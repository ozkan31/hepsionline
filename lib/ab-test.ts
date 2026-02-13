import { prisma } from "@/lib/prisma";

type AbExperiment = {
  enabled?: boolean;
  traffic?: number;
  variants?: Record<string, unknown>;
};

type AbSettings = {
  enabled?: boolean;
  experiments?: Record<string, AbExperiment>;
};

function normalizeTraffic(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.floor(value)));
}

function stableBucket(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 1000003;
  }
  return Math.abs(hash) % 100;
}

function pickVariant(experiment: AbExperiment, seed: string) {
  const variants = Object.keys(experiment.variants ?? {}).filter((x) => x.length > 0);
  if (variants.length === 0) {
    return null;
  }

  const index = stableBucket(seed) % variants.length;
  return variants[index] ?? null;
}

export async function resolveAbVariantForToken(testKey: string, token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const settings = await prisma.adminSetting.findUnique({
    where: { id: 1 },
    select: {
      abTests: true,
    },
  });

  const ab = (settings?.abTests ?? {}) as AbSettings;
  if (!ab.enabled) {
    return null;
  }

  const experiment = ab.experiments?.[testKey];
  if (!experiment || !experiment.enabled) {
    return null;
  }

  const traffic = normalizeTraffic(experiment.traffic);
  const trafficBucket = stableBucket(`${testKey}:traffic:${token}`);
  if (trafficBucket >= traffic) {
    return null;
  }

  return pickVariant(experiment, `${testKey}:variant:${token}`);
}
