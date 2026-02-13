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

    const from = daysAgo(parsedDays.value);

    const [products, events] = await Promise.all([
      prisma.product.findMany({
        select: { id: true, name: true, imageUrl: true },
        take: 500,
      }),
      prisma.adminAuditLog.findMany({
        where: { createdAt: { gte: from } },
        select: {
          action: true,
          entityId: true,
          afterJson: true,
        },
      }),
    ]);

    const stats = new Map<number, { salesQty: number; revenueTRY: number; addToCart: number; views: number }>();
    for (const p of products) {
      stats.set(p.id, { salesQty: 0, revenueTRY: 0, addToCart: 0, views: 0 });
    }

    for (const event of events) {
      const productId = Number.parseInt(event.entityId ?? "", 10);
      if (!Number.isFinite(productId) || productId <= 0) {
        continue;
      }

      const stat = stats.get(productId) ?? { salesQty: 0, revenueTRY: 0, addToCart: 0, views: 0 };
      const payload =
        event.afterJson && typeof event.afterJson === "object" && !Array.isArray(event.afterJson)
          ? (event.afterJson as Record<string, unknown>)
          : null;

      if (event.action === "event:product_view") {
        stat.views += 1;
        stats.set(productId, stat);
        continue;
      }

      if (event.action === "event:add_to_cart") {
        const quantity =
          payload && typeof payload.quantity === "number"
            ? Math.max(1, Math.floor(payload.quantity))
            : 1;

        stat.addToCart += quantity;
        stats.set(productId, stat);
        continue;
      }

      if (event.action === "event:purchase_item") {
        const quantity =
          payload && typeof payload.quantity === "number"
            ? Math.max(1, Math.floor(payload.quantity))
            : 1;
        const totalPrice =
          payload && typeof payload.totalPrice === "number"
            ? Math.max(0, Math.floor(payload.totalPrice))
            : 0;

        stat.salesQty += quantity;
        stat.revenueTRY += totalPrice;
        stats.set(productId, stat);
      }
    }

    const rows = products
      .map((p) => {
        const st = stats.get(p.id) ?? { salesQty: 0, revenueTRY: 0, addToCart: 0, views: 0 };
        const views = st.views;
        const addRate = views > 0 ? Math.round((st.addToCart / views) * 100) : 0;
        const conversion = views > 0 ? Math.round((st.salesQty / views) * 100) : 0;
        return {
          productId: p.id,
          title: p.name,
          image: p.imageUrl,
          views,
          addToCart: st.addToCart,
          addRate,
          salesQty: st.salesQty,
          revenueTRY: st.revenueTRY,
          conversion,
        };
      })
      .sort((a, b) => b.revenueTRY - a.revenueTRY);

    return Response.json({ rows });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
