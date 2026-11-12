// Rule-based claim parser for English and Portuguese flood claims. No dependencies, so it runs anywhere.
// It only splits a claim into fields; verdict.ts decides the verdict.

export type ClaimType = "flood" | "impact" | "damage" | "built_up" | "vegetation" | "depth" | "extent" | "other";
export type DateKind = "none" | "day" | "period" | "since" | "relative";
export type Polarity = "positive" | "negative";
export const CLAIM_TYPES: readonly ClaimType[] = ["flood", "impact", "damage", "built_up", "vegetation", "depth", "extent", "other"];
export const DATE_KINDS: readonly DateKind[] = ["none", "day", "period", "since", "relative"];

export interface Copernicus {
  product: string;
  sensor: string;
  observed_utc: string;
  mapped_share: number | null;
  flooded_share: number | null;
  flooded_share_open: number | null;
}

/** One entry of data/places.json (pipeline/places.py). Shares are fractions of the buffer unless named otherwise. */
export interface Place {
  id: string;
  name: string;
  place: "city" | "town" | "village" | "suburb";
  lon: number;
  lat: number;
  buffer_m: number;
  variants: string[];
  area: string;
  in_scored_area: boolean;
  pixels: number;
  coverage: { evaluated: number; outside_mapped_area: number; unclear: number; edge_excluded: number; no_data: number };
  valid_share: number;
  built_up_share: number;
  open_share: number;
  new_water_ha: number;
  new_water_share: number | null; // of pixels with NISAR data
  new_water_share_open: number | null; // of open pixels
  dark_5jan_share: number | null; // of the new water
  copernicus: Copernicus[];
  osm_buildings: number;
  osm_buildings_in_new_water: number;
}

export interface Scene { role: "before" | "after"; granule_id: string; start_utc: string; end_utc: string; frame: number }
export interface Area { name: string; release: string; scenes: Scene[]; copernicus: { product: string; sensor: string; observed_utc: string }[] }
export interface Places { generated_utc: string; as_of_label: string; buffer_m: Record<string, number>; areas: Record<string, Area>; places: Place[] }

export interface Fields {
  place_id: string | null;
  place_text: string | null; // as the claim wrote it
  polarity: Polarity;
  date_kind: DateKind;
  date_from: string | null; // YYYY-MM-DD
  date_to: string | null; // YYYY-MM-DD; null for "since"
  date_text: string | null;
  claim_type: ClaimType;
  quantifier: string | null; // the amount claimed as written: a word ("whole") or, for extent claims, a number ("80%")
  confidence: number;
}

// ---------- text

interface Token { w: string; raw: string; clause: number }

/** Accents stripped, lower case. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const CLAUSE_END = /[;!?]|[.,]\s/; // a full stop or comma before a space; "17.01.2026" and "2,5" do not end a clause
const CLAUSE_START = new Set(["mas", "but", "porem", "contudo", "todavia", "however", "although", "though", "embora"]);

function tokens(s: string): Token[] {
  const out: Token[] = [];
  const spaced = s.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").replace(/['’]s\b/g, ""); // #XaiXai -> Xai Xai; Chókwè's -> Chókwè
  let clause = 0, prev = 0;
  for (const m of spaced.matchAll(/[\p{L}\p{N}]+(?:['’`´][\p{L}\p{N}]+)*/gu)) {
    if (CLAUSE_END.test(spaced.slice(prev, m.index))) clause++;
    prev = m.index! + m[0].length;
    const w = fold(m[0]).replace(/[^a-z0-9]/g, "");
    if (w && CLAUSE_START.has(w)) clause++;
    if (w) out.push({ w, raw: m[0], clause });
  }
  return out;
}

/** The claim as folded words, for example "Xai-Xai não alagou!" -> ["xai", "xai", "nao", "alagou"]. */
export const words = (s: string): string[] => tokens(s).map((t) => t.w);

