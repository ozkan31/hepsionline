import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedDays = parseBoundedInt(searchParams.get("days"), {
      defaultValue: 30,
      min: 1,
      max: 365,
      paramName: "days",
    });
    if (!parsedDays.ok) return parsedDays.response;

    const days = parsedDays.value;
    const from = daysAgo(days);
    const stalePendingFrom = new Date(Date.now() - 30 * 60 * 1000);

    const [paidOrders, failedOrders, pendingOrders, stalePendingOrders, failedReasonRows, paidRevenue] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: from },
          paymentStatus: "PAID",
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: from },
          paymentStatus: "FAILED",
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: from },
          paymentStatus: "PENDING",
        },
      }),
      prisma.order.count({
        where: {
          paymentStatus: "PENDING",
          status: "PENDING",
          createdAt: { lte: stalePendingFrom },
        },
      }),
      prisma.order.groupBy({
        by: ["paytrFailedReasonCode"],
        where: {
          createdAt: { gte: from },
          paymentStatus: "FAILED",
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _count: {
            paytrFailedReasonCode: "desc",
          },
        },
        take: 10,
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: from },
          paymentStatus: "PAID",
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return Response.json({
      rangeDays: days,
      paidOrders,
      failedOrders,
      pendingOrders,
      stalePendingOrders,
      paidRevenueTRY: paidRevenue._sum.totalAmount ?? 0,
      failedReasons: failedReasonRows.map((row) => ({
        code: row.paytrFailedReasonCode ?? "UNKNOWN",
        count: row._count._all,
      })),
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
