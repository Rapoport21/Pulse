import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { COLORS, FONTS, TYPE, RADIUS, SPACE, MOTION, CHROME } from './tokens';

/**
 * PULSE Tactical Design Primitives
 *
 * The minimal set of UI atoms and molecules that the Tactical direction
 * is built on. Every tab, modal, and surface should compose from these
 * rather than hand-rolling their own chrome.
 *
 * Primitives:
 *   - Mono          : monospace uppercase tracked label
 *   - StatusPill    : terminal-style [ STATUS ] with dot
 *   - CornerBracket : L-shaped decoration (Palantir signature)
 *   - BracketFrame  : wraps a child with four corner brackets
 *   - TacticalCard  : sharp-cornered panel with bracket-reveal on hover
 *   - SectionTitle  : h2 with divider and optional meta
 *   - Divider       : hairline or dashed rule
 *   - HudStrip      : fixed horizontal bar at top or bottom
 *   - ScanningLine  : ambient horizontal scanning motion line
 *   - DotGridBg     : subtle dot grid background layer
 *   - GlowBg        : radial rose glow from the bottom
 *   - KbdKey        : small kbd pill for keyboard shortcuts
 *   - MetricValue   : large numeric readout with label + trend
 *   - TacticalButton: primary/secondary button with tactical chrome
 *   - BracketLabel  : mono label wrapped in [ BRACKETS ]
 */

// ─────────────────────────────────────────────────────────────────────────
// Mono — monospace uppercase tracked label (the workhorse)
// ─────────────────────────────────────────────────────────────────────────
type MonoTone = 'primary' | 'secondary' | 'muted' | 'dim' | 'accent' | 'ok' | 'warn' | 'crit' | 'info';

const monoToneColor = (tone: MonoTone = 'secondary'): string => {
  switch (tone) {
    case 'primary':
      return COLORS.textPrimary;
    case 'secondary':
      return COLORS.textSecondary;
    case 'muted':
      return COLORS.textMuted;
    case 'dim':
      return COLORS.textDim;
    case 'accent':
      return COLORS.accent;
    case 'ok':
      return COLORS.ok;
    case 'warn':
      return COLORS.warn;
    case 'crit':
      return COLORS.crit;
    case 'info':
      return COLORS.info;
  }
};

