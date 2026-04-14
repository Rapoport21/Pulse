import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QrScanner from 'qr-scanner';
import {
  X,
  ScanLine,
  AlertCircle,
  Zap,
  ZapOff,
  RotateCcw,
  Check,
  Crosshair,
} from 'lucide-react';
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
 * Aesthetics match the rest of PULSE (rose accent, mono labels, corner
 * brackets). The targeting frame is not a static centered square — it
 * HUNTS while searching (subtle scale breathing + drifting scan line +
 * rotating crosshair halo) and SNAPS to the QR's actual cornerPoints
 * the moment a decode fires, then flashes through a success state
 * before firing onScan.
 *
 * Two visual states:
 *   • HUNT  — no QR in view. Frame centered, size breathes between
 *             240px and 250px, scanning line sweeps top→bottom, crosshair
 *             ring slowly rotates. Accent color = rose.
 *   • LOCK  — QR decoded. We map qr-scanner's cornerPoints (video-space)
 *             to display-space accounting for objectFit:cover, compute
 *             a padded bbox, and spring the frame onto it. Colour
 *             transitions rose → emerald. Scan line stops. A check
 *             icon + LOCKED label appear. After 480ms we fire onScan.
 *
 * Coordinate math: qr-scanner returns cornerPoints in the native video
 * pixel space. The <video> element uses objectFit:cover, which means
 * the video is uniformly scaled to cover the display box and then
 * overflow is cropped equally on both sides. scale = max(dW/vW, dH/vH).
 * Each point is then: displayX = p.x * scale - (vW*scale - dW)/2, same
 * for y. After that we reduce the four points to a bbox and pad by 16px.
 *
 * The init effect still:
 *   1. Holds onScan in a ref so parent 1s clock ticks don't re-init.
 *   2. Uses a cancelled flag to silently exit interrupted starts.
 *   3. Re-runs on retryKey bump.
 */

interface QRScannerModalProps {
  onClose: () => void;
  onScan: (payload: string) => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Bounding-box padding around the decoded QR — gives the frame a little
// breathing room so it wraps, not hugs, the code.
const BBOX_PAD = 16;
// Default hunting-frame size (breathes between this and HUNT_SIZE + 10).
const HUNT_SIZE = 240;

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const hasDecodedRef = useRef(false);

  // Hold the latest onScan callback in a ref so parent re-renders
  // (MobileView's 1s clock tick) don't re-run the init effect.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Lock state: null = hunting, otherwise the bbox the frame should snap to.
  const [lockedBox, setLockedBox] = useState<Box | null>(null);

