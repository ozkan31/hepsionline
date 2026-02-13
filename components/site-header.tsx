"use client";

import { LiveProductSearch } from "@/components/live-product-search";
import type { SiteHeaderData } from "@/lib/site-header-data";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const HEADER_CATEGORY_LABELS = [
  "Kadın",
  "Erkek",
  "Anne & Çocuk",
  "Ev & Yaşam",
  "Kozmetik",
  "Ayakkabı & Çanta",
  "Elektronik",
  "Saat & Aksesuar",
  "Spor & Outdoor",
] as const;

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

function MenuIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type RootCategoryIconKey =
  | "fashion"
  | "baby"
  | "market"
  | "book"
  | "watch"
  | "jewel"
  | "tools"
  | "health"
  | "office"
  | "gift"
  | "digital"
  | "default";

function getRootCategoryIconKey(slug: string, label: string): RootCategoryIconKey {
  const normalized = `${slug} ${label}`.toLowerCase();

  if (normalized.includes("erkek") || normalized.includes("kadin")) return "fashion";
  if (normalized.includes("anne") || normalized.includes("bebek")) return "baby";
  if (normalized.includes("supermarket")) return "market";
  if (normalized.includes("kitap") || normalized.includes("kirtasiye")) return "book";
  if (normalized.includes("saat")) return "watch";
  if (normalized.includes("taki") || normalized.includes("mucevher")) return "jewel";
  if (normalized.includes("yapi") || normalized.includes("bahce") || normalized.includes("market")) return "tools";
  if (normalized.includes("saglik")) return "health";
  if (normalized.includes("ofis") || normalized.includes("is")) return "office";
  if (normalized.includes("hediye") || normalized.includes("parti")) return "gift";
  if (normalized.includes("dijital")) return "digital";

  return "default";
}

