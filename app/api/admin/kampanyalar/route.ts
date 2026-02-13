import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const campaigns = await prisma.coupon.findMany({
    select: {
      id: true,
      code: true,
      description: true,
      isActive: true,
      startsAt: true,
      expiresAt: true,
      type: true,
      value: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return Response.json({
    campaigns,
  });
}


