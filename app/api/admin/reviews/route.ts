import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [rows, products] = await Promise.all([
    prisma.adminReview.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    prisma.xmlImportedProduct.findMany({
      select: { id: true, name: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  return Response.json(
    rows.map((r) => ({
      ...r,
      product: r.productId ? { title: productMap.get(r.productId)?.name ?? "Ürün" } : null,
      user: { email: r.userEmail ?? "-" },
    }))
  );
}

