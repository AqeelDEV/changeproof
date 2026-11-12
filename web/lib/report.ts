// The evidence report for one checked claim, as Markdown. Every number comes from the checker's result or the
// area's stats.json; nothing is worked out here.
import type { ClaimResult, Stats } from "../app/types";
import { shownVerdict } from "./claims/verdict.ts";

export const NUMBER_LABELS: Record<string, string> = {
  valid_share: "NISAR data on both dates, share of the area",
  new_water_ha: "New open water, hectares",
  new_water_share: "New open water, share of the area with data",
  open_share: "Open ground, share of the area",
  new_water_share_open: "New open water, share of the open ground",
  built_up_share: "Built-up, share of the area",
  unclear_share: "Possible flooded vegetation (HH rose), share of the area",
  dark_5jan_share: "Of the new water, already dark on 5 Jan",
  osm_buildings: "OpenStreetMap buildings in the area",
  osm_buildings_in_new_water: "OpenStreetMap buildings on detected new water",
};

/** 0.4211 -> "42.1%" for shares; counts and hectares as they are. */
export const showNumber = (key: string, v: number | null): string =>
  v === null ? "n/a" : key.endsWith("_share") || key.endsWith("_share_open") ? `${(v * 100).toFixed(1)}%` : v.toLocaleString("en-GB");

/** Display only: the checker's sentence "42% of the area within 3 km with NISAR data (1191 ha) was newly under open water"
 *  can be read as if 1191 ha were the area with data. This puts the hectares first, with their own label. The report and
 *  the checker keep their wording.
 *  shortcut: matches the sentences built in lib/claims/verdict.ts by pattern; if that wording changes, the original
 *  sentence shows unchanged and the build check in app/page.tsx fails, so move the wording into verdict.ts then. */
export const plainReason = (reason: string, place: string): string =>
  reason.replace(/(\S+%) of the area(?: within (\S+ km))?(?: of (.+?))? with NISAR data \((\S+) ha\) was newly under open water/,
    (_, share, km, named, ha, at: number) => {
      const water = `${showNumber("new_water_ha", Number(ha))} ha was newly under open water`, where = km ? `within ${km} of ${named ?? place}, ` : "";
      return at === 0 ? `${where.replace("w", "W")}${water}. That is ${share} of the area NISAR saw` : `${where}${water}, which is ${share} of the area NISAR saw`;
    });

export function dateRead(f: ClaimResult["fields"]): string {
  if (!f.date_from) return f.date_kind;
  const to = f.date_to && f.date_to !== f.date_from ? ` to ${f.date_to}` : "";
  return `${f.date_kind}: ${f.date_from}${to}${f.date_kind === "since" ? " onwards" : ""}`;
}

export function reportMarkdown(r: ClaimResult, area: Stats | undefined, url: string, source?: { source: string; link: string; published: string }): string {
  const e = r.evidence, f = r.fields, p = f.place;
  const out = [
    "# ChangeProof evidence report",
    "",
    `**Claim:** "${r.claim}"`,
    ...(source ? [`**Published by:** ${source.source}, ${source.published}, ${source.link}`] : []),
    `**Verdict:** ${shownVerdict(r.verdict, f.polarity)}, as of ${r.as_of} (NISAR ${e?.area.release ?? "Beta"} data)`,
    "",
    r.headline,
    "",
    "## Why",
    ...r.reasons.map((x) => `- ${x}`),
    "",
    "## How the claim was read",
    `- Place: ${p ? `${p.name} (${p.area}), the area within ${p.buffer_m / 1000} km of ${p.lat}, ${p.lon}` : "none matched"}`,
    `- Says: ${f.polarity === "negative" ? "it did not happen" : "it happened"}; type: ${f.claim_type}; amount: ${f.quantifier ?? "none"}`,
    `- Date: ${dateRead(f)}`,
    `- Fields from: ${r.path} (model: ${r.model_status}). The model only fills these fields; fixed rules give the verdict.`,
  ];
  if (e) {
    out.push("", "## Numbers", ...Object.entries(e.numbers).map(([k, v]) => `- ${NUMBER_LABELS[k] ?? k}: ${showNumber(k, v)}`),
      "", "## Copernicus EMS (EMSR857) at this place", ...e.copernicus.map((x) => `- ${x}`),
      "", "## Buildings", e.buildings,
      "", "## NISAR scenes", `${e.area.name}`, ...e.area.granules.map((g) => `- ${g}`),
      "", "## Caveats for this place", ...e.caveats.map((x) => `- ${x}`));
  }
  if (area) out.push("", `## Limits for ${area.name}`, ...area.limits.map((x) => `- ${x}`));
  out.push("", "---", `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by ChangeProof, ${url}`,
    "Agreement with Copernicus is not accuracy. This report says what NISAR data can and cannot support; it is not a damage assessment.");
  return out.join("\n") + "\n";
}
