"""Threshold baselines for AOI05, scored against the Copernicus EMSR857 observed flood layer.

Rules, fixed on 11 Nov 2026 before any score was computed:
- Water threshold per date: the HH value where the share of reference water above it equals the share of
  reference land below it. Reference water: JRC occurrence >= 90% or DSWx-S1 5 Jan open water, one pixel in
  from the edge, at least 100 ha. Reference land: JRC 0% and DSWx-S1 not water on 5 Jan. No other 17 Jan
  map is used, because Copernicus mapped from that same Sentinel-1 pass.
  (Revised the same evening: reference water was JRC >= 90% alone, which gave AOI06 only 2 ha. The first
  AOI05 numbers, under the old definition, are kept in PROGRESS.md.)
- Background change: median HH change (17 Jan minus 5 Jan) over the reference land. The 17 Jan scene is
  about 3 dB brighter, on land and on permanent water, so this is removed before judging any change.
- Water before the flood: NISAR water on 5 Jan, or DSWx-S1 5 Jan open water or inundated vegetation.
- Permanent water: JRC occurrence >= 50%. Never counted as flood (the Copernicus layer leaves it out too).
- Baseline "threshold": water on 17 Jan, not water before, not permanent water.
- Baseline "change": the same, and HH fell by more than 3 dB against the background.
- Unclear, not scored: HH rose by more than 3 dB against the background (possible flooded vegetation).
- Edge buffer, not scored: 2 pixels around the Copernicus mapped-area boundary and around missing NISAR data.

AOI05 is the held-out test area. If data/aoi06/tuned_rule.json exists (written by pipeline/tune_aoi06.py),
that rule is scored here too, unchanged. Nothing is tuned on AOI05.

  python pipeline\\baseline_aoi05.py

Reads data/aoi05 (see docs/DATA_CONTRACT.md). Writes data/aoi05/stats_baseline.json and
data/aoi05/disagreement_baseline.png. With a tuned rule, also writes that rule's contract outputs:
water_new, change_hh and coverage GeoTIFFs in data/aoi05, and the PNG overlays and stats.json in
web/public/data/aoi05.
"""
import itertools
import json
import re
import sys
import warnings
from datetime import datetime, timezone

import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image
from rasterio.transform import array_bounds, from_origin
from rasterio.warp import Resampling, calculate_default_transform, reproject, transform_bounds

import prep_aoi05 as p
import matplotlib.pyplot as plt  # noqa: E402  (prep_aoi05 has already selected the Agg backend)

BEFORE, AFTER = "20260105", "20260117"
WATER_REF_PCT, PERMANENT_PCT, MIN_REF_HA = 90, 50, 100
DROP_DB = RISE_DB = 3.0
EDGE_PX = 2
HA = p.PIX * p.PIX / 1e4
# OPERA DSWx-S1 v1.0 WTR codes. The file only carries a colour table, so the names come from the product
# description (Earth Engine catalogue OPERA/DSWX/L3_V1/S1). The 2023 preliminary spec v0.2.1 used other codes.
DSWX_NAMES = {0: "not water", 1: "open water", 3: "inundated vegetation", 250: "HAND masked",
              251: "layover/shadow masked", 255: "fill (no data)"}
DSWX_WATER = (1, 3)
RULE_DEFAULTS = {"dark_offset_db": 0.0, "drop_db": None, "filter_px": 1, "before": "nisar+dswx"}
TUNED = p.ROOT / "data" / "aoi06" / "tuned_rule.json"
WEB = p.ROOT / "web" / "public" / "data"
COVERAGE_COLOURS = {1: ("#1b9e77", "evaluated"), 2: ("#bdbdbd", "valid, outside the Copernicus mapped area"),
                    3: ("#e6ab02", "unclear: HH rose, possible flooded vegetation"),
                    4: ("#7570b3", "edge buffer, not scored")}  # code 0, no NISAR data, stays transparent


