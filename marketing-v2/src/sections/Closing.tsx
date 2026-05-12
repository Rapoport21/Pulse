import { motion } from 'motion/react';

/**
 * Closing — 3vh.
 *
 * Vital-sign waveform from the hero returns and resolves into the PULSE
 * wordmark. Same two CTAs as the hero.
 *
 * Single accent: waveform + wordmark, rose-600.
 */
export function Closing() {
  return (
    <>
      <section
        id="demo"
        style={{
          position: 'relative',
          minHeight: '100vh',
          background: 'var(--bg-deep)',
          display: 'grid',
          placeItems: 'center',
          padding: '24vh 24px 12vh',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'clamp(32px, 5vh, 56px)',
            width: '100%',
            maxWidth: 720,
          }}
        >
          {/* Waveform redraws */}
          <motion.svg
            width="200"
            height="80"
            viewBox="0 0 200 80"
            fill="none"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-30%' }}
            transition={{ duration: 0.6 }}
            aria-hidden
          >
            <motion.path
              d="M0,40 L60,40 L70,40 L80,16 L90,64 L100,28 L110,40 L200,40"
              stroke="var(--accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true, margin: '-30%' }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.svg>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30%' }}
            transition={{ duration: 0.8, delay: 0.4 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <h2
              style={{
                fontSize: 'var(--type-display-xl)',
                fontWeight: 600,
                letterSpacing: '-0.06em',
                lineHeight: 0.88,
                color: 'var(--accent)',
              }}
            >
              PULSE
            </h2>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                letterSpacing: '0.24em',
              }}
            >
              PATIENT URGENCY · LOAD SITUATIONAL ENGINE
            </span>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-30%' }}
            transition={{ duration: 0.6, delay: 0.8 }}
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <a
              href="mailto:hi@pulse.health?subject=PULSE%20demo%20request"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 22px',
                background: 'var(--text)',
                color: 'var(--bg)',
                fontWeight: 500,
                fontSize: 14,
                borderRadius: 2,
              }}
            >
              Request a demo <span aria-hidden>→</span>
            </a>
            <a
              id="investors"
              href="mailto:hi@pulse.health?subject=PULSE%20investor%20inquiry"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 22px',
                border: '1px solid var(--border-strong)',
                color: 'var(--text)',
                fontWeight: 500,
                fontSize: 14,
                borderRadius: 2,
              }}
            >
              For investors
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '32px 24px',
          background: 'var(--bg-deep)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--text-3)',
            textTransform: 'uppercase',
          }}
        >
          <span>PULSE · 2026</span>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span>HIPAA</span>
            <span>FHIR R4</span>
            <span>SOC 2</span>
            <span>ON-PREM</span>
          </div>
          <a href="mailto:hi@pulse.health" style={{ color: 'var(--text-2)' }}>
            hi@pulse.health
          </a>
        </div>
      </footer>
    </>
  );
}
