import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * Coverage — 5vh.
 *
 * Capability list with staggered fade-in, plus an integration ECG strip
 * along the bottom (Epic, Cerner, etc. as monospace text labels on a
 * horizontal line).
 *
 * Single accent: NONE. This scene intentionally abstains. Rose-600 stays
 * away — coverage is meant to read as the calm authority section.
 */

const CAPABILITIES = [
  '90-Minute Forecast',
  'Surge Actions',
  'Brief Me',
  'Replay',
  'Why View',
  'Confidence Indicators',
  'Manual Mode',
  'Role-Aware Surfaces',
];

const INTEGRATIONS = ['EPIC', 'CERNER', 'TELETRACKING', 'MEDITECH', 'FHIR R4'];

export function Coverage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  return (
    <section
      ref={ref}
      style={{
        position: 'relative',
        height: '500vh',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Eyebrow + headline */}
        <div
          style={{
            padding: 'clamp(72px, 12vh, 120px) 24px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--text-3)' }}>
            WHAT PULSE COVERS
          </div>
          <h2
            style={{
              fontSize: 'var(--type-display)',
              fontWeight: 600,
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
              textAlign: 'center',
              color: 'var(--text)',
              maxWidth: '18ch',
            }}
          >
            Wraps the systems you already run.
          </h2>
        </div>

        {/* Capability list — center */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'clamp(8px, 1.2vh, 14px)',
              width: '100%',
              maxWidth: 720,
            }}
          >
            {CAPABILITIES.map((cap, i) => (
              <CapabilityRow
                key={cap}
                name={cap}
                index={i}
                progress={scrollYProgress}
              />
            ))}
          </div>
        </div>

        {/* Integration ECG strip — bottom */}
        <IntegrationStrip progress={scrollYProgress} />
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
  // Staggered reveal across the section
  const start = 0.06 + (0.5 * index) / total;
  const end = start + 0.04;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [10, 0]);

  return (
    <motion.div
      style={{
        opacity,
        y,
        fontSize: 'clamp(22px, 2.6vw, 36px)',
        fontWeight: 500,
        letterSpacing: '-0.025em',
        color: 'var(--text)',
        textAlign: 'center',
      }}
    >
      {name}
    </motion.div>
  );
}

function IntegrationStrip({
  progress,
}: {
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
}) {
  const stripOpacity = useTransform(progress, [0.7, 0.9], [0, 1]);
  const closingLineOpacity = useTransform(progress, [0.85, 1], [0, 1]);

  return (
    <motion.div
      style={{
        padding: '0 24px clamp(48px, 8vh, 96px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        opacity: stripOpacity,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--text-3)',
            letterSpacing: '0.22em',
            whiteSpace: 'nowrap',
          }}
        >
          INTEGRATIONS
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--text-2)',
          }}
        >
          {INTEGRATIONS.map((n, i) => (
            <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {n}
              {i < INTEGRATIONS.length - 1 && (
                <span style={{ color: 'var(--text-faint)' }}>·</span>
              )}
            </span>
          ))}
        </div>
      </div>

      <motion.p
        style={{
          opacity: closingLineOpacity,
          fontSize: 'var(--type-body-lg)',
          color: 'var(--text-2)',
          textAlign: 'center',
          maxWidth: '52ch',
          lineHeight: 1.55,
          marginTop: 8,
        }}
      >
        Where the EHR ends and the workflow begins, PULSE is already there.
      </motion.p>
    </motion.div>
  );
}
