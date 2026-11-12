import samples from "./sample_results.json";
import type { ClaimResult } from "../app/types";

export const SAMPLES = samples as Record<string, ClaimResult>;

// Accents, case, spacing and trailing punctuation ignored: "Chokwe" matches "Chókwè".
export const normalise = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim().replace(/[\s.!?…]+$/u, "");

const BY_TEXT = new Map(Object.entries(SAMPLES).map(([k, v]) => [normalise(k), v]));

// The one call the panel makes. Connecting the real checker replaces this body.
export async function checkClaim(text: string): Promise<ClaimResult | null> {
  return BY_TEXT.get(normalise(text)) ?? null;
}
