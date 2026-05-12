import { useRef } from 'react';
import { motion, useTransform } from 'motion/react';
import { useScrollProgress } from '../lib/scroll-progress';

/**
 * Hero — 4 viewports tall, sticky-pinned inner content.
 *
 * Mimics the Relats pattern: the section is much taller than the
 * viewport, but the visible content is `position: sticky; top: 0;
 * height: 100vh` so it stays pinned while you scroll through the
 * outer wrapper. As the visitor scrolls 4 viewports' worth, the
 * documentary backdrop's video scrubs forward, and the foreground
 * copy reveals progressively:
 *
 *   - 0–10%    eyebrow + waveform (intro)
 *   - 10–35%   headline rises
 *   - 35–60%   subhead fades in
 *   - 60–85%   CTAs + ticker arrive
 *   - 85–100%  exit drift (slight upward translate so the next section feels close)
 *
 * In non-documentary themes, the same pinned structure provides
 * deliberate cinematic pacing — sticky hero stays put for several
 * viewports of scroll while the visitor reads. No video plays in
 * those modes, but the editorial weight still lands.
 *
 * Single accent: the waveform line itself, rose-600.
 */
export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(sectionRef);

  // Reveal phases — eyebrow + headline are ALREADY visible at progress 0
  // (so the page isn't blank on first paint), subhead and CTAs reveal as
  // you scroll deeper. Everything fades out as you exit the section.
  const eyebrowOpacity = useTransform(progress, [0, 0.92, 1], [1, 1, 0]);
  const headlineOpacity = useTransform(progress, [0, 0.92, 1], [1, 1, 0]);
  const subheadOpacity = useTransform(progress, [0.18, 0.35, 0.92, 1], [0, 1, 1, 0]);
  const subheadY = useTransform(progress, [0.18, 0.35], [16, 0]);
  const ctaOpacity = useTransform(progress, [0.4, 0.55, 0.92, 1], [0, 1, 1, 0]);
  const ctaY = useTransform(progress, [0.4, 0.55], [12, 0]);
  const tickerOpacity = useTransform(progress, [0.6, 0.78], [0, 1]);

  return (
    <section
      id="top"
      ref={sectionRef}
      style={{
        position: 'relative',
        // 4 viewports tall — gives the documentary video room to scrub,
        // creates editorial pacing in non-documentary themes too.
        height: '400vh',
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
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          background: 'var(--bg-deep)',
        }}
      >
        {/* Waveform — single rose accent, draws on mount */}
        <Waveform />

        {/* Eyebrow */}
        <motion.div
          className="eyebrow"
          style={{
            opacity: eyebrowOpacity,
            color: 'var(--text-3)',
            marginBottom: 28,
            zIndex: 2,
          }}
        >
          PATIENT URGENCY · LOAD SITUATIONAL ENGINE
        </motion.div>

        {/* Headline — visible immediately, fades on exit only */}
        <motion.h1
          style={{
            opacity: headlineOpacity,
            fontSize: 'var(--type-display)',
            fontWeight: 600,
            letterSpacing: '-0.045em',
            lineHeight: 0.96,
            textAlign: 'center',
            maxWidth: '14ch',
            color: 'var(--text)',
            zIndex: 2,
          }}
        >
          The 90 minutes<br />
          before everything<br />
          goes wrong.
        </motion.h1>

        {/* Subhead */}
        <motion.p
          style={{
            opacity: subheadOpacity,
            y: subheadY,
            fontSize: 'var(--type-body-lg)',
            color: 'var(--text-2)',
            maxWidth: '52ch',
            lineHeight: 1.55,
            textAlign: 'center',
            marginTop: 32,
            zIndex: 2,
          }}
        >
          PULSE forecasts capacity, risk, and staffing — and turns rising risk
          into coordinated action, with a human in the loop.
        </motion.p>

        {/* CTAs */}
        <motion.div
          style={{
            opacity: ctaOpacity,
            y: ctaY,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 36,
            zIndex: 2,
          }}
        >
          <a
            href="#demo"
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
            href="#investors"
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

        {/* HUD ticker — appears last */}
        <motion.div
          style={{
            opacity: tickerOpacity,
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            zIndex: 2,
          }}
        >
          <span>v 0.1 · local</span>
          <span>status · nominal</span>
          <span>scroll · 11 scenes</span>
        </motion.div>
      </div>
    </section>
  );
}

function Waveform() {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: '100%',
        height: 120,
        opacity: 0.95,
        zIndex: 1,
      }}
      aria-hidden
    >
      <motion.path
        d="M0,60 L420,60 L460,60 L478,30 L494,90 L508,42 L520,72 L540,60 L860,60 L900,60 L920,18 L938,102 L956,30 L972,72 L988,60 L1440,60"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
