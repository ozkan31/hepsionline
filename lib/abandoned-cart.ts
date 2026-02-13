import { prisma } from "@/lib/prisma";

type ScanOptions = {
  minutes: number;
  limit: number;
  source?: "api" | "script";
};

type ScanResult = {
  thresholdMinutes: number;
  scanned: number;
  sent: number;
  skippedNoEmail: number;
  skippedAlreadySent: number;
  skippedRecovered: number;
  sentCartTokens: string[];
};

export type AbandonedCartSummary = {
  thresholdMinutes: number;
  tracked: number;
  actionable: number;
  sent: number;
  recovered: number;
  waiting: number;
  recoveryRate: number;
  rows: Array<{
    cartToken: string;
    userEmail: string | null;
    lastActivityAt: string;
    reminderSentAt: string | null;
    recoveredAt: string | null;
    couponCode: string | null;
    updatedAt: string;
  }>;
};

function buildCouponCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BACK${ts}${rand}`;
}

async function createSingleUseAbandonedCoupon() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 8; i += 1) {
    const code = buildCouponCode();
    try {
      await prisma.coupon.create({
        data: {
          code,
          type: "PERCENT",
          value: 10,
          description: "Abandoned cart recovery coupon",
          isActive: true,
          startsAt: now,
          expiresAt,
          usageLimit: 1,
          perUserLimit: 1,
        },
      });
      return code;
    } catch {
      // Retry on potential unique code collision.
    }
  }
  throw new Error("COUPON_CREATE_FAILED");
}

export async function markAbandonedCartRecovered(cartToken: string) {
  if (!cartToken) return;
  await prisma.abandonedCartRecovery.updateMany({
    where: {
      cartToken,
      recoveredAt: null,
    },
    data: {
      recoveredAt: new Date(),
    },
  });
}

export async function scanAndSendAbandonedCartReminders(options: ScanOptions): Promise<ScanResult> {
  const thresholdMinutes = Math.min(24 * 60, Math.max(5, options.minutes));
  const limit = Math.min(500, Math.max(1, options.limit));
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const source = options.source ?? "api";

  const candidates = await prisma.cart.findMany({
    where: {
      updatedAt: { lte: threshold },
      items: {
        some: {},
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      token: true,
      updatedAt: true,
    },
  });

  if (!candidates.length) {
    return {
      thresholdMinutes,
      scanned: 0,
      sent: 0,
      skippedNoEmail: 0,
      skippedAlreadySent: 0,
      skippedRecovered: 0,
      sentCartTokens: [],
    };
  }

  const cartTokens = candidates.map((cart) => cart.token);
  const [existingRows, orders, auditLogs] = await Promise.all([
    prisma.abandonedCartRecovery.findMany({
      where: { cartToken: { in: cartTokens } },
      select: {
        cartToken: true,
        userEmail: true,
        reminderSentAt: true,
        recoveredAt: true,
      },
    }),
    prisma.order.findMany({
      where: {
        cartToken: { in: cartTokens },
      },
      select: {
        cartToken: true,
        createdAt: true,
        paymentStatus: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      where: {
        entity: "cart",
        entityId: { in: cartTokens },
        actorId: { not: null },
      },
      select: {
        entityId: true,
        actorId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const existingMap = new Map(existingRows.map((row) => [row.cartToken, row]));
  const orderMap = new Map(
    orders
      .filter((order) => Boolean(order.cartToken))
      .map((order) => [order.cartToken as string, order]),
  );
  const emailByCartToken = new Map<string, string>();
  for (const log of auditLogs) {
    if (!log.entityId || !log.actorId || emailByCartToken.has(log.entityId)) continue;
    emailByCartToken.set(log.entityId, log.actorId.toLowerCase());
  }

  let sent = 0;
  let skippedNoEmail = 0;
  let skippedAlreadySent = 0;
  let skippedRecovered = 0;
  const sentCartTokens: string[] = [];

  for (const cart of candidates) {
    const existing = existingMap.get(cart.token);
    const linkedOrder = orderMap.get(cart.token);

    if (linkedOrder) {
      await prisma.abandonedCartRecovery.upsert({
        where: { cartToken: cart.token },
        create: {
          cartToken: cart.token,
          userEmail: existing?.userEmail ?? emailByCartToken.get(cart.token) ?? null,
          lastActivityAt: cart.updatedAt,
          recoveredAt: linkedOrder.createdAt,
        },
        update: {
          lastActivityAt: cart.updatedAt,
          recoveredAt: existing?.recoveredAt ?? linkedOrder.createdAt,
          userEmail: existing?.userEmail ?? emailByCartToken.get(cart.token) ?? null,
        },
      });
      skippedRecovered += 1;
      continue;
    }

    const userEmail = existing?.userEmail ?? emailByCartToken.get(cart.token) ?? null;
    await prisma.abandonedCartRecovery.upsert({
      where: { cartToken: cart.token },
      create: {
        cartToken: cart.token,
        userEmail,
        lastActivityAt: cart.updatedAt,
      },
      update: {
        userEmail: existing?.userEmail ?? userEmail,
        lastActivityAt: cart.updatedAt,
      },
    });

    if (existing?.recoveredAt) {
      skippedRecovered += 1;
      continue;
    }

    if (existing?.reminderSentAt) {
      skippedAlreadySent += 1;
      continue;
    }

    if (!userEmail) {
      skippedNoEmail += 1;
      continue;
    }

    const couponCode = await createSingleUseAbandonedCoupon();
    const reminderSentAt = new Date();

    await prisma.abandonedCartRecovery.update({
      where: { cartToken: cart.token },
      data: {
        userEmail,
        reminderSentAt,
        couponCode,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        action: "event:abandoned_cart_reminder_sent",
        actorId: userEmail,
        entity: "cart",
        entityId: cart.token,
        afterJson: {
          couponCode,
          thresholdMinutes,
          source,
        },
      },
    });

    sent += 1;
    sentCartTokens.push(cart.token);
  }

  return {
    thresholdMinutes,
    scanned: candidates.length,
    sent,
    skippedNoEmail,
    skippedAlreadySent,
    skippedRecovered,
    sentCartTokens,
  };
}

export async function getAbandonedCartSummary(minutes = 30, take = 30): Promise<AbandonedCartSummary> {
  const thresholdMinutes = Math.min(24 * 60, Math.max(5, minutes));
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const safeTake = Math.min(100, Math.max(1, take));

  const [tracked, sent, recovered, waiting, actionable, rows] = await Promise.all([
    prisma.abandonedCartRecovery.count(),
    prisma.abandonedCartRecovery.count({
      where: { reminderSentAt: { not: null } },
    }),
    prisma.abandonedCartRecovery.count({
      where: { recoveredAt: { not: null } },
    }),
    prisma.abandonedCartRecovery.count({
      where: {
        recoveredAt: null,
        reminderSentAt: null,
        lastActivityAt: { lte: threshold },
      },
    }),
    prisma.abandonedCartRecovery.count({
      where: {
        recoveredAt: null,
        reminderSentAt: null,
        userEmail: { not: null },
        lastActivityAt: { lte: threshold },
      },
    }),
    prisma.abandonedCartRecovery.findMany({
      orderBy: { updatedAt: "desc" },
      take: safeTake,
      select: {
        cartToken: true,
        userEmail: true,
        lastActivityAt: true,
        reminderSentAt: true,
        recoveredAt: true,
        couponCode: true,
        updatedAt: true,
      },
    }),
  ]);

  const recoveryRate = sent > 0 ? Math.round((recovered / sent) * 1000) / 10 : 0;

  return {
    thresholdMinutes,
    tracked,
    actionable,
    sent,
    recovered,
    waiting,
    recoveryRate,
    rows: rows.map((row) => ({
      cartToken: row.cartToken,
      userEmail: row.userEmail,
      lastActivityAt: row.lastActivityAt.toISOString(),
      reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
      recoveredAt: row.recoveredAt?.toISOString() ?? null,
      couponCode: row.couponCode ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}
