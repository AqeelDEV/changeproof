"use client";

import { useEffect, useRef, useState } from "react";
import { checkClaim, PRESETS, PUBLISHED, type ClaimOpts, type PublishedClaim } from "../lib/checkClaim";
import { dateRead, NUMBER_LABELS, plainReason, reportMarkdown, showNumber } from "../lib/report";
import { shownVerdict } from "../lib/claims/verdict.ts";
import { formatDay, type ClaimPlace, type ClaimRequest, type ClaimResult, type Stats } from "./types";

const MEANING: Record<string, string> = {
  supported: "The data shows it, inside the time and area NISAR covered.",
  contradicted: "The data shows otherwise, inside the time and area NISAR covered.",
  "not supported": "NISAR saw no new open water at this place on its pass. That is not proof it stayed dry.",
  "not provable, dry": "NISAR saw no new open water here, which fits the claim, but radar cannot prove a place stayed dry.",
  "not observable": "The claim falls outside the time or area NISAR covered.",
  "not provable": "Inside the time and area, but radar cannot settle it.",
};

/** The one-line meaning under the badge. A dry-rule result shown as "not provable" has its own line. */
export const meaningOf = (r: ClaimResult): string => {
  const shown = shownVerdict(r.verdict, r.fields.polarity);
  return MEANING[shown === "not provable" && r.verdict === "supported" ? "not provable, dry" : shown];
};

