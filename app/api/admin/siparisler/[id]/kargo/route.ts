import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/api-response";
import { SHIPPING_CARRIERS, type ShippingCarrierCode, notifyCarrier } from "@/lib/cargo";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function isCarrier(value: unknown): value is ShippingCarrierCode {
  return typeof value === "string" && SHIPPING_CARRIERS.includes(value as ShippingCarrierCode);
}

function normalizeTrackingNo(value: string) {
  return value.trim().toUpperCase().slice(0, 80);
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

    if (!isCarrier(body.carrier)) {
      return jsonError(400, "INVALID_BODY", `carrier must be one of: ${SHIPPING_CARRIERS.join(", ")}.`);
    }
    if (typeof body.trackingNo !== "string") {
      return jsonError(400, "INVALID_BODY", "trackingNo must be a string.");
    }

    const trackingNo = normalizeTrackingNo(body.trackingNo);
    if (!trackingNo) {
      return jsonError(400, "INVALID_BODY", "trackingNo is required.");
    }

    const notify = body.notifyCarrier === true;

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        shippedAt: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        shippingCarrier: true,
        shippingTrackingNo: true,
      },
    });

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Order not found.");
    }

    const nextStatus =
      existing.status === "PENDING" || existing.status === "CONFIRMED" || existing.status === "PREPARING" ? "SHIPPED" : existing.status;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingCarrier: body.carrier,
        shippingTrackingNo: trackingNo,
        shippedAt: existing.shippedAt ?? new Date(),
        status: nextStatus,
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

    let carrierSync: { ok: boolean; message?: string; providerRef?: string; mock?: boolean } = { ok: true };

    if (notify) {
      const sync = await notifyCarrier({
        carrier: body.carrier,
        trackingNo,
        orderId: updated.id,
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        customerAddress: updated.customerAddress,
      });

      if (sync.ok) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            shippingSyncedAt: new Date(),
            shippingLabelNo: sync.providerRef ?? updated.shippingLabelNo,
          },
        });
        carrierSync = { ok: true, providerRef: sync.providerRef, mock: sync.mock };
      } else {
        carrierSync = { ok: false, message: sync.error ?? "Kargo API baglantisi basarisiz." };
      }
    }

    await prisma.adminAuditLog.create({
      data: {
        action: "order_shipping_update",
        entity: "order",
        entityId: String(orderId),
        beforeJson: {
          status: existing.status,
          shippingCarrier: existing.shippingCarrier,
          shippingTrackingNo: existing.shippingTrackingNo,
        },
        afterJson: {
          status: updated.status,
          shippingCarrier: updated.shippingCarrier,
          shippingTrackingNo: updated.shippingTrackingNo,
          carrierSync,
        },
      },
    });

    revalidatePath("/hesabim/siparislerim");

    return Response.json({ order: updated, carrierSync });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
