"""Tune the flood rule on AOI06 (frame 165), the training area. AOI05 is not read here: it is the test area.

Search grid, fixed on 11 Nov 2026 before running, from what the AOI05 baseline missed:
- dark_offset_db 0 to 4: loosen the 17 Jan water threshold (many missed pixels sit just above it)
- drop_db none, 1, 2 or 3: require HH to fall against the background, to hold precision as the threshold loosens
- filter_px 1 or 3: a 3x3 median filter on dB, against speckle at flood edges
- before "nisar+dswx" or "dswx": whether NISAR's own 5 Jan darkness counts as water before the flood
Thresholds and the background shift are refitted on AOI06's own reference water and land, as on AOI05.
The rule with the highest IoU against the Copernicus AOI06 observed layer (Sentinel-1, 17 Jan 03:19 UTC) is
written to data/aoi06/tuned_rule.json. Then run pipeline\\baseline_aoi05.py to score it on AOI05 once.

  python pipeline\\tune_aoi06.py
"""
import itertools
import json
from datetime import datetime, timezone

import numpy as np

import baseline_aoi05 as b
import prep_aoi05 as p

AREA = p.ROOT / "data" / "aoi06"
SEARCH = {"dark_offset_db": [0.0, 1.0, 2.0, 3.0, 4.0], "drop_db": [None, 1.0, 2.0, 3.0], "filter_px": [1, 3],
          "before": ["nisar+dswx", "dswx"]}
STRIPS = 4  # horizontal strips of AOI06, to see whether the chosen rule holds across the area


def show(s):
    return f"IoU {s['iou']:.3f}  precision {s['precision']:.3f}  recall {s['recall']:.3f}"


def main():
    d = b.load(AREA)
    coverage = b.scoring(d)
    ev, truth = coverage == 1, d["label"] == 1
    _, fit = b.detect(d)
    print(f"AOI06: water thresholds {fit['water_threshold_db']}, background change +{fit['background_change_db']} dB, "
          f"reference water {fit['reference_water_ha']:,} ha, reference land {fit['reference_land_ha']:,} ha")
    print(f"Scored {ev.mean():.1%} of the grid ({ev.sum() * b.HA:,.0f} ha), no NISAR data on {(coverage == 0).mean():.1%}. "
          f"Copernicus flood in the scored area: {(truth & ev).sum() * b.HA:,.0f} ha")

    rows = []
    for combo in itertools.product(*SEARCH.values()):
        rule = dict(zip(SEARCH, combo))
        flood, info = b.detect(d, **rule)
        rows.append((b.score(flood[ev], truth[ev]), rule, info))
    rows.sort(key=lambda r: -r[0]["iou"])
    fixed = {name: next(r[0] for r in rows if r[1] == {**b.RULE_DEFAULTS, **rule})
             for name, rule in (("threshold", {}), ("change", {"drop_db": b.DROP_DB}))}

    print(f"\n{len(rows)} rules tried. Best 10 on AOI06:")
    for s, rule, _ in rows[:10]:
        print(f"  {show(s)}   {rule}")
    for name, s in fixed.items():
        print(f"  fixed '{name}' rule on AOI06: {show(s)}")

    best_s, best_rule, best_info = rows[0]
    print("\nStability of the chosen rule across AOI06 (horizontal strips, north to south):")
    flood, base = b.detect(d, **best_rule)[0], b.detect(d)[0]
    for i, rows_idx in enumerate(np.array_split(np.arange(ev.shape[0]), STRIPS)):
        m = np.zeros_like(ev)
        m[rows_idx] = True
        m &= ev
        if (truth & m).sum() == 0:
            continue
        print(f"  strip {i + 1}: tuned {show(b.score(flood[m], truth[m]))}   fixed threshold {show(b.score(base[m], truth[m]))}")

    AREA.joinpath("tuned_rule.json").write_text(json.dumps({
        "rule": best_rule, "summary": b.describe(best_rule), "chosen_by": "highest IoU on AOI06 scored area",
        "aoi06": {k: round(float(v), 4) for k, v in best_s.items()}, "aoi06_fitted": best_info,
        "aoi06_fixed_baselines": {n: {k: round(float(v), 4) for k, v in s.items()} for n, s in fixed.items()},
        "search": SEARCH, "rules_tried": len(rows),
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }, indent=2), encoding="utf-8")
    print(f"\nChosen: {b.describe(best_rule)}\nWrote {AREA / 'tuned_rule.json'}. Next: python pipeline\\baseline_aoi05.py")


if __name__ == "__main__":
    main()
