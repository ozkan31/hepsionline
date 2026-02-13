import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseLimit(raw) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(1000, Math.max(1, parsed));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const limit = parseLimit(process.argv[2]);
  const rows = await prisma.stockAlert.findMany({
    where: { notifiedAt: null },
    include: {
      product: {
        select: { id: true, quantityControl: true, quantity: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let notified = 0;
  let skippedOutOfStock = 0;
  let skippedInvalidEmail = 0;

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
        afterJson: { stockAlertId: row.id, source: "script" },
      },
    });
    notified += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        notified,
        skippedOutOfStock,
        skippedInvalidEmail,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
