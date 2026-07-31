# RespiNet Design System — Respiratory Atlas

## Design intent

RespiNet should feel like a modern scientific field guide joined to a rigorous analysis instrument. It is calm, editorial, legible, and explicit about uncertainty. The visual system avoids both hospital-software sterility and “futuristic AI” decoration.

The source of truth is generated option 3 at:

`/mnt/c/Users/ocoelho/.codex/generated_images/019fb759-0486-7c22-9c52-2ecd4fdae053/exec-4546cab7-9094-4d70-b03e-96624cddd69e.png`

## Audience and jobs

- **Respiratory researchers:** inspect inputs, model scores, processing, provenance, and limitations.
- **Clinicians reviewing research:** understand what the prototype can and cannot establish without diagnostic framing.
- **Students and educators:** learn the distinction between respiratory sounds, disease labels, model output, and clinical assessment.

Primary job: review a recording, run research analysis, and read the evidence with appropriate context.

## Information architecture

- **Analyze:** the end-to-end recording workflow and primary application screen.
- **Evidence:** method, dataset, benchmark caveats, provenance, and responsible-use boundaries.
- **Learn:** cited respiratory reference and glossary.
- **Report / Explainability:** contextual result detail reached from an analysis, not equal-priority global destinations.

Legacy paths remain as redirects so existing links do not break.

## Visual tokens

### Colour

| Token | Value | Use |
|---|---:|---|
| Canvas | `#fffdf7` | Main warm-ivory background |
| Canvas muted | `#f2f0e8` | Secondary sections and controls |
| Surface | `#ffffff` | Focused content surfaces |
| Ink | `#17211e` | Primary text |
| Ink muted | `#58625e` | Supporting copy |
| Indigo | `#2f477d` | Primary action and active navigation |
| Indigo dark | `#243660` | Hover/pressed action |
| Seafoam | `#e7f1ec` | Explanatory guidance |
| Moss | `#557b69` | Sound observations and positive readiness |
| Sky | `#6ca6c1` | Secondary data series |
| Terracotta | `#b6533b` | Research-only warning and editorial emphasis |
| Amber | `#9a6b16` | Caution |
| Red | `#a33d32` | Error only |
| Rule | `#d8d5ca` | Borders and separators |

Neutral surfaces should occupy at least 80% of the visible screen. Data color is always paired with text, values, and/or icons.

### Typography

- Display/editorial headings: `Source Serif 4` style via a robust Georgia/Palatino serif stack.
- Interface and reading text: `Source Sans 3` style via a Segoe UI/system sans stack.
- Technical metadata only: `IBM Plex Mono` style via a ui-monospace stack.
- Base size: 16px desktop and mobile.
- Body: 1rem/1.65; reading measure 65–75 characters.
- Page title: clamp 2.25–4rem, regular-to-medium serif weight.
- Section title: clamp 1.5–2rem serif.
- UI label: 0.78rem/1.3, semibold, sentence case.
- Do not use all-caps as a default hierarchy device.

### Spacing, radius, elevation

- 4px base scale; core steps 8, 12, 16, 24, 32, 48, 64.
- Desktop container: fluid with 1480px maximum; Analyze uses a 12-column composition.
- Reading pages: 1120px maximum, 720px prose measure.
- Radius: 4px controls, 8px panels, 999px only for true pills/status chips.
- Elevation: almost flat; one soft shadow only for floating menus and focused upload states.
- Borders: 1px neutral rules; use whitespace and rules before card containers.

## Components

- **Top navigation:** 62px, ivory surface, bottom rule, editorial wordmark, three primary links, utility actions at right.
- **Research notice:** persistent terracotta text close to the page title and analysis action.
- **Step rail:** three steps—Review recording, Run analysis, Read the evidence—with numbered circles and connecting rules.
- **Recording panel:** file/sample picker, audio metadata, honest audio player, waveform/spectrogram visualization, and quality notes.
- **Evidence guide:** seafoam side rail explaining what the model saw, what scores mean, and what they cannot mean.
- **Ranked score list:** direct-labeled horizontal bars and tabular values; no detached legend or rainbow categories.
- **Reference entries:** editorial rows/accordions with source links and reviewed dates; symptoms and tests are explanatory, not personalized advice.
- **Alerts:** short title, plain-language body, relevant recovery action; no more than two prominent alerts per view.

## Motion

- Control feedback: 90–140ms.
- Panel/page reveal: 180–240ms using opacity plus at most 6px translation.
- Accordion: 200ms.
- No ambient animation, shimmer, parallax, tilt, pointer glow, orbiting particles, simulated pipeline stages, or autoplay audio.
- `prefers-reduced-motion` removes all non-essential transitions.

## Accessibility

- WCAG AA contrast targets: 4.5:1 normal text, 3:1 large text and UI boundaries.
- Minimum 44px primary targets; minimum 24px compact icon targets with adequate spacing.
- Visible 2px indigo focus ring with 2px ivory offset.
- Semantic headings, fieldsets/legends for grouped inputs, status announcements with `aria-live`, and keyboard-operable disclosure controls.
- Every visualization includes a readable text/table equivalent.
- No meaning conveyed by color alone.

## Content principles

- Say **Analyze recording**, not Diagnose.
- Say **Model score — uncalibrated**, not confidence or certainty.
- Say **No adventitious sound label**, not healthy patient.
- Separate recorded data, model output, interpretation, and known limitations.
- Disease pages explain what authoritative sources say; they do not prescribe treatment or infer a condition from a sound.
- Keep this statement visible near analysis and results: “Research prototype — not a diagnostic device.”

## Content sources

- NHS colour, typography, and layout guidance: <https://service-manual.nhs.uk/design-system/styles/colour>
- WHO Data Design Language: <https://data.who.int/about/datadot/data-design-language>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- ICBHI 2017 Challenge: <https://bhichallenge.med.auth.gr/ICBHI_2017_Challenge>
- ICBHI respiratory sound database paper: <https://doi.org/10.1088/1361-6579/ab03ea>
- WHO COPD: <https://www.who.int/news-room/fact-sheets/detail/chronic-obstructive-pulmonary-disease-(copd)>
- WHO asthma: <https://www.who.int/news-room/fact-sheets/detail/asthma>
- CDC pneumonia: <https://www.cdc.gov/pneumonia/about/index.html>
- NHLBI bronchiectasis: <https://www.nhlbi.nih.gov/health/bronchiectasis>
- NHS bronchiolitis: <https://www.nhs.uk/conditions/bronchiolitis/>
- NHS respiratory tract infections: <https://www.nhs.uk/conditions/respiratory-tract-infection/>
- ERS respiratory sound terminology: <https://publications.ersnet.org/content/erj/47/3/724>

## Icon and asset policy

The selected reference uses restrained rounded line icons. The existing Lucide set is retained because its geometry and stroke treatment closely match the reference and covers the required semantic actions consistently. No emoji, custom inline SVG, handcrafted icons, CSS art, or decorative stock imagery will be used. Waveform and spectrogram views must be derived from selected/recorded audio or explicitly presented as a labeled example visualization.
