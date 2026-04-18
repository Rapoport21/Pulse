import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import { braceletQRPayload, POOL_SIZE, type BraceletNumber } from '../lib/braceletPool';

/**
 * BraceletCard — a printable medical admit band (v8 tactical HUD).
 *
 * Matches `pulse-collateral/bracelets/current-v8/pulse-bracelet-v8.svg`
 * at a 10:1 aspect ratio. Physical print target is 10" × 1" on a
 * landscape letter sheet (via PrintBraceletsSheet).
 *
 * Visual language:
 *  - Rose-600 accent (#E11D48) on corner brackets, HUD strip lead, band
 *    ID, and QR frame.
 *  - Monospace typography throughout (ui-monospace / Menlo stack) so
 *    exported SVGs render identically even on systems without Geist Mono.
 *  - Corner brackets sit in the 8px gutter between tape tab and content
 *    column so they never collide with glyphs (v7→v8 fix).
 *  - Subtle 1-unit scanline overlay for screen fidelity; degrades
 *    gracefully to plain white on paper.
 *  - "by Nick Rapoport" signature at 5pt beneath the QR.
 *
 * Content strategy:
 *  - Auto-filled: bracelet number, PULSE-XX MRN, serial / pool size.
 *  - Blank lines for Name / DOB / Issued / Admit-by — handwritten at
 *    the stand. Bracelets are pre-printed before the event, so the
 *    operator never has guest data at print time.
 *
 * QR payload: `pulse://bracelet/<number>` (see `lib/braceletPool.ts`).
 * Scan flow is unchanged from v0 — this component only restyles.
 *
 * Implementation note: the internals are a single inline SVG at viewBox
 * `0 0 1000 100`. Keeps pixel-perfect fidelity to the designer's
 * reference, and lets the sibling `scripts/export-bracelets.ts` emit
 * standalone SVG files with the same markup.
 */

/** Hospital label rendered in the HUD strip. Placeholder — override via prop. */
export const DEFAULT_HOSPITAL_LABEL = 'MEMORIAL GENERAL · EMERGENCY DEPT';

export interface BraceletCardProps {
  /** Two-digit bracelet number (e.g. "07"). */
  number: BraceletNumber;
  /** Render the tape-tab dashed guides + "TAB" labels. Defaults to true. */
  cutLine?: boolean;
  /** Hospital name in the HUD strip. Default is placeholder copy. */
  hospital?: string;
}

