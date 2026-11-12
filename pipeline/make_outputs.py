"""Contract 1.1 outputs for AOI05, AOI06 and AOI01, with the method chosen by the one-time AOI05 test.

The method is the one named in data/aoi05/test_lgbm_vs_rule.json (written by pipeline/lgbm_aoi06.py --test).
If that file is missing, the tuned threshold rule is used. LightGBM runs the v2 model (land median over JRC 0%
land, data/aoi06/lgbm_model_v2.txt). Its post-fix rerun on AOI05 (data/aoi05/test_lgbm_v2.json) is quoted next to
the clean v1 test, and stops this script if it fell below the rule. For each area this writes water_new, change_hh and
coverage GeoTIFFs in data/<area>, and the overlays and stats.json in web/public/data/<area>, then lists the
finished areas in web/public/data/areas.json. It also counts OpenStreetMap buildings inside detected new water.

AOI01 has no Copernicus map from the NISAR morning, so its label is the 16 Jan first estimate (Sentinel-1) and
the 18 Jan delineation (COSMO-SkyMed) where they agree; elsewhere it is 255 and not scored. DSWx-S1 covers only
part of AOI01 on 5 Jan, so there JRC occurrence >= X stands in for water before the flood, with X chosen where
both exist (no flood label used).

  python pipeline\\make_outputs.py
"""
import json
import sys
import traceback

import lightgbm as lgb
import numpy as np
from affine import Affine
from rasterio.features import rasterize
from rasterio.warp import transform

import baseline_aoi05 as b
import fetch_all as f
import lgbm_aoi06 as m
import prep_aoi05 as p

DATA = p.ROOT / "data"
EMS = {"source": "Copernicus EMS", "activation": "EMSR857", "layer": "observedEventA"}
AREAS = {
    "aoi05": {"name": "AOI05 Chinhangane, Mozambique", "frame": 166, "granules": p.GRANULES,
              "reference": b.AOI05_REFERENCE,
              "limits": ["Agreement with Copernicus, not accuracy: the reference is a Sentinel-1 (C-band) map made "
                         "24 minutes before the NISAR pass, not ground truth.",
                         "AOI05 is the held-out test area: the method was chosen on AOI06 and applied here once, "
                         "unchanged."]},
    "aoi06": {"name": "AOI06 Palmeira, Mozambique", "frame": 165, "granules": f.NISAR_165,
              "reference": {**EMS, "aoi": "AOI06", "product": "Delineation (DEL), monitoring 0, version 1",
                            "sensor": "Sentinel-1", "observed_utc": "2026-01-17T03:19:00Z", "observed_ha": 14064.9},
              "limits": ["Agreement with Copernicus, not accuracy: the reference is a Sentinel-1 (C-band) map made "
                         "23 minutes before the NISAR pass, not ground truth.",
                         "AOI06 is the training area: the method's settings were chosen here, so its agreement "
                         "figure is in-sample, not a test. The held-out test is AOI05."]},
    "aoi01": {"name": "AOI01 Chibabel: Chókwè, Macia and Xai-Xai, Mozambique", "frame": 165, "granules": f.NISAR_165,
              "reference": {**EMS, "aoi": "AOI01",
                            "product": "Delineation (DEL), monitoring 0, version 1, scored only where it agrees with "
                                       "the First Estimate Product (FEP) from Sentinel-1 at 16:22 UTC on 16 Jan "
                                       "(observed 20,126.9 ha)",
                            "sensor": "COSMO-SkyMed", "observed_utc": "2026-01-18T14:55:00Z", "observed_ha": 87857.6},
              "limits": ["Agreement with Copernicus, not accuracy, and a lower bound: no Copernicus map was made on "
                         "the NISAR morning here. The reference maps are from about 11 hours before (Sentinel-1, "
                         "C-band) and 35 hours after (COSMO-SkyMed, X-band) the NISAR pass, so part of their "
                         "difference may be the sensor, not the flood.",
                         "NISAR's last pass on this track was 17 Jan 03:42 UTC. Copernicus observed a larger flood "
                         "here on 20 Jan (127,755.1 ha), after that pass."]},
}
LEGEND_AOI01 = {2: "valid, outside the area both Copernicus maps cover, or where the 16 and 18 Jan maps disagree"}
# Field grids in AOI01, drawn by eye on the 17 Jan HH image along the visible field boundaries, as (column, row) on
# the AOI01 grid. Water inside them may be irrigation rather than flood (pipeline/check_fields_aoi01.py).
# shortcut: hand-drawn outlines, edges good to about 1 km; replace with a mapped irrigation-scheme boundary if found.
FIELDS_AOI01 = {
    "on the south-west bank downstream of Chókwè": [[(520, 700), (560, 690), (700, 765), (960, 985), (1450, 1262), (1600, 1300),
                                               (1600, 1420), (430, 1420), (380, 1360), (440, 1150), (480, 900)]],
    "north-west of Xai-Xai": [[(2385, 2005), (2625, 2005), (2625, 2385), (2385, 2385)],
                              [(2715, 2125), (2895, 2125), (2895, 2425), (2715, 2425)]],
}
V1_IOU = {"aoi05": 0.5716, "aoi06": 0.5772, "aoi01": 0.7179}  # LightGBM v1, published 12 Nov (commit db3bded)


