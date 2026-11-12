"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { PLACES } from "../lib/checkClaim";
import type { Place } from "../lib/claims/parse.ts";
import { isDry, isWet, THRESHOLDS } from "../lib/claims/verdict.ts";
import { formatDay, formatUtc, type Bounds, type ClaimPlace, type MapState, type Stats } from "./types";

// Contract order is [west, south, east, north]; Leaflet wants [[south, west], [north, east]].
const toLeaflet = (b: Bounds): L.LatLngBoundsExpression => [
  [b[1], b[0]],
  [b[3], b[2]],
];

const CLASS_LAYERS = [
  { file: "water_new.png", name: "Detected new water", colour: "#1f78ff" },
  { file: "label.png", name: "Copernicus observed flood", colour: "#e5382d" },
  { file: "coverage.png", name: "Coverage", colour: "" },
];

// What NISAR can say about a place, by the checker's own rules (lib/claims/verdict.ts).
const PLACE_STATES = {
  wet: { colour: "#1f78ff", text: "new open water: a flood claim is supported" },
  dry: { colour: "#ffffff", text: "no new open water: a flood claim is contradicted" },
  open: { colour: "#f0b429", text: "cannot settle it" },
  blind: { colour: "#8a8f98", text: "too little NISAR data" },
} as const;
const stateOf = (p: Place): keyof typeof PLACE_STATES =>
  p.valid_share < THRESHOLDS.min_valid_share ? "blind" : isWet(p) ? "wet" : isDry(p) ? "dry" : "open";

// "#1b9e77 at alpha 170: evaluated" -> ["#1b9e77", "evaluated"]
function legendRow(text: string): [string, string] {
  const i = text.indexOf(": ");
  const colour = /^#[0-9a-f]{6}/i.exec(text)?.[0] ?? "transparent";
  return [colour, i >= 0 ? text.slice(i + 2) : text];
}

