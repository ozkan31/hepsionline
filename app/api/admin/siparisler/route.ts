import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await prisma.order.findMany({
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
    orderBy: [{ createdAt: "desc" }],
  });

  return Response.json({
    total: orders.length,
    orders,
  });
}


