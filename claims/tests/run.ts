// Runs the frozen test claims (claims.json) through the parser alone and through the parser plus the model, and
// reports counts and every failure. Then: the places where the dry rule fires, the demo claims (from their cache,
// no network) and the published claims in ../real_claims.json, which have no expected values.
//
//   node claims/tests/run.ts
//
// Model replies come from model_cache.json, kept apart per settings key (a hash of the model, prompt and token limit,
// so a new LLM_MODEL records afresh). Missing ones are recorded first, with a 20 s timeout, when LLM_BASE_URL,
// LLM_MODEL and LLM_API_KEY are set and LLM_DISABLED is not 1. A recorded reply counts only if it arrived within
// LLM_TIMEOUT_MS (default 2500). The demo replies in ../demo.json are recorded again when the settings change.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cacheKey, check, type CacheEntry, type Result } from "../check.ts";
import { askModel, settingsKey, timeoutMs } from "../model.ts";
import type { Places } from "../parse.ts";
import { isDry } from "../verdict.ts";

interface Expect {
  place: string | null; polarity: string; date_kind: string; date_from: string | null; date_to: string | null;
  claim_type: string; quantifier: string | null; verdict: string;
}
interface TestClaim { id: string; set: "clean" | "messy"; text: string; expect: Expect; why: string }
interface RealClaim { quote: string; source: string; link: string; published: string; refers_to?: string; place_hint?: string }

const here = (p: string) => new URL(p, import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(here(p), "utf8"));
const places: Places = read("../../data/places.json");
const tests: TestClaim[] = read("claims.json").claims;
const demo: { claims: string[]; settings?: string; cache: Record<string, CacheEntry> } = read("../demo.json");
const real: RealClaim[] = read("../real_claims.json");
const store: Record<string, Record<string, CacheEntry>> = existsSync(here("model_cache.json")) ? read("model_cache.json") : {};
const key = settingsKey(), cache = (store[key] ??= {});
console.log("Test claims frozen in d1bd515; the first run (12 Nov) is the clean test. Any later run is after fixes, not a clean test.");

// 1. Record missing model replies.
const env = process.env;
const live = env.LLM_DISABLED !== "1" && !!env.LLM_BASE_URL && !!env.LLM_MODEL && !!env.LLM_API_KEY;
async function record(texts: string[], into: Record<string, CacheEntry>): Promise<number> {
  let n = 0;
  for (const t of texts)
    if (live && !into[cacheKey(t)]) {
      into[cacheKey(t)] = await askModel(t, 20000);
      n++;
    }
  return n;
}
const recorded = await record([...tests.map((c) => c.text), ...real.map((r) => r.quote)], cache);
if (recorded) writeFileSync(here("model_cache.json"), JSON.stringify(store, null, 1) + "\n");
if (live && demo.settings !== key) [demo.settings, demo.cache] = [key, {}];
if (await record(demo.claims, demo.cache)) writeFileSync(here("../demo.json"), JSON.stringify(demo, null, 1) + "\n");
console.log(`Model replies recorded this run: ${recorded} (${live ? "model settings found" : "no model settings, so none recorded"}). Settings key ${key}. Timeout for use: ${timeoutMs()} ms.`);

// 2. No network from here on: model replies come from the caches only.
delete env.LLM_BASE_URL;

const nameOf = (r: Result) => places.places.find((p) => p.id === r.fields.place_id)?.name ?? null;
function diffs(r: Result, e: Expect): string[] {
  const f = r.fields, out: string[] = [];
  const got: Record<string, unknown> = { place: nameOf(r), polarity: f.polarity, date_kind: f.date_kind, date_from: f.date_from, date_to: f.date_to, claim_type: f.claim_type };
  for (const k of Object.keys(got)) if (got[k] !== e[k as keyof Expect]) out.push(`${k}: expected ${e[k as keyof Expect]}, got ${got[k]}`);
  if ((f.quantifier === null) !== (e.quantifier === null)) out.push(`quantifier: expected ${e.quantifier}, got ${f.quantifier}`);
  return out;
}

const runs: Record<string, { claim: TestClaim; r: Result; fieldDiffs: string[] }[]> = { "parser alone": [], "parser plus model": [] };
for (const c of tests) {
  for (const [path, opts] of [["parser alone", {}], ["parser plus model", { cache }]] as const) {
    const r = await check(c.text, places, opts);
    runs[path].push({ claim: c, r, fieldDiffs: diffs(r, c.expect) });
  }
}

