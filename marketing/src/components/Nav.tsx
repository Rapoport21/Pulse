import { useEffect, useState } from 'react';
import { VariantSwitcher } from './VariantSwitcher';

/** Glassmorphic top nav. Mirrors Relats's "Full view / Overview" toggle but
 *  reads "Demo / Overview" — closer to the way PULSE is shown to operators.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 12,
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
          width: 'min(1180px, calc(100vw - 32px))',
          padding: '8px 12px',
          borderRadius: 999,
          background: scrolled ? 'rgba(10,10,10,0.55)' : 'rgba(10,10,10,0.35)',
          backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
          border: '1px solid var(--border)',
          transition: 'background 0.3s var(--ease-out)',
        }}
      >
        {/* Wordmark */}
        <a
          href="#top"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          <PulseGlyph />
          <span
            style={{
              fontWeight: 600,
              letterSpacing: '0.18em',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
            }}
          >
            PULSE
          </span>
        </a>

        {/* Right cluster: variant switcher + Demo/Overview toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <VariantSwitcher />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <button
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid var(--border-strong)',
              }}
            >
              Demo
            </button>
            <button
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                color: 'var(--text-2)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Overview
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

function PulseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M1 9h3l1.5-4 3 8L11 5l1.5 4H17"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
