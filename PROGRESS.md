# Progress

Updated Thursday 12 November 2026, after the overnight run, the AOI01 checks, the land-median fix and the limits wording. Submission is Saturday 14 November, 12:00 GST.

## Start here tomorrow

Where things stand:
- LightGBM is the method for all three areas, now as v2. The only change from v1: the land median is taken over all valid pixels with JRC 0% occurrence.
- **AOI05 headline, worded as in its `stats.json`: IoU 0.574 for the current model (v2), with "one clean test: 0.572" beside it.**
  - 0.572 is v1, scored once on AOI05 before the fix: the one clean test.
  - 0.574 is v2's post-fix rerun, which is not a clean test.
  - The tuned rule scored 0.521.
- **AOI01 totals, before you quote them.** v2 finds 75,951 ha of new water with 824 OSM buildings in it; the tuned rule finds 76,198 ha with 682. Of the 24,457 ha that v2 added over v1, 55% is outside the Copernicus maps, so nothing checks it. Of v2's whole 75,951 ha, 55% (41,589 ha) lies outside the area both Copernicus maps cover, and AOI01's limits say it has no independent check yet. See "AOI01 totals, checked before quoting" and "limits wording".
- AOI01: v2 scores 0.835 against its reference. That is a diagnostic only, because the problem was found there. The published v1 figure was 0.718 and the rule scores 0.833. AOI01's `stats.json` gives all three.
- Contract 1.1 outputs for all three areas were regenerated with v2, and `web/public/data/areas.json` lists all three.

1. **Irrigation: the caveat is now narrowed to the Xai-Xai fields.** The field grids north-west of Xai-Xai hold 2,622 ha of new water (23 buildings), and about 525 ha of it was already dark on 5 Jan. AOI01's limits say that part of it may be irrigation. The field grid downstream of Chókwè holds 7,799 ha (81 buildings), and the limits say the evidence leans towards flood water, not confirmed. HLS 19 Jan is all cloud, so it could not settle either. To settle it you would need a clear optical image from early to mid January, or a map of the irrigation schemes. See "Field-shaped water in AOI01" below.
2. **Delete the four old grey PNGs** in `web/public/data/aoi05/` (`hh_20260105.png`, `hh_20260117.png`, `hv_20260105.png`, `hv_20260117.png`) once the web app uses the WebP files. They are kept for now because the app may still load them, but `stats.json` no longer lists them.
3. **Check the web app reads the new files.** It needs to handle three things:
   - `areas.json` with three areas.
   - The optional building fields in `results` (see `docs/DATA_CONTRACT.md`, 12 Nov addition).
   - AOI06, where 35% of the grid has no NISAR data.
4. **`pipeline/__pycache__` is tracked in git.** Add `__pycache__/` to `.gitignore` and untrack it. It was outside tonight's folders, so it is not done.
5. **Carry on with "Next steps" from step 6**: web app, then claims.

Keep in mind:
- AOI05 has now been scored three times: the rule (11 Nov), LightGBM v1 (12 Nov, the clean test) and LightGBM v2 (12 Nov, the post-fix rerun, labelled as such). Do not tune anything else on AOI05.
- AOI01 can no longer check the land-median definition independently.

## Done, 12 Nov: limits wording (no method or number changes)

- **Where.** The edits are in `pipeline/make_outputs.py`, so reruns keep them. I reran it for all three areas.
- **Nothing but limits text changed.**
  - In the three `stats.json` files, only `limits` and the `generated_utc` timestamp differ. Every other key is equal, including `results` and `agreement`.
  - The SHA-256 of every other file in `web/public/data/` is unchanged. So are the `water_new`, `change_hh`, `coverage` and AOI01 `label_agree` GeoTIFFs in `data/`.
  - `check_contract` passes on all three areas.
- **1. Buildings, all three areas.** "This is a lower bound" is gone. The sentence now says the count can be too high or too low, and gives a reason for each:
  - Too low: OSM is incomplete, and flooded built-up areas look bright in radar, so open-water detection misses them.
  - Too high: a 30 m pixel is larger than a house, so a building beside water can fall on a water pixel, and some detected water may not be flood.
  - AOI01 adds "about 680 to 820 mapped buildings in detected water, depending on method". The script works this out from the tuned rule's 682 and LightGBM's 824, rounded to the nearest 10.
  - `osm_buildings_in_new_water` stays 15, 5 and 824.
- **2. Irrigation caveat, AOI01.** It now covers the Xai-Xai field grids only: 2,622 ha of new water (23 buildings), about 525 ha of it already dark on 5 Jan. For the Chókwè grid (7,799 ha, 81 buildings) the limits say the evidence leans towards flood water held in the fields, and that this is not confirmed.
  - The two reasons given for Chókwè come from `check_fields_aoi01.json`: where the 18 Jan map covers it, 52% of the water is called flooded and 5% dry (43% is unmapped), and JRC saw water at 2% of it.
  - The 525 ha and the hectares are worked out in the script, not typed in. "Most" and "almost never" are typed in, and were checked against that JSON.
