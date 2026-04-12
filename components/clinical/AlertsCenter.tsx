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

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface AlertsCenterProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
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

export const AlertsCenter: React.FC<AlertsCenterProps> = ({ open, onClose, showToast }) => {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  const alerts = useMemo(() => {
    let list = [...MOCK_ALERTS];

    if (filter === 'critical') list = list.filter((a) => a.severity === 'critical');
    else if (filter === 'clinical') list = list.filter((a) => a.category === 'clinical');
    else if (filter === 'system') list = list.filter((a) => a.category === 'system');
    else if (filter === 'staffing') list = list.filter((a) => a.category === 'staffing');

    // Unacknowledged first, then by time
    list.sort((a, b) => {
      const ackA = acknowledged.has(a.id) ? 1 : 0;
      const ackB = acknowledged.has(b.id) ? 1 : 0;
      if (ackA !== ackB) return ackA - ackB;
      return a.minutesAgo - b.minutesAgo;
    });

    return list;
  }, [filter, acknowledged]);

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
