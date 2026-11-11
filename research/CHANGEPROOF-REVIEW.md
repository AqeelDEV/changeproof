# ChangeProof: hostile review and fixes

Checked on 11 November 2026. Catalogue facts were checked live against the ASF, Copernicus EMS, USGS and NASA CMR APIs. No NISAR science file was opened, because that needs an Earthdata login.

**Correction, 11 November (evening):** Copernicus's headline "flooded area" figures are its modelled extent (`modelledEventA`). The observed layer (`observedEventA`), which is the one to use as a label, is smaller. The figures below now give observed areas, measured from the layer files, and say where a figure is the modelled headline.

ChangeProof is defensible as a claim-audit tool, but not yet as a flood mapper. Three things would sink it today: the last NISAR image is from before the flood peak, the chosen frame misses the towns the claims are about, and the validation plan is too vague to survive questions.

One piece of luck: Copernicus built two EMSR857 maps from a Sentinel-1 pass 24 minutes before the NISAR pass. The label date gap can be close to zero.

## 1. Top weaknesses, ranked

1. **Time mismatch will produce wrong verdicts.** The last public NISAR image on this track is 17 Jan 03:42 UTC, and the next is 22 June. [JBA](https://www.jbarisk.com/knowledge-hub/event-response/floods-in-southern-africa-january-2026/) puts the peak in southern Mozambique around 20 Jan. Copernicus's observed flood layer on the Chókwè to Xai-Xai reach grows from 87,858 ha (18 Jan) to 127,755 ha (20 Jan).
   - **Fix:** gate every claim on time and area before any verdict. Use four outcomes: supported as of 17 Jan 03:42 UTC, contradicted as of that time, not observable (outside time or area), not provable from this data. Never return "contradicted" for something outside the window.

2. **Frame 166 misses the story.** It covers Massingir and the Elefantes river. Chókwè, Macia and Xai-Xai are in frame 165, and [NASA's own close-ups](https://svs.gsfc.nasa.gov/5661) are of Chókwè and Macia. Only Copernicus AOI05 (Chinhangane, rural) and the tiny AOI12 fall inside frame 166.
   - **Fix:** keep frame 166 with AOI05 for validation, because it has the cleanest label. Add frame 165 (same track, dates and polarisations) for the story, the buildings and a cross-frame test.

3. **"Labels from EMSR857" is not a plan.** Most of its 43 products date from 18 to 27 Jan. Products also carry modelled-flood and maximum-extent layers. A random pixel split would leak through spatial autocorrelation.
   - **Fix:** see section 3.

4. **The ML may add nothing.** LightGBM trained on a map made by thresholding another radar will mostly learn that threshold.
   - **Fix:** fix the rule in advance. Ship ML only if it beats the baseline on a held-out frame. Otherwise ship the threshold and show the comparison. Either result is a valid answer to the judge.

5. **Beta data.** ASF says Beta products are "not fully calibrated" ([product overview](https://nisar-docs.asf.alaska.edu/products-overview/)). The [known issues](https://nisar-docs.asf.alaska.edu/product-known-issues) hit dark areas hardest, which is where water is: along-track streaks, interference in cross-pol, banding, edge artefacts and about 5 m geolocation error at 40 MHz.
   - **Fix:** use per-scene thresholds and before/after differences, not absolute values. Use the same processing ID on both dates (X05010, true for 5 and 17 Jan). Average 3x3 to 30 m, buffer away from frame edges, and print "Beta" on screen and in the report.

6. **Copernicus and OPERA already mapped this flood.** See section 4. Do not pitch a better flood map.

7. **The building count is the weakest inference.** OSM is incomplete in rural Mozambique. A 10 to 30 m pixel is bigger than a house. Flooded built-up areas look bright in radar, not dark, so open-water detection misses them.
   - **Fix:** call it "mapped buildings inside detected open water, a lower bound". Show Copernicus's own figure beside it. In AOI05 that is 0.7 ha of residential area affected on 17 Jan, rising to 19.8 ha on 19 Jan. These are Copernicus statistics and may be based on its modelled extent, so say so.

8. **Landsat is not an independent check at flood time.** Every Landsat scene on 19 and 20 Jan is 95 to 100% cloud.
   - **Fix:** use Landsat as the cloud proof. For a real optical check use the Sentinel-2 HLS tile T36JWT on 19 Jan (6% cloud, full coverage) or its OPERA DSWx-HLS product.

9. **Six pipeline stages, one person, 30 hours.**
   - **Fix:** precompute everything. The live app reads cached rasters and JSON. Only the claim parser runs live.

10. **Challenge fit.** The [brief](https://hackathlone.com/challenges/dancing-with-the-sars) asks for visualisation, time series, polarisation insight, physical drivers and open source. A verdict box alone under-delivers.
    - **Fix:** add a before/after slider, a five-date strip, one panel on why water is dark and flooded trees are bright, and a public repo.

## 2. Fact and data check

| Claim | Verdict | Correction | Source |
|---|---|---|---|
| GCOV pair 5 and 17 Jan, track 114, frame 166, Beta | True | 2.35 GB and 2.18 GB, HH+HV, 40+5 MHz (10 m posting), both X05010 | [ASF search API](https://api.daac.asf.alaska.edu/services/search/param?dataset=NISAR&processingLevel=GCOV&bbox=31.5,-26.0,34.5,-23.0&start=2025-10-01T00:00:00Z&end=2026-06-30T23:59:59Z&maxResults=400&output=geojson), [GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/) |
| Frame 166 covers the flood | Partly | Covers Massingir and Chinhangane, not Chókwè, Macia or Xai-Xai | ASF footprints, [NASA SVS 5661](https://svs.gsfc.nasa.gov/5661) |
| Only two dates exist | False | Both frames have 30 Nov, 12 Dec, 24 Dec, 5 Jan, 17 Jan. Frame 166 uses X05009 on the two December dates | ASF search API |
| EMSR857 is this flood | True | "Flood in Mozambique and South Africa", activated 17 Jan 07:38 UTC, 17 AOIs, 43 products | [EMS API](https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?code=EMSR857) |
| NISAR and Copernicus labels have a date gap | Mostly avoidable | AOI05 and AOI06 delineations use Sentinel-1 at 03:18 to 03:19 UTC on 17 Jan. NISAR passed at 03:42 | EMS API |
| Copernicus flooded-area figures are observations | False | The headline figure is the modelled extent. AOI05: 9,702.9 ha observed against 14,324.8 ha headline | EMS layer files (`observedEventA`, `modelledEventA`) |
| Landsat gives an independent optical check | False at flood time | 19 Jan: 99.98 to 100% cloud. 20 Jan: 95 to 96%. First usable: 27 and 28 Jan (33 to 38%). First clean: 5 Feb (8%) | [USGS STAC](https://landsatlook.usgs.gov/stac-server) |
| Radar sees through cloud | True, and provable | Sentinel-2 on 17 Jan 08:06 UTC, four hours after NISAR, was 100% cloud | [NASA CMR](https://cmr.earthdata.nasa.gov/search/granules.json?short_name=HLSS30&version=2.0&bounding_box=32.7,-25.2,33.7,-24.4&temporal=2026-01-14T00:00:00Z,2026-01-30T23:59:59Z) |
| OPERA has a NISAR water product for January | False | No DSWx-NI collection in CMR on 11 Nov. OPERA lists it for June 2026, with its record starting at the NISAR validated record. Validated products cover 21 Oct 2026 onwards | [OPERA products](https://www.jpl.nasa.gov/go/opera/products/), [ASF](https://nisar-docs.asf.alaska.edu/products-overview/) |
| OPERA has nothing for this flood | False | DSWx-S1 and RTC-S1 exist for 5 and 17 Jan at 03:18 UTC | [CMR DSWx-S1](https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C2949811996-POCLOUD&bounding_box=32.4,-25.6,33.8,-23.8&temporal=2026-01-03T00:00:00Z,2026-01-30T23:59:59Z) |
| NISAR projects are favoured | Unverified | The official guide lists five criteria: impact, creativity, validity, relevance, presentation. No NISAR bonus | [Judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide) |

**Unsure:** the EMS API gives the event time as 10 Jan, but its summary text says 15 Jan. NASA's page gives impact figures without a source, and other sources differ, so attribute any figure quoted.

### Best data

- **NISAR, validation:** frame 166, 5 and 17 Jan, cropped to AOI05 (lon 32.13 to 32.63, lat -24.20 to -23.81).
  - `NISAR_L2_PR_GCOV_009_114_A_166_4005_DHDH_A_20260105T034252_20260105T034303_X05010_N_P_J_001.h5`
  - `NISAR_L2_PR_GCOV_010_114_A_166_4005_DHDH_A_20260117T034253_20260117T034303_X05010_N_P_J_001.h5`
- **NISAR, story:** frame 165, same dates (about 4.0 and 4.2 GB), cropped around Chókwè and around AOI06. Only 67% of the AOI06 product sits inside the frame.
  - `NISAR_L2_PR_GCOV_009_114_A_165_4005_DHDH_A_20260105T034232_20260105T034253_X05010_N_P_J_001.h5`
  - `NISAR_L2_PR_GCOV_010_114_A_165_4005_DHDH_A_20260117T034232_20260117T034254_X05010_N_P_J_001.h5`
- **Copernicus labels:** AOI05 and AOI06 delineation products, `observedEventA` layer only. The GeoJSON is public, for example [AOI05](https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR857/AOI05/DEL_PRODUCT/EMSR857_AOI05_DEL_PRODUCT_observedEventA_v1.json). Observed-layer areas: 9,702.9 ha (AOI05) and 14,064.9 ha (AOI06). The headline figures (14,324.8 and 22,687.7 ha) are modelled.
- **NASA reference:** OPERA DSWx-S1 for 5 and 17 Jan. It includes permanent water, which is needed for the "before" state.
- **Optical:** Landsat 9 `LC09_L2SP_167077_20260120` (95% cloud) as the cloud proof. HLS S30 T36JWT on 19 Jan as the real check (OPERA granule `OPERA_L3_DSWx-HLS_T36JWT_20260119T073231Z_20260121T014517Z_S2C_30_v1.1`). `LC09_L2SP_168077_20251226` (24% cloud) as pre-flood.

### Copernicus products inside the NISAR frames

| AOI | Product | Sensor and time (UTC) | Observed (ha) | Headline, modelled (ha) | Inside frame |
|---|---|---|---:|---:|---|
| AOI05 Chinhangane | Delineation | Sentinel-1, 17 Jan 03:18 | 9,702.9 | 14,324.8 | 166: 100% |
| AOI05 Chinhangane | Monitoring 1 | COSMO-SkyMed SG, 19 Jan 15:13 | 7,523.6 | 13,289.5 | 166: 100% |
| AOI06 Palmeira | Delineation | Sentinel-1, 17 Jan 03:19 | 14,064.9 | 22,687.7 | 165: 67% |
| AOI06 Palmeira | Monitoring 1 | COSMO-SkyMed SG, 18 Jan 14:55 | 20,914.3 | 29,307.8 | 165: 67% |
| AOI01 Chibabel | Delineation | COSMO-SkyMed SG, 18 Jan 14:55 | 87,857.6 | 113,524.2 | 165: 100% |
| AOI01 Chibabel | Monitoring 1 | COSMO-SkyMed SG, 20 Jan 03:56 | 127,755.1 | 154,048.1 | 165: 100% |
| AOI01 Chibabel | Monitoring 2 | COSMO-SkyMed SG, 23 Jan 14:49 | not measured | 125,470.6 | 165: 100% |
| AOI01 Chibabel | Monitoring 3 | Sentinel-1, 24 Jan 03:10 | not measured | 119,514.7 | 165: 100% |
| AOI01 Chibabel | Monitoring 4 | ICEYE, 25 Jan 10:49 | not measured | 111,198.1 | 165: 100% |

Observed areas are the sum of the `area` field in each `observedEventA` layer. Headline figures are the "Flooded area" statistic from the EMS API, which equals the `modelledEventA` layer.

The AOI01 mapped extent grew slightly after the first product, and sensors differ between rows, so the AOI01 figures are not strictly like for like.

### Subsetting GCOV without full downloads

Follow the [NISAR Cookbook recipe](https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/):

1. Create an Earthdata bearer token.
2. Open the `.h5` URL over HTTPS with `fsspec`, 8 MB blocks.
3. Load the group `/science/LSAR/GCOV/grids/frequencyA` with `xarray.open_datatree(engine="h5netcdf")`.
4. Crop with `rio.clip_box` and save a GeoTIFF.

HTTPS streaming works from anywhere but is slower. Direct S3 only works inside AWS us-west-2, so running the crop there is the fast route. Values are linear gamma-0 power, so convert to dB. Whether the files use a cloud-optimised layout was not confirmed, so streaming speed is unknown until tried.

## 3. ML validation plan

1. **Labels, same morning.**
   - After: Copernicus `observedEventA` for AOI05 and AOI06.
   - Before, and permanent water: OPERA DSWx-S1 for 5 Jan.
   - Check whether the Copernicus layer includes the normal river channel. If not, add permanent water from DSWx-S1, or the detector is punished for finding the river.
2. **Target.** Open water per date. Flood means water on 17 Jan and not on 5 Jan. Pixels where HH rises sharply are possible flooded vegetation: mark them "unclear" in the coverage map, not dry.
3. **Features.** HH and HV in dB, their difference, the change between dates, and local mean and spread, all at 30 m.
4. **Baseline.** A per-scene threshold on HH, plus the same change rule.
5. **Split.** Train on AOI06 (frame 165) using spatial blocks. Test once on AOI05 (frame 166), a different frame and river. No random pixel splits.
6. **Hygiene.** Drop a two-pixel band around label edges, frame edges and invalid pixels.
7. **Metrics.** IoU, precision, recall, and detected hectares against the observed-layer area. Report them separately for open land and wetland, because C-band and L-band differ over flooded vegetation. Call it "agreement with Copernicus", never "accuracy".
8. **Claim parser.** Thirty hand-labelled claims, frozen before tuning. Include uncheckable and out-of-window ones.

### Handling the date gap

- **Avoid it:** use the two same-morning products.
- **Where a gap remains** (AOI01, Chókwè to Xai-Xai, labelled 35 hours later): keep only pixels that agree in the products before and after (16 Jan 16:22 and 18 Jan 14:55). Exclude the rest and report the excluded share.
- **Show why it matters:** Copernicus's observed AOI06 area grew from 14,064.9 to 20,914.3 ha in 36 hours, a 49% change. The two maps use different radars, so part of that may be sensor difference. A score against a later label is a lower bound, not an error rate.

## 4. "Why not just use Copernicus or OPERA?"

"For this flood you should, and we do. They are our reference. Copernicus is on demand: it was activated on 17 Jan, a week into the event, and covers only the areas requested. OPERA has no NISAR water product for January 2026. Neither answers a claim; they publish maps, and someone still has to work out what a sentence about the flood can and cannot say. ChangeProof does that last step and adds NISAR's L-band as a second, independent radar look. We do not claim our map is better than theirs."

## 5. Scope and plan

**Must**
- Frame 166 and AOI05 precomputed, with a threshold water and change map.
- Copernicus overlay with agreement numbers.
- Coverage map.
- Claim parser with the time and area gate and four verdicts.
- Before/after slider.
- Report export listing granule IDs and limits.
- Cloud panel.
- Public repo and a backup video.

**Should**
- Frame 165 for Chókwè.
- LightGBM against the baseline with the cross-frame test.
- OSM buildings as a lower bound.
- The 19 Jan optical check.
- The five-date strip.
- The 30-claim test.

**Could**
- A Beta against Provisional comparison (track 42 has both for 12 Jan).
- A flooded-vegetation class.
- Portuguese output.

| Hours | Suggested slot (GST) | Work | Checkpoint |
|---|---|---|---|
| 0 to 2 | Wed evening | Token; stream a 20 km HH and HV crop of AOI05 for both dates | **Go:** two aligned GeoTIFFs. **No-go:** run in us-west-2 or start full downloads |
| 2 to 4 | Wed evening | Copernicus GeoJSON and DSWx-S1 onto the same 30 m grid; overlay | **Go:** flood polygons sit on dark HH. **No-go at hour 4:** fallback B |
| 4 to 8 | Thu morning | dB, masks, threshold baseline, change map, agreement metrics | **Go:** baseline numbers exist |
| 8 to 10 | Thu afternoon | Same script on frame 165 (AOI06 and Chókwè crops) | |
| 10 to 13 | Thu afternoon | LightGBM, strictly three hours | **Decide:** keep ML only if it wins on AOI05 |
| 13 to 16 | Thu evening | Next.js map, slider, layers | |
| 16 to 20 | Fri morning | Claim parser, gate, verdict rules, report export | **Go:** full path works on the deployed URL. **No-go:** cut buildings, optical, strip |
| 20 to 24 | Fri afternoon | Buildings, cloud panel, optical check, five-date strip | Feature freeze at hour 24 |
| 24 to 27 | Fri evening | Claim test, README limits, backup video, three slides | |
| 27 to 30 | Sat 08:00 to 11:00 | Rehearse five times, submit, check links logged out | One hour of buffer to 12:00 |

## 6. Demo script (3 minutes)

- **0:00** "In January floods hit southern Mozambique. This is what optical satellites saw." Show the 100% cloud scene. "This is what NISAR saw."
- **0:20** Paste a claim with three parts. The parser tags them: checkable, not provable, not observable.
- **0:50** Slide from 5 Jan to 17 Jan. Show new water in hectares, the Copernicus outline from a different radar 24 minutes earlier, the agreement figure and the coverage map.
- **1:30** Second claim, about Xai-Xai on 25 Jan. Verdict: not observable, NISAR's last pass was 17 Jan. "Homes destroyed": not provable, with the building lower bound.
- **2:00** Validation slide: baseline against ML on the held-out frame, and the Beta caveat.
- **2:30** Export the evidence report.
- **2:50** "ChangeProof does not replace Copernicus or OPERA. It turns their evidence and NISAR's into a sentence you can defend, and says so when it cannot."

### Top 10 judge questions

1. **Why not Copernicus or OPERA?** Use the section 4 answer.
2. **Beta data is uncalibrated.** "Yes. We use relative change, per-scene thresholds, matched processing, and label every output as Beta."
3. **What is your ground truth?** "None. We report agreement with a Copernicus analyst-checked map from Sentinel-1, 24 minutes earlier."
4. **Does ML beat a threshold?** Give the real numbers, whichever way they fall.
5. **How did you prevent leakage?** "Spatial blocks, and the test area is a different frame and river."
6. **Why do you disagree with Copernicus in places?** "L-band and C-band see flooded vegetation differently, and smooth dry soil is dark at L-band."
7. **Can you say homes were destroyed?** "No. Only how many mapped buildings sit in detected water, as a lower bound."
8. **Was 5 Jan really 'before'?** "Rain began in December, so we show five dates from 30 Nov and the OPERA water map for 5 Jan."
9. **Can the LLM invent a verdict?** "No. It only splits the claim. Verdicts come from fixed rules on computed numbers."
10. **Does it generalise?** "Unproven. One event. Validated NISAR data began in October 2026, and OPERA's NISAR water product can replace our detector."

## 7. Fallback if NISAR fails

- **A. Streaming fails, login works.** Download the two frame 166 files (4.5 GB in total), or run the same code inside us-west-2.
- **B. Files unreadable, or water areas visibly corrupted, by hour 4.** Run the same detector on OPERA RTC-S1 for 5 and 17 Jan, and show NISAR browse images for context. Say plainly that the numbers are Sentinel-1. Relevance drops, and browse image access was not tested.
- **C. Nothing radar works by Thursday midday.** Switch to TrendProof Climate, as `SPACE-APPS-2026-DECISION.md` says.

## Sources

- [ASF NISAR product overview](https://nisar-docs.asf.alaska.edu/products-overview/)
- [Beta known issues](https://nisar-docs.asf.alaska.edu/product-known-issues)
- [Provisional known issues](https://nisar-docs.asf.alaska.edu/provisional-known-issues/)
- [GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/)
- [NISAR Cookbook: search, stream, subset](https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/)
- [NASA SVS 5661](https://svs.gsfc.nasa.gov/5661)
- [Copernicus EMSR857](https://mapping.emergency.copernicus.eu/activations/EMSR857/) and [EMSR857 news](https://mapping.emergency.copernicus.eu/news/flood-in-mozambique-emsr857/)
- [OPERA products](https://www.jpl.nasa.gov/go/opera/products/)
- [JBA event response](https://www.jbarisk.com/knowledge-hub/event-response/floods-in-southern-africa-january-2026/)
- [Space Apps judging guide](https://www.spaceappschallenge.org/resources/judging-awards-guide)
- [Challenge text, organiser copy](https://hackathlone.com/challenges/dancing-with-the-sars)

## Not checked

- Any authenticated NISAR read, and the pixel quality of the Beta scenes.
- The contents of the Copernicus zip packages (only the public GeoJSON header was read).
- OSM building coverage in these areas.
- River gauge data: none was found, so the peak date rests on JBA and the Copernicus area figures.

The biggest risk is hour 0 to 2: if the crop does not open cleanly, everything after it moves.
