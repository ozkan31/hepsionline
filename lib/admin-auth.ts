import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "hepsionline_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  username: string;
  iat: number;
  exp: number;
};

type SessionVerification =
  | { ok: true; session: AdminSessionPayload }
  | { ok: false; reason: "missing_token" | "invalid_token" | "expired_token" | "config_error" };

type CredentialsValidation =
  | { ok: true }
  | { ok: false; reason: "missing_credentials" | "invalid_credentials" | "missing_secret" };

function timingSafeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function signTokenPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function isAdminAuthConfigured() {
  return Boolean(getAdminCredentials() && getAdminSecret());
}

export function createAdminSessionToken(username: string) {
  const secret = getAdminSecret();
  if (!secret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    username,
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signTokenPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined): SessionVerification {
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const secret = getAdminSecret();
  if (!secret) {
    return { ok: false, reason: "config_error" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "invalid_token" };
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = signTokenPayload(encodedPayload, secret);
  if (!timingSafeEquals(signature, expectedSignature)) {
    return { ok: false, reason: "invalid_token" };
  }

  let payload: AdminSessionPayload | null = null;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSessionPayload;
  } catch {
    return { ok: false, reason: "invalid_token" };
  }

  if (!payload || typeof payload.username !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "invalid_token" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { ok: false, reason: "expired_token" };
  }

  return { ok: true, session: payload };
}

export function validateAdminCredentials(inputUsername: string, inputPassword: string): CredentialsValidation {
  const credentials = getAdminCredentials();
  if (!credentials) {
    return { ok: false, reason: "missing_credentials" };
  }

  if (!getAdminSecret()) {
    return { ok: false, reason: "missing_secret" };
  }

  const usernameValid = timingSafeEquals(inputUsername, credentials.username);
  const passwordValid = timingSafeEquals(inputPassword, credentials.password);
  if (!usernameValid || !passwordValid) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return { ok: true };
}

export async function getAdminSessionFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function setAdminSessionCookie(username: string) {
  const token = createAdminSessionToken(username);
  if (!token) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return true;
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
