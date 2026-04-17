/**
 * PatientHeaderStrip — the safety-critical chart banner that sits at the
 * top of every patient view.
 *
 * Renders the five data points a clinician must see before making any
 * decision:
 *
 *   1. Identity — MRN, name, sex, age, weight
 *   2. Code status — FULL / DNR / DNI / COMFORT (big, unambiguous)
 *   3. Isolation precaution — CONTACT / DROPLET / AIRBORNE / PROTECTIVE
 *   4. Allergies — red alert if any "high" severity, otherwise a NKA pill
 *   5. Highest-risk early warning score — MEWS / NEWS2 / qSOFA tile
 *
 * These are the "never-miss" items from Joint Commission's Patient
 * Safety Goals. This strip is deliberately dense and tactical — no
 * collapses, no hover-reveal — so the clinician sees the safety header
 * at a glance without any interaction.
 *
 * Derived, not stored: the displayed score is computed from the latest
 * Vital set in `patient.vitalsHistory`. If there is no vital data, the
 * score tile shows "—" with a "NO DATA" pill.
 */

import React from 'react';
import { AlertTriangle, Biohazard, FileHeart, Languages, Shield, ShieldAlert } from 'lucide-react';
import type { Patient, EarlyWarningScore, Allergy } from '../../types';
import { computeAllScores } from '../../lib/clinicalScores';
import { ageInYears } from '../../data/clinicalMock';
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
// Tone helpers
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

const riskOrder: EarlyWarningScore['risk'][] = ['low', 'moderate', 'high', 'critical'];

/** Return the score with the highest risk bucket. Ties break by value. */
const pickDominantScore = (scores: EarlyWarningScore[]): EarlyWarningScore => {
  return scores.reduce((best, s) => {
    const bi = riskOrder.indexOf(best.risk);
    const si = riskOrder.indexOf(s.risk);
    if (si > bi) return s;
    if (si === bi && s.value > best.value) return s;
    return best;
  }, scores[0]);
};

/** Colour + label for a code status. */
const codeStatusMeta = (code: Patient['codeStatus']): { color: string; bg: string } => {
  switch (code) {
    case 'DNR':
    case 'DNI':
    case 'DNR/DNI':
      return { color: COLORS.accent, bg: 'rgba(225,29,72,0.08)' };
    case 'COMFORT':
      return { color: COLORS.info, bg: 'rgba(59,130,246,0.08)' };
    case 'LIMITED':
      return { color: COLORS.warn, bg: 'rgba(245,158,11,0.08)' };
    case 'FULL':
      return { color: COLORS.ok, bg: 'rgba(16,185,129,0.06)' };
    case 'UNKNOWN':
    default:
      return { color: COLORS.textMuted, bg: COLORS.surface };
  }
};

