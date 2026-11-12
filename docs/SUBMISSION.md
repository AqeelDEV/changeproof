# ChangeProof: Space Apps project page (draft)

## Project name

ChangeProof

## High-level summary

Forecasts triggered early action: INGD activated anticipatory action for the southern basins, the Limpopo among them, on 6 to 8 Jan 2026, and the Government declared a national Red Alert on 16 Jan. ChangeProof is the step after the forecast: where the water went and which claims are true. Next, checking whether trigger forecasts came true.

ChangeProof checks a written flood claim against NISAR radar data. Optical satellites were clouded out during the January 2026 floods in southern Mozambique, and a map is not a verdict. Type a sentence and the app gives one of five verdicts: supported, not supported, contradicted, not observable or not provable. Each is stated as of 17 Jan 2026, 03:42 UTC, with the numbers and limits behind it. It never calls a flood claim false on silence: radar cannot show that a place stayed dry. Copernicus is the reference. We do not claim a better flood map.

## Detailed description

**What it does.** ChangeProof is a map app with a before and after swipe of NISAR HH and HV radar for 5 and 17 January 2026. It shows detected new water, the Copernicus observed flood, and a coverage map. A cloud card shows that optical images of 19 and 20 January were clouded out. You can also type a claim, or pick one of 11 published claims from news and UN reports. The app finds the place, the date and what is claimed, and returns a verdict. It exports an evidence report with the NISAR granule IDs, the numbers and the limits.

**How it works.** A Python pipeline reads NISAR GCOV Beta files (track 114, frames 165 and 166), converts them to dB at 30 m, and detects new open water with a LightGBM classifier. We compared it with a tuned threshold rule. Both were tuned on one area with spatial blocks and tested once on a different frame and river. On that held-out area, the rule scored an IoU of 0.521 and LightGBM 0.572 against Copernicus, so LightGBM is used. The claim parser is rule-based. An optional language model only fills fields and never decides a verdict. Fixed rules on measured numbers decide it.

**Benefits.** A journalist, fact-checker or aid analyst can see at once whether a sentence is supported by the radar, and also whether the data could ever settle it. A claim about 25 January is not observable, because NISAR's last pass on this track was 17 January. A claim that homes were destroyed is not provable from open-water detection.

**What is honest about its limits.** The data is Beta and not fully calibrated. Results are agreement with Copernicus, not accuracy. The clean test on the held-out area is 0.572. A later fix gave 0.574, which is not a clean test. One area's 0.835 is a diagnostic, and another's 0.577 is in-sample. Only open water is detected. The building count can be too high or too low, and says nothing about damage. It is one event.

**Tools and languages.** Python, LightGBM, rasterio, Next.js, TypeScript, Leaflet.

## NASA data used

- NISAR L2 GCOV, Beta release, track 114, frames 165 and 166, passes of 5 and 17 January 2026 (via the Alaska Satellite Facility).
- OPERA DSWx-S1 (dynamic surface water extent from Sentinel-1) for 5 and 17 January 2026.
- Harmonized Landsat Sentinel-2 (HLS) and OPERA DSWx-HLS for 19 January 2026.
- Landsat 9 Collection 2 Level-2 (NASA and USGS), 20 January 2026.

## Space agency partner and other data

- ISRO, partner on the NISAR mission.
- Copernicus Emergency Management Service, activation EMSR857 (observed flood layers).
- ESA Sentinel-1 (the basis of the AOI05 and AOI06 Copernicus maps).
- ASI COSMO-SkyMed (the basis of the AOI01 Copernicus map of 18 January).
- JRC Global Surface Water.
- OpenStreetMap contributors (places and buildings, ODbL).

## References

- [NISAR product overview, ASF](https://nisar-docs.asf.alaska.edu/products-overview/)
- [NISAR Beta known issues, ASF](https://nisar-docs.asf.alaska.edu/product-known-issues)
- [NISAR GCOV guide, ASF](https://nisar-docs.asf.alaska.edu/gcov/)
- [NISAR Cookbook: search, stream, subset](https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/)
- [NASA SVS 5661](https://svs.gsfc.nasa.gov/5661)
- [Copernicus EMS activation EMSR857](https://mapping.emergency.copernicus.eu/activations/EMSR857/)
- [Copernicus EMSR857 news](https://mapping.emergency.copernicus.eu/news/flood-in-mozambique-emsr857/)
- [OPERA products, NASA JPL](https://www.jpl.nasa.gov/go/opera/products/)
- [JBA event response: floods in southern Africa, January 2026](https://www.jbarisk.com/knowledge-hub/event-response/floods-in-southern-africa-january-2026/)
- [USGS Landsat STAC](https://landsatlook.usgs.gov/stac-server)
- [Challenge text: Dancing with the SARs](https://hackathlone.com/challenges/dancing-with-the-sars)
- Live site: https://changeproof-dusky.vercel.app
- Code (MIT licence): https://github.com/AqeelDEV/changeproof

## Use of AI

The app's optional language model only splits a claim into fields and never decides a verdict.

Complete this field on the form yourself.
