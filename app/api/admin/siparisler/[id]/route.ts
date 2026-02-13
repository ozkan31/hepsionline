import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/api-response";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "ON_THE_WAY", "DELIVERED", "CANCELLED"] as const;
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED"] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

function canTransitionOrderStatus(current: OrderStatus, next: OrderStatus) {
  if (current === next) return true;
  if (current === "DELIVERED" || current === "CANCELLED") return false;
  return true;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return jsonError(400, "INVALID_PATH", "id must be a positive integer.");
    }

    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }

    const patch: { status?: OrderStatus; paymentStatus?: PaymentStatus } = {};

    if ("status" in body) {
      if (!isOrderStatus(body.status)) {
        return jsonError(400, "INVALID_BODY", `status must be one of: ${ORDER_STATUSES.join(", ")}.`);
      }
      patch.status = body.status;
    }

    if ("paymentStatus" in body) {
      if (!isPaymentStatus(body.paymentStatus)) {
        return jsonError(400, "INVALID_BODY", `paymentStatus must be one of: ${PAYMENT_STATUSES.join(", ")}.`);
      }
      patch.paymentStatus = body.paymentStatus;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError(400, "INVALID_BODY", "At least one of status or paymentStatus must be provided.");
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
      },
    });

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Order not found.");
    }

    if (patch.status && !canTransitionOrderStatus(existing.status, patch.status)) {
      return jsonError(400, "INVALID_TRANSITION", `Cannot transition from ${existing.status} to ${patch.status}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id: orderId },
        data: {
          status: patch.status,
          paymentStatus: patch.paymentStatus,
        },
        include: {
          items: {
            select: {
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              product: {
                select: {
                  imageUrl: true,
                  imageAlt: true,
                },
              },
            },
          },
          couponUsages: {
            select: {
              discountAmount: true,
              userEmail: true,
              usedAt: true,
              coupon: {
                select: {
                  code: true,
                  type: true,
                  value: true,
                },
              },
            },
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "order_status_update",
          entity: "order",
          entityId: String(orderId),
          beforeJson: {
            status: existing.status,
            paymentStatus: existing.paymentStatus,
          },
          afterJson: {
            status: next.status,
            paymentStatus: next.paymentStatus,
          },
        },
      });

      return next;
    });

    revalidatePath("/hesabim/siparislerim");

    return Response.json(updated);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
