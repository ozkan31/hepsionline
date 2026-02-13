import { jsonError, readJsonObject } from "@/lib/api-response";
import { subscribeStockAlert } from "@/lib/stock-alert";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }

    const productId = Number(body.productId);
    const email = typeof body.email === "string" ? body.email : "";
    if (!Number.isInteger(productId) || productId <= 0) {
      return jsonError(400, "INVALID_BODY", "productId must be a positive integer.");
    }

    const result = await subscribeStockAlert(productId, email);
    if (!result.ok) {
      return jsonError(400, "SUBSCRIBE_FAILED", result.reason ?? "subscribe_failed");
    }

    return Response.json(result);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
