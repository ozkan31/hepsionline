"use server";

import { randomUUID } from "node:crypto";
import { CART_COOKIE_NAME, getOrCreateCartForAction } from "@/lib/cart";
import { resolveAbVariantForToken } from "@/lib/ab-test";
import { markAbandonedCartRecovered } from "@/lib/abandoned-cart";
import { resolveCouponAbVariantForToken } from "@/lib/coupon-ab-test";
import {
  clearAppliedCouponCodeCookie,
  getAppliedCouponCodeFromCookie,
  normalizeCouponCode,
  setAppliedCouponCodeCookie,
  validateCoupon,
  validateCouponInTx,
} from "@/lib/coupon";
import { getPaytrConfig } from "@/lib/paytr";
import { generateUniqueOrderNo } from "@/lib/order-no";
import { createPerfScope } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromSession } from "@/lib/user-auth";
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const STOCK_RESERVATION_ERROR = "STOCK_RESERVATION_ERROR";
const COUPON_VALIDATION_ERROR = "COUPON_VALIDATION_ERROR";
const ORDER_NO_GENERATION_ERROR = "ORDER_NO_GENERATION_ERROR";

function generatePaytrMerchantOid() {
  const rand = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `ORD${Date.now().toString(36).toUpperCase()}${rand}`;
}

async function findCurrentCart() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const cart = await prisma.cart.findUnique({
    where: { token },
    select: { id: true, token: true },
  });

  return cart ?? null;
}