def load(folder):
    """The inputs of one area folder, for example data/aoi05."""
    def read(name):
        with rasterio.open(folder / name) as src:
            return src.read(1)
    return {"hh0": read(f"hh_{BEFORE}_db_30m.tif"), "hh1": read(f"hh_{AFTER}_db_30m.tif"),
            "label": read(f"label_emsr857_{folder.name}_flood_30m.tif"), "jrc": read("jrc_occurrence_30m.tif"),
            "dswx0": read(f"dswx_s1_wtr_{BEFORE}_30m.tif")}


def eer_threshold(water, land):
    """dB value where the share of reference water above it equals the share of reference land below it."""
    lo, hi = -40.0, 10.0
    for _ in range(50):
        t = (lo + hi) / 2
        lo, hi = (t, hi) if (water > t).mean() > (land < t).mean() else (lo, t)
    return t


def dilate(mask, r):
    """True within r pixels (a square window) of any True pixel."""
    return sliding_window_view(np.pad(mask, r), (2 * r + 1, 2 * r + 1)).any(axis=(2, 3))


def median_filter(a, px):
    """Median of each px x px window, ignoring NaN."""
    r = px // 2
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # windows with no valid pixel give NaN
        return np.nanmedian(sliding_window_view(np.pad(a, r, constant_values=np.nan), (px, px)),
                            axis=(2, 3)).astype("float32")


def filtered(d, key, px):
    """d[key] after a px x px median filter, kept in d so a search filters each array once."""
    if px == 1:
        return d[key]
    if (key, px) not in d:
        d[(key, px)] = median_filter(d[key], px)
    return d[(key, px)]


def score(pred, truth):
    tp, fp, fn = (pred & truth).sum(), (pred & ~truth).sum(), (~pred & truth).sum()
    return {"iou": tp / max(tp + fp + fn, 1), "precision": tp / max(tp + fp, 1), "recall": tp / max(tp + fn, 1),
            "tp_ha": tp * HA, "fp_ha": fp * HA, "fn_ha": fn * HA}


def permanent(jrc):
    return (jrc >= PERMANENT_PCT) & (jrc <= 100)


def detect(d, dark_offset_db=0.0, drop_db=None, filter_px=1, before="nisar+dswx"):
    """Flood mask for one area under one rule. Thresholds and the background shift are fitted on that area's
    own reference water and land, so a rule carries over from one area to another."""
    hh0, hh1 = filtered(d, "hh0", filter_px), filtered(d, "hh1", filter_px)
    jrc, dswx0 = d["jrc"], d["dswx0"]
    valid = np.isfinite(hh0) & np.isfinite(hh1)
    known = ((jrc >= WATER_REF_PCT) & (jrc <= 100)) | (dswx0 == 1)
    water_ref = valid & known & ~dilate(~known, 1)  # core pixels only: edges mix water and land
    if water_ref.sum() * HA < MIN_REF_HA:
        raise ValueError(f"Only {water_ref.sum() * HA:.0f} ha of reference water: the thresholds would not be reliable.")
    land_ref = valid & (jrc == 0) & (dswx0 == 0)
    t0, t1 = eer_threshold(hh0[water_ref], hh0[land_ref]), eer_threshold(hh1[water_ref], hh1[land_ref])
    shift = float(np.median((hh1 - hh0)[land_ref]))
    with np.errstate(invalid="ignore"):  # NaN compares as False, and those pixels are not scored anyway
        flood = valid & (hh1 < t1 + dark_offset_db) & ~np.isin(dswx0, DSWX_WATER) & ~permanent(jrc)
        if "nisar" in before:
            flood &= ~(hh0 < t0)
        if drop_db:
            flood &= hh1 - hh0 - shift < -drop_db
    return flood, {"water_threshold_db": {BEFORE: round(t0, 2), AFTER: round(t1, 2)},
                   "background_change_db": round(shift, 2), "reference_water_ha": round(water_ref.sum() * HA),
                   "reference_land_ha": round(land_ref.sum() * HA)}


