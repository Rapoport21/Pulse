import { motion, useTransform, type MotionValue } from 'motion/react';
import { PinnedScrub } from '../components/PinnedScrub';
import { HudPanel } from '../components/HudPanel';

/**
 * Forecast Engine — pinned scrub. Three variants (Capacity, Risk, Staffing)
 * share the same big background scene; foreground forecast surface and
 * floating spec cards crossfade per variant.
 *
 * Direct port of Relats's "Revitex" pattern: variants list (left-bottom),
 * hero visual (center), spec cards (right). Same primitives, different
 * vocabulary.
 */

type Variant = {
  name: string;
  metric: string;
  unit: string;
  delta: string;
  primary: { label: string; value: string };
  secondary: { label: string; value: string };
  tertiary: { label: string; value: string };
  series: number[];
  color: string;
};

const VARIANTS: Variant[] = [
  {
    name: 'Capacity',
    metric: '102',
    unit: '% ED OCCUPANCY · T+90',
    delta: '↑ +15 pts',
    primary: { label: 'Beds available', value: '4 of 47' },
    secondary: { label: 'Boarding hours', value: '38.6 / forecast' },
    tertiary: { label: 'Confidence', value: 'High · 0.91' },
    series: [62, 64, 68, 71, 74, 78, 82, 86, 89, 93, 97, 102],
    color: 'var(--accent)',
  },
  {
    name: 'Risk',
    metric: '0.74',
    unit: 'COMPOSITE RISK SCORE · T+90',
    delta: '↑ +0.18',
    primary: { label: 'Driver · Boarding', value: '+0.21' },
    secondary: { label: 'Driver · Acuity', value: '+0.11' },
    tertiary: { label: 'Confidence', value: 'High · 0.88' },
    series: [0.31, 0.33, 0.36, 0.41, 0.46, 0.52, 0.58, 0.63, 0.67, 0.7, 0.72, 0.74],
    color: 'var(--warn)',
  },
  {
    name: 'Staffing',
    metric: '−6',
    unit: 'NURSE COVERAGE GAP · 22:00',
    delta: '↓ 6 RNs short',
    primary: { label: 'MED-SURG', value: '−4' },
    secondary: { label: 'TELE', value: '−2' },
    tertiary: { label: 'Confidence', value: 'Medium · 0.74' },
    series: [0, -1, -1, -2, -2, -3, -4, -5, -5, -6, -6, -6],
    color: 'var(--info)',
  },
];

export function ForecastEngine() {
  return (
    <PinnedScrub id="forecast" viewports={9} variants={VARIANTS.length}>
      {({ progress, variantIndex }) => (
        <ForecastInner progress={progress} variantIndex={variantIndex} />
      )}
    </PinnedScrub>
  );
}

function ForecastInner({
  progress,
  variantIndex,
}: {
  progress: MotionValue<number>;
  variantIndex: MotionValue<number>;
}) {
  // Headline fades out as we leave the intro of the section
  // Section title fades out fast so the first variant scene gets a clean stage.
  // Note: framer-motion's `useScroll` returns progress on a different scale
  // than the [0..1] you'd compute by hand for `target` + `offset:'start start'/'end end'` —
  // empirically the value scales ~0.3× for tall pinned sections. So our fade
  // range here is intentionally TINY — it lands at scrollY ~50px past the
  // section start, which is the right "the moment you start scrolling" cue.
  const headlineOpacity = useTransform(progress, [0, 0.005], [1, 0]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg)' }}>
      {/* Subtle grid backdrop */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.25 }} />
      <div className="scanline" />

      {/* Section eyebrow */}
      <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>
          90-MINUTE FORWARD FORECAST
        </div>
      </div>

      {/* Initial jumbo headline */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: headlineOpacity,
          pointerEvents: 'none',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(48px, 8vw, 128px)',
            fontWeight: 600,
            letterSpacing: '-0.05em',
            lineHeight: 0.9,
            textAlign: 'center',
            maxWidth: '14ch',
          }}
        >
          See the next<br />
          <span style={{ color: 'var(--accent)' }}>90 minutes</span>
        </h2>
      </motion.div>

      {/* Crossfaded variant scenes */}
      {VARIANTS.map((v, i) => (
        <Scene key={v.name} variant={v} index={i} variantIndex={variantIndex} />
      ))}

      {/* Variant list — bottom-left */}
      <div
        style={{
          position: 'absolute',
          left: 'clamp(24px, 5vw, 64px)',
          bottom: '12vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--text-2)' }}>
          FORECAST DIMENSIONS
        </div>
        {VARIANTS.map((v, i) => (
          <VariantLabel key={v.name} name={v.name} index={i} variantIndex={variantIndex} />
        ))}
      </div>
    </div>
  );
}

