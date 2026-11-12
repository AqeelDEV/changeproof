"""Place list for the claim checker: OSM place nodes inside the three grids, with numbers precomputed per place.

For every city, town, village and suburb node on an area grid, this measures a disk around the node (3 km for a
city or town, 1 km for a village or suburb): coverage shares, detected new water, open ground (valid, not unclear,
not built-up), each Copernicus map, new water already dark on 5 Jan and OSM buildings. The claim checker in
claims/ picks its verdict from these numbers only.

It also prints, for each city and town, the verdict class at 1 km and at 3 km from coverage and built-up numbers
only (never new water), to show what the larger buffer changes.

Writes data/places.json. The raw Overpass reply is kept in data/osm_places_raw.json, so a rerun does not fetch again.

  python pipeline\\places.py
"""
import json
import math
import unicodedata
from datetime import datetime, timezone

import numpy as np
import rasterio
import requests
from rasterio.warp import transform

import baseline_aoi05 as b
import fetch_all as f
import make_outputs as mo
import prep_aoi05 as p

DATA = p.ROOT / "data"
RAW, OUT = DATA / "osm_places_raw.json", DATA / "places.json"
RADIUS_M = {"city": 3000, "town": 3000, "village": 1000, "suburb": 1000}
NAME_TAGS = ("name", "name:pt", "name:en", "alt_name", "old_name", "official_name", "short_name")
# Thresholds of the dry rule in claims/verdict.ts, used here only for the buffer comparison report.
MIN_VALID, MIN_OPEN, MAX_UNCLEAR = 0.50, 0.50, 0.10
FEP = {"file": "label_emsr857_aoi01_fep_flood_30m.tif", "product": "First Estimate Product (FEP)",
       "sensor": "Sentinel-1", "observed_utc": "2026-01-16T16:22:00Z"}


def delineation(area):
    ref = mo.AREAS[area]["reference"]
    return {"file": f"label_emsr857_{area}_flood_30m.tif", "product": "Delineation (DEL)", "sensor": ref["sensor"],
            "observed_utc": ref["observed_utc"]}


MAPS = {"aoi05": [delineation("aoi05")], "aoi06": [delineation("aoi06")], "aoi01": [FEP, delineation("aoi01")]}


def variants(tags):
    """Name spellings: as tagged, without accents, hyphens as spaces, and with no spaces. "A (B)" also gives A and B."""
    out = []
    parts = [v.strip() for t in NAME_TAGS for v in tags.get(t, "").split(";")]
    for name in (x for v in parts for x in [v, *([y.strip(" )") for y in v.split("(")] if "(" in v else [])]):
        plain = "".join(c for c in unicodedata.normalize("NFD", name) if unicodedata.category(c) != "Mn")
        spaced = " ".join(plain.replace("-", " ").split())
        for v in (name, plain, spaced, spaced.replace(" ", "")):
            if v and v not in out:
                out.append(v)
    return out


