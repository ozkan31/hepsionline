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
    const testKey = (searchParams.get("testKey") ?? "").trim();
    if (!testKey) {
      return jsonError(400, "INVALID_QUERY", "testKey is required.");
    }

    const parsedDays = parseBoundedInt(searchParams.get("days"), {
      defaultValue: 30,
      min: 1,
      max: 365,
      paramName: "days",
    });
    if (!parsedDays.ok) return parsedDays.response;

    const from = daysAgo(parsedDays.value);

    const events = await prisma.adminAuditLog.findMany({
      where: {
        createdAt: { gte: from },
        action: {
          startsWith: `ab:${testKey}:`,
        },
      },
      select: {
        action: true,
      },
    });

    const variants = new Map<string, { views: number; addToCart: number; checkoutStart: number; purchases: number }>();
    const ensure = (v: string) => {
      if (!variants.has(v)) variants.set(v, { views: 0, addToCart: 0, checkoutStart: 0, purchases: 0 });
      return variants.get(v)!;
    };

    for (const e of events) {
      const parts = e.action.split(":");
      const variant = parts[2] || "A";
      const metric = parts[3] || "view";
      const row = ensure(variant);
      if (metric === "view") row.views += 1;
      if (metric === "add_to_cart") row.addToCart += 1;
      if (metric === "checkout_start") row.checkoutStart += 1;
      if (metric === "purchase") row.purchases += 1;
    }

    if (variants.size === 0) {
      variants.set("A", { views: 0, addToCart: 0, checkoutStart: 0, purchases: 0 });
      variants.set("B", { views: 0, addToCart: 0, checkoutStart: 0, purchases: 0 });
    }

    const rows = Array.from(variants.entries()).map(([variant, m]) => {
      const addRate = m.views > 0 ? Math.round((m.addToCart / m.views) * 100) : 0;
      const purchaseRate = m.views > 0 ? Math.round((m.purchases / m.views) * 100) : 0;
      const checkoutToPurchaseRate = m.checkoutStart > 0 ? Math.round((m.purchases / m.checkoutStart) * 100) : 0;
      return {
        variant,
        views: m.views,
        addToCart: m.addToCart,
        checkoutStart: m.checkoutStart,
        purchases: m.purchases,
        addRate,
        purchaseRate,
        checkoutToPurchaseRate,
      };
    });

    return Response.json({ rows });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
