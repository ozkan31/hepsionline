import { scanAndSendAbandonedCartReminders } from "@/lib/abandoned-cart";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedMinutes = parseBoundedInt(searchParams.get("minutes"), {
      defaultValue: 30,
      min: 5,
      max: 24 * 60,
      paramName: "minutes",
    });
    if (!parsedMinutes.ok) return parsedMinutes.response;

    const parsedLimit = parseBoundedInt(searchParams.get("limit"), {
      defaultValue: 100,
      min: 1,
      max: 500,
      paramName: "limit",
    });
    if (!parsedLimit.ok) return parsedLimit.response;

    const result = await scanAndSendAbandonedCartReminders({
      minutes: parsedMinutes.value,
      limit: parsedLimit.value,
      source: "api",
    });
    return Response.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