  // Track viewport size so we can centre the hunting frame and detect
  // orientation changes.
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0,
  });
  useEffect(() => {
    const update = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // The hunting-frame target position: dead centre, constant size.
  const huntBox: Box = useMemo(
    () => ({
      x: (viewport.w - HUNT_SIZE) / 2,
      y: (viewport.h - HUNT_SIZE) / 2,
      w: HUNT_SIZE,
      h: HUNT_SIZE,
    }),
    [viewport.w, viewport.h],
  );

  // Map cornerPoints from video-pixel space to display-pixel space.
  // qr-scanner's detailed scan result gives us four points in the
  // source video's native coordinates. Because the <video> element
  // uses objectFit:cover, we have to account for the uniform scale
  // applied + the crop offset.
  const mapCornersToBox = useCallback(
    (
      points: { x: number; y: number }[],
      videoEl: HTMLVideoElement,
    ): Box | null => {
      const vW = videoEl.videoWidth;
      const vH = videoEl.videoHeight;
      const dW = videoEl.clientWidth;
      const dH = videoEl.clientHeight;
      if (!vW || !vH || !dW || !dH) return null;

      const scale = Math.max(dW / vW, dH / vH);
      const offsetX = (vW * scale - dW) / 2;
      const offsetY = (vH * scale - dH) / 2;

      const displayPts = points.map((p) => ({
        x: p.x * scale - offsetX,
        y: p.y * scale - offsetY,
      }));

      const xs = displayPts.map((p) => p.x);
      const ys = displayPts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      // Enforce a minimum frame size — tiny QRs should still get a
      // visible lock frame.
      const w = Math.max(maxX - minX + BBOX_PAD * 2, 80);
      const h = Math.max(maxY - minY + BBOX_PAD * 2, 80);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      return { x: cx - w / 2, y: cy - h / 2, w, h };
    },
    [],
  );

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let cancelled = false;
    let scanner: QrScanner | null = null;

    setError(null);
    setStarted(false);
    setLockedBox(null);
    hasDecodedRef.current = false;

    const init = async () => {
      try {
        const cameraAvailable = await QrScanner.hasCamera();
        if (cancelled) return;
        if (!cameraAvailable) {
          setError(
            'No camera detected. If you are running in the iOS Simulator, cameras are not supported — install on a real iPhone to test.',
          );
          return;
        }

        scanner = new QrScanner(
          videoEl,
          (result) => {
            if (hasDecodedRef.current) return;
            hasDecodedRef.current = true;
            triggerHaptic('medium');

            const el = videoRef.current;
            const bbox = el
              ? mapCornersToBox(result.cornerPoints, el)
              : null;
            if (bbox) setLockedBox(bbox);

            // Give the snap animation time to play before tearing down
            // the modal. 480ms feels like a decisive "target acquired"
            // moment without dragging the user.
            window.setTimeout(() => {
              onScanRef.current(result.data);
            }, 480);
          },
          {
            returnDetailedScanResult: true,
            preferredCamera: 'environment',
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond: 5,
          },
        );
        scannerRef.current = scanner;

        await scanner.start();
        if (cancelled) {
          scanner.stop();
          scanner.destroy();
          return;
        }

        setStarted(true);

        try {
          const flashAvailable = await scanner.hasFlash();
          if (!cancelled) setHasFlash(flashAvailable);
        } catch {
          if (!cancelled) setHasFlash(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;

        const raw = err instanceof Error ? err.message : String(err);
        const msg = raw.toLowerCase();

        if (
          msg.includes('permission') ||
          msg.includes('denied') ||
          msg.includes('notallowed')
        ) {
          setError(
            'Camera permission denied. Open Settings → PULSE → Camera, toggle it on, then tap RETRY.',
          );
        } else if (
          msg.includes('not found') ||
          msg.includes('notfound') ||
          msg.includes('no camera')
        ) {
          setError(
            'No camera detected. If you are running in the iOS Simulator, cameras are not supported — install on a real iPhone to test.',
          );
        } else if (msg.includes('secure') || msg.includes('https')) {
          setError(
            'Camera access requires HTTPS or localhost. Open the app over a secure origin.',
          );
        } else if (msg.includes('abort')) {
          setError('Scanner init was interrupted. Tap RETRY to try again.');
        } else if (msg.includes('in use') || msg.includes('notreadable')) {
          setError(
            'Camera is in use by another app. Close other camera apps (FaceTime, Camera, Zoom) and tap RETRY.',
          );
        } else {
          setError(`Camera error: ${raw}`);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (scanner) {
        try {
          scanner.stop();
          scanner.destroy();
        } catch {
          // ignore
        }
      }
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey, mapCornersToBox]);

  const toggleFlash = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner || !hasFlash) return;
    try {
      await scanner.toggleFlash();
      setFlashOn(scanner.isFlashOn());
      triggerHaptic('light');
    } catch {
      // ignore
    }
  }, [hasFlash]);

  const handleRetry = useCallback(() => {
    triggerHaptic('light');
    setRetryKey((n) => n + 1);
  }, []);

  // Current frame target — when locked, the QR bbox; otherwise the
  // centered hunting frame.
  const target = lockedBox ?? huntBox;
  const isLocked = !!lockedBox;
  const frameColor = isLocked ? COLORS.ok : COLORS.accent;
  const frameColorDim = isLocked ? COLORS.okDim : COLORS.accentDim;
  const frameGlow = isLocked
    ? 'rgba(16, 185, 129, 0.5)'
    : 'rgba(225, 29, 72, 0.45)';

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
      {/* Video surface — covers entire viewport behind the HUD */}
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

      {/* Dimming mask — darkens everything outside the target frame so
          the user's eye is drawn to it. We paint four opaque rectangles
          (top / bottom / left / right of the target) to leave a clear
          window over the frame itself. */}
      {!error && viewport.w > 0 && (
        <MaskOverlay
          target={target}
          viewport={viewport}
          locked={isLocked}
        />
      )}

      {/* Top gradient + header row */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.md}px ${SPACE.base}px`,
          paddingTop: `calc(${SPACE.md}px + env(safe-area-inset-top))`,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.88), rgba(0,0,0,0))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <ScanLine
            size={14}
            strokeWidth={1.75}
            color={isLocked ? COLORS.ok : COLORS.accent}
          />
          <BracketLabel tone={isLocked ? 'ok' : 'accent'}>
            {isLocked ? 'TARGET LOCKED' : 'QR SCANNER'}
          </BracketLabel>
        </div>
        <div style={{ display: 'flex', gap: SPACE.sm }}>
          {hasFlash && !error && (
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

      {/* Targeting frame — absolutely positioned, springs to the
          decoded QR bbox when locked, breathes in the centre while
          hunting. */}
      {!error && (
        <motion.div
          animate={{
            x: target.x,
            y: target.y,
            width: target.w,
            height: target.h,
          }}
          transition={
            isLocked
              ? { type: 'spring', stiffness: 280, damping: 26, mass: 0.8 }
              : { duration: MOTION.base, ease: MOTION.ease }
          }
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          {/* Inner breather — a slow 2.4s scale pulse while hunting,
              frozen at 1 on lock. Gives the HUD that alive feel even
              when no motion is happening at the bbox level. */}
          <motion.div
            animate={
              isLocked
                ? { scale: [1, 1.04, 1] }
                : { scale: [1, 1.02, 1] }
            }
            transition={
              isLocked
                ? { duration: 0.48, ease: MOTION.ease, times: [0, 0.4, 1] }
                : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
            }
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: RADIUS.sm,
              border: `1px solid ${frameColorDim}`,
              boxShadow: `0 0 0 1px ${frameColorDim} inset, 0 0 24px ${frameGlow}`,
              transition: `border-color ${MOTION.base}s ${MOTION.ease as unknown as string}, box-shadow ${MOTION.base}s ${MOTION.ease as unknown as string}`,
            }}
          />

          {/* Corner brackets — rose while hunting, emerald when locked.
              Use a key on the color so they smoothly re-render. */}
          <CornerBracket
            position="tl"
            color={frameColor}
            size={30}
            thickness={2}
            inset={-1}
          />
          <CornerBracket
            position="tr"
            color={frameColor}
            size={30}
            thickness={2}
            inset={-1}
          />
          <CornerBracket
            position="bl"
            color={frameColor}
            size={30}
            thickness={2}
            inset={-1}
          />
          <CornerBracket
            position="br"
            color={frameColor}
            size={30}
            thickness={2}
            inset={-1}
          />

          {/* Scanning sweep line — only while hunting. Hidden on lock. */}
          {started && !isLocked && (
            <motion.div
              initial={{ top: 0 }}
              animate={{ top: ['0%', 'calc(100% - 2px)', '0%'] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                left: 6,
                right: 6,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${COLORS.accent}, ${COLORS.accentBright}, ${COLORS.accent}, transparent)`,
                boxShadow: `0 0 14px ${COLORS.accent}, 0 0 28px rgba(225, 29, 72, 0.4)`,
              }}
            />
          )}

          {/* Crosshair — centered in the frame while hunting, fades out on lock */}
          <AnimatePresence>
            {!isLocked && started && (
              <motion.div
                key="crosshair"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.85, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 14,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: RADIUS.full,
                    border: `1px dashed ${COLORS.accent}88`,
                  }}
                />
                <Crosshair
                  size={18}
                  strokeWidth={1.5}
                  color={COLORS.accent}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirmation check — appears on lock, scales up with a tiny
              bloom */}
          <AnimatePresence>
            {isLocked && (
              <motion.div
                key="lock-check"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{
                  duration: MOTION.base,
                  ease: MOTION.ease,
                  delay: 0.08,
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 54,
                  height: 54,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: RADIUS.full,
                  background: COLORS.okDim,
                  border: `1px solid ${COLORS.ok}`,
                  boxShadow: `0 0 24px ${COLORS.ok}55`,
                }}
              >
                <Check size={24} strokeWidth={2.5} color={COLORS.ok} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(88%, 360px)',
            padding: SPACE.base,
            background: COLORS.surface,
            border: `1px solid ${COLORS.crit}`,
            borderRadius: RADIUS.sm,
            zIndex: 5,
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
              marginBottom: SPACE.base,
              fontFamily: FONTS.sans,
              fontSize: 13,
              color: COLORS.textSecondary,
              lineHeight: 1.45,
            }}
          >
            {error}
          </p>
          <div
            style={{
              display: 'flex',
              gap: SPACE.sm,
              justifyContent: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleRetry}
              style={{
                minHeight: 40,
                padding: `0 ${SPACE.md}px`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACE.xs,
                background: COLORS.surfaceElev,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: RADIUS.sm,
                color: COLORS.accent,
                cursor: 'pointer',
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              <RotateCcw size={12} />
              <span>RETRY</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              style={{
                minHeight: 40,
                padding: `0 ${SPACE.md}px`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACE.xs,
                background: COLORS.surfaceElev,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                cursor: 'pointer',
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Bottom gradient + hint + status strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.xl}px ${SPACE.base}px ${SPACE.lg}px`,
          paddingBottom: `calc(${SPACE.lg}px + env(safe-area-inset-bottom))`,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.92), rgba(0,0,0,0))',
          textAlign: 'center',
          zIndex: 4,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={error ? 'err' : isLocked ? 'lock' : started ? 'hunt' : 'req'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <Mono
              tone={
                error
                  ? 'crit'
                  : isLocked
                    ? 'ok'
                    : started
                      ? 'accent'
                      : 'secondary'
              }
              size="xs"
            >
              {error
                ? 'SCANNER OFFLINE'
                : isLocked
                  ? 'TARGET ACQUIRED · OPENING'
                  : started
                    ? 'SEARCHING FOR QR CODE'
                    : 'REQUESTING CAMERA…'}
            </Mono>
            {!error && started && !isLocked && (
              <Mono tone="muted" size="xs">
                ALIGN CODE INSIDE THE BRACKETS
              </Mono>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MaskOverlay — four translucent black rectangles that surround the
// target frame, leaving a clear viewport over the frame itself. The
// rectangles animate with the target so the clear window always
// follows the QR snap.
// ─────────────────────────────────────────────────────────────────────
interface MaskOverlayProps {
  target: Box;
  viewport: { w: number; h: number };
  locked: boolean;
}

const MaskOverlay: React.FC<MaskOverlayProps> = ({ target, viewport, locked }) => {
  const dim = locked ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.52)';
  const base = {
    position: 'absolute' as const,
    background: dim,
    zIndex: 1,
    pointerEvents: 'none' as const,
    transition: `background ${MOTION.base}s ${MOTION.ease as unknown as string}`,
  };
  return (
    <>
      {/* top */}
      <motion.div
        animate={{ height: Math.max(target.y, 0) }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{ ...base, top: 0, left: 0, right: 0 }}
      />
      {/* bottom */}
      <motion.div
        animate={{
          top: target.y + target.h,
          height: Math.max(viewport.h - (target.y + target.h), 0),
        }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{ ...base, left: 0, right: 0 }}
      />
      {/* left */}
      <motion.div
        animate={{
          top: target.y,
          height: target.h,
          width: Math.max(target.x, 0),
        }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{ ...base, left: 0 }}
      />
      {/* right */}
      <motion.div
        animate={{
          top: target.y,
          height: target.h,
          left: target.x + target.w,
          width: Math.max(viewport.w - (target.x + target.w), 0),
        }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{ ...base }}
      />
    </>
  );
};
