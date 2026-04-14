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
 * QRScannerModal — fullscreen tactical camera view.
 *
 * Two distinct states, both rendered as a HUD over the live feed:
 *
 *   HUNT   — No QR yet. A small corner-bracket reticle sweeps a
 *            5-waypoint circuit across the viewfinder (TL → TR → C →
 *            BR → BL → loop). A full-screen dimming mask follows the
 *            reticle so the bright window tracks with it. An ambient
 *            horizontal scan line races the full viewport top→bottom
 *            on a 3s loop. Viewport corner brackets anchor the edges.
 *            The bottom status strip reports the active sector.
 *
 *   LOCK   — QR decoded. cornerPoints from qr-scanner's detailed
 *            result are mapped from video-pixel space into display
 *            coordinates (accounting for objectFit:cover scale +
 *            crop), reduced to a padded bbox, and the reticle springs
 *            onto that bbox. The acquisition sequence plays in
 *            parallel:
 *              • two radial "sonar" rings emanate from the QR center
 *              • the reticle's corner brackets scale-pulse (pop) on
 *                snap, then settle
 *              • a vertical scan sweep races across the locked bbox
 *                once (left→right), fading on exit
 *              • colour flips rose → emerald
 *              • a "LOCK" tag appears above the top-right bracket
 *              • the ambient viewfinder scan line fades out
 *            After 520ms we fire onScan.
 *
 * The init / permission / flash / retry plumbing is unchanged from
 * the prior rev — including the onScan ref trick that prevents the
 * parent's 1s clock tick from re-running the init effect.
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

