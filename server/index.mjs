import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import https from "node:https";
import net from "node:net";
import nodemailer from "nodemailer";
import multer from "multer";
import { promises as dnsPromises } from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JWT, OAuth2Client } from "google-auth-library";
import { createClient } from "redis";
import sharp from "sharp";
import { pool } from "./db.mjs";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 3001);
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_REMEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SITE_NAME = "StilBags&Fashion";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const distIndexHtml = path.join(distDir, "index.html");
const uploadsDir = path.resolve(__dirname, "../uploads");
const uploadVariantsDir = path.join(uploadsDir, "variants");
const responseCache = new Map();
const securityCounterCache = new Map();
const REDIS_CACHE_PREFIX = String(process.env.REDIS_CACHE_PREFIX || "stilbags-cache:");
const REDIS_URL = String(process.env.REDIS_URL || "").trim();
const REDIS_ENABLED = REDIS_URL.length > 0;
let redisClient = null;
let redisConnected = false;
const SECURITY_REDIS_PREFIX = `${REDIS_CACHE_PREFIX}security:`;
const CORS_ALLOWED_ORIGINS = new Set(
  [
    "https://stilbagsfashion.com",
    "https://www.stilbagsfashion.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    String(process.env.FRONTEND_ORIGIN ?? "").trim(),
    String(process.env.SITE_URL ?? "").trim(),
  ].filter(Boolean)
);
const CACHE_TTL_MS = {
  settings: 15 * 60 * 1000,
  categories: 30 * 60 * 1000,
  productList: 2 * 60 * 1000,
  productDetail: 5 * 60 * 1000,
  productMedia: 5 * 60 * 1000,
};
const AUTH_SECURITY_LIMITS = Object.freeze({
  authLogin: {
    scope: "auth-login",
    message: "Çok fazla giriş denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.",
    windowSeconds: 15 * 60,
    ipLimit: 25,
    identifierLimit: 6,
  },
  adminLogin: {
    scope: "admin-login",
    message: "Çok fazla admin giriş denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.",
    windowSeconds: 15 * 60,
    ipLimit: 10,
    identifierLimit: 5,
  },
  authFlowStart: {
    scope: "auth-flow-start",
    message: "Çok fazla kayıt veya doğrulama kodu talebi yapıldı. Lütfen biraz sonra tekrar deneyin.",
    windowSeconds: 15 * 60,
    ipLimit: 12,
    identifierLimit: 3,
  },
  authFlowVerify: {
    scope: "auth-flow-verify",
    message: "Çok fazla doğrulama kodu denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.",
    windowSeconds: 10 * 60,
    ipLimit: 20,
    identifierLimit: 5,
  },
  passwordForgot: {
    scope: "auth-password-forgot",
    message: "Çok fazla şifre yenileme talebi yapıldı. Lütfen biraz sonra tekrar deneyin.",
    windowSeconds: 15 * 60,
    ipLimit: 10,
    identifierLimit: 3,
  },
  couponApply: {
    scope: "coupon-apply",
    message: "Çok fazla kupon denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.",
    windowSeconds: 10 * 60,
    ipLimit: 20,
    identifierLimit: 0,
  },
});
const IMAGE_VARIANT_SPECS = {
  thumb: { width: 200, quality: 72 },
  card: { width: 480, quality: 78 },
  detail: { width: 960, quality: 84 },
};
const TRENDYOL_ENABLED = ["1", "true", "yes"].includes(String(process.env.TRENDYOL_ENABLED ?? "").trim().toLowerCase());
const TRENDYOL_ENVIRONMENT = String(process.env.TRENDYOL_ENVIRONMENT || "production").trim().toLowerCase();
const TRENDYOL_SELLER_ID = String(process.env.TRENDYOL_SELLER_ID || "").trim();
const TRENDYOL_SUPPLIER_ID = String(process.env.TRENDYOL_SUPPLIER_ID || TRENDYOL_SELLER_ID).trim();
const TRENDYOL_API_KEY = String(process.env.TRENDYOL_API_KEY || "").trim();
const TRENDYOL_API_SECRET = String(process.env.TRENDYOL_API_SECRET || "").trim();
const TRENDYOL_USER_AGENT_SUFFIX = String(process.env.TRENDYOL_USER_AGENT_SUFFIX || "SelfIntegration").trim();
const TRENDYOL_AUTO_SYNC_PRODUCTS = ["1", "true", "yes"].includes(
  String(process.env.TRENDYOL_AUTO_SYNC_PRODUCTS ?? "").trim().toLowerCase()
);
const TRENDYOL_DEFAULT_BRAND_ID = String(process.env.TRENDYOL_DEFAULT_BRAND_ID || "").trim();
const TRENDYOL_DEFAULT_CATEGORY_ID = String(process.env.TRENDYOL_DEFAULT_CATEGORY_ID || "").trim();
const TRENDYOL_DEFAULT_CARGO_COMPANY_ID = String(process.env.TRENDYOL_DEFAULT_CARGO_COMPANY_ID || "").trim();
const TRENDYOL_DEFAULT_VAT_RATE = Number(process.env.TRENDYOL_DEFAULT_VAT_RATE || 20);
const TRENDYOL_DEFAULT_DESI = Number(process.env.TRENDYOL_DEFAULT_DESI || 1);
const TRENDYOL_DEFAULT_DELIVERY_DURATION = Number(process.env.TRENDYOL_DEFAULT_DELIVERY_DURATION || 3);
const TRENDYOL_DEFAULT_QUANTITY = Number(process.env.TRENDYOL_DEFAULT_QUANTITY || 100);
const TRENDYOL_DEFAULT_LIST_PRICE_MULTIPLIER = Number(process.env.TRENDYOL_DEFAULT_LIST_PRICE_MULTIPLIER || 1);
const TRENDYOL_DEFAULT_IMAGE_TEMPLATE = String(process.env.TRENDYOL_DEFAULT_IMAGE_TEMPLATE || "").trim();
const TRENDYOL_DEFAULT_ATTRIBUTES_JSON = String(process.env.TRENDYOL_DEFAULT_ATTRIBUTES_JSON || "[]").trim();
const TRENDYOL_ORDER_STATUS = String(process.env.TRENDYOL_ORDER_STATUS || "Created").trim();
const BLOCKED_PUBLIC_PATH_PATTERNS = [
  /(?:^|\/)\.(?:env|git|svn|hg)(?:$|[./~_-])/i,
  /(?:^|\/)\.ht(?:access|passwd)(?:$|[./~_-])/i,
  /(?:^|\/).+\.env(?:$|[.~_-])/i,
  /(?:^|\/).+\.(?:bak|backup|old|orig|save|swp)(?:$|[./_-])/i,
  /(?:^|\/)(?:docker-compose|compose)\.(?:ya?ml)(?:$|[.~_-])/i,
];

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(uploadVariantsDir)) {
  fs.mkdirSync(uploadVariantsDir, { recursive: true });
}

function getRedisCacheKey(cacheKey) {
  return `${REDIS_CACHE_PREFIX}${cacheKey}`;
}

async function initializeRedisCache() {
  if (!REDIS_ENABLED) {
    return;
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    redisClient.on("error", (error) => {
      redisConnected = false;
      console.warn("Redis cache error:", error instanceof Error ? error.message : error);
    });

    redisClient.on("ready", () => {
      redisConnected = true;
      console.info("Redis cache connected.");
    });

    redisClient.on("end", () => {
      redisConnected = false;
      console.warn("Redis cache disconnected.");
    });

    await redisClient.connect();
  } catch (error) {
    redisClient = null;
    redisConnected = false;
    console.warn("Redis cache disabled, falling back to memory cache.", error instanceof Error ? error.message : error);
  }
}

async function getCachedResponse(cacheKey) {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
  } else {
    return entry.value;
  }

  if (!redisClient || !redisConnected) {
    return null;
  }

  try {
    const raw = await redisClient.get(getRedisCacheKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Number(parsed.expiresAt || 0) <= Date.now()) {
      await redisClient.del(getRedisCacheKey(cacheKey));
      return null;
    }
    responseCache.set(cacheKey, {
      value: parsed.value,
      expiresAt: Number(parsed.expiresAt),
    });
    return parsed.value ?? null;
  } catch (error) {
    console.warn("Redis cache read failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function setCachedResponse(cacheKey, value, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  const payload = {
    value,
    expiresAt,
  };

  responseCache.set(cacheKey, payload);

  if (redisClient && redisConnected) {
    try {
      await redisClient.set(getRedisCacheKey(cacheKey), JSON.stringify(payload), {
        EX: Math.max(1, Math.ceil(ttlMs / 1000)),
      });
    } catch (error) {
      console.warn("Redis cache write failed:", error instanceof Error ? error.message : error);
    }
  }

  return value;
}

async function invalidateCacheByPrefix(prefix) {
  for (const cacheKey of responseCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      responseCache.delete(cacheKey);
    }
  }

  if (!redisClient || !redisConnected) {
    return;
  }

  try {
    const keysToDelete = [];
    for await (const key of redisClient.scanIterator({
      MATCH: `${getRedisCacheKey(prefix)}*`,
      COUNT: 100,
    })) {
      keysToDelete.push(key);
    }
    if (keysToDelete.length > 0) {
      await redisClient.del(...keysToDelete);
    }
  } catch (error) {
    console.warn("Redis cache invalidation failed:", error instanceof Error ? error.message : error);
  }
}

async function invalidateProductCaches() {
  await Promise.all([
    invalidateCacheByPrefix("products:list:"),
    invalidateCacheByPrefix("product:detail:"),
    invalidateCacheByPrefix("product:media:"),
  ]);
}

async function invalidateSettingsCache() {
  await invalidateCacheByPrefix("settings:");
}

function getTrendyolApiBaseUrl() {
  return TRENDYOL_ENVIRONMENT === "stage"
    ? "https://stageapigw.trendyol.com"
    : "https://apigw.trendyol.com";
}

function getTrendyolUserAgent() {
  const sellerId = TRENDYOL_SELLER_ID || TRENDYOL_SUPPLIER_ID || "unknown";
  const suffix = TRENDYOL_USER_AGENT_SUFFIX || "SelfIntegration";
  return `${sellerId} - ${suffix}`;
}

function getTrendyolMissingFields() {
  const missing = [];
  if (!TRENDYOL_SELLER_ID) missing.push("TRENDYOL_SELLER_ID");
  if (!TRENDYOL_SUPPLIER_ID) missing.push("TRENDYOL_SUPPLIER_ID");
  if (!TRENDYOL_API_KEY) missing.push("TRENDYOL_API_KEY");
  if (!TRENDYOL_API_SECRET) missing.push("TRENDYOL_API_SECRET");
  return missing;
}

function parseTrendyolAttributes() {
  try {
    const parsed = JSON.parse(TRENDYOL_DEFAULT_ATTRIBUTES_JSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getTrendyolStatusSnapshot() {
  const missing = getTrendyolMissingFields();
  const notes = [
    "Trendyol siparişleri resmi order endpoint üzerinden ayrı olarak admin panelde listelenir.",
    "Otomatik ürün senkronizasyonu create/update sırasında çalışır ve Trendyol zorunlu kategori/brand/attribute bilgilerine ihtiyaç duyar.",
    "Kategori, brand, cargo ve attribute alanları Trendyol panelinizdeki gerçek değerlerle doldurulmalıdır.",
  ];
  const productSyncReady =
    TRENDYOL_ENABLED &&
    missing.length === 0 &&
    TRENDYOL_AUTO_SYNC_PRODUCTS &&
    Boolean(TRENDYOL_DEFAULT_BRAND_ID) &&
    Boolean(TRENDYOL_DEFAULT_CATEGORY_ID) &&
    Boolean(TRENDYOL_DEFAULT_CARGO_COMPANY_ID) &&
    parseTrendyolAttributes().length > 0;

  return {
    enabled: TRENDYOL_ENABLED,
    configured: TRENDYOL_ENABLED && missing.length === 0,
    environment: TRENDYOL_ENVIRONMENT,
    sellerId: TRENDYOL_SELLER_ID,
    supplierId: TRENDYOL_SUPPLIER_ID,
    userAgent: getTrendyolUserAgent(),
    autoSyncProducts: TRENDYOL_AUTO_SYNC_PRODUCTS,
    orderFetchReady: TRENDYOL_ENABLED && missing.length === 0,
    productSyncReady,
    missing,
    notes,
  };
}

function getTrendyolAuthHeaders() {
  const basic = Buffer.from(`${TRENDYOL_API_KEY}:${TRENDYOL_API_SECRET}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "User-Agent": getTrendyolUserAgent(),
  };
}

async function trendyolRequest(pathname, { method = "GET", searchParams, body } = {}) {
  const status = getTrendyolStatusSnapshot();
  if (!status.orderFetchReady) {
    throw new Error("Trendyol ayarlari eksik. .env dosyasini doldurun.");
  }

  const url = new URL(`${getTrendyolApiBaseUrl()}${pathname}`);
  if (searchParams && typeof searchParams === "object") {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    ...getTrendyolAuthHeaders(),
  };
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    throw new Error(
      `Trendyol istegi basarisiz: ${response.status} ${
        typeof payload === "string" ? payload.slice(0, 300) : JSON.stringify(payload).slice(0, 300)
      }`
    );
  }

  return payload;
}

function mapTrendyolOrder(order) {
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const totalPrice = lines.reduce((total, line) => total + Number(line?.price ?? 0) * Number(line?.quantity ?? 0), 0);
  return {
    id: String(order?.shipmentPackageId ?? order?.id ?? order?.orderNumber ?? ""),
    orderNumber: String(order?.orderNumber ?? ""),
    packageNumber: String(order?.shipmentPackageId ?? order?.packageNumber ?? ""),
    status: String(order?.status ?? ""),
    customerName: `${String(order?.customerFirstName ?? "").trim()} ${String(order?.customerLastName ?? "").trim()}`.trim() || "-",
    createdAt: String(order?.orderDate ?? order?.createdDate ?? new Date().toISOString()),
    cargoTrackingNumber: String(order?.cargoTrackingNumber ?? ""),
    cargoProviderName: String(order?.cargoProviderName ?? ""),
    totalPrice,
    lines: lines.map((line) => ({
      barcode: String(line?.barcode ?? ""),
      productName: String(line?.productName ?? ""),
      merchantSku: String(line?.merchantSku ?? line?.sku ?? ""),
      quantity: Number(line?.quantity ?? 0),
      price: Number(line?.price ?? 0),
    })),
  };
}

async function fetchTrendyolOrders() {
  const payload = await trendyolRequest(`/integration/order/sellers/${encodeURIComponent(TRENDYOL_SELLER_ID)}/orders`, {
    searchParams: {
      status: TRENDYOL_ORDER_STATUS || undefined,
      size: 50,
      page: 0,
    },
  });
  const content = Array.isArray(payload?.content) ? payload.content : Array.isArray(payload?.items) ? payload.items : [];
  return content.map(mapTrendyolOrder).filter((item) => item.id);
}

function buildAbsoluteStorefrontProductImage(rawValue) {
  const normalized = normalizeMediaPath(rawValue);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const baseUrl = getBaseUrl();
  return `${baseUrl}${normalized}`;
}

function buildTrendyolProductPayload(product) {
  const attributes = parseTrendyolAttributes();
  if (attributes.length === 0) {
    throw new Error("TRENDYOL_DEFAULT_ATTRIBUTES_JSON zorunludur.");
  }

  const imageUrls = (Array.isArray(product?.images) ? product.images : [product?.image])
    .map((item) => buildAbsoluteStorefrontProductImage(item))
    .filter(Boolean);
  const firstImage = imageUrls[0] || (TRENDYOL_DEFAULT_IMAGE_TEMPLATE ? TRENDYOL_DEFAULT_IMAGE_TEMPLATE.replace(/\{productId\}/g, String(product?.id ?? "")) : "");
  const title = String(product?.name ?? "").trim();
  const description = String(product?.description ?? "").trim() || title;
  const quantity = Math.max(0, Number(product?.stock ?? TRENDYOL_DEFAULT_QUANTITY ?? 0));
  const salePrice = Number(product?.price ?? 0);
  const listPrice = Number((salePrice * Math.max(1, TRENDYOL_DEFAULT_LIST_PRICE_MULTIPLIER)).toFixed(2));

  if (!title || !firstImage) {
    throw new Error("Trendyol ürün senkronu için ürün adı ve görsel zorunludur.");
  }

  return {
    items: [
      {
        barcode: String(product?.barcode ?? product?.id ?? "").trim() || String(product?.id ?? "").trim(),
        title,
        productMainId: String(product?.id ?? "").trim(),
        brandId: Number(TRENDYOL_DEFAULT_BRAND_ID),
        categoryId: Number(TRENDYOL_DEFAULT_CATEGORY_ID),
        quantity,
        stockCode: String(product?.id ?? "").trim(),
        dimensionalWeight: Math.max(1, Number(TRENDYOL_DEFAULT_DESI || 1)),
        description,
        currencyType: "TRY",
        listPrice,
        salePrice,
        vatRate: Number.isFinite(TRENDYOL_DEFAULT_VAT_RATE) ? TRENDYOL_DEFAULT_VAT_RATE : 20,
        cargoCompanyId: Number(TRENDYOL_DEFAULT_CARGO_COMPANY_ID),
        images: imageUrls.length > 0 ? imageUrls.map((url) => ({ url })) : [{ url: firstImage }],
        attributes,
        deliveryDuration: Math.max(1, Number(TRENDYOL_DEFAULT_DELIVERY_DURATION || 3)),
      },
    ],
  };
}

async function syncProductToTrendyol(productRow) {
  const status = getTrendyolStatusSnapshot();
  if (!status.productSyncReady) {
    return { skipped: true, reason: "Trendyol otomatik ürün senkronu hazır değil." };
  }

  const product = mapProductRow(productRow);
  const payload = buildTrendyolProductPayload(product);
  const response = await trendyolRequest(
    `/integration/product/sellers/${encodeURIComponent(TRENDYOL_SUPPLIER_ID)}/products`,
    {
      method: "POST",
      body: payload,
    }
  );
  return { skipped: false, response };
}

function getSecurityRedisKey(counterKey) {
  return `${SECURITY_REDIS_PREFIX}${counterKey}`;
}

function getSecurityFallbackEntry(counterKey) {
  const entry = securityCounterCache.get(counterKey);
  if (!entry) return null;
  if (Number(entry.expiresAt || 0) <= Date.now()) {
    securityCounterCache.delete(counterKey);
    return null;
  }
  return entry;
}

async function getSecurityCounter(counterKey) {
  const fallbackEntry = getSecurityFallbackEntry(counterKey);
  if (fallbackEntry) {
    return {
      count: Number(fallbackEntry.count || 0),
      retryAfterSeconds: Math.max(1, Math.ceil((fallbackEntry.expiresAt - Date.now()) / 1000)),
    };
  }

  if (!redisClient || !redisConnected) {
    return { count: 0, retryAfterSeconds: 0 };
  }

  try {
    const redisKey = getSecurityRedisKey(counterKey);
    const [countRaw, ttlRaw] = await Promise.all([redisClient.get(redisKey), redisClient.ttl(redisKey)]);
    const count = Number.parseInt(String(countRaw ?? "0"), 10) || 0;
    const ttl = Number.parseInt(String(ttlRaw ?? "0"), 10) || 0;
    return {
      count,
      retryAfterSeconds: ttl > 0 ? ttl : 0,
    };
  } catch (error) {
    console.warn("Security counter read failed:", error instanceof Error ? error.message : error);
    return { count: 0, retryAfterSeconds: 0 };
  }
}

async function incrementSecurityCounter(counterKey, ttlSeconds) {
  const normalizedTtl = Math.max(1, Math.ceil(ttlSeconds));

  if (redisClient && redisConnected) {
    try {
      const redisKey = getSecurityRedisKey(counterKey);
      const count = await redisClient.incr(redisKey);
      if (count === 1) {
        await redisClient.expire(redisKey, normalizedTtl);
      }
      const ttl = await redisClient.ttl(redisKey);
      return {
        count,
        retryAfterSeconds: ttl > 0 ? ttl : normalizedTtl,
      };
    } catch (error) {
      console.warn("Security counter write failed:", error instanceof Error ? error.message : error);
    }
  }

  const existing = getSecurityFallbackEntry(counterKey);
  if (!existing) {
    const nextEntry = {
      count: 1,
      expiresAt: Date.now() + normalizedTtl * 1000,
    };
    securityCounterCache.set(counterKey, nextEntry);
    return {
      count: 1,
      retryAfterSeconds: normalizedTtl,
    };
  }

  existing.count = Number(existing.count || 0) + 1;
  securityCounterCache.set(counterKey, existing);
  return {
    count: Number(existing.count || 0),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - Date.now()) / 1000)),
  };
}

async function clearSecurityCounter(counterKey) {
  securityCounterCache.delete(counterKey);

  if (!redisClient || !redisConnected) {
    return;
  }

  try {
    await redisClient.del(getSecurityRedisKey(counterKey));
  } catch (error) {
    console.warn("Security counter clear failed:", error instanceof Error ? error.message : error);
  }
}

function buildSecurityScopeKeys(req, scope, identifier = "") {
  const ipHash = sha256(getClientIp(req));
  const keys = [{ key: `${scope}:ip:${ipHash}`, type: "ip" }];
  const normalizedIdentifier = String(identifier ?? "").trim().toLowerCase();
  if (normalizedIdentifier) {
    keys.push({
      key: `${scope}:identifier:${sha256(normalizedIdentifier)}`,
      type: "identifier",
    });
  }
  return keys;
}

async function getRateLimitBlockState(req, config, identifier = "") {
  const keys = buildSecurityScopeKeys(req, config.scope, identifier);
  const states = await Promise.all(
    keys.map(async (entry) => {
      const state = await getSecurityCounter(entry.key);
      const limit = entry.type === "ip" ? Number(config.ipLimit || 0) : Number(config.identifierLimit || 0);
      return { ...entry, ...state, limit };
    })
  );
  const blocked = states.find((entry) => entry.limit > 0 && entry.count >= entry.limit);
  if (!blocked) {
    return null;
  }
  return {
    retryAfterSeconds: Math.max(1, Number(blocked.retryAfterSeconds || config.windowSeconds || 60)),
  };
}

async function recordRateLimitFailure(req, config, identifier = "") {
  const keys = buildSecurityScopeKeys(req, config.scope, identifier);
  const states = await Promise.all(
    keys.map(async (entry) => {
      const state = await incrementSecurityCounter(entry.key, config.windowSeconds);
      const limit = entry.type === "ip" ? Number(config.ipLimit || 0) : Number(config.identifierLimit || 0);
      return { ...entry, ...state, limit };
    })
  );
  const blocked = states.find((entry) => entry.limit > 0 && entry.count >= entry.limit);
  if (!blocked) {
    return null;
  }
  return {
    retryAfterSeconds: Math.max(1, Number(blocked.retryAfterSeconds || config.windowSeconds || 60)),
  };
}

async function clearRateLimitFailures(req, config, identifier = "") {
  const keys = buildSecurityScopeKeys(req, config.scope, identifier);
  await Promise.all(keys.map((entry) => clearSecurityCounter(entry.key)));
}

async function enforceRateLimit(req, res, config, identifier = "") {
  const blocked = await getRateLimitBlockState(req, config, identifier);
  if (!blocked) {
    return false;
  }
  res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
  res.status(429).json({ message: config.message });
  return true;
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
  const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isGoogleCrawlerRequest(userAgent = "") {
  const normalized = String(userAgent || "").toLowerCase();
  return (
    normalized.includes("googlebot") ||
    normalized.includes("googlebot-image") ||
    normalized.includes("storebot-google") ||
    normalized.includes("adsbot-google") ||
    normalized.includes("google-inspectiontool")
  );
}

app.use((req, res, next) => {
  const userAgent = String(req.get("user-agent") || "");
  const shouldLogCrawlerRequest =
    isGoogleCrawlerRequest(userAgent) &&
    ["/robots.txt", "/sitemap.xml", "/uploads/", "/api/uploads/", "/api/merchant/product/"].some((prefix) =>
      req.path.startsWith(prefix)
    );

  if (!shouldLogCrawlerRequest) {
    next();
    return;
  }

  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.info("Crawler request:", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userAgent,
      referer: String(req.get("referer") || ""),
      ip: req.ip,
    });
  });

  next();
});

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  next();
});
app.use((req, res, next) => {
  const decodedPath = (() => {
    try {
      return decodeURIComponent(String(req.path || ""));
    } catch {
      return String(req.path || "");
    }
  })();

  if (BLOCKED_PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(decodedPath))) {
    return res.status(404).type("text/plain; charset=utf-8").send("Not Found");
  }

  return next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || CORS_ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "50mb" }));
const staticUploadOptions = {
  maxAge: "365d",
  immutable: true,
  dotfiles: "deny",
  setHeaders: (res, filePath) => {
    res.setHeader("X-Robots-Tag", "all");
    res.setHeader("Content-Disposition", "inline");
    if (path.extname(String(filePath ?? "")).toLowerCase() === ".jfif") {
      res.setHeader("Content-Type", "image/jpeg");
    }
  },
};
app.use("/uploads", express.static(uploadsDir, staticUploadOptions));
app.use("/api/uploads", express.static(uploadsDir, staticUploadOptions));

const allowedUploadMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/heic",
  "image/heif",
]);
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const normalizedExtByMime = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/pjpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/bmp": ".bmp",
      "image/avif": ".avif",
      "image/heic": ".heic",
      "image/heif": ".heif",
    };
    const extFromMime = normalizedExtByMime[mime] || "";
    const extFromName = path.extname(file.originalname || "").toLowerCase();
    const safeExt = (extFromMime || (extFromName.length <= 10 ? extFromName : "") || ".jpg").replace(
      /[^a-z0-9.]/gi,
      ""
    );
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt || ".jpg"}`);
  },
});
const adminImageUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 12 * 1024 * 1024, files: 15 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (allowedUploadMimeTypes.has(mime)) {
      cb(null, true);
      return;
    }
    cb(new Error("INVALID_IMAGE_TYPE"));
  },
});

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MINUTES = 30;
const PAYTR_PAYMENT_INTENT_TTL_MINUTES = 60;
const GOOGLE_CLIENT_IDS = Array.from(
  new Set(
    [process.env.GOOGLE_CLIENT_ID, process.env.VITE_GOOGLE_CLIENT_ID]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
  )
);
const googleOAuthClient = GOOGLE_CLIENT_IDS.length > 0 ? new OAuth2Client() : null;
const PASSWORD_RESET_BASE_URL = String(process.env.PASSWORD_RESET_BASE_URL ?? "").trim();
const ORDER_EMAIL_BASE_URL = String(
  process.env.ORDER_EMAIL_BASE_URL ?? process.env.PASSWORD_RESET_BASE_URL ?? ""
).trim();
const SMTP_HOST = String(process.env.SMTP_HOST ?? "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER ?? "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS ?? "").trim();
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME ?? "StilBags&Fashion").trim();
const SMTP_FROM_EMAIL = String(process.env.SMTP_FROM_EMAIL ?? SMTP_USER).trim();
const isSmtpConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM_EMAIL);
const mailTransporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;
const ORDER_SMTP_HOST = String(process.env.ORDER_SMTP_HOST ?? "").trim();
const ORDER_SMTP_PORT = Number(process.env.ORDER_SMTP_PORT || 587);
const ORDER_SMTP_SECURE = String(process.env.ORDER_SMTP_SECURE ?? "false").toLowerCase() === "true";
const ORDER_SMTP_USER = String(process.env.ORDER_SMTP_USER ?? "").trim();
const ORDER_SMTP_PASS = String(process.env.ORDER_SMTP_PASS ?? "").trim();
const ORDER_SMTP_FROM_NAME = String(process.env.ORDER_SMTP_FROM_NAME ?? "StilBags&Fashion").trim();
const ORDER_SMTP_FROM_EMAIL = String(process.env.ORDER_SMTP_FROM_EMAIL ?? ORDER_SMTP_USER).trim();
const isOrderSmtpConfigured = Boolean(
  ORDER_SMTP_HOST &&
    ORDER_SMTP_PORT &&
    ORDER_SMTP_USER &&
    ORDER_SMTP_PASS &&
    ORDER_SMTP_FROM_EMAIL
);
const orderMailTransporter = isOrderSmtpConfigured
  ? nodemailer.createTransport({
      host: ORDER_SMTP_HOST,
      port: ORDER_SMTP_PORT,
      secure: ORDER_SMTP_SECURE,
      auth: {
        user: ORDER_SMTP_USER,
        pass: ORDER_SMTP_PASS,
      },
    })
  : null;
const WELCOME_SMTP_HOST = String(process.env.WELCOME_SMTP_HOST ?? "").trim();
const WELCOME_SMTP_PORT = Number(process.env.WELCOME_SMTP_PORT || 587);
const WELCOME_SMTP_SECURE = String(process.env.WELCOME_SMTP_SECURE ?? "false").toLowerCase() === "true";
const WELCOME_SMTP_USER = String(process.env.WELCOME_SMTP_USER ?? "").trim();
const WELCOME_SMTP_PASS = String(process.env.WELCOME_SMTP_PASS ?? "").trim();
const WELCOME_SMTP_FROM_NAME = String(process.env.WELCOME_SMTP_FROM_NAME ?? "StilBags&Fashion").trim();
const WELCOME_SMTP_FROM_EMAIL = String(process.env.WELCOME_SMTP_FROM_EMAIL ?? WELCOME_SMTP_USER).trim();
const WELCOME_EMAIL_SUBJECT = String(process.env.WELCOME_EMAIL_SUBJECT ?? "Aramiza Hos Geldiniz").trim();
const WELCOME_EMAIL_BASE_URL = String(
  process.env.WELCOME_EMAIL_BASE_URL ?? process.env.ORDER_EMAIL_BASE_URL ?? process.env.PASSWORD_RESET_BASE_URL ?? ""
).trim();
const isDedicatedWelcomeSmtpConfigured = Boolean(
  WELCOME_SMTP_HOST &&
    WELCOME_SMTP_PORT &&
    WELCOME_SMTP_USER &&
    WELCOME_SMTP_PASS &&
    WELCOME_SMTP_FROM_EMAIL
);
const dedicatedWelcomeMailTransporter = isDedicatedWelcomeSmtpConfigured
  ? nodemailer.createTransport({
      host: WELCOME_SMTP_HOST,
      port: WELCOME_SMTP_PORT,
      secure: WELCOME_SMTP_SECURE,
      auth: {
        user: WELCOME_SMTP_USER,
        pass: WELCOME_SMTP_PASS,
      },
    })
  : null;
const welcomeMailTransporter = dedicatedWelcomeMailTransporter || mailTransporter || orderMailTransporter;
const welcomeMailFromName = dedicatedWelcomeMailTransporter
  ? WELCOME_SMTP_FROM_NAME
  : mailTransporter
    ? SMTP_FROM_NAME
    : ORDER_SMTP_FROM_NAME;
const welcomeMailFromEmail = dedicatedWelcomeMailTransporter
  ? WELCOME_SMTP_FROM_EMAIL
  : mailTransporter
    ? SMTP_FROM_EMAIL
    : ORDER_SMTP_FROM_EMAIL;
const abandonedCartMailTransporter = orderMailTransporter || mailTransporter;
const abandonedCartMailFromName = orderMailTransporter ? ORDER_SMTP_FROM_NAME : SMTP_FROM_NAME;
const abandonedCartMailFromEmail = orderMailTransporter ? ORDER_SMTP_FROM_EMAIL : SMTP_FROM_EMAIL;
const ABANDONED_CART_SETTING_KEY = "marketing_abandoned_cart";
const CUSTOMER_COUPON_SETTING_KEY = "marketing_customer_coupon";
const NAVLUNGO_SENDER_ADDRESS_SETTING_KEY = "navlungo_sender_address_id";
const ABANDONED_CART_SCAN_INTERVAL_MS = 15 * 60 * 1000;
const NAVLUNGO_STATUS_SYNC_INTERVAL_MS = Math.max(
  10 * 1000,
  Number.parseInt(String(process.env.NAVLUNGO_STATUS_SYNC_INTERVAL_MS ?? `${10 * 1000}`), 10) || 10 * 1000
);
const DEFAULT_ABANDONED_CART_SETTINGS = Object.freeze({
  enabled: false,
  delayMinutes: 120,
  subject: "Sepetiniz sizi bekliyor",
  heading: "Sepetinizde bıraktığınız ürünler sizi bekliyor",
  body:
    "Seçtiğiniz ürünler hâlâ sepetinizde duruyor. Tükenmeden alışverişinizi tamamlamak için sepete geri dönebilirsiniz.",
  ctaLabel: "Sepetime Dön",
  couponEnabled: false,
  couponCode: "",
  couponType: "percentage",
  couponValue: 10,
  couponMinimumSubtotal: 750,
  couponDescription: "Sepetinize özel indirim kodunuz hazır.",
});
const DEFAULT_CUSTOMER_COUPON_SETTINGS = Object.freeze({
  enabled: false,
  code: "",
  type: "percentage",
  value: 10,
  minimumSubtotal: 750,
  description: "Müşterilerinize özel indirim kodunuz hazır.",
  singleUsePerCustomer: true,
  startsAt: "",
  expiresAt: "",
  usageCount: 0,
});
let abandonedCartScanTimeout = null;
let abandonedCartScanInFlight = null;
let navlungoStatusSyncTimeout = null;
let navlungoStatusSyncInFlight = null;
let navlungoTokenCache = {
  token: "",
  expiresAt: 0,
};
const WHATSAPP_ENABLED = String(process.env.WHATSAPP_ENABLED ?? "false").toLowerCase() === "true";
const WHATSAPP_API_URL = String(process.env.WHATSAPP_API_URL ?? "").trim();
const WHATSAPP_API_TOKEN = String(process.env.WHATSAPP_API_TOKEN ?? "").trim();
const WHATSAPP_PHONE_NUMBER_ID = String(process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim();
const WHATSAPP_TO_NUMBER = String(process.env.WHATSAPP_TO_NUMBER ?? "").trim();
const WHATSAPP_TO_NUMBER_2 = String(process.env.WHATSAPP_TO_NUMBER_2 ?? "").trim();
const WHATSAPP_TO_NUMBERS = Array.from(
  new Set([WHATSAPP_TO_NUMBER, WHATSAPP_TO_NUMBER_2].map((item) => String(item ?? "").trim()).filter(Boolean))
);
const WHATSAPP_TEMPLATE_NAME = String(process.env.WHATSAPP_TEMPLATE_NAME ?? "hello_world").trim();
const WHATSAPP_TEMPLATE_LANG = String(process.env.WHATSAPP_TEMPLATE_LANG ?? "en_US").trim();
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "").trim();
const WHATSAPP_ORDER_PRIMARY_MODE = String(process.env.WHATSAPP_ORDER_PRIMARY_MODE ?? "template")
  .trim()
  .toLowerCase();
