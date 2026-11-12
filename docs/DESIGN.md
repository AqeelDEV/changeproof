# ChangeProof design

One idea: **seen through cloud**. On 17 January 2026 southern Mozambique was under cloud. NISAR's radar looked through it at 03:42 UTC. Everything on screen follows from that: what the instrument saw, and what can honestly be written down about it.

This file is the reference for the globe at `/globe`, the checker at `/`, the printed report and the slides. If a screen and this file disagree, fix the screen or change this file on purpose.

## Two surfaces and one line

| Surface | Where | What it means |
|---|---|---|
| Space | globe, slides, header, tour bar | where the instrument looks |
| Report | checker, cards, evidence, print | where the verdict is written |

The one memorable element is the **pass line**: a thin line in the signal colour. It appears only where the instrument is acting:

1. the sweep that crosses the ground on the globe, south to north, as NISAR did;
2. the rule under the header, which carries "as of 17 Jan 2026, 03:42 UTC";
3. the left edge of the as-of stamp on a verdict card;
4. keyboard focus.

Nowhere else. Everything around it stays quiet.

## Colour

Contrast is the WCAG ratio, measured from the hex values. Text up to 17 px needs 4.5; larger or bold text and the edges of controls need 3.

### Surfaces and text

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--space` | `#0a1024` | Space surface | sand on it 15.8, paper on it 17.8 |
| `--space-raised` | `#151d3a` | bars and panels on Space | paper on it 15.6 |
| `--sand` | `#f1eadc` | Report page | ink on it 14.4 |
| `--paper` | `#fbf8f1` | cards, inputs | ink on it 16.3 |
| `--ink` | `#141a2e` | text on Report, solid buttons | paper on it 16.3 |
| `--ink-soft` | `#565c6e` | secondary text on Report | 5.6 on sand, 6.3 on paper |
| `--space-soft` | `#a9b0c6` | secondary text on Space | 8.7 on space, 7.7 on raised |
| `--edge` | `#757a8c` | borders of inputs and buttons on Report | 3.6 on sand, 4.0 on paper |
| `--edge-space` | `#6c7699` | borders of inputs and buttons on Space | 4.2 |
| `--rule` | `#d6ccb8` | hairlines on Report, decoration only | 1.3 |
| `--rule-space` | `#2b3560` | hairlines on Space, decoration only | 1.6 |

### Signal

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--signal` | `#b79cff` | pass line and focus on Space | 8.3 on space, 7.3 on raised |
| `--signal-deep` | `#5a35d6` | pass line and focus on Report | 6.0 on sand, 6.8 on paper |

Rules for the signal:

- It is a line 1 to 2 px wide, or a focus ring. Never a filled button, a background, a large glow or a gradient.
- Lilac is used on navy only; the deep violet on sand and paper only.
- **Never a mid violet.** `#8f6bff` is 0.4 away from the water blue for a protanope, which is the same colour.
- Never a filled area on a map.

### Data colours (fixed, never restyled)

| Colour | Hex | Means | Contrast |
|---|---|---|---|
| Water | `#1f78ff` | new open water NISAR detected (baked into the PNGs) | 4.7 on space, 3.8 on paper |
| Copernicus | `#e5382d` | flood mapped by Copernicus EMS | 4.4 on space, 4.0 on paper |
| Coverage | `#1b9e77`, `#bdbdbd`, `#e6ab02`, `#7570b3` | the coverage classes, as each `stats.json` legend names them | map only |
| Place dots | water blue, white, `#f0b429`, `#8a8f98` | water seen, none seen, cannot settle, too little data | map only |

One colour means one thing. Water blue is never used for a button, a link, a tab or a focus ring. Red on the map is Copernicus only; red on a card is "Contradicted" only. Links are ink, underlined.

### Verdicts

Badge values are unchanged from today.

| Label | Text on tint | Border | Text contrast | Mark |
|---|---|---|---|---|
| Supported | `#145a26` on `#d9f2df` | `#2e8b47` | 7.0 | filled disk |
| Not supported | `#6b4e00` on `#fff1cc` | `#c99a00` | 6.9 | empty disk |
| Not provable | `#6b4e00` on `#fff1cc` | `#c99a00` | 6.9 | half disk |
| Contradicted | `#8a1414` on `#fbdcdc` | `#c62828` | 7.5 | disk with a bar across |
| Not observable | `#333333` on `#e6e6e6` | `#888888`, dashed | 10.1 | dashed ring |

Colour alone never carries a verdict:

- The word is always there.
- Each verdict has a mark that is not colour. The mark is the checker's 3 km disk in the state the radar found it: water seen, none seen, cannot settle, water seen against the claim, not looked at. It matches the place dots on the map.
- This matters because the green and red tints are 1.9 apart for deuteranopia and 7.7 for protanopia (under about 10 is hard to tell apart), and the amber stripe is only 2.4 against paper.

