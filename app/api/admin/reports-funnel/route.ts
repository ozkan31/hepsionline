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

    const [views, addToCartCount, checkoutStart, purchases] = await Promise.all([
      prisma.adminAuditLog.count({
        where: {
          action: "event:product_view",
          createdAt: { gte: from },
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "event:add_to_cart",
          createdAt: { gte: from },
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "event:checkout_start",
          createdAt: { gte: from },
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "event:purchase_order",
          createdAt: { gte: from },
        },
      }),
    ]);

    const addToCartRate = views > 0 ? Math.round((addToCartCount / views) * 100) : 0;
    const checkoutRate = addToCartCount > 0 ? Math.round((checkoutStart / addToCartCount) * 100) : 0;
    const conversionRate = views > 0 ? Math.round((purchases / views) * 100) : 0;
    const checkoutToPurchaseRate = checkoutStart > 0 ? Math.round((purchases / checkoutStart) * 100) : 0;

    return Response.json({
      views,
      addToCart: addToCartCount,
      checkoutStart,
      purchases,
      addToCartRate,
      checkoutRate,
      conversionRate,
      checkoutToPurchaseRate,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
