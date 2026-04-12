# PULSE — Decisions Log

A running log of non-obvious architectural, design, and product
decisions. Each entry is short on purpose — 3–5 lines of context, a
single-sentence decision, and the options we considered and rejected.

This is not a formal ADR spec. It's a decision memory so we stop
re-litigating settled choices and future-us knows *why* the code looks
the way it does.

New entries go at the top. Most recent first.

---

## 2026-04-11 · 15-screen clinical surface: launch from everywhere

**Context.** PULSE now has 15 clinical components (ESI Triage, EMS
Inbound, Bed Board, Admit, Discharge, Rounding List, Note Composer,
CPOE, Code Blue, Handoff, Secure Messaging, Workforce Coverage,
Alerts Center, Patient Header, Vitals Panel). The question was where
each screen launches from — dedicated tab, shared launcher, or inline.

**Decision.** Every screen is accessible from multiple entry points.
The Patients tab has launcher cards for clinical workflows (Triage,
EMS, Admit, Discharge, Rounding, Notes, Orders, Code Blue, Handoff).
The Dashboard tab has Quick Actions (Code Blue, Page, Divert, QR) and
a Workforce launcher. Alerts tab has a full Alerts Center launcher.
Comms tab has a Secure Messaging launcher. The desktop PulseHorizon
right column mirrors all launchers in a compact grid. The patient
chart's "Add Note" and "Order" buttons open the NoteComposer and
OrderEntry overlays directly. This means a clinician always finds the
tool they need from wherever they happen to be.

**Rejected.** (1) One launcher per screen — forces navigation when the
user is already in context. (2) A dedicated "Tools" tab — hides
screens behind an extra tap. (3) Only in the patient chart — screens
like Workforce and Messaging aren't patient-specific.

---

## 2026-04-11 · Strategic pivot: three-bucket build plan

**Context.** The 47-wedge build plan conflated "what production hospital
software needs" with "what a demo should show." Many wedges (SEP-1
trackers, Falls/Braden forms, restraint timers) mirror existing Epic/Cerner
screens — they wouldn't impress a UX audience or differentiate PULSE.

**Decision.** Sort all planned work into three buckets:

- **Bucket A (build full fidelity):** PULSE-native innovation — 90-min
  forecast, risk drivers, surge proposal with Ops Director confirmation,
  bed state board, confidence/freshness indicators, replay timeline,
  manual mode. This is the moat.
- **Bucket B (build clean, emulate):** Full hospital platform — EHR tab
  (labs, notes, imaging, meds, orders), admit/discharge flows, comms,
  alerts. Looks and feels like software hospitals can use, but doesn't
  need backend compliance.
- **Bucket C (document only):** Compliance/regulatory — SEP-1, HIPAA
  audit trails, CMS quality reporting, FHIR/HL7 integration specs.
  Documented in `docs/production-scope.md`, never built.

**Rejected.** (1) Build everything at equal fidelity — wastes demo time
on commodity screens. (2) Skip clinical surfaces entirely and only
build Bucket A — makes PULSE feel like a dashboard, not an all-in-one
platform. Nick's framing: *"compliance-lite, visually complete."*

---

## 2026-04-11 · PULSE is all-in-one, not just an ops layer

**Context.** Early sessions framed PULSE as "the operations layer on top
of the EHR." Nick corrected: PULSE is the **entire hospital platform** —
it includes EHR workflow, bed management, staffing, communication, and
operations under one roof. The EHR is a tab inside PULSE, not something
PULSE sits on top of.

**Decision.** Build the EHR tab (patient chart with labs, notes, imaging,
meds, orders) as a core part of PULSE, not an imitation overlay.
Position for the demo: "PULSE integrates with existing systems on the
backend and provides better, more consistent UI + AI features."

**Rejected.** (1) Position as ops-only layer — undersells the vision.
(2) Build a full EHR competitor — overkill for POC. The middle ground:
emulate EHR workflow at full visual quality without backend compliance.

---

## 2026-04-11 · ConfidenceBadge as a first-class design primitive

**Context.** The PULSE vision document names confidence and freshness
indicators as a core differentiator. Nothing else in hospital software
makes data quality this explicit.

**Decision.** Add `ConfidenceBadge` to the tactical design system
(`components/design/primitives.tsx`). Two variants: compact (dot +
percentage) and full (freshness label + confidence + age). Four
freshness levels: LIVE (≤1m), RECENT (≤10m), STALE (≤60m), OFFLINE
(>60m). Weave into section headers and data tiles throughout.