const RETICLE_SIZE = 150; // baseline hunt-reticle square
const BBOX_PAD = 18; // padding around the decoded QR bbox
const HUNT_LOOP_SECONDS = 9; // full cycle time through all 5 waypoints
const ACQUIRE_DELAY_MS = 520; // time from decode to onScan fire

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const hasDecodedRef = useRef(false);

  // Hold the latest onScan in a ref so parent re-renders don't re-init.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Lock state: null → hunting; Box → snapped onto QR.
  const [lockedBox, setLockedBox] = useState<Box | null>(null);

  // Viewport for hunt-path math + dimming-mask sizing.
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

  // Five hunt waypoints — TL, TR, C, BR, BL, then back to TL to loop.
  // Margins chosen so the reticle never collides with the top bar or
  // the bottom status strip.
  const huntPath = useMemo(() => {
    const vw = viewport.w;
    const vh = viewport.h;
    if (!vw || !vh) {
      return { xs: [0], ys: [0], waypoints: [] as Box[] };
    }
    const s = RETICLE_SIZE;
    const side = 32;
    const top = 112;
    const bottom = 180;

    const wps: Box[] = [
      { x: side, y: top, w: s, h: s }, // sector 01 · TL
      { x: vw - side - s, y: top, w: s, h: s }, // sector 02 · TR
      { x: (vw - s) / 2, y: (vh - s) / 2, w: s, h: s }, // sector 03 · C
      { x: vw - side - s, y: vh - bottom - s, w: s, h: s }, // sector 04 · BR
      { x: side, y: vh - bottom - s, w: s, h: s }, // sector 05 · BL
    ];

    // Close the loop with the starting waypoint so the motion keyframes
    // don't discontinuity-snap at the end of a cycle.
    const closed = [...wps, wps[0]];
    return {
      xs: closed.map((w) => w.x),
      ys: closed.map((w) => w.y),
      waypoints: wps,
    };
  }, [viewport.w, viewport.h]);

  // Sector label ticks alongside the reticle path so the status strip
  // can say "SEARCHING · SECTOR 03/05". Advances at 1/5 of loop time.
  const [sector, setSector] = useState(0);
  useEffect(() => {
    if (lockedBox || error || !started) return;
    const step = (HUNT_LOOP_SECONDS * 1000) / huntPath.waypoints.length;
    setSector(0);
    const id = window.setInterval(() => {
      setSector((s) => (s + 1) % huntPath.waypoints.length);
    }, step);
    return () => window.clearInterval(id);
  }, [lockedBox, error, started, huntPath.waypoints.length]);

  // Map cornerPoints (video-pixel space) → display-pixel space, then
  // reduce to a padded bbox. objectFit:cover means the video is
  // uniformly scaled to cover the element then cropped equally on
  // both overflow sides: scale = max(dW/vW, dH/vH).
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

      const pts = points.map((p) => ({
        x: p.x * scale - offsetX,
        y: p.y * scale - offsetY,
      }));

      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      // Enforce minimum frame size so tiny QRs still get a visible lock.
      const w = Math.max(maxX - minX + BBOX_PAD * 2, 96);
      const h = Math.max(maxY - minY + BBOX_PAD * 2, 96);
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
            const bbox = el ? mapCornersToBox(result.cornerPoints, el) : null;
            if (bbox) setLockedBox(bbox);

            window.setTimeout(() => {
              onScanRef.current(result.data);
            }, ACQUIRE_DELAY_MS);
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

  const isLocked = !!lockedBox;
  const frameColor = isLocked ? COLORS.ok : COLORS.accent;

  // Dimming mask follows the reticle: either a fixed box at the lock
  // position, or the current waypoint (chosen by the motion keyframe
  // system on the reticle itself). We approximate the mask target with
  // the current sector's waypoint when hunting, which keeps the mask
  // in sync with where the reticle *is* without needing a motion
  // subscription.
  const dimmingTarget: Box =
    lockedBox ??
    huntPath.waypoints[sector] ?? {
      x: (viewport.w - RETICLE_SIZE) / 2,
      y: (viewport.h - RETICLE_SIZE) / 2,
      w: RETICLE_SIZE,
      h: RETICLE_SIZE,
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
      {/* Live camera feed — sits behind every HUD layer */}
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

      {/* ── HUD backdrop — painted across the entire viewport ────── */}
      {!error && viewport.w > 0 && (
        <HudBackdrop viewport={viewport} hunting={!isLocked && started} />
      )}

      {/* ── Dimming mask — keeps the active target bright, dims the
          rest of the viewport so the user's eye tracks the reticle ── */}
      {!error && viewport.w > 0 && (
        <MaskOverlay
          target={dimmingTarget}
          viewport={viewport}
          locked={isLocked}
        />
      )}

      {/* ── Top bar: label + flash + close ──────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.md}px ${SPACE.base}px`,
          paddingTop: `calc(${SPACE.md}px + env(safe-area-inset-top))`,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.92), rgba(0,0,0,0))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
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

      {/* ── The reticle — wanders during hunt, springs onto the QR
          bbox on lock ─────────────────────────────────────────── */}
      {!error && started && (
        <HuntReticle
          huntPath={huntPath}
          lockedBox={lockedBox}
          color={frameColor}
        />
      )}

      {/* ── Acquisition rings — two radial pings centred on the QR
          when it locks. Sells the "target acquired" moment. ────── */}
      <AnimatePresence>
        {isLocked && lockedBox && (
          <AcquisitionRings
            center={{
              x: lockedBox.x + lockedBox.w / 2,
              y: lockedBox.y + lockedBox.h / 2,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Error overlay ────────────────────────────────────────── */}
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
            zIndex: 12,
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

      {/* ── Bottom status strip ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: `${SPACE.xl}px ${SPACE.base}px ${SPACE.lg}px`,
          paddingBottom: `calc(${SPACE.lg}px + env(safe-area-inset-bottom))`,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.94), rgba(0,0,0,0))',
          zIndex: 10,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={error ? 'err' : isLocked ? 'lock' : started ? 'hunt' : 'req'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACE.base,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                  MOVE CODE INTO VIEW · RETICLE WILL LOCK
                </Mono>
              )}
            </div>
            {!error && started && !isLocked && (
              <Mono tone="dim" size="xs">
                SECTOR {String(sector + 1).padStart(2, '0')}/
                {String(huntPath.waypoints.length).padStart(2, '0')}
              </Mono>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// HudBackdrop — full-screen HUD chrome that sits over the camera feed.
// Viewport corner brackets anchor each corner. While hunting, an
// ambient horizontal scan line races top→bottom across the entire
// viewport on a 3s loop — the "radar sweep" motif. Fades out on lock.
// ─────────────────────────────────────────────────────────────────────
interface HudBackdropProps {
  viewport: { w: number; h: number };
  hunting: boolean;
}

const HudBackdrop: React.FC<HudBackdropProps> = ({ viewport, hunting }) => (
  <>
    {/* Viewport corner brackets — big L marks at each corner of the
        screen. Always present; these are the persistent HUD anchors. */}
    <ViewportCornerBracket position="tl" />
    <ViewportCornerBracket position="tr" />
    <ViewportCornerBracket position="bl" />
    <ViewportCornerBracket position="br" />

    {/* Ambient full-width scan line — fades out on lock. */}
    <AnimatePresence>
      {hunting && (
        <motion.div
          key="ambient-scan"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: viewport.h,
            pointerEvents: 'none',
            zIndex: 2,
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ top: -8 }}
            animate={{ top: [`-8px`, `${viewport.h}px`] }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              background: `linear-gradient(90deg, transparent 0%, ${COLORS.accent}77 20%, ${COLORS.accentBright} 50%, ${COLORS.accent}77 80%, transparent 100%)`,
              boxShadow: `0 0 16px ${COLORS.accent}aa, 0 0 32px ${COLORS.accent}55`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

const ViewportCornerBracket: React.FC<{
  position: 'tl' | 'tr' | 'bl' | 'br';
}> = ({ position }) => {
  const [v, h] = position.split('') as Array<'t' | 'b' | 'l' | 'r'>;
  const L = 40;
  const thick = 2;
  const inset = 16;
  return (
    <>
      {/* Horizontal arm */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          [v === 't' ? 'top' : 'bottom']: `calc(${inset}px + env(safe-area-inset-${v === 't' ? 'top' : 'bottom'}))`,
          [h === 'l' ? 'left' : 'right']: inset,
          width: L,
          height: thick,
          background: COLORS.textSecondary,
          opacity: 0.55,
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      {/* Vertical arm */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          [v === 't' ? 'top' : 'bottom']: `calc(${inset}px + env(safe-area-inset-${v === 't' ? 'top' : 'bottom'}))`,
          [h === 'l' ? 'left' : 'right']: inset,
          width: thick,
          height: L,
          background: COLORS.textSecondary,
          opacity: 0.55,
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// HuntReticle — the roaming search frame. Corner-bracket-only (no
// rectangle border), wanders across a 5-waypoint loop while hunting,
// springs onto the QR bbox on lock, and pops its brackets as part of
// the acquisition animation.
// ─────────────────────────────────────────────────────────────────────
interface HuntReticleProps {
  huntPath: { xs: number[]; ys: number[]; waypoints: Box[] };
  lockedBox: Box | null;
  color: string;
}

const HuntReticle: React.FC<HuntReticleProps> = ({
  huntPath,
  lockedBox,
  color,
}) => {
  const isLocked = !!lockedBox;

  // Split props by phase. Hunt mode feeds keyframes arrays for x & y
  // (width/height stay constant); lock mode feeds scalar targets so
  // motion can spring onto them. `scale` is a separate keyframe that
  // pops on lock for the acquisition accent.
  const reticleProps = isLocked
    ? {
        animate: {
          x: lockedBox!.x,
          y: lockedBox!.y,
          width: lockedBox!.w,
          height: lockedBox!.h,
          scale: [0.82, 1.14, 1],
        },
        transition: {
          x: { type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.8 },
          y: { type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.8 },
          width: { type: 'spring' as const, stiffness: 340, damping: 28 },
          height: { type: 'spring' as const, stiffness: 340, damping: 28 },
          scale: {
            duration: 0.42,
            ease: MOTION.ease,
            times: [0, 0.55, 1],
          },
        },
      }
    : {
        animate: {
          x: huntPath.xs,
          y: huntPath.ys,
          width: huntPath.waypoints[0]?.w ?? RETICLE_SIZE,
          height: huntPath.waypoints[0]?.h ?? RETICLE_SIZE,
          scale: 1,
        },
        transition: {
          x: {
            duration: HUNT_LOOP_SECONDS,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          },
          y: {
            duration: HUNT_LOOP_SECONDS,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          },
        },
      };

  return (
    <motion.div
      animate={reticleProps.animate}
      transition={reticleProps.transition}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      {/* Corner brackets — pure L marks, no rectangle border between
          them. These are the primary visual indicator the user reads. */}
      <CornerBracket
        position="tl"
        color={color}
        size={34}
        thickness={2.5}
        inset={-2}
      />
      <CornerBracket
        position="tr"
        color={color}
        size={34}
        thickness={2.5}
        inset={-2}
      />
      <CornerBracket
        position="bl"
        color={color}
        size={34}
        thickness={2.5}
        inset={-2}
      />
      <CornerBracket
        position="br"
        color={color}
        size={34}
        thickness={2.5}
        inset={-2}
      />

      {/* Hunt-only inner scan line — vertical sweep inside the reticle.
          Complements the full-viewport scan and gives the reticle its
          own "alive" pulse. */}
      {!isLocked && (
        <motion.div
          initial={{ top: '0%' }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      )}

      {/* Lock-only acquisition sweep — a single left→right pass across
          the locked bbox. Plays once, then the AnimatePresence exit
          fades it as the modal unmounts. */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            key="lock-sweep"
            initial={{ left: -4, opacity: 0 }}
            animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 0.44,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.12,
              times: [0, 0.2, 0.8, 1],
            }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 3,
              background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
              boxShadow: `0 0 18px ${color}, 0 0 36px ${color}88`,
            }}
          />
        )}
      </AnimatePresence>

      {/* LOCK tag — appears above the top-right corner on lock. Sits
          outside the reticle so it never obscures the decoded QR. */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            key="lock-tag"
            initial={{ opacity: 0, y: 8, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.7 }}
            transition={{
              duration: MOTION.base,
              ease: MOTION.ease,
              delay: 0.14,
            }}
            style={{
              position: 'absolute',
              top: -26,
              right: -2,
              padding: `2px 8px`,
              background: COLORS.ok,
              color: '#000',
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              boxShadow: `0 0 20px ${COLORS.ok}88`,
            }}
          >
            LOCK
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// AcquisitionRings — two concentric radial pings from the QR center
// on lock. Each ring expands + fades independently with a staggered
// delay to read as a "sonar acquisition" burst.
// ─────────────────────────────────────────────────────────────────────
const AcquisitionRings: React.FC<{ center: { x: number; y: number } }> = ({
  center,
}) => {
  const rings = [
    { delay: 0.0, duration: 0.7, maxScale: 3.2 },
    { delay: 0.12, duration: 0.8, maxScale: 4.0 },
  ];
  return (
    <>
      {rings.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.35 }}
          animate={{
            opacity: [0, 0.9, 0],
            scale: [0.35, r.maxScale * 0.7, r.maxScale],
          }}
          transition={{
            duration: r.duration,
            delay: r.delay,
            ease: 'easeOut',
            times: [0, 0.3, 1],
          }}
          style={{
            position: 'absolute',
            top: center.y - 60,
            left: center.x - 60,
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: `2px solid ${COLORS.ok}`,
            boxShadow: `0 0 18px ${COLORS.ok}88`,
            pointerEvents: 'none',
            zIndex: 6,
          }}
        />
      ))}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────
// MaskOverlay — four translucent black rectangles that dim everything
// except the active target window. Rectangles animate with the target
// so the bright window follows the reticle as it wanders, and snaps
// with it on lock.
// ─────────────────────────────────────────────────────────────────────
interface MaskOverlayProps {
  target: Box;
  viewport: { w: number; h: number };
  locked: boolean;
}

const MaskOverlay: React.FC<MaskOverlayProps> = ({
  target,
  viewport,
  locked,
}) => {
  const dim = locked ? 'rgba(0,0,0,0.46)' : 'rgba(0,0,0,0.58)';
  const tween = locked
    ? { type: 'spring' as const, stiffness: 340, damping: 28 }
    : { duration: HUNT_LOOP_SECONDS / 5, ease: 'easeInOut' as const };
  const base: React.CSSProperties = {
    position: 'absolute',
    background: dim,
    zIndex: 1,
    pointerEvents: 'none',
    transition: `background ${MOTION.base}s ${MOTION.ease as unknown as string}`,
  };

  return (
    <>
      {/* top */}
      <motion.div
        animate={{ height: Math.max(target.y, 0) }}
        transition={tween}
        style={{ ...base, top: 0, left: 0, right: 0 }}
      />
      {/* bottom */}
      <motion.div
        animate={{
          top: target.y + target.h,
          height: Math.max(viewport.h - (target.y + target.h), 0),
        }}
        transition={tween}
        style={{ ...base, left: 0, right: 0 }}
      />
      {/* left */}
      <motion.div
        animate={{
          top: target.y,
          height: target.h,
          width: Math.max(target.x, 0),
        }}
        transition={tween}
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
        transition={tween}
        style={{ ...base }}
      />
    </>
  );
};
