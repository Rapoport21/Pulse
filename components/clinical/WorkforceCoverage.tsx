/**
 * WorkforceCoverage — fullscreen overlay showing real-time staffing
 * and workforce coverage across all hospital units.
 *
 * Core PULSE innovation (Bucket A): nothing in current hospital software
 * gives charge nurses and administrators a unified, real-time view of
 * staffing ratios, coverage gaps, float pool availability, and upcoming
 * shift change impact in a single tactical surface.
 *
 * Sections:
 *   1. Summary Hero      — total staff, avg ratio, coverage status, shift countdown
 *   2. Unit Staffing     — per-unit cards with role breakdown + coverage bars
 *   3. Role Breakdown    — horizontal bar chart of filled vs needed by role
 *   4. Call/Float Pool   — available float nurses and on-call staff
 *   5. Shift Changes     — upcoming shift transitions with net impact
 *   6. Filter Controls   — unit, role, gaps-only toggle
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Users, AlertTriangle, Clock, Phone, ArrowRightLeft,
  ChevronDown, ChevronUp, Filter, RefreshCw, Activity,
  TrendingDown, TrendingUp, Shield, PhoneCall, PhoneOff, UserPlus,
} from 'lucide-react';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, Z, CHROME,
  Mono, BracketLabel, StatusPill, TacticalCard,
  TacticalButton, HudStrip, ScanningLine, Divider,
  ConfidenceBadge,
} from '../design';
import { UserRole } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface WorkforceCoverageProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** Current user role — drives default unit filter and gaps-only toggle. */
  role?: UserRole;
  /** When true, renders as inline desktop layout instead of mobile overlay. */
  embedded?: boolean;
}

type Role = 'RN' | 'MD' | 'RT' | 'Tech' | 'Charge';
type CoverageStatus = 'ADEQUATE' | 'STRAINED' | 'CRITICAL';
type FloatStatus = 'Available' | 'On-Call' | 'Called In' | 'En Route';
type UnitFilter = 'ALL' | string;

interface StaffCount { current: number; required: number; }
interface UnitStaffing {
  id: string;
  name: string;
  floor: string;
  patients: number;
  beds: number;
  roles: Record<Role, StaffCount>;
  nursePatientRatio: number;
}
interface FloatEntry {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  status: FloatStatus;
}
interface ShiftUnit {
  name: string;
  incoming: number;
  outgoing: number;
  gapAfter: number;
}
interface ShiftChange {
  time: string;
  label: string;
  units: ShiftUnit[];
}

// ─────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────

const UNITS: UnitStaffing[] = [
  { id: 'ed-trauma', name: 'ED-Trauma', floor: '1F', patients: 8, beds: 10, nursePatientRatio: 2.0,
    roles: { RN: { current: 4, required: 4 }, MD: { current: 2, required: 2 }, RT: { current: 1, required: 1 }, Tech: { current: 2, required: 2 }, Charge: { current: 1, required: 1 } } },
  { id: 'ed-acute', name: 'ED-Acute', floor: '1F', patients: 18, beds: 22, nursePatientRatio: 4.5,
    roles: { RN: { current: 4, required: 5 }, MD: { current: 2, required: 2 }, RT: { current: 1, required: 1 }, Tech: { current: 1, required: 2 }, Charge: { current: 1, required: 1 } } },
  { id: 'ed-fast', name: 'ED-Fast Track', floor: '1F', patients: 6, beds: 8, nursePatientRatio: 3.0,
    roles: { RN: { current: 2, required: 2 }, MD: { current: 1, required: 1 }, RT: { current: 0, required: 0 }, Tech: { current: 1, required: 1 }, Charge: { current: 0, required: 0 } } },
  { id: 'icu', name: 'ICU', floor: '3F', patients: 12, beds: 14, nursePatientRatio: 2.0,
    roles: { RN: { current: 6, required: 6 }, MD: { current: 2, required: 2 }, RT: { current: 2, required: 2 }, Tech: { current: 1, required: 1 }, Charge: { current: 1, required: 1 } } },
  { id: 'stepdown', name: 'Stepdown', floor: '3F', patients: 10, beds: 12, nursePatientRatio: 3.3,
    roles: { RN: { current: 3, required: 4 }, MD: { current: 1, required: 1 }, RT: { current: 1, required: 1 }, Tech: { current: 1, required: 1 }, Charge: { current: 1, required: 1 } } },
  { id: 'medsurg-2w', name: 'Med-Surg 2W', floor: '2F', patients: 24, beds: 28, nursePatientRatio: 6.0,
    roles: { RN: { current: 4, required: 5 }, MD: { current: 1, required: 1 }, RT: { current: 0, required: 1 }, Tech: { current: 2, required: 2 }, Charge: { current: 1, required: 1 } } },
  { id: 'medsurg-3e', name: 'Med-Surg 3E', floor: '3F', patients: 20, beds: 26, nursePatientRatio: 5.0,
    roles: { RN: { current: 4, required: 5 }, MD: { current: 1, required: 1 }, RT: { current: 1, required: 1 }, Tech: { current: 2, required: 2 }, Charge: { current: 1, required: 1 } } },
];

const FLOAT_POOL: FloatEntry[] = [
  { id: 'f1', name: 'M. Torres', credentials: 'RN, BSN', specialty: 'Med-Surg', status: 'Available' },
  { id: 'f2', name: 'J. Kim', credentials: 'RN, BSN', specialty: 'ICU', status: 'Available' },
  { id: 'f3', name: 'R. Patel', credentials: 'RN, BSN', specialty: 'ED', status: 'On-Call' },
  { id: 'f4', name: 'A. Washington', credentials: 'RT', specialty: 'Respiratory', status: 'On-Call' },
  { id: 'f5', name: 'L. Chen', credentials: 'RN, BSN', specialty: 'Stepdown', status: 'Called In' },
  { id: 'f6', name: 'D. Okafor', credentials: 'RN, MSN', specialty: 'ED', status: 'En Route' },
];

const SHIFT_CHANGES: ShiftChange[] = [
  { time: '19:00', label: 'Evening Shift', units: [
    { name: 'ED-Trauma', incoming: 4, outgoing: 5, gapAfter: 1 },
    { name: 'ED-Acute', incoming: 3, outgoing: 4, gapAfter: 2 },
    { name: 'ICU', incoming: 6, outgoing: 6, gapAfter: 0 },
    { name: 'Stepdown', incoming: 3, outgoing: 3, gapAfter: 1 },
    { name: 'Med-Surg 2W', incoming: 4, outgoing: 4, gapAfter: 2 },
    { name: 'Med-Surg 3E', incoming: 4, outgoing: 5, gapAfter: 1 },
  ]},
  { time: '07:00', label: 'Day Shift', units: [
    { name: 'ED-Trauma', incoming: 5, outgoing: 4, gapAfter: 0 },
    { name: 'ED-Acute', incoming: 5, outgoing: 3, gapAfter: 0 },
    { name: 'ICU', incoming: 6, outgoing: 6, gapAfter: 0 },
    { name: 'Stepdown', incoming: 4, outgoing: 3, gapAfter: 0 },
    { name: 'Med-Surg 2W', incoming: 5, outgoing: 4, gapAfter: 0 },
    { name: 'Med-Surg 3E', incoming: 5, outgoing: 4, gapAfter: 0 },
  ]},
];

