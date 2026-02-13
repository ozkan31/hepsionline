"use server";

import { redeemLoyaltyPointsForCoupon } from "@/lib/loyalty";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ALLOWED_POINTS = new Set([100, 250, 500, 1000]);

function parsePoints(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const points = Number.parseInt(value, 10);
  if (!Number.isFinite(points) || !ALLOWED_POINTS.has(points)) return null;
  return points;
}

export async function redeemLoyaltyCouponAction(formData: FormData) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect("/giris?status=required&next=%2Fhesabim%2Fpuanlar");
  }

  const points = parsePoints(formData.get("points"));
  if (!points) {
    redirect("/hesabim/puanlar?status=invalid_points");
  }

  try {
    const result = await redeemLoyaltyPointsForCoupon(user.id, points);
    revalidatePath("/hesabim/puanlar");
    revalidatePath("/hesabim/kuponlar");
    revalidatePath("/akalin1453/loyalty");
    redirect(`/hesabim/puanlar?status=success&code=${encodeURIComponent(result.couponCode)}`);
  } catch (error) {
    if (error instanceof Error && error.message === "LOYALTY_INSUFFICIENT_POINTS") {
      redirect("/hesabim/puanlar?status=insufficient");
    }
    redirect("/hesabim/puanlar?status=failed");
  }
}

