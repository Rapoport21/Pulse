/**
 * CinematicBoot — PULSE startup sequence.
 *
 * 2026-04-30 · Trimmed: removed the vertical scanline sweep, the ECG
 * ribbon, and the white engage flash per Nick's request. What's left
 * is the cleaner core sequence:
 *
 *   0.0–0.5s  dot grid + rose glow fade in
 *   0.3–2.2s  terminal log stream — 10 mono lines stagger in, last
 *             one is `[GO] All systems nominal` in green.
 *   1.8–2.6s  PULSE wordmark fades up + scales 0.92 → 1.0
 *   2.4–3.1s  rose underline draws left → right beneath the wordmark
 *   2.7–3.0s  tagline fades in
 *   3.0–4.0s  progress bar fills · `[ SYSTEM ONLINE ]` flips green
 *   4.2s      parent unmounts the boot, login takes over
 *
 * Tap or any key triggers the parent's onComplete early.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { COLORS, FONTS, SPACE, RADIUS, MOTION } from './design';

// ──────────────────────────────────────────────────────────────────
// Boot log lines — staggered terminal stream
// ──────────────────────────────────────────────────────────────────
const BOOT_LINES: { tag: string; msg: string; status: 'OK' | 'GO' }[] = [
  { tag: 'SYSTEM',  msg: 'Initializing predictive engine · v3.2.7',          status: 'OK' },
  { tag: 'NETWORK', msg: 'TLS 1.3 negotiated · 14 secure channels',          status: 'OK' },
  { tag: 'EHR',     msg: 'Bed sync online · 312 beds across 47 units',       status: 'OK' },
  { tag: 'EMS',     msg: 'Dispatch link active · 3 regional hubs',           status: 'OK' },
  { tag: 'MESH',    msg: 'Realtime nodes · 4 online · 18ms median',          status: 'OK' },
  { tag: 'PULSE',   msg: 'Heartbeat baseline · 72 BPM · NEDOCS 112',         status: 'OK' },
  { tag: 'SITE',    msg: 'Profile loaded · Memorial General · 412 staffed',  status: 'OK' },
  { tag: 'AUDIT',   msg: 'Chain verified · 90 days clean',                   status: 'OK' },
  { tag: 'OVERLAY', msg: 'Predictive overlays primed · 12 metrics tracking', status: 'OK' },
  { tag: 'MISSION', msg: 'All systems nominal',                              status: 'GO' },
];

// Each line appears at roughly 0.30s + i*0.18s — total ~2.1s for the stream.
const LINE_BASE_DELAY = 0.30;
const LINE_STAGGER = 0.18;

const TOTAL_DURATION_MS = 4200;

// ──────────────────────────────────────────────────────────────────
// Mobile detection — matches LoginScreenTactical's 640px breakpoint
// so the boot → login transition is consistent. Boot screen collapses
// the 2-column desktop grid to a single vertical stack below this width
// and reduces the wordmark + padding to fit narrow viewports.
// ──────────────────────────────────────────────────────────────────
const useIsBootMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
};

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────
export const CinematicBoot: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const skipRef = useRef(false);
  const isMobile = useIsBootMobile();

  // Skip handler — tap or any key fires the parent unmount early.
  useEffect(() => {
    const handler = () => {
      if (skipRef.current) return;
      skipRef.current = true;
      window.setTimeout(() => onComplete?.(), 200);
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('mousedown', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, [onComplete]);

  // Build date stamp for the top corner
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const timeStr = new Date().toISOString().slice(11, 19);

  const [hideSkipHint, setHideSkipHint] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHideSkipHint(true), 3500);
    return () => window.clearTimeout(t);
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // MOBILE BOOT — clean iOS-style splash, NOT a squished desktop.
  // Just the wordmark + rose underline + subtle "Loading" pip
  // centered on dark, dot-grid texture + rose floor glow behind.
  // Matches the iOS native LaunchScreen splash's mood; no terminal
  // stream, no progress bar, no meta row. Boots run for the same
  // 4.2s (parent unmounts; skip handler still attached above).
  // ─────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          minHeight: '100vh',
          height: '100lvh',
          background: COLORS.bg,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          // Push the wordmark block toward the LOWER half of the screen.
          // flex-end anchors content to the bottom; the paddingBottom
          // floats it back up to roughly 60–65% from the top of the
          // visible area (plus the safe-area-inset reservation so the
          // wordmark doesn't slip under the home indicator).
          justifyContent: 'flex-end',
          paddingBottom: `calc(env(safe-area-inset-bottom) + 30vh)`,
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
          zIndex: 9999,
          // No safe-area padding on the OUTER container otherwise — we
          // want the background (rose floor glow + dot grid) to extend
          // edge-to-edge. The inner content block is the only thing
          // positioned safely away from chrome.
        }}
      >
        <style>{`
          @keyframes cb-m-fade-in {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
          @keyframes cb-m-underline {
            from { transform: scaleX(0); }
            to   { transform: scaleX(1); }
          }
          @keyframes cb-m-pulse {
            0%, 100% { opacity: 0.45; }
            50%      { opacity: 1; }
          }
        `}</style>

        {/* Rose floor glow — edge-to-edge */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${COLORS.accentDim}, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
        {/* Subtle dot grid */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            opacity: 0.18,
            maskImage: 'radial-gradient(ellipse 75% 60% at center, black 25%, transparent 90%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at center, black 25%, transparent 90%)',
            pointerEvents: 'none',
          }}
        />

        {/* Wordmark block — outer container's flex-end +
            paddingBottom: env(safe-area-inset-bottom) + 30vh already
            anchors this in the lower third. No need for safe-area
            padding here; just horizontal breathing room. */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: SPACE.md,
            paddingLeft: SPACE.lg,
            paddingRight: SPACE.lg,
            animation: 'cb-m-fade-in 600ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
            animationDelay: '0.15s',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: FONTS.sans,
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: '0.18em',
              lineHeight: 1,
              color: COLORS.textPrimary,
              textShadow: `0 0 24px rgba(225, 29, 72, 0.22)`,
            }}
          >
            PULSE
          </h1>
          <div
            style={{
              height: 2,
              width: 140,
              background: `linear-gradient(90deg, ${COLORS.accentBright}, ${COLORS.accent} 80%, transparent)`,
              transformOrigin: 'left',
              animation: 'cb-m-underline 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
              animationDelay: '0.7s',
              transform: 'scaleX(0)',
              boxShadow: `0 0 12px ${COLORS.accentGlow}`,
            }}
          />
          <div
            style={{
              marginTop: SPACE.sm,
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.28em',
              color: COLORS.textMuted,
              textTransform: 'uppercase',
              animation: 'cb-m-pulse 1.6s ease-in-out infinite',
              animationDelay: '1.4s',
              opacity: 0,
              animationFillMode: 'both',
            }}
          >
            Loading
          </div>
        </div>

        {/* Skip hint — bottom safe-area aware */}
        <div
          style={{
            position: 'absolute',
            bottom: `max(env(safe-area-inset-bottom), ${SPACE.base}px)`,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.22em',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            opacity: hideSkipHint ? 0 : 1,
            transition: 'opacity 400ms ease-out',
            pointerEvents: 'none',
            zIndex: 11,
          }}
        >
          Tap to skip
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // DESKTOP BOOT — full cinematic sequence below. Restored to the
  // pre-mobile-pass baseline; mobile now lives in its own early
  // return above so this branch has no `isMobile ?` ternaries.
  // ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bg,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.mono,
        color: COLORS.textSecondary,
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes cb-dot-grid-fade {
          from { opacity: 0; }
          to   { opacity: 0.32; }
        }
        @keyframes cb-rose-underline {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes cb-progress-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes cb-go-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50%      { box-shadow: 0 0 18px 2px rgba(16, 185, 129, 0.55); }
        }
      `}</style>

      {/* ═════════════════════════════════════════════════════════════
          BACKGROUND LAYERS — dot grid + rose floor glow
          ═════════════════════════════════════════════════════════════ */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          opacity: 0,
          animation: 'cb-dot-grid-fade 700ms ease-out forwards',
          maskImage:
            'radial-gradient(ellipse 70% 55% at center, black 35%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 55% at center, black 35%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 40% at 50% 110%, ${COLORS.accentDim}, transparent 60%)`,
        }}
      />

      {/* ═════════════════════════════════════════════════════════════
          MAIN BOOT FRAME — left log column, right brand stack.
          ═════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 1080,
          padding: SPACE['3xl'],
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: SPACE['3xl'],
          alignItems: 'center',
        }}
      >
        {/* ─── LEFT: terminal stream ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {BOOT_LINES.map((l, i) => {
            const delay = LINE_BASE_DELAY + i * LINE_STAGGER;
            const isGo = l.status === 'GO';
            return (
              <motion.div
                key={l.tag + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay, duration: 0.32, ease: MOTION.ease }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.md,
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                }}
              >
                <span
                  style={{
                    color: COLORS.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 32,
                    fontSize: 9,
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ color: COLORS.textDim, minWidth: 70 }}>[{l.tag}]</span>
                <span style={{ color: COLORS.textSecondary, flex: 1 }}>{l.msg}</span>
                <span
                  style={{
                    color: isGo ? COLORS.ok : COLORS.textMuted,
                    fontWeight: 600,
                    minWidth: 24,
                    textAlign: 'right',
                  }}
                >
                  {l.status}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* ─── RIGHT: brand block, progress, GO pill ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xl }}>
          {/* Top meta row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: FONTS.mono,
              fontSize: 9,
              letterSpacing: '0.18em',
              color: COLORS.textDim,
              textTransform: 'uppercase',
            }}
          >
            <span>BUILD {dateStr}</span>
            <span>NODE ER-01 · {timeStr}Z</span>
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.7, duration: 0.7, ease: MOTION.ease }}
            style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: FONTS.sans,
                fontSize: 96,
                fontWeight: 600,
                letterSpacing: '0.18em',
                lineHeight: 0.92,
                color: COLORS.textPrimary,
                textShadow: `0 0 24px rgba(225, 29, 72, 0.18)`,
              }}
            >
              PULSE
            </h1>
            {/* Rose underline that draws on left→right */}
            <div
              style={{
                height: 3,
                width: 320,
                background: `linear-gradient(90deg, ${COLORS.accentBright}, ${COLORS.accent} 80%, transparent)`,
                transformOrigin: 'left',
                animation: 'cb-rose-underline 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                animationDelay: '2.4s',
                transform: 'scaleX(0)',
                boxShadow: `0 0 16px ${COLORS.accentGlow}`,
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.7, duration: 0.4 }}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                letterSpacing: '0.24em',
                color: COLORS.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              Predictive Unified Logistics &amp; Surge Engine
            </motion.div>
          </motion.div>

          {/* Progress bar */}
          <div
            style={{
              height: 2,
              width: '100%',
              background: COLORS.border,
              borderRadius: RADIUS.full,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, ${COLORS.accentBright}, ${COLORS.accent})`,
                transformOrigin: 'left',
                animation: 'cb-progress-fill 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                animationDelay: '3s',
                transform: 'scaleX(0)',
                boxShadow: `0 0 10px ${COLORS.accentGlow}`,
              }}
            />
          </div>

          {/* Footer row — system online pill */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.18em',
              color: COLORS.textDim,
              textTransform: 'uppercase',
            }}
          >
            <span>// Biometric auth · TLS 1.3 · session-bound</span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.5, duration: 0.3 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACE.xs,
                padding: `${SPACE.xs}px ${SPACE.sm}px`,
                color: COLORS.ok,
                background: 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${COLORS.ok}`,
                borderRadius: RADIUS.full,
                fontWeight: 600,
                animation: 'cb-go-pulse 1.4s ease-in-out infinite',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: COLORS.ok,
                  boxShadow: `0 0 8px ${COLORS.ok}`,
                }}
              />
              SYSTEM ONLINE
            </motion.span>
          </div>
        </div>
      </div>

      {/* Skip hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: hideSkipHint ? 0 : 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        style={{
          position: 'absolute',
          bottom: SPACE.lg,
          right: SPACE.lg,
          fontFamily: FONTS.mono,
          fontSize: 9,
          letterSpacing: '0.2em',
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          zIndex: 11,
        }}
      >
        Press any key to skip
      </motion.div>
    </div>
  );
};

export const BOOT_DURATION_MS = TOTAL_DURATION_MS;