const sound = (w: string) => w.replace(/sh|ch/g, "x"); // Portuguese x sounds like sh: Shai Shai = Xai-Xai

/** Damerau-Levenshtein distance (optimal string alignment). */
export function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

const allowed = (n: number) => (n >= 9 ? 2 : n >= 5 ? 1 : 0);
const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

// ---------- word lists (folded)

const FLOOD_EN = set("flood floods flooded flooding floodwater floodwaters underwater submerged inundated inundation swamped deluged overflowed overflowing waterlogged");
const FLOOD_PT = set(`inundado inundada inundados inundadas inundacao inundacoes inundou inundaram inundar alagado alagada alagados alagadas
  alagou alagaram alagar alagamento alagamentos cheia cheias enchente enchentes submerso submersa submersos submersas transbordou transbordaram`);
const FLOOD_PHRASES = ["under water", "debaixo de agua", "debaixo dagua", "sob as aguas", "burst its banks", "burst their banks", "water everywhere",
  "agua por todo lado", "agua por todo o lado"];
const DRY = set("dry seco seca secos secas enxuto enxuta");
const NEG_EN = set("not never without nor didnt wasnt isnt arent werent hasnt havent hadnt dont doesnt cant couldnt wont didn wasn isn aren weren hasn haven doesn don");
const NEG_PT = set("nao naum nunca nem sem jamais nenhum nenhuma");
const WHOLE_NEG = set("fake hoax false falso falsa mentira boato desinformacao");
const WHOLE_NEG_PHRASES = ["not true", "nao e verdade", "nao e verdadeiro"];
const TYPE_CUES: [ClaimType, Set<string>, string[]][] = [
  ["impact", set(`dead deaths death died die dying killed kill kills drowned drowning missing injured injuries displaced evacuated evacuees homeless
    victims casualties fatalities stranded rescued mortos morto morta mortas mortes morte morreu morreram obitos obito afogado afogados afogada
    afogadas afogou afogaram corpos desaparecidos desaparecidas desaparecido feridos feridas ferido deslocados deslocadas desalojados desalojadas
    evacuados evacuadas vitimas vitima resgatados resgatadas sinistrados`),
    ["people affected", "families affected", "pessoas afetadas", "pessoas afectadas", "familias afetadas", "familias afectadas"]],
  ["damage", set(`destroyed destroy destroying destruction damaged damage damages collapsed collapse ruined demolished wrecked razed destruidas
    destruida destruidos destruido destruiu destruiram destruicao danificadas danificada danificados danificado danos estragos desabou desabaram
    desabamento ruiu ruiram arrastadas arrastados arrastou derrubou derrubadas`),
    ["washed away", "swept away", "cut off", "estrada cortada", "estradas cortadas", "ponte caiu"]],
  ["depth", set(`deep depth waist chest knee knees neck roof roofs rooftop rooftops profundidade profunda profundo cintura joelho joelhos peito
    pescoco telhado telhados tecto teto`), []],
  ["built_up", set(`streets street houses house homes home market school schools hospital buildings building downtown roads road shops ruas rua
    casas casa mercado escola escolas edificios edificio estradas estrada lojas residencias moradias baixa bairro bairros`),
    ["city centre", "city center", "town centre", "town center"]],
  ["vegetation", set(`crops crop maize corn sugarcane cane bananas trees tree forest forests woodland mangroves mangrove plantations plantation
    orchards culturas colheitas milho cana canaviais bananeiras bananal arvores arvore floresta florestas mato plantacoes plantacao pomares`),
    ["sugar cane"]],
];
const DEPTH_RE = /\b\d+(?:[.,]\d+)?\s*(?:m|cm|metres?|meters?|metros?|centimetros?|centimetres?|centimeters?|feet|ft)\b/;
const EXTENT_RE = /\d+(?:[.,]\d+)*\s*(?:km2|km²|km 2|sq km|square kilomet\w*|quilometros quadrados|km quadrados|hectares?\b|ha\b|%|percent\b|per cent\b|por cento\b|porcento\b)/;
const QUANT_WORDS = set("whole entire entirely completely totally fully inteiro inteira inteiramente totalmente completamente");
const QUANT_PHRASES = ["almost all", "nearly all", "all of", "most of", "quase todo", "quase toda", "quase todos", "quase todas", "a maior parte",
  "maior parte", "todo o", "toda a", "todos os", "todas as"];
