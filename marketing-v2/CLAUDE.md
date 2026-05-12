# marketing-v2/ — Web Marketing V2

**This is the PULSE web marketing site, version 2.** Standalone Vite +
React + TypeScript app, design-led restraint pass. Lives inside the
main PULSE repo for discoverability and vendoring, but is
**architecturally separate** from the main PULSE app.

## CRITICAL — DO NOT do any of these

1. **Do not import from the parent PULSE app.** No `import ... from '../../components/...'`, no `from '../../lib/...'`, no `from '../../App'`, no `from '../../MobileView'`. The relative paths work (this folder is a child of the main repo) but using them would couple the standalone marketing site to the mobile app's runtime — that is forbidden.

2. **Do not include this directory in the main PULSE app's bundle.** The main app's `vite.config.ts` and Capacitor's `cap sync` do not see `marketing-v2/` and they must not be made to. Sibling app.

3. **Do not run iOS / Capacitor commands in response to changes here.** `npx cap sync ios`, Xcode click paths, `npm run build` at the repo root — none of those apply to changes in this directory. They affect the main PULSE app only.

4. **Do not assume `package.json` / `node_modules` here are the same as the parent.** This folder has its own `package.json`. Run `cd marketing-v2 && npm install` for its dependencies.

5. **Do not bring main-app concerns into the design.** Cold-inbound web visitors are the audience. The mobile app's role hierarchy, native nav rules, EHR tab, MobileView constraints, etc. are not relevant. Read `.impeccable.md` for the actual design context.

## What this folder IS

- Standalone marketing site, the design-led restraint pass (v2).
- Built off a formal design brief (`DESIGN_BRIEF.md`) produced via the `/shape` skill.
- Design context committed to `.impeccable.md`.
- Runtime theme switcher in the nav: **Tactical / Editorial / Brutalist / Documentary**.
- Documentary mode is the one with the scroll-scrubbed cinematic video backdrop — see `src/components/DocumentaryBackdrop.tsx`.
- 11 sections matching the Relats motion grammar, executed with editorial restraint.
- One accent rule strictly enforced: rose-600 (or the active theme's accent) once per scene.

## Running this site

```bash
cd marketing-v2
npm install
npm run dev      # → http://localhost:5175/
```

Build:

```bash
npm run build    # outputs to marketing-v2/dist/, ignored by .gitignore
```

## When to work in this folder

Only when the user's request is explicitly about **the web marketing
site, version 2**. Signals: they mention "v2", "the restraint pass",
"the design-led marketing site", "documentary mode", "the cinematic
hero", "the theme switcher", `localhost:5175`, `marketing-v2/`, or
the files documented in `README.md`.

If they're talking about the **app** (mobile, iOS, MobileView, role
surfaces, Capacitor, EHR tab, beds, surge, forecast — as a product) —
that is the main PULSE app, **NOT this directory**. Work in the
repo root or parent-level directories instead.

## Read these first when working in this folder

- `.impeccable.md` — design context: audience, brand personality, aesthetic direction, anti-references, principles
- `DESIGN_BRIEF.md` — full design brief: section-by-section content, single accent moments, anchor copy, CTA strategy
- `README.md` — file-of-interest pointers, theme system overview, video replacement instructions
- `src/lib/theme.ts` — theme system (Tactical / Editorial / Brutalist / Documentary)
- `src/components/DocumentaryBackdrop.tsx` — scroll-scrubbed video, procedural fallback, scrub anchored to hero section

## Relationship to v1

`../marketing/` is the first-pass Relats-mirror build. v2 is the
design-led restraint pass on the same content. Both run side-by-side
via the Compare panel in either site's nav.

When making coordinated changes to both, document in both. Keep code
independent — they intentionally do not share modules.
