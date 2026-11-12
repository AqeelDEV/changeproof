"use client";

// The globe: one map and one timeline. The surface is NASA's VIIRS image of 17 January 2026; the NISAR image appears
// only where NISAR looked; every number comes from the checker's result. Design rules: docs/DESIGN.md.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { CanvasSource, GeoJSONSource, ImageSource, Map as GlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globe.css";
import tileSets from "./tiles.json";
import { meaningOf } from "../ClaimPanel";
import { checkClaim, PRESETS, runCheck } from "../../lib/checkClaim";
import { shownVerdict } from "../../lib/claims/verdict.ts";
import { showNumber } from "../../lib/report";
import type { Bounds, ClaimPlace, ClaimResult } from "../types";

gsap.registerPlugin(useGSAP);

export interface GlobeArea { id: string; name: string; bounds: Bounds; radar: { url: string; bounds: Bounds }; water: { url: string; bounds: Bounds } }

type Mode = "load" | "intro" | "flight" | "free";
interface Cam { lng: number; lat: number; zoom: number; pitch: number; bearing: number; x: number; y: number } // x, y: where the centre sits on screen, px

const SEEN = "changeproof.intro"; // set once the intro has played, so later visits open on the globe
const TOP = 44; // height of the top bar, px
const SWEEP_W = 1024; // the reveal is drawn at reduced size while it moves
const rad = Math.PI / 180;
const merc = (lat: number) => Math.asinh(Math.tan(lat * rad));
const pct = (x: number | null) => (x === null ? "n/a" : x > 0 && x < 0.01 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`); // as lib/claims/verdict.ts
const corners = ([w, s, e, n]: Bounds): [[number, number], [number, number], [number, number], [number, number]] => [[w, n], [e, n], [e, s], [w, s]];
const line = (coordinates: number[][]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates } });
const lines = (features: ReturnType<typeof line>[]) => ({ type: "FeatureCollection" as const, features });
const NONE = lines([]);
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="; // 1 px, see-through
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const seenIntro = () => { try { return localStorage.getItem(SEEN) === "1"; } catch { return false; } };
const remember = () => { try { localStorage.setItem(SEEN, "1"); } catch { /* storage blocked: the intro simply plays again */ } };

function screen() {
  const W = innerWidth, H = innerHeight, tall = W < H * 0.8;
  return { W, H, tall, band: Math.round(H * (tall ? 0.34 : 0.32)) };
}
// Zoom at which the globe looks r px in radius. The sphere's own radius is 512 * 2^zoom / (2 pi cos(latitude)), and the
// camera stands 1.5 screen heights from its surface, so the limb is seen under a perspective: measured against the map.
function radiusZoom(r: number, lat: number) {
  const F = 1.5 * innerHeight, s = Math.sin(Math.atan(r / F));
  return Math.log2((2 * Math.PI * ((s * F) / (1 - s)) * Math.cos(lat * rad)) / 512);
}
// Zoom at which `span` degrees of longitude cross the screen.
const spanZoom = (W: number, span: number) => Math.log2((W * 360) / (span * 512));

// The opening: the Earth small, up and to the right, with dark space for the type.
function opening(): Cam {
  const { W, H, tall } = screen();
  return { lng: 50, lat: -14, zoom: radiusZoom(tall ? 0.46 * W : 0.42 * H, -14), pitch: 0, bearing: 0, x: tall ? W / 2 : 0.68 * W, y: 0.3 * H };
}
const overMozambique = (): Cam => ({ ...opening(), lng: 36, lat: -22, zoom: radiusZoom(screen().tall ? 0.46 * screen().W : 0.42 * screen().H, -22) });
// Free view: the whole Earth inside the picture, above the band.
function home(): Cam {
  const { W, H, band } = screen(), h = H - TOP - band;
  return { lng: 36, lat: -22, zoom: radiusZoom(Math.min(0.46 * h, 0.44 * W), -22), pitch: 0, bearing: 0, x: W / 2, y: TOP + h / 2 };
}

// Where a result sends the camera, and what the picture may show there.
function target(r: ClaimResult, areas: GlobeArea[]) {
  const { W, H, tall, band } = screen(), p = r.fields.place;
  const h = tall ? 0.42 * H - TOP : H - TOP - band; // on a phone the card is a sheet over the lower part
  const x = tall ? W / 2 : 0.62 * W, y = TOP + h / 2;
  if (!p) { // no place matched: we hold no coordinates for it, so show the three areas NISAR covered
    const w = Math.min(...areas.map((a) => a.bounds[0])), s = Math.min(...areas.map((a) => a.bounds[1]));
    const e = Math.max(...areas.map((a) => a.bounds[2])), n = Math.max(...areas.map((a) => a.bounds[3]));
    const span = Math.max((e - w) * 1.5, ((n - s) / Math.cos(((s + n) / 2) * rad)) * (W / h) * 1.3);
    return { cam: { lng: (w + e) / 2, lat: (s + n) / 2, zoom: spanZoom(W, span), pitch: 0, bearing: 0, x, y }, area: null, place: null, seen: false };
  }
  const km = p.buffer_m / 1000, span = Math.max(tall ? 0.08 : 0.2, km * (tall ? 0.055 : 0.15));
  // "not observable" means the date or the coverage rules it out: then nothing is revealed and the cloud stays.
  const seen = shownVerdict(r.verdict, r.fields.polarity) !== "not observable";
  return { cam: { lng: p.lon, lat: p.lat, zoom: spanZoom(W, span), pitch: 30, bearing: 0, x, y }, area: areas.find((a) => a.id === p.area) ?? null, place: p, seen };
}

// The checker's disk around a place, as a ring of points; `t` draws only the first part of it.
function ring(p: ClaimPlace, t: number) {
  const dLat = p.buffer_m / 111_320, dLon = dLat / Math.cos(p.lat * rad), n = Math.round(72 * t);
  return n < 1 ? NONE : lines([line(Array.from({ length: n + 1 }, (_, i) => [p.lon + dLon * Math.sin((i / 72) * 2 * Math.PI), p.lat + dLat * Math.cos((i / 72) * 2 * Math.PI)]))]);
}

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 4, 0.7, 6.5, 0] }, // the thin air glow, gone by the time we are close
  sources: {
    ...Object.fromEntries(tileSets.map((s) => [s.id, { type: "raster" as const, tiles: ["/globe/{z}/{y}/{x}.jpg"], tileSize: 256, minzoom: s.minzoom, maxzoom: s.maxzoom, bounds: s.bounds as Bounds }])),
    areas: { type: "geojson", data: NONE }, disk: { type: "geojson", data: NONE },
  },
  layers: [
    ...tileSets.map((s) => ({ id: s.id, type: "raster" as const, source: s.id })),
    { id: "areas-casing", type: "line", source: "areas", paint: { "line-color": "#0a1024", "line-width": 4.5 } }, // white alone vanishes on white cloud
    { id: "areas", type: "line", source: "areas", paint: { "line-color": "#fbf8f1", "line-width": 1.5 } },
    { id: "disk", type: "line", source: "disk", paint: { "line-color": "#fbf8f1", "line-width": 2, "line-dasharray": [2, 1.5] } },
  ],
};

function Mark({ v }: { v: string }) {
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

export default function Globe({ areas }: { areas: GlobeArea[] }) {
  const root = useRef<HTMLDivElement>(null), mapEl = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const figShare = useRef<HTMLElement>(null), figHa = useRef<HTMLElement>(null), passEl = useRef<HTMLDivElement>(null);
  const map = useRef<GlMap | null>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const cam = useRef<Cam>({ lng: 50, lat: -14, zoom: 1.5, pitch: 0, bearing: 0, x: 0, y: 0 });
  // What the handlers need without waiting for a render.
  const live = useRef({ mode: "load" as Mode, result: null as ClaimResult | null, first: null as ClaimResult | null, sweeping: false,
    paper: null as HTMLCanvasElement | null, paperFor: "", canvas: null as HTMLCanvasElement | null,
    lat: null as number | null }); // lat: the latitude the reveal was last drawn to, or null when there is no pass line
  const [mode, setModeState] = useState<Mode>("load");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const q = gsap.utils.selector(root);
  const { contextSafe } = useGSAP({ scope: root });

  const setMode = (m: Mode) => { live.current.mode = m; setModeState(m); };
  const data = (id: string, d: ReturnType<typeof lines>) => (map.current?.getSource(id) as GeoJSONSource | undefined)?.setData(d);
  const opacity = (id: string, on: boolean) => map.current?.setPaintProperty(id, "raster-opacity", on ? 1 : 0);
  const noPass = () => { live.current.lat = null; if (passEl.current) passEl.current.style.visibility = "hidden"; };

  function apply() {
    const m = map.current, c = cam.current, { W, H } = screen();
    m?.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing,
      padding: { left: Math.max(0, 2 * c.x - W), right: Math.max(0, W - 2 * c.x), top: Math.max(0, 2 * c.y - H), bottom: Math.max(0, H - 2 * c.y) } });
  }

  function lock(on: boolean) {
    const m = map.current;
    if (!m) return;
    for (const h of [m.dragPan, m.scrollZoom, m.touchZoomRotate, m.dragRotate, m.doubleClickZoom, m.keyboard, m.touchPitch]) {
      if (on) h.disable();
      else h.enable();
    }
  }

  // Point the overlays at an area and compose its radar image and new water once, small, for the moving reveal.
  async function prepare(a: GlobeArea) {
    const m = map.current, L = live.current;
    if (!m || L.paperFor === a.id) return;
    L.paperFor = a.id;
    L.paper = null;
    (m.getSource("radar") as ImageSource).updateImage({ url: a.radar.url, coordinates: corners(a.radar.bounds) });
    (m.getSource("water") as ImageSource).updateImage({ url: a.water.url, coordinates: corners(a.water.bounds) });
    (m.getSource("sweep") as CanvasSource).setCoordinates(corners(a.radar.bounds));
    const load = (url: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    try {
      const [hh, water] = await Promise.all([load(a.radar.url), load(a.water.url)]);
      if (L.paperFor !== a.id) return; // another area was asked for meanwhile
      const c = document.createElement("canvas");
      c.width = SWEEP_W;
      c.height = Math.round((SWEEP_W * hh.naturalHeight) / hh.naturalWidth);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(hh, 0, 0, c.width, c.height);
      ctx.drawImage(water, 0, 0, c.width, c.height);
      L.paper = c;
    } catch { /* the moving reveal then shows nothing; the full images still appear when it ends */ }
  }

  // The reveal up to a latitude: everything south of the line is shown, in step with the line.
  function sweepTo(a: GlobeArea, lat: number) {
    const L = live.current, cv = L.canvas;
    if (cv && L.paper) {
      if (cv.height !== L.paper.height) cv.height = L.paper.height;
      const [, s, , n] = a.radar.bounds, ctx = cv.getContext("2d")!;
      const y = Math.min(cv.height, Math.max(0, ((merc(n) - merc(lat)) / (merc(n) - merc(s))) * cv.height));
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (y < cv.height) ctx.drawImage(L.paper, 0, y, cv.width, cv.height - y, 0, y, cv.width, cv.height - y);
    }
    L.lat = lat; // the pass line is put there when the map next draws: see the "render" handler
  }

  function sweeping(on: boolean) {
    const s = map.current?.getSource("sweep") as CanvasSource | undefined;
    live.current.sweeping = on;
    opacity("sweep", on);
    if (on) s?.play();
    else s?.pause();
  }

  function count(t: number) {
    const n = live.current.result?.evidence?.numbers;
    if (!n || !figShare.current || !figHa.current) return;
    figShare.current.textContent = t < 1 ? `${Math.round((n.new_water_share ?? 0) * 100 * t)}%` : pct(n.new_water_share);
    figHa.current.textContent = `${t < 1 ? Math.round(n.new_water_ha * t).toLocaleString("en-GB") : showNumber("new_water_ha", n.new_water_ha)} ha`;
  }

  const TYPE = ".g-l1, .g-l2, .g-l3, .g-l4, .g-land, .g-word, .g-figs";

  // The end state for a result, set directly. The timeline animates towards exactly this, and Skip jumps to it.
  function place(r: ClaimResult) {
    const t = target(r, areas);
    Object.assign(cam.current, t.cam);
    apply();
    sweeping(false);
    noPass();
    const shown = !!(t.seen && t.area && t.place);
    if (shown) prepare(t.area!);
    opacity("radar", shown);
    opacity("water", shown);
    data("disk", shown ? ring(t.place!, 1) : NONE);
    data("areas", t.place ? NONE : lines(areas.map((a) => line([...corners(a.bounds), corners(a.bounds)[0]]))));
    gsap.set(q(TYPE), { autoAlpha: 0 });
    gsap.set(q(".g-solid, .g-form"), { autoAlpha: 1 });
    gsap.set(q(".g-card"), { autoAlpha: 1, y: 0 });
    setMode("free");
    lock(false);
    remember();
  }
  const settle = contextSafe((r: ClaimResult) => {
    tl.current?.kill();
    tl.current = null;
    place(r);
    gsap.set(q(".g-cover"), { autoAlpha: 0 });
  });

  // A click or a key during the intro: it stops where it is and the visitor has the globe and the input.
  const take = contextSafe(() => {
    tl.current?.kill();
    tl.current = null;
    if (live.current.sweeping) { opacity("radar", true); opacity("water", true); } // never leave the picture half revealed
    sweeping(false);
    noPass();
    gsap.set(q(TYPE), { autoAlpha: 0 });
    gsap.to(q(".g-solid, .g-form"), { autoAlpha: 1, duration: 0.3 });
    setMode("free");
    lock(false);
    remember();
  });

  // Free view with no claim: later visits start here.
  const goHome = contextSafe(() => {
    cam.current = home();
    apply();
    gsap.set(q(`${TYPE}, .g-card, .g-cover`), { autoAlpha: 0 });
    gsap.set(q(".g-solid, .g-form"), { autoAlpha: 1 });
    setMode("free");
    lock(false);
  });

  // One timeline from wherever the camera is to the verdict. The intro adds the two opening beats.
  const fly = contextSafe((r: ClaimResult, intro: boolean) => {
    if (!map.current) { setResult(r); gsap.set(q(".g-card"), { autoAlpha: 1 }); return; } // no map (no WebGL): the verdict still shows
    tl.current?.kill();
    const m = map.current, L = live.current, t = target(r, areas), c = cam.current;
    if (!intro) Object.assign(c, { lng: m.getCenter().lng, lat: m.getCenter().lat, zoom: m.getZoom(), pitch: m.getPitch(), bearing: m.getBearing() }); // the visitor may have moved it
    L.result = r;
    setResult(r);
    setMode(intro ? "intro" : "flight");
    if (intro) setText("");
    lock(true);
    sweeping(false);
    noPass();
    opacity("radar", false);
    opacity("water", false);
    data("disk", NONE);
    data("areas", NONE);
    if (t.area) prepare(t.area);
    gsap.set(q(`${TYPE}, .g-card, .g-form`), { autoAlpha: 0 });

    const time = gsap.timeline({ onComplete: () => settle(r) });
    tl.current = time;
    if (reduced()) { // no flight, no sweep, no count-up: a still, then the final view, each with a short cross-fade
      if (intro) {
        Object.assign(c, opening());
        apply();
        gsap.set(q(".g-solid"), { autoAlpha: 0 });
        time.to(q(".g-l1"), { autoAlpha: 1, duration: 0.3 }).to({}, { duration: 2.2 });
      }
      time.to(q(".g-cover"), { autoAlpha: 1, duration: 0.3 }).call(() => place(r)).to(q(".g-cover"), { autoAlpha: 0, duration: 0.3 });
      return;
    }

    const D = intro ? { dive: 4, tilt: 1.2, sweep: 3, hold: 2.5 } : { dive: 3.5, tilt: 1.1, sweep: 2.2, hold: 1.7 };
    let at = 0;
    if (intro) {
      Object.assign(c, opening());
      apply();
      gsap.set(q(".g-solid"), { autoAlpha: 0 });
      time.to(c, { ...overMozambique(), duration: 3.5, ease: "none", onUpdate: apply }, 0)
        .to(q(".g-l1"), { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0)
        .to(q(".g-l1"), { autoAlpha: 0, duration: 0.3 }, 1.2)
        .to(q(".g-l2"), { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 1.5)
        .to(q(".g-l2"), { autoAlpha: 0, duration: 0.3 }, 3.2);
      at = 3.5;
      // From the dive onwards the picture fills the screen, so the type moves onto a solid band.
      time.to(q(".g-solid"), { autoAlpha: 1, duration: 0.8 }, at)
        .to(q(".g-l3"), { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, at + 0.5)
        .to(q(".g-l3"), { autoAlpha: 0, duration: 0.3 }, at + D.dive - 0.3);
    } else {
      gsap.set(q(".g-solid"), { autoAlpha: 1 });
      time.to(q(".g-l4"), { autoAlpha: 1, duration: 0.4, ease: "power2.out" }, 0);
    }

    // The dive: one move, the tilt joining at the end. Longitude takes the short way round.
    const lng = c.lng + ((((t.cam.lng - c.lng) % 360) + 540) % 360) - 180;
    time.to(c, { lng, lat: t.cam.lat, zoom: t.cam.zoom, bearing: 0, x: t.cam.x, y: t.cam.y, duration: D.dive, ease: "power2.inOut", onUpdate: apply }, at)
      .to(c, { pitch: t.cam.pitch, duration: D.tilt, ease: "power2.out", onUpdate: apply }, at + D.dive - D.tilt);
    at += D.dive;

    if (t.seen && t.area && t.place) {
      // The sweep, south to north, as NISAR passed. Constant speed. Behind the line: the real image and the real new water.
      const a = t.area, p = t.place, sw = { t: 0 }, dk = { t: 0 }, view = { s: 0, n: 0 };
      if (intro) time.to(q(".g-l4"), { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, at);
      time.to(sw, {
        t: 1, duration: D.sweep, ease: "none",
        onStart: () => {
          const b = map.current!.getBounds();
          Object.assign(view, { s: b.getSouth(), n: b.getNorth() });
          sweepTo(a, view.s);
          sweeping(true);
        },
        onUpdate: () => sweepTo(a, view.s + (view.n - view.s) * sw.t),
        onComplete: () => { opacity("radar", true); opacity("water", true); noPass(); }, // only data stays on screen
      }, at);
      at += D.sweep;
      time.call(() => sweeping(false), [], at + 0.4); // once the full images have faded in over the moving copy
      time.to(dk, { t: 1, duration: 0.6, ease: "power1.inOut", onUpdate: () => data("disk", ring(p, dk.t)) }, at);
    } else if (!t.place) {
      time.call(() => data("areas", lines(areas.map((a) => line([...corners(a.bounds), corners(a.bounds)[0]])))), [], at);
    }

    // The verdict lands large, the two numbers count up to their exact values, then it settles into the card.
    const n = { t: 0 }, figures = !!(t.seen && r.evidence);
    time.to(q(".g-l4"), { autoAlpha: 0, duration: 0.3 }, at + 0.1)
      .set(q(".g-land"), { autoAlpha: 1 }, at + 0.4)
      .fromTo(q(".g-word"), { autoAlpha: 0, scale: 1.06 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "power3.out" }, at + 0.4);
    if (figures) {
      time.call(() => count(0), [], at + 0.4)
        .to(q(".g-figs"), { autoAlpha: 1, duration: 0.3 }, at + 0.7)
        .to(n, { t: 1, duration: 1.2, ease: "power1.out", onUpdate: () => count(n.t) }, at + 0.7);
    }
    const hold = figures ? D.hold : 1.3;
    time.to(q(".g-land"), { autoAlpha: 0, duration: 0.3 }, at + hold)
      .fromTo(q(".g-card"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, at + hold + 0.15)
      .to(q(".g-form"), { autoAlpha: 1, duration: 0.3 }, at + hold + 0.2);
  });

  useEffect(() => {
    let gone = false;
    const L = live.current;
    (async () => {
      const first = (L.first = await runCheck(PRESETS[0])); // the real checker; its model reply for this claim is recorded, so no network
      try {
        const { Map, setWorkerUrl } = await import("maplibre-gl");
        if (gone) return;
        // The library looks for its worker next to its own file, which the bundler has moved. Hand it the bundled copy.
        setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
        const m = new Map({ container: mapEl.current!, style: STYLE, attributionControl: false, interactive: true, maxZoom: 13, maxPitch: 60,
          pixelRatio: Math.min(devicePixelRatio, 1.5), zoom: opening().zoom, center: [opening().lng, opening().lat] });
        m.on("load", () => {
          if (gone) return;
          map.current = m;
          L.canvas = document.createElement("canvas");
          L.canvas.width = SWEEP_W;
          L.canvas.height = 800;
          m.addSource("sweep", { type: "canvas", canvas: L.canvas, coordinates: corners(areas[0].radar.bounds), animate: true });
          m.addSource("radar", { type: "image", url: BLANK, coordinates: corners(areas[0].radar.bounds) });
          m.addSource("water", { type: "image", url: BLANK, coordinates: corners(areas[0].water.bounds) });
          for (const id of ["sweep", "radar", "water"])
            m.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } }, "areas-casing");
          (m.getSource("sweep") as CanvasSource).pause();
          // The pass line is an element of the page, placed as the map draws, at the latitude the reveal was drawn to in
          // this same frame. So it sits exactly on the reveal's edge. (As map data it arrived a frame or two late.)
          m.on("render", () => {
            const el = passEl.current;
            if (!el || L.lat === null) return;
            el.style.transform = `translate3d(0, ${m.project([cam.current.lng, L.lat]).y}px, 0)`;
            el.style.visibility = "visible";
          });
          if (seenIntro()) goHome(); else fly(first, true);
        });
        m.on("error", (e) => console.warn("globe:", e.error?.message ?? e));
      } catch (e) { // no WebGL: the checker still works, with the card and no picture
        console.warn("globe: the map could not start", e);
        gsap.set(q(".g-solid, .g-form"), { autoAlpha: 1 });
        setMode("free");
      }
    })();

    // In development only: lets a test pause the timeline at a given second and read the camera.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __globe: { tl, map, cam } });

    const onInput = (e: Event) => {
      if (!tl.current?.isActive() || (e.target as Element | null)?.closest?.(".g-skip")) return;
      if (e instanceof KeyboardEvent && ["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return; // keep Skip reachable by keyboard
      if (L.mode === "intro") take();
      else if (L.mode === "flight" && e.type !== "wheel" && L.result) settle(L.result);
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    for (const ev of events) addEventListener(ev, onInput, { capture: true, passive: true });
    return () => {
      gone = true;
      for (const ev of events) removeEventListener(ev, onInput, { capture: true });
      tl.current?.kill();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once
  }, []);

  async function check(claim: string) {
    const t = claim.trim();
    if (!t || busy) return;
    setText(t);
    setBusy(true);
    const r = await checkClaim(t);
    setBusy(false);
    fly(r, false);
  }

  const openMap = contextSafe(() => {
    const go = () => { location.href = `/?claim=${encodeURIComponent(result?.claim ?? "")}`; };
    if (reduced() || !map.current) return go();
    lock(true);
    gsap.set(q(".g-cover"), { backgroundColor: "#fbfaf7" }); // the detailed map's page colour
    gsap.timeline({ onComplete: go })
      .to(cam.current, { pitch: 0, duration: 0.6, ease: "power2.inOut", onUpdate: apply }) // level out: the detailed map looks straight down
      .to(q(".g-cover"), { autoAlpha: 1, duration: 0.4 }, 0.3);
  });

  const another = contextSafe(() => {
    gsap.to(q(".g-card"), { autoAlpha: 0, duration: 0.2 });
    setText("");
    input.current?.focus();
  });

  const f = result?.fields, shown = result && f ? shownVerdict(result.verdict, f.polarity) : "";
  const cls = shown.replace(" ", "-"), label = shown.charAt(0).toUpperCase() + shown.slice(1);
  const nums = result && f?.place && shown !== "not observable" ? result.evidence?.numbers : undefined;
  const figures = nums && (
    <>
      <div><b>{pct(nums.new_water_share)}</b><span>of the area NISAR saw</span></div>
      <div><b>{showNumber("new_water_ha", nums.new_water_ha)} ha</b><span>newly under open water</span></div>
    </>
  );

  return (
    <div className="globe" ref={root} data-mode={mode}>
      <div className="g-map" ref={mapEl} />
      <div className="g-pass" ref={passEl} />
      <div className="g-solid g-topbg" />
      <div className="g-solid g-bandbg" />
      <div className="g-top">
        <b>ChangeProof</b>
        <a href="/">Open the checker</a>
        <button type="button" className="g-skip" onClick={() => (live.current.result ? settle(live.current.result) : take())}>Skip</button>
      </div>

      <div className="g-open">
        <p className="g-l1">17 January 2026.</p>
        <p className="g-l2">Southern Mozambique from space: cloud.</p>
      </div>

      <div className="g-band">
        <p className="g-l3">Radar sees through cloud.<br />NISAR passed at 03:42 UTC.</p>
        <p className={`g-l4${(result?.claim.length ?? 0) > 48 ? " long" : ""}`}>“{result?.claim}”</p>
        <div className="g-land">
          <div className="g-word"><Mark v={shown} />{label}</div>
          <div className="g-figs">
            <div><b ref={figShare} /><span>of the area NISAR saw</span></div>
            <div><b ref={figHa} /><span>newly under open water</span></div>
          </div>
        </div>
        <form className="g-form" onSubmit={(e) => { e.preventDefault(); check(text); }}>
          <input ref={input} aria-label="Claim" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a flood claim, e.g. Chókwè was flooded on 17 January" />
          <button type="submit" className="g-go" disabled={busy}>{busy ? "Checking" : "Check"}</button>
          <button type="button" className="g-link" onClick={() => live.current.first && fly(live.current.first, true)}>Replay intro</button>
          <div className="g-chips">
            {PRESETS.map((p) => <button key={p} type="button" disabled={busy} onClick={() => check(p)}>“{p}”</button>)}
          </div>
        </form>
      </div>

      <div className={`g-card result r-${cls}`} aria-live="polite">
        {result && (
          <>
            <p className="quote">“{result.claim}”</p>
            <p><span className={`verdict v-${cls}`}><Mark v={shown} />{label}</span></p>
            <p className="g-stamp">as of {result.as_of}, NISAR Beta data</p>
            <p className="tag">{meaningOf(result)}</p>
            {figures && <div className="g-two">{figures}</div>}
            <p className="headline">{result.headline}</p>
            <p>{result.reasons[0]}</p>
            <div className="actions">
              <button type="button" className="primary" onClick={openMap}>Open the detailed map</button>
              <button type="button" onClick={another}>Check another claim</button>
            </div>
          </>
        )}
      </div>

      <p className="g-credit">
        Cloud image: NASA VIIRS on Suomi NPP, 17 January 2026, early afternoon. Pale streaks are where one orbit meets the next. Radar: NISAR
        Beta data, NASA and ISRO, 17 January 2026, 03:42 UTC.
      </p>
      <div className="g-cover" />
    </div>
  );
}
