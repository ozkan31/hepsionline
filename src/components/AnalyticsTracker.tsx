import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { hasAnalyticsEnabled, initGoogleAnalytics, initMetaPixel, trackPageView } from "@/lib/analytics";

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!hasAnalyticsEnabled()) return;
    initGoogleAnalytics();
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (!hasAnalyticsEnabled()) return;
    const path = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(path || "/");
  }, [location.pathname, location.search, location.hash]);

  return null;
}
