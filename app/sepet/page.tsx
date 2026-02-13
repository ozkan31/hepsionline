import { SiteHeader } from "@/components/site-header";
import { addBundleToCartAction } from "@/lib/bundle-actions";
import { getSmartBundleForCart } from "@/lib/bundle";
import { applyCouponAction, clearCartAction, clearCouponAction, removeCartItemAction, updateCartItemQuantityAction } from "@/lib/cart-actions";
import { getCartDetailsFromCookie } from "@/lib/cart";
import { getAppliedCouponCodeFromCookie, validateCoupon } from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { buildProductSlug } from "@/lib/product-slug";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  coupon?: string;
}>;

type IconProps = {
  className?: string;
};

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

export default async function CartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
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
  const couponDiscount = couponValidation?.ok ? couponValidation.discountAmount : 0;
  const shippingFree = subtotal >= 1500;
  const shipping = items.length === 0 ? 0 : shippingFree ? 0 : 69;
  const total = Math.max(0, subtotal - couponDiscount + shipping);
  const couponStatusMessage =
    params.status === "coupon_applied"
      ? "Kupon uygulandı."
      : params.status === "coupon_removed"
      ? "Kupon kaldırıldı."
      : params.status === "coupon_invalid"
      ? "Kupon kodu geçersiz veya bu sepet için uygun değil."
      : null;

  return (
    <>
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <main className={styles.cartPage}>
        <div className={styles.cartGrid}>
          <section className={styles.cartLeft}>
            <div className={styles.cartBanner}>
              <div className={styles.bannerLeft}>
                <TruckIcon className={styles.bannerIcon} />
                <span>{shippingFree ? "Ücretsiz kargo kazandınız!" : "Ücretsiz kargo için sepeti artırın."}</span>
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
              <div className={styles.empty}>Sepet boş.</div>
            ) : (
              <>
                <div className={styles.cartList}>
                {items.map((item) => {
                  const linePrice = item.unitPrice * item.quantity;
                  const discount = discountPercent(item.product.oldPrice, item.unitPrice);
                  const productUrl = `/urun/${buildProductSlug(item.product.name, item.product.id)}`;

                  return (
                    <article key={item.id} className={styles.cartItem}>
                      <div className={styles.cartItemLeft}>
                        <Link href={productUrl} className={styles.cartThumb}>
                          {item.product.imageBroken || !item.product.imageUrl ? (
                            <div className={styles.thumbPlaceholder}>Görsel</div>
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
                            {item.product.name}
                          </Link>

                          {discount ? <span className={`${styles.pill} ${styles.pillRed}`}>%{discount} indirim</span> : null}

                          <div className={styles.qtyControl}>
                            <form action={updateCartItemQuantityAction} className={styles.qtyForm}>
                              <input type="hidden" name="cartItemId" value={item.id} />
                              <input type="hidden" name="quantity" value={Math.max(1, item.quantity - 1)} />
                              <input type="hidden" name="redirectTo" value="/sepet" />
                              <button
                                type="submit"
                                disabled={item.quantity <= 1}
                                aria-label={`${item.product.name} adet azalt`}
                              >
                                -
                              </button>
                            </form>

                            <span>{item.quantity}</span>

                            <form action={updateCartItemQuantityAction} className={styles.qtyForm}>
                              <input type="hidden" name="cartItemId" value={item.id} />
                              <input type="hidden" name="quantity" value={item.quantity + 1} />
                              <input type="hidden" name="redirectTo" value="/sepet" />
                              <button type="submit" aria-label={`${item.product.name} adet artır`}>
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
                          <button type="submit" className={styles.removeBtn} aria-label={`${item.product.name} ürününü kaldır`}>
                            Kaldır
                          </button>
                        </form>

                        <div className={styles.now}>{formatPrice(linePrice)}</div>
                      </div>
                    </article>
                  );
                })}
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
                    {smartBundle.items.map((item, idx) => {
                      const url = `/urun/${buildProductSlug(item.title, item.productId)}${
                        idx === 0 ? "" : `?smart_from=cart&smart_base=${smartBundle.items[0]?.productId ?? item.productId}&smart_target=${item.productId}`
                      }`;
                      return (
                        <Link key={`smart-${item.productId}`} href={url} className={styles.smartBundleItem}>
                          <span className={styles.smartBundleTitle}>{item.title}</span>
                          <span className={styles.smartBundlePrice}>{formatPrice(item.unitPrice * item.quantity)}</span>
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
              <div className={styles.summaryTitle}>Sipariş Özeti</div>

              <div className={styles.summaryCoupon}>
                <div className={styles.label}>İndirim Kodu</div>
                <div className={styles.couponRow}>
                  <form action={applyCouponAction} style={{ display: "contents" }}>
                    <input type="hidden" name="redirectTo" value="/sepet" />
                    <input type="text" name="couponCode" placeholder="Kupon kodunuz" defaultValue={couponInputValue} />
                    <button type="submit">Uygula</button>
                  </form>
                </div>
                {couponStatusMessage ? <p style={{ marginTop: 8, fontSize: 13 }}>{couponStatusMessage}</p> : null}
                {couponValidation?.ok ? (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{couponValidation.coupon.code} uygulandı</span>
                    <form action={clearCouponAction}>
                      <input type="hidden" name="redirectTo" value="/sepet" />
                      <button type="submit" style={{ fontSize: 13 }}>
                        Kaldır
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>

              <div className={styles.summaryRow}>
                <span>Ara Toplam</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>

              {couponDiscount > 0 ? (
                <div className={styles.summaryRow}>
                  <span>Kupon İndirimi</span>
                  <strong>-{formatPrice(couponDiscount)}</strong>
                </div>
              ) : null}

              <div className={styles.summaryRow}>
                <span>Kargo</span>
                <strong className={styles.free}>{shippingFree ? "Ücretsiz" : formatPrice(shipping)}</strong>
              </div>

              <div className={styles.summaryTotal}>
                <span>Toplam</span>
                <strong>{formatPrice(total)}</strong>
              </div>

              <Link
                className={`${styles.checkoutBtn}${items.length === 0 ? ` ${styles.isDisabled}` : ""}`}
                href={items.length === 0 ? "/sepet" : "/checkout"}
                aria-disabled={items.length === 0}
              >
                <LockIcon className={styles.checkoutIcon} />
                Güvenli Ödemeye Geç
              </Link>

              <div className={styles.summaryLogos}>
                <span>SSL Güvenli</span>
                <span>3D Secure</span>
                <span>Visa</span>
                <span>Mastercard</span>
                <span>Troy</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
