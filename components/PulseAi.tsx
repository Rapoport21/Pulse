/**
 * PulseAi — visual surfaces for the proactive-AI layer.
 *
 *   <AiBadge event=... />          inline tag on any item the AI handled
 *   <AiActivityStrip />            top-of-Horizon scrolling feed
 *   <AiActivityPanel />            full vertical feed for sidebars
 *
 * Reads from lib/pulseAI's PulseAiProvider. Colors:
 *
 *   AUTO           info (blue)   — AI did it itself
 *   NEEDS YOU      accent (rose) — proposal awaiting approval
 *   ESCALATED      warn (amber)  — critical, AI didn't act
 *   WATCHING       muted         — monitoring, no action yet
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, AlertTriangle, Eye, Activity } from 'lucide-react';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION,
  Mono, BracketLabel,
} from './design';
import {
  type AiActionKind,
  type AiActivityEvent,
  type AiSurface,
  usePulseAi,
  useAiActivity,
  formatAge,
  kindLabel,
} from '../lib/pulseAI';

// ════════════════════════════════════════════════════════════════
// Color + icon helpers
// ════════════════════════════════════════════════════════════════

const kindColor = (k: AiActionKind): string =>
  k === 'auto_executed'   ? COLORS.info
  : k === 'awaiting_review' ? COLORS.accent
  : k === 'escalated'      ? COLORS.warn
  : COLORS.textMuted;

const KindIcon: React.FC<{ kind: AiActionKind; size?: number }> = ({ kind, size = 10 }) => {
  if (kind === 'auto_executed')   return <Check size={size} strokeWidth={2.5} />;
  if (kind === 'awaiting_review') return <Sparkles size={size} strokeWidth={2.25} />;
  if (kind === 'escalated')       return <AlertTriangle size={size} strokeWidth={2.25} />;
  return <Eye size={size} strokeWidth={2} />;
};

// ════════════════════════════════════════════════════════════════
// AiBadge — inline tag on any item the AI handled
// ════════════════════════════════════════════════════════════════

interface AiBadgeProps {
  kind: AiActionKind;
  label?: string;
  reasoning?: string;
  size?: 'xs' | 'sm';
}

export const AiBadge: React.FC<AiBadgeProps> = ({ kind, label, reasoning, size = 'xs' }) => {
  const color = kindColor(kind);
  const sm = size === 'sm';
  return (
    <span
      title={reasoning}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: sm ? '3px 8px' : '2px 6px',
        background: `${color}1f`,
        border: `1px solid ${color}55`,
        borderRadius: RADIUS.full,
        fontFamily: FONTS.mono,
        fontSize: sm ? 10 : 9,
        fontWeight: 700,
        color,
        letterSpacing: '0.12em',
        cursor: reasoning ? 'help' : 'default',
      }}
    >
      <Sparkles size={sm ? 10 : 9} strokeWidth={2.25} />
      AI · {label ?? kindLabel(kind)}
    </span>
  );
};

// ════════════════════════════════════════════════════════════════
// AiActivityStrip — narrow scrolling strip, mounted at top of Horizon
// ════════════════════════════════════════════════════════════════

export const AiActivityStrip: React.FC = () => {
  const { events, counts } = usePulseAi();
  const recent = events.slice(0, 6);
  if (recent.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `2px solid ${COLORS.info}`,
        borderRadius: RADIUS.sm,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <motion.span
          aria-hidden
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 6,
            height: 6,
            borderRadius: RADIUS.full,
            background: COLORS.info,
            boxShadow: `0 0 6px ${COLORS.info}`,
          }}
        />
        <Mono size="xs" style={{ color: COLORS.info, fontWeight: 700, letterSpacing: '0.14em' }}>
          PULSE.AI · LIVE
        </Mono>
      </div>
      <div style={{ width: 1, height: 16, background: COLORS.border, flexShrink: 0 }} />
      <Mono tone="muted" size="xs" style={{ flexShrink: 0 }}>
        {counts.autoExecuted} auto · {counts.awaitingReview} review · {counts.escalated} escalated
      </Mono>
      <div style={{ width: 1, height: 16, background: COLORS.border, flexShrink: 0 }} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          display: 'flex',
          gap: SPACE.sm,
          whiteSpace: 'nowrap',
          maskImage:
            'linear-gradient(90deg, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
        }}
      >
        <AnimatePresence initial={false}>
          {recent.map((evt) => (
            <motion.div
              key={evt.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: MOTION.fast, ease: MOTION.easeSmooth }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: COLORS.bgDeep,
                border: `1px solid ${kindColor(evt.kind)}44`,
                borderRadius: RADIUS.full,
                flexShrink: 0,
              }}
            >
              <KindIcon kind={evt.kind} />
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 12,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.003em',
                  whiteSpace: 'nowrap',
                }}
              >
                {evt.title}
              </span>
              <Mono tone="dim" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatAge(Date.now() - evt.at)} ago
              </Mono>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// AiActivityPanel — full vertical feed (sidebar / Alerts / Staffing)
// ════════════════════════════════════════════════════════════════

interface AiActivityPanelProps {
  surface?: AiSurface;
  /** Optional cap on visible items. */
  limit?: number;
  /** Optional title override. */
  title?: string;
}

export const AiActivityPanel: React.FC<AiActivityPanelProps> = ({
  surface,
  limit = 8,
  title,
}) => {
  const { events } = usePulseAi();
  const list = surface ? events.filter((e) => e.surface === surface) : events;
  const visible = list.slice(0, limit);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          paddingBottom: SPACE.sm,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <Sparkles size={14} strokeWidth={2} color={COLORS.info} />
        <BracketLabel tone="primary" size="xs">
          {title ?? 'PULSE.AI ACTIVITY'}
        </BracketLabel>
        <div style={{ flex: 1 }} />
        <Mono tone="dim" size="xs">
          {list.length} events
        </Mono>
      </div>
      {visible.length === 0 ? (
        <Mono tone="dim" size="xs" style={{ padding: SPACE.md, textAlign: 'center' }}>
          NO AI ACTIVITY YET
        </Mono>
      ) : (
        <AnimatePresence initial={false}>
          {visible.map((evt) => (
            <AiActivityRow key={evt.id} evt={evt} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
};

const AiActivityRow: React.FC<{ evt: AiActivityEvent }> = ({ evt }) => {
  const color = kindColor(evt.kind);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: MOTION.fast }}
      style={{
        padding: SPACE.sm,
        background: COLORS.bgDeep,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
          marginBottom: 4,
        }}
      >
        <span style={{ color, display: 'inline-flex' }}>
          <KindIcon kind={evt.kind} />
        </span>
        <Mono size="xs" style={{ color, fontWeight: 700, letterSpacing: '0.12em' }}>
          {kindLabel(evt.kind)}
        </Mono>
        <Mono tone="muted" size="xs">
          · {evt.surface.toUpperCase()}
        </Mono>
        <div style={{ flex: 1 }} />
        <Mono
          tone="dim"
          size="xs"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatAge(Date.now() - evt.at)} ago
        </Mono>
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: COLORS.textPrimary,
          lineHeight: 1.4,
          letterSpacing: '-0.003em',
          marginBottom: evt.reasoning ? 4 : 0,
        }}
      >
        {evt.title}
      </div>
      {evt.reasoning && (
        <Mono tone="muted" size="xs" style={{ fontStyle: 'italic' }}>
          {evt.reasoning}
        </Mono>
      )}
    </motion.div>
  );
};

// Re-export the hook for surface-scoped use.
export { useAiActivity };
