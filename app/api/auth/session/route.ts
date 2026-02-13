import { getCurrentUserFromSession } from "@/lib/user-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUserFromSession();

    return NextResponse.json(
      { loggedIn: Boolean(user) },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { loggedIn: false },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
