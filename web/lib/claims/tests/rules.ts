// Rule unit tests, written after the test claims were frozen. Part 1 applies the approved thresholds by hand to the
// numbers in web/public/data/places.json (12 Nov 2026); the rest uses synthetic places at the threshold edges and checks the
// date, coverage, type and conflict rules and the "no" rule. If these pass and a claim test fails, the failure is a
// disagreement between NISAR and the Copernicus-based expectation, not a bug.
//
//   node web/lib/claims/tests/rules.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check, type Result } from "../check.ts";
import { parse, resolveRelative, type Fields, type Place, type Places } from "../parse.ts";
import { isDry, isWet, verdict } from "../verdict.ts";

const places: Places = JSON.parse(readFileSync(new URL("../../../public/data/places.json", import.meta.url), "utf8"));
const id = (name: string) => places.places.find((p) => p.name === name)!.id;
const f = (place: string | null, over: Partial<Fields> = {}): Fields => ({ place_id: place && id(place), place_text: place, polarity: "positive",
  date_kind: "none", date_from: null, date_to: null, date_text: null, claim_type: "flood", quantifier: null, confidence: 1, ...over });
const day = (d: string): Partial<Fields> => ({ date_kind: "day", date_from: d, date_to: d });
let n = 0;
const is = (got: unknown, want: unknown, label: string) => { assert.equal(got, want, label); n++; };
const v = (fields: Fields, ps: Places = places, other?: Fields) => verdict(fields, ps, other).verdict;
const nameOf = (r: Result) => places.places.find((p) => p.id === r.fields.place_id)?.name ?? null;

// 1. Real places, by hand.
is(v(f("Chókwè")), "supported", "Chókwè: 42.1% new water of valid, 1,191 ha: wet");
is(v(f("Javanhane")), "supported", "Javanhane: 63.4%, 199 ha: wet");
is(v(f("Macuachane", { polarity: "negative" })), "contradicted", "Macuachane: 30.0%, 94 ha: wet, negative claim");
is(v(f("Taninga")), "supported", "Taninga: 20.0%, 566 ha: wet");
is(v(f("Maconguele")), "contradicted", "Maconguele: 0.34% (not wet); open 98.7%, 0.35% of open, unclear 1.3%: dry");
is(v(f("Munhamane", { polarity: "negative" })), "supported", "Munhamane: open 99.1%, 0.14% of open: dry, negative claim");
is(v(f("Palmeira")), "not provable", "Palmeira: 1.1% (not wet); 1.26% of open ground is above 1%: not dry");
is(v(f("Xai-Xai")), "not provable", "Xai-Xai: 6.4% (not wet); 10.1% of open ground: not dry");
is(v(f("Elija")), "not provable", "Elija: 0%, but open ground 35.3% < 50%: not dry");
is(v(f("Machubo")), "not observable", "Machubo: NISAR data on 0% of the buffer");

// 2. Threshold edges on a synthetic place.
const base = places.places.find((p) => p.name === "Maconguele")!;
const one = (over: Partial<Place>, unclear = 0): Places =>
  ({ ...places, places: [{ ...base, id: "test/1", ...over, coverage: { ...base.coverage, unclear } }] });
