import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * Why view — 4vh (new in v2, replaces Modules from v1).
 *
 * Take the Forecast Engine's `0.74` risk score and show it decomposed.
 * Drivers fan out from the number, then settle into a vertical stack.
 *
 * Single accent: `+0.21` (boarding driver, the largest one), rose-600.
 */

const DRIVERS = [
  { name: 'Boarding', value: '+0.21', accent: true },
  { name: 'Acuity', value: '+0.11', accent: false },
  { name: 'Length-of-stay', value: '+0.18', accent: false },
  { name: 'Staffing', value: '−0.06', accent: false },
  { name: 'Discharge velocity', value: '+0.12', accent: false },
];

export function WhyView() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Number scale: starts large in viewport center, shrinks slightly as drivers appear
  const numberScale = useTransform(scrollYProgress, [0.3, 0.5], [1, 0.78]);

  return (
    <section
      ref={ref}
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: 'clamp(120px, 16vh, 180px) 24px',
      }}
    >
      <div
        className="container"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 'clamp(40px, 6vw, 96px)',
          alignItems: 'center',
        }}
      >
        {/* Left: the risk number + headline */}
        <div>
          <div
            className="eyebrow"
            style={{ color: 'var(--text-3)', marginBottom: 24 }}
          >
            THE WHY VIEW
          </div>
          <h2
            style={{
              fontSize: 'var(--type-display)',
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 0.98,
              color: 'var(--text)',
              maxWidth: '14ch',
              marginBottom: 48,
            }}
          >
            The risk number isn't a black box.
          </h2>

          <motion.div
            style={{
              scale: numberScale,
              transformOrigin: 'left center',
              display: 'flex',
              alignItems: 'baseline',
              gap: 24,
            }}
          >
            <div
              style={{
                fontSize: 'clamp(96px, 14vw, 220px)',
                fontWeight: 600,
                letterSpacing: '-0.055em',
                lineHeight: 0.85,
                color: 'var(--text)',
              }}
            >
              0.74
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                paddingBottom: 24,
              }}
            >
              Composite<br />risk · T+90
            </div>
          </motion.div>

          <p
            style={{
              fontSize: 'var(--type-body-lg)',
              color: 'var(--text-2)',
              maxWidth: '46ch',
              lineHeight: 1.55,
              marginTop: 56,
            }}
          >
            Every metric carries its drivers. Every number is auditable.
          </p>
        </div>

        {/* Right: driver decomposition stack */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--text-3)',
              letterSpacing: '0.24em',
              marginBottom: 24,
            }}
          >
            DRIVER DECOMPOSITION
          </div>

          {DRIVERS.map((d, i) => (
            <DriverRow key={d.name} driver={d} index={i} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DriverRow({
  driver,
  index,
  progress,
}: {
  driver: { name: string; value: string; accent: boolean };
  index: number;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
}) {
  const total = DRIVERS.length;
  const start = 0.3 + (0.18 * index) / total;
  const end = start + 0.05;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const x = useTransform(progress, [start, end], [-12, 0]);

  return (
    <motion.div
      style={{
        opacity,
        x,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'baseline',
        gap: 24,
        padding: '20px 0',
        borderTop: index === 0 ? '1px solid var(--border)' : 'none',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(20px, 2vw, 28px)',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
        }}
      >
        {driver.name}
      </div>
      <div
        style={{
          fontSize: 'clamp(20px, 2vw, 28px)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-sans)',
          color: driver.accent ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {driver.value}
      </div>
    </motion.div>
  );
}
