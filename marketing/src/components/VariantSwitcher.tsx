import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * v1's switcher — a thin version that lets you jump to v2 or open
 * both side-by-side. v1 does not host the theme system; that lives
 * in v2 only.
 */
export function VariantSwitcher() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openSideBySide = () => {
    const w = window.screen.availWidth;
    const h = window.screen.availHeight;
    const halfW = Math.floor(w / 2);
    window.open(
      'http://localhost:5174/',
      'pulse-v1',
      `left=0,top=0,width=${halfW},height=${h}`,
    );
    window.open(
      'http://localhost:5175/',
      'pulse-v2',
      `left=${halfW},top=0,width=${halfW},height=${h}`,
    );
    setOpen(false);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Compare designs"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent)',
          }}
        />
        Compare
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: 'min(360px, calc(100vw - 32px))',
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              zIndex: 100,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.24em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
              }}
            >
              DESIGNS · COMPARE BUILDS
            </div>

            <Row
              label="v1 · Original"
              description="You are here. Higher density, more accents per scene."
              status="current"
            />
            <Row
              label="v2 · Restraint"
              description="Design-led pass. Live theme switcher inside."
              status="live"
              onClick={() => window.open('http://localhost:5175/', '_blank')}
            />

            <button
              type="button"
              onClick={openSideBySide}
              style={{
                marginTop: 4,
                padding: '10px 12px',
                background: 'var(--accent)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                borderRadius: 4,
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Open side-by-side <span aria-hidden>↔</span>
            </button>

            <p
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                lineHeight: 1.5,
                margin: 0,
                paddingTop: 6,
                borderTop: '1px solid var(--border)',
              }}
            >
              v2 hosts the live aesthetic toggle (Tactical / Editorial / Brutalist).
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  label,
  description,
  status,
  onClick,
}: {
  label: string;
  description: string;
  status: 'current' | 'live';
  onClick?: () => void;
}) {
  const isInteractive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '8px 10px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 4,
        textAlign: 'left',
        cursor: isInteractive ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: status === 'current' ? 'var(--accent)' : 'var(--text)',
          }}
        >
          {status === 'current' ? 'CURRENT' : 'OPEN'}
        </span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{description}</span>
    </button>
  );
}
