import type {
  Address,
  AppliedAbandonedCartCoupon,
  AdminAbandonedCartCampaignResponse,
  AdminAbandonedCartRunSummary,
  AdminAbandonedCartSettings,
  AdminContactRequest,
  AdminCustomerCouponSettings,
  AdminOrder,
  AdminUserSummary,
  CartItem,
  Category,
  Order,
  Product,
  User,
} from "@/types";

const AUTH_TOKEN_KEY = "parisMoveAuthToken";
const AUTH_REMEMBER_KEY = "parisMoveAuthRemember";

function normalizeMojibake(value: string): string {
  return String(value ?? "")
    .replaceAll("Ã¼", "ü")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã‡", "Ç")
    .replaceAll("ÄŸ", "ğ")
    .replaceAll("Äž", "Ğ")
    .replaceAll("ÅŸ", "ş")
    .replaceAll("Å", "Ş")
    .replaceAll("Ä±", "ı")
    .replaceAll("Ä°", "İ")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .replaceAll("â€“", "-")
    .replaceAll("Â", "");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? normalizeMojibake(data.message)
        : `İstek başarısız: ${response.status}`;
    throw new Error(normalizeMojibake(message));
  }
  return data as T;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthRememberPreference(): boolean {
  const stored = localStorage.getItem(AUTH_REMEMBER_KEY);
  return stored === null ? true : stored === "1";
}

export function setAuthToken(token: string, rememberMe = true) {
  localStorage.setItem(AUTH_REMEMBER_KEY, rememberMe ? "1" : "0");
  if (rememberMe) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }

  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

async function authFetch(path: string, init?: RequestInit) {
  const token = getAuthToken();
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(path, { ...init, headers });
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch("/api/categories");
  return parseResponse<Category[]>(response);
}

export async function fetchProducts(params?: {
  search?: string;
  category?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.sort) query.set("sort", params.sort);
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(Math.max(1, Math.trunc(params.limit))));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset) && params.offset >= 0) {
    query.set("offset", String(Math.max(0, Math.trunc(params.offset))));
  }

  const response = await fetch(`/api/products${query.toString() ? `?${query}` : ""}`);
  return parseResponse<Product[]>(response);
}

export async function fetchProductPage(params?: {
  search?: string;
  category?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  products: Product[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
}> {
  const query = new URLSearchParams();
  query.set("includeMeta", "1");
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.sort) query.set("sort", params.sort);
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(Math.max(1, Math.trunc(params.limit))));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset) && params.offset >= 0) {
    query.set("offset", String(Math.max(0, Math.trunc(params.offset))));
  }

  const response = await fetch(`/api/products?${query.toString()}`);
  return parseResponse<{
    products: Product[];
    total: number;
    hasMore: boolean;
    nextOffset: number;
  }>(response);
}

export async function fetchProductDetail(id: string): Promise<{
  product: Product;
  relatedProducts: Product[];
}> {
  const response = await fetch(`/api/products/${id}`);
  return parseResponse<{ product: Product; relatedProducts: Product[] }>(response);
}

export async function fetchProductMedia(id: string): Promise<{ images: string[] }> {
  const response = await fetch(`/api/products/${id}/media`);
  return parseResponse<{ images: string[] }>(response);
}

export async function fetchPublicSettings(): Promise<{ siteName: string }> {
  const response = await fetch("/api/settings");
  return parseResponse<{ siteName: string }>(response);
}

export async function submitContactRequest(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ ok: boolean; message: string }>(response);
}

export async function registerUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe?: boolean;
}): Promise<User> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token, input.rememberMe !== false);
  return data.user;
}

export async function loginUser(input: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token, input.rememberMe !== false);
  return data.user;
}

export async function loginWithGoogle(
  credential: string,
  options?: { rememberMe?: boolean }
): Promise<User> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      rememberMe: options?.rememberMe !== false,
    }),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token, options?.rememberMe !== false);
  return data.user;
}

