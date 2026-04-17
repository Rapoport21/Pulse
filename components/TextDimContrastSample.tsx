import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Info, Clock, ChevronRight, GripVertical } from 'lucide-react';
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
  DotGridBg,
  GlowBg,
  ScanningLine,
} from './design';

/**
 * TextDimContrastSample — side-by-side preview of every candidate for
 * COLORS.textDim so Nick can eyeball legibility on device before committing
 * a new value to components/design/tokens.ts.
 *
 * Tracks T3.4 (Contrast audit) in docs/improvement-ideas.md. The current
 * textDim is #2E2E2E at ~1.5:1 contrast on the #050505 canvas — well below
 * WCAG AA (4.5:1). Proposed: #5A5A5A.
 *
 * Each candidate card shows the five real-world contexts where textDim
 * currently appears in the app (HUD metadata, info+label row, empty-state
 * dashes, timestamps, breadcrumb separators) so the preview matches what
 * the operator will actually read at 3am.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  variant?: 'mobile' | 'desktop';
}

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
  { id: 'cur',  hex: '#2E2E2E', note: 'Current',       role: 'current'  },
  { id: 's1',   hex: '#3A3A3A', note: '+1 step',       role: 'step'     },
  { id: 's2',   hex: '#4A4A4A', note: '+2 steps',      role: 'step'     },
  { id: 'mute', hex: '#525252', note: '= textMuted',   role: 'muted'    },
  { id: 'prop', hex: '#5A5A5A', note: 'Proposed',      role: 'proposed' },
  { id: 'aaa',  hex: '#707070', note: 'AAA',           role: 'aaa'      },
];

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
  <TacticalCard padding="md">
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}
    >
      {/* (1) HUD-strip style metadata row with separator pipes */}
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

      {/* (2) Info icon + faint label (e.g. "Syncs to N devices") */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={11} color={dim} strokeWidth={1.75} />
        <span style={monoDim(dim, 11)}>Syncs to 3 devices</span>
      </div>

      {/* (3) Empty-state dashes (bed board / vitals without data) */}
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
                fontSize: 10,
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
                fontSize: 16,
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
        <Clock size={10} strokeWidth={2} color={dim} />
        <span style={monoDim(dim, 11)}>Last vitals · 5m ago</span>
      </div>

      {/* (5) Breadcrumb with dim chevron separators */}
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
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: COLORS.textSecondary,
          }}
        >
          Floor 3
        </span>
        <ChevronRight size={12} strokeWidth={2} color={dim} />
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: COLORS.textSecondary,
          }}
        >
          ICU North
        </span>
        <ChevronRight size={12} strokeWidth={2} color={dim} />
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: COLORS.textPrimary,
          }}
        >
          Bed 12
        </span>
      </div>

      {/* (6) Drag handle + caption row (list affordance) */}
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
        <GripVertical size={12} color={dim} strokeWidth={2} />
        <span
          style={{
            flex: 1,
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.textPrimary,
            letterSpacing: '-0.005em',
          }}
        >
          Discharge summary
        </span>
        <span style={monoDim(dim, 10)}>Draft · 02:14 UTC</span>
      </div>
    </div>
  </TacticalCard>
);

