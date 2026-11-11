# Progress

Updated Wednesday 11 November 2026. Submission is Saturday 14 November, 12:00 GST.

## Start here tomorrow

Where things stand:
- All the data is downloaded.
- AOI05 has a flood rule tuned on AOI06 and tested once on AOI05: IoU 0.521 against Copernicus.
- Its app files exist, but they still follow data contract 1.0.

1. **Bring the AOI05 overlays up to contract 1.1.** In `export()` in `pipeline/baseline_aoi05.py`:
   - Use a grey stretch of -25 to 0 dB.
   - Write the HH/HV images as WebP at half resolution, quality 80.
   - Set `schema_version` to "1.1" and allow `webp` in `check_contract`.
   - Delete the four old grey PNGs in `web/public/data/aoi05/`, then run `python pipeline\baseline_aoi05.py`.
   - Check the file sizes, and that 17 Jan is no longer washed out.
2. **Look at the two frame 165 check images.** `data/aoi06/check_aoi06.png` and `data/aoi01/check_aoi01.png` have not been inspected yet.
3. **Start the git repo**, with `data/` ignored. This is still not done.
4. **Carry on with "Next steps" from step 4**: run the tuned rule on AOI01 (Chókwè to Xai-Xai), then build the web app.

Keep in mind: AOI05 has been used as the test once, so tune only on AOI06.

## Done

- **Plan reviewed.** `research/CHANGEPROOF-REVIEW.md` has the fixes, scope and timetable. Its correction matters: Copernicus headline areas are modelled, so we use the observed layer.
- **Data test passed.** `pipeline/prep_aoi05.py` read the AOI05 crop from the NISAR GCOV Beta files for 5 and 17 Jan 2026 (track 114, frame 166, processing X05010 on both). `data/aoi05` now holds:
  - HH and HV in dB for both dates, 30 m, EPSG:32736, 1771 x 1522 pixels, aligned.
  - The Copernicus EMSR857 label: 1 flooded, 0 not flooded, 255 outside the mapped area.
- **Numbers from the test.**
  - Copernicus observed flood area for AOI05: 9,702.9 ha (the modelled headline of 14,324.8 ha is not used).
  - Median HH inside the flood area fell from -12.1 dB on 5 Jan to -15.9 dB on 17 Jan, a drop of 3.8 dB. Open water shows up as expected.
  - A quick threshold preview agreed only moderately with Copernicus: IoU about 0.47 to 0.50.
- **Project files.** `PROJECT_BRIEF.md` and `docs/DATA_CONTRACT.md`.
- **Data fetch, complete.** `pipeline/fetch_all.py` finished on 11 Nov with all 19 items OK. HLS needed one rerun after a 502 from LP DAAC.
  - Downloaded: frame 165 crops for AOI06 and AOI01, labels, DSWx-S1 for 5 and 17 Jan, HLS and DSWx-HLS for 19 Jan, JRC, OSM buildings and the Landsat previews.
  - DSWx-S1 covers only 32% of the AOI01 grid, because the Sentinel-1 swath misses most of it.
- **AOI05 baselines.** `pipeline/baseline_aoi05.py`, results in `data/aoi05/stats_baseline.json`, map in `data/aoi05/disagreement_baseline.png`.
  - Thresholds come from reference water and land on each date, never from the label.
  - Background shift: +3.2 dB on 17 Jan.
  - Permanent water is JRC occurrence of 50% or more. The Copernicus layer leaves it out too.
- **First AOI05 run.** Reference water was JRC 90% or more alone. Threshold IoU 0.428 (precision 0.728, recall 0.510); change rule IoU 0.424.
  - 43% of the Copernicus flood was not dark on 17 Jan, mostly along flood edges, and a quarter of that was brighter than -8 dB.
  - The change rule added nothing.
