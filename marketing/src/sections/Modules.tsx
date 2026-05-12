import { useState } from 'react';
import { HudPanel } from '../components/HudPanel';

/**
 * Modules — paginated list of the surfaces PULSE unifies. Equivalent
 * of Relats's "Other industries" section: a static-position page with
 * a left list (clickable) + right pair of visuals + tagline.
 */

const MODULES = [
  {
    id: 'beds',
    name: 'Bed Management',
    tagline: 'Beds as states (ready, not-ready, not-staffed, blocked) — not just a count.',
    bgColor: 'var(--ok)',
  },
  {
    id: 'staff',
    name: 'Staffing',
    tagline: 'Coverage gaps surfaced as forecasts, not headcount tallies.',
    bgColor: 'var(--info)',
  },
  {
    id: 'ehr',
    name: 'EHR Tab',
    tagline: 'Charting, orders, meds, labs — rendered in the PULSE language alongside the operations layer.',
    bgColor: 'var(--accent)',
  },
  {
    id: 'comms',
    name: 'Communications',
    tagline: 'Threads scoped by patient, unit, or surge plan. No shadow texting.',
    bgColor: 'var(--warn)',
  },
  {
    id: 'diagnostics',
    name: 'Diagnostics',
    tagline: 'Imaging and labs in the same view as the patient context, not five tabs away.',
    bgColor: 'var(--info)',
  },
  {
    id: 'brief',
    name: 'Brief Me',
    tagline: '30-second AI-synthesized handoff that preserves continuity across shift changes.',
    bgColor: 'var(--accent)',
  },
  {
    id: 'replay',
    name: 'Replay',
    tagline: 'Scrubbable timeline of decisions, actions, and outcomes for after-action review.',
    bgColor: 'var(--accent)',
  },
] as const;

export function Modules() {
  const [active, setActive] = useState(0);
  const m = MODULES[active];

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        padding: '12vh 24px',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>
          MODULES
        </div>
        <h2 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, maxWidth: '20ch' }}>
          Every surface a hospital runs on, in one system.
        </h2>

        <div
          style={{
            marginTop: 64,
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr',
            gap: 32,
            alignItems: 'stretch',
          }}
        >
          {/* Left: module list */}
          <HudPanel label={`${active + 1} / 0${MODULES.length} · ${m.name.toUpperCase()}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 360, gap: 18 }}>
              {[active - 1, active, active + 1].map((i) => {
                if (i < 0 || i >= MODULES.length) return <span key={i} />;
                const isActive = i === active;
                return (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    style={{
                      fontSize: isActive ? 'clamp(28px, 3.6vw, 44px)' : 'clamp(20px, 2.4vw, 28px)',
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      lineHeight: 1.1,
                      color: isActive ? 'var(--text)' : 'var(--text-3)',
                      transition: 'all 0.3s var(--ease-out)',
                    }}
                  >
                    {MODULES[i].name}
                  </button>
                );
              })}
            </div>

            {/* Module ticker */}
            <div
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {MODULES.map((mod, i) => (
                <button
                  key={mod.id}
                  onClick={() => setActive(i)}
                  className="mono"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: i === active ? 'var(--accent-dim)' : 'transparent',
                    border: '1px solid var(--border-strong)',
                    color: i === active ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 10,
                  }}
                >
                  {mod.name}
                </button>
              ))}
            </div>
          </HudPanel>

          {/* Right: dual visual + tagline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ModuleVisual color={m.bgColor} kind="signal" />
            <div style={{ position: 'relative', flex: 1, minHeight: 180 }}>
              <ModuleVisual color={m.bgColor} kind="surface" />

              {/* Tagline glass card overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  maxWidth: '70%',
                  padding: '14px 16px',
                  background: 'rgba(10, 10, 10, 0.75)',
                  backdropFilter: 'blur(12px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                }}
              >
                <div className="eyebrow" style={{ color: m.bgColor, fontSize: 10, marginBottom: 8 }}>
                  {m.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{m.tagline}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModuleVisual({ color, kind }: { color: string; kind: 'signal' | 'surface' }) {
  // Lightweight HUD imagery — abstract per module. Different vibe per kind.
  if (kind === 'signal') {
    return (
      <div
        style={{
          height: 200,
          borderRadius: 4,
          border: '1px solid var(--border-strong)',
          background: 'radial-gradient(ellipse at 30% 50%, rgba(225,29,72,0.1) 0%, var(--surface) 50%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg viewBox="0 0 800 200" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          {/* Wave bars */}
          {Array.from({ length: 60 }).map((_, i) => {
            const t = i / 60;
            const h = 30 + Math.sin(i * 0.4) * 30 + Math.sin(i * 1.1) * 20 + (t > 0.6 ? 30 * (t - 0.6) * 5 : 0);
            return (
              <rect
                key={i}
                x={i * 13}
                y={100 - h / 2}
                width="6"
                height={h}
                fill={t > 0.7 ? color : 'var(--border-strong)'}
                opacity={t > 0.7 ? 0.85 : 0.5}
              />
            );
          })}
          <line x1="560" y1="0" x2="560" y2="200" stroke="var(--border-strong)" strokeDasharray="2,4" />
        </svg>
        <div style={{ position: 'absolute', top: 12, left: 14, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-2)' }}>
          INTAKE · 24H
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        height: '100%',
        minHeight: 200,
        borderRadius: 4,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 6,
      }}
    >
      {Array.from({ length: 96 }).map((_, i) => {
        const states = ['var(--ok)', 'var(--ok)', 'var(--ok)', 'var(--warn)', color, 'var(--text-faint)'];
        const c = states[(i * 7) % states.length];
        return (
          <div
            key={i}
            style={{
              aspectRatio: '1',
              background: c,
              borderRadius: 1,
              opacity: c === 'var(--text-faint)' ? 0.25 : 0.85,
            }}
          />
        );
      })}
    </div>
  );
}