export const BraceletCard: React.FC<BraceletCardProps> = ({
  number,
  cutLine = true,
  hospital = DEFAULT_HOSPITAL_LABEL,
}) => {
  const payload = useMemo(() => braceletQRPayload(number), [number]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 512,
      color: { dark: '#0A0A0A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {
        /* swallow — preview will render the frame without a QR */
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <BraceletCardSvg
      number={number}
      hospital={hospital}
      cutLine={cutLine}
      qrDataUrl={qrDataUrl}
    />
  );
};

/**
 * BraceletCardSvg — the pure-SVG body. Separated so the Node export
 * script can render the same markup with a server-generated QR data URL
 * without involving hooks.
 */
export const BraceletCardSvg: React.FC<{
  number: BraceletNumber;
  hospital: string;
  cutLine: boolean;
  qrDataUrl: string | null;
}> = ({ number, hospital, cutLine, qrDataUrl }) => {
  // Unique pattern ids so multiple bracelets on one page don't collide.
  const scanId = `scan-${number}`;

  const mrn = `PULSE-${number}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 100"
      // Real-world print size: 10" × 1". CSS keeps it responsive in preview.
      style={{ width: '100%', height: 'auto', display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`PULSE admit band ${mrn}`}
      className="pulse-bracelet-svg"
      data-bracelet-number={number}
    >
      <defs>
        <pattern id={scanId} x="0" y="0" width="60" height="2" patternUnits="userSpaceOnUse">
          <rect width="60" height="1" fill="#FAFAFA" />
          <rect y="1" width="60" height="1" fill="#FFFFFF" />
        </pattern>
      </defs>

      {/* Base + subtle scanline overlay (invisible on print, texture on screen) */}
      <rect x="0" y="0" width="1000" height="100" fill="#FFFFFF" stroke="#E5E5E5" strokeWidth="1" />
      <rect x="0" y="0" width="1000" height="100" fill={`url(#${scanId})`} />

      {/* Symmetric tape tabs — 70 units each side. */}
      {cutLine && (
        <g>
          <line x1="70" y1="0" x2="70" y2="100" stroke="#A3A3A3" strokeWidth="1" strokeDasharray="2 3" />
          <line x1="930" y1="0" x2="930" y2="100" stroke="#A3A3A3" strokeWidth="1" strokeDasharray="2 3" />
          <text
            x="35"
            y="54"
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize="7"
            fill="#A3A3A3"
            letterSpacing="1.5"
          >
            TAB
          </text>
          <text
            x="965"
            y="54"
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo, monospace"
            fontSize="7"
            fill="#A3A3A3"
            letterSpacing="1.5"
          >
            TAB
          </text>
        </g>
      )}

      {/* Rose corner brackets — sit in the gutter between tape tab and content. */}
      <g stroke="#E11D48" strokeWidth="1.4" fill="none">
        <path d="M 74 8 L 84 8 M 74 8 L 74 18" />
        <path d="M 926 8 L 916 8 M 926 8 L 926 18" />
        <path d="M 74 90 L 84 90 M 74 90 L 74 80" />
        <path d="M 926 90 L 916 90 M 926 90 L 926 80" />
      </g>

      {/* HUD strip — inset from bracket zone, rose lead, hospital meta, MRN anchor. */}
      <rect x="90" y="10" width="820" height="14" fill="#F5F5F5" />
      <text
        x="98"
        y="20"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="8"
        fill="#E11D48"
        letterSpacing="1.8"
        fontWeight="700"
      >
        // ADMIT BAND · ISSUED
      </text>
      <text
        x="256"
        y="20"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="7"
        fill="#737373"
        letterSpacing="1.2"
      >
        {hospital}
      </text>
      <text
        x="904"
        y="20"
        textAnchor="end"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="7"
        fill="#737373"
        letterSpacing="1.2"
      >
        {mrn}
      </text>

      {/* Left column — wordmark, band id label, giant [ NN ] */}
      <text
        x="98"
        y="38"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="11"
        fill="#0A0A0A"
        letterSpacing="2"
        fontWeight="700"
      >
        [ PULSE ]
      </text>
      <text
        x="98"
        y="50"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="6"
        fill="#A3A3A3"
        letterSpacing="1.8"
      >
        // BAND ID
      </text>
      <text
        x="98"
        y="82"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="32"
        fill="#E11D48"
        letterSpacing="-1"
        fontWeight="700"
      >
        [ {number} ]
      </text>

      {/* Center fields — blank lines handwritten at the stand, MRN pre-filled. */}
      <g fontFamily="ui-monospace, Menlo, monospace">
        <text x="230" y="40" fontSize="7" fill="#A3A3A3" letterSpacing="1.4">
          // NAME
        </text>
        <line x1="230" y1="54" x2="580" y2="54" stroke="#D4D4D4" strokeWidth="0.8" />

        <text x="230" y="70" fontSize="7" fill="#A3A3A3" letterSpacing="1.4">
          // DOB
        </text>
        <line x1="230" y1="84" x2="340" y2="84" stroke="#D4D4D4" strokeWidth="0.8" />

        <text x="360" y="70" fontSize="7" fill="#A3A3A3" letterSpacing="1.4">
          // MRN
        </text>
        <text x="360" y="84" fontSize="10" fill="#0A0A0A" fontWeight="600">
          {mrn}
        </text>

        <text x="470" y="70" fontSize="7" fill="#A3A3A3" letterSpacing="1.4">
          // ISSUED
        </text>
        <line x1="470" y1="84" x2="580" y2="84" stroke="#D4D4D4" strokeWidth="0.8" />
      </g>

      {/* Admit-by block */}
      <g fontFamily="ui-monospace, Menlo, monospace">
        <text x="604" y="40" fontSize="7" fill="#A3A3A3" letterSpacing="1.4">
          // ADMIT BY
        </text>
        <line x1="604" y1="70" x2="730" y2="70" stroke="#D4D4D4" strokeWidth="0.8" />
        <text x="604" y="84" fontSize="5" fill="#C7C7C7" letterSpacing="1.2">
          CLINICIAN OF RECORD
        </text>
      </g>

      {/* QR block — 50×50 rose-framed square with real QR image embedded. */}
      <g transform="translate(750, 30)">
        <rect x="0" y="0" width="50" height="50" fill="#FFFFFF" stroke="#E11D48" strokeWidth="1" />
        {qrDataUrl ? (
          // Set BOTH `href` (SVG 2) and `xlink:href` (SVG 1.1) so the
          // exported bracelets render in Mac Preview, older Illustrator,
          // Inkscape < 1.0, and any print-shop raster tooling. Modern
          // browsers / Figma ignore the duplication.
          <image
            href={qrDataUrl}
            xlinkHref={qrDataUrl}
            x="3"
            y="3"
            width="44"
            height="44"
            preserveAspectRatio="none"
          />
        ) : (
          // Placeholder while the QR loads or if it errors — keeps the
          // visual rhythm so the rest of the bracelet doesn't jitter.
          <rect x="3" y="3" width="44" height="44" fill="#FAFAFA" />
        )}
        {/* Rose outer corner brackets on the QR frame. */}
        <path d="M -3 -3 L 2 -3 M -3 -3 L -3 2" stroke="#E11D48" strokeWidth="1" fill="none" />
        <path d="M 53 -3 L 48 -3 M 53 -3 L 53 2" stroke="#E11D48" strokeWidth="1" fill="none" />
        <path d="M -3 53 L 2 53 M -3 53 L -3 48" stroke="#E11D48" strokeWidth="1" fill="none" />
        <path d="M 53 53 L 48 53 M 53 53 L 53 48" stroke="#E11D48" strokeWidth="1" fill="none" />
      </g>

      {/* Signature */}
      <text
        x="775"
        y="90"
        textAnchor="middle"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize="5"
        fill="#C7C7C7"
        letterSpacing="1"
      >
        by Nick Rapoport
      </text>

      {/* Serial block — № / N, big two-digit, "batch of N" footer. */}
      <g fontFamily="ui-monospace, Menlo, monospace">
        <text x="830" y="40" fontSize="7" fill="#A3A3A3" letterSpacing="1.4">
          // № / {POOL_SIZE}
        </text>
        <text x="830" y="64" fontSize="18" fill="#0A0A0A" letterSpacing="1" fontWeight="700">
          {number}
        </text>
        <text x="830" y="78" fontSize="6" fill="#A3A3A3" letterSpacing="1.2">
          batch of {spellBatch(POOL_SIZE)}
        </text>
      </g>
    </svg>
  );
};

/** Spell common pool sizes for the flavor footer, fall back to digits. */
function spellBatch(n: number): string {
  const words: Record<number, string> = {
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
  return words[n] ?? String(n);
}

export default BraceletCard;