const RELATIVE_WORDS = set("today tonight yesterday now currently tomorrow hoje ontem agora anteontem amanha atualmente actualmente");
const RELATIVE_PHRASES = ["right now", "this morning", "last night", "this week", "last week", "this weekend", "neste momento", "esta manha",
  "esta noite", "esta semana", "semana passada", "fim de semana", "nesta altura"];
const EN_FN = set("the was is are were has have had been be it this that on at of and by after with did does under people town city village since between all whole still there my our in");
const PT_FN = set("o os de do da dos das em na nas nos foi esta estao ficou ficaram fica sao e com por pelo pela pelas pelos para que um uma desde entre ate muito muita todo toda cidade vila aldeia agua chuva");
const MONTHS_FULL: Record<string, number> = { january: 1, janeiro: 1, february: 2, fevereiro: 2, march: 3, marco: 3, april: 4, abril: 4, may: 5,
  maio: 5, june: 6, junho: 6, july: 7, julho: 7, august: 8, agosto: 8, september: 9, setembro: 9, october: 10, outubro: 10, november: 11,
  novembro: 11, december: 12, dezembro: 12 };
const MONTHS_ABBR: Record<string, number> = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9,
  sept: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12 };
const STOP = new Set([...FLOOD_EN, ...FLOOD_PT, ...DRY, ...NEG_EN, ...NEG_PT, ...WHOLE_NEG, ...QUANT_WORDS, ...RELATIVE_WORDS, ...EN_FN, ...PT_FN,
  ...TYPE_CUES.flatMap(([, s]) => [...s]), ...Object.keys(MONTHS_FULL), ...Object.keys(MONTHS_ABBR),
  ...set("no a i water river rio district distrito province provincia area zona news noticias region regiao")]);

const has = (w: string[], phrase: string, skip: Set<number> = new Set()): number => {
  const p = phrase.split(" ");
  for (let i = 0; i + p.length <= w.length; i++) if (p.every((x, k) => w[i + k] === x && !skip.has(i + k))) return i;
  return -1;
};

// ---------- places

const RANK: Record<string, number> = { city: 4, town: 3, suburb: 2, village: 1 };
const indexes = new WeakMap<Places, Map<string, Place[]>>();

function index(places: Places): Map<string, Place[]> {
  let idx = indexes.get(places);
  if (!idx) {
    idx = new Map();
    for (const p of places.places)
      for (const v of p.variants) {
        const w = words(v).map(sound);
        for (const k of new Set([w.join(" "), w.join("")])) {
          const list = idx.get(k) ?? [];
          if (k && !list.includes(p)) idx.set(k, [...list, p]);
        }
      }
    indexes.set(places, idx);
  }
  return idx;
}

export interface PlaceMatch { place: Place; start: number; len: number; fuzzy: boolean; text: string }