/** The mark before a verdict word: the checker's disk as the radar found it. It matches the place dots on the map. */
export function Mark({ v }: { v: string }) {
  const ringed = { cx: 8, cy: 8, r: 5.25, fill: "none", stroke: "currentColor", strokeWidth: 1.5 };
  return (
    <svg className="g-mark" viewBox="0 0 16 16" aria-hidden="true">
      {v === "supported" && <circle cx="8" cy="8" r="6" fill="currentColor" />}
      {v === "not supported" && <circle {...ringed} />}
      {v === "not provable" && <><circle {...ringed} /><path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" /></>}
      {v === "contradicted" && <><circle cx="8" cy="8" r="4.25" fill="currentColor" /><path d="M1 15L15 1" stroke="currentColor" strokeWidth="1.5" /></>}
      {v === "not observable" && <circle {...ringed} strokeDasharray="2.6 2.1" />}
    </svg>
  );
}

const optsOf = (c: PublishedClaim): ClaimOpts => ({ published: c.published, date: c.refers_to ?? undefined, place_hint: c.place_hint });

export default function ClaimPanel({ areas, request, onPlace }: {
  areas: Stats[];
  request: ClaimRequest | null; // a claim asked for from outside the panel: a map marker or a tour step
  onPlace: (p: ClaimPlace) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [source, setSource] = useState<PublishedClaim | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  async function run(t: string, opts: ClaimOpts = {}, src: PublishedClaim | null = null) {
    if (!t.trim()) return;
    const n = ++seq.current;
    setText(t);
    setBusy(true);
    const r = await checkClaim(t, opts);
    if (n !== seq.current) return; // a newer claim was asked meanwhile
    setBusy(false);
    setSource(src);
    setResult(r);
    if (r.fields.place) onPlace(r.fields.place); // zoom straight away; the card click zooms again
  }

  useEffect(() => {
    if (!request) return;
    const src = PUBLISHED.find((c) => c.quote === request.text) ?? null;
    run(request.text, src ? optsOf(src) : {}, src);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a new request arrives
  }, [request]);

  const f = result?.fields, place = f?.place, e = result?.evidence;
  const shown = result && f ? shownVerdict(result.verdict, f.polarity) : "";
  const meaning = result ? meaningOf(result) : "";
  const area = areas.find((a) => a.area_id === place?.area);

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([reportMarkdown(result, area, location.href, source ?? undefined)], { type: "text/markdown" }));
    a.download = `changeproof-${(place?.name ?? "claim").normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-report.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section className="claims">
      <h2 className="no-print">Check a flood claim</h2>
      <form
        className="no-print"
        onSubmit={(ev) => {
          ev.preventDefault();
          run(text);
        }}
      >
        <input aria-label="Claim" maxLength={300} value={text} onChange={(ev) => setText(ev.target.value)}
          placeholder="e.g. Chókwè was flooded on 17 January" />
        <button type="submit" disabled={busy}>{busy ? "Checking" : "Check"}</button>
      </form>
      <div className="presets no-print">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => run(p)}>{p}</button>
        ))}
      </div>

      {result && f && (
        <div className={`result r-${shown.replace(" ", "-")}`} aria-live="polite">
          <p className="print-only"><b>ChangeProof evidence report</b></p>
          <p className="quote">“{result.claim}”</p>
          {source && (
            <p className="tag">
              {source.source}, published {source.published}. <a href={source.link} target="_blank" rel="noreferrer">Source</a>
            </p>
          )}
          <p><span className={`verdict v-${shown.replace(" ", "-")}`}><Mark v={shown} />{shown.charAt(0).toUpperCase() + shown.slice(1)}</span></p>
          <p className="stamp">as of {result.as_of}, NISAR Beta data</p>
          <p className="tag">{meaning}</p>
          <p className="headline">{result.headline}</p>
          <ul>
            {result.reasons.map((r) => (
              <li key={r}>{plainReason(r, place?.name ?? "the place")}</li>
            ))}
          </ul>
          <div className="actions no-print">
            {place && <button type="button" onClick={() => onPlace(place)}>Show {place.name} on the map</button>}
            <button type="button" onClick={download}>Export report (.md)</button>
            <button
              type="button"
              onClick={(ev) => {
                // A closed <details> prints empty, so open the report's sections first.
                ev.currentTarget.closest(".result")?.querySelectorAll("details").forEach((d) => (d.open = true));
                window.print();
              }}
            >
              Print / save as PDF
            </button>
          </div>

          <details open>
            <summary>How the claim was read</summary>
            <table>
              <tbody>
                <tr><td>Place</td><td>{place ? `${place.name}, ${place.buffer_m / 1000} km around it, in ${area?.name ?? place.area}` : "none matched"}</td></tr>
                <tr><td>Says</td><td>{f.polarity === "negative" ? "it did not happen" : "it happened"}</td></tr>
                <tr><td>Date</td><td>{dateRead(f).replace(/^day: /, "").replace(/\d{4}-\d{2}-\d{2}/g, formatDay)}</td></tr>
                <tr><td>Type</td><td>{f.claim_type}</td></tr>
                <tr><td>Amount</td><td>{f.quantifier ?? "none"}</td></tr>
              </tbody>
            </table>
            <p className="tag">
              Fields from: {result.path} (model: {result.model_status}). The model only fills these fields. Fixed rules on
              the measured numbers give the verdict.
            </p>
          </details>

          {e && (
            <details className="evidence">
              <summary>Evidence: numbers, Copernicus, scenes</summary>
              <table>
                <tbody>
                  {Object.entries(e.numbers).map(([k, v]) => (
                    <tr key={k}><td>{NUMBER_LABELS[k] ?? k}</td><td>{showNumber(k, v)}</td></tr>
                  ))}
                </tbody>
              </table>
              <h3>Copernicus EMS at this place</h3>
              <ul>{e.copernicus.map((c) => <li key={c}>{c}</li>)}</ul>
              <h3>Buildings</h3>
              <p>{e.buildings}</p>
              <h3>NISAR scenes</h3>
              {e.area.granules.map((g) => <p key={g} className="mono">{g}</p>)}
              <h3>Caveats</h3>
              <ul>{e.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
              {area && (
                <>
                  <h3>Limits for {area.name}</h3>
                  <ul>{area.limits.map((l) => <li key={l}>{l}</li>)}</ul>
                </>
              )}
            </details>
          )}
        </div>
      )}

      <div className="published no-print">
        <h2>Published claims</h2>
        <p className="tag">Short quotes from news and UN reports on the flood. Reported as they come out, never used to tune anything.</p>
        {PUBLISHED.map((c) => (
          <button key={c.quote} type="button" onClick={() => run(c.quote, optsOf(c), c)}>
            “{c.quote}”
            <span className="tag">{c.source}, {c.published}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
