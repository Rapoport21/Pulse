import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import QrScanner from 'qr-scanner';
import { X, QrCode, AlertCircle, Zap, ZapOff } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  Mono,
  BracketLabel,
  CornerBracket,
} from './design';
import { triggerHaptic } from '../lib/haptics';

/**
 * QRScannerModal — fullscreen tactical camera view that decodes QR codes.
 *
 * Uses the `qr-scanner` JS library (Nimiq). No native Capacitor plugin
 * required — works identically in:
 *   • iOS WebView inside the Capacitor shell (real iPhone)
 *   • Mobile Safari over HTTPS / localhost
 *   • Desktop Chrome/Safari via laptop webcam
 *   • Android Chrome
 *
 * Will NOT work in the iOS Simulator because the simulator has no
 * camera device — that's an Apple limitation, not ours. On device
 * the first open triggers the standard iOS camera permission
 * dialog (driven by NSCameraUsageDescription in Info.plist).
 *
 * Design: black background, centered 260x260 reticle with corner
 * brackets in info-blue, slow vertical scan line, dim footer hint,
 * bracket-frame close button top-right. Matches the tactical HUD
 * aesthetic used everywhere else in the app.
 */

interface QRScannerModalProps {
  onClose: () => void;
  onScan: (payload: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const hasDecodedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const scanner = new QrScanner(
      videoEl,
      (result) => {
        // Gate to a single decode per session so rapid-fire frames
        // don't double-fire the handler before the modal unmounts.
        if (hasDecodedRef.current) return;
        hasDecodedRef.current = true;
        triggerHaptic('medium');
        onScan(result.data);
      },
      {
        returnDetailedScanResult: true,
        preferredCamera: 'environment',
        // Let us draw our own reticle in the React tree — don't
        // inject the library's default highlight overlays.
        highlightScanRegion: false,
        highlightCodeOutline: false,
        maxScansPerSecond: 5,
      },
    );
    scannerRef.current = scanner;

    scanner
      .start()
      .then(async () => {
        setStarted(true);
        try {
          const hasIt = await scanner.hasFlash();
          setHasFlash(hasIt);
        } catch {
          setHasFlash(false);
        }
      })
      .catch((err: unknown) => {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = raw.toLowerCase();
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
          setError(
            'Camera permission denied. Enable it in Settings → PULSE → Camera, then reopen the scanner.',
          );
        } else if (msg.includes('not found') || msg.includes('notfound') || msg.includes('no camera')) {
          setError(
            'No camera detected. This device has no available camera, or you are running in the iOS Simulator (which has no camera — test on a real device).',
          );
        } else if (msg.includes('secure') || msg.includes('https')) {
          setError(
            'Camera access requires HTTPS or localhost. Open the app over a secure origin.',
          );
        } else {
          setError(`Camera error: ${raw}`);
        }
      });

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [onScan]);

  const toggleFlash = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !hasFlash) return;
    try {
      await scanner.toggleFlash();
      setFlashOn(scanner.isFlashOn());
      triggerHaptic('light');
    } catch {
      // ignore
    }
  };

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
        background: '#000',
        overflow: 'hidden',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="QR code scanner"
    >
      {/* Video surface — covers the entire viewport, behind the chrome */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#000',
        }}
        muted
        playsInline
      />

      {/* Top gradient + header row with label and close button */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.md}px ${SPACE.base}px`,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <QrCode size={14} strokeWidth={1.75} color={COLORS.info} />
          <BracketLabel tone="primary">QR SCANNER</BracketLabel>
        </div>
        <div style={{ display: 'flex', gap: SPACE.sm }}>
          {hasFlash && (
            <button
              type="button"
              onClick={toggleFlash}
              aria-label={flashOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              style={{
                minHeight: 44,
                minWidth: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(10,10,10,0.65)',
                border: `1px solid ${flashOn ? COLORS.warn : COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: flashOn ? COLORS.warn : COLORS.textPrimary,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {flashOn ? <Zap size={16} /> : <ZapOff size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            aria-label="Close scanner"
            style={{
              minHeight: 44,
              minWidth: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(10,10,10,0.65)',
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Targeting reticle — absolutely centered 260x260 square with
          four corner brackets and a slow vertical scan line. Only
          visible when the camera started successfully. */}
      {!error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 260,
            height: 260,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <CornerBracket position="tl" color={COLORS.info} size={26} thickness={2} inset={0} />
          <CornerBracket position="tr" color={COLORS.info} size={26} thickness={2} inset={0} />
          <CornerBracket position="bl" color={COLORS.info} size={26} thickness={2} inset={0} />
          <CornerBracket position="br" color={COLORS.info} size={26} thickness={2} inset={0} />
          {started && (
            <motion.div
              initial={{ top: '0%' }}
              animate={{ top: ['0%', 'calc(100% - 2px)', '0%'] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${COLORS.info}, transparent)`,
                boxShadow: `0 0 12px ${COLORS.info}`,
              }}
            />
          )}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(88%, 340px)',
            padding: SPACE.base,
            background: COLORS.surface,
            border: `1px solid ${COLORS.crit}`,
            borderRadius: RADIUS.sm,
            zIndex: 3,
            textAlign: 'center',
          }}
        >
          <AlertCircle
            size={22}
            color={COLORS.crit}
            style={{ margin: '0 auto', display: 'block' }}
          />
          <div style={{ marginTop: SPACE.sm }}>
            <BracketLabel tone="crit">CAMERA UNAVAILABLE</BracketLabel>
          </div>
          <p
            style={{
              marginTop: SPACE.sm,
              marginBottom: 0,
              fontFamily: FONTS.sans,
              fontSize: 13,
              color: COLORS.textSecondary,
              lineHeight: 1.45,
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Bottom gradient + hint line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.xl}px ${SPACE.base}px ${SPACE.lg}px`,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0))',
          textAlign: 'center',
          zIndex: 2,
        }}
      >
        <Mono tone={error ? 'crit' : 'secondary'} size="xs">
          {error
            ? 'SCANNER OFFLINE'
            : started
              ? 'ALIGN QR CODE WITHIN TARGET'
              : 'REQUESTING CAMERA…'}
        </Mono>
      </div>
    </motion.div>
  );
};
