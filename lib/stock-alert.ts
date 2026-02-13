import { prisma } from "@/lib/prisma";

export type StockAlertSubscribeResult = {
  ok: boolean;
  created: boolean;
  reason?: "invalid_email" | "product_not_found" | "stock_available";
};

export type StockAlertDispatchResult = {
  scanned: number;
  notified: number;
  skippedOutOfStock: number;
  skippedInvalidEmail: number;
  notifiedIds: number[];
};

export type StockAlertSummary = {
  total: number;
  pending: number;
  notified: number;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function subscribeStockAlert(productId: number, emailRaw: string): Promise<StockAlertSubscribeResult> {
  const userEmail = normalizeEmail(emailRaw);
  if (!isValidEmail(userEmail)) {
    return { ok: false, created: false, reason: "invalid_email" };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, quantityControl: true, quantity: true },
  });
  if (!product) {
    return { ok: false, created: false, reason: "product_not_found" };
  }

  if (!product.quantityControl || product.quantity > 0) {
    return { ok: false, created: false, reason: "stock_available" };
  }

  const created = await prisma.stockAlert
    .upsert({
      where: {
        productId_userEmail: {
          productId,
          userEmail,
        },
      },
      create: {
        productId,
        userEmail,
      },
      update: {
        notifiedAt: null,
      },
    })
    .then(() => true)
    .catch(() => false);

  await prisma.adminAuditLog.create({
    data: {
      action: "event:stock_alert_subscribe",
      actorId: userEmail,
      entity: "product",
      entityId: String(productId),
    },
  });

  return { ok: true, created };
}

export async function dispatchStockAlerts(limit = 200): Promise<StockAlertDispatchResult> {
  const safeLimit = Math.min(1000, Math.max(1, limit));
  const rows = await prisma.stockAlert.findMany({
    where: {
      notifiedAt: null,
    },
    include: {
      product: {
        select: {
          id: true,
          quantityControl: true,
          quantity: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: safeLimit,
  });

  let notified = 0;
  let skippedOutOfStock = 0;
  let skippedInvalidEmail = 0;
  const notifiedIds: number[] = [];

  for (const row of rows) {
    if (!row.product.quantityControl || row.product.quantity <= 0) {
      skippedOutOfStock += 1;
      continue;
    }

    if (!isValidEmail(row.userEmail)) {
      skippedInvalidEmail += 1;
      continue;
    }

    await prisma.stockAlert.update({
      where: { id: row.id },
      data: { notifiedAt: new Date() },
    });

    await prisma.adminAuditLog.create({
      data: {
        action: "event:stock_alert_notified",
        actorId: row.userEmail,
        entity: "product",
        entityId: String(row.productId),
        afterJson: {
          stockAlertId: row.id,
        },
      },
    });

    notified += 1;
    notifiedIds.push(row.id);
  }

  return {
    scanned: rows.length,
    notified,
    skippedOutOfStock,
    skippedInvalidEmail,
    notifiedIds,
  };
}

export async function getStockAlertSummary(): Promise<StockAlertSummary> {
  const [total, pending, notified] = await Promise.all([
    prisma.stockAlert.count(),
    prisma.stockAlert.count({ where: { notifiedAt: null } }),
    prisma.stockAlert.count({ where: { notifiedAt: { not: null } } }),
  ]);
  return { total, pending, notified };
}
