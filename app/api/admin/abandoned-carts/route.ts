import { getAbandonedCartSummary } from "@/lib/abandoned-cart";
import { jsonError, parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsedMinutes = parseBoundedInt(searchParams.get("minutes"), {
      defaultValue: 30,
      min: 5,
      max: 24 * 60,
      paramName: "minutes",
    });
    if (!parsedMinutes.ok) return parsedMinutes.response;

    const parsedTake = parseBoundedInt(searchParams.get("take"), {
      defaultValue: 30,
      min: 1,
      max: 100,
      paramName: "take",
    });
    if (!parsedTake.ok) return parsedTake.response;

    const summary = await getAbandonedCartSummary(parsedMinutes.value, parsedTake.value);
    return Response.json(summary);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
