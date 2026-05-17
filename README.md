# PULSE

> **Operational intelligence for the whole hospital.**
> One view of every system, every patient, every shift.

PULSE is the operational-intelligence layer that sits on top of every
clinical system a hospital already runs (EHR, lab, pharmacy, paging,
bed board, EVS, vitals monitors). It pulls scattered signal into one
view, hands the mechanical tasks to an autonomous AI layer, and
escalates only the items that need clinical judgment — so the team
can focus on patient care instead of swivel-chair coordination.

## What's in this repo

PULSE is a single React + Vite + Capacitor codebase that renders three
surfaces from one bundle:

| Surface | Where it renders |
|---|---|
| Desktop command console | Web viewport ≥ 768px |
| Mobile companion | Web viewport < 768px |
| iOS app | Capacitor 8 native shell at `ios/` |

Same source of truth, same components, role-aware behavior (Manager /
Charge Nurse / ER Personnel / Trauma).

## Tech stack

- **React 19** + **TypeScript** + **Vite 6**
- **Capacitor 8** (iOS shell)
- **motion/react** (Framer Motion) for animation
- **lucide-react** for iconography
- **@google/genai** (Gemini) for the AI assistant + agentic helpers
- **@supabase/supabase-js** for real-time state sharing across devices
- Design system tokens at `components/design/` — Geist + Geist Mono,
  tactical-HUD aesthetic (near-black canvas, rose accent)

## Local development

```bash
npm install
npm run dev              # vite dev server (default http://localhost:5173)
```

### Environment

Some features rely on third-party services.

**Gemini (AI assistant) — server-side only.** The Gemini key is NOT a
client variable. It's read at runtime by the `/api/gemini` Vercel
serverless function (`api/gemini.ts`), never inlined into the browser
bundle. Set it as a **server** env var on the host:

```
GEMINI_API_KEY=<your Gemini API key>     # NO VITE_ prefix — server only
```

For local dev with the proxy you'd run `vercel dev` (or set
`GEMINI_API_KEY` in the shell). The browser talks to `/api/gemini`;
the SDK no longer ships to the client at all.

**Supabase (realtime sync) — client-side, safe to expose.** The anon
key is designed for browser use and is protected by row-level
security. These stay `VITE_`-prefixed in `.env.local`:

```env
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon key>
```

The app degrades gracefully without any of these; AI / realtime
features simply stay dormant.

## Build

```bash
npm run build            # TypeScript build + Vite production bundle
npm run preview          # Serve the production bundle locally
npm run lint             # ESLint pass
```

## Deploy

### Web (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml` which builds
the bundle with `VITE_BASE=/Pulse/` and publishes it to GitHub Pages.
The live site is at:

**https://rapoport21.github.io/Pulse/**

The deploy runs ~60s after each push to `main`.

### iOS

```bash
npm run build            # must be clean, no TS errors
npx cap sync ios         # copy dist -> ios/App/App/public + plugins
npx cap open ios         # open the project in Xcode
```

In Xcode: scheme **App** → destination (simulator or a connected
device) → ▶ Run (⌘R). If the bundle looks stale, **Product → Clean
Build Folder** (⇧⌘K) then Run again.

The iPhone target is portrait-only (Info.plist
`UISupportedInterfaceOrientations`). iPad keeps all orientations.

## Repo layout

```
App.tsx                       App shell, top nav, tab routing
components/                   All UI components
  clinical/                   ED / hospital clinical surfaces
  mobile/                     Mobile companion surfaces
  design/                     Design tokens + primitives
  PulseHorizon.tsx            Capacity / surge prediction (Horizon tab)
  ActionBoard.tsx             Action / task console
  AlertsCenter.tsx            Alerts + AI activity
  WorkforceCoverage.tsx       Staffing command center
  CallPanel.tsx               In-call view with HITL handoff
  WelcomeScreen.tsx           Pre-login explainer
  ...
lib/
  pulseAI.tsx                 Proactive-AI activity layer
  callState.tsx               Call + extracted-task state
  realtime.ts                 Supabase realtime sync
  ...
ios/                          Capacitor native shell
docs/
  decisions.md                Append-only architecture decision log
  improvement-ideas.md        Tiered backlog (T1-T4)
  sprint-2026-05-14.md        Most-recent sprint plan + research
CLAUDE.md                     Persistent working notes for AI agents
```

The `marketing/` and `marketing-v2/` directories are **standalone
web marketing sites**, versioned independently. They have their own
`package.json` + `CLAUDE.md` and are NOT part of the main app build.

## Documentation

- `CLAUDE.md` — standing directives, ship loop, off-limits dirs
- `docs/decisions.md` — architectural decision log (most recent on top)
- `docs/improvement-ideas.md` — tiered backlog (T1 ship-blockers
  through T4 nice-to-haves)
- `docs/sprint-2026-05-14.md` — latest sprint plan with research +
  ordered build plan
