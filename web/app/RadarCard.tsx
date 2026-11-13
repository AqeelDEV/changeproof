import { formatDay, type SeriesEntry, type Stats } from "./types";

// Three cases of the radar echo, drawn small: the pulse comes in from the top left.
function Echo({ x, kind, label, tone }: { x: number; kind: "mirror" | "rough" | "double"; label: string; tone: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="62" width="104" height="10" fill={kind === "rough" ? "#8a6d3b" : "#1f78ff"} />
      {kind === "double" && <rect x="66" y="22" width="8" height="40" fill="#3d6b35" />}
      <path d="M8 8 L46 60" stroke="#14181f" strokeWidth="2" markerEnd="url(#arrow)" fill="none" />
      {kind === "mirror" && <path d="M48 60 L88 12" stroke="#14181f" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow)" fill="none" />}
      {kind === "rough" && <path d="M46 58 L14 16 M48 58 L62 26 M48 58 L86 40" stroke="#14181f" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />}
      {kind === "double" && <path d="M46 60 L64 44 L16 6" stroke="#14181f" strokeWidth="2" markerEnd="url(#arrow)" fill="none" />}
      <rect x="0" y="80" width="104" height="14" fill={tone} stroke="#14181f" />
      <text x="52" y="110" textAnchor="middle" fontSize="10.5">{label}</text>
    </g>
  );
}

const LINES = [
  { key: "new_water", colour: "#1f78ff", name: "pixels detected as new water on 17 Jan" },
  { key: "dry_land", colour: "#8a6d3b", name: "dry land (no water on record)" },
  { key: "permanent_water", colour: "#14181f", name: "permanent water" },
] as const;

/** Median HH on each NISAR date for three fixed sets of pixels. Display only. */
function SeriesChart({ series }: { series: SeriesEntry[] }) {
  const vals = series.flatMap((s) => LINES.map((l) => s.hh_median_db[l.key])).filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const W = 340, H = 150, padL = 34, padB = 22, padT = 8;
  const x = (i: number) => padL + (i * (W - padL - 12)) / Math.max(series.length - 1, 1);
  const y = (v: number) => padT + ((hi - v) * (H - padT - padB)) / (hi - lo);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Median HH backscatter on each NISAR date">
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - 8} y1={y(v)} y2={y(v)} stroke="#dcd8cf" />
            <text x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize="9">{v.toFixed(0)} dB</text>
          </g>
        ))}
        {series.map((s, i) => (
          <text key={s.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9">{formatDay(s.date).slice(0, 6)}</text>
        ))}
        {LINES.map((l) => {
          const pts = series.map((s, i) => [x(i), s.hh_median_db[l.key]] as const).filter((p): p is readonly [number, number] => p[1] !== null);
          return (
            <g key={l.key}>
              <polyline points={pts.map(([px, v]) => `${px},${y(v)}`).join(" ")} fill="none" stroke={l.colour} strokeWidth="2" />
              {pts.map(([px, v]) => <circle key={px} cx={px} cy={y(v)} r="3" fill={l.colour} />)}
            </g>
          );
        })}
      </svg>
      <figcaption className="tag">
        Median HH echo on each NISAR pass, raw dB, lower is darker.{" "}
        {LINES.map((l) => (
          <span key={l.key}><span className="swatch" style={{ background: l.colour }} />{l.name}. </span>
        ))}
        Whole scenes shift by a few dB between passes (Beta calibration, or wet ground), so read the gap between the lines,
        not their height. For viewing only: nothing here feeds the flood detection.
      </figcaption>
    </figure>
  );
}

export default function RadarCard({ area }: { area: Stats }) {
  const m = area.results.hh_median_db_in_label;
  return (
    <section className="radar-card">
      <h2>How to read the radar</h2>
      <svg viewBox="0 0 340 116" role="img" aria-label="Three ways a radar pulse comes back: calm water, rough ground, flooded trees or buildings">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#14181f" />
          </marker>
        </defs>
        <Echo x={4} kind="mirror" label="Calm water: dark" tone="#111" />
        <Echo x={118} kind="rough" label="Rough ground: grey" tone="#888" />
        <Echo x={232} kind="double" label="Flooded trees: bright" tone="#f4f4f4" />
      </svg>
      <ul>
        <li>NISAR sends its own radar pulse and records the echo, so it sees at night and through cloud.</li>
        <li>
          Calm open water acts like a mirror and sends the pulse away from the satellite, so new water turns dark. Inside the
          Copernicus flood in this area the median HH echo fell from {m.before} dB on 5 Jan to {m.after} dB on 17 Jan.
        </li>
        <li>
          Water under trees or between buildings does the opposite: the pulse bounces off the water, then a trunk or a wall, and
          comes straight back. Those places get brighter, so this open-water method misses them. Where HH rose by more than 3 dB
          the coverage map says "unclear".
        </li>
        <li>
          HH is the echo that keeps the pulse's polarisation and shows open water best. HV is the part the surface twisted,
          strongest over plants. Switch between them in the layers box. In this flood, 17 Jan HH and its local average give
          about 91% of what the classifier uses.
        </li>
        <li>
          NISAR's L-band wave is about 24 cm long, against about 5.5 cm for Sentinel-1's C-band. It passes through leaves more
          easily, and smooth dry soil also looks dark to it. That is one reason NISAR and Copernicus disagree in places.
        </li>
        <li>
          NISAR returns every 12 days. The Beta data on ascending track 114 ends on 17 Jan 2026, and as of 13 Nov 2026 the next
          pass in the catalogue is 22 June, so every verdict here is "as of" 17 Jan.
        </li>
      </ul>
      {area.series && <SeriesChart series={area.series} />}
    </section>
  );
}
