# PULSE marketing v2 — Design Brief

> Produced by `/shape` on 2026-04-24. Companion file: `.impeccable.md` (design context).
> This brief is the input for `/impeccable craft` (or any implementation skill).

## 1. Feature Summary

A single-page, scroll-driven marketing site for **PULSE — Patient Urgency & Load Situational Engine**. Inherits the Relats motion grammar (pinned scrubs, scene crossfades, char-split headlines, count-up moments, glassmorphic nav) but executes it with deliberate restraint: each scene breathes longer, rose-600 lands once per scene, the page never feels packed. v2 is a sibling to existing v1 at `/Users/nickrapoport/Documents/PULSE-marketing/`; same vocabulary, much sharper editing.

## 2. Primary User Action

**Book a demo.**

The visitor is a cold inbound — hospital exec, investor, or candidate sent the link by someone they trust. The site has 60 seconds to make them believe PULSE is the most thought-through tool in this category, and then route them to either:

- **Demo** (primary, hospital ops/clinicians) — `Request a demo`
- **Investor inquiry** (secondary, never competes) — `For investors`

Every other UI moment is in service of one of those two CTAs landing.

## 3. Design Direction

Per `.impeccable.md`: tactical HUD aesthetic, near-black canvas (`#050505`), Geist + Geist Mono, rose-600 accent (`#E11D48`), sharp 2px radii, dark theme. The aesthetic register that makes v2 *not* a v1 reskin:

- **Restraint over density.** Where v1 stacked 3 spec cards next to a chart, v2 uses 1.
- **One accent per scene.** Rose-600 is punctuation. It lands on the single most important number, word, or stroke per pinned beat — and on nothing else in that beat.
- **Editorial pacing.** Headlines hold the screen alone before content arrives. Pinned scrubs commit to longer beats than v1.
- **Data is voice.** Confidence brackets, mono labels, time-to-event indicators. No icons-on-rounded-squares, no decorative sparklines.
- **Anti-stock authenticity.** No clinician stock photography ever. Imagery is product UI, abstract HUD, or genuinely documentary.

