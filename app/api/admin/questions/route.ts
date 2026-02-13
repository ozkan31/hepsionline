import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [questions, products] = await Promise.all([
    prisma.adminQuestion.findMany({
      include: {
        answers: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    prisma.xmlImportedProduct.findMany({
      select: { id: true, name: true, sourceSeo: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  return Response.json(
    questions.map((q) => ({
      ...q,
      product: q.productId
        ? {
            title: productMap.get(q.productId)?.name ?? "Ürün",
            slug: productMap.get(q.productId)?.sourceSeo ?? "",
          }
        : null,
      user: { email: q.userEmail ?? "Ziyaretçi" },
    }))
  );
}

