/**
 * WorkforceCoverage — Staffing Command Center
 *
 * Desktop-first 3-column staffing board:
 *   - HEADER (~72px): title, shift selector, big summary stats, top-level
 *     actions (Request Coverage · Handoff).
 *   - LEFT PANEL (~260px): unit list with coverage bars and gap chips.
 *     Click a unit to focus the center panel on it.
 *   - CENTER PANEL (flex): detail view of the focused unit — beds, ratio,
 *     required crew broken out by role with SLOT PILLS (filled = staff
 *     chip, empty = dashed placeholder). Click empty slot to open the
 *     assign popover. Click filled slot to open an actions popover
 *     (reassign / send to float / message).
 *   - RIGHT PANEL (~340px): resource pools (float / on-call / on-break)
 *     with rich staff cards plus recent changes log.
 *   - FOOTER (~44px): compliance, ratio violations, overtime, live clock.
 *
 * Drag-and-drop is preserved (chip → slot / float zone) AND click-based
 * assignment is now a first-class flow so power users can either drag or
 * pick. Every change appears in the Recent Changes log so charge nurses
 * can verify what was moved and when.
 *
 * Also exposes an `embedded` prop: desktop renders inline via embedded,
 * mobile renders fullscreen via `open`.
 */

import React, { useState, useMemo, useCallback, useEffect, DragEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  AlertTriangle,
  Clock,
  Search,
  Shield,
  Activity,
  ArrowRightLeft,
  Phone,
  UserPlus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  X,
  MoreHorizontal,
  PhoneOutgoing,
  Plus,
  Radio,
  MessageSquare,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION,
  Mono, BracketLabel, StatusPill, TacticalCard,
  TacticalButton, Divider, CornerBracket, ScanningLine,
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
type StaffStatus = 'on-duty' | 'on-call' | 'off' | 'float' | 'break';
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

interface ChangeLogEntry {
  id: string;
  ts: number;
  text: string;
  tone: 'ok' | 'warn' | 'info';
}

// ─────────────────────────────────────────────────────────────────────────
// Role colors — kept in a single place so cards, slots and dots line up.
// ─────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<StaffRole, string> = {
  RN: '#3B82F6',
  LPN: '#8B5CF6',
  CNA: '#10B981',
  MD: '#E11D48',
  PA: '#F59E0B',
  RT: '#06B6D4',
  TECH: '#6B7280',
};

