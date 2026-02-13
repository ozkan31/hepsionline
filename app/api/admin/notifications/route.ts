import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  message: string;
  action?: string;
  createdAt: Date;
};

export async function GET() {
  const [orders, couponUsages] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        orderNo: true,
        createdAt: true,
        paymentStatus: true,
        status: true,
      },
    }),
    prisma.couponUsage.findMany({
      orderBy: { usedAt: "desc" },
      take: 12,
      select: {
        id: true,
        usedAt: true,
        coupon: { select: { code: true } },
      },
    }),
  ]);

  const orderEvents: EventRow[] = orders.map((order) => ({
    id: `order-${order.id}`,
    message: `SipariÅŸ #${order.orderNo ?? order.id} - ${order.status} / ${order.paymentStatus}`,
    action: "order_update",
    createdAt: order.createdAt,
  }));

  const couponEvents: EventRow[] = couponUsages.map((usage) => ({
    id: `coupon-${usage.id}`,
    message: `Kupon kullanÄ±ldÄ±: ${usage.coupon.code}`,
    action: "coupon_used",
    createdAt: usage.usedAt,
  }));

  const events = [...orderEvents, ...couponEvents]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map((x) => ({
      id: x.id,
      message: x.message,
      action: x.action,
      createdAt: x.createdAt.toISOString(),
    }));

  return Response.json(events);
}


