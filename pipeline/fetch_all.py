"""Download and prepare all remaining ChangeProof data, for an unattended overnight run.

Every item is independent: a failure is logged and the run carries on. Finished items are skipped, so
running the same command again resumes. Log: data\\fetch_log.txt. A summary is printed at the end.

  python pipeline\\fetch_all.py              stream the NISAR crops; if streaming fails, download the
                                            full frame 165 file for that date instead (about 4 GB each)
  python pipeline\\fetch_all.py --download   download the full frame 165 files first (about 8.2 GB)

NISAR, OPERA and HLS need the EARTHDATA_TOKEN environment variable (see prep_aoi05.py).
Copernicus, JRC, OpenStreetMap and the Landsat previews need no login.
"""
import argparse
import json
import os
import sys
import time
import traceback

import fsspec
import h5py
import numpy as np
import rasterio
import requests
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

import prep_aoi05 as p

DATA, RAW = p.ROOT / "data", p.RAW
AREAS = {  # lon/lat bounds plus about 1 km
    "aoi05": p.BBOX,                          # Copernicus AOI05 Chinhangane, frame 166 (crops made by prep_aoi05.py)
    "aoi06": (32.72, -25.61, 32.94, -25.06),  # AOI06 Palmeira, about 67% inside frame 165
    "aoi01": (32.84, -25.10, 33.79, -24.36),  # AOI01 Chibabel: Chokwe, Macia and Xai-Xai, all inside frame 165
}
GRIDS = {area: p.make_grid(bbox) for area, bbox in AREAS.items()}
assert GRIDS["aoi05"] == p.GRID and GRIDS["aoi05"][2:] == (1771, 1522)  # AOI05 keeps the grid already in data/aoi05
UNION = tuple(f(b[i] for b in AREAS.values()) for i, f in enumerate((min, min, max, max)))

NISAR_165 = {  # track 114, frame 165, same processing (X05010) on both dates
    "20260105": "NISAR_L2_PR_GCOV_009_114_A_165_4005_DHDH_A_20260105T034232_20260105T034253_X05010_N_P_J_001",
    "20260117": "NISAR_L2_PR_GCOV_010_114_A_165_4005_DHDH_A_20260117T034232_20260117T034254_X05010_N_P_J_001",
}
LABELS = [  # (area, Copernicus AOI, product, output). AOI01 gets the maps either side of NISAR (date-gap rule)
    ("aoi06", 6, "DEL", "label_emsr857_aoi06_flood_30m.tif"),      # Sentinel-1, 17 Jan 03:19 UTC
    ("aoi01", 1, "DEL", "label_emsr857_aoi01_flood_30m.tif"),      # COSMO-SkyMed, 18 Jan 14:55 UTC
    ("aoi01", 1, "FEP", "label_emsr857_aoi01_fep_flood_30m.tif"),  # Sentinel-1, 16 Jan 16:22 UTC
]
JRC_URL = ("https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/"
           "occurrence_30E_20Sv1_4_2021.tif")
HLS = "HLS.S30.T36JWT.2026019T073231.v2.0"  # Sentinel-2 via HLS, 19 Jan, 6% cloud
HLS_URL = "https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/HLSS30.020/{g}/{g}.{band}.tif"
HLS_BANDS = {"B02": -9999, "B03": -9999, "B04": -9999, "B8A": -9999, "B11": -9999, "Fmask": 255}  # band: fill
DSWX_HLS_URL = ("https://archive.podaac.earthdata.nasa.gov/podaac-ops-cumulus-protected/OPERA_L3_DSWX-HLS_V1/"
                "OPERA_L3_DSWx-HLS_T36JWT_20260119T073231Z_20260121T014517Z_S2C_30_v1.1_B01_WTR.tif")
HLS_AREA = "aoi01"  # tile T36JWT starts at 33.0 E, so it misses AOI05 and AOI06
LANDSAT = ("LC09_L2SP_167077_20260120_02_T2", "LC09_L2SP_168077_20251226_02_T1")  # 95% cloud; 24% cloud, pre-flood
PC_ITEM = "https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2/items/"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"
OVERPASS = "https://overpass-api.de/api/interpreter"
UA = {"User-Agent": "ChangeProof-fetch/1.0"}
RESULTS = []  # (status, item, detail)


class Tee:
    """Write everything to the console and to the log file."""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, s):
        for st in self.streams:
            st.write(s)

    def flush(self):
        for st in self.streams:
            st.flush()

    def __getattr__(self, name):
        return getattr(self.streams[0], name)


def mb(paths):
    return sum(q.stat().st_size for q in paths if q.exists()) / 1e6


