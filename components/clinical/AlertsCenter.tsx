/**
 * AlertsCenter — fullscreen overlay showing the hospital-wide alert
 * feed. Clinical alerts, system alerts, critical lab values, code
 * activations, staffing gaps, and patient deterioration warnings all
 * flow through here.
 *
 * Props:
 *   open       — controls overlay visibility
 *   onClose    — dismiss the overlay
 *   showToast  — fire a toast notification to the parent shell
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  HeartPulse,
  AlertTriangle,
  Users,
  Bell,
  Server,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Shield,
  FlaskConical,
  Bed,
  Ambulance,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  TacticalButton,
  HudStrip,
  ScanningLine,
  Divider,
} from '../design';
import { UserRole } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface AlertsCenterProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** Current user role — drives default filter tab and sort priority. */
  role?: UserRole;
  /** When true, renders as inline desktop layout instead of mobile overlay. */
  embedded?: boolean;
}

type Severity = 'critical' | 'warning' | 'info' | 'success';
type Category = 'clinical' | 'system' | 'staffing' | 'safety' | 'general';
type FilterTab = 'all' | 'critical' | 'clinical' | 'system' | 'staffing';

interface Alert {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  source: string;
  minutesAgo: number;
  patientRef?: string;
  actions: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Mock alerts
// ─────────────────────────────────────────────────────────────────────────

const MOCK_ALERTS: Alert[] = [
  {
    id: 'A01',
    severity: 'critical',
    category: 'clinical',
    title: 'Critical Lab — Troponin 3.1 ng/mL',
    description: 'Serial troponin rising (2.4 → 3.1). NSTEMI confirmed. Cardiology consult recommended. Consider heparin drip and cath lab activation within 24h.',
    source: 'Lab System',
    minutesAgo: 2,
    patientRef: 'Smith, J — P002',
    actions: ['View Labs', 'Page Cardiology', 'Acknowledge'],
  },
  {
    id: 'A02',
    severity: 'critical',
    category: 'clinical',
    title: 'MEWS ≥ 5 — Patient Deterioration',
    description: 'MEWS score escalated to 7. HR 136, BP 84/52, SpO2 92%, GCS 13. Hemorrhagic shock trajectory. Consider rapid response activation.',
    source: 'PULSE Forecast',
    minutesAgo: 5,
    patientRef: 'Doe, J — P001',
    actions: ['View Patient', 'Call Rapid Response', 'Acknowledge'],
  },
  {
    id: 'A03',
    severity: 'critical',
    category: 'safety',
    title: 'Fall Risk — Patient Ambulating Without Assist',
    description: 'Bed alarm triggered. Post-op patient attempting to ambulate without call for assistance. Fall risk assessment: HIGH.',
    source: 'Nurse Call',
    minutesAgo: 3,
    patientRef: 'Wong, A — P004',
    actions: ['View Patient', 'Acknowledge'],
  },
  {
    id: 'A04',
    severity: 'critical',
    category: 'clinical',
    title: 'Lactate > 4.0 — Sepsis Alert',
    description: 'Lactate 4.8 mmol/L (critical high). qSOFA ≥ 2. SEP-1 bundle clock started. Broad-spectrum antibiotics due within 60 minutes of recognition.',
    source: 'PULSE Forecast',
    minutesAgo: 8,
    patientRef: 'Ruiz, C — P005',
    actions: ['View Patient', 'View SEP-1 Bundle', 'Acknowledge'],
  },
  {
    id: 'A05',
    severity: 'warning',
    category: 'system',
    title: 'Bed Capacity 88% — Approaching Surge',
    description: 'Current occupancy at 88%. PULSE 90-min forecast projects 94% if current intake rate continues. Consider activating surge protocol.',
    source: 'PULSE Forecast',
    minutesAgo: 12,
    actions: ['View Forecast', 'Open Bed Board', 'Acknowledge'],
  },
  {
    id: 'A06',
    severity: 'warning',
    category: 'staffing',
    title: 'Staffing Gap — ICU Night Shift -2 RN',
    description: 'ICU night shift (19:00–07:00) is 2 RNs short of required coverage. Current nurse:patient ratio will be 1:3 (target 1:2). Float pool has 1 ICU-qualified nurse available.',
    source: 'PULSE Workforce',
    minutesAgo: 20,
    actions: ['View Coverage', 'Call Float', 'Acknowledge'],
  },
  {
    id: 'A07',
    severity: 'warning',
    category: 'clinical',
    title: 'Blood Product Expiring — 2 Units PRBC',
    description: 'Two units of packed red blood cells (Type A+) expiring in 4 hours. Currently crossmatched for P001. Transfuse or return to blood bank.',
    source: 'Blood Bank',
    minutesAgo: 25,
    actions: ['View Orders', 'Acknowledge'],
  },
  {
    id: 'A08',
    severity: 'warning',
    category: 'system',
    title: 'Ventilator Alarm — ICU Bed 4',
    description: 'High-pressure alarm on ventilator. Patient may be biting ETT or secretions obstructing airway. RT notified.',
    source: 'BioMed',
    minutesAgo: 75,
    actions: ['Acknowledge'],
  },
  {
    id: 'A09',
    severity: 'info',
    category: 'clinical',
    title: 'EMS Inbound — MVC, ETA 8 min',
    description: 'Unrestrained passenger, GCS 12, suspected pelvic fracture. Trauma team activation recommended. Blood bank notified for potential MTP.',
    source: 'EMS Radio',
    minutesAgo: 30,
    actions: ['View EMS Board', 'Acknowledge'],
  },
  {
    id: 'A10',
    severity: 'info',
    category: 'staffing',
    title: 'Shift Change in 3h — 14 Incoming, 12 Outgoing',
    description: 'Evening shift change at 19:00. Net +2 staff. Handoff notes should be completed by 18:30.',
    source: 'PULSE Workforce',
    minutesAgo: 35,
    actions: ['View Coverage', 'Acknowledge'],
  },
  {
    id: 'A11',
    severity: 'info',
    category: 'clinical',
    title: 'Cardiology Consult Accepted — Dr. Martinez',
    description: 'Dr. Martinez will see patient within 2 hours. Preliminary read of ECG suggests NSTEMI with ST depression V3-V5.',
    source: 'Consult System',
    minutesAgo: 42,
    patientRef: 'Smith, J — P002',
    actions: ['Acknowledge'],
  },
  {
    id: 'A12',
    severity: 'info',
    category: 'clinical',
    title: 'Pharmacy — Vancomycin Trough Due',
    description: 'Vancomycin trough level due before next dose. Draw at 17:30 for 18:00 dose. Target trough 15-20 mcg/mL.',
    source: 'Pharmacy',
    minutesAgo: 50,
    patientRef: 'Ruiz, C — P005',
    actions: ['View Meds', 'Acknowledge'],
  },
  {
    id: 'A13',
    severity: 'success',
    category: 'general',
    title: 'Bed FT-1 Turned Over — Ready',
    description: 'EVS completed cleaning. Bed FT-1 is now available for new admission. Fast Track capacity restored.',
    source: 'ADT',
    minutesAgo: 45,
    actions: ['Acknowledge'],
  },
  {
    id: 'A14',
    severity: 'success',
    category: 'general',
    title: 'Discharge Completed — Fox, R (P003)',
    description: 'Patient Robert Fox discharged to home. Follow-up scheduled in 7-10 days. Prescriptions transmitted to pharmacy.',
    source: 'ADT',
    minutesAgo: 60,
    patientRef: 'Fox, R — P003',
    actions: ['Acknowledge'],
  },
  {
    id: 'A15',
    severity: 'info',
    category: 'system',
    title: 'System Update — PULSE v2.4.1 Deployed',
    description: 'Forecast model updated with revised surge thresholds. No downtime. Change log available in Settings.',
    source: 'PULSE System',
    minutesAgo: 120,
    actions: ['Acknowledge'],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<Severity, string> = {
  critical: COLORS.crit,
  warning: COLORS.warn,
  info: COLORS.info,
  success: COLORS.ok,
};

const SEV_BG: Record<Severity, string> = {
  critical: `${COLORS.crit}0A`,
  warning: `${COLORS.warn}08`,
  info: `${COLORS.info}06`,
  success: `${COLORS.ok}06`,
};

const CAT_ICON: Record<Category, React.ReactNode> = {
  clinical: <HeartPulse size={13} />,
  system: <Server size={13} />,
  staffing: <Users size={13} />,
  safety: <AlertTriangle size={13} />,
  general: <Bell size={13} />,
};

const timeLabel = (mins: number): string => {
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const AlertsCenter: React.FC<AlertsCenterProps> = ({ open, onClose, showToast, role, embedded }) => {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  // Role-aware default filter:
  //  - Nurse: clinical alerts first (patient deterioration, labs, meds)
  //  - Manager: staffing alerts first (coverage gaps, capacity)
  //  - ER: critical alerts first (trauma, triage, code activations)
  const defaultFilter: FilterTab =
    role === UserRole.NURSE ? 'clinical'
    : role === UserRole.MANAGER ? 'staffing'
    : role === UserRole.ER_PERSONNEL ? 'critical'
    : 'all';
  const [filter, setFilter] = useState<FilterTab>(defaultFilter);

  // Role-aware category weight for secondary sort within same ack+time.
  // Surfaces the most relevant alerts toward the top for each role.
  const categoryWeight = (cat: Category): number => {
    if (role === UserRole.NURSE) {
      if (cat === 'clinical') return 0;
      if (cat === 'safety') return 1;
      return 2;
    }
    if (role === UserRole.MANAGER) {
      if (cat === 'staffing') return 0;
      if (cat === 'system') return 1;
      return 2;
    }
    if (role === UserRole.ER_PERSONNEL) {
      if (cat === 'clinical') return 0;
      if (cat === 'safety') return 0;
      return 2;
    }
    return 1;
  };

  const alerts = useMemo(() => {
    let list = [...MOCK_ALERTS];

    if (filter === 'critical') list = list.filter((a) => a.severity === 'critical');
    else if (filter === 'clinical') list = list.filter((a) => a.category === 'clinical');
    else if (filter === 'system') list = list.filter((a) => a.category === 'system');
    else if (filter === 'staffing') list = list.filter((a) => a.category === 'staffing');

    // Unacknowledged first, then role-weighted category, then by time
    list.sort((a, b) => {
      const ackA = acknowledged.has(a.id) ? 1 : 0;
      const ackB = acknowledged.has(b.id) ? 1 : 0;
      if (ackA !== ackB) return ackA - ackB;
      const catW = categoryWeight(a.category) - categoryWeight(b.category);
      if (catW !== 0) return catW;
      return a.minutesAgo - b.minutesAgo;
    });

    return list;
  }, [filter, acknowledged, role]);

  const unreadCount = MOCK_ALERTS.filter((a) => !acknowledged.has(a.id)).length;
  const critCount = MOCK_ALERTS.filter((a) => a.severity === 'critical' && !acknowledged.has(a.id)).length;
  const warnCount = MOCK_ALERTS.filter((a) => a.severity === 'warning' && !acknowledged.has(a.id)).length;

  const handleAck = (id: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    showToast('Alert acknowledged');
  };

  const clearAllRead = () => {
    const allIds = new Set(MOCK_ALERTS.map((a) => a.id));
    setAcknowledged(allIds);
    showToast('All alerts acknowledged');
  };

  // Tab counts
  const tabCounts: Record<FilterTab, number> = {
    all: MOCK_ALERTS.filter((a) => !acknowledged.has(a.id)).length,
    critical: MOCK_ALERTS.filter((a) => a.severity === 'critical' && !acknowledged.has(a.id)).length,
    clinical: MOCK_ALERTS.filter((a) => a.category === 'clinical' && !acknowledged.has(a.id)).length,
    system: MOCK_ALERTS.filter((a) => a.category === 'system' && !acknowledged.has(a.id)).length,
    staffing: MOCK_ALERTS.filter((a) => a.category === 'staffing' && !acknowledged.has(a.id)).length,
  };

  // ── Desktop mock alerts for command view ──
  const MOCK_ALERTS_DESKTOP = useMemo(() => [
    { id: 'ALT-001', severity: 'critical' as const, category: 'clinical' as const, title: 'SpO2 Desaturation — ICU Bed 3', description: 'SpO2 dropped to 86%. Patient Alice Torres on 4L NC. Trend shows 15-min decline from 94%.', source: 'Vitals Monitor', patient: 'Alice Torres', mrn: 'MRN-6643', attending: 'Dr. Gomez', minutesAgo: 3, acknowledged: false, escalation: 'Auto-page to Rapid Response team' },
    { id: 'ALT-002', severity: 'critical' as const, category: 'operational' as const, title: 'ED Wait Time Exceeds Threshold', description: 'Average ED wait time is 125 minutes. 14 patients in lobby. NEDOCS score: 185 (Dangerous).', source: 'Capacity Engine', patient: null, mrn: null, attending: null, minutesAgo: 8, acknowledged: false, escalation: 'Notify Charge Nurse + House Supervisor' },
    { id: 'ALT-003', severity: 'critical' as const, category: 'clinical' as const, title: 'Critical Lab — Troponin Elevated', description: 'Troponin I: 2.4 ng/mL (ref <0.04). Patient Jason Sellers, ED Bed 4. Second draw pending.', source: 'Lab System', patient: 'Jason Sellers', mrn: 'MRN-2290', attending: 'Dr. Kim', minutesAgo: 12, acknowledged: false, escalation: 'Cardiology consult auto-requested' },
    { id: 'ALT-004', severity: 'critical' as const, category: 'clinical' as const, title: 'MEWS Score ≥5 — Sepsis Protocol', description: 'Patient Clara Rodriguez, Bed 202. MEWS 6. Lactate 4.2. qSOFA 2/3. Sepsis bundle initiated.', source: 'Early Warning System', patient: 'Clara Rodriguez', mrn: 'MRN-5501', attending: 'Dr. Foster', minutesAgo: 15, acknowledged: true, escalation: 'Sepsis bundle auto-ordered' },
    { id: 'ALT-005', severity: 'warning' as const, category: 'operational' as const, title: 'ICU Staffing Gap — Night Shift', description: 'ICU night shift (19:00-07:00) short 1 RN. Current coverage: 3 nurses for 5 patients. Ratio 1:1.7 vs target 1:1.', source: 'Workforce Engine', patient: null, mrn: null, attending: null, minutesAgo: 22, acknowledged: false, escalation: 'Float pool notified' },
    { id: 'ALT-006', severity: 'warning' as const, category: 'clinical' as const, title: 'Fall Risk — Bed 203', description: 'Patient Thomas Kim, 78yo, on opioids + anticoagulant. Morse score 65 (high). Bed alarm active.', source: 'Safety System', patient: 'Thomas Kim', mrn: 'MRN-7321', attending: 'Dr. Park', minutesAgo: 28, acknowledged: false, escalation: null },
    { id: 'ALT-007', severity: 'warning' as const, category: 'system' as const, title: 'EHR Sync Latency Detected', description: 'HL7 ADT feed from Epic delayed by 8 minutes. Lab results may be stale. Engineering notified.', source: 'Integration Monitor', patient: null, mrn: null, attending: null, minutesAgo: 35, acknowledged: true, escalation: 'IT ticket AUTO-2847 opened' },
    { id: 'ALT-008', severity: 'warning' as const, category: 'operational' as const, title: 'Dirty Beds Exceeding Turnaround', description: '3 beds dirty >20 minutes. EVS response time degraded. Beds: A5, 206, 309.', source: 'Bed Management', patient: null, mrn: null, attending: null, minutesAgo: 18, acknowledged: false, escalation: 'EVS supervisor paged' },
    { id: 'ALT-009', severity: 'info' as const, category: 'operational' as const, title: 'Shift Change in 90 Minutes', description: 'Day shift ends 19:00. 12 handoffs pending. 2 nurses have incomplete documentation.', source: 'Workforce Engine', patient: null, mrn: null, attending: null, minutesAgo: 45, acknowledged: true, escalation: null },
    { id: 'ALT-010', severity: 'info' as const, category: 'system' as const, title: 'Scheduled Downtime — Lab Interface', description: 'Lab interface maintenance window 02:00-03:00. Manual result entry may be required.', source: 'IT Operations', patient: null, mrn: null, attending: null, minutesAgo: 120, acknowledged: true, escalation: null },
    { id: 'ALT-011', severity: 'warning' as const, category: 'clinical' as const, title: 'Medication Override — Controlled Substance', description: 'Pyxis override for Dilaudid 2mg at Station 3-East. Nurse: V. Singh. No order on file. Pharmacy review pending.', source: 'Pharmacy System', patient: 'Jacob Reeves', mrn: 'MRN-4498', attending: 'Dr. Singh', minutesAgo: 40, acknowledged: false, escalation: 'Pharmacy auto-review triggered' },
    { id: 'ALT-012', severity: 'info' as const, category: 'clinical' as const, title: 'Discharge Ready — Bed 207', description: 'Patient Jacob Reeves. DC order signed. Meds dispensed. Ride confirmed for 12:30. Ready for final check.', source: 'Discharge Planner', patient: 'Jacob Reeves', mrn: 'MRN-4498', attending: 'Dr. Singh', minutesAgo: 5, acknowledged: false, escalation: null },
  ], []);

  const [deskFilter, setDeskFilter] = useState<'all' | 'clinical' | 'operational' | 'system'>('all');
  const [deskAcked, setDeskAcked] = useState<Set<string>>(
    () => new Set(['ALT-004', 'ALT-007', 'ALT-009', 'ALT-010']),
  );

  const deskHandleAck = (id: string) => {
    setDeskAcked(prev => { const n = new Set(prev); n.add(id); return n; });
    showToast('Alert acknowledged');
  };

  const deskHandleEscalate = (id: string) => {
    showToast(`Alert ${id} escalated to supervisor`);
  };

  const deskHandleSuppress = (id: string) => {
    showToast(`Alert ${id} suppressed for 30 minutes`);
  };

  // Filtered + sorted desktop alerts
  const deskAlerts = useMemo(() => {
    let list = MOCK_ALERTS_DESKTOP.map(a => ({ ...a, acknowledged: deskAcked.has(a.id) }));
    if (deskFilter !== 'all') list = list.filter(a => a.category === deskFilter);
    // Sort: newest first (ascending minutesAgo)
    list.sort((a, b) => a.minutesAgo - b.minutesAgo);
    return list;
  }, [deskFilter, deskAcked, MOCK_ALERTS_DESKTOP]);

  // Desktop stat counts
  const deskCritCount = MOCK_ALERTS_DESKTOP.filter(a => a.severity === 'critical').length;
  const deskWarnCount = MOCK_ALERTS_DESKTOP.filter(a => a.severity === 'warning').length;
  const deskInfoCount = MOCK_ALERTS_DESKTOP.filter(a => a.severity === 'info').length;
  const deskAckCount = deskAcked.size;
  const deskUnread = MOCK_ALERTS_DESKTOP.length - deskAckCount;

  const sevColor = (sev: 'critical' | 'warning' | 'info') =>
    sev === 'critical' ? COLORS.crit : sev === 'warning' ? COLORS.warn : COLORS.info;

  const sevTone = (sev: 'critical' | 'warning' | 'info') =>
    sev === 'critical' ? 'crit' as const : sev === 'warning' ? 'warn' as const : 'info' as const;

  // ── Embedded mode: full desktop alert command center ──
  if (embedded) {
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
        {/* Header */}
        <HudStrip side="top" fixed>
          <BracketLabel tone="accent" size="sm">ALERT CENTER — COMMAND VIEW</BracketLabel>
          <div style={{ flex: 1 }} />
          {deskUnread > 0 && (
            <div
              style={{
                padding: '2px 10px',
                background: COLORS.crit,
                borderRadius: RADIUS.full,
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.04em',
              }}
            >
              {deskUnread} UNREAD
            </div>
          )}
        </HudStrip>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            paddingTop: 56,
            paddingBottom: 20,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* ── Summary bar: 4 stat boxes ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: SPACE.md,
              padding: `${SPACE.lg}px ${SPACE.xl}px`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {/* Critical */}
            <div
              style={{
                background: `${COLORS.crit}08`,
                border: `1px solid ${COLORS.crit}30`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.crit, lineHeight: 1 }}>
                {deskCritCount}
              </div>
              <Mono tone="crit" size="xs">CRITICAL</Mono>
            </div>
            {/* Warning */}
            <div
              style={{
                background: `${COLORS.warn}08`,
                border: `1px solid ${COLORS.warn}30`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.warn, lineHeight: 1 }}>
                {deskWarnCount}
              </div>
              <Mono tone="warn" size="xs">WARNING</Mono>
            </div>
            {/* Info */}
            <div
              style={{
                background: `${COLORS.info}08`,
                border: `1px solid ${COLORS.info}30`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.info, lineHeight: 1 }}>
                {deskInfoCount}
              </div>
              <Mono tone="info" size="xs">INFO</Mono>
            </div>
            {/* Acknowledged */}
            <div
              style={{
                background: `${COLORS.ok}08`,
                border: `1px solid ${COLORS.ok}30`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.ok, lineHeight: 1 }}>
                {deskAckCount}
              </div>
              <Mono tone="ok" size="xs">ACKNOWLEDGED</Mono>
            </div>
          </div>

          {/* ── Category filter tabs ── */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              padding: `0 ${SPACE.xl}px`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {(['all', 'clinical', 'operational', 'system'] as const).map(tab => {
              const isActive = deskFilter === tab;
              const tabColor =
                tab === 'clinical' ? COLORS.info
                : tab === 'operational' ? COLORS.warn
                : tab === 'system' ? 'rgba(139,92,246,0.9)'
                : COLORS.textSecondary;
              return (
                <button
                  key={tab}
                  onClick={() => setDeskFilter(tab)}
                  style={{
                    padding: `${SPACE.md}px ${SPACE.lg}px`,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${isActive ? tabColor : 'transparent'}`,
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: isActive ? tabColor : COLORS.textMuted,
                    cursor: 'pointer',
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* ── Alert feed ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.md,
              padding: `${SPACE.lg}px ${SPACE.xl}px ${SPACE['2xl']}px`,
            }}
          >
            {deskAlerts.map((alert, idx) => {
              const isAck = alert.acknowledged;
              const color = sevColor(alert.severity);
              const tone = sevTone(alert.severity);
              const isFirstCrit = !isAck && alert.severity === 'critical' && idx === 0;

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: MOTION.fast }}
                  style={{
                    position: 'relative',
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderLeft: `4px solid ${isAck ? COLORS.border : color}`,
                    borderRadius: RADIUS.sm,
                    overflow: 'hidden',
                    opacity: isAck ? 0.5 : 1,
                    transition: `opacity ${MOTION.base}s ease`,
                    padding: `${SPACE.lg}px`,
                  }}
                >
                  {isFirstCrit && <ScanningLine duration={4} />}

                  {/* Row 1: Severity badge + title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                    {isAck ? (
                      <StatusPill label="ACKNOWLEDGED" tone="ok" />
                    ) : (
                      <StatusPill label={alert.severity.toUpperCase()} tone={tone} pulse={alert.severity === 'critical'} />
                    )}
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.body.size,
                        fontWeight: 700,
                        color: isAck ? COLORS.textMuted : COLORS.textPrimary,
                        flex: 1,
                      }}
                    >
                      {alert.title}
                    </div>
                  </div>

                  {/* Row 2: Description */}
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.bodySm.size,
                      color: COLORS.textSecondary,
                      lineHeight: 1.55,
                      marginBottom: SPACE.sm,
                    }}
                  >
                    {alert.description}
                  </div>

                  {/* Row 3: Source + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: alert.patient || alert.escalation ? SPACE.sm : 0 }}>
                    <Mono tone="muted" size="xs">Source: {alert.source}</Mono>
                    <Mono tone="muted" size="xs">
                      <Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                      {timeLabel(alert.minutesAgo)}
                    </Mono>
                  </div>

                  {/* Row 4: Patient info (if clinical) */}
                  {alert.patient && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: alert.escalation ? SPACE.sm : 0 }}>
                      <Mono tone="secondary" size="xs">
                        Patient: {alert.patient} ({alert.mrn})
                      </Mono>
                      {alert.attending && (
                        <Mono tone="secondary" size="xs">
                          Attending: {alert.attending}
                        </Mono>
                      )}
                    </div>
                  )}

                  {/* Row 5: Escalation (if exists) */}
                  {alert.escalation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: !isAck ? SPACE.md : 0 }}>
                      <ArrowUpRight size={11} color={COLORS.warn} style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          fontStyle: 'italic',
                          color: COLORS.warn,
                        }}
                      >
                        Escalation: {alert.escalation}
                      </span>
                    </div>
                  )}

                  {/* Action buttons (hidden when acknowledged) */}
                  {!isAck && (
                    <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTop: `1px solid ${COLORS.border}` }}>
                      <TacticalButton
                        variant="primary"
                        size="sm"
                        icon={<CheckCircle2 size={12} />}
                        onClick={() => deskHandleAck(alert.id)}
                      >
                        ACKNOWLEDGE
                      </TacticalButton>
                      <TacticalButton
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUpRight size={12} />}
                        onClick={() => deskHandleEscalate(alert.id)}
                      >
                        ESCALATE
                      </TacticalButton>
                      <TacticalButton
                        variant="ghost"
                        size="sm"
                        icon={<Clock size={12} />}
                        onClick={() => deskHandleSuppress(alert.id)}
                      >
                        SUPPRESS 30m
                      </TacticalButton>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {deskAlerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: `${SPACE['3xl']}px` }}>
                <Mono tone="muted" size="sm">No alerts match the current filter</Mono>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="alerts-center"
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
          {/* Header */}
          <HudStrip side="top" fixed>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
            <BracketLabel tone="accent" size="sm">Alerts</BracketLabel>
            <div style={{ flex: 1 }} />
            {unreadCount > 0 && (
              <div
                style={{
                  padding: '2px 8px',
                  background: COLORS.crit,
                  borderRadius: RADIUS.full,
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {unreadCount}
              </div>
            )}
          </HudStrip>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              paddingTop: 56,
              paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Summary strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: critCount > 0 ? COLORS.crit : COLORS.ok,
                    boxShadow: critCount > 0 ? `0 0 6px ${COLORS.crit}` : 'none',
                  }}
                />
                <Mono tone={critCount > 0 ? 'crit' : 'ok'} size="xs">
                  {critCount} CRIT
                </Mono>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: warnCount > 0 ? COLORS.warn : COLORS.ok,
                  }}
                />
                <Mono tone={warnCount > 0 ? 'warn' : 'ok'} size="xs">
                  {warnCount} WARN
                </Mono>
              </div>
              <div style={{ flex: 1 }} />
              <TacticalButton variant="ghost" size="sm" onClick={clearAllRead}>
                Clear All
              </TacticalButton>
            </div>

            {/* Filter tabs */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: `${SPACE.sm}px ${SPACE.base}px`,
                overflowX: 'auto',
              }}
            >
              {(['all', 'critical', 'clinical', 'system', 'staffing'] as FilterTab[]).map((tab) => {
                const isActive = filter === tab;
                const tColor =
                  tab === 'critical' ? COLORS.crit
                  : tab === 'clinical' ? COLORS.info
                  : tab === 'system' ? COLORS.warn
                  : tab === 'staffing' ? 'rgba(139,92,246,0.9)'
                  : COLORS.textSecondary;
                return (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      background: isActive ? `${tColor}15` : 'transparent',
                      border: `1px solid ${isActive ? tColor : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      fontFamily: FONTS.mono,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      color: isActive ? tColor : COLORS.textMuted,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {tab}
                    {tabCounts[tab] > 0 && (
                      <span
                        style={{
                          padding: '1px 5px',
                          background: isActive ? tColor : COLORS.border,
                          borderRadius: RADIUS.full,
                          fontSize: 9,
                          fontWeight: 700,
                          color: isActive ? '#fff' : COLORS.textMuted,
                        }}
                      >
                        {tabCounts[tab]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Alert feed */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.sm,
                padding: `${SPACE.sm}px ${SPACE.base}px ${SPACE.base}px`,
              }}
            >
              {alerts.map((alert, idx) => {
                const isAck = acknowledged.has(alert.id);
                const isExp = expanded === alert.id;
                const color = SEV_COLOR[alert.severity];
                const bg = isAck ? COLORS.surface : SEV_BG[alert.severity];
                const isFirstCrit = !isAck && alert.severity === 'critical' && idx === 0;

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02, duration: MOTION.fast }}
                    style={{
                      position: 'relative',
                      background: bg,
                      border: `1px solid ${isAck ? COLORS.border : `${color}30`}`,
                      borderLeft: `3px solid ${isAck ? COLORS.border : color}`,
                      borderRadius: RADIUS.sm,
                      overflow: 'hidden',
                      opacity: isAck ? 0.55 : 1,
                      transition: `opacity ${MOTION.base}s ease`,
                    }}
                  >
                    {isFirstCrit && <ScanningLine duration={4} />}

                    <button
                      onClick={() => setExpanded(isExp ? null : alert.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        width: '100%',
                        gap: SPACE.sm,
                        padding: `${SPACE.md}px`,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: COLORS.textPrimary,
                        outline: 'none',
                      }}
                    >
                      {/* Category icon */}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: RADIUS.sm,
                          background: `${color}15`,
                          border: `1px solid ${color}30`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color,
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {CAT_ICON[alert.category]}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: 2 }}>
                          <StatusPill
                            label={alert.severity.toUpperCase()}
                            tone={
                              alert.severity === 'critical' ? 'crit'
                              : alert.severity === 'warning' ? 'warn'
                              : alert.severity === 'success' ? 'ok'
                              : 'info'
                            }
                          />
                          <Mono tone="muted" size="xs">{alert.source}</Mono>
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: TYPE.body.size,
                            fontWeight: 600,
                            color: isAck ? COLORS.textMuted : COLORS.textPrimary,
                            marginBottom: 2,
                          }}
                        >
                          {isAck && <CheckCircle2 size={12} color={COLORS.ok} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                          {alert.title}
                        </div>
                        {alert.patientRef && (
                          <Mono tone="secondary" size="xs">{alert.patientRef}</Mono>
                        )}
                      </div>

                      {/* Time + chevron */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <Mono tone="muted" size="xs">{timeLabel(alert.minutesAgo)}</Mono>
                        {isExp ? <ChevronUp size={12} color={COLORS.textMuted} /> : <ChevronDown size={12} color={COLORS.textMuted} />}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExp && (
                        <motion.div
                          key={`exp-${alert.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: MOTION.fast }}
                          style={{ overflow: 'hidden' }}
                        >
                          <Divider />
                          <div style={{ padding: `${SPACE.md}px`, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                            <div
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: TYPE.bodySm.size,
                                color: COLORS.textSecondary,
                                lineHeight: 1.5,
                              }}
                            >
                              {alert.description}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                              {alert.actions.map((action) =>
                                action === 'Acknowledge' ? (
                                  <TacticalButton
                                    key={action}
                                    variant="primary"
                                    size="sm"
                                    disabled={isAck}
                                    icon={<CheckCircle2 size={12} />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAck(alert.id);
                                    }}
                                  >
                                    {isAck ? 'Acknowledged' : 'Acknowledge'}
                                  </TacticalButton>
                                ) : (
                                  <TacticalButton
                                    key={action}
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      showToast(action);
                                    }}
                                  >
                                    {action}
                                  </TacticalButton>
                                ),
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {alerts.length === 0 && (
                <div style={{ textAlign: 'center', padding: `${SPACE['2xl']}px` }}>
                  <Mono tone="muted" size="sm">No alerts match the current filter</Mono>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

AlertsCenter.displayName = 'AlertsCenter';
