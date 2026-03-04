import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";
import { pool } from "./db.mjs";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 3001);
const adminSessions = new Map();
const DEFAULT_SITE_NAME = "Paris move";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const distIndexHtml = path.join(distDir, "index.html");

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const SESSION_DAYS = 30;
const PASSWORD_RESET_TTL_MINUTES = 30;
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
const SMTP_FROM_NAME = String(process.env.SMTP_FROM_NAME ?? "Paris move").trim();
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
const ORDER_SMTP_FROM_NAME = String(process.env.ORDER_SMTP_FROM_NAME ?? "Paris move").trim();
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
const allowedShippingCompanies = new Set([
  "Sen Kargo",
  "Aras Kargo",
  "PTT Kargo",
  "DHL",
  "Sürat Kargo",
  "Yurtiçi Kargo",
]);

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

function toPublicUrl(baseUrl, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  if (/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${baseUrl}${value}`;
  return `${baseUrl}/${value.replace(/^\/+/, "")}`;
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
  const deliveryAddressText = buildDeliveryAddressText(deliveryAddress);
  const safeDeliveryAddress = escapeHtml(
    deliveryAddressText || "-"
  );
  const safeDeliveryPhone = escapeHtml(String(deliveryAddress?.phone ?? "").trim() || "-");
  const items = Array.isArray(order?.items) ? order.items : [];
  const mailAttachments = [];

  const itemsHtml = items
    .map((item, itemIndex) => {
      const product = item?.product ?? {};
      const productId = String(product?.id ?? "").trim();
      const productUrl = productId
        ? `${baseUrl}/?product=${encodeURIComponent(productId)}`
        : baseUrl;
      const productName = escapeHtml(product?.name ?? "Urun");
      const quantity = Number(item?.quantity ?? 1);
      const unitPrice = Number(product?.price ?? 0);
      const totalPrice = (unitPrice * quantity).toLocaleString("tr-TR");
      const imageList = Array.isArray(product?.images) ? product.images : [];
      const rawImage = String(imageList[0] ?? product?.image ?? "").trim();
      const dataAttachment = dataUrlToEmailAttachment(rawImage, `${safeOrderId || "order"}-${itemIndex}`);
      if (dataAttachment?.attachment) {
        mailAttachments.push(dataAttachment.attachment);
      }
      const image = dataAttachment?.src ?? toPublicUrl(baseUrl, rawImage);
      const color = String(item?.color ?? "").trim();

      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;">
            ${
              image
                ? `<img src="${escapeHtml(image)}" alt="${productName}" style="width:84px;height:84px;object-fit:cover;border-radius:8px;display:block;" />`
                : `<div style="width:84px;height:84px;background:#f2f2f2;border-radius:8px;"></div>`
            }
          </td>
          <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;">
            <a href="${escapeHtml(productUrl)}" style="color:#111;text-decoration:none;font-weight:600;">${productName}</a>
            <div style="margin-top:6px;font-size:13px;color:#666;">Adet: ${quantity}</div>
            ${color ? `<div style="margin-top:2px;font-size:13px;color:#666;">Renk: ${escapeHtml(color)}</div>` : ""}
          </td>
          <td style="padding:12px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;white-space:nowrap;">
            ${totalPrice} TL
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2 style="margin:0 0 12px;">Sipari\u015f Bilgileriniz</h2>
      <p>Merhaba ${safeFirstName},</p>
      <p>Sipari\u015finiz ba\u015far\u0131yla olu\u015fturuldu.</p>
      <p style="margin:0 0 4px;"><strong>Sipari\u015f No:</strong> ${safeOrderId}</p>
      <p style="margin:0 0 4px;"><strong>Tarih:</strong> ${safeOrderDate}</p>
      <p style="margin:0 0 4px;"><strong>Teslim Alacak Ki\u015fi:</strong> ${safeReceiverName}</p>
      <p style="margin:0 0 4px;"><strong>Telefon:</strong> ${safeDeliveryPhone}</p>
      <p style="margin:0 0 16px;"><strong>Teslimat Adresi:</strong> ${safeDeliveryAddress}</p>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <p style="margin-top:16px;"><strong>Toplam:</strong> ${safeOrderTotal} TL</p>
      <p>Sipari\u015f detaylar\u0131n\u0131 hesab\u0131n\u0131zdan da takip edebilirsiniz.</p>
    </div>
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
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    image: images[0] ?? row.image,
    images,
    category: row.category_id,
    description: row.description,
    features: JSON.parse(row.features_json ?? "[]"),
    colors: JSON.parse(row.colors_json ?? "[]"),
    tags: JSON.parse(row.tags_json ?? "[]"),
    isNew: Boolean(row.is_new),
    isBestseller: Boolean(row.is_bestseller),
  };
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
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

async function createSession(userId) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
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
      p.category_id,
      p.description,
      p.features_json,
      p.colors_json,
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

async function getUserWishlistItems(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.price,
      p.image,
      p.category_id,
      p.description,
      p.features_json,
      p.colors_json,
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
  const [orderRows] = await pool.query(
    `
    SELECT id, order_date, total, status, shipping_company, shipping_tracking_no, created_at
    FROM user_orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [userId]
  );

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

  const itemsByOrderId = new Map();
  for (const row of itemRows) {
    const list = itemsByOrderId.get(row.order_id) ?? [];
    let product;
    try {
      product = JSON.parse(row.product_json);
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

  return orderRows.map((row) => ({
    id: row.id,
    date: row.created_at ?? row.order_date,
    items: itemsByOrderId.get(row.id) ?? [],
    total: Number(row.total),
    status: row.status,
    shippingCompany: row.shipping_company ?? "",
    shippingTrackingNo: row.shipping_tracking_no ?? "",
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

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const user = await getSessionUser(token);
  if (!user) {
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

function cleanupExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of adminSessions.entries()) {
    if (expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function requireAdminAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  cleanupExpiredAdminSessions();
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ message: "Session expired or invalid." });
  }

  req.adminToken = token;
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
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "E-posta zorunludur." });
    }
    const [rows] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
    return res.json({ exists: rows.length > 0 });
  } catch (error) {
    return res.status(500).json({ message: "E-posta kontrolü başarısız." });
  }
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

    if (!email || !password) {
      return res.status(400).json({ message: "E-posta ve şifre zorunludur." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });
    }

    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, gender, password_hash FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length > 0) {
      const found = rows[0];
      const isValid = await bcrypt.compare(password, found.password_hash);
      if (!isValid) {
        return res.status(401).json({ message: "Şifre hatalı." });
      }
      const token = await createSession(found.id);
      const user = await getSessionUser(token);
      return res.json({ mode: "login", token, user });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ message: "Ad ve soyad zorunludur." });
    }

    if (!termsAccepted) {
      return res.status(400).json({ message: "Gizlilik Politikası ve Kullanım Koşulları onayı zorunludur." });
    }

    if (!isSmtpConfigured) {
      return res.status(500).json({ message: "E-posta servisi henüz yapılandırılmamış." });
    }

    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const codeHash = sha256(code);
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`DELETE FROM email_verification_codes WHERE email = ? OR expires_at < NOW()`, [email]);
    await pool.query(
      `
      INSERT INTO email_verification_codes (id, email, first_name, last_name, password_hash, gender, phone, code_hash, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
      `,
      [crypto.randomUUID(), email, firstName, lastName, passwordHash, normalizedGender, phone, codeHash]
    );

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
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({ message: "Auth akışı için DB migration gerekli. npm run db:migrate çalıştırın." });
    }
    return res.status(500).json({ message: "İşlem başarısız." });
  }
});

