import { SiteHeader } from "@/components/site-header";
import { addToCartAction, removeCartItemAction, updateCartItemQuantityAction } from "@/lib/cart-actions";
import { getCartDetailsFromCookie } from "@/lib/cart";
import { clearFavoritesAction, removeFavoriteItemAction } from "@/lib/favorites-actions";
import { getFavoriteDetailsFromCookie, getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { buildProductSlug } from "@/lib/product-slug";
import { getSiteHeaderData } from "@/lib/site-header-data";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type IconProps = {
  className?: string;
};

function HeartIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.5 4.5 13a5.3 5.3 0 0 1 0-7.5 5.3 5.3 0 0 1 7.5 0L12 6l.1-.5a5.3 5.3 0 0 1 7.4 7.5L12 20.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 3.5 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8L12 3.5Z" />
    </svg>
  );
}

function MinusIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function FavoritesPage() {
  const [siteHeader, cartSummary, favoriteItemCount, favoriteSummary] = await Promise.all([
    getSiteHeaderData(),
    getCartDetailsFromCookie(),
    getFavoriteItemCountFromCookie(),
    getFavoriteDetailsFromCookie(),
  ]);
  const cartItemCount = cartSummary.itemCount;

  const favoriteItems = favoriteSummary.favoriteList?.items ?? [];
  const cartStateByProductId = new Map<number, { cartItemId: number; quantity: number }>();

  for (const item of cartSummary.cart?.items ?? []) {
    cartStateByProductId.set(item.product.id, { cartItemId: item.id, quantity: item.quantity });
  }

  return (
    <main className="shop-page">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <section className="catalog-shell">
        <div className="shop-container">
          <div className={styles.headRow}>
            <div className={styles.titleWrap}>
              <h1>Favorilerim</h1>
              <span>{favoriteItems.length} ürün</span>
            </div>

            {favoriteItems.length > 0 ? (
              <form action={clearFavoritesAction}>
                <input type="hidden" name="redirectTo" value="/favoriler" />
                <button type="submit" className={styles.clearButton}>
                  Tümünü temizle
                </button>
              </form>
            ) : null}
          </div>

          {favoriteItems.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Henüz favori ürününüz yok.</p>
              <Link href="/" className={styles.emptyLink}>
                Alışverişe başla
              </Link>
            </div>
          ) : (
            <div className="products-grid">
              {favoriteItems.map((favoriteItem) => {
                const product = favoriteItem.product;
                const cartState = cartStateByProductId.get(product.id);

                return (
                  <article key={favoriteItem.id} className="product-card">
                    <div className="product-image-wrap">
                      <Link href={`/urun/${buildProductSlug(product.name, product.id)}`} aria-label={`${product.name} detayı`}>
                        {product.imageBroken || !product.imageUrl ? (
                          <div className="image-placeholder">
                            <span className="placeholder-symbol">Görsel</span>
                            <span>{product.imageAlt}</span>
                          </div>
                        ) : (
                          <Image src={product.imageUrl} alt={product.imageAlt} width={400} height={400} className="product-image" />
                        )}
                      </Link>

                      <div className="badge-stack">
                        {product.badges.map((badge) => (
                          <span
                            key={badge.id}
                            className={badge.tone === "orange" ? "product-badge badge-orange" : "product-badge badge-red"}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>

                      <form action={removeFavoriteItemAction} className="wishlist-form">
                        <input type="hidden" name="favoriteItemId" value={favoriteItem.id} />
                        <input type="hidden" name="redirectTo" value="/favoriler" />
                        <button type="submit" className="wishlist-button wishlist-button-active" aria-label="Favorilerden çıkar">
                          <HeartIcon className="icon icon-heart-mini is-active" />
                        </button>
                      </form>
                    </div>

                    <div className="product-content">
                      <h2 className="product-name">
                        <Link href={`/urun/${buildProductSlug(product.name, product.id)}`} className="product-link">
                          {product.name}
                        </Link>
                      </h2>

                      <div className="rating-row">
                        <div className="star-row" aria-hidden="true">
                          {Array.from({ length: 5 }).map((_, starIndex) => (
                            <StarIcon
                              key={`${product.id}-${starIndex}`}
                              className={starIndex < product.filledStars ? "icon icon-star-filled" : "icon icon-star-empty"}
                            />
                          ))}
                        </div>
                        <span className="rating-count">({product.ratingCount})</span>
                      </div>

                      <div className="price-row">
                        <strong className="current-price">{formatPrice(product.price)}</strong>
                      </div>

                      <div className="cart-row">
                        {cartState ? (
                          <div className="cart-split">
                            <span className="cart-added-label">{product.cartStateLabel || "Sepete eklendi"}</span>

                            <div className="quantity-box" aria-label="Adet">
                              {cartState.quantity <= 1 ? (
                                <form action={removeCartItemAction} className="quantity-step-form">
                                  <input type="hidden" name="cartItemId" value={cartState.cartItemId} />
                                  <input type="hidden" name="redirectTo" value="/favoriler" />
                                  <button
                                    type="submit"
                                    className="quantity-step quantity-step-delete"
                                    style={{
                                      color: "#EF4444",
                                      background: "#FEE2E2",
                                      backgroundImage: "none",
                                      border: "1px solid #FECACA",
                                    }}
                                    aria-label={`${product.name} sepetten sil`}
                                  >
                                    Sil
                                  </button>
                                </form>
                              ) : (
                                <form action={updateCartItemQuantityAction} className="quantity-step-form">
                                  <input type="hidden" name="cartItemId" value={cartState.cartItemId} />
                                  <input type="hidden" name="quantity" value={cartState.quantity - 1} />
                                  <input type="hidden" name="redirectTo" value="/favoriler" />
                                  <button type="submit" className="quantity-step" aria-label={`${product.name} adet azalt`}>
                                    <MinusIcon className="icon icon-qty" />
                                  </button>
                                </form>
                              )}

                              <span className="quantity-value">{cartState.quantity}</span>

                              <form action={updateCartItemQuantityAction} className="quantity-step-form">
                                <input type="hidden" name="cartItemId" value={cartState.cartItemId} />
                                <input type="hidden" name="quantity" value={cartState.quantity + 1} />
                                <input type="hidden" name="redirectTo" value="/favoriler" />
                                <button type="submit" className="quantity-step" aria-label={`${product.name} adet artır`}>
                                  <PlusIcon className="icon icon-qty" />
                                </button>
                              </form>
                            </div>
                          </div>
                        ) : (
                          <form action={addToCartAction} className="cart-form">
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="quantity" value={1} />
                            <input type="hidden" name="redirectTo" value="/favoriler" />
                            <button type="submit" className="cart-button">
                              {product.addToCartLabel}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
