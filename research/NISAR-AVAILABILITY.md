# NISAR GCOV availability checked on 11 November 2026

**Yes: ASF lists real NISAR GCOV products for download.** Level-2 GCOV contains geocoded, radiometrically terrain-corrected backscatter. It avoids raw SAR focusing and interferogram generation. It still requires subsetting, quality checks and defensible interpretation.

## Actual catalogue results

The live ASF API returned HTTP 200 for these public metadata queries. Full responses, including exact HDF5 download URLs, are saved locally.

| Saved catalogue | Observed result |
|---|---|
| `samples/nisar-mozambique_january.json` | Five intersecting GCOV products in the queried southern Mozambique box, 1-20 January 2026. |
| `samples/nisar-mozambique_provisional.json` | Six returned Provisional products, using a six-result limit. This is not the total collection count. |
| `samples/nisar-mozambique_validated.json` | Three returned Validated products in that box, 21 October to 11 November 2026. |

## Matched historical pair

Track 114, ascending, frame 166, main-band HH and HV, processing identifier X05010:

- 5 January 2026: `NISAR_L2_PR_GCOV_009_114_A_166_4005_DHDH_A_20260105T034252_20260105T034303_X05010_N_P_J_001.h5`, 2,353,004,544 bytes, about 2.35 GB.
- 17 January 2026: `NISAR_L2_PR_GCOV_010_114_A_166_4005_DHDH_A_20260117T034253_20260117T034303_X05010_N_P_J_001.h5`, 2,181,038,080 bytes, about 2.18 GB.

Both are in **NISAR_L2_GCOV_BETA_V1**. Anonymous range requests to both science-file URLs returned HTTP 302 redirects to NASA Earthdata Login. No login was attempted. No large science files were downloaded. Catalogue listing and the expected authentication redirect were verified, not a completed authenticated download.

NASA independently documents the January flood observations: https://svs.gsfc.nasa.gov/5661

## Newer validated example

The catalogue also returned `NISAR_L2_PR_GCOV_034_064_D_101_2005_DHDH_A_20261028T155126_20261028T155200_P05036_N_F_J_001.h5` in **NISAR_L2_GCOV_V1**, dated 28 October 2026, with a listed size of 1,526,726,656 bytes, about 1.53 GB. A complete matched pair of validated products was not established by this check.

ASF's current product guide says:

- Beta products are not fully calibrated and have known issues.
- Provisional products are fully calibrated and partly validated.
- Validated Level 0-2 products were released on 6 November 2026 and cover acquisitions from 21 October 2026 onwards.
- Mixing product maturities can create apparent changes caused by processing differences.

Source: https://nisar-docs.asf.alaska.edu/products-overview/

## Practical starting route

1. Open https://search.asf.alaska.edu/ and sign in with NASA Earthdata.
2. Select NISAR and GCOV; inspect data maturity and product identifiers.
3. Choose a small area with two comparable acquisitions, the same track, orbit direction, polarisation and compatible processing.
4. Use the official search/stream/subset recipe to extract just the required bands and region: https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/
5. Inspect the product's quality report and masks. Do not treat a browse PNG as a measurement raster or GCOV backscatter as ground displacement.

The January case is useful for illustrating a known event, but its beta status makes it a weaker foundation for an unreviewed quantitative classifier. Prefer a matched Provisional or Validated pair with independent reference observations if one can be prepared within the two-hour feasibility test.