const t = (over: Partial<Fields> = {}): Fields => ({ ...f(null), place_id: "test/1", ...over });
is(isWet({ ...base, new_water_share: 0.1, new_water_ha: 10 }), true, "wet at exactly 10% and 10 ha");
is(isWet({ ...base, new_water_share: 0.0999, new_water_ha: 50 }), false, "not wet just under 10%");
is(isWet({ ...base, new_water_share: 0.5, new_water_ha: 9.9 }), false, "not wet under 10 ha");
const dry: Partial<Place> = { new_water_share: 0.005, new_water_ha: 1, open_share: 0.5, new_water_share_open: 0.01 };
is(isDry(one(dry, 0.1).places[0]), true, "dry at exactly 50% open, 1% of open, 10% unclear");
is(isDry(one({ ...dry, open_share: 0.4999 }, 0.1).places[0]), false, "not dry just under 50% open");
is(isDry(one({ ...dry, new_water_share_open: 0.0101 }, 0.1).places[0]), false, "not dry just over 1% of open");
is(isDry(one(dry, 0.1001).places[0]), false, "not dry just over 10% unclear");
is(v(t(), one({ ...dry, new_water_share: 0.2, new_water_ha: 60 })), "supported", "wet wins when both wet and dry hold");
is(v(t(), one({ new_water_share: 0.05, new_water_ha: 15, open_share: 0.9, new_water_share_open: 0.05 })), "not provable", "between wet and dry");
is(v(t(), one({ valid_share: 0.4999 })), "not observable", "valid share just under 50%");
is(v(t(), one({ valid_share: 0.5 })), "contradicted", "valid share at exactly 50%, dry");

// 3. Dates (Maconguele is dry, Macuachane is wet).
is(v(f("Maconguele", day("2026-01-16"))), "contradicted", "16 Jan is judged");
is(v(f("Maconguele", day("2026-01-17"))), "contradicted", "17 Jan is judged");
is(v(f("Macuachane", day("2026-01-18"))), "not observable", "18 Jan is not judged, even when wet");
is(v(f("Macuachane", day("2026-01-05"))), "not observable", "5 Jan is not judged");
is(v(f("Maconguele", { date_kind: "since", date_from: "2026-01-17", date_to: null })), "contradicted", "since 17 Jan: throughout, dry contradicts");
is(v(f("Macuachane", { date_kind: "since", date_from: "2026-01-18", date_to: null })), "not observable", "since 18 Jan misses the pass");
const jan = { date_kind: "period", date_from: "2026-01-01", date_to: "2026-01-31" } as const;
is(v(f("Macuachane", jan)), "supported", "January, wet: supported");
is(v(f("Macuachane", { ...jan, polarity: "negative" })), "contradicted", "no flood in January, wet: contradicted");
is(v(f("Maconguele", jan)), "not provable", "January, dry: not provable");
is(v(f("Maconguele", { ...jan, polarity: "negative" })), "not provable", "no flood in January, dry: not provable");
is(v(f("Macuachane", { date_kind: "period", date_from: "2026-01-18", date_to: "2026-01-25" })), "not observable", "a range after the pass");
is(v(f("Macuachane", { date_kind: "period", date_from: "2000-01-01", date_to: "2000-12-31" })), "not observable", "the year 2000");
is(v(f("Macuachane", { date_kind: "relative", date_text: "ontem" })), "supported", "a relative date is judged as of the pass");

// 4. Types, places, headlines.
for (const type of ["impact", "damage", "built_up", "vegetation", "depth", "extent", "other"] as const)
  is(v(f("Macuachane", { claim_type: type })), "not provable", `${type} is not provable`);
is(v(f("Macuachane", { claim_type: "impact", ...day("2026-01-25") })), "not observable", "the date gate comes before the type");
is(v(f(null)), "not observable", "no place: not observable");
is(verdict(f("Maconguele"), places).headline, "No new open water detected within 1 km of Maconguele: not supported as of 17 Jan 2026, 03:42 UTC (NISAR Beta)", "dry headline");
is(verdict(f("Chókwè"), places).headline, "Flooding within 3 km of Chókwè: supported as of 17 Jan 2026, 03:42 UTC (NISAR Beta), 42% of the area newly under open water", "wet headline");
is(verdict(f("Macuachane", { polarity: "negative" }), places).headline.startsWith("Flooding within 1 km of Macuachane: contradicted"), true, "wet contradiction keeps the flooding form");
is(verdict(f("Maconguele"), places).reasons.some((r) => r.includes("under crops, trees or between buildings")), true, "dry reasons name what open water misses");
is(verdict(f("Macuachane", { quantifier: "whole" }), places).reasons.some((r) => r.includes('("whole") was not checked')), true, "quantifier reason");

