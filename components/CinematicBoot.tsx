/**
 * CinematicBoot — PULSE startup sequence (Ethereal Glass).
 *
 * 2026-04-30 · Rewrite under the high-end-visual-design skill.
 * Same 4.2s phased reveal as before, but with the agency-tier
 * treatment: OLED canvas, 3-orb radial mesh atmosphere (rose +
 * violet + emerald), double-bezel boot panel with glass blur,
 * machined hairlines, soft ambient shadow, and a sweep of
 * scanline + radial halo behind the wordmark on the GO beat.
 *
 *   0.0–0.5s   scanline sweep, mesh orbs fade in
 *   0.3–2.2s   terminal log stream — left column, mono, numbered
 *   1.7–2.6s   PULSE wordmark fades up + scales 0.92→1.0
 *   2.4–3.1s   rose underline draws beneath wordmark, L→R
 *   2.7–3.0s   tagline fades in
 *   2.9–3.7s   ECG ribbon draws across — 6-cycle heartbeat
 *   3.0–4.0s   progress bar fills · GO pill flips green
 *   4.0–4.2s   white flash · crossfade to login
 *
 * Tap or any key skips to the engage flash.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { COLORS, FONTS, SPACE, RADIUS, MESH, SHADOW, MOTION } from './design';

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

const LINE_BASE_DELAY = 0.30;
const LINE_STAGGER = 0.18;

type Phase = 'init' | 'logs' | 'reveal' | 'engage';

const TOTAL_DURATION_MS = 4200;

// ──────────────────────────────────────────────────────────────────
// ECG path — 6-cycle heartbeat across 600×60 viewBox
// ──────────────────────────────────────────────────────────────────
const buildEcgPath = (): string => {
  const cycles = 6;
  const cycleW = 600 / cycles;
  const baseY = 30;
  let d = `M 0 ${baseY}`;
  for (let i = 0; i < cycles; i++) {
    const x0 = i * cycleW;
    d += ` L ${x0 + cycleW * 0.32} ${baseY}`;
    d += ` Q ${x0 + cycleW * 0.36} ${baseY - 4} ${x0 + cycleW * 0.40} ${baseY}`;
    d += ` L ${x0 + cycleW * 0.44} ${baseY}`;
    d += ` L ${x0 + cycleW * 0.46} ${baseY + 4}`;
    d += ` L ${x0 + cycleW * 0.49} ${baseY - 22}`;
    d += ` L ${x0 + cycleW * 0.52} ${baseY + 6}`;
    d += ` L ${x0 + cycleW * 0.58} ${baseY}`;
    d += ` Q ${x0 + cycleW * 0.66} ${baseY - 6} ${x0 + cycleW * 0.74} ${baseY}`;
    d += ` L ${x0 + cycleW} ${baseY}`;
  }
  return d;
};

const ECG_PATH = buildEcgPath();

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────
export const CinematicBoot: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('init');
  const [skipping, setSkipping] = useState(false);
  const skipRef = useRef(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('logs'), 250);
    const t2 = window.setTimeout(() => setPhase('reveal'), 1700);
    const t3 = window.setTimeout(() => setPhase('engage'), 3500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (skipRef.current) return;
      skipRef.current = true;
      setSkipping(true);
      setPhase('engage');
      window.setTimeout(() => onComplete?.(), 300);
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

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const timeStr = new Date().toISOString().slice(11, 19);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // Deepest OLED black + radial mesh atmosphere underneath
        background: `${MESH.roseOrb}, ${MESH.violetOrb}, ${MESH.emeraldOrb}, #050507`,
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
        @keyframes cb-scanline-sweep {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes cb-orb-drift {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(2%, -2%); }
        }
        @keyframes cb-rose-underline {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes cb-ecg-draw {
          from { stroke-dashoffset: 1200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes cb-ecg-pulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(225, 29, 72, 0.4)); }
          50%      { filter: drop-shadow(0 0 14px rgba(225, 29, 72, 0.95)); }
        }
        @keyframes cb-progress-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes cb-go-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50%      { box-shadow: 0 0 22px 2px rgba(16, 185, 129, 0.55); }
        }
        @keyframes cb-halo-bloom {
          0%   { opacity: 0;  transform: scale(0.4); }
          50%  { opacity: 1;  transform: scale(1); }
          100% { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>

      {/* ───── BACKGROUND ATMOSPHERE ─────────────────────────────── */}
      {/* Animated drifting mesh layer */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-10%',
          background: MESH.roseOrb,
          animation: 'cb-orb-drift 18s ease-in-out infinite',
          filter: 'blur(40px)',
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-10%',
          background: MESH.violetOrb,
          animation: 'cb-orb-drift 22s ease-in-out infinite reverse',
          filter: 'blur(50px)',
          opacity: 0.85,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-10%',
          background: MESH.emeraldOrb,
          animation: 'cb-orb-drift 26s ease-in-out infinite',
          filter: 'blur(60px)',
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      />
      {/* Subtle dot grid masked to center */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          opacity: 0.55,
          maskImage:
            'radial-gradient(ellipse 70% 55% at center, black 35%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 55% at center, black 35%, transparent 100%)',
        }}
      />
      {/* Single scanline pass */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.accentBright}, transparent)`,
          opacity: 0,
          animation: 'cb-scanline-sweep 700ms cubic-bezier(0.4, 0, 0.6, 1) forwards',
          animationDelay: '120ms',
          boxShadow: `0 0 14px ${COLORS.accent}`,
        }}
      />

      {/* ───── DOUBLE-BEZEL BOOT PANEL ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: MOTION.ease }}
        style={{
          position: 'relative',
          zIndex: 10,
          // OUTER SHELL — machined-tray look with hairline ring + soft glass tint
          padding: 8,
          background: 'rgba(255, 255, 255, 0.025)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: RADIUS.squircle,
          boxShadow: `${SHADOW.glassAmbient}, ${SHADOW.glassInsetTop}, ${SHADOW.haloRose}`,
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          width: 'min(94vw, 1080px)',
        }}
      >
        {/* INNER CORE — concentric radius (squircle - outer padding 8) */}
        <div
          style={{
            background: 'rgba(8, 8, 12, 0.74)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: RADIUS.squircle - 8,
            padding: SPACE['3xl'],
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: SPACE['3xl'],
            alignItems: 'center',
            boxShadow: SHADOW.glassInsetTop,
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
                  initial={{ opacity: 0, x: -10, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  transition={{ delay, duration: 0.45, ease: MOTION.ease }}
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

          {/* ─── RIGHT: brand block, ECG ribbon, progress, GO pill ─── */}
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
                letterSpacing: '0.20em',
                color: COLORS.textDim,
                textTransform: 'uppercase',
              }}
            >
              <span>BUILD {dateStr}</span>
              <span>NODE ER-01 · {timeStr}Z</span>
            </motion.div>

            {/* Wordmark — bigger, with rose halo bloom behind it */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.7, duration: 0.7, ease: MOTION.ease }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.sm,
              }}
            >
              {/* Halo bloom — sits behind the wordmark */}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  width: 360,
                  height: 220,
                  left: -40,
                  top: -50,
                  background:
                    'radial-gradient(ellipse 60% 70% at 30% 50%, rgba(225, 29, 72, 0.55), transparent 60%)',
                  filter: 'blur(40px)',
                  opacity: 0,
                  animation: 'cb-halo-bloom 1.4s ease-out forwards',
                  animationDelay: '1.7s',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
              <h1
                style={{
                  position: 'relative',
                  margin: 0,
                  fontFamily: FONTS.sans,
                  fontSize: 108,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  lineHeight: 0.92,
                  color: COLORS.textPrimary,
                  textShadow: '0 0 30px rgba(225, 29, 72, 0.22)',
                  zIndex: 1,
                }}
              >
                PULSE
              </h1>
              {/* Rose underline draws on left→right */}
              <div
                style={{
                  height: 3,
                  width: 360,
                  background: `linear-gradient(90deg, ${COLORS.accentBright}, ${COLORS.accent} 80%, transparent)`,
                  transformOrigin: 'left',
                  animation: 'cb-rose-underline 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  animationDelay: '2.4s',
                  transform: 'scaleX(0)',
                  boxShadow: `0 0 16px ${COLORS.accentGlow}`,
                  zIndex: 1,
                }}
              />
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.7, duration: 0.4 }}
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  letterSpacing: '0.26em',
                  color: COLORS.textSecondary,
                  textTransform: 'uppercase',
                  zIndex: 1,
                }}
              >
                Predictive Unified Logistics &amp; Surge Engine
              </motion.div>
            </motion.div>

            {/* ECG ribbon — glass-bordered enclosure */}
            <div
              aria-hidden
              style={{
                width: '100%',
                height: 64,
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: RADIUS.md,
                background:
                  'linear-gradient(180deg, transparent, rgba(225, 29, 72, 0.05), transparent)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <svg
                viewBox="0 0 600 60"
                preserveAspectRatio="none"
                width="100%"
                height="100%"
                style={{ display: 'block' }}
              >
                <path
                  d={ECG_PATH}
                  stroke={COLORS.accentBright}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 1200,
                    strokeDashoffset: 1200,
                    animation:
                      'cb-ecg-draw 800ms cubic-bezier(0.65, 0, 0.35, 1) forwards, cb-ecg-pulse 1.6s ease-in-out infinite 1s',
                    animationDelay: '2.9s',
                  }}
                />
              </svg>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: 2,
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
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

            {/* Footer row — meta + GO pill */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: '0.20em',
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
      </motion.div>

      {/* ───── ENGAGE FLASH ──────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'engage' || skipping) && (
          <motion.div
            key="engage"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.45, times: [0, 0.25, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: COLORS.textPrimary,
              pointerEvents: 'none',
              zIndex: 100,
            }}
          />
        )}
      </AnimatePresence>

      {/* Skip hint — bottom right */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'engage' ? 0 : 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        style={{
          position: 'absolute',
          bottom: SPACE.lg,
          right: SPACE.lg,
          fontFamily: FONTS.mono,
          fontSize: 9,
          letterSpacing: '0.22em',
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
