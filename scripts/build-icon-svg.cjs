#!/usr/bin/env node
// Build the PULSE master SVGs (icon + splash) with the `[PULSE]` wordmark
// rendered to match the in-app <BracketLabel tone="accent">PULSE</BracketLabel>
// primitive from components/design/primitives.tsx.
//
// In-app spec (single source of truth):
//   font:         Geist Mono Medium (weight 500)
//   case:         UPPERCASE
//   color:        COLORS.accent  #E11D48  (rose)
//   tracking:     0.12em between letters
//   bracket fx:   fill-opacity 0.7, translateY(-0.035em)  — quieter wrappers
//                 around the heavier letterform
//
// Outline paths are baked into the SVG via opentype.js so the masters
// render identically regardless of installed system fonts.
//
// Run from repo root:  node scripts/build-icon-svg.cjs
// Then:                bash scripts/generate-icons.sh

const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const FONT_FILE = path.resolve(__dirname, 'fonts/GeistMono-Medium.ttf');
const ICON_OUT = path.resolve(__dirname, 'icon-master.svg');
const SPLASH_OUT = path.resolve(__dirname, 'splash-master.svg');

const buffer = fs.readFileSync(FONT_FILE);
const font = opentype.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);

// ─────────────────────────────────────────────────────────────────────────
// Design tokens — mirrors the in-app <BracketLabel> styling
// ─────────────────────────────────────────────────────────────────────────
const ROSE = '#E11D48';
const TRACKING_EM = 0.12;
const BRACKET_OPACITY = 0.7;
const BRACKET_Y_NUDGE_EM = -0.035;
const GAP_EM = 0.05; // small visual breath between bracket and first letter

// ─────────────────────────────────────────────────────────────────────────
// Lay out `[PULSE]` glyph-by-glyph so we can:
//   · apply letter-spacing (opentype.getPath doesn't support tracking)
//   · render brackets and letters in separate <path> elements with
//     different fill-opacity and a y-offset on the brackets
// Returns three path-data strings + an overall bbox we can use to center
// the mark on the canvas.
// ─────────────────────────────────────────────────────────────────────────
function buildBracketedWordmark(text, fontSize) {
  const tracking = TRACKING_EM * fontSize;
  const gap = GAP_EM * fontSize;
  const bracketYNudge = BRACKET_Y_NUDGE_EM * fontSize;

  function advance(glyph) {
    return (glyph.advanceWidth / font.unitsPerEm) * fontSize;
  }

  let x = 0;

  // Open bracket — y-nudged up so it optically aligns with cap height
  const openGlyph = font.charToGlyph('[');
  const openPath = openGlyph.getPath(x, bracketYNudge, fontSize);
  x += advance(openGlyph) + gap;

  // Letter glyphs — laid out manually with tracking between them
  const letterCommands = [];
  let letterStartX = x;
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    const p = glyph.getPath(x, 0, fontSize);
    letterCommands.push(...p.commands);
    x += advance(glyph);
    if (i < text.length - 1) x += tracking;
  }
  let letterEndX = x;

  x += gap;

  // Close bracket
  const closeGlyph = font.charToGlyph(']');
  const closePath = closeGlyph.getPath(x, bracketYNudge, fontSize);

  // Combine into a single Path for bbox computation
  const allCommands = [
    ...openPath.commands,
    ...letterCommands,
    ...closePath.commands,
  ];
  const combinedPath = new opentype.Path();
  combinedPath.commands = allCommands;
  const bbox = combinedPath.getBoundingBox();

  // Build letter-only Path (for separate render with full opacity)
  const lettersPath = new opentype.Path();
  lettersPath.commands = letterCommands;

  return {
    openD: openPath.toPathData(2),
    lettersD: lettersPath.toPathData(2),
    closeD: closePath.toPathData(2),
    bbox: {
      x1: bbox.x1,
      y1: bbox.y1,
      x2: bbox.x2,
      y2: bbox.y2,
      width: bbox.x2 - bbox.x1,
      height: bbox.y2 - bbox.y1,
    },
  };
}

