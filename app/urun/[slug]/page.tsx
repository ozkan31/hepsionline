import { SiteHeader } from "@/components/site-header";
import { addToCartAction } from "@/lib/cart-actions";
import { addBundleToCartAction } from "@/lib/bundle-actions";
import { getBundleForProduct } from "@/lib/bundle";
import { subscribeStockAlertAction } from "@/lib/stock-alert-actions";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { addToFavoritesAction, removeFavoriteItemAction } from "@/lib/favorites-actions";
import { getFavoriteDetailsFromCookie, getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { buildProductSlug, parseProductIdFromSlug } from "@/lib/product-slug";
import { createPerfScope } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { resolveLocalBaseUrl } from "@/lib/runtime-port";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import GalleryClient from "./GalleryClient";
import VariantSelectorClient from "./VariantSelectorClient";

type ParamsLike = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string; smart_from?: string; smart_base?: string; smart_target?: string }>;
};

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function formatTRY(value: number) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₺${Math.round(value).toString()}`;
  }
}

function normalizeCategoryLabel(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return "Urunler";
  if (raw.toLowerCase() === "xml urun havuzu") return "Urunler";
  return raw;
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyShoeSize(value: string) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) {
    return false;
  }
  return num >= 30 && num <= 55;
}

type VariantRow = {
  option1Name: string | null;
  option1Value: string | null;
  option2Name: string | null;
  option2Value: string | null;
  option3Name: string | null;
  option3Value: string | null;
  stock: number | null;
};

type VariantOptionGroup = {
  name: string;
  values: Array<{ value: string; inStock: boolean }>;
};

type ColorLink = {
  label: string;
  href: string;
  isActive: boolean;
};

const KNOWN_COLOR_SLUGS = new Set([
  "siyah",
  "beyaz",
  "krem",
  "haki",
  "taba",
  "bej",
  "kahve",
  "mavi",
  "lacivert",
  "gri",
  "kirmizi",
  "yesil",
  "mor",
  "pembe",
  "turuncu",
  "sari",
  "bordo",
  "antrasit",
  "camel",
  "vizon",
  "ekru",
  "gold",
  "gumus",
  "nude",
  "mint",
]);

function toDisplayLabelFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildVariantOptionGroups(variants: VariantRow[]) {
  const groupMap = new Map<string, Map<string, boolean>>();
  const order: string[] = [];

  for (const variant of variants) {
    const optionPairs = [
      [variant.option1Name, variant.option1Value],
      [variant.option2Name, variant.option2Value],
      [variant.option3Name, variant.option3Value],
    ] as const;

    for (const [nameRaw, valueRaw] of optionPairs) {
      const name = (nameRaw ?? "").trim();
      const value = (valueRaw ?? "").trim();
      if (!name || !value) continue;

      if (!groupMap.has(name)) {
        groupMap.set(name, new Map());
        order.push(name);
      }

      const valueMap = groupMap.get(name)!;
      const prev = valueMap.get(value) ?? false;
      const inStock = (variant.stock ?? 0) > 0;
      valueMap.set(value, prev || inStock);
    }
  }

  const groups: VariantOptionGroup[] = order.map((name) => {
    const valueMap = groupMap.get(name)!;
    const values = Array.from(valueMap.entries()).map(([value, inStock]) => ({ value, inStock }));
    const allNumeric = values.length > 0 && values.every((item) => !Number.isNaN(Number.parseFloat(item.value)));

    values.sort((a, b) => {
      if (allNumeric) {
        return Number.parseFloat(a.value) - Number.parseFloat(b.value);
      }
      return a.value.localeCompare(b.value, "tr");
    });

    return { name, values };
  });

  return groups;
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value));
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f-${i}`} className={cn("inline-block text-sm", "text-amber-400")} aria-hidden>
          ★
        </span>
      ))}
      {half ? (
        <span className={cn("inline-block text-sm", "text-amber-400")} aria-hidden>
          ★
        </span>
      ) : null}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} className={cn("inline-block text-sm", "text-slate-300")} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

function Pill({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl px-4 py-2 text-sm transition shadow-sm",
        active ? "bg-teal-600 text-white shadow-teal-600/15" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function SizeBox({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "h-10 w-12 rounded-xl text-sm transition shadow-sm",
        active ? "bg-teal-600 text-white shadow-teal-600/15" : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200",
      )}
    >
      {children}
    </button>
  );
}

