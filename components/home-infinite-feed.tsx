"use client";

import { HomeProductsCarousel } from "@/components/home-products-carousel";
import { addToCartAction, removeCartItemAction, updateCartItemQuantityAction } from "@/lib/cart-actions";
import { addToFavoritesAction, removeFavoriteItemAction } from "@/lib/favorites-actions";
import { buildProductSlug } from "@/lib/product-slug";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type ProductBadge = {
  id: number;
  label: string;
  tone: string;
  sortOrder: number;
  productId: number;
};

type ProductItem = {
  id: number;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  imageBroken: boolean;
  filledStars: number;
  ratingCount: number;
  price: number;
  oldPrice: number | null;
  addToCartLabel: string;
  cartStateLabel: string | null;
  quantityControl: boolean;
  quantity: number;
  showWishlist: boolean;
  sortOrder: number;
  badges: ProductBadge[];
};

type ProductSection = {
  id: number;
  slug: string;
  title: string;
  icon: string;
  sortOrder: number;
  siteConfigId: number;
  products: ProductItem[];
};

type PaginationState = {
  currentPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
  totalProducts: number;
  totalSections: number;
  sectionsPerPage: number;
  productsPerSection: number;
};

type CartStateByProductId = Record<string, { cartItemId: number; quantity: number }>;
type FavoriteStateByProductId = Record<string, { favoriteItemId: number }>;

type HomeInfiniteFeedSiteMeta = {
  sectionIcon: string;
  wishlistLabel: string;
  quantityLabel: string;
};

type HomeInfiniteFeedProps = {
  site: HomeInfiniteFeedSiteMeta;
  initialSections: ProductSection[];
  initialPagination: PaginationState;
  initialCartStateByProductId: CartStateByProductId;
  initialFavoriteStateByProductId: FavoriteStateByProductId;
};

type HomeSectionsApiResponse = {
  sections: ProductSection[];
  pagination: PaginationState;
  cartStateByProductId: CartStateByProductId;
  favoriteStateByProductId: FavoriteStateByProductId;
};

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

function FireIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22c4.1 0 7-2.8 7-6.7 0-3.8-2.5-5.7-4.5-8.1-.5 2.2-1.6 3.7-3.3 4.5.2-2.6-1.1-4.7-3.5-6.7C6.6 7.5 5 10.1 5 13.3 5 19.2 8.6 22 12 22Z"
        fill="currentColor"
      />
      <path
        d="M12.2 20.2c2 0 3.3-1.2 3.3-3.1 0-1.7-1-2.7-2.2-3.8-.3 1.1-.8 1.8-1.7 2.3.1-1.4-.5-2.5-1.7-3.5-.6 1.3-1.2 2.4-1.2 3.9 0 2.6 1.5 4.2 3.5 4.2Z"
        fill="#fbbf24"
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Yeni ürünler yüklenemedi.";
}

