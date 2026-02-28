import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "./db.mjs";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 3001);
const adminSessions = new Map();
const DEFAULT_SITE_NAME = "Paris move";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const SESSION_DAYS = 30;
const allowedShippingCompanies = new Set([
  "Sen Kargo",
  "Aras Kargo",
  "PTT Kargo",
  "DHL",
  "Sürat Kargo",
  "Yurtiçi Kargo",
]);

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
    SELECT id, first_name, last_name, phone, street, province, district, is_default
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
    SELECT u.id, u.first_name, u.last_name, u.email, u.phone
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
    isDefault: Boolean(isDefault),
  };

  if (
    !normalized.firstName ||
    !normalized.lastName ||
    !normalized.phone ||
    !normalized.street ||
    !normalized.province ||
    !normalized.district
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

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
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
        id, user_id, first_name, last_name, phone, street, province, district, is_default
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      SET first_name = ?, last_name = ?, phone = ?, street = ?, province = ?, district = ?, is_default = ?
      WHERE id = ? AND user_id = ?
      `,
      [
        value.firstName,
        value.lastName,
        value.phone,
        value.street,
        value.province,
        value.district,
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
  const { id, date, status, total, items } = req.body ?? {};
  const orderId = String(id ?? "").trim();
  const orderDate = String(date ?? "").trim();
  const orderStatus = String(status ?? "processing").trim();
  const orderTotal = Number(total);
  const orderItems = Array.isArray(items) ? items : [];

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

    await connection.query(
      `
      INSERT INTO user_orders (id, user_id, order_date, total, status)
      VALUES (?, ?, ?, ?, ?)
      `,
      [orderId, req.authUser.id, orderDate, Math.round(orderTotal), orderStatus]
    );

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

app.post("/api/admin/login", async (req, res) => {
  const adminEmail = String(process.env.ADMIN_PANEL_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PANEL_PASSWORD ?? "");
  if (!adminEmail || !adminPassword) {
    return res.status(500).json({ message: "Admin env settings are missing." });
  }

  const { email, password } = req.body ?? {};
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedPassword = String(password ?? "");

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  if (normalizedEmail !== adminEmail || normalizedPassword !== adminPassword) {
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
      SELECT user_id, first_name, last_name, phone, street, province, district, is_default, created_at
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
      const address = addressByUserId.get(row.user_id) ?? null;
      return {
        id: row.id,
        date: row.created_at ?? row.order_date,
        items: itemsByOrderId.get(row.id) ?? [],
        total: Number(row.total),
        status: row.status,
        shippingCompany: row.shipping_company ?? "",
        shippingTrackingNo: row.shipping_tracking_no ?? "",
        customer: {
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone ?? "",
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

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