export async function addToCartAction(formData: FormData) {
  const perf = createPerfScope("cartAction.addToCart");
  try {
  const redirectTo = getRedirectTarget(formData, "/sepet");
  const productId = parseInteger(getStringField(formData, "productId"), -1);
  const quantity = Math.max(1, parseInteger(getStringField(formData, "quantity"), 1));

  if (!Number.isInteger(productId) || productId <= 0) {
    redirect(redirectTo);
  }

  const product = await perf.time("db.product.findUnique", () =>
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, price: true, quantityControl: true, quantity: true },
    }),
  );

  if (!product) {
    redirect(redirectTo);
  }

  const cart = await getOrCreateCartForAction();
  const currentUser = await getCurrentUserFromSession();
  const homeAbVariant = await resolveAbVariantForToken("home_hero_copy", cart.token);

  const existing = await perf.time("db.cartItem.findUnique", () =>
    prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: product.id,
        },
      },
      select: { id: true, quantity: true },
    }),
  );

  if (existing) {
    const nextQuantity = product.quantityControl ? Math.min(existing.quantity + quantity, Math.max(0, product.quantity)) : existing.quantity + quantity;
    if (nextQuantity <= 0) {
      redirect(redirectTo);
    }

    await perf.time("db.cartItem.update", () =>
      prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQuantity,
          unitPrice: product.price,
        },
      }),
    );
  } else {
    const nextQuantity = product.quantityControl ? Math.min(quantity, Math.max(0, product.quantity)) : quantity;
    if (nextQuantity <= 0) {
      redirect(redirectTo);
    }

    await perf.time("db.cartItem.create", () =>
      prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity: nextQuantity,
          unitPrice: product.price,
        },
      }),
    );
  }

  await perf.time("db.adminAuditLog.create.add_to_cart", () =>
    prisma.adminAuditLog.create({
      data: {
        action: "event:add_to_cart",
        actorId: currentUser?.email ?? undefined,
        entity: "product",
        entityId: String(product.id),
        afterJson: {
          quantity,
          source: redirectTo,
        },
      },
    }),
  );

  if (homeAbVariant) {
    await perf.time("db.adminAuditLog.create.ab_add_to_cart", () =>
      prisma.adminAuditLog.create({
        data: {
          action: `ab:home_hero_copy:${homeAbVariant}:add_to_cart`,
          actorId: currentUser?.email ?? undefined,
          entity: "cart",
          entityId: cart.token,
          afterJson: {
            productId: product.id,
            quantity,
          },
        },
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/favoriler");
  revalidatePath("/akalin1453");
  redirect(redirectTo);
  } finally {
    perf.flush();
  }
}

export async function applyCouponAction(formData: FormData) {
  const perf = createPerfScope("cartAction.applyCoupon");
  try {
  const redirectTo = getRedirectTarget(formData, "/sepet");
  const couponCode = normalizeCouponCode(getStringField(formData, "couponCode"));
  const recommendationSource = getStringField(formData, "recommendationSource");

  if (!couponCode) {
    await clearAppliedCouponCodeCookie();
    redirect(`${redirectTo}?status=coupon_invalid`);
  }

  const cartRef = await findCurrentCart();
  if (!cartRef) {
    await clearAppliedCouponCodeCookie();
    redirect(`${redirectTo}?status=coupon_invalid`);
  }

  const cart = await perf.time("db.cart.findUnique", () =>
    prisma.cart.findUnique({
      where: { id: cartRef.id },
      select: {
        items: {
          select: {
            quantity: true,
            unitPrice: true,
          },
        },
      },
    }),
  );

  const subtotal = (cart?.items ?? []).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const validation = await perf.time("coupon.validateCoupon", () => validateCoupon(couponCode, subtotal));
  if (!validation.ok) {
    await clearAppliedCouponCodeCookie();
    redirect(`${redirectTo}?status=coupon_invalid`);
  }

  await setAppliedCouponCodeCookie(couponCode);
  await perf.time("db.adminAuditLog.create.coupon_apply", () =>
    prisma.adminAuditLog.create({
      data: {
        action: recommendationSource ? "event:coupon_reco_apply" : "event:coupon_apply",
        entity: "cart",
        entityId: cartRef.token,
        afterJson: {
          couponCode,
          source: recommendationSource || "manual",
          subtotal,
          discountAmount: validation.discountAmount,
        },
      },
    }),
  );

  if (recommendationSource.startsWith("coupon_ab:")) {
    const variant = recommendationSource.split(":")[1] === "B" ? "B" : "A";
    await perf.time("db.adminAuditLog.create.coupon_ab_apply", () =>
      prisma.adminAuditLog.create({
        data: {
          action: "event:coupon_ab_apply",
          entity: "cart",
          entityId: cartRef.token,
          afterJson: {
            couponCode,
            variant,
            source: recommendationSource,
            subtotal,
            discountAmount: validation.discountAmount,
          },
        },
      }),
    );
  }
  redirect(`${redirectTo}?status=coupon_applied`);
  } finally {
    perf.flush();
  }
}

export async function clearCouponAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, "/sepet");
  await clearAppliedCouponCodeCookie();
  redirect(`${redirectTo}?status=coupon_removed`);
}

export async function updateCartItemQuantityAction(formData: FormData) {
  const perf = createPerfScope("cartAction.updateCartItemQuantity");
  try {
  const redirectTo = getRedirectTarget(formData, "/sepet");
  const cartItemId = parseInteger(getStringField(formData, "cartItemId"), -1);
  const quantity = parseInteger(getStringField(formData, "quantity"), 1);

  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    redirect(redirectTo);
  }

  const cart = await findCurrentCart();
  if (!cart) {
    redirect(redirectTo);
  }

  const item = await perf.time("db.cartItem.findFirst", () =>
    prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
      select: {
        id: true,
        product: {
          select: {
            quantityControl: true,
            quantity: true,
          },
        },
      },
    }),
  );

  if (!item) {
    redirect(redirectTo);
  }

  if (quantity <= 0) {
    await perf.time("db.cartItem.delete", () =>
      prisma.cartItem.delete({
        where: { id: item.id },
      }),
    );
  } else {
    const safeQuantity = item.product.quantityControl ? Math.min(quantity, Math.max(0, item.product.quantity)) : quantity;
    if (safeQuantity <= 0) {
      await perf.time("db.cartItem.delete", () =>
        prisma.cartItem.delete({
          where: { id: item.id },
        }),
      );
      revalidatePath("/");
      revalidatePath("/sepet");
      revalidatePath("/favoriler");
      revalidatePath("/akalin1453");
      redirect(redirectTo);
    }

    await perf.time("db.cartItem.update", () =>
      prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity: safeQuantity },
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/favoriler");
  revalidatePath("/akalin1453");
  redirect(redirectTo);
  } finally {
    perf.flush();
  }
}

