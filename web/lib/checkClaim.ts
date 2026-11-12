// The one entry point the app uses to check a claim. The server route and the browser both end in runCheck():
// on the server the model may fill the fields; in the browser model.ts is disabled, so the parser decides.
import placesJson from "../public/data/places.json";
import demo from "./claims/demo.json";
import real from "./claims/real_claims.json";
import { check, type CacheEntry, type Result } from "./claims/check.ts";
import type { Places } from "./claims/parse.ts";
import type { ClaimResult } from "../app/types";

export const PLACES = placesJson as unknown as Places;
export const PRESETS: string[] = demo.claims;

/** A quote from a published article (lib/claims/real_claims.json). */
export interface PublishedClaim { quote: string; source: string; link: string; published: string; refers_to?: string | null; place_hint?: string }
export const PUBLISHED = real as PublishedClaim[];

export interface ClaimOpts { published?: string; date?: string; place_hint?: string }

/** The checker's result in the shape the panel shows: the place as an object, not an id. */
export function toClaimResult(r: Result): ClaimResult {
  const p = PLACES.places.find((x) => x.id === r.fields.place_id);
  const f = r.fields;
  return {
    claim: r.claim, path: r.path, model_status: r.model_status, verdict: r.verdict, as_of: r.as_of, headline: r.headline,
    reasons: r.reasons, evidence: r.evidence,
    fields: {
      place: p ? { id: p.id, name: p.name, area: p.area, lon: p.lon, lat: p.lat, buffer_m: p.buffer_m } : null,
      polarity: f.polarity, date_from: f.date_from, date_to: f.date_to, date_kind: f.date_kind, claim_type: f.claim_type,
      quantifier: f.quantifier, confidence: f.confidence,
    },
  };
}

export async function runCheck(text: string, opts: ClaimOpts = {}): Promise<ClaimResult> {
  return toClaimResult(await check(text, PLACES, { cache: demo.cache as Record<string, CacheEntry>, ...opts }));
}

/** Ask the server (parser plus model). If it cannot be reached, check in the browser with the parser alone. */
export async function checkClaim(text: string, opts: ClaimOpts = {}): Promise<ClaimResult> {
  try {
    const r = await fetch("/api/check", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, ...opts }),
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) return await r.json();
  } catch {
    // offline or timed out: fall through
  }
  return runCheck(text, opts);
}
