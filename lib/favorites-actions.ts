"use server";

import { FAVORITES_COOKIE_NAME, addProductToCurrentFavoriteList } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getUserSessionFromCookie } from "@/lib/user-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRedirectTarget(formData: FormData, fallback: string) {
  const value = getStringField(formData, "redirectTo");
  return value.length > 0 ? value : fallback;
}

function sanitizeInternalPath(rawPath: string, fallback: string) {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return fallback;
  }

  return rawPath;
}

function buildLoginRedirectForFavorite(nextPath: string, productId: number) {
  const params = new URLSearchParams();
  params.set("status", "favorite_required");
  params.set("next", nextPath);
  params.set("favoriteProductId", String(productId));
  return `/giris?${params.toString()}`;
}

function revalidateFavoriteRelatedPaths(redirectTo?: string) {
  revalidatePath("/");
  revalidatePath("/arama");
  revalidatePath("/favoriler");
  revalidatePath("/sepet");
  revalidatePath("/checkout");

  if (redirectTo) {
    const sanitizedPath = redirectTo.split("?")[0]?.trim();
    if (sanitizedPath) {
      revalidatePath(sanitizedPath);
    }
  }
}

async function findCurrentFavoriteList() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FAVORITES_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const favoriteList = await prisma.favoriteList.findUnique({
    where: { token },
    select: { id: true, token: true },
  });

  return favoriteList ?? null;
}

export async function addToFavoritesAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, "/favoriler");
  const productId = parseInteger(getStringField(formData, "productId"), -1);

  if (!Number.isInteger(productId) || productId <= 0) {
    redirect(redirectTo);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    redirect(redirectTo);
  }

  const userSession = await getUserSessionFromCookie();
  if (!userSession.ok) {
    const safeNextPath = sanitizeInternalPath(redirectTo, "/");
    redirect(buildLoginRedirectForFavorite(safeNextPath, product.id));
  }

  await addProductToCurrentFavoriteList(product.id);

  revalidateFavoriteRelatedPaths(redirectTo);
  redirect(redirectTo);
}

export async function removeFavoriteItemAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, "/favoriler");
  const favoriteItemId = parseInteger(getStringField(formData, "favoriteItemId"), -1);

  if (!Number.isInteger(favoriteItemId) || favoriteItemId <= 0) {
    redirect(redirectTo);
  }

  const favoriteList = await findCurrentFavoriteList();
  if (!favoriteList) {
    redirect(redirectTo);
  }

  const item = await prisma.favoriteItem.findFirst({
    where: {
      id: favoriteItemId,
      favoriteListId: favoriteList.id,
    },
    select: { id: true },
  });

  if (!item) {
    redirect(redirectTo);
  }

  await prisma.favoriteItem.delete({
    where: { id: item.id },
  });

  revalidateFavoriteRelatedPaths(redirectTo);
  redirect(redirectTo);
}

export async function clearFavoritesAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, "/favoriler");
  const favoriteList = await findCurrentFavoriteList();

  if (!favoriteList) {
    redirect(redirectTo);
  }

  await prisma.favoriteItem.deleteMany({
    where: {
      favoriteListId: favoriteList.id,
    },
  });

  revalidateFavoriteRelatedPaths(redirectTo);
  redirect(redirectTo);
}