export async function removeCartItemAction(formData: FormData) {
  const perf = createPerfScope("cartAction.removeCartItem");
  try {
  const redirectTo = getRedirectTarget(formData, "/sepet");
  const cartItemId = parseInteger(getStringField(formData, "cartItemId"), -1);

  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    redirect(redirectTo);
  }

  const cart = await findCurrentCart();
  if (!cart) {
    redirect(redirectTo);
  }

  const item = await perf.time("db.cartItem.findFirst", () =>
    prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
      select: { id: true },
    }),
  );

  if (!item) {
    redirect(redirectTo);
  }

  await perf.time("db.cartItem.delete", () =>
    prisma.cartItem.delete({
      where: { id: item.id },
    }),
  );

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/favoriler");
  revalidatePath("/akalin1453");
  redirect(redirectTo);
  } finally {
    perf.flush();
  }
}

export async function clearCartAction(formData: FormData) {
  const perf = createPerfScope("cartAction.clearCart");
  try {
  const redirectTo = getRedirectTarget(formData, "/sepet");
  const cart = await findCurrentCart();

  if (!cart) {
    redirect(redirectTo);
  }

  await perf.time("db.cartItem.deleteMany", () =>
    prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    }),
  );

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/favoriler");
  revalidatePath("/akalin1453");
  redirect(redirectTo);
  } finally {
    perf.flush();
  }
}

