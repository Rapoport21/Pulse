import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS, FONTS, SPACE, Z } from './design';

/**
 * GlobalTicker — tactical emergency feed strip. Marquees a set of ambient
 * status items at the top of the screen; switches to accent (rose-600)
 * palette when surge mode is active, amber otherwise.
 */
export const GlobalTicker: React.FC<{ isSurgeActive: boolean }> = ({
  isSurgeActive,
}) => {
  const fg = isSurgeActive ? COLORS.textPrimary : COLORS.warn;
  const bg = isSurgeActive ? COLORS.accent : 'rgba(245, 158, 11, 0.12)';
  const border = isSurgeActive ? COLORS.accentBright : 'rgba(245, 158, 11, 0.3)';

  const items = [
    '[14:02] 🚑 Trauma Alert: ETA 5 mins (Bay 1)',
    '[14:05] 🩸 Blood Bank: O- inventory critical (2 units remaining)',
    '[14:12] 🛏️ ICU Step-down: 2 beds clean and ready',
    '[14:15] ⚠️ ER Wait Time exceeding 45 mins',
  ];

  return (
    <>
      <style>
        {`
          @keyframes ticker-marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          @keyframes ticker-icon-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .pulse-ticker-track {
            display: inline-block;
            white-space: nowrap;
            animation: ticker-marquee 30s linear infinite;
          }
          .pulse-ticker-icon {
            animation: ticker-icon-pulse 1.6s ease-in-out infinite;
          }
        `}
      </style>
      <div
        role="status"
        style={{
          position: 'relative',
          zIndex: Z.sticky,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          padding: `${SPACE.xs + 2}px ${SPACE.base}px`,
          background: bg,
          borderBottom: `1px solid ${border}`,
          color: fg,
          fontFamily: FONTS.mono,
          fontSize: 14,
          letterSpacing: '0.08em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <AlertTriangle
          size={15}
          strokeWidth={2}
          className="pulse-ticker-icon"
          style={{ flexShrink: 0 }}
        />
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div className="pulse-ticker-track">
            {items.map((text, i) => (
              <React.Fragment key={i}>
                <span style={{ margin: `0 ${SPACE.base}px` }}>{text}</span>
                {i < items.length - 1 && (
                  <span style={{ margin: `0 ${SPACE.base}px`, opacity: 0.5 }}>•</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
