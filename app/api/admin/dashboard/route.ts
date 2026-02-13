import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    productCount,
    orderCount,
    couponCount,
    categoryCount,
    userCount,
    paidRevenue,
    pendingOrderCount,
    deliveredOrderCount,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.coupon.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: "PAID" },
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
  ]);

  return Response.json({
    metrics: {
      productCount,
      orderCount,
      couponCount,
      categoryCount,
      userCount,
      paidRevenue: paidRevenue._sum.totalAmount ?? 0,
      pendingOrderCount,
      deliveredOrderCount,
    },
  });
}


