"""Is the field-shaped new water in AOI01 irrigation or flood? Diagnostic only: nothing here changes an output.

The field grids are outlined in make_outputs.FIELDS_AOI01. For each, this reports the new water (the method
in data/aoi01/water_new_30m.tif) and the OpenStreetMap buildings in it, and what the other sources say there:
the Copernicus maps of 16 and 18 Jan, JRC occurrence (water seen there in 1984 to 2021), DSWx-S1 on 5 Jan, and
whether NISAR already saw it dark on 5 Jan. It also checks whether the HLS image of 19 Jan can show the ground.

Writes data/aoi01/check_fields_aoi01.json and data/aoi01/check_fields_aoi01.png.

  python pipeline\\check_fields_aoi01.py
"""
import json

import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from matplotlib.patches import Patch
from rasterio.warp import transform

import baseline_aoi05 as b
import fetch_all as f
import make_outputs as mo
import prep_aoi05 as p
import matplotlib.pyplot as plt  # noqa: E402  (prep_aoi05 has already selected the Agg backend)

OUT = p.ROOT / "data" / "aoi01"
DSWX_HLS = {0: "not water", 1: "open water", 2: "partial surface water", 252: "snow/ice", 253: "cloud or cloud shadow",
            254: "ocean masked", 255: "fill (no HLS data)"}  # OPERA DSWx-HLS WTR codes


def read(name):
    with rasterio.open(OUT / name) as s:
        return s.read(1)


def ha(mask):
    return round(float(mask.sum() * b.HA))


def share(mask, of):
    return round(float((mask & of).sum() / max(of.sum(), 1)), 3)