// Center bbox on canvas of `size`. Returns translate values that put the
// visual center of the wordmark at (size/2, size/2 * verticalAnchor).
// verticalAnchor = 0.5 → dead center; < 0.5 → upper half (matches the
// boot screen layout where [PULSE] sits in the top HUD, separated from
// the rose floor glow).
function centerOnCanvas(bbox, size, verticalAnchor = 0.5) {
  const cx = (bbox.x1 + bbox.x2) / 2;
  const cy = (bbox.y1 + bbox.y2) / 2;
  return {
    tx: size / 2 - cx,
    ty: size * verticalAnchor - cy,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Icon — 1024×1024
// Wordmark sits in the upper third (verticalAnchor 0.38) so the rose
// floor glow has its own space at the bottom — mirrors the boot screen
// layout where [PULSE] is in the top HUD, glow is at the bottom.
// ─────────────────────────────────────────────────────────────────────────
function buildIconSvg() {
  const size = 1024;
  const fontSize = 180;
  const wm = buildBracketedWordmark('PULSE', fontSize);
  const { tx, ty } = centerOnCanvas(wm.bbox, size, 0.38);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  PULSE app icon master — v6.
  GENERATED FILE. Do not hand-edit; regenerate via:
      node scripts/build-icon-svg.cjs

  Reproduces the in-app <BracketLabel tone="accent">PULSE</BracketLabel>
  primitive at icon scale. Wordmark sits in the upper third, rose floor
  glow occupies the lower portion — same vertical separation as the boot
  screen (BracketLabel in the top HUD strip, glow rising from below).

  Spec carried over from components/design/primitives.tsx + tokens.ts:
    font:        Geist Mono Medium (weight 500)
    case:        UPPERCASE
    tracking:    0.12em
    letters:     COLORS.accent  #E11D48
    brackets:    same rose at fill-opacity 0.7, translateY(-${(-BRACKET_Y_NUDGE_EM * fontSize).toFixed(1)})

  Wordmark bbox at fontSize=${fontSize}:
    width  ${wm.bbox.width.toFixed(2)}
    height ${wm.bbox.height.toFixed(2)}
  Centered on ${size}×${size} canvas (verticalAnchor 0.38)
  via translate(${tx.toFixed(2)} ${ty.toFixed(2)}).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- Canvas -->
  <rect width="${size}" height="${size}" fill="#050505"/>

  <!-- Rose floor glow — radial from bottom center.
       Same gradient pattern as components/design/tokens.ts → SHADOW
       and the boot screen's GlowBg(origin="bottom"). -->
  <defs>
    <radialGradient id="floorGlow" cx="0.5" cy="1.0" r="0.78">
      <stop offset="0%"   stop-color="${ROSE}" stop-opacity="0.62"/>
      <stop offset="35%"  stop-color="${ROSE}" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="${ROSE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#floorGlow)"/>

  <!-- [PULSE] wordmark — Geist Mono Medium outline paths.
       Brackets: rose at 0.7 opacity, raised slightly.
       Letters:  rose at full opacity, 0.12em tracking. -->
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})">
    <path d="${wm.openD}" fill="${ROSE}" fill-opacity="${BRACKET_OPACITY}"/>
    <path d="${wm.lettersD}" fill="${ROSE}"/>
    <path d="${wm.closeD}" fill="${ROSE}" fill-opacity="${BRACKET_OPACITY}"/>
  </g>
</svg>
`;
}

// ─────────────────────────────────────────────────────────────────────────
// Splash — 2732×2732
// Same wordmark scaled proportionally. Wordmark sits in the upper third
// just like the icon for visual continuity.
// ─────────────────────────────────────────────────────────────────────────
function buildSplashSvg() {
  const size = 2732;
  const fontSize = Math.round((180 / 1024) * size);
  const wm = buildBracketedWordmark('PULSE', fontSize);
  const { tx, ty } = centerOnCanvas(wm.bbox, size, 0.38);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  PULSE iOS LaunchScreen splash master — v6.
  GENERATED FILE. Do not hand-edit; regenerate via:
      node scripts/build-icon-svg.cjs

  Same [PULSE] BracketLabel wordmark as the v6 icon, scaled to 2732.
  Wordmark bbox at fontSize=${fontSize}:
    width  ${wm.bbox.width.toFixed(2)}
    height ${wm.bbox.height.toFixed(2)}
  Centered (verticalAnchor 0.38) via translate(${tx.toFixed(2)} ${ty.toFixed(2)}).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- Canvas -->
  <rect width="${size}" height="${size}" fill="#050505"/>

  <!-- Rose floor glow — bigger reach for the splash. -->
  <defs>
    <radialGradient id="splashFloorGlow" cx="0.5" cy="1.0" r="0.7">
      <stop offset="0%"   stop-color="${ROSE}" stop-opacity="0.55"/>
      <stop offset="35%"  stop-color="${ROSE}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${ROSE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#splashFloorGlow)"/>

  <!-- [PULSE] wordmark — Geist Mono Medium outline paths.
       Brackets: rose at 0.7 opacity, raised slightly.
       Letters:  rose at full opacity, 0.12em tracking. -->
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})">
    <path d="${wm.openD}" fill="${ROSE}" fill-opacity="${BRACKET_OPACITY}"/>
    <path d="${wm.lettersD}" fill="${ROSE}"/>
    <path d="${wm.closeD}" fill="${ROSE}" fill-opacity="${BRACKET_OPACITY}"/>
  </g>
</svg>
`;
}

fs.writeFileSync(ICON_OUT, buildIconSvg());
console.log('wrote', path.relative(process.cwd(), ICON_OUT));
fs.writeFileSync(SPLASH_OUT, buildSplashSvg());
console.log('wrote', path.relative(process.cwd(), SPLASH_OUT));