/** Colour + label for an isolation precaution. */
const isolationMeta = (iso: Patient['isolation']): {
  color: string;
  bg: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
} => {
  switch (iso) {
    case 'CONTACT':
      return { color: COLORS.warn, bg: 'rgba(245,158,11,0.08)', label: 'CONTACT ISO', Icon: Shield };
    case 'DROPLET':
      return { color: COLORS.info, bg: 'rgba(59,130,246,0.08)', label: 'DROPLET ISO', Icon: ShieldAlert };
    case 'AIRBORNE':
      return { color: COLORS.crit, bg: 'rgba(239,68,68,0.08)', label: 'AIRBORNE ISO', Icon: Biohazard };
    case 'PROTECTIVE':
      return { color: COLORS.info, bg: 'rgba(59,130,246,0.08)', label: 'PROTECTIVE ISO', Icon: Shield };
    case 'NONE':
    default:
      return { color: COLORS.textMuted, bg: COLORS.surface, label: 'NO ISO', Icon: Shield };
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Chip primitive — small bordered pill used for code/iso/lang
// ─────────────────────────────────────────────────────────────────────────

const InfoChip: React.FC<{
  label: string;
  color: string;
  background: string;
  icon?: React.ReactNode;
  emphasise?: boolean;
}> = ({ label, color, background, icon, emphasise = false }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: `5px ${emphasise ? 10 : 8}px`,
      background,
      border: `1px solid ${color}`,
      borderRadius: RADIUS.sm,
      fontFamily: FONTS.mono,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color,
      whiteSpace: 'nowrap',
      boxShadow: emphasise ? `0 0 12px ${color}33` : 'none',
      lineHeight: 1,
    }}
  >
    {icon}
    {label}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────
// Allergy row — scrollable chip strip, red if any critical
// ─────────────────────────────────────────────────────────────────────────

const allergyEmphasis = (a: Allergy) => a.severity === 'high';

const AllergyStrip: React.FC<{ allergies: Allergy[] }> = ({ allergies }) => {
  if (allergies.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: 'rgba(16,185,129,0.06)',
          border: `1px solid ${COLORS.ok}`,
          borderRadius: RADIUS.sm,
        }}
      >
        <Shield size={16} strokeWidth={2} color={COLORS.ok} />
        <Mono tone="ok" size="base">
          NKA · No Known Allergies
        </Mono>
      </div>
    );
  }

  const hasCritical = allergies.some(allergyEmphasis);
  const borderColor = hasCritical ? COLORS.accent : COLORS.warn;
  const icon = hasCritical ? (
    <AlertTriangle size={16} strokeWidth={2.5} color={borderColor} />
  ) : (
    <AlertTriangle size={16} strokeWidth={2} color={borderColor} />
  );

  return (
    <div
      style={{
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: hasCritical ? 'rgba(225,29,72,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <Mono tone={hasCritical ? 'accent' : 'warn'} size="base">
          ALLERGIES · {allergies.length}
        </Mono>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {allergies.map((a) => {
          const crit = allergyEmphasis(a);
          return (
            <span
              key={a.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                background: crit ? 'rgba(225,29,72,0.1)' : COLORS.bgDeep,
                border: `1px solid ${crit ? COLORS.accent : COLORS.border}`,
                borderRadius: RADIUS.sm,
                fontFamily: FONTS.sans,
                fontSize: 15,
                fontWeight: 600,
                color: crit ? COLORS.accent : COLORS.textPrimary,
                lineHeight: 1.2,
                boxShadow: crit ? `0 0 8px ${COLORS.accentGlow}` : 'none',
              }}
            >
              {a.substance}
              <Mono
                tone={crit ? 'accent' : 'muted'}
                size="xs"
                style={{ letterSpacing: '0.1em' }}
              >
                · {a.reaction}
              </Mono>
              {crit && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: COLORS.accent,
                    animation: 'pulse-dot 1.4s ease-in-out infinite',
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Score tile — dominant early warning score with ring indicator
// ─────────────────────────────────────────────────────────────────────────

const ScoreTile: React.FC<{ score: EarlyWarningScore | null }> = ({ score }) => {
  if (!score) {
    return (
      <div
        style={{
          position: 'relative',
          minWidth: 140,
          padding: `${SPACE.md}px ${SPACE.base}px`,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Mono tone="muted" size="xs">
          EARLY WARNING
        </Mono>
        <Mono tone="dim" size="base">
          NO DATA
        </Mono>
      </div>
    );
  }
  const color = riskColor(score.risk);
  return (
    <div
      style={{
        position: 'relative',
        minWidth: 150,
        padding: `${SPACE.md}px ${SPACE.base}px`,
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: RADIUS.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: score.risk === 'critical' ? `0 0 16px ${color}40` : 'none',
      }}
    >
      <CornerBracket position="tl" color={color} size={5} thickness={1} inset={-1} />
      <CornerBracket position="tr" color={color} size={5} thickness={1} inset={-1} />
      <CornerBracket position="bl" color={color} size={5} thickness={1} inset={-1} />
      <CornerBracket position="br" color={color} size={5} thickness={1} inset={-1} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
        }}
      >
        <Mono tone="muted" size="xs">
          EARLY WARNING
        </Mono>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animation: score.risk === 'critical' ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <Mono tone="secondary" size="base">
          {score.name}
        </Mono>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 38,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score.value}
        </span>
        <Mono tone="dim" size="xs">
          /{score.maxValue}
        </Mono>
      </div>
      <Mono tone="muted" size="xs" style={{ letterSpacing: '0.14em' }}>
        {score.risk.toUpperCase()}
      </Mono>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// PatientHeaderStrip — the main export
// ─────────────────────────────────────────────────────────────────────────

export interface PatientHeaderStripProps {
  patient: Patient;
  /** Optional — if present, overrides the auto-picked dominant score. */
  pinnedScore?: 'MEWS' | 'NEWS2' | 'qSOFA';
}

export const PatientHeaderStrip: React.FC<PatientHeaderStripProps> = ({
  patient,
  pinnedScore,
}) => {
  // Compute the three scores from the latest vital set. If no vitals
  // are on file we render a "no data" score tile.
  const latestVital = patient.vitalsHistory[patient.vitalsHistory.length - 1];
  const dominant = React.useMemo(() => {
    if (!latestVital) return null;
    const { mews, news2, qsofa } = computeAllScores(latestVital);
    if (pinnedScore === 'MEWS') return mews;
    if (pinnedScore === 'NEWS2') return news2;
    if (pinnedScore === 'qSOFA') return qsofa;
    return pickDominantScore([mews, news2, qsofa]);
  }, [latestVital, pinnedScore]);

  const age = ageInYears(patient.birthDate);
  const nameDisplay = `${patient.name.family.toUpperCase()}, ${patient.name.given}`;
  const codeMeta = codeStatusMeta(patient.codeStatus);
  const isoMeta = isolationMeta(patient.isolation);
  const encounter = patient.currentEncounter;

  return (
    <TacticalCard padding="none" style={{ marginBottom: SPACE.lg }}>
      {/* Row 1 — identity band */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: SPACE.base,
          padding: SPACE.base,
          borderBottom: `1px solid ${COLORS.border}`,
          background: `linear-gradient(180deg, ${COLORS.surfaceElev} 0%, ${COLORS.surface} 100%)`,
        }}
      >
        {/* Identity cluster */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <BracketLabel tone="muted" size="xs">
              PT · {patient.mrn}
            </BracketLabel>
            {encounter?.id && <Mono tone="dim" size="xs">CSN {encounter.id}</Mono>}
            {encounter?.esi && (
              <Mono
                size="xs"
                style={{
                  letterSpacing: '0.16em',
                  color:
                    encounter.esi <= 2 ? COLORS.accent : encounter.esi === 3 ? COLORS.warn : COLORS.ok,
                }}
              >
                ESI {encounter.esi}
              </Mono>
            )}
          </div>

          <h2
            style={{
              margin: 0,
              fontFamily: FONTS.sans,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.textPrimary,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              wordBreak: 'break-word',
            }}
          >
            {nameDisplay}
          </h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Mono tone="secondary" size="base">
              {age}
              {patient.sex}
            </Mono>
            {patient.weightKg && (
              <Mono tone="muted" size="base">
                · {Math.round(patient.weightKg)}KG
              </Mono>
            )}
            {patient.heightCm && (
              <Mono tone="muted" size="base">
                · {patient.heightCm}CM
              </Mono>
            )}
            {encounter?.location?.zone && (
              <Mono tone="muted" size="base">
                · {encounter.location.zone.toUpperCase()}
                {encounter.location.bed ? ` ${encounter.location.bed}` : ''}
              </Mono>
            )}
          </div>

          {encounter?.chiefComplaint && (
            <p
              style={{
                margin: 0,
                marginTop: 2,
                fontFamily: FONTS.sans,
                fontSize: 16,
                lineHeight: 1.45,
                color: COLORS.textSecondary,
                maxWidth: 560,
              }}
            >
              <span style={{ color: COLORS.textMuted }}>CC · </span>
              {encounter.chiefComplaint}
            </p>
          )}
        </div>

        {/* Score tile */}
        <ScoreTile score={dominant} />
      </div>

      {/* Row 2 — safety chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          padding: `${SPACE.sm + 2}px ${SPACE.base}px`,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <InfoChip
          label={patient.codeStatus === 'FULL' ? 'FULL CODE' : patient.codeStatus}
          color={codeMeta.color}
          background={codeMeta.bg}
          icon={<FileHeart size={14} strokeWidth={2} color={codeMeta.color} />}
          emphasise={patient.codeStatus !== 'FULL'}
        />
        <InfoChip
          label={isoMeta.label}
          color={isoMeta.color}
          background={isoMeta.bg}
          icon={<isoMeta.Icon size={14} strokeWidth={2} color={isoMeta.color} />}
          emphasise={patient.isolation !== 'NONE'}
        />
        <InfoChip
          label={
            patient.needsInterpreter
              ? `${patient.preferredLanguage.toUpperCase()} · INT REQ`
              : patient.preferredLanguage.toUpperCase()
          }
          color={patient.needsInterpreter ? COLORS.warn : COLORS.textMuted}
          background={patient.needsInterpreter ? 'rgba(245,158,11,0.08)' : COLORS.surface}
          icon={
            <Languages
              size={14}
              strokeWidth={2}
              color={patient.needsInterpreter ? COLORS.warn : COLORS.textMuted}
            />
          }
          emphasise={patient.needsInterpreter === true}
        />
        {patient.advanceDirective && (
          <InfoChip
            label="AD / POLST"
            color={COLORS.info}
            background="rgba(59,130,246,0.08)"
            icon={<FileHeart size={14} strokeWidth={2} color={COLORS.info} />}
          />
        )}
        {patient.problems.length > 0 && (
          <Mono tone="muted" size="xs" style={{ marginLeft: 'auto' }}>
            PROBLEMS · {patient.problems.length}
          </Mono>
        )}
      </div>

      {/* Row 3 — allergies */}
      <div style={{ padding: SPACE.base }}>
        <AllergyStrip allergies={patient.allergies} />
      </div>
    </TacticalCard>
  );
};

export default PatientHeaderStrip;