export async function checkAuthEmailStatus(email: string): Promise<{ exists: boolean }> {
  const response = await fetch("/api/auth/email/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseResponse<{ exists: boolean }>(response);
}

export async function startAuthFlow(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  gender?: "kadin" | "erkek";
  phone?: string;
  termsAccepted?: boolean;
  rememberMe?: boolean;
}): Promise<{
  mode: "login" | "register";
  token?: string;
  user?: User;
  requiresVerification?: boolean;
  message?: string;
}> {
  const response = await fetch("/api/auth/flow/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{
    mode: "login" | "register";
    token?: string;
    user?: User;
    requiresVerification?: boolean;
    message?: string;
  }>(response);
  if (data.token) {
    setAuthToken(data.token, input.rememberMe !== false);
  }
  return data;
}

export async function verifyAuthFlowCode(input: {
  email: string;
  code: string;
  rememberMe?: boolean;
}): Promise<User> {
  const response = await fetch("/api/auth/flow/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token, input.rememberMe !== false);
  return data.user;
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/auth/password/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseResponse<{ ok: boolean; message: string }>(response);
}

export async function resetPassword(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/auth/password/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ ok: boolean; message: string }>(response);
}

export async function validateResetToken(token: string): Promise<{ valid: boolean; message?: string }> {
  const query = new URLSearchParams({ token });
  const response = await fetch(`/api/auth/password/reset/validate?${query.toString()}`);
  return parseResponse<{ valid: boolean; message?: string }>(response);
}

export async function logoutUser(): Promise<void> {
  try {
    await authFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Token can already be invalid; local cleanup still required.
  } finally {
    clearAuthToken();
  }
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await authFetch("/api/auth/me");
  const data = await parseResponse<{ user: User }>(response);
  return data.user;
}

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): Promise<User> {
  const response = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ user: User }>(response);
  return data.user;
}