**Rejected.** (1) Show confidence only when degraded — misses the trust
signal when data IS good. (2) Use tooltip-only approach — too hidden
for a primary differentiator.

---

## 2026-04-11 · Commit to the full clinical gap (not just the short list)

**Context.** After the QR scanner shipped, Nick asked for a gap
analysis against Salesforce Health Cloud, Epic ASAP/Rover, Cerner
PowerChart, TigerConnect, TeleTracking, and the rest of the
enterprise hospital software landscape. The analysis produced 11
categories (A–K) of missing surface area plus an 8-item short list.
Nick's response: *"i think we need at implement all of those"* and
then *"what i meant is not just the short list but all of the
ideas"* — a commitment to closing the entire gap, not just the
cherry-picked wedges.

**Decision.** Fold the full gap analysis into
`docs/improvement-ideas.md` as proper T-tier entries first (T1.5–
T1.10, T2.8–T2.33, T3.7–T3.9, T4.7–T4.12), then ship wedges in
leverage order wave-by-wave. Wave A (patient identity + clinical
data model) is highest-leverage and ships first: `types/clinical.ts`
with FHIR-aligned shapes, clinical mock data, MEWS/NEWS2/qSOFA
score library, patient header strip with code status + allergies +
isolation, vitals panel with 24h trending. Subsequent waves (B–F)
ship as standalone features. Backend-dependent items (auth, push,
drug-interaction engine, RTLS, IoT vitals) are flagged and
deferred behind the adapter-layer work ([T1.2](./improvement-ideas.md)).

**Rejected.** (a) Implement everything at once — physically
impossible in a session, and several items depend on a real
backend that doesn't exist yet (SSO, server-enforced RBAC, push
notifications with APNs, FHIR bindings). (b) Implement only the
8-item short list — user explicitly rejected this. (c) Start with
the compliance items (audit log, PHI masking, session lock) —
important but invisible; the wedges that make the app feel like
clinical software to a clinician on first sight are the patient
banner + vitals + scores, and they compound the value of
everything that comes later. (d) Start with the role-specific
surfaces (Charge Nurse / ER Physician / Manager) — they're the
end state, but they each consume the patient/encounter data
model, so the model has to land first.

---

## 2026-04-11 · BracketLabel: glyph-center alignment (-0.035em transform)

**Context.** User reported: "on mobile loading screen P in red box is
not aligned with text". Diagnosis: in Geist Mono, the `[` and `]`
glyphs have 22 font-units of descent (extending below baseline)
while capital letters like P/L/E have 0 descent. Measured via the
browser's `measureText` API at 200px font: letter ink center at -71,
bracket ink center at -64. The bracket visual center sits 7 units
(0.035em) closer to the baseline than the letter center. The flex
`alignItems: center` correctly aligns the line boxes — but the
*ink* inside the bracket's line box is biased low. Visually, the
brackets appear to sit lower than the letters.

**Decision.** In `BracketLabel`, wrap the `[` and `]` spans in a
shared `bracketGlyphStyle` that applies
`transform: translateY(-0.035em); display: inline-block`. Transform
is used instead of margin so layout is unaffected. The shift is
em-relative so it scales correctly at every BracketLabel size (xs,
sm, base).

**Rejected.** (a) `margin-top: -0.035em` — would shift the element's
flex hitbox up, creating subtle misalignment with adjacent flex
children. (b) Scaling brackets smaller (`font-size: 0.82em`) to
match letter cap-height — loses the tactical bracket-heavy aesthetic
and makes the brackets look timid. (c) Replacing brackets with a
CSS box border — kills the type aesthetic entirely. (d) Using
`⟦ ⟧` double brackets — different glyph, different problem.

---

## 2026-04-11 · Mobile dashboard reorder: state hero first, narrative last

**Context.** Mobile dashboard opened with "AI Shift Brief" as the first
card — a narrative summary. But what an operator actually needs on
first glance is *current state*, not a paragraph about it. The page h1
was literally the word "Overview," which wastes the most prominent slot
on the screen on a label that says nothing.

