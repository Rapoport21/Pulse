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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Bed as BedIcon, User, AlertTriangle, Clock, Wrench,
  ChevronRight, ArrowUpRight, ShieldAlert, Truck, GripVertical,
  ChevronDown, ChevronUp, RefreshCw, FileText,
} from 'lucide-react';
import { COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, Z, SHADOW } from '../design/tokens';
import {
  Mono, BracketLabel, StatusPill, TacticalCard, CornerBracket,
  Divider, HudStrip, ScanningLine, TacticalButton,
} from '../design/primitives';
import type {
  BedUnit, Bed, BedState, BedSummary,
} from '../../data/bedMock';
import {
  summarizeBeds, summarizeUnit, availabilityPercent, stateLabel,
  getPendingAdmits,
} from '../../data/bedMock';
import type { PendingAdmit } from '../../data/bedMock';
import { UserRole } from '../../types';

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
  ready: <BedIcon size={15} />,
  occupied: <User size={15} />,
  dirty: <Clock size={15} />,
  not_staffed: <AlertTriangle size={15} />,
  blocked: <Wrench size={15} />,
  reserved: <Truck size={15} />,
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
  onTap?: (bed: Bed, anchor: DropdownAnchor) => void;
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
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onTap?.(bed, { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }); }}
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
          fontSize: 14,
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
            fontSize: 11,
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

/** Anchor rect passed from the clicked row */
interface DropdownAnchor {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

const BedPopover: React.FC<{
  bed: Bed;
  anchor: DropdownAnchor;
  onClose: () => void;
  onNavigateToPatient?: (patientId: string) => void;
}> = ({ bed, anchor, onClose, onNavigateToPatient }) => {
  const color = STATE_COLOR[bed.state];
  const isOccupied = bed.state === 'occupied';

  // Format LOS hours as human-readable string
  const formatLos = (hrs?: number): string => {
    if (hrs === undefined) return '--';
    if (hrs < 24) return `${hrs}h`;
    const d = Math.floor(hrs / 24);
    const h = hrs % 24;
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  };

  const ISOLATION_BADGE_COLOR: Record<string, string> = {
    CONTACT: '#F97316',
    DROPLET: COLORS.warn,
    AIRBORNE: COLORS.crit,
    PROTECTIVE: '#A855F7',
  };

  // Position dropdown below or above anchor depending on available space
  const dropdownWidth = Math.min(480, anchor.width);
  const spaceBelow = window.innerHeight - anchor.bottom;
  const spaceAbove = anchor.top;
  const maxH = 420;
  const openBelow = spaceBelow >= maxH || spaceBelow >= spaceAbove;
  const topPos = openBelow ? anchor.bottom + 4 : undefined;
  const bottomPos = openBelow ? undefined : (window.innerHeight - anchor.top + 4);
  // Horizontally align to the row's left edge, clamp to viewport
  const leftPos = Math.max(8, Math.min(anchor.left, window.innerWidth - dropdownWidth - 8));

  return (
    <>
      {/* Transparent click-catcher */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: Z.toast,
        }}
      />
      {/* Dropdown panel */}
      <motion.div
        initial={{ opacity: 0, y: openBelow ? -6 : 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: openBelow ? -4 : 4, scale: 0.98 }}
        transition={{ duration: MOTION.fast }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: topPos,
          bottom: bottomPos,
          left: leftPos,
          width: dropdownWidth,
          maxHeight: maxH,
          overflowY: 'auto',
          background: COLORS.surface,
          border: `1px solid ${color}40`,
          borderRadius: RADIUS.md,
          padding: 0,
          zIndex: Z.toast + 1,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${COLORS.border}`,
        }}
      >
        {isOccupied ? (
          /* ── Occupied bed: patient-centric view ── */
          <>
            {/* Header bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${SPACE.base}px ${SPACE.base}px ${SPACE.sm}px`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: COLORS.textMuted,
                  flexShrink: 0,
                }}>
                  BED {bed.label}
                </span>
                <StatusPill label={stateLabel(bed.state)} tone="info" />
                {bed.acuity && (
                  <span style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: ACUITY_COLOR[bed.acuity],
                    padding: '2px 6px',
                    borderRadius: RADIUS.sm,
                    background: `${ACUITY_COLOR[bed.acuity]}18`,
                    border: `1px solid ${ACUITY_COLOR[bed.acuity]}30`,
                  }}>
                    ESI {bed.acuity}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none',
                  color: COLORS.textMuted, cursor: 'pointer',
                  padding: 4, borderRadius: RADIUS.sm,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={19} />
              </button>
            </div>

