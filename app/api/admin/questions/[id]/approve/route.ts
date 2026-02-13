import { prisma } from "@/lib/prisma";
import { jsonError, readJsonObject } from "@/lib/api-response";

export const dynamic = "force-dynamic";

async function buildResponse(id: string) {
  const q = await prisma.adminQuestion.findUnique({
    where: { id },
    include: { answers: { orderBy: [{ createdAt: "desc" }] } },
  });
  if (!q) return null;
  const product = q.productId
    ? await prisma.xmlImportedProduct.findUnique({
        where: { id: q.productId },
        select: { name: true, sourceSeo: true },
      })
    : null;
  return {
    ...q,
    product: product ? { title: product.name, slug: product.sourceSeo ?? "" } : null,
    user: { email: q.userEmail ?? "Ziyaretci" },
  };
}

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

    const exists = await prisma.adminQuestion.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return jsonError(404, "NOT_FOUND", "Question not found.");
    }

    await prisma.adminQuestion.update({
      where: { id },
      data: { isApproved: body.approved },
    });

    const row = await buildResponse(id);
    if (!row) {
      return jsonError(404, "NOT_FOUND", "Question not found.");
    }
    return Response.json(row);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
