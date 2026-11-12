"""LightGBM flood classifier: tuned on AOI06 with spatial blocks, then tested once on AOI05 against the tuned rule.

Fixed on 12 Nov 2026 before any LightGBM score was computed:
- Features (14, at 30 m): HH and HV on each date, HV minus HH on each date, the HH and HV change, and the 5x5
  local mean and standard deviation of 17 Jan HH, 17 Jan HV and the HH change. All dB values first have that
  area's median over land removed, per date and polarisation: the per-scene calibration the review asks for,
  with no label used. (v1 took land as JRC 0% and DSWx-S1 5 Jan not water; v2 takes JRC 0%, see below.)
- Target: Copernicus observed flood (1) against not flooded (0), on evaluated AOI06 pixels (coverage code 1).
- Post-masks, the same as the rule: valid data, not water before the flood, not permanent water. Pixels these
  remove are left out of training.
- Spatial blocks: 100 x 100 pixel squares (3 km) holding training pixels, shuffled into 5 folds (seed 0).
- Grid: num_leaves {15, 31, 63} x min_data_in_leaf {50, 500, 2000}, learning rate 0.05, 300 rounds. The
  probability threshold is the one with the highest IoU over all out-of-fold predictions pooled (0.01 to 0.99).
- Decision on AOI05: the higher IoU at 3 decimals wins; a tie keeps the rule, which is simpler.

Revised on 12 Nov, on AOI06 only, before AOI05 was read: the first run also left a 2-pixel band around flood
polygon edges out of training and searched thresholds from 0.05. That band held 72% of AOI06's scored flood
(the polygons are fragmented), so the model saw mostly patch interiors: pooled out-of-fold IoU 0.498, with the
threshold stuck at the 0.05 end. The band was dropped and the threshold range widened.

Revised again on 12 Nov, after the AOI05 test (v2): land for the median is now every valid pixel with JRC 0%
occurrence, without needing DSWx-S1 "not water". Found on AOI01 (pipeline/check_aoi01.py): DSWx-S1 covers only
32% of it, and the land it covers is darker, so v1 made AOI01's flood look less dark than AOI06's. The medians
move by under 0.01 dB on AOI05, up to 0.11 dB on AOI06 and 1.1 to 1.6 dB on AOI01. Re-tuned on AOI06 with the
same grid and blocks. v1 stays in data/aoi06/lgbm_model.txt and lgbm_rule.json, and its AOI05 score (IoU 0.572,
data/aoi05/test_lgbm_vs_rule.json) remains the one clean test. AOI05 is scored once more as a post-fix rerun.
Decided before that rerun: the fix stays whatever the number is, and the method choice is reopened only if
LightGBM falls below the tuned rule's AOI05 IoU of 0.521.

  python pipeline\\lgbm_aoi06.py           tune on AOI06; writes data/aoi06/lgbm_model_v2.txt and lgbm_rule_v2.json
  python pipeline\\lgbm_aoi06.py --test    the v1 one-time test; refuses to run, because it has run
  python pipeline\\lgbm_aoi06.py --rerun   post-fix rerun on AOI05, once only; writes data/aoi05/test_lgbm_v2.json
"""
import itertools
import json
import sys
import time
from datetime import datetime, timezone

import lightgbm as lgb
import numpy as np
from scipy.ndimage import uniform_filter

import baseline_aoi05 as b
import prep_aoi05 as p

AOI06, AOI05 = p.ROOT / "data" / "aoi06", p.ROOT / "data" / "aoi05"
MODEL, RULE_JSON = AOI06 / "lgbm_model_v2.txt", AOI06 / "lgbm_rule_v2.json"
TEST, TEST_V2 = AOI05 / "test_lgbm_vs_rule.json", AOI05 / "test_lgbm_v2.json"  # TEST: v1, the one clean test
V1_CV = {"model_file": "lgbm_model.txt", "pooled_oof_iou": 0.57, "threshold": 0.37,
         "land": "JRC 0% and DSWx-S1 5 Jan not water"}
