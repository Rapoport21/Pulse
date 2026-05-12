# marketing/ — Web Marketing V1

**This is the PULSE web marketing site, version 1.** It is a standalone
Vite + React + TypeScript app. It lives inside the main PULSE repo for
discoverability and vendoring, but it is **architecturally separate**
from the main PULSE app.

## CRITICAL — DO NOT do any of these

1. **Do not import from the parent PULSE app.** No `import ... from '../../components/...'`, no `from '../../lib/...'`, no `from '../../App'`, no `from '../../MobileView'`. The relative paths exist (this folder is a child of the main repo) but using them would couple the standalone marketing site to the mobile app's runtime — that is forbidden.

2. **Do not include this directory in the main PULSE app's bundle.** The main app's `vite.config.ts` and Capacitor's `cap sync` do not see `marketing/` and they must not be made to. This is a sibling app.

3. **Do not run iOS / Capacitor commands in response to changes here.** `npx cap sync ios`, Xcode click paths, `npm run build` at the repo root — none of those apply to changes in this directory. They affect the main PULSE app only.

4. **Do not assume `package.json` / `node_modules` here are the same as the parent.** This folder has its own `package.json`. Run `cd marketing && npm install` for its dependencies.

5. **Do not bring main-app concerns into the design.** This is a marketing site for cold-inbound web visitors. The mobile app's role-aware hierarchy, native nav rules, EHR tab, etc. are not relevant. Build for the marketing audience (UX/industry pros, hospital execs, investors), not for clinicians on shift.

## What this folder IS

- Standalone marketing site, the first-pass Relats-mirror build (v1).
- Documents the original cloning of the Relats motion grammar (pinned scrubs, scene crossfades, count-up stats, char-split headlines).
- Higher density, multiple accents per scene, 11 sections.
- Companion site to `../marketing-v2/` (the design-led restraint pass).
- Deploys independently. Not gated on the main app shipping.

## Running this site

```bash
cd marketing
npm install
npm run dev      # → http://localhost:5174/
```

Build:

```bash
npm run build    # outputs to marketing/dist/, ignored by .gitignore
```

## When to work in this folder

Only when the user's request is explicitly about **the web marketing
site, version 1**. Signals: they mention "v1", "the original marketing
site", "the first marketing build", "the Relats clone", `localhost:5174`,
or `marketing/`.

If they're talking about the **app** (mobile, iOS, MobileView, role
surfaces, Capacitor, EHR tab, beds, surge, forecast — as a product) —
that is the main PULSE app, **NOT this directory**. Work in the
repo root or other parent-level directories instead.

## Relationship to v2

`../marketing-v2/` is the design-led pass — much more restrained, runtime
theme switcher, scroll-scrubbed video, sticky-pinned hero. Both run
side-by-side via the Compare panel in either site's nav.

When making coordinated changes to both v1 and v2 (e.g. updating the
shared design token vocabulary), document the change in both, but
keep their code independent — they intentionally do not share modules.
