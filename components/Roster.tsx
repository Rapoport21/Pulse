import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  PhoneCall,
  ShieldAlert,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Filter,
  MessageSquare,
} from 'lucide-react';
import { UserProfile } from '../types';
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
  CornerBracket,
} from './design';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'On Shift' | 'On Break' | 'Off Duty' | 'On Call';
  hoursWorked: number;
  contact: string;
  location: string;
}

const mockStaff: StaffMember[] = [
  { id: 'RN-101', name: 'Sarah Jenkins', role: 'Charge Nurse', department: 'Emergency', status: 'On Shift', hoursWorked: 8.5, contact: 'Ext 4421', location: 'Triage' },
  { id: 'RN-102', name: 'Michael Chang', role: 'Staff Nurse', department: 'Emergency', status: 'On Shift', hoursWorked: 4.0, contact: 'Ext 4422', location: 'Acute Care Pods' },
  { id: 'MD-201', name: 'Dr. Emily Chen', role: 'Attending', department: 'Emergency', status: 'On Shift', hoursWorked: 10.2, contact: 'Pager 881', location: 'Trauma Bay' },
  { id: 'RN-103', name: 'Jessica Alba', role: 'Staff Nurse', department: 'ICU', status: 'On Break', hoursWorked: 6.5, contact: 'Ext 5510', location: 'Break Room B' },
  { id: 'MD-202', name: 'Dr. Robert Smith', role: 'Surgeon', department: 'Surgery', status: 'On Call', hoursWorked: 0, contact: '555-0192', location: 'Off-site' },
  { id: 'TECH-301', name: 'David Miller', role: 'Rad Tech', department: 'Imaging', status: 'On Shift', hoursWorked: 2.5, contact: 'Ext 3311', location: 'CT Room 1' },
  { id: 'RN-104', name: 'Amanda Lewis', role: 'Staff Nurse', department: 'Med/Surg', status: 'Off Duty', hoursWorked: 0, contact: '555-0188', location: 'Off-site' },
  { id: 'SEC-401', name: 'James Wilson', role: 'Security', department: 'Operations', status: 'On Shift', hoursWorked: 7.0, contact: 'Radio Ch 2', location: 'ED Entrance' },
];

