import type { Address, AdminOrder, CartItem, Category, Order, Product, User } from "@/types";

const AUTH_TOKEN_KEY = "parisMoveAuthToken";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : `İstek başarısız: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
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
}): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (params?.sort) query.set("sort", params.sort);

  const response = await fetch(`/api/products${query.toString() ? `?${query}` : ""}`);
  return parseResponse<Product[]>(response);
}

export async function fetchProductDetail(id: string): Promise<{
  product: Product;
  relatedProducts: Product[];
}> {
  const response = await fetch(`/api/products/${id}`);
  return parseResponse<{ product: Product; relatedProducts: Product[] }>(response);
}

export async function fetchPublicSettings(): Promise<{ siteName: string }> {
  const response = await fetch("/api/settings");
  return parseResponse<{ siteName: string }>(response);
}

export async function registerUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<User> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token);
  return data.user;
}

export async function loginUser(input: { email: string; password: string }): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token);
  return data.user;
}

export async function loginWithGoogle(credential: string): Promise<User> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token);
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
  gender?: "kadin" | "erkek";
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
    setAuthToken(data.token);
  }
  return data;
}

export async function verifyAuthFlowCode(input: {
  email: string;
  code: string;
}): Promise<User> {
  const response = await fetch("/api/auth/flow/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseResponse<{ token: string; user: User }>(response);
  setAuthToken(data.token);
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
}): Promise<{ iframeUrl: string; token: string; merchantOid: string }> {
  const response = await fetch("/api/paytr/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ iframeUrl: string; token: string; merchantOid: string }>(response);
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

export async function adminLogin(input: { email: string; password: string }): Promise<string> {
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
): Promise<void> {
  const response = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  await parseResponse<{ ok: boolean; status: string }>(response);
}

export async function fetchAdminProducts(token: string): Promise<Product[]> {
  const response = await fetch("/api/admin/products", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse<{ products: Product[] }>(response);
  return data.products;
}

export async function updateAdminProduct(
  token: string,
  productId: string,
  input: {
    name: string;
    price: number;
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

export async function createAdminProduct(
  token: string,
  input: {
    id?: string;
    name: string;
    price: number;
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
