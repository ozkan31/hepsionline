import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveLocalBaseUrl } from "@/lib/runtime-port";

type PaytrConfig = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testMode: "0" | "1";
  debugOn: "0" | "1";
  noInstallment: "0" | "1";
  maxInstallment: string;
  timeoutLimit: string;
  currency: string;
  lang: string;
};

type PaytrBasketItem = {
  name: string;
  unitPrice: number;
  quantity: number;
};

type PaytrTokenRequestInput = {
  merchantOid: string;
  userIp: string;
  email: string;
  paymentAmount: number;
  userBasketBase64: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  merchantOkUrl: string;
  merchantFailUrl: string;
};

type PaytrTokenSuccess = {
  ok: true;
  token: string;
};

type PaytrTokenFailure = {
  ok: false;
  error: string;
  rawResponse?: string;
};

export type PaytrTokenResult = PaytrTokenSuccess | PaytrTokenFailure;

function normalizeSiteUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isLocalLikeHost(hostname: string) {
  const lower = hostname.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "::1";
}

function isLocalLikeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return isLocalLikeHost(parsed.hostname);
  } catch {
    return false;
  }
}

function parseFlag(value: string | undefined, fallback: "0" | "1") {
  if (value === "0" || value === "1") {
    return value;
  }

  return fallback;
}

function parseMaxInstallment(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "0";
  }
  return trimmed;
}

function parseTimeoutLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "30";
  }
  return String(parsed);
}

export function getPaytrConfig(): PaytrConfig | null {
  const merchantId = process.env.PAYTR_MERCHANT_ID?.trim() ?? "";
  const merchantKey = process.env.PAYTR_MERCHANT_KEY?.trim() ?? "";
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT?.trim() ?? "";

  if (!merchantId || !merchantKey || !merchantSalt) {
    return null;
  }

  return {
    merchantId,
    merchantKey,
    merchantSalt,
    testMode: parseFlag(process.env.PAYTR_TEST_MODE, "1"),
    debugOn: parseFlag(process.env.PAYTR_DEBUG_ON, "0"),
    noInstallment: parseFlag(process.env.PAYTR_NO_INSTALLMENT, "0"),
    maxInstallment: parseMaxInstallment(process.env.PAYTR_MAX_INSTALLMENT),
    timeoutLimit: parseTimeoutLimit(process.env.PAYTR_TIMEOUT_LIMIT),
    currency: process.env.PAYTR_CURRENCY?.trim() || "TL",
    lang: process.env.PAYTR_LANG?.trim() || "tr",
  };
}

export function isPaytrConfigured() {
  return getPaytrConfig() !== null;
}

export function resolveAppBaseUrl(headersList: Headers) {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const hostOnly = host?.split(",")[0]?.trim().split(":")[0] ?? "";

  if (fromEnv) {
    const envIsLocal = isLocalLikeUrl(fromEnv);
    const requestIsLocal = hostOnly ? isLocalLikeHost(hostOnly) : false;

    // If env URL is localhost but request is from a public host, ignore env and use request host.
    if (!envIsLocal || requestIsLocal) {
      return normalizeSiteUrl(fromEnv);
    }
  }

  if (!host) {
    return resolveLocalBaseUrl();
  }

  const proto = headersList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function getClientIpFromHeaders(headersList: Headers) {
  const forced = process.env.PAYTR_FORCE_USER_IP?.trim();
  if (forced) {
    return forced;
  }

  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "127.0.0.1";
}

export function buildPaytrBasketBase64(items: PaytrBasketItem[]) {
  const basket = items.map((item) => [item.name, item.unitPrice.toFixed(2), item.quantity] as const);
  return Buffer.from(JSON.stringify(basket), "utf8").toString("base64");
}

function createIframeTokenHash(config: PaytrConfig, input: PaytrTokenRequestInput) {
  const hashSource =
    config.merchantId +
    input.userIp +
    input.merchantOid +
    input.email +
    input.paymentAmount +
    input.userBasketBase64 +
    config.noInstallment +
    config.maxInstallment +
    config.currency +
    config.testMode;

  return createHmac("sha256", config.merchantKey)
    .update(hashSource + config.merchantSalt)
    .digest("base64");
}

export async function requestPaytrIframeToken(input: PaytrTokenRequestInput): Promise<PaytrTokenResult> {
  const config = getPaytrConfig();
  if (!config) {
    return {
      ok: false,
      error: "PAYTR konfigürasyonu eksik",
    };
  }

  const paytrToken = createIframeTokenHash(config, input);

  const params = new URLSearchParams({
    merchant_id: config.merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email: input.email,
    payment_amount: String(input.paymentAmount),
    user_basket: input.userBasketBase64,
    no_installment: config.noInstallment,
    max_installment: config.maxInstallment,
    currency: config.currency,
    test_mode: config.testMode,
    debug_on: config.debugOn,
    lang: config.lang,
    merchant_ok_url: input.merchantOkUrl,
    merchant_fail_url: input.merchantFailUrl,
    user_name: input.userName,
    user_address: input.userAddress,
    user_phone: input.userPhone,
    timeout_limit: config.timeoutLimit,
    paytr_token: paytrToken,
    merchant_key: config.merchantKey,
    merchant_salt: config.merchantSalt,
  });

  let rawResponse = "";
  try {
    const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });

    rawResponse = await response.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      return {
        ok: false,
        error: `PAYTR yanıtı JSON değil (HTTP ${response.status})`,
        rawResponse,
      };
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "status" in parsed &&
      parsed.status === "success" &&
      "token" in parsed &&
      typeof parsed.token === "string"
    ) {
      return {
        ok: true,
        token: parsed.token,
      };
    }

    if (typeof parsed === "object" && parsed !== null && "reason" in parsed && typeof parsed.reason === "string") {
      return {
        ok: false,
        error: parsed.reason,
        rawResponse,
      };
    }

    return {
      ok: false,
      error: `PAYTR token isteği başarısız (HTTP ${response.status})`,
      rawResponse,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `PAYTR bağlantı hatası: ${message}`,
      rawResponse,
    };
  }
}

export function createPaytrCallbackHash(merchantOid: string, status: string, totalAmount: string) {
  const config = getPaytrConfig();
  if (!config) {
    return null;
  }

  const hashValue = createHmac("sha256", config.merchantKey)
    .update(merchantOid + config.merchantSalt + status + totalAmount)
    .digest("base64");

  return hashValue;
}

export function isSafeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
