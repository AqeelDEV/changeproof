# Data contract

What `pipeline/` outputs for the app. `web/` and `claims/` read these files and nothing else from the pipeline. Version 1.1.

Changes in 1.1 (11 Nov 2026):
- The grey stretch is now -25 to 0 dB, because the 17 Jan scene is about 3 dB brighter and washed out at -5 dB.
- The grey HH/HV overlays are downsampled WebP, to cut about 15 MB per area.
- `stats.json` accepts the `webp` format.

Addition on 12 Nov 2026, still version 1.1 (optional fields, so files without them stay valid):
- `results.osm_buildings_in_new_water` and `results.osm_buildings_on_grid`: OpenStreetMap buildings (one point each) inside detected new water, and on the whole grid. The first can be too high or too low, and is never a damage count. It can be too low because OSM is incomplete and radar open-water detection misses flooded built-up areas. It can be too high because a 30 m pixel is larger than a house, and some detected water may not be flood.
- `areas.json` lists every finished area.
- The four old 1.0 grey PNGs in `web/public/data/aoi05/` (`hh_*.png`, `hv_*.png`) are still there but no longer listed in `stats.json`. Use the WebP files; the PNGs will be removed.

## Layout

Area ids are lower case, for example `aoi05`.

```
data/<area>/                     GeoTIFFs, not served, not committed
web/public/data/areas.json       ["aoi05", "aoi06", "aoi01"]
web/public/data/<area>/          what the app loads, committed
```

## GeoTIFFs: `data/<area>/`

All on one grid: EPSG:32736, 30 m pixels, same origin and size (AOI05: 1771 x 1522), deflate compressed.

| File | Type | Content |
|---|---|---|
| `hh_<yyyymmdd>_db_30m.tif`, `hv_<yyyymmdd>_db_30m.tif` | float32, NaN = no data | Backscatter in dB, 3x3 mean of linear power. Dates 20260105 and 20260117 |
| `label_emsr857_<area>_flood_30m.tif` | uint8, nodata 255 | Copernicus observed layer: 1 flooded, 0 not, 255 outside the mapped area |
| `water_new_30m.tif` | uint8, nodata 255 | Detected new water (water on the after date, not before): 1 yes, 0 no, 255 invalid |
| `change_hh_db_30m.tif` | float32, NaN = no data | After minus before HH, dB |
| `coverage_30m.tif` | uint8 | 0 no NISAR data, 1 evaluated, 2 valid but outside the Copernicus mapped area, 3 unclear (HH rose, possible flooded vegetation), 4 edge buffer excluded |

### Inputs fetched by `pipeline/fetch_all.py`

These sit on the same grid. Values are kept as published: nearest-neighbour resampling, no rescaling.

Areas: `aoi05` (frame 166), `aoi06` and `aoi01` (frame 165). `aoi01` is Copernicus AOI01 Chibabel: Chókwè, Macia and Xai-Xai.

| File | Areas | Type | Content |
|---|---|---|---|
| `label_emsr857_aoi01_fep_flood_30m.tif` | aoi01 | uint8, nodata 255 | Copernicus first-estimate observed layer, Sentinel-1, 16 Jan 16:22 UTC. Same codes as the main label. The `aoi01` main label is the delineation from COSMO-SkyMed, 18 Jan 14:55 UTC |
| `dswx_s1_wtr_<yyyymmdd>_30m.tif` | all | uint8, nodata 255 | OPERA DSWx-S1 WTR layer, 5 and 17 Jan, tiles mosaicked. OPERA class codes as published (not yet checked here: read them from the file metadata or the product spec before use) |
| `jrc_occurrence_30m.tif` | all | uint8, nodata 255 | JRC Global Surface Water occurrence 1984 to 2021, percent of observations with water (0 to 100). The long-term permanent water reference |
| `hls_20260119_<band>_30m.tif` | aoi01 | int16, nodata -9999 (`fmask`: uint8, nodata 255) | HLS S30 tile T36JWT, 19 Jan, bands b02, b03, b04, b8a, b11 (reflectance x 10000) and fmask. The tile starts at 33.0° E, so the west of `aoi01` has no data |
| `dswx_hls_wtr_20260119_30m.tif` | aoi01 | uint8, nodata 255 | OPERA DSWx-HLS WTR layer for the same scene. OPERA class codes |
| `osm_buildings.geojson` | all | GeoJSON points, EPSG:4326 | One point per OpenStreetMap building (way centre) with its `building` tag. Data © OpenStreetMap contributors, ODbL |
| `check_<area>.png` | aoi06, aoi01 | PNG | Visual check: HH before, HH after, and the after image with the label outline |