WIN = 5
BLOCK, FOLDS, SEED = 100, 5, 0
SEARCH = {"num_leaves": [15, 31, 63], "min_data_in_leaf": [50, 500, 2000]}
BASE = {"objective": "binary", "learning_rate": 0.05, "feature_fraction": 0.8, "bagging_fraction": 0.8,
        "bagging_freq": 1, "seed": SEED, "deterministic": True, "force_row_wise": True, "verbose": -1}
ROUNDS = 300
THRESHOLDS = np.round(np.arange(0.01, 0.991, 0.01), 2)
STRIP = 512  # rows per strip, so AOI01 (2740 x 3213) never needs its whole feature stack in memory
FEATURES = ["hh1", "hv1", "hh0", "hv0", "hvhh1", "hvhh0", "dhh", "dhv",
            "hh1_mean", "hh1_sd", "hv1_mean", "hv1_sd", "dhh_mean", "dhh_sd"]
RULE_IOU_AOI05 = 0.5207  # tuned rule on AOI05, recorded on 11 Nov; the test run must reproduce it


def offsets(d):
    """Median dB over land (valid pixels with JRC 0% occurrence), per date and polarisation."""
    valid = np.isfinite(d["hh0"]) & np.isfinite(d["hh1"])
    land = valid & (d["jrc"] == 0)
    return {k: round(float(np.nanmedian(d[k][land])), 3) for k in ("hh0", "hh1", "hv0", "hv1")}


def eligible(d):
    """Pixels that can be flood under the rule's post-masks."""
    valid = np.isfinite(d["hh0"]) & np.isfinite(d["hh1"])
    return valid & ~b.before_water(d) & ~b.permanent(d["jrc"])


def local_stats(a, win=WIN):
    """Mean and standard deviation over win x win windows, ignoring NaN."""
    ok = np.isfinite(a)
    x = np.where(ok, a, 0).astype("float64")
    n = uniform_filter(ok.astype("float64"), win, mode="constant")
    m, m2 = uniform_filter(x, win, mode="constant"), uniform_filter(x * x, win, mode="constant")
    empty = n < 0.5 / win ** 2  # no valid pixel in the window (allowing for rounding)
    n[empty] = 1
    mean = m / n
    sd = np.sqrt(np.maximum(m2 / n - mean ** 2, 0))
    mean[empty] = sd[empty] = np.nan
    return mean.astype("float32"), sd.astype("float32")


