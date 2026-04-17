import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ArrowRight, FileText, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { Playbook } from '../types';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  SectionTitle,
  TacticalCard,
  TacticalButton,
  CornerBracket,
} from './design';

interface PlaybooksProps {
  onActivate: () => void;
}

const library: Playbook[] = [
  {
    id: 'PB-SURGE-L2',
    name: 'Level 2 Surge Protocol',
    description:
      'Rapid decompression of ED via hallway boarding and fast-track expansion.',
    triggerCondition: 'NEDOCS > 100 for 60 mins',
    approverRole: 'Medical Director',
    steps: [
      { id: 's1', description: 'Notify House Supervisor and CNO', role: 'Charge Nurse', status: 'PENDING' },
      { id: 's2', description: 'Open 4 hallway beds in Med/Surg', role: 'Floor Manager', status: 'PENDING' },
      { id: 's3', description: 'Deploy rapid triage team to ED entrance', role: 'ER Personnel', status: 'PENDING' },
    ],
    estimatedImpact: '-15% Saturation in 60m',
  },
  {
    id: 'PB-MCI-ALPHA',
    name: 'Mass Casualty Alpha',
    description:
      'Total mobilization for >20 incoming casualties. Cancels all electives.',
    triggerCondition: 'External Event Notification',
    approverRole: 'Chief of Ops',
    steps: [
      { id: 'm1', description: 'Activate Incident Command Center', role: 'Admin', status: 'PENDING' },
      { id: 'm2', description: 'Clear Trauma Bays 1-4', role: 'ER Personnel', status: 'PENDING' },
      { id: 'm3', description: 'Recall off-duty surgical staff', role: 'Floor Manager', status: 'PENDING' },
    ],
    estimatedImpact: 'Capacity x200%',
  },
  {
    id: 'PB-DIV-SOFT',
    name: 'Soft Diversion',
    description:
      'Reroute BLS ambulances to secondary sites. Maintain ALS/Stroke/Trauma.',
    triggerCondition: 'Wait Time > 4hrs',
    approverRole: 'Charge Nurse',
    steps: [
      { id: 'd1', description: 'Notify EMS Dispatch of Soft Divert', role: 'Charge Nurse', status: 'PENDING' },
      { id: 'd2', description: 'Update regional dashboard status', role: 'Admin', status: 'PENDING' },
    ],
    estimatedImpact: '-5 EMS Arrivals/hr',
  },
];

/**
 * Playbooks — tactical protocol library.
 * Every card is a TacticalCard with hover chrome. The grid adapts to
 * 1/2/3 columns with simple flex wrapping; no Tailwind needed.
 */
export const Playbooks: React.FC<PlaybooksProps> = ({ onActivate }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: SPACE['2xl'],
        background: COLORS.bg,
      }}
    >
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <SectionTitle
          id="PB.LIB"
          label="Operational Playbooks"
          meta={<StatusPill label={`${library.length} Protocols Armed`} tone="ok" />}
        />
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 15,
            color: COLORS.textSecondary,
            maxWidth: 720,
            lineHeight: 1.55,
            margin: `0 0 ${SPACE['2xl']}px`,
          }}
        >
          Pre-authorized clinical and operational protocols designed to
          mitigate capacity risk and ensure patient safety during surge
          events.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: SPACE.lg,
          }}
        >
          {library.map((pb, i) => (
            <PlaybookCard
              key={pb.id}
              entry={pb}
              index={i}
              expanded={expandedId === pb.id}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === pb.id ? null : pb.id))
              }
              onActivate={onActivate}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Card component — individual playbook