app.post("/api/auth/flow/verify", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const code = String(req.body?.code ?? "").trim();
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

    const token = await createSession(userId);
    const user = await getSessionUser(token);
    return res.json({ token, user });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({ message: "Auth akışı için DB migration gerekli. npm run db:migrate çalıştırın." });
    }
    return res.status(500).json({ message: "Doğrulama işlemi başarısız." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body ?? {};

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [existing] = await pool.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [
      normalizedEmail,
    ]);

    if (existing.length > 0) {
      return res.status(409).json({ message: "This email is already registered." });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(String(password), 10);

    await pool.query(
      `
      INSERT INTO users (id, first_name, last_name, email, phone, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, String(firstName).trim(), String(lastName).trim(), normalizedEmail, "", passwordHash]
    );

    const token = await createSession(userId);
    const user = await getSessionUser(token);
    return res.status(201).json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
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
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const found = rows[0];
    const isValid = await bcrypt.compare(String(password), found.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = await createSession(found.id);
    const user = await getSessionUser(token);
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

    if (!isSmtpConfigured) {
      return res.status(500).json({ message: "E-posta servisi henüz yapılandırılmamış." });
    }

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
      return res.status(404).json({ message: "Bu e-posta ile kayitli kullanici bulunmuyor." });
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

    return res.json({
      ok: true,
      message: "Şifre yenileme bağlantısı e-posta adresinize gönderildi.",
    });
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
    }

    const token = await createSession(userId);
    const user = await getSessionUser(token);
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
    await pool.query(`DELETE FROM user_addresses WHERE id = ? AND user_id = ?`, [
      req.params.id,
      req.authUser.id,
    ]);
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
  const { id, date, status, total, items, shippingAddress } = req.body ?? {};
  const orderId = String(id ?? "").trim();
  const orderDate = String(date ?? "").trim();
  const orderStatus = String(status ?? "processing").trim();
  const orderTotal = Number(total);
  const orderItems = Array.isArray(items) ? items : [];
  const shipping = shippingAddress && typeof shippingAddress === "object" ? shippingAddress : {};
  const shippingFirstName = String(shipping.firstName ?? "").trim();
  const shippingLastName = String(shipping.lastName ?? "").trim();
  const shippingPhone = String(shipping.phone ?? "").trim();
  const shippingStreet = String(shipping.street ?? "").trim();
  const shippingProvince = String(shipping.province ?? "").trim();
  const shippingDistrict = String(shipping.district ?? "").trim();
  const shippingNeighborhood = String(shipping.neighborhood ?? "").trim();

  if (!orderId || !orderDate || !Number.isFinite(orderTotal) || orderItems.length === 0) {
    return res.status(400).json({ message: "Invalid order payload." });
  }

  const normalizedItems = [];
  for (const item of orderItems) {
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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    try {
      await connection.query(
        `
        INSERT INTO user_orders (
          id, user_id, order_date, total, status,
          shipping_first_name, shipping_last_name, shipping_phone, shipping_street, shipping_province, shipping_district, shipping_neighborhood
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          req.authUser.id,
          orderDate,
          Math.round(orderTotal),
          orderStatus,
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

    await connection.commit();
    const orders = await getUserOrders(req.authUser.id);
    const createdOrder = orders.find((order) => order.id === orderId);

    if (createdOrder && isOrderSmtpConfigured) {
      const deliveryAddress =
        shippingStreet || shippingPhone
          ? {
              firstName: shippingFirstName || req.authUser.firstName,
              lastName: shippingLastName || req.authUser.lastName,
              phone: shippingPhone || req.authUser.phone || "",
              street: shippingStreet,
              province: shippingProvince,
              district: shippingDistrict,
              neighborhood: shippingNeighborhood,
            }
          : req.authUser.addresses.find((address) => address.isDefault) ?? req.authUser.addresses[0] ?? null;
      sendOrderConfirmationEmail(req, {
        to: req.authUser.email,
        firstName: req.authUser.firstName,
        order: createdOrder,
        deliveryAddress,
      }).catch((error) => {
        console.error("Order confirmation email send failed:", error?.message || error);
      });
    }

    return res.status(201).json({ order: createdOrder ?? null, orders });
  } catch (error) {
    await connection.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Order already exists." });
    }
    return res.status(500).json({ message: "Order create failed." });
  } finally {
    connection.release();
  }
});