def features(d, off, r0=0, r1=None):
    """Feature stack (pixels x FEATURES) for rows r0:r1, read with a halo so strips match the whole image."""
    r1 = len(d["hh0"]) if r1 is None else r1
    a0, a1 = max(r0 - WIN // 2, 0), min(r1 + WIN // 2, len(d["hh0"]))
    g = {k: d[k][a0:a1] - off[k] for k in ("hh0", "hh1", "hv0", "hv1")}
    g["hvhh1"], g["hvhh0"] = g["hv1"] - g["hh1"], g["hv0"] - g["hh0"]
    g["dhh"], g["dhv"] = g["hh1"] - g["hh0"], g["hv1"] - g["hv0"]
    for k in ("hh1", "hv1", "dhh"):
        g[k + "_mean"], g[k + "_sd"] = local_stats(g[k])
    cut = slice(r0 - a0, r1 - a0)
    return np.stack([g[f][cut].ravel() for f in FEATURES], axis=1).astype("float32")


def probability(model, d, off):
    """Flood probability for every pixel, computed in row strips."""
    h = len(d["hh0"])
    prob = np.empty(d["hh0"].shape, "float32")
    for r0 in range(0, h, STRIP):
        r1 = min(r0 + STRIP, h)
        prob[r0:r1] = model.predict(features(d, off, r0, r1)).reshape(r1 - r0, -1)
    return prob


def predict(model, d, threshold):
    """Flood mask: probability at or above threshold, then the rule's post-masks."""
    return eligible(d) & (probability(model, d, offsets(d)) >= threshold)


def block_folds(train, block=BLOCK, folds=FOLDS, seed=SEED):
    """Fold per pixel (-1 where the block holds no training pixel): square blocks shuffled into folds."""
    nbx = -(-train.shape[1] // block)
    r, c = np.indices(train.shape)
    bid = (r // block) * nbx + c // block
    used = np.unique(bid[train])
    fold_of = np.full(bid.max() + 1, -1)
    fold_of[used[np.random.default_rng(seed).permutation(len(used))]] = np.arange(len(used)) % folds
    return fold_of[bid]


def ious(prob, elig, truth):
    """IoU at every threshold in THRESHOLDS, for 1-d arrays of the scored pixels."""
    out = []
    for t in THRESHOLDS:
        pred = elig & (prob >= t)
        tp = (pred & truth).sum()
        out.append(tp / max(pred.sum() + truth.sum() - tp, 1))
    return np.array(out)


# Self-checks
_rng = np.random.default_rng(1)
_d = {k: _rng.normal(-12, 4, (23, 9)).astype("float32") for k in ("hh0", "hh1", "hv0", "hv1")}
_d["hh0"][3:6, 2:4] = np.nan
_off = {k: 0.0 for k in _d}
_full = features(_d, _off)
_strips = np.concatenate([features(_d, _off, r, min(r + 6, 23)) for r in range(0, 23, 6)])
assert _full.shape == (23 * 9, len(FEATURES)) and np.allclose(_full, _strips, equal_nan=True), "strips differ"
assert abs(local_stats(np.ones((7, 7), "float32"))[0][3, 3] - 1) < 1e-6
assert np.isclose(local_stats(np.arange(9.0).reshape(3, 3), 3)[0][1, 1], 4.0)
_train = np.zeros((250, 130), bool)
_train[::7, ::3] = True
_train[200:, 100:] = False  # one block with no training pixel
_f = block_folds(_train, 50, 3)
assert set(np.unique(_f[_train])) == {0, 1, 2} and (_f[200:, 100:] == -1).all()
assert all(len(np.unique(_f[i:i + 50, j:j + 50])) == 1 for i in range(0, 250, 50) for j in range(0, 130, 50))


def tune():
    t_start = time.time()
    d = b.load(AOI06)
    coverage = b.scoring(d)
    ev, truth, elig = coverage == 1, d["label"] == 1, eligible(d)
    train = ev & elig
    fold = block_folds(train)
    off = offsets(d)
    p.log(f"AOI06: {train.sum():,} training pixels ({(truth & train).sum() * b.HA:,.0f} ha flooded), "
          f"{ev.sum():,} scored pixels, {len(np.unique(fold[train]))} folds, offsets {off}")
    for k in range(FOLDS):
        m = train & (fold == k)
        p.log(f"  fold {k}: {m.sum():,} training pixels, {(m & truth).sum() * b.HA:,.0f} ha flooded")

    X = features(d, off)
    y = truth.ravel()
    ev_f, tr_f, fold_f, elig_f = ev.ravel(), train.ravel(), fold.ravel(), elig.ravel()
    # Scored pixels in blocks with no training pixel (all ineligible) get fold -1: score them
    # in fold 0, which never trained on them either.
    score_fold = np.where(fold_f < 0, 0, fold_f)

    results = []
    for combo in itertools.product(*SEARCH.values()):
        params = {**BASE, **dict(zip(SEARCH, combo))}
        oof = np.zeros(len(y), "float32")
        for k in range(FOLDS):
            fit = tr_f & (fold_f != k)
            model = lgb.train(params, lgb.Dataset(X[fit], y[fit].astype("float32")), num_boost_round=ROUNDS)
            m = ev_f & (score_fold == k)
            oof[m] = model.predict(X[m])
        curve = ious(oof[ev_f], elig_f[ev_f], y[ev_f])
        i = int(curve.argmax())
        results.append({"params": dict(zip(SEARCH, combo)), "threshold": float(THRESHOLDS[i]),
                        "pooled_iou": float(curve[i]), "oof": oof})
        p.log(f"  {dict(zip(SEARCH, combo))}: pooled out-of-fold IoU {curve[i]:.4f} at threshold {THRESHOLDS[i]:.2f}")

    best = max(results, key=lambda r: r["pooled_iou"])
    rule = json.loads(b.TUNED.read_text(encoding="utf-8"))["rule"]
    rule_pred = b.detect(d, **rule)[0].ravel()
    per_fold = []
    for k in range(FOLDS):
        m = ev_f & (score_fold == k)
        s_l = b.score((elig_f & (best["oof"] >= best["threshold"]))[m], y[m])
        s_r = b.score(rule_pred[m], y[m])
        per_fold.append({"fold": k, "scored_ha": round(float(m.sum() * b.HA)), "lightgbm_iou": round(float(s_l["iou"]), 4),
                         "rule_iou_in_sample": round(float(s_r["iou"]), 4)})
        p.log(f"  fold {k}: LightGBM IoU {s_l['iou']:.3f}, tuned rule {s_r['iou']:.3f} (rule tuned on all of AOI06)")
    pooled = b.score((elig_f & (best["oof"] >= best["threshold"]))[ev_f], y[ev_f])

    params = {**BASE, **best["params"]}
    model = lgb.train(params, lgb.Dataset(X[tr_f], y[tr_f].astype("float32")), num_boost_round=ROUNDS)
    model.save_model(str(MODEL))
    insample = b.score(predict(model, d, best["threshold"])[ev], truth[ev])  # also checks the strip path
    gain = model.feature_importance("gain")
    importance = {f: round(float(g / gain.sum()), 4) for f, g in sorted(zip(FEATURES, gain), key=lambda t: -t[1])}
    RULE_JSON.write_text(json.dumps({
        "model_file": MODEL.name, "features": FEATURES, "window_px": WIN, "params": params, "rounds": ROUNDS,
        "threshold": best["threshold"], "offsets_aoi06": off,
        "version": 2, "land_for_offsets": "valid pixels with JRC 0% occurrence",
        "cv": {"blocks_px": BLOCK, "folds": FOLDS, "seed": SEED, "first_run_with_2px_label_edge_band": {"pooled_oof_iou": 0.4978, "threshold": 0.05},
               "v1": V1_CV,
               "pooled_out_of_fold": {k: round(float(v), 4) for k, v in pooled.items()}, "per_fold": per_fold,
               "search": [{"params": r["params"], "threshold": r["threshold"], "pooled_iou": round(r["pooled_iou"], 4)}
                          for r in results]},
        "aoi06_in_sample_final_model": {k: round(float(v), 4) for k, v in insample.items()},
        "feature_importance_gain_share": importance,
        "training_pixels": int(tr_f.sum()), "minutes": round((time.time() - t_start) / 60, 1),
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }, indent=2), encoding="utf-8")
    p.log(f"Chosen {best['params']}, threshold {best['threshold']:.2f}: pooled out-of-fold IoU {pooled['iou']:.4f} "
          f"(precision {pooled['precision']:.3f}, recall {pooled['recall']:.3f}). Final model in-sample IoU "
          f"{insample['iou']:.4f}. Importance: {importance}")
    p.log(f"Wrote {MODEL} and {RULE_JSON}. Next, once only: python pipeline\\lgbm_aoi06.py --rerun")


def test():
    if TEST.exists():
        sys.exit(f"AOI05 has already been scored: {TEST}. It is a one-time test, so it is not run again.")
    cfg = json.loads(RULE_JSON.read_text(encoding="utf-8"))
    model = lgb.Booster(model_file=str(MODEL))
    rule = json.loads(b.TUNED.read_text(encoding="utf-8"))["rule"]
    d = b.load(AOI05)
    coverage = b.scoring(d)
    ev, truth = coverage == 1, d["label"] == 1
    s_l = b.score(predict(model, d, cfg["threshold"])[ev], truth[ev])
    s_r = b.score(b.detect(d, **rule)[0][ev], truth[ev])
    chosen = "lightgbm" if round(float(s_l["iou"]), 3) > round(float(s_r["iou"]), 3) else "threshold"
    TEST.write_text(json.dumps({
        "chosen": chosen, "decision_rule": "higher AOI05 IoU at 3 decimals wins; a tie keeps the rule",
        "lightgbm": {k: round(float(v), 4) for k, v in s_l.items()},
        "tuned_rule": {k: round(float(v), 4) for k, v in s_r.items()},
        "offsets_aoi05": offsets(d), "lightgbm_threshold": cfg["threshold"], "lightgbm_params": cfg["params"],
        "scored_ha": round(float(ev.sum() * b.HA), 1),
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }, indent=2), encoding="utf-8")
    for name, s in (("LightGBM", s_l), ("tuned rule", s_r)):
        print(f"AOI05 {name:10}: IoU {s['iou']:.4f}  precision {s['precision']:.4f}  recall {s['recall']:.4f}  "
              f"NISAR {s['tp_ha'] + s['fp_ha']:,.0f} ha  both {s['tp_ha']:,.0f}  NISAR only {s['fp_ha']:,.0f}  "
              f"Copernicus only {s['fn_ha']:,.0f}")
    print(f"Chosen: {chosen}. Wrote {TEST}")
    if abs(s_r["iou"] - RULE_IOU_AOI05) > 5e-4:
        print(f"WARNING: the tuned rule gave {s_r['iou']:.4f} on AOI05, not the recorded {RULE_IOU_AOI05}.")


def rerun():
    """Post-fix rerun of the v2 model on AOI05, once only. Not a clean test: the fix was found after the AOI05 test."""
    if TEST_V2.exists():
        sys.exit(f"The post-fix rerun on AOI05 has already been scored: {TEST_V2}. It is not run again.")
    clean = json.loads(TEST.read_text(encoding="utf-8"))
    cfg = json.loads(RULE_JSON.read_text(encoding="utf-8"))
    model = lgb.Booster(model_file=str(MODEL))
    d = b.load(AOI05)
    coverage = b.scoring(d)
    ev, truth = coverage == 1, d["label"] == 1
    assert round(float(ev.sum() * b.HA), 1) == clean["scored_ha"], "the scored area changed since the clean test"
    s = {k: round(float(v), 4) for k, v in b.score(predict(model, d, cfg["threshold"])[ev], truth[ev]).items()}
    reopen = round(s["iou"], 3) < round(RULE_IOU_AOI05, 3)
    TEST_V2.write_text(json.dumps({
        "label": "post-fix rerun",
        "note": "Not a clean test. The land-median fix was found on AOI01 after AOI05 had been used as the test. "
                "The clean held-out figure is the v1 score in test_lgbm_vs_rule.json.",
        "decided_before_scoring": "The fix stays whatever this number is. The method choice is reopened only if "
                                  "LightGBM falls below the tuned rule's AOI05 IoU of 0.521 (at 3 decimals).",
        "reopen_method_choice": reopen,
        "lightgbm_v2": s, "clean_test_lightgbm_v1": clean["lightgbm"], "tuned_rule": clean["tuned_rule"],
        "offsets_aoi05_v2": offsets(d), "offsets_aoi05_v1": clean["offsets_aoi05"], "model_file": MODEL.name,
        "lightgbm_threshold": cfg["threshold"], "lightgbm_params": cfg["params"], "scored_ha": clean["scored_ha"],
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }, indent=2), encoding="utf-8")
    print(f"AOI05 post-fix rerun, LightGBM v2: IoU {s['iou']:.4f}  precision {s['precision']:.4f}  recall "
          f"{s['recall']:.4f}  (clean v1 test: {clean['lightgbm']['iou']:.4f}; rule {clean['tuned_rule']['iou']:.4f})")
    print(f"Reopen the method choice: {reopen}. Wrote {TEST_V2}")


if __name__ == "__main__":
    test() if "--test" in sys.argv else rerun() if "--rerun" in sys.argv else tune()
