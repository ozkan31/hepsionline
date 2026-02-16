"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 20v-6h5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="20" r="1.8" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="20" r="1.8" stroke="currentColor" strokeWidth="2" />
      <path d="M4 4h2l2.2 10.5h10.3l2-7.5H7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c1.7-3.3 4.2-5 8-5s6.3 1.7 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Anasayfa",
    isActive: (pathname) => pathname === "/",
    icon: <HomeIcon />,
  },
  {
    href: "/favoriler",
    label: "Favoriler",
    isActive: (pathname) => pathname.startsWith("/favoriler"),
    icon: <HeartIcon />,
  },
  {
    href: "/sepet",
    label: "Sepet",
    isActive: (pathname) => pathname.startsWith("/sepet") || pathname.startsWith("/checkout") || pathname.startsWith("/odeme"),
    icon: <CartIcon />,
  },
  {
    href: "/hesabim",
    label: "Hesabım",
    isActive: (pathname) => pathname.startsWith("/hesabim"),
    icon: <UserIcon />,
  },
];

export function MobileBottomBar() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const hideOnPath =
    pathname.startsWith("/akalin1453") || pathname.startsWith("/api") || pathname.startsWith("/__status");

  const navItems = useMemo(
    () =>
      NAV_ITEMS.map((item) => {
        if (item.href !== "/sepet") return item;
        return {
          ...item,
          badgeCount: cartCount,
        };
      }),
    [cartCount],
  );

  useEffect(() => {
    let mounted = true;

    const loadCartCount = async () => {
      try {
        const response = await fetch("/api/cart/count", { method: "GET", cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { itemCount?: number };
        if (mounted) {
          setCartCount(typeof payload.itemCount === "number" ? payload.itemCount : 0);
        }
      } catch {
        if (mounted) setCartCount(0);
      }
    };

    void loadCartCount();
    const intervalId = window.setInterval(() => {
      void loadCartCount();
    }, 4000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [pathname]);

  if (hideOnPath) {
    return null;
  }

  return (
    <nav className="mobile-bottom-bar" aria-label="Mobil alt menü">
      {navItems.map((item) => {
        const active = item.isActive(pathname);
        const badgeCount = (item as NavItem & { badgeCount?: number }).badgeCount ?? 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "mobile-bottom-link is-active" : "mobile-bottom-link"}
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-bottom-icon">
              {item.icon}
              {badgeCount > 0 ? <span className="mobile-bottom-badge">{badgeCount}</span> : null}
            </span>
            <span className="mobile-bottom-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