const GOOGLE_MERCHANT_ENABLED = String(process.env.GOOGLE_MERCHANT_ENABLED ?? "false").toLowerCase() === "true";
const GOOGLE_MERCHANT_ACCOUNT_ID = String(process.env.GOOGLE_MERCHANT_ACCOUNT_ID ?? "").trim();
const GOOGLE_MERCHANT_CONTENT_LANGUAGE = String(process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE ?? "tr").trim() || "tr";
const GOOGLE_MERCHANT_TARGET_COUNTRY = String(process.env.GOOGLE_MERCHANT_TARGET_COUNTRY ?? "TR").trim() || "TR";
const GOOGLE_MERCHANT_CURRENCY = String(process.env.GOOGLE_MERCHANT_CURRENCY ?? "TRY").trim() || "TRY";
const GOOGLE_MERCHANT_BRAND = String(process.env.GOOGLE_MERCHANT_BRAND ?? DEFAULT_SITE_NAME).trim() || DEFAULT_SITE_NAME;
const GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL = String(
  process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL ?? ""
).trim();
const GOOGLE_MERCHANT_SERVICE_ACCOUNT_PRIVATE_KEY = String(
  process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_PRIVATE_KEY ?? ""
).trim();
const GOOGLE_MERCHANT_PRODUCT_URL_BASE = String(process.env.GOOGLE_MERCHANT_PRODUCT_URL_BASE ?? "").trim();
const GOOGLE_MERCHANT_CRAWL_VERSION = String(
  process.env.GOOGLE_MERCHANT_CRAWL_VERSION ?? Date.now().toString(36)
).trim();
const GOOGLE_MERCHANT_SCOPES = ["https://www.googleapis.com/auth/content"];
const isGoogleMerchantConfigured = Boolean(
  GOOGLE_MERCHANT_ENABLED &&
    GOOGLE_MERCHANT_ACCOUNT_ID &&
    GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL &&
    GOOGLE_MERCHANT_SERVICE_ACCOUNT_PRIVATE_KEY
);
const NAVLUNGO_API_BASE_URL = String(
  process.env.NAVLUNGO_API_BASE_URL ?? "https://domestic-api.navlungo.com/v2.1"
)
  .trim()
  .replace(/\/+$/, "");
const NAVLUNGO_USERNAME = String(process.env.NAVLUNGO_USERNAME ?? "").trim();
const NAVLUNGO_PASSWORD = String(process.env.NAVLUNGO_PASSWORD ?? "").trim();
const NAVLUNGO_SENDER_ADDRESS_ID = String(process.env.NAVLUNGO_SENDER_ADDRESS_ID ?? "").trim();
const NAVLUNGO_SENDER_LOCATION_NAME = String(process.env.NAVLUNGO_SENDER_LOCATION_NAME ?? "").trim();
const NAVLUNGO_SENDER_NAME = String(process.env.NAVLUNGO_SENDER_NAME ?? "").trim();
const NAVLUNGO_SENDER_EMAIL = String(process.env.NAVLUNGO_SENDER_EMAIL ?? "").trim();
const NAVLUNGO_SENDER_PHONE = String(process.env.NAVLUNGO_SENDER_PHONE ?? "").trim();
const NAVLUNGO_SENDER_ADDRESS_LINE = String(process.env.NAVLUNGO_SENDER_ADDRESS_LINE ?? "").trim();
const NAVLUNGO_SENDER_COUNTRY = String(process.env.NAVLUNGO_SENDER_COUNTRY ?? "tr").trim() || "tr";
const NAVLUNGO_SENDER_CITY = String(process.env.NAVLUNGO_SENDER_CITY ?? "").trim();
const NAVLUNGO_SENDER_DISTRICT = String(process.env.NAVLUNGO_SENDER_DISTRICT ?? "").trim();
const NAVLUNGO_SENDER_POST_CODE = String(process.env.NAVLUNGO_SENDER_POST_CODE ?? "").trim();
const NAVLUNGO_DEFAULT_CARRIER_ID = Math.max(1, Number.parseInt(String(process.env.NAVLUNGO_DEFAULT_CARRIER_ID ?? "1"), 10) || 1);
const NAVLUNGO_DEFAULT_POST_TYPE = Math.max(1, Number.parseInt(String(process.env.NAVLUNGO_DEFAULT_POST_TYPE ?? "2"), 10) || 2);
const NAVLUNGO_DEFAULT_DESI = Number.isFinite(Number(process.env.NAVLUNGO_DEFAULT_DESI))
  ? Math.max(0.1, Number(process.env.NAVLUNGO_DEFAULT_DESI))
  : 1;
const NAVLUNGO_DEFAULT_PACKAGE_COUNT = Math.max(
  1,
  Number.parseInt(String(process.env.NAVLUNGO_DEFAULT_PACKAGE_COUNT ?? "1"), 10) || 1
);
const NAVLUNGO_PLATFORM = String(process.env.NAVLUNGO_PLATFORM ?? "stilbagsfashion").trim();
const NAVLUNGO_LOCALIZATION = String(process.env.NAVLUNGO_LOCALIZATION ?? "tr").trim() || "tr";
const hasNavlungoSenderCreateConfig = Boolean(
  NAVLUNGO_SENDER_NAME &&
    NAVLUNGO_SENDER_EMAIL &&
    NAVLUNGO_SENDER_PHONE &&
    NAVLUNGO_SENDER_ADDRESS_LINE &&
    NAVLUNGO_SENDER_CITY &&
    NAVLUNGO_SENDER_DISTRICT
);
const isNavlungoConfigured = Boolean(
  NAVLUNGO_API_BASE_URL &&
    NAVLUNGO_USERNAME &&
    NAVLUNGO_PASSWORD
);
const isWhatsappConfigured = Boolean(
  WHATSAPP_ENABLED &&
    WHATSAPP_API_URL &&
    WHATSAPP_API_TOKEN &&
    WHATSAPP_TO_NUMBERS.length > 0 &&
    (WHATSAPP_PHONE_NUMBER_ID || /\/messages$/i.test(WHATSAPP_API_URL))
);
function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function buildPasswordResetUrl(req, token) {
  const routePath = `/giris?mode=reset&token=${encodeURIComponent(token)}`;
  if (PASSWORD_RESET_BASE_URL) {
    const rawBase = PASSWORD_RESET_BASE_URL.trim();
    const hasScheme = /^https?:\/\//i.test(rawBase);
    const normalizedBase = hasScheme
      ? rawBase
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawBase)
        ? `http://${rawBase}`
        : `https://${rawBase}`;
    const base = normalizedBase.replace(/\/+$/, "");
    return `${base}${routePath}`;
  }
  return `${req.protocol}://${req.get("host")}${routePath}`;
}

function buildPublicBaseUrl(req) {
  const rawBase = String(ORDER_EMAIL_BASE_URL ?? "").trim();
  if (rawBase) {
    const hasScheme = /^https?:\/\//i.test(rawBase);
    const normalizedBase = hasScheme
      ? rawBase
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawBase)
        ? `http://${rawBase}`
        : `https://${rawBase}`;
    return normalizedBase.replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function appendQueryParamToUrl(rawUrl, key, value) {
  const input = String(rawUrl ?? "").trim();
  if (!input) return "";

  try {
    const parsed = new URL(input);
    parsed.searchParams.set(String(key), String(value));
    return parsed.toString();
  } catch {
    return input;
  }
}

function sanitizeExternalHttpUrl(rawUrl) {
  const input = String(rawUrl ?? "").trim();
  if (!input) return "";

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildSitemapBaseUrl(req) {
  const rawBase = String(
    process.env.PUBLIC_SITE_URL ??
      process.env.ORDER_EMAIL_BASE_URL ??
      process.env.PASSWORD_RESET_BASE_URL ??
      ""
  ).trim();
  if (rawBase) {
    const withProtocol = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
    return withProtocol.replace(/\/+$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function buildWelcomeBaseUrl(req) {
  const rawBase = String(WELCOME_EMAIL_BASE_URL ?? "").trim();
  if (rawBase) {
    const hasScheme = /^https?:\/\//i.test(rawBase);
    const normalizedBase = hasScheme
      ? rawBase
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawBase)
        ? `http://${rawBase}`
        : `https://${rawBase}`;
    return normalizedBase.replace(/\/+$/, "");
  }
  return buildPublicBaseUrl(req);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getGoogleMerchantPrivateKey() {
  if (!GOOGLE_MERCHANT_SERVICE_ACCOUNT_PRIVATE_KEY) return "";
  return GOOGLE_MERCHANT_SERVICE_ACCOUNT_PRIVATE_KEY.replaceAll("\\n", "\n");
}

function buildGoogleMerchantBaseUrl(req) {
  const explicit = String(GOOGLE_MERCHANT_PRODUCT_URL_BASE ?? "").trim();
  if (explicit) {
    const hasScheme = /^https?:\/\//i.test(explicit);
    const normalized = hasScheme ? explicit : `https://${explicit}`;
    return normalized.replace(/\/+$/, "");
  }
  return buildSitemapBaseUrl(req);
}

async function getGoogleMerchantAccessToken() {
  if (!isGoogleMerchantConfigured) {
    throw new Error("Google Merchant API ayarlari eksik.");
  }
  const client = new JWT({
    email: GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL,
    key: getGoogleMerchantPrivateKey(),
    scopes: GOOGLE_MERCHANT_SCOPES,
  });
  const tokenResponse = await client.getAccessToken();
  const token = String(tokenResponse?.token ?? "").trim();
  if (!token) {
    throw new Error("Google access token alinamadi.");
  }
  return token;
}

const MERCHANT_CATEGORY_LABELS = {
  crossbody: "Çapraz Çanta",
  mini: "Mini Çanta",
  shoulder: "Omuz Çantası",
  shopper: "Shopper Çanta",
  wallet: "Cüzdan",
  tote: "Tote Çanta",
};

function sanitizeMerchantText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMerchantCategoryLabel(categoryId) {
  const normalized = sanitizeMerchantText(categoryId).toLowerCase();
  return MERCHANT_CATEGORY_LABELS[normalized] || "Kadın Çanta";
}

function hasReadableLetters(value) {
  return /[\p{L}]/u.test(String(value ?? ""));
}

function buildGoogleMerchantTitle(product) {
  const rawTitle = sanitizeMerchantText(product?.name);
  const categoryLabel = getMerchantCategoryLabel(product?.category);
  const brand = sanitizeMerchantText(GOOGLE_MERCHANT_BRAND) || DEFAULT_SITE_NAME;

  if (rawTitle.length >= 3 && hasReadableLetters(rawTitle)) {
    const enrichedTitle = rawTitle.toLowerCase().includes(brand.toLowerCase())
      ? `${rawTitle} - ${categoryLabel}`
      : `${rawTitle} - ${brand}`;
    return enrichedTitle.slice(0, 150);
  }

  return `${brand} ${categoryLabel}`.slice(0, 150);
}

function buildGoogleMerchantDescription(product, title) {
  const rawDescription = sanitizeMerchantText(product?.description);
  if (rawDescription.length >= 60) {
    return rawDescription.slice(0, 5000);
  }

  const categoryLabel = getMerchantCategoryLabel(product?.category);
  const brand = sanitizeMerchantText(GOOGLE_MERCHANT_BRAND) || DEFAULT_SITE_NAME;
  const fallback = `${title} modeli ${brand} koleksiyonunda yer alan şık ve kullanışlı ${categoryLabel.toLowerCase()} seçeneklerinden biridir. Günlük kullanım ve modern kombinler için uygundur.`;
  return fallback.slice(0, 5000);
}

function mapProductToGoogleMerchantEntry(req, product, index) {
  const baseUrl = buildGoogleMerchantBaseUrl(req);
  const offerId = String(product.id ?? "").trim();
  const title = buildGoogleMerchantTitle(product);
  const description = buildGoogleMerchantDescription(product, title);
  const price = Number(product.price ?? 0);
  const merchantVersion = buildMerchantProductVersion(product);
  const productUrl = appendUrlQueryParam(
    `${baseUrl}/api/merchant/product/${encodeURIComponent(offerId)}`,
    "gmc",
    merchantVersion
  );
  const rawImageCandidates = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  const nonProxyCandidates = rawImageCandidates.filter(
    (item) => !/^\/api\/products\/[^/]+\/image\/\d+$/i.test(item)
  );
  const selectedCandidates = Array.from(
    new Set(nonProxyCandidates.length > 0 ? nonProxyCandidates : rawImageCandidates)
  );
  const toMerchantImageUrl = (rawValue, imageIndex = 0) => {
    const value = String(rawValue ?? "").trim();
    if (isMerchantSafeDirectImageSource(value)) {
      return appendUrlQueryParam(toPublicUrl(baseUrl, value), "gmcimg", merchantVersion);
    }
    return appendUrlQueryParam(
      `${baseUrl}/api/merchant/product/${encodeURIComponent(offerId)}/image/${Math.max(0, imageIndex)}`,
      "gmcimg",
      merchantVersion
    );
  };
  const imageUrl = toMerchantImageUrl(selectedCandidates[0], 0);
  const additionalImageLinks = selectedCandidates
    .slice(1, 11)
    .map((item, relativeIndex) => toMerchantImageUrl(item, relativeIndex + 1))
    .filter(Boolean);

  return {
    batchId: index + 1,
    merchantId: GOOGLE_MERCHANT_ACCOUNT_ID,
    method: "insert",
    product: {
      offerId,
      title,
      description,
      link: productUrl,
      imageLink: imageUrl,
      additionalImageLinks,
      contentLanguage: GOOGLE_MERCHANT_CONTENT_LANGUAGE.toLowerCase(),
      targetCountry: GOOGLE_MERCHANT_TARGET_COUNTRY.toUpperCase(),
      channel: "online",
      availability: Number(product.stock) === 0 ? "out of stock" : "in stock",
      condition: "new",
      price: {
        value: Number.isFinite(price) ? price.toFixed(2) : "0.00",
        currency: GOOGLE_MERCHANT_CURRENCY.toUpperCase(),
      },
      brand: GOOGLE_MERCHANT_BRAND,
      productTypes: product.category ? [String(product.category)] : [],
      identifierExists: false,
    },
  };
}

function buildGoogleMerchantProductResourceId(offerId) {
  return `online:${GOOGLE_MERCHANT_CONTENT_LANGUAGE.toLowerCase()}:${GOOGLE_MERCHANT_TARGET_COUNTRY.toUpperCase()}:${String(
    offerId ?? ""
  ).trim()}`;
}

async function batchDeleteGoogleMerchantProducts(accessToken, offerIds) {
  const uniqueOfferIds = Array.from(new Set(offerIds.map((item) => String(item ?? "").trim()).filter(Boolean)));
  if (uniqueOfferIds.length === 0) {
    return { deleted: 0, failed: 0, errors: [] };
  }

  const endpoint = "https://shoppingcontent.googleapis.com/content/v2.1/products/batch";
  const chunkSize = 100;
  let deleted = 0;
  let failed = 0;
  const errors = [];

  for (let start = 0; start < uniqueOfferIds.length; start += chunkSize) {
    const chunk = uniqueOfferIds.slice(start, start + chunkSize);
    const entries = chunk.map((offerId, index) => ({
      batchId: start + index + 1,
      merchantId: GOOGLE_MERCHANT_ACCOUNT_ID,
      method: "delete",
      productId: buildGoogleMerchantProductResourceId(offerId),
    }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entries }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Google Merchant silme hatasi (${response.status}): ${JSON.stringify(data).slice(0, 500)}`
      );
    }

    const responseEntries = Array.isArray(data?.entries) ? data.entries : [];
    if (responseEntries.length === 0) {
      deleted += chunk.length;
      continue;
    }

    for (const entry of responseEntries) {
      const entryErrors = Array.isArray(entry?.errors?.errors) ? entry.errors.errors : [];
      if (entryErrors.length === 0) {
        deleted += 1;
        continue;
      }

      const isNotFound = entryErrors.some((item) => {
        const reason = String(item?.reason ?? "").toLowerCase();
        const message = String(item?.message ?? "").toLowerCase();
        return reason === "notfound" || message.includes("not found");
      });

      if (isNotFound) {
        deleted += 1;
        continue;
      }

      failed += 1;
      errors.push({
        offerId: String(entry?.productId ?? ""),
        message: entryErrors.map((item) => item.message).join(" | "),
      });
    }
  }

  return { deleted, failed, errors };
}

async function listAllGoogleMerchantProducts() {
  let pageToken = "";
  const allProducts = [];

  for (;;) {
    const result = await listGoogleMerchantProducts({ maxResults: 250, pageToken });
    allProducts.push(...result.products);
    if (!result.nextPageToken) {
      break;
    }
    pageToken = result.nextPageToken;
  }

  return allProducts;
}

async function syncProductsToGoogleMerchant(req) {
  const [rows] = await pool.query(
    `
    SELECT id, name, price, stock, barcode, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
    FROM products
    ORDER BY id ASC
    `
  );
  const products = rows.map(mapProductRow).filter((item) => String(item?.id ?? "").trim());
  const accessToken = await getGoogleMerchantAccessToken();
  const merchantProducts = await listAllGoogleMerchantProducts();
  const dbOfferIds = new Set(products.map((item) => String(item.id ?? "").trim()).filter(Boolean));
  const orphanOfferIds = merchantProducts
    .map((item) => String(item.offerId ?? "").trim())
    .filter((offerId) => offerId && !dbOfferIds.has(offerId));

  let success = 0;
  let failed = 0;
  let deleted = 0;
  const errors = [];

  if (orphanOfferIds.length > 0) {
    const deleteSummary = await batchDeleteGoogleMerchantProducts(accessToken, orphanOfferIds);
    deleted += deleteSummary.deleted;
    failed += deleteSummary.failed;
    errors.push(...deleteSummary.errors);
  }

  if (products.length === 0) {
    return { total: 0, success: 0, failed, deleted, errors };
  }

  const endpoint = "https://shoppingcontent.googleapis.com/content/v2.1/products/batch";
  const chunkSize = 100;

  for (let start = 0; start < products.length; start += chunkSize) {
    const chunk = products.slice(start, start + chunkSize);
    const deleteSummary = await batchDeleteGoogleMerchantProducts(
      accessToken,
      chunk.map((product) => product.id)
    );
    deleted += deleteSummary.deleted;
    failed += deleteSummary.failed;
    errors.push(...deleteSummary.errors);

    const entries = chunk.map((product, index) =>
      mapProductToGoogleMerchantEntry(req, product, start + index)
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entries }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Google Merchant API hatasi (${response.status}): ${JSON.stringify(data).slice(0, 500)}`
      );
    }

    const responseEntries = Array.isArray(data?.entries) ? data.entries : [];
    if (responseEntries.length === 0) {
      throw new Error(
        `Google Merchant API boş entry döndürdü. Yanıt: ${JSON.stringify(data).slice(0, 500)}`
      );
    }
    for (const entry of responseEntries) {
      if (entry?.errors?.errors?.length) {
        failed += 1;
        errors.push({
          offerId: entry?.product?.offerId ?? "",
          message: entry.errors.errors.map((item) => item.message).join(" | "),
        });
      } else {
        success += 1;
      }
    }
  }

  return {
    total: products.length,
    success,
    failed,
    deleted,
    errors,
  };
}

async function listGoogleMerchantProducts({ maxResults = 20, pageToken = "" } = {}) {
  const accessToken = await getGoogleMerchantAccessToken();
  const params = new URLSearchParams();
  params.set("maxResults", String(Math.max(1, Math.min(250, Number(maxResults) || 20))));
  if (String(pageToken ?? "").trim()) {
    params.set("pageToken", String(pageToken).trim());
  }

  const endpoint = `https://shoppingcontent.googleapis.com/content/v2.1/${encodeURIComponent(
    GOOGLE_MERCHANT_ACCOUNT_ID
  )}/products?${params.toString()}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Google Merchant ürün listeleme hatası (${response.status}): ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  const resources = Array.isArray(data?.resources) ? data.resources : [];
  return {
    totalResources: resources.length,
    nextPageToken: String(data?.nextPageToken ?? ""),
    products: resources.map((item) => ({
      id: String(item?.id ?? ""),
      offerId: String(item?.offerId ?? ""),
      title: String(item?.title ?? ""),
      channel: String(item?.channel ?? ""),
      targetCountry: String(item?.targetCountry ?? ""),
      contentLanguage: String(item?.contentLanguage ?? ""),
      availability: String(item?.availability ?? ""),
      destinationStatuses: Array.isArray(item?.destinationStatuses) ? item.destinationStatuses : [],
      issues: Array.isArray(item?.itemIssues) ? item.itemIssues : [],
    })),
  };
}

function toPublicUrl(baseUrl, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  if (/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${baseUrl}${value}`;
  return `${baseUrl}/${value.replace(/^\/+/, "")}`;
}

function appendUrlQueryParam(url, key, value) {
  const normalizedUrl = String(url ?? "").trim();
  const normalizedKey = String(key ?? "").trim();
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedUrl || !normalizedKey || !normalizedValue) {
    return normalizedUrl;
  }

  const hashIndex = normalizedUrl.indexOf("#");
  const base = hashIndex >= 0 ? normalizedUrl.slice(0, hashIndex) : normalizedUrl;
  const hash = hashIndex >= 0 ? normalizedUrl.slice(hashIndex) : "";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${encodeURIComponent(normalizedKey)}=${encodeURIComponent(
    normalizedValue
  )}${hash}`;
}

function isMerchantSafeDirectImageSource(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return false;
  if (!isLocalUploadPath(value)) return false;
  const extension = path.extname(value.split("?")[0]).toLowerCase();
  return new Set([".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".bmp", ".avif"]).has(extension);
}

function buildMerchantProductVersion(product) {
  const images = Array.isArray(product?.images)
    ? product.images.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  const seed = JSON.stringify({
    crawlVersion: GOOGLE_MERCHANT_CRAWL_VERSION,
    id: String(product?.id ?? "").trim(),
    name: String(product?.name ?? "").trim(),
    price: Number(product?.price ?? 0).toFixed(2),
    image: String(product?.image ?? "").trim(),
    images,
    category: String(product?.category ?? "").trim(),
    description: String(product?.description ?? "").trim(),
    isNew: Boolean(product?.isNew),
    isBestseller: Boolean(product?.isBestseller),
  });
  return sha256(seed).slice(0, 16);
}

function getWhatsappMessagesEndpoint() {
  const cleanUrl = WHATSAPP_API_URL.replace(/\/+$/, "");
  if (/\/messages$/i.test(cleanUrl)) return cleanUrl;
  if (!WHATSAPP_PHONE_NUMBER_ID) return "";
  return `${cleanUrl}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function sendWhatsappPayload(payload) {
  const endpoint = getWhatsappMessagesEndpoint();
  if (!endpoint) {
    throw new Error("WhatsApp endpoint is not configured.");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`WhatsApp API failed (${response.status}): ${bodyText.slice(0, 500)}`);
  }
  return bodyText;
}

function formatWhatsappOrderText({ order, deliveryAddress }) {
  const customerName = `${String(deliveryAddress?.firstName ?? "").trim()} ${String(
    deliveryAddress?.lastName ?? ""
  ).trim()}`.trim();
  const lines = [
    "Yeni sipariş oluşturuldu.",
    `Sipariş ID: ${String(order?.id ?? "-")}`,
    `Müşteri: ${customerName || "-"}`,
  ].filter(Boolean);

  return lines.join("\n");
}

async function sendOrderWhatsappNotification({ order, deliveryAddress }) {
  if (!isWhatsappConfigured || !order) return;
  for (const recipient of WHATSAPP_TO_NUMBERS) {
    const customerName = `${String(deliveryAddress?.firstName ?? "").trim()} ${String(
      deliveryAddress?.lastName ?? ""
    ).trim()}`.trim();
    const orderIdText = String(order?.id ?? "-").trim() || "-";
    const customerNameText = customerName || "-";

    const textPayload = {
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: {
        body: formatWhatsappOrderText({ order, deliveryAddress }),
      },
    };

    const templatePayload = {
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE_NAME,
        language: { code: WHATSAPP_TEMPLATE_LANG },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderIdText },
              { type: "text", text: customerNameText },
            ],
          },
        ],
      },
    };

    const primaryPayload = WHATSAPP_ORDER_PRIMARY_MODE === "text" ? textPayload : templatePayload;
    const secondaryPayload = WHATSAPP_ORDER_PRIMARY_MODE === "text" ? templatePayload : textPayload;
    const primaryLabel = WHATSAPP_ORDER_PRIMARY_MODE === "text" ? "text" : "template";
    const secondaryLabel = WHATSAPP_ORDER_PRIMARY_MODE === "text" ? "template" : "text";

    try {
      const responseText = await sendWhatsappPayload(primaryPayload);
      console.log(`Order WhatsApp ${primaryLabel} sent:`, {
        orderId: order?.id ?? "",
        to: recipient,
        response: responseText.slice(0, 300),
      });
      continue;
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      console.error(
        `WhatsApp ${primaryLabel} send failed, trying ${secondaryLabel} fallback:`,
        { orderId: order?.id ?? "", to: recipient, error: errorText }
      );
    }

    try {
      const responseText = await sendWhatsappPayload(secondaryPayload);
      console.log(`Order WhatsApp ${secondaryLabel} fallback sent:`, {
        orderId: order?.id ?? "",
        to: recipient,
        response: responseText.slice(0, 300),
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      console.error(`WhatsApp ${secondaryLabel} fallback failed:`, {
        orderId: order?.id ?? "",
        to: recipient,
        error: errorText,
      });
    }
  }
}

function normalizeMediaPath(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const normalizedUploadPath = normalizeLocalUploadWebPath(value, { apiPrefix: true });
  if (normalizedUploadPath) return normalizedUploadPath;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) return value;
  if (/^\/api\/products\/[^/]+\/image\/\d+(?:\?.*)?$/i.test(value)) return value;
  return "";
}

function normalizeLocalUploadWebPath(rawValue, { apiPrefix = true } = {}) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";

  const match = value.match(/^\/(?:api\/)?uploads\/(.+)$/i);
  if (!match) return "";

  const sanitizedRelativePath = String(match[1] ?? "")
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!sanitizedRelativePath) return "";

  const segments = sanitizedRelativePath.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return "";
  }

  const normalizedRelativePath = segments.join("/");
  const resolvedPath = path.resolve(uploadsDir, normalizedRelativePath);
  const relativeFromRoot = path.relative(uploadsDir, resolvedPath);
  if (!relativeFromRoot || relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    return "";
  }

  return `${apiPrefix ? "/api" : ""}/uploads/${normalizedRelativePath}`;
}

function isPrivateIpAddress(address) {
  const normalized = String(address ?? "").trim().toLowerCase();
  const ipVersion = net.isIP(normalized);
  if (!ipVersion) return false;

  const mappedIpv4Match = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedIpv4Match) {
    return isPrivateIpAddress(mappedIpv4Match[1]);
  }

  if (ipVersion === 4) {
    const octets = normalized.split(".").map((part) => Number(part));
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return true;
    }
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
  }

  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/i.test(normalized)) return true;
  return false;
}

function isObviouslyUnsafeRemoteHostname(hostname) {
  const normalized = String(hostname ?? "").trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) return true;
  if (isPrivateIpAddress(normalized)) return true;
  return false;
}

function isSafeRemoteMediaUrlCandidate(rawUrl) {
  const value = String(rawUrl ?? "").trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (parsed.username || parsed.password) return false;
    if (isObviouslyUnsafeRemoteHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function isSafeRemoteMediaUrl(rawUrl) {
  if (!isSafeRemoteMediaUrlCandidate(rawUrl)) {
    return false;
  }

  try {
    const parsed = new URL(String(rawUrl ?? "").trim());
    const results = await dnsPromises.lookup(parsed.hostname, { all: true, verbatim: true });
    if (!Array.isArray(results) || results.length === 0) {
      return false;
    }
    return results.every((entry) => !isPrivateIpAddress(entry?.address));
  } catch {
    return false;
  }
}

function sanitizeStoredProductMediaSource(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";

  const normalizedUploadPath = normalizeLocalUploadWebPath(value, { apiPrefix: false });
  if (normalizedUploadPath) return normalizedUploadPath;
  if (/^https?:\/\//i.test(value)) {
    return isSafeRemoteMediaUrlCandidate(value) ? value : "";
  }
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) return value;
  if (/^\/api\/products\/[^/]+\/image\/\d+(?:\?.*)?$/i.test(value)) return value;
  return "";
}

function normalizeProductMedia(product) {
  if (!product || typeof product !== "object") return product;
  const rawImages = Array.isArray(product.images) ? product.images : [];
  const normalizedImages = rawImages
    .map((image) => normalizeMediaPath(image))
    .filter(Boolean);
  const normalizedImage = normalizeMediaPath(product.image);
  const fallbackImage = normalizedImages[0] || normalizedImage;
  return {
    ...product,
    image: fallbackImage,
    images: normalizedImages.length > 0 ? normalizedImages : fallbackImage ? [fallbackImage] : [],
  };
}

function dataUrlToEmailAttachment(rawValue, cidBase) {
  const value = String(rawValue ?? "").trim();
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];
  const extensionMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/bmp": "bmp",
  };
  const extension = extensionMap[mimeType] ?? "img";
  const cid = `${cidBase}@stilbagsfashion`;

  try {
    return {
      src: `cid:${cid}`,
      attachment: {
        filename: `product-${cidBase}.${extension}`,
        content: Buffer.from(base64Payload, "base64"),
        cid,
        contentType: mimeType,
      },
    };
  } catch {
    return null;
  }
}

