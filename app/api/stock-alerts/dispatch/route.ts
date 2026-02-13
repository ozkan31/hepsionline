import { dispatchStockAlerts } from "@/lib/stock-alert";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedLimit = parseBoundedInt(searchParams.get("limit"), {
      defaultValue: 200,
      min: 1,
      max: 1000,
      paramName: "limit",
    });
    if (!parsedLimit.ok) return parsedLimit.response;

    const result = await dispatchStockAlerts(parsedLimit.value);
    return Response.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
