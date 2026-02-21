import type { CreateClaimPayload } from "../api";

export const DEMO_CLAIM: CreateClaimPayload = {
  policy_id: "POL-OH-2024-83921",
  claimant: {
    full_name: "Sarah Mitchell",
    phone: "(614) 555-0237",
    email: "sarah.mitchell@email.com",
    address: "782 Maple Ridge Dr, Columbus, OH 43215",
  },
  loss: {
    date_of_loss: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    city: "Columbus",
    description:
      "Was driving eastbound on Broad Street when another vehicle ran a red light at the intersection of 4th Street and collided with the front-right quarter panel. Impact caused significant damage to the bumper, headlight assembly, and fender. Police report filed (CPD #2026-0215-4472). The other driver was cited for running the red light. No injuries reported but vehicle was not drivable and had to be towed to Buckeye Auto Body on E. Main St.",
  },
  vehicle: {
    vin: "1HGCV1F34PA027839",
    year: 2023,
    make: "Honda",
    model: "Accord",
  },
};

export async function fetchDemoImages(): Promise<File[]> {
  try {
    const res = await fetch("/demo-damage.webp");
    if (!res.ok) return [];
    const blob = await res.blob();
    return [new File([blob], "demo-damage.webp", { type: "image/webp" })];
  } catch {
    return [];
  }
}
