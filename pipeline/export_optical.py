"""Optical images nearest the 17 Jan NISAR pass, for the web app's cloud card (AOI01 only).

- HLS 19 Jan (Sentinel-2C via HLS, tile T36JWT): true colour from B04/B03/B02, already on the AOI01 grid in data/aoi01.
- Landsat 9, 20 Jan: the Planetary Computer rendered preview in data/landsat, cropped to the AOI01 extent.

Cloud figures are computed here from the local files, never typed in. Writes web/public/data/aoi01/:
hls_20260119.webp, landsat_20260120.webp and optical.json.

  python pipeline\\export_optical.py
"""
import json

import numpy as np
import rasterio
from PIL import Image

import fetch_all as f
import prep_aoi05 as p

AREA = "aoi01"
DATA, WEB = p.ROOT / "data", p.ROOT / "web" / "public" / "data" / AREA
HLS_ID = f.HLS
LANDSAT_ID = f.LANDSAT[0]
FALSE_NORTHING = 10_000_000  # UTM 36S (EPSG:32736) northing = UTM 36N (EPSG:32636) northing + 10,000,000 m
FMASK_CLOUD, FMASK_SNOW = 1 << 1, 1 << 4  # HLS v2 Fmask bits
DSWX_SNOW, DSWX_CLOUD, DSWX_FILL = 252, 253, 255


def read(name):
    with rasterio.open(DATA / AREA / name) as s:
        return s.read(1)


def share(mask, of):
    return round(float(mask[of].mean()), 4)


def hls():
    x0, y1, nx, ny = f.GRIDS[AREA]
    bands = [read(f"hls_20260119_{b}_30m.tif") for b in ("b04", "b03", "b02")]
    assert all(b.shape == (ny, nx) for b in bands)
    valid = (bands[0] != -9999) & (bands[1] != -9999) & (bands[2] != -9999)
    rgb = np.stack([np.clip(b * 0.0001 / 0.3, 0, 1) * 255 for b in bands], -1).astype("uint8")  # reflectance 0 to 0.3
    img = np.dstack([rgb, np.where(valid, 255, 0).astype("uint8")])[::2, ::2]  # every second pixel, as the grey overlays
    Image.fromarray(img, "RGBA").save(WEB / "hls_20260119.webp", quality=80)

    fmask, dswx = read("hls_20260119_fmask_30m.tif"), read("dswx_hls_wtr_20260119_30m.tif")
    fm_ok, dx_ok = fmask != 255, dswx != DSWX_FILL
    fig = {"tile_covers_share_of_area": round(float(valid.mean()), 4),
           "fmask_cloud_share": share((fmask & FMASK_CLOUD) > 0, fm_ok),
           "fmask_snow_ice_share": share((fmask & FMASK_SNOW) > 0, fm_ok),
           "dswx_hls_snow_ice_share": share(dswx == DSWX_SNOW, dx_ok),
           "dswx_hls_cloud_share": share(dswx == DSWX_CLOUD, dx_ok),
           "scope": "shares of the AOI01 pixels the HLS tile covers"}
    for k, v in fig.items():
        assert k == "scope" or 0 <= v <= 1, (k, v)
    return fig, img.shape


def landsat():
    item = json.loads((DATA / "landsat" / f"{LANDSAT_ID}.json").read_text(encoding="utf-8"))
    assert item["properties"]["proj:epsg"] == 32636
    a, _, gx0, _, e, gy1 = item["properties"]["proj:transform"][:6]  # shared by the 30 m bands
    rows, cols = item["properties"]["proj:shape"]
    im = Image.open(DATA / "landsat" / f"{LANDSAT_ID}_preview.png").convert("RGBA")
    assert abs(im.width / im.height - cols / rows) < 0.01, "preview is not the asset grid scaled"
    sx, sy = a * cols / im.width, -e * rows / im.height  # metres per preview pixel

    x0, y1, nx, ny = f.GRIDS[AREA]
    left, top = (x0 - gx0) / sx, (gy1 - (y1 - FALSE_NORTHING)) / sy
    right, bottom = left + nx * p.PIX / sx, top + ny * p.PIX / sy
    box = tuple(round(v) for v in (left, top, right, bottom))
    assert 0 <= box[0] < box[2] <= im.width and 0 <= box[1] < box[3] <= im.height, box
    crop = im.crop(box)
    crop.save(WEB / "landsat_20260120.webp", quality=80)
    props = item["properties"]
    fig = {"scene_cloud_share": round(props["eo:cloud_cover"] / 100, 4),
           "scene_land_cloud_share": round(props["landsat:cloud_cover_land"] / 100, 4),
           "scope": "whole Landsat scene (path 167, row 77), from USGS metadata"}
    return fig, crop.size, props["datetime"], round(sx)


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    hfig, hshape = hls()
    lfig, lsize, ldate, lpix = landsat()
    p.log(f"HLS {hshape[1]} x {hshape[0]} px: {hfig}")
    p.log(f"Landsat crop {lsize[0]} x {lsize[1]} px at about {lpix} m: {lfig}")
    out = {
        "area_id": AREA,
        "images": [
            {"file": "hls_20260119.webp", "date_utc": "2026-01-19T07:32:31Z",
             "source": "Sentinel-2C via NASA HLS (HLSS30 v2.0), true colour", "product_id": HLS_ID,
             "cloud": hfig},
            {"file": "landsat_20260120.webp", "date_utc": ldate[:19] + "Z",
             "source": "Landsat 9 Collection 2 Level-2, USGS, preview from Microsoft Planetary Computer",
             "product_id": LANDSAT_ID, "pixel_m": lpix, "cloud": lfig},
        ],
        "note": "The nearest free optical images we checked (19 and 20 Jan) were cloud. Radar saw through.",
    }
    (WEB / "optical.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    for im in out["images"]:
        assert (WEB / im["file"]).stat().st_size < 1_000_000, im["file"]
    p.log(f"Wrote {WEB / 'optical.json'}")


if __name__ == "__main__":
    main()
