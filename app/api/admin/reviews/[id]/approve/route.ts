import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return jsonError(400, "INVALID_PATH", "id is required.");
    }

    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }
    if (typeof body.approved !== "boolean") {
      return jsonError(400, "INVALID_BODY", "approved must be boolean.");
    }

    const exists = await prisma.adminReview.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return jsonError(404, "NOT_FOUND", "Review not found.");
    }

    const updated = await prisma.adminReview.update({
      where: { id },
      data: { isApproved: body.approved },
    });

    const product = updated.productId
      ? await prisma.xmlImportedProduct.findUnique({
          where: { id: updated.productId },
          select: { name: true },
        })
      : null;

    return Response.json({
      ...updated,
      product: { title: product?.name ?? "Urun" },
      user: { email: updated.userEmail ?? "-" },
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
