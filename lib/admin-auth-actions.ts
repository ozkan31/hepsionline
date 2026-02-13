"use server";

import { clearAdminSessionCookie, setAdminSessionCookie, validateAdminCredentials } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeNextPath(rawValue: string, fallback: string) {
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return fallback;
  }

  return rawValue;
}

export async function loginAdminAction(formData: FormData) {
  const username = getStringField(formData, "username");
  const password = getStringField(formData, "password");
  const nextPath = sanitizeNextPath(getStringField(formData, "next"), "/akalin1453");

  const credentials = validateAdminCredentials(username, password);
  if (!credentials.ok) {
    redirect(`/akalin1453/giris?status=invalid&next=${encodeURIComponent(nextPath)}`);
  }

  const sessionSet = await setAdminSessionCookie(username);
  if (!sessionSet) {
    redirect(`/akalin1453/giris?status=session_error&next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

export async function logoutAdminAction() {
  await clearAdminSessionCookie();
  redirect("/akalin1453/giris?status=logged_out");
}
