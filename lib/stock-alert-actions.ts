"use server";

import { subscribeStockAlert } from "@/lib/stock-alert";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { redirect } from "next/navigation";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function subscribeStockAlertAction(formData: FormData) {
  const productId = Number.parseInt(getStringField(formData, "productId"), 10);
  const redirectTo = getStringField(formData, "redirectTo") || "/";
  const emailInput = getStringField(formData, "email");
  const currentUser = await getCurrentUserFromSession();
  const email = emailInput || currentUser?.email || "";

  if (!Number.isInteger(productId) || productId <= 0) {
    redirect(`${redirectTo}?status=stock_alert_invalid`);
  }

  if (!isValidEmail(email)) {
    redirect(`${redirectTo}?status=stock_alert_invalid_email`);
  }

  const result = await subscribeStockAlert(productId, email);
  if (!result.ok) {
    if (result.reason === "stock_available") {
      redirect(`${redirectTo}?status=stock_alert_stock_available`);
    }
    if (result.reason === "product_not_found") {
      redirect(`${redirectTo}?status=stock_alert_invalid`);
    }
    redirect(`${redirectTo}?status=stock_alert_invalid_email`);
  }

  redirect(`${redirectTo}?status=${result.created ? "stock_alert_subscribed" : "stock_alert_exists"}`);
}
