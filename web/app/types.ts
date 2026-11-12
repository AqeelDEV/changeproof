import type { Evidence } from "../lib/claims/verdict.ts";

// Subset of the stats.json schema (docs/DATA_CONTRACT.md, version 1.1) that the app reads.
export type Bounds = [number, number, number, number]; // [west, south, east, north]

export interface FileEntry {
  file: string;
  format: "png" | "webp" | "geotiff";
  bounds_4326?: Bounds;
  legend?: Record<string, string>;
}

export interface Scene {
  role: "before" | "after";
  granule_id: string;
  start_utc: string;
}

export interface Stats {
  schema_version: string;
  area_id: string;
  name: string;
  as_of_label: string;
  release: string;
  grid: { bounds_4326: Bounds };
  scenes: Scene[];
  reference: {
    source: string;
    activation: string;
    aoi: string;
    product: string;
    sensor: string;
    observed_utc: string;
    observed_ha: number;
  };
  method: { name: string; parameters: { aoi05_test: { lightgbm_iou: number } } };
  results: {
    flooded_ha: number;
    flooded_ha_in_mapped_area: number;
    osm_buildings_in_new_water?: number;
    osm_buildings_on_grid?: number;
  };
  agreement: { iou: number; precision: number; recall: number; evaluated_ha: number };
  coverage: Record<string, number>;
  files: FileEntry[];
  limits: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-01-17T03:42:32Z" -> "17 Jan 2026, 03:42 UTC", the same form as as_of_label.
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export const buildingsLimit = (s: Stats) => s.limits.find((l) => l.startsWith("Buildings:"));

// Claim checker result (lib/claims/), one per claim. fields.place is null when no place matched.
export const VERDICTS = ["supported", "contradicted", "not observable", "not provable"] as const;
export type Verdict = (typeof VERDICTS)[number];

// The checker's vocabulary (lib/claims/check.ts).
export const PATHS = ["parser", "model", "conflict"] as const;
export const MODEL_STATUSES = ["used", "cached", "ignored", "disabled", "timeout", "error", "invalid", "off_list"] as const;

export interface ClaimPlace {
  id: string;
  name: string;
  area: string;
  lon: number;
  lat: number;
  buffer_m: number;
}

export interface ClaimResult {
  claim: string;
  path: (typeof PATHS)[number];
  model_status: (typeof MODEL_STATUSES)[number];
  fields: {
    place: ClaimPlace | null;
    polarity: "positive" | "negative";
    date_from: string | null;
    date_to: string | null;
    date_kind: string;
    claim_type: string;
    quantifier: string | null;
    confidence: number;
  };
  verdict: Verdict;
  as_of: string;
  headline: string;
  reasons: string[];
  evidence: Evidence | null;
}

// A claim to run, asked for from outside the panel. A new object each time, so the same text can run twice.
export interface ClaimRequest { text: string }

// web/public/data/<area>/optical.json, written by pipeline/export_optical.py.
export interface Optical {
  area_id: string;
  images: { file: string; date_utc: string; source: string; product_id: string; cloud: Record<string, number | string> }[];
  note: string;
}
