"use client";

import { useState } from "react";
import { checkClaim, SAMPLES } from "../lib/checkClaim";
import type { ClaimPlace, ClaimResult } from "./types";

const PRESETS = Object.keys(SAMPLES);
const IS_SAMPLE = new Set(Object.values(SAMPLES));

// Any evidence shape as rows: {a: {b: 1}, c: [{d: 2}]} -> [["a.b", 1], ["c[1].d", 2]]
function flatten(v: unknown, key = ""): [string, string][] {
  if (Array.isArray(v)) return v.flatMap((x, i) => flatten(x, `${key}[${i + 1}]`));
  if (v && typeof v === "object")
    return Object.entries(v).flatMap(([k, x]) => flatten(x, key ? `${key}.${k}` : k));
  return [[key || "value", v === null ? "none" : String(v)]];
}

export default function ClaimPanel({ onPlace }: { onPlace: (p: ClaimPlace) => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [miss, setMiss] = useState(false);

  async function run(t: string) {
    setText(t);
    const r = await checkClaim(t);
    setResult(r);
    setMiss(!r && t.trim() !== "");
  }

  const place = result?.fields.place;
  const f = result?.fields;

  return (
    <section className="claims">
      <h2>Check a claim</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(text);
        }}
      >
        <input
          aria-label="Claim"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Chókwè was flooded on 17 January"
        />
        <button type="submit">Check</button>
      </form>
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => run(p)}>
            {p}
          </button>
        ))}
      </div>
      {miss && <p className="tag">The live checker is not connected yet. Try one of the examples.</p>}

      {result && f && (
        <div
          className={`result${place ? " clickable" : ""}`}
          {...(place && {
            role: "button",
            tabIndex: 0,
            title: `Zoom the map to ${place.name}`,
            onClick: () => onPlace(place),
            onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onPlace(place),
          })}
        >
          {IS_SAMPLE.has(result) && <span className="sample">Sample result</span>}
          <p className="headline">{result.headline}</p>
          <p>
            <span className={`verdict v-${result.verdict.replace(" ", "-")}`}>{result.verdict}</span>{" "}
            <span className="tag">as of {result.as_of}</span>
          </p>
          <ul>
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <h3>What the claim says</h3>
          <table>
            <tbody>
              <tr>
                <td>Place</td>
                <td>{place ? `${place.name} (${place.area}, ${place.buffer_m / 1000} km around it)` : "none matched"}</td>
              </tr>
              <tr>
                <td>Polarity</td>
                <td>{f.polarity}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td>
                  {f.date_kind}
                  {f.date_from && `: ${f.date_from}${f.date_to && f.date_to !== f.date_from ? ` to ${f.date_to}` : ""}`}
                  {f.date_kind === "since" && " onwards"}
                </td>
              </tr>
              <tr>
                <td>Type</td>
                <td>{f.claim_type}</td>
              </tr>
              <tr>
                <td>Quantifier</td>
                <td>{f.quantifier ?? "none"}</td>
              </tr>
              <tr>
                <td>Confidence</td>
                <td>{f.confidence}</td>
              </tr>
            </tbody>
          </table>
          <p className="tag">
            Fields from: {result.path} (model: {result.model_status})
          </p>
          <details>
            <summary>Evidence</summary>
            <table className="mono">
              <tbody>
                {flatten(result.evidence).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {place && <p className="tag">Click this card to zoom the map to {place.name}.</p>}
        </div>
      )}
    </section>
  );
}
