import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { HudPanel } from '../components/HudPanel';

/**
 * Intro mosaic — 3×3 grid of HUD tiles. Starts zoomed in on the center
 * PULSE tile, pulls back to reveal the eight surfaces PULSE unifies.
 * Mirrors Relats's intro section pattern.
 */
const TILES: Array<{ label: string; render: () => React.ReactNode }> = [
  { label: 'BEDS', render: TileBeds },
  { label: 'STAFF', render: TileStaff },
  { label: 'RISK', render: TileRisk },
  { label: 'EHR', render: TileEhr },
  { label: 'PULSE', render: TileCenter },
  { label: 'SURGE', render: TileSurge },
  { label: 'BRIEF', render: TileBrief },
  { label: 'COMMS', render: TileComms },
  { label: 'REPLAY', render: TileReplay },
];

export function IntroMosaic() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Start zoomed in on center tile, pull back to full grid by 50% progress
  const scale = useTransform(scrollYProgress, [0, 0.5], [3.4, 1]);
  // Opacity of peripheral tiles ramps up after the camera starts pulling back
  const peripheralOpacity = useTransform(scrollYProgress, [0.05, 0.4], [0, 1]);

  // Headline crossfade — phase 1 visible early, phase 2 visible late.
  // Use 2-point keyframes only; multi-point clamping in motion/react has been
  // unreliable in our version, so we keep ranges simple and explicit.
  const h1Opacity = useTransform(scrollYProgress, [0.32, 0.46], [1, 0]);
  const h1Y = useTransform(scrollYProgress, [0.32, 0.46], [0, -16]);
  const h2Opacity = useTransform(scrollYProgress, [0.55, 0.7], [0, 1]);
  const h2Y = useTransform(scrollYProgress, [0.55, 0.7], [16, 0]);

  return (
    <section
      ref={ref}
      style={{
        position: 'relative',
        height: '400vh',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid backdrop */}
        <div
          className="grid-bg"
          style={{ position: 'absolute', inset: 0, opacity: 0.18, pointerEvents: 'none' }}
        />

        {/* Tile grid — centered, scaled */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <motion.div
            style={{
              scale,
              transformOrigin: 'center center',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: 14,
              width: 'min(86vw, 1200px)',
              height: 'min(82vh, 760px)',
            }}
          >
            {TILES.map((tile, i) => {
              const isCenter = i === 4;
              return (
                <motion.div
                  key={i}
                  style={{
                    opacity: isCenter ? 1 : peripheralOpacity,
                    position: 'relative',
                  }}
                >
                  {tile.render()}
                  <span
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 14,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.22em',
                      color: 'var(--text-2)',
                      textTransform: 'uppercase',
                      pointerEvents: 'none',
                    }}
                  >
                    {tile.label}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Crossfading headlines, stacked at viewport center */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1100,
              height: 'clamp(60px, 7vw, 100px)',
            }}
          >
            <motion.h2
              style={{
                opacity: h1Opacity,
                y: h1Y,
                position: 'absolute',
                inset: 0,
                margin: 0,
                fontSize: 'clamp(28px, 4.4vw, 64px)',
                fontWeight: 600,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
                color: 'var(--text)',
                textAlign: 'center',
                textShadow: '0 4px 28px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)',
              }}
            >
              One operational picture.
            </motion.h2>

            <motion.h2
              style={{
                opacity: h2Opacity,
                y: h2Y,
                position: 'absolute',
                inset: 0,
                margin: 0,
                fontSize: 'clamp(28px, 4.4vw, 64px)',
                fontWeight: 600,
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
                color: 'var(--text)',
                textAlign: 'center',
                textShadow: '0 4px 28px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)',
              }}
            >
              Every surface a hospital runs on.
            </motion.h2>
          </div>
        </div>

        {/* Eyebrow at top */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: 0,
            right: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--accent)' }}>
            UNIFIED SURFACE · 9 MODULES
          </div>
        </div>
      </div>
    </section>
  );
}

/* — Synthetic HUD tiles — bright enough to read at any progress. */

function TileBeds() {
  return (
    <HudPanel label="BED MAP · 4-EAST" emphasized style={{ height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, marginTop: 16 }}>
        {Array.from({ length: 56 }).map((_, i) => {
          const states = [
            'var(--ok)', 'var(--ok)', 'var(--ok)', 'var(--ok)',
            'var(--warn)', 'var(--accent)', 'var(--info)', 'var(--text-faint)',
          ];
          const c = states[(i * 5) % states.length];
          return (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                background: c,
                borderRadius: 1,
                opacity: c === 'var(--text-faint)' ? 0.35 : 0.95,
              }}
            />
          );
        })}
      </div>
    </HudPanel>
  );
}

