import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * Coverage — silver-truck equivalent. A pinned 3D-feel hero (rendered as
 * an SVG floor plan + pulse) with a list of every PULSE capability that
 * staggers in as you scroll.
 */

const CAPABILITIES = [
  { name: '90-Minute Forecast', icon: 'forecast' },
  { name: 'Surge Actions', icon: 'surge' },
  { name: 'Brief Me', icon: 'brief' },
  { name: 'Replay', icon: 'replay' },
  { name: 'Why View', icon: 'why' },
  { name: 'Confidence Indicators', icon: 'conf' },
  { name: 'Manual Mode', icon: 'manual' },
  { name: 'Role-Aware Surfaces', icon: 'role' },
] as const;

export function Coverage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  return (
    <section ref={ref} id="coverage" style={{ position: 'relative', height: '500vh', background: 'var(--bg)' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Backdrop hospital floor */}
        <FloorBackdrop />

        {/* Headline + capability list */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 clamp(24px, 6vw, 96px)',
          }}
        >
          <div style={{ maxWidth: 600 }}>
            <motion.div
              className="eyebrow"
              style={{
                color: 'var(--accent)',
                marginBottom: 24,
                opacity: useTransform(scrollYProgress, [0.02, 0.08], [0, 1]),
              }}
            >
              TOP TIER COVERAGE FOR
            </motion.div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CAPABILITIES.map((c, i) => (
                <CapabilityRow key={c.name} name={c.name} index={i} progress={scrollYProgress} />
              ))}
            </div>

            <motion.p
              style={{
                marginTop: 40,
                fontSize: 14,
                color: 'var(--text-2)',
                maxWidth: 480,
                lineHeight: 1.6,
                opacity: useTransform(scrollYProgress, [0.85, 1], [0, 1]),
              }}
            >
              Where the EHR ends and the workflow begins, PULSE is already there. One platform for everything that runs on top of the data.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilityRow({
  name,
  index,
  progress,
}: {
  name: string;
  index: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
}) {
  const total = CAPABILITIES.length;
  const start = 0.05 + (0.7 * index) / total;
  const end = start + 0.06;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const x = useTransform(progress, [start, end], [-12, 0]);

  return (
    <motion.div style={{ opacity, x, display: 'flex', alignItems: 'center', gap: 16 }}>
      <span
        style={{
          width: 28,
          height: 28,
          border: '1px solid var(--border-strong)',
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span className="pulse-dot" style={{ width: 6, height: 6 }} />
      </span>
      <span style={{ fontSize: 'clamp(20px, 2.4vw, 32px)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)' }}>
        {name}
      </span>
    </motion.div>
  );
}

function FloorBackdrop() {
  // Stylized floor plan / hallway suggestion — tactical blueprint feel.
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.5,
      }}
    >
      <defs>
        <linearGradient id="floorFade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--bg-deep)" stopOpacity="1" />
          <stop offset="50%" stopColor="var(--bg-deep)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* Floor grid */}
      {Array.from({ length: 24 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 60} y1="0" x2={i * 60} y2="900" stroke="var(--border)" strokeWidth="1" opacity="0.6" />
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 60} x2="1440" y2={i * 60} stroke="var(--border)" strokeWidth="1" opacity="0.6" />
      ))}

      {/* Rooms (right side) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = 720 + (i % 4) * 160;
        const y = 200 + Math.floor(i / 4) * 220;
        const states = ['var(--ok)', 'var(--ok)', 'var(--warn)', 'var(--accent)', 'var(--ok)', 'var(--text-faint)', 'var(--ok)', 'var(--warn)'];
        return (
          <g key={i}>
            <rect x={x} y={y} width="140" height="200" fill="var(--surface)" stroke={states[i]} strokeWidth="1" opacity="0.85" />
            <circle cx={x + 70} cy={y + 100} r="6" fill={states[i]} opacity="0.9" />
            <text x={x + 8} y={y + 18} fill="var(--text-2)" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="0.18em">
              ROOM {String(i + 1).padStart(3, '0')}
            </text>
          </g>
        );
      })}

      {/* Left fade overlay */}
      <rect width="1440" height="900" fill="url(#floorFade)" />
    </svg>
  );
}