            {/* Patient name + MRN */}
            <div style={{ padding: `${SPACE.base}px ${SPACE.base}px ${SPACE.sm}px` }}>
              <div style={{
                fontFamily: FONTS.sans,
                fontSize: 25,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: COLORS.textPrimary,
                lineHeight: 1.2,
              }}>
                {bed.patientName || bed.patientInitials || '--'}
              </div>
              {bed.mrn && (
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  color: COLORS.textSecondary,
                  marginTop: 2,
                  display: 'inline-block',
                }}>
                  {bed.mrn}
                </span>
              )}
            </div>

            {/* Quick info row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: SPACE.xs,
              padding: `${SPACE.sm}px ${SPACE.base}px`,
              margin: `0 ${SPACE.base}px`,
              background: COLORS.surfaceElev,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`,
            }}>
              <DetailRow label="Attending" value={bed.attending || '--'} />
              <DetailRow label="Nurse" value={bed.assignedNurse || '--'} />
              <DetailRow label="LOS" value={formatLos(bed.losHours)} />
              <DetailRow
                label="Isolation"
                value={bed.isolation || 'NONE'}
                valueColor={bed.isolation && bed.isolation !== 'NONE' ? ISOLATION_BADGE_COLOR[bed.isolation] : undefined}
              />
            </div>

            {/* Admit source */}
            {bed.admitSource && (
              <div style={{ padding: `${SPACE.sm}px ${SPACE.base}px 0` }}>
                <DetailRow label="Admit Source" value={bed.admitSource} />
              </div>
            )}

            {/* Discharge milestones */}
            {bed.dischargeMilestones && (
              <div style={{ padding: `${SPACE.sm}px ${SPACE.base}px 0` }}>
                <Mono tone="muted" size="xs" style={{ marginBottom: 6, display: 'block' }}>
                  Discharge Milestones
                </Mono>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
                  {([
                    ['dcOrderWritten', 'DC Order'],
                    ['rideConfirmed', 'Ride Confirmed'],
                    ['medsToeBedside', 'Meds to Bedside'],
                  ] as const).map(([key, label]) => {
                    const done = bed.dischargeMilestones?.[key] ?? false;
                    return (
                      <span key={key} style={{
                        fontFamily: FONTS.mono,
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        color: done ? COLORS.ok : COLORS.textMuted,
                        padding: '3px 8px',
                        borderRadius: RADIUS.sm,
                        background: done ? 'rgba(16,185,129,0.12)' : COLORS.surfaceElev,
                        border: `1px solid ${done ? COLORS.ok + '30' : COLORS.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {done ? '\u2713' : '\u2012'} {label}
                      </span>
                    );
                  })}
                  {bed.dischargeMilestones.estimatedDcTime && (
                    <span style={{
                      fontFamily: FONTS.mono,
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      color: COLORS.textSecondary,
                      padding: '3px 8px',
                      borderRadius: RADIUS.sm,
                      background: COLORS.surfaceElev,
                      border: `1px solid ${COLORS.border}`,
                    }}>
                      EST DC {bed.dischargeMilestones.estimatedDcTime}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{
              display: 'flex', gap: SPACE.sm,
              padding: SPACE.base,
              marginTop: SPACE.sm,
              borderTop: `1px solid ${COLORS.border}`,
            }}>
              <TacticalButton variant="secondary" size="sm" fullWidth>
                REASSIGN BED
              </TacticalButton>
              {onNavigateToPatient && (
                <TacticalButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => onNavigateToPatient(bed.patientId || bed.mrn || bed.id)}
                >
                  <FileText size={17} style={{ marginRight: 6 }} />
                  OPEN FULL CHART
                </TacticalButton>
              )}
            </div>
          </>
        ) : (
          /* ── Non-occupied bed: original-style view ── */
          <>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${SPACE.base}px ${SPACE.base}px ${SPACE.sm}px`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 19,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  letterSpacing: '0.04em',
                }}>
                  {bed.label}
                </span>
                <StatusPill
                  label={stateLabel(bed.state)}
                  tone={bed.state === 'ready' ? 'ok' : bed.state === 'dirty' ? 'warn' : bed.state === 'blocked' ? 'crit' : 'neutral'}
                />
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none',
                  color: COLORS.textMuted, cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={19} />
              </button>
            </div>

            {/* Details grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: `${SPACE.sm}px ${SPACE.base}px`,
              padding: SPACE.base,
            }}>
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
            <div style={{
              display: 'flex', gap: SPACE.sm,
              padding: `0 ${SPACE.base}px ${SPACE.base}px`,
            }}>
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
            </div>
          </>
        )}
      </motion.div>
    </>
  );
};

const DetailRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div>
    <Mono tone="muted" size="xs">{label}</Mono>
    <div style={{
      fontFamily: FONTS.mono,
      fontSize: 15,
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
  onBedTap: (bed: Bed, anchor: DropdownAnchor) => void;
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
          fontSize: 46,
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
              fontSize: 11,
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
          <ChevronRight size={15} color={COLORS.textMuted} />
        </div>
      </div>

      {/* Hero stat */}
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
  role?: UserRole;
  embedded?: boolean;
  onNavigateToPatient?: (patientId: string) => void;
}> = ({ units, surgeActive, onClose, role, embedded, onNavigateToPatient }) => {
  const [selectedBed, setSelectedBed] = useState<{ bed: Bed; anchor: DropdownAnchor } | null>(null);
  // Role-aware default filter:
  //  - ER: default to showing occupied beds (ED focus on active patients)
  //  - Manager: show all beds (full capacity overview)
  //  - Nurse: show occupied beds (assigned patients first)
  const defaultBedFilter: BedState | 'all' =
    role === UserRole.ER_PERSONNEL ? 'occupied'
    : role === UserRole.NURSE ? 'occupied'
    : 'all';
  const [filter, setFilter] = useState<BedState | 'all'>(defaultBedFilter);

  const visibleUnits = useMemo(() => {
    let base = surgeActive ? units : units.filter(u => !u.surgeOnly);
    if (filter !== 'all') {
      base = base
        .map(u => ({ ...u, beds: u.beds.filter(b => b.state === filter) }))
        .filter(u => u.beds.length > 0);
    }
    // Role-aware unit ordering:
    //  - ER: ED units (shortName starts with "ED") sorted to top
    //  - Nurse: assigned unit highlighted (no reorder, keep natural order)
    //  - Manager: all units in natural order
    if (role === UserRole.ER_PERSONNEL) {
      base = [...base].sort((a, b) => {
        const aED = a.shortName.startsWith('ED') ? 0 : 1;
        const bED = b.shortName.startsWith('ED') ? 0 : 1;
        return aED - bED;
      });
    }
    return base;
  }, [units, surgeActive, filter, role]);

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

  // ── Embedded mode: Epic-style desktop bed board ──
  // These hooks are always called (rules of hooks) but only used when embedded.
  const [pendingAdmits] = useState<PendingAdmit[]>(() => getPendingAdmits());
  const [refreshCountdown, setRefreshCountdown] = useState<number>(30);
  const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());

  // Auto-refresh countdown timer (only ticks when embedded)
  useEffect(() => {
    if (!embedded) return;
    const interval = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [embedded]);

  // LOS formatter helper
  const formatLOS = (hours?: number): string => {
    if (hours === undefined || hours === 0) return '--';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainHrs = hours % 24;
    if (remainHrs === 0) return `${days}d`;
    return `${days}d ${remainHrs}h`;
  };

  // Toggle unit collapse
  const toggleUnit = (unitId: string) => {
    setCollapsedUnits((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  // Source badge colors for pending admits
  const SOURCE_COLOR: Record<string, string> = {
    ED: COLORS.crit,
    OR: COLORS.info,
    Transfer: '#A855F7',
    Direct: COLORS.ok,
  };

  // Row tint colors (very subtle)
  const STATE_ROW_TINT: Record<BedState, string> = {
    ready: 'rgba(16, 185, 129, 0.04)',
    occupied: 'transparent',
    dirty: 'rgba(245, 158, 11, 0.04)',
    not_staffed: 'rgba(249, 115, 22, 0.04)',
    blocked: 'rgba(239, 68, 68, 0.04)',
    reserved: 'rgba(168, 85, 247, 0.04)',
  };

  // Bed status display text
  const bedStatusText = (bed: Bed): string => {
    if (bed.state === 'ready') return 'AVAILABLE';
    if (bed.state === 'dirty') {
      const evs = bed.evsStatus === 'requested' ? 'EVS Requested' : bed.evsStatus === 'in_progress' ? 'EVS In Progress' : bed.evsStatus === 'complete' ? 'EVS Complete' : '';
      return evs ? `DIRTY \u2014 ${evs}` : 'DIRTY';
    }
    if (bed.state === 'blocked') return `BLOCKED \u2014 ${bed.blockReason || 'Unknown'}`;
    if (bed.state === 'reserved') return `RESERVED \u2014 ${bed.reservedFor || 'Pending'}`;
    if (bed.state === 'not_staffed') return 'NOT STAFFED';
    return '';
  };

  // Isolation badge labels
  const ISOLATION_LABEL: Record<string, { short: string; color: string }> = {
    CONTACT: { short: 'C', color: '#F97316' },
    DROPLET: { short: 'D', color: COLORS.warn },
    AIRBORNE: { short: 'A', color: COLORS.crit },
    PROTECTIVE: { short: 'P', color: COLORS.info },
  };

  if (embedded) {
    const sortedPending = pendingAdmits ? [...pendingAdmits].sort((a, b) => b.waitingMinutes - a.waitingMinutes) : [];

    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          overflow: 'hidden',
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
        }}
      >
        {/* ── HudStrip header ── */}
        <HudStrip side="top" fixed>
          <BracketLabel tone="accent">BED BOARD &mdash; COMMAND VIEW</BracketLabel>
          <div style={{ flex: 1 }} />
          {surgeActive && <StatusPill label="SURGE ACTIVE" tone="crit" pulse />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: SPACE.sm }}>
            <RefreshCw size={15} color={COLORS.textMuted} />
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: COLORS.textMuted,
            }}>
              REFRESH IN {refreshCountdown}s
            </span>
          </div>
        </HudStrip>

        {/* ── Content below header ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingTop: 52,
        }}>
          {/* ── Summary Bar: 6 stat boxes ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: SPACE.sm,
            padding: `${SPACE.base}px ${SPACE.lg}px`,
            background: COLORS.bgDeep,
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}>
            {[
              { label: 'TOTAL BEDS', value: summary.total, color: COLORS.textPrimary },
              { label: 'OCCUPIED', value: summary.occupied, color: COLORS.textSecondary },
              { label: 'AVAILABLE', value: summary.ready, color: COLORS.ok },
              { label: 'DIRTY', value: summary.dirty, color: COLORS.warn },
              { label: 'NOT STAFFED', value: summary.notStaffed, color: '#F97316' },
              { label: 'BLOCKED', value: summary.blocked, color: COLORS.crit },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  padding: `${SPACE.md}px ${SPACE.base}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span style={{
                  fontFamily: FONTS.sans,
                  fontSize: 40,
                  fontWeight: 700,
                  color: stat.color,
                  lineHeight: 1.1,
                }}>
                  {stat.value}
                </span>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  color: COLORS.textMuted,
                  marginTop: 4,
                  textTransform: 'uppercase',
                }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Filter Row ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.xs,
            padding: `${SPACE.sm}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}>
            {filters.map((f) => {
              const isActive = filter === f.key;
              const chipColor = f.key === 'all' ? COLORS.textSecondary : STATE_COLOR[f.key as BedState];
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: `5px ${SPACE.md}px`,
                    background: isActive ? `${chipColor}20` : 'transparent',
                    border: `1px solid ${isActive ? chipColor : COLORS.border}`,
                    borderRadius: RADIUS.full,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                >
                  {f.key !== 'all' && (
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: RADIUS.full,
                      background: chipColor,
                    }} />
                  )}
                  <span style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    color: isActive ? chipColor : COLORS.textMuted,
                    textTransform: 'uppercase',
                  }}>
                    {f.label}
                  </span>
                  <span style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    fontWeight: 600,
                    color: isActive ? chipColor : COLORS.textDim,
                  }}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Main content: Unit sections + Pending Admits sidebar ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}>
            {/* ── Left: Unit sections (scrollable) ── */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: `${SPACE.base}px ${SPACE.lg}px`,
            }}>
              {visibleUnits.map((unit) => {
                const uSummary = summarizeUnit(unit);
                const occupiedCount = uSummary.occupied + uSummary.reserved;
                const totalBeds = uSummary.total;
                const occupancyPct = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;
                const barColor = occupancyPct >= 90 ? COLORS.crit : occupancyPct >= 70 ? COLORS.warn : COLORS.ok;
                const isCollapsed = collapsedUnits.has(unit.id);

                return (
                  <div
                    key={unit.id}
                    style={{
                      marginBottom: SPACE.lg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Unit header */}
                    <div
                      onClick={() => toggleUnit(unit.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.sm,
                        padding: `${SPACE.sm}px ${SPACE.base}px`,
                        background: COLORS.surface,
                        borderBottom: isCollapsed ? 'none' : `1px solid ${COLORS.border}`,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {isCollapsed
                        ? <ChevronRight size={17} color={COLORS.textMuted} />
                        : <ChevronDown size={17} color={COLORS.textMuted} />
                      }
                      <span style={{
                        fontFamily: FONTS.mono,
                        fontSize: 16,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: COLORS.textPrimary,
                        textTransform: 'uppercase',
                      }}>
                        {unit.name}
                      </span>
                      {unit.surgeOnly && (
                        <StatusPill label="SURGE" tone="crit" pulse size="xs" />
                      )}
                      {/* Occupancy bar */}
                      <div style={{
                        flex: 1,
                        maxWidth: 180,
                        height: 8,
                        background: COLORS.bgDeep,
                        borderRadius: RADIUS.full,
                        overflow: 'hidden',
                        border: `1px solid ${COLORS.border}`,
                        marginLeft: SPACE.sm,
                      }}>
                        <div style={{
                          width: `${occupancyPct}%`,
                          height: '100%',
                          background: barColor,
                          borderRadius: RADIUS.full,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <span style={{
                        fontFamily: FONTS.mono,
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        color: COLORS.textSecondary,
                        whiteSpace: 'nowrap',
                      }}>
                        {occupancyPct}% ({occupiedCount}/{totalBeds} OCCUPIED)
                      </span>
                      <span style={{
                        fontFamily: FONTS.mono,
                        fontSize: 14,
                        fontWeight: 500,
                        color: COLORS.ok,
                        marginLeft: 'auto',
                        whiteSpace: 'nowrap',
                      }}>
                        {uSummary.ready} AVAIL
                      </span>
                    </div>

                    {/* Bed table */}
                    {!isCollapsed && (
                      <div>
                        {/* Table header */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '28px 64px 1fr 72px 110px 110px 72px 40px 80px',
                          gap: 0,
                          padding: `${SPACE.xs}px ${SPACE.base}px`,
                          background: COLORS.bgDeep,
                          borderBottom: `1px solid ${COLORS.border}`,
                        }}>
                          {['', 'BED', 'PATIENT', 'ACUITY', 'ATTENDING', 'NURSE', 'LOS', 'ISO', 'DC'].map((col) => (
                            <span key={col} style={{
                              fontFamily: FONTS.mono,
                              fontSize: 13,
                              fontWeight: 600,
                              letterSpacing: '0.14em',
                              color: COLORS.textDim,
                              textTransform: 'uppercase',
                              padding: `2px 4px`,
                            }}>
                              {col}
                            </span>
                          ))}
                        </div>
                        {/* Bed rows */}
                        {unit.beds.map((bed) => {
                          const dotColor = STATE_COLOR[bed.state];
                          const rowBg = STATE_ROW_TINT[bed.state];
                          const isOccupied = bed.state === 'occupied';
                          const showStatusText = !isOccupied;
                          const iso = bed.isolation && bed.isolation !== 'NONE' ? ISOLATION_LABEL[bed.isolation] : null;
                          const milestones = bed.dischargeMilestones;
                          return (
                            <div
                              key={bed.id}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setSelectedBed({ bed, anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width } });
                              }}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '28px 64px 1fr 72px 110px 110px 72px 40px 80px',
                                gap: 0,
                                padding: `0 ${SPACE.base}px`,
                                height: 44,
                                alignItems: 'center',
                                background: rowBg,
                                borderBottom: `1px solid ${COLORS.border}`,
                                cursor: 'pointer',
                                transition: `background ${MOTION.fast}s ease`,
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = COLORS.surfaceHover; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = rowBg; }}
                            >
                              {/* Status dot */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: RADIUS.full,
                                  background: dotColor,
                                  boxShadow: `0 0 4px ${dotColor}60`,
                                }} />
                              </div>
                              {/* Bed label */}
                              <span style={{
                                fontFamily: FONTS.mono,
                                fontSize: 17,
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                color: COLORS.textPrimary,
                                padding: '0 4px',
                              }}>
                                {bed.label}
                              </span>
                              {/* Patient name / status */}
                              <div style={{ padding: '0 4px', overflow: 'hidden' }}>
                                {isOccupied ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                                    <span style={{
                                      fontFamily: FONTS.sans,
                                      fontSize: 17,
                                      fontWeight: 500,
                                      color: COLORS.textPrimary,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}>
                                      {bed.patientName || bed.patientInitials || '--'}
                                    </span>
                                    {bed.mrn && (
                                      <span style={{
                                        fontFamily: FONTS.mono,
                                        fontSize: 14,
                                        color: COLORS.textMuted,
                                        letterSpacing: '0.06em',
                                      }}>
                                        {bed.mrn}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{
                                    fontFamily: FONTS.mono,
                                    fontSize: 15,
                                    fontWeight: 500,
                                    letterSpacing: '0.06em',
                                    color: dotColor,
                                  }}>
                                    {bedStatusText(bed)}
                                  </span>
                                )}
                              </div>
                              {/* Acuity badge */}
                              <div style={{ padding: '0 4px' }}>
                                {bed.acuity ? (
                                  <span style={{
                                    fontFamily: FONTS.mono,
                                    fontSize: 14,
                                    fontWeight: 700,
                                    letterSpacing: '0.06em',
                                    color: ACUITY_COLOR[bed.acuity],
                                    background: `${ACUITY_COLOR[bed.acuity]}18`,
                                    border: `1px solid ${ACUITY_COLOR[bed.acuity]}30`,
                                    borderRadius: RADIUS.sm,
                                    padding: '2px 6px',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    ESI-{bed.acuity}
                                  </span>
                                ) : (
                                  <span style={{ fontFamily: FONTS.mono, fontSize: 15, color: COLORS.textDim }}>--</span>
                                )}
                              </div>
                              {/* Attending */}
                              <span style={{
                                fontFamily: FONTS.sans,
                                fontSize: 16,
                                color: isOccupied ? COLORS.textSecondary : COLORS.textDim,
                                padding: '0 4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {bed.attending || '--'}
                              </span>
                              {/* Nurse */}
                              <span style={{
                                fontFamily: FONTS.sans,
                                fontSize: 16,
                                color: isOccupied ? COLORS.textSecondary : COLORS.textDim,
                                padding: '0 4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {bed.assignedNurse || '--'}
                              </span>
                              {/* LOS */}
                              <span style={{
                                fontFamily: FONTS.mono,
                                fontSize: 15,
                                fontWeight: 500,
                                color: isOccupied ? COLORS.textSecondary : COLORS.textDim,
                                padding: '0 4px',
                              }}>
                                {isOccupied ? formatLOS(bed.losHours) : '--'}
                              </span>
                              {/* Isolation */}
                              <div style={{ padding: '0 4px', display: 'flex', justifyContent: 'center' }}>
                                {iso ? (
                                  <span style={{
                                    fontFamily: FONTS.mono,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: iso.color,
                                    background: `${iso.color}18`,
                                    border: `1px solid ${iso.color}30`,
                                    borderRadius: RADIUS.sm,
                                    padding: '1px 4px',
                                    lineHeight: '16px',
                                  }}>
                                    {iso.short}
                                  </span>
                                ) : null}
                              </div>
                              {/* Discharge milestones */}
                              <div style={{ padding: '0 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
                                {milestones ? (
                                  <>
                                    <div title="DC Order" style={{
                                      width: 8, height: 8, borderRadius: RADIUS.full,
                                      background: milestones.dcOrderWritten ? COLORS.ok : COLORS.textDim,
                                      border: `1px solid ${milestones.dcOrderWritten ? COLORS.ok : COLORS.textDim}`,
                                    }} />
                                    <div title="Ride Confirmed" style={{
                                      width: 8, height: 8, borderRadius: RADIUS.full,
                                      background: milestones.rideConfirmed ? COLORS.ok : COLORS.textDim,
                                      border: `1px solid ${milestones.rideConfirmed ? COLORS.ok : COLORS.textDim}`,
                                    }} />
                                    <div title="Meds to Bedside" style={{
                                      width: 8, height: 8, borderRadius: RADIUS.full,
                                      background: milestones.medsToeBedside ? COLORS.ok : COLORS.textDim,
                                      border: `1px solid ${milestones.medsToeBedside ? COLORS.ok : COLORS.textDim}`,
                                    }} />
                                    {milestones.estimatedDcTime && (
                                      <span style={{
                                        fontFamily: FONTS.mono,
                                        fontSize: 13,
                                        color: COLORS.textMuted,
                                        marginLeft: 2,
                                      }}>
                                        {milestones.estimatedDcTime}
                                      </span>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleUnits.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: SPACE['3xl'],
                }}>
                  <Mono tone="muted">NO BEDS MATCH FILTER</Mono>
                </div>
              )}
            </div>

            {/* ── Right: Pending Admits Queue ── */}
            <div style={{
              width: 320,
              minWidth: 320,
              borderLeft: `1px solid ${COLORS.border}`,
              display: 'flex',
              flexDirection: 'column',
              background: COLORS.surface,
              overflow: 'hidden',
            }}>
              {/* Queue header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACE.sm}px ${SPACE.base}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: COLORS.textPrimary,
                  textTransform: 'uppercase',
                }}>
                  PENDING ADMITS
                </span>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  background: COLORS.accent,
                  borderRadius: RADIUS.full,
                  padding: '2px 8px',
                  lineHeight: '16px',
                }}>
                  {sortedPending.length}
                </span>
              </div>
              {/* Queue list */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}>
                {sortedPending.map((admit) => {
                  const waitColor = admit.waitingMinutes > 60 ? COLORS.crit : admit.waitingMinutes > 30 ? COLORS.warn : COLORS.ok;
                  const srcColor = SOURCE_COLOR[admit.source] || COLORS.textMuted;
                  return (
                    <div
                      key={admit.id}
                      style={{
                        padding: `${SPACE.sm}px ${SPACE.base}px`,
                        borderBottom: `1px solid ${COLORS.border}`,
                        display: 'flex',
                        gap: SPACE.sm,
                      }}
                    >
                      {/* Drag handle */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: COLORS.textDim,
                        flexShrink: 0,
                        cursor: 'grab',
                        paddingTop: 2,
                      }}>
                        <GripVertical size={17} />
                      </div>
                      {/* Card content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + MRN row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: 4 }}>
                          <span style={{
                            fontFamily: FONTS.sans,
                            fontSize: 17,
                            fontWeight: 600,
                            color: COLORS.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {admit.patientName}
                          </span>
                          <span style={{
                            fontFamily: FONTS.mono,
                            fontSize: 13,
                            color: COLORS.textMuted,
                            letterSpacing: '0.06em',
                            flexShrink: 0,
                          }}>
                            {admit.mrn}
                          </span>
                        </div>
                        {/* Source + Acuity badges */}
                        <div style={{ display: 'flex', gap: SPACE.xs, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: FONTS.mono,
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color: srcColor,
                            background: `${srcColor}18`,
                            border: `1px solid ${srcColor}30`,
                            borderRadius: RADIUS.sm,
                            padding: '1px 6px',
                          }}>
                            {admit.source.toUpperCase()}
                          </span>
                          <span style={{
                            fontFamily: FONTS.mono,
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            color: ACUITY_COLOR[admit.acuity],
                            background: `${ACUITY_COLOR[admit.acuity]}18`,
                            border: `1px solid ${ACUITY_COLOR[admit.acuity]}30`,
                            borderRadius: RADIUS.sm,
                            padding: '1px 6px',
                          }}>
                            ESI-{admit.acuity}
                          </span>
                        </div>
                        {/* Chief complaint */}
                        <div style={{
                          fontFamily: FONTS.sans,
                          fontSize: 15,
                          color: COLORS.textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 4,
                        }}>
                          {admit.chiefComplaint}
                        </div>
                        {/* Wait time + unit */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} color={waitColor} />
                            <span style={{
                              fontFamily: FONTS.mono,
                              fontSize: 14,
                              fontWeight: 600,
                              color: waitColor,
                              letterSpacing: '0.06em',
                            }}>
                              {admit.waitingMinutes}m
                            </span>
                          </div>
                          <span style={{
                            fontFamily: FONTS.mono,
                            fontSize: 13,
                            color: COLORS.textMuted,
                            letterSpacing: '0.08em',
                          }}>
                            &rarr; {admit.requestedUnit}
                          </span>
                        </div>
                        {/* Attending */}
                        <span style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          color: COLORS.textDim,
                        }}>
                          {admit.attending}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bed dropdown — anchored below clicked row */}
        <AnimatePresence>
          {selectedBed && (
            <BedPopover
              key="popover"
              bed={selectedBed.bed}
              anchor={selectedBed.anchor}
              onClose={() => setSelectedBed(null)}
              onNavigateToPatient={onNavigateToPatient}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

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
        paddingTop: 'env(safe-area-inset-top)',
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
          <X size={17} />
          <Mono tone="secondary" size="xs">CLOSE</Mono>
        </button>
      </HudStrip>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: `${SPACE.xl + 52}px ${SPACE.base}px 0`,
          paddingBottom: `max(env(safe-area-inset-bottom), ${SPACE.xl}px)`,
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
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  color: isActive ? chipColor : COLORS.textMuted,
                  textTransform: 'uppercase',
                }}>
                  {f.label}
                </span>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
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
            onBedTap={(bed, anchor) => setSelectedBed({ bed, anchor })}
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

      {/* Bed dropdown — anchored below clicked tile */}
      <AnimatePresence>
        {selectedBed && (
          <BedPopover
            key="popover"
            bed={selectedBed.bed}
            anchor={selectedBed.anchor}
            onClose={() => setSelectedBed(null)}
            onNavigateToPatient={onNavigateToPatient}
          />
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
  /** Current user role — drives default unit expansion and highlight. */
  role?: UserRole;
  /** When true, renders as inline desktop layout instead of mobile overlay. */
  embedded?: boolean;
  /** Callback when user clicks an occupied bed to navigate to a patient chart. */
  onNavigateToPatient?: (patientId: string) => void;
}

export const BedBoard: React.FC<BedBoardProps> = ({
  display,
  units,
  surgeActive = false,
  onExpand,
  onClose,
  open = false,
  role,
  embedded,
  onNavigateToPatient,
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
          role={role}
          embedded={embedded}
          onNavigateToPatient={onNavigateToPatient}
        />
      )}
    </AnimatePresence>
  );
};
