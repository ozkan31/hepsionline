import { prisma } from "@/lib/prisma";
import { Prisma, type LoyaltyTransactionType } from "@prisma/client";

const POINTS_PER_100_TRY = 5;

const REDEEM_OPTIONS = [
  { points: 100, discountTRY: 25 },
  { points: 250, discountTRY: 70 },
  { points: 500, discountTRY: 150 },
  { points: 1000, discountTRY: 320 },
] as const;

export type RedeemOption = (typeof REDEEM_OPTIONS)[number];

function calculateTier(totalEarned: number) {
  if (totalEarned >= 5000) return "PLATINUM";
  if (totalEarned >= 2000) return "GOLD";
  if (totalEarned >= 750) return "SILVER";
  return "BRONZE";
}

function createLoyaltyCouponCode() {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `LOY${Date.now().toString().slice(-7)}${random}`.slice(0, 15).toUpperCase();
}

async function createUniqueLoyaltyCoupon(
  tx: Prisma.TransactionClient,
  payload: {
    value: number;
    points: number;
  },
) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = createLoyaltyCouponCode();
    try {
      const coupon = await tx.coupon.create({
        data: {
          code,
          type: "FIXED",
          value: payload.value,
          minOrderAmount: payload.value * 2,
          description: `Sadakat puani donusumu (${payload.points} puan)`,
          isActive: true,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          usageLimit: 1,
          perUserLimit: 1,
        },
      });
      return coupon;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("LOYALTY_COUPON_CODE_FAILED");
}

export function getLoyaltyRedeemOptions() {
  return REDEEM_OPTIONS;
}

export async function ensureLoyaltyAccount(
  tx: Prisma.TransactionClient,
  userId: number,
) {
  const existing = await tx.loyaltyAccount.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return tx.loyaltyAccount.create({
    data: {
      userId,
      tier: "BRONZE",
      pointsBalance: 0,
      totalEarned: 0,
      totalRedeemed: 0,
    },
  });
}

export async function grantLoyaltyPointsForOrder(
  tx: Prisma.TransactionClient,
  orderId: number,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmount: true,
      customerEmail: true,
      paymentStatus: true,
    },
  });

  if (!order || order.paymentStatus !== "PAID" || !order.customerEmail) {
    return { granted: 0, reason: "order_not_eligible" as const };
  }

  const user = await tx.user.findUnique({
    where: { email: order.customerEmail.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!user) {
    return { granted: 0, reason: "user_not_found" as const };
  }

  const alreadyGranted = await tx.loyaltyTransaction.findFirst({
    where: {
      orderId: order.id,
      type: "EARN_PURCHASE",
    },
    select: { id: true },
  });
  if (alreadyGranted) {
    return { granted: 0, reason: "already_granted" as const };
  }

  const points = Math.max(0, Math.floor(order.totalAmount / 100) * POINTS_PER_100_TRY);
  if (points <= 0) {
    return { granted: 0, reason: "amount_too_low" as const };
  }

  const account = await ensureLoyaltyAccount(tx, user.id);
  const nextTotalEarned = account.totalEarned + points;
  const nextTier = calculateTier(nextTotalEarned);

  await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      pointsBalance: { increment: points },
      totalEarned: { increment: points },
      tier: nextTier,
    },
  });

  await tx.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      orderId: order.id,
      type: "EARN_PURCHASE",
      pointsChange: points,
      note: "Odeme sonrasi puan kazanimi",
      meta: {
        orderTotal: order.totalAmount,
        userEmail: user.email,
      },
    },
  });

  return { granted: points, reason: "ok" as const };
}

export async function redeemLoyaltyPointsForCoupon(userId: number, points: number) {
  const option = REDEEM_OPTIONS.find((item) => item.points === points);
  if (!option) {
    throw new Error("LOYALTY_INVALID_POINTS");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new Error("LOYALTY_USER_NOT_FOUND");
    }

    const account = await ensureLoyaltyAccount(tx, user.id);
    if (account.pointsBalance < points) {
      throw new Error("LOYALTY_INSUFFICIENT_POINTS");
    }

    const coupon = await createUniqueLoyaltyCoupon(tx, {
      value: option.discountTRY,
      points,
    });

    const nextTotalRedeemed = account.totalRedeemed + points;
    const nextTier = calculateTier(account.totalEarned);

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: { decrement: points },
        totalRedeemed: nextTotalRedeemed,
        tier: nextTier,
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "REDEEM_COUPON",
        pointsChange: -points,
        note: `Kupona cevirim: ${coupon.code}`,
        meta: {
          couponCode: coupon.code,
          couponValue: coupon.value,
        },
      },
    });

    return {
      couponCode: coupon.code,
      couponValue: coupon.value,
      spentPoints: points,
    };
  });
}

