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

export async function GET() {
  const bundles = await prisma.bundleOffer.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      primaryProduct: {
        select: { id: true, name: true, imageUrl: true, price: true },
      },
      items: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          product: {
            select: { id: true, name: true, imageUrl: true, price: true },
          },
        },
      },
    },
    take: 200,
  });

  return Response.json({ bundles });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");

    const primaryProductId = Number(body.primaryProductId);
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const discountPercent = Math.max(0, Math.min(40, Number(body.discountPercent) || 0));
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
    const itemProductIds = sanitizeIds(body.itemProductIds).filter((id) => id !== primaryProductId);

    if (!Number.isInteger(primaryProductId) || primaryProductId <= 0) {
      return jsonError(400, "INVALID_BODY", "primaryProductId must be a positive integer.");
    }
    if (itemProductIds.length < 1) {
      return jsonError(400, "INVALID_BODY", "At least one bundle item must be selected.");
    }

    const productIds = [primaryProductId, ...itemProductIds];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return jsonError(400, "INVALID_BODY", "Some selected products do not exist.");
    }

    const created = await prisma.$transaction(async (tx) => {
      const offer = await tx.bundleOffer.create({
        data: {
          primaryProductId,
          title: title || null,
          discountPercent,
          isActive,
        },
      });
      await tx.bundleOfferItem.createMany({
        data: itemProductIds.map((productId, idx) => ({
          offerId: offer.id,
          productId,
          quantity: 1,
          sortOrder: idx,
        })),
      });
      await tx.adminAuditLog.create({
        data: {
          action: "bundle_offer_create",
          entity: "bundle_offer",
          entityId: String(offer.id),
          afterJson: {
            primaryProductId,
            itemProductIds,
            discountPercent,
            isActive,
          },
        },
      });
      return offer.id;
    });

    const bundle = await prisma.bundleOffer.findUnique({
      where: { id: created },
      include: {
        primaryProduct: { select: { id: true, name: true, imageUrl: true, price: true } },
        items: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { product: { select: { id: true, name: true, imageUrl: true, price: true } } },
        },
      },
    });
    return Response.json(bundle);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