// ─────────────────────────────────────────────────────────────────────────
const PlaybookCard: React.FC<{
  entry: Playbook;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onActivate: () => void;
}> = ({ entry, index, expanded, onToggleExpand, onActivate }) => {
  const isSurge = entry.id.includes('SURGE') || entry.id.includes('MCI');
  const Icon = isSurge ? ShieldAlert : FileText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.08 + index * 0.06,
        duration: MOTION.base,
        ease: MOTION.ease,
      }}
    >
      <TacticalCard
        interactive
        accentBar={isSurge}
        padding="md"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: SPACE.lg,
          gap: SPACE.md,
        }}
      >
        {/* Header row: icon + ID */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: SPACE.md,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.surfaceElev,
              border: `1px solid ${isSurge ? COLORS.accent : COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: isSurge ? COLORS.accent : COLORS.textSecondary,
              flexShrink: 0,
            }}
          >
            <Icon size={20} strokeWidth={2} />
            <CornerBracket position="tl" color={isSurge ? COLORS.accent : COLORS.borderStrong} size={4} thickness={1} />
            <CornerBracket position="br" color={isSurge ? COLORS.accent : COLORS.borderStrong} size={4} thickness={1} />
          </div>
          <BracketLabel tone={isSurge ? 'accent' : 'muted'} size="xs">
            {entry.id}
          </BracketLabel>
        </div>

        {/* Title */}
        <div>
          <h3
            style={{
              fontFamily: FONTS.sans,
              fontSize: TYPE.h3.size,
              fontWeight: TYPE.h3.weight,
              letterSpacing: TYPE.h3.tracking,
              lineHeight: TYPE.h3.lineHeight,
              color: COLORS.textPrimary,
              margin: 0,
              marginBottom: 6,
            }}
          >
            {entry.name}
          </h3>
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 14,
              color: COLORS.textSecondary,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {entry.description}
          </p>
        </div>

        {/* Meta list: trigger / impact / approver */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.sm,
            paddingTop: SPACE.md,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <MetaRow label="Trigger" value={entry.triggerCondition} />
          <MetaRow
            label="Impact"
            value={entry.estimatedImpact}
            valueColor={COLORS.ok}
          />
          <MetaRow label="Approver" value={entry.approverRole} />
        </div>

        {/* Expandable steps */}
        <div>
          <button
            type="button"
            onClick={onToggleExpand}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACE.sm}px 0`,
              background: 'transparent',
              border: 'none',
              borderTop: `1px dashed ${COLORS.border}`,
              cursor: 'pointer',
              color: COLORS.textMuted,
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              transition: `color ${MOTION.fast}s ease`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
          >
            <span>View Protocol Steps ({entry.steps.length})</span>
            {expanded ? (
              <ChevronUp size={15} strokeWidth={2} />
            ) : (
              <ChevronDown size={15} strokeWidth={2} />
            )}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="steps"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: MOTION.base, ease: MOTION.ease }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.xs,
                    paddingTop: SPACE.sm,
                  }}
                >
                  {entry.steps.map((step, idx) => (
                    <StepRow key={step.id} step={step} index={idx + 1} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Activate button */}
        <TacticalButton
          variant={isSurge ? 'primary' : 'secondary'}
          size="md"
          fullWidth
          icon={<ArrowRight size={15} strokeWidth={2} />}
          onClick={onActivate}
          style={{ marginTop: 'auto' }}
        >
          Activate Protocol
        </TacticalButton>
      </TacticalCard>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// MetaRow — a label/value row styled as a tactical data readout
// ─────────────────────────────────────────────────────────────────────────
const MetaRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACE.sm,
    }}
  >
    <Mono tone="muted" size="xs">
      {label}
    </Mono>
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 12,
        color: valueColor ?? COLORS.textPrimary,
        letterSpacing: '0.04em',
        textAlign: 'right',
      }}
    >
      {value}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// StepRow — numbered protocol step with owner role
// ─────────────────────────────────────────────────────────────────────────
const StepRow: React.FC<{
  step: Playbook['steps'][number];
  index: number;
}> = ({ step, index }) => (
  <div
    style={{
      display: 'flex',
      gap: SPACE.md,
      alignItems: 'flex-start',
      padding: `${SPACE.sm}px ${SPACE.md}px`,
      background: COLORS.bgDeep,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <div
      style={{
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.surfaceElev,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: RADIUS.sm,
        fontFamily: FONTS.mono,
        fontSize: 10,
        fontWeight: 600,
        color: COLORS.textSecondary,
        flexShrink: 0,
        marginTop: 1,
      }}
    >
      {String(index).padStart(2, '0')}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <p
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: COLORS.textPrimary,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 3,
        }}
      >
        {step.description}
      </p>
      <Mono tone="muted" size="xs">
        Owner · {step.role}
      </Mono>
    </div>
  </div>
);
