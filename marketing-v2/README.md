# PULSE marketing — v2

Design-led marketing site for PULSE. Same Relats motion grammar as
`../marketing/` but executed with deliberate restraint: one accent
per scene, editorial pacing, sticky-pinned hero, runtime theme
switcher. This is the production-track build.

Standalone Vite app — independent of the parent PULSE app and of `../marketing/`.

## Run

```bash
cd marketing-v2
npm install
npm run dev      # → http://localhost:5175/
```

Build for production:

```bash
npm run build    # outputs to dist/
```

## What's different from v1

| | v1 | v2 |
|---|---|---|
| Beat structure | 1:1 Relats mirror, 11 sections | 11 sections, restraint pass |
| Accents per scene | Multiple | **One only** (rose-600) |
| Hero | 1.5vh, full content visible immediately | 4vh sticky-pinned scrub, content reveals in phases |
| Theme system | Single aesthetic | **4 swappable themes** (Tactical · Editorial · Brutalist · Documentary) |
| Documentary mode | n/a | Scroll-scrubbed video backdrop, film-set chrome (REC, timecode, frame markers) |
| Roles section | Inline video previews + heavy spec card | Quote-led, one stat per role |
| Why View | n/a | Drives the "explainable risk" story (cut Modules to make room) |
| Brief Me | n/a | 30-second handoff demo (cut Worldwide to make room) |

## Theme system

Themes are CSS-variable-scoped. Switch at runtime via the **Compare**
panel in the nav. Each theme rewrites the entire surface — colors,
fonts, radii, motion — without re-rendering components.

- **Tactical · Restraint** (default) — near-black HUD, Geist sans, rose-600 accent
- **Editorial · Clinical** — warm white, Spectral serif headlines, NEJM × Linear feel
- **Brutalist · Mechanical** — pure b/w, all monospace, flat slabs, no glow
- **Documentary · Photographic** — tungsten cinematic, scroll-scrubbed video, film chrome

Choice persists across reloads via `localStorage` (`pulse-marketing-theme`).

## Documentary mode specifics

The hero is a 4-viewport sticky-pinned scrub. Inside it:

1. A `<video>` element loads `/hero-doc.mp4` (the asset is at `public/hero-doc.mp4`)
2. As you scroll, `video.currentTime` is mapped to the hero section's progress
3. A procedural SVG corridor sits behind the video as a guaranteed fallback
4. Film chrome (REC indicator, timecode, frame markers) renders over everything

Replace the `hero-doc.mp4` asset to swap the footage — the file lives
at `public/hero-doc.mp4`. Use ffmpeg to mirror-loop any clip:

```bash
ffmpeg -i your-clip.mp4 \
  -filter_complex "[0:v]trim=duration=8,setpts=PTS-STARTPTS[a];\
                   [0:v]trim=duration=8,setpts=PTS-STARTPTS,reverse[b];\
                   [a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -an \
  public/hero-doc.mp4
```

## Files of interest

- `src/lib/theme.ts` — theme system + `useTheme()` hook
- `src/lib/scroll-progress.ts` — custom `useScrollProgress` (matches hand math, unlike framer-motion's useScroll for tall pinned sections)
- `src/components/DocumentaryBackdrop.tsx` — scroll-scrubbed video + procedural fallback + chrome composition
- `src/components/VariantSwitcher.tsx` — Compare panel: cross-build + theme + narrative axes
- `src/styles/globals.css` — token system, theme classes, hero entry animations
- `.impeccable.md` — design context (audience, brand, anti-references)
- `DESIGN_BRIEF.md` — full design brief produced by `/shape`

## Stack

- Vite 6
- React 19 + TypeScript
- `motion/react` (Framer Motion) — for component-level motion
- `lenis` — smooth scroll
- Custom scroll-progress hook for pinned scrubs (replaces motion's useScroll)
- Geist + Geist Mono + Spectral (serif, editorial theme only)

## Compare with v1

Open the **Compare** panel in the nav (top-right) and either click v1
to open it in a new tab, or use `Open side-by-side ↔` to snap both
sites to half-screen windows.