def scoring(d):
    """Contract coverage codes, from the unfiltered data so that every rule is scored on the same pixels."""
    hh0, hh1, label = d["hh0"], d["hh1"], d["label"]
    valid = np.isfinite(hh0) & np.isfinite(hh1)
    shift = np.median((hh1 - hh0)[valid & (d["jrc"] == 0) & (d["dswx0"] == 0)])
    with np.errstate(invalid="ignore"):
        rose = hh1 - hh0 - shift > RISE_DB
    mapped = label != 255
    edge = dilate(~mapped, EDGE_PX) | dilate(~valid, EDGE_PX)
    return np.select([~valid, ~mapped, edge, rose], [0, 2, 4, 3], 1).astype("uint8")


def describe(rule):
    r = {**RULE_DEFAULTS, **rule}
    parts = [f"HH on 17 Jan below that date's water threshold"
             + (f" plus {r['dark_offset_db']:g} dB" if r["dark_offset_db"] else ""),
             "not water on 5 Jan (" + ("NISAR or DSWx-S1" if "nisar" in r["before"] else "DSWx-S1") + ")",
             f"not permanent water (JRC occurrence >= {PERMANENT_PCT}%)"]
    if r["drop_db"]:
        parts.append(f"HH fell by more than {r['drop_db']:g} dB after removing the scene-wide brightening")
    if r["filter_px"] > 1:
        parts.insert(0, f"{r['filter_px']}x{r['filter_px']} median filter on dB")
    return "; ".join(parts) + "."


assert -18 <= eer_threshold(np.array([-20.0, -19, -18]), np.array([-10.0, -9, -8])) <= -10
_one = np.zeros((5, 5), bool)
_one[2, 2] = True
assert dilate(_one, 1).sum() == 9
assert median_filter(np.where(_one, 99.0, 1.0), 3)[2, 2] == 1.0  # a lone outlier is removed
assert score(np.array([1, 1, 0, 0], bool), np.array([1, 0, 1, 0], bool))["iou"] == 1 / 3

CONTRACT_KEYS = {  # docs/DATA_CONTRACT.md, stats.json: these objects allow no other keys
    None: ["schema_version", "area_id", "name", "generated_utc", "as_of_label", "release", "grid", "scenes",
           "reference", "method", "results", "agreement", "coverage", "files", "limits"],
    "grid": ["epsg", "pixel_m", "width", "height", "bounds_4326"],
    "reference": ["source", "activation", "aoi", "product", "layer", "sensor", "observed_utc", "observed_ha"],
    "method": ["name", "summary", "parameters", "edge_buffer_px"],
    "results": ["flooded_ha", "flooded_ha_in_mapped_area", "hh_median_db_in_label"],
    "agreement": ["iou", "precision", "recall", "evaluated_ha"],
    "coverage": ["evaluated", "outside_mapped_area", "unclear", "edge_excluded", "no_data"],
}
SCENE_KEYS = ["role", "granule_id", "track", "frame", "processing_version", "start_utc", "end_utc", "polarisations"]


def check_contract(stats):
    for key, need in CONTRACT_KEYS.items():
        have = set(stats if key is None else stats[key])
        assert have == set(need), f"stats.{key}: keys differ from the contract: {have ^ set(need)}"
    assert all(set(s) == set(SCENE_KEYS) for s in stats["scenes"]) and len(stats["scenes"]) >= 2
    assert abs(sum(stats["coverage"].values()) - 1) < 1e-3, "coverage shares must sum to 1"
    assert all(0 <= stats["agreement"][k] <= 1 for k in ("iou", "precision", "recall"))
    assert all("bounds_4326" in f for f in stats["files"] if f["format"] == "png")


def rgba(mask, colour, alpha=255):
    """RGBA image: colour where mask is True, fully transparent elsewhere."""
    img = np.zeros(mask.shape + (4,), "uint8")
    img[mask] = [*bytes.fromhex(colour.lstrip("#")), alpha]
    return img


