import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PhoneCall,
  ShieldAlert,
  Clock,
  MapPin,
  Search,
  Filter,
  MessageSquare,
  Coffee,
  ChevronRight,
  ChevronDown,
  Activity,
  Radio,
  AlertCircle,
  BadgeCheck,
  X,
  UserMinus,
  Shuffle,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  Mono,
  BracketLabel,
  StatusPill,
  SectionTitle,
  TacticalCard,
  CornerBracket,
  TacticalButton,
  Divider,
  ScanningLine,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────────
type ShiftStatus = 'On Shift' | 'On Break' | 'Off Duty' | 'On Call';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  status: ShiftStatus;
  hoursWorked: number;
  contact: string;
  location: string;
  shiftStart: string;      // HH:MM
  shiftEnd: string;        // HH:MM
  shiftLength: number;     // hours (for progress bar)
  currentTask?: string;
  certifications: string[];
  patientsAssigned: number;
  yearsExperience: number;
}

interface OpenShift {
  id: string;
  role: string;
  department: string;
  window: string;       // "19:00 – 07:00"
  urgency: 'crit' | 'warn' | 'info';
  reason: string;       // "Call-out · Jessica Alba"
}

interface DeptCoverage {
  department: string;
  target: number;
  actual: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Mock data — 24 members across 7 departments, realistic shift windows
// Assumed "now" = 13:30, so hours-worked values ≈ (now - shiftStart).
// ─────────────────────────────────────────────────────────────────────────
const mockStaff: StaffMember[] = [
  // EMERGENCY
  { id: 'MD-201', name: 'Dr. Emily Chen', role: 'Attending', department: 'Emergency',
    status: 'On Shift', hoursWorked: 8.5, contact: 'Pager 881', location: 'Trauma Bay 2',
    shiftStart: '05:00', shiftEnd: '17:00', shiftLength: 12,
    currentTask: 'Trauma assessment · Bed 03',
    certifications: ['ACLS', 'ATLS', 'PALS'], patientsAssigned: 4, yearsExperience: 12 },
  { id: 'RN-101', name: 'Sarah Jenkins', role: 'Charge Nurse', department: 'Emergency',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 4421', location: 'Triage',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Triage oversight · queue 7',
    certifications: ['ACLS', 'TNCC', 'CPEN'], patientsAssigned: 0, yearsExperience: 8 },
  { id: 'RN-102', name: 'Michael Chang', role: 'Staff Nurse', department: 'Emergency',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 4422', location: 'Acute Pod A',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Pod A · 3 patients',
    certifications: ['ACLS', 'TNCC'], patientsAssigned: 3, yearsExperience: 4 },
  { id: 'RN-105', name: 'Priya Patel', role: 'Staff Nurse', department: 'Emergency',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 4423', location: 'Acute Pod B',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Pod B · 2 patients',
    certifications: ['ACLS', 'PALS'], patientsAssigned: 2, yearsExperience: 3 },
  { id: 'RN-106', name: 'Tomás Rivera', role: 'Staff Nurse', department: 'Emergency',
    status: 'On Break', hoursWorked: 6.0, contact: 'Ext 4424', location: 'Break Room A',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    certifications: ['ACLS', 'TNCC'], patientsAssigned: 2, yearsExperience: 5 },
  { id: 'TECH-302', name: 'Jenna Okafor', role: 'ED Tech', department: 'Emergency',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 4450', location: 'Fast Track',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'EKG · Bed 08',
    certifications: ['EMT-B'], patientsAssigned: 0, yearsExperience: 2 },

  // ICU (the shortage department)
  { id: 'MD-205', name: 'Dr. Anand Desai', role: 'Intensivist', department: 'ICU',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Pager 874', location: 'ICU Rounds',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Afternoon rounds',
    certifications: ['ACLS', 'CCM'], patientsAssigned: 8, yearsExperience: 15 },
  { id: 'RN-110', name: 'Hannah Wolf', role: 'Charge Nurse', department: 'ICU',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 5501', location: 'ICU West',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Bed assignments',
    certifications: ['ACLS', 'CCRN'], patientsAssigned: 2, yearsExperience: 9 },
  { id: 'RN-103', name: 'Jessica Alba', role: 'Staff Nurse', department: 'ICU',
    status: 'On Break', hoursWorked: 6.0, contact: 'Ext 5510', location: 'Break Room B',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    certifications: ['ACLS', 'CCRN'], patientsAssigned: 2, yearsExperience: 6 },
  { id: 'RN-112', name: 'Daniel Kwon', role: 'Staff Nurse', department: 'ICU',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 5512', location: 'ICU East',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Vent mgmt · Bed 12',
    certifications: ['ACLS', 'CCRN'], patientsAssigned: 2, yearsExperience: 7 },

  // SURGERY
  { id: 'MD-202', name: 'Dr. Robert Smith', role: 'Surgeon', department: 'Surgery',
    status: 'On Call', hoursWorked: 0, contact: '555-0192', location: 'Off-site (8 min ETA)',
    shiftStart: '00:00', shiftEnd: '24:00', shiftLength: 24,
    certifications: ['ACLS', 'ATLS', 'ACS-BLS'], patientsAssigned: 0, yearsExperience: 18 },
  { id: 'MD-208', name: 'Dr. Lia Moreno', role: 'Surgeon', department: 'Surgery',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Pager 862', location: 'OR 4',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Lap appy · OR 4',
    certifications: ['ACLS', 'ATLS'], patientsAssigned: 1, yearsExperience: 11 },
  { id: 'RN-122', name: 'Marcus Field', role: 'OR Nurse', department: 'Surgery',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 6201', location: 'OR 4',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Scrub · OR 4',
    certifications: ['ACLS', 'CNOR'], patientsAssigned: 1, yearsExperience: 6 },

  // IMAGING
  { id: 'TECH-301', name: 'David Miller', role: 'Rad Tech', department: 'Imaging',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 3311', location: 'CT Room 1',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'CT head · pt. Ramirez',
    certifications: ['ARRT-CT'], patientsAssigned: 1, yearsExperience: 5 },
  { id: 'TECH-305', name: 'Aisha Baako', role: 'US Tech', department: 'Imaging',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 3322', location: 'US Bay',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'FAST exam · Bed 03',
    certifications: ['ARDMS'], patientsAssigned: 0, yearsExperience: 4 },

  // MED/SURG
  { id: 'RN-140', name: 'Grace Park', role: 'Charge Nurse', department: 'Med/Surg',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 7101', location: '5 West',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Admissions · 3 pending',
    certifications: ['ACLS', 'MedSurg-BC'], patientsAssigned: 0, yearsExperience: 10 },
  { id: 'RN-141', name: 'Brandon Hayes', role: 'Staff Nurse', department: 'Med/Surg',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 7102', location: '5 West · Hall B',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Rounds · rooms 508–515',
    certifications: ['ACLS'], patientsAssigned: 6, yearsExperience: 3 },
  { id: 'RN-104', name: 'Amanda Lewis', role: 'Staff Nurse', department: 'Med/Surg',
    status: 'Off Duty', hoursWorked: 0, contact: '555-0188', location: 'Off-site',
    shiftStart: '19:00', shiftEnd: '07:00', shiftLength: 12,
    certifications: ['ACLS', 'MedSurg-BC'], patientsAssigned: 0, yearsExperience: 7 },

  // PEDS
  { id: 'MD-215', name: 'Dr. Nina Albright', role: 'Peds Attending', department: 'Peds',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Pager 903', location: 'Peds Pod',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Well-child · Peds Pod',
    certifications: ['ACLS', 'PALS', 'NRP'], patientsAssigned: 3, yearsExperience: 9 },
  { id: 'RN-151', name: 'Olivia Reyes', role: 'Peds Nurse', department: 'Peds',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 8801', location: 'Peds Pod',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Peds · 3 patients',
    certifications: ['PALS', 'CPEN'], patientsAssigned: 3, yearsExperience: 5 },

  // OPERATIONS
  { id: 'SEC-401', name: 'James Wilson', role: 'Security', department: 'Operations',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Radio Ch 2', location: 'ED Entrance',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Perimeter patrol',
    certifications: ['CPI', 'BLS'], patientsAssigned: 0, yearsExperience: 4 },
  { id: 'OPS-410', name: 'Kenji Tanaka', role: 'Unit Clerk', department: 'Operations',
    status: 'On Shift', hoursWorked: 6.5, contact: 'Ext 4400', location: 'ED Charge Desk',
    shiftStart: '07:00', shiftEnd: '19:00', shiftLength: 12,
    currentTask: 'Bed board · admits',
    certifications: ['HUC'], patientsAssigned: 0, yearsExperience: 6 },
  { id: 'SEC-402', name: 'Rachel Voss', role: 'Security', department: 'Operations',
    status: 'On Call', hoursWorked: 0, contact: 'Radio Ch 4', location: 'On-premises',
    shiftStart: '00:00', shiftEnd: '24:00', shiftLength: 24,
    certifications: ['CPI'], patientsAssigned: 0, yearsExperience: 3 },
];

const mockOpenShifts: OpenShift[] = [
  { id: 'OPEN-1', role: 'ICU RN', department: 'ICU', window: '19:00 – 07:00 tonight',
    urgency: 'crit', reason: 'Call-out · M. Suarez' },
  { id: 'OPEN-2', role: 'ED Tech', department: 'Emergency', window: 'Sat overnight',
    urgency: 'warn', reason: 'Weekend gap' },
  { id: 'OPEN-3', role: 'Pharmacy', department: 'Operations', window: '23:00 – 07:00',
    urgency: 'info', reason: 'Float pool backup' },
];

const departmentTargets: Record<string, number> = {
  Emergency: 6,
  ICU: 4,
  Surgery: 3,
  Imaging: 2,
  'Med/Surg': 3,
  Peds: 2,
  Operations: 2,
};

// Status display order (for grouping)
const STATUS_ORDER: ShiftStatus[] = ['On Shift', 'On Break', 'On Call', 'Off Duty'];

const statusToTone: Record<ShiftStatus, 'ok' | 'warn' | 'info' | 'neutral'> = {
  'On Shift': 'ok',
  'On Break': 'warn',
  'On Call': 'info',
  'Off Duty': 'neutral',
};

const statusToColor: Record<ShiftStatus, string> = {
  'On Shift': COLORS.ok,
  'On Break': COLORS.warn,
  'On Call': COLORS.info,
  'Off Duty': COLORS.textMuted,
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
interface RosterProps {
  currentUser: UserProfile | null;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const Roster: React.FC<RosterProps> = ({ showToast }) => {
  // Search / filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<ShiftStatus | 'All'>('All');

  // Row expansion state — multiple rows can be expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ShiftStatus>>(new Set());

  // Live status overrides (simulate quick actions mutating roster state)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ShiftStatus>>({});
  const [locationOverrides, setLocationOverrides] = useState<Record<string, string>>({});

  // Apply overrides to roster
  const staff = useMemo<StaffMember[]>(() => {
    return mockStaff.map((s) => ({
      ...s,
      status: statusOverrides[s.id] ?? s.status,
      location: locationOverrides[s.id] ?? s.location,
    }));
  }, [statusOverrides, locationOverrides]);

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(mockStaff.map((s) => s.department)))],
    [],
  );

