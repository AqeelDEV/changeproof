"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import StatsPanel from "./StatsPanel";
import type { Stats } from "./types";

// Leaflet needs window, so the map is loaded on the client only.
const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function App({ areas }: { areas: Stats[] }) {
  const [id, setId] = useState(areas[0].area_id);
  const area = areas.find((a) => a.area_id === id) ?? areas[0];

  return (
    <>
      <header>
        <h1>ChangeProof</h1>
        <label>
          Area{" "}
          <select value={id} onChange={(e) => setId(e.target.value)}>
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
          <MapView area={area} />
        </div>
        <StatsPanel area={area} />
      </main>
    </>
  );
}
