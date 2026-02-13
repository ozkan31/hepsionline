import { jsonError, parseBoundedInt, readJsonObject } from "@/lib/api-response";
import {
  COUPON_AB_TEST_KEY,
  parseCouponAbExperiment,
} from "@/lib/coupon-ab-test";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeCode(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizePercent(raw: unknown, fallback: number) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.max(0, Math.min(100, Math.floor(raw)));
}

function normalizeForceVariant(raw: unknown) {
  if (raw === "A" || raw === "B") return raw;
  if (raw === null || raw === "NONE") return null;
  return undefined;
}

async function buildStats(days: number, couponA: string, couponB: string) {
  const from = daysAgo(days);

  const [impressions, applies, usages] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: {
        action: "event:coupon_ab_impression",
        createdAt: { gte: from },
      },
      select: { afterJson: true },
    }),
    prisma.adminAuditLog.findMany({
      where: {
        action: "event:coupon_ab_apply",
        createdAt: { gte: from },
      },
      select: { afterJson: true },
    }),
    prisma.couponUsage.findMany({
      where: {
        usedAt: { gte: from },
        coupon: {
          code: {
            in: [couponA, couponB].filter((x) => x.length > 0),
          },
        },
      },
      select: {
        discountAmount: true,
        coupon: { select: { code: true } },
        order: { select: { paymentStatus: true, totalAmount: true } },
      },
    }),
  ]);

  const base = {
    A: { variant: "A" as const, couponCode: couponA, impressions: 0, applies: 0, paidOrders: 0, discountTRY: 0, revenueTRY: 0, netTRY: 0, applyRate: 0, purchaseRate: 0 },
    B: { variant: "B" as const, couponCode: couponB, impressions: 0, applies: 0, paidOrders: 0, discountTRY: 0, revenueTRY: 0, netTRY: 0, applyRate: 0, purchaseRate: 0 },
  };

  for (const row of impressions) {
    const meta = safeObject(row.afterJson);
    const variant = meta.variant === "A" || meta.variant === "B" ? meta.variant : null;
    if (!variant) continue;
    base[variant].impressions += 1;
  }

  for (const row of applies) {
    const meta = safeObject(row.afterJson);
    const variant = meta.variant === "A" || meta.variant === "B" ? meta.variant : null;
    if (!variant) continue;
    base[variant].applies += 1;
  }

  for (const row of usages) {
    const code = row.coupon.code;
    const variant = code === couponA ? "A" : code === couponB ? "B" : null;
    if (!variant) continue;
    base[variant].discountTRY += Math.max(0, Number(row.discountAmount ?? 0));
    const orderTotal = Math.max(0, Number(row.order?.totalAmount ?? 0));
    if (row.order?.paymentStatus === "PAID") {
      base[variant].paidOrders += 1;
      base[variant].revenueTRY += orderTotal;
      base[variant].netTRY += Math.max(0, orderTotal - Math.max(0, Number(row.discountAmount ?? 0)));
    }
  }

  for (const key of ["A", "B"] as const) {
    const row = base[key];
    row.applyRate = row.impressions > 0 ? Math.round((row.applies / row.impressions) * 100) : 0;
    row.purchaseRate = row.applies > 0 ? Math.round((row.paidOrders / row.applies) * 100) : 0;
  }

  let winner: "A" | "B" | null = null;
  if (base.A.netTRY !== base.B.netTRY) {
    winner = base.A.netTRY > base.B.netTRY ? "A" : "B";
  } else if (base.A.paidOrders !== base.B.paidOrders) {
    winner = base.A.paidOrders > base.B.paidOrders ? "A" : "B";
  } else if (base.A.applyRate !== base.B.applyRate) {
    winner = base.A.applyRate > base.B.applyRate ? "A" : "B";
  }

  return {
    days,
    variants: [base.A, base.B],
    suggestedWinner: winner,
  };
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedDays = parseBoundedInt(searchParams.get("days"), {
      defaultValue: 30,
      min: 7,
      max: 180,
      paramName: "days",
    });
    if (!parsedDays.ok) return parsedDays.response;

    const settings = await prisma.adminSetting.findUnique({
      where: { id: 1 },
      select: { abTests: true },
    });

    const ab = safeObject(settings?.abTests);
    const experiments = safeObject(ab.experiments);
    const experiment = parseCouponAbExperiment(experiments[COUPON_AB_TEST_KEY]);
    const stats = await buildStats(
      parsedDays.value,
      experiment.variants.A.couponCode,
      experiment.variants.B.couponCode,
    );

    return Response.json({
      globalEnabled: Boolean(ab.enabled),
      experiment,
      stats,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }

    const settings = await prisma.adminSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        abTests: {
          enabled: false,
          experiments: {},
        },
      },
      select: { abTests: true },
    });

    const ab = safeObject(settings.abTests);
    const experiments = safeObject(ab.experiments);
    const current = parseCouponAbExperiment(experiments[COUPON_AB_TEST_KEY]);

    const next = {
      enabled:
        typeof body.enabled === "boolean" ? body.enabled : current.enabled,
      traffic: normalizePercent(body.traffic, current.traffic),
      splitA: normalizePercent(body.splitA, current.splitA),
      forceVariant:
        normalizeForceVariant(body.forceVariant) === undefined
          ? current.forceVariant
          : normalizeForceVariant(body.forceVariant),
      variants: {
        A: {
          couponCode:
            normalizeCode(body.couponCodeA) || current.variants.A.couponCode,
        },
        B: {
          couponCode:
            normalizeCode(body.couponCodeB) || current.variants.B.couponCode,
        },
      },
    };

    const nextAb = {
      ...ab,
      experiments: {
        ...experiments,
        [COUPON_AB_TEST_KEY]: next,
      },
    };

    const updated = await prisma.adminSetting.update({
      where: { id: 1 },
      data: {
        abTests: nextAb as Prisma.InputJsonValue,
      },
      select: { abTests: true },
    });

    await prisma.adminAuditLog.create({
      data: {
        action: "coupon_ab_update",
        entity: "admin_setting",
        entityId: "1",
        afterJson: nextAb,
      },
    });

    const finalAb = safeObject(updated.abTests);
    const finalExperiments = safeObject(finalAb.experiments);
    const experiment = parseCouponAbExperiment(finalExperiments[COUPON_AB_TEST_KEY]);

    return Response.json({
      globalEnabled: Boolean(finalAb.enabled),
      experiment,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }
    const action = typeof body.action === "string" ? body.action : "";
    if (action !== "activate_winner") {
      return jsonError(400, "INVALID_BODY", "action must be activate_winner.");
    }

    const parsedDays = parseBoundedInt(
      typeof body.days === "number" ? String(body.days) : null,
      { defaultValue: 30, min: 7, max: 180, paramName: "days" },
    );
    if (!parsedDays.ok) return parsedDays.response;

    const settings = await prisma.adminSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        abTests: {
          enabled: false,
          experiments: {},
        },
      },
      select: { abTests: true },
    });

    const ab = safeObject(settings.abTests);
    const experiments = safeObject(ab.experiments);
    const experiment = parseCouponAbExperiment(experiments[COUPON_AB_TEST_KEY]);
    const stats = await buildStats(
      parsedDays.value,
      experiment.variants.A.couponCode,
      experiment.variants.B.couponCode,
    );

    if (!stats.suggestedWinner) {
      return jsonError(409, "NO_WINNER", "Yeterli fark olusmadi, kazanan secilemedi.");
    }

    const winner = stats.suggestedWinner;
    const loser = winner === "A" ? "B" : "A";
    const winnerCode = experiment.variants[winner].couponCode;
    const loserCode = experiment.variants[loser].couponCode;

    await prisma.$transaction(async (tx) => {
      const nextAb = {
        ...ab,
        experiments: {
          ...experiments,
          [COUPON_AB_TEST_KEY]: {
            ...experiment,
            forceVariant: winner,
          },
        },
      };

      await tx.adminSetting.update({
        where: { id: 1 },
        data: { abTests: nextAb as Prisma.InputJsonValue },
      });

      if (winnerCode) {
        await tx.coupon.updateMany({
          where: { code: winnerCode },
          data: { isActive: true },
        });
      }
      if (loserCode) {
        await tx.coupon.updateMany({
          where: { code: loserCode },
          data: { isActive: false },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          action: "coupon_ab_activate_winner",
          entity: "admin_setting",
          entityId: "1",
          afterJson: {
            winner,
            winnerCode,
            loserCode,
            days: parsedDays.value,
          },
        },
      });
    });

    return Response.json({
      ok: true,
      winner,
      winnerCode,
      loserCode,
      days: parsedDays.value,
      stats,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