interface MonoProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: MonoTone;
  size?: 'xs' | 'sm' | 'base';
  as?: 'span' | 'div';
}
export const Mono: React.FC<MonoProps> = ({
  tone = 'secondary',
  size = 'sm',
  as: Tag = 'span',
  style,
  children,
  ...rest
}) => {
  const scale = size === 'xs' ? TYPE.monoXs : size === 'base' ? TYPE.mono : TYPE.monoSm;
  return (
    <Tag
      style={{
        fontFamily: FONTS.mono,
        fontSize: scale.size,
        fontWeight: scale.weight,
        letterSpacing: scale.tracking,
        lineHeight: scale.lineHeight,
        textTransform: 'uppercase',
        color: monoToneColor(tone),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// BracketLabel — [ LABEL ] — mono wrapped in brackets
//
// Uses flex layout so brackets don't inherit letter-spacing from the
// inner label — otherwise `]` drifts right of the last character.
//
// Vertical alignment fix: in Geist Mono the `[` and `]` glyphs extend
// 22 font-units below the baseline (descender) while capital letters
// P/L/E sit exactly on the baseline (0 descent). Measured via the
// browser's `measureText` API at 200px font: letter visual center
// at -71, bracket visual center at -64 — so the bracket is 7 units
// (0.035em) closer to the baseline than the letter. The user
// perceives this as "P not aligned with the brackets" because the
// flex alignItems:center aligns the line boxes, not the ink inside.
// Fix: shift the bracket spans up by 0.035em so their visual center
// matches the letter cap-height center. Transform is used instead
// of margin so layout is unaffected.
// ─────────────────────────────────────────────────────────────────────────
const bracketGlyphStyle: React.CSSProperties = {
  opacity: 0.7,
  transform: 'translateY(-0.035em)',
  display: 'inline-block',
};

export const BracketLabel: React.FC<{
  children: React.ReactNode;
  tone?: MonoTone;
  size?: 'xs' | 'sm' | 'base';
  style?: React.CSSProperties;
}> = ({ children, tone = 'accent', size = 'sm', style }) => {
  const scale = size === 'xs' ? TYPE.monoXs : size === 'base' ? TYPE.mono : TYPE.monoSm;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: FONTS.mono,
        fontSize: scale.size,
        fontWeight: scale.weight,
        lineHeight: 1,
        textTransform: 'uppercase',
        color: monoToneColor(tone),
        whiteSpace: 'nowrap',
        letterSpacing: 0,
        ...style,
      }}
    >
      <span aria-hidden style={bracketGlyphStyle}>[</span>
      <span style={{ letterSpacing: scale.tracking }}>{children}</span>
      <span aria-hidden style={bracketGlyphStyle}>]</span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StatusPill — terminal-style live status with glowing dot
// ─────────────────────────────────────────────────────────────────────────
export type StatusTone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral';

const statusColor = (tone: StatusTone): string => {
  switch (tone) {
    case 'ok':
      return COLORS.ok;
    case 'warn':
      return COLORS.warn;
    case 'crit':
      return COLORS.crit;
    case 'info':
      return COLORS.info;
    case 'neutral':
      return COLORS.textSecondary;
  }
};

export const StatusPill: React.FC<{
  label: string;
  tone?: StatusTone;
  pulse?: boolean;
  size?: 'xs' | 'sm';
}> = ({ label, tone = 'ok', pulse = false, size = 'sm' }) => {
  const color = statusColor(tone);
  const dotSize = size === 'xs' ? 4 : 5;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: FONTS.mono,
        fontSize: size === 'xs' ? 9 : 10,
        fontWeight: 500,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: RADIUS.full,
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: pulse ? 'pulse-dot 1.8s ease-in-out infinite' : undefined,
        }}
      />
      {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// CornerBracket — L-shaped decoration (the Palantir signature)
// ─────────────────────────────────────────────────────────────────────────
export const CornerBracket: React.FC<{
  position: 'tl' | 'tr' | 'bl' | 'br';
  color?: string;
  size?: number;
  thickness?: number;
  inset?: number;
}> = ({
  position,
  color = COLORS.accent,
  size = 10,
  thickness = 1.5,
  inset = -1,
}) => {
  const [v, h] = position.split('') as Array<'t' | 'b' | 'l' | 'r'>;
  const style: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    [v === 't' ? 'top' : 'bottom']: inset,
    [h === 'l' ? 'left' : 'right']: inset,
    borderTop: v === 't' ? `${thickness}px solid ${color}` : undefined,
    borderBottom: v === 'b' ? `${thickness}px solid ${color}` : undefined,
    borderLeft: h === 'l' ? `${thickness}px solid ${color}` : undefined,
    borderRight: h === 'r' ? `${thickness}px solid ${color}` : undefined,
    pointerEvents: 'none',
  };
  return <span style={style} />;
};

// ─────────────────────────────────────────────────────────────────────────
// BracketFrame — wraps children with four corner brackets
// ─────────────────────────────────────────────────────────────────────────
export const BracketFrame: React.FC<{
  children?: React.ReactNode;
  color?: string;
  size?: number;
  visible?: boolean;
  animate?: boolean;
}> = ({ children, color = COLORS.accent, size = 10, visible = true, animate = false }) => (
  <motion.span
    aria-hidden
    initial={animate ? { opacity: 0 } : undefined}
    animate={animate ? { opacity: visible ? 1 : 0 } : undefined}
    transition={animate ? { duration: MOTION.fast } : undefined}
    style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      opacity: animate ? undefined : visible ? 1 : 0,
    }}
  >
    <CornerBracket position="tl" color={color} size={size} />
    <CornerBracket position="tr" color={color} size={size} />
    <CornerBracket position="bl" color={color} size={size} />
    <CornerBracket position="br" color={color} size={size} />
    {children}
  </motion.span>
);