**Decision.** Reorder the mobile dashboard to: **state hero → Live Ops
grid → Pulse Horizon → Quick Actions → AI Shift Brief**. Replace the
"Overview" h1 with a stateful label ("Nominal" / "Strained" / "Surge
Active") colored by severity. Introduce a dedicated `StateHero`
component as the top card with a `displaySm` numeric for the dominant
KPI.

**Rejected.** (a) Keeping AI Brief first but "making it bigger" — the
brief is a narrative, and narrative is always less scannable than raw
state. (b) A personalized greeting h1 like "Good evening, Sarah" — too
soft for a tactical system; operators don't open a hospital dashboard
to be greeted. (c) Putting a chart as the hero — charts require
interpretation, and the hero should answer *one* question with *zero*
interpretation.

---

## 2026-04-11 · MetricTile size differentiation by severity

**Context.** Every MetricTile on mobile rendered its main numeric at
30px, regardless of whether the metric was critical (bed capacity 98%)
or benign (active codes 1). Uniform size meant severity was only
encoded in color. Color alone is too weak a signal on a small mobile
screen — severity should be encoded in *size*.

**Decision.** MetricTile value font scales with the `accent` prop:
`default/info = 30px`, `warn = 34px`, `crit = 40px`. The tile itself
keeps the same footprint so the grid stays visually aligned.

**Rejected.** Scaling the whole tile (bigger card for bigger severity)
— would break the 2×2 grid layout and introduce reflow nightmares.
Adding a pulse animation to critical tiles — distracting, and the tile
border highlight already draws the eye.

---

## 2026-04-11 · Remove CONF · 94% from AI Shift Brief footer

**Context.** The AI Shift Brief card had a footer showing `CONF · 94%`,
a confidence indicator for the AI-generated summary. But the number was
static, never actually reflected model confidence, and consumed
real estate that could show something useful.

**Decision.** Delete it. If we ever plumb through real confidence
telemetry, we can add a proper indicator then.

**Rejected.** Hiding it behind a tooltip — would still be dead weight
in the code and mislead users who see it.

---

## 2026-04-11 · Active tab indicator uses layoutId morph

**Context.** The mobile bottom nav's active tab was marked with a
`BracketFrame` that just flicked on/off when the user tapped a new
tab. Felt jumpy and cheap.

**Decision.** Wrap the active indicator (background + border + 4
corner brackets) in a `motion.span` with
`layoutId="mobile-nav-active-frame"`. Framer Motion's shared-layout
API automatically slides the entire frame from old tab to new tab
with a spring (`stiffness 520, damping 38, mass 0.8`). One line of
code, genuinely feels like a native iOS tab bar.

**Rejected.** A custom translate3d tween keyed off tab index — more
code, worse feel, and breaks the moment the tab layout changes size.
Staying with the flick — would have been cheaper to ship but
permanently cheap-feeling.

---

## 2026-04-11 · BracketLabel primitive: 3-span flex, not raw text

**Context.** `BracketLabel` was a `<Mono>[ {children} ]</Mono>`. The
brackets inherited the mono's `letter-spacing: 0.14em`, which pushed
the closing `]` roughly 2px to the right of the word. Most visible on
`[ COMMS ]` but affected every bracket label in the app.

**Decision.** `BracketLabel` now renders three children: an opening
`[` span, an inner content span with tracking, and a closing `]` span.
The brackets use `letter-spacing: 0`. Inner text keeps the scale's
tracking.

**Rejected.** CSS pseudo-elements (`::before`/`::after`) — harder to
tone-color and harder to size independently. Adding padding-right to
compensate — fragile, would break on different font sizes.

---

## 2026-04-11 · AI icon: BrainCircuit, not Sparkles

**Context.** Every AI touchpoint in the app used Lucide's `Sparkles`
icon. Read as "magic wand AI" — a tone that doesn't match a tactical
hospital dashboard. AI here is about synthesis, not magic.

**Decision.** Replace `Sparkles` with `BrainCircuit` at
`strokeWidth={1.75}` everywhere: MobileView top bar, AI Shift Brief
card, BriefMe button, ChatAssistant header and floating launcher.

**Rejected.** `Bot` — reads as chatbot, too playful. `Cpu` — reads as
hardware monitor. `Zap` — reads as power/action, not intelligence.
`BrainCircuit` hits the synthesis + tactical register cleanly.

---

## 2026-04-11 · Restrain red to urgent-only

**Context.** The red accent (`#E11D48`) was being used as a general
"emphasis" color — nav hover states, tab indicators, button borders,
divider accents. When every piece of UI shouts, nothing shouts.

**Decision.** The accent color is reserved for **urgent action
required**: surge activation, code blue, critical patient rows, alert
indicators. Everything else uses the neutral palette (`border`,
`borderStrong`, `borderHover`, `textSecondary`). AI content uses
`info` (blue), nominal states use `ok` (green), attention-but-not-
urgent uses `warn` (amber).

**Rejected.** A softer rose for non-urgent accents — would dilute the
semantic by another half-step and we'd be right back here in a month.

---

## 2026-04-11 · Haptic escalation, not uniform taps

**Context.** `installGlobalHapticListener` already fires a light haptic
on every click. Easy path: leave it at that. Problem: *every* tap
feels the same, which means no tap feels meaningful.

**Decision.** Layer explicit `triggerHaptic(style)` calls on top of the
global listener for moments that deserve weight:
- `heavy` — surge activation, CODE BLUE
- `medium` — tab switch, task acknowledge, DIVERT STATUS
- `light` — everything else (global listener handles this)

**Rejected.** Replacing the global listener with a prop-driven haptic
system — every interactive element would need `hapticStyle`. Too much
ceremony for light/light/light/light, which is what 90% of taps want.

---

## 2026-04-11 · Desktop page header outside the 2fr/1fr grid

**Context.** PulseHorizon had its page header (`Predictive Capacity
Horizon` + metadata + status pill) as the first child of the left
grid column. Result: left column started with the header, right column
started with `Inbound EMS`, and the two columns' first *cards* sat at
different Y-coordinates.

**Decision.** Hoist the page header out of the grid into a full-width
row above it. Both columns now start with their first content card at
the same baseline.

**Rejected.** `alignItems: start` + transparent spacer — hack, wastes
space, still wrong if the header height changes.

---

## 2026-04-11 · 16px input floor to kill iOS Safari zoom

**Context.** iOS Safari auto-zooms into any input with computed
`font-size < 16px` when focused. We had mono inputs at 13px
everywhere, so tapping the ChatAssistant or patient search would
trigger a zoom and wreck the layout.

**Decision.** Global CSS under `@media (max-width: 768px)`:
`input, textarea, select { font-size: 16px !important }`. Plus
explicit 16px on ChatAssistant's input as belt-and-suspenders.

**Rejected.** `maximum-scale=1` in the viewport meta — blocks
legitimate pinch-zoom accessibility and Apple rightly penalizes it.
Per-input JavaScript focus handlers — fragile and doesn't survive
React re-mounts.

---

## 2026-04-11 · Connection indicator in HudStrip on mobile, hidden desktop floater

**Context.** The connection-state indicator was a fixed bottom-left
floating pill on every viewport. On mobile it overlapped the bottom
tab bar and got clipped by the safe-area inset. We tried moving it up
but it blocked content.

**Decision.** Mobile gets the connection state inline in the top
HudStrip as a pulsing dot + `LINK` / `SYNC` / `OFFL` pill next to the
operator name. Desktop keeps the floating indicator but it's tagged
`.pulse-connection-indicator` and hidden via CSS on viewports
≤ 768px.

**Rejected.** A second top-level global component — too much state
plumbing. A context provider — same problem, solved at the wrong
layer.

---

## 2026-04-11 · Chart: smoothstep + jitter, not raw noise

**Context.** The mobile Pulse Horizon chart had 5 static data points
that looked fake. Replacing them with `Math.random()` noise would
look busy and untrustworthy.

**Decision.** 17 points generated via smoothstep easing
(`t * t * (3 - 2 * t)`) between a start and end baseline, plus a
deterministic dual-sinusoid jitter
(`sin(i * 1.3) * 1.4 + cos(i * 0.7) * 0.9`). Looks like smoothed
telemetry: continuous, plausible, never identical between renders.

**Rejected.** Cubic Bézier interpolation — prettier but tells a lie
(forecasts aren't smooth in reality). Random walk — too jagged and
non-deterministic. Real data — we don't have any yet; this is a
simulator.

---

## 2026-04-11 · Quick Actions as horizontal scroll-snap, not 3-col grid

**Context.** Mobile Quick Actions started as a 3-column grid. With long
labels (`PAGE ON-CALL`, `DIVERT STATUS`), text wrapped to two lines
and the buttons got squat and ugly at narrow widths.

**Decision.** Horizontal scroll-snap row. Each button
`flexShrink: 0` with `scrollSnapAlign: start`. Renders 2.5 buttons at
once on iPhone widths and lets the user swipe for the rest.

**Rejected.** Truncating labels with ellipsis — defeats the point.
Wrapping the row to two rows of grid — doubles vertical space for no
information gain. Icons-only — removes the text scannability.

---