const ROLE_LABEL: Record<StaffRole, string> = {
  RN: 'Registered Nurse',
  LPN: 'Licensed Practical Nurse',
  CNA: 'Certified Nursing Assistant',
  MD: 'Physician',
  PA: 'Physician Assistant',
  RT: 'Respiratory Therapist',
  TECH: 'Technician',
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
// Mock data — Staff
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
  { id: 's32', name: 'K. Shaw', role: 'CNA', unit: null, shift: 'day', status: 'break', hoursWorked: 4.0 },
  { id: 's33', name: 'Dr. B. Nair', role: 'MD', unit: null, shift: 'day', status: 'on-call', certifications: ['BLS'], hoursWorked: 0 },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const ALL_ROLES: StaffRole[] = ['RN', 'LPN', 'CNA', 'MD', 'PA', 'RT', 'TECH'];

function unitAssigned(unit: UnitDef, staff: StaffMember[]): StaffMember[] {
  return staff.filter(s => s.unit === unit.id);
}

function unitGap(unit: UnitDef, staff: StaffMember[]): number {
  const assigned = unitAssigned(unit, staff);
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

function unitRatio(unit: UnitDef, staff: StaffMember[]): number {
  const rns = staff.filter(s => s.unit === unit.id && s.role === 'RN').length;
  if (rns === 0) return Infinity;
  return unit.patients / rns;
}

function gapTone(gap: number): 'ok' | 'warn' | 'crit' {
  if (gap === 0) return 'ok';
  if (gap <= 2) return 'warn';
  return 'crit';
}

function toneColor(t: 'ok' | 'warn' | 'crit' | 'info' | 'muted'): string {
  if (t === 'ok') return COLORS.ok;
  if (t === 'warn') return COLORS.warn;
  if (t === 'crit') return COLORS.crit;
  if (t === 'info') return COLORS.info;
  return COLORS.textMuted;
}

function initialsFromName(name: string): string {
  // "S. Jenkins" → "SJ"; "Dr. E. Chen" → "EC"; "M. Torres" → "MT"
  const clean = name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').trim();
  const parts = clean.split(/[\s.]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const WorkforceCoverage: React.FC<WorkforceCoverageProps> = ({
  open,
  onClose: _onClose,
  showToast,
  role: _role,
  embedded,
}) => {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('day');
  const [selectedUnitId, setSelectedUnitId] = useState<string>(UNITS[0].id);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignSheet, setAssignSheet] = useState<{ unitId: string; role: StaffRole } | null>(null);
  const [slotMenu, setSlotMenu] = useState<{ staffId: string; anchorId: string } | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [now, setNow] = useState(() => new Date());

  // Live clock tick (once/min is enough).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Filtered staff by shift
  const filteredStaff = useMemo(() => {
    if (shiftFilter === 'all') return staff;
    return staff.filter(s => s.shift === shiftFilter);
  }, [staff, shiftFilter]);

  // Pools
  const floatPool = useMemo(
    () => filteredStaff.filter(s => s.unit === null && s.status === 'float'),
    [filteredStaff],
  );
  const onCallPool = useMemo(
    () => filteredStaff.filter(s => s.unit === null && s.status === 'on-call'),
    [filteredStaff],
  );
  const breakPool = useMemo(
    () => filteredStaff.filter(s => s.status === 'break'),
    [filteredStaff],
  );

  // Summary stats
  const totalOnDuty = filteredStaff.filter(s => s.status === 'on-duty').length;
  const totalGaps = UNITS.reduce((s, u) => s + unitGap(u, filteredStaff), 0);
  const unitsCompliant = UNITS.filter(u => unitGap(u, filteredStaff) === 0).length;
  const ratioViolations = UNITS.filter(u => {
    const r = unitRatio(u, filteredStaff);
    return Number.isFinite(r) && r > u.mandatedRatio;
  }).length;
  const overtimeStaff = filteredStaff.filter(s => (s.hoursWorked ?? 0) > 10);

  // Selected unit
  const selectedUnit = useMemo(
    () => UNITS.find(u => u.id === selectedUnitId) ?? UNITS[0],
    [selectedUnitId],
  );

  // Shift change-over info (rough estimate).
  const shiftChangeIn = useMemo(() => {
    // 07:00 day, 19:00 night — pick the nearest upcoming.
    const h = now.getHours();
    const m = now.getMinutes();
    const toNext = (targetH: number) => {
      const diffMin = (targetH - h) * 60 - m + (targetH <= h ? 24 * 60 : 0);
      return diffMin;
    };
    const nextDayMin = toNext(7);
    const nextNightMin = toNext(19);
    const nextMin = Math.min(nextDayMin, nextNightMin);
    const nextLabel = nextDayMin < nextNightMin ? '07:00 DAY' : '19:00 NIGHT';
    const hours = Math.floor(nextMin / 60);
    const mins = nextMin % 60;
    return {
      label: nextLabel,
      countdown: `${hours}H ${String(mins).padStart(2, '0')}M`,
      minutesLeft: nextMin,
    };
  }, [now]);

  // ── Log helper ─────────────────────────────────────────────────────────

  const appendChange = useCallback(
    (text: string, tone: ChangeLogEntry['tone'] = 'info') => {
      setChangeLog(prev => [
        { id: `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), text, tone },
        ...prev,
      ].slice(0, 40));
    },
    [],
  );

  // ── Mutation API ───────────────────────────────────────────────────────

  const moveStaff = useCallback(
    (staffId: string, targetUnitId: string | null) => {
      setStaff(prev => prev.map(s => {
        if (s.id !== staffId) return s;
        const newStatus: StaffStatus = targetUnitId ? 'on-duty' : 'float';
        return { ...s, unit: targetUnitId, status: newStatus };
      }));
      const member = staff.find(s => s.id === staffId);
      const prevUnitId = member?.unit ?? null;
      const prevUnitName = prevUnitId
        ? UNITS.find(u => u.id === prevUnitId)?.name ?? prevUnitId
        : 'Float Pool';
      const targetName = targetUnitId
        ? UNITS.find(u => u.id === targetUnitId)?.name ?? targetUnitId
        : 'Float Pool';
      if (member) {
        const tone: ChangeLogEntry['tone'] = targetUnitId ? 'ok' : 'info';
        appendChange(`${member.name} → ${targetName}${prevUnitName !== targetName ? ` (from ${prevUnitName})` : ''}`, tone);
        showToast(`${member.name} assigned to ${targetName}`);
      }
    },
    [staff, showToast, appendChange],
  );

  const sendStaffHome = useCallback(
    (staffId: string) => {
      const member = staff.find(s => s.id === staffId);
      setStaff(prev => prev.map(s =>
        s.id === staffId ? { ...s, unit: null, status: 'off' as const } : s,
      ));
      if (member) {
        appendChange(`${member.name} sent home (off shift)`, 'warn');
        showToast(`${member.name} marked off-shift`);
      }
    },
    [staff, showToast, appendChange],
  );

  const callInStaff = useCallback(
    (staffId: string) => {
      const member = staff.find(s => s.id === staffId);
      setStaff(prev => prev.map(s =>
        s.id === staffId ? { ...s, status: 'float' as const } : s,
      ));
      if (member) {
        appendChange(`${member.name} called in → Float Pool`, 'ok');
        showToast(`${member.name} paged in — en-route`);
      }
    },
    [staff, showToast, appendChange],
  );

  // ── Drag handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, staffId: string) => {
    e.dataTransfer.setData('text/plain', staffId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(staffId);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, unitId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(unitId ?? 'FLOAT');
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetUnitId: string | null) => {
    e.preventDefault();
    const staffId = e.dataTransfer.getData('text/plain');
    if (!staffId) return;
    moveStaff(staffId, targetUnitId);
    setDraggedId(null);
    setDropTarget(null);
  }, [moveStaff]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTarget(null);
  }, []);

  if (!open && !embedded) return null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      onClick={() => { setSlotMenu(null); setAssignSheet(null); }}
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        background: COLORS.bg,
        overflow: 'hidden',
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
      }}
    >
      {/* ═════════════════════════════════════════════════════════════════ */}
      {/*  HEADER                                                            */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <header
        style={{
          position: 'relative',
          padding: `${SPACE.md}px ${SPACE.xl}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bg} 100%)`,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xl,
          flexWrap: 'wrap',
          minHeight: 88,
        }}
      >
        <ScanningLine color={COLORS.accent} duration={24} />

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 200 }}>
          <BracketLabel tone="accent" size="xs">STAFFING</BracketLabel>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: COLORS.textPrimary,
              lineHeight: 1.05,
            }}
          >
            Command Center
          </div>
          <Mono tone="muted" size="xs">
            {now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            SHIFT CHANGE IN {shiftChangeIn.countdown}
          </Mono>
        </div>

        <Divider
          variant="solid"
          color={COLORS.border}
          style={{ width: 1, height: 56, borderTop: 'none', borderLeft: `1px solid ${COLORS.border}` }}
        />

        {/* Big stats */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: SPACE.lg, flex: 1, minWidth: 0 }}>
          <BigStat label="ON DUTY" value={totalOnDuty} tone="ok" />
          <BigStat
            label="GAPS"
            value={totalGaps}
            tone={totalGaps === 0 ? 'ok' : totalGaps <= 3 ? 'warn' : 'crit'}
          />
          <BigStat
            label="UNITS COMPLIANT"
            value={`${unitsCompliant}/${UNITS.length}`}
            tone={unitsCompliant === UNITS.length ? 'ok' : 'warn'}
          />
          <BigStat
            label="RATIO VIOLATIONS"
            value={ratioViolations}
            tone={ratioViolations === 0 ? 'ok' : 'crit'}
          />
          <BigStat
            label="OVERTIME &gt;10H"
            value={overtimeStaff.length}
            tone={overtimeStaff.length === 0 ? 'ok' : 'warn'}
          />
        </div>

        {/* Shift filter + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <div
            style={{
              display: 'flex',
              gap: 1,
              padding: 2,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
            }}
          >
            {(['day', 'night', 'all'] as ShiftFilter[]).map(s => {
              const active = shiftFilter === s;
              return (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); setShiftFilter(s); }}
                  style={{
                    padding: `6px ${SPACE.md}px`,
                    minWidth: 56,
                    background: active ? COLORS.surfaceElev : 'transparent',
                    border: active ? `1px solid ${COLORS.borderHover}` : '1px solid transparent',
                    borderRadius: RADIUS.sm,
                    cursor: 'pointer',
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: active ? COLORS.textPrimary : COLORS.textMuted,
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <TacticalButton
            variant="accent"
            size="sm"
            onClick={(e) => {
              e?.stopPropagation?.();
              showToast('Coverage request broadcast to agency + float managers');
              appendChange('Coverage request broadcast (agency + float managers)', 'info');
            }}
          >
            <Radio size={13} />
            <span>REQUEST COVERAGE</span>
          </TacticalButton>

          <TacticalButton
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e?.stopPropagation?.();
              showToast('Handoff composer opening…');
            }}
          >
            <ArrowRightLeft size={13} />
            <span>HANDOFF</span>
          </TacticalButton>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/*  BODY                                                              */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr) minmax(320px, 360px)',
          gap: 1,
          background: COLORS.border,
          overflow: 'hidden',
        }}
      >
        {/* ───────── LEFT · UNIT LIST ───────── */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: COLORS.bg,
            overflow: 'hidden',
          }}
        >
          <PanelHeader
            label="UNITS"
            count={`${unitsCompliant}/${UNITS.length} COMPLIANT`}
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {UNITS.map(u => (
              <UnitListItem
                key={u.id}
                unit={u}
                staff={filteredStaff}
                active={u.id === selectedUnitId}
                isDropTarget={dropTarget === u.id && draggedId !== null}
                onSelect={() => setSelectedUnitId(u.id)}
                onDragOver={(e) => handleDragOver(e, u.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, u.id)}
              />
            ))}
          </div>
        </nav>

        {/* ───────── CENTER · UNIT DETAIL ───────── */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: COLORS.bg,
            overflow: 'hidden',
          }}
        >
          <UnitDetailPanel
            unit={selectedUnit}
            staff={filteredStaff}
            draggedId={draggedId}
            dropTarget={dropTarget}
            slotMenu={slotMenu}
            onSetSlotMenu={setSlotMenu}
            onOpenAssignSheet={(role) =>
              setAssignSheet({ unitId: selectedUnit.id, role })
            }
            onMoveStaff={moveStaff}
            onSendHome={sendStaffHome}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, selectedUnit.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, selectedUnit.id)}
            onMessageUnit={() => {
              showToast(`Broadcast queued for ${selectedUnit.name} crew`);
              appendChange(`Crew broadcast → ${selectedUnit.name}`, 'info');
            }}
            onRequestSupport={() => {
              showToast(`Support request sent for ${selectedUnit.name}`);
              appendChange(`Support request → ${selectedUnit.name}`, 'warn');
            }}
            onDeclareShortage={() => {
              showToast(`${selectedUnit.name} flagged as staffing shortage`);
              appendChange(`${selectedUnit.name} flagged SHORTAGE`, 'warn');
            }}
          />
        </section>

        {/* ───────── RIGHT · RESOURCE POOLS ───────── */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: COLORS.bg,
            overflow: 'hidden',
          }}
        >
          <PanelHeader
            label="RESOURCES"
            count={`${floatPool.length + onCallPool.length} AVAILABLE`}
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <PoolSection
              title="FLOAT POOL"
              tone="info"
              count={floatPool.length}
              members={floatPool}
              draggedId={draggedId}
              isDropTarget={dropTarget === 'FLOAT' && draggedId !== null}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, null)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, null)}
              hintWhenEmpty="// NO FLOAT STAFF AVAILABLE — REQUEST COVERAGE"
              onMessage={(m) => {
                showToast(`Message queued for ${m.name}`);
                appendChange(`Message → ${m.name}`, 'info');
              }}
            />
            <PoolSection
              title="ON CALL"
              tone="warn"
              count={onCallPool.length}
              members={onCallPool}
              draggedId={draggedId}
              isDropTarget={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => { e.preventDefault(); }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => { e.preventDefault(); }}
              hintWhenEmpty="// NO ON-CALL STAFF ROSTERED"
              callInAction={(m) => callInStaff(m.id)}
              onMessage={(m) => {
                showToast(`Message queued for ${m.name}`);
                appendChange(`Message → ${m.name}`, 'info');
              }}
            />
            <PoolSection
              title="ON BREAK"
              tone="muted"
              count={breakPool.length}
              members={breakPool}
              draggedId={draggedId}
              isDropTarget={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => { e.preventDefault(); }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => { e.preventDefault(); }}
              hintWhenEmpty="// NO STAFF ON BREAK"
              onMessage={(m) => {
                showToast(`Message queued for ${m.name}`);
                appendChange(`Message → ${m.name}`, 'info');
              }}
            />

            <div style={{ padding: SPACE.base, borderTop: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <BracketLabel tone="muted" size="xs">SHIFT CHANGE</BracketLabel>
                <Mono tone="secondary" size="xs">{shiftChangeIn.label}</Mono>
                <div style={{ flex: 1 }} />
                <Mono
                  tone={shiftChangeIn.minutesLeft < 60 ? 'warn' : 'muted'}
                  size="xs"
                >
                  {shiftChangeIn.countdown}
                </Mono>
              </div>
              <TacticalCard padding="sm">
                <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                  <ShiftBadge label="IN" value={24} tone="ok" />
                  <ShiftBadge label="OUT" value={27} tone="warn" />
                  <ShiftBadge label="NET" value={-3} tone="crit" />
                </div>
              </TacticalCard>
            </div>

            {/* Recent changes log */}
            <div style={{ padding: SPACE.base, borderTop: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <BracketLabel tone="muted" size="xs">RECENT CHANGES</BracketLabel>
                <Mono tone="muted" size="xs">{changeLog.length}</Mono>
                <div style={{ flex: 1 }} />
                {changeLog.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setChangeLog([]); }}
                    aria-label="Clear change log"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.textMuted,
                      cursor: 'pointer',
                      padding: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: FONTS.mono,
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <RefreshCw size={10} />
                    CLEAR
                  </button>
                )}
              </div>
              {changeLog.length === 0 ? (
                <Mono tone="dim" size="xs">// NO CHANGES THIS SESSION</Mono>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {changeLog.slice(0, 8).map(entry => (
                    <ChangeLogRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/*  FOOTER                                                            */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          padding: `${SPACE.sm}px ${SPACE.xl}px`,
          borderTop: `1px solid ${COLORS.border}`,
          background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bg} 100%)`,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xl,
          minHeight: 44,
        }}
      >
        <FooterChip
          icon={<Shield size={12} color={unitsCompliant === UNITS.length ? COLORS.ok : COLORS.warn} />}
          label="RATIO COMPLIANCE"
          value={`${unitsCompliant}/${UNITS.length}`}
          tone={unitsCompliant === UNITS.length ? 'ok' : 'warn'}
        />
        <FooterChip
          icon={<AlertTriangle size={12} color={ratioViolations > 0 ? COLORS.crit : COLORS.textMuted} />}
          label="RATIO VIOLATIONS"
          value={ratioViolations}
          tone={ratioViolations > 0 ? 'crit' : 'muted'}
        />
        <FooterChip
          icon={<Clock size={12} color={overtimeStaff.length > 0 ? COLORS.warn : COLORS.textMuted} />}
          label="OVERTIME"
          value={`${overtimeStaff.length} STAFF`}
          tone={overtimeStaff.length > 0 ? 'warn' : 'muted'}
        />
        <FooterChip
          icon={<Users size={12} color={COLORS.textMuted} />}
          label="TOTAL ROSTER"
          value={filteredStaff.length}
          tone="muted"
        />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: RADIUS.full,
              background: COLORS.ok,
              boxShadow: `0 0 6px ${COLORS.ok}`,
            }}
          />
          <Mono tone="ok" size="xs">LIVE</Mono>
          <Mono tone="muted" size="xs">
            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Mono>
        </div>
      </footer>

      {/* ── ASSIGN SHEET POPOVER (click empty slot) ────────────────────── */}
      <AnimatePresence>
        {assignSheet && (
          <AssignSheet
            unitId={assignSheet.unitId}
            role={assignSheet.role}
            staff={staff}
            onClose={() => setAssignSheet(null)}
            onPick={(staffId) => {
              moveStaff(staffId, assignSheet.unitId);
              setAssignSheet(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// PanelHeader — small row that sits above each column's scroll area
// ─────────────────────────────────────────────────────────────────────────

const PanelHeader: React.FC<{
  label: string;
  count?: React.ReactNode;
  trailing?: React.ReactNode;
}> = ({ label, count, trailing }) => (
  <div
    style={{
      padding: `${SPACE.sm}px ${SPACE.base}px`,
      borderBottom: `1px solid ${COLORS.border}`,
      background: COLORS.surface,
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      flexShrink: 0,
      minHeight: 36,
    }}
  >
    <BracketLabel tone="muted" size="xs">{label}</BracketLabel>
    {count !== undefined && <Mono tone="muted" size="xs">{count}</Mono>}
    <div style={{ flex: 1 }} />
    {trailing}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// UnitListItem — left column row
// ─────────────────────────────────────────────────────────────────────────

const UnitListItem: React.FC<{
  unit: UnitDef;
  staff: StaffMember[];
  active: boolean;
  isDropTarget: boolean;
  onSelect: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
}> = ({ unit, staff, active, isDropTarget, onSelect, onDragOver, onDragLeave, onDrop }) => {
  const gap = unitGap(unit, staff);
  const cur = unitCurrent(unit, staff);
  const req = unitRequired(unit);
  const covPct = coveragePct(unit, staff);
  const ratio = unitRatio(unit, staff);
  const ratioViolation = Number.isFinite(ratio) && ratio > unit.mandatedRatio;
  const tone = gapTone(gap);
  const leftAccent =
    tone === 'ok' ? COLORS.ok : tone === 'warn' ? COLORS.warn : COLORS.crit;

  return (
    <motion.button
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      whileHover={{ x: active ? 0 : 2 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      aria-pressed={active}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gridTemplateRows: 'auto auto auto',
        rowGap: 4,
        columnGap: SPACE.sm,
        width: '100%',
        textAlign: 'left',
        padding: `${SPACE.md}px ${SPACE.base}px`,
        paddingLeft: SPACE.base + 4,
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${isDropTarget ? COLORS.accent : leftAccent}`,
        background: active
          ? COLORS.surfaceElev
          : isDropTarget
          ? `${COLORS.accent}08`
          : 'transparent',
        cursor: 'pointer',
        fontFamily: FONTS.sans,
        color: 'inherit',
      }}
    >
      {/* Row 1: name + gap chip */}
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.textPrimary,
          letterSpacing: '-0.01em',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
        }}
      >
        {unit.name}
        {active && (
          <motion.span
            layoutId="unit-list-active-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: RADIUS.full,
              background: COLORS.accent,
              boxShadow: `0 0 6px ${COLORS.accent}`,
            }}
          />
        )}
      </span>
      <GapBadge gap={gap} />

      {/* Row 2: floor · beds · ratio */}
      <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', gridColumn: '1 / -1' }}>
        <Mono tone="muted" size="xs">{unit.floor}</Mono>
        <Mono tone="muted" size="xs">{unit.patients}/{unit.beds} BEDS</Mono>
        <Mono
          tone={ratioViolation ? 'crit' : 'muted'}
          size="xs"
        >
          {Number.isFinite(ratio) ? ratio.toFixed(1) : '—'}:1 RN{ratioViolation ? ' ×' : ''}
        </Mono>
        <div style={{ flex: 1 }} />
        <Mono tone="secondary" size="xs">{cur}/{req}</Mono>
      </div>

      {/* Row 3: coverage bar */}
      <div
        style={{
          gridColumn: '1 / -1',
          height: 5,
          background: COLORS.border,
          borderRadius: RADIUS.full,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${covPct}%` }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
          style={{
            height: '100%',
            background:
              covPct === 100 ? COLORS.ok : covPct >= 80 ? COLORS.warn : COLORS.crit,
            borderRadius: RADIUS.full,
          }}
        />
      </div>
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// GapBadge
// ─────────────────────────────────────────────────────────────────────────

const GapBadge: React.FC<{ gap: number }> = ({ gap }) => {
  if (gap === 0) {
    return (
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: COLORS.ok,
          padding: `2px ${SPACE.xs}px`,
          background: `${COLORS.ok}15`,
          border: `1px solid ${COLORS.ok}40`,
          borderRadius: RADIUS.sm,
          alignSelf: 'start',
        }}
      >
        OK
      </span>
    );
  }
  const color = gapTone(gap) === 'warn' ? COLORS.warn : COLORS.crit;
  return (
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color,
        padding: `2px ${SPACE.xs}px`,
        background: `${color}15`,
        border: `1px solid ${color}40`,
        borderRadius: RADIUS.sm,
        alignSelf: 'start',
      }}
    >
      −{gap}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// BigStat — one header stat
// ─────────────────────────────────────────────────────────────────────────

const BigStat: React.FC<{
  label: string;
  value: React.ReactNode;
  tone: 'ok' | 'warn' | 'crit' | 'info' | 'muted';
}> = ({ label, value, tone }) => {
  const color = toneColor(tone);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: `4px ${SPACE.md}px`,
        borderLeft: `2px solid ${color}`,
        background: `${color}08`,
        minWidth: 86,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: COLORS.textMuted,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// UnitDetailPanel — center column content
// ─────────────────────────────────────────────────────────────────────────

interface UnitDetailProps {
  unit: UnitDef;
  staff: StaffMember[];
  draggedId: string | null;
  dropTarget: string | null;
  slotMenu: { staffId: string; anchorId: string } | null;
  onSetSlotMenu: (v: { staffId: string; anchorId: string } | null) => void;
  onOpenAssignSheet: (role: StaffRole) => void;
  onMoveStaff: (staffId: string, unitId: string | null) => void;
  onSendHome: (staffId: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onMessageUnit: () => void;
  onRequestSupport: () => void;
  onDeclareShortage: () => void;
}

const UnitDetailPanel: React.FC<UnitDetailProps> = ({
  unit,
  staff,
  draggedId,
  dropTarget,
  slotMenu,
  onSetSlotMenu,
  onOpenAssignSheet,
  onMoveStaff,
  onSendHome,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onMessageUnit,
  onRequestSupport,
  onDeclareShortage,
}) => {
  const assigned = unitAssigned(unit, staff);
  const gap = unitGap(unit, staff);
  const ratio = unitRatio(unit, staff);
  const ratioViolation = Number.isFinite(ratio) && ratio > unit.mandatedRatio;
  const cur = unitCurrent(unit, staff);
  const req = unitRequired(unit);
  const covPct = coveragePct(unit, staff);
  const isDropTarget = dropTarget === unit.id && draggedId !== null;
  const rolesToShow = ALL_ROLES.filter(r => unit.required[r] > 0);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: isDropTarget ? `${COLORS.accent}04` : 'transparent',
        transition: `background ${MOTION.fast}s ease`,
        overflow: 'hidden',
      }}
    >
      {/* Title block */}
      <div
        style={{
          position: 'relative',
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          display: 'flex',
          alignItems: 'flex-start',
          gap: SPACE.lg,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <BracketLabel tone="accent" size="xs">UNIT DETAIL</BracketLabel>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: COLORS.textPrimary,
            }}
          >
            {unit.name}
          </div>
          <Mono tone="muted" size="xs">FLOOR {unit.floor}</Mono>
        </div>

        <Divider
          variant="solid"
          color={COLORS.border}
          style={{ width: 1, height: 56, borderTop: 'none', borderLeft: `1px solid ${COLORS.border}` }}
        />

        <DetailStat label="BEDS" value={`${unit.patients}/${unit.beds}`} />
        <DetailStat
          label="CURRENT RATIO"
          value={Number.isFinite(ratio) ? `${ratio.toFixed(1)}:1` : '—'}
          tone={ratioViolation ? 'crit' : 'ok'}
        />
        <DetailStat label="MANDATED" value={`${unit.mandatedRatio.toFixed(1)}:1`} tone="muted" />
        <DetailStat label="COVERAGE" value={`${covPct}%`} tone={covPct === 100 ? 'ok' : covPct >= 80 ? 'warn' : 'crit'} />
        <DetailStat
          label="CREW"
          value={`${cur}/${req}`}
          tone={gap === 0 ? 'ok' : gapTone(gap)}
        />
        <DetailStat
          label="GAPS"
          value={gap === 0 ? 'OK' : `−${gap}`}
          tone={gap === 0 ? 'ok' : gapTone(gap)}
        />
      </div>

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          gap: SPACE.sm,
          padding: `${SPACE.sm}px ${SPACE.lg}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <TacticalButton
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e?.stopPropagation?.();
            onMessageUnit();
          }}
        >
          <MessageSquare size={12} />
          <span>MESSAGE UNIT</span>
        </TacticalButton>
        <TacticalButton
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e?.stopPropagation?.();
            onRequestSupport();
          }}
        >
          <Phone size={12} />
          <span>REQUEST SUPPORT</span>
        </TacticalButton>
        {gap > 0 && (
          <TacticalButton
            variant="accent"
            size="sm"
            onClick={(e) => {
              e?.stopPropagation?.();
              onDeclareShortage();
            }}
          >
            <AlertTriangle size={12} />
            <span>DECLARE SHORTAGE</span>
          </TacticalButton>
        )}
        <div style={{ flex: 1 }} />
        {isDropTarget && (
          <Mono tone="info" size="xs">// DROP TO ASSIGN TO {unit.name.toUpperCase()}</Mono>
        )}
      </div>

      {/* Role rows */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: `${SPACE.md}px ${SPACE.lg}px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
          <BracketLabel tone="muted" size="xs">REQUIRED CREW</BracketLabel>
          <Mono tone="muted" size="xs">// TAP SLOT TO ASSIGN · DRAG CHIPS TO MOVE</Mono>
        </div>

        {rolesToShow.map(role => (
          <RoleSlotRow
            key={`${unit.id}-${role}`}
            unitId={unit.id}
            role={role}
            required={unit.required[role]}
            assigned={assigned.filter(s => s.role === role)}
            draggedId={draggedId}
            slotMenu={slotMenu}
            onSetSlotMenu={onSetSlotMenu}
            onOpenAssignSheet={() => onOpenAssignSheet(role)}
            onMoveStaff={onMoveStaff}
            onSendHome={onSendHome}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}

        {/* Extra staff on unit (if any are assigned in roles that aren't required) */}
        {ALL_ROLES.filter(r => unit.required[r] === 0 && assigned.some(a => a.role === r)).map(role => (
          <RoleSlotRow
            key={`${unit.id}-extra-${role}`}
            unitId={unit.id}
            role={role}
            required={0}
            assigned={assigned.filter(s => s.role === role)}
            draggedId={draggedId}
            slotMenu={slotMenu}
            onSetSlotMenu={onSetSlotMenu}
            onOpenAssignSheet={() => onOpenAssignSheet(role)}
            onMoveStaff={onMoveStaff}
            onSendHome={onSendHome}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            extra
          />
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// DetailStat — small stat block in unit detail header
// ─────────────────────────────────────────────────────────────────────────

const DetailStat: React.FC<{
  label: string;
  value: React.ReactNode;
  tone?: 'ok' | 'warn' | 'crit' | 'info' | 'muted';
}> = ({ label, value, tone = 'info' }) => {
  const color = toneColor(tone);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72 }}>
      <Mono tone="muted" size="xs">{label}</Mono>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: tone === 'muted' ? COLORS.textSecondary : color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// RoleSlotRow — one role's required slots in the unit detail
// ─────────────────────────────────────────────────────────────────────────

interface RoleSlotRowProps {
  unitId: string;
  role: StaffRole;
  required: number;
  assigned: StaffMember[];
  draggedId: string | null;
  slotMenu: { staffId: string; anchorId: string } | null;
  onSetSlotMenu: (v: { staffId: string; anchorId: string } | null) => void;
  onOpenAssignSheet: () => void;
  onMoveStaff: (staffId: string, unitId: string | null) => void;
  onSendHome: (staffId: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  extra?: boolean;
}

const RoleSlotRow: React.FC<RoleSlotRowProps> = ({
  unitId,
  role,
  required,
  assigned,
  draggedId,
  slotMenu,
  onSetSlotMenu,
  onOpenAssignSheet,
  onMoveStaff,
  onSendHome,
  onDragStart,
  onDragEnd,
  extra,
}) => {
  const color = ROLE_COLORS[role];
  const filled = assigned.length;
  const emptySlots = Math.max(0, required - filled);
  const over = extra ? filled : Math.max(0, filled - required);
  const rowGap = required === 0 ? 0 : required - filled;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto',
        alignItems: 'start',
        gap: SPACE.md,
        padding: `${SPACE.sm}px 0`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Role column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: RADIUS.full,
              background: color,
              boxShadow: `0 0 6px ${color}80`,
            }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color,
            }}
          >
            {role}
          </span>
        </div>
        <Mono tone="muted" size="xs">
          {extra ? `${filled} EXTRA` : `${filled}/${required}`}
          {!extra && over > 0 && ` +${over}`}
        </Mono>
      </div>

      {/* Slots */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE.xs,
          paddingTop: 2,
        }}
      >
        {assigned.map(member => (
          <AssignedChip
            key={member.id}
            member={member}
            menuOpen={slotMenu?.staffId === member.id}
            onOpenMenu={(anchorId) => onSetSlotMenu({ staffId: member.id, anchorId })}
            onCloseMenu={() => onSetSlotMenu(null)}
            onSendToFloat={() => { onMoveStaff(member.id, null); onSetSlotMenu(null); }}
            onSendHome={() => { onSendHome(member.id); onSetSlotMenu(null); }}
            isDragged={draggedId === member.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {!extra &&
          Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot
              key={`empty-${unitId}-${role}-${i}`}
              color={color}
              onClick={onOpenAssignSheet}
            />
          ))}
      </div>

      {/* Trailing gap chip */}
      <div style={{ paddingTop: 2 }}>
        {extra ? (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: COLORS.textMuted,
              padding: `2px ${SPACE.xs}px`,
              background: `${COLORS.textMuted}15`,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
            }}
          >
            EXTRA
          </span>
        ) : rowGap > 0 ? (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.crit,
              padding: `2px ${SPACE.xs}px`,
              background: `${COLORS.crit}15`,
              border: `1px solid ${COLORS.crit}40`,
              borderRadius: RADIUS.sm,
            }}
          >
            −{rowGap}
          </span>
        ) : (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 700,
              color: COLORS.ok,
              padding: `2px ${SPACE.xs}px`,
              background: `${COLORS.ok}15`,
              border: `1px solid ${COLORS.ok}40`,
              borderRadius: RADIUS.sm,
            }}
          >
            OK
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// EmptySlot — dashed circle placeholder, click to assign
// ─────────────────────────────────────────────────────────────────────────

const EmptySlot: React.FC<{ color: string; onClick: () => void }> = ({ color, onClick }) => (
  <motion.button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.96 }}
    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
    aria-label="Assign staff to this slot"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      minHeight: 26,
      background: 'transparent',
      border: `1px dashed ${color}60`,
      borderRadius: RADIUS.full,
      color: color,
      cursor: 'pointer',
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}
  >
    <Plus size={11} />
    ASSIGN
  </motion.button>
);

// ─────────────────────────────────────────────────────────────────────────
// AssignedChip — staff currently on a unit, draggable + clickable
// ─────────────────────────────────────────────────────────────────────────

interface AssignedChipProps {
  member: StaffMember;
  menuOpen: boolean;
  onOpenMenu: (anchorId: string) => void;
  onCloseMenu: () => void;
  onSendToFloat: () => void;
  onSendHome: () => void;
  isDragged: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
}

const AssignedChip: React.FC<AssignedChipProps> = ({
  member,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onSendToFloat,
  onSendHome,
  isDragged,
  onDragStart,
  onDragEnd,
}) => {
  const color = ROLE_COLORS[member.role];
  const anchorId = `chip-${member.id}`;
  const isOvertime = (member.hoursWorked ?? 0) > 10;

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: isDragged ? 0.4 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: MOTION.fast, ease: MOTION.ease }}
        draggable
        onDragStart={(e) => onDragStart(e as unknown as DragEvent<HTMLDivElement>, member.id)}
        onDragEnd={onDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          menuOpen ? onCloseMenu() : onOpenMenu(anchorId);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          minHeight: 26,
          background: menuOpen ? `${color}14` : COLORS.surface,
          border: `1px solid ${menuOpen ? color : COLORS.border}`,
          borderRadius: RADIUS.full,
          cursor: 'grab',
          userSelect: 'none',
          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
        }}
        title={`${member.name} · ${ROLE_LABEL[member.role]}${member.certifications ? ' · ' + member.certifications.join(', ') : ''}${member.hoursWorked ? ' · ' + member.hoursWorked + 'h' : ''}`}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: RADIUS.full,
            background: `${color}30`,
            border: `1px solid ${color}60`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONTS.mono,
            fontSize: 9,
            fontWeight: 700,
            color: color,
            letterSpacing: 0,
          }}
        >
          {initialsFromName(member.name)}
        </span>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 500,
            color: COLORS.textPrimary,
            whiteSpace: 'nowrap',
            letterSpacing: '-0.005em',
          }}
        >
          {member.name}
        </span>
        {isOvertime && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: RADIUS.full,
              background: COLORS.warn,
              boxShadow: `0 0 4px ${COLORS.warn}`,
            }}
            title={`${member.hoursWorked}h on shift`}
          />
        )}
        <ChevronDown size={10} color={COLORS.textMuted} />
      </motion.div>

      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 200,
            background: COLORS.surfaceElev,
            border: `1px solid ${COLORS.borderHover}`,
            borderRadius: RADIUS.md,
            boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
            padding: SPACE.xs,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 20,
          }}
        >
          <div style={{ padding: `${SPACE.xs}px ${SPACE.sm}px`, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 2 }}>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.textPrimary,
              }}
            >
              {member.name}
            </div>
            <div style={{ display: 'flex', gap: SPACE.xs, marginTop: 2 }}>
              <Mono tone="secondary" size="xs">{member.role}</Mono>
              <Mono
                tone={isOvertime ? 'warn' : 'muted'}
                size="xs"
              >
                {member.hoursWorked ?? 0}H
              </Mono>
              {member.certifications && member.certifications.length > 0 && (
                <Mono tone="muted" size="xs">{member.certifications.join(' · ')}</Mono>
              )}
            </div>
          </div>
          <MenuItem
            icon={<ArrowRightLeft size={12} />}
            label="SEND TO FLOAT"
            onClick={onSendToFloat}
          />
          <MenuItem
            icon={<MessageSquare size={12} />}
            label="MESSAGE"
            onClick={onCloseMenu}
          />
          <MenuItem
            icon={<Check size={12} />}
            label={`APPROVE ${member.hoursWorked && member.hoursWorked > 10 ? 'OT' : 'SHIFT'}`}
            onClick={onCloseMenu}
          />
          <MenuItem
            icon={<X size={12} />}
            label="SEND HOME"
            danger
            onClick={onSendHome}
          />
        </motion.div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      padding: `${SPACE.xs}px ${SPACE.sm}px`,
      background: 'transparent',
      border: 'none',
      borderRadius: RADIUS.sm,
      cursor: 'pointer',
      fontFamily: FONTS.mono,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      color: danger ? COLORS.crit : COLORS.textSecondary,
      textAlign: 'left',
      textTransform: 'uppercase',
      transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = danger ? `${COLORS.crit}15` : COLORS.surface; e.currentTarget.style.color = danger ? COLORS.crit : COLORS.textPrimary; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? COLORS.crit : COLORS.textSecondary; }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', color: danger ? COLORS.crit : COLORS.textMuted }}>{icon}</span>
    <span>{label}</span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// PoolSection — right column group
