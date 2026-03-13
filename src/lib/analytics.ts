declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initializedMeasurementId = "";

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