function buildDeliveryAddressText(deliveryAddress) {
  const rawStreet = String(deliveryAddress?.street ?? "").trim();
  const street = rawStreet.includes("|||")
    ? rawStreet
        .split("|||")
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(", ")
    : rawStreet;
  const neighborhood = String(deliveryAddress?.neighborhood ?? "").trim();
  const district = String(deliveryAddress?.district ?? "").trim();
  const province = String(deliveryAddress?.province ?? "").trim();

  const streetLower = street.toLocaleLowerCase("tr-TR");
  const includesNeighborhood = neighborhood
    ? streetLower.includes(neighborhood.toLocaleLowerCase("tr-TR"))
    : false;
  const includesDistrict = district
    ? streetLower.includes(district.toLocaleLowerCase("tr-TR"))
    : false;
  const includesProvince = province
    ? streetLower.includes(province.toLocaleLowerCase("tr-TR"))
    : false;

  const districtProvince =
    district && province ? `${district} / ${province}` : district || province;
  const parts = [
    street,
    !includesNeighborhood ? neighborhood : "",
    !includesDistrict && !includesProvince ? districtProvince : "",
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  const seen = new Set();
  const deduped = parts.filter((part) => {
    const key = part.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.join(", ");
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeJsonForHtmlScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function formatOrderDateForEmail(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    return value.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
  const hasTime = normalized.includes("T");
  const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  const candidate = hasTime && !hasExplicitTimezone ? `${normalized}Z` : normalized;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  if (!mailTransporter) {
    throw new Error("SMTP is not configured.");
  }

  const safeName = String(firstName ?? "").trim() || "M\u00fc\u015fterimiz";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2 style="margin:0 0 12px;">\u015eifre S\u0131f\u0131rlama</h2>
      <p>Merhaba ${safeName},</p>
      <p>Hesab\u0131n\u0131z i\u00e7in \u015fifre s\u0131f\u0131rlama talebi al\u0131nd\u0131.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;text-decoration:none;border-radius:999px;">
          \u015eifremi Yenile
        </a>
      </p>
      <p>Bu ba\u011flant\u0131 ${PASSWORD_RESET_TTL_MINUTES} dakika ge\u00e7erlidir.</p>
      <p>E\u011fer bu i\u015flemi siz yapmad\u0131ysan\u0131z bu e-postay\u0131 yok sayabilirsiniz.</p>
    </div>
  `;
  const text = [
    `Merhaba ${safeName},`,
    "Hesab\u0131n\u0131z i\u00e7in \u015fifre s\u0131f\u0131rlama talebi al\u0131nd\u0131.",
    `\u015eifre yenileme ba\u011flant\u0131s\u0131: ${resetUrl}`,
    `Bu ba\u011flant\u0131 ${PASSWORD_RESET_TTL_MINUTES} dakika ge\u00e7erlidir.`,
    "E\u011fer bu i\u015flemi siz yapmad\u0131ysan\u0131z bu e-postay\u0131 yok sayabilirsiniz.",
  ].join("\n");

  await mailTransporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to,
    subject: "\u015eifre Yenileme",
    text,
    html,
  });
}

async function sendEmailVerificationCodeEmail({ to, code }) {
  if (!mailTransporter) {
    throw new Error("SMTP is not configured.");
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2 style="margin:0 0 12px;">E-posta Do\u011frulamas\u0131</h2>
      <p>Hesab\u0131n\u0131z\u0131 tamamlamak i\u00e7in do\u011frulama kodunuz:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px;margin:12px 0;">${code}</p>
      <p>Bu kod 10 dakika ge\u00e7erlidir.</p>
    </div>
  `;
  const text = `E-posta do\u011frulama kodunuz: ${code}. Bu kod 10 dakika ge\u00e7erlidir.`;

  await mailTransporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to,
    subject: "E-posta Do\u011frulama Kodu",
    text,
    html,
  });
}

async function sendWelcomeEmail(req, { to, firstName }) {
  if (!welcomeMailTransporter || !welcomeMailFromEmail) {
    throw new Error("Welcome email transporter is not configured.");
  }

  const safeName = escapeHtml(String(firstName ?? "").trim() || "Müşterimiz");
  const baseUrl = buildWelcomeBaseUrl(req);
  const shopUrl = `${baseUrl}/shop/`;
  const accountUrl = `${baseUrl}/hesabim/`;
  const subject = WELCOME_EMAIL_SUBJECT || "Aramiza Hos Geldiniz";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.7;color:#111;background:#f7f7f7;padding:32px 16px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:36px 32px;">
        <div style="font-size:28px;font-weight:700;margin-bottom:8px;">StilBags&Fashion</div>
        <h2 style="margin:0 0 18px;font-size:32px;font-weight:600;">Aramıza Hoş Geldiniz</h2>
        <p>Merhaba ${safeName},</p>
        <p>Hesabınız başarıyla oluşturuldu. Yeni ürünlerimizi inceleyebilir, favorilerinizi kaydedebilir ve güvenle alışverişe başlayabilirsiniz.</p>
        <p style="margin:22px 0;">
          <a href="${shopUrl}" style="display:inline-block;padding:14px 24px;background:#111;color:#fff;text-decoration:none;border-radius:999px;">
            Alışverişe Başla
          </a>
        </p>
        <p style="margin:0 0 8px;"><strong>Hesabınızla neler yapabilirsiniz?</strong></p>
        <p style="margin:0;color:#444;">
          • Siparişlerinizi tek yerden takip edebilirsiniz.<br>
          • Favori ürünlerinizi daha sonra incelemek için kaydedebilirsiniz.<br>
          • Adres bilgilerinizi kaydedip ödeme sürecini hızlandırabilirsiniz.
        </p>
        <p style="margin-top:24px;">
          <a href="${accountUrl}" style="display:inline-block;padding:13px 22px;background:#f3f3f3;color:#111;text-decoration:none;border-radius:999px;border:1px solid #d9d9d9;">
            Hesabım
          </a>
        </p>
      </div>
    </div>
  `;
  const text = [
    `Merhaba ${String(firstName ?? "").trim() || "Müşterimiz"},`,
    "",
    "StilBags&Fashion hesabınız başarıyla oluşturuldu.",
    "Yeni ürünleri inceleyebilir, favorilerinizi kaydedebilir ve güvenle alışverişe başlayabilirsiniz.",
    "",
    `Alışverişe başla: ${shopUrl}`,
    `Hesabım: ${accountUrl}`,
  ].join("\n");

  await welcomeMailTransporter.sendMail({
    from: `"${welcomeMailFromName}" <${welcomeMailFromEmail}>`,
    to,
    subject,
    text,
    html,
  });
}

function queueWelcomeEmail(req, { to, firstName, source }) {
  if (!welcomeMailTransporter || !welcomeMailFromEmail) {
    return;
  }

  setImmediate(async () => {
    try {
      await sendWelcomeEmail(req, { to, firstName });
      console.log("Welcome email sent:", { to, source });
    } catch (error) {
      console.error("Welcome email send failed:", {
        to,
        source,
        error: error instanceof Error ? error.message : error,
      });
    }
  });
}

async function sendOrderConfirmationEmail(req, { to, firstName, order, deliveryAddress }) {
  if (!orderMailTransporter) {
    throw new Error("Order SMTP is not configured.");
  }

  const baseUrl = buildPublicBaseUrl(req);
  const safeFirstName = escapeHtml(firstName || "M\u00fc\u015fterimiz");
  const safeOrderId = escapeHtml(order?.id ?? "");
  const safeOrderDate = escapeHtml(formatOrderDateForEmail(order?.date ?? ""));
  const safeOrderTotal = Number(order?.total ?? 0).toLocaleString("tr-TR");
  const receiverName = `${deliveryAddress?.firstName ?? ""} ${deliveryAddress?.lastName ?? ""}`.trim();
  const safeReceiverName = escapeHtml(receiverName || `${firstName || "M\u00fc\u015fterimiz"}`);
  const safeAddressName = escapeHtml(String(deliveryAddress?.addressName ?? "").trim() || "-");
  const deliveryAddressText = buildDeliveryAddressText(deliveryAddress);
  const safeDeliveryAddress = escapeHtml(
    deliveryAddressText || "-"
  );
  const safeDeliveryPhone = escapeHtml(String(deliveryAddress?.phone ?? "").trim() || "-");
  const items = Array.isArray(order?.items) ? order.items : [];
  const mailAttachments = [];

  const productSubtotal = items.reduce((sum, item) => {
    const product = item?.product ?? {};
    const quantity = Number(item?.quantity ?? 1);
    const unitPrice = Number(product?.price ?? 0);
    return sum + unitPrice * quantity;
  }, 0);
  const resolvedSubtotal = Math.max(0, Number(order?.subtotal ?? productSubtotal));
  const productSubtotalText = resolvedSubtotal.toLocaleString("tr-TR");
  const mailGrandTotal = Number(order?.total ?? resolvedSubtotal);
  const safeGrandTotal = mailGrandTotal.toLocaleString("tr-TR");
  const discountAmount = Math.max(0, Number(order?.discountTotal ?? 0));
  const shippingAmountRaw = mailGrandTotal - resolvedSubtotal + discountAmount;
  const shippingAmount =
    order?.shippingTotal != null
      ? Math.max(0, Number(order.shippingTotal))
      : shippingAmountRaw > 0
        ? shippingAmountRaw
        : 79;
  const shippingAmountText = shippingAmount.toLocaleString("tr-TR");
  const discountAmountText = discountAmount.toLocaleString("tr-TR");

  const productCardsHtml = items
    .map((item, itemIndex) => {
      const product = item?.product ?? {};
      const productId = String(product?.id ?? "").trim();
      const productUrl = productId
        ? `${baseUrl}/?product=${encodeURIComponent(productId)}`
        : `${baseUrl}/urunler`;
      const productName = escapeHtml(String(product?.name ?? "Urun"));
      const quantity = Number(item?.quantity ?? 1);
      const unitPrice = Number(product?.price ?? 0);
      const totalPriceText = (unitPrice * quantity).toLocaleString("tr-TR");
      const color = escapeHtml(String(item?.color ?? "Siyah"));
      const imageList = Array.isArray(product?.images) ? product.images : [];
      const rawImage = String(imageList[0] ?? product?.image ?? "").trim();
      const dataAttachment = dataUrlToEmailAttachment(rawImage, `${safeOrderId || "order"}-${itemIndex}`);
      if (dataAttachment?.attachment) {
        mailAttachments.push(dataAttachment.attachment);
      }
      const image = dataAttachment?.src ?? toPublicUrl(baseUrl, rawImage);

      return `
<tr>
<td style="padding:0 40px 30px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;padding:25px;">
<tr>
<td width="130" valign="top">
${image ? `<img src="${escapeHtml(image)}" width="120" style="border-radius:10px;display:block;" alt="${productName}">` : `<div style="width:120px;height:120px;border-radius:10px;background:#ececec;display:block;"></div>`}
</td>
<td valign="top" style="padding-left:20px;">
<div style="font-size:22px;font-weight:600;margin-bottom:10px;"><a href="${escapeHtml(productUrl)}" style="color:inherit;text-decoration:none;">${productName}</a></div>
<div style="color:#666;font-size:16px;">Adet: ${quantity}</div>
<div style="color:#666;font-size:16px;">Renk: ${color}</div>
<div style="margin-top:6px;font-size:18px;font-weight:600;">Fiyat: ${totalPriceText} TL</div>
</td>
</tr>
</table>
</td>
</tr>
      `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>Siparişiniz Alındı</title>
</head>

<body style="margin:0;padding:0;background:#efefef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#222;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#efefef;padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">

<tr>
<td style="padding:40px 40px 10px;text-align:center;">
<div style="font-size:30px;font-weight:700;letter-spacing:0.5px;color:#111;">StilBags&Fashion</div>
<div style="font-size:36px;font-weight:600;color:#111;">Siparişiniz Alındı</div>
<div style="margin-top:8px;font-size:18px;color:#666;">Teşekkür ederiz!</div>
</td>
</tr>

<tr>
<td style="padding:10px 50px 25px;font-size:17px;line-height:1.7;color:#444;">
Merhaba ${safeFirstName},<br><br>
Siparişiniz başarıyla oluşturuldu.<br>
Siparişiniz hazırlanmaya başlanmıştır.
</td>
</tr>

<tr>
<td style="padding:0 40px 30px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;padding:25px;">
<tr>
<td colspan="2" style="font-size:22px;font-weight:600;padding-bottom:20px;">
Sipariş Bilgileri
</td>
</tr>

<tr>
<td width="50%" style="font-size:16px;line-height:2;color:#333;border-right:1px solid #e4e4e4;padding-right:25px;">
<b>Sipariş No:</b> ${safeOrderId}<br>
<b>Tarih:</b> ${safeOrderDate}<br>
<b>Ödeme:</b> Kredi Kartı
</td>

<td width="50%" style="font-size:16px;line-height:2;color:#333;padding-left:25px;">
<b>Teslimat Bilgileri</b><br>
${safeReceiverName}<br>
Telefon ${safeDeliveryPhone}<br>
${safeDeliveryAddress}
</td>
</tr>

</table>
</td>
</tr>

${productCardsHtml}

<tr>
<td style="padding:0 40px 30px;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;padding:25px;">
<tr>
<td>
<table width="100%" style="font-size:16px;color:#333;line-height:2.2;">
<tr>
<td>Ürün Toplamı:</td>
<td align="right">${productSubtotalText} TL</td>
</tr>
<tr>
<td>Kargo:</td>
<td align="right">${shippingAmountText} TL</td>
</tr>
${discountAmount > 0 ? `
<tr>
<td>Kupon İndirimi${order?.couponCode ? ` (${escapeHtml(String(order.couponCode))})` : ""}:</td>
<td align="right" style="color:#0f766e;">-${discountAmountText} TL</td>
</tr>
` : ""}
<tr>
<td style="font-size:20px;font-weight:600;padding-top:6px;">TOPLAM:</td>
<td align="right" style="font-size:20px;font-weight:600;padding-top:6px;">${safeGrandTotal} TL</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td align="center" style="padding:10px 40px 30px;">
<a href="${escapeHtml(`${baseUrl}/hesabim`)}" style="background:#111;color:#fff;text-decoration:none;padding:16px 45px;border-radius:35px;font-size:16px;font-weight:500;display:inline-block;">
Siparişimi Görüntüle
</a>
</td>
</tr>

<tr>
<td style="padding:10px 40px 40px;text-align:center;font-size:14px;color:#777;">
Siparişiniz kargoya verildiğinde size bilgilendirme e-postası gönderilecektir.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
  `;
  const textItems = items
    .map((item) => {
      const product = item?.product ?? {};
      const productName = String(product?.name ?? "Urun");
      const quantity = Number(item?.quantity ?? 1);
      const unitPrice = Number(product?.price ?? 0);
      const totalPrice = (unitPrice * quantity).toLocaleString("tr-TR");
      const productId = String(product?.id ?? "").trim();
      const productUrl = productId
        ? `${baseUrl}/?product=${encodeURIComponent(productId)}`
        : baseUrl;
      return `- ${productName} x${quantity} (${totalPrice} TL) ${productUrl}`;
    })
    .join("\n");
  const text = [
    `Merhaba ${firstName || "M\u00fc\u015fterimiz"},`,
    "Sipari\u015finiz ba\u015far\u0131yla olu\u015fturuldu.",
    `Sipari\u015f No: ${order?.id ?? ""}`,
    `Tarih: ${formatOrderDateForEmail(order?.date ?? "")}`,
    `Teslim Alacak Ki\u015fi: ${receiverName || firstName || "M\u00fc\u015fterimiz"}`,
    `Telefon: ${String(deliveryAddress?.phone ?? "").trim() || "-"}`,
    `Adres Başlığı: ${String(deliveryAddress?.addressName ?? "").trim() || "-"}`,
    `Teslimat Adresi: ${deliveryAddressText || "-"}`,
    "",
    "\u00dcr\u00fcnler:",
    textItems,
    "",
    `Toplam: ${safeOrderTotal} TL`,
  ].join("\n");

  await orderMailTransporter.sendMail({
    from: `"${ORDER_SMTP_FROM_NAME}" <${ORDER_SMTP_FROM_EMAIL}>`,
    to,
    subject: `Sipari\u015finiz Al\u0131nd\u0131 - #${order?.id ?? ""}`,
    text,
    html,
    attachments: mailAttachments,
  });
}

async function sendAbandonedCartEmail(req, { to, firstName, cartItems, settings }) {
  if (!abandonedCartMailTransporter) {
    throw new Error("Abandoned cart mail transporter is not configured.");
  }

  const safeSettings = sanitizeAbandonedCartSettings(settings);
  const safeFirstName = escapeHtml(String(firstName ?? "").trim() || "Müşterimiz");
  const baseUrl = buildPublicBaseUrl(req);
  const subject = String(safeSettings.subject ?? DEFAULT_ABANDONED_CART_SETTINGS.subject).trim();
  const heading = escapeHtml(String(safeSettings.heading ?? DEFAULT_ABANDONED_CART_SETTINGS.heading).trim());
  const body = escapeHtml(String(safeSettings.body ?? DEFAULT_ABANDONED_CART_SETTINGS.body).trim());
  const ctaLabel = escapeHtml(String(safeSettings.ctaLabel ?? DEFAULT_ABANDONED_CART_SETTINGS.ctaLabel).trim());
  const items = Array.isArray(cartItems) ? cartItems : [];
  const mailAttachments = [];
  const subtotalAmount = getCartSubtotal(items);
  const shippingAmount = getCartShippingAmount(subtotalAmount);
  const configuredCoupon = getConfiguredAbandonedCartCoupon(safeSettings);
  const couponSummary =
    configuredCoupon && configuredCoupon.code
      ? resolveAbandonedCartCoupon({
          code: configuredCoupon.code,
          cartItems: items,
          settings: safeSettings,
        })
      : null;
  const discountAmount = couponSummary?.valid ? couponSummary.discountAmount : 0;
  const totalAmount = Math.max(0, subtotalAmount + shippingAmount - discountAmount);
  const cartRedirectPath = couponSummary?.valid
    ? `/sepet?kupon=${encodeURIComponent(couponSummary.code)}`
    : "/sepet";
  const loginUrl = `${baseUrl}/giris?redirect=${encodeURIComponent(cartRedirectPath)}`;
  const couponValueLabel =
    couponSummary?.valid
      ? couponSummary.type === "fixed"
        ? `${Number(couponSummary.value).toLocaleString("tr-TR")} TL`
        : `%${Number(couponSummary.value).toLocaleString("tr-TR")}`
      : "";
  const couponHtml = couponSummary?.valid
    ? `
          <tr>
            <td style="padding:0 40px 25px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;padding:22px;">
                <tr>
                  <td style="color:#fff;">
                    <div style="font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:#d6c4a4;">Size özel indirim kodu</div>
                    <div style="margin-top:10px;font-size:28px;font-weight:700;letter-spacing:2px;">${escapeHtml(couponSummary.code)}</div>
                    <div style="margin-top:10px;font-size:15px;color:#f1f1f1;">
                      ${escapeHtml(couponSummary.description || "Sepetinize özel indirim kodunuz hazır.")}
                    </div>
                    <div style="margin-top:8px;font-size:14px;color:#d8d8d8;">
                      İndirim: ${escapeHtml(couponValueLabel)} · Minimum sepet: ${couponSummary.minimumSubtotal.toLocaleString("tr-TR")} TL
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
      `
    : "";

  const productCardsHtml = items
    .map((item, index) => {
      const product = item?.product ?? {};
      const productId = String(product?.id ?? "").trim();
      const productName = escapeHtml(String(product?.name ?? "Ürün"));
      const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);
      const unitPrice = Number(product?.price ?? 0);
      const totalPriceText = (unitPrice * quantity).toLocaleString("tr-TR");
      const productUrl = productId ? `${baseUrl}/product/${encodeURIComponent(productId)}/` : loginUrl;
      const rawImage = String(
        Array.isArray(product?.images) && product.images.length > 0 ? product.images[0] : product?.image ?? ""
      ).trim();
      const dataAttachment = dataUrlToEmailAttachment(rawImage, `abandoned-cart-${Date.now()}-${index}`);
      if (dataAttachment?.attachment) {
        mailAttachments.push(dataAttachment.attachment);
      }
      const image = dataAttachment?.src ?? toPublicUrl(baseUrl, rawImage);

      return `
        <tr>
          <td style="padding:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;padding:20px;">
              <tr>
                <td width="110" valign="top">
                  ${image ? `<img src="${escapeHtml(image)}" width="96" style="border-radius:10px;display:block;" alt="${productName}">` : `<div style="width:96px;height:96px;border-radius:10px;background:#ececec;"></div>`}
                </td>
                <td valign="top" style="padding-left:18px;">
                  <div style="font-size:18px;font-weight:600;margin-bottom:8px;">
                    <a href="${escapeHtml(productUrl)}" style="color:#111;text-decoration:none;">${productName}</a>
                  </div>
                  <div style="color:#666;font-size:15px;">Adet: ${quantity}</div>
                  <div style="margin-top:6px;font-size:16px;font-weight:600;">${totalPriceText} TL</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#efefef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#efefef;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 10px;text-align:center;">
              <div style="font-size:30px;font-weight:700;letter-spacing:0.5px;color:#111;">StilBags&Fashion</div>
              <div style="margin-top:14px;font-size:32px;font-weight:600;color:#111;">${heading}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 50px 20px;font-size:16px;line-height:1.8;color:#444;">
              Merhaba ${safeFirstName},<br><br>
              ${body}
            </td>
          </tr>
          ${couponHtml}
          <tr>
            <td style="padding:0 40px 10px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${productCardsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 25px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;padding:20px;">
                <tr>
                  <td style="font-size:16px;color:#333;">Ara Toplam</td>
                  <td align="right" style="font-size:16px;font-weight:600;color:#111;">${subtotalAmount.toLocaleString("tr-TR")} TL</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:16px;color:#333;">Kargo</td>
                  <td align="right" style="padding-top:8px;font-size:16px;font-weight:600;color:#111;">${shippingAmount === 0 ? "Ücretsiz" : `${shippingAmount.toLocaleString("tr-TR")} TL`}</td>
                </tr>
                ${
                  discountAmount > 0
                    ? `
                <tr>
                  <td style="padding-top:8px;font-size:16px;color:#333;">Kupon İndirimi</td>
                  <td align="right" style="padding-top:8px;font-size:16px;font-weight:600;color:#0f766e;">-${discountAmount.toLocaleString("tr-TR")} TL</td>
                </tr>
                `
                    : ""
                }
                <tr>
                  <td style="padding-top:10px;font-size:18px;color:#333;">Toplam</td>
                  <td align="right" style="padding-top:10px;font-size:18px;font-weight:700;color:#111;">${totalAmount.toLocaleString("tr-TR")} TL</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 40px 35px;">
              <a href="${escapeHtml(loginUrl)}" style="background:#111;color:#fff;text-decoration:none;padding:16px 42px;border-radius:35px;font-size:16px;font-weight:500;display:inline-block;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;text-align:center;font-size:14px;color:#777;">
              Sepetinizdeki ürünler hesabınızda saklanır. Giriş yaptıktan sonra kaldığınız yerden devam edebilirsiniz.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textItems = items
    .map((item) => {
      const product = item?.product ?? {};
      const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);
      const price = Number(product?.price ?? 0);
      return `- ${String(product?.name ?? "Ürün")} x${quantity} (${(price * quantity).toLocaleString("tr-TR")} TL)`;
    })
    .join("\n");
  const text = [
    `Merhaba ${String(firstName ?? "").trim() || "Müşterimiz"},`,
    String(safeSettings.body ?? DEFAULT_ABANDONED_CART_SETTINGS.body).trim(),
    "",
    ...(couponSummary?.valid
      ? [
          `İndirim kodunuz: ${couponSummary.code}`,
          `Kupon avantajı: ${couponValueLabel} indirim`,
          `Minimum sepet tutarı: ${couponSummary.minimumSubtotal.toLocaleString("tr-TR")} TL`,
          "",
        ]
      : []),
    "Sepetinizde kalan ürünler:",
    textItems,
    "",
    `Ara toplam: ${subtotalAmount.toLocaleString("tr-TR")} TL`,
    `Kargo: ${shippingAmount === 0 ? "Ücretsiz" : `${shippingAmount.toLocaleString("tr-TR")} TL`}`,
    ...(discountAmount > 0 ? [`Kupon indirimi: -${discountAmount.toLocaleString("tr-TR")} TL`] : []),
    `Toplam: ${totalAmount.toLocaleString("tr-TR")} TL`,
    `Sepete dön: ${loginUrl}`,
  ].join("\n");

  await abandonedCartMailTransporter.sendMail({
    from: `"${abandonedCartMailFromName}" <${abandonedCartMailFromEmail}>`,
    to,
    subject,
    text,
    html,
    attachments: mailAttachments,
  });
}

async function runAbandonedCartCampaign({ req = null, force = false } = {}) {
  const settings = await getAbandonedCartSettings();
  if (!settings.enabled && !force) {
    return {
      enabled: false,
      scanned: 0,
      eligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      message: "Sepeti terk etme kampanyası kapalı.",
    };
  }

  if (!abandonedCartMailTransporter) {
    return {
      enabled: settings.enabled,
      scanned: 0,
      eligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      message: "SMTP ayarı eksik olduğu için kampanya çalıştırılamadı.",
    };
  }

  const [rows] = await pool.query(
    `
    SELECT
      c.user_id,
      u.email,
      u.first_name,
      MAX(c.updated_at) AS cart_updated_at
    FROM user_cart_items c
    JOIN users u ON u.id = c.user_id
    WHERE COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
    GROUP BY c.user_id, u.email, u.first_name
    HAVING MAX(c.updated_at) <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    ORDER BY MAX(c.updated_at) ASC
    `,
    [settings.delayMinutes]
  );

  const summary = {
    enabled: settings.enabled,
    scanned: rows.length,
    eligible: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    message: "",
  };

  for (const row of rows) {
    const userId = String(row.user_id ?? "").trim();
    const email = String(row.email ?? "").trim().toLowerCase();
    if (!userId || !email) {
      summary.skipped += 1;
      continue;
    }

    const cartItems = await getUserCartItems(userId);
    if (cartItems.length === 0) {
      summary.skipped += 1;
      continue;
    }

    const cartSignature = buildAbandonedCartSignature(cartItems);
    if (!cartSignature) {
      summary.skipped += 1;
      continue;
    }

    if (await hasSentAbandonedCartEmail(userId, cartSignature)) {
      summary.skipped += 1;
      continue;
    }

    summary.eligible += 1;

    try {
      const requestLike = req ?? {
        protocol: "https",
        get: (headerName) => {
          if (String(headerName).toLowerCase() === "host") {
            return String(ORDER_EMAIL_BASE_URL ?? "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
          }
          return "";
        },
      };
      await sendAbandonedCartEmail(requestLike, {
        to: email,
        firstName: row.first_name,
        cartItems,
        settings,
      });
      await recordAbandonedCartEmailAttempt({
        userId,
        email,
        cartSignature,
        cartUpdatedAt: row.cart_updated_at,
        cartItems,
        status: "sent",
      });
      summary.sent += 1;
    } catch (error) {
      await recordAbandonedCartEmailAttempt({
        userId,
        email,
        cartSignature,
        cartUpdatedAt: row.cart_updated_at,
        cartItems,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      summary.failed += 1;
      console.error("Abandoned cart email send failed:", {
        userId,
        email,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  summary.message = `Tarama tamamlandı. Uygun: ${summary.eligible}, Gönderilen: ${summary.sent}, Atlanan: ${summary.skipped}, Hatalı: ${summary.failed}`;
  return summary;
}

async function scheduleAbandonedCartCampaignScan() {
  if (abandonedCartScanInFlight) {
    return abandonedCartScanInFlight;
  }

  abandonedCartScanInFlight = (async () => {
    try {
      await ensureMarketingAbandonedCartEmailsTable();
      await getAbandonedCartSettings();
      await runAbandonedCartCampaign();
    } catch (error) {
      console.error("Abandoned cart scan failed:", error instanceof Error ? error.message : error);
    } finally {
      abandonedCartScanInFlight = null;
      if (abandonedCartScanTimeout != null) {
        clearTimeout(abandonedCartScanTimeout);
      }
      abandonedCartScanTimeout = setTimeout(() => {
        void scheduleAbandonedCartCampaignScan();
      }, ABANDONED_CART_SCAN_INTERVAL_MS);
    }
  })();

  return abandonedCartScanInFlight;
}

function mapProductRow(row) {
  let images = [];
  try {
    images = JSON.parse(row.images_json ?? "[]");
    if (!Array.isArray(images)) images = [];
  } catch {
    images = [];
  }
  if (images.length === 0 && row.image) {
    images = [row.image];
  }
  const normalizedImages = images
    .map((image, index) => buildResolvedProductImagePath(row.id, image, index))
    .filter(Boolean);
  const normalizedSingleImage = buildResolvedProductImagePath(row.id, row.image, 0);
  const resolvedImages = normalizedImages.length > 0 ? normalizedImages : normalizedSingleImage ? [normalizedSingleImage] : [];
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    stock: row.stock == null ? null : Number(row.stock),
    barcode: row.barcode == null ? null : String(row.barcode),
    image: resolvedImages[0] ?? buildProductImageProxyPath(row.id, 0),
    images: resolvedImages,
    category: row.category_id,
    description: row.description,
    features: parseArrayJson(row.features_json),
    colors: parseArrayJson(row.colors_json),
    tags: parseArrayJson(row.tags_json),
    isNew: Boolean(row.is_new),
    isBestseller: Boolean(row.is_bestseller),
  };
}

function parseArrayJson(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildProductImageProxyPath(productId, imageIndex = 0) {
  return `/api/products/${encodeURIComponent(String(productId))}/image/${Math.max(0, Number(imageIndex) || 0)}`;
}

function toDisplayImagePath(rawValue) {
  const normalized = normalizeMediaPath(rawValue);
  if (!normalized) return "";
  if (normalized.startsWith("/api/uploads/")) {
    return normalized;
  }
  if (normalized.startsWith("/uploads/")) {
    return normalized.replace(/^\/uploads\//i, "/api/uploads/");
  }
  return normalized;
}

function buildResolvedProductImagePath(productId, rawValue, imageIndex = 0, variantKey = "original") {
  const normalized = toDisplayImagePath(rawValue);
  if (normalized) {
    if (variantKey === "original" || !isLocalUploadPath(normalized)) {
      return normalized;
    }
    const variantWebPath = getLocalUploadVariantWebPath(normalized, variantKey);
    if (variantWebPath && localUploadExists(variantWebPath)) {
      return variantWebPath;
    }
    return `${buildProductImageProxyPath(productId, imageIndex)}?variant=${encodeURIComponent(variantKey)}`;
  }
  const fallbackPath = buildProductImageProxyPath(productId, imageIndex);
  return variantKey === "original" ? fallbackPath : `${fallbackPath}?variant=${encodeURIComponent(variantKey)}`;
}

function mapProductListRow(row) {
  const cover = buildResolvedProductImagePath(row.id, row.image, 0, "card");
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    stock: row.stock == null ? null : Number(row.stock),
    barcode: row.barcode == null ? null : String(row.barcode),
    image: cover,
    images: [cover],
    category: row.category_id,
    description: String(row.description ?? ""),
    features: [],
    colors: parseArrayJson(row.colors_json).map((item) => String(item ?? "")).filter(Boolean),
    tags: parseArrayJson(row.tags_json).map((item) => String(item ?? "")).filter(Boolean),
    isNew: Boolean(row.is_new),
    isBestseller: Boolean(row.is_bestseller),
  };
}

function mapAdminProductListRow(row) {
  const proxyImage = buildResolvedProductImagePath(row.id, row.image, 0, "thumb");
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    stock: row.stock == null ? null : Number(row.stock),
    barcode: row.barcode == null ? null : String(row.barcode),
    image: proxyImage,
    images: [proxyImage],
    category: row.category_id,
    description: "",
    features: [],
    colors: [],
    tags: [],
    isNew: Boolean(row.is_new),
    isBestseller: Boolean(row.is_bestseller),
  };
}

function parseProductImageSources(row) {
  const parsed = parseArrayJson(row.images_json)
    .map((item) => normalizeMediaPath(item))
    .filter(Boolean);
  const cover = normalizeMediaPath(row.image);
  if (parsed.length > 0) return parsed;
  return cover ? [cover] : [];
}

function isLocalUploadPath(value) {
  return Boolean(normalizeLocalUploadWebPath(value, { apiPrefix: true }));
}

function localUploadExists(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return false;
  if (!isLocalUploadPath(normalized)) return true;
  const fileInfo = resolveLocalUploadFileInfo(normalized);
  if (!fileInfo) return false;
  return fs.existsSync(fileInfo.filePath);
}

function resolveLocalUploadFileInfo(value) {
  const normalized = normalizeLocalUploadWebPath(value, { apiPrefix: true });
  if (!normalized) return null;
  const relativePath = normalized.replace(/^\/api\/uploads\//, "");
  return {
    webPath: normalized,
    relativePath,
    filePath: path.resolve(uploadsDir, relativePath),
  };
}

function buildLocalUploadVariantRelativePath(rawValue, variantKey) {
  const fileInfo = resolveLocalUploadFileInfo(rawValue);
  const variantSpec = IMAGE_VARIANT_SPECS[variantKey];
  if (!fileInfo || !variantSpec) return "";
  const parsedPath = path.parse(fileInfo.relativePath);
  const normalizedDir = String(parsedPath.dir ?? "").replace(/\\/g, "/");
  const filename = `${parsedPath.name}__${variantKey}.webp`;
  return [normalizedDir, filename].filter(Boolean).join("/");
}

function getLocalUploadVariantWebPath(rawValue, variantKey) {
  const relativeVariantPath = buildLocalUploadVariantRelativePath(rawValue, variantKey);
  return relativeVariantPath ? `/api/uploads/variants/${relativeVariantPath}` : "";
}

async function ensureLocalUploadVariant(rawValue, variantKey) {
  const fileInfo = resolveLocalUploadFileInfo(rawValue);
  const variantSpec = IMAGE_VARIANT_SPECS[variantKey];
  if (!fileInfo || !variantSpec || !fs.existsSync(fileInfo.filePath)) {
    return "";
  }

  const relativeVariantPath = buildLocalUploadVariantRelativePath(rawValue, variantKey);
  if (!relativeVariantPath) {
    return "";
  }

  const targetPath = path.join(uploadVariantsDir, relativeVariantPath);
  if (!fs.existsSync(targetPath)) {
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await sharp(fileInfo.filePath, { animated: false })
      .rotate()
      .resize({
        width: variantSpec.width,
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: variantSpec.quality })
      .toFile(targetPath);
  }

  return `/api/uploads/variants/${relativeVariantPath.replace(/\\/g, "/")}`;
}

async function reencodeImageBufferToJpeg(buffer) {
  return sharp(buffer, { animated: false })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

async function normalizeUploadedImageFile(file) {
  const originalPath = String(file?.path ?? "").trim();
  if (!originalPath || !fs.existsSync(originalPath)) {
    throw new Error("UPLOAD_FILE_MISSING");
  }

  const parsedPath = path.parse(originalPath);
  const normalizedFilename = `${parsedPath.name}.jpg`;
  const normalizedPath = path.join(parsedPath.dir, normalizedFilename);

  const normalizedBuffer = await sharp(originalPath, { animated: false })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  await fs.promises.writeFile(normalizedPath, normalizedBuffer);
  if (normalizedPath !== originalPath && fs.existsSync(originalPath)) {
    await fs.promises.unlink(originalPath).catch(() => {});
  }

  await Promise.all(
    Object.keys(IMAGE_VARIANT_SPECS).map((variantKey) =>
      ensureLocalUploadVariant(`/uploads/${normalizedFilename}`, variantKey).catch(() => "")
    )
  );

  return {
    ...file,
    filename: normalizedFilename,
    path: normalizedPath,
    mimetype: "image/jpeg",
    size: normalizedBuffer.length,
  };
}

async function cleanupUploadedFiles(files) {
  const uploadList = Array.isArray(files) ? files : [];
  await Promise.all(
    uploadList.map(async (file) => {
      const filePath = String(file?.path ?? "").trim();
      if (!filePath) return;
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // ignore cleanup failures
      }
    })
  );
}

function resolveAdminImageSource(inputValue, productId, existingSources) {
  const value = String(inputValue ?? "").trim();
  if (!value) return "";
  const proxyMatch = value.match(/^\/api\/products\/([^/]+)\/image\/(\d+)$/i);
  if (!proxyMatch) return value;

  const matchedProductId = decodeURIComponent(proxyMatch[1]);
  if (matchedProductId !== String(productId)) return value;

  const index = Number(proxyMatch[2]);
  if (!Number.isFinite(index) || index < 0) {
    return existingSources[0] ?? "";
  }
  return existingSources[index] ?? existingSources[0] ?? "";
}

function sendImageSourceResponse(res, source) {
  const normalized = String(source ?? "").trim();
  if (!normalized) {
    return res.status(404).json({ message: "Image not found." });
  }

  const dataMatch = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    const mimeType = dataMatch[1];
    const payload = dataMatch[2];
    try {
      const buffer = Buffer.from(payload, "base64");
      res.setHeader("Content-Type", mimeType);
      // Product image proxy URLs are stable (/api/products/:id/image/:index) while source can change.
      // Avoid long immutable caching so updated images appear immediately after admin edits.
      res.setHeader("Cache-Control", "no-store");
      return res.send(buffer);
    } catch {
      return res.status(400).json({ message: "Invalid image payload." });
    }
  }

  if (/^https?:\/\//i.test(normalized)) {
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, normalized);
  }

  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, normalized.startsWith("/") ? normalized : `/${normalized}`);
}

function sendImageSourceDirect(res, source) {
  const normalized = String(source ?? "").trim();
  if (!normalized) {
    return res.status(404).json({ message: "Image not found." });
  }

  const dataMatch = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    const mimeType = dataMatch[1];
    const payload = dataMatch[2];
    try {
      const buffer = Buffer.from(payload, "base64");
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buffer);
    } catch {
      return res.status(400).json({ message: "Invalid image payload." });
    }
  }

  if (isLocalUploadPath(normalized)) {
    const relativePath = normalized
      .replace(/^\/api\/uploads\//, "")
      .replace(/^\/uploads\//, "")
      .replace(/^\/+/, "");
    const filePath = path.join(uploadsDir, relativePath);
    if (relativePath && fs.existsSync(filePath)) {
      const extension = path.extname(filePath).toLowerCase();
      const mimeByExt = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".jfif": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".avif": "image/avif",
        ".bmp": "image/bmp",
      };
      const contentType = mimeByExt[extension];
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(filePath);
    }
  }

  if (/^https?:\/\//i.test(normalized)) {
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, normalized);
  }

  return sendImageSourceResponse(res, normalized);
}

async function sendImageSourceAsMerchantJpeg(res, source) {
  const normalized = String(source ?? "").trim();
  if (!normalized) {
    return res.status(404).json({ message: "Image not found." });
  }

  try {
    let inputBuffer = null;
    let inputPath = "";

    const dataMatch = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataMatch) {
      inputBuffer = Buffer.from(dataMatch[2], "base64");
    } else if (isLocalUploadPath(normalized)) {
      const fileInfo = resolveLocalUploadFileInfo(normalized);
      if (!fileInfo || !fs.existsSync(fileInfo.filePath)) {
        return res.status(404).json({ message: "Image not found." });
      }
      inputPath = fileInfo.filePath;
    } else if (/^https?:\/\//i.test(normalized)) {
      let currentUrl = normalized;
      let redirectCount = 0;
      let response = null;

      for (;;) {
        if (!(await isSafeRemoteMediaUrl(currentUrl))) {
          return res.status(404).json({ message: "Image not found." });
        }
        response = await fetch(currentUrl, { redirect: "manual" });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirectCount >= 3) {
            return res.status(404).json({ message: "Image not found." });
          }
          const location = response.headers.get("location");
          if (!location) {
            return res.status(404).json({ message: "Image not found." });
          }
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount += 1;
          continue;
        }
        break;
      }

      if (!response?.ok) {
        return res.status(404).json({ message: "Image not found." });
      }

      const arrayBuffer = await response.arrayBuffer();
      inputBuffer = Buffer.from(arrayBuffer);
    } else {
      const forwarded = normalized.startsWith("/") ? normalized : `/${normalized}`;
      return res.redirect(302, forwarded);
    }

    const outputBuffer = inputPath
      ? await sharp(inputPath, { animated: false })
          .rotate()
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer()
      : await reencodeImageBufferToJpeg(inputBuffer);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Disposition", "inline");
    return res.send(outputBuffer);
  } catch (error) {
    console.error("Merchant image normalization failed:", {
      source: normalized,
      message: error?.message ?? String(error),
    });
    return sendImageSourceResponse(res, normalized);
  }
}

function mapAddressRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone ?? "",
    street: row.street,
    province: row.province,
    district: row.district ?? "",
    neighborhood: row.neighborhood ?? "",
    isDefault: Boolean(row.is_default),
  };
}

function mapUserRow(row, addresses = []) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? "",
    gender: row.gender ?? "",
    addresses,
  };
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string") return null;
  const match = authHeader.match(/^Bearer ([a-f0-9]{96})$/i);
  return match ? match[1] : null;
}

function logAuthorizationScopeMismatch(req, expectedScope, detectedScope) {
  console.warn("Authorization scope mismatch:", {
    expectedScope,
    detectedScope,
    method: req.method,
    path: req.originalUrl,
    ip: getClientIp(req),
    userAgent: String(req.get("user-agent") || ""),
  });
}

function getUserSessionTtlMs(rememberMe = false) {
  return rememberMe ? REMEMBER_SESSION_TTL_MS : SESSION_TTL_MS;
}

async function createSession(userId, { rememberMe = true } = {}) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + getUserSessionTtlMs(rememberMe));
  await pool.query(
    `
    INSERT INTO user_sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
    `,
    [token, userId, expiresAt]
  );
  return token;
}

async function getUserAddresses(userId) {
  const [rows] = await pool.query(
    `
    SELECT id, first_name, last_name, phone, street, province, district, neighborhood, is_default
    FROM user_addresses
    WHERE user_id = ?
    ORDER BY is_default DESC, created_at DESC
    `,
    [userId]
  );
  return rows.map(mapAddressRow);
}

function mapCartRow(row) {
  return {
    product: mapProductRow(row),
    quantity: Number(row.quantity),
    color: row.color ?? undefined,
  };
}

async function getUserCartItems(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      c.quantity,
      c.color,
      p.id,
      p.name,
      p.price,
      p.image,
      p.images_json,
      p.category_id,
      p.description,
      p.features_json,
      p.colors_json,
      p.tags_json,
      p.is_new,
      p.is_bestseller
    FROM user_cart_items c
    JOIN products p ON p.id = c.product_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
    `,
    [userId]
  );

  return rows.map(mapCartRow);
}

function sanitizeCouponRequestItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      productId: String(item?.productId ?? item?.id ?? item?.product?.id ?? "").trim(),
      quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),
      color: String(item?.color ?? "").trim(),
    }))
    .filter((item) => item.productId);
}

