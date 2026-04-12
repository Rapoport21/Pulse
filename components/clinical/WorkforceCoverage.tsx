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

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Users, AlertTriangle, Clock, Phone, ArrowRightLeft,
  ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, Z,
  Mono, BracketLabel, StatusPill, TacticalCard,
  TacticalButton, HudStrip, ScanningLine, Divider,
  ConfidenceBadge,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface WorkforceCoverageProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
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

export const WorkforceCoverage: React.FC<WorkforceCoverageProps> = ({ open, onClose, showToast }) => {
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [gapsOnly, setGapsOnly] = useState(false);
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
              paddingBottom: SPACE['3xl'],
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
