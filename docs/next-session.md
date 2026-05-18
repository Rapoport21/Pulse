# Next Session — To-Do

Created 2026-05-17. Source of truth for the next working session. Items
are in Nick's original numbering. Each carries: **what he asked**, my
**read**, a **category**, **where to look**, and **preliminary notes**
(things I already know from this session's work, so next-session-me
starts ahead instead of re-deriving).

Categories: `INVESTIGATE` · `QUICK FIX` · `BUILD` · `DESIGN+RESEARCH` ·
`AUDIT` · `DISCOVERY`.

---

## 1. Is AI usage free or paid? `INVESTIGATE` (gates 2 / 2.5 / 2.6)

> **✅ RESOLVED 2026-05-17.** Paid (Postpay) but trivial. Whole Google
> Cloud spend all year = $3.99, of which $3.52 was a now-deleted "TEST
> Gemini Project" (not PULSE). PULSE's own project = $0.47 lifetime, now
> ~$0.03/mo on `gemini-3-flash-preview`, server-proxied. Nothing owed
> (3c running tab, auto-pays ~June 1, no action needed). Cleanup done:
> 5 junk projects deleted, only `Pulse` (`gen-lang-client-0199807208`)
> active, its key restricted to Gemini API only, $10 Cloud budget alert
> created ("Pulse $10 monthly cap", emails at $5/$9/$10).

**Asked:** Check if AI activity is actually free or I pay for usage. If
paid → do #2.

**Read / where to look:** The Gemini key is an AI Studio key
(`GEMINI_API_KEY`, server-side only in Vercel). AI Studio keys have a
free tier *and* an optional paid tier — it bills only if billing is
enabled on the underlying Google Cloud project tied to the key.

**Preliminary notes:**
- Need to check the Google account: aistudio.google.com → API key →
  see if it's "Free tier" or has a linked billing account. Also check
  Google Cloud billing for the project the key belongs to.
- If FREE tier only: usage can't cost money (it rate-limits instead).
  Then #2/#2.5/#2.6 become "nice to have," not urgent.
- If billing enabled: proceed to #2 + set a budget alert (I can drive
  Chrome for the budget-alert page; Nick does the Google sign-in).
- Model is `gemini-3-flash-preview` everywhere now (cheap), key is
  server-proxied. Both already cost-minimising.

## 2. Background AI usage drain? `INVESTIGATE`

> **◑ Corroborated 2026-05-17 (not yet formally grepped).** Google Cloud
> shows only ~21 Gemini requests/day, all user-initiated, none on a
> timer. Strongly consistent with the preliminary finding (no background
> drain). Still worth the explicit `createGeminiClient` / `/api/gemini`
> grep next session to close it formally.

**Asked:** Check if there's background AI activity draining usage (e.g.
the AI recommendations in the Alerts tab).

