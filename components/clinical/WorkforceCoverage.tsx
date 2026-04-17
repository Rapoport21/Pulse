/**
 * WorkforceCoverage — Full-screen Staffing Command Center
 *
 * Desktop drag-and-drop staffing board with:
 *   - Top HudStrip: title, shift selector, summary stats
 *   - Left column (~65%): Unit staffing grid with draggable staff chips
 *   - Right column (~35%): Staff pool / roster / float pool
 *   - Bottom strip: Coverage metrics, ratio compliance, overtime alerts
 *
 * All state is managed internally. Staff can be dragged between units
 * and from the float pool using native HTML5 drag-and-drop with
 * framer-motion animations for smooth transitions.
 */

import React, { useState, useMemo, useCallback, DragEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, AlertTriangle, Clock, Search, Shield,
  Activity, ArrowRightLeft, Phone, UserPlus,
  GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION,
  Mono, BracketLabel, StatusPill, TacticalCard,
  TacticalButton, HudStrip, Divider, CornerBracket,
} from '../design';
import { UserRole } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface WorkforceCoverageProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  role?: UserRole;
  embedded?: boolean;
}

type StaffRole = 'RN' | 'LPN' | 'CNA' | 'MD' | 'PA' | 'RT' | 'TECH';
type ShiftType = 'day' | 'night';
type StaffStatus = 'on-duty' | 'on-call' | 'off' | 'float';
type ShiftFilter = 'day' | 'night' | 'all';

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  unit: string | null;
  shift: ShiftType;
  status: StaffStatus;
  certifications?: string[];
  hoursWorked?: number;
}

interface UnitDef {
  id: string;
  name: string;
  floor: string;
  required: Record<StaffRole, number>;
  mandatedRatio: number;
  beds: number;
  patients: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Role colors
// ─────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<StaffRole, string> = {
  RN: '#3B82F6',   // blue
  LPN: '#8B5CF6',  // violet
  CNA: '#10B981',  // emerald
  MD: '#E11D48',   // rose (accent)
  PA: '#F59E0B',   // amber
  RT: '#06B6D4',   // cyan
  TECH: '#6B7280', // gray
};

// ─────────────────────────────────────────────────────────────────────────
// Mock data — Units
// ─────────────────────────────────────────────────────────────────────────

const UNITS: UnitDef[] = [
  { id: 'ed-trauma', name: 'ED-Trauma', floor: '1F', beds: 10, patients: 8, mandatedRatio: 2.0,
    required: { RN: 4, LPN: 0, CNA: 1, MD: 2, PA: 0, RT: 1, TECH: 2 } },
  { id: 'ed-acute', name: 'ED-Acute', floor: '1F', beds: 22, patients: 18, mandatedRatio: 4.0,
    required: { RN: 5, LPN: 1, CNA: 2, MD: 2, PA: 1, RT: 1, TECH: 2 } },
  { id: 'ed-fast', name: 'ED-Fast Track', floor: '1F', beds: 8, patients: 6, mandatedRatio: 4.0,
    required: { RN: 2, LPN: 0, CNA: 1, MD: 1, PA: 1, RT: 0, TECH: 1 } },
  { id: 'icu', name: 'ICU', floor: '3F', beds: 14, patients: 12, mandatedRatio: 2.0,
    required: { RN: 6, LPN: 0, CNA: 2, MD: 2, PA: 0, RT: 2, TECH: 1 } },
  { id: 'stepdown', name: 'Stepdown', floor: '3F', beds: 12, patients: 10, mandatedRatio: 3.0,
    required: { RN: 4, LPN: 1, CNA: 1, MD: 1, PA: 0, RT: 1, TECH: 1 } },
  { id: 'medsurg-2w', name: 'Med-Surg 2W', floor: '2F', beds: 28, patients: 24, mandatedRatio: 5.0,
    required: { RN: 5, LPN: 2, CNA: 2, MD: 1, PA: 1, RT: 1, TECH: 2 } },
  { id: 'medsurg-3e', name: 'Med-Surg 3E', floor: '3F', beds: 26, patients: 20, mandatedRatio: 5.0,
    required: { RN: 5, LPN: 1, CNA: 2, MD: 1, PA: 0, RT: 1, TECH: 2 } },
];

