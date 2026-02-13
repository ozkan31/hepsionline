import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [totalActiveCarts, cartItemsGrouped] = await Promise.all([
    prisma.cart.count(),
    prisma.cartItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
  ]);

  const totalItemsInCarts = cartItemsGrouped.reduce((sum, row) => sum + (row._sum.quantity ?? 0), 0);
  const productIds = cartItemsGrouped.map((x) => x.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return Response.json({
    totalActiveCarts,
    totalItemsInCarts,
    topVariants: cartItemsGrouped.map((row) => ({
      variantId: row.productId,
      title: productMap.get(row.productId) ?? `Ürün #${row.productId}`,
      qty: row._sum.quantity ?? 0,
    })),
  });
}

