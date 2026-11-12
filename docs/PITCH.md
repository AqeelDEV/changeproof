# ChangeProof: pitch

Live site: https://changeproof-dusky.vercel.app. Code: https://github.com/AqeelDEV/changeproof. Every verdict is "as of 17 Jan 2026, 03:42 UTC". NISAR data is Beta.

## A. Three-minute script

The tour has five steps. Each step below gives the time, what to click and what to say. Keep the pace slow. Practise the click path five times.

### 0:00 to 0:35. Step 1: optical saw cloud, radar saw the flood

Click: open https://changeproof-dusky.vercel.app and press "Take the tour". Step 1 opens the Evidence tab with the cloud panel beside the 17 Jan radar image. Point at the two optical images, then at the map.

Say:
"In January 2026, floods hit southern Mozambique. This is what optical satellites saw. Landsat on 20 January: 95% cloud. Sentinel-2 on 19 January: thick cloud over our area. Sentinel-2 on 17 January, four hours after NISAR: 100% cloud. Radar sees through cloud. This is what NISAR saw."

Click: nothing. Stay on step 1 while you finish the sentence, then press "Next".

### 0:35 to 1:05. Step 2: slide from 5 Jan to 17 Jan at Chókwè

Click: step 2 zooms to Chókwè. Open "Layers" if it is closed and move the "Before / after" slider slowly from right to left and back.

Say:
"This is NISAR, track 114, Beta data. Left is 5 January. Right is 17 January, at 03:42 UTC. Dark means smooth open water. The town sits in a wide dark area that was not there twelve days earlier."

### 1:05 to 1:40. Step 3: new water, the Copernicus outline, the agreement figure

Click: press "Next". Step 3 switches to AOI05 with the blue and red overlays on. Scroll the Evidence tab to "Agreement with Copernicus".

Say:
"Blue is new open water that we detect. Red is the Copernicus observed flood, from a different radar, Sentinel-1, 24 minutes before NISAR. On the held-out area the agreement with Copernicus is IoU 0.574 for the current model. One clean test gave 0.572. A tuned threshold rule gave 0.521. This is agreement with Copernicus, not accuracy. Copernicus is our reference. We do not claim a better flood map."

### 1:40 to 2:15. Step 4: a published claim, checked

Click: press "Next". Step 4 runs the AIM claim of 17 Jan by itself and shows the verdict card. Press "Show Chókwè on the map".

Say:
"This sentence was published by AIM on 17 January: 'The flood waters of the Limpopo river have engulfed the town of Chokwe.' The parser only splits it into place, date and type. Fixed rules do the rest. Verdict: supported, as of 17 January, 03:42 UTC. 42% of the area within 3 kilometres of Chókwè was newly under open water. The rule needs 10%."

### 2:15 to 2:45. Step 5: what NISAR cannot say, then export

Click: press "Next". Step 5 runs "Xai-Xai was under water on 25 Jan" by itself. Then press the preset "Homes were destroyed in Chókwè". Then press "Export report (.md)".

Say:
"Now what NISAR cannot say. 'Xai-Xai was under water on 25 January': not observable. NISAR's last pass on this track was 17 January. 'Homes were destroyed in Chókwè': not provable. Radar open-water detection says nothing about damage. The evidence report lists the granule IDs, the numbers and the limits."

### 2:45 to 3:00. Close

Say:
"ChangeProof does not replace Copernicus or OPERA. It turns their evidence and NISAR's into a sentence you can defend, and says so when it cannot."

### Notes for the presenter

- If the site is slow, open the backup video.
- If asked about a number, say where it comes from. The areas' stats files hold every figure shown.
- Do not say "accuracy", "lives saved" or "damage".

## B. Ten judge questions, short answers

1. **Why not just use Copernicus or OPERA?**
For this flood you should, and we do. They are our reference. Copernicus is on demand: it was activated on 17 January, a week into the event, and covers only the areas requested. OPERA has no NISAR water product for January 2026. Neither answers a claim. ChangeProof does that last step and adds NISAR's L-band as a second look.

2. **Beta data is not fully calibrated.**
Yes. We use relative change, remove each area's median over land with no water on record, use the same processing version (X05010) on both dates, and label every output as Beta. The 17 January scene is about 3 dB brighter overall, which is why the median is removed.

3. **What is your ground truth?**
None. We report agreement with a Copernicus map made from Sentinel-1, 24 minutes before the NISAR pass on AOI05. On AOI01 the maps are 11 hours before and 35 hours after, so we score only where they agree.

4. **Does machine learning beat a threshold?**
Slightly, on the held-out area. LightGBM scored IoU 0.572 on AOI05 in one clean test. The tuned rule scored 0.521. After a later fix, the rerun scored 0.574, and it is labelled as not a clean test. The model mostly learns a smoothed 17 January HH threshold, and its gain over the rule is recall.

5. **How did you prevent leakage?**
We tuned on AOI06 only, with spatial blocks of 3 km, not random pixels. The test area, AOI05, is a different frame and a different river. It was scored once before the fix. Out of fold on AOI06, the IoU is 0.570.

6. **Why do you disagree with Copernicus in places?**
Copernicus used C-band radar and we use L-band, and the two see flooded vegetation and smooth dry ground differently. The clearest case is Palmeira. NISAR shows 1.14% of the area newly under open water and Copernicus 0.72% of the open ground. That one disagreement causes the three misses in our 45 test claims. We did not move the thresholds to hide it.

7. **Can you say homes were destroyed?**
No. The verdict is not provable. We can show how many mapped buildings sit inside detected open water: 15 on AOI05, 5 on AOI06 and 824 on AOI01. The count can be too high or too low, and says nothing about damage.

8. **Was 5 January really "before"?**
Mostly. Rain began earlier, so some water was already there. 5% of AOI05's detected new water (738 ha) was already dark on 5 January, 6% on AOI06 and 17% on AOI01. We say so in the limits. Both frames also have passes on 30 November, 12 December and 24 December, and the app shows them in a five-date strip.

9. **Can the language model invent a verdict?**
No. It only fills fields: place, date and type. It is optional and the app works with the rule-based parser alone. Verdicts come from fixed rules on computed numbers. If the parser and the model disagree, the verdict is not provable.

10. **Does it generalise?**
Unproven. It is one event and one track. Validated NISAR data only began in October 2026, and an OPERA NISAR water product can replace our detector when it covers events like this one. The claim logic does not depend on our detector.

## C. 30-second video shot list

| Time | Shot | Caption or voice |
|---|---|---|
| 0:00 to 0:04 | Cloud card: Landsat 20 Jan and the 19 Jan Sentinel-2 image, all white | "Optical saw cloud." |
| 0:04 to 0:09 | Radar swipe 5 Jan to 17 Jan at Chókwè | "NISAR radar saw the flood." |
| 0:09 to 0:14 | New water in blue, Copernicus outline in red, IoU 0.574 in the stats panel | "Checked against Copernicus." |
| 0:14 to 0:21 | Claim typed: the AIM sentence, verdict "supported", 42% | "Type a claim. Get a verdict." |
| 0:21 to 0:26 | "Xai-Xai under water on 25 Jan": not observable. "Homes destroyed": not provable | "And what the data cannot say." |
| 0:26 to 0:30 | Evidence report export, then title card with https://changeproof-dusky.vercel.app | "ChangeProof. Beta data, as of 17 Jan 2026, 03:42 UTC." |
