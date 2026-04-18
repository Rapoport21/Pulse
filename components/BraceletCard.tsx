import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import { FONTS } from './design';
import { braceletQRPayload, type BraceletNumber } from '../lib/braceletPool';

/**
 * BraceletCard — a printable medical wristband for the SCAD bracelet demo.
 *
 * Black on white, portrait-oriented strip sized to wrap a human wrist.
 * Designed for regular 8.5×11" paper (or A4): four strips per sheet when
 * arranged in a 2×2 grid. Each strip is ~180mm × 45mm, leaves ~5mm margin
 * for scissor trimming, and has a dashed cut line at the edge.
 *
 * Why paper for now: Nick is going to design a proper vinyl/Tyvek
 * bracelet later. This gets us physically testable wristbands today.
 *
 * Payload: `pulse://bracelet/<number>` (see `lib/braceletPool.ts`).
 * Scans land in MobileView's `handleQRScan` → if the slot is linked,
 * opens that patient's chart; if empty, offers to admit with this
 * bracelet pre-selected.
 *
 * Visual language: HUGE number for ID at a glance, mono brand mark,
 * a small QR below. No color — pure black on white so copier/laser
 * printers reproduce it cleanly.
 */

export interface BraceletCardProps {
  /** Two-digit bracelet number. */
  number: BraceletNumber;
  /** Include dashed scissor-guide. Defaults to true. */
  cutLine?: boolean;
}

export const BraceletCard: React.FC<BraceletCardProps> = ({ number, cutLine = true }) => {
  const payload = useMemo(() => braceletQRPayload(number), [number]);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <div
      style={{
        // Horizontal strip — long & thin, wraps the wrist.
        width: '180mm',
        minHeight: '45mm',
        background: '#FFFFFF',
        color: '#000000',
        padding: '4mm 6mm',
        display: 'flex',
        alignItems: 'center',
        gap: '6mm',
        border: '1px solid #000000',
        borderRadius: 2,
        boxSizing: 'border-box',
        position: 'relative',
        fontFamily: FONTS.sans,
      }}
    >
      {/* Left: brand + "PATIENT ID" label stack */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2mm',
          minWidth: '28mm',
          borderRight: '1px solid #000000',
          paddingRight: '6mm',
          alignSelf: 'stretch',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
          }}
        >
          PULSE
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 6.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#000000',
          }}
        >
          Patient ID
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 6.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#000000',
            opacity: 0.7,
          }}
        >
          SCAD · 2026
        </div>
      </div>

      {/* Center: BIG number — the dominant element */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#000000',
          }}
        >
          {number}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 7,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginTop: '1.5mm',
            color: '#000000',
          }}
        >
          Bracelet Number
        </div>
      </div>

      {/* Right: QR */}
      <div
        style={{
          flexShrink: 0,
          width: '32mm',
          height: '32mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
        }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR bracelet ${number}`}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : error ? (
          <div style={{ fontSize: 8, color: '#000000' }}>QR error</div>
        ) : (
          <div style={{ fontSize: 8, color: '#000000' }}>…</div>
        )}
      </div>

      {/* Cut guide — a thin dashed line on the top edge so you know
          where to scissor the strip from the sheet. */}
      {cutLine && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -3,
            height: 0,
            borderTop: '1px dashed #000000',
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
};

export default BraceletCard;
