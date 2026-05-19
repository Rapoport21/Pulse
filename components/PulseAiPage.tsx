/**
 * PulseAiPage — the dedicated PULSE AI surface (backlog #9).
 *
 * The showcase page for the autonomous-operations story: the full-size
 * Rehoboam orb, what the AI auto-executed vs escalated, the live
 * activity feed, cross-session memory status (#2.6 tie-in), confidence
 * mix, and a single primary CTA into the assistant.
 *
 * SEPARATE from PulseRadiant (the Horizon capacity radiant). This is
 * the AI's home; the radiant is untouched.
 */

import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  Mono,
  BracketLabel,
  TacticalCard,
  TacticalButton,
  Divider,
} from './design';
import { AiActivityPanel } from './PulseAi';
import { usePulseAi, kindLabel } from '../lib/pulseAI';
import type { AiActionKind } from '../lib/pulseAI';
import { loadAiMemory, loadPersistedState } from '../lib/persistence';

const RehoboamOrb = lazy(() => import('./RehoboamOrb'));

const kindColor = (k: AiActionKind): string =>
  k === 'auto_executed'
    ? COLORS.info
    : k === 'awaiting_review'
      ? COLORS.accent
      : k === 'escalated'
        ? COLORS.warn
        : COLORS.textMuted;

interface PulseAiPageProps {
  currentUser?: { name?: string } | null;
  /** Opens the existing assistant (App wires this to setShowChat). */
  onOpenAssistant?: () => void;
}

const KIND_ORDER: AiActionKind[] = [
  'auto_executed',
  'awaiting_review',
  'escalated',
  'monitoring',
];

export const PulseAiPage: React.FC<PulseAiPageProps> = ({
  currentUser,
  onOpenAssistant,
}) => {
  const { events, counts } = usePulseAi();

  const countFor = (k: AiActionKind): number =>
    k === 'auto_executed'
      ? counts.autoExecuted
      : k === 'awaiting_review'
        ? counts.awaitingReview
        : k === 'escalated'
          ? counts.escalated
          : counts.monitoring;

  const confidence = useMemo(() => {
    const c = { high: 0, med: 0, low: 0 };
    events.forEach((e) => {
      c[e.confidence] += 1;
    });
    return c;
  }, [events]);

  // Memory status — read once (localStorage, cheap). #2.6 tie-in.
  const [memory] = useState(() => {
    const ai = loadAiMemory();
    const state = loadPersistedState();
    return {
      messages: ai?.length ?? 0,
      stateKeys: state ? Object.keys(state.cache).length : 0,
    };
  });

  const sectionLabel: React.CSSProperties = {
    color: COLORS.textMuted,
  };

  return (
    <div
      style={{
        padding: SPACE.lg,
        // multidevice: 1280 read as a lost island once the 55" shell
        // scales up (big black gutters, audit B.2). 1760 stays a tidy
        // centered showcase on the iMac but fills the wall properly
        // after the large-format scale.
        maxWidth: 1760,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.lg,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <Sparkles size={16} color={COLORS.textSecondary} strokeWidth={2} />
        <BracketLabel size="sm" style={sectionLabel}>
          PULSE AI
        </BracketLabel>
        <Mono size="xs" style={{ color: COLORS.textDim }}>
          · autonomous operations layer{currentUser?.name ? ` · ${currentUser.name}` : ''}
        </Mono>
      </div>

      {/* Hero orb */}
      <TacticalCard padding="md">
        <Suspense
          fallback={
            <div
              style={{
                height: 420,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mono size="xs" style={{ color: COLORS.textDim }}>
                initialising Rehoboam…
              </Mono>
            </div>
          }
        >
          <RehoboamOrb surface="alerts" height={420} />
        </Suspense>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: SPACE.lg,
            marginTop: SPACE.sm,
          }}
        >
          <Mono size="xs" style={{ color: COLORS.textDim }}>
            {counts.total} active signals · live
          </Mono>
        </div>
      </TacticalCard>

      {/* KPI strip — auto vs needs-you vs escalated vs watching */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: SPACE.md,
        }}
      >
        {KIND_ORDER.map((k) => {
          const color = kindColor(k);
          return (
            <TacticalCard key={k} padding="md">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: RADIUS.full,
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
                <Mono size="xs" style={{ color: COLORS.textMuted }}>
                  {kindLabel(k)}
                </Mono>
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 26,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  lineHeight: 1,
                }}
              >
                {countFor(k)}
              </div>
            </TacticalCard>
          );
        })}
      </div>

      {/* Body: live feed + memory/confidence */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: SPACE.lg,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Mono size="xs" style={{ ...sectionLabel, display: 'block', marginBottom: SPACE.sm }}>
            LIVE ACTIVITY
          </Mono>
          <AiActivityPanel title="AI · ALL ACTIVITY" limit={10} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg, minWidth: 0 }}>
          {/* Memory */}
          <TacticalCard padding="md">
            <Mono size="xs" style={{ ...sectionLabel, display: 'block', marginBottom: SPACE.sm }}>
              CROSS-SESSION MEMORY
            </Mono>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 13,
                color: COLORS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {memory.messages > 0 || memory.stateKeys > 0 ? (
                <>
                  Active. <strong style={{ color: COLORS.textPrimary }}>{memory.messages}</strong>{' '}
                  remembered assistant message{memory.messages === 1 ? '' : 's'} ·{' '}
                  <strong style={{ color: COLORS.textPrimary }}>{memory.stateKeys}</strong>{' '}
                  persisted demo state key{memory.stateKeys === 1 ? '' : 's'}.
                </>
              ) : (
                <>No saved memory yet. It will persist once you interact.</>
              )}
            </div>
            <Mono size="xs" style={{ color: COLORS.textDim, display: 'block', marginTop: SPACE.sm }}>
              Wipe via Settings · Reset &amp; Wipe Memory
            </Mono>
          </TacticalCard>

          {/* Confidence mix */}
          <TacticalCard padding="md">
            <Mono size="xs" style={{ ...sectionLabel, display: 'block', marginBottom: SPACE.sm }}>
              CONFIDENCE MIX
            </Mono>
            {(['high', 'med', 'low'] as const).map((lvl) => {
              const n = confidence[lvl];
              const pct = events.length ? Math.round((n / events.length) * 100) : 0;
              return (
                <div key={lvl} style={{ marginBottom: SPACE.sm }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 3,
                    }}
                  >
                    <Mono size="xs" style={{ color: COLORS.textMuted }}>
                      {lvl.toUpperCase()}
                    </Mono>
                    <Mono size="xs" style={{ color: COLORS.textSecondary }}>
                      {n} · {pct}%
                    </Mono>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: COLORS.border,
                      borderRadius: RADIUS.full,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background:
                          lvl === 'high'
                            ? COLORS.ok
                            : lvl === 'med'
                              ? COLORS.textSecondary
                              : COLORS.textMuted,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </TacticalCard>

          <Divider variant="dashed" />

          {/* Single primary CTA (allowed rose focal point per #6) */}
          <TacticalButton
            variant="primary"
            fullWidth
            size="md"
            icon={<MessageSquare size={14} strokeWidth={2} />}
            onClick={() => onOpenAssistant?.()}
          >
            Talk to PULSE AI
          </TacticalButton>
        </div>
      </div>
    </div>
  );
};