interface RosterProps {
  currentUser: UserProfile | null;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type StatusTone = 'ok' | 'warn' | 'info' | 'neutral';
const statusToTone: Record<StaffMember['status'], StatusTone> = {
  'On Shift': 'ok',
  'On Break': 'warn',
  'On Call': 'info',
  'Off Duty': 'neutral',
};

/**
 * Roster — real-time personnel tracking.
 * Four KPI cards + tactical table with inline search / department filter.
 */
export const Roster: React.FC<RosterProps> = ({ showToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');

  const departments = ['All', ...Array.from(new Set(mockStaff.map((s) => s.department)))];

  const filteredStaff = mockStaff.filter((staff) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      staff.name.toLowerCase().includes(q) ||
      staff.role.toLowerCase().includes(q) ||
      staff.id.toLowerCase().includes(q);
    const matchesDept =
      departmentFilter === 'All' || staff.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const onShiftCount = mockStaff.filter((s) => s.status === 'On Shift').length;
  const onBreakCount = mockStaff.filter((s) => s.status === 'On Break').length;
  const onCallCount = mockStaff.filter((s) => s.status === 'On Call').length;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE['2xl'],
        background: COLORS.bg,
        gap: SPACE.lg,
        overflowY: 'auto',
      }}
    >
      {/* Header with inline search + filter */}
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
            // Real-time personnel tracking and deployment
          </Mono>
        </div>
        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center' }}>
          <TacticalInput
            icon={<Search size={14} strokeWidth={2} />}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search personnel…"
            width={240}
          />
          <TacticalSelect
            icon={<Filter size={14} strokeWidth={2} />}
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departments}
          />
        </div>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: SPACE.md,
        }}
      >
        <KpiCard
          label="Total On Shift"
          value={onShiftCount}
          tone="ok"
          Icon={CheckCircle2}
        />
        <KpiCard
          label="On Break"
          value={onBreakCount}
          tone="warn"
          Icon={Clock}
        />
        <KpiCard
          label="On Call (Available)"
          value={onCallCount}
          tone="info"
          Icon={PhoneCall}
        />
        <KpiCard
          label="Critical Shortage"
          value="ICU RN -1"
          tone="crit"
          Icon={ShieldAlert}
          highlight
        />
      </div>

      {/* Personnel table */}
      <TacticalCard
        padding="none"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flex: 1,
          minHeight: 260,
        }}
      >
        {/* Table header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1.6fr 1.4fr 1.8fr 0.8fr 1.6fr',
            gap: SPACE.md,
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceElev,
          }}
        >
          <Mono tone="muted" size="xs">
            Personnel
          </Mono>
          <Mono tone="muted" size="xs">
            Department
          </Mono>
          <Mono tone="muted" size="xs">
            Status
          </Mono>
          <Mono tone="muted" size="xs">
            Location
          </Mono>
          <Mono tone="muted" size="xs" style={{ textAlign: 'center' }}>
            Hours
          </Mono>
          <Mono tone="muted" size="xs" style={{ textAlign: 'right' }}>
            Contact
          </Mono>
        </div>

        {/* Table body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredStaff.length === 0 ? (
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
              // No personnel found
            </div>
          ) : (
            filteredStaff.map((staff, i) => (
              <StaffRow
                key={staff.id}
                staff={staff}
                index={i}
                onMessage={() => {
                  if (showToast) showToast(`Message sent to ${staff.name}`, 'success');
                }}
              />
            ))
          )}
        </div>
      </TacticalCard>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string;
  value: string | number;
  tone: 'ok' | 'warn' | 'info' | 'crit';
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  highlight?: boolean;
}> = ({ label, value, tone, Icon, highlight }) => {
  const toneColor =
    tone === 'ok'
      ? COLORS.ok
      : tone === 'warn'
      ? COLORS.warn
      : tone === 'info'
      ? COLORS.info
      : COLORS.crit;

  return (
    <TacticalCard
      padding="md"
      accentBar={highlight}
      highlight={highlight}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACE.lg,
        gap: SPACE.md,
        minHeight: 88,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Mono tone={highlight ? 'accent' : 'muted'} size="xs">
          {label}
        </Mono>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: highlight ? 18 : 28,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            color: highlight ? COLORS.textPrimary : toneColor,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${toneColor}1a`,
          border: `1px solid ${toneColor}`,
          borderRadius: RADIUS.sm,
          flexShrink: 0,
        }}
      >
        <Icon size={20} strokeWidth={2} color={toneColor} />
        <CornerBracket position="tl" color={toneColor} size={4} thickness={1} inset={-1} />
        <CornerBracket position="br" color={toneColor} size={4} thickness={1} inset={-1} />
      </div>
    </TacticalCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Staff row — the main table element
// ─────────────────────────────────────────────────────────────────────────
const StaffRow: React.FC<{
  staff: StaffMember;
  index: number;
  onMessage: () => void;
}> = ({ staff, index, onMessage }) => {
  const [hovered, setHovered] = useState(false);
  const tone = statusToTone[staff.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: MOTION.base, ease: MOTION.ease }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '3fr 1.6fr 1.4fr 1.8fr 0.8fr 1.6fr',
        gap: SPACE.md,
        padding: `${SPACE.md}px ${SPACE.lg}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        alignItems: 'center',
        background: hovered ? COLORS.surfaceHover : 'transparent',
        transition: `background ${MOTION.fast}s ease`,
      }}
    >
      {/* Personnel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, minWidth: 0 }}>
        <div
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.surfaceElev,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: COLORS.textPrimary,
            flexShrink: 0,
          }}
        >
          {staff.name.split(' ').map((n) => n[0]).join('')}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 14,
              fontWeight: 500,
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
              marginTop: 2,
            }}
          >
            <Mono tone="muted" size="xs">
              {staff.id}
            </Mono>
            <span style={{ color: COLORS.textDim }}>·</span>
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: COLORS.textSecondary,
              }}
            >
              {staff.role}
            </span>
          </div>
        </div>
      </div>

      {/* Department */}
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: COLORS.textSecondary,
        }}
      >
        {staff.department}
      </span>

      {/* Status */}
      <div>
        <StatusPill label={staff.status} tone={tone} />
      </div>

      {/* Location */}
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
        <MapPin size={12} strokeWidth={2} color={COLORS.textMuted} />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {staff.location}
        </span>
      </div>

      {/* Hours */}
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 13,
          color: COLORS.textPrimary,
          textAlign: 'center',
          letterSpacing: '0.04em',
        }}
      >
        {staff.hoursWorked > 0 ? `${staff.hoursWorked}h` : '—'}
      </span>

      {/* Contact + message button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: SPACE.md,
          minWidth: 0,
        }}
      >
        <span
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
        </span>
        <button
          type="button"
          onClick={onMessage}
          title="Send Message"
          style={{
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hovered ? COLORS.surface : 'transparent',
            border: `1px solid ${hovered ? COLORS.border : 'transparent'}`,
            borderRadius: RADIUS.sm,
            color: hovered ? COLORS.textPrimary : COLORS.textMuted,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0.4,
            transition: `all ${MOTION.fast}s ease`,
            flexShrink: 0,
          }}
        >
          <MessageSquare size={14} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Tactical input + select — tactical chrome for the header filters
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
