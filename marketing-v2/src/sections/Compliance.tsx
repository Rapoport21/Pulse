/**
 * Compliance — 2vh.
 *
 * Kept per Nick's redline. Static card. Speaks in muted authority — no
 * accent, no fanfare. Just facts.
 *
 * Single accent: NONE. Compliance abstains.
 */
export function Compliance() {
  return (
    <section
      style={{
        background: 'var(--bg)',
        padding: 'clamp(80px, 12vh, 140px) 24px',
      }}
    >
      <div
        className="container"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
          gap: 'clamp(40px, 6vw, 96px)',
          alignItems: 'start',
        }}
      >
        <div>
          <div
            className="eyebrow"
            style={{ color: 'var(--text-3)', marginBottom: 24 }}
          >
            COMPLIANCE-READY
          </div>
          <h2
            style={{
              fontSize: 'var(--type-display-sm)',
              fontWeight: 600,
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
              color: 'var(--text)',
              maxWidth: '14ch',
            }}
          >
            Built for the HIPAA / FHIR reality.
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <p
            style={{
              fontSize: 'var(--type-body-lg)',
              color: 'var(--text-2)',
              lineHeight: 1.6,
              maxWidth: '52ch',
            }}
          >
            Audit trails on every action. FHIR integrations to existing
            systems. On-prem option. A deployment posture you can hand to
            your compliance team without rewriting their playbook.
          </p>

          {/* Spec strip — mono, neutral */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {[
              { label: 'HIPAA', detail: 'Audit trail · SOC 2 mapping' },
              { label: 'FHIR R4', detail: 'Epic · Cerner · Meditech' },
              { label: 'On-prem', detail: 'Air-gapped option' },
              { label: 'SSO', detail: 'SAML · OIDC' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '14px 18px',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  minWidth: 180,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--text)',
                    letterSpacing: '0.18em',
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {s.detail}
                </span>
              </div>
            ))}
          </div>

          <a
            href="#"
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 20px',
              border: '1px solid var(--border-strong)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 2,
            }}
          >
            Read the security overview <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
