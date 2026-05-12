import { useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { useScrollProgress } from '../lib/scroll-progress';

/**
 * Intro mosaic — 5vh.
 *
 * 2×2 grid of HUD tiles (Beds · Risk · Surge · Replay). Starts zoomed
 * in on the Risk tile (the single accented one), pulls back to reveal
 * all four. Headline crossfades from "One operational picture." to
 * "Across every workflow that runs a hospital."
 *
 * Single accent: the Risk tile's `0.74` composite score, rose-600.
 */
export function IntroMosaic() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollYProgress = useScrollProgress(ref);

  // Now that progress is accurate (matches hand math), ranges are sane:
  // 0.0 = section top hits viewport top, 1.0 = section bottom hits viewport bottom.
  const scale = useTransform(scrollYProgress, [0, 0.45], [2.6, 1]);
  const peripheralOpacity = useTransform(scrollYProgress, [0.1, 0.4], [0, 1]);
  const h1Opacity = useTransform(scrollYProgress, [0.35, 0.55], [1, 0]);
  const h1Y = useTransform(scrollYProgress, [0.35, 0.55], [0, -16]);
  const h2Opacity = useTransform(scrollYProgress, [0.6, 0.8], [0, 1]);
  const h2Y = useTransform(scrollYProgress, [0.6, 0.8], [16, 0]);

  return (
    <section
      ref={ref}
      style={{ position: 'relative', height: '500vh', background: 'var(--bg)' }}
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
        {/* Eyebrow at top */}
        <div
          style={{
            position: 'absolute',
            top: 'clamp(72px, 12vh, 120px)',
            left: 0,
            right: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--text-3)' }}>
            UNIFIED SURFACE · 4 LENSES
          </div>
        </div>

        {/* Tile grid */}
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
              // Risk tile is at grid position (1,0) — top-right of 2×2.
              // Origin at its center (75% horizontal, 25% vertical) means
              // scaling up keeps the Risk tile centered and pushes the
              // others off-screen. Pulling back to scale 1 reveals the
              // full grid composition.
              transformOrigin: '75% 25%',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridTemplateRows: 'repeat(2, 1fr)',
              gap: 16,
              width: 'min(72vw, 920px)',
              aspectRatio: '4 / 3',
              maxHeight: '70vh',
            }}
          >
            <Tile peripheral={peripheralOpacity}>
              <BedsTile />
            </Tile>
            <Tile peripheral={undefined}>
              <RiskTile />
            </Tile>
            <Tile peripheral={peripheralOpacity}>
              <SurgeTile />
            </Tile>
            <Tile peripheral={peripheralOpacity}>
              <ReplayTile />
            </Tile>
          </motion.div>
        </div>

        {/* Crossfading headlines */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'clamp(72px, 12vh, 120px)',
            display: 'flex',
            justifyContent: 'center',
            padding: '0 24px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1100,
              height: 'clamp(36px, 5vw, 60px)',
            }}
          >
            <motion.h2
              style={{
                opacity: h1Opacity,
                y: h1Y,
                position: 'absolute',
                inset: 0,
                fontSize: 'var(--type-display-sm)',
                fontWeight: 600,
                letterSpacing: '-0.035em',
                lineHeight: 1,
                color: 'var(--text)',
                textAlign: 'center',
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
                fontSize: 'var(--type-display-sm)',
                fontWeight: 600,
                letterSpacing: '-0.035em',
                lineHeight: 1,
                color: 'var(--text)',
                textAlign: 'center',
              }}
            >
              Across every workflow that runs a hospital.
            </motion.h2>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({
  peripheral,
  children,
}: {
  peripheral: MotionValue<number> | undefined;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      style={{
        opacity: peripheral ?? 1,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        padding: 'clamp(16px, 2.4vw, 28px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </motion.div>
  );
}

/* — Tiles. Mono-neutral except for Risk which carries the accent. */

function BedsTile() {
  return (
    <TileFrame label="BEDS · 4-EAST">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 4,
          marginTop: 24,
        }}
      >
        {Array.from({ length: 56 }).map((_, i) => {
          const states = ['var(--text-2)', 'var(--text-2)', 'var(--text-2)', 'var(--text-3)', 'var(--text-3)', 'var(--text-faint)'];
          const c = states[(i * 5) % states.length];
          return (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                background: c,
                opacity: c === 'var(--text-faint)' ? 1 : 0.85,
              }}
            />
          );
        })}
      </div>
      <div
        className="mono"
        style={{ marginTop: 18, fontSize: 10, color: 'var(--text-3)' }}
      >
        4 of 47 ready · 12 not staffed
      </div>
    </TileFrame>
  );
}

function RiskTile() {
  // The accent moment of this section
  return (
    <TileFrame label="COMPOSITE RISK · T+90" accent>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          height: 'calc(100% - 12px)',
          minHeight: 200,
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontSize: 'clamp(56px, 7.2vw, 112px)',
            fontWeight: 600,
            letterSpacing: '-0.05em',
            lineHeight: 0.92,
            color: 'var(--accent)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          0.74
        </div>
        <div
          className="mono"
          style={{ marginTop: 14, fontSize: 10, color: 'var(--text-3)' }}
        >
          ↑ +0.18 · driver · boarding
        </div>
      </div>
    </TileFrame>
  );
}

function SurgeTile() {
  return (
    <TileFrame label="SURGE · AWAITING DIRECTOR">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 22,
          fontSize: 13,
        }}
      >
        {[
          'Discharge 9 ICU',
          'Open 4 EVS bed-turns',
          'Pull 2 RNs to MS',
          'Hold 1 elective',
          'Notify ED triage',
        ].map((s) => (
          <div
            key={s}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--text)',
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                background: 'var(--text-2)',
              }}
            />
            {s}
          </div>
        ))}
      </div>
      <div
        className="mono"
        style={{
          marginTop: 22,
          fontSize: 10,
          color: 'var(--text-3)',
        }}
      >
        5 actions · 4 owners · ↓ 0.28
      </div>
    </TileFrame>
  );
}

function ReplayTile() {
  return (
    <TileFrame label="REPLAY · 24H">
      <svg
        viewBox="0 0 240 80"
        style={{ width: '100%', height: 80, marginTop: 24 }}
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: 30 }).map((_, i) => {
          const h = 8 + Math.abs(Math.sin(i * 0.7) * 50 + Math.sin(i * 1.4) * 16);
          const x = i * 8;
          const isNow = i === 22;
          return (
            <rect
              key={i}
              x={x}
              y={80 - h}
              width="5"
              height={h}
              fill={isNow ? 'var(--text)' : i > 22 ? 'var(--text-faint)' : 'var(--text-2)'}
              opacity={i > 22 ? 0.4 : isNow ? 1 : 0.5}
            />
          );
        })}
      </svg>
      <div
        className="mono"
        style={{
          marginTop: 14,
          fontSize: 10,
          color: 'var(--text-3)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>00:00</span>
        <span>now · 14:10</span>
        <span>23:59</span>
      </div>
    </TileFrame>
  );
}

function TileFrame({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: accent ? 'var(--text-2)' : 'var(--text-3)',
          letterSpacing: '0.22em',
        }}
      >
        {label}
      </div>
      {children}
    </>
  );
}
