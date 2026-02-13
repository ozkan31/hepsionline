import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.adminReturnRequest.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    const orderIds = Array.from(new Set(rows.map((x) => x.orderId).filter((x): x is number => typeof x === "number")));
    const orderItemIds = Array.from(
      new Set(rows.map((x) => x.orderItemId).filter((x): x is number => typeof x === "number"))
    );

    const [orders, orderItems] = await Promise.all([
      orderIds.length
        ? prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, orderNo: true, customerEmail: true },
          })
        : Promise.resolve([]),
      orderItemIds.length
        ? prisma.orderItem.findMany({
            where: { id: { in: orderItemIds } },
            select: { id: true, productName: true },
          })
        : Promise.resolve([]),
    ]);

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const orderItemMap = new Map(orderItems.map((i) => [i.id, i]));

    return Response.json(
      rows.map((r) => ({
        ...r,
        order: r.orderId ? { orderNo: orderMap.get(r.orderId)?.orderNo ?? r.orderId, customerEmail: orderMap.get(r.orderId)?.customerEmail } : null,
        orderItem: r.orderItemId ? { title: orderItemMap.get(r.orderItemId)?.productName ?? "-" } : null,
        user: { email: r.userEmail ?? orderMap.get(r.orderId ?? -1)?.customerEmail ?? "-" },
      }))
    );
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
