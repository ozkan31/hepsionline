import { jsonError, parseBoundedInt } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function safeMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedDays = parseBoundedInt(searchParams.get("days"), {
      defaultValue: 30,
      min: 7,
      max: 365,
      paramName: "days",
    });
    if (!parsedDays.ok) return parsedDays.response;

    const days = parsedDays.value;
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - (days - 1));
    const fromStart = startOfDay(from);

    const [coupons, usages, impressions, applies] = await Promise.all([
      prisma.coupon.findMany({
        select: {
          id: true,
          code: true,
          type: true,
          value: true,
          isActive: true,
          expiresAt: true,
        },
      }),
      prisma.couponUsage.findMany({
        where: { usedAt: { gte: fromStart } },
        select: {
          couponId: true,
          discountAmount: true,
          usedAt: true,
          userEmail: true,
          order: {
            select: {
              id: true,
              totalAmount: true,
              paymentStatus: true,
              customerEmail: true,
            },
          },
        },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: "event:coupon_reco_impression",
          createdAt: { gte: fromStart },
        },
        select: { createdAt: true, afterJson: true },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: "event:coupon_reco_apply",
          createdAt: { gte: fromStart },
        },
        select: { afterJson: true },
      }),
    ]);

    const couponById = new Map(coupons.map((c) => [c.id, c]));
    const byCoupon = new Map<
      number,
      {
        couponId: number;
        code: string;
        type: "FIXED" | "PERCENT";
        value: number;
        uses: number;
        paidOrders: number;
        discountTotalTRY: number;
        grossRevenueTRY: number;
        netRevenueTRY: number;
        uniqueUsers: Set<string>;
      }
    >();
    const usersByEmail = new Map<string, number>();

    for (const usage of usages) {
      const coupon = couponById.get(usage.couponId);
      if (!coupon) continue;
      const row =
        byCoupon.get(usage.couponId) ??
        {
          couponId: usage.couponId,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          uses: 0,
          paidOrders: 0,
          discountTotalTRY: 0,
          grossRevenueTRY: 0,
          netRevenueTRY: 0,
          uniqueUsers: new Set<string>(),
        };
      row.uses += 1;
      row.discountTotalTRY += Math.max(0, Number(usage.discountAmount ?? 0));
      const gross = Math.max(0, Number(usage.order?.totalAmount ?? 0));
      row.grossRevenueTRY += gross;
      row.netRevenueTRY += Math.max(0, gross - Math.max(0, Number(usage.discountAmount ?? 0)));
      if (usage.order?.paymentStatus === "PAID") row.paidOrders += 1;

      const emailRaw = usage.userEmail ?? usage.order?.customerEmail ?? "";
      const email = emailRaw.trim().toLowerCase();
      if (email) {
        row.uniqueUsers.add(email);
        usersByEmail.set(email, (usersByEmail.get(email) ?? 0) + 1);
      }
      byCoupon.set(usage.couponId, row);
    }

    const dayMap = new Map<
      string,
      { day: string; impressions: number; applies: number; discountTRY: number; revenueTRY: number }
    >();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(fromStart);
      d.setDate(fromStart.getDate() + i);
      const key = dayKey(d);
      dayMap.set(key, {
        day: key,
        impressions: 0,
        applies: 0,
        discountTRY: 0,
        revenueTRY: 0,
      });
    }

    for (const row of impressions) {
      const key = dayKey(new Date(row.createdAt));
      const item = dayMap.get(key);
      if (item) item.impressions += 1;
    }
    for (const usage of usages) {
      const key = dayKey(new Date(usage.usedAt));
      const item = dayMap.get(key);
      if (!item) continue;
      item.applies += 1;
      item.discountTRY += Math.max(0, Number(usage.discountAmount ?? 0));
      item.revenueTRY += Math.max(0, Number(usage.order?.totalAmount ?? 0));
    }

    const recommendationApplyCount = applies.length;
    const directApplyCount = Math.max(0, usages.length - recommendationApplyCount);
    let recommendationImpressionCount = impressions.length;
    const recommendationMetaByCode = new Map<string, { impressions: number; applies: number }>();
    for (const row of impressions) {
      const meta = safeMeta(row.afterJson);
      const code = String(meta.couponCode ?? "UNKNOWN").toUpperCase();
      const stats = recommendationMetaByCode.get(code) ?? { impressions: 0, applies: 0 };
      stats.impressions += 1;
      recommendationMetaByCode.set(code, stats);
    }
    for (const row of applies) {
      const meta = safeMeta(row.afterJson);
      const code = String(meta.couponCode ?? "UNKNOWN").toUpperCase();
      const stats = recommendationMetaByCode.get(code) ?? { impressions: 0, applies: 0 };
      stats.applies += 1;
      recommendationMetaByCode.set(code, stats);
    }
    if (recommendationImpressionCount < recommendationApplyCount) {
      recommendationImpressionCount = recommendationApplyCount;
    }

    const totalDiscountTRY = usages.reduce(
      (sum, row) => sum + Math.max(0, Number(row.discountAmount ?? 0)),
      0,
    );
    const totalRevenueTRY = usages.reduce(
      (sum, row) => sum + Math.max(0, Number(row.order?.totalAmount ?? 0)),
      0,
    );
    const paidOrderCount = usages.reduce(
      (sum, row) => sum + (row.order?.paymentStatus === "PAID" ? 1 : 0),
      0,
    );
    const uniqueUsers = usersByEmail.size;
    const newUsers = Array.from(usersByEmail.values()).filter((count) => count === 1).length;
    const returningUsers = Math.max(0, uniqueUsers - newUsers);

    const couponRows = Array.from(byCoupon.values())
      .map((row) => ({
        couponId: row.couponId,
        code: row.code,
        type: row.type,
        value: row.value,
        uses: row.uses,
        paidOrders: row.paidOrders,
        conversionRate: row.uses > 0 ? Math.round((row.paidOrders / row.uses) * 100) : 0,
        uniqueUsers: row.uniqueUsers.size,
        discountTotalTRY: row.discountTotalTRY,
        grossRevenueTRY: row.grossRevenueTRY,
        netRevenueTRY: row.netRevenueTRY,
      }))
      .sort((a, b) => {
        if (b.netRevenueTRY !== a.netRevenueTRY) return b.netRevenueTRY - a.netRevenueTRY;
        if (b.uses !== a.uses) return b.uses - a.uses;
        return a.code.localeCompare(b.code);
      })
      .slice(0, 20);

    const recommendations = couponRows
      .filter((row) => row.uses >= 5)
      .map((row) => ({
        code: row.code,
        suggestion:
          row.conversionRate < 30
            ? "Dusuk donusum. Kupon kosullarini sadeleştirip degeri optimize edin."
            : row.discountTotalTRY > row.netRevenueTRY * 0.35
              ? "Indirim maliyeti yuksek. Maksimum indirim veya min. sepet kosulunu artirin."
              : "Performans iyi. Daha fazla gorunurluk icin checkout onerisine ekleyin.",
      }))
      .slice(0, 4);

    return Response.json({
      days,
      summary: {
        couponCount: coupons.length,
        activeCouponCount: coupons.filter((c) => c.isActive).length,
        applies: usages.length,
        paidOrders: paidOrderCount,
        conversionRate: usages.length > 0 ? Math.round((paidOrderCount / usages.length) * 100) : 0,
        recommendationImpressions: recommendationImpressionCount,
        recommendationApplies: recommendationApplyCount,
        recommendationApplyRate:
          recommendationImpressionCount > 0
            ? Math.round((recommendationApplyCount / recommendationImpressionCount) * 100)
            : 0,
        totalDiscountTRY,
        totalRevenueTRY,
        netRevenueTRY: Math.max(0, totalRevenueTRY - totalDiscountTRY),
        avgOrderValueTRY: paidOrderCount > 0 ? Math.round(totalRevenueTRY / paidOrderCount) : 0,
      },
      segments: {
        customerType: [
          { label: "Yeni", value: newUsers },
          { label: "Mevcut", value: returningUsers },
        ],
        channel: [
          { label: "Otomatik Oneri", value: recommendationApplyCount },
          { label: "Manuel Giris", value: directApplyCount },
        ],
      },
      trend: Array.from(dayMap.values()),
      byCoupon: couponRows,
      recommendations,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
