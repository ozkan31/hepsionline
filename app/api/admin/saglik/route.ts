import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [dbOk, productCount, orderCount, lastOrder] = await Promise.all([
    prisma.$queryRaw`SELECT 1`,
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.findFirst({
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, createdAt: true, paymentStatus: true, status: true },
    }),
  ]);

  return Response.json({
    health: {
      database: Array.isArray(dbOk) ? "ok" : "unknown",
      productCount,
      orderCount,
      lastOrder,
    },
  });
}


