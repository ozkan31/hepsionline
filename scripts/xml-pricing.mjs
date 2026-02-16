export const PROFIT_TIER_CONFIG = Object.freeze({
  currency: "TRY",
  vatRate: 0.2,
  tierBase: "cost_with_vat",
  profitBase: "cost_with_vat",
  psychologicalEnding: 90,
  tiers: Object.freeze([
    { min: 0, max: 2000, rate: 0.45 },
    { min: 2000, max: 7500, rate: 0.3 },
    { min: 7500, max: 20000, rate: 0.2 },
    { min: 20000, max: 40000, rate: 0.14 },
    { min: 40000, max: null, rate: 0.1 },
  ]),
});

export function resolveProfitRate(costPrice, config = PROFIT_TIER_CONFIG) {
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    return null;
  }

  const tier = config.tiers.find((item) => {
    if (costPrice < item.min) {
      return false;
    }
    if (item.max === null) {
      return true;
    }
    return costPrice < item.max;
  });

  return tier?.rate ?? null;
}

export function applyPsychologicalPrice(roundedPrice, ending = 90) {
  if (!Number.isFinite(roundedPrice) || roundedPrice < 0) {
    return null;
  }

  const priceInt = Math.round(roundedPrice);
  const base = Math.floor(priceInt / 100) * 100 + ending;
  return base >= priceInt ? base : base + 100;
}

export function calculateTieredSellingPrice(costPrice, config = PROFIT_TIER_CONFIG) {
  const vatRate = Number.isFinite(config.vatRate) ? config.vatRate : 0;
  const vatIncludedCost = costPrice * (1 + vatRate);
  const tierBase = config.tierBase === "cost" ? costPrice : vatIncludedCost;
  const profitBase = config.profitBase === "cost" ? costPrice : vatIncludedCost;

  const rate = resolveProfitRate(tierBase, config);
  if (rate === null) {
    return null;
  }

  const grossPrice = profitBase + profitBase * rate;
  const roundedGrossPrice = Math.round(grossPrice);
  const psychologicalPrice = applyPsychologicalPrice(roundedGrossPrice, config.psychologicalEnding);
  if (psychologicalPrice === null) {
    return null;
  }

  return {
    costPrice,
    vatRate,
    vatIncludedCost,
    rate,
    grossPrice,
    roundedGrossPrice,
    finalPrice: psychologicalPrice,
  };
}
