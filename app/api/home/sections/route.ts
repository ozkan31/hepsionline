import { getCartHomepageStateFromCookie } from "@/lib/cart";
import { getFavoriteHomepageStateFromCookie } from "@/lib/favorites";
import { getHomepageSectionsPage } from "@/lib/homepage-data";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parsePage(searchParams: URLSearchParams) {
  const rawValue = searchParams.get("page");
  if (!rawValue) {
    return 1;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePage(searchParams);

  const [payload, cartState, favoriteState] = await Promise.all([
    getHomepageSectionsPage(page),
    getCartHomepageStateFromCookie(),
    getFavoriteHomepageStateFromCookie(),
  ]);

  const productIdsInPage = new Set<number>();

  for (const section of payload.sections) {
    for (const product of section.products) {
      productIdsInPage.add(product.id);
    }
  }

  const cartStateByProductId: Record<string, { cartItemId: number; quantity: number }> = {};
  for (const item of cartState.items) {
    if (!productIdsInPage.has(item.productId)) {
      continue;
    }

    cartStateByProductId[String(item.productId)] = {
      cartItemId: item.id,
      quantity: item.quantity,
    };
  }

  const favoriteStateByProductId: Record<string, { favoriteItemId: number }> = {};
  for (const item of favoriteState.items) {
    if (!productIdsInPage.has(item.productId)) {
      continue;
    }

    favoriteStateByProductId[String(item.productId)] = {
      favoriteItemId: item.id,
    };
  }

  return NextResponse.json(
    {
      sections: payload.sections,
      pagination: payload.pagination,
      cartStateByProductId,
      favoriteStateByProductId,
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
