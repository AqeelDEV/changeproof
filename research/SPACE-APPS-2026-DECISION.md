# Space Apps 2026: project decision for a solo full-stack developer

Research checked on 11 November 2026. All scores, working-hour budgets and proposed evaluation-set sizes below are planning judgements, not measured results or NASA predictions. Download sizes are marked as measured, catalogue-listed or estimated. Repository descriptions establish feature overlap, not independently verified performance.

## Decision

**Try ChangeProof, the NISAR version of TrendProof, first. Give data access and a comparable scene pair two hours tonight. If that fails, build TrendProof Climate.** Decide by Thursday morning. The Dubai organisers' explicit encouragement of NISAR is a meaningful local advantage, as reported by the participant. I found no evidence that global judges award extra points simply for using NISAR.

ChangeProof checks one kind of claim: whether open-water extent changed in a defined area between two observations. Its user is a district communications officer or local journalist preparing a flood update. Its distinctive interaction is an evidence audit: show what the sensors measured, what the analysis inferred, and which parts of the proposed public statement remain unsupported. Submit it to **Dancing with the SARs**. Two radar scenes are not a defensible long-term climate trend.

The original Missing Layer earthquake-slope idea remains a poor solo choice. A processed radar product can reduce data preparation, but it does not establish slope instability or a validated inspection priority.

NASA selects global winners in several categories. There is no defensible numerical probability that any of these ideas will win. The practical objective is to maximise the chance of a complete, credible, distinctive submission, while preserving enough time for a strong presentation and project page.

## What was checked