// ─────────────────────────────────────────────────────────────────────────
// Main component — list of candidate cards, each with its own SampleBlock.
// ─────────────────────────────────────────────────────────────────────────
export const TextDimContrastSample: React.FC<Props> = ({
  open,
  onClose,
  variant = 'mobile',
}) => {
  const isMobile = variant === 'mobile';
  const bg = COLORS.bg;

  // Precompute ratios so we can reuse in the summary row.
  const rows = useMemo(
    () =>
      CANDIDATES.map((c) => {
        const ratio = contrastRatio(c.hex, bg);
        return { ...c, ratio, grade: wcagGrade(ratio) };
      }),
    [bg],
  );

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
            zIndex: 250, // above SettingsScreen (200)
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
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ChevronLeft size={14} strokeWidth={2} />
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
              paddingBottom: isMobile ? SPACE.xl : SPACE['2xl'],
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
                  // S05 · DISPLAY
                </Mono>
                <h2
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 18,
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
                    fontSize: 13,
                    color: COLORS.textSecondary,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  textDim is the palette's quietest text tone — separator
                  pipes, timestamps, empty-state dashes. Scroll through
                  the candidates and pick the one that reads comfortably
                  on this device. WCAG AA requires 4.5:1 on normal text.
                </p>

                {/* Summary grid */}
                <div
                  style={{
                    marginTop: SPACE.md,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: SPACE.sm,
                  }}
                >
                  {rows.map((r) => (
                    <div
                      key={`sum-${r.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.sm,
                        padding: `${SPACE.sm}px ${SPACE.sm}px`,
                        background: COLORS.surfaceElev,
                        border: `1px solid ${
                          r.role === 'proposed'
                            ? COLORS.accent
                            : COLORS.border
                        }`,
                        borderRadius: RADIUS.sm,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          flexShrink: 0,
                          background: r.hex,
                          border: `1px solid ${COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: COLORS.textPrimary,
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.ratio.toFixed(2)}:1
                      </span>
                      <StatusPill
                        label={r.grade.grade}
                        tone={r.grade.tone}
                        size="xs"
                      />
                    </div>
                  ))}
                </div>
              </TacticalCard>

              {/* One card per candidate */}
              {rows.map((r) => {
                const isCurrent = r.role === 'current';
                const isProposed = r.role === 'proposed';
                const borderCol = isProposed
                  ? COLORS.accent
                  : isCurrent
                  ? COLORS.crit
                  : COLORS.borderStrong;
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.sm,
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: SPACE.sm,
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: COLORS.surface,
                        border: `1px solid ${borderCol}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          flexShrink: 0,
                          background: r.hex,
                          border: `1px solid ${COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 13,
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
                      <span style={{ marginLeft: 'auto' }}>
                        {isCurrent && (
                          <Mono tone="crit" size="xs">
                            IN USE
                          </Mono>
                        )}
                        {isProposed && (
                          <Mono tone="accent" size="xs">
                            RECOMMENDED
                          </Mono>
                        )}
                        {!isCurrent && !isProposed && (
                          <Mono tone="dim" size="xs">
                            {r.note}
                          </Mono>
                        )}
                      </span>
                    </div>
                    <SampleBlock dim={r.hex} />
                  </div>
                );
              })}

              {/* Footer note */}
              <TacticalCard padding="md" style={{ borderColor: COLORS.accent }}>
                <Mono tone="accent" size="xs">
                  // RECOMMENDATION
                </Mono>
                <p
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    color: COLORS.textSecondary,
                    lineHeight: 1.5,
                    margin: `${SPACE.sm}px 0 0`,
                  }}
                >
                  Approved value gets set in{' '}
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    components/design/tokens.ts
                  </span>{' '}
                  under{' '}
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    COLORS.textDim
                  </span>
                  . Backlog T3.4 proposes{' '}
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      color: COLORS.textPrimary,
                    }}
                  >
                    #5A5A5A
                  </span>{' '}
                  — AA-compliant without losing the tactical "quiet data" feel.
                </p>
              </TacticalCard>
            </div>
          </div>

          {/* ── BOTTOM HUD (mobile only) ─────────────────────── */}
          {isMobile && (
            <div
              style={{
                flexShrink: 0,
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: COLORS.surface,
              }}
            >
              <HudStrip side="bottom" height={32}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Mono tone="dim" size="xs">
                    Display audit
                  </Mono>
                  <span style={{ color: COLORS.textDim }}>│</span>
                  <Mono tone="dim" size="xs">
                    WCAG AA
                  </Mono>
                </div>
                <Mono tone="dim" size="xs">
                  {CANDIDATES.length} candidates
                </Mono>
              </HudStrip>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextDimContrastSample;
