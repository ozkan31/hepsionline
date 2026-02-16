import { getCartItemCountFromCookie } from "@/lib/cart";
import { NextResponse } from "next/server";

export async function GET() {
  const itemCount = await getCartItemCountFromCookie();

  return NextResponse.json(
    { itemCount },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
