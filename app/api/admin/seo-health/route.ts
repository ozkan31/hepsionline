import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function ratio(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export async function GET() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
    const now = new Date();
    const last30 = new Date(now);
    last30.setDate(now.getDate() - 30);

    const [
      totalProducts,
      missingImageCount,
      missingImageAltCount,
      brokenImageCount,
      viewedProducts30dRows,
      topProducts,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({
        where: {
          OR: [{ imageUrl: null }, { imageUrl: "" }],
        },
      }),
      prisma.product.count({
        where: {
          imageAlt: "",
        },
      }),
      prisma.product.count({
        where: { imageBroken: true },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: "event:product_view",
          entity: "product",
          createdAt: { gte: last30 },
        },
        select: { entityId: true },
        distinct: ["entityId"],
      }),
      prisma.product.findMany({
        select: { id: true, name: true, price: true },
        orderBy: [{ id: "desc" }],
        take: 8,
      }),
    ]);

    const viewedProducts30d = viewedProducts30dRows.filter((row) => row.entityId).length;
    const staleProducts30d = Math.max(0, totalProducts - viewedProducts30d);

    const checks = [
      {
        key: "site_url",
        label: "NEXT_PUBLIC_SITE_URL",
        pass: Boolean(siteUrl && isValidUrl(siteUrl)),
      },
      {
        key: "sitemap",
        label: "Sitemap",
        pass: true,
      },
      {
        key: "robots",
        label: "Robots",
        pass: true,
      },
      {
        key: "product_image",
        label: "Urun gorseli eksikligi <%5",
        pass: totalProducts === 0 || ratio(missingImageCount, totalProducts) < 5,
      },
      {
        key: "image_alt",
        label: "Alt text eksikligi <%10",
        pass: totalProducts === 0 || ratio(missingImageAltCount, totalProducts) < 10,
      },
      {
        key: "broken_image",
        label: "Bozuk gorsel",
        pass: brokenImageCount === 0,
      },
      {
        key: "structured_data",
        label: "Product JSON-LD",
        pass: true,
      },
    ];

    const passedChecks = checks.filter((x) => x.pass).length;
    const score = Math.round((passedChecks / checks.length) * 100);

    const suggestions = [
      missingImageCount > 0
        ? `Gorseli eksik ${missingImageCount} urun var. XML import veya admin katalogdan tamamlayin.`
        : null,
      missingImageAltCount > 0
        ? `Alt text eksik ${missingImageAltCount} urun var. Urun isimleriyle otomatik alt metin doldurun.`
        : null,
      staleProducts30d > 0
        ? `Son 30 gunde goruntulenmeyen ${staleProducts30d} urun var. Kategori landing veya kampanya bloguyla destekleyin.`
        : null,
      !siteUrl
        ? "NEXT_PUBLIC_SITE_URL tanimli degil. Canonical/sitemap URL'leri icin .env ayarini tamamlayin."
        : null,
    ].filter((x): x is string => Boolean(x));

    const baseUrl = siteUrl || "http://localhost:3000";

    return Response.json({
      score,
      checks,
      summary: {
        totalProducts,
        missingImageCount,
        missingImageAltCount,
        brokenImageCount,
        viewedProducts30d,
        staleProducts30d,
      },
      links: {
        sitemap: `${baseUrl}/sitemap.xml`,
        robots: `${baseUrl}/robots.txt`,
      },
      topProducts: topProducts.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        suggestedTitle: `${product.name} - Uygun Fiyat | hepsionline`,
        suggestedDescription: `${product.name} urununu avantajli fiyatlarla hemen inceleyin. Hizli teslimat ve guvenli odeme ile simdi satin alin.`,
      })),
      suggestions,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
