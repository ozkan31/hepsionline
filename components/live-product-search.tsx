"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SearchProduct = {
  id: number;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  imageAlt: string;
  imageBroken: boolean;
};

type SearchResponse = {
  products?: SearchProduct[];
  correctedQuery?: string | null;
  suggestions?: string[];
  usedFuzzy?: boolean;
};

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

export function LiveProductSearch({ placeholder, buttonLabel }: { placeholder: string; buttonLabel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const hasProducts = products.length > 0;

  useEffect(() => {
    if (!hasQuery) {
      setProducts([]);
      setCorrectedQuery(null);
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(trimmedQuery)}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          setProducts([]);
          setOpen(true);
          return;
        }

        const data = (await response.json()) as SearchResponse;
        setProducts(Array.isArray(data.products) ? data.products : []);
        setCorrectedQuery(typeof data.correctedQuery === "string" && data.correctedQuery ? data.correctedQuery : null);
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 6) : []);
        setOpen(true);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setProducts([]);
        setCorrectedQuery(null);
        setSuggestions([]);
        setOpen(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hasQuery, trimmedQuery]);

  const firstResultHref = useMemo(() => {
    if (!hasProducts) {
      return null;
    }
    return `/urun/${products[0].slug}`;
  }, [hasProducts, products]);

  return (
    <div
      className="search-live"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <form
        className="search-shell"
        onSubmit={(event) => {
          event.preventDefault();
          if (!firstResultHref) {
            return;
          }
          setOpen(false);
          router.push(firstResultHref);
        }}
      >
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          className="search-input"
          onFocus={() => {
            if (hasQuery) {
              setOpen(true);
            }
          }}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <button type="submit" className="search-button" aria-label={buttonLabel}>
          <SearchIcon className="icon icon-search" />
        </button>
      </form>

      {open ? (
        <div className="search-dropdown" role="listbox" aria-label="Arama sonuçları">
          <div className="search-dropdown-head">
            {hasQuery ? (
              <Link
                href={{ pathname: "/arama", query: { q: trimmedQuery } }}
                className="search-show-all"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Tümünü gör
              </Link>
            ) : null}
          </div>

          {loading ? (
            <div className="search-status">Ürünler aranıyor...</div>
          ) : null}

          {!loading && hasProducts ? (
            <div className="search-results">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/urun/${product.slug}`}
                  className="search-result-item"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  <div className="search-result-thumb">
                    {product.imageBroken || !product.imageUrl ? (
                      <span className="search-result-placeholder">Görsel</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.imageAlt} loading="lazy" />
                    )}
                  </div>
                  <span className="search-result-name">{product.name}</span>
                  <span className="search-result-price">{formatPrice(product.price)}</span>
                </Link>
              ))}
            </div>
          ) : null}

          {!loading && !hasProducts && hasQuery ? <div className="search-status">Ürün bulunamadı.</div> : null}

          {!loading && correctedQuery ? (
            <Link
              href={{ pathname: "/arama", query: { q: correctedQuery } }}
              className="search-status"
              onClick={() => {
                setOpen(false);
              }}
            >
              Bunu mu demek istediniz: <strong>{correctedQuery}</strong>
            </Link>
          ) : null}

          {!loading && suggestions.length > 0 ? (
            <div className="search-status">
              Öneriler:{" "}
              {suggestions.map((item, idx) => (
                <Link
                  key={`${item}-${idx}`}
                  href={{ pathname: "/arama", query: { q: item } }}
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="underline underline-offset-2"
                >
                  {idx > 0 ? `, ${item}` : item}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

