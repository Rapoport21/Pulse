#!/usr/bin/env node
// Build the PULSE master SVGs (icon + splash) with the `[pulse]` wordmark
// rendered as outline paths from Geist Mono Medium. Outline paths make
// the SVG portable: qlmanage (and any other SVG renderer) draws the
// wordmark identically regardless of installed system fonts.
//
// Run from repo root:  node scripts/build-icon-svg.cjs
// Then:                bash scripts/generate-icons.sh
//
// The script writes:
//   scripts/icon-master.svg     1024×1024 canvas with [pulse] wordmark
//   scripts/splash-master.svg   2732×2732 canvas with [pulse] wordmark
//
// Both share the dark canvas (#050505) + rose floor glow (#E11D48)
// design language from the in-app boot screen / Pulse Radiant.

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
// Build path data for `[pulse]` at a given font size.
// Returns the path 'd' attribute plus the bounding box so we can center
// the mark on whatever canvas size we want.
// ─────────────────────────────────────────────────────────────────────────
function buildWordmarkPath(text, fontSize) {
  const path = font.getPath(text, 0, 0, fontSize);
  const bb = path.getBoundingBox();
  return {
    d: path.toPathData(2),
    width: bb.x2 - bb.x1,
    height: bb.y2 - bb.y1,
    x1: bb.x1,
    y1: bb.y1,
    x2: bb.x2,
    y2: bb.y2,
  };
}

// Center the path on a square canvas of `size`. Returns the translate
// values to put the visual center of the text at (size/2, size/2).
function centerOnCanvas(bbox, size) {
  const cx = (bbox.x1 + bbox.x2) / 2;
  const cy = (bbox.y1 + bbox.y2) / 2;
  return {
    tx: size / 2 - cx,
    ty: size / 2 - cy,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Icon — 1024×1024
// ─────────────────────────────────────────────────────────────────────────
function buildIconSvg() {
  const size = 1024;
  const fontSize = 240;
  const wm = buildWordmarkPath('[pulse]', fontSize);
  const { tx, ty } = centerOnCanvas(wm, size);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  PULSE app icon master — v5.
  GENERATED FILE. Do not hand-edit; regenerate via:
      node scripts/build-icon-svg.cjs

  Wordmark form: \`[pulse]\` rendered as outline paths from Geist Mono
  Medium (weight 500). Geist Mono is the app's data/label typeface
  (loaded in index.html via Google Fonts). Square brackets around the
  word is a tactical-HUD convention used throughout the app.

  Color tokens:
    canvas: COLORS.bg            #050505
    text:   COLORS.textPrimary   #FAFAFA
    glow:   COLORS.accent        #E11D48

  Wordmark bbox at fontSize=${fontSize}:
    width  ${wm.width.toFixed(2)}
    height ${wm.height.toFixed(2)}
  Centered on ${size}×${size} canvas via translate(${tx.toFixed(2)}, ${ty.toFixed(2)}).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- Canvas -->
  <rect width="${size}" height="${size}" fill="#050505"/>

  <!-- Rose floor glow — radial from bottom center.
       Same gradient pattern used in components/design/tokens.ts → SHADOW
       and the boot screen's atmospheric layer. -->
  <defs>
    <radialGradient id="floorGlow" cx="0.5" cy="1.0" r="0.78">
      <stop offset="0%"   stop-color="#E11D48" stop-opacity="0.62"/>
      <stop offset="35%"  stop-color="#E11D48" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#E11D48" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#floorGlow)"/>

  <!-- [pulse] wordmark — Geist Mono Medium outline paths, centered. -->
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})">
    <path d="${wm.d}" fill="#FAFAFA"/>
  </g>
</svg>
`;
}

// ─────────────────────────────────────────────────────────────────────────
// Splash — 2732×2732 (iOS LaunchScreen master).
// Same wordmark, scaled up so the mark reads at the same proportional
// size as the icon (≈25% of canvas width).
// ─────────────────────────────────────────────────────────────────────────
function buildSplashSvg() {
  const size = 2732;
  // Scale wordmark proportionally — icon uses 240/1024 ≈ 23%, so apply
  // the same ratio to the bigger canvas.
  const fontSize = Math.round((240 / 1024) * size);
  const wm = buildWordmarkPath('[pulse]', fontSize);
  const { tx, ty } = centerOnCanvas(wm, size);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  PULSE iOS LaunchScreen splash master — v5.
  GENERATED FILE. Do not hand-edit; regenerate via:
      node scripts/build-icon-svg.cjs

  Same \`[pulse]\` wordmark as the v5 icon, scaled to a 2732 canvas.
  Wordmark bbox at fontSize=${fontSize}:
    width  ${wm.width.toFixed(2)}
    height ${wm.height.toFixed(2)}
  Centered via translate(${tx.toFixed(2)}, ${ty.toFixed(2)}).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- Canvas -->
  <rect width="${size}" height="${size}" fill="#050505"/>

  <!-- Rose floor glow — bigger reach for the splash. -->
  <defs>
    <radialGradient id="splashFloorGlow" cx="0.5" cy="1.0" r="0.7">
      <stop offset="0%"   stop-color="#E11D48" stop-opacity="0.55"/>
      <stop offset="35%"  stop-color="#E11D48" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#E11D48" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#splashFloorGlow)"/>

  <!-- [pulse] wordmark — Geist Mono Medium outline paths, centered. -->
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})">
    <path d="${wm.d}" fill="#FAFAFA"/>
  </g>
</svg>
`;
}

fs.writeFileSync(ICON_OUT, buildIconSvg());
console.log('wrote', path.relative(process.cwd(), ICON_OUT));
fs.writeFileSync(SPLASH_OUT, buildSplashSvg());
console.log('wrote', path.relative(process.cwd(), SPLASH_OUT));
