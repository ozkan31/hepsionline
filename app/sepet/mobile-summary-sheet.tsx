"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type MobileSummaryItem = {
  id: number;
  quantity: number;
  unitPrice: number;
  product: {
    name: string;
    imageUrl: string | null;
    imageAlt: string;
    imageBroken: boolean;
  };
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={open ? `${styles.mobileSummaryChevron} ${styles.mobileSummaryChevronOpen}` : styles.mobileSummaryChevron}
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.mobileSummaryCheckoutIcon}>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m13 7 6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileSummarySheet({
  items,
  subtotal,
  shipping,
  total,
  couponDiscount,
  checkoutHref,
}: {
  items: MobileSummaryItem[];
  subtotal: number;
  shipping: number;
  total: number;
  couponDiscount: number;
  checkoutHref: string;
}) {
  const [open, setOpen] = useState(false);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const canCheckout = items.length > 0;
  const productCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <section className={open ? `${styles.mobileSummary} ${styles.mobileSummaryOpen}` : styles.mobileSummary} aria-label="Sepet özeti">
      <div className={styles.mobileSummaryTitle}>Sepet Ozeti</div>
      <div className={styles.mobileSummaryLine} />

      {open ? (
        <div className={styles.mobileSummaryBody}>
          <div className={styles.mobileSummaryCount}>Sepetim ({productCount})</div>

          <div className={styles.mobileSummaryItems}>
            {items.map((item) => (
              <div key={item.id} className={styles.mobileSummaryItem}>
                <div className={styles.mobileSummaryThumb}>
                  <span className={styles.mobileSummaryQtyBadge}>x{item.quantity}</span>
                  {item.product.imageBroken || !item.product.imageUrl ? (
                    <span className={styles.mobileSummaryThumbFallback}>Gorsel</span>
                  ) : (
                    <Image
                      src={item.product.imageUrl}
                      alt={item.product.imageAlt}
                      width={40}
                      height={40}
                      className={styles.mobileSummaryThumbImage}
                    />
                  )}
                </div>
                <div className={styles.mobileSummaryItemMeta}>
                  <span className={styles.mobileSummaryItemPrice}>{formatter.format(item.unitPrice * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.mobileSummaryTotals}>
            <div className={styles.mobileSummaryTotalsRow}>
              <span>Ara Toplam</span>
              <strong>{formatter.format(subtotal)}</strong>
            </div>
            {couponDiscount > 0 ? (
              <div className={styles.mobileSummaryTotalsRow}>
                <span>Kupon Indirimi</span>
                <strong>-{formatter.format(couponDiscount)}</strong>
              </div>
            ) : null}
            <div className={styles.mobileSummaryTotalsRow}>
              <span>Kargo</span>
              <strong>{shipping <= 0 ? "Ucretsiz" : formatter.format(shipping)}</strong>
            </div>
            <div className={`${styles.mobileSummaryTotalsRow} ${styles.mobileSummaryTotalsRowTotal}`}>
              <span>Toplam</span>
              <strong>{formatter.format(total)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.mobileSummaryActions}>
        <button
          type="button"
          className={styles.mobileSummaryToggle}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? "Sepet özetini gizle" : "Sepet özetini göster"}
        >
          <ChevronIcon open={open} />
          <span>{formatter.format(total)}</span>
        </button>

        <Link
          className={canCheckout ? styles.mobileSummaryCheckout : `${styles.mobileSummaryCheckout} ${styles.mobileSummaryCheckoutDisabled}`}
          href={canCheckout ? checkoutHref : "/sepet"}
          aria-disabled={!canCheckout}
        >
          Sepeti Onayla
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}
