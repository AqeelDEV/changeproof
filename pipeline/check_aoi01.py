"""Checks on AOI01, where the tuned rule scores higher than LightGBM. Diagnostic only: nothing here changes a
method, a threshold or an output file.

1. Both methods against the AOI01 agreement label (16 and 18 Jan Copernicus maps where they agree): IoU,
   precision, recall, and where LightGBM's errors sit (missed core flood, missed flood edge, extra water inside
   the scored area, water outside it).
2. Whether AOI01's normalised features look like AOI06's (the training area): land medians, and feature
   percentiles for flood and dry pixels. AOI05, the held-out area, is not read here beyond its stats.json offsets.
3. The rule's AOI01 IoU with and without the JRC fallback, against the value in stats.json.
4. What LightGBM v2 added over v1, split by zone (a partition of the valid pixels, each zone also split into
   where DSWx-S1 has data and the JRC-fallback area), with the rule's totals beside it, and why the v1 land share
   (30% of valid pixels) is lower than DSWx-S1's coverage (32%).

Writes data/aoi01/check_aoi01.json and data/aoi01/disagreement_aoi01.png.

First written for the v1 model; those results are in PROGRESS.md ("AOI01 checks", 12 Nov). It now checks the
published v2 model and v2 land medians (JRC 0% land), and rebuilds v1 for the comparison in part 4.

  python pipeline\\check_aoi01.py
"""
import json

import lightgbm as lgb
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch

import baseline_aoi05 as b
import fetch_all
import lgbm_aoi06 as m
import make_outputs as mo
import prep_aoi05 as p
import matplotlib.pyplot as plt  # noqa: E402  (prep_aoi05 has already selected the Agg backend)

DATA = p.ROOT / "data"
OUT = DATA / "aoi01"
CORE_PX = 3  # core flood: agreed flood at least 3 pixels (90 m) from any pixel that is not agreed flood
PCTS = (5, 25, 50, 75, 95)
SHOW = ["hh1", "hh1_mean", "hv1", "hh0", "dhh"]  # features printed and logged; all 14 go in the JSON
V1_PUBLISHED = {"new_water_ha": 51494, "buildings": 313}  # AOI01 under LightGBM v1, published 12 Nov (commit db3bded)


def ha(mask):
    return round(float(mask.sum() * b.HA))


def v1_offsets(d):
    """The v1 land median: valid pixels with JRC 0% and DSWx-S1 5 Jan not water."""
    valid = np.isfinite(d["hh0"]) & np.isfinite(d["hh1"])
    land = valid & (d["jrc"] == 0) & (d["dswx0"] == 0)
    return {k: round(float(np.nanmedian(d[k][land])), 3) for k in ("hh0", "hh1", "hv0", "hv1")}


def rounded_ha(counts):
    """Pixel counts to whole hectares that add up to the rounded total (largest remainder)."""
    exact = np.array(counts, float) * b.HA
    out = np.floor(exact)
    out[np.argsort(-(exact - out), kind="stable")[: int(round(exact.sum()) - out.sum())]] += 1
    return out.astype(int).tolist()


assert rounded_ha([5, 5, 5]) == [1, 0, 0] and sum(rounded_ha([7, 11, 13, 2])) == round(33 * b.HA)


def pct(a):
    return [round(float(v), 2) for v in np.nanpercentile(a, PCTS)]


def shift(a, ref):
    """Median of a minus median of ref, in units of ref's interquartile range."""
    q1, q3 = np.nanpercentile(ref, [25, 75])
    return round(float((np.nanmedian(a) - np.nanmedian(ref)) / max(q3 - q1, 1e-6)), 2)


def rows(d, off, mask):
    """Feature rows for the True pixels of mask, built in strips like lgbm_aoi06.probability."""
    out = []
    for r0 in range(0, len(mask), m.STRIP):
        r1 = min(r0 + m.STRIP, len(mask))
        if mask[r0:r1].any():
            out.append(m.features(d, off, r0, r1)[mask[r0:r1].ravel()])
    return np.concatenate(out)


def read(name):
    with rasterio.open(OUT / name) as s:
        return s.read(1)


def scores(pred, truth, ev):
    s = b.score(pred[ev], truth[ev])
    return {k: round(float(v), 4) if k in ("iou", "precision", "recall") else round(float(v)) for k, v in s.items()}


