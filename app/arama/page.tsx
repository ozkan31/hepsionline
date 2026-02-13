import { SiteHeader } from "@/components/site-header";
import { addToCartAction, removeCartItemAction, updateCartItemQuantityAction } from "@/lib/cart-actions";
import { getCartDetailsFromCookie } from "@/lib/cart";
import { addToFavoritesAction, removeFavoriteItemAction } from "@/lib/favorites-actions";
import { getFavoriteDetailsFromCookie, getFavoriteItemCountFromCookie } from "@/lib/favorites";
import type { ProductSearchSort } from "@/lib/product-search";
import { searchProductsSmart } from "@/lib/product-search";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  min?: string;
  max?: string;
  rating?: string;
  discounted?: string;
  stock?: string;
  sort?: string;
  section?: string;
}>;

type IconProps = {
  className?: string;
};

const SORT_OPTIONS: { value: ProductSearchSort; label: string }[] = [
  { value: "relevance", label: "Önerilen" },
  { value: "price_asc", label: "Fiyat: Artan" },
  { value: "price_desc", label: "Fiyat: Azalan" },
  { value: "rating_desc", label: "Puanı yüksek" },
  { value: "newest", label: "En yeni" },
];

function parseOptionalInteger(rawValue: string | undefined, min: number, max: number) {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < min) {
    return min;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

function parseFlag(rawValue: string | undefined) {
  return rawValue === "1" || rawValue === "true";
}

function parseSort(rawValue: string | undefined): ProductSearchSort {
  if (rawValue === "price_asc" || rawValue === "price_desc" || rawValue === "rating_desc" || rawValue === "newest") {
    return rawValue;
  }

  return "relevance";
}

function buildSearchHref(params: {
  query: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
  discountedOnly: boolean;
  inStockOnly: boolean;
  sort: ProductSearchSort;
  sectionSlug: string | null;
}) {
  const search = new URLSearchParams();

  if (params.query.trim()) {
    search.set("q", params.query.trim());
  }

  if (params.minPrice !== null) {
    search.set("min", String(params.minPrice));
  }

  if (params.maxPrice !== null) {
    search.set("max", String(params.maxPrice));
  }

  if (params.minRating !== null) {
    search.set("rating", String(params.minRating));
  }

  if (params.discountedOnly) {
    search.set("discounted", "1");
  }

  if (params.inStockOnly) {
    search.set("stock", "1");
  }

  if (params.sort !== "relevance") {
    search.set("sort", params.sort);
  }

  if (params.sectionSlug) {
    search.set("section", params.sectionSlug);
  }

  const encoded = search.toString();
  return encoded.length > 0 ? `/arama?${encoded}` : "/arama";
}

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

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const hasQuery = query.length > 0;

  let minPrice = parseOptionalInteger(params.min, 0, 1_000_000_000);
  let maxPrice = parseOptionalInteger(params.max, 0, 1_000_000_000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    const temp = minPrice;
    minPrice = maxPrice;
    maxPrice = temp;
  }

  const minRating = parseOptionalInteger(params.rating, 1, 5);
  const discountedOnly = parseFlag(params.discounted);
  const inStockOnly = parseFlag(params.stock);
  const sort = parseSort(params.sort);
  const sectionSlug = (params.section ?? "").trim() || null;

  const hasActiveFilters =
    minPrice !== null ||
    maxPrice !== null ||
    minRating !== null ||
    discountedOnly ||
    inStockOnly ||
    sort !== "relevance" ||
    Boolean(sectionSlug);

  const searchRedirect = buildSearchHref({
    query,
    minPrice,
    maxPrice,
    minRating,
    discountedOnly,
    inStockOnly,
    sort,
    sectionSlug,
  });

  const [siteHeader, cartSummary, favoriteItemCount, favoriteSummary, smartResult, sections] = await Promise.all([
    getSiteHeaderData(),
    getCartDetailsFromCookie(),
    getFavoriteItemCountFromCookie(),
    getFavoriteDetailsFromCookie(),
    hasQuery
      ? searchProductsSmart(query, {
          limit: 64,
          preferStartsWith: false,
          minPrice,
          maxPrice,
          minRating,
          discountedOnly,
          inStockOnly,
          sectionSlug,
          sort,
        })
      : Promise.resolve({ products: [], correctedQuery: null, suggestions: [], usedFuzzy: false }),
    prisma.section.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
      },
    }),
  ]);
  const products = smartResult.products;
  const correctedQuery = smartResult.correctedQuery;
  const cartItemCount = cartSummary.itemCount;

  const cartStateByProductId = new Map<number, { cartItemId: number; quantity: number }>();
  const favoriteStateByProductId = new Map<number, { favoriteItemId: number }>();

  for (const item of cartSummary.cart?.items ?? []) {
    cartStateByProductId.set(item.product.id, { cartItemId: item.id, quantity: item.quantity });
  }

  for (const item of favoriteSummary.favoriteList?.items ?? []) {
    favoriteStateByProductId.set(item.product.id, { favoriteItemId: item.id });
  }

  return (
    <main className="shop-page">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <section className="catalog-shell">
        <div className="shop-container">
          <div className="section-title-row">
            <h1>Arama Sonuçları</h1>
          </div>

          {!hasQuery ? <p className={styles.helper}>Arama kutusuna kelime yazın.</p> : null}

          {hasQuery ? (
            <form method="GET" className={styles.filterForm}>
              <input type="hidden" name="q" value={query} />

              <label className={styles.field}>
                <span className={styles.label}>Kategori</span>
                <select name="section" defaultValue={sectionSlug ?? ""} className={styles.control}>
                  <option value="">Tüm kategoriler</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.slug}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Min fiyat</span>
                <input
                  name="min"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={minPrice !== null ? String(minPrice) : ""}
                  className={styles.control}
                  placeholder="0"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Max fiyat</span>
                <input
                  name="max"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={maxPrice !== null ? String(maxPrice) : ""}
                  className={styles.control}
                  placeholder="25000"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Min puan</span>
                <select
                  name="rating"
                  defaultValue={minRating !== null ? String(minRating) : ""}
                  className={styles.control}
                >
                  <option value="">Farketmez</option>
                  <option value="5">5 yıldız</option>
                  <option value="4">4 yıldız ve üzeri</option>
                  <option value="3">3 yıldız ve üzeri</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Sıralama</span>
                <select name="sort" defaultValue={sort} className={styles.control}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`${styles.checkboxField} ${styles.field}`}>
                <input type="checkbox" name="discounted" value="1" defaultChecked={discountedOnly} />
                <span>Sadece indirimli</span>
              </label>

              <label className={`${styles.checkboxField} ${styles.field}`}>
                <input type="checkbox" name="stock" value="1" defaultChecked={inStockOnly} />
                <span>Stokta olanlar</span>
              </label>

              <div className={styles.actions}>
                <button type="submit" className={styles.applyButton}>
                  Uygula
                </button>
                {hasActiveFilters ? (
                  <Link href={{ pathname: "/arama", query: { q: query } }} className={styles.clearButton}>
                    Temizle
                  </Link>
                ) : null}
              </div>
            </form>
          ) : null}

          {hasQuery ? (
            <p className={styles.helper}>
              “{query}” için <strong>{products.length}</strong> ürün bulundu.
            </p>
          ) : null}

          {hasQuery && correctedQuery ? (
            <p className={styles.helper}>
              Bunu da deneyin:{" "}
              <Link href={{ pathname: "/arama", query: { q: correctedQuery } }} className={styles.clearButton}>
                {correctedQuery}
              </Link>
            </p>
          ) : null}

          {hasQuery && products.length === 0 ? <p className={styles.helper}>Bu arama için ürün bulunamadı.</p> : null}

          {hasQuery && products.length > 0 ? (
            <div className="products-grid">
              {products.map((product) => {
                const cartState = cartStateByProductId.get(product.id);
                const favoriteState = favoriteStateByProductId.get(product.id);

                return (
                  <article key={product.id} className="product-card">
                    <div className="product-image-wrap">
                      <Link href={`/urun/${product.slug}`} aria-label={`${product.name} detayı`}>
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

                      {product.showWishlist ? (
                        <form action={favoriteState ? removeFavoriteItemAction : addToFavoritesAction} className="wishlist-form">
                          {favoriteState ? (
                            <input type="hidden" name="favoriteItemId" value={favoriteState.favoriteItemId} />
                          ) : (
                            <input type="hidden" name="productId" value={product.id} />
                          )}
                          <input type="hidden" name="redirectTo" value={searchRedirect} />
                          <button
                            type="submit"
                            className={favoriteState ? "wishlist-button wishlist-button-active" : "wishlist-button"}
                            aria-label={favoriteState ? "Favorilerden çıkar" : "Favorilere ekle"}
                          >
                            <HeartIcon className={favoriteState ? "icon icon-heart-mini is-active" : "icon icon-heart-mini"} />
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="product-content">
                      <h2 className="product-name">
                        <Link href={`/urun/${product.slug}`} className="product-link">
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
                                  <input type="hidden" name="redirectTo" value={searchRedirect} />
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
                                  <input type="hidden" name="redirectTo" value={searchRedirect} />
                                  <button type="submit" className="quantity-step" aria-label={`${product.name} adet azalt`}>
                                    <MinusIcon className="icon icon-qty" />
                                  </button>
                                </form>
                              )}

                              <span className="quantity-value">{cartState.quantity}</span>

                              <form action={updateCartItemQuantityAction} className="quantity-step-form">
                                <input type="hidden" name="cartItemId" value={cartState.cartItemId} />
                                <input type="hidden" name="quantity" value={cartState.quantity + 1} />
                                <input type="hidden" name="redirectTo" value={searchRedirect} />
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
                            <input type="hidden" name="redirectTo" value={searchRedirect} />
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
          ) : null}
        </div>
      </section>
    </main>
  );
}
