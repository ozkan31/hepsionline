import { clearAdminSessionCookie } from "@/lib/admin-auth";
import { clearUserSessionCookie } from "@/lib/user-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await clearAdminSessionCookie();
  await clearUserSessionCookie();
  return NextResponse.redirect(new URL("/akalin1453/giris?status=logged_out", request.url));
}