  // Filtered list
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return staff.filter((m) => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q);
      const matchesDept = departmentFilter === 'All' || m.department === departmentFilter;
      const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [staff, searchQuery, departmentFilter, statusFilter]);

  // Grouped by status
  const grouped = useMemo(() => {
    const map: Record<ShiftStatus, StaffMember[]> = {
      'On Shift': [],
      'On Break': [],
      'On Call': [],
      'Off Duty': [],
    };
    filteredStaff.forEach((m) => map[m.status].push(m));
    // Sort each group: department then role
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        if (a.department !== b.department) return a.department.localeCompare(b.department);
        return a.role.localeCompare(b.role);
      }),
    );
    return map;
  }, [filteredStaff]);

  // Census counts (use full roster after overrides, not filtered)
  const census = useMemo(() => {
    return {
      total: staff.length,
      onShift: staff.filter((s) => s.status === 'On Shift').length,
      onBreak: staff.filter((s) => s.status === 'On Break').length,
      onCall: staff.filter((s) => s.status === 'On Call').length,
      offDuty: staff.filter((s) => s.status === 'Off Duty').length,
    };
  }, [staff]);

  // Department coverage — actual counts on-shift
  const coverage = useMemo<DeptCoverage[]>(() => {
    return Object.entries(departmentTargets).map(([department, target]) => ({
      department,
      target,
      actual: staff.filter((s) => s.department === department && s.status === 'On Shift').length,
    }));
  }, [staff]);

  const hasActiveFilter = searchQuery || departmentFilter !== 'All' || statusFilter !== 'All';

  // ── Handlers ────────────────────────────────────────────────────────────
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (status: ShiftStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const changeStatus = (member: StaffMember, next: ShiftStatus, opts?: { location?: string }) => {
    setStatusOverrides((prev) => ({ ...prev, [member.id]: next }));
    if (opts?.location) {
      setLocationOverrides((prev) => ({ ...prev, [member.id]: opts.location! }));
    }
    showToast?.(`${member.name} → ${next}`, 'success');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('All');
    setStatusFilter('All');
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE['2xl'],
        background: COLORS.bg,
        gap: SPACE.lg,
        overflow: 'hidden',
      }}
    >
      {/* ── Header: title + search/filter + census strip ────────────────── */}
      <RosterHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        departmentFilter={departmentFilter}
        setDepartmentFilter={setDepartmentFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        departments={departments}
        census={census}
        hasActiveFilter={!!hasActiveFilter}
        onClearFilters={clearFilters}
      />

      {/* ── Body: 2-column layout ───────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: SPACE.lg,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Main — grouped roster */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
            overflowY: 'auto',
            paddingRight: SPACE.xs,
          }}
        >
          {filteredStaff.length === 0 ? (
            <TacticalCard padding="lg">
              <div
                style={{
                  padding: SPACE['2xl'],
                  textAlign: 'center',
                  color: COLORS.textMuted,
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                // No personnel match these filters
              </div>
            </TacticalCard>
          ) : (
            STATUS_ORDER.map((status) => {
              const members = grouped[status];
              if (members.length === 0) return null;
              return (
                <StaffGroup
                  key={status}
                  status={status}
                  members={members}
                  collapsed={collapsedGroups.has(status)}
                  onToggle={() => toggleGroup(status)}
                  expandedIds={expandedIds}
                  onRowToggle={toggleExpanded}
                  onChangeStatus={changeStatus}
                  onMessage={(m) => showToast?.(`Message sent to ${m.name}`, 'success')}
                  onPage={(m) => showToast?.(`Paging ${m.name}…`, 'info')}
                  onCall={(m) => showToast?.(`Calling ${m.contact}…`, 'info')}
                />
              );
            })
          )}
        </div>

        {/* Sidebar — coverage, open shifts, shift clock */}
        <CoverageSidebar
          coverage={coverage}
          openShifts={mockOpenShifts}
          onDepartmentClick={(d) => setDepartmentFilter(d)}
          activeDept={departmentFilter}
          onOpenShiftClick={(os) =>
            showToast?.(`Searching available: ${os.role} for ${os.window}`, 'info')
          }
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Header — title, search/filter, census strip (click-to-filter chips)
// ─────────────────────────────────────────────────────────────────────────
const RosterHeader: React.FC<{
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (v: string) => void;
  statusFilter: ShiftStatus | 'All';
  setStatusFilter: (v: ShiftStatus | 'All') => void;
  departments: string[];
  census: { total: number; onShift: number; onBreak: number; onCall: number; offDuty: number };
  hasActiveFilter: boolean;
  onClearFilters: () => void;
}> = ({
  searchQuery,
  setSearchQuery,
  departmentFilter,
  setDepartmentFilter,
  statusFilter,
  setStatusFilter,
  departments,
  census,
  hasActiveFilter,
  onClearFilters,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, flexShrink: 0 }}>
      {/* Row 1: title + search + department filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: SPACE.lg,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <SectionTitle
            id="PERS.ROSTER"
            label="Staffing & Roster"
            divider={false}
            style={{ marginBottom: SPACE.xs }}
          />
          <Mono tone="muted" size="xs">
            // Real-time personnel tracking · click a chip to filter · click a row to expand
          </Mono>
        </div>
        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center', flexWrap: 'wrap' }}>
          <TacticalInput
            icon={<Search size={13} strokeWidth={2} />}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search name, role, ID…"
            width={260}
          />
          <TacticalSelect
            icon={<Filter size={13} strokeWidth={2} />}
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departments}
          />
          {hasActiveFilter && (
            <TacticalButton
              size="sm"
              variant="ghost"
              icon={<X size={12} strokeWidth={2} />}
              onClick={onClearFilters}
            >
              Clear
            </TacticalButton>
          )}
        </div>
      </div>

      {/* Row 2: census chip strip — click to filter by status */}
      <CensusStrip
        census={census}
        statusFilter={statusFilter}
        onStatusClick={(s) => setStatusFilter(statusFilter === s ? 'All' : s)}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Census strip — interactive status chips
// ─────────────────────────────────────────────────────────────────────────
const CensusStrip: React.FC<{
  census: { total: number; onShift: number; onBreak: number; onCall: number; offDuty: number };
  statusFilter: ShiftStatus | 'All';
  onStatusClick: (s: ShiftStatus) => void;
}> = ({ census, statusFilter, onStatusClick }) => {
  const chips: Array<{ status: ShiftStatus; label: string; count: number; color: string }> = [
    { status: 'On Shift', label: 'ON SHIFT', count: census.onShift, color: COLORS.ok },
    { status: 'On Break', label: 'ON BREAK', count: census.onBreak, color: COLORS.warn },
    { status: 'On Call', label: 'ON CALL', count: census.onCall, color: COLORS.info },
    { status: 'Off Duty', label: 'OFF DUTY', count: census.offDuty, color: COLORS.textMuted },
  ];

  return (
    <TacticalCard padding="none" style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `100px repeat(${chips.length}, 1fr)`,
          alignItems: 'stretch',
        }}
      >
        {/* Total tile */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4,
            padding: `${SPACE.md}px ${SPACE.base}px`,
            borderRight: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceElev,
          }}
        >
          <Mono tone="muted" size="xs">TOTAL</Mono>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 0.95,
              color: COLORS.textPrimary,
            }}
          >
            {census.total}
          </span>
        </div>

        {chips.map((chip) => {
          const active = statusFilter === chip.status;
          return (
            <button
              key={chip.status}
              type="button"
              onClick={() => onStatusClick(chip.status)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                gap: 4,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                border: 'none',
                borderRight: `1px solid ${COLORS.border}`,
                borderLeft: active ? `2px solid ${chip.color}` : '2px solid transparent',
                background: active ? `${chip.color}14` : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                fontFamily: FONTS.sans,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = COLORS.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: RADIUS.full,
                    background: chip.color,
                    boxShadow: active ? `0 0 6px ${chip.color}` : undefined,
                  }}
                />
                <Mono tone={active ? 'primary' : 'muted'} size="xs">
                  {chip.label}
                </Mono>
              </div>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  lineHeight: 0.95,
                  color: chip.count === 0 ? COLORS.textMuted : chip.color,
                }}
              >
                {chip.count}
              </span>
              {active && <ScanningLine color={chip.color} duration={4} />}
            </button>
          );
        })}
      </div>
    </TacticalCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StaffGroup — collapsible status-grouped list
