import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseAfterJson(
  value: unknown,
): {
  recommendationSource?: string;
  from?: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const obj = value as Record<string, unknown>;
  return {
    recommendationSource:
      typeof obj.recommendationSource === "string"
        ? obj.recommendationSource
        : undefined,
    from: typeof obj.from === "string" ? obj.from : undefined,
  };
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

    const [impressionEvents, clickEvents, addEvents] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: {
          action: {
            in: [
              "event:smart_bundle_impression",
              "event:smart_bundle_impression_checkout",
            ],
          },
          createdAt: { gte: from },
        },
        select: {
          createdAt: true,
          afterJson: true,
        },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: "event:smart_bundle_click",
          createdAt: { gte: from },
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: {
            in: ["event:add_bundle_to_cart", "event:smart_bundle_add_checkout"],
          },
          createdAt: { gte: from },
        },
        select: {
          action: true,
          createdAt: true,
          actorId: true,
          afterJson: true,
        },
      }),
    ]);

    const placements: Record<string, number> = {};
    for (const event of impressionEvents) {
      const meta = parseAfterJson(event.afterJson);
      const key = meta.from || "unknown";
      placements[key] = (placements[key] ?? 0) + 1;
    }

    const smartAddEvents = addEvents.filter((event) => {
      if (event.action === "event:smart_bundle_add_checkout") {
        return true;
      }
      const meta = parseAfterJson(event.afterJson);
      return (
        meta.recommendationSource === "smart" ||
        meta.recommendationSource === "smart_cart" ||
        meta.recommendationSource === "smart_checkout"
      );
    });

    const sourceMap: Record<string, number> = {};
    for (const event of smartAddEvents) {
      const meta = parseAfterJson(event.afterJson);
      const source =
        event.action === "event:smart_bundle_add_checkout"
          ? "smart_checkout"
          : meta.recommendationSource ?? "unknown";
      sourceMap[source] = (sourceMap[source] ?? 0) + 1;
    }

    const smartActors = Array.from(
      new Set(
        smartAddEvents
          .map((event) => event.actorId)
          .filter((actor): actor is string => Boolean(actor)),
      ),
    );

    const assistedPurchases =
      smartActors.length > 0
        ? await prisma.adminAuditLog.count({
            where: {
              action: "event:purchase_order",
              actorId: { in: smartActors },
              createdAt: { gte: from },
            },
          })
        : 0;

    const clickCount = clickEvents.length;
    const impressions = impressionEvents.length;
    const addToCart = smartAddEvents.length;
    const ctr = impressions > 0 ? Math.round((clickCount / impressions) * 100) : 0;
    const addRateFromClicks =
      clickCount > 0 ? Math.round((addToCart / clickCount) * 100) : 0;
    const purchaseRateFromAdds =
      addToCart > 0 ? Math.round((assistedPurchases / addToCart) * 100) : 0;

    const startDay = new Date(from);
    startDay.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const dayMap = new Map<
      string,
      { date: string; impressions: number; clicks: number; adds: number }
    >();
    for (
      const cursor = new Date(startDay);
      cursor <= today;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const key = toDayKey(cursor);
      dayMap.set(key, { date: key, impressions: 0, clicks: 0, adds: 0 });
    }

    for (const event of impressionEvents) {
      const key = toDayKey(event.createdAt);
      const entry = dayMap.get(key);
      if (entry) entry.impressions += 1;
    }
    for (const event of clickEvents) {
      const key = toDayKey(event.createdAt);
      const entry = dayMap.get(key);
      if (entry) entry.clicks += 1;
    }
    for (const event of smartAddEvents) {
      const key = toDayKey(event.createdAt);
      const entry = dayMap.get(key);
      if (entry) entry.adds += 1;
    }

    const series = Array.from(dayMap.values());

    return Response.json({
      days: parsedDays.value,
      impressions,
      clicks: clickCount,
      ctr,
      addToCart,
      addRateFromClicks,
      assistedPurchases,
      purchaseRateFromAdds,
      placements: Object.entries(placements)
        .map(([placement, count]) => ({ placement, count }))
        .sort((a, b) => b.count - a.count),
      sources: Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      series,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
