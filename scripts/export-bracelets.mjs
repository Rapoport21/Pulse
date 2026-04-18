#!/usr/bin/env node
/**
 * export-bracelets.mjs — write 20 standalone admit-band SVGs to disk.
 *
 * Why this exists: browser print from the app is the fast path for
 * SCAD stand day, but Nick also wants file-on-disk SVGs that open
 * cleanly in Figma / Illustrator / print shop software for:
 *   - tweaking the design offline,
 *   - handing off to a vinyl or Tyvek print shop,
 *   - having a static archive of band numbers 01–20.
 *
 * Output: `../pulse-collateral/bracelets/current-v8/generated/pulse-bracelet-NN.svg`
 * (one file per bracelet in the pool). The directory is created if
 * missing. Files are regenerated on every run — safe to re-run any
 * time the design changes.
 *
 * Run:
 *   node scripts/export-bracelets.mjs
 *
 * Notes:
 *   - SVG markup is kept in sync with `components/BraceletCard.tsx`
 *     by hand. If the component changes, update `buildBraceletSvg`
 *     below too. Duplication is the price of skipping a React SSR
 *     toolchain for a 20-line static template.
 *   - QR payloads match the app: `pulse://bracelet/<number>`. Scanned
 *     via MobileView, resolved against the pool.
 *   - Real QR is embedded as a base64 PNG via <image href=...>.
 *     Self-contained, no external refs, no font embedding needed
 *     (monospace falls back per CSS stack).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Output lives in the sibling collateral folder, outside this repo.
// This keeps generated artifacts out of app source while staying next
// to the design spec they correspond to.
const OUTPUT_DIR = resolve(
  __dirname,
  '../../pulse-collateral/bracelets/current-v8/generated',
);

// ⚠️ Keep in sync with `lib/braceletPool.ts` POOL_SIZE and the matching
// `BATCH_WORDS` map in `components/BraceletCard.tsx`. Three files, one
// truth — no shared module because this script runs outside the Vite
// bundle (plain Node ESM, no TS import). If you bump POOL_SIZE:
//   1. Update POOL_SIZE here AND in lib/braceletPool.ts
//   2. Add the new size to BATCH_WORDS here AND in BraceletCard.tsx
//   3. Re-run `npm run export:bracelets` to regenerate the SVG files
//   4. Reprint physical bracelets — already-printed 01–20 say "№ / 20"
//      and "batch of twenty" and will be inconsistent with the new batch
// Full checklist: see the POOL_SIZE comment in lib/braceletPool.ts.
const POOL_SIZE = 20;
const HOSPITAL = 'MEMORIAL GENERAL · EMERGENCY DEPT';

const BATCH_WORDS = {
  10: 'ten',
  12: 'twelve',
  15: 'fifteen',
  20: 'twenty',
  24: 'twenty-four',
  25: 'twenty-five',
  30: 'thirty',
  40: 'forty',
  50: 'fifty',
  100: 'one hundred',
};
const spellBatch = (n) => BATCH_WORDS[n] ?? String(n);

/** Build the standalone SVG string for a single bracelet. */
function buildBraceletSvg(number, qrDataUrl, hospital = HOSPITAL) {
  const mrn = `PULSE-${number}`;
  const scanId = `scan-${number}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 100" width="1000" height="100">
  <defs>
    <pattern id="${scanId}" x="0" y="0" width="60" height="2" patternUnits="userSpaceOnUse">
      <rect width="60" height="1" fill="#FAFAFA"/>
      <rect y="1" width="60" height="1" fill="#FFFFFF"/>
    </pattern>
  </defs>

  <rect x="0" y="0" width="1000" height="100" fill="#FFFFFF" stroke="#E5E5E5" stroke-width="1"/>
  <rect x="0" y="0" width="1000" height="100" fill="url(#${scanId})"/>

  <line x1="70" y1="0" x2="70" y2="100" stroke="#A3A3A3" stroke-width="1" stroke-dasharray="2 3"/>
  <line x1="930" y1="0" x2="930" y2="100" stroke="#A3A3A3" stroke-width="1" stroke-dasharray="2 3"/>
  <text x="35" y="54" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="7" fill="#A3A3A3" letter-spacing="1.5">TAB</text>
  <text x="965" y="54" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="7" fill="#A3A3A3" letter-spacing="1.5">TAB</text>

  <g stroke="#E11D48" stroke-width="1.4" fill="none">
    <path d="M 74 8 L 84 8 M 74 8 L 74 18"/>
    <path d="M 926 8 L 916 8 M 926 8 L 926 18"/>
    <path d="M 74 90 L 84 90 M 74 90 L 74 80"/>
    <path d="M 926 90 L 916 90 M 926 90 L 926 80"/>
  </g>

  <rect x="90" y="10" width="820" height="14" fill="#F5F5F5"/>
  <text x="98" y="20" font-family="ui-monospace, Menlo, monospace" font-size="8" fill="#E11D48" letter-spacing="1.8" font-weight="700">// ADMIT BAND · ISSUED</text>
  <text x="256" y="20" font-family="ui-monospace, Menlo, monospace" font-size="7" fill="#737373" letter-spacing="1.2">${hospital}</text>
  <text x="904" y="20" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="7" fill="#737373" letter-spacing="1.2">${mrn}</text>

  <text x="98" y="38" font-family="ui-monospace, Menlo, monospace" font-size="11" fill="#0A0A0A" letter-spacing="2" font-weight="700">[ PULSE ]</text>
  <text x="98" y="50" font-family="ui-monospace, Menlo, monospace" font-size="6" fill="#A3A3A3" letter-spacing="1.8">// BAND ID</text>
  <text x="98" y="82" font-family="ui-monospace, Menlo, monospace" font-size="32" fill="#E11D48" letter-spacing="-1" font-weight="700">[ ${number} ]</text>

  <g font-family="ui-monospace, Menlo, monospace">
    <text x="230" y="40" font-size="7" fill="#A3A3A3" letter-spacing="1.4">// NAME</text>
    <line x1="230" y1="54" x2="580" y2="54" stroke="#D4D4D4" stroke-width="0.8"/>
    <text x="230" y="70" font-size="7" fill="#A3A3A3" letter-spacing="1.4">// DOB</text>
    <line x1="230" y1="84" x2="340" y2="84" stroke="#D4D4D4" stroke-width="0.8"/>
    <text x="360" y="70" font-size="7" fill="#A3A3A3" letter-spacing="1.4">// MRN</text>
    <text x="360" y="84" font-size="10" fill="#0A0A0A" font-weight="600">${mrn}</text>
    <text x="470" y="70" font-size="7" fill="#A3A3A3" letter-spacing="1.4">// ISSUED</text>
    <line x1="470" y1="84" x2="580" y2="84" stroke="#D4D4D4" stroke-width="0.8"/>
  </g>

  <g font-family="ui-monospace, Menlo, monospace">
    <text x="604" y="40" font-size="7" fill="#A3A3A3" letter-spacing="1.4">// ADMIT BY</text>
    <line x1="604" y1="70" x2="730" y2="70" stroke="#D4D4D4" stroke-width="0.8"/>
    <text x="604" y="84" font-size="5" fill="#C7C7C7" letter-spacing="1.2">CLINICIAN OF RECORD</text>
  </g>

  <g transform="translate(750, 30)">
    <rect x="0" y="0" width="50" height="50" fill="#FFFFFF" stroke="#E11D48" stroke-width="1"/>
    <image href="${qrDataUrl}" xlink:href="${qrDataUrl}" x="3" y="3" width="44" height="44" preserveAspectRatio="none"/>
    <path d="M -3 -3 L 2 -3 M -3 -3 L -3 2" stroke="#E11D48" stroke-width="1" fill="none"/>
    <path d="M 53 -3 L 48 -3 M 53 -3 L 53 2" stroke="#E11D48" stroke-width="1" fill="none"/>
    <path d="M -3 53 L 2 53 M -3 53 L -3 48" stroke="#E11D48" stroke-width="1" fill="none"/>
    <path d="M 53 53 L 48 53 M 53 53 L 53 48" stroke="#E11D48" stroke-width="1" fill="none"/>
  </g>

  <text x="775" y="90" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="5" fill="#C7C7C7" letter-spacing="1">by Nick Rapoport</text>

  <g font-family="ui-monospace, Menlo, monospace">
    <text x="830" y="40" font-size="7" fill="#A3A3A3" letter-spacing="1.4">// № / ${POOL_SIZE}</text>
    <text x="830" y="64" font-size="18" fill="#0A0A0A" letter-spacing="1" font-weight="700">${number}</text>
    <text x="830" y="78" font-size="6" fill="#A3A3A3" letter-spacing="1.2">batch of ${spellBatch(POOL_SIZE)}</text>
  </g>
</svg>
`;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (let i = 1; i <= POOL_SIZE; i++) {
    const number = String(i).padStart(2, '0');
    const payload = `pulse://bracelet/${number}`;
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 512,
      color: { dark: '#0A0A0A', light: '#FFFFFF' },
    });
    const svg = buildBraceletSvg(number, qrDataUrl);
    const outPath = join(OUTPUT_DIR, `pulse-bracelet-${number}.svg`);
    writeFileSync(outPath, svg, 'utf-8');
    console.log(`  ✓ pulse-bracelet-${number}.svg`);
  }

  console.log(`\nWrote ${POOL_SIZE} bracelets to:\n  ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
