import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme, THEMES, type Theme } from '../lib/theme';

/**
 * Variant switcher — opens a panel with three axes of comparison:
 *
 *   1. Designs  → cross-build comparison (v1 / v2). Opens a different URL.
 *   2. Aesthetics → runtime theme swap inside this build. Switches CSS tokens.
 *   3. Narratives → marketing structure (tour / single shift / etc).
 *      Currently scaffolded only — the structural variants are a future
 *      build round.
 *
 * Side-by-side: opens v1 + v2 in two windows snapped to half-screen so
 * scrolling them in parallel is one click.
 */

const DESIGNS = [
  {
    id: 'v1',
    label: 'v1 · Original',
    description: 'Relats-clone first pass. Higher density, more accents per scene.',
    url: 'http://localhost:5174/',
  },
  {
    id: 'v2',
    label: 'v2 · Restraint',
    description: 'Design-led pass. One accent per scene, editorial pacing.',
    url: 'http://localhost:5175/',
  },
] as const;

const NARRATIVES = [
  { id: 'tour', label: 'Tour', description: 'Feature walkthrough. Current.', status: 'current' as const },
  { id: 'single-shift', label: 'Single Shift', description: 'One shift unfolding in real-time.', status: 'planned' as const },
  { id: 'incident-replay', label: 'Incident Replay', description: 'Walk through how PULSE handles a real incident.', status: 'planned' as const },
  { id: 'thesis', label: 'Thesis-led', description: 'Open with a sharp claim, prove it.', status: 'planned' as const },
  { id: 'numbers', label: 'Number-led', description: 'Every section anchored by one big number.', status: 'planned' as const },
];

type Variant = 'v1' | 'v2';

export function VariantSwitcher({ current }: { current: Variant }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

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
        title="Compare designs and aesthetics"
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          fontSize: 10,
          letterSpacing: '0.18em',
          color: 'var(--text-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: open ? 'var(--surface)' : 'transparent',
          transition: 'background 0.2s var(--ease-out)',
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
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 0,
              width: 'min(440px, calc(100vw - 32px))',
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
              zIndex: 100,
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
            }}
          >
            {/* DESIGNS */}
            <Section title="DESIGNS · COMPARE BUILDS">
              {DESIGNS.map((d) => (
                <Row
                  key={d.id}
                  label={d.label}
                  description={d.description}
                  status={d.id === current ? 'current' : 'live'}
                  onClick={
                    d.id === current
                      ? undefined
                      : () => window.open(d.url, '_blank')
                  }
                />
              ))}
              <button
                type="button"
                onClick={openSideBySide}
                className="mono"
                style={{
                  marginTop: 4,
                  padding: '10px 12px',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  borderRadius: 'var(--radius-sm)',
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                }}
              >
                Open side-by-side <span aria-hidden>↔</span>
              </button>
            </Section>

            <Divider />

            {/* AESTHETICS — real working theme swaps */}
            <Section title="AESTHETICS · SWAP THEME LIVE">
              {Object.values(THEMES).map((t) => {
                const isCurrent = theme === t.id;
                return (
                  <Row
                    key={t.id}
                    label={t.label}
                    description={t.description}
                    status={isCurrent ? 'current' : 'live'}
                    onClick={isCurrent ? undefined : () => setTheme(t.id as Theme)}
                  />
                );
              })}
            </Section>

            <Divider />

            {/* NARRATIVES — placeholder (next build round) */}
            <Section title="NARRATIVES · STORY SHAPE">
              {NARRATIVES.map((n) => (
                <Row
                  key={n.id}
                  label={n.label}
                  description={n.description}
                  status={n.status}
                />
              ))}
            </Section>

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
              Aesthetic swaps apply instantly and persist across reloads.
              Narrative variants are scaffolded for the next build round.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.24em',
          color: 'var(--text-3)',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)' }} />;
}

type RowStatus = 'current' | 'live' | 'planned' | 'stub';

function Row({
  label,
  description,
  status,
  onClick,
}: {
  label: string;
  description: string;
  status: RowStatus;
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
        borderRadius: 'var(--radius-sm)',
        textAlign: 'left',
        cursor: isInteractive ? 'pointer' : 'default',
        transition: 'background 0.15s var(--ease-out), border-color 0.15s var(--ease-out)',
      }}
      onMouseEnter={(e) => {
        if (isInteractive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
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
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color:
              status === 'planned' || status === 'stub'
                ? 'var(--text-2)'
                : 'var(--text)',
          }}
        >
          {label}
        </span>
        <StatusPill status={status} />
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          lineHeight: 1.4,
        }}
      >
        {description}
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: RowStatus }) {
  const map = {
    current: { label: 'CURRENT', color: 'var(--accent)' },
    live: { label: 'SWAP', color: 'var(--text)' },
    planned: { label: 'PLANNED', color: 'var(--text-3)' },
    stub: { label: 'NEEDS MEDIA', color: 'var(--text-3)' },
  } as const;
  const { label, color } = map[status];
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: '0.2em',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