function TileStaff() {
  return (
    <HudPanel label="COVERAGE · 22:00" emphasized style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {[
          { unit: 'ED', pct: 78, c: 'var(--ok)' },
          { unit: 'ICU', pct: 92, c: 'var(--accent)' },
          { unit: 'TELE', pct: 88, c: 'var(--accent)' },
          { unit: 'MED-SURG', pct: 65, c: 'var(--warn)' },
          { unit: 'OR', pct: 100, c: 'var(--ok)' },
        ].map((row) => (
          <div
            key={row.unit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
            }}
          >
            <span style={{ color: 'var(--text-2)', width: 70 }}>{row.unit}</span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: 'var(--surface-elev)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${row.pct}%`,
                  height: '100%',
                  background: row.c,
                }}
              />
            </div>
            <span style={{ color: 'var(--text)', width: 36, textAlign: 'right' }}>{row.pct}%</span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function TileRisk() {
  return (
    <HudPanel label="COMPOSITE RISK · T+90" emphasized style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100% - 12px)',
          marginTop: 10,
        }}
      >
        <div
          style={{
            fontSize: 'clamp(40px, 5vw, 72px)',
            fontWeight: 600,
            lineHeight: 1,
            color: 'var(--accent)',
            letterSpacing: '-0.05em',
          }}
        >
          0.74
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
          }}
        >
          ↑ +0.18 · BOARDING
        </div>
      </div>
    </HudPanel>
  );
}

function TileEhr() {
  return (
    <HudPanel label="ORDERS · BED 14" emphasized style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 14,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {[
          { o: 'CMP', s: 'RES' },
          { o: 'CXR PA/LAT', s: 'RES' },
          { o: 'TROPONIN', s: 'RUN' },
          { o: 'PT/INR', s: 'PEND' },
          { o: 'D-DIMER', s: 'PEND' },
        ].map((row, i) => (
          <div key={row.o} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background:
                    row.s === 'RES' ? 'var(--ok)' : row.s === 'RUN' ? 'var(--info)' : 'var(--text-3)',
                }}
              />
              <span style={{ color: i < 2 ? 'var(--text)' : 'var(--text-2)' }}>{row.o}</span>
            </div>
            <span
              style={{
                color:
                  row.s === 'RES' ? 'var(--ok)' : row.s === 'RUN' ? 'var(--info)' : 'var(--text-3)',
                letterSpacing: '0.16em',
              }}
            >
              {row.s}
            </span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function TileCenter() {
  return (
    <HudPanel emphasized style={{ height: '100%' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          height: 'calc(100% - 12px)',
        }}
      >
        <svg width="92" height="44" viewBox="0 0 92 44" fill="none">
          <path
            d="M0,22 L28,22 L34,22 L40,6 L46,38 L52,12 L58,22 L92,22"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="mono"
          style={{ fontSize: 14, letterSpacing: '0.32em', color: 'var(--text)' }}
        >
          PULSE
        </div>
        <div
          className="mono"
          style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--text-2)' }}
        >
          SITUATIONAL · ENGINE
        </div>
      </div>
    </HudPanel>
  );
}

function TileSurge() {
  return (
    <HudPanel label="SURGE · AWAITING DIRECTOR" emphasized style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', color: 'var(--accent)' }}>
            5 ACTIONS · 4 OWNERS
          </span>
        </div>
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        {[
          'Discharge ICU 9',
          'Open 4 EVS bed-turns',
          'Pull 2 RNs to MS',
          'Hold 1 elective',
          'Notify ED triage',
        ].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
            {s}
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function TileBrief() {
  return (
    <HudPanel label="BRIEF ME · 30S" emphasized style={{ height: '100%' }}>
      <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.6, color: 'var(--text-2)' }}>
        Outgoing shift: <span style={{ color: 'var(--text)' }}>3 holds in PACU</span>, ICU at{' '}
        <span style={{ color: 'var(--accent)' }}>92%</span>, telemetry transfer pending bed{' '}
        <span style={{ color: 'var(--text)' }}>4-East</span>. EVS team aware, MS coverage thin past
        22:00. <span style={{ color: 'var(--text)' }}>Brief authored 14:09 by PULSE.</span>
      </div>
    </HudPanel>
  );
}

function TileComms() {
  return (
    <HudPanel label="COMMS · SURGE-2614" emphasized style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, fontSize: 11 }}>
        {[
          { who: 'CHARGE-RN', msg: 'ICU 12 vacating', t: '14:02', c: 'var(--info)' },
          { who: 'EVS-LEAD', msg: '4-East ready in 8m', t: '14:04', c: 'var(--ok)' },
          { who: 'ATTENDING', msg: 'Code 7 cleared', t: '14:07', c: 'var(--accent)' },
        ].map((m) => (
          <div key={m.t} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: m.c,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                {m.who}
              </span>
              <div style={{ color: 'var(--text)' }}>{m.msg}</div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-3)',
                letterSpacing: '0.14em',
              }}
            >
              {m.t}
            </span>
          </div>
        ))}
      </div>
    </HudPanel>
  );
}

function TileReplay() {
  return (
    <HudPanel label="REPLAY · 24H" emphasized style={{ height: '100%' }}>
      <div style={{ marginTop: 14 }}>
        <svg viewBox="0 0 240 70" style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
          {Array.from({ length: 28 }).map((_, i) => {
            const h = 8 + Math.abs(Math.sin(i * 0.7) * 36 + Math.sin(i * 1.3) * 14);
            const x = i * 8.5;
            const isNow = i === 22;
            return (
              <rect
                key={i}
                x={x}
                y={70 - h}
                width="5"
                height={h}
                fill={isNow ? 'var(--accent)' : i > 22 ? 'var(--border-strong)' : 'var(--text-2)'}
                opacity={i > 22 ? 0.35 : isNow ? 1 : 0.65}
              />
            );
          })}
        </svg>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-3)',
            letterSpacing: '0.14em',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>00:00</span>
          <span style={{ color: 'var(--accent)' }}>NOW · 14:10</span>
          <span>23:59</span>
        </div>
      </div>
    </HudPanel>
  );
}