// 5. Conflicts: the gates first, then not provable.
is(v(f("Macuachane"), places, f("Maconguele")), "not provable", "different places, both pass the gates");
is(v(f("Macuachane"), places, f("Macuachane", { polarity: "negative" })), "not provable", "different polarity");
is(v(f("Macuachane", day("2026-01-25")), places, f("Maconguele", day("2026-01-25"))), "not observable", "both readings fail the date gate");
is(v(f("Machubo"), places, f("Macuachane")), "not provable", "one reading passes the gates");

// 6. Negation (changed after the first run). Portuguese "no" is "in the"; English "no" is a negator; "n" is one only
// directly before a Portuguese flood word; a negator reaches the cue anywhere earlier in the same clause.
is(parse("No flooding in Maconguele", places).polarity, "negative", "English no");
is(parse("cheias no distrito de Maconguele", places).polarity, "positive", "Portuguese no");
is(parse("Maconguele nao alagou", places).polarity, "negative", "nao");
is(parse("Maconguele n alagou", places).polarity, "negative", "n directly before alagou");
is(parse("Maconguele n inundado", places).polarity, "negative", "n directly before inundado");
is(parse("Rua n 5 alagada em Maconguele", places).polarity, "positive", "n as an abbreviation is not a negator");
is(parse("Maconguele flooded n destroyed", places).polarity, "positive", "n before an English word is not a negator");
is(parse("Maconguele nao foi afectada pelas cheias", places).polarity, "negative", "negator four words before the cue");
is(parse("Sem energia, Maconguele alagou", places).polarity, "positive", "a comma ends the clause");
is(parse("Nao sei mas Maconguele alagou", places).polarity, "positive", "mas ends the clause");
is(parse("Not sure. Maconguele flooded", places).polarity, "positive", "a full stop ends the clause");
is(parse("Nao houve a 17.01.2026 cheias em Maconguele", places).polarity, "negative", "dots inside a date do not end the clause");
is(parse("Maconguele nao alagou, fake news", places).polarity, "negative", "fake news keeps a negative claim negative");

// 7. Published claims: relative dates from the published date, and the article's place only when the quote names none.
process.env.LLM_DISABLED = "1";
is(JSON.stringify(resolveRelative("ontem", "2026-01-19")), '{"from":"2026-01-18","to":"2026-01-18"}', "ontem in an article of 19 Jan");
is(JSON.stringify(resolveRelative("this week", "2026-01-19")), '{"from":"2026-01-13","to":"2026-01-19"}', "this week: the seven days to the article");
is(resolveRelative("fim de semana", "2026-01-19"), null, "a weekend is left unresolved");
const r1 = await check("Macuachane ficou alagada ontem", places, { published: "2026-01-18" });
is(r1.fields.date_from, "2026-01-17", "ontem on 18 Jan is 17 Jan");
is(r1.verdict, "supported", "and 17 Jan is judged");
is(r1.reasons.some((x) => x.includes('"ontem" in an article published 2026-01-18')), true, "the reasons say how the date was read");
is((await check("Macuachane ficou alagada ontem", places, { published: "2026-01-19" })).verdict, "not observable", "ontem on 19 Jan is 18 Jan");
is((await check("Macuachane ficou alagada hoje", places, { published: "2026-01-17", date: "2026-01-25" })).verdict, "supported", "a resolved relative word wins over refers_to");
is((await check("Macuachane ficou alagada", places, { published: "2026-01-19", date: "2026-01-16" })).fields.date_from, "2026-01-16", "no date: refers_to");
const r2 = await check("A aldeia ficou debaixo de agua", places, { place_hint: "Macuachane" });
is(nameOf(r2), "Macuachane", "no place in the quote: the hint");
is(r2.reasons.some((x) => x.includes("taken from the article, not the quote")), true, "the reasons say so");
is(nameOf(await check("Maconguele ficou debaixo de agua", places, { place_hint: "Macuachane" })), "Maconguele", "the quote's place wins over the hint");

console.log(`rules.ts: ${n} of ${n} checks passed`);
