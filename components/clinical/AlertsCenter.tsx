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
 *
 * Alert lifecycle:  active -> acknowledged -> resolved
 *                   active -> escalated (stays visible, stronger chrome)
 *                   escalated -> resolved
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  MOTION, cssTransition,
  Z,
  SHADOW,
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
  /** Cross-device synced alert acknowledgments */
  alertAcks?: Record<string, { status: string; actor: string; at: string }>;
  /** Callback to acknowledge alert across devices */
  onAcknowledgeAlert?: (alertId: string, actor: string) => void;
}

type Severity = 'critical' | 'warning' | 'info' | 'success';
type Category = 'clinical' | 'system' | 'staffing' | 'safety' | 'general';
type FilterTab = 'all' | 'critical' | 'clinical' | 'system' | 'staffing';

/** Mutable alert lifecycle status */
type AlertStatus = 'active' | 'acknowledged' | 'escalated' | 'resolved';

/** Desktop/mobile status filter */
type StatusFilterTab = 'all' | 'active' | 'escalated' | 'acknowledged' | 'resolved';

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

/** Tracks mutable state for each alert at runtime */
interface AlertState {
  status: AlertStatus;
  /** ISO timestamp of when status last changed */
  statusChangedAt: string;
  /** Who performed the action */
  actor: string;
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

/** Format an ISO timestamp to a short readable time string */
const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─────────────────────────────────────────────────────────────────────────
// CSS keyframes injected once for the pulse-ring animation
// ─────────────────────────────────────────────────────────────────────────

const PULSE_RING_KEYFRAMES = `
@keyframes pulse-escalation-ring {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}
`;

let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected) return;
  const style = document.createElement('style');
  style.textContent = PULSE_RING_KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const AlertsCenter: React.FC<AlertsCenterProps> = ({ open, onClose, showToast, role, embedded, alertAcks, onAcknowledgeAlert }) => {
  // Inject keyframes for escalation animation
  React.useEffect(() => { ensureKeyframes(); }, []);

  // ── Mobile alert state — merge local state with cross-device synced acks ──
  const [alertStates, setAlertStates] = useState<Record<string, AlertState>>(() => {
    const init: Record<string, AlertState> = {};
    for (const a of MOCK_ALERTS) {
      // Use synced ack if available, otherwise default to active
      const synced = alertAcks?.[a.id];
      init[a.id] = synced
        ? { status: synced.status as AlertStatus, statusChangedAt: synced.at, actor: synced.actor }
        : { status: 'active', statusChangedAt: new Date().toISOString(), actor: '' };
    }
    return init;
  });

  // Merge incoming synced acks into local state
  React.useEffect(() => {
    if (!alertAcks) return;
    setAlertStates(prev => {
      const next = { ...prev };
      for (const [id, ack] of Object.entries(alertAcks)) {
        if (next[id] && next[id].status !== ack.status) {
          next[id] = { status: ack.status as AlertStatus, statusChangedAt: ack.at, actor: ack.actor };
        }
      }
      return next;
    });
  }, [alertAcks]);

  const [expanded, setExpanded] = useState<string | null>(null);

  // Role-aware default filter
  const defaultFilter: FilterTab =
    role === UserRole.NURSE ? 'clinical'
    : role === UserRole.MANAGER ? 'staffing'
    : role === UserRole.ER_PERSONNEL ? 'critical'
    : 'all';
  const [filter, setFilter] = useState<FilterTab>(defaultFilter);

  // Status filter for mobile
  const [statusFilter, setStatusFilter] = useState<StatusFilterTab>('all');

  // Role-aware category weight for secondary sort
  const categoryWeight = useCallback((cat: Category): number => {
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
  }, [role]);

  // Mutation helpers — mobile alerts
  const changeStatus = useCallback((id: string, status: AlertStatus) => {
    setAlertStates(prev => ({
      ...prev,
      [id]: { status, statusChangedAt: new Date().toISOString(), actor: 'Ops Director' },
    }));
  }, []);

  const handleAck = useCallback((id: string) => {
    changeStatus(id, 'acknowledged');
    onAcknowledgeAlert?.(id, 'Ops Director');
    showToast('Alert acknowledged');
  }, [changeStatus, showToast, onAcknowledgeAlert]);

  const handleResolve = useCallback((id: string) => {
    changeStatus(id, 'resolved');
    showToast('Alert resolved');
  }, [changeStatus, showToast]);

  const handleEscalate = useCallback((id: string) => {
    changeStatus(id, 'escalated');
    showToast('Alert escalated to supervisor');
  }, [changeStatus, showToast]);

  const getStatus = useCallback((id: string): AlertStatus => {
    return alertStates[id]?.status ?? 'active';
  }, [alertStates]);

  const getState = useCallback((id: string): AlertState => {
    return alertStates[id] ?? { status: 'active' as AlertStatus, statusChangedAt: new Date().toISOString(), actor: '' };
  }, [alertStates]);

  // Status counts for mobile
  const mobileStatusCounts: Record<StatusFilterTab, number> = useMemo(() => {
    const counts: Record<StatusFilterTab, number> = { all: 0, active: 0, escalated: 0, acknowledged: 0, resolved: 0 };
    for (const a of MOCK_ALERTS) {
      const s = getStatus(a.id);
      counts[s]++;
      counts.all++;
    }
    return counts;
  }, [getStatus]);

  const alerts = useMemo(() => {
    let list = [...MOCK_ALERTS];

    // Category filter
    if (filter === 'critical') list = list.filter((a) => a.severity === 'critical');
    else if (filter === 'clinical') list = list.filter((a) => a.category === 'clinical');
    else if (filter === 'system') list = list.filter((a) => a.category === 'system');
    else if (filter === 'staffing') list = list.filter((a) => a.category === 'staffing');

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(a => getStatus(a.id) === statusFilter);
    }

    // Sort: escalated first, then active, then acknowledged, then resolved
    const statusOrder: Record<AlertStatus, number> = { escalated: 0, active: 1, acknowledged: 2, resolved: 3 };
    list.sort((a, b) => {
      const sA = statusOrder[getStatus(a.id)];
      const sB = statusOrder[getStatus(b.id)];
      if (sA !== sB) return sA - sB;
      const catW = categoryWeight(a.category) - categoryWeight(b.category);
      if (catW !== 0) return catW;
      return a.minutesAgo - b.minutesAgo;
    });

    return list;
  }, [filter, statusFilter, alertStates, getStatus, categoryWeight]);

  const unreadCount = MOCK_ALERTS.filter((a) => getStatus(a.id) === 'active' || getStatus(a.id) === 'escalated').length;
  const critCount = MOCK_ALERTS.filter((a) => a.severity === 'critical' && getStatus(a.id) !== 'resolved').length;
  const warnCount = MOCK_ALERTS.filter((a) => a.severity === 'warning' && getStatus(a.id) !== 'resolved').length;

  const clearAllRead = () => {
    const now = new Date().toISOString();
    setAlertStates(prev => {
      const next = { ...prev };
      for (const a of MOCK_ALERTS) {
        if (next[a.id].status === 'active') {
          next[a.id] = { status: 'acknowledged', statusChangedAt: now, actor: 'Ops Director' };
        }
      }
      return next;
    });
    showToast('All active alerts acknowledged');
  };

  // Tab counts (category filter — counts non-resolved/non-acked)
  const tabCounts: Record<FilterTab, number> = useMemo(() => ({
    all: MOCK_ALERTS.filter(a => getStatus(a.id) === 'active' || getStatus(a.id) === 'escalated').length,
    critical: MOCK_ALERTS.filter(a => a.severity === 'critical' && (getStatus(a.id) === 'active' || getStatus(a.id) === 'escalated')).length,
    clinical: MOCK_ALERTS.filter(a => a.category === 'clinical' && (getStatus(a.id) === 'active' || getStatus(a.id) === 'escalated')).length,
    system: MOCK_ALERTS.filter(a => a.category === 'system' && (getStatus(a.id) === 'active' || getStatus(a.id) === 'escalated')).length,
    staffing: MOCK_ALERTS.filter(a => a.category === 'staffing' && (getStatus(a.id) === 'active' || getStatus(a.id) === 'escalated')).length,
  }), [getStatus]);

  // ── Desktop mock alerts for command view ──
  const MOCK_ALERTS_DESKTOP = useMemo(() => [
    { id: 'ALT-001', severity: 'critical' as const, category: 'clinical' as const, title: 'SpO2 Desaturation — ICU Bed 3', description: 'SpO2 dropped to 86%. Patient Alice Torres on 4L NC. Trend shows 15-min decline from 94%.', source: 'Vitals Monitor', patient: 'Alice Torres', mrn: 'MRN-6643', attending: 'Dr. Gomez', minutesAgo: 3, escalation: 'Auto-page to Rapid Response team' },
    { id: 'ALT-002', severity: 'critical' as const, category: 'operational' as const, title: 'ED Wait Time Exceeds Threshold', description: 'Average ED wait time is 125 minutes. 14 patients in lobby. NEDOCS score: 185 (Dangerous).', source: 'Capacity Engine', patient: null, mrn: null, attending: null, minutesAgo: 8, escalation: 'Notify Charge Nurse + House Supervisor' },
    { id: 'ALT-003', severity: 'critical' as const, category: 'clinical' as const, title: 'Critical Lab — Troponin Elevated', description: 'Troponin I: 2.4 ng/mL (ref <0.04). Patient Jason Sellers, ED Bed 4. Second draw pending.', source: 'Lab System', patient: 'Jason Sellers', mrn: 'MRN-2290', attending: 'Dr. Kim', minutesAgo: 12, escalation: 'Cardiology consult auto-requested' },
    { id: 'ALT-004', severity: 'critical' as const, category: 'clinical' as const, title: 'MEWS Score ≥5 — Sepsis Protocol', description: 'Patient Clara Rodriguez, Bed 202. MEWS 6. Lactate 4.2. qSOFA 2/3. Sepsis bundle initiated.', source: 'Early Warning System', patient: 'Clara Rodriguez', mrn: 'MRN-5501', attending: 'Dr. Foster', minutesAgo: 15, escalation: 'Sepsis bundle auto-ordered' },
    { id: 'ALT-005', severity: 'warning' as const, category: 'operational' as const, title: 'ICU Staffing Gap — Night Shift', description: 'ICU night shift (19:00-07:00) short 1 RN. Current coverage: 3 nurses for 5 patients. Ratio 1:1.7 vs target 1:1.', source: 'Workforce Engine', patient: null, mrn: null, attending: null, minutesAgo: 22, escalation: 'Float pool notified' },
    { id: 'ALT-006', severity: 'warning' as const, category: 'clinical' as const, title: 'Fall Risk — Bed 203', description: 'Patient Thomas Kim, 78yo, on opioids + anticoagulant. Morse score 65 (high). Bed alarm active.', source: 'Safety System', patient: 'Thomas Kim', mrn: 'MRN-7321', attending: 'Dr. Park', minutesAgo: 28, escalation: null },
    { id: 'ALT-007', severity: 'warning' as const, category: 'system' as const, title: 'EHR Sync Latency Detected', description: 'HL7 ADT feed from Epic delayed by 8 minutes. Lab results may be stale. Engineering notified.', source: 'Integration Monitor', patient: null, mrn: null, attending: null, minutesAgo: 35, escalation: 'IT ticket AUTO-2847 opened' },
    { id: 'ALT-008', severity: 'warning' as const, category: 'operational' as const, title: 'Dirty Beds Exceeding Turnaround', description: '3 beds dirty >20 minutes. EVS response time degraded. Beds: A5, 206, 309.', source: 'Bed Management', patient: null, mrn: null, attending: null, minutesAgo: 18, escalation: 'EVS supervisor paged' },
    { id: 'ALT-009', severity: 'info' as const, category: 'operational' as const, title: 'Shift Change in 90 Minutes', description: 'Day shift ends 19:00. 12 handoffs pending. 2 nurses have incomplete documentation.', source: 'Workforce Engine', patient: null, mrn: null, attending: null, minutesAgo: 45, escalation: null },
    { id: 'ALT-010', severity: 'info' as const, category: 'system' as const, title: 'Scheduled Downtime — Lab Interface', description: 'Lab interface maintenance window 02:00-03:00. Manual result entry may be required.', source: 'IT Operations', patient: null, mrn: null, attending: null, minutesAgo: 120, escalation: null },
    { id: 'ALT-011', severity: 'warning' as const, category: 'clinical' as const, title: 'Medication Override — Controlled Substance', description: 'Pyxis override for Dilaudid 2mg at Station 3-East. Nurse: V. Singh. No order on file. Pharmacy review pending.', source: 'Pharmacy System', patient: 'Jacob Reeves', mrn: 'MRN-4498', attending: 'Dr. Singh', minutesAgo: 40, escalation: 'Pharmacy auto-review triggered' },
    { id: 'ALT-012', severity: 'info' as const, category: 'clinical' as const, title: 'Discharge Ready — Bed 207', description: 'Patient Jacob Reeves. DC order signed. Meds dispensed. Ride confirmed for 12:30. Ready for final check.', source: 'Discharge Planner', patient: 'Jacob Reeves', mrn: 'MRN-4498', attending: 'Dr. Singh', minutesAgo: 5, escalation: null },
  ], []);

  // ── Desktop alert state (mirroring the mobile pattern) ──
  const [deskAlertStates, setDeskAlertStates] = useState<Record<string, AlertState>>(() => {
    const init: Record<string, AlertState> = {};
    const now = new Date().toISOString();
    const preAckedIds = new Set(['ALT-004', 'ALT-007', 'ALT-009', 'ALT-010']);
    for (const a of [
      { id: 'ALT-001' }, { id: 'ALT-002' }, { id: 'ALT-003' }, { id: 'ALT-004' },
      { id: 'ALT-005' }, { id: 'ALT-006' }, { id: 'ALT-007' }, { id: 'ALT-008' },
      { id: 'ALT-009' }, { id: 'ALT-010' }, { id: 'ALT-011' }, { id: 'ALT-012' },
    ]) {
      init[a.id] = {
        status: preAckedIds.has(a.id) ? 'acknowledged' : 'active',
        statusChangedAt: now,
        actor: preAckedIds.has(a.id) ? 'Ops Director' : '',
      };
    }
    return init;
  });

  const [deskFilter, setDeskFilter] = useState<'all' | 'clinical' | 'operational' | 'system'>('all');
  const [deskStatusFilter, setDeskStatusFilter] = useState<StatusFilterTab>('all');

  const getDeskStatus = useCallback((id: string): AlertStatus => {
    return deskAlertStates[id]?.status ?? 'active';
  }, [deskAlertStates]);

  const getDeskState = useCallback((id: string): AlertState => {
    return deskAlertStates[id] ?? { status: 'active' as AlertStatus, statusChangedAt: new Date().toISOString(), actor: '' };
  }, [deskAlertStates]);

  const deskChangeStatus = useCallback((id: string, status: AlertStatus) => {
    setDeskAlertStates(prev => ({
      ...prev,
      [id]: { status, statusChangedAt: new Date().toISOString(), actor: 'Ops Director' },
    }));
  }, []);

  const deskHandleAck = useCallback((id: string) => {
    deskChangeStatus(id, 'acknowledged');
    showToast('Alert acknowledged');
  }, [deskChangeStatus, showToast]);

  const deskHandleEscalate = useCallback((id: string) => {
    deskChangeStatus(id, 'escalated');
    showToast('Alert escalated to supervisor');
  }, [deskChangeStatus, showToast]);

  const deskHandleResolve = useCallback((id: string) => {
    deskChangeStatus(id, 'resolved');
    showToast('Alert resolved');
  }, [deskChangeStatus, showToast]);

  // Desktop status counts
  const deskStatusCounts: Record<StatusFilterTab, number> = useMemo(() => {
    const counts: Record<StatusFilterTab, number> = { all: 0, active: 0, escalated: 0, acknowledged: 0, resolved: 0 };
    for (const a of MOCK_ALERTS_DESKTOP) {
      const s = getDeskStatus(a.id);
      counts[s]++;
      counts.all++;
    }
    return counts;
  }, [getDeskStatus, MOCK_ALERTS_DESKTOP]);

  // Filtered + sorted desktop alerts
  const deskAlerts = useMemo(() => {
    let list = MOCK_ALERTS_DESKTOP.map(a => ({ ...a }));
    if (deskFilter !== 'all') list = list.filter(a => a.category === deskFilter);
    if (deskStatusFilter !== 'all') list = list.filter(a => getDeskStatus(a.id) === deskStatusFilter);

    // Sort: escalated first, active, acknowledged, resolved. Then by time.
    const statusOrder: Record<AlertStatus, number> = { escalated: 0, active: 1, acknowledged: 2, resolved: 3 };
    list.sort((a, b) => {
      const sA = statusOrder[getDeskStatus(a.id)];
      const sB = statusOrder[getDeskStatus(b.id)];
      if (sA !== sB) return sA - sB;
      return a.minutesAgo - b.minutesAgo;
    });
    return list;
  }, [deskFilter, deskStatusFilter, deskAlertStates, MOCK_ALERTS_DESKTOP, getDeskStatus]);

  // Desktop severity counts (for the old summary display, now secondary)
  const deskCritCount = MOCK_ALERTS_DESKTOP.filter(a => a.severity === 'critical' && getDeskStatus(a.id) !== 'resolved').length;
  const deskWarnCount = MOCK_ALERTS_DESKTOP.filter(a => a.severity === 'warning' && getDeskStatus(a.id) !== 'resolved').length;
  const deskInfoCount = MOCK_ALERTS_DESKTOP.filter(a => a.severity === 'info' && getDeskStatus(a.id) !== 'resolved').length;
  const deskUnread = MOCK_ALERTS_DESKTOP.filter(a => getDeskStatus(a.id) === 'active' || getDeskStatus(a.id) === 'escalated').length;

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
          {/* ── Summary bar: 4 status boxes (clickable filters) ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: SPACE.md,
              padding: `${SPACE.lg}px ${SPACE.xl}px`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {/* Active */}
            <button
              onClick={() => setDeskStatusFilter(deskStatusFilter === 'active' ? 'all' : 'active')}
              style={{
                background: deskStatusFilter === 'active' ? `${COLORS.info}15` : `${COLORS.info}08`,
                border: `1px solid ${deskStatusFilter === 'active' ? COLORS.info : `${COLORS.info}30`}`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
                cursor: 'pointer',
                transition: cssTransition(),
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.info, lineHeight: 1 }}>
                {deskStatusCounts.active}
              </div>
              <Mono tone="info" size="xs">ACTIVE</Mono>
            </button>
            {/* Escalated */}
            <button
              onClick={() => setDeskStatusFilter(deskStatusFilter === 'escalated' ? 'all' : 'escalated')}
              style={{
                background: deskStatusFilter === 'escalated' ? `${COLORS.crit}15` : `${COLORS.crit}08`,
                border: `1px solid ${deskStatusFilter === 'escalated' ? COLORS.crit : `${COLORS.crit}30`}`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
                cursor: 'pointer',
                transition: cssTransition(),
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.crit, lineHeight: 1 }}>
                {deskStatusCounts.escalated}
              </div>
              <Mono tone="crit" size="xs">ESCALATED</Mono>
            </button>
            {/* Acknowledged */}
            <button
              onClick={() => setDeskStatusFilter(deskStatusFilter === 'acknowledged' ? 'all' : 'acknowledged')}
              style={{
                background: deskStatusFilter === 'acknowledged' ? `${COLORS.warn}15` : `${COLORS.warn}08`,
                border: `1px solid ${deskStatusFilter === 'acknowledged' ? COLORS.warn : `${COLORS.warn}30`}`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
                cursor: 'pointer',
                transition: cssTransition(),
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.warn, lineHeight: 1 }}>
                {deskStatusCounts.acknowledged}
              </div>
              <Mono tone="warn" size="xs">ACKNOWLEDGED</Mono>
            </button>
            {/* Resolved */}
            <button
              onClick={() => setDeskStatusFilter(deskStatusFilter === 'resolved' ? 'all' : 'resolved')}
              style={{
                background: deskStatusFilter === 'resolved' ? `${COLORS.ok}15` : `${COLORS.ok}08`,
                border: `1px solid ${deskStatusFilter === 'resolved' ? COLORS.ok : `${COLORS.ok}30`}`,
                borderRadius: RADIUS.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.xs,
                cursor: 'pointer',
                transition: cssTransition(),
              }}
            >
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: FONTS.mono, color: COLORS.ok, lineHeight: 1 }}>
                {deskStatusCounts.resolved}
              </div>
              <Mono tone="ok" size="xs">RESOLVED</Mono>
            </button>
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
              // System tab was rgba(139,92,246,0.9) (violet leak);
              // → COLORS.accentDeep (rose-deep) keeps it brand-aligned.
              const tabColor =
                tab === 'clinical' ? COLORS.info
                : tab === 'operational' ? COLORS.warn
                : tab === 'system' ? COLORS.accentDeep
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
                    transition: cssTransition(),
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
            <AnimatePresence mode="popLayout">
              {deskAlerts.map((alert, idx) => {
                const st = getDeskStatus(alert.id);
                const stState = getDeskState(alert.id);
                const isResolved = st === 'resolved';
                const isEscalated = st === 'escalated';
                const isAck = st === 'acknowledged';
                const color = sevColor(alert.severity);
                const tone = sevTone(alert.severity);
                const isFirstCrit = !isResolved && !isAck && alert.severity === 'critical' && idx === 0;

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03, duration: MOTION.fast }}
                    style={{
                      position: 'relative',
                      background: isResolved ? COLORS.bg : COLORS.surface,
                      border: `1px solid ${isEscalated ? COLORS.crit : COLORS.border}`,
                      borderLeft: `4px solid ${isResolved ? COLORS.ok : isEscalated ? COLORS.crit : isAck ? COLORS.warn : color}`,
                      borderRadius: RADIUS.sm,
                      overflow: 'hidden',
                      opacity: isResolved ? 0.45 : isAck ? 0.65 : 1,
                      transition: cssTransition(MOTION.base),
                      padding: `${SPACE.lg}px`,
                      boxShadow: isEscalated ? `0 0 16px ${COLORS.crit}30, inset 0 0 1px ${COLORS.crit}40` : undefined,
                      animation: isEscalated ? 'pulse-escalation-ring 2s ease-in-out infinite' : undefined,
                    }}
                  >
                    {isFirstCrit && <ScanningLine duration={4} />}

                    {/* Row 1: Status badge + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                      {isResolved ? (
                        <StatusPill label="RESOLVED" tone="ok" />
                      ) : isEscalated ? (
                        <StatusPill label="ESCALATED" tone="crit" pulse />
                      ) : isAck ? (
                        <StatusPill label="ACKNOWLEDGED" tone="warn" />
                      ) : (
                        <StatusPill label={alert.severity.toUpperCase()} tone={tone} pulse={alert.severity === 'critical'} />
                      )}
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.body.size,
                          fontWeight: 700,
                          color: isResolved ? COLORS.textMuted : COLORS.textPrimary,
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: alert.escalation || isEscalated ? SPACE.sm : 0 }}>
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

                    {/* Row 5: Escalation info */}
                    {(alert.escalation || isEscalated) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.sm }}>
                        <ArrowUpRight size={11} color={COLORS.crit} style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: TYPE.bodySm.size,
                            fontStyle: 'italic',
                            color: COLORS.crit,
                          }}
                        >
                          {isEscalated && !alert.escalation
                            ? `Escalated by ${stState.actor} at ${formatTimestamp(stState.statusChangedAt)}`
                            : `Escalation: ${alert.escalation}`}
                        </span>
                      </div>
                    )}

                    {/* Resolved/Acknowledged metadata */}
                    {(isResolved || isAck) && stState.actor && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.sm }}>
                        <CheckCircle2 size={11} color={isResolved ? COLORS.ok : COLORS.warn} style={{ flexShrink: 0 }} />
                        <Mono tone={isResolved ? 'ok' : 'warn'} size="xs">
                          {isResolved ? 'Resolved' : 'Acknowledged'} by {stState.actor} at {formatTimestamp(stState.statusChangedAt)}
                        </Mono>
                      </div>
                    )}

                    {/* Action buttons — visible when not resolved */}
                    {!isResolved && (
                      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTop: `1px solid ${COLORS.border}` }}>
                        {st === 'active' && (
                          <TacticalButton
                            variant="secondary"
                            size="sm"
                            icon={<CheckCircle2 size={12} />}
                            onClick={() => deskHandleAck(alert.id)}
                          >
                            ACKNOWLEDGE
                          </TacticalButton>
                        )}
                        {st !== 'escalated' && (
                          <TacticalButton
                            variant="danger"
                            size="sm"
                            icon={<ArrowUpRight size={12} />}
                            onClick={() => deskHandleEscalate(alert.id)}
                          >
                            ESCALATE
                          </TacticalButton>
                        )}
                        <TacticalButton
                          variant="primary"
                          size="sm"
                          icon={<Shield size={12} />}
                          onClick={() => deskHandleResolve(alert.id)}
                        >
                          RESOLVE
                        </TacticalButton>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

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

  // ── Mobile overlay mode ──
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

            {/* ── Status filter tabs (Active / Escalated / Acknowledged / Resolved) ── */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: `${SPACE.sm}px ${SPACE.base}px`,
                overflowX: 'auto',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              {(['all', 'active', 'escalated', 'acknowledged', 'resolved'] as StatusFilterTab[]).map(tab => {
                const isActive = statusFilter === tab;
                const tColor =
                  tab === 'escalated' ? COLORS.crit
                  : tab === 'active' ? COLORS.info
                  : tab === 'acknowledged' ? COLORS.warn
                  : tab === 'resolved' ? COLORS.ok
                  : COLORS.textSecondary;
                return (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
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
                    {mobileStatusCounts[tab] > 0 && (
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
                        {mobileStatusCounts[tab]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Category filter tabs */}
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
                // Staffing tab was rgba(139,92,246,0.9) (violet leak)
                // → COLORS.accentDeep, brand-aligned.
                const tColor =
                  tab === 'critical' ? COLORS.crit
                  : tab === 'clinical' ? COLORS.info
                  : tab === 'system' ? COLORS.warn
                  : tab === 'staffing' ? COLORS.accentDeep
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
              <AnimatePresence mode="popLayout">
                {alerts.map((alert, idx) => {
                  const st = getStatus(alert.id);
                  const stState = getState(alert.id);
                  const isResolved = st === 'resolved';
                  const isEscalated = st === 'escalated';
                  const isAck = st === 'acknowledged';
                  const isExp = expanded === alert.id;
                  const color = SEV_COLOR[alert.severity];
                  const bg = isResolved ? COLORS.bg : isAck ? COLORS.surface : SEV_BG[alert.severity];
                  const isFirstCrit = !isResolved && !isAck && alert.severity === 'critical' && idx === 0;

                  return (
                    <motion.div
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.02, duration: MOTION.fast }}
                      style={{
                        position: 'relative',
                        background: bg,
                        border: `1px solid ${isEscalated ? `${COLORS.crit}60` : isResolved ? COLORS.border : `${color}30`}`,
                        borderLeft: `3px solid ${isResolved ? COLORS.ok : isEscalated ? COLORS.crit : isAck ? COLORS.warn : color}`,
                        borderRadius: RADIUS.sm,
                        overflow: 'hidden',
                        opacity: isResolved ? 0.45 : isAck ? 0.6 : 1,
                        transition: cssTransition(MOTION.base),
                        boxShadow: isEscalated ? `0 0 12px ${COLORS.crit}25` : undefined,
                        animation: isEscalated ? 'pulse-escalation-ring 2s ease-in-out infinite' : undefined,
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
                            background: isEscalated ? `${COLORS.crit}20` : `${color}15`,
                            border: `1px solid ${isEscalated ? `${COLORS.crit}50` : `${color}30`}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isEscalated ? COLORS.crit : color,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {isEscalated ? <ArrowUpRight size={13} /> : CAT_ICON[alert.category]}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: 2 }}>
                            {isResolved ? (
                              <StatusPill label="RESOLVED" tone="ok" />
                            ) : isEscalated ? (
                              <StatusPill label="ESCALATED" tone="crit" pulse />
                            ) : isAck ? (
                              <StatusPill label="ACKNOWLEDGED" tone="warn" />
                            ) : (
                              <StatusPill
                                label={alert.severity.toUpperCase()}
                                tone={
                                  alert.severity === 'critical' ? 'crit'
                                  : alert.severity === 'warning' ? 'warn'
                                  : alert.severity === 'success' ? 'ok'
                                  : 'info'
                                }
                              />
                            )}
                            <Mono tone="muted" size="xs">{alert.source}</Mono>
                          </div>
                          <div
                            style={{
                              fontFamily: FONTS.sans,
                              fontSize: TYPE.body.size,
                              fontWeight: 600,
                              color: isResolved ? COLORS.textMuted : COLORS.textPrimary,
                              marginBottom: 2,
                            }}
                          >
                            {isResolved && <CheckCircle2 size={12} color={COLORS.ok} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                            {alert.title}
                          </div>
                          {alert.patientRef && (
                            <Mono tone="secondary" size="xs">{alert.patientRef}</Mono>
                          )}
                          {/* Inline status metadata */}
                          {(isResolved || isAck) && stState.actor && (
                            <div style={{ marginTop: 2 }}>
                              <Mono tone={isResolved ? 'ok' : 'warn'} size="xs">
                                {isResolved ? 'Resolved' : "Ack'd"} by {stState.actor} at {formatTimestamp(stState.statusChangedAt)}
                              </Mono>
                            </div>
                          )}
                          {isEscalated && stState.actor && (
                            <div style={{ marginTop: 2 }}>
                              <Mono tone="crit" size="xs">
                                Escalated by {stState.actor} at {formatTimestamp(stState.statusChangedAt)}
                              </Mono>
                            </div>
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
                                {/* Lifecycle actions based on current status */}
                                {st === 'active' && (
                                  <TacticalButton
                                    variant="secondary"
                                    size="sm"
                                    icon={<CheckCircle2 size={12} />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAck(alert.id);
                                    }}
                                  >
                                    Acknowledge
                                  </TacticalButton>
                                )}
                                {(st === 'active' || st === 'acknowledged') && (
                                  <TacticalButton
                                    variant="danger"
                                    size="sm"
                                    icon={<ArrowUpRight size={12} />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEscalate(alert.id);
                                    }}
                                  >
                                    Escalate
                                  </TacticalButton>
                                )}
                                {!isResolved && (
                                  <TacticalButton
                                    variant="primary"
                                    size="sm"
                                    icon={<Shield size={12} />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResolve(alert.id);
                                    }}
                                  >
                                    Resolve
                                  </TacticalButton>
                                )}
                                {/* Additional context actions from mock data */}
                                {alert.actions.filter(a => a !== 'Acknowledge').map((action) => (
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
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

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