### Colour-blind distances

Machado 2009 simulation, CIELAB distance. Under about 10 is hard to tell apart.

| Pair | Protan | Deutan | Tritan |
|---|---|---|---|
| Lilac `#b79cff` and water | 26 | 39 | 32 |
| Deep `#5a35d6` and water | 21 | 14 | 24 |
| Mid violet `#8f6bff` and water (banned) | 0.4 | | |
| Lilac and every other data colour | 40 or more | 40 or more | 18 against the grey of Not observable |
| Copernicus red and Contradicted red | 11 | | |

## Type

Three families, all under the SIL Open Font Licence, served from our own site so they work offline and in the static slides.

| Family | Voice | Used for |
|---|---|---|
| Newsreader | the claim and the verdict | quotes in italic; verdict words, headings and the large lines of the intro upright |
| Atkinson Hyperlegible Next | the instrument | interface, numbers, captions, credits |
| Atkinson Hyperlegible Mono | identifiers | NISAR granule IDs only |

A rule that carries meaning: **serif italic in quotes is always somebody's claim.** A preset, a published claim and the quote on a card all look the same, because they are the same kind of thing.

| Role | Face | Size and leading | Weight |
|---|---|---|---|
| Intro line | Newsreader | 5.6% to 8.6% of the screen width by the length of the line, never under 36px or over 128px / 1.04, tracking -0.02em | 500 |
| Verdict word, landing | Newsreader | 9% of the screen width, never under 48px or over 128px / 1 | 600 |
| Quote on the globe | Newsreader italic | clamp(24px, 3vw, 40px) / 1.2 | 400 |
| Verdict word, on a card | Newsreader | 28px / 1.1 | 600 |
| Quote on a card | Newsreader italic | 20px / 1.35 | 400 |
| Heading | Newsreader | 20px / 1.25 | 600 |
| Large number | Atkinson Next | 36px / 1, tabular figures | 600 |
| Body and controls | Atkinson Next | 15px / 1.5 | 400, 600 for emphasis |
| Small text | Atkinson Next | 13px / 1.45 | 400 |
| Granule ID | Atkinson Mono | 11.5px / 1.4 | 400 |

- Nothing is set below 11.5 px. No light or thin weights.
- Sentence case everywhere. No all-caps labels, no letter-spaced labels, no meta lines joined with dots, no arrows after link text.
- Lines of text stay under about 75 characters.
- Numbers use tabular figures, so a count-up does not jitter.

## Shape and depth

- Cards are solid paper with a hard edge (1 px ink) and a real shadow, like a report laid on a dark table. Corner radius 2 px. Nothing is blurred behind them and nothing is see-through.
- Controls (inputs, buttons) have a 4 px radius. Buttons are solid ink with paper text on Report and solid sand with ink text on Space. Secondary buttons are an outline in the edge colour.
- Shadow on Report: `0 1px 0 rgba(20,26,46,.25), 0 10px 24px -14px rgba(20,26,46,.45)`. On Space: `0 18px 48px -18px rgba(0,0,0,.7)`.
- No gradients, except the short fading trail behind the sweep.

## Motion

GSAP is the only animation library and drives one timeline. Camera values are tweened and the map jumps to them each frame, so the journey can be paused, skipped or replaced by stills.

### The intro, about 13.5 seconds

It plays once, on a visitor's first load. A small "Skip" is on screen from the first frame. Any click or key stops it where it is and hands over the globe and the claim input. Later loads go straight to the globe, with "Replay intro".

| Time | Camera | Type on screen | Ease |
|---|---|---|---|
| 0 to 1.5 s | the Earth drifts slowly | "17 January 2026." | none (constant drift) |
| 1.5 to 3.5 s | southern Africa reaches the centre | "Southern Mozambique from space: cloud." | none |
| 3.5 to 7.5 s | one dive to Chókwè, tilting in the last 1.2 s | "Radar sees through cloud. NISAR passed at 03:42 UTC." | power2.inOut |
| 7.5 to 10.5 s | still; the pass line sweeps south to north | the claim, in quotes | none (a pass has constant speed) |
| 10.5 to 13.5 s | still; the 3 km disk draws, the verdict lands | "Supported", then the two numbers | power3.out |

The first two beats are short; the dive, the sweep and the landing keep their full length. The card then stays on screen, so the verdict can be read for as long as needed.

The verdict beat shows exactly two numbers, each with its label, both read from the result's evidence:

- `new_water_share`: "42% of the area NISAR saw"
- `new_water_ha`: "1,191 ha newly under open water"

No hectare figure appears without its label.

### Small moves

| Move | Duration | Ease |
|---|---|---|
| A line of type appears or leaves | 0.5 s, opacity only | power2.out |
| Verdict word lands | 0.45 s, scale 1.06 to 1 with opacity | power3.out, one settle, no bounce |
| Numbers count up | 1.2 s, ending on the exact value | power1.out |
| Card settles | 0.35 s, 12 px upward with opacity | power2.out |
| Disk draws | 0.6 s, stroke only | power1.inOut |
| Hover and focus | 0.12 s, colour only | linear |

