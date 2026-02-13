import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedDays = parseBoundedInt(searchParams.get("days"), {
      defaultValue: 30,
      min: 1,
      max: 90,
      paramName: "days",
    });
    if (!parsedDays.ok) return parsedDays.response;

    const parsedWindow = parseBoundedInt(searchParams.get("activeWindowMin"), {
      defaultValue: 5,
      min: 1,
      max: 60,
      paramName: "activeWindowMin",
    });
    if (!parsedWindow.ok) return parsedWindow.response;

    const days = parsedDays.value;
    const activeWindowMin = parsedWindow.value;

    const today = startOfDay(new Date());
    const from = addDays(today, -(days - 1));
    const to = addDays(today, 1);
    const activeFrom = new Date(Date.now() - activeWindowMin * 60 * 1000);

    const [events, currentVisitors] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where: {
          createdAt: { gte: from, lt: to },
          action: "storefront_visit",
        },
        select: { createdAt: true },
      }),
      prisma.adminAuditLog.count({
        where: {
          action: "storefront_visit",
          createdAt: { gte: activeFrom },
        },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (const e of events) {
      const key = formatDate(startOfDay(e.createdAt));
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    const series = Array.from({ length: days }).map((_, i) => {
      const day = addDays(from, i);
      const key = formatDate(day);
      return {
        date: key,
        visitors: byDay.get(key) ?? 0,
      };
    });

    const totalVisitors = series.reduce((sum, item) => sum + item.visitors, 0);
    const todayVisitors = series[series.length - 1]?.visitors ?? 0;

    return Response.json({
      series,
      totalVisitors,
      todayVisitors,
      currentVisitors,
      activeWindowMin,
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
