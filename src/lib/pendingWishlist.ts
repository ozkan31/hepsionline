import type { Product } from "@/types";

const PENDING_WISHLIST_KEY = "pendingWishlistProducts";

function readPendingWishlist(): Product[] {
  try {
    const raw = localStorage.getItem(PENDING_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Product => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<Product>;
      return typeof candidate.id === "string" && candidate.id.trim().length > 0;
    });
  } catch {
    return [];
  }
}

function writePendingWishlist(items: Product[]) {
  if (items.length === 0) {
    localStorage.removeItem(PENDING_WISHLIST_KEY);
    return;
  }
  localStorage.setItem(PENDING_WISHLIST_KEY, JSON.stringify(items));
}

export function queuePendingWishlistProduct(product: Product) {
  const existing = readPendingWishlist();
  if (existing.some((item) => item.id === product.id)) return;
  const next = [...existing, product].slice(-20);
  writePendingWishlist(next);
}

export function consumePendingWishlistProducts(): Product[] {
  const items = readPendingWishlist();
  localStorage.removeItem(PENDING_WISHLIST_KEY);
  return items;
}