function CategoryRootIcon({ iconKey, className = "" }: { iconKey: RootCategoryIconKey; className?: string }) {
  if (iconKey === "fashion") return <UserIcon className={className} />;

  if (iconKey === "baby") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="10" r="4.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="18" r="2.4" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (iconKey === "market") return <CartIcon className={className} />;

  if (iconKey === "book") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14.5H6.5A2.5 2.5 0 0 0 4 21V6.5Z" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8h8M8 11h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (iconKey === "watch") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="2.5" width="6" height="4" rx="1.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="2" />
        <path d="M12 12V9.6m0 2.4 1.7 1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="9" y="17.5" width="6" height="4" rx="1.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (iconKey === "jewel") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 10.2 12 19.5l7.5-9.3L16.8 5H7.2L4.5 10.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M7.2 5 12 10.2 16.8 5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (iconKey === "tools") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 4h7v4l-3 3v8h-4V11L10 8V4h3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M4 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (iconKey === "health") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (iconKey === "office") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="7.5" width="17" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (iconKey === "gift") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M4 10h16M12 10v10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 10h4.1A2.1 2.1 0 1 0 14 6.8L12 10Zm0 0H7.9A2.1 2.1 0 1 1 10 6.8L12 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (iconKey === "digital") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M4 9h2m0 6H4m14-6h2m0 6h-2M9 4v2m6 0V4m-6 16v-2m6 2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="2" />
      <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="13" width="6.5" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function renderActionIcon(icon: string, className: string) {
  if (icon === "search") return <SearchIcon className={className} />;
  if (icon === "user") return <UserIcon className={className} />;
  if (icon === "heart") return <HeartIcon className={className} />;
  if (icon === "cart") return <CartIcon className={className} />;
  return null;
}

export function SiteHeader({
  site,
  cartItemCount,
  favoriteItemCount,
}: {
  site: SiteHeaderData;
  cartItemCount?: number;
  favoriteItemCount?: number;
}) {
  const [isCategoryVisible, setIsCategoryVisible] = useState(true);
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean | null>(null);
  const [activeRootId, setActiveRootId] = useState<number | null>(site.categories[0]?.id ?? null);
  const [expandedChildMap, setExpandedChildMap] = useState<Record<number, boolean>>({});
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);

  const activeRootCategory = useMemo(() => {
    return site.categories.find((category) => category.id === activeRootId) ?? site.categories[0] ?? null;
  }, [activeRootId, site.categories]);

  useEffect(() => {
    const onScroll = () => {
      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const previousY = lastScrollYRef.current;
        const delta = currentY - previousY;

        if (currentY <= 12) {
          setIsCategoryVisible(true);
        } else if (Math.abs(delta) >= 6) {
          setIsCategoryVisible(delta < 0);
        }

        lastScrollYRef.current = currentY;
        tickingRef.current = false;
      });
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return response.json() as Promise<{ loggedIn?: boolean }>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setIsUserLoggedIn(payload?.loggedIn === true);
      })
      .catch(() => {
        if (active) {
          setIsUserLoggedIn(false);
        }
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, []);

  return (
    <header className="shop-header">
      <div className="shop-container">
        <div className="header-main-row">
          <Link href="/" className="brand-box" aria-label="Ana sayfa">
            <span className="brand-badge">{site.brandLetter}</span>
            <strong className="brand-name">{site.brandName}</strong>
          </Link>

          <LiveProductSearch placeholder={site.searchPlaceholder} buttonLabel={site.searchButtonLabel} />

          <div className="header-actions">
            {site.headerActions.map((action) => {
              const badgeCount =
                action.icon === "cart"
                  ? (typeof cartItemCount === "number" ? cartItemCount : action.badgeCount)
                  : action.icon === "heart"
                    ? (typeof favoriteItemCount === "number" ? favoriteItemCount : action.badgeCount)
                    : action.badgeCount;

              if (action.icon === "cart") {
                return (
                  <Link key={action.id} href="/sepet" className="action-item">
                    <span className="action-icon-wrap">
                      {renderActionIcon(action.icon, "icon icon-action")}
                      {typeof badgeCount === "number" && badgeCount > 0 ? <span className="action-badge">{badgeCount}</span> : null}
                    </span>
                    <span className="action-label">{action.label}</span>
                  </Link>
                );
              }

              if (action.icon === "heart") {
                return (
                  <Link key={action.id} href="/favoriler" className="action-item">
                    <span className="action-icon-wrap">
                      {renderActionIcon(action.icon, "icon icon-action")}
                      {typeof badgeCount === "number" && badgeCount > 0 ? <span className="action-badge">{badgeCount}</span> : null}
                    </span>
                    <span className="action-label">{action.label}</span>
                  </Link>
                );
              }

              if (action.icon === "user") {
                if (isUserLoggedIn !== true) {
                  return (
                    <div key={action.id} className="action-auth-wrap">
                      <div className="action-item action-auth-trigger" aria-hidden="true">
                        <span className="action-icon-wrap">
                          {renderActionIcon(action.icon, "icon icon-action")}
                          {typeof badgeCount === "number" && badgeCount > 0 ? (
                            <span className="action-badge">{badgeCount}</span>
                          ) : null}
                        </span>
                        <span className="action-label">Giriş Yap</span>
                      </div>

                      <div className="action-auth-dropdown" role="menu" aria-label="Kullanıcı menüsü">
                        <Link href="/giris" className="action-auth-link" role="menuitem">
                          Giriş Yap
                        </Link>
                        <Link href="/kayit" className="action-auth-link" role="menuitem">
                          Kayıt Ol
                        </Link>
                      </div>
                    </div>
                  );
                }

                return (
                  <Link key={action.id} href="/hesabim" className="action-item">
                    <span className="action-icon-wrap">
                      {renderActionIcon(action.icon, "icon icon-action")}
                      {typeof badgeCount === "number" && badgeCount > 0 ? <span className="action-badge">{badgeCount}</span> : null}
                    </span>
                    <span className="action-label">{action.label}</span>
                  </Link>
                );
              }

              return (
                <button key={action.id} type="button" className="action-item">
                  <span className="action-icon-wrap">
                    {renderActionIcon(action.icon, "icon icon-action")}
                    {typeof badgeCount === "number" ? <span className="action-badge">{badgeCount}</span> : null}
                  </span>
                  <span className="action-label">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <nav
          className={isCategoryVisible ? "category-row" : "category-row category-row-hidden"}
          aria-label={site.categoryNavLabel}
          aria-hidden={!isCategoryVisible}
        >
          <div
            className="category-mega-wrap"
            onMouseEnter={() => {
              if (!activeRootCategory && site.categories[0]) {
                setActiveRootId(site.categories[0].id);
              }
              setIsMegaOpen(true);
            }}
            onMouseLeave={() => setIsMegaOpen(false)}
          >
            <div className="category-mega-trigger" aria-label="Kategoriler menüsü">
              <MenuIcon className="icon icon-menu" />
              <span className="category-mega-label">Kategoriler</span>
            </div>

            {isMegaOpen && activeRootCategory ? (
              <div className="category-mega-panel">
                <div className="category-mega-left">
                  {site.categories.map((category) => (
                    <div
                      key={category.id}
                      className={category.id === activeRootCategory.id ? "category-mega-root is-active" : "category-mega-root"}
                      onMouseEnter={() => setActiveRootId(category.id)}
                      onClick={() => setActiveRootId(category.id)}
                    >
                      <CategoryRootIcon
                        iconKey={getRootCategoryIconKey(category.slug, category.label)}
                        className="icon icon-category-root"
                      />
                      <span className="category-root-label">{category.label}</span>
                    </div>
                  ))}
                </div>

                <div className="category-mega-right">
                  {activeRootCategory.children.length === 0 ? (
                    <p className="category-mega-empty">Alt kategori bulunamadı.</p>
                  ) : (
                    <div className="category-mega-groups">
                      {activeRootCategory.children.map((childCategory) => (
                        <div key={childCategory.id} className="category-mega-group">
                          <Link
                            href={{ pathname: "/arama", query: { q: childCategory.label } }}
                            className="category-mega-group-title"
                          >
                            {childCategory.label}
                          </Link>

                          {childCategory.children.length > 0 ? (
                            <div className="category-mega-sublist">
                              {(expandedChildMap[childCategory.id]
                                ? childCategory.children
                                : childCategory.children.slice(0, 5)
                              ).map((grandChildCategory) => (
                                <Link
                                  key={grandChildCategory.id}
                                  href={{ pathname: "/arama", query: { q: grandChildCategory.label } }}
                                  className="category-mega-subitem"
                                >
                                  {grandChildCategory.label}
                                </Link>
                              ))}
                            </div>
                          ) : null}

                          {childCategory.children.length > 5 ? (
                            <button
                              type="button"
                              className="category-mega-more-btn"
                              onClick={() =>
                                setExpandedChildMap((previous) => ({
                                  ...previous,
                                  [childCategory.id]: !previous[childCategory.id],
                                }))
                              }
                            >
                              <span>{expandedChildMap[childCategory.id] ? "Daha az gör" : "Daha fazla gör"}</span>
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                                className={
                                  expandedChildMap[childCategory.id]
                                    ? "icon icon-more-chevron is-open"
                                    : "icon icon-more-chevron"
                                }
                              >
                                <path
                                  d="M6.5 9.5 12 15l5.5-5.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {HEADER_CATEGORY_LABELS.map((label) => (
            <span key={label} className="category-link category-link-static">
              {label}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
