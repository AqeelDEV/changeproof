// Verdict rules: fixed thresholds on web/public/data/places.json only. Approved 12 Nov 2026 before any test claim was written;
// never change them on test results.
import type { Fields, Place, Places } from "./parse.ts";

export type Verdict = "supported" | "contradicted" | "not observable" | "not provable";

export const THRESHOLDS = {
  min_valid_share: 0.5, // NISAR data on both dates, share of the buffer
  wet_share: 0.1, // new open water, share of the buffer pixels with NISAR data
  wet_min_ha: 10,
  dry_min_open_share: 0.5, // open ground (valid, not unclear, not built-up), share of the buffer
  dry_max_open_water_share: 0.01, // new open water, share of the open ground
  dry_max_unclear_share: 0.1, // HH rose, possible flooded vegetation, share of the buffer
} as const;
const T = THRESHOLDS;
const PASS_DAY = "2026-01-17";
const JUDGED_DAYS = ["2026-01-16", "2026-01-17"];

export interface Evidence {
  place: { id: string; name: string; type: string; lon: number; lat: number; radius_m: number; in_scored_area: boolean };
  area: { id: string; name: string; release: string; granules: string[] };
  numbers: Pick<Place, "valid_share" | "new_water_ha" | "new_water_share" | "open_share" | "new_water_share_open" | "built_up_share"
    | "dark_5jan_share" | "osm_buildings" | "osm_buildings_in_new_water"> & { unclear_share: number };
  copernicus: string[];
  buildings: string;
  caveats: string[];
}
export interface Judgement { verdict: Verdict; headline: string; reasons: string[]; evidence: Evidence | null }

export const isWet = (p: Place) => (p.new_water_share ?? 0) >= T.wet_share && p.new_water_ha >= T.wet_min_ha;
export const isDry = (p: Place) => p.open_share >= T.dry_min_open_share
  && p.new_water_share_open !== null && p.new_water_share_open <= T.dry_max_open_water_share && p.coverage.unclear <= T.dry_max_unclear_share;

const pct = (x: number | null) => (x === null ? "n/a" : x > 0 && x < 0.01 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);
const km = (p: Place) => `${p.buffer_m / 1000} km`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const span = (from: string, to: string) => {
  const [y, m] = from.split("-");
  if (from.endsWith("-01-01") && to === `${y}-12-31`) return `the year ${y}`;
  if (from.endsWith("-01") && to === `${y}-${m}-${new Date(Date.UTC(+y, +m, 0)).getUTCDate()}`)
    return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+m - 1]} ${y}`;
  return `${day(from)} to ${day(to)}`;
};

/** Is the claim's date one NISAR can speak to, and the sentence that says how it was read. */
function dateGate(f: Fields, asOf: string): { ok: boolean; note: string } {
  const look = `NISAR looked on ${asOf}`;
  switch (f.date_kind) {
    case "none":
      return { ok: true, note: `The claim gives no date; it is judged as of NISAR's look on ${asOf}, the last pass on this track.` };
    case "relative":
      return { ok: true, note: `The claim gives a relative date${f.date_text ? ` ("${f.date_text}")` : ""} that cannot be fixed to a day; it is judged as of NISAR's look on ${asOf}, the last pass on this track.` };
    case "day":
      if (JUDGED_DAYS.includes(f.date_from!)) return { ok: true, note: `The claim refers to ${day(f.date_from!)}; ${look}.` };
      return { ok: false, note: `The claim refers to ${day(f.date_from!)}; NISAR looked on 5 and 17 Jan 2026 only (5 Jan is the "before" image), so that day was not observed.`
        + (f.date_from! > PASS_DAY ? " The flood was still rising after 17 Jan, so the 17 Jan image cannot stand in for a later day." : "") };
    case "since":
      return f.date_from! <= PASS_DAY
        ? { ok: true, note: `The claim says since ${day(f.date_from!)}, read as water throughout that time; NISAR's look on ${asOf} falls inside it.` }
        : { ok: false, note: `The claim says since ${day(f.date_from!)}, which starts after NISAR's last look on ${asOf}.` };
    case "period":
      return f.date_from! <= PASS_DAY && f.date_to! >= PASS_DAY
        ? { ok: true, note: `The claim covers ${span(f.date_from!, f.date_to!)}, read as "at some point in that period". NISAR looked once in it, on ${asOf}: water then counts, no water then does not settle it.` }
        : { ok: false, note: `The claim covers ${span(f.date_from!, f.date_to!)}, which does not include NISAR's look on ${asOf}.` };
  }
}