async function getProductBySlug(slug: string) {
  const perf = createPerfScope("productDetail.getProductBySlug");
  const id = parseProductIdFromSlug(slug);
  if (!id) {
    perf.flush();
    return null;
  }

  const product = await perf.time("db.product.findUnique", () =>
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sourceProductId: true,
        name: true,
        imageUrl: true,
        imageAlt: true,
        filledStars: true,
        ratingCount: true,
        price: true,
        oldPrice: true,
        quantityControl: true,
        quantity: true,
        section: {
          select: { id: true, title: true },
        },
      },
    }),
  );

  if (!product) {
    perf.flush();
    return null;
  }

  const recentlyViewed = await perf.time("cache.recentlyViewed", () => getCachedRecentlyViewedProducts(product.id));

  const [metrics, variants, imageUrls, colorLinks] = await Promise.all([
    perf.time("cache.metrics", () => getCachedProductMetrics(product.id)),
    perf.time("cache.variants", () => getCachedProductVariants(product.sourceProductId, product.name)),
    perf.time("cache.images", () => getCachedProductImages(product.sourceProductId, product.imageUrl)),
    perf.time("cache.colorLinks", () => getCachedVariantColorLinks(product.sourceProductId)),
  ]);
  const bundle = await perf.time("bundle.getBundleForProduct", () => getBundleForProduct(product.id, product.section?.id ?? null));
  const variantOptions = buildVariantOptionGroups(variants);

  const result = {
    product,
    imageUrls,
    recentlyViewed,
    reviewCount: metrics.reviewCount,
    questionCount: metrics.questionCount,
    last24HourViews: metrics.last24HourViews,
    last24HourAddToCart: metrics.last24HourAddToCart,
    variantOptions,
    colorLinks,
    bundle,
  };

  perf.flush();
  return result;
}

async function getProductSeoBySlug(slug: string) {
  const id = parseProductIdFromSlug(slug);
  if (!id) {
    return null;
  }

  return prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      imageAlt: true,
    },
  });
}

const getCachedRecentlyViewedProducts = unstable_cache(
  async (productId: number) =>
    prisma.product.findMany({
      take: 3,
      where: { id: { not: productId } },
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        imageAlt: true,
        imageBroken: true,
      },
    }),
  ["product-detail-recently-viewed"],
  { revalidate: 120 },
);

