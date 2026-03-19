import dotenv from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(rootDir, ".env") });

const apiPort = Number(process.env.CHECKOUT_BENCH_PORT || 3305);
const baseUrl = `http://127.0.0.1:${apiPort}`;
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function waitForServerReady(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // ignore until timeout
    }
    await sleep(500);
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

function startIsolatedApiServer() {
  const child = spawn(process.execPath, [path.join(rootDir, "server/index.mjs")], {
    cwd: rootDir,
    env: {
      ...process.env,
      API_PORT: String(apiPort),
      WHATSAPP_ENABLED: "false",
      ORDER_SMTP_HOST: "",
      ORDER_SMTP_USER: "",
      ORDER_SMTP_PASS: "",
      ORDER_SMTP_FROM_EMAIL: "",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM_EMAIL: "",
      PAYTR_TEST_MODE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.log(`[bench-api] ${text}`);
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.error(`[bench-api:error] ${text}`);
    }
  });

  return child;
}

async function createTestSession() {
  const userId = crypto.randomUUID();
  const email = `checkout-bench-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const token = crypto.randomBytes(48).toString("hex");

  await mysqlPool.query(
    `
      INSERT INTO users (id, first_name, last_name, email, phone, gender, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, "Bench", "User", email, "05000000000", null, "bench-not-used"]
  );

  await mysqlPool.query(
    `
      INSERT INTO user_sessions (token, user_id, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))
    `,
    [token, userId]
  );

  return { userId, email, token };
}

