import { cookies } from "next/headers";

export const SMART_BUNDLE_CHECKOUT_CAP_COOKIE =
  "hepsionline_smart_bundle_checkout_cap";

const IMPRESSION_COOLDOWN_SECONDS = 60 * 60 * 24;
const ACCEPT_COOLDOWN_SECONDS = 60 * 60 * 48;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SmartBundleCapPayload = {
  nextAllowedAt: number;
  lastAction: "impression" | "accepted";
  updatedAt: number;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parsePayload(raw: string | undefined): SmartBundleCapPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SmartBundleCapPayload>;
    if (
      !parsed ||
      typeof parsed.nextAllowedAt !== "number" ||
      (parsed.lastAction !== "impression" && parsed.lastAction !== "accepted")
    ) {
      return null;
    }
    return {
      nextAllowedAt: parsed.nextAllowedAt,
      lastAction: parsed.lastAction,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : nowSeconds(),
    };
  } catch {
    return null;
  }
}

async function writePayload(payload: SmartBundleCapPayload) {
  const cookieStore = await cookies();
  cookieStore.set(
    SMART_BUNDLE_CHECKOUT_CAP_COOKIE,
    JSON.stringify(payload),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    },
  );
}

export async function canShowSmartBundleCheckout() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SMART_BUNDLE_CHECKOUT_CAP_COOKIE)?.value;
  const payload = parsePayload(raw);
  if (!payload) return true;
  return payload.nextAllowedAt <= nowSeconds();
}

export async function markSmartBundleCheckoutImpression() {
  const now = nowSeconds();
  await writePayload({
    nextAllowedAt: now + IMPRESSION_COOLDOWN_SECONDS,
    lastAction: "impression",
    updatedAt: now,
  });
}

export async function markSmartBundleCheckoutAccepted() {
  const now = nowSeconds();
  await writePayload({
    nextAllowedAt: now + ACCEPT_COOLDOWN_SECONDS,
    lastAction: "accepted",
    updatedAt: now,
  });
}

export async function clearSmartBundleCheckoutCap() {
  const cookieStore = await cookies();
  cookieStore.set(SMART_BUNDLE_CHECKOUT_CAP_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