const ALL_ROLES: Role[] = ['RN', 'MD', 'RT', 'Tech', 'Charge'];

/** Call-in / call-off tracker entries (desktop embedded only) */
interface CallEvent {
  id: string;
  name: string;
  type: 'call-in' | 'call-off';
  role: Role;
  unit: string;
  time: string;
}

const CALL_EVENTS: CallEvent[] = [
  { id: 'ce1', name: 'T. Rivera', type: 'call-off', role: 'RN', unit: 'ED-Acute', time: '14:22' },
  { id: 'ce2', name: 'S. Nguyen', type: 'call-in', role: 'RN', unit: 'Med-Surg 2W', time: '14:45' },
  { id: 'ce3', name: 'P. Martinez', type: 'call-off', role: 'Tech', unit: 'Stepdown', time: '15:01' },
  { id: 'ce4', name: 'K. Abrams', type: 'call-in', role: 'RT', unit: 'ICU', time: '15:18' },
  { id: 'ce5', name: 'W. Johnson', type: 'call-off', role: 'RN', unit: 'Med-Surg 3E', time: '15:30' },
];

/** State-mandated nurse-to-patient ratio limits by unit type */
const MANDATED_RATIOS: Record<string, number> = {
  'ED-Trauma': 2.0,
  'ED-Acute': 4.0,
  'ED-Fast Track': 4.0,
  'ICU': 2.0,
  'Stepdown': 3.0,
  'Med-Surg 2W': 5.0,
  'Med-Surg 3E': 5.0,
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function unitGap(u: UnitStaffing): number {
  return ALL_ROLES.reduce((sum, r) => sum + Math.max(0, u.roles[r].required - u.roles[r].current), 0);
}

function coverageStatus(units: UnitStaffing[]): CoverageStatus {
  const totalGap = units.reduce((s, u) => s + unitGap(u), 0);
  if (totalGap === 0) return 'ADEQUATE';
  if (totalGap <= 4) return 'STRAINED';
  return 'CRITICAL';
}

function coverageTone(s: CoverageStatus): 'ok' | 'warn' | 'crit' {
  return s === 'ADEQUATE' ? 'ok' : s === 'STRAINED' ? 'warn' : 'crit';
}

function ratioTone(ratio: number): 'ok' | 'warn' | 'crit' {
  if (ratio <= 4) return 'ok';
  if (ratio <= 5) return 'warn';
  return 'crit';
}

function ratioColor(ratio: number): string {
  const t = ratioTone(ratio);
  return t === 'ok' ? COLORS.ok : t === 'warn' ? COLORS.warn : COLORS.crit;
}

function coveragePercent(u: UnitStaffing): number {
  const req = ALL_ROLES.reduce((s, r) => s + u.roles[r].required, 0);
  if (req === 0) return 100;
  const cur = ALL_ROLES.reduce((s, r) => s + Math.min(u.roles[r].current, u.roles[r].required), 0);
  return Math.round((cur / req) * 100);
}

function statusDotColor(s: FloatStatus): string {
  if (s === 'Available') return COLORS.ok;
  if (s === 'On-Call') return COLORS.warn;
  if (s === 'Called In') return COLORS.info;
  return '#A855F7';
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const WorkforceCoverage: React.FC<WorkforceCoverageProps> = ({ open, onClose, showToast, role, embedded }) => {
  // Role-aware defaults:
  //  - Manager: see all units, all roles (full staffing dashboard)
  //  - Nurse: default to RN role filter, gaps-only on (what needs attention now)
  //  - ER: filter to ED-Trauma unit (trauma bay focus)
  const defaultUnitFilter: UnitFilter =
    role === UserRole.ER_PERSONNEL ? 'ed-trauma' : 'ALL';
  const defaultRoleFilter: Role | 'ALL' =
    role === UserRole.NURSE ? 'RN' : 'ALL';
  const defaultGapsOnly = role === UserRole.NURSE;

  const [unitFilter, setUnitFilter] = useState<UnitFilter>(defaultUnitFilter);
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>(defaultRoleFilter);
  const [gapsOnly, setGapsOnly] = useState(defaultGapsOnly);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (s: string) => setExpandedSection(prev => prev === s ? null : s);

  // ── Derived data ──────────────────────────────────────────────────────
  const filteredUnits = useMemo(() => {
    let result = UNITS;
    if (unitFilter !== 'ALL') result = result.filter(u => u.id === unitFilter);
    if (gapsOnly) result = result.filter(u => unitGap(u) > 0);
    return result;
  }, [unitFilter, gapsOnly]);

  const totalStaff = UNITS.reduce((s, u) => s + ALL_ROLES.reduce((rs, r) => rs + u.roles[r].current, 0), 0);
  const totalPatients = UNITS.reduce((s, u) => s + u.patients, 0);
  const avgRatio = totalPatients > 0
    ? (totalPatients / UNITS.reduce((s, u) => s + u.roles.RN.current, 0)).toFixed(1)
    : '0';
  const status = coverageStatus(UNITS);
  const tone = coverageTone(status);

  // Aggregate role breakdown
  const roleAgg = useMemo(() => ALL_ROLES.map(r => ({
    role: r,
    current: UNITS.reduce((s, u) => s + u.roles[r].current, 0),
    required: UNITS.reduce((s, u) => s + u.roles[r].required, 0),
  })), []);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleCallIn = (entry: FloatEntry) => {
    showToast(`Paging ${entry.name} (${entry.credentials}) — call-in initiated`);
  };

  const handleReassign = (entry: FloatEntry) => {
    showToast(`Float reassignment initiated for ${entry.name}`);
  };

  // ── Render: Summary Hero ──────────────────────────────────────────────
  const renderHero = () => (
    <div style={{ padding: `${SPACE.base}px ${SPACE.base}px 0` }}>
      <TacticalCard padding="lg">
        <ScanningLine duration={18} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.md, marginBottom: SPACE.md }}>
          <span style={{
            fontFamily: FONTS.sans, fontSize: 48, fontWeight: 600,
            letterSpacing: '-0.04em', lineHeight: 0.9,
            color: COLORS.textPrimary,
          }}>
            {totalStaff}
          </span>
          <Mono tone="muted" size="sm">STAFF ON SHIFT</Mono>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.md, marginBottom: SPACE.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
            <Mono tone="muted" size="xs">RATIO</Mono>
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
              1:{avgRatio}
            </span>
            <Mono tone="muted" size="xs">AVG NURSE:PT</Mono>
          </div>
        </div>

        <Divider style={{ margin: `${SPACE.sm}px 0` }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.md }}>
          <StatusPill label={status} tone={tone} pulse={status !== 'ADEQUATE'} />
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
            <Clock size={12} color={COLORS.textMuted} />
            <Mono tone="secondary" size="xs">NEXT SHIFT 19:00 (3H 22M)</Mono>
          </div>
        </div>
      </TacticalCard>
    </div>
  );

  // ── Render: Filter Controls ───────────────────────────────────────────
  const renderFilters = () => (
    <div style={{ padding: `${SPACE.md}px ${SPACE.base}px`, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <Filter size={12} color={COLORS.textMuted} />
        <Mono tone="muted" size="xs">FILTERS</Mono>
      </div>

      {/* Unit filter */}
      <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
        {['ALL', ...UNITS.map(u => u.id)].map(id => {
          const isActive = unitFilter === id;
          const label = id === 'ALL' ? 'ALL' : UNITS.find(u => u.id === id)?.name ?? id;
          return (
            <button key={id} onClick={() => setUnitFilter(id)}
              style={{
                padding: `3px ${SPACE.sm}px`, background: isActive ? `${COLORS.accent}20` : 'transparent',
                border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`, borderRadius: RADIUS.sm,
                cursor: 'pointer',
              }}>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
                letterSpacing: '0.1em', color: isActive ? COLORS.accent : COLORS.textMuted,
                textTransform: 'uppercase',
              }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Role filter + gaps toggle */}
      <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['ALL', ...ALL_ROLES] as const).map(r => {
          const isActive = roleFilter === r;
          return (
            <button key={r} onClick={() => setRoleFilter(r)}
              style={{
                padding: `3px ${SPACE.sm}px`, background: isActive ? `${COLORS.info}20` : 'transparent',
                border: `1px solid ${isActive ? COLORS.info : COLORS.border}`, borderRadius: RADIUS.sm,
                cursor: 'pointer',
              }}>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
                letterSpacing: '0.1em', color: isActive ? COLORS.info : COLORS.textMuted,
                textTransform: 'uppercase',
              }}>{r}</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button onClick={() => setGapsOnly(g => !g)}
          style={{
            padding: `3px ${SPACE.sm}px`,
            background: gapsOnly ? `${COLORS.crit}20` : 'transparent',
            border: `1px solid ${gapsOnly ? COLORS.crit : COLORS.border}`,
            borderRadius: RADIUS.sm, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
          <AlertTriangle size={9} color={gapsOnly ? COLORS.crit : COLORS.textMuted} />
          <span style={{
            fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
            letterSpacing: '0.1em', color: gapsOnly ? COLORS.crit : COLORS.textMuted,
          }}>GAPS ONLY</span>
        </button>
      </div>
    </div>
  );

  // ── Render: Unit Staffing Cards ───────────────────────────────────────
  const renderUnitCards = () => (
    <div style={{ padding: `0 ${SPACE.base}px`, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs }}>
        <BracketLabel tone="accent" size="xs">UNIT STAFFING</BracketLabel>
        <Mono tone="muted" size="xs">{filteredUnits.length} UNITS</Mono>
      </div>

      {filteredUnits.map(unit => {
        const gap = unitGap(unit);
        const covPct = coveragePercent(unit);
        const rTone = ratioTone(unit.nursePatientRatio);
        const accentColor = gap > 0 ? (gap >= 3 ? COLORS.crit : COLORS.warn) : COLORS.ok;
        const visibleRoles = roleFilter === 'ALL' ? ALL_ROLES : ALL_ROLES.filter(r => r === roleFilter);

        return (
          <TacticalCard key={unit.id} padding="md" style={{
            borderLeft: `3px solid ${accentColor}`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm }}>
              <div>
                <span style={{
                  fontFamily: FONTS.sans, fontSize: TYPE.h4.size, fontWeight: TYPE.h4.weight,
                  color: COLORS.textPrimary,
                }}>{unit.name}</span>
                <Mono tone="muted" size="xs" style={{ marginLeft: SPACE.sm }}>{unit.floor}</Mono>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                {gap > 0 && (
                  <span style={{
                    padding: `1px ${SPACE.sm}px`, background: `${COLORS.crit}20`,
                    border: `1px solid ${COLORS.crit}40`, borderRadius: RADIUS.sm,
                    fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.1em', color: COLORS.crit,
                  }}>GAP -{gap}</span>
                )}
                <StatusPill label={`1:${unit.nursePatientRatio.toFixed(1)}`} tone={rTone} size="xs" />
              </div>
            </div>

            {/* Patient load */}
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
              <Mono tone="muted" size="xs">PATIENTS</Mono>
              <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>
                {unit.patients}/{unit.beds}
              </span>
              <Mono tone="muted" size="xs">BEDS</Mono>
            </div>

            {/* Role counts */}
            <div style={{ display: 'flex', gap: SPACE.md, flexWrap: 'wrap', marginBottom: SPACE.md }}>
              {visibleRoles.filter(r => unit.roles[r].required > 0).map(r => {
                const s = unit.roles[r];
                const short = s.current < s.required;
                return (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
                      letterSpacing: '0.1em', color: COLORS.textMuted,
                    }}>{r}</span>
                    <span style={{
                      fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                      color: short ? COLORS.crit : COLORS.ok,
                    }}>{s.current}/{s.required}</span>
                  </div>
                );
              })}
            </div>

            {/* Coverage bar */}
            <div style={{ position: 'relative', height: 4, background: `${COLORS.crit}30`, borderRadius: RADIUS.full, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${covPct}%` }}
                transition={{ duration: MOTION.base, ease: MOTION.ease }}
                style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0,
                  background: covPct === 100 ? COLORS.ok : covPct >= 80 ? COLORS.warn : COLORS.crit,
                  borderRadius: RADIUS.full,
                }}
              />
            </div>
            <Mono tone="muted" size="xs" style={{ marginTop: SPACE.xs, display: 'block' }}>
              {covPct}% COVERAGE
            </Mono>
          </TacticalCard>
        );
      })}

      {filteredUnits.length === 0 && (
        <div style={{ textAlign: 'center', padding: SPACE['2xl'] }}>
          <Mono tone="muted">NO UNITS MATCH FILTERS</Mono>
        </div>
      )}
    </div>
  );

  // ── Render: Role Breakdown ────────────────────────────────────────────
  const renderRoleBreakdown = () => {
    const isOpen = expandedSection === 'roles';
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('roles')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <BracketLabel tone="accent" size="xs">ROLE BREAKDOWN</BracketLabel>
          {isOpen ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: MOTION.fast }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, paddingBottom: SPACE.base }}>
                {roleAgg.map(({ role, current, required }) => {
                  const gap = Math.max(0, required - current);
                  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100;
                  const barTone = gap === 0 ? COLORS.ok : gap === 1 ? COLORS.warn : COLORS.crit;
                  return (
                    <div key={role}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Mono tone="secondary" size="xs">{role}</Mono>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color: barTone }}>
                            {current}/{required}
                          </span>
                          {gap > 0 && (
                            <span style={{
                              fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, color: COLORS.crit,
                              padding: `0 4px`, background: `${COLORS.crit}18`, borderRadius: RADIUS.sm,
                            }}>-{gap}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ position: 'relative', height: 6, background: `${COLORS.border}`, borderRadius: RADIUS.full, overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, bottom: 0,
                          width: `${pct}%`, background: barTone, borderRadius: RADIUS.full,
                          transition: `width ${MOTION.base}s ease`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Render: Float Pool ────────────────────────────────────────────────
  const renderFloatPool = () => {
    const isOpen = expandedSection === 'float';
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('float')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <BracketLabel tone="accent" size="xs">CALL / FLOAT POOL</BracketLabel>
            <Mono tone="muted" size="xs">{FLOAT_POOL.length} STAFF</Mono>
          </div>
          {isOpen ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: MOTION.fast }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, paddingBottom: SPACE.base }}>
                {FLOAT_POOL.map(entry => (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: SPACE.md,
                    padding: SPACE.md, background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
                  }}>
                    {/* Status dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: RADIUS.full, flexShrink: 0,
                      background: statusDotColor(entry.status),
                      boxShadow: `0 0 6px ${statusDotColor(entry.status)}60`,
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, fontWeight: 500, color: COLORS.textPrimary }}>
                        {entry.name}
                      </div>
                      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: 2 }}>
                        <Mono tone="muted" size="xs">{entry.credentials}</Mono>
                        <Mono tone="muted" size="xs">{entry.specialty}</Mono>
                      </div>
                    </div>

                    {/* Status label */}
                    <Mono tone={entry.status === 'Available' ? 'ok' : entry.status === 'En Route' ? 'info' : 'warn'} size="xs">
                      {entry.status.toUpperCase()}
                    </Mono>

                    {/* Actions */}
                    {entry.status === 'On-Call' && (
                      <TacticalButton variant="primary" size="sm" onClick={() => handleCallIn(entry)}
                        icon={<Phone size={10} />}>
                        Call In
                      </TacticalButton>
                    )}
                    {entry.status === 'Available' && (
                      <TacticalButton variant="secondary" size="sm" onClick={() => handleReassign(entry)}
                        icon={<ArrowRightLeft size={10} />}>
                        Reassign
                      </TacticalButton>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Render: Shift Changes ─────────────────────────────────────────────
  const renderShiftChanges = () => {
    const isOpen = expandedSection === 'shifts';
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('shifts')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <BracketLabel tone="accent" size="xs">UPCOMING SHIFT CHANGES</BracketLabel>
          {isOpen ? <ChevronUp size={14} color={COLORS.textMuted} /> : <ChevronDown size={14} color={COLORS.textMuted} />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: MOTION.fast }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.base, paddingBottom: SPACE.base }}>
                {SHIFT_CHANGES.map(shift => {
                  const totalIn = shift.units.reduce((s, u) => s + u.incoming, 0);
                  const totalOut = shift.units.reduce((s, u) => s + u.outgoing, 0);
                  const totalGaps = shift.units.reduce((s, u) => s + u.gapAfter, 0);

                  return (
                    <TacticalCard key={shift.time} padding="md">
                      {/* Shift header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <span style={{
                            fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700,
                            color: COLORS.textPrimary, letterSpacing: '0.02em',
                          }}>{shift.time}</span>
                          <Mono tone="secondary" size="xs">{shift.label}</Mono>
                        </div>
                        <div style={{ display: 'flex', gap: SPACE.md }}>
                          <Mono tone="ok" size="xs">IN {totalIn}</Mono>
                          <Mono tone="secondary" size="xs">OUT {totalOut}</Mono>
                          {totalGaps > 0 && <Mono tone="crit" size="xs">GAPS {totalGaps}</Mono>}
                        </div>
                      </div>

                      <Divider style={{ margin: `0 0 ${SPACE.md}px` }} />

                      {/* Per-unit breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {shift.units.map(su => {
                          const net = su.incoming - su.outgoing;
                          return (
                            <div key={su.name} style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                              <Mono tone="secondary" size="xs" style={{ width: 90, flexShrink: 0 }}>{su.name}</Mono>

                              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flex: 1 }}>
                                <Mono tone="ok" size="xs">{su.incoming} IN</Mono>
                                <Mono tone="muted" size="xs">/</Mono>
                                <Mono tone="secondary" size="xs">{su.outgoing} OUT</Mono>
                              </div>

                              <span style={{
                                fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
                                color: net > 0 ? COLORS.ok : net < 0 ? COLORS.crit : COLORS.textMuted,
                              }}>
                                {net > 0 ? `+${net}` : net === 0 ? '--' : net}
                              </span>

                              {su.gapAfter > 0 && (
                                <span style={{
                                  padding: `0 4px`, background: `${COLORS.crit}20`,
                                  border: `1px solid ${COLORS.crit}35`, borderRadius: RADIUS.sm,
                                  fontFamily: FONTS.mono, fontSize: 8, fontWeight: 600,
                                  letterSpacing: '0.1em', color: COLORS.crit,
                                }}>GAP -{su.gapAfter}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TacticalCard>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────

  // ── Embedded mode: full-screen desktop staffing command center ──────────
  // State for desktop-only features
  const [refreshCountdown, setRefreshCountdown] = useState(30);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Auto-refresh countdown
  useEffect(() => {
    if (!embedded) return;
    const iv = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [embedded]);

  // Aggregated KPI computations
  const totalGaps = useMemo(() => UNITS.reduce((s, u) => s + unitGap(u), 0), []);
  const floatAvailable = useMemo(() => FLOAT_POOL.filter(f => f.status === 'Available').length, []);
  const coveragePct = useMemo(() => {
    const req = UNITS.reduce((s, u) => s + ALL_ROLES.reduce((rs, r) => rs + u.roles[r].required, 0), 0);
    const cur = UNITS.reduce((s, u) => s + ALL_ROLES.reduce((rs, r) => rs + Math.min(u.roles[r].current, u.roles[r].required), 0), 0);
    return req > 0 ? Math.round((cur / req) * 100) : 100;
  }, []);
  const roleBreakdownCounts = useMemo(() => {
    const out: Record<Role, number> = { RN: 0, MD: 0, RT: 0, Tech: 0, Charge: 0 };
    UNITS.forEach(u => ALL_ROLES.forEach(r => { out[r] += u.roles[r].current; }));
    return out;
  }, []);
  const callNetImpact = useMemo(() => {
    return CALL_EVENTS.reduce((net, e) => net + (e.type === 'call-in' ? 1 : -1), 0);
  }, []);

  // Next shift countdown
  const nextShiftCountdown = useMemo(() => {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    // Next shift at 19:00 or 07:00
    let targetH = hh < 7 ? 7 : hh < 19 ? 19 : 7;
    let diffMin = (targetH * 60) - (hh * 60 + mm);
    if (diffMin <= 0) diffMin += 24 * 60;
    const hrs = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }, []);

  // Coverage color helper
  const covColor = coveragePct >= 95 ? COLORS.ok : coveragePct >= 80 ? COLORS.warn : COLORS.crit;

  if (embedded) {
    // ── Table: column header style
    const thStyle: React.CSSProperties = {
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.14em',
      color: COLORS.textDim,
      textTransform: 'uppercase',
      padding: `6px 8px`,
      textAlign: 'left',
      whiteSpace: 'nowrap',
    };
    // ── Table: data cell style
    const tdStyle: React.CSSProperties = {
      fontFamily: FONTS.mono,
      fontSize: 12,
      fontWeight: 500,
      color: COLORS.textSecondary,
      padding: `0 8px`,
      whiteSpace: 'nowrap',
    };
    // ── Role cell: current/required with gap coloring
    const RoleCell: React.FC<{ s: StaffCount }> = ({ s }) => {
      const short = s.current < s.required;
      const over = s.current > s.required;
      return (
        <span style={{
          ...tdStyle,
          color: short ? COLORS.crit : over ? COLORS.info : COLORS.ok,
          fontWeight: 600,
        }}>
          {s.current}/{s.required}
        </span>
      );
    };

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
        {/* ════════════════════════════════════════════════════════════════
            1. HEADER — HudStrip
        ════════════════════════════════════════════════════════════════ */}
        <HudStrip side="top" fixed>
          <BracketLabel tone="accent">WORKFORCE COMMAND</BracketLabel>
          <div style={{ flex: 1 }} />
          <StatusPill
            label={status}
            tone={tone}
            pulse={status !== 'ADEQUATE'}
          />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: `2px ${SPACE.md}px`,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
          }}>
            <Users size={12} color={COLORS.textMuted} />
            <span style={{
              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700,
              color: COLORS.textPrimary, letterSpacing: '0.04em',
            }}>{totalStaff}</span>
            <Mono tone="muted" size="xs">ON DUTY</Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} color={COLORS.textMuted} />
            <Mono tone="muted" size="xs">REFRESH {refreshCountdown}S</Mono>
          </div>
          <ConfidenceBadge confidence={92} ageMinutes={1} />
        </HudStrip>

        {/* ════════════════════════════════════════════════════════════════
            2. SUMMARY HERO BAR — 6 KPI cells
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: SPACE.sm,
          padding: `${SPACE.base}px ${SPACE.lg}px`,
          paddingTop: CHROME.headerHeight + SPACE.base,
          background: COLORS.bgDeep,
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}>
          {/* KPI: Total Staff */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 32, fontWeight: 700,
              color: COLORS.textPrimary, lineHeight: 1.1,
            }}>{totalStaff}</span>
            <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>STAFF ON DUTY</Mono>
            <div style={{
              display: 'flex', gap: SPACE.sm, marginTop: 6, flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              {ALL_ROLES.map(r => (
                <span key={r} style={{
                  fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
                  color: COLORS.textDim, letterSpacing: '0.08em',
                }}>{r} {roleBreakdownCounts[r]}</span>
              ))}
            </div>
          </div>

          {/* KPI: Overall Coverage */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 32, fontWeight: 700,
              color: covColor, lineHeight: 1.1,
            }}>{coveragePct}%</span>
            <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>COVERAGE</Mono>
            <div style={{
              width: '80%', height: 4, background: COLORS.border,
              borderRadius: RADIUS.full, overflow: 'hidden', marginTop: 6,
            }}>
              <div style={{
                width: `${coveragePct}%`, height: '100%',
                background: covColor, borderRadius: RADIUS.full,
              }} />
            </div>
          </div>

          {/* KPI: Avg Nurse:Patient Ratio */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{
                fontFamily: FONTS.sans, fontSize: 32, fontWeight: 700,
                color: ratioColor(parseFloat(avgRatio)), lineHeight: 1.1,
              }}>1:{avgRatio}</span>
              {parseFloat(avgRatio) > 4.5
                ? <TrendingUp size={14} color={COLORS.crit} />
                : <TrendingDown size={14} color={COLORS.ok} />
              }
            </div>
            <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>AVG RN:PT RATIO</Mono>
          </div>

          {/* KPI: Open Gaps */}
          <div style={{
            background: totalGaps > 0 ? `${COLORS.crit}08` : COLORS.surface,
            border: `1px solid ${totalGaps > 0 ? `${COLORS.crit}40` : COLORS.border}`,
            borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 32, fontWeight: 700,
              color: totalGaps > 0 ? COLORS.crit : COLORS.ok, lineHeight: 1.1,
            }}>{totalGaps}</span>
            <Mono tone={totalGaps > 0 ? 'crit' : 'muted'} size="xs" style={{ marginTop: 4 }}>
              OPEN GAPS
            </Mono>
          </div>

          {/* KPI: Float Pool Available */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 32, fontWeight: 700,
              color: floatAvailable > 0 ? COLORS.info : COLORS.warn, lineHeight: 1.1,
            }}>{floatAvailable}</span>
            <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>FLOAT AVAIL</Mono>
            <Mono tone="dim" size="xs" style={{ marginTop: 2 }}>
              {FLOAT_POOL.length} TOTAL POOL
            </Mono>
          </div>

          {/* KPI: Next Shift Countdown */}
          <div style={{
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm, padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <span style={{
              fontFamily: FONTS.mono, fontSize: 30, fontWeight: 700,
              color: COLORS.textPrimary, lineHeight: 1.1, letterSpacing: '0.02em',
            }}>{nextShiftCountdown}</span>
            <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>NEXT SHIFT</Mono>
            <Mono tone="dim" size="xs" style={{ marginTop: 2 }}>
              {SHIFT_CHANGES[0].time} {SHIFT_CHANGES[0].label.toUpperCase()}
            </Mono>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            3. MAIN CONTENT — 70/30 split
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}>
          {/* ── LEFT COLUMN (70%): Filters + Unit Table + Role Breakdown ── */}
          <div style={{
            flex: 7,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: `1px solid ${COLORS.border}`,
          }}>
            {/* ── Filter Bar ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderBottom: `1px solid ${COLORS.border}`,
              flexShrink: 0,
              flexWrap: 'wrap',
              background: COLORS.surface,
            }}>
              <Filter size={12} color={COLORS.textMuted} />
              <Mono tone="muted" size="xs">UNIT</Mono>

              {/* Unit filter pills */}
              <select
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                style={{
                  background: COLORS.surfaceElev,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  padding: `4px ${SPACE.sm}px`,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                <option value="ALL">ALL UNITS</option>
                {UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <div style={{ width: 1, height: 20, background: COLORS.border }} />
              <Mono tone="muted" size="xs">ROLE</Mono>

              {/* Role filter pills */}
              {(['ALL', ...ALL_ROLES] as const).map(r => {
                const isActive = roleFilter === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    style={{
                      padding: `4px ${SPACE.md}px`,
                      background: isActive ? `${COLORS.info}20` : 'transparent',
                      border: `1px solid ${isActive ? COLORS.info : COLORS.border}`,
                      borderRadius: RADIUS.full,
                      cursor: 'pointer',
                      transition: `all ${MOTION.fast}s ease`,
                    }}
                  >
                    <span style={{
                      fontFamily: FONTS.mono, fontSize: 11, fontWeight: 500,
                      letterSpacing: '0.1em', color: isActive ? COLORS.info : COLORS.textMuted,
                      textTransform: 'uppercase',
                    }}>{r}</span>
                  </button>
                );
              })}

              <div style={{ flex: 1 }} />

              {/* Gaps-only toggle */}
              <button
                onClick={() => setGapsOnly(g => !g)}
                style={{
                  padding: `4px ${SPACE.md}px`,
                  background: gapsOnly ? `${COLORS.crit}20` : 'transparent',
                  border: `1px solid ${gapsOnly ? COLORS.crit : COLORS.border}`,
                  borderRadius: RADIUS.full,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: `all ${MOTION.fast}s ease`,
                }}
              >
                <AlertTriangle size={11} color={gapsOnly ? COLORS.crit : COLORS.textMuted} />
                <span style={{
                  fontFamily: FONTS.mono, fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.1em', color: gapsOnly ? COLORS.crit : COLORS.textMuted,
                }}>GAPS ONLY</span>
              </button>
            </div>

            {/* ── Scrollable content area ── */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>
              {/* ── Unit Staffing TABLE ── */}
              <div style={{ minWidth: 0 }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 48px 80px 72px 72px 72px 72px 72px 72px 56px 72px',
                  padding: `0 ${SPACE.lg}px`,
                  background: COLORS.bgDeep,
                  borderBottom: `1px solid ${COLORS.border}`,
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}>
                  {['UNIT', 'FLR', 'CENSUS/CAP', 'RN', 'MD', 'RT', 'TECH', 'CHARGE', 'RATIO', 'GAP', 'STATUS'].map(col => (
                    <span key={col} style={thStyle}>{col}</span>
                  ))}
                </div>

                {/* Table rows */}
                {filteredUnits.map(unit => {
                  const gap = unitGap(unit);
                  const covPct = coveragePercent(unit);
                  const rTone = ratioTone(unit.nursePatientRatio);
                  const rowStatus: CoverageStatus = gap === 0 ? 'ADEQUATE' : gap <= 2 ? 'STRAINED' : 'CRITICAL';
                  const rowBg = rowStatus === 'CRITICAL' ? `${COLORS.crit}06`
                    : rowStatus === 'STRAINED' ? `${COLORS.warn}04`
                    : 'transparent';
                  const isExpanded = expandedRow === unit.id;

                  return (
                    <React.Fragment key={unit.id}>
                      <div
                        onClick={() => setExpandedRow(isExpanded ? null : unit.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '160px 48px 80px 72px 72px 72px 72px 72px 72px 56px 72px',
                          padding: `0 ${SPACE.lg}px`,
                          height: 44,
                          alignItems: 'center',
                          background: rowBg,
                          borderBottom: `1px solid ${COLORS.border}`,
                          cursor: 'pointer',
                          transition: `background ${MOTION.fast}s ease`,
                          borderLeft: gap > 0
                            ? `3px solid ${gap >= 3 ? COLORS.crit : COLORS.warn}`
                            : `3px solid ${COLORS.ok}`,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = COLORS.surfaceHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}
                      >
                        {/* Unit name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
                          {isExpanded
                            ? <ChevronUp size={12} color={COLORS.textMuted} />
                            : <ChevronDown size={12} color={COLORS.textMuted} />
                          }
                          <span style={{
                            fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600,
                            color: COLORS.textPrimary,
                          }}>{unit.name}</span>
                        </div>
                        {/* Floor */}
                        <span style={tdStyle}>{unit.floor}</span>
                        {/* Census/Cap */}
                        <span style={{
                          ...tdStyle,
                          fontWeight: 600,
                          color: unit.patients / unit.beds > 0.9 ? COLORS.warn : COLORS.textSecondary,
                        }}>{unit.patients}/{unit.beds}</span>
                        {/* RN */}
                        <RoleCell s={unit.roles.RN} />
                        {/* MD */}
                        <RoleCell s={unit.roles.MD} />
                        {/* RT */}
                        <RoleCell s={unit.roles.RT} />
                        {/* Tech */}
                        <RoleCell s={unit.roles.Tech} />
                        {/* Charge */}
                        <RoleCell s={unit.roles.Charge} />
                        {/* Ratio */}
                        <span style={{
                          ...tdStyle,
                          fontWeight: 600,
                          color: ratioColor(unit.nursePatientRatio),
                        }}>1:{unit.nursePatientRatio.toFixed(1)}</span>
                        {/* Gap */}
                        <span style={{
                          ...tdStyle,
                          fontWeight: 700,
                          color: gap > 0 ? COLORS.crit : COLORS.ok,
                        }}>{gap > 0 ? `-${gap}` : '--'}</span>
                        {/* Status */}
                        <StatusPill
                          label={rowStatus === 'ADEQUATE' ? 'OK' : rowStatus === 'STRAINED' ? 'WARN' : 'CRIT'}
                          tone={rowStatus === 'ADEQUATE' ? 'ok' : rowStatus === 'STRAINED' ? 'warn' : 'crit'}
                          size="xs"
                        />
                      </div>

                      {/* Expanded row detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: MOTION.fast }}
                            style={{
                              overflow: 'hidden',
                              background: COLORS.surfaceElev,
                              borderBottom: `1px solid ${COLORS.border}`,
                            }}
                          >
                            <div style={{
                              padding: `${SPACE.md}px ${SPACE.lg}px ${SPACE.md}px 48px`,
                              display: 'flex', gap: SPACE['2xl'], flexWrap: 'wrap',
                            }}>
                              {/* Per-role detail */}
                              {ALL_ROLES.filter(r => unit.roles[r].required > 0).map(r => {
                                const s = unit.roles[r];
                                const short = s.current < s.required;
                                const delta = s.current - s.required;
                                return (
                                  <div key={r} style={{
                                    display: 'flex', flexDirection: 'column', gap: 4,
                                    minWidth: 100,
                                  }}>
                                    <Mono tone="secondary" size="xs">{r}</Mono>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                      <span style={{
                                        fontFamily: FONTS.sans, fontSize: 22, fontWeight: 700,
                                        color: short ? COLORS.crit : COLORS.ok,
                                      }}>{s.current}</span>
                                      <span style={{
                                        fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim,
                                      }}>/ {s.required} req</span>
                                    </div>
                                    {delta !== 0 && (
                                      <span style={{
                                        fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
                                        color: delta > 0 ? COLORS.ok : COLORS.crit,
                                        padding: `1px 6px`,
                                        background: delta > 0 ? COLORS.okDim : COLORS.critDim,
                                        borderRadius: RADIUS.sm,
                                        alignSelf: 'flex-start',
                                      }}>{delta > 0 ? `+${delta} OVER` : `${delta} SHORT`}</span>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Coverage mini-bar */}
                              <div style={{ minWidth: 140, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Mono tone="secondary" size="xs">COVERAGE</Mono>
                                <div style={{
                                  width: '100%', height: 8, background: COLORS.border,
                                  borderRadius: RADIUS.full, overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${covPct}%`, height: '100%',
                                    background: covPct === 100 ? COLORS.ok : covPct >= 80 ? COLORS.warn : COLORS.crit,
                                    borderRadius: RADIUS.full,
                                    transition: `width ${MOTION.base}s ease`,
                                  }} />
                                </div>
                                <Mono tone="muted" size="xs">{covPct}% STAFFED</Mono>
                              </div>
                              {/* Mandated ratio check */}
                              <div style={{ minWidth: 120, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Mono tone="secondary" size="xs">MANDATED RATIO</Mono>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                  <span style={{
                                    fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700,
                                    color: COLORS.textPrimary,
                                  }}>1:{MANDATED_RATIOS[unit.name] ?? '?'}</span>
                                  {unit.nursePatientRatio <= (MANDATED_RATIOS[unit.name] ?? 999)
                                    ? <Shield size={12} color={COLORS.ok} />
                                    : <AlertTriangle size={12} color={COLORS.crit} />
                                  }
                                </div>
                                <Mono
                                  tone={unit.nursePatientRatio <= (MANDATED_RATIOS[unit.name] ?? 999) ? 'ok' : 'crit'}
                                  size="xs"
                                >
                                  {unit.nursePatientRatio <= (MANDATED_RATIOS[unit.name] ?? 999) ? 'COMPLIANT' : 'OUT OF COMPLIANCE'}
                                </Mono>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}

                {filteredUnits.length === 0 && (
                  <div style={{ textAlign: 'center', padding: SPACE['3xl'] }}>
                    <Mono tone="muted">NO UNITS MATCH CURRENT FILTERS</Mono>
                  </div>
                )}
              </div>

              {/* ── Role Breakdown Horizontal Bar Chart ── */}
              <div style={{
                padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE.base}px`,
                borderTop: `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.sm,
                  marginBottom: SPACE.base,
                }}>
                  <BracketLabel tone="accent" size="xs">ROLE BREAKDOWN</BracketLabel>
                  <Mono tone="muted" size="xs">FILLED VS REQUIRED — ALL UNITS</Mono>
                </div>

                <div style={{ display: 'flex', gap: SPACE.lg, flexWrap: 'wrap' }}>
                  {roleAgg.map(({ role: r, current, required }) => {
                    const gap = Math.max(0, required - current);
                    const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100;
                    const barColor = gap === 0 ? COLORS.ok : gap <= 1 ? COLORS.warn : COLORS.crit;
                    return (
                      <div key={r} style={{ flex: '1 1 120px', minWidth: 120 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 4,
                        }}>
                          <Mono tone="secondary" size="xs">{r}</Mono>
                          <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
                            <span style={{
                              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600,
                              color: barColor,
                            }}>{current}/{required}</span>
                            {gap > 0 && (
                              <span style={{
                                fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600,
                                color: COLORS.crit, padding: '0 4px',
                                background: COLORS.critDim, borderRadius: RADIUS.sm,
                              }}>-{gap}</span>
                            )}
                          </div>
                        </div>
                        <div style={{
                          position: 'relative', height: 10,
                          background: COLORS.border, borderRadius: RADIUS.full,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            position: 'absolute', top: 0, left: 0, bottom: 0,
                            width: `${pct}%`, background: barColor,
                            borderRadius: RADIUS.full,
                            transition: `width ${MOTION.base}s ease`,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT SIDEBAR (30%, ~320px) ──────────────────────────── */}
          <div style={{
            flex: 3,
            minWidth: 300,
            maxWidth: 380,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: COLORS.bgDeep,
          }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>

              {/* ── Shift Schedule Grid ── */}
              <div style={{
                padding: `${SPACE.base}px ${SPACE.base}px ${SPACE.md}px`,
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.sm,
                  marginBottom: SPACE.md,
                }}>
                  <Clock size={12} color={COLORS.accent} />
                  <BracketLabel tone="accent" size="xs">SHIFT SCHEDULE</BracketLabel>
                </div>

                {SHIFT_CHANGES.map((shift, idx) => {
                  const totalIn = shift.units.reduce((s, u) => s + u.incoming, 0);
                  const totalOut = shift.units.reduce((s, u) => s + u.outgoing, 0);
                  const totalShiftGaps = shift.units.reduce((s, u) => s + u.gapAfter, 0);
                  const isNext = idx === 0;

                  return (
                    <div key={shift.time} style={{
                      background: isNext ? COLORS.surface : 'transparent',
                      border: `1px solid ${isNext ? COLORS.borderStrong : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      padding: SPACE.md,
                      marginBottom: SPACE.sm,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: SPACE.sm,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <span style={{
                            fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700,
                            color: COLORS.textPrimary, letterSpacing: '0.02em',
                          }}>{shift.time}</span>
                          <Mono tone="secondary" size="xs">{shift.label}</Mono>
                          {isNext && (
                            <span style={{
                              padding: '1px 6px', background: COLORS.accentDim,
                              border: `1px solid ${COLORS.accent}30`,
                              borderRadius: RADIUS.sm,
                              fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600,
                              color: COLORS.accent, letterSpacing: '0.1em',
                            }}>NEXT</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: SPACE.md, marginBottom: SPACE.xs }}>
                        <Mono tone="ok" size="xs">IN {totalIn}</Mono>
                        <Mono tone="secondary" size="xs">OUT {totalOut}</Mono>
                        {totalShiftGaps > 0 && <Mono tone="crit" size="xs">GAPS {totalShiftGaps}</Mono>}
                      </div>
                      {/* Mini unit bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {shift.units.map(su => (
                          <div key={su.name} style={{
                            display: 'flex', alignItems: 'center', gap: SPACE.xs,
                          }}>
                            <Mono tone="dim" size="xs" style={{ width: 74, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {su.name}
                            </Mono>
                            <div style={{
                              flex: 1, height: 4, background: COLORS.border,
                              borderRadius: RADIUS.full, overflow: 'hidden',
                            }}>
                              <div style={{
                                width: su.outgoing > 0 ? `${Math.min(100, Math.round((su.incoming / su.outgoing) * 100))}%` : '100%',
                                height: '100%',
                                background: su.gapAfter > 0 ? COLORS.crit : su.incoming >= su.outgoing ? COLORS.ok : COLORS.warn,
                                borderRadius: RADIUS.full,
                              }} />
                            </div>
                            {su.gapAfter > 0 && (
                              <Mono tone="crit" size="xs">-{su.gapAfter}</Mono>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Float Pool & On-Call ── */}
              <div style={{
                padding: `${SPACE.md}px ${SPACE.base}px`,
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.sm,
                  marginBottom: SPACE.md,
                }}>
                  <UserPlus size={12} color={COLORS.accent} />
                  <BracketLabel tone="accent" size="xs">FLOAT POOL &amp; ON-CALL</BracketLabel>
                  <Mono tone="muted" size="xs">{FLOAT_POOL.length}</Mono>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                  {FLOAT_POOL.map(entry => (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: SPACE.sm,
                      padding: `${SPACE.xs}px ${SPACE.sm}px`,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: RADIUS.full, flexShrink: 0,
                        background: statusDotColor(entry.status),
                        boxShadow: `0 0 4px ${statusDotColor(entry.status)}60`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <span style={{
                          fontFamily: FONTS.sans, fontSize: 12, fontWeight: 500,
                          color: COLORS.textPrimary,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          display: 'block',
                        }}>{entry.name}</span>
                        <div style={{ display: 'flex', gap: SPACE.xs }}>
                          <Mono tone="dim" size="xs">{entry.credentials}</Mono>
                          <Mono tone="dim" size="xs">{entry.specialty}</Mono>
                        </div>
                      </div>
                      <span style={{
                        fontFamily: FONTS.mono, fontSize: 9, fontWeight: 500,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: statusDotColor(entry.status),
                        flexShrink: 0,
                      }}>{entry.status.toUpperCase()}</span>
                      {entry.status === 'On-Call' && (
                        <TacticalButton variant="primary" size="sm" onClick={() => handleCallIn(entry)}
                          icon={<Phone size={9} />}
                          style={{ padding: '0 8px', height: 22, fontSize: 9 }}>
                          CALL
                        </TacticalButton>
                      )}
                      {entry.status === 'Available' && (
                        <TacticalButton variant="secondary" size="sm" onClick={() => handleReassign(entry)}
                          icon={<ArrowRightLeft size={9} />}
                          style={{ padding: '0 8px', height: 22, fontSize: 9 }}>
                          ASSIGN
                        </TacticalButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Call-In / Call-Off Tracker ── */}
              <div style={{
                padding: `${SPACE.md}px ${SPACE.base}px`,
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.sm,
                  marginBottom: SPACE.md,
                }}>
                  <Activity size={12} color={COLORS.accent} />
                  <BracketLabel tone="accent" size="xs">CALL TRACKER</BracketLabel>
                  <span style={{
                    fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700,
                    color: callNetImpact >= 0 ? COLORS.ok : COLORS.crit,
                    padding: '1px 6px',
                    background: callNetImpact >= 0 ? COLORS.okDim : COLORS.critDim,
                    borderRadius: RADIUS.sm,
                    letterSpacing: '0.08em',
                  }}>NET {callNetImpact >= 0 ? '+' : ''}{callNetImpact}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                  {CALL_EVENTS.map(ev => (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: SPACE.sm,
                      padding: `${SPACE.xs}px ${SPACE.sm}px`,
                      background: ev.type === 'call-off' ? `${COLORS.crit}06` : `${COLORS.ok}06`,
                      border: `1px solid ${ev.type === 'call-off' ? `${COLORS.crit}20` : `${COLORS.ok}20`}`,
                      borderRadius: RADIUS.sm,
                    }}>
                      {ev.type === 'call-in'
                        ? <PhoneCall size={10} color={COLORS.ok} />
                        : <PhoneOff size={10} color={COLORS.crit} />
                      }
                      <span style={{
                        fontFamily: FONTS.sans, fontSize: 12, fontWeight: 500,
                        color: COLORS.textPrimary, flex: 1,
                      }}>{ev.name}</span>
                      <Mono tone="dim" size="xs">{ev.role}</Mono>
                      <Mono tone="dim" size="xs">{ev.unit}</Mono>
                      <Mono tone="muted" size="xs">{ev.time}</Mono>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Ratio Compliance Dashboard ── */}
              <div style={{
                padding: `${SPACE.md}px ${SPACE.base}px ${SPACE.lg}px`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.sm,
                  marginBottom: SPACE.md,
                }}>
                  <Shield size={12} color={COLORS.accent} />
                  <BracketLabel tone="accent" size="xs">RATIO COMPLIANCE</BracketLabel>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                  {UNITS.map(unit => {
                    const mandated = MANDATED_RATIOS[unit.name] ?? 999;
                    const compliant = unit.nursePatientRatio <= mandated;
                    const pctOfLimit = mandated > 0 ? Math.min(100, Math.round((unit.nursePatientRatio / mandated) * 100)) : 0;
                    return (
                      <div key={unit.id} style={{
                        display: 'flex', alignItems: 'center', gap: SPACE.sm,
                      }}>
                        <Mono tone="dim" size="xs" style={{ width: 74, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {unit.name}
                        </Mono>
                        <div style={{
                          flex: 1, height: 8, background: COLORS.border,
                          borderRadius: RADIUS.full, overflow: 'hidden',
                          position: 'relative',
                        }}>
                          <div style={{
                            width: `${pctOfLimit}%`, height: '100%',
                            background: compliant
                              ? (pctOfLimit >= 80 ? COLORS.warn : COLORS.ok)
                              : COLORS.crit,
                            borderRadius: RADIUS.full,
                            transition: `width ${MOTION.base}s ease`,
                          }} />
                          {/* Mandated limit marker */}
                          <div style={{
                            position: 'absolute', top: -2, bottom: -2,
                            left: '100%', width: 2,
                            background: COLORS.textDim,
                          }} />
                        </div>
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
                          color: compliant ? COLORS.ok : COLORS.crit,
                          width: 36, textAlign: 'right', flexShrink: 0,
                        }}>1:{unit.nursePatientRatio.toFixed(1)}</span>
                        {compliant
                          ? <Shield size={10} color={COLORS.ok} />
                          : <AlertTriangle size={10} color={COLORS.crit} />
                        }
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: SPACE.sm,
                  marginTop: SPACE.md,
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                }}>
                  <Mono tone="dim" size="xs">BAR = ACTUAL / MANDATED LIMIT</Mono>
                  <div style={{ flex: 1 }} />
                  <Mono tone={UNITS.every(u => u.nursePatientRatio <= (MANDATED_RATIOS[u.name] ?? 999)) ? 'ok' : 'crit'} size="xs">
                    {UNITS.filter(u => u.nursePatientRatio <= (MANDATED_RATIOS[u.name] ?? 999)).length}/{UNITS.length} COMPLIANT
                  </Mono>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="workforce-coverage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: Z.modal,
            background: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          {/* ── Header strip ──────────────────────────────────────────── */}
          <HudStrip side="top" fixed>
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, background: 'transparent',
                border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
                color: COLORS.textSecondary, cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
            <BracketLabel tone="accent" size="sm">Workforce</BracketLabel>
            <div style={{ flex: 1 }} />
            <ConfidenceBadge confidence={92} ageMinutes={1} />
          </HudStrip>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              paddingTop: 56,
              paddingBottom: `max(env(safe-area-inset-bottom), ${SPACE['3xl']}px)`,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {renderHero()}

            <Divider style={{ margin: `${SPACE.base}px ${SPACE.base}px ${SPACE.sm}px` }} />
            {renderFilters()}

            <Divider style={{ margin: `${SPACE.xs}px ${SPACE.base}px ${SPACE.base}px` }} />
            {renderUnitCards()}

            <Divider style={{ margin: `${SPACE.base}px ${SPACE.base}px 0` }} />
            {renderRoleBreakdown()}

            <Divider style={{ margin: `0 ${SPACE.base}px` }} />
            {renderFloatPool()}

            <Divider style={{ margin: `0 ${SPACE.base}px` }} />
            {renderShiftChanges()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

WorkforceCoverage.displayName = 'WorkforceCoverage';