- **3. AOI01, new water outside the Copernicus maps.**
  - **55% (54.8%) of v2's 75,951 ha of new water, 41,589 ha, lies outside the area that both the 16 and 18 Jan maps cover.** The limits now say it has no independent check yet.
  - It is the same as the table's "Outside one or both Copernicus maps" row (41,589 ha). Of that 41,589 ha, 33,787 ha (44.5% of the total) is outside both maps. The other 7,802 ha is inside the 18 Jan map only.
  - Not the same as the earlier 55% (13,507 of the 24,457 ha that v2 added over v1). It is a different share that rounds the same.
  - Pixels where the maps disagree are a separate 22% (16,848 ha) and are not in this figure.
- **Not changed (outside the folders I was asked to touch).** `docs/DATA_CONTRACT.md` (lines 11 and 152) and `PROJECT_BRIEF.md` (line 36) still say "lower bound" for buildings. AOI01's first limit also still calls the agreement figure "a lower bound". That is about agreement, not buildings, so I left it.

## Done, 12 Nov: AOI01 totals, checked before quoting (no outputs changed)

- **Script:** `pipeline/check_aoi01.py`, rerun after its edit, with a new part 4.
  - It rebuilds v1 (the v1 model, the v1 land median, threshold 0.37) and asserts that this reproduces the published v1 figures: IoU 0.7179, 51,494 ha and 313 buildings.
  - It asserts that v2 matches the published `water_new` and building count. Every assert passed.
  - It rewrote `data/aoi01/check_aoi01.json` (replacing the v1-era file; the v1 results are in "AOI01 checks" below) and `disagreement_aoi01.png`, which now shows v2.
- **Code changes, with no output changes.**
  - `make_outputs.py` gains `pixels()`, which places points on the grid; `count_in()` now uses it.
  - `check_fields_aoi01.py` also reports the dark-on-5-Jan hectares.
  - Nothing in `web/public/data/` changed.

### 1. Where v2's extra 24,457 ha and 511 buildings are

- **The zones overlap, so the table has two layers.**
  - The Copernicus zones split the valid pixels with no overlap: every pixel is in exactly one.
  - Each zone is then split into where DSWx-S1 has data and the JRC-fallback area, where DSWx-S1 is missing and JRC 4% or more stands for water before the flood.
  - The JRC-fallback area overlaps every Copernicus zone, so it is a column, not a row.
- **One extra zone.** I added the edge buffer and unclear pixels inside the agreed area, which you didn't list, so that the zones cover every pixel.
- **Rounding.** Hectares are rounded so the parts add up to the totals exactly.

| Zone | v1 (ha) | v2 (ha) | Added (ha) | Added, DSWx-S1 present | Added, JRC-fallback area | Buildings, v1 to v2 | Added buildings | DSWx-S1 present | JRC-fallback area |
|---|---|---|---|---|---|---|---|---|---|
| Scored area | 4,812 | 6,503 | 1,691 | 980 | 711 | 3 to 8 | 5 | 3 | 2 |
| Flooded on 16 Jan only | 601 | 935 | 334 | 224 | 110 | 76 to 195 | 119 | 119 | 0 |
| Flooded on 18 Jan only | 10,057 | 15,913 | 5,856 | 1,154 | 4,702 | 50 to 170 | 120 | 35 | 85 |
| Outside one or both Copernicus maps | 28,082 | 41,589 | 13,507 | 10,710 | 2,797 | 48 to 128 | 80 | 77 | 3 |
| Edge buffer or unclear, inside the agreed area | 7,942 | 11,011 | 3,069 | 1,664 | 1,405 | 136 to 323 | 187 | 166 | 21 |
| **Total** | **51,494** | **75,951** | **24,457** | 14,732 | 9,725 | **313 to 824** | **511** | 400 | 111 |

- **Almost all of it is gained, not swapped.** The net 24,457 ha is 24,518 ha gained less 61 ha dropped.
- **Little of it is checked.**
  - 13,507 ha (55%) is outside the Copernicus maps, so nothing checks it.
  - 5,856 ha (24%) is flooded on 18 Jan only. The later map agrees with it, but it is not scored.
  - Only 1,691 ha (7%) is in the scored area.
- **The JRC-fallback area** holds 9,725 ha (40%) of the added area and 111 of the added buildings.
- **Buildings.**
  - 187 of the 511 sit in the edge buffer and unclear pixels, and 119 in the "flooded on 16 Jan only" zone. That zone holds 195 buildings in only 935 ha of v2 water, so it is densely built.
  - Only 5 sit in the scored area.

### 2. The rule beside v2 on AOI01

| Method | New water (ha) | OSM buildings in it |
|---|---|---|
| Tuned rule | 76,198 | 682 |
| LightGBM v2 (published) | 75,951 | 824 |
| LightGBM v1 (12 Nov, replaced) | 51,494 | 313 |

The area is almost the same, but v2 has 142 more buildings in its water.

### 3. v2 on AOI01 against the agreement label (a diagnostic)

