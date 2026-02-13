import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const RETURN_STATUSES = ["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"] as const;

type ReturnStatus = (typeof RETURN_STATUSES)[number];

function isReturnStatus(value: unknown): value is ReturnStatus {
  return typeof value === "string" && RETURN_STATUSES.includes(value as ReturnStatus);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return jsonError(400, "INVALID_PATH", "id is required.");
    }

    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }

    const patch: { status?: ReturnStatus; adminNote?: string } = {};

    if ("status" in body) {
      if (!isReturnStatus(body.status)) {
        return jsonError(400, "INVALID_BODY", `status must be one of: ${RETURN_STATUSES.join(", ")}.`);
      }
      patch.status = body.status;
    }

    if ("adminNote" in body) {
      if (typeof body.adminNote !== "string") {
        return jsonError(400, "INVALID_BODY", "adminNote must be a string.");
      }
      patch.adminNote = body.adminNote.trim().slice(0, 2000);
    }

    if (Object.keys(patch).length === 0) {
      return jsonError(400, "INVALID_BODY", "At least one of status or adminNote must be provided.");
    }

    const existing = await prisma.adminReturnRequest.findUnique({ where: { id } });
    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Return request not found.");
    }

    const updated = await prisma.adminReturnRequest.update({
      where: { id },
      data: patch,
    });

    const [order, orderItem] = await Promise.all([
      updated.orderId
        ? prisma.order.findUnique({
            where: { id: updated.orderId },
            select: { id: true, orderNo: true, customerEmail: true },
          })
        : Promise.resolve(null),
      updated.orderItemId
        ? prisma.orderItem.findUnique({
            where: { id: updated.orderItemId },
            select: { id: true, productName: true },
          })
        : Promise.resolve(null),
    ]);

    return Response.json({
      ...updated,
      order: updated.orderId ? { orderNo: order?.orderNo ?? updated.orderId, customerEmail: order?.customerEmail } : null,
      orderItem: updated.orderItemId ? { title: orderItem?.productName ?? "-" } : null,
      user: { email: updated.userEmail ?? order?.customerEmail ?? "-" },
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
