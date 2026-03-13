export const SEO_BRAND_NAME = "StilBags&Fashion";
export const SEO_DEFAULT_TITLE = "StilBags&Fashion | Kadın Çanta ve Aksesuar Modelleri";
export const SEO_DEFAULT_DESCRIPTION =
  "StilBags&Fashion kadın çanta ve aksesuar koleksiyonlarını keşfedin. Günlük, şık ve modern modeller tek adreste.";
export const SEO_DEFAULT_IMAGE = "/banner1.jpg";

export type JsonLd = Record<string, unknown>;

export interface SeoPayload {
  title: string;
  description: string;
  canonicalPath?: string;
  canonicalUrl?: string;
  image?: string;
  type?: "website" | "product" | "article";
  noindex?: boolean;
  schema?: JsonLd | JsonLd[];
}

function ensureMetaByName(name: string, content: string) {
  let node = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("name", name);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function ensureMetaByProperty(property: string, content: string) {
  let node = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("property", property);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function ensureCanonical(href: string) {
  let node = document.head.querySelector(`link[rel="canonical"]`) as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", "canonical");
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function toSingleLine(text: string, maxLength: number) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function getSiteOrigin() {
  const configured = String(import.meta.env.VITE_SITE_URL ?? "").trim();
  if (configured) {
    if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
    return `https://${configured.replace(/\/+$/, "")}`;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "https://stilbagsfashion.com";
}

export function toAbsoluteUrl(pathOrUrl?: string) {
  const value = String(pathOrUrl ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  const origin = getSiteOrigin();
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${origin}${normalizedPath}`;
}

function clearManagedSchemas() {
  const nodes = document.head.querySelectorAll('script[type="application/ld+json"][data-seo-managed="true"]');
  nodes.forEach((node) => node.remove());
}

function appendSchemas(schema: JsonLd | JsonLd[]) {
  const list = Array.isArray(schema) ? schema : [schema];
  list
    .filter(Boolean)
    .forEach((item) => {
      const node = document.createElement("script");
      node.setAttribute("type", "application/ld+json");
      node.setAttribute("data-seo-managed", "true");
      node.textContent = JSON.stringify(item);
      document.head.appendChild(node);
    });
}

export function applySeo(payload: SeoPayload) {
  const title = toSingleLine(payload.title || SEO_DEFAULT_TITLE, 65);
  const description = toSingleLine(payload.description || SEO_DEFAULT_DESCRIPTION, 170);
  const currentPath = payload.canonicalPath ?? window.location.pathname + window.location.search;
  const canonicalUrl = payload.canonicalUrl || toAbsoluteUrl(currentPath);
  const imageUrl = toAbsoluteUrl(payload.image || SEO_DEFAULT_IMAGE);
  const pageType = payload.type || "website";
  const robotsContent = payload.noindex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

  document.title = title;
  ensureCanonical(canonicalUrl);

  ensureMetaByName("description", description);
  ensureMetaByName("robots", robotsContent);

  ensureMetaByProperty("og:locale", "tr_TR");
  ensureMetaByProperty("og:site_name", SEO_BRAND_NAME);
  ensureMetaByProperty("og:type", pageType);
  ensureMetaByProperty("og:title", title);
  ensureMetaByProperty("og:description", description);
  ensureMetaByProperty("og:url", canonicalUrl);
  ensureMetaByProperty("og:image", imageUrl);

  ensureMetaByName("twitter:card", "summary_large_image");
  ensureMetaByName("twitter:title", title);
  ensureMetaByName("twitter:description", description);
  ensureMetaByName("twitter:image", imageUrl);

  clearManagedSchemas();
  if (payload.schema) {
    appendSchemas(payload.schema);
  }
}
