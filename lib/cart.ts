import { prisma } from "@/lib/prisma";
import { createPerfScope } from "@/lib/perf";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const CART_COOKIE_NAME = "hepsionline_cart_token";
export const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getCartTokenFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE_NAME)?.value ?? null;
}

export async function getCartItemCountFromCookie() {
  const perf = createPerfScope("cart.getCartItemCountFromCookie");
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!token) {
    perf.flush();
    return 0;
  }

  const count = await perf.time("db.cartItem.aggregate", () =>
    prisma.cartItem.aggregate({
      where: {
        cart: {
          token,
        },
      },
      _sum: {
        quantity: true,
      },
    }),
  );

  perf.flush();

  return count._sum.quantity ?? 0;
}

export async function getCartHomepageStateFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!token) {
    return {
      itemCount: 0,
      items: [] as Array<{ id: number; productId: number; quantity: number }>,
    };
  }

  const cart = await prisma.cart.findUnique({
    where: { token },
    select: {
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
        },
      },
    },
  });

  if (!cart) {
    return {
      itemCount: 0,
      items: [] as Array<{ id: number; productId: number; quantity: number }>,
    };
  }

  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  return {
    itemCount,
    items: cart.items,
  };
}

export async function getCartDetailsFromCookie() {
  const perf = createPerfScope("cart.getCartDetailsFromCookie");
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!token) {
    perf.flush();
    return {
      cart: null,
      itemCount: 0,
      totalAmount: 0,
    };
  }

  const cart = await perf.time("db.cart.findUnique", () =>
    prisma.cart.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
      },
    }),
  );

  if (!cart) {
    perf.flush();
    return {
      cart: null,
      itemCount: 0,
      totalAmount: 0,
    };
  }

  const cartItems = await perf.time("db.cartItem.findMany", () =>
    prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { id: "desc" },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        productId: true,
      },
    }),
  );

  const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));
  const products = productIds.length
    ? await perf.time("db.product.findMany.byIds", () =>
        prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            imageAlt: true,
            imageBroken: true,
            oldPrice: true,
          },
        }),
      )
    : [];

  const productById = new Map(products.map((product) => [product.id, product]));
  const items = cartItems
    .map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        return null;
      }
      return {
        id: item.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productId: item.productId,
        product,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  let itemCount = 0;
  let totalAmount = 0;

  for (const item of items) {
    itemCount += item.quantity;
    totalAmount += item.quantity * item.unitPrice;
  }

  perf.flush();

  return {
    cart: {
      id: cart.id,
      token: cart.token,
      items,
    },
    itemCount,
    totalAmount,
  };
}

export async function getOrCreateCartForAction() {
  const cookieStore = await cookies();
  let token = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!token) {
    token = randomUUID();
    cookieStore.set(CART_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE_SECONDS,
    });
  }

  let cart = await prisma.cart.findUnique({
    where: { token },
    select: { id: true, token: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { token },
      select: { id: true, token: true },
    });
  }

  return cart;
}