export async function saveAddress(input: Omit<Address, "id">): Promise<User> {
  const response = await authFetch("/api/auth/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ user: User }>(response);
  return data.user;
}

export async function deleteAddress(addressId: string): Promise<User> {
  const response = await authFetch(`/api/auth/addresses/${addressId}`, {
    method: "DELETE",
  });
  const data = await parseResponse<{ user: User }>(response);
  return data.user;
}

export async function updateAddress(addressId: string, input: Omit<Address, "id">): Promise<User> {
  const response = await authFetch(`/api/auth/addresses/${addressId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ user: User }>(response);
  return data.user;
}

export async function fetchCart(): Promise<CartItem[]> {
  const response = await authFetch("/api/cart");
  const data = await parseResponse<{ items: CartItem[] }>(response);
  return data.items;
}

export async function saveCart(items: CartItem[]): Promise<CartItem[]> {
  const payload = items.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
    color: item.color ?? null,
  }));

  const response = await authFetch("/api/cart", {
    method: "PUT",
    body: JSON.stringify({ items: payload }),
  });
  const data = await parseResponse<{ items: CartItem[] }>(response);
  return data.items;
}

export async function fetchWishlist(): Promise<Product[]> {
  const response = await authFetch("/api/wishlist");
  const data = await parseResponse<{ items: Product[] }>(response);
  return data.items;
}

export async function saveWishlist(items: Product[]): Promise<Product[]> {
  const payload = items.map((item) => ({ productId: item.id }));

  const response = await authFetch("/api/wishlist", {
    method: "PUT",
    body: JSON.stringify({ items: payload }),
  });
  const data = await parseResponse<{ items: Product[] }>(response);
  return data.items;
}

export async function createPaytrIframe(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  province: string;
  district: string;
  total: number;
  items: Array<{ name: string; unitPrice: number; quantity: number }>;
  couponCode?: string | null;
}): Promise<{ iframeUrl: string; token: string; merchantOid: string }> {
  const response = await authFetch("/api/paytr/token", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseResponse<{ iframeUrl: string; token: string; merchantOid: string }>(response);
}

export async function applyAbandonedCartCoupon(code: string): Promise<AppliedAbandonedCartCoupon> {
  const response = await authFetch("/api/marketing/abandoned-cart/coupon/apply", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const data = await parseResponse<{ coupon: AppliedAbandonedCartCoupon }>(response);
  return data.coupon;
}

export async function applyCustomerCoupon(
  code: string,
  items: CartItem[]
): Promise<AppliedAbandonedCartCoupon> {
  const response = await fetch("/api/coupons/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      items: Array.isArray(items)
        ? items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            color: item.color ?? "",
          }))
        : [],
    }),
  });
  const data = await parseResponse<{ coupon: AppliedAbandonedCartCoupon }>(response);
  return data.coupon;
}

export async function fetchOrders(): Promise<Order[]> {
  const response = await authFetch("/api/orders");
  const data = await parseResponse<{ orders: Order[] }>(response);
  return data.orders;
}

export async function createOrder(input: Order): Promise<Order> {
  const response = await authFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ order: Order | null }>(response);
  if (!data.order) {
    throw new Error("Order create response is empty.");
  }
  return data.order;
}

export async function adminLogin(input: {
  email: string;
  password: string;
  rememberMe: boolean;
}): Promise<string> {
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string }>(response);
  return data.token;
}

export async function adminValidate(token: string): Promise<boolean> {
  const response = await fetch("/api/admin/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseResponse<{ ok: boolean }>(response);
  return true;
}

export async function adminLogout(token: string): Promise<void> {
  const response = await fetch("/api/admin/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function fetchAdminSettings(token: string): Promise<{ siteName: string }> {
  const response = await fetch("/api/admin/settings", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<{ siteName: string }>(response);
}

export async function updateAdminSettings(
  token: string,
  input: { siteName: string }
): Promise<{ siteName: string }> {
  const response = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return parseResponse<{ siteName: string }>(response);
}

export async function fetchAdminAbandonedCartCampaign(
  token: string
): Promise<AdminAbandonedCartCampaignResponse> {
  const response = await fetch("/api/admin/marketing/abandoned-cart", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<AdminAbandonedCartCampaignResponse>(response);
}

export async function fetchAdminCustomerCouponSettings(
  token: string
): Promise<AdminCustomerCouponSettings> {
  const response = await fetch("/api/admin/marketing/customer-coupon", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ settings: AdminCustomerCouponSettings }>(response);
  return data.settings;
}

export async function fetchAdminCoupons(
  token: string
): Promise<AdminCustomerCouponSettings[]> {
  const response = await fetch("/api/admin/coupons", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ coupons: AdminCustomerCouponSettings[] }>(response);
  return Array.isArray(data.coupons) ? data.coupons : [];
}

export async function updateAdminCustomerCouponSettings(
  token: string,
  input: AdminCustomerCouponSettings
): Promise<AdminCustomerCouponSettings> {
  const response = await fetch("/api/admin/marketing/customer-coupon", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ settings: AdminCustomerCouponSettings }>(response);
  return data.settings;
}

export async function createAdminCoupon(
  token: string,
  input: AdminCustomerCouponSettings
): Promise<AdminCustomerCouponSettings> {
  const response = await fetch("/api/admin/coupons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ coupon: AdminCustomerCouponSettings }>(response);
  return data.coupon;
}

export async function updateAdminCoupon(
  token: string,
  couponId: string,
  input: AdminCustomerCouponSettings
): Promise<AdminCustomerCouponSettings> {
  const response = await fetch(`/api/admin/coupons/${couponId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ coupon: AdminCustomerCouponSettings }>(response);
  return data.coupon;
}

export async function deleteAdminCoupon(token: string, couponId: string): Promise<void> {
  const response = await fetch(`/api/admin/coupons/${couponId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function updateAdminAbandonedCartCampaign(
  token: string,
  input: AdminAbandonedCartSettings
): Promise<AdminAbandonedCartCampaignResponse> {
  const response = await fetch("/api/admin/marketing/abandoned-cart", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return parseResponse<AdminAbandonedCartCampaignResponse>(response);
}

export async function runAdminAbandonedCartCampaign(
  token: string
): Promise<AdminAbandonedCartRunSummary> {
  const response = await fetch("/api/admin/marketing/abandoned-cart/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  return parseResponse<AdminAbandonedCartRunSummary>(response);
}

export async function fetchAdminGoogleMerchantStatus(token: string): Promise<{
  enabled: boolean;
  configured: boolean;
  accountId: string;
  targetCountry: string;
  contentLanguage: string;
  currency: string;
  brand: string;
}> {
  const response = await fetch("/api/admin/google-merchant/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse<{
    enabled: boolean;
    configured: boolean;
    accountId: string;
    targetCountry: string;
    contentLanguage: string;
    currency: string;
    brand: string;
  }>(response);
}

export async function syncAdminGoogleMerchant(token: string): Promise<{
  ok: boolean;
  total: number;
  success: number;
  deleted: number;
  failed: number;
  message: string;
}> {
  const response = await fetch("/api/admin/google-merchant/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  return parseResponse<{
    ok: boolean;
    total: number;
    success: number;
    deleted: number;
    failed: number;
    message: string;
  }>(response);
}

export async function fetchAdminOrders(token: string): Promise<AdminOrder[]> {
  const response = await fetch("/api/admin/orders", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ orders: AdminOrder[] }>(response);
  return data.orders;
}

export async function updateAdminOrderStatus(
  token: string,
  orderId: string,
  payload: {
    status: "processing" | "shipped" | "delivered";
    shippingCompany?: string;
    shippingTrackingNo?: string;
  }
): Promise<{
  ok: boolean;
  status: "processing" | "shipped" | "delivered";
  shippingCompany: string;
  shippingTrackingNo: string;
  event: import("@/types").AdminOrderTimelineEvent | null;
}> {
  const response = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return parseResponse<{
    ok: boolean;
    status: "processing" | "shipped" | "delivered";
    shippingCompany: string;
    shippingTrackingNo: string;
    event: import("@/types").AdminOrderTimelineEvent | null;
  }>(response);
}

export async function fetchAdminProducts(
  token: string,
  params?: { limit?: number; offset?: number }
): Promise<{ products: Product[]; hasMore: boolean; nextOffset: number; total: number }> {
  const query = new URLSearchParams();
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(Math.max(1, Math.trunc(params.limit))));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset)) {
    query.set("offset", String(Math.max(0, Math.trunc(params.offset))));
  }

  const response = await fetch(`/api/admin/products${query.toString() ? `?${query.toString()}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{
    products: Product[];
    hasMore?: boolean;
    nextOffset?: number;
    total?: number;
  }>(response);
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    products,
    hasMore: Boolean(data.hasMore),
    nextOffset:
      typeof data.nextOffset === "number" && Number.isFinite(data.nextOffset)
        ? data.nextOffset
        : products.length,
    total: typeof data.total === "number" && Number.isFinite(data.total) ? data.total : products.length,
  };
}

export async function fetchAdminContactRequests(token: string): Promise<AdminContactRequest[]> {
  const response = await fetch("/api/admin/contact-requests", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ requests: AdminContactRequest[] }>(response);
  return data.requests;
}

export async function fetchAdminUsers(token: string): Promise<AdminUserSummary[]> {
  const response = await fetch("/api/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ users: AdminUserSummary[] }>(response);
  return data.users;
}

export async function updateAdminProduct(
  token: string,
  productId: string,
  input: {
    name: string;
    price: number;
    stock: number | null;
    barcode: string;
    image: string;
    images: string[];
    category: string;
    description: string;
    features: string[];
    colors: string[];
    tags: string[];
    isNew: boolean;
    isBestseller: boolean;
  }
): Promise<Product> {
  const response = await fetch(`/api/admin/products/${productId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ product: Product }>(response);
  return data.product;
}

export async function fetchAdminProductById(token: string, productId: string): Promise<Product> {
  const response = await fetch(`/api/admin/products/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ product: Product }>(response);
  return data.product;
}

export async function createAdminProduct(
  token: string,
  input: {
    id?: string;
    name: string;
    price: number;
    stock: number | null;
    barcode: string;
    image: string;
    images: string[];
    category: string;
    description: string;
    features: string[];
    colors: string[];
    tags: string[];
    isNew: boolean;
    isBestseller: boolean;
  }
): Promise<Product> {
  const response = await fetch(`/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ product: Product }>(response);
  return data.product;
}

export async function deleteAdminProduct(token: string, productId: string): Promise<void> {
  const response = await fetch(`/api/admin/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function uploadAdminProductImages(token: string, files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  const response = await fetch("/api/admin/upload-images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await parseResponse<{ urls: string[] }>(response);
  return Array.isArray(data.urls) ? data.urls : [];
}