def export(d, pred, coverage, stats):
    """Contract outputs for one rule: GeoTIFFs in data/aoi05, PNG overlays (EPSG:4326) and stats.json for the app."""
    valid = np.isfinite(d["hh0"]) & np.isfinite(d["hh1"])
    water_new = np.where(valid, pred, 255).astype("uint8")
    p.save(p.OUT / "water_new_30m.tif", water_new, 255)
    p.save(p.OUT / "change_hh_db_30m.tif", (d["hh1"] - d["hh0"]).astype("float32"), np.nan)
    p.save(p.OUT / "coverage_30m.tif", coverage, None)

    x0, y1, nx, ny = p.GRID
    src_t = from_origin(x0, y1, p.PIX, p.PIX)
    dst_t, w, h = calculate_default_transform(p.CRS, "EPSG:4326", nx, ny, *array_bounds(ny, nx, src_t))
    bounds = [round(v, 6) for v in array_bounds(h, w, dst_t)]

    def warp(a, nodata):
        dst = np.full((h, w), nodata, a.dtype)
        reproject(a, dst, src_transform=src_t, src_crs=p.CRS, src_nodata=nodata, dst_transform=dst_t,
                  dst_crs="EPSG:4326", dst_nodata=nodata, resampling=Resampling.nearest)
        return dst

    pngs = {}
    for pol, date in itertools.product(("hh", "hv"), (BEFORE, AFTER)):
        with rasterio.open(p.OUT / f"{pol}_{date}_db_30m.tif") as src:
            db = warp(src.read(1), np.nan)
        grey = (np.clip((np.nan_to_num(db, nan=-25) + 25) / 20, 0, 1) * 255).astype("uint8")  # -25 dB black, -5 white
        pngs[f"{pol}_{date}.png"] = np.dstack([grey, grey, grey, np.where(np.isfinite(db), 255, 0).astype("uint8")])
    pngs["water_new.png"] = rgba(warp(water_new, 255) == 1, "#1f78ff")
    pngs["label.png"] = rgba(warp(d["label"], 255) == 1, "#e5382d")
    cov = warp(coverage, 0)
    pngs["coverage.png"] = sum(rgba(cov == code, colour, 170) for code, (colour, _) in COVERAGE_COLOURS.items())

    web = WEB / "aoi05"
    web.mkdir(parents=True, exist_ok=True)
    for name, img in pngs.items():
        Image.fromarray(img, "RGBA").save(web / name, optimize=True)
    files = [{"file": name, "format": "png", "bounds_4326": bounds} for name in pngs]
    files[-1]["legend"] = {"0": "transparent: no NISAR data",
                           **{str(c): f"{col} at alpha 170: {txt}" for c, (col, txt) in COVERAGE_COLOURS.items()}}
    files += [{"file": f"data/aoi05/{n}", "format": "geotiff"}
              for n in ("water_new_30m.tif", "change_hh_db_30m.tif", "coverage_30m.tif")]
    app = {**stats, "files": files}
    check_contract(app)
    (web / "stats.json").write_text(json.dumps(app, indent=2), encoding="utf-8")
    (WEB / "areas.json").write_text(json.dumps(["aoi05"]), encoding="utf-8")
    print(f"Contract outputs written: 3 GeoTIFFs in {p.OUT}, {len(pngs)} PNGs and stats.json in {web}")


def scene(role, date):
    gran = p.GRANULES[date]
    start, end, crid = re.search(r"_(\d{8}T\d{6})_(\d{8}T\d{6})_(X\d{5})_", gran).groups()
    iso = lambda s: datetime.strptime(s, "%Y%m%dT%H%M%S").strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    return {"role": role, "granule_id": gran, "track": 114, "frame": 166, "processing_version": crid,
            "start_utc": iso(start), "end_utc": iso(end), "polarisations": ["HH", "HV"]}


