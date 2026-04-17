import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, ShieldAlert, Database, Cpu, Network } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  CornerBracket,
  DotGridBg,
  GlowBg,
  ScanningLine,
  HudStrip,
} from './design';

type BootStep = {
  p: number;
  s: string;
  label: string;
  id: string;
};

const STEPS: BootStep[] = [
  { p: 15, s: 'ESTABLISHING EHR CONNECTION…', label: 'EHR LINK', id: 'EHR' },
  { p: 35, s: 'SYNCING REGIONAL NETWORK DATA…', label: 'REGIONAL', id: 'RGN' },
  { p: 60, s: 'LOADING PREDICTIVE MODELS…', label: 'AI MODELS', id: 'AIM' },
  { p: 85, s: 'CALIBRATING SURGE THRESHOLDS…', label: 'PROTOCOLS', id: 'SRG' },
  { p: 100, s: 'SYSTEM READY.', label: 'READY', id: 'RDY' },
];

const CHECKS: Array<{
  key: string;
  label: string;
  threshold: number;
  Icon: typeof Database;
}> = [
  { key: 'ehr', label: 'EHR LINK', threshold: 15, Icon: Database },
  { key: 'rgn', label: 'REGIONAL', threshold: 35, Icon: Network },
  { key: 'aim', label: 'AI MODELS', threshold: 60, Icon: Cpu },
  { key: 'srg', label: 'PROTOCOLS', threshold: 85, Icon: ShieldAlert },
];

/**
 * LoadingScreen — tactical boot sequence. Dot-grid background, rose-accent
 * ring pulses, step-by-step log + progress bar, system check grid.
 * Fires onComplete after the last step.
 */
export const LoadingScreen: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('INITIALIZING SECURE LINK…');
  const [stepIndex, setStepIndex] = useState(-1);

  useEffect(() => {
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < STEPS.length) {
        setProgress(STEPS[currentStep].p);
        setStatus(STEPS[currentStep].s);
        setStepIndex(currentStep);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 400);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        overflow: 'hidden',
      }}
    >
      {/* Background layers — the boot screen already has a radar
          animation and animated progress bar carrying the "activity"
          signal, so the decorative ScanningLine was redundant visual
          noise and has been removed. */}
      <DotGridBg />
      <GlowBg origin="bottom" />

      {/* Top HUD */}
      <HudStrip side="top" fixed height={36}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flex: 1 }}>
          <BracketLabel tone="accent">PULSE</BracketLabel>
          <span style={{ color: COLORS.textDim }}>│</span>
          <Mono tone="secondary" size="xs">
            BOOT SEQUENCE · ACTIVE
          </Mono>
        </div>
        <Mono tone="dim" size="xs">
          v1.2.4 · Node ER-01
        </Mono>
      </HudStrip>

      {/* Bottom HUD */}
      <HudStrip side="bottom" fixed height={36}>
        <Mono tone="dim" size="xs" style={{ flex: 1 }}>
          Secure Uplink · TLS 1.3
        </Mono>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: COLORS.accent,
              boxShadow: `0 0 8px ${COLORS.accentGlow}`,
              animation: 'pulse-dot 1.2s ease-in-out infinite',
            }}
          />
          <Mono tone="muted" size="xs">
            STREAMING
          </Mono>
        </div>
      </HudStrip>

      {/* Center content */}
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACE.xl,
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 460,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Radar / pulse animation */}
          <div
            style={{
              position: 'relative',
              width: 140,
              height: 140,
              marginBottom: SPACE['2xl'],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Corner brackets around the ring */}
            <CornerBracket position="tl" color={COLORS.accent} size={11} thickness={1} />
            <CornerBracket position="tr" color={COLORS.accent} size={11} thickness={1} />
            <CornerBracket position="bl" color={COLORS.accent} size={11} thickness={1} />
            <CornerBracket position="br" color={COLORS.accent} size={11} thickness={1} />

            {/* Concentric ping rings */}
            {[0, 0.4, 0.8].map((delay, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 12 + i * 12,
                  border: `1px solid ${COLORS.accent}`,
                  borderRadius: '50%',
                  opacity: 0.9 - i * 0.2,
                  animation: `pulse-ring 2s ease-out ${delay}s infinite`,
                }}
              />
            ))}

            {/* Center activity icon */}
            <div
              style={{
                position: 'relative',
                width: 52,
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: COLORS.surface,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: RADIUS.sm,
                color: COLORS.accent,
                boxShadow: `0 0 24px ${COLORS.accentGlow}`,
              }}
            >
              <Activity
                size={24}
                strokeWidth={2}
                style={{ animation: 'pulse-dot 1.6s ease-in-out infinite' }}
              />
              <CornerBracket position="tl" color={COLORS.accent} size={4} thickness={1} inset={-1} />
              <CornerBracket position="tr" color={COLORS.accent} size={4} thickness={1} inset={-1} />
              <CornerBracket position="bl" color={COLORS.accent} size={4} thickness={1} inset={-1} />
              <CornerBracket position="br" color={COLORS.accent} size={4} thickness={1} inset={-1} />
            </div>
          </div>

          {/* Status text */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: SPACE.lg,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.span
              key={status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 13,
                letterSpacing: '0.2em',
                fontWeight: 500,
                color: COLORS.accent,
                textTransform: 'uppercase',
              }}
            >
              {status}
            </motion.span>
          </div>

          {/* Step counter */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: SPACE.sm,
            }}
          >
            <Mono tone="muted" size="xs">
              STEP{' '}
              {stepIndex >= 0
                ? String(Math.min(stepIndex + 1, STEPS.length)).padStart(2, '0')
                : '00'}{' '}
              / {String(STEPS.length).padStart(2, '0')}
            </Mono>
            <Mono tone="accent" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {String(progress).padStart(3, '0')}%
            </Mono>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 4,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              overflow: 'hidden',
              marginBottom: SPACE['2xl'],
              position: 'relative',
            }}
          >
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: MOTION.ease }}
              style={{
                height: '100%',
                background: `linear-gradient(90deg, ${COLORS.accentDeep}, ${COLORS.accent})`,
                boxShadow: `0 0 10px ${COLORS.accentGlow}`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 40,
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.35))',
                }}
              />
            </motion.div>
          </div>

          {/* System checks */}
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: SPACE.sm,
            }}
          >
            {CHECKS.map(({ key, label, threshold, Icon }) => {
              const active = progress >= threshold;
              return (
                <div
                  key={key}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                    padding: `${SPACE.xs + 2}px ${SPACE.sm}px`,
                    background: active ? 'rgba(225,29,72,0.06)' : COLORS.bgDeep,
                    border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                >
                  <Icon
                    size={13}
                    strokeWidth={2}
                    color={active ? COLORS.accent : COLORS.textDim}
                  />
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      color: active ? COLORS.accent : COLORS.textDim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: active ? COLORS.ok : COLORS.borderStrong,
                      boxShadow: active ? `0 0 6px ${COLORS.ok}` : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse-ring {
            0% { transform: scale(0.6); opacity: 0.9; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};
