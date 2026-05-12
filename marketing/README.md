# PULSE marketing — v1

First-pass marketing site for PULSE. Higher density, more rose-600
accents per scene, 1:1 beat-mirror of the Relats reference. Sibling
of `marketing-v2/`.

This is a standalone Vite app — independent build, independent deploy.
It shares vocabulary (Geist + Geist Mono, near-black canvas, rose-600
accent, sharp 2px radii) with the parent PULSE design system at
`/Users/nickrapoport/Documents/PULSE/components/design/tokens.ts` but
does not import from it.

## Run

```bash
cd marketing
npm install
npm run dev      # → http://localhost:5174/
```

Build for production:

```bash
npm run build    # outputs to dist/
```

## Structure

11 scroll-driven sections matching the Relats reference pattern:

1. **Hero** — orange-braid macro analog (vital-sign waveform on near-black)
2. **IntroMosaic** — 9-tile HUD grid that zooms out from center
3. **ForecastEngine** — pinned scrub, 3 variants (Capacity / Risk / Staffing)
4. **Roles** — pinned scrub, 4 roles (Operations Director / Charge / ER / EVS)
5. **StatMoment** — count-up "X min back to the bedside"
6. **SurgeAction** — 3-stage human-in-the-loop pinned scrub
7. **Modules** — paginated module list
8. **Coverage** — capability list reveal over hospital floor SVG
9. **Compliance** — HIPAA / FHIR card
10. **Worldwide** — abstract deployment map
11. **Closing** — wordmark + CTAs + footer

## Stack

- Vite 6
- React 19 + TypeScript
- `motion/react` (Framer Motion)
- `lenis` for smooth scroll
- Geist + Geist Mono via Google Fonts
- Single accent rule: rose-600 once per scene

## Relationship to marketing-v2

`marketing-v2/` is the design-led pass: same vocabulary executed with
much more restraint and editorial pacing. v2 also hosts a runtime
theme switcher (Tactical / Editorial / Brutalist / Documentary) and
ships a sibling `Compare` panel for cross-build comparison.

Open both via the **Compare** button in either site's nav, or run
side-by-side with the panel's `Open side-by-side ↔` button.