- **Reference water revised.**
  - What changed: reference water is now JRC 90% or more, or DSWx-S1 5 Jan open water, one pixel in from the edge, and at least 100 ha.
  - Why: AOI06 had only 2 ha of JRC water, so its thresholds were fitted on 22 pixels.
  - AOI05 scores played no part in the change.
  - New AOI05 thresholds: -16.0 dB on 5 Jan, -15.3 dB on 17 Jan.
- **Tuned on AOI06, tested once on AOI05.** `pipeline/tune_aoi06.py` tried 80 rules on AOI06 (frame 165, Copernicus AOI06 from Sentinel-1 at 03:19 UTC on 17 Jan). It wrote the best one to `data/aoi06/tuned_rule.json`.
  - The chosen rule: a 3x3 median filter on dB; the 17 Jan threshold plus 1 dB; before-flood water from DSWx-S1 only (NISAR's own 5 Jan darkness removed); no drop requirement.
  - The rule beat the fixed one in each of AOI06's three strips that contain flood.

  | Rule | AOI06 IoU (train) | AOI05 IoU (test) | AOI05 precision | AOI05 recall | NISAR flood (ha) | Both (ha) | NISAR only (ha) | Copernicus only (ha) |
  |---|---|---|---|---|---|---|---|---|
  | Threshold, fixed | 0.462 | 0.407 | 0.726 | 0.481 | 6,367 | 4,620 | 1,746 | 4,994 |
  | Change, fixed (also fell by more than 3 dB) | 0.454 | 0.406 | 0.726 | 0.479 | 6,351 | 4,610 | 1,741 | 5,005 |
  | Tuned on AOI06 | 0.558 | **0.521** | 0.765 | 0.620 | 7,785 | 5,957 | 1,827 | 3,657 |

  - AOI05 scored area: 62,970 ha, holding 9,614 ha of Copernicus observed flood.
  - Not scored: 0.6% unclear (HH rose) and 0.5% edge buffer.
  - The tuned rule carries over to a different frame and river, losing only 0.04 IoU between train and test.
  - Most of what it still misses is the south-east branch of AOI05.

AOI05 has now been used as the test once. Further tuning must stay on AOI06, or the AOI05 number stops being a fair test.

Not done or not checked: the pixel quality of the Beta scenes beyond this test, any web code, any claim code.

## Next steps, in order

1. Start the git repo (data/ ignored) so the public repo exists from the start.
2. Done: the Copernicus layer leaves out permanent water, and the baseline does too (JRC plus DSWx-S1 for 5 Jan).
3. Done: baseline for AOI05.
   - Rules, AOI06 tuning and the AOI05 test are finished (see above).
   - `baseline_aoi05.py` writes the contract outputs for the tuned rule:
     - `water_new`, `change_hh` and `coverage` GeoTIFFs in `data/aoi05`.
     - Seven EPSG:4326 PNG overlays, `stats.json` and `areas.json` in `web/public/data`.
   - Checked: water_new covers 11,528 ha, the same as `flooded_ha` in stats.json, and the overlays line up with the label.
   - Decided on 11 Nov (data contract 1.1), not yet applied to the files:
     - The grey stretch becomes -25 to 0 dB. At -5 dB, 17 Jan land was almost all white (its median is -5.4 dB).
     - The grey HH/HV overlays become WebP at half resolution, quality 80. They were PNGs of 3.3 to 3.8 MB each.
4. Generalise the script for other areas, then run it on frame 165 (AOI06 and Chókwè).
5. LightGBM, three hours at most. Keep it only if it beats the baseline on a held-out frame. Report the comparison either way.
6. Next.js app: map, before/after slider, overlays, coverage map. Reads `web/public/data` only.
7. `claims/`: parser, time and area gate, verdict rules, evidence report. Write the 30 test claims before tuning. Check the full path on the deployed URL.
8. Buildings lower bound, cloud panel, 19 Jan optical check, five-date strip, panel on why water is dark. Feature freeze after this.
9. Run the 30-claim test, README with limits, backup video, slides.
10. Rehearse, submit, and check every link while logged out.