**Preliminary finding (HIGH CONFIDENCE — verify, don't assume):**
There is currently **no background Gemini usage**. Specifically:
- `lib/pulseAI.tsx` (the PULSE.AI activity feed powering the Alerts /
  Staffing / Actions "AI activity" panels) is a **pure client-side
  mock** — a `setInterval` every ~12s that cycles canned events. It
  makes **zero network / Gemini calls**.
- The proactive chat opener built this session is **deterministic**
  (composed from a local snapshot, zero tokens).
- The ONLY Gemini calls are user-initiated: sending a chat message in
  `ChatAssistant`, and the "generate" action in
  `StaffManagementModal`. Nothing fires on a timer or in the
  background.

**Action next session:** confirm the above by grepping for
`createGeminiClient` / `/api/gemini` call sites and confirming none sit
in a `setInterval`/`useEffect`-on-mount that auto-fires. Then report
"confirmed: no background drain" or fix whatever is found.

## 2.5 Where is AI data stored? `INVESTIGATE` / document

> **✅ ANSWERED + CHANGED 2026-05-17.** Was: nowhere persistent. Now (via
> #2.6): the AI transcript persists to `localStorage['pulse-ai-memory-v1']`
> (last 40 messages, on-device only) and demo/app state to
> `localStorage['pulse-state-v1']`. Nothing AI is written to Supabase or
> disk; no server-side storage. Gemini still reads live ops fresh per
> message via `getRealtimeStateSnapshot`. Wipe: Settings "Reset & Wipe
> Memory" clears both keys.

**Preliminary answer (pre-2.6, historical):** Nowhere persistent today.
- Chat conversation = React `useState` in `ChatAssistant` — wiped when
  the chat is closed / app reloads.
- The "live ops" the AI reads = pulled fresh each message from
  realtime state (`getRealtimeStateSnapshot`) — not stored *for* the
  AI, just read at query time.
- `lib/pulseAI.tsx` events = in-memory React state, regenerated each
  load.
- No AI memory, transcripts, or learned state is written to disk,
  localStorage, or Supabase.

Document this clearly for Nick next session, then → 2.6.

## 2.6 Cross-session memory + wipe control `DESIGN+RESEARCH` → `BUILD`

> **✅ DONE 2026-05-17 (commit 63e0a2e).** Built `lib/persistence.ts`
> (guarded/debounced localStorage, `beforeunload` flush). `lib/realtime.ts`
> hydrates `store.cache` + Lamport versions at module init so
> `useRealtimeState` restores with zero component changes. ChatAssistant
> rehydrates the transcript (full history already goes to Gemini so model
> memory is restored for free). Settings reset is now a full memory wipe,
> relabelled "Reset & Wipe Memory". Supabase-table version intentionally
> deferred (see `docs/decisions.md` 2026-05-17). Both memory concepts
> (app-state + AI) shipped.

**Asked:** Can we create memory so changes are saved across sessions?
Best way to do it? With an option to restart / wipe the memory.

**Read:** Two separate "memory" concepts to scope:
  a. **App state memory** (the demo state: scenario, surge, bed
     changes, acknowledged tasks) persisting across reloads.
  b. **AI memory** (the assistant remembering prior conversation /
     decisions across sessions).

**Preliminary direction:**
- Supabase is **already connected** (project `pulse-demo`,
  `oqwmgynvvswtjknusmvy`) and is the natural store. `lib/realtime.ts`
  is broadcast+presence only today (no tables). Adding a small
  `pulse_state` table (or a single JSON row per "room") gives durable
  cross-session/cross-device memory.
- Lighter alternative for a demo: `localStorage` snapshot of realtime
  state + a "Reset demo" that clears it (a reset already exists in
  Settings — `resetSimulation`; wire wipe into it).
- AI memory: persist the chat transcript + an extracted "facts"
  summary; re-inject the summary into the system prompt on open.
- MUST include a visible "Restart / wipe memory" control (Settings is
  the right home; there's already a reset there to extend).
- Research the cleanest pattern (Supabase row vs localStorage vs
  IndexedDB) before building; write the plan, then implement.

## 3. Remove PULSE.AI LIVE strip above Horizon graph `QUICK FIX`

**Asked:** Remove the "PULSE.AI · LIVE" activity tab/strip above the
Horizon graph tile.

**Where:** `components/PulseHorizon.tsx` — the `<AiActivityStrip />`
mounted at the top of the LEFT column (added this session, sprint
2026-05-14 item 14). Remove that mount (and the now-unused import).
Keep `AiActivityStrip` exported — it'll be reused by #5/#9.

## 4. Admit button on awaiting patients (Admissions Command Center) `BUILD`

**Asked:** Have an admit button on awaiting patients in the ADMISSIONS
COMMAND CENTER.

**Where:** `components/clinical/AdmitFlow.tsx` — the admission queue /
"awaiting" list (the desktop queue with `queueFilter`). Each
awaiting/pending row needs an inline **Admit** CTA that opens the
admit flow pre-filled for that patient (mirror the bed-board
pending-admit CTA wired in sprint 2026-05-14 item 10).

## 5. Redesign "AI · ALERTS ACTIVITY" → Rehoboam-style `DESIGN+RESEARCH` → `BUILD`

**Asked:** Plan + propose a redesign of "AI · ALERTS ACTIVITY" on
Alerts / Staffing / other pages. Give it a shape — a sphere, or better,
a PULSE-style take on Rehoboam from Westworld.

**Read:** Rehoboam = the large rotating data-sphere AI from Westworld
S3. A "PULSE take" = the tactical-HUD aesthetic (near-black, rose,
Geist mono) rendered as a living sphere/orb that visualises the AI
working — events orbiting / flowing into a core, pulse rings, etc.

**Plan to produce next session (research first, then propose, then
build):**
- Research Rehoboam visual language + good web sphere techniques
  (CSS/SVG orb vs Three.js — note `@react-three/fiber` is already a
  dependency, and `PulseRadiant.tsx` already does a 3D scene; reuse
  that competence).
- Decide: ambient orb that summarises AI activity, with events as
  particles/arcs feeding the core; colour by kind
  (auto/escalated/needs-you).
- Replace the current flat `AiActivityPanel` usage on Alerts +
  Staffing + Actions with the orb (keep a list view accessible).
- Ties tightly to #9 (dedicated AI page is where the full orb lives;
  smaller embedded version on the other pages).
- Respect `prefers-reduced-motion` (static fallback).

## 6. Too much red — visual hierarchy broken `DESIGN+RESEARCH` → fix

**Asked:** There's too much red on pages; can't tell what's important.
Think about it and fix it.

**Read:** Rose/red (`COLORS.accent`, `crit`) is overused — accents,
alerts, dividers, surge, NEEDS-YOU, ESI, etc. all compete, so nothing
reads as truly urgent. This is a known anti-pattern (the design
skills call it out: "single-accent rule"). Needs a deliberate colour-
hierarchy pass:
- Reserve rose strictly for genuinely critical / single most-important
  action per view.
- Demote everything else to neutral greys / muted tones; let numbers
  and weight carry hierarchy.
- Audit every `COLORS.accent` / `COLORS.crit` usage across
  `components/` and reclassify.
Produce a written hierarchy rule, then apply surface by surface.
(There's prior art: the mobile `/distill` pass + `MobileHome` colour-
discipline notes — extend that philosophy app-wide.)

## 7. Default to NORMAL scenario on login `QUICK FIX` / `INVESTIGATE`

**Asked:** See a normal scenario by default on login, not a near-surge
one.

**Where:** The demo intentionally seeds an elevated baseline. Look for:
- `METRIC_BASELINES` in `lib/scenario.ts` (e.g. `nedocsScore` baseline)
  and the `loginCount > 1` "calm vs dangerous" branching that was in
  the old AI mocks + `PulseHorizon` Census/Throughput ("keeps the
  demo's dangerous vibe" comments).
- Goal: first login shows calm/normal numbers; surge/scenario only
  when explicitly triggered. Decide whether to change the baseline or
  the first-login override. Likely a small change in `lib/scenario.ts`
  + remove the `loginCount`-based escalation assumptions.

## 8. Move scenarios into Sim Controls (right sidebar) `BUILD`

**Asked:** Put scenarios in Sim Controls in the right sidebar.

**Where:** `components/CommandSidebar.tsx` has a `simPanelOpen` / sim
controls section. Scenario start/stop currently lives in PulseHorizon's
What-If panel + Settings. Consolidate scenario triggers into the
sidebar Sim Controls so they're one place. Keep `onStartScenario` /
`onStopScenario` wiring (already plumbed through App.tsx).

## 9. Dedicated PULSE Rehoboam AI page `BUILD` (depends on #5)

**Asked:** Create an entire page dedicated to PULSE Rehoboam — only
about the AI.

**Read:** New top-level tab/surface. The full-size Rehoboam orb (#5)
lives here, plus: live AI activity feed, what the AI auto-executed vs
escalated, the chat, AI "memory" (ties to #2.6), confidence/usage. This
is the showcase surface for the AI story in a pitch. Scope after #5's
visual direction is locked. Add to nav (probably under "More" or as a
primary tab — decide with Nick).

## 10. Full list of every dead button `AUDIT` (then a separate build epic)

**Asked:** Create a full list of every button that does nothing; we'll
have a separate large task to make them work.

**Action:** Systematic sweep of `components/` for buttons / clickable
rows whose `onClick` is empty, a no-op, a toast-only stub, or
`console.log`. Produce `docs/dead-buttons.md` — grouped by surface,
each with file:line + what it *should* do. Do NOT fix in this pass;
the list is the deliverable. The fixing is its own future epic.
(Note: sprint 2026-05-14 already fixed the Horizon Command Actions
stubs — exclude those; flag anything still stubbed.)

## 11. Study PULSE and ask improvement questions `DISCOVERY`

**Asked:** A separate task where I study PULSE and ask Nick the
questions that would help me improve it.

**Action:** Deep read of the app (flows, surfaces, the pitch/demo
narrative, the docs in `docs/`). Come back with a tight set of
high-leverage questions — product intent, audience, what "great" looks
like for the pitch, which surfaces matter most, what's mock vs needs to
feel real — so subsequent work is aimed, not guessed. Deliver as a
short question list, not an essay.

## 12. iPad layout is broken: needs a tablet redesign `DESIGN+RESEARCH` → `BUILD` (SEPARATE TASK · do LAST)

**Asked (2026-05-18):** Installed PULSE on the physical iPad (iPad Pro
11", `iPad8,1`). It opens but is **unusable**: layout impossible to
use, things do not fit. Nick: "we need to completely redesign it" for
iPad. Logged, not started.

**Read / why this happens (HIGH CONFIDENCE):** PULSE renders three
surfaces from one bundle, chosen purely by viewport width:
`< 768px` → mobile companion (`components/MobileView.tsx`), `≥ 768px`
→ the **desktop command console**, plus the Capacitor iOS shell. The
iPad (~834pt portrait / 1194pt landscape) lands in the `≥ 768px`
branch, so it gets the **full desktop console**, which was built for a
true desktop: wide viewport, mouse + hover affordances, dense tactical
HUD. On the iPad that overflows, doesn't fit, and isn't touch-sized.
**There is no tablet breakpoint or tablet surface at all.** Also note
CLAUDE.md directive #6: iPad keeps **all orientations** (unlike the
portrait-only iPhone), so any fix must hold in portrait AND landscape.

**Where to look:**
- The viewport→surface switch (the `768` breakpoint / `isMobile`-style
  hook deciding `MobileView` vs desktop console; likely `App.tsx` or a
  shared media-query hook).
- `components/MobileView.tsx`, the desktop console components, and
  `components/design/tokens.ts` (breakpoints, spacing, touch targets).

**Directions to evaluate with Nick (research → propose → build):**
1. **Dedicated tablet surface** — a real iPad layout between mobile and
   desktop (best fidelity, most work).
2. **Make the desktop console responsive + touch-first** down to iPad
   widths (fluid grids, ≥44px targets, kill hover-only affordances).
3. **Route iPad to an adapted, scaled-up "mobile-plus" layout**
   (fastest path to a usable pitch device; lower ceiling).
Decide the approach with Nick before building. **Priority (Nick's
call, 2026-05-18): this is a separate task done LAST — only after
every other backlog item is complete. Not a blocker.** The iPad still
launches the (cramped) desktop console in the meantime; the free
signing just needs a weekly refresh before any iPad demo.

---

## Suggested order for next session

1. **#1** (free vs paid) — gates the urgency of 2 / 2.5 / 2.6. Fast.
   ✅ done 2026-05-17.
2. **#2 + #2.5** — confirm no background drain, document storage. Fast,
   mostly verification of the preliminary findings above.
3. **#3, #7, #4, #8** — the quick/medium fixes (visible wins, low risk).
4. **#10** — the dead-button audit (produces a doc, unblocks a future
   epic).
5. **#6** — the red/colour-hierarchy pass (research → rule → apply).
6. **#5 → #9** — Rehoboam: research + propose the visual direction,
   get Nick's pick, then build the embedded orb (#5) and the dedicated
   page (#9).
7. **#2.6** — cross-session memory (research the pattern, plan, build,
   include wipe control). ✅ done 2026-05-17.
8. **#11** — run in parallel / at the start: study + come back with
   questions to aim everything else.
9. **#12** (iPad redesign) — **separate task, LAST.** Nick's call
   (2026-05-18): do this only after every other backlog item above is
   done. Not treated as a blocker. Research the 3 directions, get
   Nick's pick, then build.

Per `CLAUDE.md` directive #2, every code change auto-ships (Vercel
auto-deploys on push; iPhone rebuilt). Report links each time.
