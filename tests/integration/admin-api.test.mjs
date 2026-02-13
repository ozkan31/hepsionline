import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import test from "node:test";

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  const text = fs.readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate test port"));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForServer(baseUrl, child, maxMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${baseUrl}/`);
      if (res.status >= 200 && res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error("Timed out waiting for next start");
}

async function startNextServer() {
  const port = await getFreePort();
  const child = spawn(`npm run start -- -p ${port}`, {
    shell: true,
    windowsHide: true,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (d) => {
    logs += d.toString();
  });
  child.stderr.on("data", (d) => {
    logs += d.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl, child);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${logs.slice(-1200)}`);
  }

  return {
    baseUrl,
    stop: async () => {
      if (child.exitCode !== null) return;
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        return;
      }

      child.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 800));
      if (child.exitCode === null) child.kill("SIGKILL");
    },
  };
}

async function loginAsAdmin(baseUrl, username, password) {
  const loginPage = await fetch(`${baseUrl}/akalin1453/giris`);
  const html = await loginPage.text();
  const match = html.match(/name="(\$ACTION_ID_[^"]+)"/);
  if (!match) throw new Error("Server action id not found on login page");
  const actionId = match[1];

  const form = new FormData();
  form.set(actionId, "");
  form.set("next", "/akalin1453");
  form.set("username", username);
  form.set("password", password);

  const loginRes = await fetch(`${baseUrl}/akalin1453/giris`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  assert.equal(loginRes.status, 303, "Admin login should redirect on success");

  const rawSetCookie = loginRes.headers.get("set-cookie") ?? "";
  const cookie = rawSetCookie
    .split(",")
    .map((x) => x.trim())
    .find((x) => x.startsWith("hepsionline_admin_session="))
    ?.split(";")[0];
  assert.ok(cookie, "Admin session cookie should be set");
  return cookie;
}

const envFile = parseEnvFile(".env");
const adminUsername = process.env.ADMIN_USERNAME ?? envFile.ADMIN_USERNAME ?? "";
const adminPassword = process.env.ADMIN_PASSWORD ?? envFile.ADMIN_PASSWORD ?? "";

if (!adminUsername || !adminPassword) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required for integration tests.");
}

const server = await startNextServer();
const { baseUrl } = server;
const adminCookie = await loginAsAdmin(baseUrl, adminUsername, adminPassword);

test("admin api rejects unauthenticated requests", async () => {
  const res = await fetch(`${baseUrl}/api/admin/settings`);
  assert.equal(res.status, 401);
});

test("admin pages are reachable with authenticated session", async () => {
  const res = await fetch(`${baseUrl}/akalin1453/reports`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(res.status, 200);
});

test("admin api returns data with authenticated session", async () => {
  const res = await fetch(`${baseUrl}/api/admin/settings`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(typeof json.site_name, "string");
});

test("admin api validates query params", async () => {
  const res = await fetch(`${baseUrl}/api/admin/reports-revenue?days=abc`, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, "INVALID_QUERY");
});

test("admin settings validates payload schema", async () => {
  const res = await fetch(`${baseUrl}/api/admin/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      palette: { primary: "invalid-color", accent: "#8b5cf6", background: "#ffffff" },
    }),
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, "INVALID_BODY");
});

test.after(async () => {
  await server.stop();
});
