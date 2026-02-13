"use server";

import { calcDiscountedUnitPrice } from "@/lib/bundle";
import { getOrCreateCartForAction } from "@/lib/cart";
import { prisma } from "@/lib/prisma";
import { markSmartBundleCheckoutAccepted } from "@/lib/smart-bundle-cap";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseIntSafe(raw: string, fallback = 0) {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseProductIdsCsv(raw: string) {
  return raw
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isInteger(x) && x > 0)
    .slice(0, 6);
}

export async function addBundleToCartAction(formData: FormData) {
  const redirectTo = getStringField(formData, "redirectTo") || "/sepet";
  const offerId = parseIntSafe(getStringField(formData, "offerId"), 0);
  const mode = getStringField(formData, "bundleMode");
  const requestedDiscountPercent = Math.max(0, Math.min(40, parseIntSafe(getStringField(formData, "discountPercent"), 0)));
  const recommendationSource = getStringField(formData, "recommendationSource");
  const baseProductId = parseIntSafe(getStringField(formData, "baseProductId"), 0);

  let bundleItems: Array<{ productId: number; quantity: number; unitPrice: number }> = [];
  let discountPercent = requestedDiscountPercent;

  if (offerId > 0) {
    const offer = await prisma.bundleOffer.findUnique({
      where: { id: offerId },
      include: {
        primaryProduct: {
          select: { id: true, price: true, quantityControl: true, quantity: true },
        },
        items: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            product: {
              select: { id: true, price: true, quantityControl: true, quantity: true },
            },
          },
        },
      },
    });

    if (!offer || !offer.isActive) {
      redirect(`${redirectTo}?status=bundle_invalid`);
    }

    discountPercent = Math.max(0, Math.min(40, offer.discountPercent));
    const offerRows = [
      { product: offer.primaryProduct, quantity: 1 },
      ...offer.items.map((item) => ({ product: item.product, quantity: Math.max(1, item.quantity) })),
    ];

    for (const row of offerRows) {
      if (row.product.quantityControl && row.product.quantity <= 0) {
        redirect(`${redirectTo}?status=bundle_stock`);
      }
    }

    bundleItems = offerRows.map((row, idx) => ({
      productId: row.product.id,
      quantity: row.quantity,
      unitPrice: calcDiscountedUnitPrice(row.product.price, idx, discountPercent),
    }));
  } else if (mode === "fallback") {
    const ids = parseProductIdsCsv(getStringField(formData, "productIds"));
    if (ids.length < 2) {
      redirect(`${redirectTo}?status=bundle_invalid`);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, price: true, quantityControl: true, quantity: true },
    });
    const map = new Map(products.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => map.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    if (ordered.length !== ids.length) {
      redirect(`${redirectTo}?status=bundle_invalid`);
    }

    for (const p of ordered) {
      if (p.quantityControl && p.quantity <= 0) {
        redirect(`${redirectTo}?status=bundle_stock`);
      }
    }

    bundleItems = ordered.map((p, idx) => ({
      productId: p.id,
      quantity: 1,
      unitPrice: calcDiscountedUnitPrice(p.price, idx, discountPercent),
    }));
  } else {
    redirect(`${redirectTo}?status=bundle_invalid`);
  }

  const cart = await getOrCreateCartForAction();
  for (const item of bundleItems) {
    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: item.productId,
        },
      },
      select: { id: true, quantity: true, unitPrice: true },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + item.quantity,
          unitPrice: Math.min(existing.unitPrice, item.unitPrice),
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        },
      });
    }
  }

  await prisma.adminAuditLog.create({
    data: {
      action: "event:add_bundle_to_cart",
      entity: "cart",
      entityId: cart.token,
      afterJson: {
        offerId: offerId || null,
        itemCount: bundleItems.length,
        discountPercent,
        recommendationSource: recommendationSource || null,
        baseProductId: baseProductId > 0 ? baseProductId : null,
      },
    },
  });

  if (recommendationSource === "smart_checkout") {
    await markSmartBundleCheckoutAccepted();
    await prisma.adminAuditLog.create({
      data: {
        action: "event:smart_bundle_add_checkout",
        entity: "cart",
        entityId: cart.token,
        afterJson: {
          baseProductId: baseProductId > 0 ? baseProductId : null,
          itemCount: bundleItems.length,
          discountPercent,
        },
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/favoriler");
  revalidatePath("/akalin1453");
  redirect(`${redirectTo}?status=bundle_added`);
}