function matchTokens(toks: Token[], places: Places): PlaceMatch | null {
  const idx = index(places), w = toks.map((t) => sound(t.w));
  const better = (a: PlaceMatch, b: PlaceMatch | null, da: number, db: number) => !b ||
    [a.len - b.len, db - da, RANK[a.place.place] - RANK[b.place.place], a.place.osm_buildings - b.place.osm_buildings, b.start - a.start].find((x) => x !== 0)! > 0;
  for (const fuzzy of [false, true]) {
    let best: PlaceMatch | null = null, bestD = 0;
    for (let len = 4; len >= 1; len--)
      for (let i = 0; i + len <= w.length; i++) {
        const g = w.slice(i, i + len);
        const ends = STOP.has(toks[i].w) || STOP.has(toks[i + len - 1].w);
        if (len === 1 ? ends : fuzzy && ends) continue;
        if (fuzzy && g.some((x) => /\d/.test(x))) continue;
        const spaced = g.join(" "), compact = g.join("");
        const hits: [Place, number][] = [];
        if (!fuzzy) for (const p of idx.get(spaced) ?? idx.get(compact) ?? []) hits.push([p, 0]);
        else if (allowed(compact.length) > 0)
          for (const [k, ps] of idx) {
            if (k.includes(" ")) continue;
            const dist = distance(compact, k);
            if (dist <= Math.min(allowed(compact.length), allowed(k.length))) for (const p of ps) hits.push([p, dist]);
          }
        for (const [p, dist] of hits) {
          const m = { place: p, start: i, len, fuzzy, text: toks.slice(i, i + len).map((t) => t.raw).join(" ") };
          if (better(m, best, dist, bestD)) [best, bestD] = [m, dist];
        }
      }
    if (best) return best;
  }
  return null;
}

/** The place a piece of text names, if it is on the list: exact spelling first, then a close misspelling. */
export const findPlace = (text: string, places: Places): PlaceMatch | null => matchTokens(tokens(text), places);

// ---------- dates

const PASS = { y: 2026, m: 1, d: 17 };
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
const year = (y: string | undefined, m: number, d: number): number => {
  if (y) return y.length === 2 ? 2000 + Number(y) : Number(y);
  const pass = Date.UTC(PASS.y, PASS.m - 1, PASS.d); // no year given: the year that puts the date nearest the pass
  return [2025, 2026, 2027].reduce((a, b) => (Math.abs(Date.UTC(b, m - 1, d) - pass) < Math.abs(Date.UTC(a, m - 1, d) - pass) ? b : a));
};
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthWord(w: string): string | null {
  const m = MONTHS_FULL[w] ?? (w.length >= 6 ? Object.entries(MONTHS_FULL).find(([n]) => n.length >= 6 && distance(w, n) <= 1)?.[1] : undefined);
  if (m) return `M${pad(m)}F`; // a full month name, typos allowed: may stand alone ("em janeiro")
  return MONTHS_ABBR[w] ? `M${pad(MONTHS_ABBR[w])}A` : null; // an abbreviation: only next to a day number
}

interface DateHit { kind: DateKind; from: string | null; to: string | null; text: string | null; dia: boolean }
interface Span { start: number; end: number; hit: DateHit }