export function HomeInfiniteFeed({
  site,
  initialSections,
  initialPagination,
  initialCartStateByProductId,
  initialFavoriteStateByProductId,
}: HomeInfiniteFeedProps) {
  const [sections, setSections] = useState<ProductSection[]>(initialSections);
  const [pagination, setPagination] = useState<PaginationState>(initialPagination);
  const [cartStateByProductId, setCartStateByProductId] = useState<CartStateByProductId>(initialCartStateByProductId);
  const [favoriteStateByProductId, setFavoriteStateByProductId] = useState<FavoriteStateByProductId>(
    initialFavoriteStateByProductId,
  );
  const [isLoadingNextPage, setIsLoadingNextPage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const loadedPagesRef = useRef(new Set<number>([initialPagination.currentPage]));

  const loadNextPage = useCallback(async () => {
    const nextPage = pagination.nextPage;

    if (!nextPage || !pagination.hasNextPage || isFetchingRef.current || loadedPagesRef.current.has(nextPage)) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingNextPage(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/home/sections?page=${nextPage}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Yeni ürünler yüklenemedi.");
      }

      const payload = (await response.json()) as HomeSectionsApiResponse;

      loadedPagesRef.current.add(payload.pagination.currentPage);
      setPagination(payload.pagination);
      setCartStateByProductId((current) => ({ ...current, ...payload.cartStateByProductId }));
      setFavoriteStateByProductId((current) => ({ ...current, ...payload.favoriteStateByProductId }));
      setSections((current) => {
        const existingIds = new Set(current.map((section) => section.id));
        const uniqueSections = payload.sections.filter((section) => !existingIds.has(section.id));
        if (uniqueSections.length === 0) {
          return current;
        }

        return [...current, ...uniqueSections];
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      isFetchingRef.current = false;
      setIsLoadingNextPage(false);
    }
  }, [pagination.hasNextPage, pagination.nextPage]);

  useEffect(() => {
    const sentinelElement = sentinelRef.current;
    if (!sentinelElement) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        void loadNextPage();
      },
      {
        root: null,
        rootMargin: "700px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinelElement);

    return () => {
      observer.disconnect();
    };
  }, [loadNextPage]);

  return (
    <div className="best-sellers-list">
      {sections.map((section) => {
        const sectionProducts = section.products ?? [];

        if (sectionProducts.length === 0) {
          return null;
        }

        return (
          <div key={section.id} className="best-sellers-container">
            <div className="section-title-row">
              {section.icon === "fire" || site.sectionIcon === "fire" ? <FireIcon className="icon icon-fire" /> : null}
              <h1>{section.title}</h1>
            </div>

            <HomeProductsCarousel>
              {sectionProducts.map((product) => {
                const cartState = cartStateByProductId[String(product.id)];
                const favoriteState = favoriteStateByProductId[String(product.id)];

                return (
                  <article key={product.id} className="product-card">
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

                      {product.showWishlist ? (
                        <form action={favoriteState ? removeFavoriteItemAction : addToFavoritesAction} className="wishlist-form">
                          {favoriteState ? (
                            <input type="hidden" name="favoriteItemId" value={favoriteState.favoriteItemId} />
                          ) : (
                            <input type="hidden" name="productId" value={product.id} />
                          )}
                          <input type="hidden" name="redirectTo" value="/" />
                          <button
                            type="submit"
                            className={favoriteState ? "wishlist-button wishlist-button-active" : "wishlist-button"}
                            aria-label={favoriteState ? "Favorilerden çıkar" : site.wishlistLabel}
                          >
                            <HeartIcon className={favoriteState ? "icon icon-heart-mini is-active" : "icon icon-heart-mini"} />
                          </button>
                        </form>
                      ) : null}
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

                            <div className="quantity-box" aria-label={site.quantityLabel}>
                              {cartState.quantity <= 1 ? (
                                <form action={removeCartItemAction} className="quantity-step-form">
                                  <input type="hidden" name="cartItemId" value={cartState.cartItemId} />
                                  <input type="hidden" name="redirectTo" value="/" />
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
                                  <input type="hidden" name="redirectTo" value="/" />
                                  <button type="submit" className="quantity-step" aria-label={`${product.name} adet azalt`}>
                                    <MinusIcon className="icon icon-qty" />
                                  </button>
                                </form>
                              )}

                              <span className="quantity-value">{cartState.quantity}</span>

                              <form action={updateCartItemQuantityAction} className="quantity-step-form">
                                <input type="hidden" name="cartItemId" value={cartState.cartItemId} />
                                <input type="hidden" name="quantity" value={cartState.quantity + 1} />
                                <input type="hidden" name="redirectTo" value="/" />
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
                            <input type="hidden" name="redirectTo" value="/" />
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
            </HomeProductsCarousel>
          </div>
        );
      })}

      <div ref={sentinelRef} className="home-infinite-sentinel" aria-hidden="true" />

      {isLoadingNextPage ? <p className="home-infinite-status">Ürünler yükleniyor...</p> : null}

      {loadError ? (
        <div className="home-infinite-error">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadNextPage()}>
            Tekrar dene
          </button>
        </div>
      ) : null}
    </div>
  );
}
