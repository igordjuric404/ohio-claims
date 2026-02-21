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

const DEMO_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1597007066704-67bf2068d950?w=800&q=80",
  "https://images.unsplash.com/photo-1543465077-db45d34b88a5?w=800&q=80",
  "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80",
];

export async function fetchDemoImages(): Promise<File[]> {
  const files: File[] = [];
  for (let i = 0; i < DEMO_IMAGE_URLS.length; i++) {
    try {
      const res = await fetch(DEMO_IMAGE_URLS[i]);
      if (!res.ok) continue;
      const blob = await res.blob();
      files.push(new File([blob], `demo-damage-${i + 1}.jpg`, { type: "image/jpeg" }));
    } catch {
      // Skip images that fail to fetch in demo mode
    }
  }
  return files;
}
