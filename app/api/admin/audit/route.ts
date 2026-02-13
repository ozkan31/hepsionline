import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  return Response.json(rows);
}

