import fs from "node:fs";
import path from "node:path";
import App from "./App";
import { SAMPLES } from "../lib/checkClaim";
import { formatUtc, buildingsLimit, VERDICTS, type Optical, type Stats } from "./types";

const DATA = path.join(process.cwd(), "public", "data");

const isBounds = (b: unknown) =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number");

// Build-time self-check: the build fails if the data breaks what the page relies on.
function check(s: Stats, id: string) {
  const fail = (msg: string) => {
    throw new Error(`web/public/data/${id}/stats.json: ${msg}`);
  };
  if (s.area_id !== id) fail(`area_id is ${s.area_id}`);
  if (s.schema_version !== "1.1") fail(`schema_version is ${s.schema_version}, expected 1.1`);
  if (!s.as_of_label || !s.release) fail("as_of_label or release missing");
  if (!isBounds(s.grid?.bounds_4326)) fail("grid.bounds_4326 missing");
  for (const f of s.files) {
    if (f.format === "geotiff") continue; // points at data/, outside web/, not served
    if (!isBounds(f.bounds_4326)) fail(`${f.file} has no bounds_4326`);
    if (!fs.existsSync(path.join(DATA, id, f.file))) fail(`${f.file} not found`);
  }
  if (typeof s.method?.parameters?.aoi05_test?.lightgbm_iou !== "number")
    fail("method.parameters.aoi05_test.lightgbm_iou missing");
  if (s.results.osm_buildings_in_new_water !== undefined && !buildingsLimit(s))
    fail('building count without a limits entry starting "Buildings:"');
  for (const role of ["before", "after"])
    if (!s.scenes.some((sc) => sc.role === role)) fail(`no ${role} scene`);
  if (formatUtc("2026-01-17T03:42:32Z") !== "17 Jan 2026, 03:42 UTC") fail("formatUtc is wrong");
}

// Build-time shape check of web/lib/sample_results.json, so the real checker's output can be held to the same test.
function checkSamples() {
  const PLACE_KEYS = ["id", "name", "area", "lon", "lat", "buffer_m"];
  const FIELD_KEYS = ["place", "polarity", "date_from", "date_to", "date_kind", "claim_type", "quantifier", "confidence"];
  for (const [claim, r] of Object.entries(SAMPLES)) {
    const fail = (msg: string) => {
      throw new Error(`web/lib/sample_results.json, "${claim}": ${msg}`);
    };
    for (const k of ["path", "model_status", "fields", "verdict", "as_of", "headline", "reasons", "evidence"])
      if (!(k in r)) fail(`${k} missing`);
    if (!VERDICTS.includes(r.verdict)) fail(`verdict "${r.verdict}" is not one of ${VERDICTS.join(", ")}`);
    for (const k of FIELD_KEYS) if (!(k in r.fields)) fail(`fields.${k} missing`);
    const p = r.fields.place;
    if (p !== null && !PLACE_KEYS.every((k) => k in p)) fail(`fields.place needs ${PLACE_KEYS.join(", ")} or null`);
    if (p && (typeof p.lon !== "number" || typeof p.lat !== "number" || typeof p.buffer_m !== "number"))
      fail("fields.place lon, lat and buffer_m must be numbers");
    if (!Array.isArray(r.reasons) || !r.reasons.length) fail("reasons empty");
    if (r.as_of !== "17 Jan 2026, 03:42 UTC" || !r.headline.includes(`as of ${r.as_of}`))
      fail('as_of must be "17 Jan 2026, 03:42 UTC" and appear in the headline');
    if (/accura/i.test(JSON.stringify(r))) fail('says "accuracy"; use "agreement"');
  }
}

// Optional optical.json (pipeline/export_optical.py): every listed image must exist.
function readOptical(id: string): Optical | undefined {
  const file = path.join(DATA, id, "optical.json");
  if (!fs.existsSync(file)) return undefined;
  const o: Optical = JSON.parse(fs.readFileSync(file, "utf8"));
  if (o.area_id !== id || !o.images?.length) throw new Error(`${file}: area_id or images wrong`);
  for (const im of o.images)
    if (!fs.existsSync(path.join(DATA, id, im.file)) || !im.date_utc || !im.source || !im.cloud)
      throw new Error(`${file}: ${im.file} missing or incomplete`);
  return o;
}

export default function Page() {
  checkSamples();
  const ids: string[] = JSON.parse(fs.readFileSync(path.join(DATA, "areas.json"), "utf8"));
  const areas = ids.map((id) => {
    const s: Stats = JSON.parse(fs.readFileSync(path.join(DATA, id, "stats.json"), "utf8"));
    check(s, id);
    return s;
  });
  const optical: Record<string, Optical> = {};
  for (const id of ids) {
    const o = readOptical(id);
    if (o) optical[id] = o;
  }
  return <App areas={areas} optical={optical} />;
}
