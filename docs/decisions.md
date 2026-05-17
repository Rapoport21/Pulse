# PULSE — Decisions Log

A running log of non-obvious architectural, design, and product
decisions. Each entry is short on purpose — 3–5 lines of context, a
single-sentence decision, and the options we considered and rejected.

This is not a formal ADR spec. It's a decision memory so we stop
re-litigating settled choices and future-us knows *why* the code looks
the way it does.

New entries go at the top. Most recent first.

---

## 2026-05-17 · Cross-session memory: localStorage hydrate-at-init, not a Supabase table

**Context.** App state (`useRealtimeState`) and the AI transcript were
in-memory only. A single-device reload wiped the whole demo: the
realtime layer keeps state in `store.cache` and only recovers it if a
peer answers a `state-request` within 500ms. No peer (the common
single-screen pitch case) meant total loss. The next-session backlog
(#2.6) asked for durable memory plus a visible wipe.

**Decision.** Added `lib/persistence.ts`: a guarded, debounced
localStorage layer with two stores (`pulse-state-v1`,
`pulse-ai-memory-v1`) and a `beforeunload`/`pagehide`/visibility flush.
`lib/realtime.ts` hydrates `store.cache` + Lamport versions at *module
init*, before React mounts, so `useRealtimeState`'s lazy initializer
restores transparently with zero component rewiring. ChatAssistant
rehydrates the transcript (full history is already sent to Gemini, so
model memory is restored for free). The existing Settings reset is now
a full memory wipe, relabelled "Reset & Wipe Memory" so the control is
visible.

**Considered and rejected.**
- *Supabase `pulse_state` table / JSON row.* True cross-device durable
  memory, but adds schema, RLS, migration, and write-amplification for
  what is a single-operator pitch demo. Deferred as a future upgrade;
  the hydrate-at-init seam makes swapping the backing store a
  one-function change later.
- *IndexedDB.* Overkill for a few small JSON blobs; localStorage is
  synchronous, which is exactly what module-init hydration needs.
- *Persisting via a React effect in App.tsx.* Would race the first
  paint and require threading through every `useRealtimeState` call.
  Hydrating the shared cache once at import is simpler and lossless.

## 2026-05-10 · Pulse Radiant focus-engage perf: memoization + no `filter: blur` on dim

**Context.** When the user clicks a widget in the radiant, ~118 sibling
widgets get `dimmed=true` in one render. Early version of the
expanded-card flow stuttered visibly during the camera dolly. Two root
causes:

1. **GPU.** Dimmed siblings animated `filter: blur(0.4px)` alongside
   the opacity drop. Running `filter: blur(...)` simultaneously on
   118 DOM elements was the dominant cost — CSS filter blur doesn't
   batch and lives on the compositor.
2. **Reconciliation.** All 118 siblings re-rendered their full
   component tree (CV brackets, priority pips, badges) even though
   only the boolean `dimmed` flipped. `onClick` callbacks were
   freshly-constructed closures (`() => onSelect(w.id)`) so default
   `React.memo` couldn't skip the re-render.

**Decision.** Three locked-in choices in `components/PulseRadiant.tsx`:

1. **`React.memo` wrappers** on `DriftWidgetImpl`, `WidgetCardImpl`,
   `FutureCardImpl`, `FutureNodeRenderImpl`. The exported names
   (`DriftWidget`, etc.) are the memoized versions. Don't remove the
   `Impl` suffix split or the memo wrappers.
2. **Stable callbacks.** `DriftWidget` receives `onSelect: (id) => void`
   and builds its own click closure with `useCallback` inside.
   Scene passes `onSelect={onSelectCluster}` directly without
   wrapping in a fresh `() => ...` closure. Same pattern for
   `FutureNodeRender`. `onSelectCluster` / `onSelectFuture` /
   `onDismiss` in `PulseRadiant` outer are `useCallback`'d.
3. **Dim = opacity only.** `WidgetCard` and `FutureCard` apply
   `opacity: 0.16` when `dimmed=true`. **Do not re-add `filter:
   blur`**, even at 0.2–0.4px. The `transition` list explicitly
   excludes `filter` so it can't reappear by inheritance.

Plus: `AmbientRotation` accepts a `paused` prop (via `forwardRef`)
and pauses when focus engages. Camera target is computed in world
space by applying the rotation snapshot to the local position —
otherwise the rotating group keeps moving underneath the camera and
the focused card drifts off-center.

**Why.** Click-to-focus is the headline interaction of the Radiant.
If the camera dolly stutters, the "wow" lands as "broken." The CSS
filter-blur removal alone moved focus engage from ~30fps to a smooth
60fps on iPhone 15 Pro; the memoization removed the lingering jitter
on lower-end iPad.

**What NOT to undo.**
  - Don't swap `React.memo(...)` for plain `React.FC` exports.
  - Don't inline `onClick={() => onSelect(w.id)}` at the call site —
    DriftWidget's `useCallback` inside is load-bearing.
  - Don't add any animated CSS `filter` to dimmed widgets. Animate
    only `transform` + `opacity`. (`backdrop-filter` on the focused
    card itself is fine — it's only one element.)
  - Don't remove `paused` from `AmbientRotation` — without it, focus
    target drifts because the world rotation keeps accumulating.

**Open follow-ups (not blocking).**
  - Measure actual FPS on a mid-range Android tablet — only validated
    on Apple silicon and iPhone so far.
  - Consider lazy-rendering the heavier viz components (RadarSweep
    has infinite SVG `<animate>`s) only when the camera is at rest.

---

## 2026-04-30 · Killed the 3D "Live Floor" drone view

**Context.** Briefly shipped a 3D hospital floor-plan modal launched
from the Forecast chart header — `components/BedDroneView.tsx` plus a
modal stub in `PulseHorizon`. Built on `three`, `@react-three/fiber`,
and `@react-three/drei`. Three sequential rebuild attempts:

1. **First pass.** Flat plate + extruded boxes per bed; ward
   placements mis-mapped (`medsurg-2w` instead of actual `ms-2w`);
   too dim to read.
2. **Second pass.** Added wall geometry, room partitions, corridor
   strips, ceiling lights, scenario-tinted ambient. Still felt like
   a chart, not a hospital — walls were 0.08–0.16 thick (hairlines)
   and the camera was too far back.
3. **Third pass.** Bumped wall thickness 4×, added MEMORIAL GENERAL
   on the north facade, painted ambulance bay with red cross +
   helipad H, parking stripes, IV poles, wall monitors with tiny
   waveform planes, nursing-station avatars, a crash cart at ED
   Trauma, drei `OrbitControls` for user rotation/zoom. Still
   visually unconvincing.

**Decision.** Removed entirely. Deleted `components/BedDroneView.tsx`,
the modal block in `PulseHorizon`, the `Radar` import, the
`showDroneView` state, and the launcher button on the chart header.
Uninstalled `three` / `@react-three/fiber` / `@react-three/drei`
(reclaimed ~1MB gzipped from the bundle). Idea is parked in
`docs/improvement-ideas.md` under T4 with a pointer back here.

**Why.** Three iterations couldn't make it read as a real hospital.
Procedural geometry built from primitives (boxes for walls, cylinders
for IV poles, capsules for nurses) is the wrong tool — it lands in a
visual uncanny valley between schematic and rendered. The SimCity-y
look distracted from the actual operations data, and on Nick's
review it landed as "very bad" each pass.

**What we'd do differently if we revisit.** Don't build the geometry
by hand. Either:
  (a) Load a real GLTF/GLB hospital floor model (Sketchfab Pro,
      ArchViz packs, or commission one). Map our `BedUnit` data onto
      named meshes via `gltf.scene.getObjectByName('ICU-1')` and
      drive only color/emissive based on bed state.
  (b) Use a 2D top-down floor plan rendered in SVG with isometric
      CSS transforms. Cheaper, sharper, no uncanny valley — looks
      like an architectural drawing instead of a low-poly toy.
  (c) Skip 3D entirely and double down on the existing 2D Bed Board
      grid with motion accents.

The data wiring (`useEmsInbound` for moving dots, scenario severity
tinting, bed-state visuals) was sound — that part can be reused
under any future approach. Only the rendering layer needs to change.

**Trade-offs accepted.** No live spatial visualization in the demo
right now. The Bed Board tab still gives the same data in 2D. The
EMS auto-brief (also shipped this week) covers the "demo magic
moment" function the drone view was meant to provide.

**Sunset checklist** — confirmed before commit:
- [x] `components/BedDroneView.tsx` deleted
- [x] Modal block + state + button + import removed from
      `components/PulseHorizon.tsx`
- [x] `three` / `@react-three/fiber` / `@react-three/drei`
      uninstalled
- [x] Bundle size confirmed ~1MB smaller post-uninstall
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean

---

## 2026-04-18 · Bracelet generation lives on disk, not in the app

**Context.** We briefly shipped an in-app pre-print flow
(`PrintBraceletsSheet` + `BraceletCard` + Capacitor `@capacitor/filesystem`
/ `@capacitor/share` plugins) so Nick could export bracelet SVGs
directly from iPhone or desktop. The offline generator
(`scripts/export-bracelets.mjs`, `npm run export:bracelets`) already
wrote the same 20 SVGs to `../pulse-collateral/bracelets/current-v8/generated/`.

**Decision.** Removed the entire in-app flow. `PrintBraceletsSheet`,
`BraceletCard`, the Settings "Print wristbands" row, and the two
Capacitor plugins are gone. The `PrintPreviewModal` reverted to its
pre-bracelet shape (no `chromeless` / `extraActions` / `footerHint`
props). Nick will edit the generator, re-run it, and print from the
disk files. The app keeps only the runtime pool state and QR scan
resolution — `lib/braceletPool.ts` is untouched except for a comment
now pointing at the offline script as the canonical SVG source.

**Why.** Two mental models for the same job is one too many. The
offline script has zero WKWebView quirks, is faster, produces the
same bytes across environments, and the files live next to the
design spec. In-app export was a luxury path used ~never.

**Trade-offs accepted.** If Nick ever wants to print on the go from
the iPhone (no Mac nearby), he'd need to re-add the Capacitor share
plugin. T3.11 and the `POOL_SIZE` comment in `lib/braceletPool.ts`
document the scale-up flow that now only touches the script.

---

## 2026-04-17 · Opt-in "Larger UI" toggle in Settings → Display

**Context.** Baseline sizing is now the morning-of-pre-bump values (see
the entry below this one). Some operators — iPads in bright light, worn
screens, farther viewing distance — still want a larger read without
changing the default everyone else sees. Native iOS accessibility zoom
works but clipping is ugly and users don't know it's there.

**Decision.** Ship a single toggle under Settings → Display named
"UI scale" with two options, **Default** and **Larger**. Default is
the current baseline. Larger applies a **+15% zoom** to the document
element via `document.documentElement.style.zoom`. Preference persists
to `localStorage` under key `pulse-ui-scale` and is re-applied once on
app mount via `initUiScale()` in `App.tsx`. All lives in `lib/uiScale.ts`.

**Why `zoom` and not a token swap.** Tokens in `components/design/tokens.ts`
are absolute `px` values imported directly by ~50 files — a runtime
token swap would require either a React context consumed by every
`fontSize: TYPE.mono.size` call site or a full rem refactor. `zoom` on
`<html>` scales every descendant uniformly (fonts, icons, borders,
padding, spacing, chart axes) and is supported in WebKit (Safari,
Capacitor iOS WebView), Blink (Chrome/Edge), and Gecko (Firefox ≥126,
May 2024) — all three surfaces PULSE ships on.

**Trade-offs accepted.** (a) Layouts that budget against `100vh` (e.g.,
Horizon's single-viewport fit) may overflow in Larger and need vertical
scroll. Users opting in accept this. (b) `window.innerWidth` reports
the pre-zoom value so breakpoint media queries keep their boundaries —
usually what we want. (c) 15% was picked as the same magnitude as the
afternoon Pass-2 bump Nick called "way too big" when shipped as the
default, but is the right order of magnitude as opt-in for operators
who genuinely want it larger.

**Rejected.** (a) A separate token file per scale. Doubles the source
of truth and doesn't automatically cover new components. (b) A rem
refactor before adding the toggle. Too much churn for a single opt-in
knob. (c) Three options (small/default/large). Unnecessary — nobody has
asked to go smaller.

---

## 2026-04-17 · Sizing fully reverted to baseline; simulator rewrite kept

**Context.** Three size passes shipped today, each rejected:

1. **Morning Pass 1** (+10-12%, commit `e0748d4`). Nick: "still too tiny".
2. **Afternoon Pass 2** (+15% on Pass 1, commit `2fcc5cd`). Nick: "way
   too big."
3. **Pass-2 revert** (back to Pass-1 values, commit `64367f6`). Nick:
   "things are too large. need to be closer to what is was before."

At that point the right read was: the Pass-1 bump itself was also
too far. The original pre-bump scale is what Nick actually wants
(mono 11/12/13, body 14/16, h 17/21/26/34, display 48/64, CHROME
56/36/64).

**Decision (sizing, reverted fully).** Rolled everything back to the
pre-`e0748d4` state — TYPE tokens, CHROME heights, every `fontSize: N`
literal (48 files, 520 instances), and every lucide `size={N}` ≥ 11
prop. Three net commits today end at the same sizing state the repo
was in this morning before any bump touched it.

**Decision (simulator, kept).** The LeverSlider stepper rewrite from
`2fcc5cd` is preserved through every revert. The native
`<input type="range">` it replaced was genuinely broken in the
Capacitor iOS WebView (invisible thumb on the dark surface, dragged
gestures eaten by WebKit scroll handling). Replaced with ± stepper
buttons (44×44, iOS HIG) flanking a segmented fill bar. Unrelated to
sizing, no reason to drop the fix.

**Takeaway.** Don't apply a global multiplier to a typography scale
without an in-hand eyes-on review. The proportional relationships
looked fine in isolation but the absolute feel had a much narrower
tolerance window than the percentage suggested. If a specific surface
reads "too small" going forward, bump *that surface* — not the whole
scale.

**Rejected.** (a) Keep Pass 1 and do a CHROME-only revert (mobile
navbar tall, text unchanged). The user's feedback was about text and
chrome, not just chrome. (b) Apply a midpoint bump (half of Pass 1).
Needed eyes-on review, faster to revert fully and iterate upward if
requested than keep guessing downward.

---

## 2026-04-17 · Patient Flow Pipeline removed from Horizon

**Context.** Horizon had a full-width Patient Flow Pipeline card
showing per-stage ED patient counts (WAITING / IN ED / BOARDING /
ADMITTED / DC READY), total in motion, and a bottleneck indicator.
Card went through three iterations (tile strip → rich card with
dwell/velocity metrics → thin HUD strip) trying to both fit the
viewport and justify its footprint. None of them stuck — Nick
repeatedly flagged the widget as unclear and consistently getting
clipped by the 40px bottom HudStrip ticker.

**Decision.** Delete the widget from Horizon. Its signal was already
surfaced elsewhere on the page:

| Stage count     | Already covered by               |
| --------------- | -------------------------------- |
| WAITING         | ER WAIT TIME (Census & Throughput) |
| IN ED           | TOTAL CENSUS (Census & Throughput) |
| BOARDING        | Active Alerts (boarding threshold) |
| DC READY        | Bed Board (availability)           |
| Bottleneck pill | Active Alerts (ED wait ≥ 90m etc.) |

Horizon is the **forecast** tab — what's coming in the next 4 hours.
Current-state ED throughput belongs on a dedicated Operations tab
(T2.x candidate) where the flow stages can be first-class citizens
alongside triage scores, RN assignments, and door-to-doc timers.

**Rejected.** (a) Keep the thin strip but cut viewport further —
still duplicative, still fighting the ticker. (b) Move the Pipeline
to the top of the page — steals focus from the Saturation Forecast
chart which is Horizon's actual purpose. (c) Build a synthetic
"boarding alert" into Active Alerts when the count crosses
threshold — the Alerts feed already does this in practice.

**Follow-up.** If we ship an Operations tab, port the Pipeline there
as a full-fidelity card (stages, dwell times, velocity arrows,
bottleneck detection). The design work from this round is in git
history (commit `901e0b6`) for reuse.

---

## 2026-04-17 · Type scale + icon sizes bumped ~10-12% for clinical legibility

**Context.** UI read as too small on scratched iPads and in variable
lighting — the base mono tier (`monoXs 11 / monoSm 12 / mono 13`) sits
right at the threshold where glyph weight disappears on a non-perfect
display. Tactical density is the signature, but density had crossed
into unreadable at the base. `fontSize: 10` and `fontSize: 11` were
also used 170 times across the codebase as raw literals — most were
chip labels, timestamps, and metadata strips that operators look at
most often.

**Decision.** Single-pass ~10-12% bump, applied in three layers:

1. **Design tokens** (`components/design/tokens.ts`). `TYPE` scale
   shifted: body 16→17, bodySm 14→15, mono 13→14, monoSm 12→13,
   monoXs 11→12, h4 17→19, h3 21→23, h2 26→28, h1 34→37,
   displaySm 48→52, display 64→70. `CHROME` heights proportional:
   header 56→60, footer 36→40, mobileNav 64→72. `SPACE` left alone
   on purpose — tactical density stays.
2. **Hardcoded `fontSize: N`** across 48 TSX files (520 instances)
   lifted by the same mapping via single-pass perl substitution.
   Below-10 values untouched (CornerBracket chrome).
3. **Lucide icon `size={N}`** (≥10 only — protects CornerBracket
   decoration at size={4-8}) bumped with the same mapping so icons
   stay proportional to the labels they pair with.

Applied uniformly to mobile and desktop — tokens are shared and
splitting by breakpoint would require a `useBreakpoint` check in every
consumer. The proportional relationships hold, so layouts don't need
a full rework.

**Rejected.** A steeper ~20% bump (body 16→19) — loses the tactical
density signature, reads more like Epic than Palantir. Also rejected:
separate mobile/desktop scales — forces every consumer to know which
viewport it lives in, big ergonomics tax for small wins. Also rejected:
root-font-size rescale — would be the cleanest fix if tokens were in
rem, but they're absolute px today, so the token edit is the same
surface area.

**Follow-up.** Spot-check for overflow on narrow mobile screens (iPhone
SE, small-width patient chips, truncated tab labels). Any overflow bugs
get logged as `SPACE.md: 12 → 14` candidates — bump spacing only if a
specific surface feels cramped after the type change, not preemptively.

---

## 2026-04-17 · EmptyState primitive + role-aware zero-states

**Context.** Stage 7 audit walked every screen × role (Manager / Nurse /
ER Personnel / Trauma) looking for surfaces that render from an array
and would read as broken when the array is empty. Most lists already
had empty-state handling, but every one was hand-rolled with different
padding, icon size, label casing, and copy. A few were also generic
("Your caseload is empty") where the role context could carry meaning.

**Decision.** New `EmptyState` primitive in `components/design/primitives.tsx`.
Composes INSIDE a `TacticalCard` (does not wrap one), so it drops into
both standalone placeholders and slots inside existing list cards.
Props: `icon`, `label` (mono all-caps), `title`, `description`, `tone`,
`action`, `compact`. Wired into four offenders:

- **MobileView · Nurse Actions** — "Queue Clear / ALL ACTIONS COMPLETE"
  with filter-aware copy (tells you if you're filtered to STAT/ROUTINE).
- **MobileView · Patients filter** — "NO PATIENTS MATCH" with a Reset
  Filters action when a search or non-default filter is active.
- **MobileView · My Patients** — role-aware: Nurse sees "Caseload
  clear"; ER Personnel sees "No active ED cases"; Trauma sees "No
  active trauma cases". Each with role-specific follow-up copy.
- **EmsInboundBoard · zero traffic** — "NO INBOUND TRAFFIC" upgraded
  from ad-hoc block to the primitive, keeps the dashed border it had.

**Rejected.** Building an `<Empty.Card>` / `<Empty.Inline>` split — one
primitive with a `compact` flag is simpler and already covers both
usage sites. Also rejected: generating empty states per role via a
lookup map — the three copy variants read better as inline conditionals
at the call site.

**Follow-up.** `PatientDetailScreen` (desktop) Labs / Notes / Imaging
return `null` when empty. That's acceptable (sections disappear
cleanly) but could use a `compact` EmptyState if we want to surface
"No labs ordered yet — tap + to add" as a call to action. Not blocking;
clean-scroll behavior is fine for demo.

---

## 2026-04-17 · textDim bumped #2E2E2E → #5A5A5A (WCAG AA)

**Context.** `COLORS.textDim` was `#2E2E2E` — ~1.5:1 contrast on the
`#050505` canvas. Well below WCAG AA (4.5:1). Used for separator pipes,
timestamps, dashes, "SYNCS TO N" labels — all over the app. Legible on
a fresh OLED in a dim room; invisible on a scratched iPad at 3am in a
bright unit.

**Decision.** `textDim` → `#5A5A5A` (5.0:1, clears AA normal-text).
Settings → Display → Contrast check lets you preview any candidate and
apply via `localStorage['pulse-text-dim']` with a reload. Default now
ships AA-compliant; the override hook stays for future tuning.

**Rejected.** `#707070` (AAA) — would visually merge `textDim` into
`textMuted` (#525252) and kill the three-tier quiet-metadata hierarchy.
`#525252` (the textMuted value) — only 4.1:1, still sub-AA, also
destroys hierarchy. Conservative play: lowest value that clears AA.

**Follow-up.** T3.4 step 2 in `improvement-ideas.md` — bump `textMuted`
from `#525252` to `#707070` to restore the contrast gap between the
two tiers. Not done in this change; revisit after eyeballing `#5A5A5A`
in the wild for a week.

---

## 2026-04-17 · Tactical error boundary with 3s auto-reload *(backfilled)*

**Context.** Before Stage 6 a top-level crash in any surface dropped the
user into React's default white fallback — white background, black
sans-serif stack trace. Jarring on a dark tactical UI and useless on a
locked iPhone at 3am. The demo can't afford a screen that says "Something
went wrong" in Helvetica.

**Decision.** `components/ErrorBoundary.tsx` wraps `<App />` in
`index.tsx` and renders a tactical fallback on throw: red-scan canvas,
`SYSTEM FAULT · RESTARTING IN N` ticker, auto-reload in 3 seconds. A
hidden HOLD button + full stack-trace panel unlocks via `?debug=1` in
the URL — invisible for the demo, available to me when things break.

**Rejected.** Sentry integration (T4.4) — real answer but needs a
backend, keys, PHI review. Out of scope for the show. Also rejected:
manual "Reload" button only — if the nurse doesn't see the crash she
can't tap it, auto-recovery wins.

**Follow-up.** T4.4 still the path forward for production — add Sentry
post-show once the backend exists. The tactical fallback is the
permanent first line; Sentry is the reporting channel behind it.

---

## 2026-04-17 · Lamport version clock on shared records for lost-edit detection *(backfilled)*

**Context.** Supabase Broadcast is last-write-wins. Two devices editing
the same patient's vitals within a few hundred ms will silently clobber
each other — the second `setState` call wins the local store and the
broadcast, and the first edit vanishes without the operator knowing.
Worst-case failure mode for a clinical tool.

**Decision.** Every synced record (`Patient`, `ActionItem`, vitals row,
note) carries a `version: number` field that monotonically increments
on mutation. Before accepting an inbound broadcast, compare versions:
if the inbound is older than what we have, drop it. If it's newer,
apply. If it's equal-but-different, surface a `LOST EDIT` toast to the
loser with a reload hint. This is Lamport-clock-lite — not true CRDT,
but 95% of real conflicts become visible.

**Rejected.** Full CRDT via Y.js or Automerge — overkill for our data
shapes, adds ~100KB gzip. Also rejected: vector clocks per field —
would let us auto-merge non-overlapping field edits, but the UX cost
(conflict resolution modal, per-field timestamps) outweighs the
benefit at demo scale.

**Follow-up.** T1.3 in `improvement-ideas.md` is partially addressed —
we have detection but not automatic merge. True merge is Wave C work;
this unblocks the demo without pretending we're solving distributed
systems.

---

## 2026-04-16 · MEWS / NEWS2 / qSOFA triad on PatientHeaderStrip *(backfilled)*

**Context.** `types.ts` has FHIR-aligned `Vital` records but nothing
computed a clinical score from them. A patient with HR 112, BP 88/52,
RR 28, SpO2 91% rendered as four values in four colors — the experienced
eye reads "sepsis" instantly, the app said nothing. Every serious EHR
computes these automatically.

**Decision.** `lib/clinicalScores.ts` — pure functions
`computeMEWS(v)`, `computeNEWS2(v)`, `computeQSOFA(v)` that take a
`Vital` and return `{ score, band: 'low' | 'moderate' | 'high' |
'critical', drivers: [...] }`. Surfaced on `PatientHeaderStrip` as
three Mono chips with tone driven by band (ok → warn → crit). Tapping
a chip expands which vitals are pushing the score up.

**Rejected.** Just showing NEWS2 (UK standard) and skipping MEWS/qSOFA
— US sites use MEWS, Sepsis-3 deprecated SIRS in favor of qSOFA, and
the cost of adding the other two is a dozen lines each. No reason to
pick one.

**Follow-up.** T1.8 in `improvement-ideas.md` is now done. Next wedge
is auto-recompute on each inbound `Vital` write (done in-handler) and
trend arrows showing score delta between the last two measurements
(not yet — adds a second vitals lookup per render, revisit when lists
feel slow).

---

## 2026-04-16 · StateHero binds to live sim; surge tasks become state-aware *(backfilled)*

**Context.** `MobileView` StateHero was hardcoded — `98%`, `4`, `0
bays`. Surge tasks were a static 5-item list regardless of whether
we were in a real surge or a warm-up. Decorative, not operational. The
live sim (`lib/realtimeSim.ts`) had been running for a few days but
nothing on screen actually read from it.

**Decision.** Two moves in the same commit:

1. **StateHero reads live state.** Census %, open bays, EMS inbound
   count, active alerts — all sourced from the simulation's tick
   store. Values update every sim tick; the animated delta arrow is
   the real delta, not a decoration.
2. **Surge tasks are state-aware.** `lib/surgeTaskTemplates.ts`
   inspects current census, open zones, EMS count, staffing gap and
   emits a task list selected from the library. "Open overflow bay in
   Hall C" only renders if Hall C has ≥2 open beds. Tasks reorder by
   impact delta as state changes.

**Rejected.** Gemini-generated surge tasks (T4.1 Phase 2) — ideal but
needs the API budget decision and fallback logic. Phase 1 (deterministic
ruleset) is enough to make the activation feel responsive.

**Follow-up.** T4.1 Phase 2 remains open. This change landed Phase 1.

---

## 2026-04-16 · Remove biometric unlock from login *(backfilled)*

**Context.** Stage 1 shipped a Face ID unlock overlay on top of the
login role picker. On the iPhone 15 Pro simulator it worked fine; on a
physical device without a paired face template it got stuck in the
prompt loop — the overlay blocked the role cards and there was no
escape. Also didn't map to any real identity (see T1.1 — role-picker
trust is the real gap).

**Decision.** Removed the biometric overlay entirely. Login is now just
the role picker again. No identity, no session, no audit (T1.1 will
solve all three properly when it lands). Keeping a half-real biometric
step was worse than skipping it — it implied security we weren't
providing.

**Rejected.** Capacitor Biometric Auth plugin with real fallback to a
passcode — correct answer, but requires a backing identity store and a
PIN-reset flow. Out of scope for POC.

**Follow-up.** T1.10 session lock (5m mobile / 15m desktop) is the real
next step. Lives as an idle-timer + PIN overlay, not Face ID — works
on any device with any user.

---

## 2026-04-16 · QR scanner: reticle only on detection, no hunt animation *(backfilled)*

**Context.** The QR scanner UI went through three iterations in two
days: (1) static centered frame, (2) roaming "hunt" reticle that wandered
the viewport pretending to search, (3) detection-only reticle that
only appears when a code is actually recognized. The hunt animation
looked tactical but implied the scanner was searching when actually
it was doing nothing — honest-demo principle violated.

**Decision.** Detection-only reticle. The frame is static; the scan
line pulses down the viewport; *only* when `BarcodeDetector` (or the
Capacitor plugin on device) returns a match does the tactical reticle
snap into place with corner brackets and the metadata strip (patient
MRN, bed, timestamp). No hunt animation, no pretend-work.

**Rejected.** Hunt reticle — looks cool, lies about what's happening.
Also rejected: overlay a "SCANNING..." ticker — same dishonesty at the
copy layer.

**Follow-up.** Scanner is reused as the BCMA primitive in T2.13 Phase
2 (patient-wristband + med-label verify). The detection-only pattern
is the right base for that workflow.

---

## 2026-04-14 · Bed assignment optional on admission — "holding area" *(backfilled)*

**Context.** The admission flow required picking a bed before the
patient record could be created. Real ED workflow: patient arrives, you
stabilize and chart *before* a bed is available. Forcing an assignment
up front meant we either made up a bed (lie) or blocked the admit (bug).

**Decision.** `BedAssignmentStatus` enum added to `types.ts`:
`UNASSIGNED | PENDING | ASSIGNED`. Admission can create a patient in
`UNASSIGNED` state — they land in a "holding area" view on the bed board
and render in the *My Patients* worklist with a `HOLDING` chip instead
of a bed number. Bed can be assigned later via the bed board or the
patient detail — assigning flips state to `ASSIGNED` and fires the
same broadcast the original flow would.

**Rejected.** A virtual "Bed TBD" row — works visually but breaks bed
counts and census math. Also rejected: forcing triage to assign a bed
— wrong clinically, ESI is about acuity not location.

**Follow-up.** Holding area is a second-class citizen on the bed board
right now — a row under the grid. T2.9 (mutable bed board) should
promote it to a proper zone with its own drag-drop behavior.

---

## 2026-04-14 · MobileAdmitFlow as 6-step wizard, not single form *(backfilled)*

**Context.** The first cut of mobile admission was one long scrolling
form — patient identity, vitals, allergies, problems, code status, bed
on a single surface. On a phone that's eight screens of scroll with the
keyboard eating half the viewport for each field. Tap rates were low
and nurses were abandoning the flow mid-way.

**Decision.** Six-step wizard with a persistent progress bar and explicit
Next/Back navigation:

1. Identity (name, DOB, sex, MRN)
2. Chief complaint + ESI
3. Vitals
4. Allergies + code status
5. Active problems
6. Bed assignment (optional — see holding area ADR above)

Each step is a single focused surface. Swipe-back gesture mirrors
system nav. Progress is preserved in React state so backing out and
forward doesn't lose data. Final step shows a summary before commit.

**Rejected.** Single-form with collapsible sections — still forces the
keyboard + scroll problem. Also rejected: a stepper nav dots UI — too
small on a phone; the progress bar + numeric step indicator reads
better.

**Follow-up.** Desktop admit still uses a single long form (room is
available there, no keyboard pressure). Not worth unifying the flows
— different constraints, different shapes.

---

## 2026-04-13 · Mobile IA stays at 5 tabs; role-gate desktop-only surfaces *(backfilled)*

**Context.** Tried restructuring mobile IA to 12 tabs mirroring every
desktop view. Looked comprehensive on paper, shipped it in commit
`07feb54`, and immediately it was unusable — 12 tabs don't fit on an
iPhone tab bar and a swipe-nav felt like a drawer-in-disguise. Reverted
in `cec1188` the same day.

**Decision.** Mobile stays at 5 tabs: **Horizon**, **Actions**,
**Patients**, **Alerts**, **Comms**. Desktop-only surfaces (Staffing,
Playbooks, Replay, Integration Health, ADT Feed, etc.) are reachable
via the hamburger menu but are not promoted to the tab bar. Tabs
themselves are role-gated: Trauma sees a different Actions tab (activation
checklist) than Nurse (task queue) than Manager (overview KPIs). Same
route, different content.

**Rejected.** 12-tab mirror — reverted. Also rejected: collapsing to 3
tabs (Dashboard / Patients / Actions) — loses Alerts and Comms as
first-class surfaces, and they're the most time-sensitive on mobile.

**Follow-up.** T2.1 (split `MobileView.tsx`) is the next structural
move — once each tab is its own file, role-gating can live at the file
level and the render graph stops mounting everything.

---

## 2026-04-13 · Supabase Broadcast for cross-device sync; publish outside React setState *(backfilled)*

**Context.** Before cross-device sync landed, each device had its own
React state and the demo required running a second browser tab to look
like multi-user. Two bugs surfaced fast: (a) the initial publish was
inside a `setState` callback and fired *before* the state actually
flushed, so remote devices got stale data, and (b) no conflict handling
meant two devices editing vitals overwrote each other silently.

**Decision.** `lib/realtime.ts` uses Supabase Broadcast channels keyed
by incident ID. Every mutation:

1. Optimistic `setState` locally.
2. `queueMicrotask(() => channel.send({ type, payload }))` —
   publish *after* state flush, not inside the setter.
3. Remote receivers compare record versions (see Lamport ADR above)
   and accept or drop.

Channels auto-reconnect on network flap. The HUD strip's connection
indicator reads `SYNC · N` where N is the channel member count.

**Rejected.** Supabase Postgres subscriptions (cheaper queries, slower
fanout — Broadcast is in-memory and sub-100ms). Also rejected: publish
inside the setState callback — looks idiomatic React, silently breaks
ordering.

**Follow-up.** T2.3 (offline outbox) is the next layer — today, a failed
broadcast during network flap is lost. An outbox pattern with local
SQLite persistence makes the story complete.

---

## 2026-04-13 · MobilePatientDetailScreen is a separate component *(backfilled)*

**Context.** Desktop `PatientDetailScreen` is a three-column chart
layout — banner top, vitals + labs + notes + imaging in columns below.
On a phone that shape collapses into a wall of sections and every
interaction is a full-page nav. Trying to make one component render
both well meant a dozen `isMobile ?` forks inside one file.

**Decision.** `components/MobilePatientDetailScreen.tsx` is a separate
phone-native component with its own IA: header strip, tabbed detail
(Vitals / Labs / Notes / Imaging / Orders), bottom action bar
(Discharge, Transfer, Add Vital, Note). Shares `PatientHeaderStrip` and
the clinical primitives with desktop but doesn't try to share layout.

**Rejected.** Responsive-one-file — too many `isMobile` forks, unreadable.
Also rejected: drawer over the list view — loses the fullscreen immersion
the phone form factor asks for.

**Follow-up.** When T2.1 (split `MobileView.tsx`) happens, this file
lives under `components/mobile/` alongside the tab files. Today it's
at `components/` root which is fine for POC.

---

## 2026-04-13 · Trauma is a first-class role, not an ER variant *(backfilled)*

**Context.** Early cut had three roles: Manager, Nurse, ER Personnel.
Trauma response was handled as an ER Personnel mode with a "trauma
activation" toggle. That collapsed two distinct mental models — the
trauma attending running a coordinated team response is not the same
person as the ER nurse managing a bay — and made every role-gated
surface have to special-case `isERPersonnel && isTraumaMode`.

**Decision.** `UserRole` enum gets a fourth value: `TRAUMA`. Every
role-dispatched view (`ROLE_ACTIONS`, `ROLE_METRICS`, StateHero copy,
Actions tab content, menu surfaces) now has a Trauma branch. The
trauma attending sees activation checklist / team assembly / MTP panel
as their primary Actions tab, not as a modal over the ER view.

**Rejected.** Keeping three roles with a mode toggle — forces every
downstream component to know about two dimensions (role + mode).
Four roles is one dimension, cleaner to gate on.

**Follow-up.** T2.26 (Trauma activation + MTP + mass casualty) is the
full build-out. Today the Trauma role has surface coverage but the
activation workflow itself is narrative, not wizard. Wave D work.

---

## 2026-04-12 · Phase 3-4 polish: animations, surge reactivity, safe-area, real-time sim

**Context.** All 17 clinical screens were built and wired. Next was
making the platform feel polished and alive: consistent animations,
surge protocol actually affecting bed state, iOS device safety, and
live-updating metrics.

**Decisions.**

1. **Animation tokens over hard-coded durations.** Five screens had
   custom durations (0.32–0.38s). Normalized to MOTION.fast / MOTION.base
   tokens. Step slides standardized to x:±30 offset.

2. **Surge escalates bed state.** `escalateBedState()` transforms the
   entire hospital: dirty→ready (EVS rapid response), not-staffed→float
   pool, ED beds→reserved, overflow hall opens. Reverts on deescalation.

3. **Safe-area on all overlays.** All 10 clinical overlay screens now
   use `env(safe-area-inset-top/bottom)` for Dynamic Island and home
   indicator. CodeBlueScreen and ESITriageScreen already had it.

4. **Real-time simulation hook.** `useRealtimeSimulation` jitters
   metrics every 5s with ±2% noise. Surge mode transitions smoothly
   over 4 ticks (20s). Dashboard tiles now show live-updating values.

5. **Patient chart enrichment.** Added encounter timeline (6-step ED
   journey with visual connector), care team section (5 members with
   active dots), and handoff launch button.

**Rejected.** Code-splitting via React.lazy — breaks AnimatePresence
exit animations on overlays. Acceptable for a PoC at 2.1MB.

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
