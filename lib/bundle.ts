import { prisma } from "@/lib/prisma";

type BundleItem = {
  productId: number;
  quantity: number;
  title: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPrice: number;
};

export type BundleViewModel = {
  offerId: number | null;
  title: string;
  discountPercent: number;
  items: BundleItem[];
  baseTotal: number;
  discountedTotal: number;
  savings: number;
  source: "offer" | "smart" | "fallback";
};

function clampDiscountPercent(value: number) {
  return Math.max(0, Math.min(40, Math.floor(value)));
}

function calcBundleTotals(items: BundleItem[], discountPercent: number) {
  const pct = clampDiscountPercent(discountPercent);
  const baseTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountedTotal = items.reduce((sum, item, idx) => {
    const line = item.unitPrice * item.quantity;
    if (idx === 0) return sum + line;
    const discountedLine = Math.max(1, Math.floor(line * (1 - pct / 100)));
    return sum + discountedLine;
  }, 0);
  return {
    baseTotal,
    discountedTotal,
    savings: Math.max(0, baseTotal - discountedTotal),
  };
}

async function getSmartCoPurchaseItems(baseProductId: number, limit = 2) {
  const baseOrderRows = await prisma.orderItem.findMany({
    where: {
      productId: baseProductId,
      order: {
        paymentStatus: "PAID",
      },
    },
    orderBy: [{ orderId: "desc" }],
    take: 300,
    select: {
      orderId: true,
    },
  });

  const orderIds = Array.from(new Set(baseOrderRows.map((row) => row.orderId)));
  if (orderIds.length === 0) {
    return [];
  }

  const siblingRows = await prisma.orderItem.findMany({
    where: {
      orderId: {
        in: orderIds,
      },
      AND: [{ productId: { not: null } }, { productId: { not: baseProductId } }],
    },
    select: {
      orderId: true,
      productId: true,
      quantity: true,
    },
  });

  if (siblingRows.length === 0) {
    return [];
  }

  const scoreMap = new Map<number, { orderSet: Set<number>; qty: number }>();
  for (const row of siblingRows) {
    if (!row.productId) continue;
    const entry = scoreMap.get(row.productId) ?? { orderSet: new Set<number>(), qty: 0 };
    entry.orderSet.add(row.orderId);
    entry.qty += Math.max(1, row.quantity);
    scoreMap.set(row.productId, entry);
  }

  const sorted = Array.from(scoreMap.entries())
    .map(([productId, metric]) => ({
      productId,
      orderHits: metric.orderSet.size,
      qty: metric.qty,
    }))
    .sort((a, b) => {
      if (b.orderHits !== a.orderHits) return b.orderHits - a.orderHits;
      if (b.qty !== a.qty) return b.qty - a.qty;
      return a.productId - b.productId;
    })
    .slice(0, Math.max(1, limit));

  if (sorted.length === 0) {
    return [];
  }

  const suggestedProducts = await prisma.product.findMany({
    where: {
      id: {
        in: sorted.map((row) => row.productId),
      },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      imageAlt: true,
      price: true,
      quantityControl: true,
      quantity: true,
    },
  });

  const productById = new Map(suggestedProducts.map((row) => [row.id, row]));
  return sorted
    .map((row) => productById.get(row.productId))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row) => !row.quantityControl || row.quantity > 0)
    .slice(0, limit);
}

