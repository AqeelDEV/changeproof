// Check one claim: the parser always runs; the model runs alongside it and its fields are used only if they arrive in
// time, fit the schema and name a place on the list. Import from server code only (the model call reads the key).
import { findPlace, parse, resolveRelative, words, type Fields, type Places } from "./parse.ts";
import { askModel, timeoutMs, validate, type ModelReply } from "./model.ts";
import { verdict, type Judgement } from "./verdict.ts";

export type Path = "parser" | "model" | "conflict";
export type ModelStatus = "used" | "cached" | "ignored" | "disabled" | "timeout" | "error" | "invalid" | "off_list";
export type CacheEntry = ModelReply; // a recorded model reply, so planned demo claims and tests need no network

export interface Result extends Judgement {
  claim: string;
  as_of: string;
  fields: Fields;
  path: Path;
  model_status: ModelStatus;
  parser_fields?: Fields; // both readings, when they conflict
  model_fields?: Fields;
}

/** The key a claim is cached under: its folded words. */
export const cacheKey = (text: string) => words(text).join(" ");

/** For a quote from an article (all YYYY-MM-DD, all optional):
 * - published: the article's date; relative words ("ontem", "today") are worked out from it.
 * - date: the day the claim refers to, used only when the text gives no date and no relative word that published resolves.
 * - place_hint: the place the article is about, used only when the quote names no place. */
export async function check(text: string, places: Places,
  opts: { cache?: Record<string, CacheEntry>; date?: string; published?: string; place_hint?: string } = {}): Promise<Result> {
  const limit = timeoutMs(), hit = opts.cache?.[cacheKey(text)];
  const pending = hit ? Promise.resolve(hit) : askModel(text, limit); // started before the parser runs
  const parsed = parse(text, places);
  const reply = await pending;

  let status: ModelStatus, model: Fields | null = null, modelNamedOther = false;
  if (reply.content === null) status = reply.status === "ok" ? "error" : reply.status;
  else if (reply.ms > limit) status = "timeout";
  else {
    const v = validate(reply.content, places);
    if (typeof v === "string") [status, modelNamedOther] = [v === "no_place" ? "off_list" : v, v === "off_list"];
    else [model, status] = [v, hit ? "cached" : "used"];
  }

  let path: Path = "parser", fields = parsed, other: Fields | undefined;
  if (model) {
    const parserFound = parsed.place_id !== null && parsed.claim_type !== "other";
    const agree = model.place_id === parsed.place_id && model.polarity === parsed.polarity;
    if (!parserFound || agree) [path, fields] = ["model", model];
    else if (model.claim_type !== "other") [path, other] = ["conflict", model];
    else status = "ignored";
  }

  const notes: string[] = [];
  // shortcut: with no model reply, a quote naming a place off the list looks like one naming none, so the hint is used; place_hint is set by hand.
  if (fields.place_id === null && opts.place_hint && !modelNamedOther) {
    const m = findPlace(opts.place_hint, places);
    if (m) {
      fields = { ...fields, place_id: m.place.id, place_text: opts.place_hint };
      notes.push(`The place (${m.place.name}) was taken from the article, not the quote.`);
    }
  }

  const rel = parsed.date_kind === "relative" ? parsed.date_text : null;
  const span = rel && opts.published ? resolveRelative(rel, opts.published) : null;
  if (span && fields.date_kind === "relative") notes.push(`"${rel}" in an article published ${opts.published} is read as ${span.from === span.to ? span.from : `${span.from} to ${span.to}`}.`);
  const dated = (f: Fields): Fields => {
    if (f.date_kind === "relative" && span)
      return { ...f, date_kind: span.from === span.to ? "day" : "period", date_from: span.from, date_to: span.to, date_text: `${rel}, worked out from the published date` };
    return opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) && (f.date_kind === "none" || f.date_kind === "relative")
      ? { ...f, date_kind: "day", date_from: opts.date, date_to: opts.date, date_text: `${opts.date}, the date given with the claim` } : f;
  };
  fields = dated(fields);
  const j = verdict(fields, places, other && dated(other));
  j.reasons.splice(1, 0, ...notes); // the first line stays the date reading
  return { claim: text, as_of: places.as_of_label, ...j, fields, path, model_status: status,
    ...(other ? { parser_fields: fields, model_fields: dated(other) } : {}) };
}
