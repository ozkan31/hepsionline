import { prisma } from "@/lib/prisma";

export const COUPON_AB_TEST_KEY = "coupon_checkout_offer";

type CouponAbVariantConfig = {
  couponCode?: string;
};

type CouponAbExperimentRaw = {
  enabled?: boolean;
  traffic?: number;
  splitA?: number;
  forceVariant?: "A" | "B" | null;
  variants?: {
    A?: CouponAbVariantConfig;
    B?: CouponAbVariantConfig;
  };
};

type AbSettingsRaw = {
  enabled?: boolean;
  experiments?: Record<string, unknown>;
};

export type CouponAbExperiment = {
  enabled: boolean;
  traffic: number;
  splitA: number;
  forceVariant: "A" | "B" | null;
  variants: {
    A: { couponCode: string };
    B: { couponCode: string };
  };
};

export const DEFAULT_COUPON_AB_EXPERIMENT: CouponAbExperiment = {
  enabled: false,
  traffic: 100,
  splitA: 50,
  forceVariant: null,
  variants: {
    A: { couponCode: "" },
    B: { couponCode: "" },
  },
};

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizePercent(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function normalizeCouponCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function stableBucket(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 1000003;
  }
  return Math.abs(hash) % 100;
}

export function parseCouponAbExperiment(value: unknown): CouponAbExperiment {
  const raw = safeObject(value) as CouponAbExperimentRaw;
  const variantsRaw = safeObject(raw.variants);
  const aRaw = safeObject(variantsRaw.A);
  const bRaw = safeObject(variantsRaw.B);
  const forceVariant =
    raw.forceVariant === "A" || raw.forceVariant === "B" ? raw.forceVariant : null;

  return {
    enabled: Boolean(raw.enabled),
    traffic: normalizePercent(raw.traffic, DEFAULT_COUPON_AB_EXPERIMENT.traffic),
    splitA: normalizePercent(raw.splitA, DEFAULT_COUPON_AB_EXPERIMENT.splitA),
    forceVariant,
    variants: {
      A: { couponCode: normalizeCouponCode(aRaw.couponCode) },
      B: { couponCode: normalizeCouponCode(bRaw.couponCode) },
    },
  };
}

export async function getCouponAbExperimentFromSettings() {
  const settings = await prisma.adminSetting.findUnique({
    where: { id: 1 },
    select: { abTests: true },
  });

  const ab = safeObject(settings?.abTests) as AbSettingsRaw;
  const experiments = safeObject(ab.experiments);
  const expRaw = experiments[COUPON_AB_TEST_KEY];

  return {
    globalEnabled: Boolean(ab.enabled),
    experiment: parseCouponAbExperiment(expRaw),
    rawAbTests: ab,
  };
}

export async function resolveCouponAbVariantForToken(token: string | null | undefined) {
  if (!token) return null;

  const { globalEnabled, experiment } = await getCouponAbExperimentFromSettings();
  if (!globalEnabled || !experiment.enabled) return null;

  const couponA = experiment.variants.A.couponCode;
  const couponB = experiment.variants.B.couponCode;
  if (!couponA || !couponB) return null;

  if (experiment.forceVariant) {
    const couponCode =
      experiment.forceVariant === "A" ? couponA : couponB;
    return {
      testKey: COUPON_AB_TEST_KEY,
      variant: experiment.forceVariant,
      couponCode,
    } as const;
  }

  const trafficBucket = stableBucket(`${COUPON_AB_TEST_KEY}:traffic:${token}`);
  if (trafficBucket >= experiment.traffic) return null;

  const variantBucket = stableBucket(`${COUPON_AB_TEST_KEY}:variant:${token}`);
  const variant = variantBucket < experiment.splitA ? "A" : "B";
  const couponCode = variant === "A" ? couponA : couponB;

  return {
    testKey: COUPON_AB_TEST_KEY,
    variant,
    couponCode,
  } as const;
}