def field_mask(shape, polygons):
    """True on pixels whose centre lies inside any of the (column, row) polygons."""
    return rasterize([({"type": "Polygon", "coordinates": [list(pg) + [pg[0]]]}, 1) for pg in polygons],
                     out_shape=shape, transform=Affine.identity(), dtype="uint8").astype(bool)


def agreement_label(a, c):
    """1 or 0 where both maps cover the pixel and agree, otherwise 255."""
    return np.where((a != 255) & (c != 255) & (a == c), a, 255).astype("uint8")


def fit_jrc_x(d):
    """JRC occurrence level whose mask best matches DSWx-S1 5 Jan water where DSWx-S1 has data. Returns (x, IoU)."""
    have = (d["dswx0"] != 255) & (d["jrc"] <= 100)
    water, jrc = np.isin(d["dswx0"][have], b.DSWX_WATER), d["jrc"][have]

    def iou(x):
        mask = jrc >= x
        return (mask & water).sum() / max((mask | water).sum(), 1)
    x = max(range(1, 101), key=iou)
    return x, round(float(iou(x)), 4)


def count_in(lon, lat, grid, mask):
    """Points inside the grid, and those of them on True pixels of mask. Returns (on mask, on grid)."""
    if not len(lon):
        return 0, 0
    row, col = pixels(lon, lat, grid)
    return int(mask[row, col].sum()), len(row)


def pixels(lon, lat, grid):
    """Row and column of each lon/lat point that falls on the grid."""
    x0, y1, nx, ny = grid
    xs, ys = transform("EPSG:4326", p.CRS, list(lon), list(lat))
    col, row = np.floor((np.array(xs) - x0) / p.PIX).astype(int), np.floor((y1 - np.array(ys)) / p.PIX).astype(int)
    inside = (row >= 0) & (row < ny) & (col >= 0) & (col < nx)
    return row[inside], col[inside]


def buildings(area, grid, flood):
    feats = json.loads((DATA / area / "osm_buildings.geojson").read_text(encoding="utf-8"))["features"]
    lon = [ft["geometry"]["coordinates"][0] for ft in feats]
    lat = [ft["geometry"]["coordinates"][1] for ft in feats]
    return count_in(lon, lat, grid, flood)


assert (agreement_label(np.array([1, 0, 1, 255, 0]), np.array([1, 0, 0, 1, 255])) == [1, 0, 255, 255, 255]).all()
_g = (p.X0, p.Y1, 4, 3)
_lon, _lat = transform(p.CRS, "EPSG:4326", [p.X0 + 45, p.X0 + 105, p.X0 + 500], [p.Y1 - 15, p.Y1 - 75, p.Y1 - 15])
_mask = np.zeros((3, 4), bool)
_mask[0, 1] = True
assert count_in(_lon, _lat, _g, _mask) == (1, 2)  # pixel (0, 1) is hit, (2, 3) is not, the third is off the grid
assert field_mask((4, 6), [[(1, 1), (4, 1), (4, 3), (1, 3)]]).sum() == 6  # columns 1-3, rows 1-2