export async function getBundleForProduct(productId: number, sectionId?: number | null): Promise<BundleViewModel | null> {
  const offer = await prisma.bundleOffer.findFirst({
    where: {
      isActive: true,
      primaryProductId: productId,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      primaryProduct: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          imageAlt: true,
          price: true,
        },
      },
      items: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              imageAlt: true,
              price: true,
            },
          },
        },
      },
    },
  });

  if (offer && offer.items.length > 0) {
    const items: BundleItem[] = [
      {
        productId: offer.primaryProduct.id,
        quantity: 1,
        title: offer.primaryProduct.name,
        imageUrl: offer.primaryProduct.imageUrl,
        imageAlt: offer.primaryProduct.imageAlt,
        unitPrice: offer.primaryProduct.price,
      },
      ...offer.items.map((item) => ({
        productId: item.product.id,
        quantity: Math.max(1, item.quantity),
        title: item.product.name,
        imageUrl: item.product.imageUrl,
        imageAlt: item.product.imageAlt,
        unitPrice: item.product.price,
      })),
    ];

    const totals = calcBundleTotals(items, offer.discountPercent);
    return {
      offerId: offer.id,
      title: offer.title?.trim() || "Birlikte Al",
      discountPercent: clampDiscountPercent(offer.discountPercent),
      items,
      source: "offer",
      ...totals,
    };
  }

  const main = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      imageAlt: true,
      price: true,
    },
  });
  if (!main) return null;

  const smartCandidates = await getSmartCoPurchaseItems(productId, 2);
  if (smartCandidates.length > 0) {
    const items: BundleItem[] = [
      {
        productId: main.id,
        quantity: 1,
        title: main.name,
        imageUrl: main.imageUrl,
        imageAlt: main.imageAlt,
        unitPrice: main.price,
      },
      ...smartCandidates.map((p) => ({
        productId: p.id,
        quantity: 1,
        title: p.name,
        imageUrl: p.imageUrl,
        imageAlt: p.imageAlt,
        unitPrice: p.price,
      })),
    ];

    const discountPercent = 9;
    const totals = calcBundleTotals(items, discountPercent);
    return {
      offerId: null,
      title: "Birlikte Al (Akilli Oneri)",
      discountPercent,
      items,
      source: "smart",
      ...totals,
    };
  }

  if (!sectionId) return null;
  const fallbackProducts = await prisma.product.findMany({
    where: {
      sectionId,
      id: { not: productId },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: 2,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      imageAlt: true,
      price: true,
    },
  });
  if (fallbackProducts.length < 2) return null;

  const items: BundleItem[] = [
    {
      productId: main.id,
      quantity: 1,
      title: main.name,
      imageUrl: main.imageUrl,
      imageAlt: main.imageAlt,
      unitPrice: main.price,
    },
    ...fallbackProducts.map((p) => ({
      productId: p.id,
      quantity: 1,
      title: p.name,
      imageUrl: p.imageUrl,
      imageAlt: p.imageAlt,
      unitPrice: p.price,
    })),
  ];
  const discountPercent = 7;
  const totals = calcBundleTotals(items, discountPercent);
  return {
    offerId: null,
    title: "Birlikte Al",
    discountPercent,
    items,
    source: "fallback",
    ...totals,
  };
}

export async function getSmartBundleForCart(cartProductIds: number[]): Promise<BundleViewModel | null> {
  const normalized = Array.from(new Set(cartProductIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (normalized.length === 0) return null;

  for (const baseProductId of normalized) {
    const main = await prisma.product.findUnique({
      where: { id: baseProductId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        imageAlt: true,
        price: true,
      },
    });
    if (!main) continue;

    const smartCandidates = await getSmartCoPurchaseItems(baseProductId, 2);
    if (smartCandidates.length === 0) continue;

    const filteredItems: BundleItem[] = [
      {
        productId: main.id,
        quantity: 1,
        title: main.name,
        imageUrl: main.imageUrl,
        imageAlt: main.imageAlt,
        unitPrice: main.price,
      },
      ...smartCandidates
        .filter((item) => !normalized.includes(item.id))
        .map((item) => ({
          productId: item.id,
          quantity: 1,
          title: item.name,
          imageUrl: item.imageUrl,
          imageAlt: item.imageAlt,
          unitPrice: item.price,
        })),
    ];
    if (filteredItems.length < 2) {
      continue;
    }

    const discountPercent = 9;
    const totals = calcBundleTotals(filteredItems, discountPercent);
    return {
      offerId: null,
      title: "Birlikte Al (Akilli Oneri)",
      discountPercent,
      items: filteredItems,
      source: "smart",
      ...totals,
    };
  }

  return null;
}

export function calcDiscountedUnitPrice(unitPrice: number, index: number, discountPercent: number) {
  if (index === 0) return unitPrice;
  const pct = clampDiscountPercent(discountPercent);
  return Math.max(1, Math.floor(unitPrice * (1 - pct / 100)));
}