type Gate = { ok: true; place: Place; note: string } | { ok: false; place: Place | null; reasons: string[] };

function gates(f: Fields, places: Places): Gate {
  const place = places.places.find((p) => p.id === f.place_id) ?? null;
  if (!place) return { ok: false, place, reasons: ["No place in the claim matches a city, town, village or suburb inside the three areas NISAR covered here (AOI05, AOI06 and AOI01)."] };
  const d = dateGate(f, places.as_of_label);
  if (!d.ok) return { ok: false, place, reasons: [d.note] };
  if (place.valid_share < T.min_valid_share)
    return { ok: false, place, reasons: [d.note, `NISAR has data on both dates for only ${pct(place.valid_share)} of the area within ${km(place)} of ${place.name}; at least ${pct(T.min_valid_share)} is needed.`] };
  return { ok: true, place, note: d.note };
}

function check(f: Fields, p: Place | null): string {
  if (!p) return "Claim";
  const at = `within ${km(p)} of ${p.name}`;
  const name: Record<string, string> = {
    flood: `${f.polarity === "negative" ? "No flooding" : "Flooding"} ${at}`, impact: `Deaths, injuries or displacement ${at}`, damage: `Damage ${at}`,
    built_up: `Flooding between buildings ${at}`, vegetation: `Flooded vegetation ${at}`, depth: `Water depth ${at}`, extent: `Flood extent claimed for ${p.name}`,
    other: `Claim about ${p.name}`,
  };
  return name[f.claim_type];
}

const TYPE_REASON: Record<string, string> = {
  impact: "Radar open-water detection cannot show deaths, injuries or displaced people.",
  damage: "Radar open-water detection cannot show damage. Buildings in detected water are counted, but the count says nothing about damage.",
  built_up: "Flooding between buildings looks bright, not dark, in radar, so open-water detection cannot show it, and no dark water there does not contradict it.",
  vegetation: "Water under crops or trees looks bright, not dark, in radar, so open-water detection cannot show it.",
  depth: "Radar open-water detection shows where open water is, not how deep it is.",
  other: "The claim says nothing that radar open-water detection can check.",
};

const asOfNumbers = (p: Place, asOf: string) =>
  `As of ${asOf}, ${pct(p.new_water_share)} of the area within ${km(p)} of ${p.name} with NISAR data (${p.new_water_ha} ha) was newly under open water.`;

function evidence(p: Place, places: Places): Evidence {
  const area = places.areas[p.area];
  const caveats = [`NISAR ${area.release} data: not fully calibrated.`,
    p.in_scored_area ? "This place lies inside the area where NISAR's agreement with Copernicus was measured."
      : "This place lies outside the area where NISAR's agreement with Copernicus was measured."];
  if (p.new_water_ha > 0 && p.dark_5jan_share !== null)
    caveats.push(`${pct(p.dark_5jan_share)} of the new water here was already dark in NISAR's 5 Jan image, so some of it may have been water before.`);
  return {
    place: { id: p.id, name: p.name, type: p.place, lon: p.lon, lat: p.lat, radius_m: p.buffer_m, in_scored_area: p.in_scored_area },
    area: { id: p.area, name: area.name, release: area.release, granules: area.scenes.map((s) => s.granule_id) },
    numbers: { valid_share: p.valid_share, new_water_ha: p.new_water_ha, new_water_share: p.new_water_share, open_share: p.open_share,
      new_water_share_open: p.new_water_share_open, built_up_share: p.built_up_share, unclear_share: p.coverage.unclear,
      dark_5jan_share: p.dark_5jan_share, osm_buildings: p.osm_buildings, osm_buildings_in_new_water: p.osm_buildings_in_new_water },
    copernicus: p.copernicus.map((c) => `Copernicus ${c.product}, ${c.sensor}, ${day(c.observed_utc.slice(0, 10))} ${c.observed_utc.slice(11, 16)} UTC: `
      + (c.mapped_share ? `maps ${pct(c.mapped_share)} of the area within ${km(p)} and calls ${pct(c.flooded_share)} of the mapped part flooded.`
        : `does not cover this place.`)),
    buildings: `${p.osm_buildings_in_new_water} of the ${p.osm_buildings} OpenStreetMap buildings within ${km(p)} sit on detected new water. `
      + "The count can be too high or too low, and says nothing about damage. Data: OpenStreetMap contributors, ODbL.",
    caveats,
  };
}

const reading = (f: Fields, places: Places) =>
  `${places.places.find((p) => p.id === f.place_id)?.name ?? "no place"}, ${f.polarity === "negative" ? "no flooding" : "flooding"}`;

