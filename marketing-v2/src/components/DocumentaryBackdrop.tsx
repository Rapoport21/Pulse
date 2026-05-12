import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/theme';

/**
 * Documentary backdrop — fixed full-screen cinematic scene behind all
 * content, only mounted when the documentary theme is active.
 *
 * Layered, back to front:
 *   1. Procedural corridor SVG (always rendered, fully visible by default)
 *   2. Real <video> on top (fades to opacity 1 once it has buffered;
 *      stays at opacity 0 if it errors or never loads — procedural
 *      shows through underneath)
 *   3. Tungsten color cast over both
 *
 * The procedural layer always renders; the video sits on top and is
 * the preferred visual when available. We never conditionally remove
 * the video element — that caused state leaks across StrictMode
 * remounts where videoFailed could end up stuck `true`.
 *
 * Scroll-scrubbed playback: the video's currentTime is mapped to the
 * Hero section's scroll progress (Hero is `<main>'s first <section>`).
 * As the visitor scrolls down, the video advances; up rewinds; outside
 * Hero, the entire backdrop fades to opacity 0 over one viewport so
 * subsequent sections render in their own aesthetic.
 *
 * Lives as a sibling of `<main>` in App.tsx so its z-index: 1 sits
 * cleanly below main's z-index: 2 (which only applies in documentary
 * mode, via globals.css).
 */