const MON = String.raw`M(\d\d)[FA]`, OPT_DIA = String.raw`(?:(?:o|the)\s+)?(?:dia\s+)?`, SEP = String.raw`\s*(?:de\s+|of\s+|,\s*)?`;
const DAY_RES: [RegExp, (m: RegExpMatchArray) => (string | undefined)[]][] = [ // each gives [year, month, day]
  [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m) => [m[1], m[2], m[3]]],
  [/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b/g, (m) => [m[3], m[2], m[1]]],
  [/\b(\d{1,2})-(\d{1,2})-(\d{4}|\d{2})\b/g, (m) => [m[3], m[2], m[1]]],
  [/\b(\d{1,2})\/(\d{1,2})\b(?![/.]\d)/g, (m) => (m[2].length === 2 || Number(m[1]) >= 13 ? [undefined, m[2], m[1]] : [])], // "17/01", not "1/3"
  [new RegExp(String.raw`\b(\d{1,2})\s+(?:de\s+|of\s+)?${MON}(?:${SEP}(\d{4}))?`, "g"), (m) => [m[3], m[2], m[1]]],
  [new RegExp(String.raw`${MON}\s+(\d{1,2})\b(?:\s*,?\s*(\d{4}))?`, "g"), (m) => [m[3], m[1], m[2]]],
  [/\bdia\s+(\d{1,2})\b/g, (m) => [undefined, "dia", m[1]]], // "dia 17": month taken as January
];
const RANGE_RES: [RegExp, (m: RegExpMatchArray) => (string | undefined)[]][] = [ // each gives [d1, m1, d2, m2, year]
  [new RegExp(String.raw`\b(?:from|between|de|entre)\s+${OPT_DIA}(\d{1,2})(?:\s+(?:de\s+|of\s+)?${MON})?\s*(?:-|–|\bto\b|\buntil\b|\btill\b|\band\b|\ba\b|\bate\b|\be\b)\s*${OPT_DIA}(\d{1,2})\s+(?:de\s+|of\s+)?${MON}(?:${SEP}(\d{4}))?`, "g"),
    (m) => [m[1], m[2], m[3], m[4], m[5]]],
  [new RegExp(String.raw`\b(\d{1,2})(?:\s+(?:de\s+|of\s+)?${MON})?\s*(?:-|–|\bto\b|\ba\b|\bate\b)\s*(\d{1,2})\s+(?:de\s+|of\s+)?${MON}(?:${SEP}(\d{4}))?`, "g"),
    (m) => [m[1], m[2], m[3], m[4], m[5]]],
  [new RegExp(String.raw`\b(?:from|between)\s+${MON}\s+(\d{1,2})\s*(?:-|–|\bto\b|\buntil\b|\btill\b|\band\b)\s*(?:${MON}\s+)?(\d{1,2})(?:\s*,?\s*(\d{4}))?`, "g"),
    (m) => [m[2], m[1], m[4], m[3] ?? m[1], m[5]]],
];
const MONTH_ALONE = new RegExp(String.raw`\b(?:in|em|during|durante|de|of|throughout|no\s+mes\s+de)\s+M(\d\d)F(?:\s+(?:de\s+|of\s+)?(\d{4}))?|M(\d\d)F\s+(?:de\s+|of\s+)?(\d{4})`);
const YEAR_ALONE = /\b(?:em|in|de|of)\s+(\d{4})\b/;
const SINCE_BEFORE = /\b(?:since|desde)\s+(?:(?:o|the)\s+)?(?:dia\s+)?$/;

const shown = (s: string) => s.replace(/M(\d\d)[FA]/g, (_, m) => MONTH_SHORT[Number(m) - 1]).trim();

