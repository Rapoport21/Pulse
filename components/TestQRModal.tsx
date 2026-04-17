import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import { X, QrCode } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  Mono,
  BracketLabel,
  BracketFrame,
} from './design';
import { triggerHaptic } from '../lib/haptics';

/**
 * TestQRModal — fullscreen display of a scannable QR code so the
 * user can exercise the scanner on a real device.
 *
 * The QR encodes a `pulse://` deep-link payload that the scanner
 * parses. Format:
 *   pulse://tab/<tabname>
 *
 * Example payloads:
 *   pulse://tab/patients   → open Patients tab
 *   pulse://tab/dashboard  → open Dashboard tab
 *   pulse://tab/alerts     → open Alerts tab
 *
 * The QR is rendered white-on-black (inverted from typical) only
 * for the surrounding chrome; the actual code is black-on-white
 * for maximum scan reliability. The card contains a white inset
 * with the QR drawn onto it — the white plate is essential because
 * camera-based decoders need high contrast between modules and
 * background.
 */

interface TestQRModalProps {
  payload: string;
  label: string;
  sublabel: string;
  onClose: () => void;
}

export const TestQRModal: React.FC<TestQRModalProps> = ({
  payload,
  label,
  sublabel,
  onClose,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 640, // Upscaled; CSS will size it down. Larger source => crisper zoom.
      color: {
        dark: '#050505', // near-black, matches canvas bg token
        light: '#FAFAFA', // near-white, matches textPrimary token
      },
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (alive) setError(msg);
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.modal + 10,
        background: COLORS.bgDeep,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACE.base,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Test QR code"
    >
      {/* Header row */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.md}px ${SPACE.base}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <QrCode size={14} strokeWidth={1.75} color={COLORS.info} />
          <BracketLabel tone="primary">TEST SCAN TARGET</BracketLabel>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          aria-label="Close test QR"
          style={{
            minHeight: 44,
            minWidth: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textPrimary,
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* QR plate — framed by bracket corners, white inset for max scan contrast */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: MOTION.base, ease: MOTION.ease, delay: 0.05 }}
        style={{
          position: 'relative',
          padding: SPACE.lg,
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: RADIUS.sm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: SPACE.md,
        }}
      >
        <BracketFrame color={COLORS.info} size={14} />
        <div
          style={{
            width: 280,
            height: 280,
            background: '#FAFAFA',
            padding: SPACE.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="QR code"
              width={256}
              height={256}
              style={{
                imageRendering: 'pixelated',
                display: 'block',
                width: 256,
                height: 256,
              }}
            />
          ) : error ? (
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: COLORS.crit,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          ) : (
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: COLORS.textMuted,
              }}
            >
              ENCODING…
            </div>
          )}
        </div>

        {/* Label + sublabel */}
        <div style={{ textAlign: 'center' }}>
          <div>
            <BracketLabel tone="primary">{label}</BracketLabel>
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.textSecondary,
              letterSpacing: '-0.005em',
            }}
          >
            {sublabel}
          </div>
        </div>

        {/* Raw payload — debugging aid */}
        <div
          style={{
            marginTop: SPACE.xs,
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            background: COLORS.bg,
            border: `1px dashed ${COLORS.border}`,
            borderRadius: RADIUS.sm,
          }}
        >
          <Mono tone="muted" size="xs">
            {payload}
          </Mono>
        </div>
      </motion.div>

      {/* Footer hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.lg}px ${SPACE.base}px`,
          textAlign: 'center',
        }}
      >
        <Mono tone="dim" size="xs">
          POINT PULSE SCANNER ON ANOTHER DEVICE AT THIS CODE
        </Mono>
      </div>
    </motion.div>
  );
};
