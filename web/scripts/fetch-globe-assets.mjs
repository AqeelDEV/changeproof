// Downloads, once, what the globe needs so that it runs with no third-party request:
//   - NASA GIBS tiles of the VIIRS true-colour image of 17 January 2026 -> public/globe/{z}/{y}/{x}.jpg
//     (the tile sets and their bounds are in app/globe/tiles.json, which Globe.tsx reads too)
//   - the three font families (Latin subset) and their licences -> public/fonts/
// Files already on disk are skipped.   node scripts/fetch-globe-assets.mjs
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2026-01-17/GoogleMapsCompatible_Level9";
const FONTS = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400&family=Atkinson+Hyperlegible+Next:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"; // asks for woff2

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      if (i >= tries) throw new Error(`${r.status} ${url}`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((res) => setTimeout(res, 1500 * i));
  }
}

async function save(url, file) {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await get(url));
  }
  return statSync(file).size;
}

// Every tile that touches the bounds, at each zoom of the set.
const col = (lon, n) => Math.min(n - 1, Math.max(0, Math.floor((lon + 180) / 360 * n)));
const row = (lat, n) => Math.min(n - 1, Math.max(0, Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n)));
const jobs = [];
for (const s of JSON.parse(readFileSync(join(web, "app/globe/tiles.json"), "utf8")))
  for (let z = s.minzoom; z <= s.maxzoom; z++) {
    const n = 2 ** z, [w, so, e, no] = s.bounds;
    for (let x = col(w, n); x <= col(e - 1e-9, n); x++)
      for (let y = row(no, n); y <= row(so + 1e-9, n); y++) jobs.push([`${GIBS}/${z}/${y}/${x}.jpg`, join(web, "public/globe", String(z), String(y), `${x}.jpg`)]);
  }
let bytes = 0;
for (let i = 0; i < jobs.length; i += 8) bytes += (await Promise.all(jobs.slice(i, i + 8).map(([u, f]) => save(u, f)))).reduce((a, b) => a + b, 0);
console.log(`tiles: ${jobs.length} files, ${(bytes / 1e6).toFixed(2)} MB`);
if (bytes > 5e6) throw new Error("tiles are over the 5 MB budget");

// Fonts: keep the Latin subset (it covers Portuguese), store the files, and write a stylesheet that points at them.
const css = (await get(FONTS)).toString("utf8");
let out = "/* Written by scripts/fetch-globe-assets.mjs. Fonts under the SIL Open Font Licence; see the OFL files here. */\n", fontBytes = 0;
for (const [, subset, block] of css.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face \{[^}]+\})/g)) {
  if (subset !== "latin") continue;
  const family = /font-family: '([^']+)'/.exec(block)[1], style = /font-style: (\w+)/.exec(block)[1], weight = /font-weight: ([\d ]+)/.exec(block)[1].trim();
  const url = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
  const name = `${family.toLowerCase().replace(/ /g, "-")}-${style}-${weight.replace(" ", "_")}.woff2`;
  fontBytes += await save(url, join(web, "public/fonts", name));
  out += block.replace(url, `/fonts/${name}`) + "\n";
}
writeFileSync(join(web, "public/fonts/fonts.css"), out);
for (const f of ["newsreader", "atkinsonhyperlegiblenext", "atkinsonhyperlegiblemono"])
  await save(`https://raw.githubusercontent.com/google/fonts/main/ofl/${f}/OFL.txt`, join(web, "public/fonts", `OFL-${f}.txt`));
console.log(`fonts: ${(fontBytes / 1e3).toFixed(0)} kB, stylesheet public/fonts/fonts.css`);