def main():
    d = load(p.OUT)
    print("DSWx-S1 WTR, 5 Jan, class codes found in the file on the AOI05 grid:")
    codes, counts = np.unique(d["dswx0"], return_counts=True)
    for code, n in zip(codes.tolist(), counts.tolist()):
        print(f"  {code:3d}  {DSWX_NAMES.get(code, 'UNKNOWN'):24} {n * HA:10,.0f} ha")
    if set(codes.tolist()) - set(DSWX_NAMES):
        sys.exit("Unknown DSWx-S1 WTR code: check the OPERA product description before using this file.")

    rules = {"threshold": {}, "change": {"drop_db": DROP_DB}}
    if TUNED.exists():
        rules["tuned_on_aoi06"] = json.loads(TUNED.read_text(encoding="utf-8"))["rule"]
    hh0, hh1, label = d["hh0"], d["hh1"], d["label"]
    valid = np.isfinite(hh0) & np.isfinite(hh1)
    mapped, truth = label != 255, label == 1
    coverage = scoring(d)
    ev = coverage == 1
    shares = {k: float((coverage == c).mean()) for k, c in
              (("evaluated", 1), ("outside_mapped_area", 2), ("unclear", 3), ("edge_excluded", 4), ("no_data", 0))}
    flood, info = {}, {}
    for name, rule in rules.items():
        flood[name], info[name] = detect(d, **rule)

    fit = info["threshold"]
    print(f"\nWater thresholds: {fit['water_threshold_db'][BEFORE]:.2f} dB on 5 Jan, "
          f"{fit['water_threshold_db'][AFTER]:.2f} dB on 17 Jan (reference water {fit['reference_water_ha']:,} ha, "
          f"reference land {fit['reference_land_ha']:,} ha)")
    print(f"Background change: +{fit['background_change_db']:.2f} dB (median HH change over reference land)")
    print("Coverage: " + ", ".join(f"{k} {v:.1%}" for k, v in shares.items()))
    print(f"Copernicus observed flood in the scored area: {(truth & ev).sum() * HA:,.0f} ha "
          f"(whole layer on this grid: {truth.sum() * HA:,.0f} ha)")

    x0, y1, nx, ny = p.GRID
    bounds = [round(v, 6) for v in transform_bounds(p.CRS, "EPSG:4326", x0, y1 - ny * p.PIX, x0 + nx * p.PIX, y1)]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        med = {"before": round(float(np.nanmedian(hh0[truth])), 2), "after": round(float(np.nanmedian(hh1[truth])), 2)}
    png = "disagreement_baseline.png"
    out, scores = {}, {}
    for name, pred in flood.items():
        s = scores[name] = score(pred[ev], truth[ev])
        rule = {**RULE_DEFAULTS, **rules[name]}
        limits = [
            "NISAR Beta data: not fully calibrated. The 17 Jan scene is about 3 dB brighter overall, so each "
            "date gets its own water threshold.",
            "Agreement with Copernicus, not accuracy: the reference is a Sentinel-1 (C-band) map made 24 "
            "minutes before the NISAR pass, not ground truth.",
            f"Pixels where HH rose by more than {RISE_DB:g} dB (possible flooded vegetation) are not scored. "
            "This method only finds open water.",
            f"Permanent water (JRC occurrence >= {PERMANENT_PCT}%) is never counted as flood.",
            f"A {EDGE_PX}-pixel band along the Copernicus mapped-area edge is not scored. Flood polygon "
            "edges are scored.",
            "Thresholds come from reference water and land on each date, not from the Copernicus label.",
        ]
        if name == "tuned_on_aoi06":
            limits.append("This rule's settings were chosen on AOI06 (frame 165, Copernicus AOI06) and applied "
                          "to AOI05 once, unchanged.")
        out[name] = {
            "schema_version": "1.0", "area_id": "aoi05", "name": "AOI05 Chinhangane, Mozambique",
            "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "as_of_label": "17 Jan 2026, 03:42 UTC", "release": "Beta",
            "grid": {"epsg": p.EPSG, "pixel_m": p.PIX, "width": nx, "height": ny, "bounds_4326": bounds},
            "scenes": [scene("before", BEFORE), scene("after", AFTER)],
            "reference": {"source": "Copernicus EMS", "activation": "EMSR857", "aoi": "AOI05",
                          "product": "Delineation (DEL), monitoring 0, version 1", "layer": "observedEventA",
                          "sensor": "Sentinel-1", "observed_utc": "2026-01-17T03:18:00Z",
                          "observed_ha": p.EMS_OBSERVED_HA},
            "method": {"name": "threshold", "summary": describe(rule), "edge_buffer_px": EDGE_PX,
                       "parameters": {"baseline": name, "polarisation": "HH", **rule, **info[name],
                                      "threshold_rule": "equal-error point between reference water "
                                                        f"(JRC >= {WATER_REF_PCT}% or DSWx-S1 5 Jan open "
                                                        "water, one pixel in from the edge) and reference "
                                                        "land (JRC 0% and DSWx-S1 5 Jan not water)",
                                      "unclear_rise_db": RISE_DB, "permanent_water_jrc_pct": PERMANENT_PCT,
                                      "tuned_on": "aoi06" if name == "tuned_on_aoi06" else None}},
            "results": {"flooded_ha": round(float((pred & valid).sum() * HA), 1),
                        "flooded_ha_in_mapped_area": round(float((pred & valid & mapped).sum() * HA), 1),
                        "hh_median_db_in_label": med},
            "agreement": {"iou": round(float(s["iou"]), 4), "precision": round(float(s["precision"]), 4),
                          "recall": round(float(s["recall"]), 4), "evaluated_ha": round(float(ev.sum() * HA), 1)},
            "coverage": {k: round(v, 6) for k, v in shares.items()},
            "files": [{"file": png, "format": "png", "bounds_4326": bounds,
                       "note": "Check figure, one panel per rule in UTM 36S, not a map overlay"}],
            "limits": limits,
        }
        check_contract(out[name])
    (p.OUT / "stats_baseline.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    if "tuned_on_aoi06" in out:
        export(d, flood["tuned_on_aoi06"], coverage, out["tuned_on_aoi06"])

    # Disagreement map: one panel per rule
    colours = ["#d9d9d9", "#7f7f7f", "#ffffff", "#009E73", "#E69F00", "#CC79A7", "#56B4E9"]
    names = ["Not scored (outside mapped area, edge, no data)", "Unclear: HH rose (possible flooded vegetation)",
             "Agree: not flooded", "Agree: flooded", "NISAR only", "Copernicus only", "Permanent water (JRC >= 50%)"]
    fig, axes = plt.subplots(1, len(flood), figsize=(9 * len(flood), 8.8), constrained_layout=True)
    for ax, (name, pred) in zip(axes, flood.items()):
        c = np.zeros(coverage.shape, "uint8")
        c[coverage == 3] = 1
        c[ev] = 2
        c[ev & pred & truth], c[ev & pred & ~truth], c[ev & ~pred & truth] = 3, 4, 5
        c[permanent(d["jrc"]) & valid] = 6
        ax.imshow(c, cmap=ListedColormap(colours), vmin=0, vmax=len(colours) - 1, interpolation="nearest")
        s = scores[name]
        ax.set_title(f"'{name}': IoU {s['iou']:.2f}, precision {s['precision']:.2f}, recall {s['recall']:.2f}")
        ax.axis("off")
    fig.legend(handles=[Patch(color=col, label=n) for col, n in zip(colours, names)], loc="outside lower center",
               ncol=4, frameon=False)
    fig.suptitle("AOI05: NISAR Beta, 5 to 17 Jan 2026, against the Copernicus EMSR857 observed flood "
                 "(Sentinel-1, 17 Jan 03:18 UTC)", fontsize=13)
    fig.savefig(p.OUT / png, dpi=130)
    plt.close(fig)

    print("\nAgreement with Copernicus inside the scored area:")
    print(f"  {'rule':15} {'IoU':>6} {'precision':>10} {'recall':>7} {'NISAR ha':>9} {'both ha':>8} "
          f"{'NISAR only':>11} {'Copernicus only':>16}")
    for name, s in scores.items():
        print(f"  {name:15} {s['iou']:6.3f} {s['precision']:10.3f} {s['recall']:7.3f} "
              f"{s['tp_ha'] + s['fp_ha']:9,.0f} {s['tp_ha']:8,.0f} {s['fp_ha']:11,.0f} {s['fn_ha']:16,.0f}")
    if "tuned_on_aoi06" in rules:
        print(f"  tuned rule: {describe(rules['tuned_on_aoi06'])}")
    print(f"\nWrote {p.OUT / 'stats_baseline.json'} and {p.OUT / png}")


if __name__ == "__main__":
    main()
