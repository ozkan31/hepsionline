import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function parseMeta(value: unknown): { couponCode?: string; discountAmount?: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const obj = value as Record<string, unknown>;
  return {
    couponCode: typeof obj.couponCode === "string" ? obj.couponCode : undefined,
    discountAmount:
      typeof obj.discountAmount === "number" ? obj.discountAmount : undefined,
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

    const [impressions, applies] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: {
          action: "event:coupon_reco_impression",
          createdAt: { gte: from },
        },
        select: {
          afterJson: true,
        },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: "event:coupon_reco_apply",
          createdAt: { gte: from },
        },
        select: {
          afterJson: true,
        },
      }),
    ]);

    const impressionCount = impressions.length;
    const applyCount = applies.length;
    const applyRate =
      impressionCount > 0 ? Math.round((applyCount / impressionCount) * 100) : 0;

    let estimatedDiscountTotalTRY = 0;
    const couponStats = new Map<string, { impressions: number; applies: number }>();

    for (const row of impressions) {
      const meta = parseMeta(row.afterJson);
      const code = meta.couponCode ?? "UNKNOWN";
      const entry = couponStats.get(code) ?? { impressions: 0, applies: 0 };
      entry.impressions += 1;
      couponStats.set(code, entry);
    }

    for (const row of applies) {
      const meta = parseMeta(row.afterJson);
      const code = meta.couponCode ?? "UNKNOWN";
      const entry = couponStats.get(code) ?? { impressions: 0, applies: 0 };
      entry.applies += 1;
      couponStats.set(code, entry);
      estimatedDiscountTotalTRY += Math.max(0, Number(meta.discountAmount ?? 0));
    }

    const topCoupons = Array.from(couponStats.entries())
      .map(([couponCode, stats]) => ({
        couponCode,
        impressions: stats.impressions,
        applies: stats.applies,
        applyRate:
          stats.impressions > 0
            ? Math.round((stats.applies / stats.impressions) * 100)
            : 0,
      }))
      .sort((a, b) => {
        if (b.applies !== a.applies) return b.applies - a.applies;
        if (b.impressions !== a.impressions) return b.impressions - a.impressions;
        return a.couponCode.localeCompare(b.couponCode);
      })
      .slice(0, 6);

    return Response.json({
      days: parsedDays.value,
      impressions: impressionCount,
      applies: applyCount,
      applyRate,
      estimatedDiscountTotalTRY,
      topCoupons,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