**Reference (overall feel + motion):** [toptier.relats.com](https://toptier.relats.com/) — premium industrial product page, paced storytelling, restrained palette.

**Anti-references:** epic.com, discover.oxos.com/mc2workflow, AI-startup landing pages with rainbow gradients, smiling-doctor stock photography, "trusted by" logo grids, floating UI screenshots tilted at 15° with glow.

## 4. Layout Strategy

**11 scrollable beats, ~50 viewports of total scroll length** (v1 was 67vh). Beat composition:

| # | Beat | Length (vh) | Type |
|---|---|---|---|
| 1 | Hero | 1.5 | Static |
| 2 | Intro mosaic | 5 | Pinned scrub |
| 3 | Forecast Engine | 9 | Pinned scrub, 3 variants |
| 4 | Roles | 14 | Pinned scrub, 4 roles |
| 5 | Stat moment | 4 | Count-up |
| 6 | Surge Action | 10 | Pinned scrub, 3 stages |
| 7 | Why view | 4 | Pinned scrub |
| 8 | Coverage | 5 | Pinned reveal |
| 9 | Brief Me | 4 | Real-time text demo |
| 10 | Compliance | 2 | Static card |
| 11 | Closing | 3 | Static |

**Visual hierarchy across the page:**

- Type carries primary weight. Numbers are display-scale. Headlines hold viewports alone.
- Floating glassmorphic top nav (PULSE wordmark · Demo / Investors toggle · floating Demo CTA after viewport 1).
- Single accent rule strictly enforced: rose-600 lands once per scene, on the most important element. Coverage scene abstains from accent entirely.
- Spacing rhythm: every pinned scene opens with ~12vh of pure space before content lands. The visitor's eye is never crowded on entry.

## 5. Key States

### Page-level

- **First load (cold visitor)** — Hero waveform traces in, headline appears, CTAs fade up. Visitor has 0 context.
- **Mid-scroll (engaged)** — Floating Demo CTA visible in nav. Visitor is reading data, not branding.
- **Near-bottom (decided)** — Closing scene. Both CTAs full-width and prominent. Footer compliance label.
- **Re-visit (warm)** — Same page; no special state. Cookies aren't used.
- **Reduced motion** — All scrubs play with opacity-only transitions. No scaling, no parallax, no count-ups (numbers display final value statically).

### Per-section states

| Beat | States |
|---|---|
| Hero | (1) Pre-trace · waveform drawing · (2) Settled · all elements in. Single state once landed. |
| Intro mosaic | (1) Center tile only visible · zoomed in · (2) Mid-zoom-out · 4 tiles emerging · (3) Full grid · 2×2 stable · headline crossfaded. |
| Forecast Engine | (1) Section title held · (2) Capacity variant · (3) Risk variant · (4) Staffing variant. Each variant gets a stable hold beat before next crossfade begins. |
| Roles | (1) Section title held · (2-5) Each of 4 roles holds the screen with name + stat + quote. |
| Stat moment | (1) Pre-count number = 0 · (2) Counting · (3) Settled at final value. |
| Surge Action | (1) Stage 1 Proposed · (2) Stage 2 Awaiting Director (Confirm plan visible) · (3) Stage 3 Executing. |
| Why view | (1) Risk number alone · (2) Drivers fan out one by one · (3) Sum re-converges. |
| Coverage | (1) Headline · (2) Integration logo strip drawn in · (3) Closing line settles. |
| Brief Me | (1) Empty terminal · (2) Brief synthesizing word-by-word · (3) Timestamp lands in rose-600. |
| Compliance | Single state. Static card. |
| Closing | (1) Waveform redraws · (2) Resolves into wordmark · (3) CTAs fade up · (4) Footer line settles. |

## 6. Interaction Model

**Scroll is the primary input.** Everything responds to scroll position; nothing responds to dwell time, mouse position (except hover states on CTAs/nav), or click-through state changes.

- **Trackpad / wheel scroll** drives everything via Lenis-smoothed native scroll.
- **Page Down / Spacebar / arrow keys** work natively (Lenis handles).
- **Anchor jumps** from nav scroll smoothly to the scene start.
- **Reduced motion** preference is respected at the OS level — opacity transitions only, no scale/parallax.

**Hover/click states:**
- Nav links: subtle underline appears at 60% opacity.
- `Request a demo`: solid surface, small darken on hover, scales 1.0 → 0.98 on press.
- `For investors`: ghost button, fills to surface on hover.
- Stage 2 of Surge Action has a `Confirm plan` button that's *visually* a button but not interactive — it's part of the demonstration. (Tooltip on hover: "demonstration only — book a demo to use PULSE")

**No modals. No carousels (the Surge stages are scroll-driven, not click-driven). No popovers.**

**Mobile:** Touch scroll drives everything. Pinned scrubs pin via `position: sticky` (works the same on mobile). Some scenes simplify on viewport <768px — Roles drops to one role per full-screen card stacked vertically rather than scrub-with-list-on-left.

## 7. Content Requirements

### Section-by-section copy + accent moments

#### 1. Hero

- **Eyebrow** — `● PATIENT URGENCY & LOAD SITUATIONAL ENGINE` (mono)
- **Headline** — **"The 90 minutes before everything goes wrong."**
- **Subhead** — *PULSE forecasts capacity, risk, and staffing — and turns rising risk into coordinated action, with a human in the loop.*
- **CTAs** — `Request a demo →` (primary, solid white) · `For investors` (ghost outline)
- **Bottom HUD ticker** — `V0.1 · LOCAL BUILD` · `STATUS · NOMINAL` · `SCROLL · 11 SCENES`
- **Accent moment** — The waveform line itself, rose-600. No other accent.

#### 2. Intro mosaic (4 tiles, 2×2)

- **Eyebrow** — `UNIFIED SURFACE · 4 LENSES`
- **Headline 1 (start)** — "One operational picture."
- **Headline 2 (end)** — "Across every workflow that runs a hospital."
- **Tiles** — Beds · Risk · Surge · Replay
- **Accent moment** — Risk tile's `0.74` composite score, rose-600. Other tile values are mono-neutral.

#### 3. Forecast Engine

- **Section title** (held briefly, then fades) — *See the next 90 minutes.*
- **Eyebrow** — `90-MINUTE FORWARD FORECAST`
- **Variants:**
  - Capacity — `102%` ED occupancy at T+90, ↑ +15 pts. Driver card: *4 of 47 beds available · confidence 0.91*
  - Risk — `0.74` composite risk score at T+90, ↑ +0.18. Driver card: *boarding +0.21 · acuity +0.11 · confidence 0.88*
  - Staffing — `−6` nurse coverage gap at 22:00. Driver card: *MS −4 · TELE −2 · confidence 0.74*
- **Variant list (left side)** — `Capacity / Risk / Staffing` (active variant in white, others 30% opacity)
- **Accent moment** — Active variant's big number, rose-600. Only that, only that variant.

#### 4. Roles

- **Section title** — *Same data. Four lenses.*
- **Eyebrow** — `ROLE-AWARE SURFACES`
- **Roles** (each gets full-screen pinned beat with name + stat + quote):
  - **Operations Director** — `90 min · forward-look horizon` — *"I see what's coming, not what just happened."*
  - **Charge Nurse** — `4 of 47 · beds available, live` — *"I haven't paged the bed manager once today."*
  - **ER / Trauma Attending** — `3 holds · ED → ICU pending` — *"My patient list updates without me asking."*
  - **EVS · Transport** — `6 tasks · queued, ETA tracked` — *"No more whiteboards. No more pages."*
- **Accent moment** — Active role name in rose-600. Stat number is mono-neutral.

#### 5. Stat moment

- **Eyebrow** — `OPERATIONAL OUTCOME`
- **Lead** — *PULSE-managed shifts return on average*
- **Number** — `0 → 47 min` (count-up animation)
- **Trail** — *of clinician time, per shift, back to the bedside*
- **Caveat pill** — `● DIRECTIONAL · MEASURED ACROSS PILOT WORKLOADS`
- **Accent moment** — The `min` unit suffix (rose-600). The `47` itself stays in white. (Counter-intuitive but lets the unit do the work.)

#### 6. Surge Action (longest beat, 10vh)

- **Section title** — *From rising risk to coordinated action.*
- **Eyebrow** — `HUMAN IN THE LOOP`
- **Stage 1 — Threshold crossing detected** — `Risk 0.71 at T+72m · 5 candidate actions gathered`
- **Stage 2 — Awaiting Operations Director** — `5 actions · 4 owners · projected risk drop −0.28 by T+90m` · **`Confirm plan` button visible**
- **Stage 3 — Tasks routed and tracked** — `4 of 5 complete · risk now 0.39 · trending ↓`
- **Stage progress bar** at top: `PROPOSED ─ AWAITING ─ EXECUTING` with a moving indicator
- **Accent moment** — The `Confirm plan` button on Stage 2 only. Other stages use neutral surfaces.

#### 7. Why view (new in v2, replaces Modules)

- **Eyebrow** — `THE WHY VIEW`
- **Headline** — *The risk number isn't a black box.*
- **Detail** — Take the Forecast Engine's `0.74` risk score. Show it decomposed: `Boarding +0.21 · Acuity +0.11 · Length-of-stay +0.18 · Staffing −0.06 · Discharge velocity +0.12`. Drivers fan out from the number, then settle into a vertical stack.
- **Closing line** — *Every metric carries its drivers. Every number is auditable.*
- **Accent moment** — `+0.21` (the largest driver), rose-600.

#### 8. Coverage (redesigned)

- **Eyebrow** — `WHAT PULSE COVERS`
- **Headline** — *Wraps the systems you already run.*
- **Capability list (8 items, staggered fade-in)** — 90-Minute Forecast · Surge Actions · Brief Me · Replay · Why View · Confidence Indicators · Manual Mode · Role-Aware Surfaces
- **Integration ECG strip (bottom of scene)** — Logos rendered as monospace text labels on a horizontal line: `EPIC · CERNER · TELETRACKING · MEDITECH · FHIR R4`
- **Closing line** — *Where the EHR ends and the workflow begins, PULSE is already there.*
- **Accent moment** — None. This scene is intentionally accent-free. Rose-600 abstains.

#### 9. Brief Me (new in v2, replaces Worldwide)

- **Eyebrow** — `30-SECOND SHIFT HANDOFF`
- **Headline** — *The next shift starts knowing.*
- **The demo** — A monospace terminal frame that "types" a real-time shift handoff word-by-word as you scroll past:
  > *Outgoing shift: 3 holds in PACU. ICU at 92%. Telemetry transfer pending bed 4-East. EVS team aware. MS coverage thin past 22:00. One escalation: room 12 acuity rising — flagged for incoming charge.*
- **Timestamp** — `14:09 · brief authored by PULSE` (lands at the end)
- **Accent moment** — The timestamp `14:09`, rose-600. The synthesized text itself is mono-neutral.

#### 10. Compliance (kept per Nick's redline)

- **Eyebrow** — `COMPLIANCE-READY`
- **Headline** — *Built for the HIPAA / FHIR reality.*
- **Body** — *Audit trails on every action. FHIR integrations to existing systems. On-prem option. Deployment posture you can hand to your compliance team without rewriting their playbook.*
- **CTA** — `Read the security overview →` (ghost button, lower priority than demo)
- **Accent moment** — None. Compliance speaks in muted authority.

#### 11. Closing

- **Section** — Vital-sign waveform redraws, resolves into the **PULSE** wordmark
- **Wordmark line below** — `PATIENT URGENCY & LOAD SITUATIONAL ENGINE` (mono)
- **CTAs (full-width, generous)** — `Request a demo →` (primary) · `For investors` (ghost)
- **Footer line** — `PULSE · 2026 · HIPAA · FHIR · SOC 2 · ON-PREM · hi@pulse.health`
- **Accent moment** — Waveform + wordmark, rose-600.

### Microcopy

- **Loading** — None. The page is single-bundle and renders client-side; if anything is delayed the scene shows its initial frame.
- **Error** — None at this stage; static page.
- **Empty / first-time** — Same as default. No personalization.
- **404** — A small dedicated page with a single waveform and the line *"This room is empty. Try the front desk."* + link back to home.

### Voice & terminology

- Always: *operational picture*, *forecast horizon*, *coverage gap*, *driver decomposition*, *human in the loop*, *surge action*
- Never: *unified*, *comprehensive*, *robust*, *best-in-class*, *next-generation*, *holistic*, *cutting-edge*, *AI-powered* (we say what it does, not the buzzword)
- Numbers always carry units and confidence. `0.74` not just `0.74`. `4 of 47` not `4`.

## 8. Recommended Implementation References

When `/impeccable craft` runs the build, the most valuable reference files will be:

- **`reference/motion-design.md`** — every section is motion-driven; pacing/easing rules are central
- **`reference/typography.md`** — headlines hold the screen alone; type scale and font selection carry the design
- **`reference/spatial-design.md`** — restraint requires deliberate spacing rhythm; this is where v2 most differs from v1
- **`reference/color-and-contrast.md`** — single-accent rule needs OKLCH-aware tinting of neutrals toward the rose hue
- **`reference/responsive-design.md`** — Roles section needs mobile reflow strategy (vertical stack instead of side-by-side)

## 9. Open Questions for Implementation

These are intentionally left for the build phase to resolve:

1. **Anchor numbers are placeholders.** Nick said "use placeholders." Build with the numbers in this brief; if real numbers land before launch, swap in.
2. **Fonts.** Geist is on the project's source-of-truth tokens. v2 inherits. But the impeccable typography protocol bans defaults — so verify that Geist hasn't drifted into the reflex-fonts-to-reject list. If it has, find a more distinctive display pair (consider: Söhne, Tiempos, Untitled Sans, ABC Dinamo's Romie/Diatype) for headlines while keeping Geist Mono for data labels.
3. **Mobile strategy for Surge Action.** The 3-stage horizontal progress bar may not fit narrow viewports — fall back to vertical stage stack with line dividers, or test horizontal scroll within the stage container. Decide during build.
4. **Real waveform path.** The hero/closing waveform is currently a stylized SVG. Investigate whether to use a real ECG trace (publicly available open ECG data) or a stylized "vital sign" — likely the latter is more on-brand and avoids medical-accuracy pedantry.
5. **Sticky-positioning vs. JS-driven pinning.** v1 used `position: sticky` + Framer Motion's `useScroll`. v2 should keep the same approach but verify on Safari iOS — sticky has historically had quirks there. If quirks arise, fall back to `react-three-scroll` pinning or a custom `IntersectionObserver` pin.

## Confirmation

The 4 user-confirmed decisions baked into this brief:

1. ✅ Hero headline: **"The 90 minutes before everything goes wrong."**
2. ✅ Roles get role-voice quotes (1 per role, written above)
3. ✅ Cut Modules + Worldwide. Keep Compliance.
4. ✅ Use placeholder anchor numbers throughout.

Brief is ready for handoff to `/impeccable craft`.
