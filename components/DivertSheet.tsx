/**
 * DivertSheet — ambulance-diversion overlay.
 *
 * Implements the 5-step charge-nurse / physician decision flow from
 * the research (sprint plan 2026-05-14, §1.1):
 *
 *   1. Check internal resources  (auto-populated checklist)
 *   2. Pick tier                 (Critical-care bypass / Redirect)
 *   3. Set duration              (2h / 4h / custom up to 8h)
 *   4. Notify                    (EMS · neighbor EDs · house sup · admin)
 *   5. Confirm
 *
 * On confirm, the parent receives a DivertActivation payload. The
 * banner / countdown across the top HUD lives in the parent.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Ambulance, ShieldAlert, AlertTriangle, Check, ChevronRight, Clock,
} from 'lucide-react';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION, Z,
  Mono, BracketLabel, CornerBracket, StatusPill, TacticalButton,
} from './design';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

export type DivertTier = 'bypass' | 'redirect';

export interface DivertActivation {
  tier: DivertTier;
  durationMin: number;
  notify: {
    emsDispatch: boolean;
    neighborEDs: boolean;
    houseSup: boolean;
    adminOnCall: boolean;
    medControl: boolean;
  };
  preChecks: {
    hallwayBedsOpen: boolean;
    dischargesExpedited: boolean;
    floatPoolPaged: boolean;
    houseSupPaged: boolean;
  };
  startedAt: number;
}

interface DivertSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (activation: DivertActivation) => void;
  /** Optional initial pre-fill from current PULSE data. */
  preChecks?: Partial<DivertActivation['preChecks']>;
}

// ════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════

const STEP_LABELS = [
  'INTERNAL CHECKS',
  'TIER',
  'DURATION',
  'NOTIFY',
  'CONFIRM',
];