export async function getUserLoyaltySummary(userId: number) {
  const account = await prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!account) {
    return {
      account: {
        pointsBalance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        tier: "BRONZE",
      },
      transactions: [],
    };
  }

  return {
    account: {
      pointsBalance: account.pointsBalance,
      totalEarned: account.totalEarned,
      totalRedeemed: account.totalRedeemed,
      tier: account.tier,
    },
    transactions: account.transactions,
  };
}

export async function getLoyaltyAdminSnapshot(limit = 50) {
  const accounts = await prisma.loyaltyAccount.findMany({
    orderBy: [{ pointsBalance: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  const totals = await prisma.loyaltyAccount.aggregate({
    _sum: {
      pointsBalance: true,
      totalEarned: true,
      totalRedeemed: true,
    },
    _count: {
      _all: true,
    },
  });

  return {
    totals: {
      users: totals._count._all ?? 0,
      pointsBalance: totals._sum.pointsBalance ?? 0,
      totalEarned: totals._sum.totalEarned ?? 0,
      totalRedeemed: totals._sum.totalRedeemed ?? 0,
    },
    accounts,
  };
}

export async function adjustLoyaltyPointsByAdmin(params: {
  userId: number;
  delta: number;
  note: string;
  actorId?: string;
}) {
  const delta = Math.trunc(params.delta);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("LOYALTY_INVALID_DELTA");
  }

  const note = params.note.trim();
  if (!note) {
    throw new Error("LOYALTY_NOTE_REQUIRED");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) {
      throw new Error("LOYALTY_USER_NOT_FOUND");
    }

    const account = await ensureLoyaltyAccount(tx, user.id);
    const appliedDelta =
      delta < 0 ? Math.max(delta, -account.pointsBalance) : delta;

    if (appliedDelta === 0) {
      throw new Error("LOYALTY_INSUFFICIENT_POINTS");
    }

    const nextTotalEarned =
      appliedDelta > 0 ? account.totalEarned + appliedDelta : account.totalEarned;
    const nextTotalRedeemed =
      appliedDelta < 0
        ? account.totalRedeemed + Math.abs(appliedDelta)
        : account.totalRedeemed;
    const nextTier = calculateTier(nextTotalEarned);

    const updated = await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: {
          increment: appliedDelta,
        },
        totalEarned: nextTotalEarned,
        totalRedeemed: nextTotalRedeemed,
        tier: nextTier,
      },
    });

    const txn = await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "MANUAL_ADJUST",
        pointsChange: appliedDelta,
        note,
        meta: {
          actorId: params.actorId ?? null,
          requestedDelta: delta,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        action: "loyalty:manual_adjust",
        actorId: params.actorId,
        entity: "user",
        entityId: String(user.id),
        afterJson: {
          userEmail: user.email,
          userName: user.fullName,
          requestedDelta: delta,
          appliedDelta,
          note,
          loyaltyTransactionId: txn.id,
          pointsBalance: updated.pointsBalance,
        },
      },
    });

    return {
      userId: user.id,
      appliedDelta,
      pointsBalance: updated.pointsBalance,
    };
  });
}

export function loyaltyTxnLabel(type: LoyaltyTransactionType) {
  if (type === "EARN_PURCHASE") return "Alisveris puani";
  if (type === "REDEEM_COUPON") return "Kupona donusum";
  if (type === "MANUAL_ADJUST") return "Manuel duzeltme";
  return "Puan dusumu";
}

export function loyaltyTxnTone(pointsChange: number) {
  return pointsChange >= 0
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-amber-700 bg-amber-50 border-amber-200";
}
