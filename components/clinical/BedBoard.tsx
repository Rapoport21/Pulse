/**
 * BedBoard — real-time bed state map for the PULSE platform.
 *
 * One of PULSE's core differentiators (Bucket A). Traditional bed management
 * tools (TeleTracking Capacity IQ, Epic Bed Management) show beds as a list
 * with status icons. PULSE renders beds as a spatial grid grouped by unit,
 * color-coded by state, with PULSE-native features:
 *
 *   - States: ready / occupied / dirty / not_staffed / blocked / reserved
 *   - Acuity badges on occupied beds
 *   - Freshness indicators (time since last state change)
 *   - Surge-aware: overflow units appear when surge is active
 *   - Summary bar with availability percentage and state breakdown
 *   - Tappable beds show quick-info popover
 *
 * Display modes:
 *   - `full`  — fullscreen overlay with all units and summary bar
 *   - `card`  — compact dashboard tile showing summary + mini grid
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Bed as BedIcon, User, AlertTriangle, Clock, Wrench,
  ChevronRight, ArrowUpRight, ShieldAlert, Truck,
} from 'lucide-react';
import { COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, Z } from '../design/tokens';
import {
  Mono, BracketLabel, StatusPill, TacticalCard, CornerBracket,
  Divider, HudStrip, ScanningLine, TacticalButton,
} from '../design/primitives';
import type {
  BedUnit, Bed, BedState, BedSummary,
} from '../../data/bedMock';
import {
  summarizeBeds, summarizeUnit, availabilityPercent, stateLabel,
} from '../../data/bedMock';

// ─────────────────────────────────────────────────────────────────────────
// State → visual mapping
// ─────────────────────────────────────────────────────────────────────────

const STATE_COLOR: Record<BedState, string> = {
  ready: COLORS.ok,
  occupied: COLORS.info,
  dirty: COLORS.warn,
  not_staffed: '#F97316',   // orange-500
  blocked: COLORS.crit,
  reserved: '#A855F7',      // purple-500
};

const STATE_BG: Record<BedState, string> = {
  ready: 'rgba(16, 185, 129, 0.12)',
  occupied: 'rgba(59, 130, 246, 0.10)',
  dirty: 'rgba(245, 158, 11, 0.12)',
  not_staffed: 'rgba(249, 115, 22, 0.12)',
  blocked: 'rgba(239, 68, 68, 0.12)',
  reserved: 'rgba(168, 85, 247, 0.12)',
};

const STATE_ICON: Record<BedState, React.ReactNode> = {
  ready: <BedIcon size={12} />,
  occupied: <User size={12} />,
  dirty: <Clock size={12} />,
  not_staffed: <AlertTriangle size={12} />,
  blocked: <Wrench size={12} />,
  reserved: <Truck size={12} />,
};

const ACUITY_COLOR: Record<number, string> = {
  1: COLORS.crit,
  2: '#F97316',
  3: COLORS.warn,
  4: COLORS.ok,
  5: COLORS.info,
};

// ─────────────────────────────────────────────────────────────────────────
// Freshness — how long since state changed
// ─────────────────────────────────────────────────────────────────────────

function freshnessLabel(minAgo?: number): string {
  if (minAgo === undefined || minAgo === 0) return 'JUST NOW';
  if (minAgo < 60) return `${minAgo}M AGO`;
  const hrs = Math.floor(minAgo / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

function freshnessOpacity(minAgo?: number): number {
  if (minAgo === undefined || minAgo === 0) return 1;
  if (minAgo < 30) return 1;
  if (minAgo < 120) return 0.85;
  if (minAgo < 480) return 0.7;
  return 0.6;
}

// ─────────────────────────────────────────────────────────────────────────
// BedTile — single bed in the grid
// ─────────────────────────────────────────────────────────────────────────

const BedTile: React.FC<{
  bed: Bed;
  onTap?: (bed: Bed) => void;
  compact?: boolean;
}> = ({ bed, onTap, compact = false }) => {
  const color = STATE_COLOR[bed.state];
  const bg = STATE_BG[bed.state];
  const opacity = freshnessOpacity(bed.stateChangedMinAgo);

  if (compact) {
    // Mini tile for card mode — just a colored dot
    return (
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: RADIUS.sm,
          background: bg,
          border: `1px solid ${color}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
        }}
        title={`${bed.label} — ${stateLabel(bed.state)}`}
      >
        {bed.acuity && (
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: RADIUS.full,
              background: ACUITY_COLOR[bed.acuity] || COLORS.textMuted,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      onClick={() => onTap?.(bed)}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        minWidth: 56,
        maxWidth: 80,
        background: bg,
        border: `1px solid ${color}30`,
        borderRadius: RADIUS.sm,
        padding: SPACE.xs,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        cursor: 'pointer',
        opacity,
        overflow: 'hidden',
        transition: `opacity ${MOTION.fast}s ease`,
      }}
    >
      {/* Corner brackets for critical states */}
      {(bed.state === 'blocked' || bed.state === 'not_staffed') && (
        <>
          <CornerBracket position="tl" color={color} size={6} thickness={1} inset={0} />
          <CornerBracket position="br" color={color} size={6} thickness={1} inset={0} />
        </>
      )}

      {/* Bed label */}
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: COLORS.textPrimary,
          lineHeight: 1,
        }}
      >
        {bed.label}
      </span>

      {/* Patient initials or state icon */}
      {bed.state === 'occupied' && bed.patientInitials ? (
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.08em',
            color,
            lineHeight: 1,
          }}
        >
          {bed.patientInitials}
        </span>
      ) : (
        <span style={{ color, lineHeight: 0 }}>
          {STATE_ICON[bed.state]}
        </span>
      )}

      {/* Acuity dot */}
      {bed.acuity && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 6,
            height: 6,
            borderRadius: RADIUS.full,
            background: ACUITY_COLOR[bed.acuity],
            boxShadow: `0 0 4px ${ACUITY_COLOR[bed.acuity]}80`,
          }}
        />
      )}

      {/* Reserved indicator */}
      {bed.state === 'reserved' && (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            bottom: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: 2,
            borderRadius: RADIUS.full,
            background: color,
          }}
        />
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// BedPopover — quick info when tapping a bed
// ─────────────────────────────────────────────────────────────────────────