app.post("/api/paytr/token", async (req, res) => {
  try {
    const merchantId = process.env.PAYTR_MERCHANT_ID;
    const merchantKey = process.env.PAYTR_MERCHANT_KEY;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
    const merchantOkUrl = normalizePaytrReturnUrl(process.env.PAYTR_OK_URL, "/odeme/basarili");
    const merchantFailUrl = normalizePaytrReturnUrl(process.env.PAYTR_FAIL_URL, "/odeme/basarisiz");
    const testMode = String(process.env.PAYTR_TEST_MODE ?? "1");

    if (!merchantId || !merchantKey || !merchantSalt || !merchantOkUrl || !merchantFailUrl) {
      return res.status(500).json({ message: "PAYTR env settings are missing." });
    }

    const { email, firstName, lastName, phone, street, province, district, total, items } = req.body ?? {};
    const normalizedEmail = String(email ?? "").trim();
    const normalizedFirstName = String(firstName ?? "").trim();
    const normalizedLastName = String(lastName ?? "").trim();
    const normalizedPhone = String(phone ?? "").trim();
    const normalizedStreet = String(street ?? "").trim();
    const normalizedProvince = String(province ?? "").trim();
    const normalizedDistrict = String(district ?? "").trim();
    const amount = Number(total);
    const orderItems = Array.isArray(items) ? items : [];

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
      String(item?.name ?? "").slice(0, 120),
      Number(item?.unitPrice ?? 0).toFixed(2),
      Number(item?.quantity ?? 1),
    ]);
    const userBasket = Buffer.from(JSON.stringify(userBasketRaw), "utf8").toString("base64");

    const userIp = getClientIp(req);
    const merchantOid = `OID${Date.now()}${Math.floor(Math.random() * 1000000)}`;
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

  const { email, password } = req.body ?? {};
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedPassword = String(password ?? "");

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const matched = adminPairs.some(
    (pair) => pair.email === normalizedEmail && pair.password === normalizedPassword
  );

  if (!matched) {
    return res.status(401).json({ message: "Invalid admin credentials." });
  }

  cleanupExpiredAdminSessions();
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  adminSessions.set(token, expiresAt);

  return res.json({ token });
});

