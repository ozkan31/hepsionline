import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedDays = parseBoundedInt(searchParams.get("days"), {
      defaultValue: 30,
      min: 1,
      max: 365,
      paramName: "days",
    });
    if (!parsedDays.ok) return parsedDays.response;

    const from = daysAgo(parsedDays.value);
    const rows = await prisma.searchQueryLog.findMany({
      where: {
        createdAt: { gte: from },
      },
      orderBy: { createdAt: "desc" },
      take: 8000,
      select: {
        normalizedQuery: true,
        hadResult: true,
      },
    });

    const topMap = new Map<string, number>();
    const emptyMap = new Map<string, number>();
    for (const row of rows) {
      if (!row.normalizedQuery) continue;
      topMap.set(row.normalizedQuery, (topMap.get(row.normalizedQuery) ?? 0) + 1);
      if (!row.hadResult) {
        emptyMap.set(row.normalizedQuery, (emptyMap.get(row.normalizedQuery) ?? 0) + 1);
      }
    }

    const topQueries = [...topMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([query, count]) => ({ query, count }));
    const noResultQueries = [...emptyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([query, count]) => ({ query, count }));

    return Response.json({
      days: parsedDays.value,
      totalSearches: rows.length,
      topQueries,
      noResultQueries,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