def method_block(chosen, test, rerun, rule, info, d):
    """stats.json method block, with the AOI05 comparison (and the post-fix rerun, if any) attached."""
    comparison = {"tuned_rule_iou": test["tuned_rule"]["iou"], "lightgbm_iou": test["lightgbm"]["iou"],
                  "chosen": chosen, "decision_rule": test["decision_rule"]} if test else None
    if comparison and rerun:
        comparison["post_fix_rerun"] = {k: rerun[k] for k in ("label", "note", "decided_before_scoring")}
        comparison["post_fix_rerun"]["lightgbm_v2_iou"] = rerun["lightgbm_v2"]["iou"]
    if chosen == "threshold":
        block = b.threshold_method(rule, info, "tuned_on_aoi06")
    else:
        cfg = json.loads(m.RULE_JSON.read_text(encoding="utf-8"))
        block = {"name": "lightgbm", "edge_buffer_px": b.EDGE_PX,
                 "summary": f"LightGBM classifier on {len(m.FEATURES)} radar features (HH, HV, HV minus HH, the "
                            "change between dates, and 5x5 local mean and spread), each with the area's median over "
                            "land with no water on record (JRC 0%) removed; "
                            f"flood where the probability is at least {cfg['threshold']:.2f}; not water on 5 Jan "
                            f"(DSWx-S1); not permanent water (JRC occurrence >= {b.PERMANENT_PCT}%).",
                 "parameters": {"version": cfg.get("version", 1), "land_for_offsets": cfg.get("land_for_offsets"),
                                "features": m.FEATURES, "window_px": m.WIN, "params": cfg["params"],
                                "rounds": cfg["rounds"], "threshold": cfg["threshold"], "offsets_db": m.offsets(d),
                                "cv_aoi06": cfg["cv"]["pooled_out_of_fold"], "tuned_on": "aoi06",
                                "unclear_rise_db": b.RISE_DB, "permanent_water_jrc_pct": b.PERMANENT_PCT}}
    block["parameters"]["aoi05_test"] = comparison
    if d.get("jrc_x"):
        block["parameters"]["before_water_jrc_fallback_pct"] = d["jrc_x"]
        block["summary"] = block["summary"].replace(
            "(DSWx-S1)", f"(DSWx-S1, or JRC occurrence >= {d['jrc_x']}% where DSWx-S1 has no data)")
    return block


