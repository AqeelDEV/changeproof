# ChangeProof: project brief

ChangeProof checks a written flood claim against NISAR radar data and says what the data can and cannot support.

## Problem

Flood claims spread faster than they can be checked, and optical satellites were blind to this flood. Landsat scenes on 19 and 20 Jan 2026 were 95 to 100% cloud, and Sentinel-2 on 17 Jan, four hours after NISAR, was 100% cloud. Radar sees through cloud. Copernicus and OPERA already publish flood maps, but a map does not tell anyone whether a sentence is true, or whether the data could ever settle it. We do not claim a better flood map. Copernicus is our reference.

## User

A journalist, fact-checker or aid analyst holding a sentence about the flood, such as "Xai-Xai was under water on 25 Jan" or "homes were destroyed".

## How it works

1. **Pipeline (offline).** Reads the area from NISAR GCOV Beta files, converts HH and HV to dB at 30 m, detects new water between two dates, compares it with Copernicus and writes rasters, PNG overlays and one stats file per area (see `docs/DATA_CONTRACT.md`).
2. **Web app.** Map, before/after slider, overlays, coverage map and cloud panel. Reads cached files only.
3. **Claims (live).** The parser only splits a claim into parts (place, time, what is claimed). A gate checks the time and area against the stats file. Fixed rules on the computed numbers then pick the verdict. The evidence report lists granule IDs, numbers and limits.

| Verdict | Meaning |
|---|---|
| Supported | The data shows it, inside the time and area covered |
| Contradicted | The data shows otherwise, inside the time and area covered |
| Not observable | The claim falls outside the time or area NISAR covered |
| Not provable | Inside the time and area, but radar cannot settle it (for example "homes destroyed") |

Never return "contradicted" for something outside the time or area window.

## Demo case

Floods in southern Mozambique, January 2026, area AOI05 (Chinhangane). NISAR GCOV Beta, track 114, frame 166, passes on 5 and 17 Jan (the latter at 03:42 UTC). Reference: Copernicus EMSR857 delineation from Sentinel-1 at 03:18 UTC on 17 Jan, 24 minutes earlier, with 9,702.9 ha of observed flood. The last public NISAR pass on this track is 17 Jan, so every verdict is "as of" that time.

## Scope

**Must:** AOI05 precomputed with a threshold water map and change map; Copernicus overlay with agreement numbers; coverage map; claim parser with the time and area gate and four verdicts; before/after slider; report export with granule IDs and limits; cloud panel; public repo; backup video.

**Should:** frame 165 for Chókwè; LightGBM against the threshold baseline, kept only if it wins on a held-out frame; OSM buildings as a lower bound; 19 Jan optical check; five-date strip; one panel on why water is dark and flooded trees are bright; 30 hand-labelled test claims, frozen before tuning.

**Could:** Beta against Provisional comparison; flooded-vegetation class; Portuguese output.

## Folders

| Folder | Holds | Reads | Writes |
|---|---|---|---|
| `pipeline/` | Python: NISAR crop, grids, masks, metrics, PNGs, stats | Earthdata, Copernicus | `data/<area>/`, `web/public/data/<area>/` |
| `web/` | Next.js app | `web/public/data/`, `claims/` | nothing |
| `claims/` | Claim parser, verdict rules, evidence report | stats files only | nothing |
| `data/` | Large rasters and raw downloads, not committed | | |
| `docs/`, `research/` | Contract; review and notes | | |

The data contract is the only link between `pipeline/` and the rest. Change the contract first, then the output.

## Rules

- Outputs are precomputed. The live app reads cached files. Only the claim parser runs live.
- Every verdict states "as of 17 Jan 2026, 03:42 UTC" and uses one of the four outcomes above.
- Quote observed Copernicus areas, never the modelled headline figures.
- Say "agreement with Copernicus", never "accuracy". Label every output as Beta data.
- Never mention AI tools in code, comments, docs or commits. No co-author lines in commits.
- British English, no em dashes.
