import { getStockAlertSummary } from "@/lib/stock-alert";
import { jsonError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getStockAlertSummary();
    return Response.json(summary);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
