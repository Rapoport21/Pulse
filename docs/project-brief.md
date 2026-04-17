# PULSE — project brief for Claude

A self-contained context document to hand to any Claude chat (Claude.ai,
the desktop/mobile app, API, another Claude Code session) so it can
talk substantively about this project without reading the repo.

**Last updated:** 2026-04-17

---

## What PULSE is

PULSE is a tactical-HUD operations console for hospital emergency
department workflows. Think Palantir Gotham / Anduril Lattice, but for
the ED charge nurse, the incoming trauma team, and the bed-manager
trying to keep discharge velocity up during a surge.

It's simultaneously:

- A **demo asset** — the build that runs at a SCAD / investor /
  procurement stand, where a fresh visitor needs to see a live,
  reset-able simulation in 10 seconds.
- A **live prototype** — a React 19 + TypeScript + Vite + Capacitor
  (iOS) app maintained by Nick Rapoport with Claude Code as the
  primary build partner.

**Repo:** https://github.com/Rapoport21/Pulse
**Live web preview (GitHub Pages):** https://rapoport21.github.io/Pulse/
**iOS build:** `npx cap open ios` → Xcode → Run on simulator/device.

---

## Stack

- **Frontend:** React 19 + TypeScript (strict), Vite 6
- **Native shell:** Capacitor 8 (iOS only at present)
- **Animation:** `motion/react` (Framer Motion's successor)
- **Iconography:** `lucide-react`
- **Typography:** Geist + Geist Mono
- **Realtime sync:** in-repo `lib/realtime.ts` — BroadcastChannel + a
  localStorage last-writer-wins tiebreak for cross-device demo state
- **Backend:** none. All state is mocked and seeded from `data/`

---

## Design direction (tactical HUD)

- Near-black canvas (`#050505`), sharp corners, monospace data,
  rose-600 accent (`#E11D48`).
- Corner brackets, scanlines, status pills are the signature chrome.
- Accent is scarce — reserved for active, critical, actionable moments.
- Every color, type, spacing, radius, and motion curve lives in
  `components/design/tokens.ts` as the single source of truth.
- Shared primitives (`Mono`, `BracketLabel`, `StatusPill`,
  `CornerBracket`, `HudStrip`, `ScanningLine`, `TacticalCard`,
  `TacticalButton`) live in `components/design/`.

---

## Role hierarchy

Four user types, each gets a tailored mobile surface. **Do not
collapse these into one view.**

1. **Manager** — bed board, workforce coverage, aggregate metrics
2. **Nurse** — assigned patients, tasks, vitals trends
3. **ER Personnel** — alert center, incoming queue, playbook activation
4. **Trauma** — mass-casualty / surge-mode entry point

---

## Repo layout (high-level)

```
App.tsx                       # Top-level shell, routing, realtime wiring
components/
  MobileView.tsx              # Main mobile surface (large — split candidate, T2.1)
  SettingsScreen.tsx          # Session & simulation controls
  PulseHorizon.tsx            # Primary single-viewport dashboard
  ActionBoard.tsx             # Task/alert action center
  BriefMe.tsx, Replay.tsx     # Briefing and shift-replay
  LiveOps.tsx, Playbooks.tsx, Roster.tsx
  ChatAssistant.tsx           # LLM-style operator chat
  CommandSidebar.tsx          # Desktop command palette
  clinical/                   # BedBoard, AdmitFlow, AlertsCenter, WorkforceCoverage
  PatientsPage.tsx            # Patient chart
  design/
    tokens.ts                 # THE design system (px, hex, durations)
    *.tsx                     # Reusable HUD primitives

data/                         # All mock/seed data (bedMock, clinicalMock, userProfiles)
lib/
  realtime.ts                 # Cross-device sync (broadcast + LWW tiebreak)
  haptics.ts                  # Native + web haptic taps
  notifications.ts            # Browser + native surge alerts
  uiScale.ts                  # Opt-in +15% zoom for readability
  surgeTaskTemplates.ts       # Surge-mode task catalog
docs/
  decisions.md                # ADR-style running log, newest on top
  improvement-ideas.md        # Tiered backlog (T1 ship-stopper → T4 nice-to-have)
  project-brief.md            # (this file)
CLAUDE.md                     # Standing directives for Claude Code
```

---

## Current state (as of 2026-04-17)

- Visual direction ("tactical HUD") is locked and tokenized.
- All four role surfaces boot. Manager + Nurse are the most fleshed-out.
- Horizon dashboard, AdmitFlow, BedBoard, AlertsCenter,
  WorkforceCoverage, PatientsPage all have working flows on mocked data.
- **Simulator controls were rewritten today.** Native
  `<input type="range">` was broken in the Capacitor iOS WebView
  (invisible thumb on the dark surface, drags eaten by WebKit scroll).
  Replaced with a ±-stepper flanking a segmented fill bar (iOS HIG
  44×44 tap targets).
- **Typography scale: reverted to baseline.** Three sizing passes
  today, each rejected. Current defaults are mono 11/12/13, body 14/16,
  h 17/21/26/34, display 48/64. See the matching entry in
  `docs/decisions.md` for the full reasoning.
- **Just shipped:** opt-in "Larger UI" toggle in Settings → Display
  that applies +15% zoom to the document element. Default is unchanged
  for everyone who doesn't touch it. Lives in `lib/uiScale.ts`,
  persists via localStorage under key `pulse-ui-scale`.

---

## Backlog highlights (`docs/improvement-ideas.md`)

Tiered **T1** (ship-stopper) → **T4** (nice-to-have). A few examples:

- **T2.1** — split `MobileView.tsx`; it's the largest file in the repo.
- **T3.4** — contrast review of `COLORS.textDim` vs the `#050505`
  canvas (complete, WCAG AA now at `#5A5A5A`).
- **T3.10** — typography tuning: current baseline is kept, the +15%
  feel is remembered as a candidate for future bump if feedback shifts.

Full catalog lives in that file.

---

## Decision log highlights (`docs/decisions.md`)

Newest entries at the top. Examples:

- **Opt-in Larger UI toggle** — zoom-based rather than a token swap;
  avoids a rem refactor across ~50 files that hardcode `px` font sizes.
- **Sizing reverted to baseline** — three passes today rejected,
  landed at pre-bump state. Lesson: don't global-multiply typography
  without an eyes-on review.
- **Simulator controls rewrite kept** across sizing reverts — unrelated
  fix for a genuinely broken native range input on iOS WebView.
- **Patient Flow Pipeline removed from Horizon** — signal moved to
  ActionBoard / AlertsCenter surfaces that were closer to decisions.

---

## Ship loop (how changes land)

```
npm run build          # must be clean, no TS errors
npx cap sync ios       # copies dist → ios/App/App/public, updates plugins
git add <files>
git commit -m "..."    # follow existing commit style
git push origin main
```

Then on device:

1. Scheme selector (top bar) = **App**
2. Destination dropdown → simulator (e.g. *iPhone 15 Pro*) or connected device
3. Hit ▶ **Run** (⌘R)
4. If bundle looks stale: **Product → Clean Build Folder** (⇧⌘K), then Run

GitHub Pages deploy is automatic on push to `main` via
`.github/workflows/deploy.yml`.

---

## How to work with this project in a chat

If you're a Claude chat hearing about PULSE for the first time:

1. **Trust the tokens.** `components/design/tokens.ts` is the source of
   truth. Don't invent colors or type sizes.
2. **Respect the role hierarchy.** Suggestions that assume "one view
   for all roles" will be rejected.
3. **The tactical aesthetic is locked.** Proposals that soften it
   (rounded cards, pastel palettes, heavy shadows, playful copy) are
   off-direction.
4. **Mobile is the primary surface.** iPad + iPhone in Capacitor.
   Desktop web exists but is secondary.
5. **No backend yet.** Every data flow is mocked. Don't architect
   around a real DB unless that's explicitly on the table.
6. **Decisions are logged, not re-litigated.** If a choice looks
   strange, the reason is probably in `docs/decisions.md`.

---

## Quick pitch (for humans)

> PULSE is what an emergency department looks like when you replace the
> beige hospital dashboard with a Palantir-grade tactical console.
> Real-time bed state, role-aware mobile surfaces for nurses, charge,
> and trauma, surge-mode playbooks that activate with one tap, and a
> shift-handoff replay that turns the chaos of the last 12 hours into
> a narrative. Dark, sharp, monospace, rose-accented. Built for the
> 3 a.m. decision, not the boardroom slide.
