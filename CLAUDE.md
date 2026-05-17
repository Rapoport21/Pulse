# PULSE · Claude working notes

Persistent instructions for any Claude session on this repo. Read this first.

## Standing directives from Nick

1. **All actions pre-approved.** Never ask for permission to run builds, installs, commits, pushes, cap syncs, file edits, or agent launches. Just do the work.

2. **Auto-deploy after every change. No asking.** Every code change follows the Standard ship loop end to end without waiting for Nick to request a deploy: `npm run build` → `npx cap sync ios` → commit → `git push origin main` → rebuild + install on the iPhone. Pushing to `main` is itself the web deploy — Vercel's GitHub integration auto-builds and ships every push to production (verified: pushes auto-create deployments with no manual trigger). This is the default operating mode, exactly like the old GitHub-Pages flow.

   **After every change that ships code, always report:**
   - **GitHub link.** Direct URL to the pushed commit or compare view on `https://github.com/Rapoport21/Pulse`. Prefer the compare URL (`/compare/<old>...<new>`) when multiple commits are pushed, otherwise the single-commit URL (`/commit/<sha>`).
   - **Web link (PRIMARY = Vercel).** Vercel auto-deploys `main` to production at `https://pulse-psi-fawn.vercel.app` (project `pulse`, team `rapoportn21-5009s-projects`). Build completes ~45-60s after push; it inlines `VITE_*` env vars and runs the `api/gemini` serverless proxy. This is the canonical live URL — report it on every visible change. GitHub Pages still mirror-deploys to `https://rapoport21.github.io/Pulse/` but it is a STATIC fallback only: the AI proxy (`/api/gemini`) does not exist there, so AI is dead on GH Pages. Never present the GH Pages URL as primary.
   - **Xcode click path.** Exactly what to press in the open workspace to see the change on device/simulator. Default path:
     1. Make sure scheme selector (top bar) reads **App**.
     2. Pick destination from the dropdown next to it (simulator like *iPhone 15 Pro*, or a connected device).
     3. Hit the ▶ **Run** button (or ⌘R).
     4. If the bundle looks stale, **Product → Clean Build Folder** (⇧⌘K) then Run again.
   - Call out anything non-default: new native permissions, Info.plist keys, Podfile changes, plugin additions, signing issues, etc.

3. **Role-aware hierarchy.** Mobile UI must differentiate Manager / Nurse / ER Personnel / Trauma. Don't collapse them into one view.

4. **Navbar is universal.** The mobile bottom tab bar is a *single DOM instance* mounted at the app shell. When the user navigates to the Patients tab (or any tab) it is the SAME navbar, not a new one that looks the same. Never re-render the nav inside a per-screen component, never mount a lookalike in a modal/overlay.

5. **Fullscreen never overlays the navbar on mobile.** Any `position: fixed` / `inset: 0` overlay that renders on mobile must stop above the nav. Use `bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM` from `components/design/tokens.ts` instead of `inset: 0` / `bottom: 0`. If the overlay has its own internal bottom-fixed bar (action bar, input, etc.), that bar also needs the same offset.

6. **iPhone is portrait-only.** Landscape is disabled on iPhone. iPad keeps all orientations. Source of truth: `ios/App/App/Info.plist → UISupportedInterfaceOrientations`.

7. **Stay on track.** If Nick flags a side issue mid-task, note it and defer unless he says otherwise.

8. **OFF-LIMITS DIRECTORIES: `marketing/` and `marketing-v2/`.** These are **standalone web marketing sites** (Vite + React + TS), versioned independently. They are NOT part of the main PULSE app, NOT part of the iOS bundle, NOT compiled by `npm run build` at the repo root, and NOT synced by `npx cap sync ios`. When working on the **main PULSE app** (mobile, desktop, iOS, Capacitor, EHR tab, MobileView, components/, lib/, ios/), **do not read, modify, or import from `marketing/` or `marketing-v2/`**. Likewise, code in those directories must never import from the main PULSE app. They are siblings, not children. Each has its own `CLAUDE.md`; those apply only when the task is explicitly about the web marketing site. The Standard ship loop in this file (`cap sync`, Xcode reporting) does NOT apply to marketing changes; those are separate Vite apps with their own `npm run build` and their own deploys.

9. **No em dashes. Anywhere.** Never write `—` (U+2014) in user-facing copy, code comments, commit messages, PR descriptions, or working notes. Replace with one of: a period (split the sentence), a colon (when the second half elaborates), a comma (when the pause is light), or the on-brand middle-dot ` · ` (especially in mono-typeset labels and meta lines). When editing existing files for any reason, opportunistically remove em dashes you encounter. This rule is permanent and overrides the natural instinct to reach for the em dash.

10. **PULSE is a hospital-wide operational tool, not an ED-only product.** Frame copy at the hospital level: "hospital operations", "care teams", "the hospital floor", "every unit". The Emergency Department is one important surface PULSE serves, alongside ICU, Med-Surg, OR, Transfer Center, Pharmacy, etc. Specific role names that are inherently ED-scoped (e.g. "ER Charge Nurse", "Trauma") stay as-is because they describe real people, but never describe PULSE itself as "for emergency departments" or "the ED tool". When in doubt, broaden to hospital-level language.

## Project shape

- React 19 + TypeScript + Vite 6 + Capacitor 8 (iOS shell)
- Tactical HUD aesthetic (Palantir/Anduril). Geist + Geist Mono, tokenized design system in `components/design/`
- `MobileView.tsx` is the main mobile surface. Large file, split candidate (see `docs/improvement-ideas.md` T2.1)
- Decision log: `docs/decisions.md` (append new ADRs to the top)
- Backlog: `docs/improvement-ideas.md` (tiered T1/T2/T3/T4)

## Standard ship loop

Runs automatically after every code change (directive #2 — no asking):

```
npm run build          # must be clean, no TS errors
npx cap sync ios       # copies dist into ios/App/App/public, updates plugins
git add <files>
git commit -m "..."    # follow existing commit style
git push origin main   # <- THIS is the web deploy. Vercel auto-builds
                        #    + ships main to https://pulse-psi-fawn.vercel.app
                        #    (~45-60s). No further web step needed.
# iPhone (device 3416D2C5-8BC0-5121-A1AE-D7747DE114FA):
xcrun devicectl device uninstall app --device <id> com.rapoport.pulse
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=<id>" -derivedDataPath <ddpath> build
xcrun devicectl device install app --device <id> <App.app path>
xcrun devicectl device process launch --device <id> com.rapoport.pulse
```

Then report GitHub link + Vercel web link + Xcode click path per directive
#2. (`npx cap open ios` only if Xcode isn't already open and a manual run
is preferred over devicectl.)
