async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  return parseResponse<T>(res);
}

async function postJson<T>(url: string, body?: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export type RevenuePoint = {
  date: string;
  totalTRY: number;
};

export type RevenueReport = {
  totalTRY: number;
  series: RevenuePoint[];
};

export type TopProduct = {
  productId: string;
  title: string;
  qty: number;
};

export type NotificationRow = {
  id: string;
  message?: string;
  action?: string;
  createdAt?: string;
};

export type AuditRow = {
  id: string;
  action: string;
  actorId?: string;
  entity?: string;
  entityId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string;
  createdAt?: string;
};

type ProductRef = {
  title?: string;
  slug?: string;
};

type UserRef = {
  email?: string;
};

export type QuestionAnswer = {
  id?: string;
  answer: string;
};

export type QuestionItem = {
  id: string;
  question: string;
  isApproved: boolean;
  createdAt?: string;
  product?: ProductRef;
  user?: UserRef;
  answers?: QuestionAnswer[];
};

export type ReviewItem = {
  id: string;
  title?: string;
  rating?: number;
  isApproved: boolean;
  createdAt?: string;
  product?: ProductRef;
  user?: UserRef;
};

export type CartTopVariant = {
  variantId: string;
  title: string;
  qty: number;
};

export type CartsReport = {
  totalActiveCarts: number;
  totalItemsInCarts: number;
  topVariants: CartTopVariant[];
};

export type ProductPerformanceRow = {
  productId: string;
  image?: string;
  title: string;
  views: number;
  addToCart: number;
  addRate: number;
  salesQty: number;
  revenueTRY: number;
  conversion: number;
};

export type ProductPerformanceReport = {
  rows: ProductPerformanceRow[];
};

export type FunnelReport = {
  views: number;
  addToCart: number;
  addToCartRate: number;
  checkoutStart: number;
  checkoutRate: number;
  purchases: number;
  conversionRate: number;
};

export type StorefrontVisitorsPoint = {
  date: string;
  visitors: number;
};

export type StorefrontVisitorsReport = {
  activeWindowMin: number;
  totalVisitors: number;
  currentVisitors: number;
  todayVisitors: number;
  series: StorefrontVisitorsPoint[];
};

export type AbTestRow = {
  variant: string;
  views: number;
  addToCart: number;
  checkoutStart: number;
  purchases: number;
  addRate: number;
  purchaseRate: number;
  checkoutToPurchaseRate: number;
};

export type AbTestReport = {
  rows: AbTestRow[];
};

export type SmartBundleSourceRow = {
  source: string;
  count: number;
};

export type SmartBundlePlacementRow = {
  placement: string;
  count: number;
};

export type SmartBundleSeriesPoint = {
  date: string;
  impressions: number;
  clicks: number;
  adds: number;
};

export type SmartBundleReport = {
  days: number;
  impressions: number;
  clicks: number;
  ctr: number;
  addToCart: number;
  addRateFromClicks: number;
  assistedPurchases: number;
  purchaseRateFromAdds: number;
  placements: SmartBundlePlacementRow[];
  sources: SmartBundleSourceRow[];
  series: SmartBundleSeriesPoint[];
};

export type CouponRecoTopCouponRow = {
  couponCode: string;
  impressions: number;
  applies: number;
  applyRate: number;
};

export type CouponRecoReport = {
  days: number;
  impressions: number;
  applies: number;
  applyRate: number;
  estimatedDiscountTotalTRY: number;
  topCoupons: CouponRecoTopCouponRow[];
};

export type AbandonedCartRow = {
  cartToken: string;
  userEmail: string | null;
  lastActivityAt: string;
  reminderSentAt: string | null;
  recoveredAt: string | null;
  couponCode: string | null;
  updatedAt: string;
};

export type AbandonedCartSummary = {
  thresholdMinutes: number;
  tracked: number;
  actionable: number;
  sent: number;
  recovered: number;
  waiting: number;
  recoveryRate: number;
  rows: AbandonedCartRow[];
};

export type AbandonedCartScanResult = {
  thresholdMinutes: number;
  scanned: number;
  sent: number;
  skippedNoEmail: number;
  skippedAlreadySent: number;
  skippedRecovered: number;
  sentCartTokens: string[];
};

export type StockAlertSummary = {
  total: number;
  pending: number;
  notified: number;
};

export type StockAlertDispatchResult = {
  scanned: number;
  notified: number;
  skippedOutOfStock: number;
  skippedInvalidEmail: number;
  notifiedIds: number[];
};

export type SearchAnalyticsQueryRow = {
  query: string;
  count: number;
};

export type SearchAnalyticsReport = {
  days: number;
  totalSearches: number;
  topQueries: SearchAnalyticsQueryRow[];
  noResultQueries: SearchAnalyticsQueryRow[];
};

export type AdminProductMini = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  section?: { title?: string };
};