async function getCouponRequestCartItems(items) {
  const normalizedItems = sanitizeCouponRequestItems(items);
  if (normalizedItems.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(normalizedItems.map((item) => item.productId)));
  const placeholders = productIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.price,
      p.image,
      p.images_json,
      p.category_id,
      p.description,
      p.features_json,
      p.colors_json,
      p.tags_json,
      p.is_new,
      p.is_bestseller
    FROM products p
    WHERE p.id IN (${placeholders})
    `,
    productIds
  );

  const productsById = new Map(rows.map((row) => [String(row.id ?? "").trim(), mapProductRow(row)]));

  return normalizedItems
    .map((item) => {
      const product = productsById.get(item.productId);
      if (!product) return null;
      return {
        product,
        quantity: item.quantity,
        color: item.color || undefined,
      };
    })
    .filter(Boolean);
}

async function resolveAnyCoupon({ code, cartItems, userId = "" }) {
  const normalizedCode = normalizeCustomerCouponCode(code);
  if (!normalizedCode) {
    return null;
  }

  const [customerCoupon, abandonedCartSettings] = await Promise.all([
    resolveCustomerCoupon({
      code: normalizedCode,
      cartItems,
      userId,
    }),
    getAbandonedCartSettings(),
  ]);
  if (customerCoupon) {
    return customerCoupon;
  }

  return resolveAbandonedCartCoupon({
    code: normalizedCode,
    cartItems,
    settings: abandonedCartSettings,
  });
}

function buildAbandonedCartSignature(items) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      productId: String(item?.product?.id ?? "").trim(),
      quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),
      color: String(item?.color ?? "").trim().toLowerCase(),
    }))
    .filter((item) => item.productId)
    .sort((a, b) => {
      const idCompare = a.productId.localeCompare(b.productId);
      if (idCompare !== 0) return idCompare;
      const colorCompare = a.color.localeCompare(b.color);
      if (colorCompare !== 0) return colorCompare;
      return a.quantity - b.quantity;
    });

  return sha256(JSON.stringify(normalizedItems));
}

function buildCartIntegritySignature(items) {
  return buildAbandonedCartSignature(items);
}

function buildShippingIntegritySignature(shippingInput = {}) {
  const normalized = {
    addressName: String(shippingInput?.addressName ?? "").trim().toLocaleLowerCase("tr-TR"),
    firstName: String(shippingInput?.firstName ?? "").trim().toLocaleLowerCase("tr-TR"),
    lastName: String(shippingInput?.lastName ?? "").trim().toLocaleLowerCase("tr-TR"),
    phone: String(shippingInput?.phone ?? "").trim(),
    street: String(shippingInput?.street ?? "").trim().toLocaleLowerCase("tr-TR"),
    province: String(shippingInput?.province ?? "").trim().toLocaleLowerCase("tr-TR"),
    district: String(shippingInput?.district ?? "").trim().toLocaleLowerCase("tr-TR"),
    neighborhood: String(shippingInput?.neighborhood ?? "").trim().toLocaleLowerCase("tr-TR"),
  };
  return sha256(JSON.stringify(normalized));
}

function serializeAbandonedCartSnapshot(items) {
  const snapshot = (Array.isArray(items) ? items : []).map((item) => ({
    product: normalizeProductMedia(item?.product ?? {}),
    quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),
    color: String(item?.color ?? "").trim(),
  }));
  return JSON.stringify(snapshot);
}

function getCartSubtotal(items) {
  return Math.max(
    0,
    Math.round(
      (Array.isArray(items) ? items : []).reduce((sum, item) => {
        const unitPrice = Number(item?.product?.price ?? 0);
        const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1);
        return sum + unitPrice * quantity;
      }, 0)
    )
  );
}

function getCartShippingAmount(subtotal) {
  const normalizedSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  return normalizedSubtotal >= 1500 ? 0 : 79;
}

function normalizeAbandonedCartCouponCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeCustomerCouponCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function getConfiguredAbandonedCartCoupon(settings) {
  const safeSettings = sanitizeAbandonedCartSettings(settings);
  if (!safeSettings.couponEnabled) {
    return null;
  }

  const code = normalizeAbandonedCartCouponCode(safeSettings.couponCode);
  if (!code) {
    return null;
  }

  return {
    code,
    type: safeSettings.couponType === "fixed" ? "fixed" : "percentage",
    value: Number(safeSettings.couponValue) || 0,
    minimumSubtotal: Math.max(0, Number(safeSettings.couponMinimumSubtotal) || 0),
    description: String(safeSettings.couponDescription ?? "").trim(),
  };
}

function calculateAbandonedCartCouponDiscount(subtotal, coupon) {
  const normalizedSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  if (!coupon || normalizedSubtotal <= 0 || normalizedSubtotal < coupon.minimumSubtotal) {
    return 0;
  }

  if (coupon.type === "fixed") {
    return Math.min(normalizedSubtotal, Math.max(0, Math.round(Number(coupon.value) || 0)));
  }

  const percentage = Math.max(0, Math.min(95, Number(coupon.value) || 0));
  return Math.min(normalizedSubtotal, Math.round((normalizedSubtotal * percentage) / 100));
}

function calculateCustomerCouponDiscount(subtotal, coupon) {
  const normalizedSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  if (!coupon || normalizedSubtotal <= 0 || normalizedSubtotal < coupon.minimumSubtotal) {
    return 0;
  }

  if (coupon.type === "fixed") {
    return Math.min(normalizedSubtotal, Math.max(0, Math.round(Number(coupon.value) || 0)));
  }

  const percentage = Math.max(0, Math.min(95, Number(coupon.value) || 0));
  return Math.min(normalizedSubtotal, Math.round((normalizedSubtotal * percentage) / 100));
}

function createHttpError(statusCode, message) {
  const error = new Error(String(message || "Request failed."));
  error.statusCode = Number(statusCode) || 500;
  return error;
}

function normalizeOptionalCouponDateTime(input) {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return "";
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString();
}

function couponDateTimeToDbValue(value) {
  const normalized = normalizeOptionalCouponDateTime(value);
  return normalized ? new Date(normalized) : null;
}

function formatCouponDateTimeForResponse(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

async function getCustomerCouponRedemptionCount(couponId, userId) {
  if (!couponId || !userId) {
    return 0;
  }

  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM coupon_redemptions
    WHERE coupon_id = ? AND user_id = ?
    `,
    [couponId, userId]
  );
  return Math.max(0, Number(rows[0]?.total || 0));
}

function resolveAbandonedCartCoupon({ code, cartItems, settings }) {
  const configuredCoupon = getConfiguredAbandonedCartCoupon(settings);
  const normalizedCode = normalizeAbandonedCartCouponCode(code);

  if (!configuredCoupon || !normalizedCode || configuredCoupon.code !== normalizedCode) {
    return null;
  }

  const subtotal = getCartSubtotal(cartItems);
  const shippingAmount = getCartShippingAmount(subtotal);
  const discountAmount = calculateAbandonedCartCouponDiscount(subtotal, configuredCoupon);
  if (discountAmount <= 0) {
    return {
      valid: false,
      reason:
        subtotal < configuredCoupon.minimumSubtotal
          ? `Kuponu kullanmak için sepet tutarı en az ${configuredCoupon.minimumSubtotal.toLocaleString("tr-TR")} TL olmalıdır.`
          : "Kupon bu sepet için uygulanamadı.",
    };
  }

  return {
    valid: true,
    code: configuredCoupon.code,
    type: configuredCoupon.type,
    value: configuredCoupon.value,
    minimumSubtotal: configuredCoupon.minimumSubtotal,
    description: configuredCoupon.description,
    discountAmount,
    subtotal,
    shippingAmount,
    totalBeforeDiscount: subtotal + shippingAmount,
    totalAfterDiscount: Math.max(0, subtotal + shippingAmount - discountAmount),
  };
}

function mapAdminCouponRow(row) {
  return {
    id: String(row.id ?? "").trim(),
    enabled: Boolean(row.enabled),
    code: normalizeCustomerCouponCode(row.code),
    type: String(row.type ?? "").trim() === "fixed" ? "fixed" : "percentage",
    value: Math.max(1, Math.round(Number(row.value) || 0)),
    minimumSubtotal: Math.max(0, Math.round(Number(row.minimum_subtotal) || 0)),
    description: String(row.description ?? "").trim() || DEFAULT_CUSTOMER_COUPON_SETTINGS.description,
    singleUsePerCustomer:
      row.single_use_per_customer == null ? true : Boolean(Number(row.single_use_per_customer)),
    startsAt: formatCouponDateTimeForResponse(row.starts_at),
    expiresAt: formatCouponDateTimeForResponse(row.expires_at),
    usageCount: Math.max(0, Math.round(Number(row.usage_count) || 0)),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
  };
}

async function migrateLegacyCustomerCouponSettingToCoupons() {
  await ensureAppSettingsTable();
  const [rows] = await pool.query(
    `
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ?
    LIMIT 1
    `,
    [CUSTOMER_COUPON_SETTING_KEY]
  );
  if (rows.length === 0) {
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(String(rows[0].setting_value ?? "").trim() || "null");
  } catch {
    parsed = null;
  }

  const legacyCoupon = sanitizeCustomerCouponSettings(parsed ?? {});
  if (!legacyCoupon.code) {
    return;
  }

  const [existingRows] = await pool.query(
    `
    SELECT id
    FROM coupons
    WHERE code = ?
    LIMIT 1
    `,
    [legacyCoupon.code]
  );
  if (existingRows.length > 0) {
    return;
  }

  await pool.query(
    `
    INSERT INTO coupons (
      id, code, type, value, minimum_subtotal, description, enabled
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      legacyCoupon.code,
      legacyCoupon.type,
      legacyCoupon.value,
      legacyCoupon.minimumSubtotal,
      legacyCoupon.description,
      legacyCoupon.enabled,
    ]
  );
}

async function listCustomerCoupons() {
  await migrateLegacyCustomerCouponSettingToCoupons();
  const [rows] = await pool.query(
    `
    SELECT
      id,
      code,
      type,
      value,
      minimum_subtotal,
      description,
      enabled,
      starts_at,
      expires_at,
      usage_count,
      single_use_per_customer,
      created_at,
      updated_at
    FROM coupons
    ORDER BY updated_at DESC, created_at DESC, code ASC
    `
  );
  return rows.map(mapAdminCouponRow);
}

async function createCustomerCoupon(input) {
  const normalized = sanitizeCustomerCouponSettings(input);
  const couponId = crypto.randomUUID();
  await pool.query(
    `
    INSERT INTO coupons (
      id, code, type, value, minimum_subtotal, description, enabled, starts_at, expires_at, single_use_per_customer
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      couponId,
      normalized.code,
      normalized.type,
      normalized.value,
      normalized.minimumSubtotal,
      normalized.description,
      normalized.enabled,
      couponDateTimeToDbValue(normalized.startsAt),
      couponDateTimeToDbValue(normalized.expiresAt),
      normalized.singleUsePerCustomer,
    ]
  );

  const [rows] = await pool.query(
    `
    SELECT
      id,
      code,
      type,
      value,
      minimum_subtotal,
      description,
      enabled,
      starts_at,
      expires_at,
      usage_count,
      single_use_per_customer,
      created_at,
      updated_at
    FROM coupons
    WHERE id = ?
    LIMIT 1
    `,
    [couponId]
  );
  return rows.length > 0 ? mapAdminCouponRow(rows[0]) : null;
}

async function updateCustomerCoupon(couponId, input) {
  const normalized = sanitizeCustomerCouponSettings(input);
  const [result] = await pool.query(
    `
    UPDATE coupons
    SET
      code = ?,
      type = ?,
      value = ?,
      minimum_subtotal = ?,
      description = ?,
      enabled = ?,
      starts_at = ?,
      expires_at = ?,
      single_use_per_customer = ?
    WHERE id = ?
    `,
    [
      normalized.code,
      normalized.type,
      normalized.value,
      normalized.minimumSubtotal,
      normalized.description,
      normalized.enabled,
      couponDateTimeToDbValue(normalized.startsAt),
      couponDateTimeToDbValue(normalized.expiresAt),
      normalized.singleUsePerCustomer,
      couponId,
    ]
  );
  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      code,
      type,
      value,
      minimum_subtotal,
      description,
      enabled,
      starts_at,
      expires_at,
      usage_count,
      single_use_per_customer,
      created_at,
      updated_at
    FROM coupons
    WHERE id = ?
    LIMIT 1
    `,
    [couponId]
  );
  return rows.length > 0 ? mapAdminCouponRow(rows[0]) : null;
}

async function deleteCustomerCoupon(couponId) {
  const [result] = await pool.query(
    `
    DELETE FROM coupons
    WHERE id = ?
    `,
    [couponId]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function getCustomerCouponByCode(code) {
  const normalizedCode = normalizeCustomerCouponCode(code);
  if (!normalizedCode) {
    return null;
  }
  await migrateLegacyCustomerCouponSettingToCoupons();
  const [rows] = await pool.query(
    `
    SELECT
      id,
      code,
      type,
      value,
      minimum_subtotal,
      description,
      enabled,
      starts_at,
      expires_at,
      usage_count,
      single_use_per_customer,
      created_at,
      updated_at
    FROM coupons
    WHERE code = ?
    LIMIT 1
    `,
    [normalizedCode]
  );
  return rows.length > 0 ? mapAdminCouponRow(rows[0]) : null;
}

async function resolveCustomerCoupon({ code, cartItems, userId = "" }) {
  const configuredCoupon = await getCustomerCouponByCode(code);
  const normalizedCode = normalizeCustomerCouponCode(code);

  if (!configuredCoupon || !normalizedCode || configuredCoupon.code !== normalizedCode) {
    return null;
  }
  if (!configuredCoupon.enabled) {
    return {
      valid: false,
      reason: "Kupon kodu şu anda aktif değil.",
    };
  }
  const now = Date.now();
  const startsAtMs = configuredCoupon.startsAt ? Date.parse(configuredCoupon.startsAt) : NaN;
  if (Number.isFinite(startsAtMs) && startsAtMs > now) {
    return {
      valid: false,
      reason: "Bu kupon henüz aktif değil.",
    };
  }
  const expiresAtMs = configuredCoupon.expiresAt ? Date.parse(configuredCoupon.expiresAt) : NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
    return {
      valid: false,
      reason: "Bu kuponun kullanım süresi dolmuş.",
    };
  }
  if (configuredCoupon.singleUsePerCustomer && userId) {
    const redemptionCount = await getCustomerCouponRedemptionCount(configuredCoupon.id, userId);
    if (redemptionCount > 0) {
      return {
        valid: false,
        reason: "Bu kuponu hesabınızda daha önce kullandınız.",
      };
    }
  }

  const subtotal = getCartSubtotal(cartItems);
  const shippingAmount = getCartShippingAmount(subtotal);
  const discountAmount = calculateCustomerCouponDiscount(subtotal, configuredCoupon);
  if (discountAmount <= 0) {
    return {
      valid: false,
      reason:
        subtotal < configuredCoupon.minimumSubtotal
          ? `Kuponu kullanmak için sepet tutarı en az ${configuredCoupon.minimumSubtotal.toLocaleString("tr-TR")} TL olmalıdır.`
          : "Kupon bu sepet için uygulanamadı.",
    };
  }

  return {
    valid: true,
    id: configuredCoupon.id,
    source: "customer",
    code: configuredCoupon.code,
    type: configuredCoupon.type,
    value: configuredCoupon.value,
    minimumSubtotal: configuredCoupon.minimumSubtotal,
    description: configuredCoupon.description,
    singleUsePerCustomer: configuredCoupon.singleUsePerCustomer,
    startsAt: configuredCoupon.startsAt,
    expiresAt: configuredCoupon.expiresAt,
    discountAmount,
    subtotal,
    shippingAmount,
    totalBeforeDiscount: subtotal + shippingAmount,
    totalAfterDiscount: Math.max(0, subtotal + shippingAmount - discountAmount),
  };
}

async function recordCustomerCouponRedemption(connection, { coupon, userId, orderId, discountAmount }) {
  if (!coupon?.valid || coupon.source !== "customer" || !coupon.id || !userId || !orderId) {
    return;
  }

  const [rows] = await connection.query(
    `
    SELECT
      id,
      code,
      enabled,
      starts_at,
      expires_at,
      single_use_per_customer,
      usage_count
    FROM coupons
    WHERE id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [coupon.id]
  );

  if (rows.length === 0) {
    throw createHttpError(409, "Kupon artık kullanılamıyor.");
  }

  const lockedCoupon = mapAdminCouponRow(rows[0]);
  if (!lockedCoupon.enabled) {
    throw createHttpError(409, "Kupon artık aktif değil.");
  }

  const now = Date.now();
  const startsAtMs = lockedCoupon.startsAt ? Date.parse(lockedCoupon.startsAt) : NaN;
  if (Number.isFinite(startsAtMs) && startsAtMs > now) {
    throw createHttpError(409, "Kupon henüz aktif değil.");
  }
  const expiresAtMs = lockedCoupon.expiresAt ? Date.parse(lockedCoupon.expiresAt) : NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
    throw createHttpError(409, "Kuponun kullanım süresi dolmuş.");
  }

  if (lockedCoupon.singleUsePerCustomer) {
    const [redemptionRows] = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM coupon_redemptions
      WHERE coupon_id = ? AND user_id = ?
      `,
      [coupon.id, userId]
    );
    const redemptionCount = Math.max(0, Number(redemptionRows[0]?.total || 0));
    if (redemptionCount > 0) {
      throw createHttpError(409, "Bu kuponu hesabınızda daha önce kullandınız.");
    }
  }

  await connection.query(
    `
    INSERT INTO coupon_redemptions (
      id, coupon_id, user_id, order_id, code, discount_total
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      coupon.id,
      userId,
      orderId,
      coupon.code,
      Math.max(0, Math.round(Number(discountAmount) || 0)),
    ]
  );

  await connection.query(
    `
    UPDATE coupons
    SET usage_count = usage_count + 1
    WHERE id = ?
    `,
    [coupon.id]
  );
}

async function hasSentAbandonedCartEmail(userId, cartSignature) {
  await ensureMarketingAbandonedCartEmailsTable();
  const [rows] = await pool.query(
    `
    SELECT id
    FROM marketing_abandoned_cart_emails
    WHERE user_id = ? AND cart_signature = ? AND status = 'sent'
    LIMIT 1
    `,
    [userId, cartSignature]
  );
  return rows.length > 0;
}

async function recordAbandonedCartEmailAttempt({
  userId,
  email,
  cartSignature,
  cartUpdatedAt,
  cartItems,
  status,
  errorMessage = null,
}) {
  await ensureMarketingAbandonedCartEmailsTable();
  await pool.query(
    `
    INSERT INTO marketing_abandoned_cart_emails (
      id,
      user_id,
      email,
      cart_signature,
      cart_updated_at,
      cart_snapshot_json,
      status,
      error_message,
      sent_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      userId,
      email,
      cartSignature,
      cartUpdatedAt,
      serializeAbandonedCartSnapshot(cartItems),
      status,
      errorMessage,
      status === "sent" ? new Date() : null,
    ]
  );
}

async function getAbandonedCartCampaignStats() {
  await ensureMarketingAbandonedCartEmailsTable();
  const [eligibleRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM (
      SELECT c.user_id
      FROM user_cart_items c
      JOIN users u ON u.id = c.user_id
      WHERE COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
      GROUP BY c.user_id
    ) eligible
    `
  );
  const [sentRows] = await pool.query(
    `
    SELECT COUNT(*) AS total, MAX(sent_at) AS last_sent_at
    FROM marketing_abandoned_cart_emails
    WHERE status = 'sent' AND sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `
  );

  return {
    eligibleUsers: Number(eligibleRows?.[0]?.total ?? 0),
    sentLast7Days: Number(sentRows?.[0]?.total ?? 0),
    lastSentAt: sentRows?.[0]?.last_sent_at ?? null,
    mailConfigured: Boolean(abandonedCartMailTransporter),
  };
}

async function getUserWishlistItems(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.price,
      p.image,
      p.images_json,
      p.category_id,
      p.description,
      p.features_json,
      p.colors_json,
      p.tags_json,
      p.is_new,
      p.is_bestseller
    FROM user_wishlist_items w
    JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
    `,
    [userId]
  );

  return rows.map(mapProductRow);
}

async function getUserOrders(userId) {
  let orderRows;
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        order_date,
        total,
        status,
        subtotal_total,
        shipping_total,
        discount_total,
        coupon_code,
        shipping_company,
        shipping_tracking_no,
        created_at
      FROM user_orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );
    orderRows = rows;
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
    const [rows] = await pool.query(
      `
      SELECT id, order_date, total, status, shipping_company, shipping_tracking_no, created_at
      FROM user_orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );
    orderRows = rows;
  }

  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((row) => row.id);
  const placeholders = orderIds.map(() => "?").join(", ");
  const [itemRows] = await pool.query(
    `
    SELECT order_id, product_json, quantity, color
    FROM user_order_items
    WHERE order_id IN (${placeholders})
    ORDER BY created_at ASC
    `,
    orderIds
  );

  let shipmentRows = [];
  try {
    const [rows] = await pool.query(
      `
      SELECT
        order_id,
        provider,
        status,
        provider_reference_id,
        provider_post_number,
        carrier_name,
        tracking_url,
        barcode_url,
        error_message,
        response_payload_json,
        created_at,
        updated_at
      FROM order_shipments
      WHERE order_id IN (${placeholders}) AND provider = 'navlungo'
      ORDER BY updated_at DESC, created_at DESC
      `,
      orderIds
    );
    shipmentRows = rows;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }
  }

  const itemsByOrderId = new Map();
  for (const row of itemRows) {
    const list = itemsByOrderId.get(row.order_id) ?? [];
    let product;
    try {
      product = normalizeProductMedia(JSON.parse(row.product_json));
    } catch {
      continue;
    }
    list.push({
      product,
      quantity: Number(row.quantity),
      color: row.color ?? undefined,
    });
    itemsByOrderId.set(row.order_id, list);
  }

  const shipmentByOrderId = new Map();
  for (const row of shipmentRows) {
    if (shipmentByOrderId.has(row.order_id)) continue;
    shipmentByOrderId.set(row.order_id, mapOrderShipmentRow(row));
  }

  return orderRows.map((row) => ({
    id: row.id,
    date: row.created_at ?? row.order_date,
    items: itemsByOrderId.get(row.id) ?? [],
    total: Number(row.total),
    subtotal: row.subtotal_total == null ? undefined : Number(row.subtotal_total),
    shippingTotal: row.shipping_total == null ? undefined : Number(row.shipping_total),
    discountTotal: row.discount_total == null ? undefined : Number(row.discount_total),
    couponCode: row.coupon_code ?? "",
    status: row.status,
    shippingCompany: row.shipping_company ?? "",
    shippingTrackingNo: row.shipping_tracking_no ?? "",
    shipment: shipmentByOrderId.get(row.id) ?? undefined,
  }));
}

async function getSessionUser(token) {
  const [rows] = await pool.query(
    `
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.gender
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > NOW()
    LIMIT 1
    `,
    [token]
  );

  if (rows.length === 0) return null;
  const user = rows[0];
  const addresses = await getUserAddresses(user.id);
  return mapUserRow(user, addresses);
}

async function upsertPaytrPaymentIntent(input) {
  await ensurePaytrPaymentIntentsTable();
  await pool.query(
    `
    INSERT INTO paytr_payment_intents (
      merchant_oid, user_id, cart_signature, shipping_signature, coupon_code, amount, currency, status, expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL ? MINUTE))
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      cart_signature = VALUES(cart_signature),
      shipping_signature = VALUES(shipping_signature),
      coupon_code = VALUES(coupon_code),
      amount = VALUES(amount),
      currency = VALUES(currency),
      status = 'pending',
      paytr_status = NULL,
      paytr_payment_type = NULL,
      order_id = NULL,
      consumed_at = NULL,
      expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
    `,
    [
      input.merchantOid,
      input.userId,
      input.cartSignature,
      input.shippingSignature,
      input.couponCode || null,
      input.amount,
      input.currency || "TL",
      PAYTR_PAYMENT_INTENT_TTL_MINUTES,
      PAYTR_PAYMENT_INTENT_TTL_MINUTES,
    ]
  );
}

async function getPaytrPaymentIntent(merchantOid, userId) {
  await ensurePaytrPaymentIntentsTable();
  const [rows] = await pool.query(
    `
    SELECT
      merchant_oid,
      user_id,
      cart_signature,
      shipping_signature,
      coupon_code,
      amount,
      currency,
      status,
      paytr_status,
      paytr_payment_type,
      order_id,
      expires_at,
      consumed_at
    FROM paytr_payment_intents
    WHERE merchant_oid = ? AND user_id = ? AND expires_at > NOW()
    LIMIT 1
    `,
    [merchantOid, userId]
  );
  return rows[0] ?? null;
}

async function markPaytrPaymentIntentChecked(merchantOid, updates = {}) {
  await ensurePaytrPaymentIntentsTable();
  await pool.query(
    `
    UPDATE paytr_payment_intents
    SET
      status = COALESCE(?, status),
      paytr_status = COALESCE(?, paytr_status),
      paytr_payment_type = COALESCE(?, paytr_payment_type),
      order_id = COALESCE(?, order_id),
      consumed_at = CASE WHEN ? IS NULL THEN consumed_at ELSE NOW() END,
      last_checked_at = NOW()
    WHERE merchant_oid = ?
    `,
    [
      updates.status ?? null,
      updates.paytrStatus ?? null,
      updates.paymentType ?? null,
      updates.orderId ?? null,
      updates.consume ? 1 : null,
      merchantOid,
    ]
  );
}

async function queryPaytrPaymentStatus(merchantOid) {
  const merchantId = String(process.env.PAYTR_MERCHANT_ID ?? "").trim();
  const merchantKey = String(process.env.PAYTR_MERCHANT_KEY ?? "").trim();
  const merchantSalt = String(process.env.PAYTR_MERCHANT_SALT ?? "").trim();

  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error("PAYTR_STATUS_CONFIG_MISSING");
  }

  const paytrToken = crypto
    .createHmac("sha256", merchantKey)
    .update(`${merchantId}${merchantOid}${merchantSalt}`)
    .digest("base64");

  const payload = new URLSearchParams({
    merchant_id: merchantId,
    merchant_oid: merchantOid,
    paytr_token: paytrToken,
  });

  const response = await fetch("https://www.paytr.com/odeme/durum-sorgu", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json || String(json.status ?? "").toLowerCase() !== "success") {
    const reason = String(json?.err_msg ?? json?.reason ?? `HTTP ${response.status}`).trim();
    throw new Error(reason || "PAYTR_STATUS_QUERY_FAILED");
  }

  const paymentTotalRaw =
    json.payment_amount ??
    json.payment_total ??
    json.total_amount ??
    json.total ??
    json.amount ??
    0;
  const normalizedPaymentAmount = Number.parseInt(String(paymentTotalRaw ?? "0"), 10) || 0;

  return {
    paytrStatus: String(json.payment_status ?? json.status ?? "").trim().toLowerCase(),
    paymentAmount: normalizedPaymentAmount,
    paymentType: String(json.payment_type ?? json.odeme_tipi ?? "").trim().toLowerCase(),
    raw: json,
  };
}

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const user = await getSessionUser(token);
  if (!user) {
    const adminSession = await getAdminSession(token, { touch: false });
    if (adminSession) {
      logAuthorizationScopeMismatch(req, "user", "admin");
      return res.status(403).json({ message: "Forbidden." });
    }
    return res.status(401).json({ message: "Session expired or invalid." });
  }

  req.authToken = token;
  req.authUser = user;
  return next();
}

function normalizeAddressInput(body = {}) {
  const {
    firstName,
    lastName,
    phone,
    street,
    province,
    district,
    neighborhood,
    city,
    postalCode,
    isDefault,
  } = body;

  const normalized = {
    firstName: String(firstName ?? "").trim(),
    lastName: String(lastName ?? "").trim(),
    phone: String(phone ?? "").trim(),
    street: String(street ?? "").trim(),
    province: String(province ?? city ?? "").trim(),
    district: String(district ?? postalCode ?? "").trim(),
    neighborhood: String(neighborhood ?? "").trim(),
    isDefault: Boolean(isDefault),
  };

  if (
    !normalized.firstName ||
    !normalized.lastName ||
    !normalized.phone ||
    !normalized.street ||
    !normalized.province ||
    !normalized.district ||
    !normalized.neighborhood
  ) {
    return { error: "All address fields are required.", value: normalized };
  }

  if (normalized.street.length < 10) {
    return { error: "Address must be at least 10 characters.", value: normalized };
  }

  return { error: null, value: normalized };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp.trim();
  }

  return req.socket?.remoteAddress || "127.0.0.1";
}

function normalizePaytrReturnUrl(rawUrl, hashPath) {
  const input = String(rawUrl ?? "").trim();
  if (!input) return "";

  if (input.includes("#/")) {
    return input;
  }

  try {
    const parsed = new URL(input);
    const normalizedHashPath = hashPath.startsWith("/") ? hashPath : `/${hashPath}`;
    const normalizedPathname = parsed.pathname.replace(/\/+$/, "") || "/";

    // Avoid duplicated path like /odeme/basarili#/odeme/basarili.
    if (normalizedPathname === normalizedHashPath) {
      parsed.pathname = "/";
      parsed.search = "";
    } else if (normalizedPathname.endsWith(normalizedHashPath)) {
      const basePath = normalizedPathname.slice(0, -normalizedHashPath.length) || "/";
      parsed.pathname = basePath.endsWith("/") ? basePath : `${basePath}/`;
      parsed.search = "";
    }

    parsed.hash = hashPath.startsWith("#") ? hashPath : `#${hashPath}`;
    return parsed.toString();
  } catch {
    return input;
  }
}

