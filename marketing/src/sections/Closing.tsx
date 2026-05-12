import { motion } from 'motion/react';

/**
 * Closing — bookend the page. Black void with a single ECG line that
 * traces and resolves into the PULSE wordmark, then footer.
 *
 * Equivalent of Relats's closing "animation" section + footer.
 */
export function Closing() {
  return (
    <>
      <section
        style={{
          position: 'relative',
          height: '90vh',
          background: 'var(--bg-deep)',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {/* Subtle accent border vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 240px rgba(225,29,72,0.18)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ textAlign: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30%' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <svg width="160" height="80" viewBox="0 0 160 80" fill="none" style={{ margin: '0 auto 32px' }}>
              <motion.path
                d="M0,40 L50,40 L60,40 L70,10 L80,70 L90,20 L100,40 L160,40"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, margin: '-30%' }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
          </motion.div>

          <h2 style={{ fontSize: 'clamp(48px, 8vw, 128px)', fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 0.9 }}>
            PULSE
          </h2>
          <p className="mono" style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 16, letterSpacing: '0.18em' }}>
            PATIENT URGENCY &amp; LOAD SITUATIONAL ENGINE
          </p>

          <div
            style={{
              marginTop: 56,
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <a
              href="mailto:hi@pulse.local"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 24px',
                borderRadius: 999,
                background: 'var(--text)',
                color: 'var(--bg)',
                fontWeight: 500,
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Request a demo
              <span style={{ fontSize: 16 }}>→</span>
            </a>
            <a
              href="#top"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 24px',
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                color: 'var(--text)',
                fontWeight: 500,
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              ↑ Back to top
            </a>
          </div>
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
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            color: 'var(--text-3)',
            textTransform: 'uppercase',
          }}
        >
          <span>PULSE · 2026</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="mailto:hi@pulse.local" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>
              hi@pulse.local
            </a>
            <span>v0.1 · LOCAL</span>
            <span>STATUS · NOMINAL</span>
          </div>
        </div>
      </footer>
    </>
  );
}
