"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { formatUtc, type Bounds, type Stats } from "./types";

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

// "#1b9e77 at alpha 170: evaluated" -> ["#1b9e77", "evaluated"]
function legendRow(text: string): [string, string] {
  const i = text.indexOf(": ");
  const colour = /^#[0-9a-f]{6}/i.exec(text)?.[0] ?? "transparent";
  return [colour, i >= 0 ? text.slice(i + 2) : text];
}

export default function MapView({ area }: { area: Stats }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [pol, setPol] = useState<"hh" | "hv">("hh");
  const [radarOn, setRadarOn] = useState(true);
  const [classesOn, setClassesOn] = useState<Record<string, boolean>>({ "water_new.png": true });
  const [split, setSplit] = useState(0.5);

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
    for (const [name, z] of [["before", 410], ["after", 420], ["classes", 430]] as const)
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
    map?.invalidateSize().fitBounds(toLeaflet(area.grid.bounds_4326));
  }, [map, area]);

  const before = area.scenes.find((s) => s.role === "before")!;
  const after = area.scenes.find((s) => s.role === "after")!;

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
    const grey = (startUtc: string) => `${pol}_${startUtc.slice(0, 10).replace(/-/g, "")}.webp`;
    if (radarOn) {
      add(grey(before.start_utc), "before");
      add(grey(after.start_utc), "after");
    }
    for (const c of CLASS_LAYERS) if (classesOn[c.file]) add(c.file, "classes");
    return () => layers.forEach((l) => l.remove());
  }, [map, area, before, after, pol, radarOn, classesOn]);

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

  return (
    <>
      <div ref={divRef} className="map" />
      {radarOn && (
        <>
          <div className="swipe-line" style={{ left: `${split * 100}%` }} />
          <div className="side-label" style={{ right: `${(1 - split) * 100}%` }}>
            {formatUtc(before.start_utc)} (before)
          </div>
          <div className="side-label" style={{ left: `${split * 100}%` }}>
            {formatUtc(after.start_utc)} (after)
          </div>
        </>
      )}
      <div className="controls">
        <label>
          <input type="checkbox" checked={radarOn} onChange={(e) => setRadarOn(e.target.checked)} /> NISAR radar
          (grey)
        </label>
        <label>
          <input type="radio" name="pol" checked={pol === "hh"} onChange={() => setPol("hh")} /> HH{" "}
          <input type="radio" name="pol" checked={pol === "hv"} onChange={() => setPol("hv")} /> HV
        </label>
        <label>
          Before / after
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
          />
        </label>
        <hr />
        {CLASS_LAYERS.map((c) => (
          <label key={c.file}>
            <input
              type="checkbox"
              checked={!!classesOn[c.file]}
              onChange={(e) => setClassesOn({ ...classesOn, [c.file]: e.target.checked })}
            />{" "}
            {c.colour && <span className="swatch" style={{ background: c.colour }} />}
            {c.name}
          </label>
        ))}
        {classesOn["coverage.png"] && (
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
      </div>
    </>
  );
}
