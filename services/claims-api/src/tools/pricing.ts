/**
 * Simulated pricing, labor, and valuation tools for the assessor agent.
 * In production, these would call real APIs (PartsTech, Mitchell, CCC, etc.)
 * For now, they return realistic synthetic data with documented assumptions.
 */

export type PartResult = {
  part_name: string;
  condition: string;
  price_low: number;
  price_high: number;
  source: string;
};

export async function searchParts(params: {
  vehicle: { year?: number; make?: string; model?: string };
  part_name: string;
  condition?: string;
}): Promise<PartResult[]> {
  const basePrices: Record<string, [number, number]> = {
    bumper: [150, 450],
    fender: [100, 350],
    hood: [200, 600],
    door: [250, 700],
    headlight: [80, 250],
    taillight: [60, 200],
    mirror: [50, 180],
    windshield: [200, 500],
    trunk: [300, 800],
    quarter_panel: [200, 500],
  };

  const normalized = params.part_name.toLowerCase().replace(/[^a-z]/g, "_");
  const match = Object.entries(basePrices).find(([k]) => normalized.includes(k));
  const [low, high] = match ? match[1] : [100, 400];

  const condition = params.condition ?? "new_oem";
  const multiplier = condition === "aftermarket" ? 0.6 : condition === "lkq" ? 0.5 : 1.0;

  return [
    {
      part_name: params.part_name,
      condition: condition,
      price_low: Math.round(low * multiplier),
      price_high: Math.round(high * multiplier),
      source: `synthetic_parts_db/${params.vehicle.year ?? "unknown"}_${params.vehicle.make ?? "unknown"}`,
    },
  ];
}

export type LaborRate = {
  rate_per_hour: number;
  locality: string;
  shop_type: string;
  source: string;
};

export async function getLocalLaborRate(params: {
  city?: string;
  state?: string;
  shop_type?: string;
}): Promise<LaborRate> {
  const baseRate = params.state === "OH" ? 65 : 75;
  const shopMultiplier = params.shop_type === "dealer" ? 1.3 : 1.0;

  return {
    rate_per_hour: Math.round(baseRate * shopMultiplier),
    locality: `${params.city ?? "Ohio"}, ${params.state ?? "OH"}`,
    shop_type: params.shop_type ?? "independent",
    source: "ohio_labor_rate_survey_2026",
  };
}

export type ACVResult = {
  actual_cash_value: number;
  mileage_adjustment: number;
  condition_adjustment: number;
  sources: string[];
};

export async function getACV(params: {
  vehicle: { year?: number; make?: string; model?: string };
  mileage?: number;
}): Promise<ACVResult> {
  const yearFactor = Math.max(0.3, 1 - ((2026 - (params.vehicle.year ?? 2020)) * 0.08));
  const baseValue = 25000;
  const mileageAdj = params.mileage ? Math.min(0, -(params.mileage - 50000) * 0.04) : 0;

  return {
    actual_cash_value: Math.round(baseValue * yearFactor + mileageAdj),
    mileage_adjustment: Math.round(mileageAdj),
    condition_adjustment: 0,
    sources: [
      `kbb_estimate_${params.vehicle.year ?? "unknown"}_${params.vehicle.make ?? "unknown"}`,
      `nada_guide_2026`,
    ],
  };
}
