// Optional model extraction: one plain fetch to a chat-completions endpoint. Server-side only: the key comes from
// environment variables and is never logged. The model only fills fields; it never decides the verdict.
import { CLAIM_TYPES, DATE_KINDS, findPlace, type Fields, type Places } from "./parse.ts";

export interface ModelReply {
  status: "ok" | "disabled" | "timeout" | "error"; content: string | null; ms: number;
  finish?: string | null; tokens?: number | null; reasoning_tokens?: number | null; http?: number; // recorded to explain cut-off or failed replies
}

const MAX_TOKENS = 1000; // hidden reasoning counts against this: at 200 it used up to 190 tokens and cut the JSON off

const SYSTEM = `You extract fields from one short claim about the January 2026 floods in southern Mozambique.
The claim may be in English or Portuguese, informal, with typos. Do not judge whether it is true.
Reply with one JSON object and nothing else:
{"place": the place name as written in the claim, or null,
 "polarity": "positive" if the claim says there was flooding (or the other thing it claims happened), "negative" if it says there was none or calls such a claim false,
 "date_kind": "none" | "day" | "period" | "since" | "relative",
 "date_from": "YYYY-MM-DD" or null,
 "date_to": "YYYY-MM-DD" or null,
 "claim_type": "flood" | "impact" | "damage" | "built_up" | "vegetation" | "depth" | "extent" | "other",
 "quantifier": the amount claimed as written, a word such as "whole" or "quase todo" or a number such as "80%", or null,
 "confidence": a number from 0 to 1}
Dates: "day" is one day, with date_from = date_to. "period" is a range ("from 16 to 20 Jan", "between", "de 16 a 20 de janeiro"), a month on its own (the whole month) or a year on its own (the whole year). "since" is "since/desde X", with date_to null. "relative" is a word like today, yesterday, now, hoje, ontem, agora, with both dates null. "none" means no date, with both dates null. A missing year is the year that puts the date nearest 17 Jan 2026. "dia 17" with no month means 17 January. A number like "2000 people" is not a year.
claim_type: impact = deaths, injuries, missing or displaced people; damage = destroyed or damaged things; depth = how deep the water was; extent = a number of km², hectares or a percentage; built_up = flooding of streets, houses, roads or other buildings; vegetation = flooded crops, trees or forest; flood = whether a place flooded or stayed dry; other = anything else. If several apply, pick the first in this order: impact, damage, depth, extent, built_up, vegetation, flood.`;

const env = (): Record<string, string | undefined> =>
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export function timeoutMs(): number {
  const v = Number(env().LLM_TIMEOUT_MS);
  return v > 0 ? v : 2500;
}

/** A short hash of everything that shapes a reply (model, prompt, limit), so recorded replies are kept apart per setting. */
export function settingsKey(): string {
  let h = 0x811c9dc5; // FNV-1a
  const extra = env().LLM_EXTRA_JSON; // appended only when set, so keys recorded before it existed stay valid
  for (const ch of [env().LLM_MODEL ?? "", MAX_TOKENS, SYSTEM, ...(extra ? [extra] : [])].join("\n")) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Ask the model for the fields. Never throws; a missing setting or LLM_DISABLED=1 means no call. */
export async function askModel(text: string, limit: number = timeoutMs()): Promise<ModelReply> {
  const { LLM_BASE_URL: base, LLM_MODEL: model, LLM_API_KEY: key, LLM_DISABLED: off, LLM_EXTRA_JSON: extra } = env();
  if ((globalThis as { window?: unknown }).window !== undefined || off === "1" || !base || !model || !key)
    return { status: "disabled", content: null, ms: 0 };
  const t0 = Date.now(), ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), limit);
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      // LLM_EXTRA_JSON: endpoint-specific body fields, e.g. {"reasoning":{"enabled":false}}; bad JSON gives status "error"
      body: JSON.stringify({ model, temperature: 0, max_tokens: MAX_TOKENS, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }], ...JSON.parse(extra || "{}") }),
    });
    if (!r.ok) return { status: "error", content: null, ms: Date.now() - t0, http: r.status };
    const js = await r.json(), choice = js?.choices?.[0], content = choice?.message?.content;
    const meta = { finish: choice?.finish_reason ?? null, tokens: js?.usage?.completion_tokens ?? null,
      reasoning_tokens: js?.usage?.completion_tokens_details?.reasoning_tokens ?? null };
    return typeof content === "string" && content ? { status: "ok", content, ms: Date.now() - t0, ...meta } : { status: "error", content: null, ms: Date.now() - t0, ...meta };
  } catch {
    return { status: ctl.signal.aborted ? "timeout" : "error", content: null, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown): v is string => typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(v));

/** The model's reply as fields, or why it cannot be used: "invalid" (not the schema), "off_list" (names a place not on the list) or "no_place". */
export function validate(content: string, places: Places): Fields | "invalid" | "off_list" | "no_place" {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
  } catch {
    return "invalid";
  }
  const { place, polarity, date_kind: kind, date_from: from, date_to: to, claim_type: type, quantifier: q, confidence: c } = o;
  if (!(place === null || typeof place === "string") || (polarity !== "positive" && polarity !== "negative")) return "invalid";
  if (!DATE_KINDS.includes(kind as never) || !CLAIM_TYPES.includes(type as never)) return "invalid";
  if (!(q === null || typeof q === "string") || typeof c !== "number" || c < 0 || c > 1) return "invalid";
  const dates = kind === "day" ? isDate(from) && to === from
    : kind === "since" ? isDate(from) && to === null
    : kind === "period" ? isDate(from) && isDate(to) && from <= to
    : from === null && to === null;
  if (!dates) return "invalid";
  if (place === null || !place.trim()) return "no_place";
  const match = findPlace(place, places);
  if (!match) return "off_list";
  return {
    place_id: match.place.id, place_text: place as string, polarity, date_kind: kind as Fields["date_kind"],
    date_from: (from as string | null) ?? null, date_to: (to as string | null) ?? null, date_text: null,
    claim_type: type as Fields["claim_type"], quantifier: (q as string | null) || null, confidence: c,
  };
}
