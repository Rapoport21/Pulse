/**
 * CinematicBoot — PULSE startup sequence (Industrial Brutalist).
 *
 * 2026-04-30 · Rewrite under industrial-brutalist-ui skill.
 * Pure Tactical Telemetry / CRT Terminal aesthetic. No glass,
 * no mesh orbs, no halos. Heavy structural typography, razor-thin
 * grid dividers, crosshairs at intersections, CRT static overlay.
 *
 *   0.0–0.3s   page reveals · CRT static fades in · scanline sweep
 *   0.3–2.2s   terminal log stream — left column, mono uppercase
 *   1.7–2.6s   PULSE wordmark snaps in at hero scale (clamp 6→12rem)
 *   2.4–3.1s   accent rule under wordmark draws L→R
 *   2.7–3.0s   tagline + technical metadata appear
 *   2.9–3.7s   ECG ribbon draws across — single 6-cycle heartbeat
 *   3.0–4.0s   progress bar fills · GO callout flips to OK
 *   4.0–4.2s   white flash · crossfade to login
 *
 * Tap or any key skips to the engage flash.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { COLORS, FONTS, SPACE, MACRO, SCANLINES, MOTION } from './design';

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
// Crosshair — inline `+` mark for panel corners
// ──────────────────────────────────────────────────────────────────
const Crosshair: React.FC<{
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  size?: number;
  color?: string;
}> = ({ top, left, right, bottom, size = 18, color = COLORS.accent }) => (
  <span
    aria-hidden
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    }}
  >
    <span style={{ position: 'absolute', inset: 0, top: '50%', height: 1, marginTop: -0.5, background: color }} />
    <span style={{ position: 'absolute', inset: 0, left: '50%', width: 1, marginLeft: -0.5, background: color }} />
  </span>
);

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
  const serial = 'D-01-MEMG-2026';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONTS.mono,
        color: COLORS.textPrimary,
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
        @keyframes cb-rule-draw {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes cb-ecg-draw {
          from { stroke-dashoffset: 1200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes cb-ecg-pulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(225, 29, 72, 0.4)); }
          50%      { filter: drop-shadow(0 0 12px rgba(225, 29, 72, 0.85)); }
        }
        @keyframes cb-progress-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes cb-go-pulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        @keyframes cb-static-flicker {
          0%, 96%, 100% { opacity: 1; }
          97%           { opacity: 0.92; }
          98%           { opacity: 1; }
          99%           { opacity: 0.95; }
        }
      `}</style>

      {/* ───── CRT STATIC OVERLAY (full-bleed) ───────────────────── */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: SCANLINES.medium,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Single scanline pass (one-shot) */}
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
          zIndex: 2,
        }}
      />

      {/* ───── TOP CHROME — RAW METADATA STRIP ───────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: `1px solid ${COLORS.borderStrong}`,
          background: COLORS.surface,
          fontFamily: FONTS.mono,
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: COLORS.textMuted,
        }}
      >
        {[
          ['REV', '2.6.7'],
          ['NODE', 'ER-01'],
          ['UNIT', serial],
          ['BUILD', dateStr],
        ].map(([k, v], i) => (
          <div
            key={k}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRight: i < 3 ? `1px solid ${COLORS.borderStrong}` : undefined,
              display: 'flex',
              gap: SPACE.md,
            }}
          >
            <span style={{ color: COLORS.textDim }}>{k}</span>
            <span style={{ color: COLORS.textPrimary }}>{v}</span>
          </div>
        ))}
      </div>

      {/* ───── CENTER: HERO + LOG STREAM ─────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 0,
          overflow: 'hidden',
        }}
      >
        {/* LEFT — terminal stream, framed */}
        <div
          style={{
            position: 'relative',
            padding: `${SPACE['3xl']}px ${SPACE['2xl']}px`,
            borderRight: `1px solid ${COLORS.borderStrong}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Crosshair markers at column corners */}
          <Crosshair top={0} left={0} color={COLORS.accent} />
          <Crosshair bottom={0} right={0} color={COLORS.accent} />

          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: COLORS.accent,
              marginBottom: SPACE.lg,
            }}
          >
            // BOOT.SEQUENCE · TELEMETRY
          </div>

          {/* Lines rendered as a 1px-gap grid for razor-thin dividers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 1,
              background: COLORS.borderStrong,
              border: `1px solid ${COLORS.borderStrong}`,
            }}
          >
            {BOOT_LINES.map((l, i) => {
              const delay = LINE_BASE_DELAY + i * LINE_STAGGER;
              const isGo = l.status === 'GO';
              return (
                <motion.div
                  key={l.tag + i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay, duration: 0.22, ease: 'easeOut' }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 78px 1fr 36px',
                    alignItems: 'center',
                    background: COLORS.bg,
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      color: COLORS.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 9,
                      letterSpacing: '0.16em',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ color: COLORS.textDim }}>[{l.tag}]</span>
                  <span style={{ color: COLORS.textSecondary }}>{l.msg}</span>
                  <span
                    style={{
                      color: isGo ? COLORS.ok : COLORS.textMuted,
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {l.status}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — hero block: massive wordmark + metadata + ECG */}
        <div
          style={{
            position: 'relative',
            padding: `${SPACE['3xl']}px ${SPACE['2xl']}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: SPACE.xl,
          }}
        >
          {/* Crosshair markers at column corners */}
          <Crosshair top={0} right={0} color={COLORS.accent} />
          <Crosshair bottom={0} left={0} color={COLORS.accent} />

          {/* Top tag */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: COLORS.accent,
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
            }}
          >
            <span>+++</span>
            <span>PREDICTIVE UNIFIED LOGISTICS &amp; SURGE ENGINE</span>
            <span style={{ flex: 1, height: 1, background: COLORS.accent, opacity: 0.6, marginLeft: SPACE.sm }} />
          </motion.div>

          {/* HERO WORDMARK — fluid clamp, tight tracking, compressed leading.
              This is the structural anchor of the whole boot. */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.5, ease: 'easeOut' }}
            style={{
              fontFamily: FONTS.sans,
              fontSize: MACRO.hero,
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 0.86,
              color: COLORS.textPrimary,
              margin: 0,
              // Slight CRT-glow without the SaaS-y diffused halo
              textShadow: `0 0 1px ${COLORS.accent}`,
            }}
          >
            PULSE
            <sup
              style={{
                fontSize: '0.16em',
                fontFamily: FONTS.mono,
                fontWeight: 500,
                letterSpacing: '0.16em',
                color: COLORS.accent,
                marginLeft: '0.05em',
                verticalAlign: 'top',
                top: '-0.6em',
                position: 'relative',
              }}
            >
              ®
            </sup>
          </motion.h1>

          {/* Accent rule — full-width, draws on */}
          <div
            style={{
              height: 2,
              width: '100%',
              background: COLORS.accent,
              transformOrigin: 'left',
              animation: 'cb-rule-draw 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
              animationDelay: '2.4s',
              transform: 'scaleX(0)',
            }}
          />

          {/* Tech metadata grid — bimodal density: small mono in tight grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.7, duration: 0.4 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: COLORS.borderStrong,
              border: `1px solid ${COLORS.borderStrong}`,
            }}
          >
            {[
              ['CLEARANCE', 'L3'],
              ['MODE', 'TACTICAL'],
              ['UPLINK', 'STABLE'],
              ['LATENCY', '18MS'],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: COLORS.bg,
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 9,
                    letterSpacing: '0.20em',
                    textTransform: 'uppercase',
                    color: COLORS.textDim,
                  }}
                >
                  {k}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: COLORS.textPrimary,
                    fontWeight: 600,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </motion.div>

          {/* ECG ribbon — bordered as a tactical readout */}
          <div
            aria-hidden
            style={{
              width: '100%',
              height: 60,
              border: `1px solid ${COLORS.borderStrong}`,
              background: 'linear-gradient(180deg, transparent, rgba(225, 29, 72, 0.05), transparent)',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 4,
                left: 6,
                fontFamily: FONTS.mono,
                fontSize: 8,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: COLORS.textDim,
              }}
            >
              ECG / 72 BPM / LEAD II
            </span>
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
                strokeWidth={1.4}
                fill="none"
                strokeLinejoin="miter"
                strokeLinecap="butt"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 9,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: COLORS.textMuted,
              }}
            >
              INIT
            </span>
            <div
              style={{
                flex: 1,
                height: 2,
                background: COLORS.borderStrong,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: COLORS.accent,
                  transformOrigin: 'left',
                  animation: 'cb-progress-fill 1000ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  animationDelay: '3s',
                  transform: 'scaleX(0)',
                }}
              />
            </div>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.5, duration: 0.3 }}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: COLORS.ok,
                animation: 'cb-go-pulse 1.4s ease-in-out infinite',
              }}
            >
              [ ONLINE ]
            </motion.span>
          </div>
        </div>
      </div>

      {/* ───── BOTTOM CHROME — STATUS RAIL ──────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: `${SPACE.sm}px ${SPACE.lg}px`,
          borderTop: `1px solid ${COLORS.borderStrong}`,
          background: COLORS.surface,
          fontFamily: FONTS.mono,
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: COLORS.textMuted,
        }}
      >
        <span>{`>>>`} TLS 1.3 / SESSION-BOUND / BIOMETRIC AUTH</span>
        <span style={{ color: COLORS.textPrimary, padding: `0 ${SPACE.lg}px` }}>
          {timeStr}
        </span>
        <span style={{ textAlign: 'right' }}>{`PRESS ANY KEY TO SKIP <<<`}</span>
      </div>

      {/* ───── ENGAGE FLASH ─────────────────────────────────────── */}
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
    </div>
  );
};

export const BOOT_DURATION_MS = TOTAL_DURATION_MS;
