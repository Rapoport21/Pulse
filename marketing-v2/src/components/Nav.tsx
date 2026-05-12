import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VariantSwitcher } from './VariantSwitcher';

/**
 * Top nav.
 *
 * Per .impeccable.md "Forbidden visual moves": no glassmorphic CTA buttons,
 * use solid surfaces only. So this nav is solid bg with a 1px border —
 * not blurred glass.
 *
 * Layout:
 *   Left:   PULSE wordmark
 *   Center: Demo / Investors links (appear after first viewport)
 *   Right:  Floating "Request demo" CTA (appears after first viewport)
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 16,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <nav
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          width: 'min(1280px, calc(100vw - 32px))',
          padding: '10px 14px 10px 18px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 2,
        }}
      >
        {/* Left: wordmark */}
        <a
          href="#top"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Wave />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.22em',
              fontSize: 12,
            }}
          >
            PULSE
          </span>
        </a>

        {/* Center: text links */}
        <AnimatePresence>
          {scrolled && (
            <motion.div
              key="links"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                gap: 28,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--text-2)',
              }}
            >
              <a href="#demo">Demo</a>
              <a href="#investors">Investors</a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: variant switcher + floating CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VariantSwitcher current="v2" />
          <AnimatePresence mode="popLayout">
            {scrolled ? (
              <motion.a
                key="demo-cta"
                href="#demo"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: 13,
                  borderRadius: 2,
                  letterSpacing: '-0.005em',
                }}
              >
                Request a demo
                <span aria-hidden style={{ marginTop: 1 }}>→</span>
              </motion.a>
            ) : null}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}

function Wave() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
      <path
        d="M0 7 H4 L5.5 2 L8.5 12 L10.5 4 L12 7 H20"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
