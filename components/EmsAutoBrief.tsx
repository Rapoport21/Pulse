/**
 * EmsAutoBrief — "AI handoff brief" auto-generated for inbound EMS.
 *
 * 2026-04-22 · Demo magic moment. When an EMS run crosses ETA 2:00,
 * a card slides in top-right with a "GENERATING HANDOFF BRIEF…"
 * shimmer that resolves into a one-line trauma-bay handoff prep.
 *
 * NO LLM IS CALLED. The brief is composed deterministically from the
 * run's real fields (age, sex, chief complaint, field vitals, field
 * treatment, destination bay) plus scenario context. The shimmer +
 * typewriter make it FEEL generated. For demo purposes only.
 *
 * If we ever want this to actually call Claude, swap composeBrief()
 * for an async fetch — the rest of the orchestration stays the same.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useEmsInbound, type EmsInboundLive } from '../lib/emsLive';
import type { ScenarioState } from '../lib/scenario';
import { COLORS, FONTS, SPACE, RADIUS, SHADOW, Z } from './design';

const BRIEF_TRIGGER_S = 120;        // fire when ETA crosses 2:00
const TYPING_INTERVAL_MS = 22;
const CHARS_PER_TICK = 2;
const GENERATING_PHASE_MS = 720;
const BRIEF_HOLD_MS = 11_000;
const MAX_VISIBLE = 2;

type ActivationLevel = NonNullable<EmsInboundLive['activationLevel']>;

// Activation-level → narrative phrasing
const ACTIVATION_PHRASE: Record<ActivationLevel, string> = {
  TRAUMA_1: 'Trauma 1 — polytrauma',
  TRAUMA_2: 'Trauma 2 — secondary survey',
  STEMI:    'Anterior STEMI — door-to-balloon clock running',
  STROKE:   'Code Stroke — tPA window open',
  SEPSIS:   'Septic shock — pressors initiated',
  NONE:     'Routine transport',
};

const ACTIVATION_BAY: Record<ActivationLevel, string> = {
  TRAUMA_1: 'Trauma Bay 1 staged',
  TRAUMA_2: 'Trauma Bay 2 staged',
  STEMI:    'Cath lab activated',
  STROKE:   'CT stroke protocol staged',
  SEPSIS:   'ED Bay 12 — sepsis bundle in',
  NONE:     'Triage on arrival',
};

// Per-severity scenario modifier appended at end of brief
const SCENARIO_TAIL = (severity: 1 | 2 | 3 | undefined, level: ActivationLevel): string => {
  if (severity === 3) {
    if (level === 'TRAUMA_1' || level === 'TRAUMA_2') return ' · MTP active · OR 2 holding';
    if (level === 'STEMI') return ' · cath holding for surge · MTP off';
    if (level === 'STROKE') return ' · neuro on the floor · CT delayed for trauma';
    if (level === 'SEPSIS') return ' · bundle stalled by MCI demand';
    return ' · MCI active';
  }
  if (severity === 2) {
    if (level === 'STROKE') return ' · neuro paged · CT 1 reserved';
    if (level === 'STEMI') return ' · cath team on the floor';
    if (level === 'TRAUMA_1' || level === 'TRAUMA_2') return ' · float pool warm';
    if (level === 'SEPSIS') return ' · pharmacy bundle ready';
    return '';
  }
  return ''; // S1 / no scenario — keep clean
};

const composeBrief = (run: EmsInboundLive, scenario: ScenarioState | null): string => {
  const lvl: ActivationLevel = run.activationLevel ?? 'NONE';
  const demo = run.age != null && run.sex
    ? `${run.age}${run.sex.charAt(0).toUpperCase()}`
    : 'Adult';
  const phrase = ACTIVATION_PHRASE[lvl];
  const cc = run.chiefComplaint?.trim() || 'Field assessment pending';
  const vitals = (() => {
    const fv = run.fieldVitals;
    if (!fv) return null;
    const parts: string[] = [];
    if (fv.gcs != null) parts.push(`GCS ${fv.gcs}`);
    if (fv.systolic != null) parts.push(`BP ${fv.systolic}/${fv.diastolic ?? '—'}`);
    if (fv.spO2 != null) parts.push(`SpO₂ ${fv.spO2}%`);
    return parts.length > 0 ? parts.join(' · ') : null;
  })();
  const treatment = run.fieldTreatment?.trim();
  const bay = run.destinationBay ? `${run.destinationBay} staged` : ACTIVATION_BAY[lvl];
  const tail = SCENARIO_TAIL(scenario?.severity, lvl);

  const sentences: string[] = [];
  sentences.push(`${demo} · ${phrase}.`);
  sentences.push(`${cc}.`);
  if (vitals) sentences.push(`${vitals}.`);
  if (treatment) sentences.push(`${treatment}.`);
  sentences.push(`${bay}${tail}.`);

  return sentences.join(' ');
};

const toneFor = (level: ActivationLevel): string => {
  if (level === 'TRAUMA_1' || level === 'STEMI' || level === 'STROKE') return COLORS.crit;
  if (level === 'TRAUMA_2' || level === 'SEPSIS') return COLORS.warn;
  return COLORS.info;
};

interface ActiveBrief {
  runId: string;
  unit: string;
  activation: ActivationLevel;
  text: string;
  shownAt: number;
  generating: boolean;
  typedChars: number;
}

export const EmsAutoBrief: React.FC<{
  activeScenario: ScenarioState | null;
  enabled?: boolean;
}> = ({ activeScenario, enabled = true }) => {
  const { inbound } = useEmsInbound();
  const [briefs, setBriefs] = useState<ActiveBrief[]>([]);
  const briefedRef = useRef<Set<string>>(new Set());

  // Detect runs crossing the 2:00 threshold
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    inbound.forEach((r) => {
      if (briefedRef.current.has(r.id)) return;
      if (r.arrived) return;
      if (r.etaSeconds <= BRIEF_TRIGGER_S && r.etaSeconds > 0) {
        briefedRef.current.add(r.id);
        const text = composeBrief(r, activeScenario);
        setBriefs((prev) => [
          ...prev,
          {
            runId: r.id,
            unit: r.unit ?? 'EMS',
            activation: r.activationLevel ?? 'NONE',
            text,
            shownAt: now,
            generating: true,
            typedChars: 0,
          },
        ]);
      }
    });
  }, [inbound, activeScenario, enabled]);

  // Drive the generating shimmer + typewriter + auto-dismiss
  useEffect(() => {
    if (briefs.length === 0) return;
    const id = window.setInterval(() => {
      setBriefs((prev) => {
        const t = Date.now();
        return prev
          .map((b) => {
            if (b.generating && t - b.shownAt > GENERATING_PHASE_MS) {
              return { ...b, generating: false };
            }
            if (!b.generating && b.typedChars < b.text.length) {
              return { ...b, typedChars: Math.min(b.text.length, b.typedChars + CHARS_PER_TICK) };
            }
            return b;
          })
          .filter((b) => t - b.shownAt < BRIEF_HOLD_MS);
      });
    }, TYPING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [briefs.length > 0]);

  // Don't render anything when there's nothing to show
  if (briefs.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes ems-brief-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes ems-brief-cursor {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes ems-brief-shimmer {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes ems-brief-spark {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.7; }
        }
        .ems-brief-card { pointer-events: auto; }
      `}</style>
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 96,
          right: SPACE.lg,
          zIndex: Z.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.md,
          maxWidth: 'calc(100vw - 32px)',
          width: 380,
          pointerEvents: 'none',
        }}
      >
        {briefs.slice(0, MAX_VISIBLE).map((brief) => (
          <BriefCard
            key={brief.runId}
            brief={brief}
            onDismiss={() =>
              setBriefs((prev) => prev.filter((b) => b.runId !== brief.runId))
            }
          />
        ))}
      </div>
    </>
  );
};

const BriefCard: React.FC<{ brief: ActiveBrief; onDismiss: () => void }> = ({
  brief,
  onDismiss,
}) => {
  const tone = toneFor(brief.activation);
  const visibleText = brief.text.slice(0, brief.typedChars);
  const typingDone = brief.typedChars >= brief.text.length;

  return (
    <div
      className="ems-brief-card"
      style={{
        background: COLORS.surfaceElev,
        border: `1px solid ${COLORS.borderStrong}`,
        borderLeft: `2px solid ${tone}`,
        borderRadius: RADIUS.sm,
        padding: SPACE.md,
        boxShadow: SHADOW.panel,
        animation: 'ems-brief-slide-in 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: FONTS.sans,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          marginBottom: SPACE.sm,
        }}
      >
        <Sparkles
          size={12}
          strokeWidth={2}
          color={tone}
          style={{ animation: brief.generating ? 'ems-brief-spark 0.9s ease-in-out infinite' : 'none' }}
        />
        <span
          style={{
            flex: 1,
            fontFamily: FONTS.mono,
            fontSize: 10,
            letterSpacing: '0.16em',
            color: COLORS.textSecondary,
            textTransform: 'uppercase',
          }}
        >
          Incoming handoff · {brief.unit} · {brief.activation.replace('_', '-')}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss brief"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: COLORS.textMuted,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>

      {/* Body — generating shimmer → typewriter */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: COLORS.textPrimary,
          minHeight: 38,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {brief.generating ? (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: COLORS.textSecondary,
              animation: 'ems-brief-shimmer 1.1s ease-in-out infinite',
            }}
          >
            ▶ Generating handoff brief…
          </span>
        ) : (
          <>
            {visibleText}
            {!typingDone && (
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 12,
                  background: tone,
                  marginLeft: 2,
                  verticalAlign: 'text-bottom',
                  animation: 'ems-brief-cursor 800ms steps(2) infinite',
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Tiny attribution — keeps it honest while still demoable */}
      {!brief.generating && typingDone && (
        <div
          style={{
            marginTop: SPACE.sm,
            paddingTop: SPACE.sm,
            borderTop: `1px solid ${COLORS.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
          }}
        >
          <span>Pulse Copilot</span>
          <span>auto · 2:00 trigger</span>
        </div>
      )}
    </div>
  );
};