export const DivertSheet: React.FC<DivertSheetProps> = ({
  open,
  onClose,
  onConfirm,
  preChecks,
}) => {
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState({
    hallwayBedsOpen: preChecks?.hallwayBedsOpen ?? false,
    dischargesExpedited: preChecks?.dischargesExpedited ?? false,
    floatPoolPaged: preChecks?.floatPoolPaged ?? false,
    houseSupPaged: preChecks?.houseSupPaged ?? false,
  });
  const [tier, setTier] = useState<DivertTier>('redirect');
  const [duration, setDuration] = useState(120);
  const [notify, setNotify] = useState({
    emsDispatch: true,
    neighborEDs: true,
    houseSup: true,
    adminOnCall: false,
    medControl: false,
  });

  const reset = () => {
    setStep(0);
    setChecks({
      hallwayBedsOpen: preChecks?.hallwayBedsOpen ?? false,
      dischargesExpedited: preChecks?.dischargesExpedited ?? false,
      floatPoolPaged: preChecks?.floatPoolPaged ?? false,
      houseSupPaged: preChecks?.houseSupPaged ?? false,
    });
    setTier('redirect');
    setDuration(120);
    setNotify({
      emsDispatch: true,
      neighborEDs: true,
      houseSup: true,
      adminOnCall: false,
      medControl: false,
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({
      tier,
      durationMin: duration,
      notify,
      preChecks: checks,
      startedAt: Date.now(),
    });
    reset();
  };

  const canAdvance =
    step === 0 ? Object.values(checks).filter(Boolean).length >= 2
    : step === 1 ? !!tier
    : step === 2 ? duration > 0
    : step === 3 ? Object.values(notify).some(Boolean)
    : true;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              zIndex: Z.overlay,
            }}
          />
          <motion.div
            initial={{ y: '8%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '8%', opacity: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.easeSmooth }}
            role="dialog"
            aria-label="Ambulance diversion"
            style={{
              position: 'fixed',
              inset: '40px clamp(20px, 8vw, 96px)',
              zIndex: Z.modal,
              background: COLORS.bg,
              border: `1px solid ${COLORS.accent}`,
              borderRadius: RADIUS.sm,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
              fontFamily: FONTS.sans,
              overflow: 'hidden',
            }}
          >
            <CornerBracket position="tl" color={COLORS.accent} size={10} thickness={2} />
            <CornerBracket position="tr" color={COLORS.accent} size={10} thickness={2} />
            <CornerBracket position="bl" color={COLORS.accent} size={10} thickness={2} />
            <CornerBracket position="br" color={COLORS.accent} size={10} thickness={2} />

            {/* Header */}
            <div
              style={{
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
              }}
            >
              <Ambulance size={18} strokeWidth={2} color={COLORS.accent} />
              <BracketLabel tone="accent" size="sm">
                AMBULANCE DIVERSION
              </BracketLabel>
              <Mono tone="dim" size="xs">
                · STEP {step + 1} OF {STEP_LABELS.length}
              </Mono>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cancel diversion flow"
                style={{
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: COLORS.textSecondary,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Step ticker */}
            <div
              style={{
                display: 'flex',
                gap: SPACE.xs,
                padding: `${SPACE.sm}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              {STEP_LABELS.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: RADIUS.sm,
                      background: active ? `${COLORS.accent}1f` : 'transparent',
                      border: `1px solid ${active ? COLORS.accent : done ? COLORS.borderStrong : COLORS.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    {done && <Check size={10} strokeWidth={2.5} color={COLORS.ok} />}
                    <Mono
                      size="xs"
                      style={{
                        color: active ? COLORS.accent : done ? COLORS.ok : COLORS.textMuted,
                        letterSpacing: '0.14em',
                        fontWeight: active ? 700 : 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {label}
                    </Mono>
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: SPACE.lg,
              }}
            >
              {step === 0 && (
                <StepInternalChecks checks={checks} onChange={setChecks} />
              )}
              {step === 1 && (
                <StepTier tier={tier} onChange={setTier} />
              )}
              {step === 2 && (
                <StepDuration duration={duration} onChange={setDuration} tier={tier} />
              )}
              {step === 3 && (
                <StepNotify notify={notify} onChange={setNotify} />
              )}
              {step === 4 && (
                <StepConfirm
                  tier={tier}
                  duration={duration}
                  notify={notify}
                  checks={checks}
                />
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderTop: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
              }}
            >
              <TacticalButton
                variant="ghost"
                size="sm"
                onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </TacticalButton>
              <div style={{ flex: 1 }} />
              {step < STEP_LABELS.length - 1 ? (
                <TacticalButton
                  variant="primary"
                  size="sm"
                  icon={<ChevronRight size={12} strokeWidth={2.5} />}
                  onClick={() => canAdvance && setStep(step + 1)}
                  disabled={!canAdvance}
                >
                  Continue
                </TacticalButton>
              ) : (
                <TacticalButton
                  variant="danger"
                  size="sm"
                  icon={<ShieldAlert size={12} strokeWidth={2.5} />}
                  onClick={handleConfirm}
                >
                  Activate diversion
                </TacticalButton>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ════════════════════════════════════════════════════════════════
// Steps
// ════════════════════════════════════════════════════════════════

const StepInternalChecks: React.FC<{
  checks: DivertActivation['preChecks'];
  onChange: (c: DivertActivation['preChecks']) => void;
}> = ({ checks, onChange }) => {
  const toggle = (k: keyof DivertActivation['preChecks']) =>
    onChange({ ...checks, [k]: !checks[k] });
  const items: Array<{ key: keyof DivertActivation['preChecks']; label: string; detail: string }> = [
    { key: 'hallwayBedsOpen', label: 'Hallway beds open', detail: 'Auxiliary space available for ED holds' },
    { key: 'dischargesExpedited', label: 'Discharges expedited', detail: 'House sup confirmed candidate IDs' },
    { key: 'floatPoolPaged', label: 'Float pool paged', detail: 'No additional RNs available within 2h' },
    { key: 'houseSupPaged', label: 'House supervisor consulted', detail: 'Sup aware and supports the request' },
  ];
  const completed = items.filter((i) => checks[i.key]).length;
  return (
    <div>
      <SectionTitle title="Internal-resource checks" detail="Diversion is the last resort. Confirm internal options exhausted before requesting EMS bypass." />
      <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
        {completed} of {items.length} confirmed · need at least 2 to continue
      </Mono>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {items.map((it) => (
          <CheckRow
            key={it.key}
            checked={checks[it.key]}
            onToggle={() => toggle(it.key)}
            label={it.label}
            detail={it.detail}
          />
        ))}
      </div>
    </div>
  );
};

const StepTier: React.FC<{
  tier: DivertTier;
  onChange: (t: DivertTier) => void;
}> = ({ tier, onChange }) => (
  <div>
    <SectionTitle title="Pick diversion tier" detail="Two tiers. Bypass is the harder posture and should be used only when even one more critical patient would compromise care." />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: SPACE.md, marginTop: SPACE.md }}>
      <TierCard
        active={tier === 'redirect'}
        onClick={() => onChange('redirect')}
        title="Redirect"
        tone={COLORS.warn}
        body="Ambulance dispatch sends non-critical patients elsewhere. Criticals still come."
        note="Default · stretched but functional"
      />
      <TierCard
        active={tier === 'bypass'}
        onClick={() => onChange('bypass')}
        title="Critical-care bypass"
        tone={COLORS.accent}
        body="Department closed to ambulance traffic. Cannot accept one more critically ill patient."
        note="Hardest posture · last resort"
      />
    </div>
  </div>
);

const StepDuration: React.FC<{
  duration: number;
  onChange: (d: number) => void;
  tier: DivertTier;
}> = ({ duration, onChange, tier }) => {
  const presets = tier === 'bypass' ? [60, 90, 120] : [120, 180, 240];
  return (
    <div>
      <SectionTitle
        title="Set duration"
        detail={`Standard auto-terminate windows: 2h for bypass, 4h for redirect. Diversion ends automatically; re-affirm to extend.`}
      />
      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.md, flexWrap: 'wrap' }}>
        {presets.map((m) => (
          <DurationPill
            key={m}
            active={duration === m}
            label={m >= 60 ? `${m / 60}h` : `${m}m`}
            onClick={() => onChange(m)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.lg }}>
        <Clock size={14} strokeWidth={2} color={COLORS.textSecondary} />
        <Mono tone="muted" size="xs">
          Custom (15-480 min)
        </Mono>
        <input
          type="number"
          min={15}
          max={480}
          step={15}
          value={duration}
          onChange={(e) => onChange(Math.max(15, Math.min(480, Number(e.target.value) || 0)))}
          style={{
            width: 96,
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            background: COLORS.bgDeep,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textPrimary,
            fontFamily: FONTS.mono,
            fontSize: 13,
            outline: 'none',
            textAlign: 'right',
          }}
        />
        <Mono tone="dim" size="xs">min</Mono>
      </div>
    </div>
  );
};

const StepNotify: React.FC<{
  notify: DivertActivation['notify'];
  onChange: (n: DivertActivation['notify']) => void;
}> = ({ notify, onChange }) => {
  const toggle = (k: keyof DivertActivation['notify']) =>
    onChange({ ...notify, [k]: !notify[k] });
  const items: Array<{ key: keyof DivertActivation['notify']; label: string; detail: string; required?: boolean }> = [
    { key: 'emsDispatch', label: 'EMS regional dispatch', detail: 'Required · sets divert status in ePCR network', required: true },
    { key: 'neighborEDs', label: 'Neighbor EDs', detail: 'Pages nearby facilities so they can prepare', required: true },
    { key: 'houseSup', label: 'House supervisor', detail: 'Coordinator for inpatient overflow + capacity moves' },
    { key: 'adminOnCall', label: 'Admin on call', detail: 'Senior leadership awareness · EMTALA documentation' },
    { key: 'medControl', label: 'Regional medical control', detail: 'Notify if bypass extends beyond 2h' },
  ];
  return (
    <div>
      <SectionTitle title="Notify" detail="EMS dispatch + neighbor EDs are required. The rest depend on duration and tier." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, marginTop: SPACE.md }}>
        {items.map((it) => (
          <CheckRow
            key={it.key}
            checked={notify[it.key]}
            onToggle={() => toggle(it.key)}
            label={it.label}
            detail={it.detail}
            required={it.required}
          />
        ))}
      </div>
    </div>
  );
};

const StepConfirm: React.FC<{
  tier: DivertTier;
  duration: number;
  notify: DivertActivation['notify'];
  checks: DivertActivation['preChecks'];
}> = ({ tier, duration, notify, checks }) => {
  const notifyCount = Object.values(notify).filter(Boolean).length;
  const checkCount = Object.values(checks).filter(Boolean).length;
  return (
    <div>
      <SectionTitle title="Confirm activation" detail="Review and activate. The HUD banner across the top will show ON DIVERT · countdown until clear." />
      <div
        style={{
          marginTop: SPACE.md,
          padding: SPACE.lg,
          background: `${COLORS.accent}10`,
          border: `1px solid ${COLORS.accent}55`,
          borderRadius: RADIUS.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.sm,
        }}
      >
        <SummaryRow label="Tier" value={tier === 'bypass' ? 'Critical-care bypass' : 'Redirect'} tone={tier === 'bypass' ? COLORS.accent : COLORS.warn} />
        <SummaryRow label="Duration" value={`${Math.floor(duration / 60)}h ${duration % 60}m`} tone={COLORS.textPrimary} />
        <SummaryRow label="Internal checks" value={`${checkCount} confirmed`} tone={COLORS.ok} />
        <SummaryRow label="Notifications" value={`${notifyCount} parties`} tone={COLORS.info} />
      </div>
      <div
        style={{
          marginTop: SPACE.md,
          padding: SPACE.md,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.sm,
          display: 'flex',
          gap: SPACE.sm,
          alignItems: 'flex-start',
        }}
      >
        <AlertTriangle size={14} strokeWidth={2} color={COLORS.warn} style={{ flexShrink: 0, marginTop: 2 }} />
        <Mono tone="muted" size="xs" style={{ lineHeight: 1.5 }}>
          DIVERSION DOES NOT RELIEVE EMTALA. ANY PATIENT WHO PRESENTS AT THE DOOR MUST BE SCREENED AND STABILIZED.
        </Mono>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

const SectionTitle: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div style={{ marginBottom: SPACE.md }}>
    <h3
      style={{
        fontFamily: FONTS.sans,
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: '-0.015em',
        color: COLORS.textPrimary,
        margin: 0,
      }}
    >
      {title}
    </h3>
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 6,
        lineHeight: 1.5,
        letterSpacing: '-0.005em',
      }}
    >
      {detail}
    </div>
  </div>
);

const CheckRow: React.FC<{
  checked: boolean;
  onToggle: () => void;
  label: string;
  detail: string;
  required?: boolean;
}> = ({ checked, onToggle, label, detail, required }) => (
  <button
    type="button"
    onClick={onToggle}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: SPACE.sm,
      padding: SPACE.md,
      background: checked ? `${COLORS.ok}10` : COLORS.surface,
      border: `1px solid ${checked ? COLORS.ok : COLORS.border}`,
      borderRadius: RADIUS.sm,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: FONTS.sans,
      color: COLORS.textPrimary,
      width: '100%',
      transition: 'border-color 0.15s ease, background 0.15s ease',
    }}
  >
    <span
      style={{
        flexShrink: 0,
        width: 18,
        height: 18,
        marginTop: 1,
        borderRadius: 3,
        border: `1px solid ${checked ? COLORS.ok : COLORS.borderStrong}`,
        background: checked ? COLORS.ok : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <Check size={11} strokeWidth={3} color={COLORS.bg} />}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.xs }}>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: '-0.005em',
          }}
        >
          {label}
        </span>
        {required && (
          <Mono size="xs" style={{ color: COLORS.accent, fontWeight: 700, letterSpacing: '0.12em' }}>
            REQUIRED
          </Mono>
        )}
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 12,
          color: COLORS.textSecondary,
          marginTop: 2,
          lineHeight: 1.4,
        }}
      >
        {detail}
      </div>
    </div>
  </button>
);

