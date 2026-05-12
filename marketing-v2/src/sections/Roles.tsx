import { motion, useTransform, type MotionValue } from 'motion/react';
import { PinnedScrub } from '../components/PinnedScrub';

/**
 * Roles — 14vh, 4 roles.
 *
 * Major v2 simplification from v1: dropped the inline preview thumbnails
 * and the heavy spec card. Each role gets one full-screen quote, a stat,
 * and a name — that's it.
 *
 * Single accent: the active role's name, rose-600. Stat is mono-neutral.
 */

type Role = {
  id: string;
  name: string;
  surface: string;
  stat: string;
  quote: string;
};

const ROLES: Role[] = [
  {
    id: 'manager',
    name: 'Operations Director',
    surface: 'COMMAND SURFACE · DESKTOP',
    stat: '90 min',
    quote: '"I see what\'s coming, not what just happened."',
  },
  {
    id: 'charge',
    name: 'Charge Nurse',
    surface: 'UNIT SURFACE · TABLET',
    stat: '4 of 47',
    quote: '"I haven\'t paged the bed manager once today."',
  },
  {
    id: 'er',
    name: 'ER / Trauma Attending',
    surface: 'CLINICAL SURFACE · MOBILE',
    stat: '3 holds',
    quote: '"My patient list updates without me asking."',
  },
  {
    id: 'evs',
    name: 'EVS · Transport',
    surface: 'OPS SURFACE · MOBILE',
    stat: '6 tasks',
    quote: '"No more whiteboards. No more pages."',
  },
];

export function Roles() {
  return (
    <PinnedScrub viewports={14} variants={ROLES.length} background="var(--bg-deep)">
      {({ progress, variantIndex }) => (
        <RolesInner progress={progress} variantIndex={variantIndex} />
      )}
    </PinnedScrub>
  );
}

function RolesInner({
  progress,
  variantIndex,
}: {
  progress: MotionValue<number>;
  variantIndex: MotionValue<number>;
}) {
  const titleOpacity = useTransform(progress, [0, 0.06], [1, 0]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Eyebrow */}
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
          ROLE-AWARE SURFACES · 04
        </div>
      </div>

      {/* Section title — holds, then fades */}
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
          Same data.<br />Four lenses.
        </h2>
      </motion.div>

      {/* Role scenes — crossfade */}
      {ROLES.map((r, i) => (
        <Scene key={r.id} role={r} index={i} variantIndex={variantIndex} />
      ))}

      {/* Role index pip strip — bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(48px, 8vh, 96px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {ROLES.map((r, i) => (
          <Pip key={r.id} index={i} variantIndex={variantIndex} />
        ))}
      </div>
    </div>
  );
}

function Pip({ index, variantIndex }: { index: number; variantIndex: MotionValue<number> }) {
  const isActive = useTransform(variantIndex, (v) => Math.round(v) === index);
  const w = useTransform(isActive, (a) => (a ? 36 : 14));
  const bg = useTransform(isActive, (a) => (a ? 'var(--text)' : 'var(--border-strong)'));

  return (
    <motion.div
      style={{
        width: w,
        height: 2,
        background: bg,
        transition: 'background 0.4s var(--ease-out)',
      }}
    />
  );
}

function Scene({
  role,
  index,
  variantIndex,
}: {
  role: Role;
  index: number;
  variantIndex: MotionValue<number>;
}) {
  // Linear crossfade between adjacent variants. At the midpoint between
  // two roles, both render at 50% opacity. The pip strip clarifies which
  // role is "current"; visual overlap of two large headlines for ~10% of
  // the scroll is acceptable — the eye reads the brighter one.
  const opacity = useTransform(variantIndex, (v) => {
    const d = Math.abs(v - index);
    return Math.max(0, 1 - d);
  });
  const y = useTransform(variantIndex, (v) => (v - index) * 16);

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        y,
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(140px, 22vh, 220px) 24px clamp(120px, 20vh, 200px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(32px, 5vh, 56px)',
        }}
      >
        {/* Surface label */}
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {role.surface}
        </div>

        {/* Role name — single accent */}
        <h3
          style={{
            fontSize: 'var(--type-display)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            textAlign: 'center',
            color: 'var(--accent)',
          }}
        >
          {role.name}
        </h3>

        {/* Quote */}
        <blockquote
          style={{
            fontSize: 'clamp(20px, 2.4vw, 28px)',
            fontWeight: 400,
            letterSpacing: '-0.015em',
            lineHeight: 1.4,
            textAlign: 'center',
            color: 'var(--text)',
            maxWidth: '40ch',
          }}
        >
          {role.quote}
        </blockquote>

        {/* Stat — mono-neutral */}
        <div className="mono" style={{ fontSize: 14, color: 'var(--text-2)' }}>
          {role.stat}
        </div>
      </div>
    </motion.div>
  );
}
