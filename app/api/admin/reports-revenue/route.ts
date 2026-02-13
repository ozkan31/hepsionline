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
    const days = parsedDays.value;

    const today = startOfDay(new Date());
    const from = addDays(today, -(days - 1));
    const to = addDays(today, 1);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        paymentStatus: "PAID",
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const byDay = new Map<string, number>();
    for (const order of orders) {
      const key = formatDate(startOfDay(order.createdAt));
      byDay.set(key, (byDay.get(key) ?? 0) + order.totalAmount);
    }

    const series = Array.from({ length: days }).map((_, i) => {
      const day = addDays(from, i);
      const key = formatDate(day);
      return {
        date: key,
        totalTRY: byDay.get(key) ?? 0,
      };
    });

    const totalTRY = series.reduce((sum, item) => sum + item.totalTRY, 0);
    return Response.json({ totalTRY, series });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
