import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { PrintPreviewModal } from './PrintPreviewModal';
import { BraceletCard } from './BraceletCard';
import { TacticalButton, COLORS, FONTS, SPACE } from './design';
import type { BraceletPool, BraceletNumber } from '../lib/braceletPool';
import { availableNumbers, POOL_SIZE } from '../lib/braceletPool';

/**
 * PrintBraceletsSheet — full pre-print flow for v8 admit bands.
 *
 * Shows every empty slot in the pool (defaults to all 20 for a fresh
 * pool) grouped into landscape letter pages of 3 bracelets each.
 * On-screen the pages are stacked vertically and scrollable so Nick
 * can review every band before hitting print. On paper, each page
 * prints on its own physical sheet via `page-break-after: always`.
 *
 * Two output paths:
 *   1. Print → browser print dialog. User sets margins to None and
 *      unchecks "Fit to page" for true 10" × 1" bands.
 *   2. Export SVG → one standalone .svg with every bracelet stacked,
 *      for Figma / Illustrator / print-shop handoff.
 *
 * The `PrintPreviewModal` is rendered chromeless so the "PULSE OPS ·
 * CONFIDENTIAL" report header is hidden — bracelet sheets have their
 * own design identity.
 */

export interface PrintBraceletsSheetProps {
  /** Current bracelet pool — used to pick empty slots. */
  braceletPool: BraceletPool;
  /**
   * Override how many bracelets to include. If omitted, include every
   * empty slot in the pool. For initial pre-print this yields all 20.
   */
  printBatchSize?: number;
  /** Close the preview. */
  onClose: () => void;
  /** True while open — drives the PrintPreviewModal mount. */
  open: boolean;
}

/** Each printed letter sheet holds this many bracelets. */
const BRACELETS_PER_PAGE = 3;

/** Bracelet viewBox is 1000 × 100; used for SVG export layout. */
const BAND_W = 1000;
const BAND_H = 100;
const EXPORT_GAP = 20;

/**
 * Chunk an array into fixed-size groups. Used to split the pool into
 * physical print pages of 3.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Serialize all rendered bracelet SVGs into a single standalone SVG and
 * trigger a browser download. Self-contained — the resulting file opens
 * in any SVG viewer without needing the app.
 */
function downloadBraceletSvg(
  container: HTMLElement,
  numbers: BraceletNumber[],
): void {
  // Select by data attribute rather than class — more reliable across
  // React's SVG className handling and survives CSS module scoping.
  const svgs = container.querySelectorAll<SVGElement>('svg[data-bracelet-number]');
  if (svgs.length === 0) {
    console.warn('[PrintBraceletsSheet] No bracelet SVGs found to export.');
    return;
  }

  const WIDTH = BAND_W;
  const HEIGHT = svgs.length * BAND_H + Math.max(0, svgs.length - 1) * EXPORT_GAP;

  const serializer = new XMLSerializer();
  const groups: string[] = [];
  svgs.forEach((svg, i) => {
    const y = i * (BAND_H + EXPORT_GAP);
    // Serialize each child of the source SVG and re-wrap in a new <g>.
    // Cloning avoids racing with React's in-flight QR data URL writes.
    const cloned = svg.cloneNode(true) as SVGElement;
    const innerParts: string[] = [];
    cloned.childNodes.forEach((child) => {
      innerParts.push(serializer.serializeToString(child));
    });
    groups.push(`<g transform="translate(0, ${y})">${innerParts.join('')}</g>`);
  });

  const doc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
${groups.join('\n')}
</svg>
`;

  const blob = new Blob([doc], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse-bracelets-${numbers[0]}-${numbers[numbers.length - 1]}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PrintBraceletsSheet: React.FC<PrintBraceletsSheetProps> = ({
  braceletPool,
  printBatchSize,
  onClose,
  open,
}) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // Default behavior: every empty slot in the pool. For a fresh pool
  // that's all 20 — exactly what Nick wants for a pre-event print run.
  // If the pool is totally empty of empties (full house), fall back to
  // all slots so the preview always renders something.
  const emptyNumbers = availableNumbers(braceletPool);
  const baseNumbers: BraceletNumber[] =
    emptyNumbers.length > 0
      ? emptyNumbers
      : braceletPool.bracelets.map((b) => b.number);
  const numbers = printBatchSize
    ? baseNumbers.slice(0, printBatchSize)
    : baseNumbers;

  const pages = chunk(numbers, BRACELETS_PER_PAGE);
  const pageCount = pages.length;

  return (
    <>
      {/* Print-only styles — mounted while the sheet is open. Forces
          landscape letter orientation, zeroes the default page margin,
          and inserts a hard page break between each bracelet page. */}
      {open && (
        <style>{`
          @media print {
            @page { size: letter landscape; margin: 0; }
            .bracelet-page {
              page-break-after: always;
              break-after: page;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .bracelet-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
          }
        `}</style>
      )}
      <PrintPreviewModal
        isOpen={open}
        onClose={onClose}
        onPrint={() => window.print()}
        chromeless
        title={`Wristbands · ${numbers.length} bands · ${pageCount} page${pageCount === 1 ? '' : 's'}`}
        footerHint="In the print dialog: margins = None · uncheck Fit to page"
        extraActions={
          <TacticalButton
            variant="secondary"
            size="sm"
            icon={<Download size={13} strokeWidth={2} />}
            onClick={() => {
              if (previewRef.current) {
                downloadBraceletSvg(previewRef.current, numbers);
              }
            }}
          >
            Export SVG
          </TacticalButton>
        }
        content={
          <div
            ref={previewRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
              padding: SPACE.lg,
              background: '#F5F5F5',
            }}
          >
            {pages.map((pageNumbers, pageIdx) => (
              <div
                key={pageIdx}
                className="bracelet-page"
                style={{
                  width: '100%',
                  maxWidth: 1056, // 11" @ 96dpi for screen preview
                  aspectRatio: '11 / 8.5',
                  margin: '0 auto',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-around',
                  padding: '0.75in 0.5in',
                  boxSizing: 'border-box',
                  position: 'relative',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                }}
              >
                {/* Tiny page indicator — visible on screen, hidden on print */}
                <div
                  className="bracelet-page-label"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 12,
                    fontFamily: FONTS.mono,
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: COLORS.textMuted,
                    textTransform: 'uppercase',
                  }}
                >
                  PAGE {pageIdx + 1} / {pageCount}
                </div>
                {pageNumbers.map((n) => (
                  <BraceletCard key={n} number={n} />
                ))}
              </div>
            ))}
            {/* On-print: hide the page label. On-screen it's useful
                wayfinding; on paper it's noise. */}
            <style>{`
              @media print {
                .bracelet-page-label { display: none !important; }
                .bracelet-page { box-shadow: none !important; margin: 0 !important; }
              }
            `}</style>
          </div>
        }
      />
    </>
  );
};

export default PrintBraceletsSheet;

// Re-export POOL_SIZE so callers can display a friendly "N of M" counter
// without double-importing from braceletPool.
export { POOL_SIZE };