async function ensureAdminSessionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token VARCHAR(128) PRIMARY KEY,
      admin_email VARCHAR(255) NOT NULL,
      remember_me BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_admin_sessions_expires_at (expires_at),
      KEY idx_admin_sessions_admin_email (admin_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

function getAdminSessionTtlMs(rememberMe = false) {
  return rememberMe ? ADMIN_REMEMBER_SESSION_TTL_MS : ADMIN_SESSION_TTL_MS;
}

async function cleanupExpiredAdminSessions() {
  await ensureAdminSessionsTable();
  await pool.query(`DELETE FROM admin_sessions WHERE expires_at <= NOW()`);
}

async function createAdminSession(adminEmail, { rememberMe = false } = {}) {
  await cleanupExpiredAdminSessions();
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + getAdminSessionTtlMs(rememberMe));

  await pool.query(
    `
      INSERT INTO admin_sessions (token, admin_email, remember_me, expires_at, last_seen_at)
      VALUES (?, ?, ?, ?, NOW())
    `,
    [token, String(adminEmail ?? "").trim().toLowerCase(), rememberMe ? 1 : 0, expiresAt]
  );

  return { token, expiresAt };
}

async function getAdminSession(token, { touch = false } = {}) {
  await cleanupExpiredAdminSessions();

  const [rows] = await pool.query(
    `
      SELECT token, admin_email AS adminEmail, remember_me AS rememberMe, expires_at AS expiresAt
      FROM admin_sessions
      WHERE token = ? AND expires_at > NOW()
      LIMIT 1
    `,
    [token]
  );

  if (rows.length === 0) {
    return null;
  }

  const session = rows[0];

  if (touch) {
    const nextExpiry = new Date(Date.now() + getAdminSessionTtlMs(Boolean(session.rememberMe)));
    await pool.query(
      `
        UPDATE admin_sessions
        SET last_seen_at = NOW(), expires_at = ?
        WHERE token = ?
      `,
      [nextExpiry, token]
    );
    session.expiresAt = nextExpiry;
  }

  return session;
}

async function deleteAdminSession(token) {
  if (!token) return;
  await ensureAdminSessionsTable();
  await pool.query(`DELETE FROM admin_sessions WHERE token = ?`, [token]);
}

async function requireAdminAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const session = await getAdminSession(token, { touch: true });
  if (!session) {
    const user = await getSessionUser(token);
    if (user) {
      logAuthorizationScopeMismatch(req, "admin", "user");
      return res.status(403).json({ message: "Forbidden." });
    }
    return res.status(401).json({ message: "Session expired or invalid." });
  }

  req.adminToken = token;
  req.adminSession = session;
  return next();
}

async function ensureAppSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(120) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function ensureContactRequestsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_requests (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function ensurePaytrPaymentIntentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS paytr_payment_intents (
      merchant_oid VARCHAR(120) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      cart_signature CHAR(64) NOT NULL,
      shipping_signature CHAR(64) NOT NULL,
      coupon_code VARCHAR(64) NULL,
      amount INT NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'TL',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      paytr_status VARCHAR(32) NULL,
      paytr_payment_type VARCHAR(32) NULL,
      order_id VARCHAR(64) NULL,
      consumed_at DATETIME NULL,
      expires_at DATETIME NOT NULL,
      last_checked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_paytr_payment_intents_user_id (user_id),
      KEY idx_paytr_payment_intents_status (status),
      KEY idx_paytr_payment_intents_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function ensureMarketingAbandonedCartEmailsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_abandoned_cart_emails (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      cart_signature CHAR(64) NOT NULL,
      cart_updated_at DATETIME NOT NULL,
      cart_snapshot_json JSON NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      error_message TEXT NULL,
      sent_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_marketing_abandoned_cart_emails_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      KEY idx_marketing_abandoned_cart_signature (user_id, cart_signature, status),
      KEY idx_marketing_abandoned_cart_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function ensureOrderShipmentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_shipments (
      id CHAR(36) PRIMARY KEY,
      order_id VARCHAR(20) NOT NULL,
      provider VARCHAR(40) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'created',
      provider_reference_id VARCHAR(120) NULL,
      provider_post_number VARCHAR(120) NULL,
      carrier_name VARCHAR(120) NULL,
      tracking_url TEXT NULL,
      barcode_url TEXT NULL,
      error_message TEXT NULL,
      request_payload_json JSON NULL,
      response_payload_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_order_shipments_order
        FOREIGN KEY (order_id)
        REFERENCES user_orders(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      UNIQUE KEY uq_order_shipments_order_provider (order_id, provider),
      KEY idx_order_shipments_status (status),
      KEY idx_order_shipments_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getJsonAppSetting(settingKey, fallbackValue) {
  await ensureAppSettingsTable();
  const [rows] = await pool.query(
    `
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ?
    LIMIT 1
    `,
    [settingKey]
  );

  if (rows.length === 0) {
    await pool.query(
      `
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES (?, ?)
      `,
      [settingKey, JSON.stringify(fallbackValue)]
    );
    return JSON.parse(JSON.stringify(fallbackValue));
  }

  try {
    const parsed = JSON.parse(String(rows[0].setting_value ?? "").trim() || "null");
    if (parsed && typeof parsed === "object") {
      return { ...fallbackValue, ...parsed };
    }
  } catch {
    // fall through to reset invalid JSON
  }

  await pool.query(
    `
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [settingKey, JSON.stringify(fallbackValue)]
  );
  return JSON.parse(JSON.stringify(fallbackValue));
}

async function setJsonAppSetting(settingKey, value) {
  await ensureAppSettingsTable();
  await pool.query(
    `
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [settingKey, JSON.stringify(value)]
  );
}

async function getTextAppSetting(settingKey, fallbackValue = "") {
  await ensureAppSettingsTable();
  const [rows] = await pool.query(
    `
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ?
    LIMIT 1
    `,
    [settingKey]
  );

  if (rows.length === 0) {
    return fallbackValue;
  }

  const value = String(rows[0].setting_value ?? "").trim();
  return value || fallbackValue;
}

async function setTextAppSetting(settingKey, value) {
  await ensureAppSettingsTable();
  await pool.query(
    `
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [settingKey, String(value ?? "").trim()]
  );
}

function sanitizeAbandonedCartSettings(input = {}) {
  const delayMinutesRaw = Number(input?.delayMinutes ?? DEFAULT_ABANDONED_CART_SETTINGS.delayMinutes);
  const delayMinutes = Math.max(15, Math.min(7 * 24 * 60, Number.isFinite(delayMinutesRaw) ? Math.trunc(delayMinutesRaw) : DEFAULT_ABANDONED_CART_SETTINGS.delayMinutes));
  const subject = String(input?.subject ?? DEFAULT_ABANDONED_CART_SETTINGS.subject).trim().slice(0, 180);
  const heading = String(input?.heading ?? DEFAULT_ABANDONED_CART_SETTINGS.heading).trim().slice(0, 180);
  const body = String(input?.body ?? DEFAULT_ABANDONED_CART_SETTINGS.body).trim().slice(0, 2000);
  const ctaLabel = String(input?.ctaLabel ?? DEFAULT_ABANDONED_CART_SETTINGS.ctaLabel).trim().slice(0, 80);
  const couponCode = String(input?.couponCode ?? DEFAULT_ABANDONED_CART_SETTINGS.couponCode)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
  const couponType = String(input?.couponType ?? DEFAULT_ABANDONED_CART_SETTINGS.couponType).trim() === "fixed"
    ? "fixed"
    : "percentage";
  const couponValueRaw = Number(input?.couponValue ?? DEFAULT_ABANDONED_CART_SETTINGS.couponValue);
  const couponValue =
    couponType === "fixed"
      ? Math.max(1, Math.min(100000, Number.isFinite(couponValueRaw) ? Math.round(couponValueRaw) : DEFAULT_ABANDONED_CART_SETTINGS.couponValue))
      : Math.max(1, Math.min(95, Number.isFinite(couponValueRaw) ? Math.round(couponValueRaw) : DEFAULT_ABANDONED_CART_SETTINGS.couponValue));
  const couponMinimumSubtotalRaw = Number(
    input?.couponMinimumSubtotal ?? DEFAULT_ABANDONED_CART_SETTINGS.couponMinimumSubtotal
  );
  const couponMinimumSubtotal = Math.max(
    0,
    Math.min(
      1000000,
      Number.isFinite(couponMinimumSubtotalRaw)
        ? Math.round(couponMinimumSubtotalRaw)
        : DEFAULT_ABANDONED_CART_SETTINGS.couponMinimumSubtotal
    )
  );
  const couponDescription = String(
    input?.couponDescription ?? DEFAULT_ABANDONED_CART_SETTINGS.couponDescription
  )
    .trim()
    .slice(0, 200);

  return {
    enabled: Boolean(input?.enabled),
    delayMinutes,
    subject: subject || DEFAULT_ABANDONED_CART_SETTINGS.subject,
    heading: heading || DEFAULT_ABANDONED_CART_SETTINGS.heading,
    body: body || DEFAULT_ABANDONED_CART_SETTINGS.body,
    ctaLabel: ctaLabel || DEFAULT_ABANDONED_CART_SETTINGS.ctaLabel,
    couponEnabled: Boolean(input?.couponEnabled && couponCode),
    couponCode,
    couponType,
    couponValue,
    couponMinimumSubtotal,
    couponDescription: couponDescription || DEFAULT_ABANDONED_CART_SETTINGS.couponDescription,
  };
}

function sanitizeCustomerCouponSettings(input = {}) {
  const code = String(input?.code ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.code)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
  const type = String(input?.type ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.type).trim() === "fixed"
    ? "fixed"
    : "percentage";
  const valueRaw = Number(input?.value ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.value);
  const value =
    type === "fixed"
      ? Math.max(1, Math.min(100000, Number.isFinite(valueRaw) ? Math.round(valueRaw) : DEFAULT_CUSTOMER_COUPON_SETTINGS.value))
      : Math.max(1, Math.min(95, Number.isFinite(valueRaw) ? Math.round(valueRaw) : DEFAULT_CUSTOMER_COUPON_SETTINGS.value));
  const minimumSubtotalRaw = Number(
    input?.minimumSubtotal ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.minimumSubtotal
  );
  const minimumSubtotal = Math.max(
    0,
    Math.min(
      1000000,
      Number.isFinite(minimumSubtotalRaw)
        ? Math.round(minimumSubtotalRaw)
        : DEFAULT_CUSTOMER_COUPON_SETTINGS.minimumSubtotal
    )
  );
  const description = String(input?.description ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.description)
    .trim()
    .slice(0, 200);
  const singleUsePerCustomer =
    input?.singleUsePerCustomer == null
      ? DEFAULT_CUSTOMER_COUPON_SETTINGS.singleUsePerCustomer
      : Boolean(input.singleUsePerCustomer);
  const startsAt = normalizeOptionalCouponDateTime(input?.startsAt ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.startsAt);
  const expiresAt = normalizeOptionalCouponDateTime(input?.expiresAt ?? DEFAULT_CUSTOMER_COUPON_SETTINGS.expiresAt);

  return {
    enabled: Boolean(input?.enabled && code),
    code,
    type,
    value,
    minimumSubtotal,
    description: description || DEFAULT_CUSTOMER_COUPON_SETTINGS.description,
    singleUsePerCustomer,
    startsAt,
    expiresAt,
  };
}

function validateCustomerCouponSettingsInput(rawInput, normalizedSettings) {
  const rawStartsAt = String(rawInput?.startsAt ?? "").trim();
  const rawExpiresAt = String(rawInput?.expiresAt ?? "").trim();

  if (rawStartsAt && !normalizedSettings.startsAt) {
    return "Kupon başlangıç tarihi geçerli değil.";
  }
  if (rawExpiresAt && !normalizedSettings.expiresAt) {
    return "Kupon bitiş tarihi geçerli değil.";
  }
  if (normalizedSettings.startsAt && normalizedSettings.expiresAt) {
    const startsAtMs = Date.parse(normalizedSettings.startsAt);
    const expiresAtMs = Date.parse(normalizedSettings.expiresAt);
    if (Number.isFinite(startsAtMs) && Number.isFinite(expiresAtMs) && expiresAtMs <= startsAtMs) {
      return "Kupon bitiş tarihi başlangıç tarihinden sonra olmalıdır.";
    }
  }
  return "";
}

async function getAbandonedCartSettings() {
  const stored = await getJsonAppSetting(ABANDONED_CART_SETTING_KEY, DEFAULT_ABANDONED_CART_SETTINGS);
  return sanitizeAbandonedCartSettings(stored);
}

async function setAbandonedCartSettings(input) {
  const normalized = sanitizeAbandonedCartSettings(input);
  await setJsonAppSetting(ABANDONED_CART_SETTING_KEY, normalized);
  return normalized;
}

async function getCustomerCouponSettings() {
  await ensureAppSettingsTable();
  const [rows] = await pool.query(
    `
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ?
    LIMIT 1
    `,
    [CUSTOMER_COUPON_SETTING_KEY]
  );

  if (rows.length === 0) {
    const abandonedCartSettings = await getAbandonedCartSettings();
    const migratedFallback = sanitizeCustomerCouponSettings({
      enabled: abandonedCartSettings.couponEnabled,
      code: abandonedCartSettings.couponCode,
      type: abandonedCartSettings.couponType,
      value: abandonedCartSettings.couponValue,
      minimumSubtotal: abandonedCartSettings.couponMinimumSubtotal,
      description: abandonedCartSettings.couponDescription,
    });
    const fallbackSettings = migratedFallback.code ? migratedFallback : DEFAULT_CUSTOMER_COUPON_SETTINGS;
    await setJsonAppSetting(CUSTOMER_COUPON_SETTING_KEY, fallbackSettings);
    return sanitizeCustomerCouponSettings(fallbackSettings);
  }

  try {
    const parsed = JSON.parse(String(rows[0].setting_value ?? "").trim() || "null");
    return sanitizeCustomerCouponSettings(parsed);
  } catch {
    await setJsonAppSetting(CUSTOMER_COUPON_SETTING_KEY, DEFAULT_CUSTOMER_COUPON_SETTINGS);
    return sanitizeCustomerCouponSettings(DEFAULT_CUSTOMER_COUPON_SETTINGS);
  }
}

async function setCustomerCouponSettings(input) {
  const normalized = sanitizeCustomerCouponSettings(input);
  await setJsonAppSetting(CUSTOMER_COUPON_SETTING_KEY, normalized);
  return normalized;
}

async function getSiteNameSetting() {
  await ensureAppSettingsTable();
  const [rows] = await pool.query(
    `
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = 'site_name'
    LIMIT 1
    `
  );
  if (rows.length === 0) {
    await pool.query(
      `
      INSERT INTO app_settings (setting_key, setting_value)
      VALUES ('site_name', ?)
      `,
      [DEFAULT_SITE_NAME]
    );
    return DEFAULT_SITE_NAME;
  }
  const value = String(rows[0].setting_value ?? "").trim();
  return value || DEFAULT_SITE_NAME;
}

async function setSiteNameSetting(siteName) {
  await ensureAppSettingsTable();
  await pool.query(
    `
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES ('site_name', ?)
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `,
    [siteName]
  );
}

async function generateUniqueProductId() {
  for (let i = 0; i < 10; i += 1) {
    const candidate = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const [rows] = await pool.query(`SELECT id FROM products WHERE id = ? LIMIT 1`, [candidate]);
    if (rows.length === 0) return candidate;
  }
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function getDefaultCategoryId() {
  const [rows] = await pool.query(
    `
    SELECT id
    FROM categories
    ORDER BY id ASC
    LIMIT 1
    `
  );
  return rows.length > 0 ? String(rows[0].id ?? "").trim() : "";
}

function parseAdminPriceInput(value, fallback = 0) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.isFinite(Number(fallback)) ? Math.max(0, Math.trunc(Number(fallback))) : 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

function parseAdminStockInput(value, fallback = null) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, "");
  if (!normalized) {
    if (fallback == null || fallback === "") return null;
    const parsedFallback = Number(fallback);
    return Number.isFinite(parsedFallback) && parsedFallback >= 0 ? Math.trunc(parsedFallback) : null;
  }

  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    if (fallback == null || fallback === "") return null;
    const parsedFallback = Number(fallback);
    return Number.isFinite(parsedFallback) && parsedFallback >= 0 ? Math.trunc(parsedFallback) : null;
  }

  return Math.trunc(parsed);
}

function mapOrderStatusTimelineEventRow(row) {
  const rawType = String(row.event_type ?? "").trim();
  const type =
    rawType === "created" || rawType === "processing" || rawType === "shipped" || rawType === "delivered"
      ? rawType
      : "processing";
  const note = String(row.note ?? "").trim();
  const shippingCompany = String(row.shipping_company ?? "").trim();
  const shippingTrackingNo = String(row.shipping_tracking_no ?? "").trim();
  return {
    id: String(row.id ?? "").trim() || crypto.randomUUID(),
    type,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    note: note || undefined,
    shippingCompany: shippingCompany || undefined,
    shippingTrackingNo: shippingTrackingNo || undefined,
  };
}

function buildFallbackOrderTimeline(orderRow, storedEvents = []) {
  const timeline = [...storedEvents];
  const orderCreatedAt =
    orderRow?.created_at != null
      ? new Date(orderRow.created_at).toISOString()
      : String(orderRow?.order_date ?? "").trim()
      ? new Date(`${String(orderRow.order_date).trim()}T00:00:00`).toISOString()
      : new Date().toISOString();

  if (!timeline.some((event) => event.type === "created")) {
    timeline.push({
      id: `fallback-created-${String(orderRow?.id ?? "").trim() || crypto.randomUUID()}`,
      type: "created",
      createdAt: orderCreatedAt,
      note: "Sipariş müşteriden alındı.",
    });
  }

  const currentStatus = String(orderRow?.status ?? "").trim();
  const orderUpdatedAt =
    orderRow?.updated_at != null ? new Date(orderRow.updated_at).toISOString() : orderCreatedAt;
  if (
    (currentStatus === "shipped" || currentStatus === "delivered") &&
    !timeline.some((event) => event.type === currentStatus)
  ) {
    timeline.push({
      id: `fallback-${currentStatus}-${String(orderRow?.id ?? "").trim() || crypto.randomUUID()}`,
      type: currentStatus,
      createdAt: orderUpdatedAt,
      note:
        currentStatus === "shipped"
          ? "Kargo durumu mevcut sipariş kaydından geri dolduruldu."
          : "Teslim durumu mevcut sipariş kaydından geri dolduruldu.",
      shippingCompany: String(orderRow?.shipping_company ?? "").trim() || undefined,
      shippingTrackingNo: String(orderRow?.shipping_tracking_no ?? "").trim() || undefined,
    });
  }

  return timeline.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function insertOrderStatusTimelineEvent(
  db,
  { orderId, type, note = "", shippingCompany = "", shippingTrackingNo = "" }
) {
  const eventId = crypto.randomUUID();
  const safeType =
    type === "created" || type === "processing" || type === "shipped" || type === "delivered"
      ? type
      : "processing";
  await db.query(
    `
    INSERT INTO order_status_events (
      id, order_id, event_type, note, shipping_company, shipping_tracking_no
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      eventId,
      orderId,
      safeType,
      String(note ?? "").trim() || null,
      String(shippingCompany ?? "").trim() || null,
      String(shippingTrackingNo ?? "").trim() || null,
    ]
  );

  return {
    id: eventId,
    type: safeType,
    createdAt: new Date().toISOString(),
    note: String(note ?? "").trim() || undefined,
    shippingCompany: String(shippingCompany ?? "").trim() || undefined,
    shippingTrackingNo: String(shippingTrackingNo ?? "").trim() || undefined,
  };
}

function mapOrderShipmentRow(row) {
  const rawStatus = String(row.status ?? "").trim().toLowerCase();
  const status = rawStatus === "created" || rawStatus === "failed" ? rawStatus : "failed";
  let providerStatusCode = null;
  let providerStatusName = "";

  try {
    const parsedResponsePayload = row.response_payload_json ? JSON.parse(row.response_payload_json) : null;
    const extractedStatus = extractNavlungoCheckPayload(parsedResponsePayload);
    if (Number.isFinite(Number(extractedStatus.statusCode)) && Number(extractedStatus.statusCode) > 0) {
      providerStatusCode = Number(extractedStatus.statusCode);
    }
    providerStatusName = String(extractedStatus.statusName ?? "").trim();
  } catch {
    providerStatusCode = null;
    providerStatusName = "";
  }

  return {
    provider: String(row.provider ?? "").trim() || "navlungo",
    status,
    referenceId: String(row.provider_reference_id ?? "").trim() || undefined,
    postNumber: String(row.provider_post_number ?? "").trim() || undefined,
    carrierName: String(row.carrier_name ?? "").trim() || undefined,
    trackingUrl: sanitizeExternalHttpUrl(row.tracking_url) || undefined,
    barcodeUrl: sanitizeExternalHttpUrl(row.barcode_url) || undefined,
    errorMessage: String(row.error_message ?? "").trim() || undefined,
    providerStatusCode: providerStatusCode ?? undefined,
    providerStatusName: providerStatusName || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function getOrderStatusRank(status) {
  switch (String(status ?? "").trim()) {
    case "delivered":
      return 3;
    case "shipped":
      return 2;
    case "processing":
    default:
      return 1;
  }
}

function normalizeNavlungoStatusName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR");
}

function mapNavlungoLifecycleStatus(statusCode, statusName) {
  const numericStatusCode = Number(statusCode ?? 0);
  const normalizedStatusName = normalizeNavlungoStatusName(statusName);

  if (
    numericStatusCode === 2 ||
    numericStatusCode === 13 ||
    normalizedStatusName.includes("teslim edildi") ||
    normalizedStatusName.includes("tamamlandı")
  ) {
    return "delivered";
  }

  if (
    [3, 4, 5, 6, 16, 17, 18].includes(numericStatusCode) ||
    normalizedStatusName.includes("teslim alındı") ||
    normalizedStatusName.includes("transfer aşamasında") ||
    normalizedStatusName.includes("şubede beklemede") ||
    normalizedStatusName.includes("teslim edilecek") ||
    normalizedStatusName.includes("dağıtıma çıktı") ||
    normalizedStatusName.includes("dağıtım planlandı") ||
    normalizedStatusName.includes("tekrar sevk")
  ) {
    return "shipped";
  }

  return null;
}

function extractNavlungoCheckPayload(payload) {
  const normalizedPayload =
    payload && typeof payload === "object" && payload.data && typeof payload.data === "object" ? payload.data : payload;
  const data = Array.isArray(normalizedPayload) ? normalizedPayload[0] ?? {} : normalizedPayload ?? {};
  const post = data?.post && typeof data.post === "object" ? data.post : {};
  const status = data?.status && typeof data.status === "object" ? data.status : {};

  return {
    raw: data,
    referenceId: String(data.reference_id ?? "").trim(),
    postNumber: String(data.post_number ?? "").trim(),
    carrierName: String(post.carrier_name ?? data.carrier_name ?? "").trim(),
    trackingUrl: sanitizeExternalHttpUrl(data.tracking_url),
    carrierTrackingUrl: sanitizeExternalHttpUrl(data.carrier_tracking_url),
    barcodeUrl: sanitizeExternalHttpUrl(data.barcode_url ?? data.barcode),
    statusCode: Number(status.status_code ?? data.status_code ?? 0) || 0,
    statusName: String(status.status_name ?? data.status_name ?? "").trim(),
    pickedUpDate: String(status.picked_up_date ?? "").trim(),
    deliveredDate: String(status.delivered_date ?? "").trim(),
  };
}

function parseNavlungoResponsePayload(text) {
  const normalized = String(text ?? "").trim();
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch {
    return normalized;
  }
}

function formatNavlungoErrorMessage(payload, fallbackMessage = "Navlungo isteği başarısız oldu.") {
  const flattenErrorValues = (value) => {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value.flatMap((entry) => flattenErrorValues(entry));
    }
    if (typeof value === "object") {
      return Object.values(value).flatMap((entry) => flattenErrorValues(entry));
    }
    const normalized = String(value ?? "").trim();
    return normalized ? [normalized] : [];
  };

  if (!payload) return fallbackMessage;
  if (typeof payload === "string") {
    return payload || fallbackMessage;
  }
  if (payload.error != null && typeof payload.error !== "object") {
    const topLevelError = String(payload.error ?? "").trim();
    if (topLevelError) {
      return topLevelError;
    }
  }
  if (payload.error && typeof payload.error === "object") {
    const flattened = flattenErrorValues(payload.error);
    if (flattened.length > 0) {
      return flattened.join(" | ");
    }
  }
  const message = String(payload.message ?? "").trim();
  if (message) {
    return message;
  }
  return fallbackMessage;
}

function buildNavlungoApiUrl(pathname) {
  const normalizedPath = String(pathname ?? "").trim().replace(/^\/+/, "");
  return `${NAVLUNGO_API_BASE_URL}/${normalizedPath}`;
}

function normalizeNavlungoPhone(phone) {
  const raw = String(phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+90${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+90${digits}`;
  }
  if (raw.startsWith("+")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function buildNavlungoRecipientAddressLine(deliveryAddress = {}) {
  const parts = [
    String(deliveryAddress.addressName ?? "").trim(),
    String(deliveryAddress.street ?? "").trim(),
    String(deliveryAddress.neighborhood ?? "").trim(),
  ].filter(Boolean);
  return parts.join(", ").slice(0, 250);
}

function getNavlungoPostRequestMeta(payload = {}) {
  const post = Array.isArray(payload.posts) ? payload.posts[0] ?? {} : {};
  const providerPost = post.post && typeof post.post === "object" ? post.post : {};
  return {
    referenceId: String(post.reference_id ?? "").trim(),
    carrierId: Number(post.carrier_id ?? NAVLUNGO_DEFAULT_CARRIER_ID) || NAVLUNGO_DEFAULT_CARRIER_ID,
    postType: Number(post.post_type ?? NAVLUNGO_DEFAULT_POST_TYPE) || NAVLUNGO_DEFAULT_POST_TYPE,
    packageCount: Number(providerPost.package_count ?? NAVLUNGO_DEFAULT_PACKAGE_COUNT) || NAVLUNGO_DEFAULT_PACKAGE_COUNT,
    desi: Number(providerPost.desi ?? NAVLUNGO_DEFAULT_DESI) || NAVLUNGO_DEFAULT_DESI,
  };
}

async function requestNavlungoToken({ forceRefresh = false } = {}) {
  if (!isNavlungoConfigured) {
    throw new Error("Navlungo entegrasyonu için gerekli bilgiler eksik.");
  }

  if (!forceRefresh && navlungoTokenCache.token && navlungoTokenCache.expiresAt > Date.now()) {
    return navlungoTokenCache.token;
  }

  const response = await fetch(buildNavlungoApiUrl("auth/api"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-localization": NAVLUNGO_LOCALIZATION,
    },
    body: JSON.stringify({
      username: NAVLUNGO_USERNAME,
      password: NAVLUNGO_PASSWORD,
    }),
  });

  const payload = parseNavlungoResponsePayload(await response.text());
  if (!response.ok || !payload || typeof payload !== "object" || payload.status === false) {
    throw new Error(formatNavlungoErrorMessage(payload, `Navlungo token alınamadı (${response.status}).`));
  }

  const accessToken = String(payload.data?.access_token ?? "").trim();
  const expiresAtRaw = String(payload.data?.expires_in ?? "").trim();
  if (!accessToken) {
    throw new Error("Navlungo token cevabı geçersiz.");
  }

  const parsedExpiry = expiresAtRaw ? Date.parse(expiresAtRaw) : NaN;
  navlungoTokenCache = {
    token: accessToken,
    expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry - 60 * 1000 : Date.now() + 7 * 60 * 60 * 1000,
  };
  return accessToken;
}

async function performNavlungoHttpRequest(url, { method = "GET", headers = {}, body = "" } = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: Number(res.statusCode ?? 0),
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function requestNavlungoJson(pathname, init = {}, { retryOnUnauthorized = true } = {}) {
  const token = await requestNavlungoToken();
  const method = String(init.method ?? "GET").trim().toUpperCase() || "GET";
  const headers = new Headers(init.headers ?? {});
  headers.set("Accept", "application/json");
  headers.set("X-localization", NAVLUNGO_LOCALIZATION);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  const requestUrl = buildNavlungoApiUrl(pathname);
  const serializedBody =
    typeof init.body === "string"
      ? init.body
      : init.body == null
        ? ""
        : String(init.body);
  if (serializedBody) {
    headers.set("Content-Length", String(Buffer.byteLength(serializedBody)));
  }

  let status = 0;
  let rawText = "";
  if (serializedBody) {
    const rawResponse = await performNavlungoHttpRequest(requestUrl, {
      method,
      headers: Object.fromEntries(headers.entries()),
      body: serializedBody,
    });
    status = rawResponse.status;
    rawText = rawResponse.text;
  } else {
    const response = await fetch(requestUrl, {
      ...init,
      method,
      headers,
    });
    status = response.status;
    rawText = await response.text();
  }

  if (status === 401 && retryOnUnauthorized) {
    await requestNavlungoToken({ forceRefresh: true });
    return requestNavlungoJson(pathname, init, { retryOnUnauthorized: false });
  }

  const payload = parseNavlungoResponsePayload(rawText);
  const isOk = status >= 200 && status < 300;
  if (!isOk || (payload && typeof payload === "object" && payload.status === false)) {
    throw new Error(formatNavlungoErrorMessage(payload, `Navlungo isteği başarısız oldu (${status}).`));
  }

  return payload;
}

function extractNavlungoAddressId(addressPayload) {
  const candidates = [
    addressPayload?.id,
    addressPayload?.addressId,
    addressPayload?.address_id,
    addressPayload?.data?.id,
    addressPayload?.data?.addressId,
    addressPayload?.data?.address_id,
  ];
  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

async function listNavlungoSenderAddresses() {
  const payload = await requestNavlungoJson("address-book/getAll", {
    method: "GET",
    body: JSON.stringify({
      limit: 50,
      page: 1,
      filters: {
        address_type: "sender",
      },
    }),
  });

  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.data?.data)) {
    return payload.data.data;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
}

function normalizeNavlungoComparableValue(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

function doesNavlungoSenderAddressMatchConfig(address = {}) {
  if (!hasNavlungoSenderCreateConfig) {
    return false;
  }

  const configuredLocationName = normalizeNavlungoComparableValue(NAVLUNGO_SENDER_LOCATION_NAME || NAVLUNGO_SENDER_NAME);
  const configuredAddressName = normalizeNavlungoComparableValue(NAVLUNGO_SENDER_NAME);
  const configuredAddressLine = normalizeNavlungoComparableValue(NAVLUNGO_SENDER_ADDRESS_LINE);
  const configuredCity = normalizeNavlungoComparableValue(NAVLUNGO_SENDER_CITY);
  const configuredDistrict = normalizeNavlungoComparableValue(NAVLUNGO_SENDER_DISTRICT);

  const candidateLocationName = normalizeNavlungoComparableValue(
    address?.location_name ?? address?.locationName ?? address?.address_name ?? address?.addressName ?? ""
  );
  const candidateAddressName = normalizeNavlungoComparableValue(address?.address_name ?? address?.addressName ?? address?.name ?? "");
  const candidateAddressLine = normalizeNavlungoComparableValue(
    address?.address_line ?? address?.addressLine ?? address?.address ?? ""
  );
  const candidateCity = normalizeNavlungoComparableValue(address?.address_city ?? address?.city ?? "");
  const candidateDistrict = normalizeNavlungoComparableValue(address?.address_district ?? address?.district ?? "");

  return (
    candidateLocationName === configuredLocationName &&
    candidateAddressName === configuredAddressName &&
    candidateAddressLine === configuredAddressLine &&
    candidateCity === configuredCity &&
    candidateDistrict === configuredDistrict
  );
}

async function createNavlungoSenderAddress() {
  if (!hasNavlungoSenderCreateConfig) {
    throw new Error("Navlungo gonderici adres bilgileri eksik.");
  }

  const payload = await requestNavlungoJson("address-book/create", {
    method: "POST",
    body: JSON.stringify({
      location_name: NAVLUNGO_SENDER_LOCATION_NAME || NAVLUNGO_SENDER_NAME,
      address_name: NAVLUNGO_SENDER_NAME,
      address_type: "sender",
      address_email: NAVLUNGO_SENDER_EMAIL,
      address_phone: normalizeNavlungoPhone(NAVLUNGO_SENDER_PHONE),
      address_line: NAVLUNGO_SENDER_ADDRESS_LINE,
      address_country: NAVLUNGO_SENDER_COUNTRY,
      address_city: NAVLUNGO_SENDER_CITY,
      address_district: NAVLUNGO_SENDER_DISTRICT,
      post_code: NAVLUNGO_SENDER_POST_CODE,
      is_main_warehouse: 1,
    }),
  });

  const addressId = extractNavlungoAddressId(payload);
  if (!addressId) {
    throw new Error("Navlungo gonderici adresi olusturuldu ama address id donmedi.");
  }
  await setTextAppSetting(NAVLUNGO_SENDER_ADDRESS_SETTING_KEY, addressId);
  return addressId;
}

async function getNavlungoSenderAddressId() {
  const explicitAddressId = String(NAVLUNGO_SENDER_ADDRESS_ID ?? "").trim();
  if (explicitAddressId) {
    return explicitAddressId;
  }

  const cachedAddressId = await getTextAppSetting(NAVLUNGO_SENDER_ADDRESS_SETTING_KEY, "");
  if (cachedAddressId) {
    return cachedAddressId;
  }

  const senderAddresses = await listNavlungoSenderAddresses();
  if (hasNavlungoSenderCreateConfig) {
    const configuredAddress = senderAddresses.find((address) => doesNavlungoSenderAddressMatchConfig(address)) ?? null;
    const configuredAddressId = extractNavlungoAddressId(configuredAddress);
    if (configuredAddressId) {
      await setTextAppSetting(NAVLUNGO_SENDER_ADDRESS_SETTING_KEY, configuredAddressId);
      return configuredAddressId;
    }

    return createNavlungoSenderAddress();
  }

  const primaryAddress =
    senderAddresses.find((address) => Number(address?.is_main_warehouse ?? 0) === 1) ?? senderAddresses[0] ?? null;
  const primaryAddressId = extractNavlungoAddressId(primaryAddress);
  if (primaryAddressId) {
    await setTextAppSetting(NAVLUNGO_SENDER_ADDRESS_SETTING_KEY, primaryAddressId);
    return primaryAddressId;
  }

  throw new Error("Navlungo gonderici adresi bulunamadi. sender address id ya da gonderici adres bilgilerini ekleyin.");
}

function buildNavlungoShipmentPayload({ order, user, deliveryAddress }) {
  const recipientPhone = normalizeNavlungoPhone(deliveryAddress?.phone || user?.phone || "");
  const recipientCity = String(deliveryAddress?.province ?? "").trim();
  const recipientDistrict = String(deliveryAddress?.district ?? "").trim();
  const recipientAddressLine = buildNavlungoRecipientAddressLine(deliveryAddress);
  const recipientName = `${String(deliveryAddress?.firstName ?? user?.firstName ?? "").trim()} ${String(
    deliveryAddress?.lastName ?? user?.lastName ?? ""
  )
    .trim()
    .trim()}`.trim();
  const senderAddressId = NAVLUNGO_SENDER_ADDRESS_ID || "";

  if (!recipientName || !recipientPhone || !recipientCity || !recipientDistrict || !recipientAddressLine) {
    throw new Error("Navlungo için teslimat adresi eksik veya geçersiz.");
  }

  return {
    platform: NAVLUNGO_PLATFORM,
    posts: [
      {
        reference_id: String(order?.id ?? "").trim(),
        carrier_id: NAVLUNGO_DEFAULT_CARRIER_ID,
        post_type: NAVLUNGO_DEFAULT_POST_TYPE,
        cod_payment_type: "",
        sender: {
          addressId: Number.isFinite(Number(senderAddressId)) ? Number(senderAddressId) : senderAddressId,
        },
        recipient: {
          name: recipientName,
          phone: recipientPhone,
          email: String(user?.email ?? "").trim(),
          address: recipientAddressLine,
          country: "tr",
          city: recipientCity,
          district: recipientDistrict,
          post_code: "",
        },
        post: {
          desi: NAVLUNGO_DEFAULT_DESI,
          package_count: NAVLUNGO_DEFAULT_PACKAGE_COUNT,
          price: "",
          note: `StilBags&Fashion siparisi #${String(order?.id ?? "").trim()}`,
        },
        custom_data_1: String(order?.id ?? "").trim(),
        custom_data_2: String(order?.couponCode ?? "").trim(),
      },
    ],
  };
}

async function upsertOrderShipmentRecord({
  orderId,
  provider = "navlungo",
  status,
  requestPayload = null,
  responsePayload = null,
  errorMessage = "",
  referenceId = "",
  postNumber = "",
  carrierName = "",
  trackingUrl = "",
  barcodeUrl = "",
}) {
  await ensureOrderShipmentsTable();
  await pool.query(
    `
    INSERT INTO order_shipments (
      id,
      order_id,
      provider,
      status,
      provider_reference_id,
      provider_post_number,
      carrier_name,
      tracking_url,
      barcode_url,
      error_message,
      request_payload_json,
      response_payload_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      provider_reference_id = VALUES(provider_reference_id),
      provider_post_number = VALUES(provider_post_number),
      carrier_name = VALUES(carrier_name),
      tracking_url = VALUES(tracking_url),
      barcode_url = VALUES(barcode_url),
      error_message = VALUES(error_message),
      request_payload_json = VALUES(request_payload_json),
      response_payload_json = VALUES(response_payload_json),
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      crypto.randomUUID(),
      orderId,
      provider,
      status,
      String(referenceId ?? "").trim() || null,
      String(postNumber ?? "").trim() || null,
      String(carrierName ?? "").trim() || null,
      sanitizeExternalHttpUrl(trackingUrl) || null,
      sanitizeExternalHttpUrl(barcodeUrl) || null,
      String(errorMessage ?? "").trim() || null,
      requestPayload == null ? null : JSON.stringify(requestPayload),
      responsePayload == null ? null : JSON.stringify(responsePayload),
    ]
  );

  const [rows] = await pool.query(
    `
    SELECT provider, status, provider_reference_id, provider_post_number, carrier_name, tracking_url, barcode_url,
           error_message, response_payload_json, created_at, updated_at
    FROM order_shipments
    WHERE order_id = ? AND provider = ?
    LIMIT 1
    `,
    [orderId, provider]
  );

  return rows.length > 0 ? mapOrderShipmentRow(rows[0]) : null;
}

async function getOrderShipmentRecord(orderId, provider = "navlungo") {
  try {
    const [rows] = await pool.query(
      `
      SELECT provider, status, provider_reference_id, provider_post_number, carrier_name, tracking_url, barcode_url,
             error_message, response_payload_json, created_at, updated_at
      FROM order_shipments
      WHERE order_id = ? AND provider = ?
      LIMIT 1
      `,
      [orderId, provider]
    );
    return rows.length > 0 ? mapOrderShipmentRow(rows[0]) : null;
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return null;
    }
    throw error;
  }
}

async function createNavlungoShipmentForOrder({ order, user, deliveryAddress, force = false }) {
  if (!isNavlungoConfigured) {
    return { skipped: true, shipment: null };
  }

  const orderId = String(order?.id ?? "").trim();
  if (!orderId) {
    throw new Error("Navlungo gönderisi için sipariş numarası eksik.");
  }

  const existingShipment = await getOrderShipmentRecord(orderId, "navlungo");
  if (existingShipment && existingShipment.status === "created" && !force) {
    return { skipped: true, shipment: existingShipment };
  }

  const senderAddressId = await getNavlungoSenderAddressId();
  const requestPayload = buildNavlungoShipmentPayload({
    order: { ...order, id: orderId },
    user,
    deliveryAddress,
  });
  requestPayload.posts[0].sender.addressId = Number.isFinite(Number(senderAddressId))
    ? Number(senderAddressId)
    : senderAddressId;

  try {
    let responsePayload;
    try {
      responsePayload = await requestNavlungoJson("post/create", {
        method: "POST",
        body: JSON.stringify(requestPayload),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!NAVLUNGO_SENDER_ADDRESS_ID && message.includes("adres")) {
        await setTextAppSetting(NAVLUNGO_SENDER_ADDRESS_SETTING_KEY, "");
        const refreshedSenderAddressId = await getNavlungoSenderAddressId();
        requestPayload.posts[0].sender.addressId = Number.isFinite(Number(refreshedSenderAddressId))
          ? Number(refreshedSenderAddressId)
          : refreshedSenderAddressId;
        responsePayload = await requestNavlungoJson("post/create", {
          method: "POST",
          body: JSON.stringify(requestPayload),
        });
      } else {
        throw error;
      }
    }

    const normalizedResponse =
      responsePayload && typeof responsePayload === "object" && responsePayload.data
        ? responsePayload.data
        : responsePayload;
    const postResponse = Array.isArray(normalizedResponse) ? normalizedResponse[0] ?? {} : normalizedResponse ?? {};
    const requestMeta = getNavlungoPostRequestMeta(requestPayload);
    const shipment = await upsertOrderShipmentRecord({
      orderId,
      provider: "navlungo",
      status: "created",
      requestPayload,
      responsePayload,
      referenceId: String(postResponse.reference_id ?? requestMeta.referenceId ?? orderId).trim(),
      postNumber: String(postResponse.post_number ?? "").trim(),
      carrierName: String(postResponse.post?.carrier_name ?? postResponse.carrier_name ?? "").trim(),
      trackingUrl: sanitizeExternalHttpUrl(postResponse.tracking_url),
      barcodeUrl: sanitizeExternalHttpUrl(postResponse.barcode_url),
    });

    console.info("Navlungo shipment created:", {
      orderId,
      referenceId: shipment?.referenceId || requestMeta.referenceId,
      postNumber: shipment?.postNumber || "",
      carrierId: requestMeta.carrierId,
      postType: requestMeta.postType,
    });

    return { skipped: false, shipment };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Navlungo gönderisi oluşturulamadı.";
    const shipment = await upsertOrderShipmentRecord({
      orderId,
      provider: "navlungo",
      status: "failed",
      requestPayload,
      errorMessage,
    });
    console.error("Navlungo shipment create failed:", {
      orderId,
      error: errorMessage,
    });
    return { skipped: false, shipment };
  }
}

async function fetchNavlungoShipmentStatus(shipment) {
  const lookupValue = String(shipment?.postNumber ?? shipment?.referenceId ?? "").trim();
  if (!lookupValue) {
    throw new Error("Navlungo durum sorgusu için post numarası veya referans bulunamadı.");
  }

  const responsePayload = await requestNavlungoJson(`post/check/${encodeURIComponent(lookupValue)}`, {
    method: "GET",
  });

  return {
    lookupValue,
    responsePayload,
    summary: extractNavlungoCheckPayload(responsePayload),
  };
}

async function syncNavlungoShipmentStatusForOrder(orderId) {
  const normalizedOrderId = String(orderId ?? "").trim();
  if (!normalizedOrderId || !isNavlungoConfigured) {
    return { skipped: true, reason: "not_configured" };
  }

  const shipment = await getOrderShipmentRecord(normalizedOrderId, "navlungo");
  if (!shipment || shipment.status !== "created") {
    return { skipped: true, reason: "shipment_not_ready" };
  }

  if (!shipment.postNumber && !shipment.referenceId) {
    return { skipped: true, reason: "missing_lookup_value" };
  }

  const { lookupValue, responsePayload, summary } = await fetchNavlungoShipmentStatus(shipment);
  const refreshedShipment = await upsertOrderShipmentRecord({
    orderId: normalizedOrderId,
    provider: "navlungo",
    status: "created",
    requestPayload: {
      source: "post/check",
      lookupValue,
    },
    responsePayload,
    referenceId: summary.referenceId || shipment.referenceId || normalizedOrderId,
    postNumber: summary.postNumber || shipment.postNumber || "",
    carrierName: summary.carrierName || shipment.carrierName || "",
    trackingUrl: summary.trackingUrl || shipment.trackingUrl || summary.carrierTrackingUrl || "",
    barcodeUrl: summary.barcodeUrl || shipment.barcodeUrl || "",
  });

  const mappedOrderStatus = mapNavlungoLifecycleStatus(summary.statusCode, summary.statusName);
  if (!mappedOrderStatus) {
    return {
      skipped: true,
      reason: "status_not_mapped",
      shipment: refreshedShipment,
      navlungoStatusCode: summary.statusCode,
      navlungoStatusName: summary.statusName,
    };
  }

  const [currentRows] = await pool.query(
    `
    SELECT status, shipping_company, shipping_tracking_no
    FROM user_orders
    WHERE id = ?
    LIMIT 1
    `,
    [normalizedOrderId]
  );

  if (currentRows.length === 0) {
    return { skipped: true, reason: "order_not_found", shipment: refreshedShipment };
  }

  const currentOrder = currentRows[0];
  const currentStatus = String(currentOrder.status ?? "processing").trim() || "processing";
  const currentShippingCompany = String(currentOrder.shipping_company ?? "").trim();
  const currentShippingTrackingNo = String(currentOrder.shipping_tracking_no ?? "").trim();
  const nextStatus = getOrderStatusRank(mappedOrderStatus) > getOrderStatusRank(currentStatus) ? mappedOrderStatus : currentStatus;
  const nextShippingCompany = String(summary.carrierName || refreshedShipment?.carrierName || currentShippingCompany).trim();
  const nextShippingTrackingNo = String(summary.postNumber || refreshedShipment?.postNumber || currentShippingTrackingNo).trim();

  const shouldUpdateStatus = nextStatus !== currentStatus;
  const shouldUpdateShipping =
    (nextShippingCompany && nextShippingCompany !== currentShippingCompany) ||
    (nextShippingTrackingNo && nextShippingTrackingNo !== currentShippingTrackingNo);

  if (!shouldUpdateStatus && !shouldUpdateShipping) {
    return {
      skipped: true,
      reason: "already_synced",
      shipment: refreshedShipment,
      navlungoStatusCode: summary.statusCode,
      navlungoStatusName: summary.statusName,
    };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE user_orders
      SET status = ?, shipping_company = ?, shipping_tracking_no = ?
      WHERE id = ?
      `,
      [nextStatus, nextShippingCompany || null, nextShippingTrackingNo || null, normalizedOrderId]
    );

    let timelineEvent = null;
    if (shouldUpdateStatus) {
      timelineEvent = await insertOrderStatusTimelineEvent(connection, {
        orderId: normalizedOrderId,
        type: nextStatus,
        note:
          nextStatus === "delivered"
            ? `Navlungo durumu teslim edildi olarak güncellendi (${summary.statusName || "Teslim Edildi"}).`
            : `Navlungo durumu kargoya verildi olarak güncellendi (${summary.statusName || "Teslim Alındı"}).`,
        shippingCompany: nextShippingCompany,
        shippingTrackingNo: nextShippingTrackingNo,
      });
    }

    await connection.commit();

    return {
      skipped: false,
      shipment: refreshedShipment,
      status: nextStatus,
      shippingCompany: nextShippingCompany,
      shippingTrackingNo: nextShippingTrackingNo,
      timelineEvent,
      navlungoStatusCode: summary.statusCode,
      navlungoStatusName: summary.statusName,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function runNavlungoShipmentStatusSync({ limit = 25 } = {}) {
  if (!isNavlungoConfigured) {
    return {
      ok: false,
      message: "Navlungo entegrasyonu aktif değil.",
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  await ensureOrderShipmentsTable();

  const [rows] = await pool.query(
    `
    SELECT s.order_id
    FROM order_shipments s
    JOIN user_orders o ON o.id = s.order_id
    WHERE s.provider = 'navlungo'
      AND s.status = 'created'
      AND o.status IN ('processing', 'shipped')
    ORDER BY s.updated_at ASC, s.created_at ASC
    LIMIT ?
    `,
    [Math.max(1, Number(limit) || 25)]
  );

  const summary = {
    ok: true,
    scanned: rows.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    message: "",
  };

  for (const row of rows) {
    const orderId = String(row.order_id ?? "").trim();
    if (!orderId) {
      summary.skipped += 1;
      continue;
    }

    try {
      const result = await syncNavlungoShipmentStatusForOrder(orderId);
      if (result?.skipped) {
        summary.skipped += 1;
      } else {
        summary.updated += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error("Navlungo shipment status sync failed:", {
        orderId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  summary.message = `Navlungo senkron tamamlandı. Taranan: ${summary.scanned}, Güncellenen: ${summary.updated}, Atlanan: ${summary.skipped}, Hatalı: ${summary.failed}`;
  return summary;
}

async function scheduleNavlungoShipmentStatusSync() {
  if (navlungoStatusSyncInFlight) {
    return navlungoStatusSyncInFlight;
  }

  navlungoStatusSyncInFlight = (async () => {
    try {
      await runNavlungoShipmentStatusSync();
    } catch (error) {
      console.error("Navlungo shipment status scheduler failed:", error instanceof Error ? error.message : error);
    } finally {
      navlungoStatusSyncInFlight = null;
      if (navlungoStatusSyncTimeout != null) {
        clearTimeout(navlungoStatusSyncTimeout);
      }
      navlungoStatusSyncTimeout = setTimeout(() => {
        void scheduleNavlungoShipmentStatusSync();
      }, NAVLUNGO_STATUS_SYNC_INTERVAL_MS);
    }
  })();

  return navlungoStatusSyncInFlight;
}

async function getOrderContextForNavlungo(orderId) {
  let orderRow = null;
  try {
    const [rows] = await pool.query(
      `
      SELECT
        o.id,
        o.user_id,
        o.total,
        o.coupon_code,
        o.shipping_first_name,
        o.shipping_last_name,
        o.shipping_phone,
        o.shipping_street,
        o.shipping_province,
        o.shipping_district,
        o.shipping_neighborhood,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM user_orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
      LIMIT 1
      `,
      [orderId]
    );
    orderRow = rows[0] ?? null;
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return null;
    }
    throw error;
  }

  if (!orderRow) {
    return null;
  }

  const [addressRows] = await pool.query(
    `
    SELECT first_name, last_name, phone, street, province, district, neighborhood, is_default, created_at
    FROM user_addresses
    WHERE user_id = ?
    ORDER BY is_default DESC, created_at DESC
    LIMIT 1
    `,
    [orderRow.user_id]
  );

  const fallbackAddressRow = addressRows[0] ?? null;
  const shippingAddressFromOrder =
    String(orderRow.shipping_street ?? "").trim() ||
    String(orderRow.shipping_district ?? "").trim() ||
    String(orderRow.shipping_province ?? "").trim() ||
    String(orderRow.shipping_neighborhood ?? "").trim()
      ? {
          firstName: String(orderRow.shipping_first_name ?? "").trim() || String(orderRow.first_name ?? "").trim(),
          lastName: String(orderRow.shipping_last_name ?? "").trim() || String(orderRow.last_name ?? "").trim(),
          phone: String(orderRow.shipping_phone ?? "").trim() || String(orderRow.phone ?? "").trim(),
          street: String(orderRow.shipping_street ?? "").trim(),
          province: String(orderRow.shipping_province ?? "").trim(),
          district: String(orderRow.shipping_district ?? "").trim(),
          neighborhood: String(orderRow.shipping_neighborhood ?? "").trim(),
          addressName: "",
        }
      : null;

  const fallbackAddress = fallbackAddressRow
    ? {
        firstName: String(fallbackAddressRow.first_name ?? "").trim() || String(orderRow.first_name ?? "").trim(),
        lastName: String(fallbackAddressRow.last_name ?? "").trim() || String(orderRow.last_name ?? "").trim(),
        phone: String(fallbackAddressRow.phone ?? "").trim() || String(orderRow.phone ?? "").trim(),
        street: String(fallbackAddressRow.street ?? "").trim(),
        province: String(fallbackAddressRow.province ?? "").trim(),
        district: String(fallbackAddressRow.district ?? "").trim(),
        neighborhood: String(fallbackAddressRow.neighborhood ?? "").trim(),
        addressName: "",
      }
    : null;

  return {
    order: {
      id: String(orderRow.id ?? "").trim(),
      total: Number(orderRow.total ?? 0),
      couponCode: String(orderRow.coupon_code ?? "").trim(),
    },
    user: {
      id: String(orderRow.user_id ?? "").trim(),
      firstName: String(orderRow.first_name ?? "").trim(),
      lastName: String(orderRow.last_name ?? "").trim(),
      email: String(orderRow.email ?? "").trim(),
      phone: String(orderRow.phone ?? "").trim(),
    },
    deliveryAddress: shippingAddressFromOrder ?? fallbackAddress,
  };
}

function splitFullName(name) {
  const normalized = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "Google", lastName: "User" };
  }
  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "User" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post("/api/auth/email/status", async (req, res) => {
  return res.status(410).json({
    message: "Bu uç güvenlik nedeniyle devre dışı bırakıldı. Lütfen doğrudan giriş veya kayıt akışını kullanın.",
  });
});

app.post("/api/auth/flow/start", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const firstName = String(req.body?.firstName ?? "").trim();
    const lastName = String(req.body?.lastName ?? "").trim();
    const gender = String(req.body?.gender ?? "").trim().toLowerCase();
    const phone = String(req.body?.phone ?? "").trim();
    const termsAccepted = Boolean(req.body?.termsAccepted);
    const normalizedGender = gender === "kadin" || gender === "erkek" ? gender : "";

    if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.authFlowStart, email)) {
      return;
    }

    if (!email || !password) {
      return res.status(400).json({ message: "E-posta ve şifre zorunludur." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ message: "Ad ve soyad zorunludur." });
    }

    if (!termsAccepted) {
      return res.status(400).json({ message: "Gizlilik Politikası ve Kullanım Koşulları onayı zorunludur." });
    }

    const [rows] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
    if (rows.length > 0) {
      return res.status(409).json({
        message: "Bu e-posta ile bir hesap zaten mevcut. Lütfen giriş yapın veya şifrenizi yenileyin.",
      });
    }

    if (!isSmtpConfigured) {
      return res.status(500).json({ message: "E-posta servisi henüz yapılandırılmamış." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`DELETE FROM email_verification_codes WHERE email = ? OR expires_at < NOW()`, [email]);
    let code = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      const codeHash = sha256(code);
      try {
        await pool.query(
          `
          INSERT INTO email_verification_codes (id, email, first_name, last_name, password_hash, gender, phone, code_hash, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
          `,
          [crypto.randomUUID(), email, firstName, lastName, passwordHash, normalizedGender, phone, codeHash]
        );
        break;
      } catch (insertError) {
        if (insertError?.code === "ER_DUP_ENTRY" && attempt < 7) {
          continue;
        }
        throw insertError;
      }
    }

    try {
      await sendEmailVerificationCodeEmail({ to: email, code });
    } catch (mailError) {
      await pool.query(`DELETE FROM email_verification_codes WHERE email = ?`, [email]);
      const lowerMailError = String(mailError?.message ?? "").toLowerCase();
      if (lowerMailError.includes("smtp") || lowerMailError.includes("auth")) {
        return res.status(500).json({
          message: "Doğrulama kodu gönderilemedi. E-posta sunucu ayarlarını kontrol edin.",
        });
      }
      return res.status(500).json({ message: "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin." });
    }
    return res.json({
      mode: "register",
      requiresVerification: true,
      message: "Doğrulama kodu e-posta adresinize gönderildi.",
    });
  } catch (error) {
    console.error("Auth flow start failed:", error?.code, error?.message || error);
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({ message: "Auth akışı için DB migration gerekli. npm run db:migrate çalıştırın." });
    }
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return res.status(500).json({ message: "Auth akışı için DB sütunları eksik. npm run db:migrate çalıştırın." });
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(500).json({ message: "Doğrulama kodu üretilirken çakışma oluştu. Lütfen tekrar deneyin." });
    }
    return res.status(500).json({ message: "İşlem başarısız." });
  }
});

app.post("/api/auth/flow/verify", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const code = String(req.body?.code ?? "").trim();
    const rememberMe = req.body?.rememberMe === undefined ? true : Boolean(req.body?.rememberMe);
    if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.authFlowVerify, email)) {
      return;
    }
    if (!email || !code) {
      return res.status(400).json({ message: "E-posta ve doğrulama kodu zorunludur." });
    }

    const codeHash = sha256(code);
    const [verifyRows] = await pool.query(
      `
      SELECT id, email, first_name, last_name, password_hash, gender, phone
      FROM email_verification_codes
      WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > NOW()
      LIMIT 1
      `,
      [email, codeHash]
    );

    if (verifyRows.length === 0) {
      const blocked = await recordRateLimitFailure(req, AUTH_SECURITY_LIMITS.authFlowVerify, email);
      if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
        return res.status(429).json({ message: AUTH_SECURITY_LIMITS.authFlowVerify.message });
      }
      return res.status(400).json({ message: "Doğrulama kodu geçersiz veya süresi dolmuş." });
    }

    const verifyRow = verifyRows[0];
    const [existing] = await pool.query(
      `SELECT id, first_name, last_name, phone FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    let userId = existing.length > 0 ? existing[0].id : null;
    const verifiedFirstName = String(verifyRow.first_name ?? "").trim();
    const verifiedLastName = String(verifyRow.last_name ?? "").trim();
    const verifiedPhone = String(verifyRow.phone ?? "").trim();

    let createdNewUser = false;
    if (!userId) {
      const fallbackFirst = verifiedFirstName || "Uye";
      const fallbackLast = verifiedLastName || "Uye";
      await pool.query(
        `
        INSERT INTO users (id, first_name, last_name, email, phone, gender, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          crypto.randomUUID(),
          fallbackFirst,
          fallbackLast,
          email,
          verifiedPhone,
          verifyRow.gender,
          verifyRow.password_hash,
        ]
      );
      const [fresh] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
      userId = fresh[0].id;
      createdNewUser = true;
    } else if (verifiedFirstName && verifiedLastName) {
      const currentFirstName = String(existing[0].first_name ?? "").trim();
      const currentLastName = String(existing[0].last_name ?? "").trim();
      const currentPhone = String(existing[0].phone ?? "").trim();
      if (
        currentFirstName !== verifiedFirstName ||
        currentLastName !== verifiedLastName ||
        (verifiedPhone && currentPhone !== verifiedPhone)
      ) {
        await pool.query(
          `
          UPDATE users
          SET first_name = ?, last_name = ?, phone = ?
          WHERE id = ?
          `,
          [verifiedFirstName, verifiedLastName, verifiedPhone || currentPhone, userId]
        );
      }
    }

    await pool.query(`UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?`, [verifyRow.id]);
    await pool.query(`DELETE FROM email_verification_codes WHERE email = ?`, [email]);

    const token = await createSession(userId, { rememberMe });
    const user = await getSessionUser(token);
    await clearRateLimitFailures(req, AUTH_SECURITY_LIMITS.authFlowVerify, email);
    if (createdNewUser && user?.email) {
      queueWelcomeEmail(req, {
        to: user.email,
        firstName: user.firstName,
        source: "auth-flow-verify",
      });
    }
    return res.json({ token, user });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({ message: "Auth akışı için DB migration gerekli. npm run db:migrate çalıştırın." });
    }
    return res.status(500).json({ message: "Doğrulama işlemi başarısız." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  return res.status(410).json({
    message: "Bu kayıt ucu devre dışı bırakıldı. Lütfen doğrulama kodlu kayıt akışını kullanın.",
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const rememberMe = req.body?.rememberMe === undefined ? true : Boolean(req.body?.rememberMe);
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.authLogin, normalizedEmail)) {
      return;
    }
    const [rows] = await pool.query(
      `
      SELECT id, first_name, last_name, email, phone, password_hash
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      const blocked = await recordRateLimitFailure(req, AUTH_SECURITY_LIMITS.authLogin, normalizedEmail);
      if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
        return res.status(429).json({ message: AUTH_SECURITY_LIMITS.authLogin.message });
      }
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const found = rows[0];
    const isValid = await bcrypt.compare(String(password), found.password_hash);
    if (!isValid) {
      const blocked = await recordRateLimitFailure(req, AUTH_SECURITY_LIMITS.authLogin, normalizedEmail);
      if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
        return res.status(429).json({ message: AUTH_SECURITY_LIMITS.authLogin.message });
      }
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = await createSession(found.id, { rememberMe });
    const user = await getSessionUser(token);
    await clearRateLimitFailures(req, AUTH_SECURITY_LIMITS.authLogin, normalizedEmail);
    return res.json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: "Login failed." });
  }
});

app.post("/api/auth/password/forgot", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "E-posta zorunludur." });
    }

    if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.passwordForgot, email)) {
      return;
    }

    if (!isSmtpConfigured) {
      return res.status(500).json({ message: "E-posta servisi henüz yapılandırılmamış." });
    }

    const genericSuccessPayload = {
      ok: true,
      message: "Eğer bu e-posta sistemimizde kayıtlıysa, şifre yenileme bağlantısı gönderilecektir.",
    };

    const [rows] = await pool.query(
      `
      SELECT id, first_name, email
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.json(genericSuccessPayload);
    }

    const user = rows[0];
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    await pool.query(
      `
      DELETE FROM password_reset_tokens
      WHERE user_id = ? OR expires_at < NOW()
      `,
      [user.id]
    );

    await pool.query(
      `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
      `,
      [crypto.randomUUID(), user.id, tokenHash, PASSWORD_RESET_TTL_MINUTES]
    );

    const resetUrl = buildPasswordResetUrl(req, rawToken);
    // Do not block the HTTP response while SMTP is sending.
    setImmediate(async () => {
      try {
        await sendPasswordResetEmail({
          to: user.email,
          firstName: user.first_name,
          resetUrl,
        });
      } catch (error) {
        console.error("Password reset email send failed:", error?.message || error);
      }
    });

    return res.json(genericSuccessPayload);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "Şifre yenileme için DB migration gerekli. npm run db:migrate çalıştırın.",
      });
    }
    return res.status(500).json({ message: "Şifre yenileme e-postası gönderilemedi." });
  }
});