def main():
    stats = json.loads((b.WEB / "aoi01" / "stats.json").read_text(encoding="utf-8"))
    rule = json.loads(b.TUNED.read_text(encoding="utf-8"))["rule"]
    model = lgb.Booster(model_file=str(m.MODEL))
    thr = json.loads(m.RULE_JSON.read_text(encoding="utf-8"))["threshold"]

    # AOI01 exactly as make_outputs.py builds it
    fep, dl = read("label_emsr857_aoi01_fep_flood_30m.tif"), read("label_emsr857_aoi01_flood_30m.tif")
    label = mo.agreement_label(fep, dl)
    assert (label == read("label_agree_aoi01_flood_30m.tif")).all()
    d = b.load(OUT, label)
    d["jrc_x"] = mo.fit_jrc_x(d)[0]
    assert d["jrc_x"] == stats["method"]["parameters"]["before_water_jrc_fallback_pct"]
    cov, truth = b.scoring(d), label == 1
    ev, valid = cov == 1, np.isfinite(d["hh0"]) & np.isfinite(d["hh1"])
    off = m.offsets(d)
    prob, elig = m.probability(model, d, off), m.eligible(d)
    lg = elig & (prob >= thr)
    rp, rinfo = b.detect(d, **rule)
    assert ((read("water_new_30m.tif") == 1) == lg).all(), "LightGBM mask differs from the published water_new"
    methods = {"tuned_rule": rp, "lightgbm": lg}
    sc = {k: scores(v, truth, ev) for k, v in methods.items()}
    assert sc["lightgbm"]["iou"] == stats["agreement"]["iou"]
    assert sc["tuned_rule"]["iou"] == stats["method"]["parameters"]["tuned_rule_iou_this_area"]

    # 1. Where the errors sit
    core = truth & ~b.dilate(~truth, CORE_PX)
    zones = {"flooded_18_jan_only": (fep == 0) & (dl == 1), "flooded_16_jan_only": (fep == 1) & (dl == 0),
             "outside_one_or_both_maps": (fep == 255) | (dl == 255),
             "edge_buffer_or_unclear_in_agreed_area": (label != 255) & ~ev}
    assert not np.any(sum(z.astype(int) for z in zones.values())[valid & ~ev] != 1)  # zones split the unscored area
    errors = {}
    for name, pred in methods.items():
        fn = ev & truth & ~pred
        errors[name] = {"missed_core_ha": ha(fn & core), "missed_edge_ha": ha(fn & ~core),
                        "extra_in_scored_area_ha": ha(ev & pred & ~truth),
                        "missed_because_post_masks_ha": ha(fn & ~elig),
                        "water_outside_scored_area_ha": {z: ha(pred & valid & mask) for z, mask in zones.items()}}
    fn_lg = ev & truth & ~lg
    near = fn_lg & elig & (prob >= thr / 2)
    hh1n = d["hh1"] - off["hh1"]
    lg_detail = {"core_flood_scored_ha": ha(ev & core), "edge_flood_scored_ha": ha(ev & truth & ~core),
                 "missed_but_rule_detects_ha": ha(fn_lg & rp), "missed_eligible_ha": ha(fn_lg & elig),
                 "missed_eligible_prob_at_least_half_threshold_ha": ha(near),
                 "missed_eligible_prob_median": round(float(np.median(prob[fn_lg & elig])), 3),
                 "rule_only_flood_detected_ha": ha(ev & truth & rp & ~lg),
                 "lightgbm_only_flood_detected_ha": ha(ev & truth & lg & ~rp),
                 "hh1_normalised_median_db": {"lightgbm_missed_flood": round(float(np.nanmedian(hh1n[fn_lg & elig])), 2),
                                              "lightgbm_detected_flood": round(float(np.nanmedian(hh1n[ev & truth & lg])), 2),
                                              "agreed_dry": round(float(np.nanmedian(hh1n[ev & ~truth])), 2)},
                 "zone_size_ha": {z: ha(mask & valid) for z, mask in zones.items()}}
    curve = m.ious(prob[ev], elig[ev], truth[ev])
    best = int(np.argmax(curve))
    threshold_diag = {"threshold_used": thr, "iou_at_used": round(float(curve[np.abs(m.THRESHOLDS - thr).argmin()]), 4),
                      "best_threshold_on_aoi01": float(m.THRESHOLDS[best]), "iou_at_best": round(float(curve[best]), 4),
                      "note": "In-sample on AOI01. Diagnostic only, not used to choose anything."}

    # 2. Do AOI01's features look like AOI06's?
    d6 = b.load(DATA / "aoi06")
    off6, cov6 = m.offsets(d6), b.scoring(d6)
    train6, truth6 = (cov6 == 1) & m.eligible(d6), d6["label"] == 1
    x6, y6 = rows(d6, off6, train6), truth6[train6]
    assert np.array_equal(x6, m.features(d6, off6)[train6.ravel()], equal_nan=True)
    x1, y1 = rows(d, off, ev & elig), truth[ev & elig]
    feats = {}
    for i, f in enumerate(m.FEATURES):
        lo, hi = np.nanpercentile(x6[:, i], [1, 99])
        feats[f] = {"aoi06_flood": pct(x6[y6, i]), "aoi01_flood": pct(x1[y1, i]),
                    "aoi06_dry": pct(x6[~y6, i]), "aoi01_dry": pct(x1[~y1, i]),
                    "shift_flood_in_aoi06_iqr": shift(x1[y1, i], x6[y6, i]),
                    "shift_dry_in_aoi06_iqr": shift(x1[~y1, i], x6[~y6, i]),
                    "aoi01_share_outside_aoi06_p1_p99": round(float(np.mean((x1[:, i] < lo) | (x1[:, i] > hi))), 4)}

    def land_info(dd, o):
        v = np.isfinite(dd["hh0"]) & np.isfinite(dd["hh1"])
        old, new = v & (dd["jrc"] == 0) & (dd["dswx0"] == 0), v & (dd["jrc"] == 0)
        return {"offsets_db_v2": o, "offsets_db_v1": v1_offsets(dd),
                "land_v1_ha": ha(old), "land_v1_share_of_valid": round(float(old.sum() / v.sum()), 3),
                "land_v2_ha": ha(new), "land_v2_share_of_valid": round(float(new.sum() / v.sum()), 3)}
    _, rinfo6 = b.detect(d6, **rule)
    thr17 = {a: {"raw_db": i["water_threshold_db"][b.AFTER], "minus_land_median_db":
                 round(i["water_threshold_db"][b.AFTER] - o["hh1"], 2)} for a, i, o in (("aoi06", rinfo6, off6), ("aoi01", rinfo, off))}
    aoi05_off = json.loads((b.WEB / "aoi05" / "stats.json").read_text(encoding="utf-8"))["method"]["parameters"]["offsets_db"]
    features = {"land": {"aoi06": land_info(d6, off6), "aoi01": land_info(d, off), "aoi05_offsets_db": aoi05_off},
                "flood_share_of_scored_eligible": {"aoi06": round(float(y6.mean()), 3), "aoi01": round(float(y1.mean()), 3)},
                "rule_17_jan_water_threshold": thr17,
                "hh1_raw_db_percentiles": {"aoi06_flood": pct(d6["hh1"][train6 & truth6]), "aoi01_flood": pct(d["hh1"][ev & elig & truth]),
                                           "aoi06_dry": pct(d6["hh1"][train6 & ~truth6]), "aoi01_dry": pct(d["hh1"][ev & elig & ~truth])},
                "percentiles": list(PCTS), "per_feature": feats}
    del d6, x6
    # AOI06 and AOI01 share the frame 165 granules, so a land-median gap between them is landscape, not calibration.
    # LightGBM on AOI01 with other offsets, same model and threshold. In-sample, not used to choose anything.
    alt = {"used": off, "aoi06_offsets_same_frame": off6, "aoi01_land_v1_with_dswx": v1_offsets(d)}
    features["lightgbm_aoi01_with_other_offsets"] = {}
    for name, o in alt.items():
        pr = elig & (m.probability(model, d, o) >= thr)
        s = scores(pr, truth, ev)
        features["lightgbm_aoi01_with_other_offsets"][name] = {
            "offsets_db": o, "iou": s["iou"], "precision": s["precision"], "recall": s["recall"],
            "new_water_ha": ha(pr)}
    assert features["lightgbm_aoi01_with_other_offsets"]["used"]["iou"] == sc["lightgbm"]["iou"]

    # 3. The rule's IoU with and without the JRC fallback
    fallback = {}
    for x in (None, d["jrc_x"]):
        d["jrc_x"] = x
        fallback[f"jrc_{x}"] = {"tuned_rule": scores(b.detect(d, **rule)[0], truth, ev)["iou"],
                                "lightgbm": scores(m.eligible(d) & (prob >= thr), truth, ev)["iou"]}
    fallback["in_stats_json"] = {"tuned_rule_iou_this_area": stats["method"]["parameters"]["tuned_rule_iou_this_area"],
                                 "agreement_iou": stats["agreement"]["iou"]}

    # 4. What v2 added over v1, by zone; the rule's totals; the v1 land share
    model1 = lgb.Booster(model_file=str(m.AOI06 / m.V1_CV["model_file"]))
    thr1 = json.loads((m.AOI06 / "lgbm_rule.json").read_text(encoding="utf-8"))["threshold"]
    lg1 = elig & (m.probability(model1, d, v1_offsets(d)) >= thr1)
    feats_b = json.loads((OUT / "osm_buildings.geojson").read_text(encoding="utf-8"))["features"]
    br, bc = mo.pixels([ft["geometry"]["coordinates"][0] for ft in feats_b],
                       [ft["geometry"]["coordinates"][1] for ft in feats_b], fetch_all.GRIDS["aoi01"])

    def nb(mask):
        return int(mask[br, bc].sum())
    assert scores(lg1, truth, ev)["iou"] == mo.V1_IOU["aoi01"], "v1 does not reproduce its published AOI01 IoU"
    assert (ha(lg1), nb(lg1)) == (V1_PUBLISHED["new_water_ha"], V1_PUBLISHED["buildings"]), (ha(lg1), nb(lg1))
    assert nb(lg) == stats["results"]["osm_buildings_in_new_water"]
    zones_all = {"scored": ev, **zones}
    assert (sum(z.astype(int) for z in zones_all.values())[valid] == 1).all()  # a partition of the valid pixels
    fallback_area = d["dswx0"] == 255
    cells = [(z, part, valid & zm & pm) for z, zm in zones_all.items()
             for part, pm in (("dswx_s1_present", ~fallback_area), ("jrc_fallback_area", fallback_area))]
    v1_ha, v2_ha = rounded_ha([(c & lg1).sum() for *_, c in cells]), rounded_ha([(c & lg).sum() for *_, c in cells])
    split = [{"zone": z, "part": part, "v1_ha": a, "v2_ha": c2, "added_ha": c2 - a,
              "gained_ha": ha(c & lg & ~lg1), "dropped_ha": ha(c & lg1 & ~lg),
              "v1_buildings": nb(c & lg1), "v2_buildings": nb(c & lg), "added_buildings": nb(c & lg) - nb(c & lg1)}
             for (z, part, c), a, c2 in zip(cells, v1_ha, v2_ha)]
    assert sum(r["added_ha"] for r in split) == ha(lg) - ha(lg1)
    assert sum(r["added_buildings"] for r in split) == nb(lg) - nb(lg1)
    dswx = d["dswx0"]
    parts = {"dswx_water_1_or_3": np.isin(dswx, b.DSWX_WATER), "dswx_masked_250_or_251": np.isin(dswx, (250, 251)),
             "dswx_not_water_but_jrc_not_0": (dswx == 0) & (d["jrc"] != 0), "land_v1": (dswx == 0) & (d["jrc"] == 0)}
    assert ((sum(v.astype(int) for v in parts.values()) == 1) == (dswx != 255)).all()  # splits the DSWx-S1 cover
    v2_vs_v1 = {
        "split": split,
        "totals": {"lightgbm_v1": {"new_water_ha": ha(lg1), "buildings": nb(lg1)},
                   "lightgbm_v2": {"new_water_ha": ha(lg), "buildings": nb(lg)},
                   "tuned_rule": {"new_water_ha": ha(rp), "buildings": nb(rp)},
                   "v2_gained_ha": ha(lg & ~lg1), "v2_dropped_ha": ha(lg1 & ~lg)},
        "land_v1_share_explained": {"dswx_s1_covers_share_of_grid": round(float((dswx != 255).mean()), 4),
                                    "valid_share_of_grid": round(float(valid.mean()), 4),
                                    "of_valid_pixels": {k: round(float((v & valid).sum() / valid.sum()), 4)
                                                        for k, v in parts.items()}}}

    # Disagreement map, like data/aoi05/disagreement_baseline.png, with NISAR water outside the scored area added
    colours = [*b.DISAGREE_COLOURS, "#f3c98b"]
    names = [*b.DISAGREE_NAMES, "NISAR new water, not scored"]
    perm = b.permanent(d["jrc"]) & valid
    rr, cc = np.nonzero(label != 255)
    r0, r1, c0, c1 = max(rr.min() - 30, 0), rr.max() + 31, max(cc.min() - 30, 0), cc.max() + 31
    fig, axes = plt.subplots(1, 2, figsize=(18, 9.5 * (r1 - r0) / (c1 - c0) + 1.8), constrained_layout=True)
    for ax, (name, pred) in zip(axes, methods.items()):
        code = b.disagreement_codes(cov, pred, truth, perm)
        code[~ev & pred & valid] = 7
        ax.imshow(code[r0:r1, c0:c1], cmap=ListedColormap(colours), vmin=0, vmax=len(colours) - 1,
                  interpolation="nearest")
        s = sc[name]
        ax.set_title(f"{ {'tuned_rule': 'Tuned rule', 'lightgbm': 'LightGBM v2'}[name]}: IoU {s['iou']:.2f}, "
                     f"precision {s['precision']:.2f}, "
                     f"recall {s['recall']:.2f}")
        ax.axis("off")
    fig.legend(handles=[Patch(color=col, label=n) for col, n in zip(colours, names)], loc="outside lower center",
               ncol=4, frameon=False)
    fig.suptitle("AOI01: NISAR Beta, 5 to 17 Jan 2026, against Copernicus EMSR857 where the 16 Jan (Sentinel-1) and "
                 "18 Jan (COSMO-SkyMed) maps agree. Cropped to the mapped area.", fontsize=12)
    fig.savefig(OUT / "disagreement_aoi01.png", dpi=110)
    plt.close(fig)

    out = {"scores": sc, "errors": errors, "lightgbm_detail": lg_detail, "core_px": CORE_PX,
           "threshold_diagnostic": threshold_diag, "features": features, "jrc_fallback": fallback,
           "v2_vs_v1": v2_vs_v1}
    (OUT / "check_aoi01.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps({k: out[k] for k in ("scores", "errors", "lightgbm_detail", "threshold_diagnostic", "jrc_fallback")},
                     indent=1))
    print(json.dumps({k: v for k, v in v2_vs_v1.items() if k != "split"}, indent=1))
    print(f"  {'zone':40} {'part':18} {'v1 ha':>7} {'v2 ha':>7} {'added':>7} {'gained':>7} {'dropped':>7} "
          f"{'v1 bld':>6} {'v2 bld':>6} {'added':>6}")
    for r in v2_vs_v1["split"]:
        print(f"  {r['zone']:40} {r['part']:18} {r['v1_ha']:7,} {r['v2_ha']:7,} {r['added_ha']:7,} {r['gained_ha']:7,} "
              f"{r['dropped_ha']:7,} {r['v1_buildings']:6} {r['v2_buildings']:6} {r['added_buildings']:6}")
    print(json.dumps({k: v for k, v in features.items() if k != "per_feature"}, indent=1))
    for f in SHOW:
        print(f, json.dumps(feats[f]))
    print("all features, shift in AOI06 IQR (flood, dry) and share outside AOI06 p1-p99:")
    for f in m.FEATURES:
        v = feats[f]
        print(f"  {f:9} {v['shift_flood_in_aoi06_iqr']:6.2f} {v['shift_dry_in_aoi06_iqr']:6.2f} "
              f"{v['aoi01_share_outside_aoi06_p1_p99']:.3f}")
    print(f"Wrote {OUT / 'check_aoi01.json'} and {OUT / 'disagreement_aoi01.png'}")


if __name__ == "__main__":
    main()
