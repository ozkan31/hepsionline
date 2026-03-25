import type { AppliedAbandonedCartCoupon, DiscountType } from "@/types";

const STORAGE_KEY = "stilbagsAbandonedCartCoupon";
const STORAGE_KEY_PREFIX = `${STORAGE_KEY}:`;

function normalizeCouponCode(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function calculateDiscountAmount(
  subtotal: number,
  coupon: Pick<AppliedAbandonedCartCoupon, "type" | "value" | "minimumSubtotal">
) {
  const safeSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  if (safeSubtotal <= 0 || safeSubtotal < Math.max(0, Math.round(Number(coupon.minimumSubtotal) || 0))) {
    return 0;
  }

  if (coupon.type === "fixed") {
    return Math.min(safeSubtotal, Math.max(0, Math.round(Number(coupon.value) || 0)));
  }

  const percentage = Math.max(0, Math.min(100, Number(coupon.value) || 0));
  return Math.min(safeSubtotal, Math.round((safeSubtotal * percentage) / 100));
}

function normalizeCouponOwner(owner?: string | null) {
  const normalized = String(owner ?? "").trim();
  return normalized ? normalized : "guest";
}

function getCouponStorageKey(owner?: string | null) {
  return `${STORAGE_KEY_PREFIX}${normalizeCouponOwner(owner)}`;
}

function cleanupLegacyCouponStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getStoredAbandonedCartCouponCode(owner?: string | null) {
  if (typeof window === "undefined") return "";
  try {
    cleanupLegacyCouponStorage();
    const raw = window.localStorage.getItem(getCouponStorageKey(owner));
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return normalizeCouponCode(String(parsed?.code ?? ""));
  } catch {
    return "";
  }
}

export function getStoredAbandonedCartCoupon(owner?: string | null) {
  if (typeof window === "undefined") return null;
  try {
    cleanupLegacyCouponStorage();
    const raw = window.localStorage.getItem(getCouponStorageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const code = normalizeCouponCode(String(parsed?.code ?? ""));
    if (!code) return null;
    return {
      ...parsed,
      code,
    } as AppliedAbandonedCartCoupon;
  } catch {
    return null;
  }
}

export function storeAbandonedCartCoupon(coupon: AppliedAbandonedCartCoupon, owner?: string | null) {
  if (typeof window === "undefined") return;
  cleanupLegacyCouponStorage();
  window.localStorage.setItem(
    getCouponStorageKey(owner),
    JSON.stringify({
      ...coupon,
      code: normalizeCouponCode(coupon.code),
    })
  );
}

export function clearStoredAbandonedCartCoupon(owner?: string | null) {
  if (typeof window === "undefined") return;
  cleanupLegacyCouponStorage();
  window.localStorage.removeItem(getCouponStorageKey(owner));
}

export function clearAllStoredAbandonedCartCoupons() {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (key === STORAGE_KEY || key.startsWith(STORAGE_KEY_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function normalizeClientCouponCode(value: string) {
  return normalizeCouponCode(value);
}

export function describeCouponDiscount(type: DiscountType, value: number) {
  if (type === "fixed") {
    return `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("tr-TR")} TL indirim`;
  }
  const percentage = Math.max(0, Math.min(100, Number(value) || 0));
  return `%${percentage.toLocaleString("tr-TR")} indirim`;
}

export function getCouponDiscountAmount(subtotal: number, coupon: AppliedAbandonedCartCoupon | null) {
  if (!coupon) return 0;
  return calculateDiscountAmount(subtotal, coupon);
}
