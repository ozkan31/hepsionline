import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "hepsionline_admin_session";

function base64UrlToBytes(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyAdminToken(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, signature] = parts;
  let payloadJson = "";
  try {
    payloadJson = new TextDecoder().decode(base64UrlToBytes(encodedPayload));
  } catch {
    return false;
  }

  let payload: { exp?: number } | null = null;
  try {
    payload = JSON.parse(payloadJson) as { exp?: number };
  } catch {
    return false;
  }

  if (!payload || typeof payload.exp !== "number") {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  const expectedSignature = bytesToBase64Url(new Uint8Array(signed));

  return safeEqual(signature, expectedSignature);
}

function unauthorizedApi() {
  return NextResponse.json({ error: "Unauthorized admin session" }, { status: 401 });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/akalin1453");
  const isAdminLoginPage = pathname === "/akalin1453/giris" || pathname === "/akalin1453/giris/";

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  if (isAdminLoginPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const valid = await verifyAdminToken(token, process.env.ADMIN_SESSION_SECRET);
  if (valid) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return unauthorizedApi();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/akalin1453/giris";
  loginUrl.search = `?status=required&next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/api/admin/:path*", "/akalin1453/:path*"],
};