export type BundleOfferItemAdmin = {
  id: number;
  productId: number;
  quantity: number;
  sortOrder: number;
  product: {
    id: number;
    name: string;
    price: number;
    imageUrl?: string | null;
  };
};

export type BundleOfferAdmin = {
  id: number;
  primaryProductId: number;
  title?: string | null;
  discountPercent: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  primaryProduct: {
    id: number;
    name: string;
    price: number;
    imageUrl?: string | null;
  };
  items: BundleOfferItemAdmin[];
};

export type AdminCoupon = {
  id: number;
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  description?: string | null;
  isActive: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  createdAt?: string;
  _count?: {
    usages: number;
  };
};

export type CouponPerformanceSummary = {
  couponCount: number;
  activeCouponCount: number;
  applies: number;
  paidOrders: number;
  conversionRate: number;
  recommendationImpressions: number;
  recommendationApplies: number;
  recommendationApplyRate: number;
  totalDiscountTRY: number;
  totalRevenueTRY: number;
  netRevenueTRY: number;
  avgOrderValueTRY: number;
};

export type CouponPerformanceSegmentRow = {
  label: string;
  value: number;
};

export type CouponPerformanceTrendRow = {
  day: string;
  impressions: number;
  applies: number;
  discountTRY: number;
  revenueTRY: number;
};

export type CouponPerformanceByCouponRow = {
  couponId: number;
  code: string;
  type: "FIXED" | "PERCENT";
  value: number;
  uses: number;
  paidOrders: number;
  conversionRate: number;
  uniqueUsers: number;
  discountTotalTRY: number;
  grossRevenueTRY: number;
  netRevenueTRY: number;
};

export type CouponPerformanceRecommendation = {
  code: string;
  suggestion: string;
};

export type CouponPerformanceReport = {
  days: number;
  summary: CouponPerformanceSummary;
  segments: {
    customerType: CouponPerformanceSegmentRow[];
    channel: CouponPerformanceSegmentRow[];
  };
  trend: CouponPerformanceTrendRow[];
  byCoupon: CouponPerformanceByCouponRow[];
  recommendations: CouponPerformanceRecommendation[];
};

export type CouponAbVariantStats = {
  variant: "A" | "B";
  couponCode: string;
  impressions: number;
  applies: number;
  paidOrders: number;
  discountTRY: number;
  revenueTRY: number;
  netTRY: number;
  applyRate: number;
  purchaseRate: number;
};

export type CouponAbExperiment = {
  enabled: boolean;
  traffic: number;
  splitA: number;
  forceVariant: "A" | "B" | null;
  variants: {
    A: { couponCode: string };
    B: { couponCode: string };
  };
};

export type CouponAbReport = {
  globalEnabled: boolean;
  experiment: CouponAbExperiment;
  stats: {
    days: number;
    variants: CouponAbVariantStats[];
    suggestedWinner: "A" | "B" | null;
  };
};

export type SeoHealthCheck = {
  key: string;
  label: string;
  pass: boolean;
};

export type SeoHealthTopProduct = {
  id: number;
  name: string;
  price: number;
  suggestedTitle: string;
  suggestedDescription: string;
};

