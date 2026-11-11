"""Prepare AOI05 (Copernicus EMSR857, Chinhangane) for ChangeProof.

Reads only the AOI from two NISAR GCOV Beta files (5 and 17 Jan 2026, track 114,
frame 166), converts HH and HV to dB at 30 m, puts the Copernicus flood layer on
the same grid and saves a check image.

  python pipeline\\prep_aoi05.py              stream the AOI over HTTPS (default)
  python pipeline\\prep_aoi05.py --download   fallback: download the full files first (about 4.5 GB)

Needs the EARTHDATA_TOKEN environment variable (an Earthdata Login bearer token).
"""
import argparse
import math
import os
import re
import sys
import time
import warnings
from pathlib import Path

import fsspec
import h5py
import matplotlib
import numpy as np
import rasterio
import requests
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds, transform_geom

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT, RAW = ROOT / "data" / "aoi05", ROOT / "data" / "raw"

ASF = "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_BETA_V1/{g}/{g}.h5"
GRANULES = {
    "20260105": "NISAR_L2_PR_GCOV_009_114_A_166_4005_DHDH_A_20260105T034252_20260105T034303_X05010_N_P_J_001",
    "20260117": "NISAR_L2_PR_GCOV_010_114_A_166_4005_DHDH_A_20260117T034253_20260117T034303_X05010_N_P_J_001",
}
LABEL_URL = ("https://rapidmapping-viewer.s3.eu-west-1.amazonaws.com/EMSR857/AOI{aoi:02d}/{product}_PRODUCT/"
             "EMSR857_AOI{aoi:02d}_{product}_PRODUCT_observedEventA_v1.json")
EMS_API = "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?code=EMSR857"
# Sum of the observed layer's own "area" field. Copernicus's headline 14,324.8 ha for this
# product is the modelled extent (modelledEventA), which we do not use as a label.
EMS_OBSERVED_HA = 9702.9
BBOX = (32.12, -24.21, 32.64, -23.80)  # AOI05 lon/lat bounds plus about 1 km
EPSG = 32736  # UTM zone 36S, the projection NISAR uses here
GROUP = "/science/LSAR/GCOV/grids/frequencyA"
PIX = 30  # output pixel size in metres


def make_grid(bbox=BBOX):
    """Output grid snapped to multiples of PIX so every raster lines up. Returns (x0, y1, nx, ny)."""
    left, bottom, right, top = transform_bounds("EPSG:4326", f"EPSG:{EPSG}", *bbox)
    x0, y1 = math.floor(left / PIX) * PIX, math.ceil(top / PIX) * PIX
    return x0, y1, math.ceil((right - x0) / PIX), math.ceil((y1 - bottom) / PIX)


GRID = make_grid()
X0, Y1, NX, NY = GRID
CRS = f"EPSG:{EPSG}"


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def block_mean(a, f):
    """Average f x f blocks, ignoring NaN. Use on linear power, before dB."""
    h, w = a.shape[0] // f, a.shape[1] // f
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # blocks with no valid pixel give NaN
        return np.nanmean(a[:h * f, :w * f].reshape(h, f, w, f), axis=(1, 3))


assert block_mean(np.arange(36.0).reshape(6, 6), 3)[0, 0] == 7.0


def save(path, arr, nodata, grid=GRID):
    with rasterio.open(path, "w", driver="GTiff", height=arr.shape[0], width=arr.shape[1], count=1,
                       dtype=arr.dtype, crs=CRS, transform=from_origin(grid[0], grid[1], PIX, PIX),
                       nodata=nodata, compress="deflate") as dst:
        dst.write(arr, 1)


def check_access(url):
    """Stop with a clear message if Earthdata will not serve the file. Returns auth headers."""
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        sys.exit("EARTHDATA_TOKEN is not set. Create a token at https://urs.earthdata.nasa.gov "
                 '(Generate Token), then in PowerShell run:  $env:EARTHDATA_TOKEN = "<your token>"')
    headers = {"Authorization": f"Bearer {token}"}
    with requests.get(url, headers={**headers, "Range": "bytes=0-7"}, stream=True, timeout=60) as r:
        if r.status_code not in (200, 206) or r.headers.get("Content-Type", "").startswith("text/html"):
            sys.exit(f"Earthdata did not serve {url.rsplit('/', 1)[-1]} (HTTP {r.status_code}). The token may be "
                     "expired or mistyped. Tokens last 60 days. Also sign in once at "
                     "https://search.asf.alaska.edu and download any NISAR file there to accept the terms.")
    return headers


