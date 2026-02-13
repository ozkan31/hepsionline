import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { clearSmartBundleCheckoutCap } from "@/lib/smart-bundle-cap";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearSmartBundleCheckoutCap();

    await prisma.adminAuditLog.create({
      data: {
        action: "ops:reset_smart_upsell_cap",
        entity: "smart_upsell",
        entityId: "checkout",
      },
    });

    return Response.json({
      ok: true,
      message: "Smart upsell cooldown sifirlandi.",
    });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

