import { motion } from 'motion/react';

/** Hero — full-bleed near-black canvas with an ambient ECG line and the
 *  primary headline. Like Relats's looping orange-braid macro, but our
 *  "macro" is the vital sign itself. */
export function Hero() {
  return (
    <section
      id="top"
      style={{
        position: 'relative',
        height: '100vh',
        background:
          'radial-gradient(ellipse at center, #0a0a0a 0%, #050505 50%, #020202 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Subtle blueprint grid */}
      <div
        className="grid-bg"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          maskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 70%)',
        }}
      />

      {/* ECG line tracing across the screen */}
      <EcgLine />

      {/* Headline */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: '14vh',
          textAlign: 'center',
        }}
      >
        <motion.div
          className="eyebrow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            color: 'var(--accent)',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="pulse-dot" />
          PATIENT URGENCY &amp; LOAD SITUATIONAL ENGINE
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(40px, 6vw, 84px)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            maxWidth: '14ch',
          }}
        >
          The 90-minute<br />
          operational picture
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            marginTop: 28,
            fontSize: 18,
            color: 'var(--text-2)',
            maxWidth: '52ch',
            lineHeight: 1.45,
          }}
        >
          PULSE forecasts capacity, risk, and staffing — and turns rising risk
          into coordinated surge actions, with a human in the loop.
        </motion.p>

        {/* CTA + scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          style={{
            marginTop: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <a
            href="#forecast"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 999,
              background: 'var(--text)',
              color: 'var(--bg)',
              fontWeight: 500,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            See the demo cycle
            <span style={{ fontSize: 16 }}>→</span>
          </a>

          <span
            className="mono"
            style={{
              color: 'var(--text-2)',
              fontSize: 11,
            }}
          >
            SCROLL · 12 SCENES
          </span>
        </motion.div>
      </div>

      {/* Bottom HUD ticker */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          color: 'var(--text-3)',
          textTransform: 'uppercase',
        }}
      >
        <span>v0.1 · LOCAL BUILD</span>
        <span>STATUS · NOMINAL</span>
        <span>SCENES · 12 / 12 LOADED</span>
      </div>
    </section>
  );
}

function EcgLine() {
  return (
    <svg
      viewBox="0 0 1440 200"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        top: '38%',
        left: 0,
        width: '100%',
        height: 200,
        opacity: 0.9,
      }}
    >
      <defs>
        <linearGradient id="ecgFade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="20%" stopColor="var(--accent)" stopOpacity="0.6" />
          <stop offset="80%" stopColor="var(--accent)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0,100 L400,100 L440,100 L460,40 L480,160 L500,80 L520,100 L900,100 L940,100 L960,30 L980,170 L1000,100 L1440,100"
        fill="none"
        stroke="url(#ecgFade)"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
