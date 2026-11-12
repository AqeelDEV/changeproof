// POST {text, published?, date?, place_hint?} -> the checker's result. The only server code that reads the model key.
import { runCheck } from "../../../lib/checkClaim";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CHARS = 300; // a claim is a sentence; this also caps what one request can cost

export async function POST(req: Request) {
  const b: Record<string, unknown> | null = await req.json().catch(() => null);
  const text = typeof b?.text === "string" ? b.text.trim() : "";
  if (!b || !text || text.length > MAX_CHARS)
    return Response.json({ error: `text must be 1 to ${MAX_CHARS} characters` }, { status: 400 });
  const opt = (k: string, ok: (s: string) => boolean) => {
    const v = b[k];
    return typeof v === "string" && ok(v) ? v : undefined;
  };
  return Response.json(
    await runCheck(text, {
      published: opt("published", (s) => ISO.test(s)),
      date: opt("date", (s) => ISO.test(s)),
      place_hint: opt("place_hint", (s) => s.length <= 60),
    })
  );
}
