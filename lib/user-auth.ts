import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const USER_SESSION_COOKIE = "hepsionline_user_session";
export const USER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type UserSessionPayload = {
  userId: number;
  email: string;
  fullName: string;
  iat: number;
  exp: number;
};

type SessionVerification =
  | { ok: true; session: UserSessionPayload }
  | { ok: false; reason: "missing_token" | "invalid_token" | "expired_token" | "config_error" };

function timingSafeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getUserSessionSecret() {
  const dedicatedSecret = process.env.USER_SESSION_SECRET?.trim();
  if (dedicatedSecret) {
    return dedicatedSecret;
  }

  const fallbackSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  return fallbackSecret && fallbackSecret.length > 0 ? fallbackSecret : null;
}

function signTokenPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createUserSessionToken(user: { id: number; email: string; fullName: string }) {
  const secret = getUserSessionSecret();
  if (!secret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: UserSessionPayload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    iat: now,
    exp: now + USER_SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signTokenPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyUserSessionToken(token: string | undefined): SessionVerification {
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const secret = getUserSessionSecret();
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

  let payload: UserSessionPayload | null = null;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as UserSessionPayload;
  } catch {
    return { ok: false, reason: "invalid_token" };
  }

  if (
    !payload ||
    typeof payload.userId !== "number" ||
    typeof payload.email !== "string" ||
    typeof payload.fullName !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "invalid_token" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { ok: false, reason: "expired_token" };
  }

  return { ok: true, session: payload };
}

export async function getUserSessionFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  return verifyUserSessionToken(token);
}

export async function setUserSessionCookie(user: { id: number; email: string; fullName: string }) {
  const token = createUserSessionToken(user);
  if (!token) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  });

  return true;
}

export async function clearUserSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUserFromSession() {
  const session = await getUserSessionFromCookie();
  if (!session.ok) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.session.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      district: true,
      postalCode: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return null;
  }

  return user;
}
