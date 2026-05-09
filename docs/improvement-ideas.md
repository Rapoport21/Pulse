# PULSE — Improvement Ideas

A prioritized list of things we could do next. Not a roadmap, not a
backlog — a set of *bets*, each with enough context to decide whether
it's worth doing.

Entries are tiered by **leverage**, not urgency:

- **T1 · Ship-blockers.** If this ever wants to be a product in a real
  hospital, these must exist. Without them, the app is a pitch deck.
- **T2 · High leverage now.** Invisible wins that prevent compounding
  debt. The longer we wait, the more expensive they get.
- **T3 · Polish.** Visible wins an operator will actually feel. Cheap
  to do, high signal-to-noise.
- **T4 · Bets.** Product ideas and speculative wins. These aren't
  fixes — they're new surface area.

Each entry: what's there now → why it matters → what to do.

---

## Recently shipped (April 2026)

Tracked here instead of deleting the original entries — the "what to do"
sections on the done items still contain useful detail about *how* it
got done. Jump to [`docs/decisions.md`](./decisions.md) for the ADRs.

**Fully shipped:**

- ✓ **T1.5 · Clinical data model (FHIR-compatible)** — `types.ts` now
  carries FHIR R4-aligned `Patient`, `Encounter`, `Vital`, `Allergy`,
  `Problem`, `MedicationOrder`, `Note`, `CodeStatus`, `Isolation`.
- ✓ **T1.8 · Early warning scores (MEWS / NEWS2 / qSOFA)** —
  `lib/clinicalScores.ts` + surfaced on `PatientHeaderStrip`.
- ✓ **T2.10 · EMS incoming board** — `components/clinical/EmsInboundBoard.tsx`.
- ✓ **T2.11 · Vitals capture + trending** — `components/clinical/VitalsPanel.tsx`.
- ✓ **T3.4 · textDim contrast (step 1)** — `#2E2E2E → #5A5A5A` (WCAG AA).
  *Step 2 (bump `textMuted`) still pending.*

**Substantially shipped (primary surface built, follow-ups remain):**

- ⟂ **T1.3 · Persistence with conflict resolution** — version fields
  + `LOST EDIT` toast shipped; automatic merge still open.
- ⟂ **T1.7 · Patient identity (code status / allergies / isolation)** —
  `components/clinical/PatientHeaderStrip.tsx`.
- ⟂ **T1.9 · ESI triage intake flow** — `components/clinical/ESITriageScreen.tsx`.
- ⟂ **T2.8 · Role-based messaging** — `components/clinical/SecureMessaging.tsx`
  ships DM + role broadcast. Escalation chains + SLA timers not yet.
- ⟂ **T2.9 · Mutable bed board** — `components/clinical/BedBoard.tsx`
  is the 1800-line command surface; holding-area zone is a row, not a grid.
- ⟂ **T2.16 · SOAP / I-PASS handoff composer** —
  `components/clinical/HandoffComposer.tsx` replaces the freeform textarea.
- ⟂ **T2.24 · Charge Nurse assignment** —
  `components/clinical/WorkforceCoverage.tsx`.
- ⟂ **T2.25 · ER Physician track board** — `RoundingList.tsx` + `OrderEntry.tsx`.
- ⟂ **T2.31 · Nurse-call + alarm aggregation** —
  `components/clinical/AlertsCenter.tsx`.
- ⟂ **T4.4 · Crash reporting** — tactical `ErrorBoundary` with 3s
  auto-reload shipped; Sentry not yet.

**New since the original list:**

- Trauma promoted to a first-class `UserRole` (not an ER variant) —
  every role-dispatched view branches on four values now, not three.
- Mobile IA locked at **5 tabs** after a 12-tab experiment reverted —
  desktop-only surfaces live behind the hamburger, tabs are role-gated.
- Holding-area admission flow — `BedAssignmentStatus` lets patients be
  created `UNASSIGNED` and live in the worklist pre-bed.
- 6-step `MobileAdmitFlow` wizard replaced the single long form.
- Cross-device realtime via Supabase Broadcast — publish fires
  **after** `setState` flush (not inside the callback).
- `EmptyState` primitive covers every zero-state surface role-aware.

---

## T1 · Ship-blockers

### T1.0a · Navbar is a single universal instance — enforce it

**Where.** `components/MobileView.tsx` — the `<nav>` on ~line 5206 is
today the one and only mobile tab bar. Good. What's missing is the
*architectural guardrail* that prevents a future change from mounting a
second one inside a modal, overlay, or per-screen component.

**Now.** Nav is a single React element in MobileView, z-index 40. But:
- Nothing in the codebase flags "don't render another nav anywhere else."
- Several fullscreen overlays were (and some still are) rendered with
  `position: fixed; inset: 0; z-index: 50`, which visually *replaces*
  the nav with nothing — to the user that reads as "the nav disappeared
  and came back when I closed this screen." That's the same failure
  mode as mounting a lookalike nav per screen, from the user's side.
- `CLAUDE.md` directive #4 now requires: when navigating to any tab,
  the user is looking at the *same* DOM instance. Not a new one that
  looks the same.

**Why it matters.** User-visible invariant. Nick's exact words:
"navbar still disappears. must be there." A replaced/remounted nav
loses animation state, loses focus, can flicker, and is a tell that the
IA isn't really a shell with tabs — it's N separate screens cosplaying.

**What to do.**
1. Add an ESLint rule / grep-check that flags new `<nav>` elements
   outside `MobileView.tsx` and the single desktop shell header.
