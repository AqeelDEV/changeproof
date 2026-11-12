"""Checks on AOI01, where the tuned rule scores higher than LightGBM. Diagnostic only: nothing here changes a
method, a threshold or an output file.

1. Both methods against the AOI01 agreement label (16 and 18 Jan Copernicus maps where they agree): IoU,
   precision, recall, and where LightGBM's errors sit (missed core flood, missed flood edge, extra water inside
   the scored area, water outside it).
2. Whether AOI01's normalised features look like AOI06's (the training area): land medians, and feature
   percentiles for flood and dry pixels. AOI05, the held-out area, is not read here beyond its stats.json offsets.
3. The rule's AOI01 IoU with and without the JRC fallback, against the value in stats.json.

Writes data/aoi01/check_aoi01.json and data/aoi01/disagreement_aoi01.png.

Written for the v1 model, whose results are in PROGRESS.md ("AOI01 checks", 12 Nov). Rerun now, it uses the v2
model and v2 land medians (JRC 0% land), which this check led to.

  python pipeline\\check_aoi01.py
"""
import json

import lightgbm as lgb
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch

import baseline_aoi05 as b
import lgbm_aoi06 as m
import make_outputs as mo
import prep_aoi05 as p
import matplotlib.pyplot as plt  # noqa: E402  (prep_aoi05 has already selected the Agg backend)

DATA = p.ROOT / "data"
OUT = DATA / "aoi01"
CORE_PX = 3  # core flood: agreed flood at least 3 pixels (90 m) from any pixel that is not agreed flood
PCTS = (5, 25, 50, 75, 95)
SHOW = ["hh1", "hh1_mean", "hv1", "hh0", "dhh"]  # features printed and logged; all 14 go in the JSON


def ha(mask):
    return round(float(mask.sum() * b.HA))


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
        land, jrc0 = v & (dd["jrc"] == 0) & (dd["dswx0"] == 0), v & (dd["jrc"] == 0)
        return {"offsets_db": o, "reference_land_ha": ha(land), "reference_land_share_of_valid": round(float(land.sum() / v.sum()), 3),
                "hh1_median_jrc0_only_db": round(float(np.nanmedian(dd["hh1"][jrc0])), 3),
                "hh0_median_jrc0_only_db": round(float(np.nanmedian(dd["hh0"][jrc0])), 3)}
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
    jrc0 = valid & (d["jrc"] == 0)
    alt = {"used": off, "aoi06_offsets_same_frame": off6,
           "aoi01_land_jrc0_only": {k: round(float(np.nanmedian(d[k][jrc0])), 3) for k in ("hh0", "hh1", "hv0", "hv1")}}
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
        ax.set_title(f"{name.replace('_', ' ')}: IoU {s['iou']:.2f}, precision {s['precision']:.2f}, "
                     f"recall {s['recall']:.2f}")
        ax.axis("off")
    fig.legend(handles=[Patch(color=col, label=n) for col, n in zip(colours, names)], loc="outside lower center",
               ncol=4, frameon=False)
    fig.suptitle("AOI01: NISAR Beta, 5 to 17 Jan 2026, against Copernicus EMSR857 where the 16 Jan (Sentinel-1) and "
                 "18 Jan (COSMO-SkyMed) maps agree. Cropped to the mapped area.", fontsize=12)
    fig.savefig(OUT / "disagreement_aoi01.png", dpi=110)
    plt.close(fig)

    out = {"scores": sc, "errors": errors, "lightgbm_detail": lg_detail, "core_px": CORE_PX,
           "threshold_diagnostic": threshold_diag, "features": features, "jrc_fallback": fallback}
    (OUT / "check_aoi01.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps({k: out[k] for k in ("scores", "errors", "lightgbm_detail", "threshold_diagnostic", "jrc_fallback")},
                     indent=1))
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
