declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: Window["fbq"];
  }
}

let initializedMeasurementId = "";
let initializedMetaPixelId = "";

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

function getMetaPixelId() {
  const env = import.meta.env as Record<string, string | undefined>;
  const configuredId = String(env.VITE_META_PIXEL_ID ?? "").trim();
  if (/^\d+$/.test(configuredId)) {
    return configuredId;
  }
  return "920348000612912";
}

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
    script.onerror = () => {
      console.warn(
        `[analytics] Google tag script yüklenemedi. Ölçüm kimliğini kontrol et: ${measurementId}`
      );
    };
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });
  initializedMeasurementId = measurementId;
}

export function initMetaPixel() {
  const pixelId = getMetaPixelId();
  if (!pixelId) return;
  if (initializedMetaPixelId === pixelId && window.fbq) return;

  if (!window.fbq) {
    const fbqStub = ((...args: unknown[]) => {
      if (typeof fbqStub.callMethod === "function") {
        fbqStub.callMethod(...args);
      } else {
        fbqStub.queue?.push(args);
      }
    }) as NonNullable<Window["fbq"]>;
    fbqStub.queue = [];
    fbqStub.loaded = true;
    fbqStub.version = "2.0";
    fbqStub.push = (...args: unknown[]) => {
      fbqStub(...args);
    };
    window.fbq = fbqStub;
    window._fbq = fbqStub;
  }

  const existingScript = document.getElementById("meta-pixel-script");
  if (!existingScript) {
    const script = document.createElement("script");
    script.id = "meta-pixel-script";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  window.fbq("init", pixelId);
  initializedMetaPixelId = pixelId;
}

export function trackPageView(path: string) {
  const measurementId = getMeasurementId();
  const pageLocation = `${window.location.origin}${path}`;

  if (measurementId && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: pageLocation,
      page_title: document.title,
    });
  }

  if (window.fbq) {
    window.fbq("track", "PageView");
  }
}

export function hasAnalyticsEnabled() {
  return Boolean(getMeasurementId() || getMetaPixelId());
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

function mapCartLineToMetaContent(line: AnalyticsCartLine) {
  return {
    id: String(line.product.id ?? ""),
    quantity: Number(line.quantity ?? 1),
    item_price: Number(line.product.price ?? 0),
  };
}

export function trackAddToCart(input: { product: AnalyticsProduct; quantity?: number; color?: string }) {
  const quantity = Math.max(1, Number(input.quantity ?? 1));
  const item = mapCartLineToGtagItem({
    product: input.product,
    quantity,
    color: input.color,
  });
  const value = Number(input.product.price ?? 0) * quantity;

  if (window.gtag && getMeasurementId()) {
    window.gtag("event", "add_to_cart", {
      currency: "TRY",
      value,
      items: [item],
    });
  }

  if (window.fbq) {
    window.fbq("track", "AddToCart", {
      content_ids: [String(input.product.id ?? "")],
      content_name: String(input.product.name ?? ""),
      content_category: String(input.product.category ?? ""),
      content_type: "product",
      contents: [{ id: String(input.product.id ?? ""), quantity, item_price: Number(input.product.price ?? 0) }],
      currency: "TRY",
      value,
    });
  }
}

export function trackBeginCheckout(input: { items: AnalyticsCartLine[]; total: number }) {
  const total = Number(input.total ?? 0);
  const items = (input.items ?? []).map(mapCartLineToGtagItem);

  if (window.gtag && getMeasurementId()) {
    window.gtag("event", "begin_checkout", {
      currency: "TRY",
      value: total,
      items,
    });
  }

  if (window.fbq) {
    window.fbq("track", "InitiateCheckout", {
      currency: "TRY",
      value: total,
      num_items: (input.items ?? []).reduce((sum, line) => sum + Number(line.quantity ?? 1), 0),
      content_ids: (input.items ?? []).map((line) => String(line.product.id ?? "")),
      contents: (input.items ?? []).map(mapCartLineToMetaContent),
    });
  }
}

export function trackPurchase(order: AnalyticsOrder) {
  const total = Number(order.total ?? 0);
  const items = (order.items ?? []).map(mapCartLineToGtagItem);

  if (window.gtag && getMeasurementId()) {
    window.gtag("event", "purchase", {
      transaction_id: String(order.id ?? ""),
      currency: "TRY",
      value: total,
      items,
    });
  }

  if (window.fbq) {
    window.fbq("track", "Purchase", {
      currency: "TRY",
      value: total,
      content_ids: (order.items ?? []).map((line) => String(line.product.id ?? "")),
      contents: (order.items ?? []).map(mapCartLineToMetaContent),
      num_items: (order.items ?? []).reduce((sum, line) => sum + Number(line.quantity ?? 1), 0),
    });
  }
}

export function trackViewContent(product: AnalyticsProduct) {
  const value = Number(product.price ?? 0);

  if (window.fbq) {
    window.fbq("track", "ViewContent", {
      content_ids: [String(product.id ?? "")],
      content_name: String(product.name ?? ""),
      content_category: String(product.category ?? ""),
      content_type: "product",
      contents: [{ id: String(product.id ?? ""), quantity: 1, item_price: value }],
      currency: "TRY",
      value,
    });
  }
}
