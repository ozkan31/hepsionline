export type ShippingCarrierCode = "ARAS" | "YURTICI" | "MNG" | "SURAT" | "PTT" | "UPS";

export const SHIPPING_CARRIERS: ShippingCarrierCode[] = ["ARAS", "YURTICI", "MNG", "SURAT", "PTT", "UPS"];

type CargoConfig = {
  mode: "mock" | "live";
  baseUrl: string | null;
  apiKey: string | null;
  timeoutMs: number;
};

export type CarrierNotifyInput = {
  carrier: ShippingCarrierCode;
  trackingNo: string;
  orderId: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
};

export type CarrierNotifyResult = {
  ok: boolean;
  providerRef?: string;
  error?: string;
  mock?: boolean;
};

function getCargoConfig(): CargoConfig {
  const mode = process.env.CARGO_API_MODE === "live" ? "live" : "mock";
  const baseUrl = process.env.CARGO_API_BASE_URL?.trim() || null;
  const apiKey = process.env.CARGO_API_KEY?.trim() || null;
  const timeoutMs = Number(process.env.CARGO_API_TIMEOUT_MS || 12000);

  return {
    mode,
    baseUrl,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000,
  };
}

export async function notifyCarrier(input: CarrierNotifyInput): Promise<CarrierNotifyResult> {
  const config = getCargoConfig();

  if (config.mode !== "live") {
    return {
      ok: true,
      mock: true,
      providerRef: `MOCK-${input.carrier}-${input.orderId}-${Date.now()}`,
    };
  }

  if (!config.baseUrl || !config.apiKey) {
    return {
      ok: false,
      error: "CARGO_API_BASE_URL veya CARGO_API_KEY eksik.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        carrier: input.carrier,
        trackingNo: input.trackingNo,
        orderId: input.orderId,
        recipient: {
          name: input.customerName,
          phone: input.customerPhone,
          address: input.customerAddress,
        },
      }),
      signal: controller.signal,
    });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {}

    if (!res.ok) {
      return {
        ok: false,
        error: `Kargo API hatasi: HTTP ${res.status}`,
      };
    }

    const providerRef =
      typeof body === "object" && body !== null && "providerRef" in body && typeof (body as { providerRef?: unknown }).providerRef === "string"
        ? (body as { providerRef: string }).providerRef
        : undefined;

    return { ok: true, providerRef };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Kargo servisine baglanilamadi.",
    };
  } finally {
    clearTimeout(timer);
  }
}