export type SeoHealthReport = {
  score: number;
  checks: SeoHealthCheck[];
  summary: {
    totalProducts: number;
    missingImageCount: number;
    missingImageAltCount: number;
    brokenImageCount: number;
    viewedProducts30d: number;
    staleProducts30d: number;
  };
  links: {
    sitemap: string;
    robots: string;
  };
  topProducts: SeoHealthTopProduct[];
  suggestions: string[];
};

export type ReturnRequestStatus = "REQUESTED" | "REVIEWING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type ReturnRequestType = "RETURN" | "EXCHANGE";

export type ReturnRequest = {
  id: string;
  type: ReturnRequestType;
  status: ReturnRequestStatus;
  reason?: string;
  note?: string;
  adminNote?: string;
  createdAt?: string;
  user?: UserRef;
  order?: {
    orderNo?: string | number;
    customerEmail?: string;
  };
  orderItem?: {
    title?: string;
  };
};

export type AdminOrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "SHIPPED" | "ON_THE_WAY" | "DELIVERED" | "CANCELLED";
export type AdminPaymentStatus = "PENDING" | "PAID" | "FAILED";
export type ShippingCarrierCode = "ARAS" | "YURTICI" | "MNG" | "SURAT" | "PTT" | "UPS";

export type AdminOrderItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: {
    imageUrl?: string;
    imageAlt?: string;
  };
};

export type AdminOrderCouponUsage = {
  discountAmount: number;
  userEmail?: string;
  usedAt?: string;
  coupon?: {
    code: string;
    type: "FIXED" | "PERCENT";
    value: number;
  };
};

export type AdminOrder = {
  id: number;
  orderNo?: string | null;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  customerNote?: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  shippingCarrier?: ShippingCarrierCode | null;
  shippingTrackingNo?: string | null;
  shippingLabelNo?: string | null;
  shippedAt?: string | null;
  shippingSyncedAt?: string | null;
  totalAmount: number;
  currency: string;
  createdAt?: string;
  items: AdminOrderItem[];
  couponUsages: AdminOrderCouponUsage[];
};

export type AdminOrdersResponse = {
  total: number;
  orders: AdminOrder[];
};

export type AdminOrderShippingUpdateResponse = {
  order: AdminOrder;
  carrierSync: {
    ok: boolean;
    message?: string;
    providerRef?: string;
    mock?: boolean;
  };
};

export type SitePalette = {
  primary: string;
  accent: string;
  background: string;
};

export type PagePalette = {
  text: string;
  accent: string;
  background: string;
};

export type PagePaletteKey = "home" | "cart" | "payment" | "product";
export type PagePalettes = Record<PagePaletteKey, PagePalette>;

export type AbVariantCopy = {
  title: string;
  subtitle: string;
  cta: string;
};

export type AbTestsSettings = {
  enabled: boolean;
  experiments: {
    home_hero_copy: {
      enabled: boolean;
      traffic: number;
      variants: {
        A: AbVariantCopy;
        B: AbVariantCopy;
      };
    };
  };
};

export type MaintenanceSettings = {
  enabled: boolean;
  title: string;
  message: string;
  eta: string;
};

export type SettingsData = {
  site_name?: string;
  palette?: Partial<SitePalette>;
  page_palettes?: Partial<Record<PagePaletteKey, Partial<PagePalette>>>;
  ab_tests?: AbTestsSettings;
  maintenance?: Partial<MaintenanceSettings>;
  feature_toggles?: Record<string, boolean>;
};

export type ReconciliationData = {
  rangeDays: number;
  paidOrders: number;
  failedOrders: number;
  pendingOrders: number;
  stalePendingOrders: number;
  paidRevenueTRY: number;
  failedReasons: Array<{
    code: string;
    count: number;
  }>;
};

export type ReleaseResult = {
  thresholdMinutes: number;
  scanned: number;
  released: number;
  releasedOrderIds: number[];
};

export type ResetSmartUpsellCapResult = {
  ok: boolean;
  message: string;
};

