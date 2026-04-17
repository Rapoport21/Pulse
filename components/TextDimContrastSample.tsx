import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Info,
  Clock,
  ChevronRight,
  GripVertical,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  HudStrip,
  TacticalCard,
  TacticalButton,
  DotGridBg,
  GlowBg,
  ScanningLine,
  TEXT_DIM_DEFAULT_HEX,
} from './design';
import { triggerHaptic } from '../lib/haptics';

/**
 * TextDimContrastSample — interactive preview of every candidate for
 * COLORS.textDim. Tap a card to select, then tap APPLY to write the hex
 * into localStorage and reload so the whole app picks up the override
 * via tokens.ts at module load time.
 *
 * Tracks T3.4 (Contrast audit) in docs/improvement-ideas.md. The current
 * textDim default is #2E2E2E at ~1.5:1 contrast on the #050505 canvas —
 * well below WCAG AA (4.5:1). Proposed: #5A5A5A at ~5.0:1.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  variant?: 'mobile' | 'desktop';
}

const STORAGE_KEY = 'pulse-text-dim';

// ─────────────────────────────────────────────────────────────────────────
// WCAG 2.x relative luminance + contrast ratio
// ─────────────────────────────────────────────────────────────────────────
function relativeLuminance(hex: string): number {
  const n = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

type Grade = 'FAIL' | 'AA LG' | 'AA' | 'AAA';
function wcagGrade(ratio: number): {
  grade: Grade;
  tone: 'ok' | 'warn' | 'crit';
} {
  if (ratio >= 7) return { grade: 'AAA', tone: 'ok' };
  if (ratio >= 4.5) return { grade: 'AA', tone: 'ok' };
  if (ratio >= 3) return { grade: 'AA LG', tone: 'warn' };
  return { grade: 'FAIL', tone: 'crit' };
}

// ─────────────────────────────────────────────────────────────────────────
// Candidate palette — current, graded steps up to AAA.
// ─────────────────────────────────────────────────────────────────────────
type CandidateRole = 'current' | 'step' | 'muted' | 'proposed' | 'aaa';
interface Candidate {
  hex: string;
  id: string;
  note: string;
  role: CandidateRole;
}
const CANDIDATES: Candidate[] = [
  { id: 'cur',  hex: '#2E2E2E', note: 'Default',       role: 'current'  },
  { id: 's1',   hex: '#3A3A3A', note: '+1 step',       role: 'step'     },
  { id: 's2',   hex: '#4A4A4A', note: '+2 steps',      role: 'step'     },
  { id: 'mute', hex: '#525252', note: '= textMuted',   role: 'muted'    },
  { id: 'prop', hex: '#5A5A5A', note: 'Proposed',      role: 'proposed' },
  { id: 'aaa',  hex: '#707070', note: 'AAA',           role: 'aaa'      },
];

function readActiveOverride(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function findCandidateForHex(hex: string | null): string {
  if (!hex) return 'cur';
  const match = CANDIDATES.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase(),
  );
  return match?.id ?? 'cur';
}

// ─────────────────────────────────────────────────────────────────────────
// SampleBlock — one card showing textDim in its five real contexts.
// ─────────────────────────────────────────────────────────────────────────
const monoDim = (dim: string, size: number): React.CSSProperties => ({
  fontFamily: FONTS.mono,
  fontSize: size,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: dim,
  lineHeight: 1.25,
});

const SampleBlock: React.FC<{ dim: string }> = ({ dim }) => (
  <div
    style={{
      padding: SPACE.md,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE.md,
    }}
  >
    {/* (1) HUD-strip metadata row with separator pipes */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACE.sm,
        paddingBottom: SPACE.sm,
        borderBottom: `1px dashed ${COLORS.border}`,
      }}
    >
      <span style={monoDim(dim, 11)}>Node ER-01</span>
      <span style={{ color: dim, lineHeight: 1 }}>│</span>
      <span style={monoDim(dim, 11)}>TLS 1.3</span>
      <span style={{ color: dim, lineHeight: 1 }}>│</span>
      <span style={monoDim(dim, 11)}>PULSE v1.2.4</span>
    </div>

    {/* (2) Info icon + faint label */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Info size={14} color={dim} strokeWidth={1.75} />
      <span style={monoDim(dim, 11)}>Syncs to 3 devices</span>
    </div>

    {/* (3) Empty-state dashes */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: SPACE.sm,
      }}
    >
      {['BP', 'HR', 'SPO2', 'TEMP'].map((k) => (
        <div
          key={k}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: SPACE.sm,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            background: COLORS.surfaceElev,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: COLORS.textMuted,
            }}
          >
            {k}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 19,
              color: dim,
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            --
          </span>
        </div>
      ))}
    </div>

    {/* (4) Timestamp row with clock icon */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Clock size={13} strokeWidth={2} color={dim} />
      <span style={monoDim(dim, 11)}>Last vitals · 5m ago</span>
    </div>

    {/* (5) Breadcrumb */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLORS.textSecondary,
        }}
      >
        Floor 3
      </span>
      <ChevronRight size={15} strokeWidth={2} color={dim} />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLORS.textSecondary,
        }}
      >
        ICU North
      </span>
      <ChevronRight size={15} strokeWidth={2} color={dim} />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLORS.textPrimary,
        }}
      >
        Bed 12
      </span>
    </div>

    {/* (6) Drag handle + caption */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        padding: SPACE.sm,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <GripVertical size={15} color={dim} strokeWidth={2} />
      <span
        style={{
          flex: 1,
          fontFamily: FONTS.sans,
          fontSize: 16,
          color: COLORS.textPrimary,
          letterSpacing: '-0.005em',
        }}
      >
        Discharge summary
      </span>
      <span style={monoDim(dim, 10)}>Draft · 02:14 UTC</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export const TextDimContrastSample: React.FC<Props> = ({
  open,
  onClose,
  variant = 'mobile',
}) => {
  const isMobile = variant === 'mobile';
  const bg = COLORS.bg;

  // Active hex = whatever COLORS.textDim currently resolves to (localStorage
  // override or default). selectedId tracks the user's tentative pick until
  // they tap APPLY.
  const activeHex = COLORS.textDim;
  const [selectedId, setSelectedId] = useState<string>(() =>
    findCandidateForHex(readActiveOverride()),
  );
  const [justApplied, setJustApplied] = useState(false);

  const rows = useMemo(
    () =>
      CANDIDATES.map((c) => {
        const ratio = contrastRatio(c.hex, bg);
        return { ...c, ratio, grade: wcagGrade(ratio) };
      }),
    [bg],
  );

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const selectedIsActive =
    selected.hex.toLowerCase() === activeHex.toLowerCase();

  const handleSelect = (id: string) => {
    triggerHaptic('light');
    setSelectedId(id);
    setJustApplied(false);
  };

  const handleApply = () => {
    triggerHaptic('medium');
    try {
      if (selected.hex === TEXT_DIM_DEFAULT_HEX) {
        // Selecting the default = clearing the override.
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, selected.hex);
      }
    } catch {
      // If localStorage is unavailable the reload still won't hurt.
    }
    setJustApplied(true);
    // Small delay so the user sees the "applied" flash before the reload
    // wipes the screen.
    setTimeout(() => {
      window.location.reload();
    }, 420);
  };

  const handleReset = () => {
    triggerHaptic('medium');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setJustApplied(true);
    setTimeout(() => {
      window.location.reload();
    }, 420);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="contrast-sample"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
          style={{
            position: 'fixed',
            inset: 0,
            background: bg,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sans,
            zIndex: 250,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingTop: isMobile ? 'env(safe-area-inset-top)' : 0,
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          <DotGridBg opacity={0.25} />
          <GlowBg
            origin="bottom"
            color={COLORS.accentDim}
            intensity={0.3}
          />
          <ScanningLine color={COLORS.accent} duration={18} />

          {/* ── TOP HUD ────────────────────────────────────────── */}
          <HudStrip side="top" height={isMobile ? 48 : 44}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                flex: 1,
                minWidth: 0,
              }}
            >
              <motion.button
                type="button"
                onClick={onClose}
                aria-label="Close contrast check"
                whileTap={{ scale: 0.94 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `6px ${SPACE.sm}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                  fontFamily: FONTS.mono,
                  fontSize: 15,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ChevronLeft size={17} strokeWidth={2} />
                Back
              </motion.button>
              <BracketLabel tone="accent" size={isMobile ? 'sm' : 'base'}>
                CONTRAST CHECK
              </BracketLabel>
            </div>
            <Mono tone="dim" size="xs">
              T3.4
            </Mono>
          </HudStrip>

          {/* ── BODY ──────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              zIndex: 1,
              padding: isMobile ? SPACE.base : SPACE.xl,
              // Reserve room for the sticky APPLY footer so the last
              // candidate card isn't hidden under it.
              paddingBottom: isMobile ? 120 : 140,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: isMobile ? '100%' : 720,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.xl,
              }}
            >
              {/* Intro card */}
              <TacticalCard padding="md">
                <Mono tone="accent" size="xs">
                  // S04 · DISPLAY
                </Mono>
                <h2
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 23,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25,
                    color: COLORS.textPrimary,
                    margin: `${SPACE.sm}px 0 4px`,
                  }}
                >
                  textDim contrast check
                </h2>
                <p
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 16,
                    color: COLORS.textSecondary,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Tap a candidate to pick it, then tap APPLY. The app
                  reloads with that value for <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    COLORS.textDim
                  </span>{' '}
                  wired everywhere — HUD pipes, timestamps, dashes. WCAG AA
                  wants 4.5:1 on normal text.
                </p>
              </TacticalCard>

              {/* One tappable card per candidate */}
              {rows.map((r) => {
                const isSelected = r.id === selectedId;
                const isActive =
                  r.hex.toLowerCase() === activeHex.toLowerCase();
                const borderCol = isSelected
                  ? COLORS.accent
                  : isActive
                  ? COLORS.ok
                  : COLORS.borderStrong;
                return (
                  <motion.button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelect(r.id)}
                    whileTap={{ scale: 0.995 }}
                    transition={{
                      duration: MOTION.fast,
                      ease: MOTION.ease,
                    }}
                    aria-pressed={isSelected}
                    aria-label={`Select ${r.hex} for textDim`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.sm,
                      padding: SPACE.sm,
                      background: isSelected
                        ? COLORS.accentDim
                        : 'transparent',
                      border: `1px solid ${borderCol}`,
                      borderRadius: RADIUS.sm,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: FONTS.sans,
                      color: COLORS.textPrimary,
                      // outline ring when selected for bolder confirmation
                      boxShadow: isSelected
                        ? `0 0 0 1px ${COLORS.accent} inset, 0 0 16px ${COLORS.accentGlow}`
                        : isActive
                        ? `0 0 0 1px ${COLORS.ok} inset`
                        : 'none',
                    }}
                  >
                    {/* Header row — hex, ratio, grade, badges */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: SPACE.sm,
                        padding: `${SPACE.sm}px ${SPACE.sm}px`,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          flexShrink: 0,
                          background: r.hex,
                          border: `1px solid ${COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 16,
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: COLORS.textPrimary,
                        }}
                      >
                        {r.hex}
                      </span>
                      <Mono tone="muted" size="xs">
                        {r.ratio.toFixed(2)}:1
                      </Mono>
                      <StatusPill
                        label={r.grade.grade}
                        tone={r.grade.tone}
                        size="xs"
                      />
                      <span
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                        }}
                      >
                        {isActive && (
                          <Mono tone="ok" size="xs">
                            ACTIVE
                          </Mono>
                        )}
                        {isSelected && !isActive && (
                          <Mono tone="accent" size="xs">
                            SELECTED
                          </Mono>
                        )}
                        {!isSelected && !isActive && (
                          <Mono tone="dim" size="xs">
                            {r.note}
                          </Mono>
                        )}
                        {isSelected && (
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: RADIUS.full,
                              background: COLORS.accent,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Check
                              size={13}
                              strokeWidth={3}
                              color={COLORS.textPrimary}
                            />
                          </span>
                        )}
                      </span>
                    </div>
                    <SampleBlock dim={r.hex} />
                  </motion.button>
                );
              })}

              {/* Footer note */}
              <TacticalCard padding="md">
                <Mono tone="accent" size="xs">
                  // RUNTIME OVERRIDE
                </Mono>
                <p
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 16,
                    color: COLORS.textSecondary,
                    lineHeight: 1.5,
                    margin: `${SPACE.sm}px 0 0`,
                  }}
                >
                  APPLY writes the pick to{' '}
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    localStorage['{STORAGE_KEY}']
                  </span>{' '}
                  and reloads. The app rehydrates{' '}
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    COLORS.textDim
                  </span>{' '}
                  from that value at module load. Tap RESET to clear and
                  fall back to the default{' '}
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    {TEXT_DIM_DEFAULT_HEX}
                  </span>
                  .
                </p>
              </TacticalCard>
            </div>
          </div>

          {/* ── STICKY APPLY FOOTER ──────────────────────────── */}
          <div
            style={{
              flexShrink: 0,
              paddingBottom: 'env(safe-area-inset-bottom)',
              background: COLORS.surface,
              borderTop: `1px solid ${COLORS.border}`,
              zIndex: 2,
              position: 'relative',
            }}
          >
            <div
              style={{
                padding: SPACE.md,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.sm,
              }}
            >
              {/* Current selection line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  paddingBottom: SPACE.sm,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <Mono tone="dim" size="xs">
                  Selected
                </Mono>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                    background: selected.hex,
                    border: `1px solid ${COLORS.borderStrong}`,
                    borderRadius: RADIUS.sm,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: COLORS.textPrimary,
                  }}
                >
                  {selected.hex}
                </span>
                <Mono tone="muted" size="xs">
                  {selected.ratio.toFixed(2)}:1
                </Mono>
                <StatusPill
                  label={selected.grade.grade}
                  tone={selected.grade.tone}
                  size="xs"
                />
                {selectedIsActive && (
                  <span style={{ marginLeft: 'auto' }}>
                    <Mono tone="ok" size="xs">
                      Already active
                    </Mono>
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: SPACE.sm,
                }}
              >
                <div style={{ flex: 1 }}>
                  <TacticalButton
                    variant="primary"
                    fullWidth
                    size="md"
                    icon={
                      justApplied ? (
                        <Check size={17} strokeWidth={2} />
                      ) : undefined
                    }
                    onClick={handleApply}
                    disabled={selectedIsActive || justApplied}
                    style={{ height: 44 }}
                  >
                    {justApplied
                      ? 'Applied · reloading'
                      : selectedIsActive
                      ? 'Already applied'
                      : 'Apply & reload'}
                  </TacticalButton>
                </div>
                <div style={{ flexShrink: 0, width: 120 }}>
                  <TacticalButton
                    variant="secondary"
                    fullWidth
                    size="md"
                    icon={<RotateCcw size={17} strokeWidth={2} />}
                    onClick={handleReset}
                    disabled={
                      justApplied ||
                      activeHex.toLowerCase() ===
                        TEXT_DIM_DEFAULT_HEX.toLowerCase()
                    }
                    style={{ height: 44 }}
                  >
                    Reset
                  </TacticalButton>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextDimContrastSample;
