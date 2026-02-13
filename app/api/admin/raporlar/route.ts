import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function GET() {
  const [pending, preparing, shipped, delivered, cancelled, last30Orders, last30Revenue] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PREPARING" } }),
    prisma.order.count({ where: { status: "SHIPPED" } }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.order.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: daysAgo(30) },
        paymentStatus: "PAID",
      },
    }),
  ]);

  return Response.json({
    orderStatus: {
      pending,
      preparing,
      shipped,
      delivered,
      cancelled,
    },
    last30Days: {
      orderCount: last30Orders,
      paidRevenue: last30Revenue._sum.totalAmount ?? 0,
    },
  });
}