export default function MapView({ area, focus, disk, view, onView, onClaim }: {
  area: Stats;
  focus: Bounds | null;
  disk: ClaimPlace | null; // the place of the last checked claim: its measured disk is drawn
  view: MapState;
  onView: (v: Partial<MapState>) => void;
  onClaim: (text: string) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const { pol, radarOn, classes, placesOn, split } = view;

  useEffect(() => {
    const m = L.map(divRef.current!);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    }).addTo(m);
    m.attributionControl.addAttribution(
      "Flood label: Copernicus Emergency Management Service (EMSR857) | NISAR: NASA/ASF"
    );
    // Own panes above the tiles (200), so the swipe clip cuts only the after-radar.
    for (const [name, z] of [["before", 410], ["after", 420], ["classes", 430], ["places", 440]] as const)
      m.createPane(name).style.zIndex = String(z);
    // Leaflet only tracks window resizes, so watch the container too (layout shifts, panes).
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(divRef.current!);
    setMap(m);
    return () => {
      ro.disconnect();
      m.remove();
      setMap(null);
    };
  }, []);

  useEffect(() => {
    // The container may have been measured before layout, so re-read its size first.
    // One fit per change: Leaflet drops a second zoom while the first still animates.
    map?.invalidateSize().fitBounds(toLeaflet(focus ?? area.grid.bounds_4326));
  }, [map, area, focus]);

  const before = area.scenes.find((s) => s.role === "before")!;
  const after = area.scenes.find((s) => s.role === "after")!;
  const day = (startUtc: string) => startUtc.slice(0, 10);
  // The date left of the swipe: the before scene unless an earlier date of this area's series is picked.
  const series = area.series ?? [];
  const left = series.some((s) => s.date === view.left && s.role !== "after") ? view.left! : day(before.start_utc);

  useEffect(() => {
    if (!map) return;
    const layers: L.Layer[] = [];
    const add = (file: string, pane: string) => {
      const f = area.files.find((x) => x.file === file);
      if (f?.bounds_4326)
        layers.push(
          L.imageOverlay(`/data/${area.area_id}/${f.file}`, toLeaflet(f.bounds_4326), { pane }).addTo(map)
        );
    };
    // Grey file names carry the scene date, e.g. hh_20260105.webp.
    const grey = (date: string) => `${pol}_${date.replace(/-/g, "")}.webp`;
    if (radarOn) {
      add(grey(left), "before");
      add(grey(day(after.start_utc)), "after");
    }
    for (const c of CLASS_LAYERS) if (classes[c.file]) add(c.file, "classes");
    return () => layers.forEach((l) => l.remove());
  }, [map, area, left, after, pol, radarOn, classes]);

  useEffect(() => {
    if (!map) return;
    const layers: L.Layer[] = [];
    if (placesOn)
      for (const p of PLACES.places.filter((x) => x.area === area.area_id)) {
        const st = PLACE_STATES[stateOf(p)];
        layers.push(
          L.circleMarker([p.lat, p.lon], { pane: "places", radius: 6, weight: 2, color: "#14181f", fillColor: st.colour, fillOpacity: 1 })
            .bindTooltip(`${p.name}: ${st.text}. Click to check.`)
            .on("click", () => onClaim(`${p.name} was flooded`))
            .addTo(map)
        );
      }
    if (disk && disk.area === area.area_id)
      layers.push(
        L.circle([disk.lat, disk.lon], { pane: "places", radius: disk.buffer_m, weight: 2, color: "#14181f", dashArray: "6 6", fill: false, interactive: false }).addTo(map)
      );
    return () => layers.forEach((l) => l.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClaim is a new function each render
  }, [map, area, placesOn, disk]);

  // Swipe: the after pane shows only right of the slider. Panes sit at layer point (0, 0) and
  // have no size, so the inset is in layer pixels, with negative values to reach the far edges.
  useEffect(() => {
    if (!map) return;
    const pane = map.getPane("after")!;
    const update = () => {
      const size = map.getSize();
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      const x = nw.x + size.x * split;
      pane.style.clipPath = `inset(${nw.y}px ${-se.x}px ${-se.y}px ${x}px)`;
    };
    update();
    map.on("move zoom zoomend viewreset resize", update);
    return () => {
      map.off("move zoom zoomend viewreset resize", update);
    };
  }, [map, split]);

  const legend = area.files.find((f) => f.file === "coverage.png")?.legend ?? {};
  const [open, setOpen] = useState(() => window.innerWidth > 860); // closed on a phone, where the box would hide the map

  return (
    <>
      <div className="map-wrap">
        <div ref={divRef} className="map" />
        {radarOn && (
          <>
            <div className="swipe-line" style={{ left: `${split * 100}%` }} />
            <div className="side-label" style={{ right: `${(1 - split) * 100}%` }}>
              {left === day(before.start_utc) ? `${formatUtc(before.start_utc)} (before)` : `${formatDay(left)} (earlier)`}
            </div>
            <div className="side-label" style={{ left: `${split * 100}%` }}>
              {formatUtc(after.start_utc)} (after)
            </div>
          </>
        )}
        <div className="controls">
          <button type="button" className="controls-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            Layers {open ? "▾" : "▸"}
          </button>
          {open && (
            <>
              <label>
                <input type="checkbox" checked={radarOn} onChange={(e) => onView({ radarOn: e.target.checked })} /> NISAR radar
                (grey)
              </label>
              <label>
                <input type="radio" name="pol" checked={pol === "hh"} onChange={() => onView({ pol: "hh" })} /> HH{" "}
                <input type="radio" name="pol" checked={pol === "hv"} onChange={() => onView({ pol: "hv" })} /> HV
              </label>
              <label>
                Before / after
                <input type="range" min={0} max={1} step={0.005} value={split} onChange={(e) => onView({ split: Number(e.target.value) })} />
              </label>
              <hr />
              {CLASS_LAYERS.map((c) => (
                <label key={c.file}>
                  <input type="checkbox" checked={!!classes[c.file]} onChange={(e) => onView({ classes: { ...classes, [c.file]: e.target.checked } })} />{" "}
                  {c.colour && <span className="swatch" style={{ background: c.colour }} />}
                  {c.name}
                </label>
              ))}
              {classes["coverage.png"] && (
                <div className="tag">
                  {Object.values(legend).map((t) => {
                    const [colour, text] = legendRow(t);
                    return (
                      <div key={t}>
                        <span className="swatch" style={{ background: colour, opacity: 0.67 }} />
                        {text}
                      </div>
                    );
                  })}
                </div>
              )}
              <hr />
              <label>
                <input type="checkbox" checked={placesOn} onChange={(e) => onView({ placesOn: e.target.checked })} /> Places NISAR can
                speak to
              </label>
              {placesOn && (
                <div className="tag">
                  {Object.values(PLACE_STATES).map((s) => (
                    <div key={s.text}>
                      <span className="swatch dot" style={{ background: s.colour }} />
                      {s.text}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {series.length > 2 && (
        <div className="strip" role="group" aria-label="NISAR dates">
          <span className="tag">NISAR passes, 12 days apart. Pick the date shown left of the slider:</span>
          {series.map((s) =>
            s.role === "after" ? (
              <span key={s.date} className="chip after">{formatDay(s.date)} (right side)</span>
            ) : (
              <button key={s.date} type="button" className={`chip${s.date === left ? " on" : ""}`} aria-pressed={s.date === left}
                onClick={() => onView({ left: s.date, radarOn: true })}>
                {formatDay(s.date)}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}
