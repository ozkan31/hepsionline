import { prisma } from "@/lib/prisma";
import type { Coupon } from "@prisma/client";
import { cookies } from "next/headers";

export const APPLIED_COUPON_COOKIE_NAME = "hepsionline_coupon_code";
export const APPLIED_COUPON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type CouponDb = Pick<typeof prisma, "coupon" | "couponUsage">;

export type CouponValidationReason =
  | "missing_code"
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "min_order_not_met"
  | "usage_limit_reached"
  | "per_user_limit_reached"
  | "invalid_discount";

export type CouponValidationResult =
  | {
      ok: true;
      coupon: Coupon;
      discountAmount: number;
    }
  | {
      ok: false;
      reason: CouponValidationReason;
    };

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

function calculateDiscount(coupon: Coupon, subtotal: number) {
  if (subtotal <= 0) {
    return 0;
  }

  let discount = 0;
  if (coupon.type === "FIXED") {
    discount = coupon.value;
  } else {
    discount = Math.floor((subtotal * coupon.value) / 100);
  }

  if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
    discount = Math.min(discount, coupon.maxDiscountAmount);
  }

  return Math.max(0, Math.min(discount, subtotal));
}

async function validateCouponWithDb(
  db: CouponDb,
  code: string,
  subtotal: number,
  userEmail?: string | null,
): Promise<CouponValidationResult> {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    return { ok: false, reason: "missing_code" };
  }

  const coupon = await db.coupon.findUnique({
    where: { code: normalizedCode },
  });

  if (!coupon) {
    return { ok: false, reason: "not_found" };
  }

  if (!coupon.isActive) {
    return { ok: false, reason: "inactive" };
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, reason: "not_started" };
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, reason: "expired" };
  }

  if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
    return { ok: false, reason: "min_order_not_met" };
  }

  if (coupon.usageLimit && coupon.usageLimit > 0) {
    const usageCount = await db.couponUsage.count({
      where: { couponId: coupon.id },
    });

    if (usageCount >= coupon.usageLimit) {
      return { ok: false, reason: "usage_limit_reached" };
    }
  }

  if (coupon.perUserLimit && coupon.perUserLimit > 0 && userEmail) {
    const perUserUsageCount = await db.couponUsage.count({
      where: {
        couponId: coupon.id,
        userEmail: userEmail.toLowerCase(),
      },
    });

    if (perUserUsageCount >= coupon.perUserLimit) {
      return { ok: false, reason: "per_user_limit_reached" };
    }
  }

  const discountAmount = calculateDiscount(coupon, subtotal);
  if (discountAmount <= 0) {
    return { ok: false, reason: "invalid_discount" };
  }

  return {
    ok: true,
    coupon,
    discountAmount,
  };
}

export async function validateCoupon(code: string, subtotal: number, userEmail?: string | null) {
  return validateCouponWithDb(prisma, code, subtotal, userEmail);
}

export async function validateCouponInTx(db: CouponDb, code: string, subtotal: number, userEmail?: string | null) {
  return validateCouponWithDb(db, code, subtotal, userEmail);
}

export async function getAppliedCouponCodeFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(APPLIED_COUPON_COOKIE_NAME)?.value ?? "";
}

export async function setAppliedCouponCodeCookie(code: string) {
  const cookieStore = await cookies();
  cookieStore.set(APPLIED_COUPON_COOKIE_NAME, normalizeCouponCode(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: APPLIED_COUPON_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearAppliedCouponCodeCookie() {
  const cookieStore = await cookies();
  cookieStore.set(APPLIED_COUPON_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAvailableCouponCountForUser(userEmail: string) {
  const now = new Date();

  const [coupons, usages] = await Promise.all([
    prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      include: {
        _count: {
          select: {
            usages: true,
          },
        },
      },
      take: 200,
    }),
    prisma.couponUsage.findMany({
      where: {
        userEmail: userEmail.toLowerCase(),
      },
      select: {
        couponId: true,
      },
    }),
  ]);

  const usageByCouponId = new Map<number, number>();
  for (const usage of usages) {
    usageByCouponId.set(usage.couponId, (usageByCouponId.get(usage.couponId) ?? 0) + 1);
  }

  let count = 0;
  for (const coupon of coupons) {
    if (coupon.usageLimit && coupon.usageLimit > 0 && coupon._count.usages >= coupon.usageLimit) {
      continue;
    }

    const userUsageCount = usageByCouponId.get(coupon.id) ?? 0;
    if (coupon.perUserLimit && coupon.perUserLimit > 0 && userUsageCount >= coupon.perUserLimit) {
      continue;
    }

    count += 1;
  }

  return count;
}

export type BestCouponSuggestion =
  | {
      ok: true;
      coupon: Coupon;
      discountAmount: number;
    }
  | {
      ok: false;
      reason: "none_available";
    };

export async function getBestCouponSuggestionForUser(
  subtotal: number,
  userEmail: string,
): Promise<BestCouponSuggestion> {
  if (!userEmail || subtotal <= 0) {
    return { ok: false, reason: "none_available" };
  }

  const normalizedEmail = userEmail.trim().toLowerCase();
  const now = new Date();

  const [coupons, usages] = await Promise.all([
    prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      include: {
        _count: {
          select: {
            usages: true,
          },
        },
      },
      take: 200,
    }),
    prisma.couponUsage.findMany({
      where: {
        userEmail: normalizedEmail,
      },
      select: {
        couponId: true,
      },
    }),
  ]);

  const usageByCouponId = new Map<number, number>();
  for (const usage of usages) {
    usageByCouponId.set(
      usage.couponId,
      (usageByCouponId.get(usage.couponId) ?? 0) + 1,
    );
  }

  let best: { coupon: Coupon; discountAmount: number } | null = null;

  for (const coupon of coupons) {
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      continue;
    }

    if (
      coupon.usageLimit &&
      coupon.usageLimit > 0 &&
      coupon._count.usages >= coupon.usageLimit
    ) {
      continue;
    }

    const userUsageCount = usageByCouponId.get(coupon.id) ?? 0;
    if (
      coupon.perUserLimit &&
      coupon.perUserLimit > 0 &&
      userUsageCount >= coupon.perUserLimit
    ) {
      continue;
    }

    const discountAmount = calculateDiscount(coupon, subtotal);
    if (discountAmount <= 0) {
      continue;
    }

    if (!best) {
      best = { coupon, discountAmount };
      continue;
    }

    if (discountAmount > best.discountAmount) {
      best = { coupon, discountAmount };
      continue;
    }

    if (discountAmount === best.discountAmount) {
      const currentExpiry = coupon.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bestExpiry =
        best.coupon.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (currentExpiry < bestExpiry) {
        best = { coupon, discountAmount };
      }
    }
  }

  if (!best) {
    return { ok: false, reason: "none_available" };
  }

  return {
    ok: true,
    coupon: best.coupon,
    discountAmount: best.discountAmount,
  };
}
