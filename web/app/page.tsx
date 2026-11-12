import fs from "node:fs";
import path from "node:path";
import App from "./App";
import { PRESETS, runCheck } from "../lib/checkClaim";
import { reportMarkdown } from "../lib/report";
import { formatUtc, buildingsLimit, VERDICTS, PATHS, MODEL_STATUSES, type Optical, type Stats } from "./types";

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

// Build-time check of the real checker: every preset claim must give a well-formed result, with no network
// (their model replies are recorded in lib/claims/demo.json).
async function checkPresets() {
  for (const claim of PRESETS) {
    const r = await runCheck(claim);
    const fail = (msg: string) => {
      throw new Error(`preset claim "${claim}": ${msg}`);
    };
    if (!VERDICTS.includes(r.verdict)) fail(`verdict "${r.verdict}"`);
    if (!PATHS.includes(r.path) || !MODEL_STATUSES.includes(r.model_status)) fail(`path "${r.path}" or model status "${r.model_status}"`);
    if (!r.reasons.length) fail("reasons empty");
    if (r.as_of !== "17 Jan 2026, 03:42 UTC" || !r.headline.includes(`as of ${r.as_of}`)) fail("as_of missing from the headline");
    if (r.fields.place && r.evidence?.place.id !== r.fields.place.id) fail("evidence is for another place");
    if (/accura/i.test(JSON.stringify(r))) fail('says "accuracy"; use "agreement"');
    // The card and the exported report print the checker's reasons as they are: the hectares carry their own label
    // ("1,191 ha was newly under open water ... of the area NISAR saw"), never the old "of the area ... (1191 ha)" wording.
    const md = reportMarkdown(r, undefined, "");
    for (const x of r.reasons) if (!md.includes(`- ${x}\n`)) fail("the report does not carry a reason as the card shows it");
    if (r.reasons.some((x) => x.includes("with NISAR data ("))) fail("a reason still has the old hectares wording");
    if (r.reasons.some((x) => x.includes("ha was newly under open water") && !x.includes("of the area NISAR saw"))) fail("hectares without the share's label");
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

export default async function Page() {
  await checkPresets();
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
