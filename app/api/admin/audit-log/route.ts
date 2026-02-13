import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [orders, coupons] = await Promise.all([
    prisma.order.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        updatedAt: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
      },
    }),
    prisma.coupon.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        code: true,
        isActive: true,
        updatedAt: true,
      },
    }),
  ]);

  const events = [
    ...orders.map((order) => ({
      type: "order",
      entityId: order.id,
      updatedAt: order.updatedAt,
      payload: order,
    })),
    ...coupons.map((coupon) => ({
      type: "coupon",
      entityId: coupon.id,
      updatedAt: coupon.updatedAt,
      payload: coupon,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return Response.json({ events });
}


