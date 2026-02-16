import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const rootIdRaw = request.nextUrl.searchParams.get("rootId");
  const rootId = Number(rootIdRaw);

  if (!Number.isInteger(rootId) || rootId <= 0) {
    return NextResponse.json({ error: "Geçersiz rootId" }, { status: 400 });
  }

  const root = await prisma.category.findFirst({
    where: {
      id: rootId,
      parentId: null,
    },
    select: {
      id: true,
      children: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          label: true,
          slug: true,
          isHighlighted: true,
          children: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              label: true,
              slug: true,
              isHighlighted: true,
            },
          },
        },
      },
    },
  });

  if (!root) {
    return NextResponse.json({ children: [] });
  }

  return NextResponse.json({ children: root.children });
}
