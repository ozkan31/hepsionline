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

    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!answer) {
      return jsonError(400, "INVALID_BODY", "answer is required.");
    }
    if (answer.length > 4000) {
      return jsonError(400, "INVALID_BODY", "answer is too long.");
    }

    const exists = await prisma.adminQuestion.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return jsonError(404, "NOT_FOUND", "Question not found.");
    }

    await prisma.adminQuestionAnswer.create({
      data: {
        questionId: id,
        answer,
      },
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
