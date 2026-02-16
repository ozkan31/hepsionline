import { SiteHeader } from "@/components/site-header";
import { getSmartBundleForCart } from "@/lib/bundle";
import { getCartDetailsFromCookie } from "@/lib/cart";
import { getAppliedCouponCodeFromCookie, validateCoupon } from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { CartContentClient } from "./cart-content-client";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  coupon?: string;
  selectedCartItemIds?: string;
}>;

function parseSelectedCartItemIds(raw?: string) {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return ids.length > 0 ? Array.from(new Set(ids)) : [];
}

export default async function CartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedCartItemIds = parseSelectedCartItemIds(params.selectedCartItemIds);
  const [siteHeader, cartSummary, favoriteItemCount, appliedCouponCode] = await Promise.all([
    getSiteHeaderData(),
    getCartDetailsFromCookie(),
    getFavoriteItemCountFromCookie(),
    getAppliedCouponCodeFromCookie(),
  ]);

  const cartItemCount = cartSummary.itemCount;
  const queryCouponCode = (params.coupon ?? "").trim().toUpperCase();
  const couponInputValue = queryCouponCode.length > 0 ? queryCouponCode : appliedCouponCode;

  const items = cartSummary.cart?.items ?? [];
  const cartProductIds = items.map((item) => item.product.id);
  const smartBundle = await getSmartBundleForCart(cartProductIds);

  if (smartBundle?.source === "smart" && cartSummary.cart?.token) {
    await prisma.adminAuditLog.create({
      data: {
        action: "event:smart_bundle_impression",
        entity: "cart",
        entityId: cartSummary.cart.token,
        afterJson: {
          from: "cart",
          baseProductId: smartBundle.items[0]?.productId ?? null,
          suggestedProductIds: smartBundle.items.slice(1).map((item) => item.productId),
          discountPercent: smartBundle.discountPercent,
        },
      },
    });
  }

  const subtotal = cartSummary.totalAmount;
  const couponValidation = appliedCouponCode ? await validateCoupon(appliedCouponCode, subtotal) : null;
  const appliedCouponMeta = couponValidation?.ok
    ? {
        type: couponValidation.coupon.type,
        value: couponValidation.coupon.value,
        maxDiscountAmount: couponValidation.coupon.maxDiscountAmount,
      }
    : null;

  const couponStatusMessage =
    params.status === "coupon_applied"
      ? "Kupon uygulandi."
      : params.status === "coupon_removed"
        ? "Kupon kaldirildi."
        : params.status === "coupon_invalid"
          ? "Kupon kodu gecersiz veya bu sepet icin uygun degil."
          : null;

  return (
    <>
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <main className={styles.cartPage}>
        <CartContentClient
          items={items}
          initialSelectedCartItemIds={selectedCartItemIds}
          couponInputValue={couponInputValue}
          couponStatusMessage={couponStatusMessage}
          couponCodeApplied={couponValidation?.ok ? couponValidation.coupon.code : null}
          appliedCouponMeta={appliedCouponMeta}
          smartBundle={
            smartBundle
              ? {
                  source: smartBundle.source,
                  discountPercent: smartBundle.discountPercent,
                  baseTotal: smartBundle.baseTotal,
                  discountedTotal: smartBundle.discountedTotal,
                  savings: smartBundle.savings,
                  items: smartBundle.items.map((item) => ({
                    productId: item.productId,
                    title: item.title,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                  })),
                }
              : null
          }
        />
      </main>
    </>
  );
}
