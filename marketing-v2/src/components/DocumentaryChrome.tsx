import { useEffect, useState } from 'react';
import { useTheme } from '../lib/theme';

/**
 * Documentary chrome — film-set HUD that overlays the page only when
 * the documentary theme is active.
 *
 * The intent is to feel like a behind-the-camera or DIT-monitor view:
 * timecode in the corner, "REC" indicator, lens/format metadata.
 *
 * It's purely decorative — no interaction. Lives at z-index 90 so it's
 * above content but below the nav (z 50) and below the global grain
 * overlay (z 200). Hidden in any other theme.
 */
export function DocumentaryChrome() {
  const { theme } = useTheme();
  const [timecode, setTimecode] = useState('00:00:00:00');

  // Live-running timecode. Increments at 24fps cadence — the standard
  // film frame rate, since we're playing at being a documentary.
  useEffect(() => {
    if (theme !== 'documentary') return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const hours = Math.floor(elapsed / 3600) % 24;
      const minutes = Math.floor(elapsed / 60) % 60;
      const seconds = Math.floor(elapsed) % 60;
      const frames = Math.floor((elapsed * 24) % 24);
      setTimecode(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [theme]);

  if (theme !== 'documentary') return null;

  const monoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--text-2)',
  };

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        // z-index sits ABOVE the global grain overlay (z:200) so the REC
        // dot and timecode read sharply through the grain layer.
        zIndex: 210,
      }}
    >
      {/* Top-left: REC indicator */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          ...monoStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'doc-rec-pulse 1.4s ease-in-out infinite',
            }}
          />
          <span style={{ color: 'var(--text)' }}>REC</span>
        </div>
        <div>{timecode}</div>
      </div>

      {/* Top-right reserved — nav lives here */}

      {/* Bottom-left: format/lens metadata */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          display: 'flex',
          gap: 24,
          ...monoStyle,
        }}
      >
        <span>FMT · 4K · 24P</span>
        <span>LEN · 35MM</span>
        <span>ISO 1600</span>
      </div>

      {/* Bottom-right: scene + take */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          display: 'flex',
          gap: 24,
          ...monoStyle,
        }}
      >
        <span>SHOT · CONT</span>
        <span>SCN · 0042</span>
        <span style={{ color: 'var(--accent)' }}>TK · 03</span>
      </div>

      {/* Crosshair / safe area frame markers — top corners of the safe area */}
      <FrameMark pos="tl" />
      <FrameMark pos="tr" />
      <FrameMark pos="bl" />
      <FrameMark pos="br" />
    </div>
  );
}

function FrameMark({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const off = 24;
  const len = 14;
  const w = 1;
  const styles: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 70, left: off },
    tr: { top: 70, right: off },
    bl: { bottom: 70, left: off },
    br: { bottom: 70, right: off },
  };
  const isTop = pos === 'tl' || pos === 'tr';
  const isLeft = pos === 'tl' || pos === 'bl';
  return (
    <div
      style={{
        position: 'absolute',
        width: len,
        height: len,
        ...styles[pos],
      }}
    >
      <div
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: len,
          height: w,
          background: 'var(--text-2)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: w,
          height: len,
          background: 'var(--text-2)',
        }}
      />
    </div>
  );
}
