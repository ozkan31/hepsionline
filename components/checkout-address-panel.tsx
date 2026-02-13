"use client";

import { upsertPrimaryAddressAction } from "@/lib/user-auth-actions";
import { MapPin, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "@/app/checkout/page.module.css";

export type CheckoutAddressOption = {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
};

function buildCompactAddress(address: CheckoutAddressOption) {
  return [
    address.addressLine1,
    address.addressLine2,
    `${address.district} / ${address.city}`,
    address.postalCode,
    address.country,
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(", ");
}

export function CheckoutAddressPanel({
  formId,
  fallbackName,
  fallbackPhone,
  customerEmail,
  addresses,
}: {
  formId: string;
  fallbackName: string;
  fallbackPhone: string;
  customerEmail: string;
  addresses: CheckoutAddressOption[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(addresses[0]?.id ?? "");
  const selectedAddress = useMemo(() => addresses.find((address) => address.id === selectedAddressId) ?? null, [addresses, selectedAddressId]);

  const selectedFullName = selectedAddress?.fullName || fallbackName;
  const selectedPhone = selectedAddress?.phone || fallbackPhone;
  const selectedAddressText = selectedAddress ? buildCompactAddress(selectedAddress) : "";

  return (
    <>
      <div className={styles.deliveryHead}>
        <h2>Teslimat Bilgileri</h2>
        <button type="button" className={styles.addressAddButton} onClick={() => setModalOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          Adres Ekle
        </button>
      </div>

      <input type="hidden" form={formId} name="customerName" value={selectedFullName} />
      <input type="hidden" form={formId} name="customerEmail" value={customerEmail} />
      <input type="hidden" form={formId} name="customerPhone" value={selectedPhone} />
      <input type="hidden" form={formId} name="customerAddress" value={selectedAddressText} />
      <input type="hidden" form={formId} name="customerNote" value="" />

      {addresses.length === 0 ? (
        <div className={styles.addressEmpty}>Kayıtlı adres bulunamadı. Sağ üstteki Adres Ekle ile yeni adres ekleyebilirsin.</div>
      ) : (
        <div className={styles.addressOptions}>
          {addresses.map((address) => {
            const isActive = selectedAddressId === address.id;

            return (
              <label
                key={address.id}
                className={isActive ? `${styles.addressCard} ${styles.addressCardActive}` : styles.addressCard}
                onClick={() => setSelectedAddressId(address.id)}
              >
                <input
                  type="radio"
                  name="checkoutSelectedAddress"
                  checked={isActive}
                  onChange={() => setSelectedAddressId(address.id)}
                  className={styles.addressRadio}
                />

                <MapPin className={styles.addressIcon} />

                <div className={styles.addressInlineRow}>
                  <span className={styles.addressChip}>{address.fullName}</span>
                  <span className={styles.addressChip}>{address.phone}</span>
                  <span className={styles.addressChip}>{address.addressLine1}</span>
                  {address.addressLine2 ? <span className={styles.addressChip}>{address.addressLine2}</span> : null}
                  <span className={styles.addressChip}>
                    {address.district} / {address.city}
                  </span>
                  <span className={styles.addressChip}>{address.postalCode}</span>
                  <span className={styles.addressChip}>{address.country}</span>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <div className={styles.addressModalLayer} role="dialog" aria-modal="true" aria-label="Adres Ekle">
          <div className={styles.addressModalBackdrop} onClick={() => setModalOpen(false)} />
          <div className={styles.addressModalCard}>
            <form action={upsertPrimaryAddressAction}>
              <input type="hidden" name="redirectTo" value="/checkout" />

              <div className={styles.addressModalHead}>
                <h3>Yeni Adres Ekle</h3>
                <button type="button" onClick={() => setModalOpen(false)} className={styles.addressModalClose} aria-label="Kapat">
                  <X size={18} />
                </button>
              </div>

              <div className={styles.addressModalBody}>
                <label className={styles.modalField}>
                  <span>Ad Soyad</span>
                  <input name="fullName" defaultValue={selectedAddress?.fullName ?? fallbackName} required />
                </label>

                <label className={styles.modalField}>
                  <span>Telefon</span>
                  <input name="phone" defaultValue={selectedAddress?.phone ?? fallbackPhone} required />
                </label>

                <label className={styles.modalField}>
                  <span>İl</span>
                  <input name="city" defaultValue={selectedAddress?.city ?? ""} required />
                </label>

                <label className={styles.modalField}>
                  <span>İlçe</span>
                  <input name="district" defaultValue={selectedAddress?.district ?? ""} required />
                </label>

                <label className={styles.modalField}>
                  <span>Posta Kodu</span>
                  <input name="postalCode" defaultValue={selectedAddress?.postalCode ?? ""} required />
                </label>

                <label className={styles.modalField}>
                  <span>Adres Satırı 1</span>
                  <input name="addressLine1" defaultValue={selectedAddress?.addressLine1 ?? ""} required />
                </label>

                <label className={styles.modalField}>
                  <span>Adres Satırı 2 (opsiyonel)</span>
                  <input name="addressLine2" defaultValue={selectedAddress?.addressLine2 ?? ""} />
                </label>
              </div>

              <div className={styles.addressModalActions}>
                <button type="button" onClick={() => setModalOpen(false)} className={styles.modalCancel}>
                  Vazgeç
                </button>
                <button type="submit" className={styles.modalSave}>
                  Adresi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