The central [2026 catalogue](https://www.spaceappschallenge.org/2026/challenges/) identifies 14 challenges. Central detail pages did not reliably render. I read the published full statements from local organiser [HackAthlone](https://hackathlone.com/challenges) and cross-checked the [UAE catalogue](https://nasaspaceapps.ae/challenges). HackAthlone says challenge resource links become available on 13 November. That means the briefs can be assessed now, but Friday's official resources still need a final check.

The [University of Dubai page](https://events.ud.ac.ae/e/1277) confirms 13–14 November. The plan below uses the participant's more specific onsite timetable and a conservative submission target of Saturday 11:30, with a buffer to noon. It accepts the participant's confirmed permission to build before the event.

## All 14 challenges

| Published challenge | What a successful response needs | Assessment for this participant |
|---|---|---|
| [Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars](https://hackathlone.com/challenges/nasas-discarded-equipment-storytelling) | An engaging, accurate story about actual hardware and the science it enabled, for school-age audiences. | Easy data and feasible software. Storytelling quality matters more than adding AI. |
| [Be An Earth System Trend Detective!](https://hackathlone.com/challenges/earth-system-trend-detective) | Select variables and a region, visualise a sufficiently long series, calculate change and assess significance. | Excellent fit using small POWER/MERRA-2 extracts. Statistical care is essential. |
| [Build a Junior Astronaut Mission Trainer](https://hackathlone.com/challenges/junior-astronaut-mission-trainer) | Teach ages 7–12 real outpost trade-offs through playable decisions, grounded in NASA information. | Strong demo potential. Keep to two or three resources. |
| [Lunar Landing Site Navigator](https://hackathlone.com/challenges/lunar-landing-site-navigator) | Compare landing sites and dates using Sun/Earth visibility, terrain, power and communications constraints. | Attractive UI, but terrain-dependent horizons are specialist work. AI is not necessary. Older local listings use a CLPS browser title. |
| [Create Health Monitoring Software for Astronauts on Space Missions](https://hackathlone.com/challenges/health-monitoring-software) | Help astronauts enter, understand and respond to health indicators using space-health evidence. | Easy dashboard, difficult clinical validity. Poor choice for unsupported diagnostic ML. |
| [Dancing with the SARs](https://hackathlone.com/challenges/dancing-with-the-sars) | Use NISAR to track and communicate surface change, with an intuitive interactive presentation and contextual evidence. | Strong local signal. Use a small Level-2 GCOV case, not raw SAR processing. |
| [Field Shift: Adapting Farms with NASA Data](https://hackathlone.com/challenges/adapting-farms-with-nasa-data) | Combine Earth observations and local crop/soil information to help compare rotation options and their limitations. | Data can be easy, but credible crop recommendations need agronomic inputs and review. |
| [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://hackathlone.com/challenges/flame-in-freefall) | Summarise, rank and interpret combustion experiments for space fire safety. | Strong fit for structured extraction, but an extensive competing 2026 project already exists. |
| [Harmonization of MODIS and VIIRS Hot Spots](https://hackathlone.com/challenges/modis-and-viirs-hot-spots) | Build a consistent historical hotspot series and an interactive burning-activity calendar. | Small CSVs are excellent. Sensor harmonisation is scientifically harder than the UI. |
| [Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars](https://hackathlone.com/challenges/permanent-moon-base-locations-and-mars) | Find terrestrial analogue sites using relevant physical characteristics and explain the limits of the analogy. | Good map project, but a weak natural need for ML and substantial domain interpretation. |
| [Interplanetary Survival Guide: Martian Map](https://hackathlone.com/challenges/interplanetary-survival-guide-martian-map) | Combine complementary Mars layers to support terrain/science exploration and route decisions. | Integration-heavy, crowded, and unsafe to present as validated astronaut navigation. |
| [Planet X and SPHEREx](https://hackathlone.com/challenges/planet-x-and-spherex) | Let users inspect temporal infrared image patches and look for changing or moving objects. | Small cutouts help, but alignment, wavelength and artefacts require astronomy knowledge. |
| [Space Mission Design Game](https://hackathlone.com/challenges/space-mission-design-game) | Make mission objectives, instruments, orbit, mass, power, budget and operations into meaningful design trade-offs. | Broad scope. A narrow educational game is feasible; a whole mission simulator is not. |
| [The Earth Information Jukebox](https://hackathlone.com/challenges/the-earth-information-jukebox) | Pair Earth Information Center visual frames with dynamic sonification, with accessibility in mind. | Technically feasible and presentable. ML is optional, and sonification already has strong precedents. |

## What the 2022–2025 winners actually show

I reviewed the official winner summaries for all four years. I did not independently run every historical demo, inspect every model or verify every claimed impact. Patterns below are inferences from the published project descriptions, not proof of what caused a win.

| Year and primary source | Examples | Useful lesson |
|---|---|---|
| [2022 winners](https://www.spaceappschallenge.org/blog/2022-global-winners/) | Selene presented moonquakes interactively; Team Diamonds used a game for children; What's New? applied ML to solar-storm forecasting. | A recognisable interaction and audience matter. Specialist ML entries sometimes had substantial domain or research experience. |
| [2023 winners](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/) | Arcobaleno used sonification for accessibility; Spacebee explored Apollo seismic data; Space Quest Maidens explained eclipses to children. | Accessibility, educational design and making difficult data understandable can be central innovations. |
| [2024 winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/) | WaterWise served water-management decisions; Quake Heroes detected seismic signals; Landsat Connect helped users access observations; EcoMetropolis taught sustainability through play. | Connect NASA data to a particular task. Neither a large dataset nor a complicated model is sufficient on its own. |
| [2025 winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/) | SpaceGenes+ supported research questions; SkySense focused on activity/weather decisions; HerCode Space used illustrated storytelling. SpaceGenes+ lists one team member. | Solo success is possible, but that does not establish solo winning odds. Clear use cases and different presentation formats can all succeed. |

Four practical conclusions follow:

1. **Demo quality:** the published winners often have a simple central interaction that can be explained quickly. I cannot substantiate the claim that all had polished, reliable live demos. Your own demo should show a decision changing, not a tour of menus.
2. **NASA data:** make the dataset indispensable to the result. Show source, observation dates, units and the transformation from data to output.
3. **User focus:** identify one person and one task. 'Everyone can explore the planet' is harder to validate than 'a local reporter checks one flood statement'.
4. **Validation:** the summaries do not establish that every winner conducted user interviews or rigorous external evaluation. Nevertheless, a small honest held-out evaluation and a traceable calculation are strong evidence you can produce this weekend.

The five scoring dimensions requested match the [2025 judging guide](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf). A final 2026 rubric was not independently verified here. Your project page, source links and recorded explanation must stand on their own for later judging.

## Ranking

Scores are out of five for the tightly scoped prototype described below. Impact is plausible user value, not demonstrated adoption. Validity is attainable scientific defensibility, conditional on carrying out the stated checks. Ranking also considers solo completion risk and the reported Dubai preference, so it is not simply a sum.

| Rank | Project | Impact | Creativity | Validity | Relevance | Presentation | Decision |
|---|---|---:|---:|---:|---:|---:|---|
| 1, conditional | ChangeProof: NISAR claim audit | 4 | 4 | 3 | 5 | 5 | Best strategic option if the data/reference gate passes. Creativity assumes the stress-test workflow, not a chatbot map. |
| 2 | TrendProof Climate | 4 | 3 | 4 | 5 | 5 | Best reliable solo choice with the data already tested. |
| 3 | SmokeScope | 4 | 3 | 3 | 5 | 4 | Worth considering only as a detector-specific workflow. |
| 4 | MissionDebrief | 3 | 3 | 4 | 5 | 5 | Strong delivery prospects; crowded field and weaker data dependence. |
| 5 | FireBridge | 4 | 2 | 3 | 5 | 5 | Excellent data access, but direct feature overlap with an existing 2026 project. |
| 6 | RotationReplay | 4 | 2 | 2 | 5 | 4 | Agronomic validity and a weak need for ML limit it. |
| 7 | BlinkBench | 3 | 3 | 2 | 5 | 4 | Interesting, but a weekend can disappear into image interpretation. |
| 8 | The Missing Layer | 4 | 3 | 1 | 5 | 4 | Do not choose solo without a suitable radar collaborator and validated inputs. |

If ChangeProof cannot obtain interpretable data and suitable reference evidence promptly, it drops below the first three. A strong validity score must be earned, not supplied by the project's name or an uncertainty badge.

## 1. ChangeProof: NISAR surface-change claim checking

**Challenge and fit:** Dancing with the SARs, strong. The actual output is an interactive analysis of NISAR-observed change, organised around a public claim.

**Problem and user:** a district communications officer or local journalist wants to publish 'open water expanded around this settlement'. They need to know whether the observations support that wording and how much of the area was actually assessed.

**Data and access:** use two comparable Level-2 GCOV observations, one small area and the same available polarisation channels. GCOV is geocoded backscatter, not displacement. [ASF's GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/) explains the corrected measurements and layers. HDF5 is the science format; export small analysed subsets to GeoTIFF and lightweight web overlays. Use the [official streaming/subsetting recipe](https://asfopensarlab.github.io/NISAR_Cookbook/search-stream-nisar-asf-search/).

I queried ASF directly and verified January 5 and 17 Mozambique scenes on track 114, ascending, frame 166, HH/HV, with the same processing identifier X05010. Catalogue-listed sizes are approximately **2.35 GB and 2.18 GB**. Both URLs redirect to Earthdata Login. Their science contents were not downloaded. These are **Beta** products. I also verified Provisional and Validated entries, including a validated October 28 scene listed at **1.53 GB**. A complete matched validated pair was not established. Exact catalogue results and URLs are in `NISAR-AVAILABILITY.md` and the saved JSON files.

[ASF's current maturity guide](https://nisar-docs.asf.alaska.edu/products-overview/) says Beta products are not fully calibrated, Provisional products are calibrated and partly validated, and Validated Level 0–2 products were released on November 6 for acquisitions from October 21 onwards. Mixing maturity levels can introduce processing differences that resemble real change. Prefer a comparable Provisional or Validated pair for quantitative work. NASA's [January Mozambique visualisation](https://svs.gsfc.nasa.gov/5661) confirms a real event, but its rendered PNGs are explanatory media, not analysis rasters.

**AI that earns its place:** an LLM extracts the place, dates, claimed quantity and interpretation from a paragraph, then asks for confirmation if ambiguous. For example, 'water expanded', 'homes were destroyed' and 'the dam caused flooding' require different evidence. Hard-coded checks determine product compatibility, and deterministic code calculates areas. A small random forest can classify open water from polarisation features if independent labels are available. Compare it against a simple threshold baseline. If it adds no value, do not claim ML is necessary for the mapping.

**Weekend validation:** freeze a small labelled claim set with held-out examples; check field extraction, unsupported-claim detection and citation correctness. Evaluate water mapping against independent, closely timed reference observations in spatially separated test areas, reporting precision, recall and intersection-over-union. Label agreement with another satellite product as agreement, not field truth. Record acquisition-time differences. An [independent UNOSAT map](https://unosat.org/products/4232) exists for January 23–24; it is not ground truth for the January 17 NISAR observation.

**Existing work:** NASA already publishes NISAR flood comparisons. [OPERA](https://www.jpl.nasa.gov/go/opera/products/) provides water-mapping products, and the public 2026 [disasterWatch](https://github.com/BErukky/disasterWatch) project overlaps with multi-source disaster monitoring. [Hydrology Copilot](https://ntrs.nasa.gov/citations/20260008415) already combines natural-language requests, query validation and Earth-data analysis. The 2025 CeaSAR project, described by its [local organiser](https://hackathlone.com/blogs/how-to-choose-a-space-apps-challenge), is an adjacent radar-flood precedent, not a global winner or the same NISAR workflow. Do not claim to have invented radar flood mapping or conversational Earth science.

**Feasibility:** solo, 28–35 focused hours only after a successful data gate; three people, much better if one handles radar interpretation/reference labels, one the interface, and one evaluation/presentation. Three generalist coders do not remove the scientific gap.

**Biggest risk:** a persuasive interface that checks metadata correctly but still makes an invalid physical interpretation. Treat 'unknown' as a separate outcome. Avoid house-damage, flood-depth, safe-route and causality claims.

## 2. TrendProof Climate

**Challenge and fit:** Be An Earth System Trend Detective!, strong. Select a regional variable, show the series, estimate the trend and assess its uncertainty.

**Problem and user:** a student newsroom or local journalist wants to check a regional temperature or humidity trend statement without choosing misleading dates or confusing monthly means with extreme events.

**Data:** [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/), using MERRA-2 meteorological data through point requests. JSON and CSV avoid raster processing. I downloaded temperature and relative humidity at the Dubai coordinate for 2001–2025: **10,247 bytes**, with 300 monthly entries and 25 annual entries per variable. Exclude the annual month-13 entries from monthly analysis and handle the -999 missing-value marker. This is a grid-supported estimate at a coordinate, not street-level weather or a city-boundary average. Exact source URL is recorded in `samples/access-checks.json`.

**AI:** extract a testable claim from prose and identify ambiguities such as average temperature versus hottest days, relative humidity versus absolute moisture, and regional change versus causation. AI is useful for this unstructured input task; it is not necessary for regression and must not produce numerical results itself.

**Validation:** use a small frozen set of paraphrases, ambiguous statements and unsupported requests. Compare extraction with a keyword baseline. Independently verify calculations. Use a fixed monthly trend model that handles seasonality and serial correlation, with effect size and uncertainty. [Statsmodels](https://www.statsmodels.org/dev/generated/statsmodels.regression.linear_model.OLSResults.get_robustcov_results.html) documents autocorrelation-robust covariance methods. Show exploratory subperiods as exploratory; do not search for the most favourable p-value. Aim for two or three real user task trials and report actual completion problems, not adoption claims.

**Existing work:** NASA POWER's viewer and Giovanni already expose Earth data. Hydrology Copilot already performs natural-language analysis. [Climate Feedback](https://science.feedback.org/climate-feedback/) and the [Climate-FEVER research dataset](https://www.sustainablefinance.uzh.ch/en/research/climate-fever.html) establish that climate claim checking is not new. Public 2026 [Living Earth Trend Detective](https://github.com/yasar-sys/living-earth-trend-detective) demonstrates same-challenge competition. Past TerraTales in 2024 is adjacent climate communication, not an exact equivalent. The defensible distinction is a small reproducible regional statistical audit with careful language and refusal behaviour.

**Feasibility:** solo 25–30 hours; three people allow a statistics reviewer and meaningful user trials. **Biggest risk:** becoming an ordinary chart with an LLM text box, or presenting naive significance tests as scientific certainty.

## 3. SmokeScope

**Challenge and fit:** Flame in Freefall, strong if limited to smoke detection evidence.

**Problem and user:** a spacecraft fire-detection researcher needs to compare what different detectors detected or missed under specific experiment conditions, and locate missing evidence.

**Data:** NASA PSI's [SAME investigation](https://psi.nasa.gov/physci/repo/data/investigations/PSI-102), linked reports and NTRS PDFs. Two verified downloads total about **2.9 MB**: [SAME particle results](https://ntrs.nasa.gov/citations/20130000422) and a [smoke-detector reference study](https://ntrs.nasa.gov/citations/20205003817). PSI raw data access was not independently tested. A proposed six-document corpus is a scope choice, not a requirement to download an entire archive. Separate ground experiments from microgravity results.

**AI:** turn varied prose and tables into a structured matrix of material, detector, environment, measurements, result and source page. Retrieval helps answer a research question across reports. Avoid an AI-generated detector safety rating.

**Validation:** manually label a small evidence set, hold out at least one document, score extracted fields and citation support, check units, and include questions the corpus cannot answer. A subject reviewer should inspect the final scientific interpretations.

**Existing work:** the public 2026 [MicroFire Atlas](https://github.com/A-K-M-Asifuzzaman/MicroFire-Atlas/blob/main/README.md) already offers experiment comparison, evidence gaps, AI claim checks and research-planning features. Broad combustion RAG would overlap heavily. A detector-specific comparison workflow is narrower, but novelty remains incremental. SpaceGenes+ in 2025 is an adjacent research-evidence dashboard precedent; I did not verify an exact older Space Apps smoke-detector equivalent.

**Feasibility:** solo 28–35 hours; three people can split extraction, scientific review and interface. **Biggest risk:** incorrect comparisons between experiments, alongside substantial existing competition.

## 4. MissionDebrief

**Challenge and fit:** Junior Astronaut Mission Trainer, strong.

**Problem and user:** a teacher needs a short activity where children understand why a plausible mission decision can still fail. The child manages power and life support, then explains their reasoning.

**Data:** archived [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) events, plus cited NASA mission constraints. A May 2024 solar energetic particle response downloaded as **9,415 bytes of JSON**. Event timing can anchor a scenario; it is not a radiation-dose measurement for a hypothetical lunar crew. Label simplified resource units as game mechanics. Current API details matter because [CCMC has announced service changes](https://ccmc.gsfc.nasa.gov/news/major-updates/).

**AI:** classify the child's free-text explanation into a small teacher-reviewed set of misconceptions, then select a suitable follow-up challenge. The simulator follows deterministic rules. AI should not invent physics or freely generate advice for children.

**Validation:** test explanation classification on held-out examples and ask a teacher to inspect the scenarios. A small pre/post activity is a usability and comprehension pilot, not evidence of general educational efficacy.

**Existing work:** [NASA Space Place](https://spaceplace.nasa.gov/menu/games/), public 2026 [Last Light Academy](https://github.com/SadManQT/nasa-space-apps-2026) and [Outpost](https://github.com/jihadjp/outpost-app), plus past winners Diamond in the Sky, EcoMetropolis and HerCode Space. The difference must be feedback on reasoning, not another resource-management game with a space skin.

**Feasibility:** solo 25–30 hours; three people improve artwork, teaching review and playtesting. **Biggest risk:** NASA data becomes incidental and the AI could be replaced by a few buttons.

## 5. FireBridge

**Challenge and fit:** Harmonization of MODIS and VIIRS Hot Spots, directly aligned.

**Problem and user:** a regional fire analyst needs a historical burning calendar that does not mistake a change of sensor for a change in fire activity.

**Data:** [FIRMS historical country downloads](https://firms.modaps.eosdis.nasa.gov/download/). Tested Portugal 2023 downloads: MODIS **84,920 bytes**, VIIRS-SNPP **231,545 bytes**, about **316 KB combined**, both CSV. They contain 1,062 and 2,953 detection rows respectively, not unique fires. A longer small-country archive should remain manageable, but its total size was not measured. Use consistent historical science products rather than silently mixing near-real-time and archive processing.

**ML:** learn a regional relationship between overlapping sensor records, using an interpretable regression or quantile mapping. Compare with a constant-ratio and unadjusted baseline. Separate fire-radiative-power and detection-count interpretations.

**Validation:** hold out complete years, assess error and seasonal structure, and inspect known sensor transitions. This measures consistency with a reference sensor, not the true number of fires. Zero detections must not automatically mean an unobstructed fire-free observation.

**Existing work:** FIRMS already provides maps and downloads. The public 2026 [Pyro-Harmony](https://github.com/hrishi25-spec/NASA-Space-App-Challenge) already advertises harmonisation, sensor-transition diagnostics and burning calendars. Team I.O.'s 2024 GROW project is an adjacent wildfire GIS precedent. This is a particularly weak originality bet unless you find a specific unserved operational workflow.

**Feasibility:** solo 30–35 hours for one region; three people allow a stronger calibration audit. **Biggest risk:** an attractive calendar based on scientifically unjustified harmonisation.

## 6. RotationReplay

**Challenge and fit:** Field Shift, good if actual local crop and soil constraints are included.

**Problem and user:** an agricultural extension adviser compares an existing rotation with two alternatives against historical weather, explaining exposure and information gaps to a farmer.

**Data:** POWER daily JSON/CSV for rainfall and temperature, plus local crop calendars and soil information. One location is expected to require only a small, low-megabyte weather extract; that is an estimate, not a measured download. POWER does not supply field-specific soil health or crop-yield truth. Avoid adding several satellite missions merely to fill a dashboard.

**ML:** seasonal analogue retrieval or clustering could identify historically similar growing conditions. This is a weaker need for ML than the first three ideas. Agronomic rules and local expertise remain central; an LLM crop recommendation is not an agronomic model.

**Validation:** hold out seasons for weather-exposure estimates and have an adviser inspect the suggested rotations. Do not claim yield, profit or soil-health improvements without appropriate data.

**Existing work:** [FAO AquaCrop](https://www.fao.org/aquacrop/overview/about-aquacrop/), the public 2026 [Space Hunters](https://github.com/AhmedSalah-26/space-hunters) Field Shift project, and the 2024 WaterWise and 2plant winners. A generic satellite farm adviser is very crowded.

**Feasibility:** solo 25–35 hours for a comparison prototype; three people help only if one brings agriculture knowledge. **Biggest risk:** producing precise-looking recommendations unsupported by the data.

## 7. BlinkBench

**Challenge and fit:** Planet X and SPHEREx, strong for a temporal patch viewer with candidate review.

**Problem and user:** a citizen scientist wants to inspect a small sky area and prioritise possible changes without being overwhelmed by artefacts.

**Data:** NASA/IPAC [SPHEREx data at IRSA](https://irsa.ipac.caltech.edu/Missions/spherex.html), downloaded as FITS cutouts through [documented access services](https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/). Set a working budget of 10–100 MB for a small curated case; that is an estimate, and no cutout download was verified here. Use comparable wavelength information, masks and coordinate alignment. Different spectral sampling can resemble temporal change.

**ML:** rank candidate changes after a conventional registration/difference baseline, using quality features and artefact labels. Without suitable labels, a classical detector may be the more honest choice.

**Validation:** test recovery of clearly labelled injected sources and inspect known objects. Synthetic recovery does not prove discovery capability. Split evaluation by image/sky region rather than randomly separating neighbouring pixels.

**Existing work:** IRSA already supplies a SPHEREx Data Explorer. [Backyard Worlds](https://www.zooniverse.org/projects/marckuchner/backyard-worlds-planet-9) establishes the citizen-science blinking approach. Resonant Exoplanets in 2025 is adjacent astronomy ML, not a direct equivalent. An exact prior Space Apps SPHEREx version was not verified.

**Feasibility:** solo, a viewer may fit 30–35 hours, but a defensible ML detector is uncertain; three people need one astronomy contributor. **Biggest risk:** presenting instrumental artefacts as astronomical discoveries.

## 8. Benchmark: The Missing Layer

**Challenge and fit:** Dancing with the SARs, strong in concept if it actually uses NISAR measurements.

**Problem and user:** a response-team geospatial analyst prioritises slopes for field inspection following an earthquake, using displacement observations, observation gaps and exposed communities.

**Data:** appropriate NISAR interferometric products, coherence/quality information, terrain and exposure layers. GCOV alone does not measure displacement. GUNW supplies interferometric information requiring careful interpretation. [ASF's product guide](https://nisar-docs.asf.alaska.edu/using-overview/) documents HDF5 products, large file sizes and the expertise needed for advanced processing. Exact event coverage and total payload were not established. The GCOV files checked in this research ranged from roughly one to several GB, but that is not a measured GUNW workload.

**ML:** inspection ranking might be a transparent rules-based combination of exposure and observation quality. Training a useful slope-failure model requires relevant event labels and validation you do not currently have. A visually impressive risk score would not fix that.

**Validation:** needs independently mapped landslides/field reports, separation of earthquake deformation from slope movement, and spatial/event holdouts. Loss of coherence has several possible causes. Line-of-sight displacement is not a complete 3D movement vector and does not establish slope safety.

**Existing work:** [ARIA](https://aria.caltech.edu/products/) already distributes disaster-related deformation and damage products; [LHASA](https://github.com/nasa/lhasa) is an existing landslide-hazard framework, but rainfall-triggered hazard is not earthquake-slope validation. The public disasterWatch project overlaps with the broader interface. CeaSAR is an adjacent radar-flood precedent. No exact older Space Apps replica was verified.

**Feasibility:** not a credible solo scientific product in this window. With three people it becomes plausible only if one already knows SAR and brings validated event data. **Biggest risk:** confusing measured motion, missing observations and actual landslide danger.

## Top choice: make ChangeProof more creative and more valid

The core interaction should be **claim → comparable evidence → stress test → qualified statement → reproducible record**.

**1. Make the claim editable and testable.** Extract location, dates, variable, magnitude and scope from prose. Show them as editable fields before analysis. Separate 'open water increased' from 'houses were destroyed' or 'a dam caused the flood'. The latter claims need additional evidence.

**2. Add a paired-observation coverage view.** Calculate comparisons on common valid coverage. Visually distinguish observed change, excluded/ambiguous areas and unobserved areas. Report the area actually analysed. A missing pixel is not dry land. This is more useful than one vague confidence score.

**3. Add a claim stress test.** Recompute the conclusion across a small predeclared set of defensible thresholds or model settings. Show whether its direction survives those choices. Call this sensitivity analysis, not a statistical confidence interval. If every result depends on one fragile parameter, the interface should say so.

**4. Make alternative explanations visible.** Product maturity, track, polarisation, footprint, registration and acquisition timing are checkable conditions. Soil moisture, vegetation or surface roughness may also affect radar response. The system can identify a possible confounder without claiming to have proved which physical cause occurred.

**5. Export an evidence record.** Include the original claim, confirmed interpretation, granule IDs, subset boundary, timestamps, processing version, masks, method, parameters, reference-data timing and output. Another person should be able to reproduce the result. A JSON/CSV export is enough for the weekend.

These features do not make the project globally novel. Metadata validation and reproducibility are established scientific practice, and conversational analysis already exists. The creative contribution is packaging them into a fast, understandable editorial decision using NISAR.

**Three-sentence pitch:** Public flood statements often say more than the satellite evidence can support. ChangeProof checks a surface-water claim against comparable NISAR observations, reveals blind spots and tests whether the conclusion survives reasonable analysis choices. It produces an evidence record that a journalist or district officer can inspect, qualify and reproduce before publication.

**Must:** one area; one claim family; two comparable science rasters; confirmed dates and processing; common valid coverage; baseline water analysis with suitable reference evidence; an editable claim parser; qualified outputs; one reproducible export; local demo fallback. If suitable labels cannot be obtained, report radar-observed change and explicitly decline water-extent verification. That reduced result has lower impact and should trigger reconsideration of the climate fallback.

**Should:** threshold sensitivity, independent reference comparison with timing visible, a small held-out claim benchmark, one domain review and two target-user task trials. Human review is desirable, but no radar mentor is confirmed and the project must not pretend otherwise.

**Could:** a second area, Portuguese/Arabic output after the English workflow is tested, a shareable evidence page, or a second claim family. Cut all of these before cutting validation.

**The demo moment:** start with a draft statement about water expansion. Click 'test the claim' and expose an invalid comparison, such as mismatched processing or missing coverage. Switch to the prepared valid comparison, show exactly what can be concluded and export the qualified statement with its evidence. Use actual results; never predetermine a dramatic flood percentage.

**Honest scoring improvement:** creativity can plausibly rise from 3 to 4 with this interaction. Validity can plausibly rise from 2–3 to 4 only with genuine reference checks, correct observation handling and reported failures. A weekend prototype with limited independent validation does not merit a claimed 5/5 scientific validity.

## Fallback: TrendProof Climate scope

**Three-sentence pitch:** Local climate claims often hide a choice of metric, dates or geography. TrendProof turns a paragraph into an explicit statistical question and checks it against NASA's regional temperature and humidity series. It shows the trend, uncertainty and unsupported wording, then exports the calculation and a qualified statement.

**Must:** Dubai grid location; monthly temperature and relative humidity for 2001–2025; source/units/resolution visible; missing-value and annual-entry handling; fixed statistical method; editable claim extraction; supported/unsupported distinction; raw-data and method export; three prepared examples.

**Should:** one comparison location, transparent period sensitivity, held-out extraction tests, an independent calculation check and two or three user trials.

**Could:** Arabic interface, extra variables, additional regions and polished PDF output. Avoid adding NISAR to this multi-decade climate version just to collect another data source.

**The demo moment:** paste a claim about 'the hottest days', and show that monthly means cannot establish that claim. Change the wording to mean temperature, reveal the actual computed trend and uncertainty, then let a judge change the period and see how the qualified statement responds. Do not invent a trend direction before running the analysis.

## Hour-by-hour plan, Dubai time

Two alternative plans follow. Build one, not both. Example start: Wednesday 20:30. There are 28 focused build hours, plus short Friday mentor conversations and a Saturday submission buffer. If two hours are spent testing NISAR before switching, remove the climate comparison location and optional polish. Preserve sleep, evaluation and submission time.

| Time | ChangeProof | TrendProof Climate |
|---|---|---|
| Wed 20:30–21:30 | Earthdata access; select comparable products; inspect identifiers and QA. | Load tested POWER sample; define user and supported claims. |
| Wed 21:30–22:30 | Stream/crop the same small region in both scenes. Stop this route if it cannot be opened and aligned. | Clean monthly series; remove annual entries and missing values. |
| Wed 22:30–23:30 | Inspect polarisation, masks, common coverage and processing compatibility. | Plot actual data and check units, source and spatial support. |
| Wed 23:30–00:30 | Locate closely timed reference evidence; label a small pilot set. | Implement fixed trend calculation and independent numerical check. |
| Thu 00:30–01:30 | Run simple water baseline; write what the data can and cannot establish. | Create main Next.js workflow and result contract. |
| Thu 09:00–10:00 | Final go/no-go decision; freeze case and evaluation split. | Lock scope; implement seasonality/autocorrelation treatment. |
| Thu 10:00–11:00 | Finalise deterministic analysis and cached outputs. | Build claim extraction schema and editable interpretation. |
| Thu 11:00–12:00 | Trial small classifier only if reference labels support it. | Add unsupported and ambiguous request handling. |
| Thu 12:00–13:00 | Compare model with baseline on held-out spatial blocks. | Build chart, trend estimate and uncertainty display. |
| Thu 14:00–15:00 | Build map and before/after interaction. | Build evidence panel and download controls. |
| Thu 15:00–16:00 | Add common-coverage and excluded-area view. | Add period sensitivity with clear exploratory labelling. |
| Thu 16:00–17:00 | Build claim parser and confirmation fields. | Assemble frozen extraction benchmark and run it. |
| Thu 17:00–18:00 | Implement compatibility failures and qualified outcomes. | Fix observed failures; independently check calculations. |
| Thu 18:00–19:00 | Add small, predeclared sensitivity comparison. | Run first user task trials and simplify confusing UI. |
| Thu 20:00–21:00 | Export evidence record and source manifest. | Export data/method; add one comparison location only if ready. |
| Thu 21:00–22:00 | Evaluate claim parsing and refusal behaviour. | Deploy, cache data and prepare local replay. |
| Thu 22:00–23:00 | Deploy and make local fallback work. | Draft project page, limitations and actual results. |
| Fri 09:00–15:00, onsite | Seek a targeted review of one interpretation and one false-positive case; check final challenge resources. | Ask a mentor to review the statistical explanation and watch one user task; check final resources. |
| Fri 16:00–17:00 | Resolve the most consequential review finding. | Resolve the most consequential review finding. |
| Fri 17:00–18:00 | Finish held-out analysis and record failures. | Freeze results and record failures. |
| Fri 18:00–19:00 | Target-user trial; confirm the output answers a real publishing question. | Target-user trial; check whether wording and evidence are understood. |
| Fri 19:00–20:00 | Improve the single main screen and the demo path. | Improve the single main screen and the demo path. |
| Fri 21:00–22:00 | Write project page with evidence and limits. | Finalise project page and source attribution. |
| Fri 22:00–23:00 | Record a short demo and prepare slides. | Record a short demo and prepare slides. |
| Fri 23:00–00:00 | Rehearse, test offline recovery, freeze features. | Rehearse, test offline recovery, freeze features. |
| Sat 07:00–08:00 | Check deployment, sources, exports and saved demo. | Check deployment, sources, exports and saved demo. |
| Sat 08:00–09:00 | Final rehearsal and submission packaging. | Final rehearsal and submission packaging. |
| Sat 09:30–10:30 | Final mentor review; fix only critical errors. | Final mentor review; fix only critical errors. |
| Sat 10:30–11:30 | Submit all required material and verify it is accessible. | Submit all required material and verify it is accessible. |
| Sat 11:30–12:00 | Submission buffer. | Submission buffer. |

Use the stack already known: Next.js/TypeScript for the interface, Python for the scientific preparation, cached JSON/CSV and small raster overlays for the demonstration. Authentication, payments, elaborate AWS infrastructure and a general-purpose agent framework do not help the central judging question. Use a familiar deployment path and keep a labelled local replay if external services fail.

For a three-person team, assign one owner to data/science, one to the product interface and one to evaluation, sources and the presentation. The best additional recruit is someone who can challenge the interpretation, not simply add more code.

## Submission evidence worth showing

- One exact user task and the decision the prototype changes.
- One completed real-data case and one failure/abstention case.
- NASA source identifiers, observation dates and a reproducible transformation.
- The AI's actual task, the non-AI baseline and the held-out results, including errors.
- Honest limitations, particularly reference timing, resolution and product maturity.
- A short live demonstration plus a project page and recording that make sense without the presenter.

Do not claim lives saved, operational deployment, model accuracy, user demand or global novelty unless the work actually establishes it. A narrow result that survives scrutiny is a stronger submission than an ambitious claim the data cannot support.
