/**
 * Compliance — equivalent of Relats's "Sustainability Commitment" card.
 * A small two-up panel with a softened backdrop image and a card.
 */
export function Compliance() {
  return (
    <section style={{ padding: '8vh 24px', background: 'var(--bg-deep)' }}>
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          minHeight: 360,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'radial-gradient(ellipse at 30% 70%, rgba(225,29,72,0.15), var(--surface) 60%)',
          }}
        >
          <svg viewBox="0 0 600 400" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}>
            {/* Stylized lock/shield ambient */}
            <defs>
              <radialGradient id="comp-glow" cx="50%" cy="60%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <rect width="600" height="400" fill="url(#comp-glow)" />
            {Array.from({ length: 12 }).map((_, i) => (
              <circle
                key={i}
                cx="300"
                cy="220"
                r={20 + i * 18}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="1"
                opacity={0.5 - i * 0.04}
              />
            ))}
            <path
              d="M260,180 L300,160 L340,180 L340,230 L300,260 L260,230 Z"
              stroke="var(--accent)"
              strokeWidth="1.5"
              fill="rgba(225,29,72,0.08)"
            />
          </svg>
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.18em' }}>
              ENCRYPTED · AUDITED · ROLE-SCOPED
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--text-2)', marginBottom: 16 }}>
            COMPLIANCE-READY
          </div>
          <h3 style={{ fontSize: 'clamp(28px, 3.4vw, 44px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 16 }}>
            Built for the<br />HIPAA / FHIR<br />reality.
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24, maxWidth: '40ch' }}>
            Audit trails on every action. FHIR integrations to existing
            systems (Epic, Cerner, TeleTracking). On-prem option. Deployment
            posture you can hand to your compliance team without rewriting
            their playbook.
          </p>
          <button
            style={{
              alignSelf: 'flex-start',
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid var(--border-strong)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Read the security overview
          </button>
        </div>
      </div>
    </section>
  );
}