| Method | IoU | Precision | Recall | Found (ha) | Extra (ha) | Missed (ha) |
|---|---|---|---|---|---|---|
| LightGBM v2 | 0.835 | 0.879 | 0.944 | 5,715 | 788 | 342 |
| Tuned rule | 0.833 | 0.871 | 0.951 | 5,758 | 857 | 299 |
| LightGBM v1 | 0.718 | 0.944 | 0.750 | 4,542 | 270 | 1,515 |

- **Misses.** v2 misses 158 ha of core flood and 184 ha of edge. v1 missed 922 ha and 592 ha.
- **Threshold.** v2's best threshold on AOI01 would be 0.42, giving IoU 0.836 (in-sample), close to the 0.36 it uses. Under v1 the best was 0.14, so the fix removed the probability shift.
- **Other diagnostics from the rerun (in-sample).** With AOI06's land median, v2 would score 0.817 on AOI01. With the v1 land median, it would score 0.737.

### 4. Already dark on 5 Jan, inside each field outline

| Area | v2 new water (ha) | Already dark on 5 Jan |
|---|---|---|
| Field grid downstream of Chókwè | 7,799 | 716 ha (9%) |
| Field grids north-west of Xai-Xai | 2,622 | 525 ha (20%) |
| Rest of AOI01 | 65,530 | 11,933 ha (18%) |
| All of AOI01 | 75,951 | 13,174 ha (17%) |

The Chókwè grid has half the share of the rest of AOI01. The Xai-Xai grids are about the same as the rest.

### 5. Why the v1 land share is 30% here and 32% before

- **32% is DSWx-S1's coverage:** the AOI01 pixels where DSWx-S1 has any value on 5 Jan, 32.1% of the grid. Every AOI01 pixel has NISAR data, so this is also 32.1% of valid pixels.
- **30% is v1's land.** It also needed DSWx-S1 "not water" and JRC 0%, which removes:
  - 1.0% where DSWx-S1 shows water (codes 1 and 3);
  - 0.7% where DSWx-S1 shows no water but JRC is above 0% or has no value;
  - 0.0% masked by DSWx-S1 (codes 250 and 251).
  That leaves 30.3%.
- **Both figures were right; they measure different things.** Earlier wording such as "the land median comes only from the 32% where DSWx-S1 has data" was loose: the land itself was 30%.

## Done, 12 Nov: land-median fix (LightGBM v2) and the AOI01 field check

You asked for this: adopt the all-JRC-0% land median for all three areas, with full disclosure. You also decided, before the AOI05 rerun: the fix stays whatever the number is, and the method choice is reopened only if LightGBM drops below the rule's 0.521.

### 1. Land median under both definitions (no labels)

- v1 land: valid NISAR pixels with JRC 0% and DSWx-S1 "not water" on 5 Jan.
- v2 land: valid NISAR pixels with JRC 0%.

| Area | Land, v1 to v2 (share of valid pixels) | Shift, HH 5 Jan (dB) | HH 17 Jan | HV 5 Jan | HV 17 Jan |
|---|---|---|---|---|---|
| AOI05 | 97.6% to 97.9% | -0.006 | -0.007 | -0.006 | -0.007 |
| AOI06 | 88.6% to 92.0% | -0.021 | -0.090 | -0.057 | -0.107 |
| AOI01 | 30.3% to 93.2% | +1.116 | +1.240 | +1.222 | +1.611 |

- **AOI05 moves by under 0.01 dB.**
- v2 offsets in dB (HH 5 Jan, HH 17 Jan, HV 5 Jan, HV 17 Jan):
  - AOI05: -8.534, -5.309, -15.596, -13.430.
  - AOI06: -10.427, -7.483, -18.241, -16.231.
  - AOI01: -11.055, -7.907, -17.900, -15.583.

### 2. Re-tuned on AOI06 (same grid, same spatial blocks)