def main():
    grid = f.GRIDS["aoi01"]
    d = b.load(OUT, read("label_agree_aoi01_flood_30m.tif"))
    water_new = read("water_new_30m.tif") == 1
    dl, fep, jrc = read("label_emsr857_aoi01_flood_30m.tif"), read("label_emsr857_aoi01_fep_flood_30m.tif"), d["jrc"]
    rule = json.loads(b.TUNED.read_text(encoding="utf-8"))["rule"]
    info = b.detect(d, **rule)[1]
    with np.errstate(invalid="ignore"):
        dark0 = b.filtered(d, "hh0", {**b.RULE_DEFAULTS, **rule}["filter_px"]) < info["water_threshold_db"][b.BEFORE]

    # Can HLS 19 Jan see the ground?
    hls = {k: read(f"hls_20260119_{k}_30m.tif") for k in ("b02", "b04", "b8a", "b11")}
    covered = hls["b04"] != -9999
    fmask, wtr = read("hls_20260119_fmask_30m.tif"), read("dswx_hls_wtr_20260119_30m.tif")
    codes, counts = np.unique(wtr[covered], return_counts=True)
    hls_check = {"covered_share_of_grid": round(float(covered.mean()), 3),
                 "median_reflectance": {k: round(float(np.median(v[covered])) / 1e4, 3) for k, v in hls.items()},
                 "fmask_cloud_share": round(float(((fmask[covered] >> 1) & 1).mean()), 4),
                 "dswx_hls_classes_share": {DSWX_HLS.get(int(c), str(c)): round(float(n / covered.sum()), 4)
                                            for c, n in zip(codes, counts)}}

    total_ha = ha(water_new)
    feats = json.loads((OUT / "osm_buildings.geojson").read_text(encoding="utf-8"))["features"]
    lon, lat = [ft["geometry"]["coordinates"][0] for ft in feats], [ft["geometry"]["coordinates"][1] for ft in feats]
    total_bld = mo.count_in(lon, lat, grid, water_new)[0]
    areas = {}
    for name, polygons in mo.FIELDS_AOI01.items():
        inside = mo.field_mask(water_new.shape, polygons)
        w = water_new & inside
        n_in, _ = mo.count_in(lon, lat, grid, w)
        x0, y1 = grid[0], grid[1]
        lonlat = [[[round(v, 4) for v in pt] for pt in zip(*transform_px(pg, x0, y1))] for pg in polygons]
        areas[name] = {
            "outline_col_row": polygons, "outline_lon_lat": lonlat, "outline_ha": ha(inside),
            "new_water_ha": ha(w), "share_of_aoi01_new_water": round(ha(w) / max(total_ha, 1), 3),
            "osm_buildings_in_new_water": n_in, "share_of_aoi01_buildings_in_new_water": round(n_in / max(total_bld, 1), 3),
            "of_this_new_water": {
                "copernicus_18_jan_flooded": share(dl == 1, w), "copernicus_18_jan_dry": share(dl == 0, w),
                "copernicus_18_jan_unmapped": share(dl == 255, w),
                "copernicus_16_jan_flooded": share(fep == 1, w), "copernicus_16_jan_dry": share(fep == 0, w),
                "copernicus_16_jan_unmapped": share(fep == 255, w),
                "jrc_water_seen_before_1_to_100pct": share((jrc >= 1) & (jrc <= 100), w),
                "dswx_s1_5_jan_has_data": share(d["dswx0"] != 255, w),
                "nisar_dark_on_5_jan": share(dark0, w), "scored": share(b.scoring(d) == 1, w)}}
    out = {"hls_19_jan": hls_check, "aoi01_new_water_ha": total_ha, "aoi01_buildings_in_new_water": total_bld,
           "field_areas": areas}
    (OUT / "check_fields_aoi01.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=1, ensure_ascii=False))

    # Figure: per field area, radar before and after, HLS true colour, and the reference layers
    colours = ["#000000", "#b8e0b0", "#e5382d", "#7a0000", "#00c8c8"]
    names = ["Not mapped on 18 Jan", "18 Jan: dry", "18 Jan: flooded", "16 Jan: flooded", "JRC: water seen before (>= 1%)"]
    ref = np.select([(jrc >= 1) & (jrc <= 100), fep == 1, dl == 1, dl == 0], [4, 3, 2, 1], 0)
    fig, axes = plt.subplots(len(areas), 4, figsize=(28, 7.5 * len(areas)), constrained_layout=True)
    for row, (name, polygons) in zip(axes, mo.FIELDS_AOI01.items()):
        pts = np.vstack(polygons)
        c0, c1 = max(pts[:, 0].min() - 60, 0), pts[:, 0].max() + 60
        r0, r1 = max(pts[:, 1].min() - 60, 0), pts[:, 1].max() + 60
        sl, ext = (slice(r0, r1), slice(c0, c1)), (c0, c1, r1, r0)
        g1 = np.clip((d["hh1"][sl] + 25) / 25, 0, 1)
        over = np.dstack([g1] * 3)
        over[water_new[sl]] = over[water_new[sl]] * 0.4 + np.array([0.12, 0.47, 1]) * 0.6
        rgb = np.dstack([hls[k][sl] for k in ("b04", "b04", "b02")]).astype("float32") / 1e4
        rgb[..., 1] = read("hls_20260119_b03_30m.tif")[sl] / 1e4
        panels = [(np.clip((d["hh0"][sl] + 25) / 25, 0, 1), "NISAR HH, 5 Jan", "gray", 1),
                  (over, "NISAR HH, 17 Jan, with detected new water (blue)", None, None),
                  (np.clip(rgb, 0, 1), "HLS 19 Jan, true colour, reflectance 0 to 1", None, None),
                  (ref[sl], "Copernicus maps and JRC", ListedColormap(colours), len(colours) - 1)]
        for ax, (img, title, cmap, vmax) in zip(row, panels):
            ax.imshow(img, cmap=cmap, extent=ext, vmin=0, vmax=vmax, interpolation="nearest")
            for pg in polygons:
                ax.plot(*np.vstack([pg, pg[:1]]).T, "-", color="#ffd400", lw=1.5)
            ax.set_title(f"{name}: {title}", fontsize=10)
            ax.axis("off")
    fig.legend(handles=[Patch(color=c, label=n) for c, n in zip(colours, names)] +
               [Patch(edgecolor="#ffd400", facecolor="none", label="Field grid outline")],
               loc="outside lower center", ncol=6, frameon=False)
    fig.suptitle("AOI01 field grids: the HLS image of 19 Jan shows cloud, not ground. Columns and rows of the AOI01 grid.",
                 fontsize=12)
    fig.savefig(OUT / "check_fields_aoi01.png", dpi=70)
    plt.close(fig)
    print(f"Wrote {OUT / 'check_fields_aoi01.json'} and {OUT / 'check_fields_aoi01.png'}")


def transform_px(polygon, x0, y1):
    """(column, row) pixel corners to lon/lat lists."""
    xs, ys = [x0 + c * p.PIX for c, _ in polygon], [y1 - r * p.PIX for _, r in polygon]
    return transform(p.CRS, "EPSG:4326", xs, ys)


if __name__ == "__main__":
    main()
