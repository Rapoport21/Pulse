import React from 'react';
import { PrintPreviewModal } from './PrintPreviewModal';
import { BraceletCard } from './BraceletCard';
import type { BraceletPool } from '../lib/braceletPool';
import { availableNumbers, POOL_SIZE } from '../lib/braceletPool';
import { SPACE } from './design';

/**
 * PrintBraceletsSheet — printable page of paper wristbands for the SCAD
 * demo.
 *
 * How it works: picks the next 2 un-printed (empty) bracelet numbers
 * from the pool and renders two BraceletCard strips one above the
 * other on a single letter-sized page. Operator hits "Print", the
 * browser dialog opens, they print on regular paper, scissor along
 * the dashed guide, then wrap + tape around the guest's wrist.
 *
 * Why two at a time: that's what Nick asked for — "just make 2 for
 * testing". Bumping the count later is a one-line change (see
 * `printBatchSize`).
 *
 * Design: lives inside PrintPreviewModal so the chrome matches the
 * patient-QR preview, but the print area itself is pure white + black
 * so it reproduces cleanly on any laser / inkjet printer.
 */

export interface PrintBraceletsSheetProps {
  /** Current bracelet pool — used to pick the next empty slots. */
  braceletPool: BraceletPool;
  /** How many bracelets to include on the sheet. Defaults to 2. */
  printBatchSize?: number;
  /** Close the preview. */
  onClose: () => void;
  /** True while open — drives the PrintPreviewModal mount. */
  open: boolean;
}

export const PrintBraceletsSheet: React.FC<PrintBraceletsSheetProps> = ({
  braceletPool,
  printBatchSize = 2,
  onClose,
  open,
}) => {
  // Use the first N empty slots — the ones the operator is most likely
  // to hand out next. If the pool is completely full, fall back to the
  // first N numbers regardless of state so something always renders.
  const emptyNumbers = availableNumbers(braceletPool);
  const numbers =
    emptyNumbers.length >= printBatchSize
      ? emptyNumbers.slice(0, printBatchSize)
      : braceletPool.bracelets.slice(0, printBatchSize).map((b) => b.number);

  return (
    <PrintPreviewModal
      isOpen={open}
      onClose={onClose}
      onPrint={() => window.print()}
      title={`Wristbands · ${numbers.map((n) => `#${n}`).join(' · ')}`}
      content={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.lg,
            padding: `${SPACE.md}px 0`,
            alignItems: 'center',
          }}
        >
          {numbers.map((n) => (
            <BraceletCard key={n} number={n} />
          ))}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              color: '#666',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textAlign: 'center',
              paddingTop: SPACE.md,
              borderTop: '1px dashed #CCC',
              width: '100%',
              maxWidth: 640,
            }}
          >
            Cut along dashed edge · Wrap around wrist · Tape ends
          </div>
        </div>
      }
    />
  );
};

export default PrintBraceletsSheet;

// Re-export POOL_SIZE so callers can display a friendly "N of M" counter
// without double-importing from braceletPool.
export { POOL_SIZE };
