import { prisma } from "@/lib/prisma";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedLimit = parseBoundedInt(searchParams.get("limit"), {
      defaultValue: 10,
      min: 1,
      max: 50,
      paramName: "limit",
    });
    if (!parsedLimit.ok) return parsedLimit.response;
    const limit = parsedLimit.value;

    const grouped = await prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: "desc" },
      },
      take: limit,
    });

    const top = grouped.map((item) => ({
      productId: item.productId,
      title: item.productName,
      qty: item._sum.quantity ?? 0,
    }));

    return Response.json(top);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
