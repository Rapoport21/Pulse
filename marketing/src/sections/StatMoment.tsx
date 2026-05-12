import { CountUp } from '../components/CountUp';

/**
 * Stat moment — the equivalent of Relats's "143,800,000 meters per year".
 * Single big number that ticks up as the section enters the viewport,
 * over a slow ambient backdrop.
 */
export function StatMoment() {
  return (
    <section
      style={{
        position: 'relative',
        height: '90vh',
        background: 'var(--bg-deep)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ambient backdrop — abstract corridor / blueprint */}
      <BackdropCorridor />

      <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px', zIndex: 1 }}>
        <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 24 }}>
          OPERATIONAL OUTCOME
        </div>
        <div style={{ fontSize: 18, color: 'var(--text-2)', marginBottom: 24 }}>
          PULSE-managed shifts return on average
        </div>
        <h2
          style={{
            fontSize: 'clamp(80px, 14vw, 240px)',
            fontWeight: 600,
            letterSpacing: '-0.05em',
            lineHeight: 0.85,
            color: 'var(--text)',
          }}
        >
          <CountUp
            from={0}
            to={47}
            format={(n) => `${Math.round(n)}`}
            style={{ display: 'inline-block', minWidth: '2ch' }}
          />
          <span style={{ color: 'var(--accent)' }}>min</span>
        </h2>
        <div style={{ marginTop: 24, fontSize: 18, color: 'var(--text-2)' }}>
          of clinician time, per shift, back to the bedside
        </div>

        <div
          className="mono"
          style={{
            marginTop: 40,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 16px',
            border: '1px solid var(--border-strong)',
            borderRadius: 999,
            color: 'var(--text-2)',
            fontSize: 11,
          }}
        >
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          DIRECTIONAL · MEASURED ACROSS PILOT WORKLOADS
        </div>
      </div>
    </section>
  );
}

function BackdropCorridor() {
  return (
    <svg
      viewBox="0 0 1440 800"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }}
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="65%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="1440" height="800" fill="url(#glow)" />
      {/* Perspective lines suggesting a corridor receding to a vanishing point */}
      {Array.from({ length: 14 }).map((_, i) => {
        const t = i / 14;
        const y = 800 - t * 600;
        return <line key={i} x1="0" y1={y} x2="1440" y2={y} stroke="var(--border)" strokeWidth="1" opacity={0.4 - t * 0.3} />;
      })}
      {Array.from({ length: 18 }).map((_, i) => {
        const x = (i / 18) * 1440;
        return <line key={i} x1={x} y1="800" x2={720 + (x - 720) * 0.3} y2="200" stroke="var(--border)" strokeWidth="1" opacity={0.25} />;
      })}
    </svg>
  );
}
