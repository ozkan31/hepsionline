import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseMinutes(raw) {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.min(24 * 60, Math.max(5, parsed));
}

function staleThresholdDate(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function main() {
  const minutes = parseMinutes(process.argv[2]);
  const threshold = staleThresholdDate(minutes);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: "PENDING",
      createdAt: { lte: threshold },
    },
    select: {
      id: true,
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
    take: 500,
  });

  let released = 0;
  for (const order of staleOrders) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          paytrFailedReasonCode: "TIMEOUT",
          paytrFailedReasonMsg: "Otomatik iptal: ödeme zaman aşımı",
          paymentCompletedAt: null,
        },
      });

      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.updateMany({
          where: { id: item.productId, quantityControl: true },
          data: { quantity: { increment: item.quantity } },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          action: "ops:release_stale_order",
          entity: "order",
          entityId: String(order.id),
          afterJson: { thresholdMinutes: minutes, itemCount: order.items.length, source: "script" },
        },
      });
    });

    released += 1;
  }

  console.log(
    JSON.stringify(
      {
        thresholdMinutes: minutes,
        staleOrdersFound: staleOrders.length,
        released,
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
