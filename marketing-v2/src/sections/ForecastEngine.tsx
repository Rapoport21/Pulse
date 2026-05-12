import { motion, useTransform, type MotionValue } from 'motion/react';
import { PinnedScrub } from '../components/PinnedScrub';

/**
 * Forecast Engine — 9vh, 3 variants.
 *
 * Major v2 simplification from v1: dropped the floating spec cards.
 * Each variant gets one big number, one driver line, and a sparkline.
 * That's it. Restraint principle.
 *
 * Single accent: the active variant's big number, rose-600. Nothing else.
 */

type Variant = {
  name: string;
  metric: string;
  unit: string;
  delta: string;
  driverLine: string;
  series: number[];
};

const VARIANTS: Variant[] = [
  {
    name: 'Capacity',
    metric: '102',
    unit: '% ED OCCUPANCY · T+90',
    delta: '↑ +15 pts',
    driverLine: '4 of 47 beds available · confidence 0.91',
    series: [62, 64, 68, 71, 74, 78, 82, 86, 89, 93, 97, 102],
  },
  {
    name: 'Risk',
    metric: '0.74',
    unit: 'COMPOSITE RISK · T+90',
    delta: '↑ +0.18',
    driverLine: 'boarding +0.21 · acuity +0.11 · confidence 0.88',
    series: [0.31, 0.33, 0.36, 0.41, 0.46, 0.52, 0.58, 0.63, 0.67, 0.7, 0.72, 0.74],
  },
  {
    name: 'Staffing',
    metric: '−6',
    unit: 'NURSE COVERAGE GAP · 22:00',
    delta: '↓ 6 RNs short',
    driverLine: 'MS −4 · TELE −2 · confidence 0.74',
    series: [0, -1, -1, -2, -2, -3, -4, -5, -5, -6, -6, -6],
  },
];

export function ForecastEngine() {
  return (
    <PinnedScrub viewports={9} variants={VARIANTS.length}>
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
  // Section title fades fast — first variant takes the stage.
  const titleOpacity = useTransform(progress, [0, 0.06], [1, 0]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
      }}
    >
      {/* Eyebrow — always visible */}
      <div
        style={{
          position: 'absolute',
          top: 'clamp(72px, 12vh, 120px)',
          left: 0,
          right: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--text-3)' }}>
          90-MINUTE FORWARD FORECAST
        </div>
      </div>

      {/* Section title — holds before scenes resolve */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: titleOpacity,
          pointerEvents: 'none',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--type-display)',
            fontWeight: 600,
            letterSpacing: '-0.045em',
            lineHeight: 0.95,
            textAlign: 'center',
            maxWidth: '14ch',
            color: 'var(--text)',
          }}
        >
          See the next 90 minutes.
        </h2>
      </motion.div>

      {/* Scenes — crossfade based on variantIndex */}
      {VARIANTS.map((v, i) => (
        <Scene key={v.name} variant={v} index={i} variantIndex={variantIndex} />
      ))}

      {/* Variant pill list — bottom edge, always visible */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(48px, 8vh, 96px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          padding: '0 24px',
        }}
      >
        {VARIANTS.map((v, i) => (
          <VariantPill key={v.name} name={v.name} index={i} variantIndex={variantIndex} />
        ))}
      </div>
    </div>
  );
}

function VariantPill({
  name,
  index,
  variantIndex,
}: {
  name: string;
  index: number;
  variantIndex: MotionValue<number>;
}) {
  const isActive = useTransform(variantIndex, (v) => Math.round(v) === index);
  const opacity = useTransform(isActive, (a) => (a ? 1 : 0.35));
  const color = useTransform(isActive, (a) => (a ? 'var(--text)' : 'var(--text-3)'));

  return (
    <motion.div
      className="mono"
      style={{
        opacity,
        color,
        fontSize: 11,
        letterSpacing: '0.22em',
        padding: '8px 14px',
        border: '1px solid var(--border)',
      }}
    >
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
  // Linear crossfade between adjacent variants
  const opacity = useTransform(variantIndex, (v) => {
    const d = Math.abs(v - index);
    return Math.max(0, 1 - d);
  });

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(120px, 20vh, 200px) 24px clamp(140px, 22vh, 240px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
        }}
      >
        {/* Big number — single accent */}
        <div
          style={{
            fontSize: 'var(--type-display-xl)',
            fontWeight: 600,
            letterSpacing: '-0.055em',
            lineHeight: 0.88,
            color: 'var(--accent)',
            textAlign: 'center',
          }}
        >
          {variant.metric}
        </div>

        {/* Unit + delta — mono labels carrying meaning */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
            {variant.unit}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {variant.delta}
          </div>
        </div>

        {/* Sparkline */}
        <Sparkline series={variant.series} />

        {/* Driver line — mono, neutral, no card chrome */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-3)',
            letterSpacing: '0.18em',
          }}
        >
          {variant.driverLine}
        </div>
      </div>
    </motion.div>
  );
}

function Sparkline({ series }: { series: number[] }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const w = 800;
  const h = 160;
  const pad = 8;
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const forecastStart = Math.floor(series.length * 0.66);
  const fx = (forecastStart / (series.length - 1)) * w;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{
        width: 'min(800px, 90vw)',
        height: 160,
      }}
      aria-hidden
    >
      {/* T·NOW marker */}
      <line
        x1={fx}
        y1={0}
        x2={fx}
        y2={h}
        stroke="var(--border-strong)"
        strokeWidth="1"
        strokeDasharray="3,4"
      />
      <text
        x={fx + 8}
        y={14}
        fill="var(--text-3)"
        fontSize="9"
        fontFamily="var(--font-mono)"
        letterSpacing="0.16em"
      >
        T · NOW
      </text>
      {/* Line — neutral, since the accent already lives on the big number */}
      <polyline
        points={points}
        fill="none"
        stroke="var(--text-2)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
