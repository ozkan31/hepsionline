"use client";

import { addBundleToCartAction } from "@/lib/bundle-actions";
import { applyCouponAction, clearCartAction, clearCouponAction, removeCartItemAction, updateCartItemQuantityAction } from "@/lib/cart-actions";
import { buildProductSlug } from "@/lib/product-slug";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileSummarySheet } from "./mobile-summary-sheet";
import styles from "./page.module.css";

type IconProps = {
  className?: string;
};

type CartItemView = {
  id: number;
  quantity: number;
  unitPrice: number;
  product: {
    id: number;
    name: string;
    imageUrl: string | null;
    imageAlt: string;
    imageBroken: boolean;
    oldPrice: number | null;
  };
};

type SmartBundleView = {
  source: "smart" | "fallback" | "offer";
  discountPercent: number;
  baseTotal: number;
  discountedTotal: number;
  savings: number;
  items: Array<{
    productId: number;
    title: string;
    unitPrice: number;
    quantity: number;
  }>;
} | null;

type AppliedCouponMeta = {
  type: "FIXED" | "PERCENT";
  value: number;
  maxDiscountAmount: number | null;
} | null;

function TruckIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7h11v9H3z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 10h3l3 3v3h-6z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 4h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m7 7 1 12h8l1-12" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="11" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 11V8.8a3 3 0 0 1 6 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function discountPercent(oldPrice: number | null | undefined, currentPrice: number) {
  if (typeof oldPrice !== "number" || oldPrice <= currentPrice || oldPrice <= 0) {
    return null;
  }

  const discount = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  return discount > 0 ? discount : null;
}

function truncateTitle(value: string, maxLength = 40) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function calculateCouponDiscountForSubtotal(
  coupon: AppliedCouponMeta,
  subtotal: number,
) {
  if (!coupon || subtotal <= 0) {
    return 0;
  }

  let discount = 0;
  if (coupon.type === "FIXED") {
    discount = coupon.value;
  } else {
    if (coupon.value <= 0 || coupon.value > 100) {
      return 0;
    }
    discount = Math.floor((subtotal * coupon.value) / 100);
  }

  if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
    discount = Math.min(discount, coupon.maxDiscountAmount);
  }

  return Math.max(0, Math.min(discount, subtotal));
}

