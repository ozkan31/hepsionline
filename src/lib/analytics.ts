declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initializedMeasurementId = "";

type AnalyticsProduct = {
  id: string;
  name: string;
  category?: string;
  price: number;
};

type AnalyticsCartLine = {
  product: AnalyticsProduct;
  quantity: number;
  color?: string;
};

type AnalyticsOrder = {
  id: string;
  total: number;
  items: AnalyticsCartLine[];
};

function getMeasurementId() {
  const env = import.meta.env as Record<string, string | undefined>;
  return String(env.VITE_GA_MEASUREMENT_ID ?? "").trim();
}

export function initGoogleAnalytics() {
  const measurementId = getMeasurementId();
  if (!measurementId) return;
  if (initializedMeasurementId === measurementId && window.gtag) return;

  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }

  const existingScript = document.getElementById("ga4-script");
  if (!existingScript) {
    const script = document.createElement("script");
    script.id = "ga4-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
  initializedMeasurementId = measurementId;
}

export function trackPageView(path: string) {
  const measurementId = getMeasurementId();
  if (!measurementId || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  });
}

export function hasAnalyticsEnabled() {
  return Boolean(getMeasurementId());
}

function mapCartLineToGtagItem(line: AnalyticsCartLine) {
  return {
    item_id: String(line.product.id ?? ""),
    item_name: String(line.product.name ?? ""),
    item_category: String(line.product.category ?? ""),
    item_variant: String(line.color ?? ""),
    price: Number(line.product.price ?? 0),
    quantity: Number(line.quantity ?? 1),
  };
}

export function trackAddToCart(input: { product: AnalyticsProduct; quantity?: number; color?: string }) {
  if (!window.gtag || !hasAnalyticsEnabled()) return;
  const quantity = Math.max(1, Number(input.quantity ?? 1));
  const item = mapCartLineToGtagItem({
    product: input.product,
    quantity,
    color: input.color,
  });
  window.gtag("event", "add_to_cart", {
    currency: "TRY",
    value: Number(input.product.price ?? 0) * quantity,
    items: [item],
  });
}

export function trackBeginCheckout(input: { items: AnalyticsCartLine[]; total: number }) {
  if (!window.gtag || !hasAnalyticsEnabled()) return;
  window.gtag("event", "begin_checkout", {
    currency: "TRY",
    value: Number(input.total ?? 0),
    items: (input.items ?? []).map(mapCartLineToGtagItem),
  });
}

export function trackPurchase(order: AnalyticsOrder) {
  if (!window.gtag || !hasAnalyticsEnabled()) return;
  window.gtag("event", "purchase", {
    transaction_id: String(order.id ?? ""),
    currency: "TRY",
    value: Number(order.total ?? 0),
    items: (order.items ?? []).map(mapCartLineToGtagItem),
  });
}