def run_area(area, chosen, test, rerun, rule, model, threshold):
    cfg, grid = AREAS[area], f.GRIDS[area]
    limits_extra, building_range = [], ""
    if area == "aoi01":
        import rasterio
        with rasterio.open(DATA / area / "label_emsr857_aoi01_fep_flood_30m.tif") as s:
            fep = s.read(1)
        with rasterio.open(DATA / area / "label_emsr857_aoi01_flood_30m.tif") as s:
            dl = s.read(1)
        label = agreement_label(fep, dl)
        p.save(DATA / area / "label_agree_aoi01_flood_30m.tif", label, 255, grid)
        both = (fep != 255) & (dl != 255)
        d = b.load(DATA / area, label)
        d["jrc_x"], match = fit_jrc_x(d)
        dswx_share = float((d["dswx0"] != 255).mean())
        disagree, agree_ha = 1 - (label != 255).sum() / both.sum(), (label == 1).sum() * b.HA
        p.log(f"aoi01: maps agree on {1 - disagree:.1%} of the area both cover; flood on both {agree_ha:,.0f} ha. "
              f"DSWx-S1 covers {dswx_share:.1%}; JRC fallback >= {d['jrc_x']}% (IoU {match} with DSWx-S1 water)")
        limits_extra = [
            f"Only pixels where both maps agree are scored. They disagree on {disagree:.0%} of the area both cover "
            "(mostly flooded on 18 Jan only), and those pixels count as outside the mapped area. The red overlay "
            f"shows flood on both maps ({agree_ha:,.0f} ha on this grid), not the full 18 Jan extent.",
            f"DSWx-S1 covers only {dswx_share:.0%} of this area on 5 Jan. Elsewhere, water before the flood is JRC "
            f"occurrence >= {d['jrc_x']}%, the level that best matches DSWx-S1 where both exist (IoU {match:.2f}).",
        ]
    else:
        d = b.load(DATA / area)
    coverage = b.scoring(d)
    rule_pred, info = b.detect(d, **rule)
    pred = rule_pred if chosen == "threshold" else m.predict(model, d, threshold)
    valid = np.isfinite(d["hh0"]) & np.isfinite(d["hh1"])
    n_in, n_grid = buildings(area, grid, pred & valid)
    with np.errstate(invalid="ignore"):  # NaN is not dark
        dark0 = b.filtered(d, "hh0", {**b.RULE_DEFAULTS, **rule}["filter_px"]) < info["water_threshold_db"][b.BEFORE]
    dark_ha, new_ha = (pred & valid & dark0).sum() * b.HA, max((pred & valid).sum() * b.HA, 1)

    limits = list(b.LIMITS_COMMON) if chosen == "threshold" else [
        "NISAR Beta data: not fully calibrated. The 17 Jan scene is about 3 dB brighter overall, so each area's "
        "median over land with no water on record (JRC 0%) is removed before the classifier sees it.",
        *b.LIMITS_COMMON[1:4],
        "The classifier learned from the Copernicus map of AOI06 only."]
    if area == "aoi06":
        no_data = float((coverage == 0).mean())
        limits_extra.append(f"NISAR frame 165 covers only part of this grid: {no_data:.0%} has no NISAR data "
                            "on at least one of the two dates.")
    if test:
        sentence = (f"On the held-out area AOI05, the tuned rule scored IoU {test['tuned_rule']['iou']:.3f} "
                    f"and LightGBM {test['lightgbm']['iou']:.3f} against Copernicus, so the "
                    f"{'tuned rule' if chosen == 'threshold' else 'LightGBM classifier'} is used.")
        if rerun:
            sentence += (" That is the one clean test. A fix to how the land median is taken was found later, on "
                         "AOI01, and AOI05 was scored once more after it (a post-fix rerun, not a clean test): IoU "
                         f"{rerun['lightgbm_v2']['iou']:.3f}." +
                         (" The agreement figures for this area are from that rerun." if area == "aoi05" else ""))
        limits_extra.append(sentence)
    ev, truth = coverage == 1, d["label"] == 1
    rule_iou = round(float(b.score(rule_pred[ev], truth[ev])["iou"]), 4)
    if chosen == "lightgbm" and area == "aoi06":  # AOI05's comparison is the test sentence above
        lgbm_iou = float(b.score(pred[ev], truth[ev])["iou"])
        limits_extra.append(f"Against this area's reference, the tuned rule scores IoU {rule_iou:.3f} and LightGBM "
                            f"{lgbm_iou:.3f} (both in-sample).")
    elif chosen == "lightgbm" and area == "aoi01":
        lgbm_iou = float(b.score(pred[ev], truth[ev])["iou"])
        limits_extra.append(f"Against this area's reference, LightGBM scores IoU {lgbm_iou:.3f}. This is a diagnostic, "
                            "not a test score: the land-median problem was found on this area. Before the fix "
                            f"LightGBM scored {V1_IOU[area]:.3f} here, and the tuned rule scores {rule_iou:.3f}. "
                            "The method was chosen on AOI05, not here.")
        new = pred & valid
        assert not (new & (fep != 255) & (dl == 255)).any()  # so "outside both" and "18 Jan only" are the only cases
        neither_ha = (new & (fep == 255) & (dl == 255)).sum() * b.HA
        only18_ha = (new & (fep == 255) & (dl != 255)).sum() * b.HA
        limits_extra.append(f"About {neither_ha / new_ha:.0%} of the detected new water ({neither_ha:,.0f} ha of "
                            f"{new_ha:,.0f} ha) lies outside both Copernicus maps, with no independent check. A "
                            f"further {only18_ha / new_ha:.0%} ({only18_ha:,.0f} ha) is covered only by the 18 Jan "
                            "map, so it is not scored either.")
        field = {}  # name -> (new water ha, buildings in it, ha of it already dark on 5 Jan)
        for name, polygons in FIELDS_AOI01.items():
            w = pred & valid & field_mask(pred.shape, polygons)
            field[name] = (w.sum() * b.HA, buildings(area, grid, w)[0], (w & dark0).sum() * b.HA)
        (ck_ha, ck_n, _), (xx_ha, xx_n, xx_dark) = (field["on the south-west bank downstream of Chókwè"],
                                                    field["north-west of Xai-Xai"])
        limits_extra.append(
            f"Some of the new water north-west of Xai-Xai may be irrigation, not flood: {xx_ha:,.0f} ha ({xx_n:,} "
            f"buildings) lies in the field grids there, and about {xx_dark:,.0f} ha of it was already dark in NISAR's "
            f"5 Jan image. Downstream of Chókwè, {ck_ha:,.0f} ha ({ck_n:,} buildings) lies in a field grid, but the "
            "evidence leans towards flood water held in the fields, not irrigation: where the 18 Jan COSMO-SkyMed map "
            "covers it, the map calls most of it flooded, and JRC has almost never seen water there. This is not "
            "confirmed. The optical image of 19 Jan (HLS) is cloud-covered, so it could not settle either area.")
        rule_n = buildings(area, grid, rule_pred & valid)[0]
        low, high = sorted((rule_n, n_in))
        building_range = (f" For this area the count is about {round(low, -1)} to {round(high, -1)} mapped buildings "
                          "in detected water, depending on method.")
    limits_extra.append(f"{dark_ha:,.0f} ha ({dark_ha / new_ha:.0%}) of the detected new water was already dark in "
                        "NISAR's 5 Jan image. DSWx-S1 (or JRC) called it dry, so it counts as new, but some of it "
                        "may have been water before 17 Jan.")
    limits_extra.append(f"Buildings: {n_in:,} OpenStreetMap buildings sit inside detected new water, out of {n_grid:,} "
                        f"mapped on this grid.{building_range} The count can be too high or too low. Too low: "
                        "OpenStreetMap is incomplete here, and flooded built-up areas look bright in radar, so "
                        "open-water detection misses them. Too high: a 30 m pixel is larger than a house, so a "
                        "building beside water can fall on a water pixel, and some detected water may not be flood. "
                        "It says nothing about damage. Data: OpenStreetMap contributors, ODbL.")
    method = method_block(chosen, test, rerun, rule, info, d)
    method["parameters"]["tuned_rule_iou_this_area"] = rule_iou
    if chosen == "lightgbm":
        method["parameters"]["lightgbm_v1_iou_this_area"] = V1_IOU[area]
    stats = b.area_stats(area, cfg["name"], grid, cfg["frame"], cfg["granules"], cfg["reference"], method, d, pred,
                         coverage, [limits[0], *cfg["limits"], *limits[1:], *limits_extra])
    stats["results"]["osm_buildings_in_new_water"], stats["results"]["osm_buildings_on_grid"] = n_in, n_grid
    app = b.export(area, grid, d, pred, coverage, stats, LEGEND_AOI01 if area == "aoi01" else None)
    rule_ha = round(float((rule_pred & valid).sum() * b.HA))
    return app, f"tuned rule here: IoU {rule_iou:.4f}, new water {rule_ha:,} ha"


