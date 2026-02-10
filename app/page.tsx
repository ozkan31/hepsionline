import { getHomepageData } from "@/lib/homepage-data";
import Image from "next/image";

export const dynamic = "force-dynamic";

type IconProps = {
  className?: string;
};

function SearchIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c1.7-3.3 4.2-5 8-5s6.3 1.7 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

function CartIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="20" r="1.8" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="20" r="1.8" stroke="currentColor" strokeWidth="2" />
      <path d="M4 4h2l2.2 10.5h10.3l2-7.5H7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  return `₺${value.toLocaleString("tr-TR")}`;
}

function renderIcon(icon: string, className: string) {
  if (icon === "search") return <SearchIcon className={className} />;
  if (icon === "user") return <UserIcon className={className} />;
  if (icon === "heart") return <HeartIcon className={className} />;
  if (icon === "cart") return <CartIcon className={className} />;
  if (icon === "fire") return <FireIcon className={className} />;
  return null;
}

export default async function Home() {
  const site = await getHomepageData();

  if (!site) {
    return (
      <main className="empty-state">
        <p>Site verisi bulunamadi. Veritabani seed komutunu calistirin.</p>
      </main>
    );
  }

  const primarySection = site.sections[0];

  return (
    <main className="shop-page">
      <header className="shop-header">
        <div className="shop-container">
          <div className="header-main-row">
            <div className="brand-box">
              <span className="brand-badge">{site.brandLetter}</span>
              <strong className="brand-name">{site.brandName}</strong>
            </div>

            <div className="search-shell">
              <input type="search" placeholder={site.searchPlaceholder} className="search-input" />
              <button type="button" className="search-button" aria-label={site.searchButtonLabel}>
                {renderIcon("search", "icon icon-search")}
              </button>
            </div>

            <div className="header-actions">
              {site.headerActions.map((action) => (
                <button key={action.id} type="button" className="action-item">
                  <span className="action-icon-wrap">
                    {renderIcon(action.icon, "icon icon-action")}
                    {typeof action.badgeCount === "number" ? (
                      <span className="action-badge">{action.badgeCount}</span>
                    ) : null}
                  </span>
                  <span className="action-label">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <nav className="category-row" aria-label={site.categoryNavLabel}>
            {site.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={category.isHighlighted ? "category-link category-link-highlight" : "category-link"}
              >
                {category.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="catalog-shell">
        <div className="shop-container">
          <div className="section-title-row">
            {renderIcon(primarySection?.icon ?? site.sectionIcon, "icon icon-fire")}
            <h1>{primarySection?.title ?? site.sectionTitle}</h1>
          </div>

          <div className="products-grid">
            {primarySection?.products.map((product) => (
              <article key={product.id} className="product-card">
                <div className="product-image-wrap">
                  {product.imageBroken || !product.imageUrl ? (
                    <div className="image-placeholder">
                      <span className="placeholder-symbol">🖼️</span>
                      <span>{product.imageAlt}</span>
                    </div>
                  ) : (
                    <Image
                      src={product.imageUrl}
                      alt={product.imageAlt}
                      width={400}
                      height={400}
                      className="product-image"
                    />
                  )}

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
                    <button type="button" className="wishlist-button" aria-label={site.wishlistLabel}>
                      <HeartIcon className="icon icon-heart-mini" />
                    </button>
                  ) : null}
                </div>

                <h2 className="product-name">{product.name}</h2>

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
                  {product.oldPrice ? <span className="old-price">{formatPrice(product.oldPrice)}</span> : null}
                </div>

                <div className="cart-row">
                  <button type="button" className={product.quantityControl ? "cart-button cart-button-added" : "cart-button"}>
                    {product.quantityControl && product.cartStateLabel ? product.cartStateLabel : product.addToCartLabel}
                  </button>

                  {product.quantityControl ? (
                    <div className="quantity-box" aria-label={site.quantityLabel}>
                      <button type="button" className="quantity-step" aria-label={site.decrementLabel}>
                        <MinusIcon className="icon icon-qty" />
                      </button>
                      <span className="quantity-value">{product.quantity}</span>
                      <button type="button" className="quantity-step" aria-label={site.incrementLabel}>
                        <PlusIcon className="icon icon-qty" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