const count = (xs: { claim: TestClaim }[], ok: (x: never) => boolean, set?: string) => {
  const sub = xs.filter((x) => !set || x.claim.set === set);
  return `${sub.filter(ok as (x: unknown) => boolean).length} of ${sub.length}`;
};
for (const [path, rows] of Object.entries(runs)) {
  const fieldsOk = (x: { fieldDiffs: string[] }) => x.fieldDiffs.length === 0;
  const verdictOk = (x: { claim: TestClaim; r: Result }) => x.r.verdict === x.claim.expect.verdict;
  console.log(`\n${path}:`);
  console.log(`  fields correct:  ${count(rows, fieldsOk as never)} (clean ${count(rows, fieldsOk as never, "clean")}, messy ${count(rows, fieldsOk as never, "messy")})`);
  console.log(`  verdict correct: ${count(rows, verdictOk as never)} (clean ${count(rows, verdictOk as never, "clean")}, messy ${count(rows, verdictOk as never, "messy")})`);
  const status: Record<string, number> = {}, paths: Record<string, number> = {};
  for (const { r } of rows) [status[r.model_status], paths[r.path]] = [(status[r.model_status] ?? 0) + 1, (paths[r.path] ?? 0) + 1];
  console.log(`  fields came from: ${Object.entries(paths).map(([k, v]) => `${k} ${v}`).join(", ")}; model status: ${Object.entries(status).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (path === "parser plus model") {
    const inTime = tests.filter((c) => cache[cacheKey(c.text)]?.content && cache[cacheKey(c.text)].ms <= timeoutMs()).length;
    const ms = tests.map((c) => cache[cacheKey(c.text)]?.ms).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
    console.log(`  model replies within ${timeoutMs()} ms: ${inTime} of ${tests.length}${ms.length ? ` (median ${ms[ms.length >> 1]} ms, slowest ${ms[ms.length - 1]} ms)` : ""}`);
    const finish: Record<string, number> = {};
    for (const c of tests) { const f = String(cache[cacheKey(c.text)]?.finish ?? "not recorded"); finish[f] = (finish[f] ?? 0) + 1; }
    console.log(`  finish reasons: ${Object.entries(finish).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  }
}

console.log("\nFailures (every claim where the fields or the verdict differ from the frozen expectation):");
let failures = 0;
for (const [path, rows] of Object.entries(runs))
  for (const { claim, r, fieldDiffs } of rows) {
    const verdictWrong = r.verdict !== claim.expect.verdict;
    if (!verdictWrong && !fieldDiffs.length) continue;
    failures++;
    console.log(`  [${path}] ${claim.id} (${claim.set}) "${claim.text}"  (fields from ${r.path}, model ${r.model_status})`);
    if (verdictWrong) console.log(`      verdict: expected ${claim.expect.verdict}, got ${r.verdict}. ${r.headline}`);
    for (const d of fieldDiffs) console.log(`      ${d}`);
    if (r.path === "conflict") console.log(`      ${r.reasons[0]}`);
  }
if (!failures) console.log("  none");

console.log("\nPlaces where the dry rule fires (no new open water on the open ground):");
for (const p of places.places.filter(isDry))
  console.log(`  ${p.name} (${p.place}, ${p.area}) ${p.lon}, ${p.lat}: radius ${p.buffer_m / 1000} km, open ground ${(p.open_share * 100).toFixed(0)}% of the area, `
    + `new open water on it ${((p.new_water_share_open ?? 0) * 100).toFixed(2)}%`);

console.log("\nDemo claims (cached model replies, no network):");
let fromCache = 0;
for (const t of demo.claims) {
  const r = await check(t, places, { cache: demo.cache });
  if (r.model_status !== "disabled") fromCache++;
  console.log(`  "${t}"\n      ${r.headline}  [fields from ${r.path}, model ${r.model_status}]`);
}
console.log(`  ${fromCache} of ${demo.claims.length} demo claims resolved from the cache.`);

console.log("\nPublished claims (real_claims.json): reported only, never used to tune anything.");
if (!real.length) console.log("  none yet");
for (const c of real) {
  const r = await check(c.quote, places, { cache, date: c.refers_to, published: c.published, place_hint: c.place_hint });
  console.log(`  "${c.quote}" (${c.source}, published ${c.published}${c.refers_to ? `, refers to ${c.refers_to}` : ""}${c.place_hint ? `, place hint ${c.place_hint}` : ""})`
    + `\n      ${r.headline}  [fields from ${r.path}, model ${r.model_status}]\n      ${r.reasons.slice(0, 2).join("\n      ")}`);
}