- **Code.** Only `offsets()` in `pipeline/lgbm_aoi06.py` changed. The features, grid, blocks, rounds and threshold search are as before, and the docstring records the revision.
- **Files.** `data/aoi06/lgbm_model_v2.txt` and `lgbm_rule_v2.json`. The v1 files (`lgbm_model.txt`, `lgbm_rule.json`) are kept unchanged.
- **Chosen settings.** num_leaves 15, min_data_in_leaf 50, threshold 0.36. v1 had 15, 500 and 0.37.
- **Pooled out-of-fold IoU 0.5700** (precision 0.749, recall 0.704), the same as v1's 0.5700. All nine settings scored between 0.5691 and 0.5700, so the choice among them hardly matters.
- **Per fold**, LightGBM v2 against the tuned rule (the rule's scores are in-sample):

  | Fold | 0 | 1 | 2 | 3 | 4 |
  |---|---|---|---|---|---|
  | LightGBM v2 | 0.516 | 0.543 | 0.597 | 0.618 | 0.587 |
  | LightGBM v1 | 0.518 | 0.542 | 0.595 | 0.617 | 0.588 |
  | Tuned rule | 0.503 | 0.523 | 0.593 | 0.610 | 0.577 |

- **Final model on AOI06, in-sample:** IoU 0.5773. Importance: hh1 64%, hh1_mean 27%, no other feature above 3%.

### 3. AOI05 post-fix rerun

- **The run.** `python pipeline\lgbm_aoi06.py --rerun` wrote `data/aoi05/test_lgbm_v2.json`. The file is labelled "post-fix rerun" and states the decision rule fixed before scoring. The script refuses to run again.
- **The clean test is untouched.** `data/aoi05/test_lgbm_vs_rule.json` was not changed, and `--test` still refuses to run.
- **Result:** IoU 0.5741, precision 0.7055, recall 0.7551. The v1 clean test gave 0.5716, 0.7111 and 0.7445. The rerun is above the rule's 0.521, so the method choice is not reopened.
- **Headline wording, matching AOI05's `stats.json`:** 0.574 for the current model, with "one clean test: 0.572" beside it.
  - `stats.json` carries 0.574 as its agreement figure. Its limits say this comes from the post-fix rerun and that 0.572 is the one clean test.
  - `method.parameters.aoi05_test` holds both scores, with the rerun's label and note.
  - `make_outputs.py` stops if a rerun file ever says the choice is reopened.

### 4. AOI01: a diagnostic, not a test score

- **Scores against the agreement label:**
  - v2: IoU 0.835 (precision 0.879, recall 0.944).
  - Published v1: 0.718 (0.944, 0.750).
  - Tuned rule: 0.833.
- AOI01's `stats.json` limits give all three, and call 0.835 a diagnostic because the land-median problem was found on this area. `method.parameters` holds `lightgbm_v1_iou_this_area` (0.7179) and `tuned_rule_iou_this_area` (0.8328).

### 5. Before and after, per area

| Area | IoU, v1 to v2 | New water, whole grid (ha) | In mapped area (ha) | OSM buildings in new water | Already dark on 5 Jan |
|---|---|---|---|---|---|
| AOI05 | 0.572 to 0.574 (post-fix rerun) | 14,917 to 15,263 | 10,106 to 10,333 | 12 to 15, of 11,349 | 707 ha (5%) to 738 ha (5%) |
| AOI06 | 0.577 to 0.577 (in-sample) | 11,408 to 11,524 | 8,348 to 8,433 | 5 to 5, of 18,515 | 715 ha (6%) to 714 ha (6%) |
| AOI01 | 0.718 to 0.835 (diagnostic) | 51,494 to 75,951 | 12,754 to 17,514 | 313 to 824, of 346,003 | 9,050 ha (18%) to 13,174 ha (17%) |

- **What moved.** AOI05 and AOI06 barely change. AOI01's new water rises by 47%, to about the rule's 76,198 ha, and its buildings in new water more than double.
- **Files changed in `web/public/data/`:** the three `stats.json` and the three `water_new.png`. The grey WebP files, `label.png`, `coverage.png` and `areas.json` came out identical.
- **Checks passed:**
  - `check_contract` on all three areas, and coverage sums to 1.
  - `flooded_ha` matches `water_new_30m.tif`.
  - Building counts are within the grid totals.
  - Every listed file exists, and each WebP is under 1 MB.

### 6. Field-shaped water in AOI01

- **Script:** `pipeline/check_fields_aoi01.py`. It writes `data/aoi01/check_fields_aoi01.json` and `check_fields_aoi01.png`. The outlines live in `make_outputs.FIELDS_AOI01`, so the limits text and the check use the same ones.
- **Outlines.** Drawn by eye on the 17 Jan HH image, along visible field boundaries and canals. The edges are good to about 1 km.
  - South-west bank downstream of Chókwè: one polygon, 43,450 ha, roughly 32.95 to 33.31° E and 24.55 to 24.74° S.
  - North-west of Xai-Xai: two rectangles, one either side of the river, 13,068 ha together, roughly 33.55 to 33.70° E and 24.90 to 25.02° S.
- **HLS 19 Jan cannot show the ground.** Wherever it covers AOI01, it shows thick cloud:
  - The median reflectance is 0.79 in blue and red, 0.81 in NIR and 0.14 in SWIR, and the image has no ground features.
  - OPERA DSWx-HLS labels 99.7% of it snow/ice and 0.3% cloud. Snow is impossible here, so this is cloud.
  - Its Fmask flags only 0.2% as cloud, so Fmask missed the cloud.
  - The tile also misses 23% of AOI01, mainly the western 16 km.
- **Results, for v2 new water:**

  | Field area | New water (ha) | Share of AOI01 new water | OSM buildings in it | 18 Jan map: flooded / dry / unmapped | 16 Jan map: flooded / dry / unmapped | JRC saw water there before | Dark on 5 Jan |
  |---|---|---|---|---|---|---|---|
  | Downstream of Chókwè | 7,799 | 10% | 81 (10% of 824) | 52% / 5% / 43% | 2% / 3% / 94% | 2% | 9% |
  | North-west of Xai-Xai | 2,622 | 3% | 23 (3%) | 74% / 26% / 0% | 9% / 77% / 14% | 23% | 20% |

  Together: 10,421 ha (14% of AOI01's new water) and 104 buildings (13%).
- **Downstream of Chókwè: leans towards flood.**
  - The water fills plots between canals, so it is field-shaped.
  - But where the 18 Jan COSMO-SkyMed map covers it, it calls ten times as much flooded as dry (52% against 5%).
  - JRC has almost never seen water there (2%).
  - That leans towards flood water held in the fields, not routine irrigation. Not settled.
- **North-west of Xai-Xai: mixed.**
  - In the eastern block, JRC has seen water in many plots, plot by plot. That looks like fields that are flooded from time to time, for example for rice.
  - DSWx-S1 has no data here, so plots with JRC 4% or more already count as water before the flood and are excluded. Of the new water that remains, 23% has JRC 1 to 3%.
  - The 16 Jan Sentinel-1 map calls 77% of this water dry, and the 18 Jan map calls 74% flooded. Either the flood arrived after 16 Jan, or one map is wrong.
  - Part of it may well be irrigation.
- **Limits text.** AOI01's `stats.json` first said the figures may include irrigation, gave each area's hectares and buildings, and said HLS could not settle it. That was narrowed later on 12 Nov: see "Done, 12 Nov: limits wording" above.
- **Not done.** I didn't look for another optical image: Sentinel-2 or Landsat from early to mid January might show the fields. I also didn't use a mapped irrigation-scheme boundary.

### Other changes

- **`pipeline/check_aoi01.py`:** a docstring note that it was written for v1, and one key renamed. It was not rerun, so its v1 outputs in `data/aoi01/` are kept.

## Done, 12 Nov: AOI01 checks (no outputs changed)

- **Script:** `pipeline/check_aoi01.py`.
  - It reads the data and the published files. It asserts that it reproduces the agreement label, the published `water_new`, and both IoUs in `stats.json`.
  - It writes `data/aoi01/check_aoi01.json` (every number below, plus all 14 features) and `data/aoi01/disagreement_aoi01.png`.
  - `data/` is not in git, so the image and JSON stay local, like the AOI05 figure. Nothing in `web/public/data/` changed.
- **Small refactor:** the disagreement-map colours and codes in `baseline_aoi05.py` moved into `DISAGREE_COLOURS`, `DISAGREE_NAMES` and `disagreement_codes()`, so both figures share them. The AOI01 figure uses them; `baseline_aoi05.py` itself was not rerun.

### 1. Both methods on AOI01, and where LightGBM's errors sit

Against the agreement label, inside the scored area, which holds 6,057 ha of agreed flood:

| Method | IoU | Precision | Recall | Found (ha) | Extra (ha) | Missed (ha) |
|---|---|---|---|---|---|---|
| Tuned rule | 0.833 | 0.871 | 0.951 | 5,758 | 857 | 299 |
| LightGBM | 0.718 | 0.944 | 0.750 | 4,542 | 270 | 1,515 |

- **LightGBM's errors are missed flood, not extra water.** It adds only 270 ha where both maps say dry, against 857 ha for the rule.
- **The misses include the core of the flood.** Core means agreed flood at least 90 m (3 pixels) from any other pixel.
  - LightGBM misses 922 ha of the 3,918 ha core (24%) and 592 ha of the 2,139 ha edge (28%).
  - The rule misses 139 ha of core and 160 ha of edge.
- **Why the pixels are missed.**
  - 186 ha are removed by the post-masks (water on 5 Jan, permanent water). These are the same pixels for both methods.
  - The other 1,328 ha fall below LightGBM's threshold of 0.37. The rule finds 1,230 ha of them, while LightGBM finds only 14 ha of flood that the rule misses.
- **They are near misses.**
  - The missed pixels have a median probability of 0.22, and 820 ha are above 0.185 (half the threshold).
  - Their 17 Jan HH is clearly dark: a median of 7.4 dB below the land median. Flood that LightGBM does find sits 9.7 dB below it, and agreed dry land 0.9 dB above it.
- **Outside the scored area LightGBM also finds less water than the rule, not more:**

  | Zone (valid pixels) | Size (ha) | Rule water (ha) | LightGBM water (ha) |
  |---|---|---|---|
  | Flooded on 18 Jan only | 53,269 | 15,988 | 10,057 |
  | Flooded on 16 Jan only | 2,537 | 873 | 601 |
  | Outside one or both maps | 642,801 | 42,193 | 28,082 |
  | Edge buffer or unclear, inside the agreed area | 42,216 | 10,530 | 7,942 |

- **Unchecked water in the image.** West of the river, much of both methods' unscored water sits in rectangular, field-shaped patches. They may be irrigated fields rather than flood. Not checked.
- **Threshold diagnostic** (in-sample on AOI01, not used to choose anything): the best LightGBM threshold on AOI01 would be 0.14, giving IoU 0.820. So the model still ranks AOI01 pixels in a sensible order; its probabilities are just shifted down.

### 2. Do AOI01's features look like AOI06's?

- **Land medians, the offsets removed before the model sees the data** (dB):

  | Area | HH 5 Jan | HH 17 Jan | HV 5 Jan | HV 17 Jan | Reference land |
  |---|---|---|---|---|---|
  | AOI06 | -10.41 | -7.39 | -18.19 | -16.12 | 78,039 ha, 89% of valid pixels |
  | AOI01 | -12.17 | -9.15 | -19.12 | -17.19 | 240,323 ha, 30% of valid pixels |
  | AOI05 (frame 166, from its `stats.json`) | -8.53 | -5.30 | -15.59 | -13.42 | not read |

- **AOI06 and AOI01 come from the same two granules (frame 165).** So the 1.75 dB gap in 17 Jan HH is landscape, not calibration. The normalisation was meant to remove scene calibration, but because it is computed per area it removes this landscape difference too.
- **Why AOI01's land median is low.** Reference land needs JRC 0% and DSWx-S1 "not water" on 5 Jan, and DSWx-S1 covers only 32% of AOI01.
  - Over all JRC 0% land, AOI01's 17 Jan HH median is -7.91 dB, 1.24 dB higher than the one used.
  - On AOI06 the two definitions differ by 0.09 dB (HH; HV not checked).
- **The effect on flood pixels.**
  - In raw dB, AOI01's agreed flood is darker than AOI06's: 17 Jan HH median -18.4 against -17.6 dB.
  - After the offset it looks less dark: -9.3 against -10.2 dB. So the model gives it lower probabilities.
  - Agreed dry land looks brighter for the same reason: +1.0 against -0.5 dB.
- **AOI01 is shifted, not out of range.**
  - For each feature, 0.8% to 9.6% of AOI01's scored pixels fall outside AOI06's 1st to 99th percentile. The highest share is `hh1_mean`.
  - Medians move by up to half of AOI06's interquartile range.
- **Class share does not explain it.** Flood is 11.7% of AOI01's scored, eligible pixels, against 18.2% on AOI06. A lower share would push the best threshold up, not down.
- **The rule adapts to each area; LightGBM does not.** The rule fits its water threshold on each area's own reference water and land.
  - Its 17 Jan threshold is almost the same in raw dB: -16.58 on AOI06, -16.72 on AOI01.
  - Measured from each area's land median, the two thresholds are 1.6 dB apart.
- **Direct test** (in-sample on AOI01, diagnostic only, same model and threshold):

  | Offsets used on AOI01 | IoU | Precision | Recall | New water (ha) |
  |---|---|---|---|---|
  | AOI01 land where DSWx-S1 has data (published) | 0.718 | 0.944 | 0.750 | 51,494 |
  | AOI06's offsets (same granules) | 0.819 | 0.854 | 0.952 | 83,651 |
  | AOI01, all JRC 0% land | 0.838 | 0.888 | 0.937 | 73,619 |

  So most of the AOI01 gap comes from how the land median is taken, not from the model failing on a wetter scene.

### 3. The rule's AOI01 IoU: 0.833 or 0.836

- `stats.json` holds **0.8328**, in `method.parameters.tuned_rule_iou_this_area`, and its limits sentence rounds this to 0.833. That is the rule with the JRC 4% fallback, as published.
- 0.836 (0.8358) is the same rule without the fallback, with DSWx-S1 alone as water before the flood. It comes from the sensitivity table in "AOI01 choices" below, which now shows 4 decimals. The check script reproduced both values.

### What this means for the AOI01 decision

- **A label-free change would probably close most of the gap:** take the land median over JRC 0% land, without requiring DSWx-S1. It moves AOI06's HH offsets by 0.1 dB or less, so the AOI06 tuning should barely change.
- **The costs.**
  - It was found by looking at AOI01, so AOI01 can no longer check it independently.
  - AOI05 has already been used as the test. Its LightGBM output would change slightly and could not be rescored as a fresh test.
  - AOI05's offsets under the new definition were not computed.
- **Not done:** the method and the files are unchanged.

## Done, overnight 12 Nov: LightGBM, outputs for three areas, buildings

### What was run, in order

1. Installed LightGBM 4.7.0 (and SciPy 1.18.1) into `.venv`.
2. Generalised `pipeline/baseline_aoi05.py`:
   - New shared helpers: `area_stats`, `threshold_method`, `before_water`, and `export` for any area, now following contract 1.1.
   - The median filter now runs in row strips, so AOI01 fits in memory. A self-check confirms the strips give the same result as one pass.
   - After the change, `python pipeline\baseline_aoi05.py` gave a `stats_baseline.json` identical to before, for all three rules.
   - `baseline_aoi05.py` no longer writes the app files. `make_outputs.py` does.
3. `python pipeline\lgbm_aoi06.py`: tuned on AOI06 only. It ran twice; the revision is explained below.
4. `python pipeline\lgbm_aoi06.py --test`: scored on AOI05, once.
5. `python pipeline\make_outputs.py`: the contract outputs for all three areas, and the building counts.

### LightGBM design, fixed before any LightGBM score

- **Features.** 14 per 30 m pixel:
  - HH and HV on each date, HV minus HH on each date, and the HH and HV change.
  - The 5x5 local mean and standard deviation of 17 Jan HH, 17 Jan HV and the HH change.
- **Calibration.** Before anything else, every dB value has its area's median over reference land removed (JRC 0% and DSWx-S1 5 Jan not water), per date and polarisation. No label is used. AOI06 offsets: HH -10.41 and -7.39 dB, HV -18.19 and -16.12 dB (5 and 17 Jan).
- **Target.** Copernicus observed flood on evaluated AOI06 pixels (coverage code 1).
- **Post-masks.** The same as the rule: valid data, not water before the flood, not permanent water (JRC 50% or more). Pixels these masks remove are not trained on. This way the comparison measures the classifier alone.
- **Spatial blocks.** Squares of 100 x 100 pixels (3 km) that hold training pixels, shuffled into 5 folds (seed 0).
- **Settings grid.** `num_leaves` 15, 31 or 63, by `min_data_in_leaf` 50, 500 or 2000. Learning rate 0.05, 300 rounds.
- **Threshold.** The probability threshold with the best IoU over all out-of-fold predictions pooled.
- **Decision on AOI05.** The higher IoU at 3 decimals wins. A tie keeps the rule.

### One revision, on AOI06 only, before AOI05 was read

- The first run also left a 2-pixel band around flood polygon edges out of training, and searched thresholds from 0.05 to 0.95.
- That band held 6,459 of AOI06's 8,927 ha of scored flood (72%), because the polygons are fragmented. Training kept only 1,790 ha of flood.
- Result: pooled out-of-fold IoU 0.498, with the threshold stuck at 0.05, the end of the range.
- Fix: the band was dropped and the range widened to 0.01 to 0.99. Second run: 0.570, at threshold 0.37.
- This changed nothing for the rule, and AOI05 was not read before the fix.

### Results

| Method | AOI06 out-of-fold IoU | AOI06 in-sample IoU | AOI05 IoU (test) | AOI05 precision | AOI05 recall | NISAR flood (ha) | Both (ha) | NISAR only (ha) | Copernicus only (ha) |
|---|---|---|---|---|---|---|---|---|---|
| Tuned rule | not run (rule tuned on all of AOI06) | 0.558 | 0.521 | 0.765 | 0.620 | 7,785 | 5,957 | 1,827 | 3,657 |
| LightGBM | 0.570 | 0.577 | **0.572** | 0.711 | 0.745 | 10,065 | 7,158 | 2,908 | 2,457 |

- **Per fold on AOI06.**
  - LightGBM out of fold: 0.518, 0.542, 0.595, 0.617, 0.588.
  - Rule on the same folds: 0.503, 0.523, 0.593, 0.610, 0.577. These are in-sample, and LightGBM still wins in every fold.
- **The settings grid is flat:** 0.569 to 0.570 across all nine. Chosen: `num_leaves` 15, `min_data_in_leaf` 500, threshold 0.37.
- **What the model uses** (share of gain): 17 Jan HH 63%, its 5x5 mean 27%, the 5x5 mean of 17 Jan HV 2%. The change features are each under 1%.
  - So the model mostly learns a smoothed 17 Jan HH threshold, as the review predicted.
  - Its gain over the rule is recall: it finds more of the flood edges, at some cost in precision.
- **Reproduction:** the rule scored 0.5207 on AOI05 again, the same as on 11 Nov.
- **Files:**
  - `data/aoi06/lgbm_model.txt` and `data/aoi06/lgbm_rule.json` (settings, folds, importance).
  - `data/aoi05/test_lgbm_vs_rule.json`. While it exists, `lgbm_aoi06.py --test` refuses to score AOI05 again.

### Outputs per area (LightGBM v1, replaced by v2 later on 12 Nov, see above)

| Area | IoU | Precision | Recall | Scored (ha) | New water, whole grid (ha) | In mapped area (ha) | Rule IoU, same reference | Rule new water (ha) | OSM buildings in new water |
|---|---|---|---|---|---|---|---|---|---|
| AOI05 (test) | 0.572 | 0.711 | 0.745 | 62,970 | 14,917 | 10,106 | 0.521 | 11,528 | 12 of 11,349 |
| AOI06 (training) | 0.577 | 0.760 | 0.705 | 42,770 | 11,408 | 8,348 | 0.558 | 11,207 | 5 of 18,515 |
| AOI01 | 0.718 | 0.944 | 0.750 | 51,503 | 51,494 | 12,754 | 0.833 | 76,198 | 313 of 346,003 |

- **Coverage.**
  - AOI06: 35% of the grid has no NISAR data on at least one date (the 5 Jan pass covers less of it), and 31.6% is evaluated.
  - AOI01: 6.5% is evaluated, 88.2% is outside the usable reference, and 4.8% is in the edge buffer.
- **What each `stats.json` says.** `method.parameters` holds the AOI05 comparison and the rule's IoU on that area. Each `limits` list says which area is the test, which is training, and gives the AOI01 reversal in one sentence.

### AOI01 choices

- **Labels.** The 16 Jan FEP (Sentinel-1, 20,126.9 ha observed) and the 18 Jan delineation (COSMO-SkyMed, 87,857.6 ha observed) are kept only where both cover the pixel and agree.
  - They agree on 62.7% of the area both cover.
  - Flood on both: 17,569 ha. Flooded on 18 Jan only: 53,269 ha. On 16 Jan only: 2,537 ha.
  - The result is saved as `data/aoi01/label_agree_aoi01_flood_30m.tif`.
  - Pixels where the maps disagree fall under coverage code 2 (agreed before the run), and the coverage legend says so.
  - `label.png` shows the agreement layer, and the limits text quotes the full 18 Jan area.
- **JRC fallback.**
  - Where DSWx-S1 has no data (68% of AOI01), water before the flood is JRC occurrence of 4% or more.
  - 4% was chosen without any label: it is the level that best matches DSWx-S1 5 Jan water where both exist. The match is weak (IoU 0.385).
  - Sensitivity check, not used to choose anything:

    | Method | Fallback | AOI01 IoU | New water (ha) |
    |---|---|---|---|
    | LightGBM | none | 0.7175 | 59,525 |
    | LightGBM | JRC 4% | 0.7179 | 51,494 |
    | Rule | none | 0.8358 | 93,286 |
    | Rule | JRC 4% | 0.8328 | 76,198 |

    So the fallback cuts the totals but hardly changes agreement. AOI05 and AOI06 have no DSWx-S1 gaps, so it does nothing there.
- **Already dark on 5 Jan.**
  - 9,050 ha (18%) of AOI01's new water was already dark in NISAR's 5 Jan image (3x3 HH below the 5 Jan water threshold), although DSWx-S1 or JRC called it dry.
  - AOI05: 707 ha (5%). AOI06: 715 ha (6%).
  - Within AOI01 the share is 13% where DSWx-S1 is missing and 19% where it is present, so the fallback is not the cause. AOI01 was simply wetter on 5 Jan.
  - The method was not changed. Each area's limits now give its figure.

### Buildings

- **Method.** Each OSM building point is moved to EPSG:32736 and counted when it falls on a `water_new` pixel. The total on the grid is counted too.
- **Contract.** Stored in `stats.json` as `results.osm_buildings_in_new_water` and `results.osm_buildings_on_grid`.
- **The counts are tiny**: 12, 5 and 313. Radar open-water detection misses flooded built-up areas (they look bright), a 30 m pixel is bigger than a house, and OSM is incomplete. Each area's limits first called the count a lower bound. That was reworded later on 12 Nov: the count can be too high or too low, and it says nothing about damage.

### Contract and overlays

- **Contract.** `docs/DATA_CONTRACT.md` gains the two optional building fields (still version 1.1), the three-area `areas.json`, and a note that the old AOI05 PNGs will be removed.
- **Grey overlays.** -25 to 0 dB, WebP from every second pixel, quality 80.
  - AOI05: about 200 KB each, down from 3.3 to 3.8 MB as PNG. AOI06: 80 to 100 KB. AOI01: about 770 KB.
- **`check_contract`** now requires `schema_version` "1.1", allows `webp`, and allows the two optional building keys.

### Checked

- Every `stats.json` passes `check_contract`, and its coverage shares sum to 1.
- `flooded_ha` equals the `water_new` GeoTIFF count, building counts are no larger than the totals, and every listed file exists.
- Composite check images (5 Jan, 17 Jan, and 17 Jan with new water and the label) for all three areas: the overlays line up.
- 17 Jan is no longer washed out: mean grey on AOI05 is 189 of 255 on 17 Jan, against 161 on 5 Jan.
- Processing in strips gives the same result as the whole image, for both the LightGBM features and the median filter (self-checks).

### Not done or not checked

- The open land against wetland split, the flooded-vegetation class, and the HLS 19 Jan check.
- The overlays inside the web app. They were only checked as images.
- `pipeline/tune_aoi06.py` was not rerun. Its helpers kept their signatures, and `baseline_aoi05.py` reproduces its rule exactly.
- Whether the NISAR-only new water outside the Copernicus maps is real (the eastern river in AOI05, the western wetlands in AOI01). It was not checked against any other source.
- The old AOI05 PNGs were not deleted, on purpose.

## Done, 11 Nov

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

1. Done: git repo started, with `data/` ignored.
2. Done: the Copernicus layer leaves out permanent water, and the baseline does too (JRC plus DSWx-S1 for 5 Jan).
3. Done: baseline for AOI05 (11 Nov). Contract 1.1 (-25 to 0 dB stretch, WebP grey overlays) applied on 12 Nov.
4. Done 12 Nov: `pipeline/make_outputs.py` writes the outputs for AOI05, AOI06 and AOI01 (Chókwè to Xai-Xai).
5. Done 12 Nov: LightGBM beat the rule on AOI05 (0.572 against 0.521) and is kept. Both are reported. It took about an hour in all.
6. Next.js app: map, before/after slider, overlays, coverage map. Reads `web/public/data` only.
7. `claims/`: parser, time and area gate, verdict rules, evidence report. Write the 30 test claims before tuning. Check the full path on the deployed URL.
8. Buildings count done 12 Nov (worded as "too high or too low", not a lower bound). Still to do: cloud panel, 19 Jan optical check, five-date strip, panel on why water is dark. Feature freeze after this.
9. Run the 30-claim test, README with limits, backup video, slides.
10. Rehearse, submit, and check every link while logged out.
