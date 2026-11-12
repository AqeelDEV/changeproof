"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import ClaimPanel from "./ClaimPanel";
import CloudCard from "./CloudCard";
import StatsPanel from "./StatsPanel";
import type { Bounds, ClaimPlace, Optical, Stats } from "./types";

// Leaflet needs window, so the map is loaded on the client only.
const MapView = dynamic(() => import("./MapView"), { ssr: false });

// The disk the checker measured around a place, as [west, south, east, north].
function placeBounds(p: ClaimPlace): Bounds {
  const dLat = p.buffer_m / 111_320;
  const dLon = dLat / Math.cos((p.lat * Math.PI) / 180);
  return [p.lon - dLon, p.lat - dLat, p.lon + dLon, p.lat + dLat];
}

export default function App({ areas, optical }: { areas: Stats[]; optical: Record<string, Optical> }) {
  const [id, setId] = useState(areas[0].area_id);
  const [focus, setFocus] = useState<Bounds | null>(null);
  const area = areas.find((a) => a.area_id === id) ?? areas[0];

  return (
    <>
      <header>
        <h1>ChangeProof</h1>
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
      </header>
      <main>
        <div className="map-col">
          <MapView area={area} focus={focus} />
        </div>
        <aside>
          <ClaimPanel
            onPlace={(p) => {
              if (areas.some((a) => a.area_id === p.area)) setId(p.area);
              setFocus(placeBounds(p)); // a new array each click, so a second click zooms again
            }}
          />
          {optical[area.area_id] && <CloudCard area={area} optical={optical[area.area_id]} />}
          <StatsPanel area={area} />
        </aside>
      </main>
    </>
  );
}