app.get("/api/auth/password/reset/validate", async (req, res) => {
  try {
    const token = String(req.query?.token ?? "").trim().toLowerCase();
    if (!token) {
      return res.status(400).json({ valid: false, message: "Token zorunludur." });
    }

    const tokenHash = sha256(token);
    const [rows] = await pool.query(
      `
      SELECT id
      FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.json({ valid: false, message: "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş." });
    }

    return res.json({ valid: true });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        valid: false,
        message: "Şifre yenileme için DB migration gerekli. npm run db:migrate çalıştırın.",
      });
    }
    return res.status(500).json({ valid: false, message: "Token dogrulanamadi." });
  }
});

app.post("/api/auth/password/reset", async (req, res) => {
  try {
    const token = String(req.body?.token ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const confirmPassword = String(req.body?.confirmPassword ?? "");

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: "Tum alanlar zorunludur." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Şifreler eşleşmiyor." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });
    }

    const tokenHash = sha256(token);
    const [tokenRows] = await pool.query(
      `
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    if (tokenRows.length === 0) {
      return res.status(400).json({ message: "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş." });
    }

    const resetTokenRow = tokenRows[0];
    const [userRows] = await pool.query(
      `
      SELECT password_hash
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [resetTokenRow.user_id]
    );
    if (userRows.length === 0) {
      return res.status(400).json({ message: "Kullanici bulunamadi." });
    }

    const isSameAsCurrent = await bcrypt.compare(password, userRows[0].password_hash);
    if (isSameAsCurrent) {
      return res.status(400).json({ message: "Yeni sifre mevcut sifre ile ayni olamaz." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, resetTokenRow.user_id]);
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`,
      [resetTokenRow.id]
    );
    await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [resetTokenRow.user_id]);
    await pool.query(`DELETE FROM user_sessions WHERE user_id = ?`, [resetTokenRow.user_id]);

    return res.json({ ok: true, message: "Şifreniz başarıyla güncellendi." });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "Şifre yenileme için DB migration gerekli. npm run db:migrate çalıştırın.",
      });
    }
    return res.status(500).json({ message: "Şifre sıfırlama işlemi başarısız." });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body ?? {};
    const rememberMe = req.body?.rememberMe === undefined ? true : Boolean(req.body?.rememberMe);
    if (!credential) {
      return res.status(400).json({ message: "Google kimlik bilgisi zorunludur." });
    }

    if (!googleOAuthClient || GOOGLE_CLIENT_IDS.length === 0) {
      return res.status(500).json({ message: "Google ile giriş henüz yapılandırılmamış." });
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: String(credential),
      audience: GOOGLE_CLIENT_IDS,
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email ?? "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ message: "Geçersiz Google hesabı." });
    }

    if (payload?.email_verified === false) {
      return res.status(401).json({ message: "Google e-posta hesabı doğrulanmamış." });
    }

    const [existing] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
    let userId = existing.length > 0 ? existing[0].id : null;

    let createdNewUser = false;
    if (!userId) {
      const nameFromGoogle = splitFullName(payload?.name ?? "");
      const firstName = String(payload?.given_name ?? "").trim() || nameFromGoogle.firstName;
      const lastName = String(payload?.family_name ?? "").trim() || nameFromGoogle.lastName;
      const generatedPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      userId = crypto.randomUUID();

      await pool.query(
        `
        INSERT INTO users (id, first_name, last_name, email, phone, password_hash)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [userId, firstName, lastName, email, "", generatedPasswordHash]
      );
      createdNewUser = true;
    }

    const token = await createSession(userId, { rememberMe });
    const user = await getSessionUser(token);
    if (createdNewUser && user?.email) {
      queueWelcomeEmail(req, {
        to: user.email,
        firstName: user.firstName,
        source: "google-auth",
      });
    }
    return res.json({ token, user });
  } catch (error) {
    console.error("Google auth error:", error);
    const rawMessage = String(error?.message ?? "").toLowerCase();
    if (rawMessage.includes("audience")) {
      return res.status(401).json({ message: "Google client id uyuşmuyor." });
    }
    if (rawMessage.includes("token used too early")) {
      return res.status(401).json({ message: "Cihaz veya sunucu saati geri. Saati otomatik senkronize edip tekrar deneyin." });
    }
    if (rawMessage.includes("token used too late") || rawMessage.includes("expired")) {
      return res.status(401).json({ message: "Google token süresi dolmuş. Tekrar deneyin." });
    }
    return res.status(401).json({ message: "Google ile giriş başarısız." });
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM user_sessions WHERE token = ?`, [req.authToken]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  return res.json({ user: req.authUser });
});

app.put("/api/auth/profile", requireAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body ?? {};
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "First name, last name and email are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [emailOwner] = await pool.query(
      `SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1`,
      [normalizedEmail, req.authUser.id]
    );
    if (emailOwner.length > 0) {
      return res.status(409).json({ message: "This email is already in use." });
    }

    await pool.query(
      `
      UPDATE users
      SET first_name = ?, last_name = ?, email = ?, phone = ?
      WHERE id = ?
      `,
      [
        String(firstName).trim(),
        String(lastName).trim(),
        normalizedEmail,
        String(phone ?? "").trim(),
        req.authUser.id,
      ]
    );

    const user = await getSessionUser(req.authToken);
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Profile update failed." });
  }
});

app.post("/api/auth/addresses", requireAuth, async (req, res) => {
  try {
    const { error, value } = normalizeAddressInput(req.body ?? {});
    if (error) return res.status(400).json({ message: error });

    if (value.isDefault) {
      await pool.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?`, [
        req.authUser.id,
      ]);
    }

    await pool.query(
      `
      INSERT INTO user_addresses (
        id, user_id, first_name, last_name, phone, street, province, district, neighborhood, is_default
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        req.authUser.id,
        value.firstName,
        value.lastName,
        value.phone,
        value.street,
        value.province,
        value.district,
        value.neighborhood,
        value.isDefault,
      ]
    );

    const user = await getSessionUser(req.authToken);
    return res.status(201).json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Address save failed." });
  }
});