export function CartContentClient({
  items,
  initialSelectedCartItemIds,
  couponInputValue,
  couponStatusMessage,
  couponCodeApplied,
  appliedCouponMeta,
  smartBundle,
}: {
  items: CartItemView[];
  initialSelectedCartItemIds: number[] | null;
  couponInputValue: string;
  couponStatusMessage: string | null;
  couponCodeApplied: string | null;
  appliedCouponMeta: AppliedCouponMeta;
  smartBundle: SmartBundleView;
}) {
  const [selectedById, setSelectedById] = useState<Record<number, boolean>>(() => {
    if (initialSelectedCartItemIds && initialSelectedCartItemIds.length > 0) {
      const selectedSet = new Set(initialSelectedCartItemIds);
      return Object.fromEntries(items.map((item) => [item.id, selectedSet.has(item.id)]));
    }
    return Object.fromEntries(items.map((item) => [item.id, true]));
  });

  const selectedItems = useMemo(() => items.filter((item) => selectedById[item.id] !== false), [items, selectedById]);
  const selectedCartItemIdsCsv = useMemo(
    () => selectedItems.map((item) => item.id).join(","),
    [selectedItems],
  );
  const sepetRedirectTo = useMemo(
    () => (selectedCartItemIdsCsv ? `/sepet?selectedCartItemIds=${encodeURIComponent(selectedCartItemIdsCsv)}` : "/sepet"),
    [selectedCartItemIdsCsv],
  );
  const checkoutHref = useMemo(
    () => (selectedCartItemIdsCsv ? `/checkout?selectedCartItemIds=${encodeURIComponent(selectedCartItemIdsCsv)}` : "/sepet"),
    [selectedCartItemIdsCsv],
  );
  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [selectedItems],
  );
  const selectedCouponDiscount = couponCodeApplied
    ? calculateCouponDiscountForSubtotal(appliedCouponMeta, selectedSubtotal)
    : 0;
  const selectedShippingFree = selectedSubtotal >= 1500;
  const selectedShipping = selectedItems.length === 0 ? 0 : selectedShippingFree ? 0 : 69;
  const selectedTotal = Math.max(0, selectedSubtotal - selectedCouponDiscount + selectedShipping);

  return (
    <div className={styles.cartGrid}>
      <section className={styles.cartLeft}>
        <div className={styles.cartBanner}>
          <div className={styles.bannerLeft}>
            <TruckIcon className={styles.bannerIcon} />
            <span>{selectedShippingFree ? "Ucretsiz kargo kazandiniz!" : "Ucretsiz kargo icin sepeti artirin."}</span>
          </div>

          {items.length > 0 ? (
            <form action={clearCartAction}>
              <input type="hidden" name="redirectTo" value="/sepet" />
              <button type="submit" className={styles.clearBtn}>
                <TrashIcon className={styles.clearIcon} />
                Sepeti Temizle
              </button>
            </form>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>Sepet bos.</div>
        ) : (
          <>
            <div className={styles.cartList}>
              {items.map((item) => {
                const linePrice = item.unitPrice * item.quantity;
                const discount = discountPercent(item.product.oldPrice, item.unitPrice);
                const productUrl = `/urun/${buildProductSlug(item.product.name, item.product.id)}`;
                const checked = selectedById[item.id] !== false;

                return (
                  <article key={item.id} className={styles.cartItem}>
                    <div className={styles.cartSelectCell}>
                      <input
                        type="checkbox"
                        checked={checked}
                        className={styles.cartSelectCheckbox}
                        aria-label={`${item.product.name} sec`}
                        onChange={(event) =>
                          setSelectedById((prev) => ({
                            ...prev,
                            [item.id]: event.target.checked,
                          }))
                        }
                      />
                    </div>

                    <div className={styles.cartItemLeft}>
                      <Link href={productUrl} className={styles.cartThumb}>
                        {item.product.imageBroken || !item.product.imageUrl ? (
                          <div className={styles.thumbPlaceholder}>Gorsel</div>
                        ) : (
                          <Image
                            src={item.product.imageUrl}
                            alt={item.product.imageAlt}
                            width={120}
                            height={120}
                            className={styles.thumbImage}
                          />
                        )}
                      </Link>

                      <div className={styles.cartInfo}>
                        <Link href={productUrl} className={styles.cartTitle}>
                          {truncateTitle(item.product.name, 20)}
                        </Link>

                        {discount ? <span className={`${styles.pill} ${styles.pillRed}`}>%{discount} indirim</span> : null}

                        <div className={styles.qtyControl}>
                          <form action={updateCartItemQuantityAction} className={styles.qtyForm}>
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <input type="hidden" name="quantity" value={Math.max(1, item.quantity - 1)} />
                            <input type="hidden" name="redirectTo" value="/sepet" />
                            <button type="submit" disabled={item.quantity <= 1} aria-label={`${item.product.name} adet azalt`}>
                              -
                            </button>
                          </form>

                          <span>{item.quantity}</span>

                          <form action={updateCartItemQuantityAction} className={styles.qtyForm}>
                            <input type="hidden" name="cartItemId" value={item.id} />
                            <input type="hidden" name="quantity" value={item.quantity + 1} />
                            <input type="hidden" name="redirectTo" value="/sepet" />
                            <button type="submit" aria-label={`${item.product.name} adet artir`}>
                              +
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cartItemRight}>
                      <form action={removeCartItemAction}>
                        <input type="hidden" name="cartItemId" value={item.id} />
                        <input type="hidden" name="redirectTo" value="/sepet" />
                        <button type="submit" className={styles.removeIconBtn} aria-label={`${item.product.name} urununu kaldir`}>
                          <TrashIcon className={styles.removeIcon} />
                        </button>
                      </form>

                      <div className={styles.now}>{formatPrice(linePrice)}</div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.cartCouponCard}>
              <div className={styles.cartCouponTitle}>Kupon Kodu</div>
              <div className={styles.cartCouponRow}>
                <form action={applyCouponAction} style={{ display: "contents" }}>
                  <input type="hidden" name="redirectTo" value={sepetRedirectTo} />
                  <input type="text" name="couponCode" placeholder="Kupon kodunuz" defaultValue={couponInputValue} />
                  <button type="submit">Uygula</button>
                </form>
              </div>
              {couponStatusMessage ? <p className={styles.cartCouponMessage}>{couponStatusMessage}</p> : null}
              {couponCodeApplied ? (
                <div className={styles.cartCouponApplied}>
                  <span>{couponCodeApplied} uygulandi</span>
                  <form action={clearCouponAction}>
                    <input type="hidden" name="redirectTo" value={sepetRedirectTo} />
                    <button type="submit">Kaldir</button>
                  </form>
                </div>
              ) : null}
            </div>

            {smartBundle ? (
              <div className={styles.smartBundleCard}>
                <div className={styles.smartBundleHead}>
                  <div>
                    <h3>Birlikte Al (Akilli Oneri)</h3>
                    <p>Bu urunu alan musteriler bu urunleri de sepetine ekliyor.</p>
                  </div>
                  <span className={styles.smartBundleBadge}>%{smartBundle.discountPercent} paket indirimi</span>
                </div>

                <div className={styles.smartBundleItems}>
                  {smartBundle.items.map((bundleItem, idx) => {
                    const url = `/urun/${buildProductSlug(bundleItem.title, bundleItem.productId)}${
                      idx === 0
                        ? ""
                        : `?smart_from=cart&smart_base=${smartBundle.items[0]?.productId ?? bundleItem.productId}&smart_target=${bundleItem.productId}`
                    }`;
                    return (
                      <Link key={`smart-${bundleItem.productId}`} href={url} className={styles.smartBundleItem}>
                        <span className={styles.smartBundleTitle}>{bundleItem.title}</span>
                        <span className={styles.smartBundlePrice}>{formatPrice(bundleItem.unitPrice * bundleItem.quantity)}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className={styles.smartBundleTotals}>
                  <div>
                    Normal: <strong>{formatPrice(smartBundle.baseTotal)}</strong>
                  </div>
                  <div>
                    Paket: <strong>{formatPrice(smartBundle.discountedTotal)}</strong>
                  </div>
                  <div className={styles.smartBundleSaving}>Kazanciniz: {formatPrice(smartBundle.savings)}</div>
                </div>

                <form action={addBundleToCartAction}>
                  <input type="hidden" name="redirectTo" value="/sepet" />
                  <input type="hidden" name="discountPercent" value={smartBundle.discountPercent} />
                  <input type="hidden" name="bundleMode" value="fallback" />
                  <input type="hidden" name="productIds" value={smartBundle.items.map((i) => i.productId).join(",")} />
                  <input type="hidden" name="recommendationSource" value="smart_cart" />
                  <input type="hidden" name="baseProductId" value={smartBundle.items[0]?.productId ?? 0} />
                  <button type="submit" className={styles.smartBundleBtn}>
                    Paketi Sepete Ekle
                  </button>
                </form>
              </div>
            ) : null}
          </>
        )}
      </section>

      <aside className={styles.cartRight}>
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>Siparis Ozeti</div>

          <div className={styles.summaryRow}>
            <span>Ara Toplam</span>
            <strong>{formatPrice(selectedSubtotal)}</strong>
          </div>

          {selectedCouponDiscount > 0 ? (
            <div className={styles.summaryRow}>
              <span>Kupon Indirimi</span>
              <strong>-{formatPrice(selectedCouponDiscount)}</strong>
            </div>
          ) : null}

          <div className={styles.summaryRow}>
            <span>Kargo</span>
            <strong className={styles.free}>{selectedShippingFree ? "Ucretsiz" : formatPrice(selectedShipping)}</strong>
          </div>

          <div className={styles.summaryTotal}>
            <span>Toplam</span>
            <strong>{formatPrice(selectedTotal)}</strong>
          </div>

          <Link
            className={`${styles.checkoutBtn}${selectedItems.length === 0 ? ` ${styles.isDisabled}` : ""}`}
            href={selectedItems.length === 0 ? "/sepet" : checkoutHref}
            aria-disabled={selectedItems.length === 0}
          >
            <LockIcon className={styles.checkoutIcon} />
            Guvenli Odemeye Gec
          </Link>

          <div className={styles.summaryLogos}>
            <span>SSL Guvenli</span>
            <span>3D Secure</span>
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Troy</span>
          </div>
        </div>
      </aside>

      <MobileSummarySheet
        items={selectedItems}
        subtotal={selectedSubtotal}
        shipping={selectedShipping}
        total={selectedTotal}
        couponDiscount={selectedCouponDiscount}
        checkoutHref={checkoutHref}
      />
    </div>
  );
}
