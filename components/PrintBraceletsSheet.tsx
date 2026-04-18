import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { PrintPreviewModal } from './PrintPreviewModal';
import { BraceletCard } from './BraceletCard';
import { TacticalButton } from './design';
import type { BraceletPool } from '../lib/braceletPool';
import { availableNumbers, POOL_SIZE } from '../lib/braceletPool';

/**
 * PrintBraceletsSheet — landscape letter page of v8 admit bands.
 *
 * Layout: three 10" × 1" bracelets stacked vertically with 1.5" gaps,
 * centered on an 11" × 8.5" landscape letter page. A `@media print`
 * style tag switches the browser's @page orientation to landscape and
 * zeros the default margins for the duration the sheet is mounted.
 *
 * Two output paths from the sheet:
 *  1. Print — browser print dialog. User must pick a color printer
 *     (rose accent won't survive on B/W), set margins to None, and
 *     uncheck "Fit to page" for true 10" bracelets.
 *  2. Export SVG — downloads a single standalone .svg with all N
 *     bracelets stacked, openable in Figma / Illustrator / print
 *     shop tooling. No app dependency — the file is self-contained.
 *
 * The PrintPreviewModal is rendered chromeless so the SCAD bracelet
 * sheet doesn't show a "PULSE OPS · CONFIDENTIAL" document header
 * above the bands.
 */

export interface PrintBraceletsSheetProps {
  /** Current bracelet pool — used to pick the next empty slots. */
  braceletPool: BraceletPool;
  /** How many bracelets to include on the sheet. Defaults to 3. */
  printBatchSize?: number;
  /** Close the preview. */
  onClose: () => void;
  /** True while open — drives the PrintPreviewModal mount. */
  open: boolean;
}

/**
 * Serialize all rendered bracelet SVGs into a single standalone SVG and
 * trigger a browser download. Runs client-side only.
 */
function downloadBraceletSvg(
  container: HTMLElement,
  numbers: string[],
): void {
  const svgs = container.querySelectorAll<SVGElement>('svg.pulse-bracelet-svg');
  if (svgs.length === 0) return;

  // Vertical stack with a 20-unit gap between bands, matching the
  // visual rhythm of the printed sheet (1.5" gap at real size →
  // 20 svg units out of 100 per band).
  const BAND_H = 100;
  const GAP = 20;
  const WIDTH = 1000;
  const HEIGHT = svgs.length * BAND_H + Math.max(0, svgs.length - 1) * GAP;

  const serializer = new XMLSerializer();
  const groups: string[] = [];
  svgs.forEach((svg, i) => {
    const y = i * (BAND_H + GAP);
    // Serialize the inner markup only — we're re-wrapping with a new
    // outer <svg>. Clone so any in-flight React updates don't race.
    const cloned = svg.cloneNode(true) as SVGElement;
    const innerParts: string[] = [];
    cloned.childNodes.forEach((child) => {
      innerParts.push(serializer.serializeToString(child));
    });
    groups.push(
      `<g transform="translate(0, ${y})">${innerParts.join('')}</g>`,
    );
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
  a.download = `pulse-bracelets-${numbers.join('-')}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Keep the blob URL alive long enough for the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PrintBraceletsSheet: React.FC<PrintBraceletsSheetProps> = ({
  braceletPool,
  printBatchSize = 3,
  onClose,
  open,
}) => {
  const previewRef = useRef<HTMLDivElement>(null);

  // Pick the first N empty numbers. If the pool is full, fall back to
  // the first N regardless of state so preview always renders.
  const emptyNumbers = availableNumbers(braceletPool);
  const numbers =
    emptyNumbers.length >= printBatchSize
      ? emptyNumbers.slice(0, printBatchSize)
      : braceletPool.bracelets.slice(0, printBatchSize).map((b) => b.number);

  return (
    <>
      {/* Landscape letter page rule — only mounted while the sheet is open. */}
      {open && (
        <style>
          {`@media print { @page { size: letter landscape; margin: 0; } }`}
        </style>
      )}
      <PrintPreviewModal
        isOpen={open}
        onClose={onClose}
        onPrint={() => window.print()}
        chromeless
        title={`Wristbands · ${numbers.map((n) => `#${n}`).join(' · ')}`}
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
            // Landscape letter proportions (11:8.5). `aspectRatio` keeps
            // the preview honest about how bands will arrange on paper.
            style={{
              width: '100%',
              maxWidth: 1056, // 11" @ 96dpi
              aspectRatio: '11 / 8.5',
              margin: '0 auto',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              padding: '0.75in 0.5in',
              boxSizing: 'border-box',
              gap: '0.25in',
            }}
          >
            {numbers.map((n) => (
              <BraceletCard key={n} number={n} />
            ))}
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
