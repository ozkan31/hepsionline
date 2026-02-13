import { CheckoutAddressPanel } from "@/components/checkout-address-panel";
import { addBundleToCartAction } from "@/lib/bundle-actions";
import { getSmartBundleForCart } from "@/lib/bundle";
import { SiteHeader } from "@/components/site-header";
import { applyCouponAction, createOrderFromCartAction } from "@/lib/cart-actions";
import { getCartDetailsFromCookie } from "@/lib/cart";
import { resolveCouponAbVariantForToken } from "@/lib/coupon-ab-test";
import {
  getAppliedCouponCodeFromCookie,
  getBestCouponSuggestionForUser,
  validateCoupon,
} from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { buildProductSlug } from "@/lib/product-slug";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { canShowSmartBundleCheckout, markSmartBundleCheckoutImpression } from "@/lib/smart-bundle-cap";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
}>;

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function checkoutMessage(status?: string) {
  if (status === "invalid") return "Sipariş için kullanıcı bilgileri veya adres eksik.";
  if (status === "address_required") return "Ödeme için kayıtlı bir teslimat adresi gerekli.";
  if (status === "empty") return "Sepetinizde sipariş verilecek ürün bulunamadı.";
  if (status === "stock") return "Bazı ürünlerin stoğu yetersiz. Sepeti güncelleyip tekrar deneyin.";
  if (status === "coupon") return "Kupon kodu bu sipariş için geçersiz veya kullanım limiti dolmuş.";
  if (status === "coupon_applied") return "Kupon başarıyla uygulandı.";
  if (status === "coupon_removed") return "Kupon kaldırıldı.";
  if (status === "coupon_invalid") return "Kupon kodu geçersiz veya siparişe uygun değil.";
  if (status === "paytr_config") return "PAYTR ayarları eksik. Ortam değişkenlerini kontrol edin.";
  if (status === "error") return "Sipariş oluşturulurken bir hata oluştu.";
  if (status === "updated") return "Adres bilgisi güncellendi.";
  if (status === "smart_bundle_added") return "Akilli paket sepete eklendi.";
  return "";
}

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const [siteHeader, cartSummary, favoriteItemCount, currentUser, appliedCouponCode] = await Promise.all([
    getSiteHeaderData(),
    getCartDetailsFromCookie(),
    getFavoriteItemCountFromCookie(),
    getCurrentUserFromSession(),
    getAppliedCouponCodeFromCookie(),
  ]);
  const cartItemCount = cartSummary.itemCount;

  if (!currentUser) {
    redirect("/giris?status=required&next=%2Fcheckout");
  }

  const hasItems = Boolean(cartSummary.cart && cartSummary.cart.items.length > 0);
  const hasSavedAddress = Boolean(currentUser.addressLine1?.trim() && currentUser.city?.trim() && currentUser.district?.trim());
  const canSubmit = hasItems && hasSavedAddress;
  const couponValidation = appliedCouponCode ? await validateCoupon(appliedCouponCode, cartSummary.totalAmount, currentUser.email) : null;
  const couponDiscount = couponValidation?.ok ? couponValidation.discountAmount : 0;
  const appliedValidCouponCode = couponValidation?.ok ? couponValidation.coupon.code : null;
  const payableTotal = Math.max(0, cartSummary.totalAmount - couponDiscount);
  const bestCouponSuggestion = await getBestCouponSuggestionForUser(
    cartSummary.totalAmount,
    currentUser.email,
  );
  const couponAbVariant = await resolveCouponAbVariantForToken(
    cartSummary.cart?.token ?? null,
  );
  const couponAbValidation =
    couponAbVariant?.couponCode
      ? await validateCoupon(
          couponAbVariant.couponCode,
          cartSummary.totalAmount,
          currentUser.email,
        )
      : null;
  const hasAppliedCoupon = Boolean(appliedCouponCode && couponValidation?.ok);
  const shouldShowCouponAbCard = Boolean(
    couponAbVariant &&
      couponAbValidation?.ok &&
      (!hasAppliedCoupon ||
        couponAbValidation.coupon.code !== appliedValidCouponCode),
  );
  const shouldShowBestCouponCard =
    !shouldShowCouponAbCard &&
    bestCouponSuggestion.ok &&
    (!hasAppliedCoupon ||
      bestCouponSuggestion.coupon.code !== appliedValidCouponCode);
  const canShowSmartUpsell = hasItems ? await canShowSmartBundleCheckout() : false;
  const smartBundle = canShowSmartUpsell
    ? await getSmartBundleForCart(
        cartSummary.cart?.items.map((item) => item.product.id) ?? [],
      )
    : null;

  if (smartBundle && cartSummary.cart?.token) {
    await prisma.adminAuditLog.create({
      data: {
        action: "event:smart_bundle_impression_checkout",
        actorId: currentUser.email,
        entity: "cart",
        entityId: cartSummary.cart.token,
        afterJson: {
          from: "checkout",
          baseProductId: smartBundle.items[0]?.productId ?? null,
          suggestedProductIds: smartBundle.items
            .slice(1)
            .map((item) => item.productId),
          discountPercent: smartBundle.discountPercent,
        },
      },
    });
    await markSmartBundleCheckoutImpression();
  }

  if (shouldShowBestCouponCard && bestCouponSuggestion.ok && cartSummary.cart?.token) {
    await prisma.adminAuditLog.create({
      data: {
        action: "event:coupon_reco_impression",
        actorId: currentUser.email,
        entity: "cart",
        entityId: cartSummary.cart.token,
        afterJson: {
          source: "checkout_best_coupon",
          couponCode: bestCouponSuggestion.coupon.code,
          discountAmount: bestCouponSuggestion.discountAmount,
        },
      },
    });
  }

  if (
    shouldShowCouponAbCard &&
    couponAbVariant &&
    couponAbValidation?.ok &&
    cartSummary.cart?.token
  ) {
    await prisma.adminAuditLog.create({
      data: {
        action: "event:coupon_ab_impression",
        actorId: currentUser.email,
        entity: "cart",
        entityId: cartSummary.cart.token,
        afterJson: {
          source: "checkout_coupon_ab",
          testKey: couponAbVariant.testKey,
          variant: couponAbVariant.variant,
          couponCode: couponAbValidation.coupon.code,
          discountAmount: couponAbValidation.discountAmount,
        },
      },
    });
  }

  const notice = checkoutMessage(query.status);
  const isErrorNotice =
    query.status === "invalid" ||
    query.status === "empty" ||
    query.status === "error" ||
    query.status === "paytr_config" ||
    query.status === "stock" ||
    query.status === "coupon" ||
    query.status === "coupon_invalid";

  const addressOptions = hasSavedAddress
    ? [
        {
          id: `user-${currentUser.id}`,
          fullName: currentUser.fullName,
          phone: currentUser.phone,
          addressLine1: currentUser.addressLine1,
          addressLine2: currentUser.addressLine2 ?? "",
          city: currentUser.city,
          district: currentUser.district,
          postalCode: currentUser.postalCode,
          country: "Türkiye",
        },
      ]
    : [];

  return (
    <>
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>Ödeme ve Sipariş</h1>
            <Link href="/sepet" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" />
              Sepete dön
            </Link>
          </div>

          {notice ? <div className={isErrorNotice ? styles.noticeError : styles.noticeSuccess}>{notice}</div> : null}

          {!hasItems ? (
            <section className={styles.emptyState}>
              <p>Sepetiniz boş olduğu için ödeme adımı açılamadı.</p>
              {isErrorNotice ? <p>Ürün ekleyip tekrar deneyin.</p> : null}
              <Link href="/" className={styles.primaryLink}>
                Ürünlere dön
              </Link>
            </section>
          ) : (
            <div className={styles.layout}>
              <section className={styles.deliveryCard}>
                <CheckoutAddressPanel
                  formId="checkout-pay-form"
                  fallbackName={currentUser.fullName}
                  fallbackPhone={currentUser.phone}
                  customerEmail={currentUser.email}
                  addresses={addressOptions}
                />
              </section>

              <section className={styles.summaryCard}>
                <h2>Sipariş Özeti</h2>

                <div className={styles.summaryList}>
                  {cartSummary.cart?.items.map((item) => (
                    <article key={item.id} className={styles.summaryItem}>
                      <div className={styles.summaryImageWrap}>
                        {item.product.imageBroken || !item.product.imageUrl ? (
                          <div className={styles.placeholder}>Görsel yok</div>
                        ) : (
                          <Image
                            src={item.product.imageUrl}
                            alt={item.product.imageAlt}
                            width={120}
                            height={120}
                            className={styles.summaryImage}
                          />
                        )}
                      </div>

                      <div className={styles.summaryInfo}>
                        <strong>{item.product.name}</strong>
                        <span>
                          {item.quantity} x {formatPrice(item.unitPrice)}
                        </span>
                      </div>

                      <div className={styles.itemTotal}>{formatPrice(item.quantity * item.unitPrice)}</div>
                    </article>
                  ))}
                </div>

                {shouldShowCouponAbCard &&
                couponAbVariant &&
                couponAbValidation?.ok ? (
                  <div className={styles.bestCouponCard}>
                    <div className={styles.bestCouponHead}>
                      <strong>A/B Test Kuponu</strong>
                      <span>{couponAbValidation.coupon.code}</span>
                    </div>
                    <div className={styles.bestCouponSub}>
                      Varyant {couponAbVariant.variant} aktif. Tahmini indirim:{" "}
                      <b>{formatPrice(couponAbValidation.discountAmount)}</b>
                    </div>
                    <form action={applyCouponAction}>
                      <input type="hidden" name="redirectTo" value="/checkout" />
                      <input
                        type="hidden"
                        name="recommendationSource"
                        value={`coupon_ab:${couponAbVariant.variant}`}
                      />
                      <input
                        type="hidden"
                        name="couponCode"
                        value={couponAbValidation.coupon.code}
                      />
                      <button type="submit" className={styles.bestCouponButton}>
                        Varyanti uygula
                      </button>
                    </form>
                  </div>
                ) : null}

                {shouldShowBestCouponCard && bestCouponSuggestion.ok ? (
                  <div className={styles.bestCouponCard}>
                    <div className={styles.bestCouponHead}>
                      <strong>Sana en uygun kupon</strong>
                      <span>{bestCouponSuggestion.coupon.code}</span>
                    </div>
                    <div className={styles.bestCouponSub}>
                      Bu sipariste tahmini indirim:{" "}
                      <b>{formatPrice(bestCouponSuggestion.discountAmount)}</b>
                    </div>
                    <form action={applyCouponAction}>
                      <input type="hidden" name="redirectTo" value="/checkout" />
                      <input type="hidden" name="recommendationSource" value="checkout_best_coupon" />
                      <input
                        type="hidden"
                        name="couponCode"
                        value={bestCouponSuggestion.coupon.code}
                      />
                      <button type="submit" className={styles.bestCouponButton}>
                        Tek tikla uygula
                      </button>
                    </form>
                  </div>
                ) : null}

                {smartBundle ? (
                  <div className={styles.smartUpsellCard}>
                    <div className={styles.smartUpsellHead}>
                      <strong>Son Firsat: Akilli Paket</strong>
                      <span>%{smartBundle.discountPercent}</span>
                    </div>

                    <div className={styles.smartUpsellList}>
                      {smartBundle.items.map((item, idx) => (
                        <Link
                          key={`checkout-smart-${item.productId}`}
                          href={`/urun/${buildProductSlug(item.title, item.productId)}${
                            idx === 0
                              ? ""
                              : `?smart_from=checkout&smart_base=${
                                  smartBundle.items[0]?.productId ??
                                  item.productId
                                }&smart_target=${item.productId}`
                          }`}
                          className={styles.smartUpsellItem}
                        >
                          <span>{item.title}</span>
                          <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                        </Link>
                      ))}
                    </div>

                    <div className={styles.smartUpsellTotals}>
                      <span>Paket: {formatPrice(smartBundle.discountedTotal)}</span>
                      <span>Kazanciniz: {formatPrice(smartBundle.savings)}</span>
                    </div>

                    <form action={addBundleToCartAction}>
                      <input type="hidden" name="redirectTo" value="/checkout?status=smart_bundle_added" />
                      <input type="hidden" name="discountPercent" value={smartBundle.discountPercent} />
                      <input type="hidden" name="bundleMode" value="fallback" />
                      <input type="hidden" name="productIds" value={smartBundle.items.map((i) => i.productId).join(",")} />
                      <input type="hidden" name="recommendationSource" value="smart_checkout" />
                      <input type="hidden" name="baseProductId" value={smartBundle.items[0]?.productId ?? 0} />
                      <button type="submit" className={styles.smartUpsellButton}>
                        Tek Tikla Paketi Ekle
                      </button>
                    </form>
                  </div>
                ) : null}

                <div className={styles.totalRow}>
                  <span>Toplam ürün</span>
                  <strong>{cartSummary.itemCount}</strong>
                </div>

                <div className={styles.totalRow}>
                  <span>Genel toplam</span>
                  <strong>{formatPrice(cartSummary.totalAmount)}</strong>
                </div>

                {couponDiscount > 0 ? (
                  <>
                    <div className={styles.totalRow}>
                      <span>Kupon indirimi</span>
                      <strong>-{formatPrice(couponDiscount)}</strong>
                    </div>
                    <div className={styles.totalRow}>
                      <span>Ödenecek tutar</span>
                      <strong>{formatPrice(payableTotal)}</strong>
                    </div>
                  </>
                ) : null}

                <form id="checkout-pay-form" action={createOrderFromCartAction} className={styles.payForm}>
                  <button type="submit" className={styles.submitButton} disabled={!canSubmit}>
                    Ödemeye geç
                  </button>
                </form>

                <p className={styles.formHint}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  Devam ettiğinizde güvenli PAYTR ödeme ekranına yönlendirileceksiniz.
                </p>

                {!canSubmit ? (
                  <p className={styles.warningText}>Devam etmek için hesap bilgileri ve en az bir adres gerekli.</p>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}



