import fs from "node:fs";
import path from "node:path";
import App from "./App";
import { formatUtc, buildingsLimit, type Stats } from "./types";

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

export default function Page() {
  const ids: string[] = JSON.parse(fs.readFileSync(path.join(DATA, "areas.json"), "utf8"));
  const areas = ids.map((id) => {
    const s: Stats = JSON.parse(fs.readFileSync(path.join(DATA, id, "stats.json"), "utf8"));
    check(s, id);
    return s;
  });
  return <App areas={areas} />;
}