app.put("/api/auth/addresses/:id", requireAuth, async (req, res) => {
  try {
    const { error, value } = normalizeAddressInput(req.body ?? {});
    if (error) return res.status(400).json({ message: error });

    if (value.isDefault) {
      await pool.query(`UPDATE user_addresses SET is_default = FALSE WHERE user_id = ? AND id <> ?`, [
        req.authUser.id,
        req.params.id,
      ]);
    }

    const [result] = await pool.query(
      `
      UPDATE user_addresses
      SET first_name = ?, last_name = ?, phone = ?, street = ?, province = ?, district = ?, neighborhood = ?, is_default = ?
      WHERE id = ? AND user_id = ?
      `,
      [
        value.firstName,
        value.lastName,
        value.phone,
        value.street,
        value.province,
        value.district,
        value.neighborhood,
        value.isDefault,
        req.params.id,
        req.authUser.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Address not found." });
    }

    const user = await getSessionUser(req.authToken);
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Address update failed." });
  }
});

app.delete("/api/auth/addresses/:id", requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(`DELETE FROM user_addresses WHERE id = ? AND user_id = ?`, [
      req.params.id,
      req.authUser.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Address not found." });
    }
    const user = await getSessionUser(req.authToken);
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Address delete failed." });
  }
});

app.get("/api/cart", requireAuth, async (req, res) => {
  try {
    const items = await getUserCartItems(req.authUser.id);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: "Cart fetch failed." });
  }
});

app.put("/api/cart", requireAuth, async (req, res) => {
  const inputItems = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!inputItems) {
    return res.status(400).json({ message: "Cart items are required." });
  }

  const normalizedItems = [];
  for (const item of inputItems) {
    const productId = String(item?.productId ?? "").trim();
    const quantity = Number(item?.quantity);
    const color = item?.color == null ? null : String(item.color).trim();

    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Invalid cart item." });
    }

    normalizedItems.push({ productId, quantity, color });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM user_cart_items WHERE user_id = ?`, [req.authUser.id]);

    if (normalizedItems.length > 0) {
      const valuesSql = normalizedItems.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const params = normalizedItems.flatMap((item) => [
        crypto.randomUUID(),
        req.authUser.id,
        item.productId,
        item.quantity,
        item.color,
      ]);

      await connection.query(
        `
        INSERT INTO user_cart_items (id, user_id, product_id, quantity, color)
        VALUES ${valuesSql}
        `,
        params
      );
    }

    await connection.commit();
    const items = await getUserCartItems(req.authUser.id);
    return res.json({ items });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Cart save failed." });
  } finally {
    connection.release();
  }
});

app.get("/api/wishlist", requireAuth, async (req, res) => {
  try {
    const items = await getUserWishlistItems(req.authUser.id);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: "Wishlist fetch failed." });
  }
});

app.put("/api/wishlist", requireAuth, async (req, res) => {
  const inputItems = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!inputItems) {
    return res.status(400).json({ message: "Wishlist items are required." });
  }

  const productIds = [];
  for (const item of inputItems) {
    const productId = String(item?.productId ?? "").trim();
    if (!productId) {
      return res.status(400).json({ message: "Invalid wishlist item." });
    }
    productIds.push(productId);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM user_wishlist_items WHERE user_id = ?`, [req.authUser.id]);

    if (productIds.length > 0) {
      const valuesSql = productIds.map(() => "(?, ?, ?)").join(", ");
      const params = productIds.flatMap((productId) => [crypto.randomUUID(), req.authUser.id, productId]);

      await connection.query(
        `
        INSERT INTO user_wishlist_items (id, user_id, product_id)
        VALUES ${valuesSql}
        `,
        params
      );
    }

    await connection.commit();
    const items = await getUserWishlistItems(req.authUser.id);
    return res.json({ items });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Wishlist save failed." });
  } finally {
    connection.release();
  }
});

app.get("/api/orders", requireAuth, async (req, res) => {
  try {
    const orders = await getUserOrders(req.authUser.id);
    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({ message: "Orders fetch failed." });
  }
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const { merchantOid, shippingAddress, couponCode } = req.body ?? {};
  const normalizedMerchantOid = String(merchantOid ?? "").trim();
  const shipping = shippingAddress && typeof shippingAddress === "object" ? shippingAddress : {};
  const shippingAddressName = String(shipping.addressName ?? "").trim();
  const shippingFirstName = String(shipping.firstName ?? "").trim();
  const shippingLastName = String(shipping.lastName ?? "").trim();
  const shippingPhone = String(shipping.phone ?? "").trim();
  const shippingStreet = String(shipping.street ?? "").trim();
  const shippingProvince = String(shipping.province ?? "").trim();
  const shippingDistrict = String(shipping.district ?? "").trim();
  const shippingNeighborhood = String(shipping.neighborhood ?? "").trim();
  const orderStatus = "processing";
  const orderDate = new Date().toISOString();

  if (!normalizedMerchantOid) {
    return res.status(400).json({ message: "Ödeme doğrulama bilgisi eksik." });
  }

  const paymentIntent = await getPaytrPaymentIntent(normalizedMerchantOid, req.authUser.id);
  if (!paymentIntent) {
    return res.status(404).json({ message: "Ödeme oturumu bulunamadı." });
  }
  if (String(paymentIntent.status ?? "").trim() === "consumed" || paymentIntent.consumed_at) {
    return res.status(409).json({ message: "Bu ödeme oturumu daha önce kullanılmış." });
  }

  const serverCartItems = await getUserCartItems(req.authUser.id);
  if (serverCartItems.length === 0) {
    return res.status(400).json({ message: "Invalid order payload." });
  }
  const trustedOrderItems = serverCartItems;

  const normalizedItems = [];
  for (const item of trustedOrderItems) {
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || !item?.product) {
      return res.status(400).json({ message: "Invalid order item payload." });
    }
    normalizedItems.push({
      productJson: JSON.stringify(item.product),
      quantity,
      color: item?.color == null ? null : String(item.color).trim(),
    });
  }

  const subtotal = getCartSubtotal(trustedOrderItems);
  const shippingTotal = getCartShippingAmount(subtotal);
  const coupon = normalizeCustomerCouponCode(couponCode)
    ? await resolveAnyCoupon({ code: couponCode, cartItems: trustedOrderItems, userId: req.authUser.id })
    : null;
  if (coupon && !coupon.valid) {
    return res.status(400).json({ message: coupon.reason || "Kupon geçersiz." });
  }
  const discountTotal = coupon?.valid ? coupon.discountAmount : 0;
  const orderTotal = Math.max(0, subtotal + shippingTotal - discountTotal);
  const expectedCartSignature = buildCartIntegritySignature(trustedOrderItems);
  const expectedShippingSignature = buildShippingIntegritySignature({
    addressName: shippingAddressName,
    firstName: shippingFirstName,
    lastName: shippingLastName,
    phone: shippingPhone,
    street: shippingStreet,
    province: shippingProvince,
    district: shippingDistrict,
    neighborhood: shippingNeighborhood,
  });
  const expectedPaymentAmount = Math.round(orderTotal * 100);
  const expectedCouponCode = coupon?.valid ? coupon.code : "";

  if (
    String(paymentIntent.cart_signature ?? "") !== expectedCartSignature ||
    String(paymentIntent.shipping_signature ?? "") !== expectedShippingSignature ||
    Number(paymentIntent.amount ?? 0) !== expectedPaymentAmount ||
    String(paymentIntent.coupon_code ?? "") !== expectedCouponCode
  ) {
    return res.status(409).json({
      message: "Ödeme oturumu ile sipariş içeriği eşleşmiyor. Lütfen ödemeyi yeniden başlatın.",
    });
  }

  let paytrStatusResult;
  try {
    paytrStatusResult = await queryPaytrPaymentStatus(normalizedMerchantOid);
  } catch (error) {
    await markPaytrPaymentIntentChecked(normalizedMerchantOid, {
      status: "pending",
      paytrStatus: "check_failed",
    });
    return res.status(409).json({
      message: "Ödeme henüz doğrulanamadı. Lütfen birkaç saniye sonra tekrar deneyin.",
    });
  }

  if (String(paytrStatusResult.paytrStatus ?? "") !== "success") {
    await markPaytrPaymentIntentChecked(normalizedMerchantOid, {
      status: "pending",
      paytrStatus: paytrStatusResult.paytrStatus || "pending",
      paymentType: paytrStatusResult.paymentType || null,
    });
    return res.status(409).json({
      message: "Ödeme henüz onaylanmadı. Sipariş oluşturulmadı.",
    });
  }

  if (Number(paytrStatusResult.paymentAmount ?? 0) !== expectedPaymentAmount) {
    await markPaytrPaymentIntentChecked(normalizedMerchantOid, {
      status: "failed",
      paytrStatus: "amount_mismatch",
      paymentType: paytrStatusResult.paymentType || null,
    });
    return res.status(409).json({
      message: "Ödeme tutarı doğrulanamadı. Sipariş oluşturulmadı.",
    });
  }

  const orderId = String(Math.floor(1000000000 + Math.random() * 9000000000));

  const createdOrder = {
    id: orderId,
    date: orderDate,
    total: Math.round(orderTotal),
    subtotal,
    shippingTotal,
    discountTotal,
    couponCode: coupon?.valid ? coupon.code : "",
    status: orderStatus,
    items: trustedOrderItems.map((item) => ({
      product: normalizeProductMedia(item.product),
      quantity: Number(item.quantity),
      color: item?.color == null ? undefined : String(item.color).trim(),
    })),
    shippingCompany: "",
    shippingTrackingNo: "",
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    try {
      await connection.query(
        `
        INSERT INTO user_orders (
          id, user_id, order_date, total, status,
          subtotal_total, shipping_total, discount_total, coupon_code,
          shipping_first_name, shipping_last_name, shipping_phone, shipping_street, shipping_province, shipping_district, shipping_neighborhood
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          req.authUser.id,
          orderDate,
          Math.round(orderTotal),
          orderStatus,
          subtotal,
          shippingTotal,
          discountTotal,
          coupon?.valid ? coupon.code : null,
          shippingFirstName,
          shippingLastName,
          shippingPhone,
          shippingStreet,
          shippingProvince,
          shippingDistrict,
          shippingNeighborhood,
        ]
      );
    } catch (error) {
      // Backward compatible for DBs not yet migrated with shipping snapshot fields.
      if (error?.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }
      await connection.query(
        `
        INSERT INTO user_orders (id, user_id, order_date, total, status)
        VALUES (?, ?, ?, ?, ?)
        `,
        [orderId, req.authUser.id, orderDate, Math.round(orderTotal), orderStatus]
      );
    }

    await insertOrderStatusTimelineEvent(connection, {
      orderId,
      type: "created",
      note: "Sipariş müşteriden alındı.",
    });

    const valuesSql = normalizedItems.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const params = normalizedItems.flatMap((item) => [
      crypto.randomUUID(),
      orderId,
      item.productJson,
      item.quantity,
      item.color,
    ]);
    await connection.query(
      `
      INSERT INTO user_order_items (id, order_id, product_json, quantity, color)
      VALUES ${valuesSql}
      `,
      params
    );

    await recordCustomerCouponRedemption(connection, {
      coupon,
      userId: req.authUser.id,
      orderId,
      discountAmount: discountTotal,
    });

    // Keep order creation and cart cleanup atomic:
    // if order is committed, user's server-side cart is guaranteed to be empty.
    await connection.query(`DELETE FROM user_cart_items WHERE user_id = ?`, [req.authUser.id]);

    await connection.query(
      `
      UPDATE paytr_payment_intents
      SET
        status = 'consumed',
        paytr_status = ?,
        paytr_payment_type = ?,
        order_id = ?,
        consumed_at = NOW(),
        last_checked_at = NOW()
      WHERE merchant_oid = ? AND user_id = ?
      `,
      [
        paytrStatusResult.paytrStatus || "success",
        paytrStatusResult.paymentType || null,
        orderId,
        normalizedMerchantOid,
        req.authUser.id,
      ]
    );

    await connection.commit();

    const fallbackAddress =
      req.authUser.addresses.find((address) => address.isDefault) ?? req.authUser.addresses[0] ?? null;
    const fallbackStreet = String(fallbackAddress?.street ?? "");
    const [fallbackAddressName, fallbackAddressDetail] = fallbackStreet.split("|||");
    const normalizedFallbackAddress = fallbackAddress
      ? {
          ...fallbackAddress,
          addressName: String(fallbackAddressName ?? "").trim(),
          street: String(fallbackAddressDetail ?? "").trim() || String(fallbackAddressName ?? "").trim(),
        }
      : null;

    const hasShippingAddressSnapshot = Boolean(
      shippingAddressName || shippingStreet || shippingProvince || shippingDistrict || shippingNeighborhood
    );
    const deliveryAddress = hasShippingAddressSnapshot
      ? {
          addressName: shippingAddressName || normalizedFallbackAddress?.addressName || "",
          firstName: shippingFirstName || normalizedFallbackAddress?.firstName || req.authUser.firstName,
          lastName: shippingLastName || normalizedFallbackAddress?.lastName || req.authUser.lastName,
          phone: shippingPhone || normalizedFallbackAddress?.phone || req.authUser.phone || "",
          street: shippingStreet || normalizedFallbackAddress?.street || "",
          province: shippingProvince || normalizedFallbackAddress?.province || "",
          district: shippingDistrict || normalizedFallbackAddress?.district || "",
          neighborhood: shippingNeighborhood || normalizedFallbackAddress?.neighborhood || "",
        }
      : normalizedFallbackAddress;

    if (isOrderSmtpConfigured) {
      sendOrderConfirmationEmail(req, {
        to: req.authUser.email,
        firstName: req.authUser.firstName,
        order: createdOrder,
        deliveryAddress,
      }).catch((error) => {
        console.error("Order confirmation email send failed:", error?.message || error);
      });
    }

    if (isWhatsappConfigured) {
      sendOrderWhatsappNotification({
        order: createdOrder,
        deliveryAddress,
      }).catch((error) => {
        console.error("Order WhatsApp notification failed:", error?.message || error);
      });
    }

    if (deliveryAddress) {
      createNavlungoShipmentForOrder({
        order: createdOrder,
        user: req.authUser,
        deliveryAddress,
      }).catch((error) => {
        console.error("Navlungo shipment queue failed:", error?.message || error);
      });
    }

    return res.status(201).json({ order: createdOrder });
  } catch (error) {
    await connection.rollback();
    if (Number(error?.statusCode || 0) >= 400) {
      return res.status(Number(error.statusCode)).json({ message: error.message || "İstek başarısız." });
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Order already exists." });
    }
    return res.status(500).json({ message: "Order create failed." });
  } finally {
    connection.release();
  }
});

app.post("/api/paytr/token", requireAuth, async (req, res) => {
  try {
    const merchantId = process.env.PAYTR_MERCHANT_ID;
    const merchantKey = process.env.PAYTR_MERCHANT_KEY;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
    const baseMerchantOkUrl = normalizePaytrReturnUrl(process.env.PAYTR_OK_URL, "/odeme/basarili");
    const baseMerchantFailUrl = normalizePaytrReturnUrl(process.env.PAYTR_FAIL_URL, "/odeme/basarisiz");
    const testMode = String(process.env.PAYTR_TEST_MODE ?? "1");

    if (!merchantId || !merchantKey || !merchantSalt || !baseMerchantOkUrl || !baseMerchantFailUrl) {
      return res.status(500).json({ message: "PAYTR env settings are missing." });
    }

    const { email, firstName, lastName, phone, street, province, district, neighborhood, addressName, couponCode } = req.body ?? {};
    const normalizedEmail = String(email ?? "").trim();
    const normalizedFirstName = String(firstName ?? "").trim();
    const normalizedLastName = String(lastName ?? "").trim();
    const normalizedPhone = String(phone ?? "").trim();
    const normalizedAddressName = String(addressName ?? "").trim();
    const normalizedStreet = String(street ?? "").trim();
    const normalizedProvince = String(province ?? "").trim();
    const normalizedDistrict = String(district ?? "").trim();
    const normalizedNeighborhood = String(neighborhood ?? "").trim();
    const orderItems = await getUserCartItems(req.authUser.id);
    const subtotal = getCartSubtotal(orderItems);
    const shippingAmount = getCartShippingAmount(subtotal);
    const coupon = normalizeCustomerCouponCode(couponCode)
      ? await resolveAnyCoupon({ code: couponCode, cartItems: orderItems, userId: req.authUser.id })
      : null;
    if (coupon && !coupon.valid) {
      return res.status(400).json({ message: coupon.reason || "Kupon geçersiz." });
    }
    const discountAmount = coupon?.valid ? coupon.discountAmount : 0;
    const amount = subtotal + shippingAmount - discountAmount;

    if (
      !normalizedEmail ||
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedPhone ||
      !normalizedStreet ||
      !normalizedProvince ||
      !normalizedDistrict ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      orderItems.length === 0
    ) {
      return res.status(400).json({ message: "Invalid payment request payload." });
    }

    const paymentAmount = Math.round(amount * 100);
    const userBasketRaw = orderItems.map((item) => [
      String(item?.product?.name ?? "").slice(0, 120),
      Number(item?.product?.price ?? 0).toFixed(2),
      Math.max(1, Number(item?.quantity ?? 1) || 1),
    ]);
    const userBasket = Buffer.from(JSON.stringify(userBasketRaw), "utf8").toString("base64");

    const userIp = getClientIp(req);
    const merchantOid = `OID${Date.now()}${Math.floor(Math.random() * 1000000)}`;
    const merchantOkUrl = appendQueryParamToUrl(baseMerchantOkUrl, "merchantOid", merchantOid);
    const merchantFailUrl = appendQueryParamToUrl(baseMerchantFailUrl, "merchantOid", merchantOid);
    const noInstallment = "0";
    const maxInstallment = "0";
    const currency = "TL";
    const non3dTestFailed = "0";
    const debugOn = "1";
    const userName = `${normalizedFirstName} ${normalizedLastName}`.trim();
    const userAddress = `${normalizedStreet}, ${normalizedDistrict}/${normalizedProvince}`;

    const hashStr = `${merchantId}${userIp}${merchantOid}${normalizedEmail}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;
    const paytrToken = crypto
      .createHmac("sha256", merchantKey)
      .update(hashStr + merchantSalt)
      .digest("base64");

    const formData = new URLSearchParams({
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email: normalizedEmail,
      payment_amount: String(paymentAmount),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: debugOn,
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: userName,
      user_address: userAddress,
      user_phone: normalizedPhone,
      merchant_ok_url: merchantOkUrl,
      merchant_fail_url: merchantFailUrl,
      timeout_limit: "30",
      currency,
      test_mode: testMode,
      lang: "tr",
      non_3d: "0",
      non3d_test_failed: non3dTestFailed,
    });

    const paytrResponse = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });

    const paytrJson = await paytrResponse.json().catch(() => null);
    if (!paytrResponse.ok || !paytrJson || paytrJson.status !== "success" || !paytrJson.token) {
      return res.status(400).json({
        message: "PAYTR token alınamadı.",
        reason: paytrJson?.reason || `HTTP ${paytrResponse.status}`,
      });
    }

    await upsertPaytrPaymentIntent({
      merchantOid,
      userId: req.authUser.id,
      cartSignature: buildCartIntegritySignature(orderItems),
      shippingSignature: buildShippingIntegritySignature({
        addressName: normalizedAddressName,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: normalizedPhone,
        street: normalizedStreet,
        province: normalizedProvince,
        district: normalizedDistrict,
        neighborhood: normalizedNeighborhood,
      }),
      couponCode: coupon?.valid ? coupon.code : "",
      amount: paymentAmount,
      currency,
    });

    return res.json({
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${paytrJson.token}`,
      token: paytrJson.token,
      merchantOid,
    });
  } catch (error) {
    return res.status(500).json({ message: "PAYTR token request failed." });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const subject = String(req.body?.subject ?? "").trim();
    const message = String(req.body?.message ?? "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "Tüm alanlar zorunludur." });
    }

    await ensureContactRequestsTable();
    await pool.query(
      `
      INSERT INTO contact_requests (id, name, email, subject, message)
      VALUES (?, ?, ?, ?, ?)
      `,
      [crypto.randomUUID(), name, email, subject, message]
    );

    return res.json({ ok: true, message: "Mesajınız alındı." });
  } catch (error) {
    return res.status(500).json({ message: "İletişim talebi kaydedilemedi." });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const adminPairs = [
    {
      email: String(process.env.ADMIN_PANEL_EMAIL ?? "").trim().toLowerCase(),
      password: String(process.env.ADMIN_PANEL_PASSWORD ?? ""),
    },
    {
      email: String(process.env.ADMIN_PANEL_EMAIL_2 ?? "").trim().toLowerCase(),
      password: String(process.env.ADMIN_PANEL_PASSWORD_2 ?? ""),
    },
  ].filter((pair) => pair.email && pair.password);

  if (adminPairs.length === 0) {
    return res.status(500).json({ message: "Admin env settings are missing." });
  }

  const { email, password, rememberMe } = req.body ?? {};
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedPassword = String(password ?? "");
  const normalizedRememberMe = rememberMe === undefined ? true : Boolean(rememberMe);

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.adminLogin, normalizedEmail)) {
    return;
  }

  const matched = adminPairs.some(
    (pair) =>
      timingSafeStringEqual(pair.email, normalizedEmail) &&
      timingSafeStringEqual(pair.password, normalizedPassword)
  );

  if (!matched) {
    const blocked = await recordRateLimitFailure(req, AUTH_SECURITY_LIMITS.adminLogin, normalizedEmail);
    if (blocked) {
      res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
      return res.status(429).json({ message: AUTH_SECURITY_LIMITS.adminLogin.message });
    }
    return res.status(401).json({ message: "Invalid admin credentials." });
  }

  const session = await createAdminSession(normalizedEmail, {
    rememberMe: normalizedRememberMe,
  });
  await clearRateLimitFailures(req, AUTH_SECURITY_LIMITS.adminLogin, normalizedEmail);

  return res.json({
    token: session.token,
    rememberMe: normalizedRememberMe,
    expiresAt: session.expiresAt.toISOString(),
  });
});

app.get("/api/admin/me", requireAdminAuth, async (req, res) => {
  return res.json({ ok: true, rememberMe: Boolean(req.adminSession?.rememberMe) });
});

app.post("/api/admin/logout", requireAdminAuth, async (req, res) => {
  await deleteAdminSession(req.adminToken);
  return res.json({ ok: true });
});

app.get("/api/settings", async (_req, res) => {
  try {
    const cacheKey = "settings:public";
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      return res.json(cached);
    }
    const siteName = await getSiteNameSetting();
    const payload = await setCachedResponse(cacheKey, { siteName }, CACHE_TTL_MS.settings);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Settings fetch failed." });
  }
});

app.get("/api/admin/settings", requireAdminAuth, async (_req, res) => {
  try {
    const siteName = await getSiteNameSetting();
    return res.json({ siteName });
  } catch (error) {
    return res.status(500).json({ message: "Admin settings fetch failed." });
  }
});

app.put("/api/admin/settings", requireAdminAuth, async (req, res) => {
  try {
    const siteName = String(req.body?.siteName ?? "").trim();
    if (!siteName) {
      return res.status(400).json({ message: "Site ismi zorunludur." });
    }
    if (siteName.length > 80) {
      return res.status(400).json({ message: "Site ismi en fazla 80 karakter olabilir." });
    }
    await setSiteNameSetting(siteName);
    await invalidateSettingsCache();
    return res.json({ siteName });
  } catch (error) {
    return res.status(500).json({ message: "Admin settings update failed." });
  }
});

app.get("/api/admin/marketing/abandoned-cart", requireAdminAuth, async (_req, res) => {
  try {
    const [settings, stats] = await Promise.all([
      getAbandonedCartSettings(),
      getAbandonedCartCampaignStats(),
    ]);
    return res.json({
      settings,
      stats,
    });
  } catch (error) {
    return res.status(500).json({ message: "Abandoned cart kampanya ayarları alınamadı." });
  }
});

app.post("/api/marketing/abandoned-cart/coupon/apply", requireAuth, async (req, res) => {
  try {
    if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.couponApply)) {
      return;
    }
    const code = normalizeCustomerCouponCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ message: "Kupon kodu zorunludur." });
    }

    const cartItems = await getUserCartItems(req.authUser.id);
    if (cartItems.length === 0) {
      return res.status(400).json({ message: "Sepetiniz boş." });
    }

    const coupon = await resolveAnyCoupon({ code, cartItems, userId: req.authUser.id });
    if (!coupon?.valid) {
      const blocked = await recordRateLimitFailure(req, AUTH_SECURITY_LIMITS.couponApply);
      if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
        return res.status(429).json({ message: AUTH_SECURITY_LIMITS.couponApply.message });
      }
      return res.status(400).json({
        message: coupon?.reason || "Kupon kodu geçersiz veya şu anda aktif değil.",
      });
    }

    return res.json({ coupon });
  } catch (error) {
    return res.status(500).json({ message: "Kupon doğrulanamadı." });
  }
});

app.post("/api/coupons/apply", async (req, res) => {
  try {
    if (await enforceRateLimit(req, res, AUTH_SECURITY_LIMITS.couponApply)) {
      return;
    }
    const code = normalizeCustomerCouponCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ message: "Kupon kodu zorunludur." });
    }

    const cartItems = await getCouponRequestCartItems(req.body?.items);
    if (cartItems.length === 0) {
      return res.status(400).json({ message: "Sepetiniz boş." });
    }

    const coupon = await resolveAnyCoupon({ code, cartItems });
    if (!coupon?.valid) {
      const blocked = await recordRateLimitFailure(req, AUTH_SECURITY_LIMITS.couponApply);
      if (blocked) {
        res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
        return res.status(429).json({ message: AUTH_SECURITY_LIMITS.couponApply.message });
      }
      return res.status(400).json({
        message: coupon?.reason || "Kupon kodu geçersiz veya şu anda aktif değil.",
      });
    }

    return res.json({ coupon });
  } catch (error) {
    return res.status(500).json({ message: "Kupon doğrulanamadı." });
  }
});

app.get("/api/admin/coupons", requireAdminAuth, async (_req, res) => {
  try {
    const coupons = await listCustomerCoupons();
    return res.json({ coupons });
  } catch (error) {
    return res.status(500).json({ message: "Kuponlar alınamadı." });
  }
});

app.post("/api/admin/coupons", requireAdminAuth, async (req, res) => {
  try {
    const rawCouponInput = req.body ?? {};
    const couponInput = sanitizeCustomerCouponSettings(rawCouponInput);
    if (!String(couponInput.code ?? "").trim()) {
      return res.status(400).json({ message: "Kupon kodu zorunludur." });
    }
    if (!Number.isFinite(Number(couponInput.value)) || Number(couponInput.value) <= 0) {
      return res.status(400).json({ message: "Kupon değeri 0'dan büyük olmalıdır." });
    }
    const validationMessage = validateCustomerCouponSettingsInput(rawCouponInput, couponInput);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const coupon = await createCustomerCoupon(couponInput);
    if (!coupon) {
      return res.status(500).json({ message: "Kupon oluşturulamadı." });
    }
    return res.status(201).json({ coupon });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Bu kupon kodu zaten kullanılıyor." });
    }
    return res.status(500).json({ message: "Kupon oluşturulamadı." });
  }
});

app.put("/api/admin/coupons/:id", requireAdminAuth, async (req, res) => {
  try {
    const couponId = String(req.params.id ?? "").trim();
    if (!couponId) {
      return res.status(400).json({ message: "Geçersiz kupon." });
    }

    const rawCouponInput = req.body ?? {};
    const couponInput = sanitizeCustomerCouponSettings(rawCouponInput);
    if (!String(couponInput.code ?? "").trim()) {
      return res.status(400).json({ message: "Kupon kodu zorunludur." });
    }
    if (!Number.isFinite(Number(couponInput.value)) || Number(couponInput.value) <= 0) {
      return res.status(400).json({ message: "Kupon değeri 0'dan büyük olmalıdır." });
    }
    const validationMessage = validateCustomerCouponSettingsInput(rawCouponInput, couponInput);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const coupon = await updateCustomerCoupon(couponId, couponInput);
    if (!coupon) {
      return res.status(404).json({ message: "Kupon bulunamadı." });
    }
    return res.json({ coupon });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Bu kupon kodu zaten kullanılıyor." });
    }
    return res.status(500).json({ message: "Kupon güncellenemedi." });
  }
});

app.delete("/api/admin/coupons/:id", requireAdminAuth, async (req, res) => {
  try {
    const couponId = String(req.params.id ?? "").trim();
    if (!couponId) {
      return res.status(400).json({ message: "Geçersiz kupon." });
    }

    const deleted = await deleteCustomerCoupon(couponId);
    if (!deleted) {
      return res.status(404).json({ message: "Kupon bulunamadı." });
    }
    return res.json({ ok: true });
  } catch (error) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({ message: "Kullanılmış kupon silinemez. Kuponu pasif hale getirin." });
    }
    return res.status(500).json({ message: "Kupon silinemedi." });
  }
});

app.get("/api/admin/marketing/customer-coupon", requireAdminAuth, async (_req, res) => {
  try {
    const coupons = await listCustomerCoupons();
    const settings = coupons[0] ?? { ...DEFAULT_CUSTOMER_COUPON_SETTINGS };
    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({ message: "Müşteri kupon ayarları alınamadı." });
  }
});

app.put("/api/admin/marketing/customer-coupon", requireAdminAuth, async (req, res) => {
  try {
    const rawSettings = req.body ?? {};
    const settings = sanitizeCustomerCouponSettings(rawSettings);
    const validationMessage = validateCustomerCouponSettingsInput(rawSettings, settings);
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    if (Boolean(rawSettings?.enabled)) {
      if (!String(settings.code ?? "").trim()) {
        return res.status(400).json({ message: "Kupon kodu zorunludur." });
      }
      if (!Number.isFinite(Number(settings.value)) || Number(settings.value) <= 0) {
        return res.status(400).json({ message: "Kupon değeri 0'dan büyük olmalıdır." });
      }
    }

    const saved = String(rawSettings?.id ?? "").trim()
      ? await updateCustomerCoupon(String(rawSettings.id).trim(), settings)
      : await createCustomerCoupon(settings);
    if (!saved) {
      return res.status(404).json({ message: "Kupon bulunamadı." });
    }
    return res.json({ settings: saved });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Bu kupon kodu zaten kullanılıyor." });
    }
    return res.status(500).json({ message: "Müşteri kupon ayarları kaydedilemedi." });
  }
});

app.put("/api/admin/marketing/abandoned-cart", requireAdminAuth, async (req, res) => {
  try {
    const rawSettings = req.body ?? {};
    const settings = sanitizeAbandonedCartSettings(rawSettings);
    if (!String(settings.subject ?? "").trim()) {
      return res.status(400).json({ message: "E-posta konusu zorunludur." });
    }
    if (!String(settings.heading ?? "").trim()) {
      return res.status(400).json({ message: "Başlık zorunludur." });
    }
    if (!String(settings.body ?? "").trim()) {
      return res.status(400).json({ message: "Mesaj metni zorunludur." });
    }
    if (Boolean(rawSettings?.couponEnabled)) {
      if (!String(settings.couponCode ?? "").trim()) {
        return res.status(400).json({ message: "Kupon kodu zorunludur." });
      }
      if (!Number.isFinite(Number(settings.couponValue)) || Number(settings.couponValue) <= 0) {
        return res.status(400).json({ message: "Kupon değeri 0'dan büyük olmalıdır." });
      }
    }
    const saved = await setAbandonedCartSettings(settings);
    const stats = await getAbandonedCartCampaignStats();
    return res.json({ settings: saved, stats });
  } catch (error) {
    return res.status(500).json({ message: "Abandoned cart kampanya ayarları kaydedilemedi." });
  }
});

app.post("/api/admin/marketing/abandoned-cart/run", requireAdminAuth, async (req, res) => {
  try {
    const summary = await runAbandonedCartCampaign({ req, force: true });
    return res.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Abandoned cart kampanyası çalıştırılamadı.";
    return res.status(500).json({ message });
  }
});

app.get("/api/admin/google-merchant/status", requireAdminAuth, async (_req, res) => {
  return res.json({
    enabled: GOOGLE_MERCHANT_ENABLED,
    configured: isGoogleMerchantConfigured,
    accountId: GOOGLE_MERCHANT_ACCOUNT_ID || "",
    targetCountry: GOOGLE_MERCHANT_TARGET_COUNTRY.toUpperCase(),
    contentLanguage: GOOGLE_MERCHANT_CONTENT_LANGUAGE.toLowerCase(),
    currency: GOOGLE_MERCHANT_CURRENCY.toUpperCase(),
    brand: GOOGLE_MERCHANT_BRAND,
  });
});

app.post("/api/admin/google-merchant/sync", requireAdminAuth, async (req, res) => {
  try {
    if (!GOOGLE_MERCHANT_ENABLED) {
      return res.status(400).json({ message: "Google Merchant entegrasyonu aktif değil." });
    }
    if (!isGoogleMerchantConfigured) {
      return res.status(500).json({
        message:
          "Google Merchant ayarları eksik. .env içine hesap id, service account email ve private key girin.",
      });
    }

    const summary = await syncProductsToGoogleMerchant(req);
    return res.json({
      ok: true,
      ...summary,
      accountId: GOOGLE_MERCHANT_ACCOUNT_ID,
      message: `Google Merchant senkron tamamlandı. Başarılı: ${summary.success}, Silinen: ${summary.deleted}, Hatalı: ${summary.failed}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Merchant senkronu başarısız.";
    return res.status(500).json({ message });
  }
});

app.get("/api/admin/trendyol/status", requireAdminAuth, async (_req, res) => {
  try {
    return res.json({ status: getTrendyolStatusSnapshot() });
  } catch (error) {
    return res.status(500).json({ message: "Trendyol status fetch failed." });
  }
});

app.get("/api/admin/trendyol/orders", requireAdminAuth, async (_req, res) => {
  try {
    const orders = await fetchTrendyolOrders();
    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Trendyol orders fetch failed.",
    });
  }
});