def main():
    test = json.loads(m.TEST.read_text(encoding="utf-8")) if m.TEST.exists() else None
    rerun = json.loads(m.TEST_V2.read_text(encoding="utf-8")) if m.TEST_V2.exists() else None
    if rerun and rerun["reopen_method_choice"]:
        sys.exit("The post-fix rerun fell below the tuned rule on AOI05, so the method choice is reopened. "
                 "Decide it before regenerating the outputs.")
    chosen = test["chosen"] if test else "threshold"
    rule = json.loads(b.TUNED.read_text(encoding="utf-8"))["rule"]
    model = lgb.Booster(model_file=str(m.MODEL)) if chosen == "lightgbm" else None
    threshold = json.loads(m.RULE_JSON.read_text(encoding="utf-8"))["threshold"] if model else None
    p.log(f"Method: {chosen}" + ("" if test else " (no AOI05 test file, so the tuned rule)"))
    done, rows = [], []
    for area in AREAS:
        try:
            app, rule_iou = run_area(area, chosen, test, rerun, rule, model, threshold)
            done.append(area)
            r, a = app["results"], app["agreement"]
            rows.append(f"  {area}: IoU {a['iou']:.4f}  precision {a['precision']:.4f}  recall {a['recall']:.4f}  "
                        f"evaluated {a['evaluated_ha']:,.0f} ha  new water {r['flooded_ha']:,.1f} ha "
                        f"(in mapped area {r['flooded_ha_in_mapped_area']:,.1f})  buildings in new water "
                        f"{r['osm_buildings_in_new_water']:,} of {r['osm_buildings_on_grid']:,}  coverage "
                        f"{app['coverage']}  [{rule_iou}]")
        except Exception:
            traceback.print_exc()
            p.log(f"FAILED: {area}. It is left out of areas.json.")
    order = [a for a in ("aoi05", "aoi06", "aoi01") if a in done]
    (b.WEB / "areas.json").write_text(json.dumps(order), encoding="utf-8")
    print("\nSummary (agreement with Copernicus inside the scored area):\n" + "\n".join(rows))
    print(f"areas.json: {order}")


if __name__ == "__main__":
    main()