2. Document in `CLAUDE.md` (done — directive #4).
3. See T1.0b for the companion "don't cover it" rule.

---

### T1.0b · Fullscreen overlays never cover the mobile navbar

**Where.** Any component with `position: 'fixed'` and `inset: 0` that
renders on mobile. Grep hit list as of 2026-04-18:

- Already fixed: `components/clinical/BedBoard.tsx`,
  `components/MobilePatientDetailScreen.tsx`.
- Still covering nav on mobile: `ChatAssistant.tsx` (2),
  `SettingsScreen.tsx`, `QRScannerModal.tsx`, `DischargeFlow.tsx`,
  `OrderEntry.tsx`, `CodeBlueScreen.tsx` (2), `RoundingList.tsx`,
  `BriefMeScreen.tsx`, `EmsInboundBoard.tsx`, `SecureMessaging.tsx`,
  `MobileAdmitFlow.tsx`, `ShiftHandoffModal.tsx`, `PulseHorizon.tsx`
  (2), `StaffManagementModal.tsx`.

**Now.** Each of those uses raw `inset: 0` which extends behind the
53px + safe-area nav, hiding it. Result: nav "disappears" — same
complaint Nick hit twice.

**Why it matters.** Every complaint about the nav vanishing roots
here. Fix is mechanical but must be applied everywhere, not piecemeal.

**What to do.** For every mobile-rendered fullscreen overlay:

1. Import `MOBILE_NAV_OVERLAY_INSET_BOTTOM` from
   `components/design/tokens.ts`.
2. Replace `inset: 0` with:
   ```ts
   top: 0, left: 0, right: 0,
   bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
   ```
3. Add `borderTop: 1px solid ${COLORS.borderStrong}` so the boundary
   reads as a seam, not a gap.
4. If the overlay has its own *internal* bottom-fixed bar (action bar,
   input composer, etc.), that bar also needs `bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM`
   — otherwise it stays pinned to the screen edge and hides the nav
   instead.
5. Add the rule to `CLAUDE.md` (done — directive #5) and reference
   this entry in PR descriptions when adding a new overlay.

**Test.** On any covered screen, the bottom 5-tab HUD must remain
interactive. Tap the tab for a different screen — should navigate
without dismissing the overlay explicitly (nav is always on).

---

### T1.0c · iPhone is portrait-locked

**Where.** `ios/App/App/Info.plist → UISupportedInterfaceOrientations`.
iPad keeps all four orientations via the `~ipad` override.

**Now.** As of 2026-04-18: iPhone is locked to Portrait only. No
Landscape, no PortraitUpsideDown.

**Why it matters.**

- PULSE mobile layout targets a 390-430px wide column. Landscape
  reflows are not designed — every screen, ticker, and overlay assumes
  portrait height.
- Accidental rotation mid-code-blue is a real-world nuisance in a
  clinical setting. Locking removes a whole class of UI-rotation bugs.
- Tablets are a different form factor with different IA expectations.
  iPad keeps rotation enabled on purpose.

**What to do.**

1. Plist is already updated — no further action on iPhone.
2. If iPad ever gets a dedicated layout, revisit whether landscape
   should still be free or gated per screen.
3. Do NOT add a JS-side `ScreenOrientation` plugin just for this —
   the plist-level lock is simpler and native.

---

### T1.1 · Identity, not name-typing

**Where.** `components/LoginScreenTactical.tsx`. `App.tsx` tracks
`currentUser` in local React state with no server validation.

**Now.** A user picks a role card ("Operations Director / Charge Nurse
/ Trauma Attending"). The app trusts it. There is no password, no
SSO, no biometric, no session, no audit trail.

**Why it matters.** This is the one thing that disqualifies PULSE
from ever touching a real hospital. HIPAA and the Joint Commission
both require identity-of-actor for every chart entry. "Who acknowledged
the code blue task at 02:14:07?" must have a real answer tied to a
person, not a device.

**What to do.** Integrate an IdP. On iOS, Capacitor's Face ID plugin
bound to a hospital-issued cert. On web, SAML/OIDC against Azure AD
or Okta. Every mutation (`setSurgeState`, `acknowledgeTask`,
`handover note`) gets stamped with `{ actorId, sessionId, deviceId,
ts }` and appended to an immutable audit log. Auto-lock after N
minutes of inactivity (shift-appropriate — 15m desktop, 5m mobile).

### T1.2 · Real data, or admit the prototype

**Where.** `components/LiveOps.tsx` (hardcoded 5 patients + 13 zones),
`data/userProfiles.ts` (`ROLE_METRICS` / `ROLE_INSIGHTS` literal strings),
`components/MobileView.tsx` StateHero (hardcoded `'98%'`, `'4'`,
`'0 bays'`), the AI Shift Brief paragraph (a single string literal).

**Now.** Every metric on the dashboard is a hardcoded string. The
"live" indicator is a pulsing green dot that means nothing. `82%`
bed capacity is the same `82%` today, tomorrow, and six months from now.

**Why it matters.** Not because the product looks fake in demos —
that's fine for a demo. It matters because *every design decision
we've made is optimized against the mock data*. The MetricTile
severity sizing ([see decisions.md 2026-04-11](./decisions.md)) assumes
`crit` is rare. The smoothstep chart jitter assumes values stay in
40–100%. The StateHero assumes one dominant KPI answers the whole
question. None of these hold when real telemetry arrives — and we
won't know which ones break until we plug it in.

**What to do.** Two tracks, both required:
1. **Data contract.** Define TypeScript types for the *real* payload
   we'd receive: `Census`, `BedState`, `EMSInbound`, `StaffingGap`,
   `TaskState`. Put them in `types.ts` alongside existing enums.
   Every component that currently renders a literal string reads
   from a typed prop against this contract. The mock layer becomes a
   `lib/mockBackend.ts` that implements the same contract in memory.
2. **Adapter layer.** `lib/realtime.ts` grows a `dataSource` config:
   `'mock' | 'supabase' | 'http'`. All three implement the same
   contract. Swapping is a single env var. The UI never knows where
   the data came from.

This is a ~2 week project that will surface more bugs than it fixes,
and that's the point — we need to find them before a hospital does.

### T1.3 · Persistence with conflict resolution

**Where.** `App.tsx` lines 62–99 (17 `useState` hooks at top level),
`components/ActionBoard.tsx` status-change handlers,
`App.tsx` `globalHandoverNotes`.

**Now.** Every mutation lives in React state. Acknowledging a task,
flipping divert status, writing a handover note — all of it
evaporates on page reload. Multi-device coordination is last-write-wins
via Supabase broadcast (optimistic, no version field).

**Why it matters.** The Charge Nurse acknowledges a critical task on
their phone. The Floor Manager, on their iPad, adds a comment to the
same task at the same instant. The broadcast arrives in a nondeterministic
order. One of them loses their change and *has no way to know it
happened*. In a hospital, "silent data loss" is the worst possible
failure mode.

**What to do.** Version every mutable record (`{ id, version, ... }`).
Every write carries the version it was based on. The backend merges
non-conflicting field updates (different columns → merge), rejects
stale writes with the current version attached. The UI shows a
conflict resolution banner with both versions side-by-side. This is
CRDT-lite and solves 95% of real cases; full CRDTs are overkill for
the data shapes we have. Pair this with an **offline outbox** ([see
T2.3](#t23--offline-first-outbox)) and the story is complete.

### T1.4 · Zero tests, on a system that can't afford regressions

**Where.** Project root — no `vitest.config.ts`, no `*.test.tsx`, no
`playwright.config.ts`. `package.json` has no test script.

**Now.** Every commit is a blind rewrite. We rely on manual click-through
and the TypeScript compiler. Both miss logic bugs. The three recent
refactors in this session (tab morph, StateHero hierarchy, MetricTile
severity sizing) could have broken something subtle in ActionBoard
or PulseHorizon and we'd never know.

**Why it matters.** This one gets worse over time. The cost of adding
the *first* test is much higher than the cost of adding the 50th.
Every month we delay, another component ossifies.

**What to do.** Vitest + @testing-library/react. Three layers:
1. **Smoke tests** (1 day). Render each tab, assert it didn't throw.
   That's it. Catches 60% of regressions for almost no effort.
2. **Critical path** (1 week). Login → activate surge → acknowledge
   the top task → verify state propagated → log out. One test per
   role. Run in CI on every PR.
3. **Unit tests for the `lib/` directory** (ongoing). `formatElapsed`,
   `surgeTaskTemplates`, the realtime channel connection state machine.
   These are pure logic and trivial to test.

Skip component-level tests for now — they're high-maintenance and
the smoke tests catch most of what they would.

### T1.5 · Clinical data model (FHIR-compatible)

**Where.** `types.ts` stops at `ZoneStatus`. There is no `Patient`,
`Encounter`, `Vital`, `Allergy`, `Problem`, `Observation`, `Order`,
`MedicationAdministration`, `Note`, or `AuditEvent`. What the app calls
a "patient" today is a row rendered from a literal string mock.

**Now.** Any clinical surface we build is a new throwaway ad-hoc
shape. When the real data arrives, every component has to be rewritten
because nothing was typed against a durable contract.

**Why it matters.** The FHIR R4 Patient/Encounter/Observation/Condition
resource set is the closest thing healthcare has to a lingua franca.
If our types mirror it, plugging in a real FHIR endpoint (Epic,
Cerner, Meditech — all speak R4) becomes an adapter problem, not a
rewrite. If our types don't, it's a rewrite.

**What to do.** One `types/clinical.ts` file with FHIR-aligned
interfaces — not the full spec, just the bits we actually render:
`Patient` (MRN, name, sex, DOB, preferredLanguage), `Encounter` (FIN,
status, admit time, discharge time, class, location, acuity),
`Vital` (systolic, diastolic, heartRate, spO2, temp, respRate,
painScore, GCS, timestamp), `Allergy` (substance, reaction, severity,
verified), `Problem` (ICD-10, display, onset, status),
`MedicationOrder` (drug, route, dose, frequency, indication,
ordering provider), `MedicationAdministration` (drug, dose given,
time, witness), `CodeStatus` ('FULL' | 'DNR' | 'DNI' | 'DNR/DNI' |
'COMFORT'), `Isolation` ('NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE' |
'PROTECTIVE'), `AdvanceDirective` flags, `InsuranceCoverage`,
`Note` (SOAP / I-PASS / nursing). Every new clinical component reads
from these types. Mock data implements the shape. The adapter layer
([T1.2](#t12--real-data-or-admit-the-prototype)) swaps in real data
later without touching components.

### T1.6 · Immutable audit log for every mutation

**Where.** No audit log exists. `ActionBoard` status changes,
`setSurgeState`, `globalHandoverNotes`, `setUrgentTasks` — all mutate
React state and vanish.

**Now.** "Who acknowledged the code blue task at 02:14:07?" has no
answer. The closest we have is a `history` array on each `ActionItem`
with freeform strings, and it isn't even always populated.

**Why it matters.** HIPAA §164.312(b) is explicit: "implement hardware,
software, and/or procedural mechanisms that record and examine
activity in information systems." The Joint Commission goes further
— every chart entry must be attributable to a specific credentialed
actor with a timestamp. Without an audit log, PULSE is legally
disqualified from touching a real chart.

**What to do.** `lib/auditLog.ts` exposes `audit.log({ actor, action,
target, before, after, reason? })`. Every state-mutating function in
the app calls `audit.log(...)` before the mutation lands. Entries
append to an immutable ring buffer (bounded so memory stays sane)
backed by IndexedDB for persistence across reloads. A Manager-only
panel renders the log in reverse chronological order with filter by
actor, target, action. When the backend arrives ([T1.2](#t12--real-data-or-admit-the-prototype)),
the ring buffer becomes a local optimistic mirror of server log
entries. Pair with [T1.1](#t11--identity-not-name-typing) so every
`actor` is a real identity-of-actor, not a self-selected role.

### T1.7 · Patient identity with code status, allergies, isolation

**Where.** `LiveOps.tsx` patient rows currently show a name + room +
chief complaint + ESI badge. `PatientDetailScreen` in `MobileView.tsx`
shows the same plus a few vitals.

**Now.** No code status. No allergies. No isolation. No weight. No
advance directive flag. No language preference. The identity of the
patient — the things that change what every other clinician *does* to
them — is invisible.

**Why it matters.** These five data points are the non-negotiable
header on every paper chart, every EHR banner, every bedside
whiteboard, in every hospital. Missing them from a clinical UI is
the difference between a concept and a product. A "FULL CODE" vs
"DNR" distinction is the difference between running a code and
holding a hand. A peanut allergy vs no peanut allergy is the
difference between giving a med and killing a patient.

**What to do.** `PatientHeaderStrip` component that renders above
the vitals on every patient view: `[MRN-1234]  JANE DOE  ♀ 72yo
62kg` on the top row, `[FULL CODE] [NKA] [CONTACT ISOLATION] [EN]`
chips on the second row, color-coded. DNR → accent red with a white
"DNR" chip; allergies → amber chip listing substances; isolation →
blue chip for contact, yellow for droplet, red for airborne. Allergy
chip is clickable and opens a modal listing each allergen with
reaction + severity. Chip labels use the same `BracketLabel`
primitive as the rest of the app so the tactical register holds.

### T1.8 · Early warning scores (MEWS / NEWS2 / qSOFA / sepsis bundle)

**Where.** Nowhere. Individual vitals exist as decoration. No tile
computes a score.

**Now.** A patient with HR 112, BP 88/52, RR 28, SpO2 91% is rendered
as four values in four colors. An experienced nurse sees "sepsis"
immediately. The app doesn't help.

**Why it matters.** The single highest-leverage clinical-decision
support feature in modern EHRs is automated early warning score
computation. NEWS2 is endorsed by the Royal College of Physicians
and runs on every NHS ward. MEWS is the same in the US. qSOFA has
been the sepsis screen since Sepsis-3 in 2016. Epic, Cerner, and
Meditech all ship this feature. PULSE has the vitals it needs to
compute all three — it just doesn't.

**What to do.** `lib/clinicalScores.ts` — pure functions that take
a `Vital` and return `{ mews, news2, qsofa, sepsis: { meetsSIRS,
suspectedInfection, organDysfunction } }`. Each score returns both
the numeric value and a risk bucket (`low` | `moderate` | `high` |
`critical`) with the action guidance attached (e.g. NEWS2 ≥7 →
"immediate clinical review, likely need escalation"). A
`ClinicalScoreTile` component renders the most relevant score
prominently on the patient header with a delta arrow, plus the
other two in smaller form. Tapping opens a breakdown showing which
vitals are driving the score. Score computation runs on every new
vital entry so the score is always live.

### T1.9 · ESI triage intake flow (Emergency Severity Index 1–5)

**Where.** No triage screen exists. Patients in the mock list already
have an `esi` level but no way to *enter* it.

**Now.** Triage is the single most clinically consequential decision
in any ED. It determines room assignment, nurse ratio, physician
pick-up order, and order-set defaults. PULSE has no way to perform
one.

**Why it matters.** Triage is the one workflow every EMS arrival,
every walk-in, every urgent care handoff passes through. If PULSE
wants to live in the ED, it has to own triage. If it doesn't, it's
a decorative layer on top of Epic ASAP.

**What to do.** `ESITriageScreen` — a wizard with the canonical
Gilboy algorithm:
1. **Is the patient dying?** (airway / pulse / responsive) → ESI 1,
   route straight to trauma bay.
2. **Is the patient high-risk?** (new stroke symptoms, chest pain
   w/ reassurance-refractory, etc.) → ESI 2, go to acute bed.
3. **How many resources does the patient need?** (0, 1, or ≥2 —
   labs, imaging, IV meds, consults all count) plus vital-sign
   danger zone check → ESI 3, 4, or 5.
Each question has a buttoned answer, not a typed free-text. Vital
signs come from a mini vital-entry modal triggered inline. The
final screen produces an ESI badge, suggested room/zone, suggested
nurse assignment, and a one-line text handoff. Store the triage
record in the audit log and attach it to the encounter.

### T1.10 · PHI masking + session lock

**Where.** `App.tsx` has no inactivity timer. No name masking.
Patient names render full-string everywhere including the dashboard
tickers.

**Now.** If a nurse leaves her iPad unlocked on the charge desk and a
visitor walks by, every patient name on the current screen is
visible. HIPAA's "minimum necessary" rule is violated by default.

**Why it matters.** The single most common HIPAA violation cited in
OCR enforcement actions is "unauthorized access to PHI due to
inadequate access controls." Unlocked devices are the #1 vector.
Hospital IT will not deploy software that can't auto-lock.

**What to do.** Two pieces:
1. **Session lock.** `useIdleTimer` hook listens for `mousemove`,
   `touchstart`, `keydown`. After 5 minutes of inactivity on mobile
   (15 minutes on desktop), the app drops a full-screen lock overlay
   with a biometric unlock button (Face ID via Capacitor's Biometric
   Auth plugin). On web, a 6-digit PIN. Lock resets the inactivity
   timer on unlock. The lock overlay blurs the content behind it via
   `backdrop-filter: blur(24px)`.
2. **PHI masking toggle.** Header button that toggles `maskPhi` in
   the Zustand UI store. When on, names render as `J*** D***`, DOBs
   render as `72yo`, SSNs as `xxx-xx-last4`, and photos are
   replaced with initials. Audit log masks actor name the same way.
   Default is *off* — clinicians need to see the whole name — but
   one tap flips the whole app when a visitor approaches the
   station.

Both are cheap to build client-side, and both are mandatory the day
we talk to a real hospital IT team.

---

## T2 · High leverage now

### T2.1 · Split MobileView.tsx (and the other giants)

**Where.** `components/MobileView.tsx` — **3343 lines**. Not alone:
`ActionBoard.tsx` 1994, `PulseHorizon.tsx` 1741, `ChatAssistant.tsx`
1699, `LiveOps.tsx` 1643.

**Now.** Every mobile surface — dashboard, tasks, patients, alerts,
comms, menu, nav, header, surge modal — lives in one file. Changing
the Quick Actions scroll-snap in the dashboard means scrolling past
1800 lines of the alerts tab to find it.

**Why it matters.** Bigger files aren't just harder to read — they
*compound*. Every import everyone else's concerns. The render tree
is one monster component so React can't meaningfully bail on
sub-tree updates. Tree-shaking ships the whole thing even if a
user only opens the dashboard tab.

**What to do.** The split is obvious once you see it:
```
components/mobile/
  MobileView.tsx         ← shell, top/bottom HUD, tab router (~300 lines)
  DashboardTab.tsx       ← StateHero + Live Ops + Horizon + Quick Actions + AI Brief
  TasksTab.tsx           ← surge tasks + routine tasks
  PatientsTab.tsx        ← patient list + search
  AlertsTab.tsx
  CommsTab.tsx
  MobileMenu.tsx         ← hamburger overlay
  StateHero.tsx          ← the biggest numeric on the screen, role-aware
  SectionHeader.tsx      ← shared primitive
  MetricTile.tsx         ← shared primitive (also used by desktop — see T2.5)
```
Each file 200–400 lines. Imports get surgical. Lazy-loading tabs
becomes trivial ([see T3.2](#t32--lazy-load-each-tab)).

This is a 1–2 day refactor with zero behavior change — all
git-movable mechanical.

### T2.2 · TypeScript strict mode, on by default

**Where.** `tsconfig.json`. Currently has *zero* strict flags —
`"strict"`, `"noImplicitAny"`, `"strictNullChecks"`, `"noUnusedLocals"`,
none of them set.

**Now.** `const patient: any = ...` is fine. `undefined.foo` compiles.
An optional prop with no default becomes a runtime time bomb.

**Why it matters.** Hospital software should be the *last* place we
accept implicit any. And the fix is free: TypeScript already knows
the types, we just haven't asked it to care.

**What to do.** Flip `"strict": true` in tsconfig, run the compiler,
count errors. My guess: 30–60 real problems, most of them trivial
(missing null checks, `any` on ref forwarding, optional props).
Spend half a day fixing them. Add a pre-commit hook via lint-staged
so no new `any`s land. The alternative — "we'll do it later when
there are fewer types" — is a lie. There will be more types, not
fewer.

### T2.3 · Offline-first outbox

**Where.** `lib/realtime.ts`. Supabase broadcast is the only write path.

**Now.** On a flaky elevator Wi-Fi connection, `setUrgentTasks(...)`
silently fails. The React state updates locally, the user sees the
green checkmark, and the change never reaches anyone else. The nurse
walks away thinking the task was acknowledged. It wasn't.

**Why it matters.** Hospital buildings are a faraday cage of concrete
and lead shielding. Signal loss is not an edge case, it's a constant.

**What to do.** Wrap every mutation in an outbox pattern:
1. Write to local SQLite via Capacitor's Preferences or a real
   SQLite plugin (`@capacitor-community/sqlite`).
2. Emit the optimistic UI update immediately.
3. Kick off the Supabase broadcast. On success, dequeue. On failure,
   leave in queue and retry with exponential backoff.
4. On app resume / connection restore, flush the queue oldest-first.
5. Show a subtle pending-count badge in the HudStrip when the queue
   is non-empty. Tap to see what's pending.

This pairs with T1.3 (versioning) — each outbox item carries the
base version it was written against, so conflicts are visible on
flush, not silent.

### T2.4 · A real state layer (stop prop drilling)

**Where.** `App.tsx` lines 62–99 — 17 top-level `useState` calls,
all drilled through to descendants that re-render whenever any of
them changes.

**Now.** Adding a new piece of global state ("current incident ID")
means adding a state hook to App.tsx, threading it through 4–6
component layers, and updating every prop type along the way.

**Why it matters.** Prop drilling is *visible* tech debt — you can
see it in every component file. But the real cost is invisible: any
state update in App.tsx re-renders the entire MobileView subtree,
including tabs that aren't even mounted. We're already paying for
it today; the bill compounds with every added state.

**What to do.** Zustand. Not Redux (ceremony), not Context
(re-render storm), not Jotai (still early). Zustand is 1KB gzip,
has React 19 compat, supports selectors for precise subscriptions.
Create `stores/session.ts` (currentUser, isMobile, connection),
`stores/incident.ts` (surge state, urgent tasks, handover notes),
`stores/ui.ts` (active tab, toasts, modals). Each component
subscribes to the slice it needs. App.tsx shrinks by half.

### T2.5 · One MetricTile, two surfaces

**Where.** Desktop metric tiles live in `components/LiveOps.tsx`
(~1643 lines). Mobile metric tiles are a separate component inside
`components/MobileView.tsx`. They share ~0 code.

**Now.** When we added severity-based value sizing
([see decisions.md](./decisions.md) — "MetricTile size
differentiation by severity"), we had to decide: fix it on mobile
only, or fix it on both. We fixed it on both, but the commit touched
two near-identical implementations. Next time we add a behavior, we
either do it twice or forget to.

**Why it matters.** Duplication survives as long as no one notices
it; then someone changes one copy and doesn't realize the other
exists. The severity-sizing decision is exactly the kind of thing
that drifts between two copies over six months of iteration.

**What to do.** Extract `components/primitives/MetricTile.tsx` as
the single source. Props: `label`, `value`, `unit`, `delta?`,
`accent?`, `progressPct?`, `size: 'sm' | 'md' | 'lg'`. Mobile uses
`md`, desktop uses `lg`, tiles inside the sidebar use `sm`. One
file, one place to change severity sizing. Same exercise for
`SectionHeader`, `StatusPill`, and (eventually) `TacticalCard`
variants.

### T2.6 · Code-split the 1.7MB bundle

**Where.** `dist/assets/index-BYy8b9yo.js` — 1.7MB minified, 473KB
gzipped, single chunk.

**Now.** Every user on every device downloads the entire app before
they can see the login screen. Recharts alone is ~160KB. The Gemini
SDK is ~90KB. React Markdown plus remark-gfm is another ~80KB. Nobody
needs any of that to sign in.

**Why it matters.** Cold start on 4G is 2–3 seconds before the login
screen renders. On a hospital Wi-Fi with TLS handshake overhead,
worse. First impression matters — and the iOS app's initial paint
is gated by the same bundle.

**What to do.** Three cheap wins stacked:
1. **Route-level lazy loading.** `React.lazy(() => import('./components/ChatAssistant'))`.
   ChatAssistant only loads when the user opens it. Same for
   `ShiftHandoffModal`, `PlaybookActivation`, `Replay`, `PrintPreviewModal`.
2. **Manual chunking.** In `vite.config.ts`, add
   `build.rollupOptions.output.manualChunks: { charts: ['recharts'], ai:
   ['@google/genai', 'react-markdown', 'remark-gfm'] }`. Recharts and the
   AI stack become separate chunks that load on demand.
3. **Tree-shake Lucide.** The imports already use named imports (good)
   but verify Vite is actually treeshaking them — add
   `"sideEffects": false` to any of our own components that don't have
   side effects, so Rollup can eliminate dead paths.

Expected outcome: initial bundle drops to ~600KB, login screen paints
in <1s on 4G.

### T2.7 · Kill the orphan `@tailwindcss/typography`

**Where.** `package.json` line 21. No `tailwind.config.*`, no
`postcss.config.*`, only 13 `className=` usages in the entire source
tree (all inline styles otherwise).

**Now.** Tailwind core isn't installed. Tailwind typography plugin is.
It does nothing. It ships in `node_modules` but can't run because it
has no core to plug into.

**Why it matters.** Dead weight is an indicator, not a bug. Someone
started migrating to Tailwind and abandoned it. Next person comes in,
sees `@tailwindcss/typography`, thinks Tailwind is the styling system,
spends an hour confused. Kill it now.

**What to do.** `npm uninstall @tailwindcss/typography`. One-line
commit. Add a sentence to `docs/decisions.md`: "Inline styles with
design tokens is the chosen approach." The commit message is the
decision.

### T2.8 · Role-based messaging with escalation chains

**Where.** `ChatAssistant.tsx` is a 1699-line AI chat surface, not
a team messaging surface. There is no DM, no channel, no role
broadcast, no escalation.

**Now.** If a bedside nurse needs to reach the on-call hospitalist,
she picks up an actual phone and pages. If the charge nurse needs
to tell every RN on a shift that a trauma is inbound, she shouts.
PULSE has AI chat but zero human chat.

**Why it matters.** The single most common "help me replace"
conversation with clinical customers in the TigerConnect/PerfectServe
space isn't about the pager — it's about the *escalation chain*.
"If the primary doesn't answer in 2 minutes, page the secondary. If
the secondary doesn't answer in 5 minutes, page the attending."
That logic lives in the messaging layer, and PULSE has no messaging
layer.

**What to do.** `lib/messages.ts` + `components/CommsTab.tsx`:
- **DM.** One-to-one threads keyed by `(senderId, recipientId)`.
  Persist in Supabase with RLS so only participants read.
- **Role broadcast.** One-to-many to all users with a given role in
  a given unit. "TRAUMA INBOUND 5m" to `@all-er-nurses`. Read
  receipts aggregated ("14 of 16 read").
- **Escalation chain.** Every critical message attaches a chain
  (`[primary → secondary → attending]`) with a timeout per hop. A
  background timer walks the chain if the current target hasn't
  acknowledged. The UI shows a live timeline of who was paged
  when.
- **Role-routing, not person-routing.** Messages address the role
  first ("whoever is on call for nephrology") and resolve through
  the on-call directory ([T2.20](#t220--on-call-directory--escalation)).

Every message gets a full audit trail so "who was told what when"
is answerable months later.

### T2.9 · Bed board that mutates state

**Where.** `LiveOps.tsx` has a bed-zone grid but each cell is a
read-only render of a static `ZoneStatus` row.

**Now.** You can see bed 4A is occupied. You can't change it. You
can't assign a patient to it, mark it dirty, trigger housekeeping,
or transfer the patient to 4B. It's a picture of a bed board, not
a bed board.

**Why it matters.** The bed board is the single most valuable screen
in a hospital command center — operators live in it. If PULSE is
going to displace TeleTracking or Epic's Bed Planning, it has to
*be* the bed board, not render a snapshot of one.

**What to do.** Extract `BedBoard.tsx` as its own surface. Every cell
is clickable. Click opens a bottom sheet (mobile) or side panel
(desktop) with the bed's current state, current patient (if any),
and action buttons: *Assign patient*, *Discharge*, *Mark dirty*,
*Mark ready*, *Transfer to...*, *Block*, *Unblock*. Every action
mutates the zone state optimistically, broadcasts via Supabase,
and writes an audit log entry. Patient assignment pulls from the
unassigned patient queue. Mark-dirty auto-creates an EVS task.
Visual state: green (ready), gray (occupied), yellow (dirty), red
(blocked), blue (clean-in-progress), amber-striped (discharge
pending).

### T2.10 · EMS incoming board

**Where.** ER_PERSONNEL role has `Ambulance ETA: 3 (<5m)` as a
metric driver. That's the entire EMS surface.

**Now.** When EMS calls ahead with a trauma, the information arrives
by radio and lives in whoever answered the phone's head. PULSE has
no way to capture or display inbound.

**Why it matters.** Trauma activation is the highest-stakes
time-sensitive workflow in any ED. "ETA 5 minutes, GSW to abdomen,
BP 74/50, HR 136, Level 1 Trauma" requires the trauma team to be
assembled and the bay prepared *before* the patient arrives. The
ED that can read that off a board beats the ED that reads it off
a radio transcript.

**What to do.** `EMSIncomingBoard.tsx` — a queue of inbound
patients sorted by ETA. Each row: ETA countdown, unit ID,
chief complaint, field vitals, trauma activation level,
destination bay, receiving team, transport method (ground/air).
Rows pulse when ETA drops below 3 minutes. Tapping a row opens
a prep checklist (trauma bay cleared, airway cart ready, blood
bank notified, attending paged, imaging alerted, OR on standby
if Level 1). When the patient arrives, the row converts to an
encounter with the pre-arrival data as seed values. Data for
demo comes from a synthetic feed with 3–5 rolling inbound entries
that advance their ETA over time.

### T2.11 · Vitals capture + trending view

**Where.** `MobileView.tsx` `PatientDetailScreen` shows *current*
vitals as labeled values. No history, no trend, no input.

**Now.** You cannot enter a new vital set. You cannot see the last
24 hours. You cannot spot a trend. A patient whose SpO2 dropped
from 97% to 89% over 40 minutes looks identical to a patient who's
been stable at 89% all shift.

**Why it matters.** Vital-sign trending is the oldest and most
reliable form of early warning in medicine. The MEWS/NEWS2
scores ([T1.8](#t18--early-warning-scores--mews--news2--qsofa--sepsis-bundle))
need the history to be meaningful. A single number at one point
in time is almost useless.

**What to do.** `VitalsPanel.tsx` — two parts:
1. **Entry.** A mini form: systolic, diastolic, HR, RR, SpO2, temp,
   pain, GCS. Tap each to inc/dec or open a numpad. Submit writes
   a new `Vital` to the patient's vital history and refreshes the
   score tile. Triggers MEWS recompute.
2. **Trending.** Recharts sparkline per vital axis (or a combined
   multi-axis chart with SpO2/HR/BP/RR). Last 24h by default, scrub
   back 48h/72h. Horizontal bands on the chart for the danger
   zones (HR > 130, SpO2 < 92, etc.). Tapping a point shows the
   time, actor, and raw value. Computed scores plot alongside for
   easy "was this patient trending toward sepsis before we caught
   it?" review.

### T2.12 · Flowsheet and I&O (intake/output)

**Where.** Nowhere in the app. No I&O tracking, no fluid balance,
no urine output log.

**Now.** The single most labor-intensive nursing task during a shift
is the flowsheet — hourly intake, hourly output, Q2 or Q4 turn and
position, Q4 pain reassessment. Nurses chart this in Epic flowsheets
or on paper.

**Why it matters.** If PULSE wants to live on the bedside iPad, it
has to own the flowsheet. Without it, the nurse is in two apps all
shift and PULSE loses.

**What to do.** `FlowsheetPanel.tsx` — grid with rows per measurement
(intake: IV, PO, enteral; output: urine, emesis, drainage), columns
per hour, cells are either a number or a dash. Tap any cell to edit.
Running totals per column, running balance per row. Thresholds:
`<30 mL/hr urine for 2 hours` triggers an amber cell + alert to
the bedside nurse. Q2 turn/reposition is a checklist column with
timestamps. Q4 pain reassessment rolls up to the patient header.

### T2.13 · MAR (Medication Administration Record)

**Where.** Nowhere.

**Now.** PULSE doesn't know what meds a patient is on, when they
were due, whether they were given, who gave them, or whether there
was a BCMA mismatch.

**Why it matters.** The MAR is the second-most-time-consuming
surface for a bedside nurse. Med errors are the #1 cause of
preventable inpatient harm — every serious hospital uses BCMA
(barcoded medication administration) where the nurse scans the
patient's wristband, scans the med, and confirms the five rights
(right patient, right drug, right dose, right route, right time).
Without this workflow, PULSE can't be the bedside surface.

**What to do.** Two phases:
1. **Phase 1 — the MAR, no scanning.** A timeline view of ordered
   meds with due times, status chips (scheduled, due, overdue,
   given, held, refused), administration history (who, when, dose
   given, witness for high-alert meds). Tap to administer → modal
   asks for verification (two-nurse for insulin/narcotics),
   records the action.
2. **Phase 2 — BCMA-lite via QR.** We already have a QR scanner
   ([QRScannerModal.tsx](../components/QRScannerModal.tsx)).
   Reuse it: patients get QR wristbands (display the patient QR on
   their detail screen as a test target), meds get QR on the label.
   The nurse scans the wristband, scans the med, and the app
   verifies the match. Mismatch → red alert, blocks administration,
   logs an audit event. Works identically in the iPhone shell and
   the web preview.

### T2.14 · Results inbox + orders panel

**Where.** Nowhere in the app.

**Now.** Labs, imaging, and pharmacy results are what the physician
*works on* all shift. PULSE has zero surface for them.

**Why it matters.** The "orders + results" surface is the primary
workflow for ER and inpatient physicians. Epic's Results Inbox is
the most-used screen in Epic outside the chart. Without it, PULSE
is a dashboard for people who don't exist.

**What to do.** Two panels on the patient detail:
1. **Orders.** Active, on-hold, completed. Each row: order name,
   type (lab/imaging/med/consult), requester, placed at, status,
   result time (if applicable). Tap to see detail / discontinue /
   modify.
2. **Results.** New-since-last-login at the top with a `NEW`
   chip. Each row: test name, LOINC code, result value, reference
   range, abnormal flag (H/L/HH/LL with color), collected at,
   resulted at. Critical results (HH/LL) stack at the very top
   with a red left-border and a required-acknowledgment button
   that logs the physician's review.

For the demo: synthetic CBC, BMP, troponin, lactate, chest X-ray,
CT head with plausible values and a couple of abnormals so the
UI shows its range.

### T2.15 · Problem list + active diagnoses + ICD-10

**Where.** Nowhere.

**Now.** The patient's active problem list — "CKD stage 3, type 2
diabetes, AFib on eliquis, HFrEF EF 35%" — is invisible.

**Why it matters.** Every clinical decision is made *in context of*
the active problem list. A chest pain workup is different for a
patient with known HFrEF. An abdominal pain workup is different
for a patient on eliquis. Without the problem list visible,
clinicians have to ask the patient, and the patient sometimes
doesn't know.

**What to do.** `ProblemListPanel.tsx` — a table of active problems
with `{ icd10, display, onset, status, lastVisit }`. Each row is a
`BracketLabel` chip with the ICD-10 code + display text. Inactive
problems collapsed under a divider. Tap to add a new problem via
ICD-10 search. Resolved problems roll down to a "past medical
history" subsection. On the patient banner, the 3 highest-priority
active problems surface as chips next to allergies.

### T2.16 · SOAP / I-PASS handoff composer

**Where.** `App.tsx` has `globalHandoverNotes` as a string blob.
`ShiftHandoffModal` exists but takes freeform text.

**Now.** Handoff is a freeform textarea. The nurse types whatever
she wants, in whatever format she wants, and hopes the receiving
nurse can parse it.

**Why it matters.** I-PASS (Illness severity, Patient summary,
Action list, Situation awareness, Synthesis by receiver) is the
most-studied handoff structure in medicine with a proven 23%
reduction in medical errors when adopted. Structured handoff is
not optional for patient safety — it's a top-5 Joint Commission
priority.

**What to do.** Replace the freeform textarea with an I-PASS
wizard:
1. **Illness severity.** Three-pick: Stable / Watcher / Unstable.
2. **Patient summary.** Gemini auto-drafts a one-paragraph
   summary from the chart, nurse edits.
3. **Action list.** Pulls from the active task list with
   checkboxes; anything unchecked at handoff stays on the list.
4. **Situation awareness.** Free text or voice, optional.
5. **Synthesis.** Incoming nurse is required to read back the
   action list to accept the handoff. Audit log records the
   read-back timestamp and identity.

Every handoff becomes a `Note` of type `I-PASS` attached to the
encounter. Reviewable in the chart timeline.

### T2.17 · Discharge readiness queue

**Where.** Manager role has `Expedite Discharges (4 identified)`
as an action item. That's a one-line string, not a workflow.

**Now.** When the bed board is red, everyone wants to know which
patients could be discharged *now*. The answer lives in a charge
nurse's head.

**Why it matters.** Discharge acceleration is the single most
impactful throughput intervention in any hospital. A 30-minute
reduction in discharge-to-bed-ready time is worth 2–3 additional
admissions per bed per day.

**What to do.** `DischargeQueue.tsx` — a filtered view of patients
whose `dischargeReady` score ≥ 7/10. Score components:
medically stable, final med rec done, scripts printed,
follow-up booked, transport arranged, family present, bed secured
at destination (if transfer), paperwork signed. Each component
is a checkbox with an owner; unchecked blocks discharge. Complete
all 10 → the patient's bed flips to `discharge-pending` on the
bed board and a housekeeping task auto-generates with the expected
discharge time.

### T2.18 · Door-to-doc / LWBS / LOS throughput dashboard

**Where.** Nowhere.

**Now.** The Manager dashboard tells you current census. It doesn't
tell you whether the ED is getting *faster* or *slower*. There's
no door-to-doc, no left-without-being-seen, no length-of-stay
trending.

**Why it matters.** CMS reports door-to-doc and ED LOS publicly for
every hospital in the US. These are the numbers the CEO asks
about on every Monday meeting. They're also the numbers the
regulators grade. PULSE can't pitch to a manager without them.

**What to do.** `ThroughputDashboard.tsx` — four tiles with
24h/7d/30d sparklines:
- **Door-to-doc** (median + 90th percentile, with the CMS target
  line at 25 minutes).
- **LWBS rate** (percentage, with a trend arrow).
- **ED LOS** (median, separated by disposition — discharged vs
  admitted vs transferred).
- **Boarding hours** (the total hours admitted patients spent
  waiting for an inpatient bed).

Each tile opens a detail drawer with histogram + outlier list +
root-cause breakdown. Shipped as a new Manager-only view, plus a
tile on the Manager dashboard as an at-a-glance summary.

### T2.19 · Integration status dashboard

**Where.** Nowhere.

**Now.** In a real deployment, PULSE would bind to 8–12 upstream
systems: Epic (FHIR R4), Cerner (FHIR R4), a lab (HL7 v2 ORU),
an imaging PACS (HL7 v2 ORM/ORU + DICOM), pharmacy (HL7 v2 RDE),
ADT feed (HL7 v2 A01/A02/A03/A08), telemetry (Philips IntelliVue
via IP), bed tracking (TeleTracking), paging (TigerConnect/Vocera),
nurse call (Rauland/Hill-Rom), RTLS (CenTrak), and push (APNs/FCM).
Any of these going down creates a blind spot for the operator.

**Why it matters.** Clinical ops teams need to know *right now*
that the ADT feed has been down for 12 minutes, because that's why
the patient who just rolled into bed 4 hasn't shown up on the
board yet. Blind integration failures create data-trust collapse,
and once trust collapses on a clinical product, it doesn't recover.

**What to do.** `IntegrationHealth.tsx` — a grid of bound systems,
each with a health indicator (green/yellow/red), last successful
message timestamp, error rate over the last hour, and a detail
drawer with recent failures. For demo, the grid is fed by a
synthetic `lib/integrations.ts` that randomizes green with
occasional yellow/red flashes and a reconnect animation. When
real integrations exist, swap the backing store without touching
the UI.

### T2.20 · On-call directory + escalation

**Where.** Nowhere.

**Now.** When the bedside nurse needs the nephrologist on call at
3am, she looks at a printed piece of paper taped to the charge
nurse desk. Often it's outdated.

**Why it matters.** On-call directory errors are one of the most
common "why didn't the right person get paged" root causes in RCA
reports. Digital, real-time, queryable on-call is the only way to
fix it.

**What to do.** `OnCallDirectory.tsx` — browsable by role,
service, unit. Each row: name, credentials, primary contact
method, secondary, tertiary, shift window. Tap a row to start a
message through the messaging primitive ([T2.8](#t28--role-based-messaging-with-escalation-chains)).
Attach an SLA to each role (e.g., cardiology 15min, nephrology
30min) — if no ack within SLA, auto-escalate to the secondary and
log the escalation.

### T2.21 · Insurance / payer / encounter tile

**Where.** Nowhere.

**Now.** PULSE doesn't know whether the patient is Medicare,
Medicaid, private, self-pay, or an out-of-network emergency
visitor. All patients render identically.

**Why it matters.** Payer drives network steering, pre-auth
requirements, follow-up options, and (in the US) the difference
between bankruptcy and a normal discharge for the patient. Case
managers work this screen every hour.

**What to do.** `InsuranceTile.tsx` on the patient detail —
primary, secondary, tertiary coverage with carrier name, plan
type, group ID (masked by default), copay status, pre-auth
requirements for any pending orders. A red banner if the current
admission is uncovered.

### T2.22 · FHIR R4 contract definitions

**Where.** Nowhere.

**Now.** We're building clinical types ([T1.5](#t15--clinical-data-model-fhir-compatible))
but we need to be explicit that they're FHIR-aligned, and we need
to be able to serialize/deserialize against an actual FHIR
endpoint the day one appears.

**Why it matters.** Epic, Cerner, Meditech, and Allscripts all
speak FHIR R4 now. Owning a small set of Patient/Encounter/
Observation/Condition/MedicationRequest/DocumentReference types
is the difference between "plug in a real endpoint in a week" and
"rewrite half the app."

**What to do.** `types/fhir.ts` — strict FHIR R4 resource shapes
for the dozen resources we care about. `lib/fhirAdapter.ts` —
pure functions that map FHIR → PULSE clinical types (one-way
for now). Test against a couple of canned FHIR bundles to verify
the mapping round-trips cleanly. This is an afternoon of work
and it's the single biggest "enterprise-ready" signal we can
send to a clinical IT team.

### T2.23 · HL7 v2 ADT feed viewer

**Where.** Nowhere.

**Now.** The ADT feed is the oldest and most widely deployed
clinical integration (A01 admit, A02 transfer, A03 discharge,
A04 register, A08 update). Every hospital has one. It's how
the bed board stays current.

**Why it matters.** In most hospitals the canonical source of
truth for "who is where right now" is the HL7 v2 ADT stream,
*not* Epic's REST API (which lags the ADT stream by seconds).
Operations teams watch the raw feed when things go wrong.

**What to do.** `ADTFeedViewer.tsx` — a scrolling terminal-style
feed of ADT messages, newest on top. Each message: timestamp,
event type, patient MRN (masked when PHI mask is on), location.
Tap a message to expand the raw pipe-delimited HL7 segment. For
demo, feed is generated by a mock `lib/adtStream.ts` that fires
a plausible mix of events per minute. Real deployment: swap the
backing source for a websocket subscription to a Mirth Connect
channel.

### T2.24 · Charge Nurse assignment load balancer

**Where.** Nowhere.

**Now.** Nurse assignments happen on a whiteboard or a grease
pencil on a laminated sheet. PULSE has no assignment view.

**Why it matters.** Charge Nurse work is 80% assignment management.
Every new admit requires deciding "which nurse takes this?" based
on current load (patient count), acuity load (ESI-weighted), and
skill match (cardiac-capable for a chest pain, etc.).

**What to do.** `AssignmentBoard.tsx` — a grid with one column per
RN on the shift, cells are assigned patients. Below each column:
patient count, acuity sum, task-count, break status, estimated
busy-minutes-per-hour. Drag-and-drop a patient between nurses
(desktop) or long-press → pick-new-nurse (mobile). Audit every
reassignment. Auto-suggest a nurse for new admits based on
lowest acuity-weighted load + skill match.

### T2.25 · ER Physician track board

**Where.** Nowhere.

**Now.** ER docs work off Epic ASAP's track board. PULSE has
nothing equivalent.

**Why it matters.** The ED track board is the ER physician's
primary workspace — it shows every patient in the department,
sorted by bed, with current status, pending results, time in
department, and the current plan. Without it, an ER doc opening
PULSE can't work.

**What to do.** `TrackBoard.tsx` — one row per patient sorted by
location. Columns: bed, patient (masked), age/sex, ESI, chief
complaint, time in department, last vitals (mini sparkline), my
pending (lab + imaging + consult counts with green/yellow/red by
age), and disposition plan. Row click → jump to the full chart.
Filter by zone (acute / fast track / trauma / CDU). Every physician
gets a personalized "my patients" filter.

### T2.26 · Trauma activation + MTP + mass casualty

**Where.** The ER_PERSONNEL dashboard mentions "Trauma activation
(Level 1) ETA 5 mins" as a narrative string. No structured workflow.

**Now.** A trauma activation is a highly choreographed 20-person
response. It has a checklist, a role card, a bay assignment, a
blood bank protocol (massive transfusion), an OR standby, and
(for a Level 1) an attending at the bedside within 15 minutes.
PULSE doesn't model any of it.

**Why it matters.** Trauma centers are graded on activation
compliance by state trauma registries. A program that can show
PULSE as the trauma team's operating surface is pitching to the
center's highest-stakes workflow.

**What to do.** `TraumaActivationScreen.tsx` — opens full-screen
on activation with:
1. **Primary survey checklist** (ABCDE — airway, breathing,
   circulation, disability, exposure) with time stamps on each
   item and the name of the person who cleared it.
2. **Role assignments** — team leader, airway, circulation
   (right), circulation (left), scribe, procedure, runner. Each
   role card pulls from the on-call directory and pages the
   assignee on activation.
3. **MTP panel** — activate massive transfusion protocol with
   a one-tap button; blood bank gets paged, the pack status is
   tracked (1:1:1 ratio of PRBC:plasma:platelets), cooler ETAs
   are shown.
4. **Imaging request** — one tap triggers CT torso / pelvis
   orders routed to the on-duty rad.

Mass casualty variant: `MassCasualtyTriageScreen.tsx` using the
START (Simple Triage And Rapid Treatment) algorithm to tag
patients black/red/yellow/green.

### T2.27 · Manager KPI cockpit

**Where.** Manager dashboard has hardcoded `24 Admitted`,
`45m Avg`, `-2 FTE`. No trend, no target, no drill-down.

**Now.** The Ops Director opens PULSE and sees three strings.
She can't tell whether today is better or worse than yesterday.
She can't drill into the staffing gap to see which zone has it.
She can't export for the Monday leadership meeting.

**Why it matters.** The Manager role is who signs the check. If
the dashboard doesn't answer her questions, she cancels the
pilot. Her questions are specific: LWBS rate, 72h bounce-back
rate, patient satisfaction (HCAHPS top-box), door-to-doc
compliance, LOS by disposition, daily revenue per admit, staff
turnover, incident rate, compliance (hand hygiene, line days,
CAUTI, CLABSI).

**What to do.** `ManagerCockpit.tsx` — a full desktop-optimized
view with:
- **Top strip.** 6 tiles: LWBS, door-to-doc, LOS, boarding hours,
  bed capacity, staffing gap. Each with target + actual + delta +
  30-day trend.
- **Quality strip.** Hand hygiene compliance, medication errors
  (7d), fall rate (30d), HAIs (30d).
- **Regulatory strip.** CMS core measures (pneumonia, sepsis,
  STEMI, stroke) with red/yellow/green on each.
- **Financial strip.** Revenue per admit, contribution margin,
  AR days, denial rate.
- **Incidents panel.** Open RCA investigations with assignment,
  due date, and status.

Each tile drills down to a detail view with histogram, outlier
list, and export-to-CSV button.

### T2.28 · Predictive bed demand forecast

**Where.** `PulseHorizon.tsx` has a forecast chart but it's
hardcoded smoothstep synthetic data.

**Now.** The forecast is decoration. It predicts nothing.

**Why it matters.** Qventus and Epic's Bed Planning module both
ship real predictive bed demand. A Charge Nurse uses the
forecast to decide whether to open overflow at 2pm or wait until
6pm. Without real prediction, the decision is guesswork.

**What to do.** Three phases:
1. **Phase 1 — rule-based.** `lib/bedForecast.ts` — simple
   projection: current census + historical average arrivals per
   hour for this DoW/hour + historical average discharges per
   hour - bounded by capacity. Fit on 30d of synthetic data
   (or real once we have it). Outputs a 12h forecast curve.
2. **Phase 2 — ML.** Train a boosted tree on historical data
   with features: census, inbound EMS count, weather, sports
   calendar, day-of-week, holiday flag. Run inference on the
   client via TensorFlow.js. Store model artifacts in `public/`.
3. **Phase 3 — confidence bands.** Shade the forecast with
   P10/P50/P90 bands so the operator sees uncertainty.

The chart already supports the line; we're replacing the data
source, not the rendering.

### T2.29 · Staff supply/demand forecast

**Where.** Nowhere.

**Now.** The "staffing gap" metric is a hardcoded `-2 FTE` string.

**Why it matters.** Staffing decisions drive more than half of
hospital operating cost. Charge Nurses manually recalculate the
ratio every time someone calls in sick.

**What to do.** `StaffingBoard.tsx` — grid of scheduled-versus-
actual staff by zone, by role, by shift. Red cell = understaffed.
Projected need for the next 4h/8h/12h based on the bed demand
forecast ([T2.28](#t228--predictive-bed-demand-forecast)). Call-out
controls: page float pool, page agency, request OT. Each action
records cost estimate for end-of-shift reporting.

### T2.30 · Incident reporting + RCA workflow

**Where.** Nowhere.

**Now.** An incident (med error, fall, wrong-site near-miss) is
captured in a paper form or a separate risk-management portal.
PULSE doesn't see it.

**Why it matters.** Incidents are the single highest-signal
feedback loop a hospital has. Every serious hospital is required
by Joint Commission to conduct RCA for sentinel events. If PULSE
owns incident capture, it becomes part of the safety fabric.

**What to do.** `IncidentReport.tsx` — a quick-capture form
(patient, event type, severity, description, involved staff,
witness) triggered from any patient view with a "report incident"
action. Creates an `Incident` record with a unique ID, auto-tagged
to the encounter. Manager-side `IncidentQueue.tsx` triages new
reports, assigns to investigator, tracks RCA phases (immediate
actions → fishbone → causal chain → corrective actions →
verification → closure). Every state change audit-logged.

### T2.31 · Nurse-call + alarm aggregation

**Where.** Nowhere.

**Now.** Nurse call bells live on the Rauland/Hill-Rom system,
telemetry alarms live on Philips IntelliVue, bed exit alarms
live on the bed itself, IV pump alarms live on the pump. A
bedside nurse juggles four distinct alarm streams across four
physical devices.

**Why it matters.** Alarm fatigue kills patients. The Joint
Commission has had "alarm management" as a National Patient
Safety Goal since 2014. Aggregating and intelligently routing
alarms is one of the most-requested hospital features.

**What to do.** `AlarmStream.tsx` — a single unified inbox of
alarms from all bound sources. Each alarm: source system,
urgency, patient, bed, message, age, ack state. Ack-all, ack-
by-type, snooze, escalate actions. Route alarms to the
assigned nurse first, then escalate to charge if no ack in
the configured window. Mute rules per source/severity (with
audit and physician-order requirement for overrides).

### T2.32 · Consent + advance directives

**Where.** Nowhere.

**Now.** Procedure consents, informed consent forms, POLST
forms, and advance directives live on paper in the chart
folder or in Epic's media tab.

**Why it matters.** If PULSE can surface "this patient has a
POLST, do not intubate" at the moment of decision, it can
prevent the single most common end-of-life error in US
hospitals — intubating a patient who explicitly refused
intubation.

**What to do.** `ConsentPanel.tsx` on the patient detail — a
list of active consent documents with type, signed-by, date,
expiration, and a "view document" button (surfaces a stored
PDF if one exists). Advance directives prominently displayed
at the top. Code status is derived from the POLST if present
and matches with the code status on the patient banner.

### T2.33 · Social determinants strip

**Where.** Nowhere.

**Now.** PULSE has no view of whether the patient has housing,
food security, transportation, interpreter needs, or caregiver
support.

**Why it matters.** Social determinants of health drive more
outcome variance than clinical factors in most populations. A
discharge plan for an unhoused patient is completely different
from one for a patient with stable housing. Case managers and
social workers need this surface.

**What to do.** `SDOHStrip.tsx` — a 6-chip row on the patient
detail: housing (stable / unstable / unhoused), food security
(yes / risk / no), transportation (yes / no), interpreter
needed (language code), caregiver at home (yes / no), utilities
secure (yes / no). Based on the Accountable Health Communities
Screening Tool from CMMI. Tap any chip to update. Flagged
items trigger a case-management referral task automatically.

---

## T3 · Polish — operators will feel these

### T3.1 · Keyboard shortcuts that actually work

**Where.** `App.tsx` line 175: `{ id: Tab.HORIZON, icon: Activity,
label: 'Horizon', code: 'H' }`. The `code` field is rendered next to
each tab label. There is no `addEventListener('keydown', ...)` anywhere
in the file.

**Now.** The UI *advertises* shortcuts (`[H] Horizon`, `[L] Live Ops`)
but pressing H does nothing. This is a promise the app breaks every
time a power user tries to use it.

**Why it matters.** Power users are exactly the people who matter most
— the Operations Director who lives in PULSE for 12 hours. Every
extra click is friction. Advertised-but-broken is worse than
not-advertised.

**What to do.** One `useEffect` in App.tsx, one `switch` statement,
done in 10 minutes:
```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return; // don't hijack inputs
    if (e.metaKey || e.ctrlKey) return;
    switch (e.key.toLowerCase()) {
      case 'h': setActiveTab(Tab.HORIZON); break;
      case 'l': setActiveTab(Tab.LIVE_OPS); break;
      case 'a': setActiveTab(Tab.ACTIONS); break;
      case 'p': setActiveTab(Tab.PLAYBOOKS); break;
      case '?': setShowShortcuts(true); break;
      case 'escape': setShowChat(false); setShowMenu(false); break;
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```
Add a `?` modal that lists all shortcuts. Matches the tactical
aesthetic perfectly — "press ? for help" is peak Palantir.

### T3.2 · Lazy-load each tab

**Where.** `components/MobileView.tsx`. All five tab bodies (dashboard,
tasks, patients, alerts, comms) are mounted at once and hidden with
`activeTab === 'dashboard' &&`.

**Now.** Opening the app mounts every tab's entire component tree
up front. Patient list hits the mock registry even if you never
switch to patients. Alerts tab renders its whole timeline.

**Why it matters.** Two reasons: (1) wasted renders on cold start,
(2) any bug in a tab you're *not* looking at still crashes the whole
screen. React 19 + Suspense makes the fix elegant.

**What to do.** This works beautifully *after* the T2.1 split.
Each tab becomes `const TasksTab = lazy(() => import('./TasksTab'));`.
Wrap the tab router in `<Suspense fallback={<TabSkeleton />}>`.
The `TabSkeleton` is a 20-line component that renders the section
headers and gray placeholder cards — matches the real layout so
there's no reflow when the real content loads. Combine with T3.3
for a finished feel.

### T3.3 · Loading skeletons, not blank screens

**Where.** `components/BriefMe.tsx` has a loading state but it's a
spinner + "Synthesizing metrics for Sarah Chen…". Every other
component renders whatever it has, even if the realtime layer says
we're disconnected.

**Now.** On a slow network, the dashboard flashes into view 2–3
seconds after the app mounts. Users think the app crashed, tap the
screen, get confused.

**Why it matters.** Perceived performance ≠ actual performance. A
200ms skeleton feels faster than a 100ms blank screen because your
eye has something to lock onto.

**What to do.** One shared `<Skeleton variant={...}>` primitive in
`components/design/`. Variants: `card`, `tile`, `row`, `chart`.
Each mirrors the target component's bounding box with a subtle
scan sweep (we already have `ScanningLine`, reuse it). The
connection hook from `lib/realtime.ts` exposes a `hasInitialData`
flag — every data-driven component shows its skeleton until that
flips true.

### T3.4 · Contrast audit (mostly textDim)

**Where.** `components/design/tokens.ts` lines 34–36:
```ts
textSecondary: '#A3A3A3',  // ~8:1  — OK
textMuted:     '#525252',  // ~4.6:1 — borderline
textDim:       '#2E2E2E',  // ~1.75:1 — FAIL
```

**Now.** `textDim` is used for timestamps, "SYNC" labels, dashed
separator text. At `#2E2E2E` on `#050505`, it's essentially invisible
against the background — we've been *relying* on the fact that it's
hard to read as a visual hierarchy tool.

**Why it matters.** Hospital operators are frequently tired, often
in variable lighting, and sometimes on older/scratched iPads.
`textDim` is a crutch that looks sophisticated on my perfect monitor
at 11am and illegible at 3am on an older screen.

**What to do.** Three-step fix:
1. **textDim → `#5A5A5A`.** Contrast ratio jumps to ~4.5:1 (WCAG AA
   for normal text). Still visibly dimmer than `textMuted`, still
   reads as "secondary information", but *legible*.
2. **textMuted → `#707070`.** Contrast ratio ~6:1, comfortably AA.
   Small loss of sophistication, real gain in usability.
3. **Run axe DevTools on every tab.** Fix anything flagged as
   critical. Most will be trivial (missing `aria-label` on icon
   buttons).

### T3.5 · Accessibility: the easy 80%

**Where.** Grep for `aria-label` returns ~10 instances across 1743
source files. Most icon buttons are bare.

**Now.** Screen reader users can't navigate the app. Most icon-only
buttons (hamburger, close, copy, chat launcher) read as "button" with
no label.

**Why it matters.** Hospital compliance ≠ optional. WCAG 2.1 AA is
the baseline for any medical software sold in the US or EU. Also:
some operators have low-vision assistive tech at home and expect it
to Just Work at the hospital.

**What to do.** Focus on the bottom 80% that's cheap:
1. **Every icon button gets `aria-label`.** ~30 instances across all
   files. One afternoon.
2. **Every tab button gets `role="tab"` + `aria-selected`.** Already
   mostly there — just needs the missing attributes.
3. **Heading hierarchy.** Replace `<span>` section titles with `<h2>`
   where semantically appropriate. Our `<SectionTitle>` primitive
   can wrap a `<h2>` by default.
4. **Skip-to-main link.** Fixed position, only visible on focus.
   5 minutes of work, required for every WCAG audit.
5. **Focus trap in modals.** Already mostly works by accident, but
   audit `ChatAssistant`, `ShiftHandoffModal`, `PlaybookActivation`.

Skip the last 20% (full screen-reader flow testing, high-contrast
mode toggle) until we have a real user who needs it.

### T3.6 · Toast queue, not single-slot

**Where.** `App.tsx` line 88: `const [toast, setToast] = useState<Toast
| null>(null)`. Single slot — new toast replaces old one immediately.

**Now.** Nurse marks action complete → success toast. Immediately
flips divert status → *new* toast replaces the first one before the
user's eye has found it. The first confirmation is lost.

**Why it matters.** Users develop a "did the system hear me?" anxiety
that mutates into double-taps, which trigger *more* toasts, which
compound the problem.

**What to do.** Toasts become an array of `{ id, message, tone,
createdAt }`. Render up to 3 stacked in the corner, newest on top.
Each auto-dismisses after 3s. Adding a 4th pushes the oldest out.
Zustand slice makes this a 20-line implementation.

### T3.7 · 24-hour clocks + explicit timezone labels

**Where.** Multiple places in `MobileView.tsx` render `2:14 PM`.
`ActionBoard` uses `14:05`. `ShiftHandoffModal` uses local time
with no TZ label.

**Now.** The app mixes 12h and 24h formats and never labels the
timezone. A patient transfer at "14:05" reads as 2:05pm in one
timezone and 3:05pm in another if the receiving device is on a
different setting.

**Why it matters.** 24-hour clocks are the clinical standard. Every
paper chart, every Epic screen, every paging system uses 24h.
Mixing formats breaks muscle memory and introduces one-hour errors.
Not labeling the TZ introduces 1–24 hour errors across regions.

**What to do.** Three pieces:
1. **All clinical timestamps 24h.** `lib/clock.ts` wraps every
   date-format call site: `formatClinicalTime(d) → '14:05'`,
   `formatClinicalDateTime(d) → '2026-04-11 14:05 CDT'`. Grep
   for every `toLocaleTimeString` and `getHours` — route them all
   through one helper.
2. **TZ label on every display.** The top HUD strip shows the
   hospital's canonical TZ (`CDT`). Every timestamp in the UI
   carries that TZ unless explicitly local.
3. **Print template respects both.** The patient banner print
   stylesheet renders timestamps with full `YYYY-MM-DD HH:mm TZ`
   so a printed chart snippet is legible without context.

### T3.8 · Coded chips (SNOMED / LOINC / RxNorm / ICD-10)

**Where.** Problem list, results, orders, meds will render display
strings ("Chest pain", "Troponin I", "Amoxicillin"). The
underlying codes are invisible.

**Now.** The codes are the interoperability handle. Without them,
two instances of "Chest pain" from different sources can't be
reliably linked. Clinicians also use the codes as a disambiguator
("R07.9 unspecified chest pain" vs "I20.9 angina").

**Why it matters.** Real interop lives on codes, not on strings.
The day we plug into a FHIR endpoint, every clinical shape will
come with a code alongside the display. Making the code visible
from the start trains the eye and makes bugs obvious.

**What to do.** Every clinical `BracketLabel` chip gets a
`<Mono tone="dim" size="xs">` code suffix: `[CHEST PAIN] <R07.9>`,
`[TROPONIN I] <LOINC 49563-0>`, `[AMOXICILLIN] <RXNORM 723>`. On
a narrow mobile viewport the code hides; on tap the code reveals
in a tooltip. Zero design cost, huge credibility signal to any
clinician who reads the app.

### T3.9 · Patient banner print template

**Where.** Nowhere. No print stylesheet exists.

**Now.** If someone hits cmd-P on the patient detail, they get the
full tactical UI with dark backgrounds and tiny mono labels on
white paper.

**Why it matters.** Printing a patient banner is the single most
common print operation in a hospital — it's stapled to paper
forms, attached to EMS handoffs, clipped into the front of paper
charts. A print output that looks terrible is a credibility hole.

**What to do.** `@media print` stylesheet in the global CSS:
- Force white background, black ink.
- Hide all chrome (HUD strips, nav, tabs, modals).
- Render the patient header strip + encounter info + code status
  + allergies + current problem list + active meds in a legible
  paper layout with sans serif.
- Include the hospital logo, the MRN, the timestamp, and the
  printer's user ID in the footer.
- A "print banner" button in the patient header for explicit
  triggering.

### T3.10 · Typography tuning — eventual modest bump

**Where.** `components/design/tokens.ts` (`TYPE` + `CHROME`) and
hardcoded `fontSize: N` / lucide `size={N}` literals across 50 files.

**Now.** As of 2026-04-17 evening, sizing is at the **pre-bump
baseline**:

| Tier      | Current (baseline) | Approx future target |
| --------- | ------------------ | -------------------- |
| monoXs    | 11                 | 12                   |
| monoSm    | 12                 | 13                   |
| mono      | 13                 | 14                   |
| bodySm    | 14                 | 15                   |
| body      | 16                 | 17                   |
| h4        | 17                 | 19                   |
| h3        | 21                 | 23                   |
| h2        | 26                 | 28                   |
| h1        | 34                 | 37                   |
| displaySm | 48                 | 52                   |
| display   | 64                 | 70                   |
| headerH   | 56                 | 60                   |
| footerH   | 36                 | 40                   |
| mobNavH   | 64                 | 72                   |

The "future target" column is roughly the morning's Pass-1 state
(commit `e0748d4`, later reverted in `c81bb68`). Nick flagged Pass-1
as "still too tiny" at the time, but on reflection the baseline
feels right today and the Pass-1 values are close to where a future
modest nudge might land. This is a reference point, not a
commitment — don't apply unless a specific surface reads too small
in actual use.

**Why it matters.** We burned three commits today learning that
global typography bumps have a very narrow tolerance window. The
Pass-1 → Pass-2 → revert-to-Pass-1 → revert-to-baseline sequence
is documented in `docs/decisions.md` (2026-04-17 entries).

**What to do — when the time comes:**
1. **Don't do another global multiplier.** The evidence says ±10-15%
   lands outside the tolerance band.
2. **Target the actual offender.** If a specific surface reads small
   (chart axis labels, ticker copy, EMS inbound labels), bump *that
   surface's* inline `fontSize` rather than the token.
3. **If it genuinely is global, do it in single-px steps.** Apply
   the table above by lifting each tier by exactly 1-2px (not a
   percentage). Review between each pass, not after all of them.
4. **The `TYPE` comment in `tokens.ts` mentions this history** —
   update it if the bump happens so the next contributor doesn't
   repeat the loop.

### T3.11 · Scale the bracelet pool beyond 20

**Where.** `lib/braceletPool.ts` → `POOL_SIZE` (runtime pool size),
and `scripts/export-bracelets.mjs` → `POOL_SIZE` + `BATCH_WORDS`
(offline SVG generator, the only place bracelet artwork lives now).

**Now.** The pool is hardcoded to 20 slots. Every generated bracelet
SVG embeds "№ / 20" and "batch of twenty" into the ink. **Physical
paper bracelets are a moment-in-time snapshot** — the "batch of twenty"
label will stay on bracelets 01–20 forever, regardless of code changes.

**Why it matters.** If a future event needs more than 20 guests
(SCAD-plus, a different campus, a bigger donor demo), bumping
POOL_SIZE to 25 without reprinting 01–20 gives you an inconsistent
batch: slots 01–20 labeled "batch of twenty", slots 21–25 labeled
"batch of twenty-five". Ugly and confusing for the demo audience.

**What to do — when the time comes:**
1. Bump `POOL_SIZE` in `lib/braceletPool.ts` to the new count.
2. Bump `POOL_SIZE` in `scripts/export-bracelets.mjs` to match.
3. Add the new count to `BATCH_WORDS` in `scripts/export-bracelets.mjs`
   (digits fallback works but looks off — "batch of 25" vs "twenty-five").
4. Run `npm run export:bracelets` to regenerate standalone SVGs in
   `../pulse-collateral/bracelets/current-v8/generated/`.
5. **Reprint every physical bracelet**, including 01–20. Don't mix
   old and new paper.
6. If any device has a cached 20-slot pool in memory from a prior
   session, broadcast a reset after rollout so 21–N appear.

Full per-file checklist is duplicated in the `POOL_SIZE` comment of
`lib/braceletPool.ts` — the canonical copy. Update it there if the
steps change.

---

## T4 · Bets

### T4.0 · 3D "Live Floor" drone view — DEAD, RESURRECTABLE

**Status.** Killed 2026-04-30 after three rebuild attempts.
See `docs/decisions.md → "Killed the 3D Live Floor drone view"` for
the autopsy. Visuals were rated "very bad" by Nick on every pass.

**Original idea.** Anduril-flavored top-down 3D model of the hospital
floor: extruded walls, color-coded beds by state, EMS arrivals as
moving glowing dots, scenario severity tinting the lighting, drei
`OrbitControls` for user rotation. Mounted as a windowed modal.

**Why it failed.** Procedural geometry built from primitives (boxes,
cylinders, capsules) lands in an uncanny valley between schematic
and rendered. Looked like a low-poly toy, not a hospital. Three
fidelity bumps (wall thickness, identity markers, furniture,
lighting) couldn't escape that.

**What was right.** The data wiring is sound and reusable: scenario
severity tinted the ambient light, `useEmsInbound` drove moving
dots toward the ambulance bay, bed states drove emissive headboard
panels with critical-acuity pulse animation, ward placement was
mapped against the real `BedUnit` ids. If you revisit this idea,
the *rendering layer* is what needs to change, not the data layer.

**What to do if we revisit.**

1. **Buy or commission a real model.** Load a GLTF/GLB hospital
   floor plan from Sketchfab Pro, an ArchViz pack, or a paid
   modeller. Map our `BedUnit` data onto named meshes via
   `gltf.scene.getObjectByName('ICU-1')` and only modify
   color/emissive based on bed state. This is the most likely
   path to "actually looks like a hospital."

2. **2D isometric SVG.** Skip 3D. Render the floor plan as a
   top-down SVG with a CSS `transform: rotateX(60deg)` and you
   get a sharp architectural-drawing aesthetic without uncanny
   valley. Cheaper, more legible, easier to label, no WebGL
   bundle cost.

3. **Skip floor visualization entirely.** Double down on the
   existing 2D Bed Board grid and use motion accents to express
   live state changes. The EMS auto-brief already covers the
   "demo magic moment" the drone view was supposed to provide.

**What was deleted.** `components/BedDroneView.tsx`, the modal +
launcher state + button in `components/PulseHorizon.tsx`, the
`Radar` lucide import, and three npm deps: `three`,
`@react-three/fiber`, `@react-three/drei` (~1MB gzipped reclaimed).
Git history has the working code at commit `63e4802` if you ever
want to read the geometry choices.

---

### T4.1 · Gemini-generated surge tasks (context-aware)

**Where.** `lib/surgeTaskTemplates.ts` — 5 hardcoded tasks, cloned
identically every surge activation. The comment says "trivial to swap
for Gemini-generated content later."

**Now.** Activating surge always produces the same 5 tasks, regardless
of current census, staffing, or weather. "Open overflow bay in Hall C"
is generated even if Hall C is already full.

**Why it matters.** A surge playbook that's the same every time is a
checklist. A surge playbook that adapts to *this* hospital at *this*
moment is a decision support system.

**What to do.** Two phases:
1. **Deterministic ruleset** (1 week). A `lib/surgePlaybook.ts` that
   reads live state (zones, staffing, weather, EMS inbound) and
   selects tasks from a library. No AI, just if/then. Gets us most
   of the way.
2. **Gemini augmentation** (2 weeks). On surge activation, call
   Gemini with the current state as structured input + a prompt
   like "You are an ED surge coordinator. Given these conditions,
   return 5 concrete 90-second tasks ordered by impact." Cache by
   state hash for 5 minutes. Fall back to phase-1 rules if API fails.

Ship phase 1 first — it's useful standalone and provides the baseline
the AI augments, not replaces.

### T4.2 · Push notifications for critical events

**Where.** `lib/notifications.ts` — only `@capacitor/local-notifications`,
no push. `package.json` has no FCM or APNs plugin.

**Now.** If the app is backgrounded, nothing reaches the operator.
Nurse closes PULSE to check Epic → surge activates → nurse finds out
when they switch back 10 minutes later.

**Why it matters.** The most important alerts are the ones that
arrive when you *aren't* looking at the app. A surge dashboard that
requires attention to deliver alerts is a contradiction.

**What to do.** `@capacitor/push-notifications` + Firebase Cloud
Messaging (works on iOS via APNs bridge). Trigger a push on
`setSurgeState(true)` and on any `critical`-priority task assigned
to the current user's role. Rich notifications with "Acknowledge"
and "View" actions so the user can resolve from the lock screen.
Backend needed: a lightweight notification dispatcher that reads
the Supabase broadcast stream and fans out to FCM.

### T4.3 · Server-side incident recording + replay

**Where.** `components/Replay.tsx` exists (646 lines) but is a mock
replay of a canned incident.

**Now.** There's no way to replay an actual past incident because
nothing is recorded. The Replay component renders a scripted
timeline from a static fixture.

**Why it matters.** After-action review is the single highest-value
use of this kind of dashboard after the incident itself. "What did we
see at T+12 minutes? Why did we wait until T+18 to activate surge?"
You can only answer that if everything was recorded.

**What to do.** Append every state mutation and every operator action
to a time-series log on the server (Supabase has this out of the box
via row inserts with timestamps). The Replay component fetches a
given incident by ID and plays back the state transitions. Controls:
play/pause/scrub/speed. This is a 2–3 week build but it unlocks
training, compliance, and post-mortem use cases simultaneously.

### T4.4 · Crash reporting + session replay

**Where.** No Sentry, no DataDog, no Rollbar, no LogRocket. Exceptions
go to `console.error` which is invisible in production.

**Now.** When PULSE crashes on a tired nurse's iPad at 03:40, we learn
about it when she emails IT Monday morning. If she emails at all.

**Why it matters.** Silent failures compound. Our refactors get harder
because we can't measure their impact. New features ship without a
feedback loop.

**What to do.** Sentry has a free tier that's enough for a single
hospital's usage. `@sentry/react` + `@sentry/capacitor`. Wrap the root
component in an `<ErrorBoundary>` that reports to Sentry and shows a
tactical-styled fallback ("SYSTEM FAULT · ER-01 · Reload"). Add
performance monitoring to catch slow tab switches. Keep `replaysSessionSampleRate`
low (1%) for privacy — PHI cannot leave the device — but sample 100%
of error sessions for debugging.

### T4.5 · Voice input for hands-full situations

**Where.** `components/ChatAssistant.tsx` is text-only.

**Now.** A trauma attending in the middle of a code has both hands
occupied. Typing into the chat is impossible. Speaking to a tablet
on the wall is trivial.

**Why it matters.** The gap between "a dashboard I look at" and "an
operating surface I talk to" is the difference between a decision
support tool and a team member. Voice is the natural modality for
hospitals — everything else there already is (rounding, handover,
code calls).

**What to do.** `SpeechRecognition` API on web, `@capacitor-community/speech-recognition`
on iOS. A microphone button in the ChatAssistant header. Push-to-talk
(hold to record) not always-on — privacy matters and we don't want
to capture background PHI. Transcribe to text, send through the
existing Gemini pipeline. Read responses back via `SpeechSynthesis`.
This is a 1-week build and it's the most demo-able feature in the
whole product.

### T4.6 · Role-appropriate alert fatigue reduction

**Where.** `lib/haptics.ts` always fires the same intensity. Toasts
always show for 3s. Every critical task is equally loud.

**Now.** During a 4-hour surge, every operator's device is buzzing
and flashing constantly. Alert fatigue sets in around minute 30. By
minute 90, operators are ignoring everything.

**Why it matters.** The alerts that matter most are the ones nobody
is listening to anymore. Medical alert fatigue is a documented cause
of patient harm — the literature is clear and brutal.

**What to do.** Server-controlled alert intensity. The surge state
grows a `hapticIntensity: 'high' | 'medium' | 'low'` field. For the
first 15 minutes of a surge, everything is high. Then it decays:
medium for the next 45, low thereafter. Critical alerts (code blue,
new trauma activation) always reset to high. Every role has different
thresholds — the Charge Nurse gets quiet alerts for things the Trauma
Attending gets loud alerts for, and vice versa. This is as much a
design problem as a tech problem, but it's the single most empathetic
thing we could do for the people who use this at 3am.

### T4.7 · Patient-facing companion (portal + tele-visit)

**Where.** Nowhere. PULSE is exclusively a clinician tool.

**Now.** Patients have no visibility into their own care while
admitted. They don't know their next scheduled med, their pending
labs, their expected discharge time, or who their attending is.

**Why it matters.** Hospital Consumer Assessment (HCAHPS) scores
are tied to reimbursement. Patient experience is measured and
graded. A patient-facing companion that answers "what's happening
to me" is one of the highest-leverage HCAHPS interventions and is
conspicuously missing from most EHRs.

**What to do.** Separate mobile surface (`/patient` route or a
separate Capacitor target) with read-only views: my care team, my
next med, my schedule, my providers, my visitors list, secure
messaging to the care team. No clinical inputs from the patient
side — read-only + messaging — to keep liability surface minimal.
Room-specific QR code on the bedside tablet logs the patient in
with a signed short-lived token.

### T4.8 · Tele-visit capability

**Where.** Nowhere.

**Now.** Specialist consults happen by phone or paging. Family
conferences happen in person. Neither scales for a busy ED.

**Why it matters.** Tele-consults have been the biggest growth
area in EHR vendor roadmaps post-COVID. Epic, Cerner, and
Allscripts all ship a tele-visit module.

**What to do.** Integrate Twilio Video (or Daily.co) as a per-
patient room. One-tap "start video consult" from the patient
header. Consult participants join with a signed link. Session is
logged (not recorded — PHI) and attached to the encounter as a
`Note` of type `teleConsult`.

### T4.9 · Localization for multi-language hospitals

**Where.** Every string is English inline literal.

**Now.** PULSE ships only in English. A hospital with a large
Spanish-speaking or ASL-interpreter-dependent staff cannot deploy
it.

**Why it matters.** Most large US hospitals have bilingual staff
and run parts of the patient-facing UI in ≥2 languages. Compliance
with Title VI of the Civil Rights Act requires meaningful
language access.

**What to do.** `lib/i18n.ts` with `formatMessage(key, vars)`.
Route every user-facing string through it. Default locale is
`en-US`. Add `es-US` as a second locale, translated via a
translator (not auto-MT) for clinical terminology. On login,
pick locale from the user profile. Clinical codes stay in
English even when the locale is Spanish (the LOINC code is
the same in every language — only the display string
translates).

### T4.10 · Drug-drug and drug-allergy interaction engine

**Where.** Nowhere.

**Now.** If a physician orders an ACE inhibitor for a patient
with a known angioedema history, PULSE doesn't warn. If a
patient on warfarin is about to get a stat dose of ibuprofen,
PULSE doesn't warn. These are the exact interactions that cause
inpatient harm.

**Why it matters.** Every serious EHR ships Epic Willow, Cerner
Multum, or First Databank integration for interaction checking.
It's a category-defining feature — you cannot be "the bedside
surface" without it.

**What to do.** License First Databank or RxNorm + NLM's
RxNav API. When a new med order is placed, run the active med
list + allergies through the interaction engine. Severity
tiered: contraindication (hard block), major (override-with-
reason), moderate (warn), minor (info). Every override is
audit-logged with the reason. This is a 2–3 week integration
but it's the single biggest clinical-safety upgrade on the list.

**Prototype status (2026-05-08).** Deferred. Not buildable in
prototype scope — the engine is licensed (First Databank is paid +
contract), or wrapped around NLM's free RxNav API which needs
backend infrastructure PULSE doesn't have. Also depends on
medication-ordering and allergy-entry surfaces that are themselves
deferred (T1.7 allergies, T2.13 MAR, T2.14 orders panel). Worth
mentioning in pitches as a category-defining feature PULSE will
obviously ship — don't build it now.

### T4.11 · RTLS patient + staff location feed

**Where.** Nowhere.

**Now.** "Where is Dr. Rostova right now?" is answered by calling
her cell phone. "Which patient just left bed 4?" is answered by
a nurse walking down the hallway.

**Why it matters.** CenTrak and Stanley STANLEY Healthcare ship
RTLS badges that report location every 1–5 seconds. Hospitals
that deploy RTLS get 20–30% throughput improvements. The app
that surfaces the RTLS feed becomes the canonical "where is
anything" tool.

**What to do.** When (if) a hospital has RTLS, subscribe to the
feed over websocket. Render a live facility map with dots for
every badged asset. Patient dots, staff dots, equipment dots
(crash cart, portable ultrasound, telemetry packs). Tap a dot
for details. Filter by role. Alert on bed-exit events from
patients flagged high-fall-risk.

### T4.12 · IoT vitals streaming

**Where.** Nowhere.

**Now.** Vitals are entered manually. Philips IntelliVue
monitors at the bedside are streaming continuously but PULSE
never sees the stream.

**Why it matters.** Continuous streaming vitals → continuous
early warning score computation → alert 30–60 minutes earlier
than spot checks alone. The literature is clear: continuous
vital monitoring + automated EWS reduces rapid-response calls
and saves lives.

**What to do.** Philips IntelliBridge + Capsule Medical's
integration platform both expose vitals as HL7 v2 over IP.
Subscribe to the feed for each monitored patient, write each
observation to the patient vitals history, recompute MEWS/NEWS2
on each. Render a live breadcrumb trail on the patient chart
so the clinician can see "SpO2 fell from 97% to 89% over the
last 40 minutes" at a glance.

---

## Not doing (for now)

Things I considered and rejected, so we don't re-litigate them:

- **Redux / Redux Toolkit.** Zustand does everything we need in 1KB.
  Redux is ceremony tax for our scale.
- **CSS Modules migration.** The inline-styles-with-design-tokens
  approach is working. Migration cost > benefit at current size.
  Revisit if `components/design/` tokens stop being enough.
- **Storybook.** Component catalog is nice-to-have; with 20
  components and no external consumers, the ROI isn't there. Add
  it if/when the design system needs to ship externally.
- **i18n.** Single-hospital deployments are English. Adding react-intl
  now is premature — add when a second locale is on the roadmap.
- **Dark mode toggle.** Already dark-by-design. Light mode would
  require rebuilding the entire color palette and visual language,
  and tactical HUDs don't do light mode.
- **Full CRDT** (Y.js / Automerge) for the action board. Overkill for
  our data shapes. Versioned optimistic updates (T1.3) handle 95%
  of real conflicts at a fraction of the complexity.

---

## Suggested sequencing

If I had two engineers for two months:

**Weeks 1–2.** T2.2 (strict TS), T2.7 (kill orphan dep), T3.1
(keyboard shortcuts), T3.6 (toast queue). Easy wins, zero risk, huge
morale boost. Ships immediately. 1 engineer.

**Weeks 1–3.** T2.1 (split MobileView) — mechanical refactor, runs
in parallel with the easy wins. 1 engineer.

**Weeks 3–5.** T1.2 (data contract + adapter), T2.5 (unify MetricTile
et al). The data contract is the hardest thing on this list — start
here so bugs have time to surface. Both engineers.

**Weeks 5–7.** T1.3 (versioning + conflict), T2.3 (offline outbox),
T2.6 (code splitting). All three are adjacent to the data contract
and build on it. Both engineers.

**Weeks 7–8.** T1.4 (tests, starting with smoke layer), T1.1 (auth —
requires backend work). 1 engineer on tests, 1 on auth.

Everything in T3 can be slotted as intermission work between the
bigger T1/T2 items. T4 bets are roadmap candidates, not sprint work.

## Clinical-feature build order (gap-analysis wedges)

Once infrastructure is stable, the clinical features (T1.5–T1.10,
T2.8–T2.33) ship in waves by leverage:

**Wave A — Patient identity and clinical data model.**
T1.5 (clinical types), T1.7 (code status + allergies + isolation
banner), T2.11 (vitals capture + trending), T1.8 (MEWS/NEWS2/qSOFA),
T2.15 (problem list), T2.14 (results inbox + orders). This wave
transforms the patient detail view from a decorative list into a
working chart surface. Everything in subsequent waves depends on
this being solid.

**Wave B — Triage and flow.**
T1.9 (ESI triage), T2.9 (mutable bed board), T2.10 (EMS incoming
board), T2.17 (discharge queue), T2.18 (throughput dashboard).
Turns PULSE into a command-surface for ED flow.

**Wave C — Communication and audit.**
T1.6 (immutable audit log), T2.8 (role-based messaging), T2.20
(on-call directory), T2.31 (alarm aggregation), T2.16 (SOAP /
I-PASS handoff). Safety and communication fabric.

**Wave D — Role-specific surfaces.**
T2.24 (Charge Nurse assignment), T2.25 (ER Physician track board),
T2.26 (Trauma activation), T2.27 (Manager KPI cockpit). Each role
gets a purpose-built operating surface.

**Wave E — Compliance and integration.**
T1.10 (PHI masking + session lock), T2.22 (FHIR adapter), T2.23
(HL7 ADT viewer), T2.19 (integration health dashboard), T2.32
(consent + advance directives). The "enterprise ready" wave.

**Wave F — Operational intelligence.**
T2.28 (bed demand forecast), T2.29 (staff supply/demand), T2.30
(incident + RCA), T2.12 (flowsheet / I&O), T2.13 (MAR), T2.21
(insurance), T2.33 (SDOH). The "now it's Epic" wave.

**Backend-dependent items** (T1.1 auth, T4.2 push, T4.3 server
replay, T4.10 drug interactions, T4.11 RTLS, T4.12 IoT vitals)
ship only after the adapter layer (T1.2) lands and we have a
real backend to bind against.

---

## Update protocol

Each entry dies when it's done, with a one-line note in
`docs/decisions.md` explaining *how* we did it (the decision), not
*what* (already here). New ideas get appended to the appropriate
tier. Rejected ideas migrate to the "Not doing" list with a reason.

This file is a living document — don't let it become a graveyard.