// ─────────────────────────────────────────────────────────────────────────
// Mock data — Staff (~28 members)
// ─────────────────────────────────────────────────────────────────────────

const INITIAL_STAFF: StaffMember[] = [
  // ED-Trauma
  { id: 's01', name: 'S. Jenkins', role: 'RN', unit: 'ed-trauma', shift: 'day', status: 'on-duty', certifications: ['TNCC', 'BLS'], hoursWorked: 8.5 },
  { id: 's02', name: 'M. Chang', role: 'RN', unit: 'ed-trauma', shift: 'day', status: 'on-duty', certifications: ['BLS'], hoursWorked: 4.0 },
  { id: 's03', name: 'Dr. E. Chen', role: 'MD', unit: 'ed-trauma', shift: 'day', status: 'on-duty', hoursWorked: 10.2 },
  { id: 's04', name: 'Dr. A. Patel', role: 'MD', unit: 'ed-trauma', shift: 'day', status: 'on-duty', hoursWorked: 6.0 },
  { id: 's05', name: 'T. Brooks', role: 'TECH', unit: 'ed-trauma', shift: 'day', status: 'on-duty', hoursWorked: 7.0 },
  { id: 's06', name: 'J. Rivera', role: 'RT', unit: 'ed-trauma', shift: 'day', status: 'on-duty', hoursWorked: 5.5 },

  // ED-Acute
  { id: 's07', name: 'K. Williams', role: 'RN', unit: 'ed-acute', shift: 'day', status: 'on-duty', certifications: ['BLS', 'ACLS'], hoursWorked: 6.0 },
  { id: 's08', name: 'P. Gonzalez', role: 'RN', unit: 'ed-acute', shift: 'day', status: 'on-duty', hoursWorked: 3.5 },
  { id: 's09', name: 'R. Thompson', role: 'RN', unit: 'ed-acute', shift: 'day', status: 'on-duty', hoursWorked: 7.0 },
  { id: 's10', name: 'Dr. J. Lee', role: 'MD', unit: 'ed-acute', shift: 'day', status: 'on-duty', hoursWorked: 9.0 },
  { id: 's11', name: 'N. Harris', role: 'PA', unit: 'ed-acute', shift: 'day', status: 'on-duty', hoursWorked: 4.5 },
  { id: 's12', name: 'C. Davis', role: 'CNA', unit: 'ed-acute', shift: 'day', status: 'on-duty', hoursWorked: 5.0 },

  // ICU
  { id: 's13', name: 'A. Foster', role: 'RN', unit: 'icu', shift: 'day', status: 'on-duty', certifications: ['CCRN', 'BLS'], hoursWorked: 8.0 },
  { id: 's14', name: 'L. Martinez', role: 'RN', unit: 'icu', shift: 'day', status: 'on-duty', certifications: ['CCRN'], hoursWorked: 6.5 },
  { id: 's15', name: 'B. Nguyen', role: 'RN', unit: 'icu', shift: 'day', status: 'on-duty', hoursWorked: 4.0 },
  { id: 's16', name: 'Dr. R. Smith', role: 'MD', unit: 'icu', shift: 'day', status: 'on-duty', hoursWorked: 11.0 },
  { id: 's17', name: 'W. Johnson', role: 'RT', unit: 'icu', shift: 'day', status: 'on-duty', hoursWorked: 7.5 },

  // Stepdown
  { id: 's18', name: 'D. Clark', role: 'RN', unit: 'stepdown', shift: 'day', status: 'on-duty', hoursWorked: 5.0 },
  { id: 's19', name: 'H. Anderson', role: 'RN', unit: 'stepdown', shift: 'day', status: 'on-duty', hoursWorked: 3.0 },
  { id: 's20', name: 'Dr. F. Okafor', role: 'MD', unit: 'stepdown', shift: 'day', status: 'on-duty', hoursWorked: 8.0 },

  // Med-Surg 2W
  { id: 's21', name: 'G. Taylor', role: 'RN', unit: 'medsurg-2w', shift: 'day', status: 'on-duty', hoursWorked: 6.5 },
  { id: 's22', name: 'E. White', role: 'RN', unit: 'medsurg-2w', shift: 'day', status: 'on-duty', hoursWorked: 4.0 },
  { id: 's23', name: 'I. Brown', role: 'LPN', unit: 'medsurg-2w', shift: 'day', status: 'on-duty', hoursWorked: 7.0 },

  // Med-Surg 3E
  { id: 's24', name: 'V. Moore', role: 'RN', unit: 'medsurg-3e', shift: 'day', status: 'on-duty', hoursWorked: 5.5 },
  { id: 's25', name: 'O. Jackson', role: 'RN', unit: 'medsurg-3e', shift: 'day', status: 'on-duty', hoursWorked: 3.0 },
  { id: 's26', name: 'Y. Kim', role: 'CNA', unit: 'medsurg-3e', shift: 'day', status: 'on-duty', hoursWorked: 6.0 },

  // Float / unassigned
  { id: 's27', name: 'M. Torres', role: 'RN', unit: null, shift: 'day', status: 'float', certifications: ['BLS', 'ACLS'], hoursWorked: 0 },
  { id: 's28', name: 'J. Kim', role: 'RN', unit: null, shift: 'day', status: 'float', certifications: ['CCRN'], hoursWorked: 0 },
  { id: 's29', name: 'R. Patel', role: 'RN', unit: null, shift: 'night', status: 'on-call', certifications: ['BLS'], hoursWorked: 0 },
  { id: 's30', name: 'A. Washington', role: 'RT', unit: null, shift: 'night', status: 'on-call', hoursWorked: 0 },
  { id: 's31', name: 'L. Chen', role: 'LPN', unit: null, shift: 'day', status: 'float', hoursWorked: 0 },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const ALL_ROLES: StaffRole[] = ['RN', 'LPN', 'CNA', 'MD', 'PA', 'RT', 'TECH'];

function unitGap(unit: UnitDef, staff: StaffMember[]): number {
  const assigned = staff.filter(s => s.unit === unit.id);
  return ALL_ROLES.reduce((sum, r) => {
    const current = assigned.filter(s => s.role === r).length;
    return sum + Math.max(0, unit.required[r] - current);
  }, 0);
}

function unitCurrent(unit: UnitDef, staff: StaffMember[]): number {
  return staff.filter(s => s.unit === unit.id).length;
}

function unitRequired(unit: UnitDef): number {
  return ALL_ROLES.reduce((s, r) => s + unit.required[r], 0);
}

function coveragePct(unit: UnitDef, staff: StaffMember[]): number {
  const req = unitRequired(unit);
  if (req === 0) return 100;
  const cur = Math.min(unitCurrent(unit, staff), req);
  return Math.round((cur / req) * 100);
}

function gapTone(gap: number): 'ok' | 'warn' | 'crit' {
  if (gap === 0) return 'ok';
  if (gap <= 2) return 'warn';
  return 'crit';
}

function gapColor(gap: number): string {
  const t = gapTone(gap);
  return t === 'ok' ? COLORS.ok : t === 'warn' ? COLORS.warn : COLORS.crit;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const WorkforceCoverage: React.FC<WorkforceCoverageProps> = ({
  open,
  onClose,
  showToast,
  role,
  embedded,
}) => {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [rosterExpanded, setRosterExpanded] = useState(false);

  // Filtered staff by shift
  const filteredStaff = useMemo(() => {
    if (shiftFilter === 'all') return staff;
    return staff.filter(s => s.shift === shiftFilter);
  }, [staff, shiftFilter]);

  // Float pool + on-call
  const floatPool = useMemo(
    () => filteredStaff.filter(s => s.unit === null && (s.status === 'float' || s.status === 'on-call')),
    [filteredStaff],
  );

  // Roster search
  const rosterResults = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return filteredStaff;
    return filteredStaff.filter(
      s => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  }, [filteredStaff, searchQuery]);

  // Summary stats
  const totalOnDuty = filteredStaff.filter(s => s.status === 'on-duty').length;
  const totalFloat = floatPool.filter(s => s.status === 'float').length;
  const totalOnCall = floatPool.filter(s => s.status === 'on-call').length;
  const totalGaps = UNITS.reduce((s, u) => s + unitGap(u, filteredStaff), 0);
  const overtimeStaff = filteredStaff.filter(s => (s.hoursWorked ?? 0) > 10);

  // Coverage compliance
  const unitsCompliant = UNITS.filter(u => unitGap(u, filteredStaff) === 0).length;
  const ratioViolations = UNITS.filter(u => {
    const rns = filteredStaff.filter(s => s.unit === u.id && s.role === 'RN').length;
    return rns > 0 && (u.patients / rns) > u.mandatedRatio;
  }).length;

  // ── Drag handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, staffId: string) => {
    e.dataTransfer.setData('text/plain', staffId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(staffId);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, unitId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(unitId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetUnitId: string | null) => {
    e.preventDefault();
    const staffId = e.dataTransfer.getData('text/plain');
    if (!staffId) return;

    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      const newStatus: StaffStatus = targetUnitId ? 'on-duty' : 'float';
      return { ...s, unit: targetUnitId, status: newStatus };
    }));

    const member = staff.find(s => s.id === staffId);
    const targetName = targetUnitId
      ? UNITS.find(u => u.id === targetUnitId)?.name ?? targetUnitId
      : 'Float Pool';
    if (member) {
      showToast(`${member.name} assigned to ${targetName}`);
    }

    setDraggedId(null);
    setDropTarget(null);
  }, [staff, showToast]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTarget(null);
  }, []);

  if (!open && !embedded) return null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: COLORS.bg,
      overflow: 'hidden',
    }}>
      {/* ── Top HudStrip ─────────────────────────────────────────────── */}
      <HudStrip side="top" height={48}>
        <BracketLabel tone="accent" size="sm">STAFFING COMMAND</BracketLabel>

        <div style={{ flex: 1 }} />

        {/* Shift selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['day', 'night', 'all'] as ShiftFilter[]).map(s => {
            const active = shiftFilter === s;
            return (
              <button
                key={s}
                onClick={() => setShiftFilter(s)}
                style={{
                  padding: `3px ${SPACE.sm}px`,
                  background: active ? `${COLORS.accent}20` : 'transparent',
                  border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: active ? COLORS.accent : COLORS.textMuted,
                  transition: `all ${MOTION.fast}s ease`,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        <Divider variant="solid" color={COLORS.border} style={{ width: 1, height: 24, borderTop: 'none', borderLeft: `1px solid ${COLORS.border}` }} />

        {/* Summary stats in header */}
        <div style={{ display: 'flex', gap: SPACE.lg, alignItems: 'center' }}>
          <StatChip label="ON DUTY" value={totalOnDuty} tone="ok" />
          <StatChip label="FLOAT" value={totalFloat} tone="info" />
          <StatChip label="ON-CALL" value={totalOnCall} tone="warn" />
          <StatChip label="GAPS" value={totalGaps} tone={totalGaps > 0 ? 'crit' : 'ok'} />
        </div>
      </HudStrip>

      {/* ── Main content area (two columns) ──────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        gap: 1,
        background: COLORS.border,
      }}>
        {/* ── Left column: Unit Staffing Grid (~65%) ─────────────────── */}
        <div style={{
          flex: '0 0 65%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.md,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            flexShrink: 0,
          }}>
            <BracketLabel tone="muted" size="xs">UNIT GRID</BracketLabel>
            <Mono tone="muted" size="xs">{UNITS.length} UNITS</Mono>
            <div style={{ flex: 1 }} />
            <Mono tone="muted" size="xs">{unitsCompliant}/{UNITS.length} COMPLIANT</Mono>
          </div>

          {/* Grid header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 60px 60px 50px 1fr',
            gap: SPACE.sm,
            padding: `${SPACE.sm}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceElev,
            flexShrink: 0,
          }}>
            <Mono tone="muted" size="xs">UNIT</Mono>
            <Mono tone="muted" size="xs" style={{ textAlign: 'center' }}>REQ</Mono>
            <Mono tone="muted" size="xs" style={{ textAlign: 'center' }}>CURR</Mono>
            <Mono tone="muted" size="xs" style={{ textAlign: 'center' }}>GAP</Mono>
            <Mono tone="muted" size="xs">ASSIGNED STAFF</Mono>
          </div>

          {/* Unit rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {UNITS.map((unit, idx) => {
              const gap = unitGap(unit, filteredStaff);
              const cur = unitCurrent(unit, filteredStaff);
              const req = unitRequired(unit);
              const isDropTarget = dropTarget === unit.id;
              const assigned = filteredStaff.filter(s => s.unit === unit.id);
              const covPct = coveragePct(unit, filteredStaff);

              return (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: MOTION.base, ease: MOTION.ease }}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, unit.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, unit.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 60px 60px 50px 1fr',
                    gap: SPACE.sm,
                    padding: `${SPACE.md}px ${SPACE.lg}px`,
                    borderBottom: `1px solid ${COLORS.border}`,
                    alignItems: 'start',
                    background: isDropTarget
                      ? `${COLORS.accent}08`
                      : 'transparent',
                    borderLeft: isDropTarget
                      ? `3px solid ${COLORS.accent}`
                      : `3px solid ${gapColor(gap)}`,
                    transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                    minHeight: 60,
                  }}
                >
                  {/* Unit name + floor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      fontFamily: FONTS.sans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      letterSpacing: '-0.005em',
                    }}>
                      {unit.name}
                    </span>
                    <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center' }}>
                      <Mono tone="muted" size="xs">{unit.floor}</Mono>
                      <Mono tone="muted" size="xs">{unit.patients}/{unit.beds} BED</Mono>
                    </div>
                    {/* Coverage micro-bar */}
                    <div style={{
                      marginTop: 3,
                      height: 3,
                      width: '100%',
                      background: `${COLORS.border}`,
                      borderRadius: RADIUS.full,
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${covPct}%` }}
                        transition={{ duration: MOTION.base, ease: MOTION.ease }}
                        style={{
                          height: '100%',
                          background: covPct === 100 ? COLORS.ok : covPct >= 80 ? COLORS.warn : COLORS.crit,
                          borderRadius: RADIUS.full,
                        }}
                      />
                    </div>
                  </div>

                  {/* Required */}
                  <span style={{
                    fontFamily: FONTS.mono,
                    fontSize: 15,
                    fontWeight: 600,
                    color: COLORS.textSecondary,
                    textAlign: 'center',
                    paddingTop: 2,
                  }}>
                    {req}
                  </span>

                  {/* Current */}
                  <span style={{
                    fontFamily: FONTS.mono,
                    fontSize: 15,
                    fontWeight: 600,
                    color: cur >= req ? COLORS.ok : COLORS.textPrimary,
                    textAlign: 'center',
                    paddingTop: 2,
                  }}>
                    {cur}
                  </span>

                  {/* Gap */}
                  <div style={{ textAlign: 'center', paddingTop: 2 }}>
                    {gap > 0 ? (
                      <span style={{
                        fontFamily: FONTS.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        color: gapColor(gap),
                        padding: `1px ${SPACE.xs}px`,
                        background: `${gapColor(gap)}15`,
                        borderRadius: RADIUS.sm,
                      }}>
                        -{gap}
                      </span>
                    ) : (
                      <span style={{
                        fontFamily: FONTS.mono,
                        fontSize: 13,
                        fontWeight: 600,
                        color: COLORS.ok,
                      }}>
                        OK
                      </span>
                    )}
                  </div>

                  {/* Assigned staff chips */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    minHeight: 28,
                    padding: 2,
                    borderRadius: RADIUS.sm,
                    border: isDropTarget ? `1px dashed ${COLORS.accent}60` : '1px dashed transparent',
                    transition: `border-color ${MOTION.fast}s ease`,
                  }}>
                    <AnimatePresence mode="popLayout">
                      {assigned.map(s => (
                        <StaffChip
                          key={s.id}
                          member={s}
                          isDragged={draggedId === s.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </AnimatePresence>
                    {assigned.length === 0 && (
                      <Mono tone="dim" size="xs" style={{ padding: '4px 0' }}>
                        DROP STAFF HERE
                      </Mono>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Right column: Staff Pool / Roster (~35%) ───────────────── */}
        <div style={{
          flex: '0 0 35%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          overflow: 'hidden',
        }}>
          {/* Float Pool section */}
          <div style={{
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
              <BracketLabel tone="info" size="xs">FLOAT POOL</BracketLabel>
              <Mono tone="muted" size="xs">{floatPool.length} AVAILABLE</Mono>
            </div>
          </div>

          <div
            onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, null)}
            style={{
              padding: SPACE.md,
              display: 'flex',
              flexWrap: 'wrap',
              gap: SPACE.xs,
              minHeight: 80,
              background: dropTarget === null && draggedId ? `${COLORS.info}06` : 'transparent',
              borderBottom: `1px solid ${COLORS.border}`,
              border: dropTarget === null && draggedId ? `1px dashed ${COLORS.info}50` : undefined,
              transition: `background ${MOTION.fast}s ease`,
              flexShrink: 0,
            }}
          >
            <AnimatePresence mode="popLayout">
              {floatPool.map(s => (
                <StaffChip
                  key={s.id}
                  member={s}
                  isDragged={draggedId === s.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  showStatus
                />
              ))}
            </AnimatePresence>
            {floatPool.length === 0 && (
              <Mono tone="dim" size="xs" style={{ padding: SPACE.md }}>
                // NO FLOAT STAFF AVAILABLE
              </Mono>
            )}
          </div>

          {/* Roster section */}
          <div style={{
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
              <button
                onClick={() => setRosterExpanded(v => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <BracketLabel tone="secondary" size="xs">ROSTER</BracketLabel>
                {rosterExpanded
                  ? <ChevronUp size={13} color={COLORS.textMuted} />
                  : <ChevronDown size={13} color={COLORS.textMuted} />
                }
              </button>
              <Mono tone="muted" size="xs">{filteredStaff.length} TOTAL</Mono>
              <div style={{ flex: 1 }} />
            </div>
            {rosterExpanded && (
              <div style={{
                marginTop: SPACE.sm,
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                height: 28,
                padding: '0 8px',
                background: COLORS.surfaceElev,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
              }}>
                <Search size={13} color={COLORS.textMuted} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search staff..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    letterSpacing: '-0.005em',
                  }}
                />
              </div>
            )}
          </div>

          {/* Roster table */}
          {rosterExpanded && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Roster header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 50px 80px 50px',
                gap: SPACE.sm,
                padding: `${SPACE.xs}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceElev,
              }}>
                <Mono tone="muted" size="xs">NAME</Mono>
                <Mono tone="muted" size="xs">ROLE</Mono>
                <Mono tone="muted" size="xs">UNIT</Mono>
                <Mono tone="muted" size="xs" style={{ textAlign: 'right' }}>HRS</Mono>
              </div>

              {rosterResults.map((s, i) => (
                <RosterRow key={s.id} member={s} index={i} />
              ))}

              {rosterResults.length === 0 && (
                <div style={{
                  padding: SPACE.xl,
                  textAlign: 'center',
                }}>
                  <Mono tone="dim" size="xs">// NO RESULTS</Mono>
                </div>
              )}
            </div>
          )}

          {/* Role breakdown (when roster collapsed) */}
          {!rosterExpanded && (
            <div style={{ flex: 1, overflowY: 'auto', padding: SPACE.md }}>
              <div style={{ marginBottom: SPACE.md }}>
                <BracketLabel tone="muted" size="xs">ROLE BREAKDOWN</BracketLabel>
              </div>
              {ALL_ROLES.map(r => {
                const assigned = filteredStaff.filter(s => s.unit !== null && s.role === r).length;
                const required = UNITS.reduce((s, u) => s + u.required[r], 0);
                const pct = required > 0 ? Math.round((assigned / required) * 100) : 100;
                return (
                  <div key={r} style={{ marginBottom: SPACE.md }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: RADIUS.full,
                          background: ROLE_COLORS[r],
                        }} />
                        <Mono tone="secondary" size="xs">{r}</Mono>
                      </div>
                      <Mono tone={pct >= 100 ? 'ok' : pct >= 80 ? 'warn' : 'crit'} size="xs">
                        {assigned}/{required}
                      </Mono>
                    </div>
                    <div style={{
                      height: 4,
                      background: COLORS.border,
                      borderRadius: RADIUS.full,
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: MOTION.base, ease: MOTION.ease }}
                        style={{
                          height: '100%',
                          background: ROLE_COLORS[r],
                          borderRadius: RADIUS.full,
                          opacity: pct >= 100 ? 1 : 0.8,
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Upcoming shift changes */}
              <Divider style={{ margin: `${SPACE.md}px 0` }} />
              <div style={{ marginBottom: SPACE.md }}>
                <BracketLabel tone="muted" size="xs">SHIFT CHANGES</BracketLabel>
              </div>
              <TacticalCard padding="sm" style={{ marginBottom: SPACE.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                  <Clock size={13} color={COLORS.textMuted} />
                  <Mono tone="secondary" size="xs">19:00 EVENING</Mono>
                  <Mono tone="warn" size="xs">3H 22M</Mono>
                </div>
                <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                  <ShiftBadge label="IN" value={24} tone="ok" />
                  <ShiftBadge label="OUT" value={27} tone="warn" />
                  <ShiftBadge label="NET" value={-3} tone="crit" />
                </div>
              </TacticalCard>
              <TacticalCard padding="sm">
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                  <Clock size={13} color={COLORS.textMuted} />
                  <Mono tone="secondary" size="xs">07:00 DAY</Mono>
                  <Mono tone="muted" size="xs">15H 22M</Mono>
                </div>
                <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                  <ShiftBadge label="IN" value={30} tone="ok" />
                  <ShiftBadge label="OUT" value={24} tone="info" />
                  <ShiftBadge label="NET" value={+6} tone="ok" />
                </div>
              </TacticalCard>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom strip: Coverage metrics ────────────────────────────── */}
      <HudStrip side="bottom" height={36}>
        <div style={{ display: 'flex', gap: SPACE.xl, alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <Shield size={12} color={unitsCompliant === UNITS.length ? COLORS.ok : COLORS.warn} />
            <Mono tone={unitsCompliant === UNITS.length ? 'ok' : 'warn'} size="xs">
              RATIO COMPLIANCE {unitsCompliant}/{UNITS.length}
            </Mono>
          </div>

          <Divider variant="solid" color={COLORS.border} style={{ width: 1, height: 16, borderTop: 'none', borderLeft: `1px solid ${COLORS.border}` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <AlertTriangle size={12} color={ratioViolations > 0 ? COLORS.crit : COLORS.textMuted} />
            <Mono tone={ratioViolations > 0 ? 'crit' : 'muted'} size="xs">
              RATIO VIOLATIONS {ratioViolations}
            </Mono>
          </div>

          <Divider variant="solid" color={COLORS.border} style={{ width: 1, height: 16, borderTop: 'none', borderLeft: `1px solid ${COLORS.border}` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <Clock size={12} color={overtimeStaff.length > 0 ? COLORS.warn : COLORS.textMuted} />
            <Mono tone={overtimeStaff.length > 0 ? 'warn' : 'muted'} size="xs">
              OVERTIME {overtimeStaff.length} STAFF &gt;10H
            </Mono>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <Activity size={12} color={COLORS.ok} />
            <Mono tone="ok" size="xs">LIVE</Mono>
            <Mono tone="muted" size="xs">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Mono>
          </div>
        </div>
      </HudStrip>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StaffChip — Draggable staff pill
// ─────────────────────────────────────────────────────────────────────────

const StaffChip: React.FC<{
  member: StaffMember;
  isDragged: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  showStatus?: boolean;
}> = ({ member, isDragged, onDragStart, onDragEnd, showStatus }) => {
  const [hovered, setHovered] = useState(false);
  const roleColor = ROLE_COLORS[member.role];
  const isOvertime = (member.hoursWorked ?? 0) > 10;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragged ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as DragEvent<HTMLDivElement>, member.id)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: `2px ${SPACE.sm}px`,
        background: hovered ? `${roleColor}20` : COLORS.surface,
        border: `1px solid ${hovered ? roleColor : COLORS.border}`,
        borderRadius: RADIUS.full,
        cursor: 'grab',
        userSelect: 'none',
        transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
        position: 'relative',
      }}
      title={`${member.name} (${member.role})${member.certifications ? ' - ' + member.certifications.join(', ') : ''}${member.hoursWorked ? ' - ' + member.hoursWorked + 'h' : ''}`}
    >
      <GripVertical size={8} color={COLORS.textDim} style={{ flexShrink: 0 }} />

      {/* Role dot */}
      <span style={{
        width: 5,
        height: 5,
        borderRadius: RADIUS.full,
        background: roleColor,
        boxShadow: `0 0 4px ${roleColor}80`,
        flexShrink: 0,
      }} />

      {/* Name */}
      <span style={{
        fontFamily: FONTS.sans,
        fontSize: 12,
        fontWeight: 500,
        color: COLORS.textPrimary,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.005em',
      }}>
        {member.name}
      </span>

      {/* Role abbreviation */}
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: roleColor,
      }}>
        {member.role}
      </span>

      {/* Status indicator for float pool */}
      {showStatus && member.status === 'on-call' && (
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.1em',
          color: COLORS.warn,
          textTransform: 'uppercase',
        }}>
          CALL
        </span>
      )}

      {/* Overtime warning */}
      {isOvertime && (
        <span style={{
          width: 4,
          height: 4,
          borderRadius: RADIUS.full,
          background: COLORS.warn,
          boxShadow: `0 0 4px ${COLORS.warn}`,
          flexShrink: 0,
        }} />
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Roster Row — compact table row in roster panel
// ─────────────────────────────────────────────────────────────────────────

const RosterRow: React.FC<{
  member: StaffMember;
  index: number;
}> = ({ member, index }) => {
  const [hovered, setHovered] = useState(false);
  const roleColor = ROLE_COLORS[member.role];
  const unitName = member.unit
    ? UNITS.find(u => u.id === member.unit)?.name ?? member.unit
    : 'Float';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.015, duration: MOTION.fast }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 50px 80px 50px',
        gap: SPACE.sm,
        padding: `${SPACE.xs}px ${SPACE.lg}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        alignItems: 'center',
        background: hovered ? COLORS.surfaceHover : 'transparent',
        transition: `background ${MOTION.fast}s ease`,
      }}
    >
      <span style={{
        fontFamily: FONTS.sans,
        fontSize: 13,
        fontWeight: 500,
        color: COLORS.textPrimary,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {member.name}
      </span>

      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        fontWeight: 600,
        color: roleColor,
        letterSpacing: '0.06em',
      }}>
        {member.role}
      </span>

      <span style={{
        fontFamily: FONTS.sans,
        fontSize: 12,
        color: member.unit ? COLORS.textSecondary : COLORS.textMuted,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {unitName}
      </span>

      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 12,
        fontWeight: 500,
        color: (member.hoursWorked ?? 0) > 10 ? COLORS.warn : COLORS.textSecondary,
        textAlign: 'right',
        letterSpacing: '0.04em',
      }}>
        {(member.hoursWorked ?? 0) > 0 ? `${member.hoursWorked}h` : '\u2014'}
      </span>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Small helper components
// ─────────────────────────────────────────────────────────────────────────

const StatChip: React.FC<{
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'crit' | 'info';
}> = ({ label, value, tone }) => {
  const color = tone === 'ok' ? COLORS.ok : tone === 'warn' ? COLORS.warn : tone === 'crit' ? COLORS.crit : COLORS.info;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Mono tone="muted" size="xs">{label}</Mono>
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 14,
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </span>
    </div>
  );
};

const ShiftBadge: React.FC<{
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'crit' | 'info';
}> = ({ label, value, tone }) => {
  const color = tone === 'ok' ? COLORS.ok : tone === 'warn' ? COLORS.warn : tone === 'crit' ? COLORS.crit : COLORS.info;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: `1px ${SPACE.xs}px`,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      borderRadius: RADIUS.sm,
    }}>
      <Mono tone="muted" size="xs">{label}</Mono>
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 12,
        fontWeight: 600,
        color,
      }}>
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
};
