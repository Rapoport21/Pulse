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

## T1 · Ship-blockers

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

---

## T4 · Bets

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

---

## Update protocol

Each entry dies when it's done, with a one-line note in
`docs/decisions.md` explaining *how* we did it (the decision), not
*what* (already here). New ideas get appended to the appropriate
tier. Rejected ideas migrate to the "Not doing" list with a reason.

This file is a living document — don't let it become a graveyard.