function parseDate(folded: string, w: string[]): DateHit {
  const s = folded.replace(/[a-z]+/g, (x) => monthWord(x) ?? x).replace(/(\d)(?:st|nd|rd|th)\b/g, "$1").replace(/(\d)[ºª°]/g, "$1");
  const spans: Span[] = [];
  for (const [re, get] of RANGE_RES)
    for (const m of s.matchAll(re)) {
      const [d1, m1, d2, m2, y] = get(m).map((x) => x);
      const mo2 = Number(m2), mo1 = m1 ? Number(m1) : mo2;
      const y2 = year(y, mo2, Number(d2));
      let y1 = y ? y2 : year(undefined, mo1, Number(d1));
      if (iso(y1, mo1, Number(d1)) > iso(y2, mo2, Number(d2))) y1 = y2 - 1;
      if (!valid(y1, mo1, Number(d1)) || !valid(y2, mo2, Number(d2))) continue;
      spans.push({ start: m.index!, end: m.index! + m[0].length, hit: { kind: "period", from: iso(y1, mo1, Number(d1)), to: iso(y2, mo2, Number(d2)), text: shown(m[0]), dia: false } });
    }
  for (const [re, get] of DAY_RES)
    for (const m of s.matchAll(re)) {
      const [y, mo, d] = get(m);
      if (!d) continue;
      const dia = mo === "dia", month = dia ? 1 : Number(mo), yy = year(y, month, Number(d));
      if (!valid(yy, month, Number(d))) continue;
      const since = SINCE_BEFORE.test(s.slice(0, m.index!));
      const day = iso(yy, month, Number(d));
      spans.push({ start: m.index!, end: m.index! + m[0].length, hit: { kind: since ? "since" : "day", from: day, to: since ? null : day, text: shown(m[0]), dia } });
    }
  // Ranges first, then the longest; drop anything overlapping a span already kept.
  spans.sort((a, b) => Number(b.hit.kind === "period") - Number(a.hit.kind === "period") || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept: Span[] = [];
  for (const sp of spans) if (!kept.some((k) => sp.start < k.end && k.start < sp.end)) kept.push(sp);
  const order: DateKind[] = ["period", "since", "day"];
  kept.sort((a, b) => order.indexOf(a.hit.kind) - order.indexOf(b.hit.kind) || a.start - b.start);
  if (kept.length) return kept[0].hit;

  const mm = s.match(MONTH_ALONE);
  if (mm) {
    const month = Number(mm[1] ?? mm[3]), yy = mm[2] ?? mm[4] ? Number(mm[2] ?? mm[4]) : year(undefined, month, 15);
    return { kind: "period", from: iso(yy, month, 1), to: iso(yy, month, new Date(Date.UTC(yy, month, 0)).getUTCDate()), text: shown(mm[0]), dia: false };
  }
  const ym = s.match(YEAR_ALONE);
  if (ym && Number(ym[1]) >= 1900 && Number(ym[1]) <= 2100) return { kind: "period", from: `${ym[1]}-01-01`, to: `${ym[1]}-12-31`, text: ym[0], dia: false };
  const rel = w.find((x) => RELATIVE_WORDS.has(x)) ?? RELATIVE_PHRASES.find((p) => has(w, p) >= 0);
  if (rel) return { kind: "relative", from: null, to: null, text: rel, dia: false };
  return { kind: "none", from: null, to: null, text: null, dia: false };
}

// Relative words as days from an article's published day; weekend words are left unresolved.
const RELATIVE_DAYS: Record<string, [number, number]> = {
  today: [0, 0], tonight: [0, 0], now: [0, 0], currently: [0, 0], hoje: [0, 0], agora: [0, 0], atualmente: [0, 0], actualmente: [0, 0],
  "right now": [0, 0], "this morning": [0, 0], "neste momento": [0, 0], "esta manha": [0, 0], "esta noite": [0, 0], "nesta altura": [0, 0],
  yesterday: [-1, -1], ontem: [-1, -1], "last night": [-1, -1], anteontem: [-2, -2], tomorrow: [1, 1], amanha: [1, 1],
  "this week": [-6, 0], "esta semana": [-6, 0], "last week": [-13, -7], "semana passada": [-13, -7],
};

/** A relative word (as the parser gives it in date_text) worked out from a published day (YYYY-MM-DD): "ontem" on 2026-01-19 is 2026-01-18. */
export function resolveRelative(word: string, published: string): { from: string; to: string } | null {
  const days = RELATIVE_DAYS[word], t = Date.parse(`${published}T00:00:00Z`);
  if (!days || !/^\d{4}-\d{2}-\d{2}$/.test(published) || Number.isNaN(t)) return null;
  const at = (n: number) => new Date(t + n * 86400000).toISOString().slice(0, 10);
  return { from: at(days[0]), to: at(days[1]) };
}

// ---------- the parser

export function parse(text: string, places: Places): Fields {
  const toks = tokens(text), w = toks.map((t) => t.w);
  const match = matchTokens(toks, places);
  const skip = new Set<number>(match ? Array.from({ length: match.len }, (_, k) => match.start + k) : []);
  const en = w.filter((x) => EN_FN.has(x) || FLOOD_EN.has(x) || NEG_EN.has(x)).length;
  const pt = w.filter((x) => PT_FN.has(x) || FLOOD_PT.has(x) || NEG_PT.has(x)).length;
  const negators = new Set([...NEG_EN, ...NEG_PT, ...(en > pt ? ["no"] : [])]); // Portuguese "no" means "in the"
  const ptFlood = (x: string) => FLOOD_PT.has(x) || (x.length >= 6 && [...FLOOD_PT].some((c) => c.length >= 6 && distance(x, c) <= 1));
  // A negator anywhere earlier in the same clause; "n" only directly before a Portuguese flood word ("n alagou").
  const negatedAt = (i: number) => {
    for (let j = i - 1; j >= 0 && toks[j].clause === toks[i].clause; j--)
      if (!skip.has(j) && (negators.has(w[j]) || (w[j] === "n" && j === i - 1 && ptFlood(w[i])))) return true;
    return false;
  };

  // Flood and dry cues, in order of position; typos of flood words count (distance 1, words of 6+ letters).
  const cues: { at: number; dry: boolean }[] = [];
  w.forEach((x, i) => {
    if (skip.has(i)) return;
    if (DRY.has(x)) cues.push({ at: i, dry: true });
    else if (FLOOD_EN.has(x) || FLOOD_PT.has(x) || (x.length >= 6 && [...FLOOD_EN, ...FLOOD_PT].some((c) => c.length >= 6 && distance(x, c) <= 1)))
      cues.push({ at: i, dry: false });
  });
  for (const p of FLOOD_PHRASES) {
    const at = has(w, p, skip);
    if (at >= 0) cues.push({ at, dry: false });
  }
  cues.sort((a, b) => a.at - b.at);

  const folded = fold(text);
  let type: ClaimType = cues.length ? "flood" : "other", typeAt = -1;
  for (const [t, cueSet, phrases] of TYPE_CUES) {
    if (t === "built_up" && EXTENT_RE.test(folded)) { type = "extent"; break; } // the plan's order: impact, damage, depth, extent, built_up, ...
    const at = w.findIndex((x, i) => cueSet.has(x) && !skip.has(i));
    const atP = phrases.map((p) => has(w, p, skip)).filter((i) => i >= 0);
    if (at >= 0 || atP.length || (t === "depth" && DEPTH_RE.test(folded))) {
      type = t;
      typeAt = Math.min(...[at, ...atP].filter((i) => i >= 0), Infinity);
      break;
    }
  }

  let negative = cues.length ? cues[0].dry !== negatedAt(cues[0].at) : typeAt >= 0 && typeAt !== Infinity && negatedAt(typeAt);
  // "fake news", "mentira": the claim calls flooding false, whatever else it says ("nao alagou, fake news").
  if (w.some((x, i) => WHOLE_NEG.has(x) && !skip.has(i)) || WHOLE_NEG_PHRASES.some((p) => has(w, p) >= 0)) negative = true;

  const quantifier = type === "extent" ? folded.match(EXTENT_RE)![0]
    : (QUANT_PHRASES.find((p) => has(w, p, skip) >= 0) ?? w.find((x, i) => QUANT_WORDS.has(x) && !skip.has(i)) ?? null);

  // A place name with digits ("25 de Setembro") must not be read as a date.
  let forDate = folded;
  if (match && match.text.match(/\d/)) forDate = forDate.replace(new RegExp(w.slice(match.start, match.start + match.len).join("[^a-z0-9]+")), " ");
  const date = parseDate(forDate, w);

  let confidence = 1;
  if (match?.fuzzy) confidence *= 0.8;
  if (date.dia) confidence *= 0.8;
  if (type === "other") confidence *= 0.5;
  return {
    place_id: match?.place.id ?? null, place_text: match?.text ?? null, polarity: negative ? "negative" : "positive",
    date_kind: date.kind, date_from: date.from, date_to: date.to, date_text: date.text, claim_type: type, quantifier,
    confidence: Math.round(confidence * 100) / 100,
  };
}