const TierCard: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
  note: string;
  tone: string;
}> = ({ active, onClick, title, body, note, tone }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: SPACE.lg,
      background: active ? `${tone}18` : COLORS.surface,
      border: `1px solid ${active ? tone : COLORS.border}`,
      borderLeft: `3px solid ${tone}`,
      borderRadius: RADIUS.sm,
      cursor: 'pointer',
      textAlign: 'left',
      fontFamily: FONTS.sans,
      color: COLORS.textPrimary,
      transition: 'all 0.15s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE.sm,
      minHeight: 132,
    }}
  >
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.015em',
        color: active ? tone : COLORS.textPrimary,
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 1.5,
        flex: 1,
      }}
    >
      {body}
    </div>
    <Mono tone="dim" size="xs">
      {note}
    </Mono>
  </button>
);

const DurationPill: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: `${SPACE.sm}px ${SPACE.lg}px`,
      background: active ? `${COLORS.accent}1f` : COLORS.surface,
      border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
      borderRadius: RADIUS.full,
      color: active ? COLORS.accent : COLORS.textSecondary,
      cursor: 'pointer',
      fontFamily: FONTS.mono,
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: '0.08em',
      minHeight: 40,
    }}
  >
    {label}
  </button>
);

const SummaryRow: React.FC<{ label: string; value: string; tone: string }> = ({
  label,
  value,
  tone,
}) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm }}>
    <Mono tone="muted" size="xs" style={{ minWidth: 160 }}>
      {label.toUpperCase()}
    </Mono>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: 16,
        fontWeight: 600,
        color: tone,
        letterSpacing: '-0.01em',
      }}
    >
      {value}
    </span>
  </div>
);
