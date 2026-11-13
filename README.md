# ChangeProof

ChangeProof checks a written flood claim against NISAR radar data and says what the data can and cannot support. It was built for NASA Space Apps 2026, challenge "Dancing with the SARs". The case is the January 2026 floods in southern Mozambique. Live site: https://changeproof-dusky.vercel.app. Code: https://github.com/AqeelDEV/changeproof.

You type a sentence, such as "The flood waters of the Limpopo river have engulfed the town of Chokwe". The app finds the place, the date and what is claimed. Fixed rules on measured numbers then give one of five verdicts, always "as of 17 Jan 2026, 03:42 UTC". All NISAR data here is Beta.

We do not claim a better flood map than Copernicus. Copernicus is our reference.

## Why

- **The free optical images we checked (Landsat 9, Sentinel-2 HLS, 17 to 20 Jan) were too cloudy to use.** Landsat 9 on 20 Jan 2026 was 95% cloud (scene metadata). Landsat on 19 Jan was 99.98 to 100% cloud, and Sentinel-2 on 17 Jan, four hours after NISAR, was 100% cloud. The 19 Jan Sentinel-2 image (HLS) shows thick cloud over our main area. Radar sees through cloud.
- **A map is not a verdict.** Copernicus and OPERA publish flood maps. A map does not tell a journalist whether a sentence is true, or whether the data could ever settle it. ChangeProof does that last step.
- **Claims spread faster than checks.** A fact-checker holding "Xai-Xai was under water on 25 Jan" needs to know that the Beta data on ascending track 114 ends on 17 Jan and that, as of 13 Nov 2026, the next pass in the catalogue is 22 June, so the data cannot say.

## What you can do in the app

- Slide between NISAR HH and HV images for 5 and 17 Jan 2026 (before and after).
- Switch on overlays: detected new water, the Copernicus observed flood, and a coverage map.
- Open the cloud card to see the optical images of 19 and 20 Jan, which were too cloudy to use.
- Read stats and limits for each of the three areas.
- Type a claim and get a verdict, with the reasons and the numbers behind it.
- Pick one of 11 published claims from news and UN reports.
- Export an evidence report with granule IDs, numbers and limits.
- Follow a five-step guided tour. Markers show 50 places.

## The verdicts

| Verdict | Meaning |
|---|---|
| Supported | The data shows it, inside the time and area covered: new open water was seen where a claim says there was a flood. |
| Not supported | NISAR saw no new open water at this place on its pass. That is not proof it stayed dry. |
| Contradicted | The data shows otherwise, inside the time and area covered: new open water was seen where a claim says there was no flood. |
| Not observable | The claim falls outside the time or area NISAR covered. |
| Not provable | Inside the time and area, but radar cannot settle it (for example "homes were destroyed"), or no new open water was seen where a claim says there was no flood: that fits the claim, but radar cannot prove a place stayed dry. |

"Not supported" and "Contradicted" are never returned for something outside the time or area window. Radar can show new open water, but not its absence under buildings, crops or trees, so a flood claim is never called false on silence. Map markers: "no new open water seen: a flood claim is not supported".

## Data used

