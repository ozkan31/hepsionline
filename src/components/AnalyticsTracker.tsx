import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { hasAnalyticsEnabled, initGoogleAnalytics, initMetaPixel, trackPageView } from "@/lib/analytics";

export function AnalyticsTracker() {
  const location = useLocation();
  const hasTrackedInitialRoute = useRef(false);

  useEffect(() => {
    if (!hasAnalyticsEnabled()) return;
    initGoogleAnalytics();
    initMetaPixel();
  }, []);

  useEffect(() => {
    if (!hasAnalyticsEnabled()) return;
    const path = `${location.pathname}${location.search}${location.hash}`;
    if (!hasTrackedInitialRoute.current) {
      hasTrackedInitialRoute.current = true;
      return;
    }
    trackPageView(path || "/");
  }, [location.pathname, location.search, location.hash]);

  return null;
}