def run(name, outputs, fn, *args):
    """One independent item: skip it if all its outputs exist, otherwise run it and record OK or FAILED."""
    if all(q.exists() for q in outputs):
        RESULTS.append(("OK", name, f"{mb(outputs):8.1f} MB  (already there)"))
        return
    p.log(f"----- {name}")
    t0 = time.time()
    try:
        fn(*args)
        missing = [q.name for q in outputs if not q.exists()]
        if missing:
            raise RuntimeError(f"finished without writing {', '.join(missing)}")
        RESULTS.append(("OK", name, f"{mb(outputs):8.1f} MB  in {(time.time() - t0) / 60:.1f} min"))
    except KeyboardInterrupt:
        raise
    except BaseException as err:  # SystemExit too: the prep_aoi05 helpers stop with sys.exit
        traceback.print_exc()
        reason = str(err).strip().splitlines()[0] if str(err).strip() else type(err).__name__
        p.log(f"FAILED: {name}: {reason}")
        RESULTS.append(("FAILED", name, reason))


def fetch(url, dest, earthdata=False):
    """Download url to dest unless it is already there."""
    if not dest.exists():
        p.download(url, dest, p.check_access(url) if earthdata else UA)
    return dest


def warp(srcs, area, out, nodata):
    """Put one or more rasters on the area grid, values unchanged (nearest). Where files overlap, the later one wins."""
    x0, y1, nx, ny = GRIDS[area]
    with rasterio.open(srcs[0]) as s:
        dst = np.full((ny, nx), nodata, s.dtypes[0])
    for src in srcs:
        with rasterio.open(src) as s:
            reproject(rasterio.band(s, 1), dst, src_nodata=nodata if s.nodata is None else s.nodata,
                      dst_transform=from_origin(x0, y1, p.PIX, p.PIX), dst_crs=p.CRS, dst_nodata=nodata,
                      init_dest_nodata=False, resampling=Resampling.nearest)
    p.save(out, dst, nodata, GRIDS[area])
    p.log(f"{area}/{out.name}: {(dst != nodata).mean():.0%} of the grid has data")


def dswx_s1(date):
    day = f"{date[:4]}-{date[4:6]}-{date[6:]}"
    r = requests.get(CMR, params={"short_name": "OPERA_L3_DSWX-S1_V1", "bounding_box": ",".join(map(str, UNION)),
                                  "temporal": f"{day}T00:00:00Z,{day}T23:59:59Z", "page_size": 100}, timeout=60)
    r.raise_for_status()
    urls = sorted({u["URL"] for it in r.json()["items"] for u in it["umm"].get("RelatedUrls", [])
                   if u["URL"].startswith("https://") and u["URL"].endswith("_B01_WTR.tif")})
    if not urls:
        raise RuntimeError(f"CMR lists no DSWx-S1 granules for {day}")
    p.log(f"{len(urls)} DSWx-S1 WTR files for {day} (reprocessed copies of a tile are mosaicked too)")
    tiles = [fetch(u, RAW / "dswx_s1" / u.rsplit("/", 1)[1], earthdata=True) for u in urls]
    for area in AREAS:
        warp(tiles, area, DATA / area / f"dswx_s1_wtr_{date}_30m.tif", 255)


def hls():
    for band, fill in HLS_BANDS.items():
        src = fetch(HLS_URL.format(g=HLS, band=band), RAW / "hls" / f"{HLS}.{band}.tif", earthdata=True)
        warp([src], HLS_AREA, DATA / HLS_AREA / f"hls_20260119_{band.lower()}_30m.tif", fill)


def dswx_hls():
    src = fetch(DSWX_HLS_URL, RAW / "dswx_hls" / DSWX_HLS_URL.rsplit("/", 1)[1], earthdata=True)
    warp([src], HLS_AREA, DATA / HLS_AREA / "dswx_hls_wtr_20260119_30m.tif", 255)


def jrc():
    src = fetch(JRC_URL, RAW / "jrc" / JRC_URL.rsplit("/", 1)[1])
    for area in AREAS:
        warp([src], area, DATA / area / "jrc_occurrence_30m.tif", 255)


