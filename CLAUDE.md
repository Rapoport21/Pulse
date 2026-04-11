# PULSE — Claude working notes

Persistent instructions for any Claude session on this repo. Read this first.

## Standing directives from Nick

1. **All actions pre-approved.** Never ask for permission to run builds, installs, commits, pushes, cap syncs, file edits, or agent launches. Just do the work.

2. **After every change that ships code, always report:**
   - **GitHub link** — direct URL to the pushed commit or compare view on `https://github.com/Rapoport21/Pulse`. Prefer the compare URL (`/compare/<old>...<new>`) when multiple commits are pushed, otherwise the single-commit URL (`/commit/<sha>`).
   - **Xcode click path** — exactly what to press in the open workspace to see the change on device/simulator. Default path:
     1. Make sure scheme selector (top bar) reads **App**.
     2. Pick destination from the dropdown next to it (simulator like *iPhone 15 Pro*, or a connected device).
     3. Hit the ▶ **Run** button (or ⌘R).
     4. If the bundle looks stale, **Product → Clean Build Folder** (⇧⌘K) then Run again.
   - Call out anything non-default: new native permissions, Info.plist keys, Podfile changes, plugin additions, signing issues, etc.

3. **Role-aware hierarchy.** Mobile UI must differentiate Manager / Nurse / ER Personnel / Trauma. Don't collapse them into one view.

4. **Stay on track.** If Nick flags a side issue mid-task, note it and defer unless he says otherwise.

## Project shape

- React 19 + TypeScript + Vite 6 + Capacitor 8 (iOS shell)
- Tactical HUD aesthetic (Palantir/Anduril) — Geist + Geist Mono, tokenized design system in `components/design/`
- `MobileView.tsx` is the main mobile surface (large file, split candidate — see `docs/improvement-ideas.md` T2.1)
- Decision log: `docs/decisions.md` (append new ADRs to the top)
- Backlog: `docs/improvement-ideas.md` (tiered T1/T2/T3/T4)

## Standard ship loop

```
npm run build          # must be clean, no TS errors
npx cap sync ios       # copies dist → ios/App/App/public, updates plugins
git add <files>
git commit -m "..."    # follow existing commit style
git push origin main
npx cap open ios       # only if Xcode isn't already open
```

Then report GitHub link + Xcode click path per directive #2.