export function DocumentaryBackdrop() {
  const { theme } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  const SOURCES = [
    '/hero-doc.mp4',
    '/hero-doc.webm',
    'https://samplelib.com/lib/preview/mp4/sample-15s.mp4',
  ];

  useEffect(() => {
    if (theme !== 'documentary') return;
    const v = videoRef.current;
    if (!v) return;

    const onCanPlay = () => {
      setVideoReady(true);
      v.pause();
      updateFromScroll();
    };
    v.addEventListener('canplay', onCanPlay);

    // Scroll-scrubbed playback anchored to the hero section.
    let raf = 0;
    let lastProgress = -1;
    const updateFromScroll = () => {
      const dur = v.duration;
      const hero = document.querySelector('main > section');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const sectionH = (hero as HTMLElement).offsetHeight;
      const scrolledIn = Math.max(0, -rect.top);

      if (dur && !isNaN(dur)) {
        const progress =
          sectionH > 0 ? Math.max(0, Math.min(1, scrolledIn / sectionH)) : 0;
        if (Math.abs(progress - lastProgress) >= 0.0005) {
          lastProgress = progress;
          v.currentTime = progress * Math.max(0, dur - 0.05);
        }
      }

      // Backdrop fade — visible during hero, fades over one viewport
      // after, then fully gone so subsequent sections render alone.
      const containerEl = containerRef.current;
      if (containerEl) {
        const vh = window.innerHeight;
        const fadeStart = sectionH;
        const fadeEnd = sectionH + vh;
        const fade =
          scrolledIn <= fadeStart
            ? 1
            : scrolledIn >= fadeEnd
            ? 0
            : 1 - (scrolledIn - fadeStart) / vh;
        containerEl.style.opacity = String(fade);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateFromScroll();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // Initial sync
    updateFromScroll();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      v.removeEventListener('canplay', onCanPlay);
    };
  }, [theme]);

  if (theme !== 'documentary') return null;

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 1,
        transition: 'opacity 0.15s linear',
      }}
    >
      {/* Procedural corridor — always rendered, always visible. The video
       * sits on top of this; if the video doesn't load, the procedural
       * is what the visitor sees. */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <ProceduralCorridor />
      </div>

      {/* Video — always in the DOM. Fades to opacity 1 when ready. If it
       * never loads, stays at opacity 0 and the procedural is what shows. */}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: videoReady ? 1 : 0,
          transition: 'opacity 0.6s var(--ease-out)',
          // Tungsten grading — pulls any footage into the documentary look.
          filter: 'saturate(0.6) contrast(1.1) sepia(0.18) brightness(0.55)',
        }}
      >
        {SOURCES.map((src) => (
          <source
            key={src}
            src={src}
            type={src.endsWith('.webm') ? 'video/webm' : 'video/mp4'}
          />
        ))}
      </video>

      {/* Tungsten warm color cast over either layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(255,170,80,0.10) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function ProceduralCorridor() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="floor" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="oklch(8% 0.012 60)" />
            <stop offset="100%" stopColor="oklch(3% 0.008 60)" />
          </linearGradient>
          <linearGradient id="ceiling" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="oklch(3% 0.008 60)" />
            <stop offset="100%" stopColor="oklch(7% 0.012 60)" />
          </linearGradient>
          <linearGradient id="wallL" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(4% 0.01 60)" />
            <stop offset="100%" stopColor="oklch(11% 0.014 60)" />
          </linearGradient>
          <linearGradient id="wallR" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(11% 0.014 60)" />
            <stop offset="100%" stopColor="oklch(4% 0.01 60)" />
          </linearGradient>
          <radialGradient id="endLight" cx="50%" cy="55%" r="40%">
            <stop offset="0%" stopColor="oklch(50% 0.10 60 / 0.95)" />
            <stop offset="60%" stopColor="oklch(20% 0.04 60 / 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <rect width="1920" height="540" fill="url(#ceiling)" />
        <polygon points="0,540 1920,540 1920,1080 0,1080" fill="url(#floor)" />
        <polygon points="0,0 0,1080 720,540 720,540" fill="url(#wallL)" />
        <polygon points="1920,0 1920,1080 1200,540 1200,540" fill="url(#wallR)" />

        {[0.18, 0.32, 0.48, 0.66].map((t, i) => {
          const xL = 720 - 720 * (1 - t);
          const xR = 1200 + 720 * (1 - t);
          const y = 540 - 540 * (1 - t) * 0.85;
          const w = 60 * t;
          const h = 200 * t;
          return (
            <g key={i}>
              <rect
                x={xL - w}
                y={y - h * 0.4}
                width={w}
                height={h}
                fill="oklch(2% 0.005 60)"
                stroke="oklch(14% 0.014 60)"
                strokeWidth={0.5}
              />
              <rect
                x={xR}
                y={y - h * 0.4}
                width={w}
                height={h}
                fill="oklch(2% 0.005 60)"
                stroke="oklch(14% 0.014 60)"
                strokeWidth={0.5}
              />
            </g>
          );
        })}

        <ellipse
          cx="960"
          cy="540"
          rx="500"
          ry="320"
          fill="url(#endLight)"
          style={{ animation: 'doc-pool 5.2s ease-in-out infinite' }}
        />

        <g opacity="0.28">
          <rect x="956" y="510" width="8" height="48" fill="oklch(3% 0.005 60)" />
          <circle cx="960" cy="500" r="6" fill="oklch(4% 0.005 60)" />
        </g>

        {[0.16, 0.28, 0.42, 0.58, 0.76].map((t, i) => {
          const y = 540 - 540 * (1 - t) * 0.85;
          const x = 960;
          const w = 200 - t * 180;
          return (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={w} ry={w * 0.06} fill="oklch(78% 0.10 70 / 0.18)" />
              <ellipse
                cx={x}
                cy={y}
                rx={w * 0.7}
                ry={w * 0.025}
                fill="oklch(85% 0.10 70 / 0.32)"
              />
            </g>
          );
        })}

        {Array.from({ length: 14 }).map((_, i) => {
          const t = (i + 1) / 14;
          const y = 540 + (1080 - 540) * t * t;
          return (
            <line
              key={i}
              x1={960 - 1920 * t}
              y1={y}
              x2={960 + 1920 * t}
              y2={y}
              stroke="oklch(14% 0.012 60 / 0.4)"
              strokeWidth={Math.max(0.5, 1.5 * t)}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 30% at 50% 60%, rgba(255,180,90,0.08) 0%, transparent 70%)',
          mixBlendMode: 'screen',
          animation: 'doc-haze 9s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes doc-haze {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.95; }
        }
        @keyframes doc-pool {
          0%, 100% { opacity: 0.95; }
          47%      { opacity: 0.82; }
          50%      { opacity: 1; }
          53%      { opacity: 0.88; }
        }
      `}</style>
    </div>
  );
}
