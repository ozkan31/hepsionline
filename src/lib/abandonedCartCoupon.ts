import type { AppliedAbandonedCartCoupon, DiscountType } from "@/types";

const STORAGE_KEY = "stilbagsAbandonedCartCoupon";

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

export function getStoredAbandonedCartCouponCode() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return normalizeCouponCode(String(parsed?.code ?? ""));
  } catch {
    return "";
  }
}

export function getStoredAbandonedCartCoupon() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

export function storeAbandonedCartCoupon(coupon: AppliedAbandonedCartCoupon) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...coupon,
      code: normalizeCouponCode(coupon.code),
    })
  );
}

export function clearStoredAbandonedCartCoupon() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
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
