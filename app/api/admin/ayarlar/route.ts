import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const configs = await prisma.siteConfig.findMany({
    include: {
      headerActions: {
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  return Response.json({ configs });
}