// ─────────────────────────────────────────────────────────────────────────
const StaffGroup: React.FC<{
  status: ShiftStatus;
  members: StaffMember[];
  collapsed: boolean;
  onToggle: () => void;
  expandedIds: Set<string>;
  onRowToggle: (id: string) => void;
  onChangeStatus: (m: StaffMember, next: ShiftStatus, opts?: { location?: string }) => void;
  onMessage: (m: StaffMember) => void;
  onPage: (m: StaffMember) => void;
  onCall: (m: StaffMember) => void;
}> = ({
  status,
  members,
  collapsed,
  onToggle,
  expandedIds,
  onRowToggle,
  onChangeStatus,
  onMessage,
  onPage,
  onCall,
}) => {
  const color = statusToColor[status];

  return (
    <div
      style={{
        position: 'relative',
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        overflow: 'hidden',
        background: COLORS.surface,
      }}
    >
      {/* Left accent bar by status */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: color,
          boxShadow: status === 'On Shift' ? `0 0 10px ${color}60` : undefined,
          pointerEvents: 'none',
        }}
      />

      {/* Group header — clickable */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.md,
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          paddingLeft: SPACE.lg + 2,
          background: COLORS.surfaceElev,
          border: 'none',
          borderBottom: collapsed ? 'none' : `1px solid ${COLORS.border}`,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {collapsed ? (
          <ChevronRight size={14} strokeWidth={2} color={COLORS.textSecondary} />
        ) : (
          <ChevronDown size={14} strokeWidth={2} color={COLORS.textSecondary} />
        )}
        <StatusPill label={status} tone={statusToTone[status]} />
        <Mono tone="primary" size="sm">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </Mono>
        <div style={{ flex: 1 }} />
        <Mono tone="dim" size="xs">
          {collapsed ? 'EXPAND' : 'COLLAPSE'}
        </Mono>
      </button>

      {/* Group body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{ overflow: 'hidden' }}
          >
            {members.map((m, i) => (
              <StaffRow
                key={m.id}
                staff={m}
                index={i}
                isLast={i === members.length - 1}
                expanded={expandedIds.has(m.id)}
                onToggle={() => onRowToggle(m.id)}
                onChangeStatus={onChangeStatus}
                onMessage={() => onMessage(m)}
                onPage={() => onPage(m)}
                onCall={() => onCall(m)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StaffRow — one member, expandable
// ─────────────────────────────────────────────────────────────────────────
const StaffRow: React.FC<{
  staff: StaffMember;
  index: number;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChangeStatus: (m: StaffMember, next: ShiftStatus, opts?: { location?: string }) => void;
  onMessage: () => void;
  onPage: () => void;
  onCall: () => void;
}> = ({
  staff,
  index,
  isLast,
  expanded,
  onToggle,
  onChangeStatus,
  onMessage,
  onPage,
  onCall,
}) => {
  const [hovered, setHovered] = useState(false);
  const tone = statusToTone[staff.status];

  const fatigueColor =
    staff.hoursWorked >= 10 ? COLORS.crit : staff.hoursWorked >= 8 ? COLORS.warn : COLORS.ok;
  const shiftPct = Math.min(100, Math.max(0, (staff.hoursWorked / staff.shiftLength) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015, duration: MOTION.base, ease: MOTION.ease }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderBottom: isLast && !expanded ? 'none' : `1px solid ${COLORS.border}`,
        background: expanded
          ? COLORS.surfaceElev
          : hovered
          ? COLORS.surfaceHover
          : 'transparent',
        transition: `background ${MOTION.fast}s ease`,
      }}
    >
      {/* Main row */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns:
            'auto minmax(0, 2.6fr) minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1.5fr) 110px 140px auto',
          gap: SPACE.md,
          padding: `${SPACE.base}px ${SPACE.lg}px`,
          paddingLeft: SPACE.lg + 2, // offset for the group left-accent
          background: 'transparent',
          border: 'none',
          alignItems: 'center',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.surfaceElev,
            border: `1px solid ${hovered ? COLORS.borderStrong : COLORS.border}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            color: COLORS.textPrimary,
            flexShrink: 0,
          }}
        >
          {staff.name
            .split(' ')
            .map((n) => n[0])
            .filter((c) => /[A-Z]/.test(c))
            .slice(0, 2)
            .join('')}
          {expanded && (
            <>
              <CornerBracket position="tl" color={COLORS.accent} size={5} thickness={1} inset={-1} />
              <CornerBracket position="br" color={COLORS.accent} size={5} thickness={1} inset={-1} />
            </>
          )}
        </div>

        {/* Name + role + id */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '-0.005em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {staff.name}
          </div>
          <div
            style={{
              display: 'flex',
              gap: SPACE.sm,
              alignItems: 'center',
              marginTop: 3,
              flexWrap: 'wrap',
            }}
          >
            <Mono tone="muted" size="xs">
              {staff.id}
            </Mono>
            <span style={{ color: COLORS.textDim, fontSize: 10 }}>·</span>
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: COLORS.textSecondary,
                letterSpacing: '-0.003em',
              }}
            >
              {staff.role}
            </span>
          </div>
        </div>

        {/* Department */}
        <div style={{ minWidth: 0 }}>
          <BracketLabel tone="muted" size="xs">{staff.department}</BracketLabel>
        </div>

        {/* Current task / location */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.textSecondary,
            minWidth: 0,
          }}
        >
          <MapPin size={12} strokeWidth={2} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {staff.currentTask && staff.status === 'On Shift' ? staff.currentTask : staff.location}
          </span>
        </div>

        {/* Status pill */}
        <div>
          <StatusPill label={staff.status} tone={tone} />
        </div>

        {/* Shift clock (hours worked + fatigue bar) */}
        {staff.shiftLength < 24 && staff.hoursWorked > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
                fontFamily: FONTS.mono,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ fontSize: 13, color: fatigueColor, fontWeight: 600 }}>
                {staff.hoursWorked.toFixed(1)}
              </span>
              <span style={{ fontSize: 10, color: COLORS.textMuted }}>
                / {staff.shiftLength}H
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: COLORS.surfaceElev,
                borderRadius: RADIUS.full,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${shiftPct}%`,
                  height: '100%',
                  background: fatigueColor,
                  boxShadow: fatigueColor === COLORS.crit ? `0 0 4px ${COLORS.crit}` : undefined,
                  transition: `width ${MOTION.base}s ease`,
                }}
              />
            </div>
          </div>
        ) : (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.textDim,
              letterSpacing: '0.04em',
            }}
          >
            {staff.status === 'On Call' ? 'ON CALL' : '—'}
          </span>
        )}

        {/* Contact */}
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            color: COLORS.textSecondary,
            letterSpacing: '0.04em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {staff.contact}
        </div>

        {/* Expand chevron */}
        <div style={{ color: COLORS.textMuted, flexShrink: 0, display: 'flex' }}>
          {expanded ? (
            <ChevronDown size={14} strokeWidth={2} />
          ) : (
            <ChevronRight size={14} strokeWidth={2} />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{ overflow: 'hidden', borderTop: `1px solid ${COLORS.border}` }}
          >
            <StaffDetailPanel
              staff={staff}
              onChangeStatus={onChangeStatus}
              onMessage={onMessage}
              onPage={onPage}
              onCall={onCall}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StaffDetailPanel — expanded row contents
// ─────────────────────────────────────────────────────────────────────────
const StaffDetailPanel: React.FC<{
  staff: StaffMember;
  onChangeStatus: (m: StaffMember, next: ShiftStatus, opts?: { location?: string }) => void;
  onMessage: () => void;
  onPage: () => void;
  onCall: () => void;
}> = ({ staff, onChangeStatus, onMessage, onPage, onCall }) => {
  const shiftPct = Math.min(100, Math.max(0, (staff.hoursWorked / staff.shiftLength) * 100));
  const remaining = Math.max(0, staff.shiftLength - staff.hoursWorked);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: SPACE.xl,
        padding: `${SPACE.lg}px ${SPACE.xl}px ${SPACE.lg}px ${SPACE.xl + 2}px`,
        background: COLORS.surface,
      }}
    >
      {/* Left: shift clock + assignment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
        <div>
          <Mono tone="muted" size="xs">SHIFT WINDOW</Mono>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 14,
              color: COLORS.textPrimary,
              letterSpacing: '0.06em',
              marginTop: 4,
            }}
          >
            {staff.shiftStart} – {staff.shiftEnd}
            {staff.shiftLength < 24 && (
              <span style={{ color: COLORS.textMuted, marginLeft: 10, fontSize: 12 }}>
                ({staff.shiftLength}H)
              </span>
            )}
          </div>
        </div>

        {/* Shift progress */}
        {staff.shiftLength < 24 && staff.hoursWorked > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <Mono tone="muted" size="xs">PROGRESS</Mono>
              <Mono tone="secondary" size="xs">
                {remaining.toFixed(1)}H REMAINING
              </Mono>
            </div>
            <div
              style={{
                height: 6,
                background: COLORS.surfaceElev,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.full,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${shiftPct}%`,
                  height: '100%',
                  background:
                    staff.hoursWorked >= 10
                      ? COLORS.crit
                      : staff.hoursWorked >= 8
                      ? COLORS.warn
                      : COLORS.ok,
                }}
              />
            </div>
            {staff.hoursWorked >= 10 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 6,
                  color: COLORS.crit,
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                <AlertCircle size={12} strokeWidth={2} />
                Fatigue threshold — consider relief
              </div>
            )}
          </div>
        )}

        {/* Assignment / location */}
        <div>
          <Mono tone="muted" size="xs">
            {staff.status === 'On Shift' ? 'CURRENT ASSIGNMENT' : 'LOCATION'}
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 14,
              color: COLORS.textPrimary,
              marginTop: 4,
              letterSpacing: '-0.005em',
            }}
          >
            {staff.currentTask && staff.status === 'On Shift' ? staff.currentTask : staff.location}
          </div>
          {staff.patientsAssigned > 0 && staff.status === 'On Shift' && (
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: COLORS.textSecondary,
                letterSpacing: '0.12em',
                marginTop: 4,
                textTransform: 'uppercase',
              }}
            >
              // {staff.patientsAssigned} patient
              {staff.patientsAssigned === 1 ? '' : 's'} assigned
            </div>
          )}
        </div>

        {/* Certifications */}
        {staff.certifications.length > 0 && (
          <div>
            <Mono tone="muted" size="xs">CERTIFICATIONS</Mono>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: SPACE.xs,
                marginTop: 6,
              }}
            >
              {staff.certifications.map((c) => (
                <span
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 7px',
                    background: COLORS.surfaceElev,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    color: COLORS.textSecondary,
                    textTransform: 'uppercase',
                  }}
                >
                  <BadgeCheck size={10} strokeWidth={2} color={COLORS.ok} />
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: SPACE.base, marginTop: 'auto' }}>
          <div>
            <Mono tone="muted" size="xs">EXPERIENCE</Mono>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 13,
                color: COLORS.textPrimary,
                letterSpacing: '0.04em',
                marginTop: 4,
              }}
            >
              {staff.yearsExperience}Y
            </div>
          </div>
        </div>
      </div>

      {/* Right: quick actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <Mono tone="muted" size="xs">QUICK ACTIONS</Mono>

        {/* Status transitions — contextual */}
        {staff.status === 'On Shift' && (
          <>
            <TacticalButton
              size="sm"
              variant="secondary"
              icon={<Coffee size={13} strokeWidth={2} />}
              onClick={() =>
                onChangeStatus(staff, 'On Break', { location: 'Break Room' })
              }
            >
              Start Break
            </TacticalButton>
            <TacticalButton
              size="sm"
              variant="secondary"
              icon={<Shuffle size={13} strokeWidth={2} />}
              onClick={() => onMessage()}
            >
              Reassign
            </TacticalButton>
            <TacticalButton
              size="sm"
              variant="ghost"
              icon={<UserMinus size={13} strokeWidth={2} />}
              onClick={() => onChangeStatus(staff, 'Off Duty', { location: 'Off-site' })}
            >
              Mark Off Duty
            </TacticalButton>
          </>
        )}
        {staff.status === 'On Break' && (
          <>
            <TacticalButton
              size="sm"
              variant="primary"
              icon={<Activity size={13} strokeWidth={2} />}
              onClick={() =>
                onChangeStatus(staff, 'On Shift', { location: staff.currentTask ?? 'Floor' })
              }
            >
              Return to Shift
            </TacticalButton>
            <TacticalButton
              size="sm"
              variant="ghost"
              icon={<Clock size={13} strokeWidth={2} />}
              onClick={() => onMessage()}
            >
              Extend Break
            </TacticalButton>
          </>
        )}
        {staff.status === 'On Call' && (
          <>
            <TacticalButton
              size="sm"
              variant="primary"
              icon={<Activity size={13} strokeWidth={2} />}
              onClick={() => onChangeStatus(staff, 'On Shift', { location: 'ED · inbound' })}
            >
              Activate
            </TacticalButton>
            <TacticalButton
              size="sm"
              variant="ghost"
              icon={<Radio size={13} strokeWidth={2} />}
              onClick={onPage}
            >
              Standby Ping
            </TacticalButton>
          </>
        )}
        {staff.status === 'Off Duty' && (
          <TacticalButton
            size="sm"
            variant="secondary"
            icon={<Activity size={13} strokeWidth={2} />}
            onClick={() => onChangeStatus(staff, 'On Call', { location: 'Standby' })}
          >
            Place On Call
          </TacticalButton>
        )}

        <Divider variant="dashed" style={{ marginTop: SPACE.xs, marginBottom: SPACE.xs }} />

        {/* Contact actions — always available */}
        <TacticalButton
          size="sm"
          variant="secondary"
          icon={<MessageSquare size={13} strokeWidth={2} />}
          onClick={onMessage}
        >
          Message
        </TacticalButton>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
          <TacticalButton
            size="sm"
            variant="ghost"
            icon={<PhoneCall size={13} strokeWidth={2} />}
            onClick={onCall}
          >
            Call
          </TacticalButton>
          <TacticalButton
            size="sm"
            variant="ghost"
            icon={<Radio size={13} strokeWidth={2} />}
            onClick={onPage}
          >
            Page
          </TacticalButton>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// CoverageSidebar — right column: shift clock, coverage bars, open shifts
// ─────────────────────────────────────────────────────────────────────────
const CoverageSidebar: React.FC<{
  coverage: DeptCoverage[];
  openShifts: OpenShift[];
  onDepartmentClick: (d: string) => void;
  activeDept: string;
  onOpenShiftClick: (os: OpenShift) => void;
}> = ({ coverage, openShifts, onDepartmentClick, activeDept, onOpenShiftClick }) => {
  // Current shift meta
  const shiftLabel = 'DAY SHIFT';
  const shiftWindow = '07:00 – 19:00';
  const shiftProgress = (6.5 / 12) * 100; // 13:30 = 6.5h in
  const shortages = coverage.filter((c) => c.actual < c.target);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
        overflowY: 'auto',
        paddingRight: SPACE.xs,
      }}
    >
      {/* Shift clock */}
      <TacticalCard padding="md" style={{ position: 'relative', overflow: 'hidden' }}>
        <ScanningLine color={COLORS.ok} duration={8} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: SPACE.sm,
          }}
        >
          <div>
            <Mono tone="muted" size="xs">ACTIVE SHIFT</Mono>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 18,
                fontWeight: 600,
                color: COLORS.textPrimary,
                letterSpacing: '-0.01em',
                marginTop: 4,
              }}
            >
              {shiftLabel}
            </div>
            <Mono tone="secondary" size="xs" style={{ marginTop: 4 }}>
              {shiftWindow}
            </Mono>
          </div>
          <StatusPill label="LIVE" tone="ok" pulse />
        </div>
        <div
          style={{
            height: 4,
            background: COLORS.surfaceElev,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.full,
            overflow: 'hidden',
            marginTop: SPACE.sm,
          }}
        >
          <div
            style={{
              width: `${shiftProgress}%`,
              height: '100%',
              background: COLORS.ok,
              boxShadow: `0 0 6px ${COLORS.ok}`,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontFamily: FONTS.mono,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
          }}
        >
          <span>6.5H IN</span>
          <span>5.5H LEFT</span>
        </div>
      </TacticalCard>

      {/* Coverage */}
      <TacticalCard padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: SPACE.md,
          }}
        >
          <BracketLabel tone="accent" size="xs">DEPT COVERAGE</BracketLabel>
          {shortages.length > 0 && (
            <StatusPill label={`${shortages.length} SHORT`} tone="crit" pulse />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {coverage.map((c) => (
            <CoverageBar
              key={c.department}
              coverage={c}
              active={activeDept === c.department}
              onClick={() => onDepartmentClick(activeDept === c.department ? 'All' : c.department)}
            />
          ))}
        </div>
      </TacticalCard>

      {/* Open shifts */}
      <TacticalCard padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: SPACE.md,
          }}
        >
          <BracketLabel tone="accent" size="xs">OPEN SHIFTS</BracketLabel>
          <Mono tone="muted" size="xs">{openShifts.length}</Mono>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {openShifts.length === 0 ? (
            <Mono tone="muted" size="xs">// ALL SHIFTS COVERED</Mono>
          ) : (
            openShifts.map((os) => <OpenShiftRow key={os.id} shift={os} onClick={() => onOpenShiftClick(os)} />)
          )}
        </div>
      </TacticalCard>

      {/* Critical alerts summary */}
      {shortages.length > 0 && (
        <TacticalCard padding="md" accentBar highlight>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
              marginBottom: SPACE.sm,
            }}
          >
            <ShieldAlert size={14} strokeWidth={2} color={COLORS.accent} />
            <BracketLabel tone="accent" size="xs">STAFFING ALERT</BracketLabel>
          </div>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 13,
              color: COLORS.textPrimary,
              lineHeight: 1.4,
            }}
          >
            {shortages.map((s) => `${s.department} ${s.actual - s.target >= 0 ? '+' : ''}${s.actual - s.target}`).join(' · ')}
          </div>
          <Mono tone="muted" size="xs" style={{ marginTop: SPACE.xs }}>
            // Recommend float pool activation
          </Mono>
        </TacticalCard>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Coverage bar — single dept row with actual/target and click-to-filter
// ─────────────────────────────────────────────────────────────────────────
const CoverageBar: React.FC<{
  coverage: DeptCoverage;
  active: boolean;
  onClick: () => void;
}> = ({ coverage, active, onClick }) => {
  const { department, target, actual } = coverage;
  const diff = actual - target;
  const tone: 'ok' | 'warn' | 'crit' =
    diff < 0 ? (Math.abs(diff) >= 2 ? 'crit' : 'warn') : 'ok';
  const color = tone === 'ok' ? COLORS.ok : tone === 'warn' ? COLORS.warn : COLORS.crit;
  const pct = Math.min(100, (actual / target) * 100);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: active ? `${COLORS.accent}14` : hovered ? COLORS.surfaceHover : 'transparent',
        border: `1px solid ${active ? COLORS.accent : hovered ? COLORS.borderStrong : 'transparent'}`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        textAlign: 'left',
        transition: cssTransition(),
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.textPrimary,
            letterSpacing: '-0.005em',
          }}
        >
          {department}
        </span>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            letterSpacing: '0.06em',
            color,
            fontWeight: 600,
          }}
        >
          {actual}
          <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>/{target}</span>
          {diff !== 0 && (
            <span style={{ marginLeft: 6 }}>
              {diff > 0 ? '+' : ''}
              {diff}
            </span>
          )}
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: COLORS.surfaceElev,
          borderRadius: RADIUS.full,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            boxShadow: tone === 'crit' ? `0 0 4px ${color}` : undefined,
            transition: `width ${MOTION.base}s ease`,
          }}
        />
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// OpenShiftRow — single gap in the schedule
// ─────────────────────────────────────────────────────────────────────────
const OpenShiftRow: React.FC<{ shift: OpenShift; onClick: () => void }> = ({ shift, onClick }) => {
  const urgencyColor =
    shift.urgency === 'crit' ? COLORS.crit : shift.urgency === 'warn' ? COLORS.warn : COLORS.info;
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: hovered ? COLORS.surfaceHover : COLORS.surfaceElev,
        border: `1px solid ${hovered ? urgencyColor : COLORS.border}`,
        borderLeft: `2px solid ${urgencyColor}`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        textAlign: 'left',
        transition: cssTransition(),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: '-0.005em',
          }}
        >
          {shift.role}
        </span>
        <Mono tone={shift.urgency === 'crit' ? 'crit' : shift.urgency === 'warn' ? 'warn' : 'info'} size="xs">
          {shift.urgency.toUpperCase()}
        </Mono>
      </div>
      <Mono tone="secondary" size="xs">
        {shift.window}
      </Mono>
      <Mono tone="dim" size="xs">
        // {shift.reason}
      </Mono>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Tactical input + select (shared from previous version)
// ─────────────────────────────────────────────────────────────────────────
const TacticalInput: React.FC<{
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}> = ({ icon, value, onChange, placeholder, width = 220 }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width,
        height: 32,
        padding: '0 10px',
        background: COLORS.surface,
        border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
        borderRadius: RADIUS.sm,
        transition: `border-color ${MOTION.fast}s ease`,
      }}
    >
      {icon && (
        <span
          style={{
            color: focused ? COLORS.accent : COLORS.textMuted,
            display: 'flex',
          }}
        >
          {icon}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: COLORS.textPrimary,
          fontFamily: FONTS.sans,
          fontSize: 13,
          letterSpacing: '-0.005em',
          minWidth: 0,
        }}
      />
    </div>
  );
};

const TacticalSelect: React.FC<{
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ icon, value, onChange, options }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 32,
        padding: '0 10px',
        background: COLORS.surface,
        border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
        borderRadius: RADIUS.sm,
        transition: `border-color ${MOTION.fast}s ease`,
      }}
    >
      {icon && (
        <span
          style={{
            color: focused ? COLORS.accent : COLORS.textMuted,
            display: 'flex',
          }}
        >
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: COLORS.textPrimary,
          fontFamily: FONTS.sans,
          fontSize: 13,
          letterSpacing: '-0.005em',
          cursor: 'pointer',
          appearance: 'none',
          paddingRight: 4,
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: COLORS.surface }}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
};
