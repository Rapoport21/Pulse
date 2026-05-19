/**
 * VitalsPanel — the 24h vital sign display that pairs with PatientHeaderStrip.
 *
 * Renders a single tactical card with:
 *
 *   • A row of "latest" vital tiles: HR, SBP/DBP, SpO2, RR, Temp, Pain
 *     (each with the 24h sparkline painted behind the number)
 *   • A row of the three early warning scores (MEWS / NEWS2 / qSOFA)
 *     computed from the newest vital set. Colours track the risk bucket.
 *   • A breakdown row for the currently-selected score. Clicking a score
 *     tile swaps which score's breakdown is shown. The breakdown lists
 *     each contributing parameter with its raw value and point weight.
 *
 * The sparkline implementation is a hand-rolled SVG path so we don't
 * pull another dep. It accepts 2–24 points and normalises to the
 * width of its tile. Min/max are auto-scaled with a ±10% headroom.
 *
 * This component is intentionally presentational — it reads from
 * `patient.vitalsHistory` and renders. Recording a new vital set lives
 * in a separate modal (T2.12, to land in Wave A).
 */

import React, { useMemo, useState } from 'react';
import { ActivitySquare, Brain, FlaskConical, Heart, Thermometer, Wind } from 'lucide-react';
import type { Patient, Vital, EarlyWarningScore } from '../../types';
import { computeMEWS, computeNEWS2, computeQSOFA } from '../../lib/clinicalScores';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  Mono,
  BracketLabel,
  CornerBracket,
  TacticalCard,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────

const riskColor = (risk: EarlyWarningScore['risk']): string => {
  switch (risk) {
    case 'critical':
      return COLORS.crit;
    case 'high':
      return COLORS.accent;
    case 'moderate':
      return COLORS.warn;
    case 'low':
    default:
      return COLORS.ok;
  }
};

/** Build an SVG path from an array of numbers. Returns null if < 2 points. */
const buildPath = (
  values: (number | undefined | null)[],
  width: number,
  height: number,
  pad = 4,
): { d: string; dAreaFill: string } | null => {
  const clean = values
    .map((v, i) => ({ v, i }))
    .filter((p) => p.v != null && !Number.isNaN(p.v)) as { v: number; i: number }[];
  if (clean.length < 2) return null;

  const vs = clean.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const range = max - min || 1;
  const headroom = range * 0.1;
  const top = max + headroom;
  const bottom = min - headroom;
  const span = top - bottom || 1;

  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const points = clean.map((p) => {
    const x = pad + (p.i / (values.length - 1)) * usableW;
    const y = pad + (1 - (p.v - bottom) / span) * usableH;
    return { x, y };
  });

  const d = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(' ');

  const dArea = `${d} L ${points[points.length - 1].x.toFixed(2)} ${(height - pad).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - pad).toFixed(2)} Z`;

  return { d, dAreaFill: dArea };
};

// ─────────────────────────────────────────────────────────────────────────
// VitalTile — a single vital sign readout with sparkline behind it
// ─────────────────────────────────────────────────────────────────────────

interface VitalTileProps {
  label: string;
  current: string;
  unit: string;
  series: (number | undefined | null)[];
  tone?: 'default' | 'ok' | 'warn' | 'crit';
  icon?: React.ReactNode;
}

const toneColor = (tone: VitalTileProps['tone']): string => {
  switch (tone) {
    case 'ok':
      return COLORS.ok;
    case 'warn':
      return COLORS.warn;
    case 'crit':
      return COLORS.crit;
    default:
      return COLORS.textPrimary;
  }
};