NISAR data is Beta: ASF says it is [not fully calibrated](https://nisar-docs.asf.alaska.edu/products-overview/). See its [known issues](https://nisar-docs.asf.alaska.edu/product-known-issues).

- **NISAR GCOV Beta**, track 114, passes on 5 and 17 Jan 2026 (the latter at 03:42 UTC), processing X05010. HH and HV, 30 m in the app. Frames 165 and 166:
  - Frame 166 (AOI05):
    - `NISAR_L2_PR_GCOV_009_114_A_166_4005_DHDH_A_20260105T034252_20260105T034303_X05010_N_P_J_001`
    - `NISAR_L2_PR_GCOV_010_114_A_166_4005_DHDH_A_20260117T034253_20260117T034303_X05010_N_P_J_001`
  - Frame 165 (AOI06 and AOI01):
    - `NISAR_L2_PR_GCOV_009_114_A_165_4005_DHDH_A_20260105T034232_20260105T034253_X05010_N_P_J_001`
    - `NISAR_L2_PR_GCOV_010_114_A_165_4005_DHDH_A_20260117T034232_20260117T034254_X05010_N_P_J_001`
  - Source: [ASF](https://nisar-docs.asf.alaska.edu/gcov/) and the [NISAR Cookbook](https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/).
- **Copernicus EMS, activation EMSR857.** The `observedEventA` layers only, never the modelled headline figures. [Activation](https://mapping.emergency.copernicus.eu/activations/EMSR857/) and [news](https://mapping.emergency.copernicus.eu/news/flood-in-mozambique-emsr857/).
  - AOI05 and AOI06: Sentinel-1, 17 Jan, 03:18 and 03:19 UTC.
  - AOI01: COSMO-SkyMed Second Generation, 18 Jan (87,857.6 ha observed), scored only where it agrees with the first estimate from Sentinel-1 on 16 Jan (20,126.9 ha observed).
- **OPERA DSWx-S1** for 5 and 17 Jan, for water before the flood. [OPERA products](https://www.jpl.nasa.gov/go/opera/products/). OPERA has no NISAR water product for January 2026.
- **JRC Global Surface Water**, for permanent water and land with no water on record.
- **HLS (Sentinel-2) and OPERA DSWx-HLS**, 19 Jan, for the optical check. [NASA CMR](https://cmr.earthdata.nasa.gov/search/granules.json?short_name=HLSS30&version=2.0&bounding_box=32.7,-25.2,33.7,-24.4&temporal=2026-01-14T00:00:00Z,2026-01-30T23:59:59Z).
- **Landsat 9**, 20 Jan, as cloud proof. [USGS STAC](https://landsatlook.usgs.gov/stac-server).
- **OpenStreetMap**, for place names and building points. Data: OpenStreetMap contributors, ODbL.

## Method in brief

1. The pipeline reads each area from the NISAR files, converts HH and HV to dB at 30 m and removes each area's median over land with no water on record (JRC 0%), so that Beta calibration differences between dates matter less.
2. Water is open water on 17 Jan that was not water on 5 Jan and is not permanent water.
3. Two detectors were compared: a tuned threshold rule and LightGBM on 14 radar features. Both were tuned on AOI06 only, with spatial blocks of 3 km, not random pixels.
4. AOI05 is a different frame and a different river. It was scored once. The rule scored 0.521 and LightGBM 0.572, so LightGBM is used, and both numbers are shown.
5. A fix to the land median (version 2) was found later, on AOI01. We kept it and scored AOI05 once more. That rerun is labelled as not a clean test.
6. Everything is precomputed. The app reads cached files. Only the claim parser runs live.

## Results

Agreement with Copernicus, not accuracy. The reference is a Copernicus map, not ground truth.

| Area | What it is | Agreement (IoU) | Precision | Recall | New water (ha) | Mapped buildings in it |
|---|---|---|---|---|---|---|
| AOI05 Chinhangane | Held-out test area, frame 166 | 0.574 for the current model, with one clean test: 0.572 beside it. The tuned rule scored 0.521. | 0.706 | 0.755 | 15,263 | 15 of 11,349 |
| AOI06 Palmeira | Training area, frame 165 | 0.577, in-sample (0.570 out of fold) | 0.757 | 0.709 | 11,524 | 5 of 18,515 |
| AOI01 Chókwè to Xai-Xai | Frame 165, labels from two maps that agree | 0.835, a diagnostic | 0.879 | 0.944 | 75,951 | 824 of 346,003 |

- AOI05's 0.572 is the one clean test. 0.574 is the rerun after the land-median fix, so it is not a clean test.
- AOI01 is a diagnostic because the land-median problem was found on this area. The same model scored 0.718 there before the fix, and the tuned rule scores 0.833.
- On AOI01, about 44% of the new water (33,787 ha of 75,951 ha) lies outside both Copernicus maps, with no independent check. A further 10% (7,802 ha) is covered only by the 18 Jan map.
- Buildings: the count can be too high or too low, and says nothing about damage.
- Observed Copernicus area for AOI05 is 9,702.9 ha, AOI06 14,064.9 ha.

## Claim checker

- A rule-based parser splits a sentence into place, date and type. An optional language model that only fills fields can help. It never decides a verdict.
- A gate checks the date and the place against the NISAR coverage. Fixed rules on the measured numbers then pick the verdict:
  - Observable: NISAR data on 50% or more of the area around the place (3 km for a town, 1 km for a village).
  - Wet: new open water on 10% or more of the pixels with data, and 10 ha or more.
  - Dry: open ground on 50% or more, new open water on 1% or less of it.
  - If the parser and the model disagree, the verdict is not provable.
- 50 places (from OpenStreetMap) are on the list. A place not on the list is not observable.

Tests:

- 77 rule checks pass (`web/lib/claims/tests/rules.ts`).
- 45 test claims were frozen before the first run. With the parser alone, 42 of 45 verdicts are right (clean 28 of 30, messy 14 of 15). The three misses are one disagreement at Palmeira: NISAR shows 1.14% of the area newly under open water, Copernicus 0.72% of the open ground. The thresholds were not changed to fix them.
- The first run (a clean test) got 41 of 45. Fixes after it brought it to 42 of 45, which is not a clean test.
- 11 published claims from news and UN reports were run and never used to tune anything: 1 supported, 5 not observable, 5 not provable.

## Limits

- **Beta data.** Not fully calibrated. We use relative change and per-area normalisation.
- **The Beta data on ascending track 114 ends on 17 Jan 2026, 03:42 UTC.** The flood kept rising after that, and Copernicus saw a larger flood on AOI01 on 20 Jan (127,755.1 ha). Every verdict is "as of" 17 Jan. NASA's catalogue, as of 13 Nov 2026, lists no NISAR pass on ascending track 114 between 17 Jan and 22 Jun 2026 (the next pass is 22 June), and no pass covering any of the three areas from 21 Jan to 17 Jun. A descending pass on 20 Jan covers part of AOI05 but is not used, so 17 Jan is the only flood-time look here.
- **Open water only.** Flooded trees and crops, and flooded buildings, can look bright in radar and are missed. Pixels where HH rose by more than 3 dB are not scored.
- **Buildings.** The count can be too high or too low, and says nothing about damage.
- **Some new water may not be flood.** On AOI01, part of the water in field grids near Xai-Xai may be irrigation. 13,174 ha (17%) of AOI01's new water was already dark on 5 Jan.
- **AOI06 coverage.** 35% of its grid has no NISAR data on at least one date.
- **One event, one track.** Whether it carries over to other floods is unproven.
- **Place list.** Hamlets, rivers and places outside the three areas are not observable. One verdict per claim, and a claim with several parts gets the verdict of its non-flood part.

## How to run

Web app (Node.js):

```
npm --prefix web ci
npm --prefix web run build
npm --prefix web run start
```

Optional language model for the claim parser (set before `start`):

```
LLM_BASE_URL=...  LLM_MODEL=...  LLM_API_KEY=...
```

Without them the rule-based parser runs alone.

Tests:

```
node web/lib/claims/tests/rules.ts
node web/lib/claims/tests/run.ts
```

Pipeline (Python 3.12; the cached outputs are already in `web/public/data/`, so this is only needed to rebuild them):

```
pip install -r requirements.txt
set EARTHDATA_TOKEN=...        (an Earthdata Login bearer token)
python pipeline/fetch_all.py
python pipeline/make_outputs.py
```

`fetch_all.py` needs the token for NISAR, OPERA and HLS. Raw data goes to `data/`, which is not committed.

## Repo layout

| Path | Holds |
|---|---|
| `pipeline/` | Python: NISAR crop, grids, masks, LightGBM, metrics, PNG and WebP overlays, stats |
| `web/` | Next.js app (TypeScript, Leaflet). Reads `web/public/data/` |
| `web/lib/claims/` | Claim parser, verdict rules, evidence report, tests |
| `web/public/data/` | Cached outputs: one folder per area, `areas.json`, `places.json` |
| `docs/` | `DATA_CONTRACT.md` (the only link between pipeline and app), pitch and submission text |
| `research/` | Review and notes |
| `PROGRESS.md`, `PROJECT_BRIEF.md` | Results log and brief |

## Licence and credits

Code: MIT, see `LICENSE`. Copyright 2026 Aqeel Jameel.

Data credits:

- NISAR data: NASA and ISRO, distributed by the Alaska Satellite Facility (ASF). Beta release.
- Copernicus Emergency Management Service (EMSR857) and ESA Sentinel-1. COSMO-SkyMed Second Generation data (the AOI01 map of 18 Jan) are from ASI via Copernicus EMS.
- OPERA DSWx-S1 and DSWx-HLS (NASA JPL), HLS (NASA and USGS), Landsat (USGS).
- JRC Global Surface Water (European Commission Joint Research Centre).
- OpenStreetMap contributors, ODbL.
- Cloud image on the globe (`/globe`): VIIRS Corrected Reflectance (True Colour), Suomi NPP, 17 January 2026. We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS). The tiles are bundled in `web/public/globe/` by `web/scripts/fetch-globe-assets.mjs`, so the globe makes no third-party request.

Software and fonts:

- MapLibre GL JS (BSD-3-Clause) draws the globe; Leaflet (BSD-2-Clause) draws the detailed map.
- GSAP runs the globe's timeline. It is free to use under [GSAP's own standard licence](https://gsap.com/community/standard-license/), which is not an open-source licence. It is installed from npm and is not copied into this repository.
- Fonts: Newsreader, Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, under the SIL Open Font Licence 1.1. The licence texts are in `web/public/fonts/`.
