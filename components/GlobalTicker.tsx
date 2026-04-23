import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS, FONTS, SPACE, Z } from './design';
import {
  type ScenarioState,
  useScenarioTick,
} from '../lib/scenario';

/**
 * GlobalTicker — tactical emergency feed strip. Marquees a set of ambient
 * status items at the top of the screen.
 *   - surge mode → rose-600 accent palette
 *   - scenario running → palette + message set tracks severity
 *   - baseline → amber palette with routine ops messages
 */
export const GlobalTicker: React.FC<{
  isSurgeActive: boolean;
  /** Active 3-minute simulation scenario. Drives palette + message set. */
  activeScenario?: ScenarioState | null;
}> = ({ isSurgeActive, activeScenario = null }) => {
  const scenarioTick = useScenarioTick(activeScenario);
  const scenarioLive = !!activeScenario && scenarioTick.remainingMs > 0;

  // Palette — surge trumps scenario visually (S3 auto-activates surge, so
  // this lines up naturally). S2 elevates to amber-high; S1 stays ambient.
  const tonePreset = (() => {
    if (isSurgeActive || (scenarioLive && activeScenario.severity === 3)) {
      return {
        fg: COLORS.textPrimary,
        bg: COLORS.accent,
        border: COLORS.accentBright,
      };
    }
    if (scenarioLive && activeScenario.severity === 2) {
      return {
        fg: COLORS.warn,
        bg: 'rgba(245, 158, 11, 0.18)',
        border: COLORS.warn,
      };
    }
    // S1 or baseline
    return {
      fg: COLORS.warn,
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
    };
  })();
  const { fg, bg, border } = tonePreset;

  // Scenario-specific message feed. Phase-aware so the ticker evolves
  // through the 3-minute arc instead of repeating the same stock lines.
  const items = (() => {
    if (!scenarioLive) {
      return [
        '[14:02] 🚑 Trauma Alert: ETA 5 mins (Bay 1)',
        '[14:05] 🩸 Blood Bank: O- inventory critical (2 units remaining)',
        '[14:12] 🛏️ ICU Step-down: 2 beds clean and ready',
        '[14:15] ⚠️ ER Wait Time exceeding 45 mins',
      ];
    }
    const phase = scenarioTick.phase;
    if (activeScenario.severity === 1) {
      return [
        '[NORMAL] 🩺 Ambulatory rounds steady — no interventions required',
        '[NORMAL] 🛏️ Discharge lounge open — 3 pts pending transport',
        '[NORMAL] 🚑 EMS baseline: 1 routine inbound, ETA 12m',
        '[NORMAL] ☕ Cafeteria grill open through 15:00',
      ];
    }
    if (activeScenario.severity === 2) {
      if (phase === 'ramp' || phase === 'climb') {
        return [
          '[MODERATE] 📈 ER load climbing — 90% saturation crossed',
          '[MODERATE] 🚑 Trauma 2 inbound (crush injury, ETA 8m)',
          '[MODERATE] 🩺 Float pool on standby — 2 RNs warming',
          '[MODERATE] 🧾 Admissions queue: 6 pending floor assignment',
        ];
      }
      if (phase === 'peak' || phase === 'hold') {
        return [
          '[MODERATE] ⚠️ Boarding pressure sustained — 6 holds ER→floor',
          '[MODERATE] 🚑 Stroke inbound — CT suite pre-warmed',
          '[MODERATE] 🩸 Blood bank: O- down to 3 units',
          '[MODERATE] 👥 Staffing gap Med-Surg 4W — charge covering',
        ];
      }
      return [
        '[MODERATE] ✅ Pressure easing — hold throughput steady',
        '[MODERATE] 🛏️ 3 discharges clearing through 14:45',
        '[MODERATE] 🚑 EMS load returning to baseline',
        '[MODERATE] 📊 NEDOCS trending down — monitor shift change',
      ];
    }
    // Severity 3 — MCI
    if (phase === 'ramp' || phase === 'climb') {
      return [
        '[DISASTER] 🚨 MASS CASUALTY INCIDENT — Surge Level 2 ACTIVE',
        '[DISASTER] 🚑 Medic 41 inbound, penetrating trauma, ETA 4m',
        '[DISASTER] 🏥 Overflow unit Hall C opening — EVS dispatched',
        '[DISASTER] 📡 Ambulance divert posted to regional grid',
      ];
    }
    if (phase === 'peak' || phase === 'hold') {
      return [
        '[DISASTER] 🚨 3 ACTIVE CODES — trauma bays saturated',
        '[DISASTER] 🩸 MTP active · O- and FFP on continuous release',
        '[DISASTER] 👥 RN shortfall -4 FTE · call-back initiated',
        '[DISASTER] 🚁 Regional transfers: St. Mary / County on divert',
      ];
    }
    return [
      '[DISASTER] 📉 Peak passed — incident stabilizing',
      '[DISASTER] 🚑 EMS offload risk easing · last ambulance bay freed',
      '[DISASTER] 📊 NEDOCS falling · MTP wind-down in progress',
      '[DISASTER] 📝 After-action review queued for 16:00',
    ];
  })();

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
          fontSize: 11,
          letterSpacing: '0.08em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <AlertTriangle
          size={12}
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
