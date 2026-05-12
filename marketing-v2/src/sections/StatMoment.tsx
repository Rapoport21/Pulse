import { CountUp } from '../components/CountUp';

/**
 * Stat moment — 4vh.
 *
 * Single big count-up. Per the brief: the *unit suffix* "min" is the
 * accent, not the number. Counter-intuitive but lets the unit do the work
 * — the visitor reads "min" first as the punctuation, then the number
 * as the substance.
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
        padding: '0 24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(24px, 3vh, 40px)',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--text-3)' }}>
          OPERATIONAL OUTCOME
        </div>

        <p
          style={{
            fontSize: 'var(--type-body-lg)',
            color: 'var(--text-2)',
            maxWidth: '40ch',
          }}
        >
          PULSE-managed shifts return on average
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'clamp(8px, 1.5vw, 24px)',
          }}
        >
          <CountUp
            from={0}
            to={47}
            format={(n) => `${Math.round(n)}`}
            style={{
              fontSize: 'var(--type-display-xl)',
              fontWeight: 600,
              letterSpacing: '-0.05em',
              lineHeight: 0.88,
              color: 'var(--text)',
              minWidth: '2ch',
              display: 'inline-block',
              textAlign: 'right',
            }}
          />
          <span
            style={{
              fontSize: 'var(--type-display-xl)',
              fontWeight: 600,
              letterSpacing: '-0.05em',
              lineHeight: 0.88,
              color: 'var(--accent)',
            }}
          >
            min
          </span>
        </div>

        <p
          style={{
            fontSize: 'var(--type-body-lg)',
            color: 'var(--text-2)',
            maxWidth: '46ch',
            lineHeight: 1.5,
          }}
        >
          of clinician time, per shift, back to the bedside.
        </p>

        <div
          style={{
            marginTop: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 14px',
            border: '1px solid var(--border)',
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--text-3)',
            }}
          />
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--text-3)' }}
          >
            DIRECTIONAL · MEASURED ACROSS PILOT WORKLOADS
          </span>
        </div>
      </div>
    </section>
  );
}
