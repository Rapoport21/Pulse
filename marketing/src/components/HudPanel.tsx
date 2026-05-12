import { type ReactNode } from 'react';

/** Tactical HUD panel — corner brackets, sharp 2px radius, mono eyebrow. */
export function HudPanel({
  label,
  children,
  style,
  emphasized = false,
}: {
  label?: string;
  children: ReactNode;
  style?: React.CSSProperties;
  emphasized?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: emphasized ? 'var(--surface-elev)' : 'var(--surface)',
        border: `1px solid ${emphasized ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 2,
        padding: '14px 16px',
        ...style,
      }}
    >
      {/* Corner brackets */}
      <Bracket pos="tl" />
      <Bracket pos="tr" />
      <Bracket pos="bl" />
      <Bracket pos="br" />

      {label && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-2)',
            marginBottom: 10,
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function Bracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const size = 6;
  const w = 1;
  const offset = -1;
  const base: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
  };
  const styles: Record<typeof pos, React.CSSProperties> = {
    tl: {
      top: offset,
      left: offset,
      borderTop: `${w}px solid var(--accent)`,
      borderLeft: `${w}px solid var(--accent)`,
    },
    tr: {
      top: offset,
      right: offset,
      borderTop: `${w}px solid var(--accent)`,
      borderRight: `${w}px solid var(--accent)`,
    },
    bl: {
      bottom: offset,
      left: offset,
      borderBottom: `${w}px solid var(--accent)`,
      borderLeft: `${w}px solid var(--accent)`,
    },
    br: {
      bottom: offset,
      right: offset,
      borderBottom: `${w}px solid var(--accent)`,
      borderRight: `${w}px solid var(--accent)`,
    },
  };
  return <span style={{ ...base, ...styles[pos] }} />;
}