/** The verdict for one reading of a claim. other is a second reading that conflicts with the first (parser first, model second). */
export function verdict(f: Fields, places: Places, other?: Fields): Judgement {
  const asOf = places.as_of_label, tail = `as of ${asOf} (NISAR Beta)`;
  const g = gates(f, places);
  if (other) {
    const g2 = gates(other, places);
    if (g.ok || g2.ok) {
      const p = g.ok ? g.place : (g2 as { place: Place }).place;
      return { verdict: "not provable", headline: `Two readings of the claim: not provable ${tail}`,
        reasons: [`The parser read "${reading(f, places)}"; the model read "${reading(other, places)}". The verdict depends on which reading is right, so none is given.`],
        evidence: evidence(p, places) };
    }
  }
  if (!g.ok) {
    if (!g.place) return { verdict: "not observable", headline: `Claim: not observable as of ${asOf} (no place matched inside the NISAR areas)`, reasons: g.reasons, evidence: null };
    return { verdict: "not observable", headline: `${check(f, g.place)}: not observable ${tail}`, reasons: [...g.reasons, asOfNumbers(g.place, asOf)], evidence: evidence(g.place, places) };
  }
  const p = g.place, reasons = [g.note];
  if (f.claim_type !== "flood") {
    if (f.claim_type === "extent")
      reasons.push(`The amount claimed${f.quantifier ? ` ("${f.quantifier}")` : ""} was not checked: the method measures new open water within ${km(p)} of a place, not the size of the whole flood.`);
    else reasons.push(TYPE_REASON[f.claim_type]);
    reasons.push(asOfNumbers(p, asOf));
    const extra = f.claim_type === "extent" ? `, ${pct(p.new_water_share)} of the area within ${km(p)} newly under open water` : "";
    return { verdict: "not provable", headline: `${check(f, p)}: not provable ${tail}${extra}`, reasons, evidence: evidence(p, places) };
  }

  if (f.quantifier) reasons.push(`The amount claimed ("${f.quantifier}") was not checked; this covers flooding within ${km(p)} of ${p.name} only.`);
  const wet = isWet(p), dry = !wet && isDry(p), negative = f.polarity === "negative", period = f.date_kind === "period";
  let v: Verdict = "not provable";
  if (wet) {
    v = negative ? "contradicted" : "supported";
    reasons.push(`${pct(p.new_water_share)} of the area within ${km(p)} with NISAR data (${p.new_water_ha} ha) was newly under open water, at or above the ${pct(T.wet_share)} (and ${T.wet_min_ha} ha) that counts as flooded.`);
  } else if (dry) {
    v = period ? "not provable" : negative ? "supported" : "contradicted";
    reasons.push(`Only ${pct(p.new_water_share_open)} of the open ground within ${km(p)} (${pct(p.open_share)} of the area, away from buildings and possible flooded vegetation) was newly under open water, at or below the ${pct(T.dry_max_open_water_share)} that counts as none.`,
      "Flooding under crops, trees or between buildings does not show as open water in radar.");
    if (p.built_up_share > 0) reasons.push(`The built-up part (${pct(p.built_up_share)} of the area) cannot be judged.`);
    if (period) reasons.push("No water at NISAR's one look does not settle a claim about a period: the flood could have been on another day.");
  } else {
    const why = [`${pct(p.new_water_share)} of the area with NISAR data (${p.new_water_ha} ha) was newly under open water, ${(p.new_water_share ?? 0) >= T.wet_share ? `but under ${T.wet_min_ha} ha` : `below the ${pct(T.wet_share)} that counts as flooded`}`];
    if (p.open_share < T.dry_min_open_share) why.push(`only ${pct(p.open_share)} of the area is open ground away from buildings and possible flooded vegetation, too little to rule flooding out (at least ${pct(T.dry_min_open_share)} is needed)`);
    else if ((p.new_water_share_open ?? 1) > T.dry_max_open_water_share) why.push(`${pct(p.new_water_share_open)} of the open ground had new water, above the ${pct(T.dry_max_open_water_share)} that counts as none`);
    if (p.coverage.unclear > T.dry_max_unclear_share) why.push(`${pct(p.coverage.unclear)} of the area may be flooded vegetation (HH rose)`);
    reasons.push(`Not enough to settle it: ${why.join("; ")}.`);
  }
  const headline = dry
    ? `No new open water detected within ${km(p)} of ${p.name}: ${v} ${tail}`
    : `Flooding within ${km(p)} of ${p.name}: ${v} ${tail}, ${pct(p.new_water_share)} of the area newly under open water`;
  return { verdict: v, headline, reasons, evidence: evidence(p, places) };
}