const getCachedProductMetrics = unstable_cache(
  async (productId: number) => {
    const [reviewCount, questionCount, last24HourViews, last24HourAddToCart] = await Promise.all([
      prisma.adminReview.count({
        where: {
          productId,
          isApproved: true,
        },
      }),
      prisma.adminQuestion.count({
        where: {
          productId,
          isApproved: true,
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "event:product_view",
          entity: "product",
          entityId: String(productId),
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "event:add_to_cart",
          entity: "product",
          entityId: String(productId),
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      reviewCount,
      questionCount,
      last24HourViews,
      last24HourAddToCart,
    };
  },
  ["product-detail-metrics"],
  { revalidate: 60 },
);

const getCachedProductVariants = unstable_cache(
  async (sourceProductId: string | null, productName: string) => {
    let importedProduct: { id: number; name: string } | null = null;

    if (sourceProductId) {
      importedProduct = await prisma.xmlImportedProduct.findFirst({
        where: {
          isActive: true,
          sourceProductId,
        },
        select: { id: true, name: true },
      });
    }

    if (!importedProduct) {
      const normalizedName = normalizeText(productName);
      if (!normalizedName) {
        return [];
      }

      const byName = await prisma.xmlImportedProduct.findFirst({
        where: { isActive: true, name: productName },
        select: { id: true, name: true },
        orderBy: { id: "desc" },
      });

      if (!byName || normalizeText(byName.name) !== normalizedName) {
        return [];
      }

      importedProduct = byName;
    }

    return prisma.xmlImportedProductVariant.findMany({
      where: { productId: importedProduct.id },
      select: {
        option1Name: true,
        option1Value: true,
        option2Name: true,
        option2Value: true,
        option3Name: true,
        option3Value: true,
        stock: true,
      },
      take: 200,
    });
  },
  ["product-detail-variants"],
  { revalidate: 300 },
);

const getCachedVariantColorLinks = unstable_cache(
  async (sourceProductId: string | null): Promise<ColorLink[]> => {
    if (!sourceProductId) {
      return [];
    }

    const current = await prisma.xmlImportedProduct.findUnique({
      where: { sourceProductId },
      select: {
        sourceProductId: true,
        sourceSeo: true,
        categoryCode: true,
      },
    });

    const currentSeo = (current?.sourceSeo ?? "").trim().toLowerCase();
    if (!currentSeo) {
      return [];
    }

    const parts = currentSeo.split("-").filter(Boolean);
    if (parts.length < 2) {
      return [];
    }

    const suffix = parts[parts.length - 1]!;
    if (!KNOWN_COLOR_SLUGS.has(suffix)) {
      return [];
    }

    const prefix = parts.slice(0, -1).join("-");
    const siblings = await prisma.xmlImportedProduct.findMany({
      where: {
        isActive: true,
        sourceSeo: { startsWith: `${prefix}-` },
        categoryCode: current?.categoryCode ?? undefined,
      },
      select: {
        sourceProductId: true,
        sourceSeo: true,
        name: true,
      },
      take: 40,
    });

    if (siblings.length === 0) {
      return [];
    }

    const products = await prisma.product.findMany({
      where: {
        sourceProductId: { in: siblings.map((s) => s.sourceProductId) },
      },
      select: {
        id: true,
        name: true,
        sourceProductId: true,
      },
    });

    const productBySourceId = new Map(products.map((p) => [p.sourceProductId, p]));
    const links: ColorLink[] = [];
    for (const sibling of siblings) {
      const sourceSeo = (sibling.sourceSeo ?? "").trim().toLowerCase();
      if (!sourceSeo.startsWith(`${prefix}-`)) continue;
      const siblingProduct = productBySourceId.get(sibling.sourceProductId);
      if (!siblingProduct) continue;

      const siblingParts = sourceSeo.split("-").filter(Boolean);
      const colorToken = siblingParts[siblingParts.length - 1] ?? "";
      if (!KNOWN_COLOR_SLUGS.has(colorToken)) continue;

      links.push({
        label: toDisplayLabelFromSlug(colorToken),
        href: `/urun/${buildProductSlug(siblingProduct.name, siblingProduct.id)}`,
        isActive: sibling.sourceProductId === sourceProductId,
      });
    }

    links.sort((a, b) => a.label.localeCompare(b.label, "tr"));
    return links;
  },
  ["product-detail-color-links"],
  { revalidate: 300 },
);

const getCachedProductImages = unstable_cache(
  async (sourceProductId: string | null, fallbackImageUrl: string | null) => {
    const unique = new Set<string>();

    if (fallbackImageUrl) {
      unique.add(fallbackImageUrl);
    }

    if (!sourceProductId) {
      return Array.from(unique);
    }

    const imported = await prisma.xmlImportedProduct.findUnique({
      where: { sourceProductId },
      select: {
        primaryImageUrl: true,
        imageUrls: true,
      },
    });

    if (!imported) {
      return Array.from(unique);
    }

    if (imported.primaryImageUrl) {
      unique.add(imported.primaryImageUrl);
    }

    if (Array.isArray(imported.imageUrls)) {
      for (const item of imported.imageUrls) {
        if (typeof item !== "string") {
          continue;
        }
        const trimmed = item.trim();
        if (!trimmed) {
          continue;
        }
        unique.add(trimmed);
      }
    }

    return Array.from(unique);
  },
  ["product-detail-images"],
  { revalidate: 300 },
);

export async function generateMetadata({ params }: ParamsLike): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductSeoBySlug(slug);
  if (!product) {
    return { title: "Ürün bulunamadı" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || resolveLocalBaseUrl();
  const canonicalSlug = buildProductSlug(product.name, product.id);
  const canonicalUrl = `${baseUrl}/urun/${canonicalSlug}`;
  const imageUrl =
    product.imageUrl ||
    "https://images.unsplash.com/photo-1528701800489-20be3c2ea2d6?auto=format&fit=crop&w=1200&q=70";
  const description = `${product.name} ürün detay sayfası`;

  return {
    title: product.name,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          alt: product.imageAlt || product.name,
        },
      ],
    },
  };
}

export default async function ProductDetailPage({ params, searchParams }: ParamsLike) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const [data, siteHeader, cartItemCount, favoriteItemCount, favoriteSummary, currentUser] = await Promise.all([
    getProductBySlug(slug),
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
    getFavoriteDetailsFromCookie(),
    getCurrentUserFromSession(),
  ]);

  if (!data) return notFound();

  const canonicalSlug = buildProductSlug(data.product.name, data.product.id);
  if (canonicalSlug !== slug) {
    redirect(`/urun/${canonicalSlug}`);
  }

  void prisma.adminAuditLog.create({
    data: {
      action: "event:product_view",
      actorId: currentUser?.email ?? undefined,
      entity: "product",
      entityId: String(data.product.id),
      afterJson: {
        slug: canonicalSlug,
      },
    },
  }).catch(() => {});

  const smartFrom = resolvedSearchParams?.smart_from?.trim();
  const smartBase = Number.parseInt(resolvedSearchParams?.smart_base ?? "", 10);
  const smartTarget = Number.parseInt(resolvedSearchParams?.smart_target ?? "", 10);
  if (smartFrom && Number.isInteger(smartBase) && smartBase > 0 && Number.isInteger(smartTarget) && smartTarget > 0) {
    void prisma.adminAuditLog.create({
      data: {
        action: "event:smart_bundle_click",
        actorId: currentUser?.email ?? undefined,
        entity: "product",
        entityId: String(smartTarget),
        afterJson: {
          from: smartFrom,
          baseProductId: smartBase,
          currentProductId: data.product.id,
        },
      },
    }).catch(() => {});
  }

  if (data.bundle?.source === "smart") {
    void prisma.adminAuditLog.create({
      data: {
        action: "event:smart_bundle_impression",
        actorId: currentUser?.email ?? undefined,
        entity: "product",
        entityId: String(data.product.id),
        afterJson: {
          from: "product_detail",
          baseProductId: data.bundle.items[0]?.productId ?? data.product.id,
          suggestedProductIds: data.bundle.items.slice(1).map((item) => item.productId),
          discountPercent: data.bundle.discountPercent,
        },
      },
    }).catch(() => {});
  }

  const favoriteItem = favoriteSummary.favoriteList?.items.find((item) => item.product.id === data.product.id) ?? null;

  const fallbackImage = data.product.imageUrl || "https://images.unsplash.com/photo-1528701800489-20be3c2ea2d6?auto=format&fit=crop&w=1200&q=70";
  const images = (data.imageUrls.length > 0 ? data.imageUrls : [fallbackImage]).map((url, index) => ({
    id: `${data.product.id}-${index + 1}`,
    url,
    alt: data.product.imageAlt || data.product.name || "Ürün görseli",
  }));

  const title = data.product.name;
  const categoryLabel = normalizeCategoryLabel(data.product.section?.title);

  const rating = Math.max(0, Math.min(5, data.product.filledStars));
  const reviewCount = data.reviewCount > 0 ? data.reviewCount : data.product.ratingCount;
  const questionCount = data.questionCount;

  const priceNum = Number(data.product.price);
  const compareAtNum = data.product.oldPrice ? Number(data.product.oldPrice) : null;
  const discountPct = compareAtNum && compareAtNum > priceNum ? Math.round(((compareAtNum - priceNum) / compareAtNum) * 100) : 0;

  const stock = data.product.quantityControl ? Math.max(0, data.product.quantity) : null;
  const stockLabel =
    stock === null
      ? "Stokta"
      : stock <= 0
      ? "Tukendi"
      : stock <= 10
      ? `Son ${stock} adet`
      : "Stokta";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || resolveLocalBaseUrl();
  const productUrl = `${baseUrl}/urun/${canonicalSlug}`;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    image: images.map((img) => img.url),
    category: categoryLabel,
    sku: String(data.product.id),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "TRY",
      price: String(priceNum),
      availability:
        stock !== null && stock <= 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    aggregateRating:
      reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: String(rating),
            reviewCount: String(reviewCount),
          }
        : undefined,
  };
  const isOutOfStock = stock !== null && stock <= 0;
  const notice =
    resolvedSearchParams?.status === "stock_alert_subscribed"
      ? "Stok bildirimi olusturuldu. Urun yeniden stoklandiginda e-posta alacaksiniz."
      : resolvedSearchParams?.status === "stock_alert_exists"
      ? "Bu urun icin zaten stok bildiriminiz var."
      : resolvedSearchParams?.status === "stock_alert_invalid_email"
      ? "Gecerli bir e-posta girin."
      : resolvedSearchParams?.status === "stock_alert_stock_available"
      ? "Urun su an stokta. Sepete ekleyebilirsiniz."
      : resolvedSearchParams?.status === "bundle_added"
      ? "Kombin paket sepete eklendi."
      : resolvedSearchParams?.status === "bundle_stock"
      ? "Paketteki urunlerden biri stokta degil."
      : resolvedSearchParams?.status === "bundle_invalid"
      ? "Kombin paketi olusturulamadi."
      : "";

  return (
    <>
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-4 text-sm text-slate-500">
            <Link className="hover:text-slate-700" href="/">
              Anasayfa
            </Link>{" "}
            <span className="mx-1">›</span>
            <span className="text-slate-600">{categoryLabel}</span>
            <span className="mx-1">›</span>
            <span className="text-slate-600">{title}</span>
          </div>

          <section className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-5">
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                <div className="p-4">
                  <GalleryClient images={images} />
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4">
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                <div className="p-5">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
                    {notice ? <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">{notice}</div> : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Stars value={rating} />
                    <span className="text-slate-400">•</span>
                    <span className="text-teal-700">({reviewCount} Değerlendirme)</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600">{questionCount} Soru &amp; Cevap</span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/60">
                    <div className="grid gap-2 text-sm">
                      <div className="flex gap-2">
                        <span className="w-16 text-slate-500">Kategori:</span>
                        <span className="font-medium text-slate-800">{categoryLabel}</span>
                      </div>
                    </div>

                    {data.variantOptions.length > 0 ? (
                      <VariantSelectorClient optionGroups={data.variantOptions} colorLinks={data.colorLinks} />
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-700">👁️</span>
                      <span>Son 24 saatte {data.last24HourViews} kişi görüntüledi</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-700">🛒</span>
                      <span>Son 24 saatte {data.last24HourAddToCart} kez sepete eklendi</span>
                    </div>
                  </div>
                </div>
              </div>

              {data.bundle ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
                  <div className="text-sm font-semibold text-slate-900">{data.bundle.title}</div>
                  <div className="mt-1 text-xs text-slate-600">%{data.bundle.discountPercent} kombin indirimi (ek urunlerde)</div>
                  <div className="mt-3 space-y-2">
                    {data.bundle.items.map((item, idx) => (
                      <div key={`bundle-mid-${item.productId}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt={item.imageAlt || item.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-[10px] text-slate-500">Gorsel</div>
                            )}
                          </div>
                          {idx === 0 ? (
                            <span className="line-clamp-2 text-xs text-slate-700">{item.title}</span>
                          ) : (
                            <Link
                              href={`/urun/${buildProductSlug(item.title, item.productId)}?smart_from=product_detail&smart_base=${data.product.id}&smart_target=${item.productId}`}
                              className="line-clamp-2 text-xs text-slate-700 hover:text-slate-900 hover:underline"
                            >
                              {item.title}
                            </Link>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-xs font-semibold text-slate-800">{formatTRY(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Paket normal fiyat</span>
                      <span>{formatTRY(data.bundle.baseTotal)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
                      <span>Paket fiyatı</span>
                      <span>{formatTRY(data.bundle.discountedTotal)}</span>
                    </div>
                    <div className="mt-1 text-emerald-700">Kazancınız: {formatTRY(data.bundle.savings)}</div>
                  </div>

                  <form action={addBundleToCartAction} className="mt-3">
                    <input type="hidden" name="redirectTo" value={`/urun/${canonicalSlug}`} />
                    <input type="hidden" name="discountPercent" value={data.bundle.discountPercent} />
                    <input type="hidden" name="recommendationSource" value={data.bundle.source} />
                    <input type="hidden" name="baseProductId" value={data.product.id} />
                    {data.bundle.offerId ? (
                      <input type="hidden" name="offerId" value={data.bundle.offerId} />
                    ) : (
                      <>
                        <input type="hidden" name="bundleMode" value="fallback" />
                        <input type="hidden" name="productIds" value={data.bundle.items.map((i) => i.productId).join(",")} />
                      </>
                    )}
                    <button type="submit" className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                      Paketi Sepete Ekle
                    </button>
                  </form>
                </div>
              ) : null}
            </div>

            <div className="col-span-12 lg:col-span-3">
              <div className="lg:sticky lg:top-6">
                <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                  <div className="p-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-3xl font-semibold text-slate-900">{formatTRY(priceNum)}</div>
                        {compareAtNum && compareAtNum > priceNum ? (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="text-sm text-slate-400 line-through">{formatTRY(compareAtNum)}</div>
                            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">%{discountPct} indirim</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700">🚚</span>
                      <span className="font-medium text-slate-700">Bugün Kargoda</span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50/70 px-4 py-3 ring-1 ring-slate-200/60">
                      <span className="text-sm text-slate-600">
                        Adet: <span className="font-semibold text-slate-800">{stockLabel}</span>
                      </span>
                    </div>

                    {!isOutOfStock ? (
                      <>
                        <form action={addToCartAction}>
                          <input type="hidden" name="productId" value={data.product.id} />
                          <input type="hidden" name="quantity" value={1} />
                          <input type="hidden" name="redirectTo" value={`/urun/${canonicalSlug}`} />
                          <button type="submit" className="mt-4 w-full rounded-2xl bg-teal-600 py-3 text-base font-semibold text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.99]">
                            Sepete Ekle
                          </button>
                        </form>

                        <form action={addToCartAction}>
                          <input type="hidden" name="productId" value={data.product.id} />
                          <input type="hidden" name="quantity" value={1} />
                          <input type="hidden" name="redirectTo" value="/checkout" />
                          <button type="submit" className="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]">
                            Hemen Al
                          </button>
                        </form>
                      </>
                    ) : (
                      <form action={subscribeStockAlertAction} className="mt-4 space-y-2">
                        <input type="hidden" name="productId" value={data.product.id} />
                        <input type="hidden" name="redirectTo" value={`/urun/${canonicalSlug}`} />
                        <input
                          type="email"
                          name="email"
                          defaultValue={currentUser?.email ?? ""}
                          placeholder="E-posta adresiniz"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500"
                          required
                        />
                        <button type="submit" className="w-full rounded-2xl bg-slate-900 py-3 text-base font-semibold text-white hover:bg-slate-800 active:scale-[0.99]">
                          Gelince Haber Ver
                        </button>
                      </form>
                    )}

                    <form action={favoriteItem ? removeFavoriteItemAction : addToFavoritesAction}>
                      {favoriteItem ? <input type="hidden" name="favoriteItemId" value={favoriteItem.id} /> : <input type="hidden" name="productId" value={data.product.id} />}
                      <input type="hidden" name="redirectTo" value={`/urun/${canonicalSlug}`} />
                      <button type="submit" className="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]">
                        {favoriteItem ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                      </button>
                    </form>

                    <div className="mt-5 space-y-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="text-teal-700">✓</span> 14 Gün İade
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-700">✓</span> Güvenli Ödeme
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-700">✓</span> SSL Sertifikalı
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200/60">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-teal-700">👁️</span>
                  Son 24 saatte {data.last24HourViews} kişi görüntüledi
                </div>
              </div>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
              <div className="flex flex-wrap items-center gap-6 border-b border-slate-100 px-5 py-4 text-sm">
                <button className="font-semibold text-teal-700">Ürün Açıklaması</button>
                <button className="text-slate-600 hover:text-slate-800">Özellikler</button>
                <button className="text-slate-600 hover:text-slate-800">Yorumlar ({reviewCount})</button>
                <button className="text-slate-600 hover:text-slate-800">Soru &amp; Cevap ({questionCount})</button>
              </div>

              <div className="p-5">
                <div className="rounded-2xl bg-slate-50/70 p-5 ring-1 ring-slate-200/60">
                  <h2 className="text-lg font-semibold text-slate-900">Ürün Açıklaması</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    <li>{title}</li>
                    <li>Kategori: {categoryLabel}</li>
                    <li>Fiyat: {formatTRY(priceNum)}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Benzer Ürünler</h3>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.recentlyViewed.map((p) => {
                const img = p.imageUrl;
                const pTitle = p.name;
                const pPrice = Number(p.price);
                return (
                  <Link
                    key={p.id}
                    href={`/urun/${buildProductSlug(p.name, p.id)}`}
                    className="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative overflow-hidden rounded-t-2xl bg-slate-100">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={pTitle} className="h-48 w-full object-cover" />
                      ) : (
                        <div className="h-48 w-full" />
                      )}
                      <div className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm">
                        ♡
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="line-clamp-2 text-sm font-medium text-slate-800">{pTitle}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{formatTRY(pPrice)}</div>

                      <button type="button" className="mt-3 w-full rounded-2xl bg-teal-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700">
                        Sepete Ekle
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