export async function createOrderFromCartAction(formData: FormData) {
  const perf = createPerfScope("cartAction.createOrderFromCart");
  try {
  if (!getPaytrConfig()) {
    redirect("/checkout?status=paytr_config");
  }

  const currentUser = await getCurrentUserFromSession();
  if (!currentUser) {
    redirect("/giris?status=required&next=%2Fcheckout");
  }

  const customerName = currentUser.fullName.trim();
  const customerEmail = currentUser.email.trim();
  const customerPhone = currentUser.phone.trim();
  const customerAddress = [
    currentUser.addressLine1,
    currentUser.addressLine2 ?? "",
    `${currentUser.district} / ${currentUser.city}`,
    currentUser.postalCode,
    "Türkiye",
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(", ");
  const customerNote = getStringField(formData, "customerNote");

  if (!customerName || !customerPhone || !customerAddress || !customerEmail || !isValidEmail(customerEmail)) {
    redirect("/checkout?status=address_required");
  }

  const cartRef = await findCurrentCart();
  if (!cartRef) {
    redirect("/checkout?status=empty");
  }

  const cart = await perf.time("db.cart.findUnique.forCheckout", () =>
    prisma.cart.findUnique({
      where: { id: cartRef.id },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                quantityControl: true,
                quantity: true,
              },
            },
          },
        },
      },
    }),
  );

  if (!cart || cart.items.length === 0) {
    redirect("/checkout?status=empty");
  }

  const totalAmount = cart.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const appliedCouponCode = await getAppliedCouponCodeFromCookie();
  const homeAbVariant = await resolveAbVariantForToken("home_hero_copy", cartRef.token);
  const couponAbVariant = await resolveCouponAbVariantForToken(cartRef.token);

  let createdOrderId = 0;
  const paytrMerchantOid = generatePaytrMerchantOid();

  try {
    await prisma.$transaction(async (tx) => {
      let couponUsage:
        | {
            couponId: number;
            discountAmount: number;
          }
        | null = null;

      if (appliedCouponCode) {
        const couponValidation = await perf.time("tx.validateCouponInTx", () =>
          validateCouponInTx(tx, appliedCouponCode, totalAmount, customerEmail.toLowerCase()),
        );
        if (!couponValidation.ok) {
          throw new Error(COUPON_VALIDATION_ERROR);
        }

        couponUsage = {
          couponId: couponValidation.coupon.id,
          discountAmount: couponValidation.discountAmount,
        };
      }

      for (const item of cart.items) {
        if (!item.product.quantityControl) {
          continue;
        }

        const updated = await perf.time("tx.product.updateMany.reserveStock", () =>
          tx.product.updateMany({
            where: {
              id: item.product.id,
              quantityControl: true,
              quantity: {
                gte: item.quantity,
              },
            },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          }),
        );

        if (updated.count !== 1) {
          throw new Error(STOCK_RESERVATION_ERROR);
        }
      }

      const createdOrder = await perf.time("tx.order.create", async () =>
        tx.order.create({
          data: {
            orderNo: await generateUniqueOrderNo(tx),
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            customerNote: customerNote.length > 0 ? customerNote : null,
            paytrMerchantOid,
            cartToken: cartRef.token,
            totalAmount: Math.max(0, totalAmount - (couponUsage?.discountAmount ?? 0)),
            items: {
              create: cart.items.map((item) => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              })),
            },
          },
          select: {
            id: true,
          },
        }),
      );

      if (couponUsage) {
        await perf.time("tx.couponUsage.create", () =>
          tx.couponUsage.create({
            data: {
              couponId: couponUsage.couponId,
              orderId: createdOrder.id,
              userEmail: customerEmail.toLowerCase(),
              discountAmount: couponUsage.discountAmount,
            },
          }),
        );
      }

      await perf.time("tx.adminAuditLog.create.checkout_start", () =>
        tx.adminAuditLog.create({
          data: {
            action: "event:checkout_start",
            actorId: currentUser?.email ?? undefined,
            entity: "order",
            entityId: String(createdOrder.id),
            afterJson: {
              totalAmount,
              itemCount: cart.items.length,
              couponCode: appliedCouponCode || null,
              discountAmount: couponUsage?.discountAmount ?? 0,
            },
          },
        }),
      );

      if (homeAbVariant) {
        await perf.time("tx.adminAuditLog.create.ab_checkout_start", () =>
          tx.adminAuditLog.create({
            data: {
              action: `ab:home_hero_copy:${homeAbVariant}:checkout_start`,
              actorId: currentUser?.email ?? undefined,
              entity: "order",
              entityId: String(createdOrder.id),
            },
          }),
        );
      }

      if (
        couponUsage &&
        couponAbVariant &&
        appliedCouponCode.toUpperCase() === couponAbVariant.couponCode
      ) {
        await perf.time("tx.adminAuditLog.create.coupon_ab_checkout_start", () =>
          tx.adminAuditLog.create({
            data: {
              action: "event:coupon_ab_checkout_start",
              actorId: currentUser?.email ?? undefined,
              entity: "order",
              entityId: String(createdOrder.id),
              afterJson: {
                testKey: couponAbVariant.testKey,
                variant: couponAbVariant.variant,
                couponCode: couponAbVariant.couponCode,
                discountAmount: couponUsage.discountAmount,
              },
            },
          }),
        );
      }

      createdOrderId = createdOrder.id;
    });
  } catch (error) {
    console.error("Create cart order failed:", error);
    if (error instanceof Error && error.message === STOCK_RESERVATION_ERROR) {
      redirect("/checkout?status=stock");
    }
    if (error instanceof Error && error.message === COUPON_VALIDATION_ERROR) {
      await clearAppliedCouponCodeCookie();
      redirect("/checkout?status=coupon");
    }
    if (error instanceof Error && error.message === ORDER_NO_GENERATION_ERROR) {
      redirect("/checkout?status=error");
    }
    redirect("/checkout?status=error");
  }

  await clearAppliedCouponCodeCookie();
  await markAbandonedCartRecovered(cartRef.token);

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/favoriler");
  revalidatePath("/checkout");
  revalidatePath(`/odeme/${createdOrderId}`);
  revalidatePath("/akalin1453");
  redirect(`/odeme/${createdOrderId}`);
  } finally {
    perf.flush();
  }
}
