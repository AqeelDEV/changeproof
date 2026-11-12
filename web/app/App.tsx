"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ClaimPanel from "./ClaimPanel";
import CloudCard from "./CloudCard";
import RadarCard from "./RadarCard";
import StatsPanel, { IOU_TAG } from "./StatsPanel";
import type { Bounds, ClaimPlace, ClaimRequest, MapState, Optical, Stats } from "./types";

// Leaflet needs window, so the map is loaded on the client only.
const MapView = dynamic(() => import("./MapView"), { ssr: false });

// The disk the checker measured around a place, as [west, south, east, north].
function placeBounds(p: ClaimPlace): Bounds {
  const dLat = p.buffer_m / 111_320;
  const dLon = dLat / Math.cos((p.lat * Math.PI) / 180);
  return [p.lon - dLon, p.lat - dLat, p.lon + dLon, p.lat + dLat];
}

const TABS = [["claim", "Check a claim"], ["evidence", "Evidence"], ["limits", "Method and limits"]] as const;
type Tab = (typeof TABS)[number][0];

const START: MapState = { pol: "hh", radarOn: true, classes: { "water_new.png": true }, placesOn: true, split: 0.5, left: null };
const CHOKWE: Bounds = [32.9, -24.62, 33.12, -24.44];

// The guided tour: each step sets the area, the map and the side panel. The pitch follows the same path.
interface Step { title: string; text: (areas: Stats[]) => string; area: string; tab: Tab; focus: Bounds | null; view: Partial<MapState>; claim?: string }
const STEPS: Step[] = [
  {
    title: "Optical satellites saw cloud",
    text: () => "The nearest optical images of the flood, on 19 and 20 January 2026, show cloud (see the panel). NISAR's radar passed on 17 January and saw the ground. This is its image.",
    area: "aoi01", tab: "evidence", focus: null, view: { radarOn: true, pol: "hh", split: 0, classes: {}, placesOn: false, left: null },
  },
  {
    title: "Before and after at Chókwè",
    text: () => "Move the Before / after slider in the Layers box. Left is 5 January, right is 17 January. Calm open water sends the radar pulse away, so the new water is dark.",
    area: "aoi01", tab: "evidence", focus: CHOKWE, view: { radarOn: true, split: 0.5, classes: {}, placesOn: false, left: null },
  },
  {
    title: "Checked against a different radar",
    text: (areas) => {
      const s = areas.find((a) => a.area_id === "aoi05");
      return `Blue is the new open water found in NISAR. Red is the flood Copernicus mapped from Sentinel-1, 24 minutes earlier. This area was held out as the test`
        + (s ? `: agreement IoU ${s.agreement.iou.toFixed(3)} (${IOU_TAG.aoi05(s)}). Agreement with Copernicus, not accuracy.` : ".");
    },
    area: "aoi05", tab: "evidence", focus: null, view: { radarOn: true, split: 0, classes: { "water_new.png": true, "label.png": true }, placesOn: false },
  },
  {
    title: "A published claim, checked",
    text: () => "A news agency wrote on 17 January that the Limpopo had engulfed the town of Chókwè. The parser finds the place and date; fixed rules on the measured numbers give the verdict.",
    area: "aoi01", tab: "claim", focus: null, view: { radarOn: true, split: 0, classes: { "water_new.png": true }, placesOn: true },
    claim: "The flood waters of the Limpopo river have engulfed the town of Chokwe",
  },
  {
    title: "What NISAR cannot say",
    text: () => "NISAR last passed on 17 January, so a claim about 25 January is not observable. Now try “Homes were destroyed in Chókwè”: radar cannot show damage, so it is not provable. Export the report for either.",
    area: "aoi01", tab: "claim", focus: null, view: { radarOn: true, split: 0, classes: { "water_new.png": true }, placesOn: true },
    claim: "Xai-Xai was under water on 25 Jan",
  },
];

export default function App({ areas, optical }: { areas: Stats[]; optical: Record<string, Optical> }) {
  const [id, setId] = useState(areas[0].area_id);
  const [focus, setFocus] = useState<Bounds | null>(null);
  const [disk, setDisk] = useState<ClaimPlace | null>(null);
  const [view, setView] = useState<MapState>(START);
  const [tab, setTab] = useState<Tab>("claim");
  const [request, setRequest] = useState<ClaimRequest | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const area = areas.find((a) => a.area_id === id) ?? areas[0];

  function go(i: number) {
    const s = STEPS[i];
    setStep(i);
    if (areas.some((a) => a.area_id === s.area)) setId(s.area);
    setFocus(s.focus);
    setDisk(null);
    setView((v) => ({ ...v, ...s.view }));
    setTab(s.tab);
    if (s.claim) setRequest({ text: s.claim });
  }

  return (
    <>
      <header>
        <div className="brand">
          <h1>ChangeProof</h1>
          <p>Check a flood claim against NISAR radar. It says what the data can and cannot support.</p>
        </div>
        <label>
          Area{" "}
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setFocus(null); // show the whole area again
            }}
          >
            {areas.map((a) => (
              <option key={a.area_id} value={a.area_id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <span className="banner">
          NISAR {area.release} data, as of {area.as_of_label}
        </span>
        <button type="button" className="tour-btn" onClick={() => go(0)}>
          Take the tour
        </button>
      </header>
      <main>
        <div className="map-col">
          {step !== null && (
            <div className="tour" aria-live="polite">
              <div>
                <b>
                  {step + 1} of {STEPS.length}. {STEPS[step].title}
                </b>
                <p>{STEPS[step].text(areas)}</p>
              </div>
              <div className="tour-nav">
                <button type="button" disabled={step === 0} onClick={() => go(step - 1)}>Back</button>
                <button type="button" className="primary" onClick={() => (step < STEPS.length - 1 ? go(step + 1) : setStep(null))}>
                  {step < STEPS.length - 1 ? "Next" : "Finish"}
                </button>
                <button type="button" aria-label="Close the tour" onClick={() => setStep(null)}>×</button>
              </div>
            </div>
          )}
          <MapView
            area={area}
            focus={focus}
            disk={disk}
            view={view}
            onView={(v) => setView((old) => ({ ...old, ...v }))}
            onClaim={(text) => {
              setTab("claim");
              setRequest({ text });
            }}
          />
        </div>
        <aside>
          <nav className="tabs" role="tablist">
            {TABS.map(([k, name]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {name}
              </button>
            ))}
          </nav>
          {/* The claim panel stays mounted so a result survives a look at the other tabs. */}
          <div className="tab-claim" hidden={tab !== "claim"}>
            <ClaimPanel
              areas={areas}
              request={request}
              onPlace={(p) => {
                if (areas.some((a) => a.area_id === p.area)) setId(p.area);
                setDisk(p);
                setFocus(placeBounds(p)); // a new array each click, so a second click zooms again
              }}
            />
          </div>
          {tab === "evidence" && (
            <div className="tab-panel">
              {optical[area.area_id] && <CloudCard area={area} optical={optical[area.area_id]} />}
              <StatsPanel area={area} />
              <RadarCard area={area} />
            </div>
          )}
          {tab === "limits" && (
            <div className="tab-panel">
              <h2>Method, {area.name}</h2>
              <p>{area.method.summary}</p>
              <h2>Limits</h2>
              <ul className="limits">
                {area.limits.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="tag">
                Code, data sources and tests: <a href="https://github.com/AqeelDEV/changeproof" target="_blank" rel="noreferrer">github.com/AqeelDEV/changeproof</a>
              </p>
            </div>
          )}
        </aside>
      </main>
    </>
  );
}