// ─────────────────────────────────────────────────────────────────────────
// TacticalCard — the primary container element
// Sharp corners, hairline border, bracket-reveal on hover, optional accent
// ─────────────────────────────────────────────────────────────────────────
export interface TacticalCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> {
  /** Enable hover states (brackets + accent bar + sweep) */
  interactive?: boolean;
  /** Emphasize with accent border */
  highlight?: boolean;
  /** Show the accent bar on the left */
  accentBar?: boolean;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export const TacticalCard = React.forwardRef<HTMLDivElement, TacticalCardProps>(
  (
    {
      interactive = false,
      highlight = false,
      accentBar = false,
      padding = 'md',
      children,
      style,
      ...rest
    },
    ref,
  ) => {
    const [hovered, setHovered] = React.useState(false);
    const pad =
      padding === 'none'
        ? 0
        : padding === 'sm'
        ? SPACE.md
        : padding === 'lg'
        ? SPACE.xl
        : SPACE.base;

    const borderColor = highlight
      ? COLORS.accent
      : interactive && hovered
      ? COLORS.accent
      : COLORS.border;
    const bg = interactive && hovered ? COLORS.surfaceElev : COLORS.surface;

    return (
      <div
        ref={ref}
        onMouseEnter={interactive ? () => setHovered(true) : undefined}
        onMouseLeave={interactive ? () => setHovered(false) : undefined}
        style={{
          position: 'relative',
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: RADIUS.sm,
          padding: pad,
          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
          overflow: 'hidden',
          ...style,
        }}
        {...rest}
      >
        {/* Accent bar on the left */}
        {(accentBar || (interactive && hovered)) && (
          <motion.span
            aria-hidden
            initial={{ width: 0 }}
            animate={{ width: accentBar ? 3 : hovered ? 3 : 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              background: COLORS.accent,
              boxShadow: `0 0 14px ${COLORS.accent}80`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Corner brackets on hover */}
        {interactive && (
          <BracketFrame visible={hovered} animate />
        )}

        {/* Scanline sweep on hover */}
        {interactive && (
          <AnimatePresence>
            {hovered && (
              <motion.span
                key="sweep"
                aria-hidden
                initial={{ x: '-100%', opacity: 0 }}
                animate={{ x: '100%', opacity: 0.28 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '40%',
                  background: `linear-gradient(90deg, transparent, ${COLORS.accent}33, transparent)`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>
        )}

        {children}
      </div>
    );
  },
);
TacticalCard.displayName = 'TacticalCard';

// ─────────────────────────────────────────────────────────────────────────
// SectionTitle — bracket-marked h2 with optional meta + divider
// ─────────────────────────────────────────────────────────────────────────
export const SectionTitle: React.FC<{
  label: string;
  id?: string;
  meta?: React.ReactNode;
  divider?: boolean;
  style?: React.CSSProperties;
}> = ({ label, id, meta, divider = true, style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.md,
      paddingBottom: divider ? SPACE.md : 0,
      marginBottom: SPACE.base,
      borderBottom: divider ? `1px solid ${COLORS.border}` : undefined,
      ...style,
    }}
  >
    {id && <Mono tone="dim">// {id}</Mono>}
    <h2
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.h2.size,
        fontWeight: TYPE.h2.weight,
        letterSpacing: TYPE.h2.tracking,
        lineHeight: TYPE.h2.lineHeight,
        color: COLORS.textPrimary,
        margin: 0,
      }}
    >
      {label}
    </h2>
    <div
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, ${COLORS.border}, transparent)`,
      }}
    />
    {meta && <div style={{ flexShrink: 0 }}>{meta}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Divider — horizontal rule, solid or dashed
// ─────────────────────────────────────────────────────────────────────────
export const Divider: React.FC<{
  variant?: 'solid' | 'dashed';
  color?: string;
  style?: React.CSSProperties;
}> = ({ variant = 'solid', color = COLORS.border, style }) => (
  <hr
    style={{
      border: 'none',
      borderTop: `1px ${variant} ${color}`,
      margin: 0,
      ...style,
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────
// HudStrip — horizontal bar at the top or bottom of a screen.
//
// When `fixed` is true the strip is anchored to the viewport via
// position:fixed. On iPhone this means the strip would otherwise sit
// directly under the dynamic island (top) or behind the home indicator
// (bottom), so we expand the box height by the matching safe-area
// inset and push the visible content into a padding edge — the strip
// stays the right colour edge-to-edge while the controls hug the
// content area.
// ─────────────────────────────────────────────────────────────────────────
export const HudStrip: React.FC<{
  side: 'top' | 'bottom';
  fixed?: boolean;
  children: React.ReactNode;
  height?: number;
}> = ({ side, fixed = false, children, height }) => {
  const h = height ?? (side === 'top' ? CHROME.headerHeight : CHROME.footerHeight);
  const safeInset = side === 'top' ? 'env(safe-area-inset-top)' : 'env(safe-area-inset-bottom)';
  return (
    <div
      style={{
        position: fixed ? 'fixed' : 'relative',
        left: fixed ? 0 : undefined,
        right: fixed ? 0 : undefined,
        [side]: fixed ? 0 : undefined,
        // Reserve safe-area space when the strip is anchored to the
        // viewport edge. With box-sizing:border-box (set globally),
        // the visible content remains `h` tall.
        height: fixed ? `calc(${h}px + ${safeInset})` : h,
        paddingTop: fixed && side === 'top' ? safeInset : undefined,
        paddingBottom: fixed && side === 'bottom' ? safeInset : undefined,
        display: 'flex',
        alignItems: 'center',
        // Horizontal padding still respects landscape safe areas so
        // controls don't disappear under rounded corners.
        paddingLeft: `max(${SPACE.base}px, env(safe-area-inset-left))`,
        paddingRight: `max(${SPACE.base}px, env(safe-area-inset-right))`,
        borderTop: side === 'bottom' ? `1px solid ${COLORS.border}` : undefined,
        borderBottom: side === 'top' ? `1px solid ${COLORS.border}` : undefined,
        background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bg} 100%)`,
        zIndex: fixed ? 20 : undefined,
        gap: SPACE.base,
        fontFamily: FONTS.mono,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ScanningLine — ambient horizontal motion line
// ─────────────────────────────────────────────────────────────────────────
export const ScanningLine: React.FC<{
  color?: string;
  duration?: number;
}> = ({ color = COLORS.accent, duration = MOTION.ambient }) => (
  <motion.div
    aria-hidden
    initial={{ y: '-10%', opacity: 0 }}
    animate={{ y: '110%', opacity: [0, 0.5, 0.5, 0] }}
    transition={{
      duration,
      repeat: Infinity,
      ease: MOTION.linear,
      times: [0, 0.1, 0.9, 1],
    }}
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
      pointerEvents: 'none',
      zIndex: 2,
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────
// DotGridBg — subtle dotted grid background layer
// ─────────────────────────────────────────────────────────────────────────
export const DotGridBg: React.FC<{
  opacity?: number;
  mask?: boolean;
}> = ({ opacity = 0.35, mask = true }) => (
  <div
    aria-hidden
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      opacity,
      maskImage: mask
        ? 'radial-gradient(ellipse 80% 60% at center, black 40%, transparent 100%)'
        : undefined,
      WebkitMaskImage: mask
        ? 'radial-gradient(ellipse 80% 60% at center, black 40%, transparent 100%)'
        : undefined,
      pointerEvents: 'none',
      zIndex: 0,
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────
// GlowBg — radial rose glow from a corner
// ─────────────────────────────────────────────────────────────────────────
export const GlowBg: React.FC<{
  origin?: 'bottom' | 'top' | 'left' | 'right' | 'center';
  color?: string;
  intensity?: number;
}> = ({ origin = 'bottom', color = COLORS.accentDim, intensity = 1 }) => {
  const pos =
    origin === 'bottom'
      ? '50% 110%'
      : origin === 'top'
      ? '50% -10%'
      : origin === 'left'
      ? '-10% 50%'
      : origin === 'right'
      ? '110% 50%'
      : '50% 50%';
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 70% 50% at ${pos}, ${color}, transparent 60%)`,
        opacity: intensity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────
// KbdKey — small kbd pill for keyboard shortcuts
// ─────────────────────────────────────────────────────────────────────────
export const KbdKey: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 500,
      color: COLORS.textSecondary,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      lineHeight: 1,
    }}
  >
    {children}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────
// MetricValue — large numeric readout with label + optional delta
// ─────────────────────────────────────────────────────────────────────────
export const MetricValue: React.FC<{
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'primary' | 'ok' | 'warn' | 'crit';
  size?: 'md' | 'lg' | 'xl';
}> = ({ label, value, delta, tone = 'primary', size = 'md' }) => {
  const valueSize = size === 'xl' ? 48 : size === 'lg' ? 36 : 26;
  const valueColor =
    tone === 'ok'
      ? COLORS.ok
      : tone === 'warn'
      ? COLORS.warn
      : tone === 'crit'
      ? COLORS.crit
      : COLORS.textPrimary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Mono tone="muted" size="xs">
        {label}
      </Mono>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: valueSize,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            color: valueColor,
          }}
        >
          {value}
        </span>
        {delta && (
          <Mono tone={tone === 'primary' ? 'muted' : tone} size="xs">
            {delta}
          </Mono>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// TacticalButton — primary / secondary / ghost
// ─────────────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface TacticalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const TacticalButton = React.forwardRef<HTMLButtonElement, TacticalButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      fullWidth,
      children,
      style,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const [hovered, setHovered] = React.useState(false);
    const height = size === 'sm' ? 28 : 36;
    const padX = size === 'sm' ? 12 : 16;
    const fontSize = size === 'sm' ? 11 : 12;

    const palette = (() => {
      switch (variant) {
        case 'primary':
          return {
            bg: hovered ? COLORS.accent : COLORS.surfaceElev,
            border: COLORS.accent,
            color: hovered ? COLORS.textPrimary : COLORS.accent,
            glow: hovered ? `0 0 20px ${COLORS.accent}60` : 'none',
          };
        case 'danger':
          return {
            bg: hovered ? COLORS.crit : COLORS.surfaceElev,
            border: COLORS.crit,
            color: hovered ? COLORS.textPrimary : COLORS.crit,
            glow: hovered ? `0 0 20px ${COLORS.crit}60` : 'none',
          };
        case 'ghost':
          return {
            bg: hovered ? COLORS.surface : 'transparent',
            border: hovered ? COLORS.border : 'transparent',
            color: hovered ? COLORS.textPrimary : COLORS.textSecondary,
            glow: 'none',
          };
        case 'secondary':
        default:
          return {
            bg: hovered ? COLORS.surfaceElev : COLORS.surface,
            border: hovered ? COLORS.borderStrong : COLORS.border,
            color: hovered ? COLORS.textPrimary : COLORS.textSecondary,
            glow: 'none',
          };
      }
    })();

    return (
      <button
        ref={ref}
        disabled={disabled}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height,
          padding: `0 ${padX}px`,
          width: fullWidth ? '100%' : undefined,
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          borderRadius: RADIUS.sm,
          color: palette.color,
          boxShadow: palette.glow,
          fontFamily: FONTS.mono,
          fontSize,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
          ...style,
        }}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  },
);
TacticalButton.displayName = 'TacticalButton';

// ─────────────────────────────────────────────────────────────────────────
// ConfidenceBadge — PULSE-native confidence + freshness indicator
//
// Every data tile in PULSE should carry two signals:
//   1. Confidence — how sure the system is (0–100%)
//   2. Freshness — how old the data is
//
// This is a core differentiator: nothing else in hospital software
// makes data quality this explicit. When confidence is low or data is
// stale, the badge dims and shows a warning state, building trust
// through transparency.
// ─────────────────────────────────────────────────────────────────────────

type FreshnessLevel = 'live' | 'recent' | 'stale' | 'offline';

function freshnessFromMinutes(min: number): FreshnessLevel {
  if (min <= 1) return 'live';
  if (min <= 10) return 'recent';
  if (min <= 60) return 'stale';
  return 'offline';
}

const freshnessColor: Record<FreshnessLevel, string> = {
  live: COLORS.ok,
  recent: COLORS.info,
  stale: COLORS.warn,
  offline: COLORS.crit,
};

const freshnessLabel: Record<FreshnessLevel, string> = {
  live: 'LIVE',
  recent: 'RECENT',
  stale: 'STALE',
  offline: 'OFFLINE',
};

export interface ConfidenceBadgeProps {
  /** Confidence percentage 0–100. */
  confidence: number;
  /** Data age in minutes. */
  ageMinutes: number;
  /** Compact mode — just dot + number, no freshness label. */
  compact?: boolean;
  style?: React.CSSProperties;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  ageMinutes,
  compact = false,
  style,
}) => {
  const freshness = freshnessFromMinutes(ageMinutes);
  const fColor = freshnessColor[freshness];
  const confColor = confidence >= 80 ? COLORS.ok : confidence >= 50 ? COLORS.warn : COLORS.crit;
  const ageText = ageMinutes < 1 ? '<1M' : ageMinutes < 60 ? `${Math.round(ageMinutes)}M` : `${Math.round(ageMinutes / 60)}H`;

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontFamily: FONTS.mono,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.12em',
          color: confColor,
          opacity: freshness === 'stale' ? 0.7 : freshness === 'offline' ? 0.5 : 1,
          ...style,
        }}
      >
        <span style={{
          width: 4,
          height: 4,
          borderRadius: RADIUS.full,
          background: fColor,
          boxShadow: freshness === 'live' ? `0 0 4px ${fColor}` : undefined,
        }} />
        {confidence}%
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: `1px ${SPACE.xs}px`,
        background: `${fColor}10`,
        border: `1px solid ${fColor}20`,
        borderRadius: RADIUS.sm,
        opacity: freshness === 'stale' ? 0.7 : freshness === 'offline' ? 0.5 : 1,
        ...style,
      }}
    >
      <span style={{
        width: 4,
        height: 4,
        borderRadius: RADIUS.full,
        background: fColor,
        boxShadow: freshness === 'live' ? `0 0 4px ${fColor}` : undefined,
      }} />
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 8,
        fontWeight: 500,
        letterSpacing: '0.14em',
        color: fColor,
        textTransform: 'uppercase',
      }}>
        {freshnessLabel[freshness]}
      </span>
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 8,
        fontWeight: 500,
        letterSpacing: '0.1em',
        color: confColor,
      }}>
        {confidence}%
      </span>
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 8,
        fontWeight: 500,
        letterSpacing: '0.1em',
        color: COLORS.textDim,
      }}>
        {ageText}
      </span>
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// EmptyState — centered zero-data placeholder
//
// One primitive for every "nothing to show" surface in the app. Before
// this existed, every screen hand-rolled its own empty block with slightly
// different padding, icon sizes, label casing, and copy. That produced
// visual drift and — worse — a handful of empty surfaces that just went
// blank and left a stranded title above nothing.
//
// The component renders INSIDE a TacticalCard (does not wrap one) so it
// composes cleanly in both standalone cards and inside existing list
// cards (e.g. a "Queue Clear" state that lives inside the Actions card).
//
// Tone tints the icon frame and the mono label. Default `muted` reads
// neutral ("no data yet"); use `ok` for positive zero-states ("queue
// clear — nothing to do"), `warn` / `crit` for concerning zero-states
// ("no EMS inbound" during a code, "no staff assigned to unit").
// ─────────────────────────────────────────────────────────────────────────
type EmptyStateTone = 'ok' | 'info' | 'warn' | 'crit' | 'muted' | 'accent';

const emptyStateToneColor = (tone: EmptyStateTone): string => {
  switch (tone) {
    case 'ok':
      return COLORS.ok;
    case 'info':
      return COLORS.info;
    case 'warn':
      return COLORS.warn;
    case 'crit':
      return COLORS.crit;
    case 'accent':
      return COLORS.accent;
    case 'muted':
      return COLORS.textMuted;
  }
};

const emptyStateToneMonoTone = (tone: EmptyStateTone): MonoTone => {
  switch (tone) {
    case 'ok':
      return 'ok';
    case 'info':
      return 'info';
    case 'warn':
      return 'warn';
    case 'crit':
      return 'crit';
    case 'accent':
      return 'accent';
    case 'muted':
      return 'muted';
  }
};

export interface EmptyStateProps {
  /** Optional icon rendered inside a 48×48 framed tile above the label. */
  icon?: React.ReactNode;
  /** Mono all-caps label — e.g. "QUEUE CLEAR", "NO PATIENTS MATCH". */
  label: string;
  /** Optional sans title below the label — e.g. "All actions complete". */
  title?: string;
  /** Optional helper text explaining the state or next step. */
  description?: string | React.ReactNode;
  /** Tone tints the icon frame + mono label. Default `muted`. */
  tone?: EmptyStateTone;
  /** Optional action node — button / link. */
  action?: React.ReactNode;
  /** Compact mode for inline use inside small cards (less vertical padding). */
  compact?: boolean;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  label,
  title,
  description,
  tone = 'muted',
  action,
  compact = false,
  style,
}) => {
  const c = emptyStateToneColor(tone);
  const padY = compact ? SPACE.lg : SPACE['2xl'];
  const padX = compact ? SPACE.base : SPACE.lg;
  const iconSize = compact ? 40 : 56;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? SPACE.sm : SPACE.md,
        padding: `${padY}px ${padX}px`,
        textAlign: 'center',
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            width: iconSize,
            height: iconSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.surfaceElev,
            border: `1px solid ${c}`,
            borderRadius: RADIUS.sm,
            color: c,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <Mono tone={emptyStateToneMonoTone(tone)} size="xs">
        {label}
      </Mono>
      {title && (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: compact ? TYPE.bodySm.size : TYPE.h4.size,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            color: COLORS.textPrimary,
            maxWidth: 360,
          }}
        >
          {title}
        </div>
      )}
      {description && (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: TYPE.bodySm.size,
            lineHeight: 1.45,
            color: COLORS.textSecondary,
            maxWidth: 360,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: SPACE.xs }}>{action}</div>}
    </div>
  );
};
