// Check one claim: the parser always runs; the model runs alongside it and its fields are used only if they arrive in
// time, fit the schema and name a place on the list. Import from server code only (the model call reads the key).
import { parse, words, type Fields, type Places } from "./parse.ts";
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

/** date (YYYY-MM-DD) is the day a claim refers to, for example a published claim's date; used only when the text gives none. */
export async function check(text: string, places: Places, opts: { cache?: Record<string, CacheEntry>; date?: string } = {}): Promise<Result> {
  const limit = timeoutMs(), hit = opts.cache?.[cacheKey(text)];
  const pending = hit ? Promise.resolve(hit) : askModel(text, limit); // started before the parser runs
  const parsed = parse(text, places);
  const reply = await pending;

  let status: ModelStatus, model: Fields | null = null;
  if (reply.content === null) status = reply.status === "ok" ? "error" : reply.status;
  else if (reply.ms > limit) status = "timeout";
  else {
    const v = validate(reply.content, places);
    if (typeof v === "string") status = v;
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

  const dated = (f: Fields): Fields => opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) && (f.date_kind === "none" || f.date_kind === "relative")
    ? { ...f, date_kind: "day", date_from: opts.date, date_to: opts.date, date_text: `${opts.date}, the date given with the claim` } : f;
  fields = dated(fields);
  const j = verdict(fields, places, other && dated(other));
  return { claim: text, as_of: places.as_of_label, ...j, fields, path, model_status: status,
    ...(other ? { parser_fields: fields, model_fields: dated(other) } : {}) };
}