def download(url, dest, headers):
    """Full-file fallback. Writes to .part first so a broken download is never mistaken for a good file."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    with requests.get(url, headers=headers, stream=True, timeout=60) as r:
        r.raise_for_status()
        total, done, last = int(r.headers.get("Content-Length", 0)), 0, time.time()
        log(f"Downloading {dest.name} ({total / 1e9:.2f} GB) ...")
        with open(part, "wb") as fh:
            for chunk in r.iter_content(8 << 20):
                fh.write(chunk)
                done += len(chunk)
                if time.time() - last > 15:
                    log(f"  {done / 1e9:.2f} of {total / 1e9:.2f} GB")
                    last = time.time()
    if total and done != total:
        sys.exit(f"Download stopped early ({done} of {total} bytes). Run the same command again.")
    part.replace(dest)


def read_db(h5, tag, grid=GRID):
    """Read the AOI window of HH and HV, average to PIX metres and return dB arrays on the output grid."""
    x0, y1, nx, ny = grid
    g = h5[GROUP]
    epsg = int(np.ravel(g["projection"].attrs["epsg_code"])[0])
    if epsg != EPSG:
        sys.exit(f"{tag}: file is in EPSG:{epsg}, expected EPSG:{EPSG}.")
    xs, ys = g["xCoordinates"][:], g["yCoordinates"][:]
    dx, dy = float(xs[1] - xs[0]), float(ys[0] - ys[1])
    f = round(PIX / dx) if dx > 0 else 0
    if dy <= 0 or abs(dx - dy) > 1e-6 or f < 1 or abs(f * dx - PIX) > 1e-6:
        sys.exit(f"{tag}: unexpected source grid ({dx:g} x {dy:g} m); cannot average to {PIX} m.")
    # shortcut: assumes x/yCoordinates are pixel centres; if they are corners the output shifts by
    # half a source pixel (5 m). Revisit only if sub-pixel alignment starts to matter.
    c0 = round((x0 - (xs[0] - dx / 2)) / dx)
    r0 = round((ys[0] + dy / 2 - y1) / dy)
    log(f"{tag}: source pixels {dx:g} m, averaging {f}x{f}. Offset from the output grid: "
        f"{xs[0] - dx / 2 + c0 * dx - x0:+.1f} m east, {ys[0] + dy / 2 - r0 * dy - y1:+.1f} m north "
        "(should be the same on both dates)")
    rows, cols = ny * f, nx * f
    ra, rb, ca, cb = max(r0, 0), min(r0 + rows, len(ys)), max(c0, 0), min(c0 + cols, len(xs))
    if ra >= rb or ca >= cb:
        sys.exit(f"{tag}: the AOI is outside this file.")
    out = {}
    for name, layer in (("hh", "HHHH"), ("hv", "HVHV")):
        ds, t0 = g[layer], time.time()
        step, last = ds.chunks[0] if ds.chunks else 512, t0
        full = np.full((rows, cols), np.nan, np.float32)  # NaN where the file has no data
        r = ra
        while r < rb:
            e = min((r // step + 1) * step, rb)  # end on a chunk edge so no chunk is read twice
            full[r - r0:e - r0, ca - c0:cb - c0] = ds[r:e, ca:cb]
            r = e
            if r >= rb or time.time() - last > 10:
                share, spent, last = (r - ra) / (rb - ra), time.time() - t0, time.time()
                log(f"  {tag} {name.upper()}: {share:4.0%} read, {spent / 60:.1f} min spent, "
                    f"about {spent / share * (1 - share) / 60:.1f} min left")
        full[~(full > 0)] = np.nan  # zero, negative and fill values are not valid power
        out[name] = (10 * np.log10(block_mean(full, f))).astype("float32")
    return out


def make_label(aoi=5, product="DEL", grid=GRID, out=None):
    """Copernicus flood polygons on the output grid: 1 flooded, 0 not flooded, 255 outside the mapped AOI.
    Uses the first (monitoring 0) product of the given type, for example DEL or FEP."""
    x0, y1, nx, ny = grid
    transform = from_origin(x0, y1, PIX, PIX)
    log(f"Downloading the Copernicus EMSR857 AOI{aoi:02d} {product} flood layer ...")
    r = requests.get(LABEL_URL.format(aoi=aoi, product=product), timeout=180)
    r.raise_for_status()
    features = r.json()["features"]
    shapes = [transform_geom("EPSG:4326", CRS, ft["geometry"]) for ft in features]
    flood = rasterize(shapes, out_shape=(ny, nx), transform=transform, fill=0, default_value=1, dtype="uint8")
    try:  # pixels outside the area Copernicus mapped are unknown, not dry
        act = requests.get(EMS_API, timeout=60).json()["results"][0]
        ems_aoi = next(a for a in act["aois"] if a["number"] == aoi)
        prod = next(p for p in ems_aoi["products"] if p["type"] == product and p["monitoringNumber"] == 0)
        if not prod["extent"].startswith("POLYGON ((") or prod["extent"].count("(") != 2:
            raise ValueError("AOI outline is not a simple polygon")
        ring = [(float(x), float(y)) for x, y in re.findall(r"(-?[\d.]+) (-?[\d.]+)", prod["extent"])]
        outline = transform_geom("EPSG:4326", CRS, {"type": "Polygon", "coordinates": [ring]})
        flood[rasterize([outline], out_shape=(ny, nx), transform=transform) == 0] = 255
    except Exception as err:
        log(f"WARNING: no AOI outline ({err}). Pixels outside the mapped AOI are 0 instead of 255.")
    save(out or OUT / "label_emsr857_aoi05_flood_30m.tif", flood, 255, grid)
    own = sum(float(ft["properties"].get("area") or 0) for ft in features)
    log(f"Label saved: {len(shapes)} polygons, {(flood == 1).sum() * PIX * PIX / 1e4:,.0f} ha flooded on the grid "
        f"(the layer's own area field: {own:,.1f} ha; expect within 5% if the grid covers the whole AOI)")
    return flood


def make_png(before, after, flood, path):
    fig, axes = plt.subplots(1, 3, figsize=(19, 6), constrained_layout=True)
    titles = ("NISAR HH, 5 Jan 2026 (before)", "NISAR HH, 17 Jan 2026 (after)",
              "17 Jan with Copernicus flood outline (red)")
    for ax, img, title in zip(axes, (before, after, after), titles):
        ax.imshow(img, cmap="gray", vmin=-25, vmax=-5)
        ax.set_title(title)
        ax.axis("off")
    axes[2].contour((flood == 1).astype(float), levels=[0.5], colors="red", linewidths=0.5)
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help="download the full files first instead of streaming")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    log(f"Output grid: {NX} x {NY} pixels of {PIX} m in {CRS}. Output folder: {OUT}")

    flood = make_label()
    hh = {}
    for date, gran in GRANULES.items():
        paths = {pol: OUT / f"{pol}_{date}_db_30m.tif" for pol in ("hh", "hv")}
        if all(p.exists() for p in paths.values()):
            log(f"{date}: GeoTIFFs already exist, skipping (delete them to redo)")
        else:
            url, src = ASF.format(g=gran), RAW / f"{gran}.h5"
            if args.download:
                if not src.exists():
                    download(url, src, check_access(url))
                log(f"{date}: reading {src.name} from disk")
            else:
                log(f"{date}: streaming the AOI from ASF. If the time left looks worse than 15 minutes, "
                    "press Ctrl+C and rerun with --download")
                fs = fsspec.filesystem("http", headers=check_access(url), cache_type="background",
                                       block_size=8 << 20)
                src = fs.open(url, "rb")
            with h5py.File(src, "r", rdcc_nbytes=64 << 20) as h5:
                for pol, arr in read_db(h5, date).items():
                    save(paths[pol], arr, np.nan)
        with rasterio.open(paths["hh"]) as ds:
            hh[date] = ds.read(1)

    before, after = hh["20260105"], hh["20260117"]
    make_png(before, after, flood, OUT / "check_aoi05.png")

    valid = min(np.isfinite(before).mean(), np.isfinite(after).mean())
    ha = float((flood == 1).sum()) * PIX * PIX / 1e4
    inside = flood == 1
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        med_b, med_a = np.nanmedian(before[inside]), np.nanmedian(after[inside])

    def mark(ok):
        return "OK   " if ok else "CHECK"

    print("\nDONE. Files are in", OUT)
    print("What success looks like:")
    print(f"  {mark(True)} 1. Five GeoTIFFs on one grid: {NX} x {NY} pixels, {PIX} m, {CRS}")
    print(f"  {mark(valid >= 0.9)} 2. NISAR pixels with data: {valid:.0%} (expect 90% or more)")
    print(f"  {mark(abs(ha - EMS_OBSERVED_HA) / EMS_OBSERVED_HA < 0.05)} 3. Label flooded area: {ha:,.0f} ha "
          f"(Copernicus observed layer: {EMS_OBSERVED_HA:,.1f} ha; expect within 5%)")
    print(f"        4. Median HH inside the Copernicus flood area: {med_b:.1f} dB on 5 Jan, {med_a:.1f} dB on 17 Jan.")
    print("           Lower on 17 Jan means open water shows up. Similar or higher: look at the image,")
    print("           it can be flooded vegetation (bright in HH) or a data problem.")
    print("        5. Open check_aoi05.png: the red outline should follow areas that turned darker.")


if __name__ == "__main__":
    main()