async function cleanupTestSession(userId) {
  await mysqlPool.query(
    `DELETE oi FROM user_order_items oi INNER JOIN user_orders o ON o.id = oi.order_id WHERE o.user_id = ?`,
    [userId]
  );
  await mysqlPool.query(`DELETE FROM user_orders WHERE user_id = ?`, [userId]);
  await mysqlPool.query(`DELETE FROM user_cart_items WHERE user_id = ?`, [userId]);
  await mysqlPool.query(`DELETE FROM user_wishlist_items WHERE user_id = ?`, [userId]);
  await mysqlPool.query(`DELETE FROM user_addresses WHERE user_id = ?`, [userId]);
  await mysqlPool.query(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
  await mysqlPool.query(`DELETE FROM users WHERE id = ?`, [userId]);
}

async function fetchBenchmarkProduct() {
  const response = await fetch(`${baseUrl}/api/products?limit=1`);
  if (!response.ok) {
    throw new Error(`Failed to fetch benchmark product: HTTP ${response.status}`);
  }
  const data = await response.json();
  const product = Array.isArray(data) ? data[0] : Array.isArray(data?.products) ? data.products[0] : null;
  if (!product) {
    throw new Error("No product available for benchmark.");
  }
  return product;
}

async function runBenchmark({
  name,
  url,
  method = "GET",
  headers = {},
  bodyFactory,
  durationMs,
  concurrency,
  timeoutMs = 15000,
}) {
  console.log(`\n[bench] Starting ${name} | concurrency=${concurrency} duration=${durationMs}ms`);
  const endAt = Date.now() + durationMs;
  const latencies = [];
  const statusCounts = new Map();
  let requests = 0;
  let successes = 0;
  let failures = 0;

  async function worker() {
    while (Date.now() < endAt) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const started = performance.now();
      try {
        const body = bodyFactory ? JSON.stringify(bodyFactory()) : undefined;
        const response = await fetch(url, {
          method,
          headers: body
            ? {
                "Content-Type": "application/json",
                ...headers,
              }
            : headers,
          body,
          signal: controller.signal,
        });
        await response.text();
        const latency = performance.now() - started;
        latencies.push(latency);
        requests += 1;
        statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
        if (response.ok) {
          successes += 1;
        } else {
          failures += 1;
        }
      } catch {
        const latency = performance.now() - started;
        latencies.push(latency);
        requests += 1;
        failures += 1;
        statusCounts.set("error", (statusCounts.get("error") || 0) + 1);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsedSeconds = durationMs / 1000;
  const avgLatency = latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0;
  const summary = {
    name,
    concurrency,
    durationMs,
    requests,
    successes,
    failures,
    reqPerSec: Number((requests / elapsedSeconds).toFixed(2)),
    avgLatencyMs: Number(avgLatency.toFixed(2)),
    p95LatencyMs: Number(percentile(latencies, 95).toFixed(2)),
    maxLatencyMs: Number((latencies.length ? Math.max(...latencies) : 0).toFixed(2)),
    statuses: Object.fromEntries(statusCounts),
  };

  console.log(`[bench] Completed ${name}`);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  const child = startIsolatedApiServer();
  let session = null;

  const shutdown = async () => {
    if (session?.userId) {
      try {
        await cleanupTestSession(session.userId);
      } catch (error) {
        console.error("[bench] Cleanup failed:", error?.message || error);
      }
    }
    if (!child.killed) {
      child.kill("SIGTERM");
      await sleep(1000);
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    await mysqlPool.end();
  };

  try {
    await waitForServerReady(`${baseUrl}/api/products?limit=1`);
    session = await createTestSession();
    const product = await fetchBenchmarkProduct();
    const date = new Date().toISOString().slice(0, 10);

    let orderCounter = 0;
    const orderHeaders = {
      Authorization: `Bearer ${session.token}`,
    };

    const orderBodyFactory = () => {
      orderCounter += 1;
      return {
        id: String(Math.floor(1000000000 + Math.random() * 9000000000)),
        date,
        status: "processing",
        total: product.price,
        items: [
          {
            product,
            quantity: 1,
            color: null,
          },
        ],
        shippingAddress: {
          addressName: "Benchmark",
          firstName: "Bench",
          lastName: "User",
          phone: "05000000000",
          street: `Benchmark Sokak ${orderCounter}`,
          province: "İstanbul",
          district: "Kadıköy",
          neighborhood: "Osmanağa",
        },
      };
    };

    const paytrBodyFactory = () => ({
      email: session.email,
      firstName: "Bench",
      lastName: "User",
      phone: "05000000000",
      street: "Benchmark Sokak No: 1",
      province: "İstanbul",
      district: "Kadıköy",
      total: product.price,
      items: [
        {
          name: product.name,
          unitPrice: product.price,
          quantity: 1,
        },
      ],
    });

    const results = [];
    results.push(
      await runBenchmark({
        name: "POST /api/orders",
        url: `${baseUrl}/api/orders`,
        method: "POST",
        headers: orderHeaders,
        bodyFactory: orderBodyFactory,
        concurrency: 5,
        durationMs: 10000,
        timeoutMs: 20000,
      })
    );
    results.push(
      await runBenchmark({
        name: "POST /api/orders",
        url: `${baseUrl}/api/orders`,
        method: "POST",
        headers: orderHeaders,
        bodyFactory: orderBodyFactory,
        concurrency: 10,
        durationMs: 10000,
        timeoutMs: 20000,
      })
    );
    results.push(
      await runBenchmark({
        name: "POST /api/paytr/token",
        url: `${baseUrl}/api/paytr/token`,
        method: "POST",
        bodyFactory: paytrBodyFactory,
        concurrency: 2,
        durationMs: 8000,
        timeoutMs: 30000,
      })
    );
    results.push(
      await runBenchmark({
        name: "POST /api/paytr/token",
        url: `${baseUrl}/api/paytr/token`,
        method: "POST",
        bodyFactory: paytrBodyFactory,
        concurrency: 5,
        durationMs: 8000,
        timeoutMs: 30000,
      })
    );

    console.log("\n[bench] Final summary");
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await shutdown();
  }
}

main().catch((error) => {
  console.error("[bench] Failed:", error?.message || error);
  process.exitCode = 1;
});

