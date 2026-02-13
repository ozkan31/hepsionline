import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function staleThresholdDate(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function releaseStalePendingOrders(minutes: number) {
  const threshold = staleThresholdDate(minutes);

  const staleOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: "PENDING",
      createdAt: {
        lte: threshold,
      },
    },
    select: {
      id: true,
      createdAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 200,
  });

  let released = 0;
  const releasedOrderIds: number[] = [];

  for (const order of staleOrders) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          paytrFailedReasonCode: "TIMEOUT",
          paytrFailedReasonMsg: "Otomatik iptal: odeme zaman asimi",
          paymentCompletedAt: null,
        },
      });

      for (const item of order.items) {
        if (!item.productId) {
          continue;
        }

        await tx.product.updateMany({
          where: {
            id: item.productId,
            quantityControl: true,
          },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          action: "ops:release_stale_order",
          entity: "order",
          entityId: String(order.id),
          afterJson: {
            thresholdMinutes: minutes,
            itemCount: order.items.length,
          },
        },
      });
    });

    released += 1;
    releasedOrderIds.push(order.id);
  }

  return {
    thresholdMinutes: minutes,
    scanned: staleOrders.length,
    released,
    releasedOrderIds,
  };
}

export async function POST(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedMinutes = parseBoundedInt(searchParams.get("minutes"), {
      defaultValue: 30,
      min: 5,
      max: 24 * 60,
      paramName: "minutes",
    });
    if (!parsedMinutes.ok) return parsedMinutes.response;

    const result = await releaseStalePendingOrders(parsedMinutes.value);
    return Response.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