app.get("/api/admin/me", async (req, res) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  cleanupExpiredAdminSessions();
  const expiresAt = adminSessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return res.status(401).json({ message: "Session expired or invalid." });
  }

  return res.json({ ok: true });
});

app.get("/api/settings", async (_req, res) => {
  try {
    const siteName = await getSiteNameSetting();
    return res.json({ siteName });
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
    return res.json({ siteName });
  } catch (error) {
    return res.status(500).json({ message: "Admin settings update failed." });
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
        const product = JSON.parse(row.product_json);
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
        status: row.status,
        shippingCompany: row.shipping_company ?? "",
        shippingTrackingNo: row.shipping_tracking_no ?? "",
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

app.patch("/api/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
  try {
    const orderId = String(req.params.id ?? "").trim();
    const nextStatus = String(req.body?.status ?? "").trim();
    const shippingCompany = String(req.body?.shippingCompany ?? "").trim();
    const shippingTrackingNo = String(req.body?.shippingTrackingNo ?? "").trim();
    const allowedStatus = new Set(["processing", "shipped", "delivered"]);

    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    if (!allowedStatus.has(nextStatus)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    if (nextStatus === "shipped") {
      if (!shippingCompany || !shippingTrackingNo) {
        return res
          .status(400)
          .json({ message: "Kargoya verildi için kargo firması ve takip no zorunludur." });
      }
      if (!allowedShippingCompanies.has(shippingCompany)) {
        return res.status(400).json({ message: "Geçersiz kargo firması." });
      }
    }

    const [result] = await pool.query(
      `
      UPDATE user_orders
      SET status = ?, shipping_company = ?, shipping_tracking_no = ?
      WHERE id = ?
      `,
      [
        nextStatus,
        nextStatus === "shipped" ? shippingCompany : null,
        nextStatus === "shipped" ? shippingTrackingNo : null,
        orderId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.json({
      ok: true,
      status: nextStatus,
      shippingCompany: nextStatus === "shipped" ? shippingCompany : "",
      shippingTrackingNo: nextStatus === "shipped" ? shippingTrackingNo : "",
    });
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") {
      return res
        .status(500)
        .json({ message: "DB migration required for shipping fields. Run npm run db:migrate." });
    }
    return res.status(500).json({ message: "Admin order status update failed." });
  }
});

app.get("/api/admin/products", requireAdminAuth, async (_req, res) => {
  try {
    try {
      const [rows] = await pool.query(
        `
        SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
        FROM products
        ORDER BY id ASC
        `
      );
      return res.json({ products: rows.map(mapProductRow) });
    } catch (error) {
      // Backward compatible for DBs without tags_json column.
      if (error?.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }
      const [rows] = await pool.query(
        `
        SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, is_new, is_bestseller
        FROM products
        ORDER BY id ASC
        `
      );
      return res.json({ products: rows.map(mapProductRow) });
    }
  } catch (error) {
    return res.status(500).json({ message: "Admin products fetch failed." });
  }
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

app.post("/api/admin/products", requireAdminAuth, async (req, res) => {
  try {
    const requestedId = String(req.body?.id ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const category = String(req.body?.category ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const image = String(req.body?.image ?? "").trim();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    const price = Number(req.body?.price);
    const features = Array.isArray(req.body?.features) ? req.body.features : [];
    const colors = Array.isArray(req.body?.colors) ? req.body.colors : [];
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const isNew = Boolean(req.body?.isNew);
    const isBestseller = Boolean(req.body?.isBestseller);

    if (!name || !category || !description || !Number.isFinite(price)) {
      return res.status(400).json({ message: "Tum urun alanlari zorunludur." });
    }

    const normalizedImages = images
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0)
      .slice(0, 15);
    const primaryImage = normalizedImages[0] ?? image;
    if (!primaryImage) {
      return res.status(400).json({ message: "En az bir urun gorseli zorunludur." });
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

    const productId = requestedId || (await generateUniqueProductId());

    await pool.query(
      `
      INSERT INTO products (
        id, name, price, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productId,
        name,
        Math.round(price),
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
      SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(500).json({ message: "Urun olusturuldu ancak okunamadi." });
    }

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

app.put("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = String(req.params.id ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const category = String(req.body?.category ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const image = String(req.body?.image ?? "").trim();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];
    const price = Number(req.body?.price);
    const features = Array.isArray(req.body?.features) ? req.body.features : [];
    const colors = Array.isArray(req.body?.colors) ? req.body.colors : [];
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const isNew = Boolean(req.body?.isNew);
    const isBestseller = Boolean(req.body?.isBestseller);

    if (!productId || !name || !category || !description || !Number.isFinite(price)) {
      return res.status(400).json({ message: "Tum urun alanlari zorunludur." });
    }
    const normalizedImages = images
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0)
      .slice(0, 15);
    const primaryImage = normalizedImages[0] ?? image;
    if (!primaryImage) {
      return res.status(400).json({ message: "En az bir urun gorseli zorunludur." });
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
        Math.round(price),
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
      SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
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
    const [rows] = await pool.query(
      `SELECT id, name, image, description FROM categories ORDER BY name ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories." });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    const where = [];
    const params = [];

    if (typeof search === "string" && search.trim() !== "") {
      where.push("(name LIKE ? OR description LIKE ?)");
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }

    if (typeof category === "string" && category.trim() !== "") {
      where.push("category_id = ?");
      params.push(category.trim());
    }

    let orderBy = "id ASC";
    if (sort === "price-low") orderBy = "price ASC";
    if (sort === "price-high") orderBy = "price DESC";
    if (sort === "newest") orderBy = "is_new DESC, id DESC";

    const sql = `
      SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, tags_json, is_new, is_bestseller
      FROM products
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${orderBy}
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(mapProductRow));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products." });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, is_new, is_bestseller
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

    const product = mapProductRow(rows[0]);

    const [relatedRows] = await pool.query(
      `
      SELECT id, name, price, image, images_json, category_id, description, features_json, colors_json, is_new, is_bestseller
      , tags_json
      FROM products
      WHERE category_id = ? AND id <> ?
      ORDER BY id ASC
      LIMIT 2
      `,
      [product.category, product.id]
    );

    return res.json({
      product,
      relatedProducts: relatedRows.map(mapProductRow),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch product." });
  }
});

if (fs.existsSync(distIndexHtml)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(distIndexHtml);
  });
}

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