export const adminApi = {
  reportsRevenue(days: number) {
    return getJson<RevenueReport>(`/api/admin/reports-revenue?days=${days}`);
  },
  topProducts(limit: number) {
    return getJson<TopProduct[]>(`/api/admin/top-products?limit=${limit}`);
  },
  notifications() {
    return getJson<NotificationRow[]>("/api/admin/notifications");
  },

  audit() {
    return getJson<AuditRow[]>("/api/admin/audit");
  },

  questions() {
    return getJson<QuestionItem[]>("/api/admin/questions");
  },
  questionApprove(id: string, approved: boolean) {
    return postJson<QuestionItem>(`/api/admin/questions/${id}/approve`, { approved });
  },
  questionAnswer(id: string, answer: string) {
    return postJson<QuestionItem>(`/api/admin/questions/${id}/answer`, { answer });
  },

  reviews() {
    return getJson<ReviewItem[]>("/api/admin/reviews");
  },
  reviewApprove(id: string, approved: boolean) {
    return postJson<ReviewItem>(`/api/admin/reviews/${id}/approve`, { approved });
  },

  carts() {
    return getJson<CartsReport>("/api/admin/carts");
  },
  productPerformance(days: number) {
    return getJson<ProductPerformanceReport>(`/api/admin/product-performance?days=${days}`);
  },
  reportsFunnel(days: number) {
    return getJson<FunnelReport>(`/api/admin/reports-funnel?days=${days}`);
  },
  reportsStorefrontVisitors(days: number, activeWindowMin: number) {
    return getJson<StorefrontVisitorsReport>(`/api/admin/reports-storefront-visitors?days=${days}&activeWindowMin=${activeWindowMin}`);
  },
  reportsAbTest(testKey: string, days: number) {
    return getJson<AbTestReport>(`/api/admin/reports-ab-test?testKey=${encodeURIComponent(testKey)}&days=${days}`);
  },
  reportsSmartBundle(days: number) {
    return getJson<SmartBundleReport>(`/api/admin/reports-smart-bundle?days=${days}`);
  },
  reportsCouponReco(days: number) {
    return getJson<CouponRecoReport>(`/api/admin/reports-coupon-reco?days=${days}`);
  },
  abandonedCarts(minutes = 30, take = 30) {
    return getJson<AbandonedCartSummary>(`/api/admin/abandoned-carts?minutes=${minutes}&take=${take}`);
  },
  scanAbandonedCarts(minutes = 30, limit = 100) {
    return postJson<AbandonedCartScanResult>(`/api/marketing/abandoned-cart/scan-send?minutes=${minutes}&limit=${limit}`);
  },
  stockAlertsSummary() {
    return getJson<StockAlertSummary>("/api/admin/stock-alerts");
  },
  stockAlertsDispatch(limit = 200) {
    return postJson<StockAlertDispatchResult>(`/api/stock-alerts/dispatch?limit=${limit}`);
  },
  searchAnalytics(days = 30) {
    return getJson<SearchAnalyticsReport>(`/api/admin/search-analytics?days=${days}`);
  },
  productsMini(limit = 300, query = "") {
    const q = query.trim();
    return getJson<{ products: AdminProductMini[] }>(`/api/admin/products-mini?limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  },
  bundles() {
    return getJson<{ bundles: BundleOfferAdmin[] }>("/api/admin/bundles");
  },
  coupons() {
    return getJson<{ coupons: AdminCoupon[] }>("/api/admin/kuponlar");
  },
  couponPerformance(days = 30) {
    return getJson<CouponPerformanceReport>(`/api/admin/kuponlar/performance?days=${days}`);
  },
  couponAbTest(days = 30) {
    return getJson<CouponAbReport>(`/api/admin/kuponlar/ab-test?days=${days}`);
  },
  seoHealth() {
    return getJson<SeoHealthReport>("/api/admin/seo-health");
  },
  updateCouponAbTest(payload: {
    enabled?: boolean;
    traffic?: number;
    splitA?: number;
    forceVariant?: "A" | "B" | "NONE" | null;
    couponCodeA?: string;
    couponCodeB?: string;
  }) {
    return postJson<{ globalEnabled: boolean; experiment: CouponAbExperiment }>(
      "/api/admin/kuponlar/ab-test",
      payload,
      "PATCH",
    );
  },
  activateCouponAbWinner(days = 30) {
    return postJson<{
      ok: boolean;
      winner: "A" | "B";
      winnerCode: string;
      loserCode: string;
      days: number;
      stats: CouponAbReport["stats"];
    }>("/api/admin/kuponlar/ab-test", { action: "activate_winner", days });
  },
  createCoupon(payload: {
    code: string;
    type: "FIXED" | "PERCENT";
    value: number;
    minOrderAmount?: number | null;
    maxDiscountAmount?: number | null;
    description?: string | null;
    isActive: boolean;
    startsAt?: string | null;
    expiresAt?: string | null;
    usageLimit?: number | null;
    perUserLimit?: number | null;
  }) {
    return postJson<AdminCoupon>("/api/admin/kuponlar", payload);
  },
  updateCoupon(
    id: number,
    payload: Partial<{
      code: string;
      type: "FIXED" | "PERCENT";
      value: number;
      minOrderAmount: number | null;
      maxDiscountAmount: number | null;
      description: string | null;
      isActive: boolean;
      startsAt: string | null;
      expiresAt: string | null;
      usageLimit: number | null;
      perUserLimit: number | null;
    }>,
  ) {
    return postJson<AdminCoupon>(`/api/admin/kuponlar/${id}`, payload, "PATCH");
  },
  deleteCoupon(id: number) {
    return postJson<{ ok: boolean }>(`/api/admin/kuponlar/${id}`, undefined, "DELETE");
  },
  createBundle(payload: { primaryProductId: number; title?: string; discountPercent: number; isActive: boolean; itemProductIds: number[] }) {
    return postJson<BundleOfferAdmin>("/api/admin/bundles", payload);
  },
  updateBundle(
    id: number,
    payload: Partial<{ title: string | null; discountPercent: number; isActive: boolean; itemProductIds: number[] }>,
  ) {
    return postJson<BundleOfferAdmin>(`/api/admin/bundles/${id}`, payload, "PATCH");
  },
  deleteBundle(id: number) {
    return postJson<{ ok: boolean }>(`/api/admin/bundles/${id}`, undefined, "DELETE");
  },

  returnRequests() {
    return getJson<ReturnRequest[]>("/api/admin/returns");
  },
  updateReturnRequest(id: string, payload: { status?: ReturnRequestStatus; adminNote?: string }) {
    return postJson<ReturnRequest>(`/api/admin/returns/${id}`, payload, "PATCH");
  },
  orders() {
    return getJson<AdminOrdersResponse>("/api/admin/siparisler");
  },
  updateOrder(id: number, payload: { status?: AdminOrderStatus; paymentStatus?: AdminPaymentStatus }) {
    return postJson<AdminOrder>(`/api/admin/siparisler/${id}`, payload, "PATCH");
  },
  updateOrderShipping(id: number, payload: { carrier: ShippingCarrierCode; trackingNo: string; notifyCarrier?: boolean }) {
    return postJson<AdminOrderShippingUpdateResponse>(`/api/admin/siparisler/${id}/kargo`, payload, "PATCH");
  },

  settingsGet() {
    return getJson<SettingsData>("/api/admin/settings");
  },
  settingsPatch(payload: Record<string, unknown>) {
    return postJson<SettingsData>("/api/admin/settings", payload, "PATCH");
  },
  reconciliation(days: number) {
    return getJson<ReconciliationData>(`/api/admin/reconciliation?days=${days}`);
  },
  releaseStaleOrders(minutes: number) {
    return postJson<ReleaseResult>(`/api/admin/operations/release-stale-orders?minutes=${minutes}`);
  },
  resetSmartUpsellCap() {
    return postJson<ResetSmartUpsellCapResult>("/api/admin/operations/reset-smart-upsell-cap");
  },
};