def disk(x, y, grid, radius):
    """Rows and columns of grid pixels whose centres lie within radius of (x, y), and the disk's pixel count
    on or off the grid."""
    x0, y1, nx, ny = grid
    r, c0, r0 = int(radius // p.PIX) + 2, int((x - x0) // p.PIX), int((y1 - y) // p.PIX)
    rr, cc = np.mgrid[r0 - r:r0 + r + 1, c0 - r:c0 + r + 1]
    inside = (x0 + (cc + 0.5) * p.PIX - x) ** 2 + (y1 - (rr + 0.5) * p.PIX - y) ** 2 <= radius ** 2
    rr, cc = rr[inside], cc[inside]
    on = (rr >= 0) & (rr < ny) & (cc >= 0) & (cc < nx)
    return rr[on], cc[on], int(inside.sum())


assert variants({"name": "Xai-Xai"}) == ["Xai-Xai", "Xai Xai", "XaiXai"]
assert variants({"name": "Chókwè", "alt_name": "Chokwe;Chokwé"}) == ["Chókwè", "Chokwe", "Chokwé"]
assert variants({"name": "Macarretane (Aldeia)"})[0] == "Macarretane (Aldeia)"
assert variants({"name": "Macarretane (Aldeia)"})[-2:] == ["Macarretane", "Aldeia"]
for _r in (1000, 3000):
    _n = disk(p.X0 + 5000, p.Y1 - 5000, p.GRID, _r)[2]
    assert abs(_n / (math.pi * _r ** 2 / p.PIX ** 2) - 1) < 0.02
assert disk(p.X0, p.Y1, p.GRID, 1000)[0].size < disk(p.X0, p.Y1, p.GRID, 1000)[2] / 3  # a corner: most is off the grid


def fetch_places():
    if not RAW.exists():
        w, s, e, n = f.UNION
        query = f'[out:json][timeout:300];node["place"~"^(city|town|village|suburb)$"]({s},{w},{n},{e});out;'
        r = requests.post(f.OVERPASS, data={"data": query}, headers=f.UA, timeout=400)
        r.raise_for_status()
        js = r.json()
        if "remark" in js:  # Overpass reports timeouts here, with HTTP 200 and partial data
            raise RuntimeError(f"Overpass: {js['remark']}")
        RAW.write_text(json.dumps(js), encoding="utf-8")
    return [el for el in json.loads(RAW.read_text(encoding="utf-8"))["elements"] if el.get("tags", {}).get("name")]


def load_area(area):
    folder, grid = DATA / area, f.GRIDS[area]

    def read(name):
        with rasterio.open(folder / name) as s:
            return s.read(1)
    a = {"grid": grid, "water": read("water_new_30m.tif"), "cov": read("coverage_30m.tif"),
         "labels": [read(m["file"]) for m in MAPS[area]]}
    assert ((a["water"] != 255) == (a["cov"] != 0)).all()  # both mark the pixels with NISAR data on both dates
    d = b.load(folder)
    rule = json.loads(b.TUNED.read_text(encoding="utf-8"))["rule"]
    info = b.detect(d, **rule)[1]  # the 5 Jan threshold, as in make_outputs.run_area
    with np.errstate(invalid="ignore"):  # NaN is not dark
        a["dark0"] = b.filtered(d, "hh0", {**b.RULE_DEFAULTS, **rule}["filter_px"]) < info["water_threshold_db"][b.BEFORE]
    feats = json.loads((folder / "osm_buildings.geojson").read_text(encoding="utf-8"))["features"]
    row, col = mo.pixels([ft["geometry"]["coordinates"][0] for ft in feats],
                         [ft["geometry"]["coordinates"][1] for ft in feats], grid)
    a["count"] = np.zeros(a["water"].shape, "int32")
    np.add.at(a["count"], (row, col), 1)
    a["built"] = b.dilate(a["count"] > 0, 1)
    return a


def share(n, of):
    return round(float(n) / of, 4) if of else None


def coverage_only(a, rr, cc, total):
    """The numbers that need no new water: coverage shares, valid, built-up and open ground."""
    cov = a["cov"][rr, cc]
    shares = {k: share((cov == c).sum() + (total - rr.size if c == 0 else 0), total) for k, c in b.SHARE_CODES}
    assert abs(sum(shares.values()) - 1) < 1e-3
    valid, built = cov != 0, a["built"][rr, cc]
    return shares, valid, built, valid & (cov != 3) & ~built


def dry_class(shares, open_share):
    if 1 - shares["no_data"] < MIN_VALID:
        return "not observable"
    return "dry rule can fire" if open_share >= MIN_OPEN and shares["unclear"] <= MAX_UNCLEAR else "dry rule cannot fire"


def measure(a, area, rr, cc, total, own):
    shares, valid, built, open_ = coverage_only(a, rr, cc, total)
    new, count = a["water"][rr, cc] == 1, a["count"][rr, cc]
    cop = []
    for lab, meta in zip((L[rr, cc] for L in a["labels"]), MAPS[area]):
        mapped = lab != 255
        cop.append({"product": meta["product"], "sensor": meta["sensor"], "observed_utc": meta["observed_utc"],
                    "mapped_share": share(mapped.sum(), total), "flooded_share": share((lab == 1).sum(), mapped.sum()),
                    "flooded_share_open": share((lab == 1)[open_].sum(), (mapped & open_).sum())})
    return {"area": area, "in_scored_area": bool(a["cov"][own] == 1), "pixels": total, "coverage": shares,
            "valid_share": share(valid.sum(), total), "built_up_share": share(built.sum(), total),
            "open_share": share(open_.sum(), total), "new_water_ha": round(float(new.sum() * b.HA), 1),
            "new_water_share": share(new.sum(), valid.sum()), "new_water_share_open": share((new & open_).sum(), open_.sum()),
            "dark_5jan_share": share((new & a["dark0"][rr, cc]).sum(), new.sum()), "copernicus": cop,
            "osm_buildings": int(count.sum()), "osm_buildings_in_new_water": int(count[new].sum())}


def main():
    nodes = fetch_places()
    p.log(f"{len(nodes)} named OSM place nodes in the union of the three areas")
    xs, ys = transform("EPSG:4326", p.CRS, [n["lon"] for n in nodes], [n["lat"] for n in nodes])
    best, compare = {}, []  # node id -> numbers on the grid with the most valid pixels; buffer comparison rows
    for area in mo.AREAS:
        p.log(f"{area}: reading the grids")
        a = load_area(area)
        x0, y1, nx, ny = a["grid"]
        for node, x, y in zip(nodes, xs, ys):
            row, col = int((y1 - y) // p.PIX), int((x - x0) // p.PIX)
            if not (0 <= row < ny and 0 <= col < nx):
                continue
            kind = node["tags"]["place"]
            rr, cc, total = disk(x, y, a["grid"], RADIUS_M[kind])
            m = measure(a, area, rr, cc, total, (row, col))
            if node["id"] not in best or m["valid_share"] > best[node["id"]]["valid_share"]:
                best[node["id"]] = m
            if RADIUS_M[kind] != 1000:
                r1, c1, t1 = disk(x, y, a["grid"], 1000)
                s1, _, _, o1 = coverage_only(a, r1, c1, t1)
                compare.append((node["id"], node["tags"]["name"], kind, area, dry_class(s1, o1.sum() / t1),
                                dry_class(m["coverage"], m["open_share"]), s1, share(o1.sum(), t1), m))

    places = []
    for node in nodes:
        if node["id"] in best:
            tags = node["tags"]
            places.append({"id": f"node/{node['id']}", "name": tags["name"], "place": tags["place"],
                           "lon": round(node["lon"], 5), "lat": round(node["lat"], 5),
                           "buffer_m": RADIUS_M[tags["place"]], "variants": variants(tags), **best[node["id"]]})
    places.sort(key=lambda q: (q["area"], q["name"]))
    areas = {area: {"name": cfg["name"], "release": "Beta",
                    "scenes": [b.scene(role, cfg["granules"][date], cfg["frame"])
                               for role, date in (("before", b.BEFORE), ("after", b.AFTER))],
                    "copernicus": [{k: m[k] for k in ("product", "sensor", "observed_utc")} for m in MAPS[area]]}
             for area, cfg in mo.AREAS.items()}
    OUT.write_text(json.dumps({"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                               "as_of_label": "17 Jan 2026, 03:42 UTC", "buffer_m": RADIUS_M, "areas": areas,
                               "places": places}, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"\nWrote {OUT}: {len(places)} places")
    for area in mo.AREAS:
        kinds = [q["place"] for q in places if q["area"] == area]
        print(f"  {area}: " + ", ".join(f"{k} {kinds.count(k)}" for k in RADIUS_M if k in kinds))
    for name in ("Chókwè", "Macia", "Xai-Xai"):
        for q in (q for q in places if q["name"] == name):
            print(f"  {name}: {q['area']} {q['place']}, {q['buffer_m']} m, valid {q['valid_share']}, "
                  f"built-up {q['built_up_share']}, open {q['open_share']}")
    compare = [c[1:] for c in compare if best[c[0]]["area"] == c[3]]  # each place once, on its chosen grid
    changed = [c for c in compare if c[3] != c[4]]
    print(f"\nBuffer comparison, cities and towns, from coverage and built-up only: {len(changed)} of {len(compare)} "
          "change verdict class between 1 km and 3 km")
    for name, kind, area, c1, c3, s1, o1, m in compare:
        print(f"  {'*' if c1 != c3 else ' '} {name} ({kind}, {area}): 1 km {c1} (valid {1 - s1['no_data']:.2f}, open "
              f"{o1:.2f}, unclear {s1['unclear']:.2f}); 3 km {c3} (valid {m['valid_share']:.2f}, open "
              f"{m['open_share']:.2f}, unclear {m['coverage']['unclear']:.2f})")


if __name__ == "__main__":
    main()
