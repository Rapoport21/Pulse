/**
 * Worldwide / Deployment readiness — equivalent of Relats's globe section.
 * Stylized map graph with location pulses; copy on the left.
 */
export function Worldwide() {
  const sites = [
    { x: 22, y: 38, kind: 'pilot' },
    { x: 28, y: 44, kind: 'pilot' },
    { x: 34, y: 36, kind: 'live' },
    { x: 48, y: 32, kind: 'live' },
    { x: 56, y: 40, kind: 'pilot' },
    { x: 70, y: 50, kind: 'live' },
    { x: 78, y: 56, kind: 'pilot' },
  ];

  return (
    <section style={{ position: 'relative', padding: '14vh 24px', background: 'var(--bg)' }}>
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: 32,
          alignItems: 'center',
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 20 }}>
            DEPLOYMENT READY
          </div>
          <h2
            style={{
              fontSize: 'clamp(40px, 5.4vw, 80px)',
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 0.95,
              marginBottom: 24,
            }}
          >
            Standing up<br />in any health system.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-2)', maxWidth: '46ch', lineHeight: 1.6 }}>
            Cloud, on-prem, or air-gapped. PULSE wraps the systems you
            already run and gives every role the same operational picture.
          </p>

          <div style={{ marginTop: 32, display: 'flex', gap: 24 }}>
            <Stat label="Live deployments" value="—" />
            <Stat label="Pilots" value="—" />
            <Stat label="Stand-up" value="< 8 wk" />
          </div>
        </div>

        <div style={{ position: 'relative', minHeight: 420 }}>
          <MapGraph sites={sites} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)' }}>{value}</div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>{label.toUpperCase()}</div>
    </div>
  );
}

function MapGraph({ sites }: { sites: Array<{ x: number; y: number; kind: 'live' | 'pilot' }> }) {
  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: 'auto', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)' }}
    >
      {/* Stylized continent blobs — purposely abstract, not geographically precise */}
      <g fill="var(--border-strong)" opacity="0.7">
        <path d="M10,28 Q14,22 22,24 Q30,22 32,30 Q34,38 28,42 Q20,46 14,42 Q8,36 10,28 Z" />
        <path d="M40,18 Q46,14 52,18 Q58,16 60,24 Q60,30 54,32 Q48,34 44,30 Q38,28 40,18 Z" />
        <path d="M64,44 Q70,40 76,44 Q82,42 84,52 Q82,56 76,56 Q68,58 64,52 Z" />
      </g>

      {/* Connection arcs between sites */}
      {sites.map((s, i) =>
        sites.slice(i + 1).map((t, j) => {
          const cx = (s.x + t.x) / 2;
          const cy = Math.min(s.y, t.y) - 10;
          return (
            <path
              key={`${i}-${j}`}
              d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="0.15"
              opacity="0.25"
            />
          );
        }),
      )}

      {/* Pins */}
      {sites.map((s, i) => (
        <g key={i}>
          <circle
            cx={s.x}
            cy={s.y}
            r="1.6"
            fill={s.kind === 'live' ? 'var(--accent)' : 'var(--info)'}
            opacity="0.9"
          />
          <circle
            cx={s.x}
            cy={s.y}
            r="3"
            fill="none"
            stroke={s.kind === 'live' ? 'var(--accent)' : 'var(--info)'}
            strokeWidth="0.2"
            opacity="0.4"
          >
            <animate attributeName="r" values="1.6;6;1.6" dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
          </circle>
        </g>
      ))}

      <text x="2" y="58" fill="var(--text-3)" fontSize="2" fontFamily="var(--font-mono)" letterSpacing="0.4">
        DEPLOYMENT MAP · INDICATIVE
      </text>
    </svg>
  );
}
