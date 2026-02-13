import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import {
  buildPaytrBasketBase64,
  getClientIpFromHeaders,
  getPaytrConfig,
  requestPaytrIframeToken,
  resolveAppBaseUrl,
} from "@/lib/paytr";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import Link from "next/link";
import Script from "next/script";
import { notFound, redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Params = Promise<{
  orderId: string;
}>;

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseOrderId(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function generatePaytrMerchantOid(orderId: number) {
  const rand = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `ORD${orderId}${Date.now().toString(36).toUpperCase()}${rand}`;
}

function isMerchantOidDuplicateError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("merchant_oid") && (normalized.includes("benzersiz") || normalized.includes("kullanilmis") || normalized.includes("used"));
}

export default async function PaymentPage({ params }: { params: Params }) {
  const routeParams = await params;
  const orderId = parseOrderId(routeParams.orderId);
  if (!orderId) {
    notFound();
  }

  const [siteHeader, cartItemCount, favoriteItemCount, currentUser, order] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
    getCurrentUserFromSession(),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        totalAmount: true,
        paytrMerchantOid: true,
        paymentStatus: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    }),
  ]);

  if (!order) {
    notFound();
  }

  if (!currentUser) {
    redirect(`/giris?status=required&next=${encodeURIComponent(`/odeme/${order.id}`)}`);
  }

  const orderBelongsToUser = order.customerEmail === currentUser.email || order.customerPhone === currentUser.phone;
  if (!orderBelongsToUser) {
    notFound();
  }

  if (order.paymentStatus === "PAID") {
    return (
      <>
        {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
        <main className={styles.page}>
          <div className={styles.container}>
            <section className={styles.infoCard}>
              <h1>Ã–deme zaten tamamlandÄ±</h1>
              <p>SipariÅŸ #{order.orderNo ?? order.id} iÃ§in Ã¶deme daha Ã¶nce onaylanmÄ±ÅŸ.</p>
              <div className={styles.linkRow}>
                <Link href={`/odeme/basarili?orderId=${order.id}`} className={styles.primaryLink}>
                  SonuÃ§ sayfasÄ±na git
                </Link>
                <Link href="/" className={styles.secondaryLink}>
                  Ana sayfaya dÃ¶n
                </Link>
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  if (!order.customerEmail) {
    return (
      <>
        {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
        <main className={styles.page}>
          <div className={styles.container}>
            <section className={styles.errorCard}>
              <h1>Ã–deme baÅŸlatÄ±lamadÄ±</h1>
              <p>SipariÅŸ bilgileri eksik. LÃ¼tfen checkout adÄ±mÄ±na geri dÃ¶nÃ¼n.</p>
              <Link href="/checkout" className={styles.primaryLink}>
                Checkout sayfasÄ±na dÃ¶n
              </Link>
            </section>
          </div>
        </main>
      </>
    );
  }

  const paytrConfig = getPaytrConfig();
  if (!paytrConfig) {
    return (
      <>
        {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
        <main className={styles.page}>
          <div className={styles.container}>
            <section className={styles.errorCard}>
              <h1>PAYTR konfigÃ¼rasyonu eksik</h1>
              <p>
                Ortam deÄŸiÅŸkenlerinde PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT alanlarÄ±nÄ±
                tanÄ±mlayÄ±n.
              </p>
              <Link href="/checkout" className={styles.secondaryLink}>
                Checkout sayfasÄ±na dÃ¶n
              </Link>
            </section>
          </div>
        </main>
      </>
    );
  }

  const headersList = await headers();
  const baseUrl = resolveAppBaseUrl(headersList);
  const userIp = getClientIpFromHeaders(headersList);
  const merchantOkUrl = `${baseUrl}/odeme/basarili?orderId=${order.id}`;
  const merchantFailUrl = `${baseUrl}/odeme/basarisiz?orderId=${order.id}`;
  const basketBase64 = buildPaytrBasketBase64(
    order.items.map((item) => ({
      name: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
  );
  const paymentAmount = Math.max(1, order.totalAmount * 100);
  let activeMerchantOid = order.paytrMerchantOid;
  if (!activeMerchantOid) {
    const generatedOid = generatePaytrMerchantOid(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { paytrMerchantOid: generatedOid },
    });
    activeMerchantOid = generatedOid;
  }

  let tokenResult = await requestPaytrIframeToken({
    merchantOid: activeMerchantOid,
    userIp,
    email: order.customerEmail,
    paymentAmount,
    userBasketBase64: basketBase64,
    userName: order.customerName,
    userAddress: order.customerAddress,
    userPhone: order.customerPhone,
    merchantOkUrl,
    merchantFailUrl,
  });

  if (!tokenResult.ok && isMerchantOidDuplicateError(tokenResult.error)) {
    const regeneratedOid = generatePaytrMerchantOid(order.id);
    await prisma.order.update({
      where: { id: order.id },
      data: { paytrMerchantOid: regeneratedOid },
    });

    tokenResult = await requestPaytrIframeToken({
      merchantOid: regeneratedOid,
      userIp,
      email: order.customerEmail,
      paymentAmount,
      userBasketBase64: basketBase64,
      userName: order.customerName,
      userAddress: order.customerAddress,
      userPhone: order.customerPhone,
      merchantOkUrl,
      merchantFailUrl,
    });
  }

  if (!tokenResult.ok) {
    return (
      <>
        {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
        <main className={styles.page}>
          <div className={styles.container}>
            <section className={styles.errorCard}>
              <h1>Ã–deme tokeni alÄ±namadÄ±</h1>
              <p>{tokenResult.error}</p>
              <div className={styles.linkRow}>
                <Link href={`/odeme/${order.id}`} className={styles.primaryLink}>
                  Tekrar dene
                </Link>
                <Link href="/checkout" className={styles.secondaryLink}>
                  Checkout sayfasÄ±na dÃ¶n
                </Link>
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
      <main className={styles.page}>
        <div className={styles.container}>
          <section className={styles.infoCard}>
            <div>
              <h1>GÃ¼venli Ã–deme</h1>
              <p>
                SipariÅŸ #{order.orderNo ?? order.id} iÃ§in Ã¶deme adÄ±mÄ±ndasÄ±nÄ±z. Toplam tutar: <strong>{formatPrice(order.totalAmount)}</strong>
              </p>
            </div>
            <Link href="/checkout" className={styles.secondaryLink}>
              Geri dÃ¶n
            </Link>
          </section>

          <section className={styles.iframeCard}>
            <iframe
              src={`https://www.paytr.com/odeme/guvenli/${tokenResult.token}`}
              id="paytriframe"
              title="PAYTR GÃ¼venli Ã–deme"
              className={styles.iframe}
              frameBorder="0"
              scrolling="no"
            />
            <p className={styles.note}>
              Ã–deme sonucunda bu sayfadan otomatik olarak sonuÃ§ ekranÄ±na yÃ¶nlendirileceksiniz.
            </p>
          </section>
        </div>
      </main>

      <Script src="https://www.paytr.com/js/iframeResizer.min.js?ver=v2" strategy="afterInteractive" />
      <Script id="paytr-iframe-resize" strategy="afterInteractive">
        {`if (typeof iFrameResize === 'function') { iFrameResize({}, '#paytriframe'); }`}
      </Script>
    </>
  );
}


