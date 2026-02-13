"use server";

import { getAdminSessionFromCookie } from "@/lib/admin-auth";
import { adjustLoyaltyPointsByAdmin } from "@/lib/loyalty";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIntField(formData: FormData, key: string) {
  const raw = getStringField(formData, key);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

const REASON_LABELS: Record<string, string> = {
  REFUND_COMPENSATION: "Iade telafisi",
  CUSTOMER_SATISFACTION: "Musteri memnuniyeti",
  SYSTEM_FIX: "Sistem duzeltmesi",
  CAMPAIGN_BONUS: "Kampanya bonusu",
  OTHER: "Diger",
};

export async function adminAdjustLoyaltyPointsAction(formData: FormData) {
  const adminSession = await getAdminSessionFromCookie();
  if (!adminSession.ok) {
    redirect("/akalin1453/giris?status=required&next=%2Fakalin1453%2Floyalty");
  }

  const userId = getIntField(formData, "userId");
  const delta = getIntField(formData, "delta");
  const reasonCode = getStringField(formData, "reasonCode");
  const noteInput = getStringField(formData, "note");
  const reasonLabel = REASON_LABELS[reasonCode];
  const note = reasonLabel
    ? noteInput
      ? `${reasonLabel} - ${noteInput}`
      : reasonLabel
    : noteInput;

  if (!userId || !delta || !note || !reasonLabel) {
    redirect("/akalin1453/loyalty?status=invalid");
  }

  try {
    await adjustLoyaltyPointsByAdmin({
      userId,
      delta,
      note,
      actorId: adminSession.session.username,
    });
    revalidatePath("/akalin1453/loyalty");
    revalidatePath("/hesabim/puanlar");
    redirect(`/akalin1453/loyalty?status=ok&userId=${userId}`);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "unknown_error";
    redirect(
      `/akalin1453/loyalty?status=error&reason=${encodeURIComponent(
        reason,
      )}&userId=${userId}`,
    );
  }
}