Landsat previews for the cloud panel are in `data/landsat/` and are not on a grid: `<scene id>_preview.png` (Planetary Computer rendered preview) and `<scene id>.json` (its STAC item, including cloud cover).

## Overlays: `web/public/data/<area>/`

RGBA images, reprojected to EPSG:4326 so the bounds are exact. Pixels with no data are fully transparent. Each file's bounds are listed in the stats file as `[west, south, east, north]`.

The grey backscatter images are lossy WebP at half resolution: every second pixel in each direction, about 60 m, quality 80, alpha kept. The rest are PNG at full resolution, so that class edges stay exact.

| File | Content |
|---|---|
| `hh_20260105.webp`, `hh_20260117.webp`, `hv_20260105.webp`, `hv_20260117.webp` | Grey, -25 dB (black) to 0 dB (white), the same stretch on both dates. WebP, half resolution |
| `water_new.png` | Detected new water, blue `#1f78ff`, rest transparent |
| `label.png` | Copernicus observed flood, red `#e5382d`, rest transparent |
| `coverage.png` | One colour per coverage code (colours set in the pipeline, listed in the report) |
| `stats.json` | One per area, schema below |

## `stats.json`

Rules: `coverage` shares are fractions of all grid pixels and sum to 1 (within 0.001). `as_of_label` is the start time of the after scene, to the minute. Areas are in hectares. Only the observed Copernicus area is stored, never the modelled one. Agreement metrics are computed inside the Copernicus mapped area only.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ChangeProof area stats",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "area_id", "name", "generated_utc", "as_of_label", "release",
               "grid", "scenes", "reference", "method", "results", "agreement", "coverage",
               "files", "limits"],
  "properties": {
    "schema_version": { "const": "1.1" },
    "area_id": { "type": "string", "pattern": "^[a-z0-9_]+$" },
    "name": { "type": "string" },
    "generated_utc": { "type": "string", "format": "date-time" },
    "as_of_label": { "type": "string", "description": "Quoted in every verdict, for example 17 Jan 2026, 03:42 UTC" },
    "release": { "enum": ["Beta", "Provisional", "Validated"] },
    "grid": {
      "type": "object", "additionalProperties": false,
      "required": ["epsg", "pixel_m", "width", "height", "bounds_4326"],
      "properties": {
        "epsg": { "type": "integer" },
        "pixel_m": { "type": "number" },
        "width": { "type": "integer" },
        "height": { "type": "integer" },
        "bounds_4326": { "$ref": "#/$defs/bounds" }
      }
    },
    "scenes": {
      "type": "array", "minItems": 2,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["role", "granule_id", "track", "frame", "processing_version", "start_utc", "end_utc", "polarisations"],
        "properties": {
          "role": { "enum": ["before", "after"] },
          "granule_id": { "type": "string" },
          "track": { "type": "integer" },
          "frame": { "type": "integer" },
          "processing_version": { "type": "string", "description": "For example X05010" },
          "start_utc": { "type": "string", "format": "date-time" },
          "end_utc": { "type": "string", "format": "date-time" },
          "polarisations": { "type": "array", "items": { "enum": ["HH", "HV"] } }
        }
      }
    },
    "reference": {
      "type": "object", "additionalProperties": false,
      "required": ["source", "activation", "aoi", "product", "layer", "sensor", "observed_utc", "observed_ha"],
      "properties": {
        "source": { "const": "Copernicus EMS" },
        "activation": { "type": "string", "description": "For example EMSR857" },
        "aoi": { "type": "string" },
        "product": { "type": "string" },
        "layer": { "const": "observedEventA" },
        "sensor": { "type": "string" },
        "observed_utc": { "type": "string", "format": "date-time" },
        "observed_ha": { "type": "number", "description": "Observed area, for example 9702.9" }
      }
    },
    "method": {
      "type": "object", "additionalProperties": false,
      "required": ["name", "summary", "parameters", "edge_buffer_px"],
      "properties": {
        "name": { "enum": ["threshold", "lightgbm"] },
        "summary": { "type": "string" },
        "parameters": { "type": "object", "description": "Thresholds and settings used, for the report" },
        "edge_buffer_px": { "type": "integer" }
      }
    },
    "results": {
      "type": "object", "additionalProperties": false,
      "required": ["flooded_ha", "flooded_ha_in_mapped_area", "hh_median_db_in_label"],
      "properties": {
        "flooded_ha": { "type": "number", "description": "Detected new water, whole grid, valid pixels" },
        "flooded_ha_in_mapped_area": { "type": "number", "description": "Same, inside the Copernicus mapped area" },
        "hh_median_db_in_label": {
          "type": "object", "required": ["before", "after"],
          "properties": { "before": { "type": "number" }, "after": { "type": "number" } }
        },
        "osm_buildings_in_new_water": { "type": "integer", "minimum": 0,
                                        "description": "Optional. OSM buildings inside detected new water: can be too high or too low, not a damage count" },
        "osm_buildings_on_grid": { "type": "integer", "minimum": 0, "description": "Optional. OSM buildings on the whole grid" }
      }
    },
    "agreement": {
      "type": "object", "additionalProperties": false,
      "required": ["iou", "precision", "recall", "evaluated_ha"],
      "properties": {
        "iou": { "type": "number", "minimum": 0, "maximum": 1 },
        "precision": { "type": "number", "minimum": 0, "maximum": 1 },
        "recall": { "type": "number", "minimum": 0, "maximum": 1 },
        "evaluated_ha": { "type": "number" }
      }
    },
    "coverage": {
      "type": "object", "additionalProperties": false,
      "required": ["evaluated", "outside_mapped_area", "unclear", "edge_excluded", "no_data"],
      "properties": {
        "evaluated": { "$ref": "#/$defs/share" },
        "outside_mapped_area": { "$ref": "#/$defs/share" },
        "unclear": { "$ref": "#/$defs/share" },
        "edge_excluded": { "$ref": "#/$defs/share" },
        "no_data": { "$ref": "#/$defs/share" }
      }
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object", "required": ["file", "format"],
        "properties": {
          "file": { "type": "string" },
          "format": { "enum": ["png", "webp", "geotiff"] },
          "bounds_4326": { "$ref": "#/$defs/bounds" }
        },
        "if": { "properties": { "format": { "enum": ["png", "webp"] } } },
        "then": { "required": ["bounds_4326"] }
      }
    },
    "limits": { "type": "array", "minItems": 1, "items": { "type": "string" },
                "description": "Plain sentences shown in the app and the report: Beta data, label gap, what the method misses" }
  },
  "$defs": {
    "bounds": { "type": "array", "minItems": 4, "maxItems": 4, "items": { "type": "number" },
                "description": "[west, south, east, north] in EPSG:4326" },
    "share": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

## Fixed values for AOI05

- Before: `NISAR_L2_PR_GCOV_009_114_A_166_4005_DHDH_A_20260105T034252_20260105T034303_X05010_N_P_J_001`
- After: `NISAR_L2_PR_GCOV_010_114_A_166_4005_DHDH_A_20260117T034253_20260117T034303_X05010_N_P_J_001`
- `as_of_label`: `17 Jan 2026, 03:42 UTC`
- Reference: EMSR857, AOI05, delineation product, Sentinel-1 at 03:18 UTC on 17 Jan, observed 9,702.9 ha