// ─────────────────────────────────────────────────────────────────────────

interface PoolSectionProps {
  title: string;
  tone: 'info' | 'warn' | 'muted';
  count: number;
  members: StaffMember[];
  draggedId: string | null;
  isDropTarget: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  hintWhenEmpty: string;
  callInAction?: (m: StaffMember) => void;
  onMessage: (m: StaffMember) => void;
}

const PoolSection: React.FC<PoolSectionProps> = ({
  title,
  tone,
  count,
  members,
  draggedId,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  hintWhenEmpty,
  callInAction,
  onMessage,
}) => {
  const color = toneColor(tone);
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div
        style={{
          padding: `${SPACE.sm}px ${SPACE.base}px`,
          background: COLORS.surface,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: RADIUS.full,
            background: color,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
        <div style={{ flex: 1 }} />
        <Mono tone="muted" size="xs">{count}</Mono>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          padding: SPACE.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.xs,
          background: isDropTarget ? `${color}06` : 'transparent',
          border: isDropTarget ? `1px dashed ${color}60` : '1px dashed transparent',
          borderRadius: RADIUS.sm,
          margin: isDropTarget ? 4 : 0,
          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
          minHeight: 52,
        }}
      >
        <AnimatePresence mode="popLayout">
          {members.map(m => (
            <StaffPoolCard
              key={m.id}
              member={m}
              isDragged={draggedId === m.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onCallIn={callInAction ? () => callInAction(m) : undefined}
              onMessage={() => onMessage(m)}
            />
          ))}
        </AnimatePresence>
        {members.length === 0 && (
          <Mono tone="dim" size="xs" style={{ padding: `${SPACE.sm}px ${SPACE.xs}px` }}>
            {hintWhenEmpty}
          </Mono>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StaffPoolCard — richer card in right column
// ─────────────────────────────────────────────────────────────────────────

const StaffPoolCard: React.FC<{
  member: StaffMember;
  isDragged: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onCallIn?: () => void;
  onMessage: () => void;
}> = ({ member, isDragged, onDragStart, onDragEnd, onCallIn, onMessage }) => {
  const color = ROLE_COLORS[member.role];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isDragged ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as DragEvent<HTMLDivElement>, member.id)}
      onDragEnd={onDragEnd}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: SPACE.sm,
        padding: `${SPACE.sm}px ${SPACE.sm}px`,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: RADIUS.sm,
        cursor: 'grab',
      }}
    >
      {/* Avatar initials */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: RADIUS.full,
          background: `${color}20`,
          border: `1px solid ${color}60`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.mono,
          fontSize: 11,
          fontWeight: 700,
          color: color,
          flexShrink: 0,
        }}
      >
        {initialsFromName(member.name)}
      </div>

      {/* Name + meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.005em',
          }}
        >
          {member.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
          <Mono tone="secondary" size="xs" style={{ color }}>
            {member.role}
          </Mono>
          {member.certifications && member.certifications.length > 0 && (
            <Mono tone="muted" size="xs">
              {member.certifications.slice(0, 2).join(' ')}
            </Mono>
          )}
          {member.status === 'on-call' && <StatusPill label="ON CALL" tone="warn" />}
          {member.status === 'break' && <StatusPill label="BREAK" tone="muted" />}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {onCallIn && (
          <button
            onClick={(e) => { e.stopPropagation(); onCallIn(); }}
            aria-label="Call in"
            style={{
              background: 'none',
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              padding: `4px ${SPACE.xs}px`,
              cursor: 'pointer',
              color: COLORS.warn,
              fontFamily: FONTS.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${COLORS.warn}15`; e.currentTarget.style.borderColor = COLORS.warn; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = COLORS.border; }}
          >
            <PhoneOutgoing size={10} />
            CALL
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onMessage(); }}
          aria-label="Message"
          title="Message"
          style={{
            background: 'none',
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            padding: 4,
            cursor: 'pointer',
            color: COLORS.textMuted,
            display: 'inline-flex',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.borderHover; e.currentTarget.style.color = COLORS.textPrimary; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textMuted; }}
        >
          <MessageSquare size={11} />
        </button>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: COLORS.textDim,
            cursor: 'grab',
            padding: 2,
          }}
        >
          <GripVertical size={12} />
        </span>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// AssignSheet — popover shown when user clicks an empty slot
// ─────────────────────────────────────────────────────────────────────────

const AssignSheet: React.FC<{
  unitId: string;
  role: StaffRole;
  staff: StaffMember[];
  onClose: () => void;
  onPick: (id: string) => void;
}> = ({ unitId, role, staff, onClose, onPick }) => {
  const unit = UNITS.find(u => u.id === unitId);
  const candidates = useMemo(() => {
    const hereFirst = (a: StaffMember, b: StaffMember) => {
      const aw = a.status === 'float' ? 0 : a.status === 'on-call' ? 1 : 2;
      const bw = b.status === 'float' ? 0 : b.status === 'on-call' ? 1 : 2;
      return aw - bw;
    };
    return staff
      .filter(s => s.role === role && s.unit !== unitId)
      .sort(hereFirst);
  }, [staff, role, unitId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.fast }}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACE.xl,
        zIndex: 30,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80%',
          background: COLORS.surfaceElev,
          border: `1px solid ${COLORS.borderHover}`,
          borderRadius: RADIUS.md,
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <CornerBracket position="tl" color={COLORS.accent} size={10} thickness={1.5} />
        <CornerBracket position="tr" color={COLORS.accent} size={10} thickness={1.5} />
        <CornerBracket position="bl" color={COLORS.accent} size={10} thickness={1.5} />
        <CornerBracket position="br" color={COLORS.accent} size={10} thickness={1.5} />
        <ScanningLine color={COLORS.accent} duration={16} />

        <div
          style={{
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
          }}
        >
          <BracketLabel tone="accent" size="xs">ASSIGN</BracketLabel>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.textPrimary,
            }}
          >
            {role} → {unit?.name ?? unitId}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close"
            style={{
              background: 'none',
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textMuted,
              cursor: 'pointer',
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <X size={12} />
            <Mono tone="muted" size="xs">ESC</Mono>
          </button>
        </div>

        <div style={{ padding: SPACE.sm, overflowY: 'auto' }}>
          {candidates.length === 0 ? (
            <div style={{ padding: SPACE.xl, textAlign: 'center' }}>
              <Mono tone="dim" size="xs">
                // NO {role}s AVAILABLE — REQUEST COVERAGE
              </Mono>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              {candidates.map(m => {
                const fromLabel = m.unit
                  ? `FROM ${UNITS.find(u => u.id === m.unit)?.name ?? m.unit}`
                  : m.status === 'float'
                  ? 'FROM FLOAT POOL'
                  : m.status === 'on-call'
                  ? 'ON CALL'
                  : m.status === 'break'
                  ? 'ON BREAK'
                  : 'OFF';
                return (
                  <button
                    key={m.id}
                    onClick={(e) => { e.stopPropagation(); onPick(m.id); }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      padding: `${SPACE.sm}px ${SPACE.md}px`,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = COLORS.surfaceHover;
                      e.currentTarget.style.borderColor = COLORS.borderHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = COLORS.surface;
                      e.currentTarget.style.borderColor = COLORS.border;
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: RADIUS.full,
                        background: `${ROLE_COLORS[m.role]}20`,
                        border: `1px solid ${ROLE_COLORS[m.role]}60`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        color: ROLE_COLORS[m.role],
                      }}
                    >
                      {initialsFromName(m.name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {m.name}
                      </span>
                      <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center' }}>
                        <Mono tone="muted" size="xs">{fromLabel}</Mono>
                        {m.certifications && m.certifications.length > 0 && (
                          <Mono tone="muted" size="xs">· {m.certifications.join(' ')}</Mono>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} color={COLORS.textMuted} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ChangeLogRow — one entry in recent changes
// ─────────────────────────────────────────────────────────────────────────

const ChangeLogRow: React.FC<{ entry: ChangeLogEntry }> = ({ entry }) => {
  const color = entry.tone === 'ok' ? COLORS.ok : entry.tone === 'warn' ? COLORS.warn : COLORS.info;
  const elapsed = Math.max(0, Math.floor((Date.now() - entry.ts) / 1000));
  const elapsedLabel = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      style={{
        display: 'grid',
        gridTemplateColumns: '8px 1fr auto',
        gap: SPACE.xs,
        alignItems: 'start',
        padding: `${SPACE.xs}px 0`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          marginTop: 6,
          borderRadius: RADIUS.full,
          background: color,
          boxShadow: `0 0 4px ${color}80`,
        }}
      />
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 12,
          color: COLORS.textSecondary,
          lineHeight: 1.35,
          letterSpacing: '-0.005em',
        }}
      >
        {entry.text}
      </span>
      <Mono tone="dim" size="xs">{elapsedLabel}</Mono>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// FooterChip — bottom strip item
// ─────────────────────────────────────────────────────────────────────────

const FooterChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: 'ok' | 'warn' | 'crit' | 'info' | 'muted';
}> = ({ icon, label, value, tone }) => {
  const color = toneColor(tone);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
      {icon}
      <Mono tone="muted" size="xs">{label}</Mono>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 13,
          fontWeight: 700,
          color,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ShiftBadge — used in shift change-over card
// ─────────────────────────────────────────────────────────────────────────

const ShiftBadge: React.FC<{
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'crit' | 'info';
}> = ({ label, value, tone }) => {
  const color = toneColor(tone);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: `2px ${SPACE.sm}px`,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: RADIUS.sm,
      }}
    >
      <Mono tone="muted" size="xs">{label}</Mono>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 12,
          fontWeight: 700,
          color,
        }}
      >
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
};