app.get("/api/admin/google-merchant/products", requireAdminAuth, async (req, res) => {
  try {
    if (!GOOGLE_MERCHANT_ENABLED) {
      return res.status(400).json({ message: "Google Merchant entegrasyonu aktif değil." });
    }
    if (!isGoogleMerchantConfigured) {
      return res.status(500).json({
        message:
          "Google Merchant ayarları eksik. .env içine hesap id, service account email ve private key girin.",
      });
    }

    const maxResults = Number(req.query?.maxResults ?? 20);
    const pageToken = String(req.query?.pageToken ?? "").trim();
    const result = await listGoogleMerchantProducts({ maxResults, pageToken });
    return res.json({
      ok: true,
      accountId: GOOGLE_MERCHANT_ACCOUNT_ID,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google Merchant ürünleri alınamadı.";
    return res.status(500).json({ message });
  }
});

app.get("/api/admin/orders", requireAdminAuth, async (_req, res) => {
  try {
    let orderRows;
    try {
      const [rows] = await pool.query(
        `
        SELECT
          o.id,
          o.user_id,
          o.order_date,
          o.total,
          o.status,
          o.subtotal_total,
          o.shipping_total,
          o.discount_total,
          o.coupon_code,
          o.shipping_company,
          o.shipping_tracking_no,
          o.shipping_first_name,
          o.shipping_last_name,
          o.shipping_phone,
          o.shipping_street,
          o.shipping_province,
          o.shipping_district,
          o.shipping_neighborhood,
          o.created_at,
          o.updated_at,
          u.first_name,
          u.last_name,
          u.email,
          u.phone
        FROM user_orders o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
        `
      );
      orderRows = rows;
    } catch (error) {
      // Backward compatible: older DB may not have shipping columns yet.
      if (error?.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }
      const [rows] = await pool.query(
        `
        SELECT
          o.id,
          o.user_id,
          o.order_date,
          o.total,
          o.status,
          o.created_at,
          o.updated_at,
          u.first_name,
          u.last_name,
          u.email,
          u.phone
        FROM user_orders o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
        `
      );
      orderRows = rows;
    }

    if (orderRows.length === 0) {
      return res.json({ orders: [] });
    }

    const orderIds = orderRows.map((row) => row.id);
    const orderPlaceholders = orderIds.map(() => "?").join(", ");
    const [itemRows] = await pool.query(
      `
      SELECT order_id, product_json, quantity, color
      FROM user_order_items
      WHERE order_id IN (${orderPlaceholders})
      ORDER BY created_at ASC
      `,
      orderIds
    );

    const userIds = [...new Set(orderRows.map((row) => row.user_id))];
    const userPlaceholders = userIds.map(() => "?").join(", ");
    const [addressRows] = await pool.query(
      `
      SELECT user_id, first_name, last_name, phone, street, province, district, neighborhood, is_default, created_at
      FROM user_addresses
      WHERE user_id IN (${userPlaceholders})
      ORDER BY is_default DESC, created_at DESC
      `,
      userIds
    );

    let timelineRows = [];
    try {
      const [rows] = await pool.query(
        `
        SELECT id, order_id, event_type, note, shipping_company, shipping_tracking_no, created_at
        FROM order_status_events
        WHERE order_id IN (${orderPlaceholders})
        ORDER BY created_at ASC, id ASC
        `,
        orderIds
      );
      timelineRows = rows;
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") {
        throw error;
      }
    }

    let shipmentRows = [];
    try {
      const [rows] = await pool.query(
        `
        SELECT
          order_id,
          provider,
          status,
          provider_reference_id,
          provider_post_number,
          carrier_name,
          tracking_url,
          barcode_url,
          error_message,
          response_payload_json,
          created_at,
          updated_at
        FROM order_shipments
        WHERE order_id IN (${orderPlaceholders}) AND provider = 'navlungo'
        ORDER BY updated_at DESC, created_at DESC
        `,
        orderIds
      );
      shipmentRows = rows;
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") {
        throw error;
      }
    }

    const addressByUserId = new Map();
    for (const row of addressRows) {
      if (addressByUserId.has(row.user_id)) continue;
      addressByUserId.set(row.user_id, {
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone ?? "",
        street: row.street,
        province: row.province,
        district: row.district,
        neighborhood: row.neighborhood ?? "",
      });
    }

    const itemsByOrderId = new Map();
    for (const row of itemRows) {
      const list = itemsByOrderId.get(row.order_id) ?? [];
      try {
        const product = normalizeProductMedia(JSON.parse(row.product_json));
        list.push({
          product,
          quantity: Number(row.quantity),
          color: row.color ?? undefined,
        });
      } catch {
        continue;
      }
      itemsByOrderId.set(row.order_id, list);
    }

    const timelineByOrderId = new Map();
    for (const row of timelineRows) {
      const list = timelineByOrderId.get(row.order_id) ?? [];
      list.push(mapOrderStatusTimelineEventRow(row));
      timelineByOrderId.set(row.order_id, list);
    }

    const shipmentByOrderId = new Map();
    for (const row of shipmentRows) {
      if (shipmentByOrderId.has(row.order_id)) continue;
      shipmentByOrderId.set(row.order_id, mapOrderShipmentRow(row));
    }

    const orders = orderRows.map((row) => {
      const shippingAddressFromOrder =
        String(row.shipping_street ?? "").trim() ||
        String(row.shipping_district ?? "").trim() ||
        String(row.shipping_province ?? "").trim() ||
        String(row.shipping_neighborhood ?? "").trim()
          ? {
              firstName: String(row.shipping_first_name ?? "").trim() || row.first_name,
              lastName: String(row.shipping_last_name ?? "").trim() || row.last_name,
              phone: String(row.shipping_phone ?? "").trim() || row.phone || "",
              street: String(row.shipping_street ?? "").trim(),
              province: String(row.shipping_province ?? "").trim(),
              district: String(row.shipping_district ?? "").trim(),
              neighborhood: String(row.shipping_neighborhood ?? "").trim(),
            }
          : null;
      const address = shippingAddressFromOrder ?? addressByUserId.get(row.user_id) ?? null;
      const customerPhone = (shippingAddressFromOrder?.phone || row.phone || "").trim();
      return {
        id: row.id,
        date: row.created_at ?? row.order_date,
        items: itemsByOrderId.get(row.id) ?? [],
        total: Number(row.total),
        subtotal: row.subtotal_total == null ? undefined : Number(row.subtotal_total),
        shippingTotal: row.shipping_total == null ? undefined : Number(row.shipping_total),
        discountTotal: row.discount_total == null ? undefined : Number(row.discount_total),
        couponCode: row.coupon_code ?? "",
        status: row.status,
        shippingCompany: row.shipping_company ?? "",
        shippingTrackingNo: row.shipping_tracking_no ?? "",
        shipment: shipmentByOrderId.get(row.id) ?? null,
        timeline: buildFallbackOrderTimeline(row, timelineByOrderId.get(row.id) ?? []),
        customer: {
          firstName: shippingAddressFromOrder?.firstName ?? row.first_name,
          lastName: shippingAddressFromOrder?.lastName ?? row.last_name,
          email: row.email,
          phone: customerPhone,
          address,
        },
      };
    });

    return res.json({ orders });
  } catch (error) {
    return res.status(500).json({ message: "Admin orders fetch failed." });
  }
});

app.post("/api/admin/orders/:id/navlungo/create", requireAdminAuth, async (req, res) => {
  try {
    if (!isNavlungoConfigured) {
      return res.status(400).json({
        message: "Navlungo entegrasyonu için API kullanıcı adı ve şifresi gerekli.",
      });
    }

    const orderId = String(req.params?.id ?? "").trim();
    if (!orderId) {
      return res.status(400).json({ message: "Geçersiz sipariş numarası." });
    }

    const context = await getOrderContextForNavlungo(orderId);
    if (!context || !context.deliveryAddress) {
      return res.status(404).json({ message: "Sipariş veya teslimat adresi bulunamadı." });
    }

    const result = await createNavlungoShipmentForOrder({
      order: context.order,
      user: context.user,
      deliveryAddress: context.deliveryAddress,
      force: true,
    });

    return res.json({
      ok: true,
      shipment: result.shipment,
      skipped: result.skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Navlungo gönderisi oluşturulamadı.";
    return res.status(500).json({ message });
  }
});

app.patch("/api/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
  let connection;
  try {
    const orderId = String(req.params.id ?? "").trim();
    const nextStatus = String(req.body?.status ?? "").trim();
    const allowedStatus = new Set(["processing", "shipped", "delivered"]);

    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    if (!allowedStatus.has(nextStatus)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [currentRows] = await connection.query(
      `
      SELECT status, shipping_company, shipping_tracking_no
      FROM user_orders
      WHERE id = ?
      LIMIT 1
      `,
      [orderId]
    );

    if (currentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Order not found." });
    }

    const currentOrder = currentRows[0];
    const currentStatus = String(currentOrder.status ?? "").trim();
    const currentShippingCompany = String(currentOrder.shipping_company ?? "").trim();
    const currentShippingTrackingNo = String(currentOrder.shipping_tracking_no ?? "").trim();
    let nextShippingCompany = "";
    let nextShippingTrackingNo = "";

    if (nextStatus === "shipped") {
      const shipment = await getOrderShipmentRecord(orderId, "navlungo");
      if (!shipment || shipment.status !== "created") {
        await connection.rollback();
        return res.status(400).json({
          message: "Kargoya verildi durumuna geçmeden önce sipariş için Navlungo gönderisi oluşturulmalı.",
        });
      }

      nextShippingCompany = String(shipment.carrierName ?? "").trim();
      nextShippingTrackingNo = String(shipment.postNumber ?? "").trim();

      if (!nextShippingCompany || !nextShippingTrackingNo) {
        await connection.rollback();
        return res.status(400).json({
          message: "Navlungo gönderisinde taşıyıcı veya gönderi numarası eksik.",
        });
      }
    }

    const noChange =
      currentStatus === nextStatus &&
      currentShippingCompany === nextShippingCompany &&
      currentShippingTrackingNo === nextShippingTrackingNo;

    if (noChange) {
      await connection.rollback();
      return res.json({
        ok: true,
        status: nextStatus,
        shippingCompany: nextShippingCompany,
        shippingTrackingNo: nextShippingTrackingNo,
        event: null,
      });
    }

    await connection.query(
      `
      UPDATE user_orders
      SET status = ?, shipping_company = ?, shipping_tracking_no = ?
      WHERE id = ?
      `,
      [
        nextStatus,
        nextStatus === "processing" ? null : nextShippingCompany || currentShippingCompany || null,
        nextStatus === "processing" ? null : nextShippingTrackingNo || currentShippingTrackingNo || null,
        orderId,
      ]
    );

    const timelineEvent = await insertOrderStatusTimelineEvent(connection, {
      orderId,
      type: nextStatus,
      note:
        nextStatus === "processing"
          ? "Sipariş hazırlık sürecine alındı."
          : nextStatus === "shipped"
          ? currentStatus === "shipped"
            ? "Navlungo kargo bilgileri güncellendi."
            : "Sipariş kargoya verildi."
          : "Sipariş teslim edildi olarak işaretlendi.",
      shippingCompany: nextShippingCompany,
      shippingTrackingNo: nextShippingTrackingNo,
    });

    await connection.commit();

    return res.json({
      ok: true,
      status: nextStatus,
      shippingCompany: nextShippingCompany,
      shippingTrackingNo: nextShippingTrackingNo,
      event: timelineEvent,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return res
        .status(500)
        .json({ message: "DB migration required for shipping fields. Run npm run db:migrate." });
    }
    return res.status(500).json({ message: "Admin order status update failed." });
  } finally {
    connection?.release();
  }
});

app.get("/api/admin/products", requireAdminAuth, async (_req, res) => {
  try {
    const parsedLimit = Number(_req.query?.limit);
    const parsedOffset = Number(_req.query?.offset);
    const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 60) : 24;
    const safeOffset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM products`);
    const total = Number(countRows?.[0]?.total ?? 0);

    try {
      const [rows] = await pool.query(
        `
        SELECT id, name, price, stock, barcode, image, category_id, is_new, is_bestseller
        FROM products
        ORDER BY id ASC
        LIMIT ?
        OFFSET ?
        `
        ,
        [safeLimit, safeOffset]
      );
      const products = rows.map(mapAdminProductListRow);
      const nextOffset = safeOffset + products.length;
      return res.json({
        products,
        total,
        hasMore: nextOffset < total,
        nextOffset,
      });
    } catch (error) {
      // Backward compatible for DBs without tags_json column.
      if (error?.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }
      const [rows] = await pool.query(
        `
        SELECT id, name, price, stock, barcode, image, category_id, is_new, is_bestseller
        FROM products
        ORDER BY id ASC
        LIMIT ?
        OFFSET ?
        `
        ,
        [safeLimit, safeOffset]
      );
      const products = rows.map(mapAdminProductListRow);
      const nextOffset = safeOffset + products.length;
      return res.json({
        products,
        total,
        hasMore: nextOffset < total,
        nextOffset,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Admin products fetch failed." });
  }
});

app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");

  if (!WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(500).send("WHATSAPP_WEBHOOK_VERIFY_TOKEN is missing.");
  }
  if (mode === "subscribe" && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send("Forbidden");
});

app.post("/api/whatsapp/webhook", (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value ?? {};
        const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
        for (const status of statuses) {
          const messageId = String(status?.id ?? "");
          const state = String(status?.status ?? "");
          const recipient = String(status?.recipient_id ?? "");
          const timestamp = String(status?.timestamp ?? "");
          const errors = Array.isArray(status?.errors) ? status.errors : [];
          if (errors.length > 0) {
            console.error("WhatsApp status error:", {
              messageId,
              state,
              recipient,
              timestamp,
              errors,
            });
          } else {
            console.log("WhatsApp status:", {
              messageId,
              state,
              recipient,
              timestamp,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("WhatsApp webhook parse failed:", error?.message || error);
  }
  return res.sendStatus(200);
});

app.get("/api/admin/contact-requests", requireAdminAuth, async (_req, res) => {
  try {
    await ensureContactRequestsTable();
    const [rows] = await pool.query(
      `
      SELECT id, name, email, subject, message, created_at
      FROM contact_requests
      ORDER BY created_at DESC
      `
    );

    const requests = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      createdAt: row.created_at,
    }));

    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ message: "Admin contact requests fetch failed." });
  }
});

app.get("/api/admin/users", requireAdminAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, first_name, last_name, email, phone, created_at
      FROM users
      ORDER BY created_at DESC
      `
    );

    const users = rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone ?? "",
      createdAt: row.created_at,
    }));

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: "Admin users fetch failed." });
  }
});

app.post("/api/admin/upload-images", requireAdminAuth, (req, res) => {
  adminImageUpload.array("images", 15)(req, res, async (error) => {
    if (error) {
      await cleanupUploadedFiles(req.files);
      if (error?.message === "INVALID_IMAGE_TYPE") {
        return res.status(400).json({ message: "Sadece görsel dosyaları yüklenebilir." });
      }
      if (error?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Her görsel en fazla 12MB olabilir." });
      }
      if (error?.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ message: "En fazla 15 görsel yükleyebilirsiniz." });
      }
      return res.status(400).json({ message: "Görsel yükleme başarısız." });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ message: "Yüklenecek görsel bulunamadı." });
    }

    try {
      const normalizedFiles = await Promise.all(files.map((file) => normalizeUploadedImageFile(file)));
      const urls = normalizedFiles.map((file) => `/api/uploads/${file.filename}`);
      return res.json({ urls });
    } catch {
      await cleanupUploadedFiles(files);
      return res.status(500).json({ message: "Görsel standart formata dönüştürülemedi." });
    }
  });
});

app.post("/api/admin/products", requireAdminAuth, async (req, res) => {
  try {
    const requestedId = String(req.body?.id ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const requestedCategory = String(req.body?.category ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const barcode = String(req.body?.barcode ?? "").trim();
    const image = String(req.body?.image ?? "").trim();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    const price = parseAdminPriceInput(req.body?.price, 0);
    const stock = parseAdminStockInput(req.body?.stock, null);
    const features = Array.isArray(req.body?.features) ? req.body.features : [];
    const colors = Array.isArray(req.body?.colors) ? req.body.colors : [];
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const isNew = Boolean(req.body?.isNew);
    const isBestseller = Boolean(req.body?.isBestseller);

    if (!name) {
      return res.status(400).json({ message: "Urun ismi zorunludur." });
    }

    const normalizedImages = images
      .map((item) => sanitizeStoredProductMediaSource(item))
      .filter((item) => item.length > 0)
      .slice(0, 15);
    const primaryImage = normalizedImages[0] ?? sanitizeStoredProductMediaSource(image);
    if (!primaryImage) {
      return res.status(400).json({ message: "Geçerli bir ürün görseli zorunludur." });
    }

    const normalizedFeatures = features
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    const normalizedColors = colors
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    const normalizedTags = tags
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    const category = requestedCategory || (await getDefaultCategoryId());
    if (!category) {
      return res.status(400).json({ message: "Kayitli kategori bulunamadi." });
    }
    const normalizedPrice = price;

    const productId = requestedId || (await generateUniqueProductId());

    await pool.query(
      `
      INSERT INTO products (
        id, name, price, stock, barcode, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productId,
        name,
        normalizedPrice,
        stock,
        barcode || null,
        primaryImage,
        JSON.stringify(normalizedImages.length > 0 ? normalizedImages : [primaryImage]),
        category,
        description,
        JSON.stringify(normalizedFeatures),
        JSON.stringify(normalizedColors),
        JSON.stringify(normalizedTags),
        isNew,
        isBestseller,
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(500).json({ message: "Urun olusturuldu ancak okunamadi." });
    }

    await invalidateProductCaches();
    void syncProductToTrendyol(rows[0]).catch((error) => {
      console.error("Trendyol product sync failed after create:", error instanceof Error ? error.message : error);
    });
    return res.status(201).json({ product: mapProductRow(rows[0]) });
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return res.status(500).json({ message: "DB migration required for product media fields. Run npm run db:migrate." });
    }
    if (error?.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Geçersiz kategori." });
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Bu ürün ID zaten kullanılıyor." });
    }
    return res.status(500).json({ message: "Admin product create failed." });
  }
});

app.get("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = String(req.params.id ?? "").trim();
    if (!productId) {
      return res.status(400).json({ message: "Geçersiz ürün." });
    }

    const [rows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }

    return res.json({ product: mapProductRow(rows[0]) });
  } catch (error) {
    return res.status(500).json({ message: "Admin product fetch failed." });
  }
});

app.put("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = String(req.params.id ?? "").trim();
    const requestedName = String(req.body?.name ?? "").trim();
    const requestedCategory = String(req.body?.category ?? "").trim();
    const requestedDescription = String(req.body?.description ?? "").trim();
    const requestedBarcode = String(req.body?.barcode ?? "").trim();
    const image = String(req.body?.image ?? "").trim();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    const features = Array.isArray(req.body?.features) ? req.body.features : [];
    const colors = Array.isArray(req.body?.colors) ? req.body.colors : [];
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const isNew = Boolean(req.body?.isNew);
    const isBestseller = Boolean(req.body?.isBestseller);

    if (!productId) {
      return res.status(400).json({ message: "Gecersiz urun." });
    }
    const [existingRows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, images_json, category_id, description
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }
    const existing = existingRows[0];

    const name = requestedName || String(existing.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ message: "Urun ismi zorunludur." });
    }
    const category =
      requestedCategory || String(existing.category_id ?? "").trim() || (await getDefaultCategoryId());
    if (!category) {
      return res.status(400).json({ message: "Kayitli kategori bulunamadi." });
    }
    const price = parseAdminPriceInput(req.body?.price, Number(existing.price ?? 0));
    const stock = parseAdminStockInput(req.body?.stock, existing.stock);
    const description = requestedDescription || String(existing.description ?? "").trim();
    const barcode = requestedBarcode || null;
    const normalizedPrice = price;

    const existingImageSources = parseProductImageSources(existing);
    const normalizedImages = images
      .map((item) => resolveAdminImageSource(item, productId, existingImageSources))
      .map((item) => sanitizeStoredProductMediaSource(item))
      .filter((item) => item.length > 0)
      .slice(0, 15);
    const resolvedImage = sanitizeStoredProductMediaSource(
      resolveAdminImageSource(image, productId, existingImageSources)
    );
    const primaryImage = normalizedImages[0] ?? resolvedImage;
    if (!primaryImage) {
      return res.status(400).json({ message: "Geçerli bir ürün görseli zorunludur." });
    }

    const normalizedFeatures = features
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    const normalizedColors = colors
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);
    const normalizedTags = tags
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0);

    const [result] = await pool.query(
      `
      UPDATE products
      SET
        name = ?,
        price = ?,
        stock = ?,
        barcode = ?,
        image = ?,
        images_json = ?,
        category_id = ?,
        description = ?,
        features_json = ?,
        colors_json = ?,
        tags_json = ?,
        is_new = ?,
        is_bestseller = ?
      WHERE id = ?
      `,
      [
        name,
        normalizedPrice,
        stock,
        barcode,
        primaryImage,
        JSON.stringify(normalizedImages.length > 0 ? normalizedImages : [primaryImage]),
        category,
        description,
        JSON.stringify(normalizedFeatures),
        JSON.stringify(normalizedColors),
        JSON.stringify(normalizedTags),
        isNew,
        isBestseller,
        productId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }

    const [rows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }

    await invalidateProductCaches();
    void syncProductToTrendyol(rows[0]).catch((error) => {
      console.error("Trendyol product sync failed after update:", error instanceof Error ? error.message : error);
    });
    return res.json({ product: mapProductRow(rows[0]) });
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return res.status(500).json({ message: "DB migration required for product media fields. Run npm run db:migrate." });
    }
    if (error?.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Geçersiz kategori." });
    }
    return res.status(500).json({ message: "Admin product update failed." });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const cacheKey = "categories:list";
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=3600");
      return res.json(cached);
    }
    const [rows] = await pool.query(
      `SELECT id, name, image, description FROM categories ORDER BY name ASC`
    );
    const payload = await setCachedResponse(cacheKey, rows, CACHE_TTL_MS.categories);
    res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=3600");
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories." });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const { search, category, sort, limit } = req.query;
    const includeMeta = String(req.query?.includeMeta ?? "0") === "1";

    const where = [];
    const params = [];

    if (typeof search === "string" && search.trim() !== "") {
      where.push("(name LIKE ? OR description LIKE ?)");
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }

    if (typeof category === "string" && category.trim() !== "") {
      const normalizedCategory = category.trim();
      if (normalizedCategory === "new") {
        where.push("is_new = TRUE");
      } else {
        where.push("category_id = ?");
        params.push(normalizedCategory);
      }
    }

    let orderBy = "is_bestseller DESC, is_new DESC, created_at DESC, id DESC";
    if (sort === "price-low") orderBy = "price ASC";
    if (sort === "price-high") orderBy = "price DESC";
    if (sort === "newest") orderBy = "is_new DESC, id DESC";

    const parsedLimit = Number(limit);
    const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 120) : 60;
    const parsedOffset = Number(req.query?.offset);
    const safeOffset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const cacheKey = `products:list:${String(search ?? "").trim()}|${String(category ?? "").trim()}|${String(sort ?? "").trim()}|${safeLimit}|${safeOffset}|${includeMeta ? "1" : "0"}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.json(cached);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM products
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `;
    const countParams = [...params];

    const sql = `
      SELECT id, name, price, stock, barcode, image, category_id, description, colors_json, tags_json, is_new, is_bestseller
      FROM products
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${orderBy}
      LIMIT ?
      OFFSET ?
    `;
    params.push(safeLimit);
    params.push(safeOffset);

    const [rows] = await pool.query(sql, params);
    const products = rows.map(mapProductListRow);
    let payload = products;

    if (includeMeta) {
      const [countRows] = await pool.query(countSql, countParams);
      const total = Number(countRows?.[0]?.total ?? 0);
      const nextOffset = safeOffset + products.length;
      payload = {
        products,
        total,
        hasMore: nextOffset < total,
        nextOffset,
      };
    }

    await setCachedResponse(cacheKey, payload, CACHE_TTL_MS.productList);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products." });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const cacheKey = `product:detail:${String(req.params.id ?? "").trim()}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
      return res.json(cached);
    }
    const [rows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, category_id, description, features_json, colors_json, is_new, is_bestseller
      , tags_json
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    const baseProduct = mapProductRow(rows[0]);
    const storefrontImages =
      (Array.isArray(baseProduct.images) ? baseProduct.images : [])
        .map((image, index) => buildResolvedProductImagePath(baseProduct.id, image, index, "detail"))
        .filter(Boolean);
    const product = {
      ...baseProduct,
      image: storefrontImages[0] ?? buildResolvedProductImagePath(baseProduct.id, baseProduct.image, 0, "detail"),
      images:
        storefrontImages.length > 0
          ? storefrontImages
          : [buildResolvedProductImagePath(baseProduct.id, baseProduct.image, 0, "detail")].filter(Boolean),
    };

    const [relatedRows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, category_id, description, colors_json, tags_json, is_new, is_bestseller
      FROM products
      WHERE category_id = ? AND id <> ?
      ORDER BY id ASC
      LIMIT 2
      `,
      [product.category, product.id]
    );

    const payload = {
      product,
      relatedProducts: relatedRows.map(mapProductListRow),
    };

    await setCachedResponse(cacheKey, payload, CACHE_TTL_MS.productDetail);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch product." });
  }
});

app.get("/api/products/:id/media", async (req, res) => {
  try {
    const cacheKey = `product:media:${String(req.params.id ?? "").trim()}`;
    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
      return res.json(cached);
    }
    const [rows] = await pool.query(
      `
      SELECT id, image, images_json
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }
    const sources = parseProductImageSources(rows[0]);
    const images = (sources.length > 0 ? sources : [rows[0].image])
      .map((source, index) => buildResolvedProductImagePath(rows[0].id, source, index, "detail"))
      .filter(Boolean);
    const payload = { images };
    await setCachedResponse(cacheKey, payload, CACHE_TTL_MS.productMedia);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=1800");
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch product media." });
  }
});

app.get("/api/products/:id/image/:index", async (req, res) => {
  try {
    const imageIndex = Math.max(0, Number(req.params.index) || 0);
    const requestedVariant = String(req.query?.variant ?? "").trim().toLowerCase();
    const variantKey = Object.prototype.hasOwnProperty.call(IMAGE_VARIANT_SPECS, requestedVariant)
      ? requestedVariant
      : "";
    const [rows] = await pool.query(
      `
      SELECT id, image, images_json
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }
    const sources = parseProductImageSources(rows[0]);
    const candidates = [
      sources[imageIndex],
      ...sources,
      rows[0].image,
    ]
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    const selected = candidates.find((item) => localUploadExists(item));
    if (!selected) {
      return res.status(404).json({ message: "Image not found." });
    }
    if (variantKey && isLocalUploadPath(selected)) {
      const variantWebPath = await ensureLocalUploadVariant(selected, variantKey).catch(() => "");
      if (variantWebPath) {
        return sendImageSourceDirect(res, variantWebPath);
      }
    }
    return sendImageSourceResponse(res, selected);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch product image." });
  }
});

app.get(["/api/merchant/product/:id", "/merchant/product/:id"], async (req, res) => {
  try {
    const productId = String(req.params.id ?? "").trim();
    if (!productId) {
      return res.status(400).send("Geçersiz ürün.");
    }

    const [rows] = await pool.query(
      `
      SELECT id, name, price, stock, barcode, image, images_json, category_id, description
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );
    if (rows.length === 0) {
      return res.status(404).send("Ürün bulunamadı.");
    }

    const product = mapProductRow(rows[0]);
    const merchantVersion = buildMerchantProductVersion(product);
    const baseUrl = buildSitemapBaseUrl(req);
    const storefrontUrl = `${baseUrl}/product/${encodeURIComponent(product.id)}`;
    const merchantUrl = appendUrlQueryParam(
      `${baseUrl}/api/merchant/product/${encodeURIComponent(product.id)}`,
      "gmc",
      merchantVersion
    );
    const imageCandidates = [
      ...(Array.isArray(product.images) ? product.images : []),
      product.image,
    ]
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    const directMerchantImage = imageCandidates.find((item) => isMerchantSafeDirectImageSource(item));
    const imageUrl = directMerchantImage
      ? appendUrlQueryParam(toPublicUrl(baseUrl, directMerchantImage), "gmcimg", merchantVersion)
      : appendUrlQueryParam(
          `${baseUrl}/api/merchant/product/${encodeURIComponent(product.id)}/image/0`,
          "gmcimg",
          merchantVersion
        );

    const safeTitle = escapeHtml(String(product.name ?? "Ürün"));
    const safeDesc = escapeHtml(
      String(product.description ?? "").trim() || `${safeTitle} - ${GOOGLE_MERCHANT_BRAND}`
    );
    const safePrice = Number(product.price ?? 0).toFixed(2);
    const safeBrand = escapeHtml(String(GOOGLE_MERCHANT_BRAND ?? DEFAULT_SITE_NAME));
    const safeCategory = escapeHtml(String(product.category ?? ""));
    const safeImage = escapeHtml(imageUrl);
    const safeStorefrontUrl = escapeHtml(storefrontUrl);
    const safeMerchantUrl = escapeHtml(merchantUrl);

    res.setHeader("X-Robots-Tag", "all");

    const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | ${safeBrand}</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="canonical" href="${safeMerchantUrl}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${safeMerchantUrl}" />
  ${safeImage ? `<meta property="og:image" content="${safeImage}" />` : ""}
</head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:900px;margin:32px auto;padding:0 16px;color:#111;">
  <h1 style="margin:0 0 12px;">${safeTitle}</h1>
  <p style="margin:0 0 16px;font-size:18px;"><strong>${safePrice} ${GOOGLE_MERCHANT_CURRENCY.toUpperCase()}</strong></p>
  ${safeCategory ? `<p style="margin:0 0 12px;color:#666;">Kategori: ${safeCategory}</p>` : ""}
  ${safeImage ? `<img src="${safeImage}" alt="${safeTitle}" style="max-width:360px;width:100%;height:auto;display:block;border-radius:8px;margin:0 0 16px;" />` : ""}
  <p style="line-height:1.6;">${safeDesc}</p>
  <p style="margin-top:20px;">
    <a href="${safeStorefrontUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;">
      Ürünü sitede aç
    </a>
  </p>
  <script type="application/ld+json">
  ${serializeJsonForHtmlScript({
    "@context": "https://schema.org",
    "@type": "Product",
    name: String(product.name ?? ""),
      image: imageUrl ? [imageUrl] : [],
      description: String(product.description ?? ""),
      brand: { "@type": "Brand", name: GOOGLE_MERCHANT_BRAND },
      offers: {
        "@type": "Offer",
        url: merchantUrl,
        priceCurrency: GOOGLE_MERCHANT_CURRENCY.toUpperCase(),
        price: Number(product.price ?? 0).toFixed(2),
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
      },
  })}
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch {
    return res.status(500).send("Merchant ürün sayfası oluşturulamadı.");
  }
});

app.get(["/api/merchant/product/:id/image/:index", "/merchant/product/:id/image/:index"], async (req, res) => {
  try {
    const productId = String(req.params.id ?? "").trim();
    const imageIndex = Math.max(0, Number(req.params.index) || 0);
    if (!productId) {
      return res.status(400).json({ message: "Product not found." });
    }

    const [rows] = await pool.query(
      `
      SELECT id, image, images_json
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    const sources = parseProductImageSources(rows[0]);
    const candidate = sources[imageIndex] || sources[0] || rows[0].image;
    if (!candidate) {
      return res.status(404).json({ message: "Image not found." });
    }

    res.setHeader("X-Robots-Tag", "all");
    return sendImageSourceAsMerchantJpeg(res, candidate);
  } catch {
    return res.status(500).json({ message: "Failed to fetch merchant image." });
  }
});

app.delete("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = String(req.params.id ?? "").trim();
    if (!productId) {
      return res.status(400).json({ message: "Gecersiz urun." });
    }

    const [result] = await pool.query(
      `
      DELETE FROM products
      WHERE id = ?
      `,
      [productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Ürün bulunamadı." });
    }

    await invalidateProductCaches();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Admin product delete failed." });
  }
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = buildSitemapBaseUrl(req);
    const nowIso = new Date().toISOString();

    const staticUrls = [
      { loc: "/", changefreq: "daily", priority: "1.0" },
      { loc: "/shop", changefreq: "daily", priority: "0.95" },
      { loc: "/hakkimizda", changefreq: "monthly", priority: "0.7" },
      { loc: "/iletisim", changefreq: "monthly", priority: "0.7" },
      { loc: "/kargo", changefreq: "monthly", priority: "0.6" },
      { loc: "/iade", changefreq: "monthly", priority: "0.6" },
      { loc: "/sss", changefreq: "weekly", priority: "0.6" },
      { loc: "/gizlilik", changefreq: "yearly", priority: "0.4" },
      { loc: "/kullanim-kosullari", changefreq: "yearly", priority: "0.4" },
      { loc: "/surdurulebilirlik", changefreq: "monthly", priority: "0.5" },
      { loc: "/kariyer", changefreq: "monthly", priority: "0.4" },
    ];

    const [productRows] = await pool.query(`SELECT id FROM products ORDER BY id ASC`);
    const [categoryRows] = await pool.query(`SELECT id FROM categories ORDER BY id ASC`);

    const productUrls = productRows.map((row) => ({
      loc: `/product/${encodeURIComponent(String(row.id ?? "").trim())}`,
      changefreq: "daily",
      priority: "0.8",
    }));

    const categoryUrls = categoryRows.map((row) => {
      const categoryId = encodeURIComponent(String(row.id ?? "").trim());
      return {
        loc: `/shop?category=${categoryId}`,
        changefreq: "daily",
        priority: "0.75",
      };
    });

    const allUrls = [...staticUrls, ...categoryUrls, ...productUrls];

    const urlset = allUrls
      .filter((entry) => String(entry.loc ?? "").trim())
      .map(
        (entry) => `  <url>
    <loc>${escapeXml(`${baseUrl}${entry.loc}`)}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(xml);
  } catch (error) {
    return res.status(500).send("Failed to generate sitemap.");
  }
});

if (fs.existsSync(distIndexHtml)) {
  app.use(express.static(distDir, { dotfiles: "deny" }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(distIndexHtml);
  });
}

await ensureAdminSessionsTable();
await ensureMarketingAbandonedCartEmailsTable();
await initializeRedisCache();
void scheduleAbandonedCartCampaignScan();
void scheduleNavlungoShipmentStatusSync();

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});