def osm(area):
    w, s, e, n = AREAS[area]
    query = f'[out:json][timeout:900];way["building"]({s},{w},{n},{e});out center;'
    for attempt in range(3):
        r = requests.post(OVERPASS, data={"data": query}, headers=UA, timeout=1000)
        if r.status_code not in (429, 502, 503, 504) or attempt == 2:
            break
        p.log(f"Overpass is busy (HTTP {r.status_code}), waiting 2 minutes")
        time.sleep(120)
    r.raise_for_status()
    js = r.json()
    if "remark" in js:  # Overpass reports timeouts and memory errors here, with HTTP 200 and partial data
        raise RuntimeError(f"Overpass: {js['remark']}")
    feats = [{"type": "Feature", "id": f"way/{el['id']}", "properties": {"building": el.get("tags", {}).get("building")},
              "geometry": {"type": "Point", "coordinates": [el["center"]["lon"], el["center"]["lat"]]}}
             for el in js["elements"] if "center" in el]
    (DATA / area / "osm_buildings.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
    p.log(f"{area}: {len(feats):,} OSM buildings, one point at the centre of each")


def landsat(item_id):
    r = requests.get(PC_ITEM + item_id, headers=UA, timeout=60)
    r.raise_for_status()
    item = r.json()
    p.download(item["assets"]["rendered_preview"]["href"], DATA / "landsat" / f"{item_id}_preview.png", UA)
    (DATA / "landsat" / f"{item_id}.json").write_text(json.dumps(item, indent=1), encoding="utf-8")
    p.log(f"{item_id}: {item['properties']['eo:cloud_cover']}% cloud (scene cloud cover from USGS metadata)")


def nisar(area, date, gran, force_download):
    url, raw, grid, tag = p.ASF.format(g=gran), RAW / f"{gran}.h5", GRIDS[area], f"{area} {date}"

    def crop(src):
        with h5py.File(src, "r", rdcc_nbytes=64 << 20) as h5:
            for pol, arr in p.read_db(h5, tag, grid).items():
                p.save(DATA / area / f"{pol}_{date}_db_30m.tif", arr, np.nan, grid)

    if not force_download and not raw.exists():
        try:
            fs = fsspec.filesystem("http", headers=p.check_access(url), cache_type="background",
                                   block_size=8 << 20)
            with fs.open(url, "rb") as src:
                return crop(src)
        except Exception as err:  # a missing token or an AOI outside the file is SystemExit and still fails here
            p.log(f"{tag}: streaming failed ({err}). Downloading the full file instead.")
    fetch(url, raw, earthdata=True)
    p.log(f"{tag}: reading {raw.name} from disk")
    crop(raw)


def check_png(area):
    hh = {}
    for date in NISAR_165:
        with rasterio.open(DATA / area / f"hh_{date}_db_30m.tif") as s:
            hh[date] = s.read(1)
    with rasterio.open(DATA / area / f"label_emsr857_{area}_flood_30m.tif") as s:
        flood = s.read(1)
    p.make_png(hh["20260105"], hh["20260117"], flood, DATA / area / f"check_{area}.png")


def summary():
    print("\nSUMMARY")
    for status, name, detail in RESULTS:
        print(f"  {status:7} {name:50} {detail}")
    failed = sum(r[0] == "FAILED" for r in RESULTS)
    print(f"\n{sum(r[0] == 'OK' for r in RESULTS)} of {len(RESULTS)} items OK, {failed} failed.")
    if failed:
        print("Fix the cause shown in the log and run the same command again: finished items are skipped.")
    print(f"Log: {DATA / 'fetch_log.txt'}")
    return failed


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help="download the full frame 165 files instead of streaming")
    args = ap.parse_args()
    for area in AREAS:
        (DATA / area).mkdir(parents=True, exist_ok=True)
    log_file = open(DATA / "fetch_log.txt", "a", encoding="utf-8")
    sys.stdout, sys.stderr = Tee(sys.__stdout__, log_file), Tee(sys.__stderr__, log_file)
    token = "set" if os.environ.get("EARTHDATA_TOKEN") else "NOT set, so NISAR, OPERA and HLS items will fail"
    p.log(f"===== fetch_all.py started{' with --download' if args.download else ''}. EARTHDATA_TOKEN is {token}.")
    for area, (_, _, nx, ny) in GRIDS.items():
        p.log(f"{area} grid: {nx} x {ny} pixels of {p.PIX} m in {p.CRS}")

    try:  # quick items and token checks first, the long NISAR crops last
        for area, aoi, product, name in LABELS:
            run(f"1 Copernicus AOI{aoi:02d} {product} label on {area}", [DATA / area / name],
                p.make_label, aoi, product, GRIDS[area], DATA / area / name)
        for date in NISAR_165:
            run(f"2 OPERA DSWx-S1 {date}, all areas", [DATA / a / f"dswx_s1_wtr_{date}_30m.tif" for a in AREAS],
                dswx_s1, date)
        run(f"4 HLS T36JWT 19 Jan on {HLS_AREA}",
            [DATA / HLS_AREA / f"hls_20260119_{b.lower()}_30m.tif" for b in HLS_BANDS], hls)
        run(f"4 OPERA DSWx-HLS T36JWT 19 Jan on {HLS_AREA}", [DATA / HLS_AREA / "dswx_hls_wtr_20260119_30m.tif"],
            dswx_hls)
        run("3 JRC water occurrence, all areas", [DATA / a / "jrc_occurrence_30m.tif" for a in AREAS], jrc)
        for area in AREAS:
            run(f"6 OSM buildings {area}", [DATA / area / "osm_buildings.geojson"], osm, area)
        for item in LANDSAT:
            run(f"5 Landsat preview {item}",
                [DATA / "landsat" / f"{item}_preview.png", DATA / "landsat" / f"{item}.json"], landsat, item)
        for area in ("aoi06", "aoi01"):
            for date, gran in NISAR_165.items():
                run(f"1 NISAR frame 165 {area} {date}", [DATA / area / f"{pol}_{date}_db_30m.tif" for pol in ("hh", "hv")],
                    nisar, area, date, gran, args.download)
            needs = [DATA / area / f"hh_{d}_db_30m.tif" for d in NISAR_165] + [DATA / area / f"label_emsr857_{area}_flood_30m.tif"]
            if all(q.exists() for q in needs):
                run(f"1 Check image {area}", [DATA / area / f"check_{area}.png"], check_png, area)
            else:
                RESULTS.append(("WAITING", f"1 Check image {area}", "needs the NISAR crops and label above"))
    finally:
        failed = summary()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
