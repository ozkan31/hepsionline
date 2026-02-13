import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function sanitizeIds(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0) as number[];
  return Array.from(new Set(ids)).slice(0, 6);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const offerId = Number(id);
    if (!Number.isInteger(offerId) || offerId <= 0) {
      return jsonError(400, "INVALID_PATH", "id must be a positive integer.");
    }

    const body = await readJsonObject(request);
    if (!body) return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");

    const existing = await prisma.bundleOffer.findUnique({
      where: { id: offerId },
      include: { items: { select: { productId: true } } },
    });
    if (!existing) return jsonError(404, "NOT_FOUND", "Bundle offer not found.");

    const patch: { title?: string | null; discountPercent?: number; isActive?: boolean } = {};

    if ("title" in body) {
      if (typeof body.title !== "string" && body.title !== null) {
        return jsonError(400, "INVALID_BODY", "title must be string or null.");
      }
      patch.title = typeof body.title === "string" ? body.title.trim().slice(0, 120) || null : null;
    }
    if ("discountPercent" in body) {
      const parsed = Number(body.discountPercent);
      if (!Number.isFinite(parsed)) return jsonError(400, "INVALID_BODY", "discountPercent must be a number.");
      patch.discountPercent = Math.max(0, Math.min(40, Math.floor(parsed)));
    }
    if ("isActive" in body) {
      if (typeof body.isActive !== "boolean") return jsonError(400, "INVALID_BODY", "isActive must be boolean.");
      patch.isActive = body.isActive;
    }

    let itemProductIds: number[] | null = null;
    if ("itemProductIds" in body) {
      itemProductIds = sanitizeIds(body.itemProductIds).filter((pid) => pid !== existing.primaryProductId);
      if (itemProductIds.length < 1) {
        return jsonError(400, "INVALID_BODY", "At least one bundle item must be selected.");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (itemProductIds) {
        const validProducts = await tx.product.findMany({
          where: { id: { in: [existing.primaryProductId, ...itemProductIds] } },
          select: { id: true },
        });
        if (validProducts.length !== [existing.primaryProductId, ...itemProductIds].length) {
          throw new Error("INVALID_PRODUCTS");
        }

        await tx.bundleOfferItem.deleteMany({
          where: { offerId },
        });
        await tx.bundleOfferItem.createMany({
          data: itemProductIds.map((productId, idx) => ({
            offerId,
            productId,
            quantity: 1,
            sortOrder: idx,
          })),
        });
      }

      const offer = await tx.bundleOffer.update({
        where: { id: offerId },
        data: patch,
      });

      await tx.adminAuditLog.create({
        data: {
          action: "bundle_offer_update",
          entity: "bundle_offer",
          entityId: String(offerId),
          afterJson: {
            ...patch,
            ...(itemProductIds ? { itemProductIds } : {}),
          },
        },
      });

      return offer;
    });

    const full = await prisma.bundleOffer.findUnique({
      where: { id: updated.id },
      include: {
        primaryProduct: { select: { id: true, name: true, imageUrl: true, price: true } },
        items: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { product: { select: { id: true, name: true, imageUrl: true, price: true } } },
        },
      },
    });
    return Response.json(full);
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_PRODUCTS") {
      return jsonError(400, "INVALID_BODY", "Some selected products do not exist.");
    }
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const offerId = Number(id);
    if (!Number.isInteger(offerId) || offerId <= 0) {
      return jsonError(400, "INVALID_PATH", "id must be a positive integer.");
    }

    const existing = await prisma.bundleOffer.findUnique({
      where: { id: offerId },
      select: { id: true },
    });
    if (!existing) return jsonError(404, "NOT_FOUND", "Bundle offer not found.");

    await prisma.$transaction(async (tx) => {
      await tx.bundleOffer.delete({
        where: { id: offerId },
      });
      await tx.adminAuditLog.create({
        data: {
          action: "bundle_offer_delete",
          entity: "bundle_offer",
          entityId: String(offerId),
        },
      });
    });

    return Response.json({ ok: true });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
