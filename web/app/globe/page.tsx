import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Globe, { type GlobeArea } from "./Globe";
import type { Stats } from "../types";

export const metadata: Metadata = {
  title: "ChangeProof: the flood claim, seen from space",
  description: "NASA's image of 17 January 2026 shows southern Mozambique under cloud. NISAR's radar passed at 03:42 UTC. Type a flood claim and fly to what the radar saw.",
};

const DATA = path.join(process.cwd(), "public", "data");

// The globe's opening lines name the date and the time of the pass, so the build fails if the data says otherwise.
function areaOf(id: string): GlobeArea {
  const s: Stats = JSON.parse(fs.readFileSync(path.join(DATA, id, "stats.json"), "utf8"));
  const fail = (msg: string): never => {
    throw new Error(`globe: web/public/data/${id}/stats.json: ${msg}`);
  };
  if (s.as_of_label !== "17 Jan 2026, 03:42 UTC") fail(`as_of_label is "${s.as_of_label}", but the intro says 17 January 2026, 03:42 UTC`);
  const after = s.scenes.find((sc) => sc.role === "after") ?? fail("no after scene");
  const file = (name: string) => {
    const f = s.files.find((x) => x.file === name);
    return f?.bounds_4326 ? { url: `/data/${id}/${name}`, bounds: f.bounds_4326 } : fail(`${name} missing or without bounds_4326`);
  };
  return {
    id, name: s.name, bounds: s.grid.bounds_4326,
    radar: file(`hh_${after.start_utc.slice(0, 10).replaceAll("-", "")}.webp`), // the flood-time image, as the detailed map shows it
    water: file("water_new.png"),
  };
}

export default function Page() {
  const ids: string[] = JSON.parse(fs.readFileSync(path.join(DATA, "areas.json"), "utf8"));
  return (
    <>
      <link rel="preload" as="font" type="font/woff2" href="/fonts/newsreader-normal-400_700.woff2" crossOrigin="anonymous" />
      <link rel="stylesheet" href="/fonts/fonts.css" precedence="default" />
      <Globe areas={ids.map(areaOf)} />
    </>
  );
}