const VitalTile: React.FC<VitalTileProps> = ({ label, current, unit, series, tone = 'default', icon }) => {
  const color = toneColor(tone);
  const pathData = useMemo(() => buildPath(series, 140, 46, 3), [series]);
  const isMissing = current === '—' || current === '' || current == null;
  return (
    <div
      style={{
        position: 'relative',
        flex: '1 1 120px',
        minWidth: 120,
        padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
        background: COLORS.bgDeep,
        border: `1px solid ${tone === 'default' ? COLORS.border : color}`,
        borderLeft: `3px solid ${tone === 'default' ? COLORS.borderStrong : color}`,
        borderRadius: RADIUS.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflow: 'hidden',
      }}
    >
      {/* Sparkline backing */}
      {pathData && (
        <svg
          aria-hidden
          viewBox="0 0 140 46"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '62%',
            height: 46,
            opacity: 0.75,
            pointerEvents: 'none',
          }}
        >
          <path d={pathData.dAreaFill} fill={color} opacity={0.08} />
          <path d={pathData.d} stroke={color} strokeWidth={1.25} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
        {icon}
        <Mono tone="muted" size="xs">
          {label}
        </Mono>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          position: 'relative',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 20,
            fontWeight: 700,
            color: isMissing ? COLORS.textMuted : color,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          {current || '—'}
        </span>
        {unit && (
          <Mono tone="muted" size="xs">
            {unit}
          </Mono>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ScoreChip — a tappable MEWS/NEWS2/qSOFA chip in the score row
// ─────────────────────────────────────────────────────────────────────────

const ScoreChip: React.FC<{
  score: EarlyWarningScore;
  active: boolean;
  onSelect: () => void;
}> = ({ score, active, onSelect }) => {
  const color = riskColor(score.risk);
  return (
    <button
      type="button"
      className="tap-target"
      onClick={onSelect}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
        background: active ? 'rgba(255,255,255,0.02)' : COLORS.bgDeep,
        border: `1px solid ${active ? color : COLORS.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 140ms ease, background 140ms ease',
      }}
    >
      {active && (
        <>
          <CornerBracket position="tl" color={color} size={5} thickness={1} inset={-1} />
          <CornerBracket position="tr" color={color} size={5} thickness={1} inset={-1} />
          <CornerBracket position="bl" color={color} size={5} thickness={1} inset={-1} />
          <CornerBracket position="br" color={color} size={5} thickness={1} inset={-1} />
        </>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
        }}
      >
        <Mono tone="muted" size="xs">
          {score.name}
        </Mono>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 26,
            fontWeight: 700,
            color,
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score.value}
        </span>
        <Mono tone="dim" size="xs">
          /{score.maxValue}
        </Mono>
      </div>
      <Mono tone="muted" size="xs" style={{ marginTop: 4, letterSpacing: '0.16em' }}>
        {score.risk.toUpperCase()}
      </Mono>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// BreakdownRow — one parameter of the selected score's breakdown
// ─────────────────────────────────────────────────────────────────────────

const BreakdownRow: React.FC<{
  parameter: string;
  rawValue: number | string | null;
  points: number;
}> = ({ parameter, rawValue, points }) => {
  const color = points >= 3 ? COLORS.crit : points >= 2 ? COLORS.warn : points >= 1 ? COLORS.info : COLORS.textMuted;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE.sm,
        padding: `6px ${SPACE.sm + 2}px`,
        background: points > 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
        borderTop: `1px solid ${COLORS.border}`,
      }}
    >
      <Mono tone={points > 0 ? 'secondary' : 'muted'} size="xs">
        {parameter}
      </Mono>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <Mono tone="dim" size="xs">
          {rawValue == null ? '—' : String(rawValue)}
        </Mono>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 22,
            height: 18,
            padding: '0 5px',
            background: points > 0 ? color + '22' : 'transparent',
            border: `1px solid ${points > 0 ? color : COLORS.border}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 10,
            fontWeight: 600,
            color: points > 0 ? color : COLORS.textMuted,
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          +{points}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VitalsPanel — the main export
// ─────────────────────────────────────────────────────────────────────────

export interface VitalsPanelProps {
  patient: Patient;
}

const formatBP = (v: Vital | undefined): string => {
  if (!v || v.systolic == null || v.diastolic == null) return '—';
  return `${v.systolic}/${v.diastolic}`;
};

const formatNum = (n: number | undefined | null, digits = 0): string => {
  if (n == null || Number.isNaN(n)) return '—';
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n));
};

/** Given a latest vital, derive a coarse display tone (ok / warn / crit). */
const hrTone = (v?: number): VitalTileProps['tone'] => {
  if (v == null) return 'default';
  if (v < 40 || v > 130) return 'crit';
  if (v < 50 || v > 110) return 'warn';
  return 'ok';
};
const sbpTone = (v?: number): VitalTileProps['tone'] => {
  if (v == null) return 'default';
  if (v <= 90 || v >= 220) return 'crit';
  if (v <= 100 || v >= 180) return 'warn';
  return 'ok';
};
const spo2Tone = (v?: number): VitalTileProps['tone'] => {
  if (v == null) return 'default';
  if (v <= 91) return 'crit';
  if (v <= 93) return 'warn';
  return 'ok';
};
const rrTone = (v?: number): VitalTileProps['tone'] => {
  if (v == null) return 'default';
  if (v <= 8 || v >= 25) return 'crit';
  if (v <= 11 || v >= 21) return 'warn';
  return 'ok';
};
const tempTone = (v?: number): VitalTileProps['tone'] => {
  if (v == null) return 'default';
  if (v <= 35 || v >= 39) return 'crit';
  if (v <= 36 || v >= 38) return 'warn';
  return 'ok';
};
const painTone = (v?: number): VitalTileProps['tone'] => {
  if (v == null) return 'default';
  if (v >= 8) return 'crit';
  if (v >= 5) return 'warn';
  return 'ok';
};

export const VitalsPanel: React.FC<VitalsPanelProps> = ({ patient }) => {
  const history = patient.vitalsHistory;
  const latest: Vital | undefined = history[history.length - 1];
  const hasData = !!latest;

  const [selectedScore, setSelectedScore] = useState<'MEWS' | 'NEWS2' | 'qSOFA'>('MEWS');

  const scores = useMemo(() => {
    if (!latest) return null;
    return {
      MEWS: computeMEWS(latest),
      NEWS2: computeNEWS2(latest),
      qSOFA: computeQSOFA(latest),
    };
  }, [latest]);

  const dominantRisk = useMemo(() => {
    if (!scores) return 'low';
    const order: EarlyWarningScore['risk'][] = ['low', 'moderate', 'high', 'critical'];
    return (
      [scores.MEWS, scores.NEWS2, scores.qSOFA].reduce<EarlyWarningScore['risk']>(
        (best, s) => (order.indexOf(s.risk) > order.indexOf(best) ? s.risk : best),
        'low' as EarlyWarningScore['risk'],
      )
    );
  }, [scores]);

  // Auto-select the worst-risk score so the breakdown opens on the
  // most actionable card. The user can still override with a tap.
  React.useEffect(() => {
    if (!scores) return;
    const order: EarlyWarningScore['risk'][] = ['low', 'moderate', 'high', 'critical'];
    const worst = ([ 'qSOFA', 'NEWS2', 'MEWS' ] as const).reduce<{ name: 'MEWS' | 'NEWS2' | 'qSOFA'; idx: number }>(
      (acc, name) => {
        const idx = order.indexOf(scores[name].risk);
        return idx > acc.idx ? { name, idx } : acc;
      },
      { name: 'MEWS', idx: -1 },
    );
    setSelectedScore(worst.name);
  }, [scores]);

  const selected = scores?.[selectedScore];
  const windowLabel = history.length > 0
    ? `${history.length} SETS · ${new Date(history[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${latest ? new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
    : 'NO DATA';

  return (
    <TacticalCard padding="none" style={{ marginBottom: SPACE.md }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACE.base}px ${SPACE.md}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surfaceElev,
          gap: SPACE.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
          <div
            style={{
              position: 'relative',
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              color: hasData ? riskColor(dominantRisk) : COLORS.textSecondary,
              flexShrink: 0,
            }}
          >
            <ActivitySquare size={12} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <Mono tone="muted" size="xs">
              PT.VITALS
            </Mono>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.textPrimary,
                letterSpacing: '-0.003em',
                lineHeight: 1.2,
              }}
            >
              Vital Signs · 24h
            </div>
          </div>
        </div>
        <BracketLabel tone="muted" size="xs">
          {windowLabel}
        </BracketLabel>
      </div>

      {/* Vital tiles row */}
      <div
        style={{
          display: 'grid',
          gap: SPACE.sm,
          padding: SPACE.md,
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        }}
      >
        <VitalTile
          label="HR"
          current={formatNum(latest?.heartRate)}
          unit="BPM"
          series={history.map((v) => v.heartRate)}
          tone={hrTone(latest?.heartRate)}
          icon={<Heart size={11} strokeWidth={2} color={COLORS.textMuted} />}
        />
        <VitalTile
          label="BP"
          current={formatBP(latest)}
          unit="MMHG"
          series={history.map((v) => v.systolic)}
          tone={sbpTone(latest?.systolic)}
        />
        <VitalTile
          label="SPO2"
          current={formatNum(latest?.spO2)}
          unit="%"
          series={history.map((v) => v.spO2)}
          tone={spo2Tone(latest?.spO2)}
          icon={<Wind size={11} strokeWidth={2} color={COLORS.textMuted} />}
        />
        <VitalTile
          label="RR"
          current={formatNum(latest?.respRate)}
          unit="/MIN"
          series={history.map((v) => v.respRate)}
          tone={rrTone(latest?.respRate)}
        />
        <VitalTile
          label="TEMP"
          current={formatNum(latest?.temperature, 1)}
          unit="°C"
          series={history.map((v) => v.temperature)}
          tone={tempTone(latest?.temperature)}
          icon={<Thermometer size={11} strokeWidth={2} color={COLORS.textMuted} />}
        />
        <VitalTile
          label="PAIN"
          current={formatNum(latest?.painScore)}
          unit="/10"
          series={history.map((v) => v.painScore)}
          tone={painTone(latest?.painScore)}
          icon={<Brain size={11} strokeWidth={2} color={COLORS.textMuted} />}
        />
      </div>

      {/* Score row */}
      {scores && selected && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
              padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            <FlaskConical size={12} strokeWidth={2} color={COLORS.textMuted} />
            <BracketLabel tone="muted" size="xs">
              EARLY WARNING · tap for breakdown
            </BracketLabel>
          </div>
          <div
            style={{
              display: 'flex',
              gap: SPACE.sm,
              padding: `0 ${SPACE.md}px ${SPACE.md}px`,
            }}
          >
            <ScoreChip score={scores.MEWS} active={selectedScore === 'MEWS'} onSelect={() => setSelectedScore('MEWS')} />
            <ScoreChip score={scores.NEWS2} active={selectedScore === 'NEWS2'} onSelect={() => setSelectedScore('NEWS2')} />
            <ScoreChip score={scores.qSOFA} active={selectedScore === 'qSOFA'} onSelect={() => setSelectedScore('qSOFA')} />
          </div>

          {/* Action row */}
          <div
            style={{
              padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
              background: COLORS.surfaceElev,
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: riskColor(selected.risk),
                boxShadow: `0 0 6px ${riskColor(selected.risk)}`,
                flexShrink: 0,
                animation: selected.risk === 'critical' ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
              }}
            />
            <Mono tone="secondary" size="xs" style={{ flex: 1, letterSpacing: '0.1em' }}>
              {selected.action}
            </Mono>
          </div>

          {/* Breakdown list */}
          <div style={{ background: COLORS.bgDeep }}>
            {selected.breakdown.map((row) => (
              <BreakdownRow
                key={row.parameter}
                parameter={row.parameter}
                rawValue={row.rawValue}
                points={row.points}
              />
            ))}
          </div>
        </>
      )}

      {!hasData && (
        <div style={{ padding: SPACE.lg, textAlign: 'center' }}>
          <Mono tone="muted" size="base">
            NO VITAL SIGNS ON FILE
          </Mono>
        </div>
      )}
    </TacticalCard>
  );
};

export default VitalsPanel;