function VariantLabel({
  name,
  index,
  variantIndex,
}: {
  name: string;
  index: number;
  variantIndex: MotionValue<number>;
}) {
  const opacity = useTransform(variantIndex, (v) => {
    const distance = Math.abs(v - index);
    return Math.max(0.3, 1 - distance * 0.7);
  });
  const isActive = useTransform(variantIndex, (v) => Math.round(v) === index);
  const color = useTransform(isActive, (a) => (a ? 'var(--text)' : 'var(--text-2)'));
  const dotOpacity = useTransform(isActive, (a) => (a ? 1 : 0));

  return (
    <motion.div
      style={{
        opacity,
        color,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 'clamp(28px, 3.6vw, 56px)',
        fontWeight: 600,
        letterSpacing: '-0.03em',
        lineHeight: 1.05,
      }}
    >
      <motion.span
        style={{
          opacity: dotOpacity,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 12px var(--accent-glow)',
        }}
      />
      {name}
    </motion.div>
  );
}

function Scene({
  variant,
  index,
  variantIndex,
}: {
  variant: Variant;
  index: number;
  variantIndex: MotionValue<number>;
}) {
  // Crossfade — peak opacity at the variant's scroll position, fades to either side.
  const opacity = useTransform(variantIndex, (v) => {
    const d = Math.abs(v - index);
    return Math.max(0, 1 - d * 1.6);
  });

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        display: 'grid',
        placeItems: 'center',
        padding: '14vh 64px 18vh',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.6fr)',
          gap: 32,
          width: 'min(1320px, 100%)',
          height: '100%',
          maxHeight: 600,
          alignItems: 'stretch',
        }}
      >
        {/* Big chart panel */}
        <HudPanel label={`${variant.name.toUpperCase()} · 90M FORECAST`} emphasized style={{ height: '100%' }}>
          <div
            style={{
              fontSize: 'clamp(48px, 7vw, 112px)',
              fontWeight: 600,
              letterSpacing: '-0.05em',
              lineHeight: 0.9,
              color: variant.color,
            }}
          >
            {variant.metric}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
            {variant.unit}
          </div>
          <div className="mono" style={{ fontSize: 11, color: variant.color, marginTop: 6 }}>
            {variant.delta}
          </div>

          {/* Sparkline */}
          <Sparkline series={variant.series} color={variant.color} />
        </HudPanel>

        {/* Spec stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
          <SpecCard label="DRIVER" value={variant.primary.value} sub={variant.primary.label} />
          <SpecCard label="DRIVER" value={variant.secondary.value} sub={variant.secondary.label} />
          <SpecCard label="META" value={variant.tertiary.value} sub={variant.tertiary.label} />
        </div>
      </div>
    </motion.div>
  );
}

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const w = 600;
  const h = 200;
  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.95 - 6;
    return `${x},${y}`;
  }).join(' ');
  // Forecast portion — last third — rendered with reduced opacity
  const forecastStart = Math.floor(series.length * 0.66);
  const fx = (forecastStart / (series.length - 1)) * w;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200, marginTop: 24 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Forecast region marker */}
      <line x1={fx} y1={0} x2={fx} y2={h} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="2,4" />
      <text x={fx + 6} y={14} fill="var(--text-2)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.14em">
        T · NOW
      </text>
      {/* Filled area */}
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#spark-${color})`} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SpecCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <HudPanel label={label}>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>{sub}</div>
    </HudPanel>
  );
}