const BedPopover: React.FC<{
  bed: Bed;
  onClose: () => void;
}> = ({ bed, onClose }) => {
  const color = STATE_COLOR[bed.state];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: MOTION.fast }}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        bottom: 100,
        left: 16,
        right: 16,
        maxWidth: 400,
        margin: '0 auto',
        background: COLORS.surface,
        border: `1px solid ${color}40`,
        borderRadius: RADIUS.md,
        padding: SPACE.base,
        zIndex: Z.toast,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${COLORS.border}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.textPrimary,
            letterSpacing: '0.04em',
          }}>
            {bed.label}
          </span>
          <StatusPill
            label={stateLabel(bed.state)}
            tone={bed.state === 'ready' ? 'ok' : bed.state === 'occupied' ? 'info' : bed.state === 'dirty' ? 'warn' : bed.state === 'blocked' ? 'crit' : 'neutral'}
          />
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${SPACE.sm}px ${SPACE.base}px` }}>
        {bed.patientInitials && (
          <DetailRow label="Patient" value={bed.patientInitials} />
        )}
        {bed.acuity && (
          <DetailRow label="Acuity" value={`ESI ${bed.acuity}`} valueColor={ACUITY_COLOR[bed.acuity]} />
        )}
        {bed.assignedNurse && (
          <DetailRow label="Nurse" value={bed.assignedNurse} />
        )}
        <DetailRow label="Last Changed" value={freshnessLabel(bed.stateChangedMinAgo)} />
        {bed.blockReason && (
          <DetailRow label="Block Reason" value={bed.blockReason} valueColor={COLORS.crit} />
        )}
        {bed.reservedFor && (
          <DetailRow label="Reserved For" value={bed.reservedFor} valueColor={STATE_COLOR.reserved} />
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.base }}>
        {bed.state === 'dirty' && (
          <TacticalButton variant="primary" size="sm" fullWidth>
            Mark Clean
          </TacticalButton>
        )}
        {bed.state === 'ready' && (
          <TacticalButton variant="primary" size="sm" fullWidth>
            Assign Patient
          </TacticalButton>
        )}
        {bed.state === 'blocked' && (
          <TacticalButton variant="danger" size="sm" fullWidth>
            Unblock
          </TacticalButton>
        )}
        {bed.state === 'not_staffed' && (
          <TacticalButton variant="primary" size="sm" fullWidth>
            Assign Nurse
          </TacticalButton>
        )}
        {bed.state === 'occupied' && (
          <TacticalButton variant="secondary" size="sm" fullWidth>
            View Patient
          </TacticalButton>
        )}
      </div>
    </motion.div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div>
    <Mono tone="muted" size="xs">{label}</Mono>
    <div style={{
      fontFamily: FONTS.mono,
      fontSize: 12,
      fontWeight: 500,
      color: valueColor || COLORS.textPrimary,
      marginTop: 2,
    }}>
      {value}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// UnitRow — one hospital unit with its bed grid
// ─────────────────────────────────────────────────────────────────────────

const UnitRow: React.FC<{
  unit: BedUnit;
  onBedTap: (bed: Bed) => void;
  isNew?: boolean;
}> = ({ unit, onBedTap, isNew = false }) => {
  const summary = summarizeUnit(unit);
  const availCount = summary.ready;
  const tone = availCount === 0 ? 'crit' : availCount <= 1 ? 'warn' : 'ok';

  return (
    <motion.div
      initial={isNew ? { opacity: 0, height: 0 } : false}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{ marginBottom: SPACE.base }}
    >
      {/* Unit header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACE.sm,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <BracketLabel tone={tone === 'crit' ? 'crit' : tone === 'warn' ? 'warn' : 'accent'} size="xs">
            {unit.shortName}
          </BracketLabel>
          {unit.surgeOnly && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Mono tone="crit" size="xs">SURGE</Mono>
            </motion.span>
          )}
        </div>
        <Mono tone="muted" size="xs">
          {availCount} / {summary.total} AVAIL
        </Mono>
      </div>

      {/* Bed grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
        gap: SPACE.xs,
      }}>
        {unit.beds.map((bed) => (
          <BedTile key={bed.id} bed={bed} onTap={onBedTap} />
        ))}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// SummaryBar — top-level stats
// ─────────────────────────────────────────────────────────────────────────

const SummaryBar: React.FC<{ summary: BedSummary; surgeActive: boolean }> = ({ summary, surgeActive }) => {
  const availPct = summary.total > 0 ? Math.round((summary.ready / summary.total) * 100) : 0;
  const pctTone = availPct <= 5 ? 'crit' : availPct <= 15 ? 'warn' : 'ok';

  const chips: Array<{ label: string; count: number; color: string }> = [
    { label: 'READY', count: summary.ready, color: STATE_COLOR.ready },
    { label: 'OCCUP', count: summary.occupied, color: STATE_COLOR.occupied },
    { label: 'DIRTY', count: summary.dirty, color: STATE_COLOR.dirty },
    { label: 'NO STAFF', count: summary.notStaffed, color: STATE_COLOR.not_staffed },
    { label: 'BLOCK', count: summary.blocked, color: STATE_COLOR.blocked },
    { label: 'RSRVD', count: summary.reserved, color: STATE_COLOR.reserved },
  ];

  return (
    <div style={{ marginBottom: SPACE.lg }}>
      {/* Hero number */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
          color: pctTone === 'crit' ? COLORS.crit : pctTone === 'warn' ? COLORS.warn : COLORS.ok,
        }}>
          {availPct}%
        </span>
        <Mono tone="muted" size="sm">AVAILABLE</Mono>
        <Mono tone="muted" size="xs">({summary.ready} / {summary.total} BEDS)</Mono>
        {surgeActive && (
          <StatusPill label="SURGE" tone="crit" pulse size="xs" />
        )}
      </div>

      {/* State chip row */}
      <div style={{
        display: 'flex',
        gap: SPACE.sm,
        flexWrap: 'wrap',
      }}>
        {chips.map((chip) => (
          <div
            key={chip.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: `2px ${SPACE.sm}px`,
              background: `${chip.color}12`,
              border: `1px solid ${chip.color}25`,
              borderRadius: RADIUS.sm,
            }}
          >
            <div style={{
              width: 5,
              height: 5,
              borderRadius: RADIUS.full,
              background: chip.color,
            }} />
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.12em',
              color: chip.color,
              textTransform: 'uppercase',
            }}>
              {chip.count} {chip.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// CardMode — compact tile for dashboard
// ─────────────────────────────────────────────────────────────────────────

const CardMode: React.FC<{
  units: BedUnit[];
  surgeActive: boolean;
  onExpand: () => void;
}> = ({ units, surgeActive, onExpand }) => {
  const visibleUnits = surgeActive ? units : units.filter(u => !u.surgeOnly);
  const summary = summarizeBeds(visibleUnits, surgeActive);
  const availPct = summary.total > 0 ? Math.round((summary.ready / summary.total) * 100) : 0;
  const pctTone = availPct <= 5 ? 'crit' : availPct <= 15 ? 'warn' : 'ok';

  return (
    <TacticalCard interactive padding="md" onClick={onExpand}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm }}>
        <BracketLabel tone="accent" size="xs">BED BOARD</BracketLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Mono tone="muted" size="xs">TAP TO EXPAND</Mono>
          <ChevronRight size={12} color={COLORS.textMuted} />
        </div>
      </div>

      {/* Hero stat */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
          color: pctTone === 'crit' ? COLORS.crit : pctTone === 'warn' ? COLORS.warn : COLORS.ok,
        }}>
          {availPct}%
        </span>
        <Mono tone="muted" size="xs">AVAIL · {summary.ready} READY · {summary.dirty} DIRTY · {summary.notStaffed} NO STAFF</Mono>
      </div>

      {/* Mini bed grid — all units inline */}
      <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
        {visibleUnits.map((unit) => (
          <div key={unit.id} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Mono tone="dim" size="xs" style={{ marginRight: 2 }}>{unit.shortName}</Mono>
            {unit.beds.map((bed) => (
              <BedTile key={bed.id} bed={bed} compact />
            ))}
          </div>
        ))}
      </div>

      {surgeActive && (
        <div style={{ marginTop: SPACE.sm }}>
          <StatusPill label="OVERFLOW HALL C ACTIVE" tone="crit" pulse size="xs" />
        </div>
      )}
    </TacticalCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// FullMode — fullscreen overlay
// ─────────────────────────────────────────────────────────────────────────

const FullMode: React.FC<{
  units: BedUnit[];
  surgeActive: boolean;
  onClose: () => void;
}> = ({ units, surgeActive, onClose }) => {
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [filter, setFilter] = useState<BedState | 'all'>('all');

  const visibleUnits = useMemo(() => {
    const base = surgeActive ? units : units.filter(u => !u.surgeOnly);
    if (filter === 'all') return base;
    return base
      .map(u => ({ ...u, beds: u.beds.filter(b => b.state === filter) }))
      .filter(u => u.beds.length > 0);
  }, [units, surgeActive, filter]);

  const summary = summarizeBeds(
    surgeActive ? units : units.filter(u => !u.surgeOnly),
    surgeActive,
  );

  const filters: Array<{ key: BedState | 'all'; label: string; count: number }> = [
    { key: 'all', label: 'ALL', count: summary.total },
    { key: 'ready', label: 'READY', count: summary.ready },
    { key: 'occupied', label: 'OCCUP', count: summary.occupied },
    { key: 'dirty', label: 'DIRTY', count: summary.dirty },
    { key: 'not_staffed', label: 'NO STAFF', count: summary.notStaffed },
    { key: 'blocked', label: 'BLOCK', count: summary.blocked },
    { key: 'reserved', label: 'RSRVD', count: summary.reserved },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.fast }}
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bg,
        zIndex: Z.modal,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ScanningLine color={COLORS.accent} duration={20} />

      {/* Header */}
      <HudStrip side="top" fixed>
        <BracketLabel tone="accent">BED BOARD</BracketLabel>
        <div style={{ flex: 1 }} />
        {surgeActive && <StatusPill label="SURGE ACTIVE" tone="crit" pulse />}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textSecondary,
            cursor: 'pointer',
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <X size={14} />
          <Mono tone="secondary" size="xs">CLOSE</Mono>
        </button>
      </HudStrip>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: `${SPACE.xl + 52}px ${SPACE.base}px ${SPACE.xl}px`,
        }}
      >
        {/* Summary */}
        <SummaryBar summary={summary} surgeActive={surgeActive} />

        {/* Filter chips */}
        <div style={{
          display: 'flex',
          gap: SPACE.xs,
          flexWrap: 'wrap',
          marginBottom: SPACE.lg,
          paddingBottom: SPACE.md,
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          {filters.map((f) => {
            const isActive = filter === f.key;
            const chipColor = f.key === 'all' ? COLORS.textSecondary : STATE_COLOR[f.key as BedState];
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: `4px ${SPACE.sm}px`,
                  background: isActive ? `${chipColor}20` : 'transparent',
                  border: `1px solid ${isActive ? chipColor : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  color: isActive ? chipColor : COLORS.textMuted,
                  textTransform: 'uppercase',
                }}>
                  {f.label}
                </span>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 9,
                  fontWeight: 600,
                  color: isActive ? chipColor : COLORS.textDim,
                }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Unit rows */}
        {visibleUnits.map((unit) => (
          <UnitRow
            key={unit.id}
            unit={unit}
            onBedTap={setSelectedBed}
            isNew={unit.surgeOnly}
          />
        ))}

        {visibleUnits.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: SPACE['3xl'],
          }}>
            <Mono tone="muted">NO BEDS MATCH FILTER</Mono>
          </div>
        )}
      </div>

      {/* Bed popover */}
      <AnimatePresence>
        {selectedBed && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBed(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: Z.toast - 1,
              }}
            />
            <BedPopover
              key="popover"
              bed={selectedBed}
              onClose={() => setSelectedBed(null)}
            />
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// BedBoard — public API
// ─────────────────────────────────────────────────────────────────────────

export interface BedBoardProps {
  /** Display mode: `card` for dashboard tile, `full` for overlay. */
  display: 'card' | 'full';
  /** Hospital unit data (mutable). */
  units: BedUnit[];
  /** Whether surge protocol is currently active. */
  surgeActive?: boolean;
  /** Callback to open full view from card mode. */
  onExpand?: () => void;
  /** Callback to close full view. */
  onClose?: () => void;
  /** Whether the full overlay is open (only for display="full"). */
  open?: boolean;
}

export const BedBoard: React.FC<BedBoardProps> = ({
  display,
  units,
  surgeActive = false,
  onExpand,
  onClose,
  open = false,
}) => {
  if (display === 'card') {
    return (
      <CardMode
        units={units}
        surgeActive={surgeActive}
        onExpand={onExpand || (() => {})}
      />
    );
  }

  // Full mode — controlled by `open` prop
  return (
    <AnimatePresence>
      {open && (
        <FullMode
          units={units}
          surgeActive={surgeActive}
          onClose={onClose || (() => {})}
        />
      )}
    </AnimatePresence>
  );
};