Things that do not move: sections do not fade in on scroll, cards do not lift on hover, nothing loops.

### The sweep is not data

A line 1 to 2 px wide in lilac, with a 1 px navy keyline on its leading side so it reads against white cloud, and a trail that fades within half a second. It is never blue and never filled, and it is gone when the reveal ends. What remains on screen is only data.

### Reduced motion

When the system asks for reduced motion: no camera flight, no sweep, no count-up. The opening still with its line, then the final view with the card, each with a 0.3 s cross-fade. Nothing is told by motion alone: every beat's fact is also in the text of the card.

### Smoothness before flourish

Pixel ratio capped, no blur anywhere, the sweep moved by transform only. If the frame rate drops, things go in this order: the trail, the tilt, the air glow, the stars. The story stays.

## Components

**Caption band (globe).** The picture fills the top two thirds of the screen. Below it is a solid band of the Space colour that carries the large type during the intro and the claim input and presets afterwards. Type never sits on the image, and the image is never darkened or tinted to carry type: white type on white cloud cannot be read, and a dimmed image is no longer what the satellite saw. Only the verdict card and "Skip" sit over the picture, both solid.

**Header and pass line.** Space surface. The name in Newsreader on the left, links on the right. Under it, the pass line: a 2 px lilac rule broken by the text "as of 17 Jan 2026, 03:42 UTC. NISAR Beta data." This replaces today's yellow Beta banner.

**Verdict card.** Paper, hard edge, 6 px stripe on the left in the verdict's border colour. Order: the quote; the mark and the verdict word; the as-of stamp on its own line, with a 2 px signal edge on its left; the meaning line; the headline; the reasons; the actions. On the globe the same card lands over the map; on a phone it is a sheet at the bottom. The badge classes are shared, so both cards are literally the same badge.

**Claim input and presets.** One input on paper with an edge-colour border and a solid ink "Check" button. Presets are claims, so they are set in Newsreader italic in quotes, on paper, with a 4 px radius.

**Tabs.** The selected tab has an ink underline, not a blue one.

**Map legend and layers.** Paper panel, edge border, swatches in the fixed data colours with their names from the data. On a phone it sits clear of the map credits.

**Tour bar.** Space-raised surface with paper text, since it is the instrument's voice. It no longer uses amber, which belongs to a verdict.

**Slides.** Space surface throughout, the same three families, "Not provable" in amber as in the app.

**Focus.** A 2 px ring with a 2 px offset: lilac on Space, deep violet on Report.

## Rules

Truth:

- The globe's surface is the real NASA VIIRS image of 17 January 2026, with its own time in the caption (early afternoon, hours after NISAR's pass). Nothing on screen says what the sky was at 03:42.
- The NISAR image appears only where NISAR looked. No cloud-free image sits under it.
- Parts of the daily image that are dark or streaked stay as they are, and the caption says why: "The far north is dark: no daylight there in January. Pale streaks are where one orbit meets the next."
- When the data cannot see, the picture says so: a date that is not covered means no sweep, and the cloud stays.
- Decoration (stars, the air glow, the sweep line) is plain, dim and never on the ground as if it were data.
- Every number has a plain label and comes from the result. Verdicts say "as of 17 Jan 2026, 03:42 UTC" and "Beta". "Agreement with Copernicus", never "accuracy".

Against a template look:

- No purple or blue gradients, no glowing buttons, no frosted-glass cards, no stock slogans. Every line of copy states a fact about this flood or this tool.
- The lilac is a thin line and the focus colour, nothing more.
- The first impression comes from the real image of the Earth, the camera and the type, not from effects.

Checked against Apple's Human Interface Guidelines, as principles for a web app:

- Motion: "Add motion purposefully", "Make motion optional", "Let people cancel motion". The intro is one sequence, can be skipped from the first frame, plays once, and has a still version.
- Branding: "Apply your app's accent color judiciously" and "Ensure branding always defers to content". The signal is one thin line and the name appears once.
- Accessibility: 4.5 to 1 for text up to 17 pt and 3 to 1 for larger or bold text; nothing told by colour alone.
- Delight: "Don't mistake delight for decoration."

Credits, shown on the page and in the README:

- Cloud image: NASA GIBS, VIIRS Corrected Reflectance (True Colour), Suomi NPP, 17 January 2026.
- NISAR data: NASA and ISRO, distributed by the Alaska Satellite Facility (ASF). Beta release.
- Flood reference: Copernicus Emergency Management Service.
- Map engine: MapLibre GL JS (BSD-3-Clause). Animation: GSAP, under its own no-charge licence, installed from npm and not copied into this repository.
- Fonts: Newsreader, Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, SIL Open Font Licence.
