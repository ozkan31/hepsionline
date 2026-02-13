import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const FAVORITES_COOKIE_NAME = "hepsionline_favorites_token";
export const FAVORITES_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getFavoriteItemCountFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAVORITES_COOKIE_NAME)?.value;

  if (!token) {
    return 0;
  }

  return prisma.favoriteItem.count({
    where: {
      favoriteList: {
        token,
      },
    },
  });
}

export async function getFavoriteHomepageStateFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAVORITES_COOKIE_NAME)?.value;

  if (!token) {
    return {
      itemCount: 0,
      items: [] as Array<{ id: number; productId: number }>,
    };
  }

  const favoriteList = await prisma.favoriteList.findUnique({
    where: { token },
    select: {
      items: {
        orderBy: [{ id: "desc" }],
        select: {
          id: true,
          productId: true,
        },
      },
    },
  });

  if (!favoriteList) {
    return {
      itemCount: 0,
      items: [] as Array<{ id: number; productId: number }>,
    };
  }

  return {
    itemCount: favoriteList.items.length,
    items: favoriteList.items,
  };
}

export async function getFavoriteDetailsFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAVORITES_COOKIE_NAME)?.value;

  if (!token) {
    return {
      favoriteList: null,
      itemCount: 0,
    };
  }

  const favoriteList = await prisma.favoriteList.findUnique({
    where: { token },
    include: {
      items: {
        orderBy: [{ id: "desc" }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              imageAlt: true,
              imageBroken: true,
              filledStars: true,
              ratingCount: true,
              price: true,
              oldPrice: true,
              addToCartLabel: true,
              cartStateLabel: true,
              showWishlist: true,
              badges: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  label: true,
                  tone: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!favoriteList) {
    return {
      favoriteList: null,
      itemCount: 0,
    };
  }

  return {
    favoriteList,
    itemCount: favoriteList.items.length,
  };
}

export async function getOrCreateFavoriteListForAction() {
  const cookieStore = await cookies();
  let token = cookieStore.get(FAVORITES_COOKIE_NAME)?.value;

  if (!token) {
    token = randomUUID();
    cookieStore.set(FAVORITES_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: FAVORITES_COOKIE_MAX_AGE_SECONDS,
    });
  }

  let favoriteList = await prisma.favoriteList.findUnique({
    where: { token },
    select: { id: true, token: true },
  });

  if (!favoriteList) {
    favoriteList = await prisma.favoriteList.create({
      data: { token },
      select: { id: true, token: true },
    });
  }

  return favoriteList;
}

export async function addProductToCurrentFavoriteList(productId: number) {
  const favoriteList = await getOrCreateFavoriteListForAction();

  await prisma.favoriteItem.upsert({
    where: {
      favoriteListId_productId: {
        favoriteListId: favoriteList.id,
        productId,
      },
    },
    update: {},
    create: {
      favoriteListId: favoriteList.id,
      productId,
    },
  });

  return favoriteList;
}
