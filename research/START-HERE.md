# Space Apps 2026 research starter data

Checked on 11 November 2026. These files are source samples for choosing a project, not a completed application or a validated scientific model.

## Recommendation

The final shortlist combines the user's NISAR preference with the claim-audit idea:

1. **ChangeProof**, the NISAR version of TrendProof, for **Dancing with the SARs**. A local journalist or district communications officer checks a narrowly defined surface-water change claim against comparable NISAR GCOV observations. It must expose observation dates, product maturity, quality gaps, reference evidence and the difference between measured radar change and inferred water extent. This is the preferred strategic option only if the two-hour data feasibility check succeeds.
2. **TrendProof Climate**, for **Be An Earth System Trend Detective!**, is the lower-risk solo fallback. Extract a regional temperature or humidity claim from prose, make its interpretation editable, calculate the statistics deterministically, and export the data, method and qualified conclusion.

NISAR's short record cannot replace a multi-decade climate series. The NISAR project should check surface-change claims, not assert a long-term climatic trend from two radar scenes.

The underlying NISAR water-change concept was initially called **Waterline**. ChangeProof retains its small geographic scope and uses Level-2 GCOV backscatter, not interferometric displacement. Commit only if two comparable, georeferenced scene subsets and suitable independent reference labels can be opened and checked by Thursday morning. NASA documents an actual Mozambique case from 5 and 17 January 2026. Both underlying scenes were subsequently verified in ASF's public catalogue, but their HDF5 contents were not downloaded or scientifically validated in this research. The published PNG visualisations are context, not quantitative raster inputs. See `NISAR-AVAILABILITY.md` for the confirmed Beta, Provisional and Validated catalogue entries.

**SmokeScope**, a detector-specific evidence comparison tool for **Flame in Freefall**, remains third on the shortlist. A generic combustion research dashboard has substantial overlap with the public 2026 MicroFire Atlas entry. SmokeScope needs a clear detector-review workflow and time for scientific review.

Useful NISAR primary sources:

- Actual Mozambique case: https://svs.gsfc.nasa.gov/5661
- GCOV product description: https://nisar-docs.asf.alaska.edu/gcov/
- Search, stream and spatially subset: https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/
- Existing OPERA water products: https://www.jpl.nasa.gov/go/opera/products/

The user clarified that Dubai organisers/judges explicitly said NISAR projects would have a higher chance of winning locally. They provided download directions but no prepared dataset or confirmed radar mentor. This makes a two-hour NISAR feasibility test tonight worthwhile; it does not remove the data and interpretation gate. No global scoring preference for NISAR was verified. OPERA product schedules alone do not prove that a usable DSWx-NI product exists for a particular place and date.

Do not choose **The Missing Layer** solo unless an experienced SAR collaborator supplies validated NISAR products and checks the interpretation. Backscatter change, line-of-sight displacement and slope instability are different things.

## Verified downloads

The exact HTTP status, byte counts and source URLs are recorded in `samples/access-checks.json`.

| File | Source | Downloaded bytes | Notes |
|---|---|---:|---|
| `samples/dubai-power-monthly.json` | NASA POWER monthly API | 10,247 | Temperature and relative humidity, 2001-2025, Dubai coordinate. Each series has 300 monthly values and 25 annual values. Exclude month 13 from monthly analysis. Missing value marker is -999. |
| `samples/same-particle-results.pdf` | NASA NTRS 20130000422 | 757,824 | SAME particle results. Inspect exact experiment conditions and pages before extracting claims. |
| `samples/smoke-detector-reference.pdf` | NASA NTRS 20205003817 | 2,115,889 | Detector characterisation reference. Distinguish ground testing from microgravity observations. |
| `samples/portugal-modis-2023.csv` | NASA FIRMS country archive | 84,920 | 1,062 rows of detections, not a count of unique fires. |
| `samples/portugal-viirs-2023.csv` | NASA FIRMS country archive | 231,545 | 2,953 rows of detections. Do not add to MODIS counts and call the result a consistent historical series. |
| `samples/donki-sep-2024-may.json` | NASA CCMC DONKI API | 9,415 | 14 archived event entries. These are not radiation-dose measurements for a hypothetical lunar crew. |

## TrendProof build boundaries

- One region around the Dubai coordinate, two variables, complete years 2001-2025.
- POWER is gridded data. A point request is not a street sensor or an administrative-area average.
- Show source, units, period, missing values and spatial support in the interface.
- Use a fixed statistical method and report effect size and uncertainty. Account for seasonality and serial correlation. A short-window exploration must not silently replace the full-period analysis.
- Never infer causation, street-level conditions, heat mortality or future climate from this prototype.
- The LLM extracts and interprets the user's requested test. It must not invent observations, execute arbitrary generated analysis, or supply the numerical result.
- Evaluate extraction on a small frozen test set, including unsupported and ambiguous claims. Compare with a simple keyword baseline and report the actual counts and failures.
- Verify calculations independently and keep a labelled local replay for demo recovery.

## Important existing work

- NASA Hydrology Copilot: https://ntrs.nasa.gov/citations/20260008415
- Climate-FEVER: https://www.sustainablefinance.uzh.ch/en/research/climate-fever.html
- Climate Feedback: https://science.feedback.org/climate-feedback/
- MicroFire Atlas: https://github.com/A-K-M-Asifuzzaman/MicroFire-Atlas/blob/main/README.md
- Pyro-Harmony: https://github.com/hrishi25-spec/NASA-Space-App-Challenge

These establish that broad climate chat, climate fact-checking, combustion evidence dashboards and MODIS/VIIRS harmonisation already exist. Project README statements establish feature overlap, not independently verified accuracy or impact.

## Challenge-source limitation

The central Space Apps catalogue identifies 14 challenges. Its full detail pages did not reliably render during this research. Full statements were read from local organiser HackAthlone's copies and cross-checked against the UAE catalogue. HackAthlone says resource links are due on Friday 13 November. Check those links and the final local submission requirements when released.

- Catalogue: https://www.spaceappschallenge.org/2026/challenges/
- Full organiser copies: https://hackathlone.com/challenges
- UAE catalogue: https://nasaspaceapps.ae/challenges
- University of Dubai dates: https://events.ud.ac.ae/e/1277

The build plan assumes the user's confirmed permission to start before the event and a local target submission time of Saturday 14 November at 11:30 GST, with a buffer to noon.
