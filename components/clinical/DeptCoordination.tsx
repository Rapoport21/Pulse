/**
 * DeptCoordination — tactical C2 overlay for multi-department ops.
 * Bucket A innovation: dept nodes, transfers, shared resources,
 * bottleneck alerts, and inter-dept coordination comms.
 *
 * This module exports two components:
 *   • `DeptCoordinationBody` — the scrollable content (summary +
 *     dept nodes + sections). Renders inline with no overlay
 *     chrome. Used by MobileCoordination so the Floor Manager's
 *     mobile tab shows the same C2 view that the Horizon quick
 *     action pops up as a fullscreen overlay. Takes `showToast`.
 *   • `DeptCoordination` — the fullscreen overlay (position:fixed
 *     + HudStrip header + close button). Wraps the body. Used by
 *     the Horizon page's "COORD · Departments" quick action.
 *
 * Keeping one source for the body guarantees the inline screen
 * and the overlay never drift — add a department or a bottleneck
 * in one place and both surfaces update.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, AlertTriangle, ArrowRight, Activity, MessageSquare,
  ChevronDown, ChevronUp, Zap, Clock, Layers,
} from 'lucide-react';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, Z,
  Mono, BracketLabel, StatusPill, TacticalCard,
  TacticalButton, HudStrip, ScanningLine, Divider,
  ConfidenceBadge,
} from '../design';

// ── Types ────────────────────────────────────────────────────────────────

export interface DeptCoordinationProps { open: boolean; onClose: () => void; showToast: (msg: string) => void; }

type DeptStatus = 'NORMAL' | 'STRAINED' | 'CRITICAL';
type TransferStatus = 'IN PROGRESS' | 'PENDING' | 'BLOCKED';

interface Department { id: string; name: string; shortName: string; census: number; capacity: number; status: DeptStatus; activeTransfers: number; color: string; type: 'clinical' | 'utility'; }
interface ActiveTransfer { id: string; patientId: string; patientInitials: string; from: string; to: string; reason: string; eta: string; status: TransferStatus; progress: number; }
interface SharedResource { id: string; name: string; available: number; total: number; unit: string; detail: string; }
interface BottleneckAlert { id: string; title: string; detail: string; severity: 'warn' | 'crit'; action: string; }
interface CoordMessage { id: string; from: string; to: string; message: string; time: string; fromColor: string; }

// ── Mock data ────────────────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
  { id: 'ed', name: 'Emergency Dept', shortName: 'ED', census: 32, capacity: 40, status: 'STRAINED', activeTransfers: 3, color: COLORS.accent, type: 'clinical' },
  { id: 'icu', name: 'Intensive Care', shortName: 'ICU', census: 12, capacity: 14, status: 'CRITICAL', activeTransfers: 2, color: COLORS.crit, type: 'clinical' },
  { id: 'or', name: 'Operating Room', shortName: 'OR', census: 4, capacity: 6, status: 'STRAINED', activeTransfers: 1, color: '#A855F7', type: 'clinical' },
  { id: 'stepdown', name: 'Stepdown Unit', shortName: 'SDU', census: 8, capacity: 12, status: 'NORMAL', activeTransfers: 1, color: COLORS.info, type: 'clinical' },
  { id: 'medsurg', name: 'Med-Surg', shortName: 'M/S', census: 44, capacity: 54, status: 'NORMAL', activeTransfers: 0, color: COLORS.ok, type: 'clinical' },
  { id: 'lab', name: 'Laboratory', shortName: 'LAB', census: 18, capacity: 30, status: 'STRAINED', activeTransfers: 0, color: COLORS.warn, type: 'utility' },
  { id: 'radiology', name: 'Radiology', shortName: 'RAD', census: 6, capacity: 8, status: 'NORMAL', activeTransfers: 0, color: '#06B6D4', type: 'utility' },
  { id: 'pharmacy', name: 'Pharmacy', shortName: 'RX', census: 42, capacity: 60, status: 'NORMAL', activeTransfers: 0, color: '#8B5CF6', type: 'utility' },
];

const ACTIVE_TRANSFERS: ActiveTransfer[] = [
  { id: 't1', patientId: 'P001', patientInitials: 'JM', from: 'ED', to: 'OR', reason: 'Trauma Surgery', eta: '15min', status: 'PENDING', progress: 30 },
  { id: 't2', patientId: 'P002', patientInitials: 'SK', from: 'ED', to: 'ICU', reason: 'NSTEMI (Cath Lab first)', eta: '45min', status: 'IN PROGRESS', progress: 55 },
  { id: 't3', patientId: 'P005', patientInitials: 'RL', from: 'ED', to: 'ICU', reason: 'Sepsis Upgrade', eta: '20min', status: 'BLOCKED', progress: 10 },
  { id: 't4', patientId: 'P008', patientInitials: 'AW', from: 'ICU', to: 'SDU', reason: 'Step-down after extubation', eta: '30min', status: 'IN PROGRESS', progress: 70 },
];

const SHARED_RESOURCES: SharedResource[] = [
  { id: 'r1', name: 'Ventilators', available: 3, total: 18, unit: 'units', detail: 'Shared across ICU / Stepdown' },
  { id: 'r2', name: 'Blood Bank PRBC', available: 12, total: 40, unit: 'units', detail: '4 FFP also available' },
  { id: 'r3', name: 'OR Rooms', available: 2, total: 6, unit: 'rooms', detail: 'Rooms 1, 4 available' },
  { id: 'r4', name: 'CT Scanner Queue', available: 4, total: 4, unit: 'waiting', detail: '~20min avg wait' },
];

const BOTTLENECK_ALERTS: BottleneckAlert[] = [
  { id: 'b1', title: 'OR Turnaround Delayed', detail: 'Room 3 cleanup 45min (target 30min)', severity: 'warn', action: 'Page EVS Lead' },
  { id: 'b2', title: 'Lab TAT Elevated', detail: 'CBC avg 52min (target 30min)', severity: 'warn', action: 'Escalate to Lab Director' },
  { id: 'b3', title: 'ED to ICU Transfer Blocked', detail: 'No ICU beds until 16:00 discharge', severity: 'crit', action: 'Activate Surge Protocol' },
];

const COORD_MESSAGES: CoordMessage[] = [
  { id: 'm1', from: 'ED', to: 'ICU', message: 'Need bed for sepsis upgrade, ETA 20min', time: '14:32', fromColor: COLORS.accent },
  { id: 'm2', from: 'OR', to: 'ED', message: 'Room 2 ready for trauma case, send when stable', time: '14:28', fromColor: '#A855F7' },
  { id: 'm3', from: 'LAB', to: 'ED', message: 'STAT troponin result available for P002', time: '14:25', fromColor: COLORS.warn },
  { id: 'm4', from: 'ICU', to: 'SDU', message: 'P008 extubated, ready for step-down in 30min', time: '14:18', fromColor: COLORS.crit },
  { id: 'm5', from: 'RX', to: 'ICU', message: 'Vasopressin drip prepared for bed 7, runner dispatched', time: '14:12', fromColor: '#8B5CF6' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

const deptStatusTone = (s: DeptStatus): 'ok' | 'warn' | 'crit' => s === 'NORMAL' ? 'ok' : s === 'STRAINED' ? 'warn' : 'crit';
const deptStatusColor = (s: DeptStatus) => s === 'NORMAL' ? COLORS.ok : s === 'STRAINED' ? COLORS.warn : COLORS.crit;
const transferStatusColor = (s: TransferStatus) => s === 'IN PROGRESS' ? COLORS.info : s === 'PENDING' ? COLORS.warn : COLORS.crit;
const transferStatusTone = (s: TransferStatus): 'ok' | 'warn' | 'crit' | 'info' => s === 'IN PROGRESS' ? 'info' : s === 'PENDING' ? 'warn' : 'crit';
const utilizationColor = (avail: number, total: number) => { const p = total > 0 ? (avail / total) * 100 : 0; return p >= 30 ? COLORS.ok : p >= 15 ? COLORS.warn : COLORS.crit; };

// ── Body component (inline) ──────────────────────────────────────────────
// Everything the overlay renders inside its scrollable region, but with
// no position:fixed, no HudStrip header, no close button. Drop this
// inside any mobile screen to embed the C2 view.

export interface DeptCoordinationBodyProps {
  showToast: (msg: string) => void;
}

export const DeptCoordinationBody: React.FC<DeptCoordinationBodyProps> = ({ showToast }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('transfers');

  const toggleSection = (s: string) => setExpandedSection(prev => prev === s ? null : s);

  // ── Department Nodes ───────────────────────────────────────────────────
  const renderDeptNodes = () => {
    const clinical = DEPARTMENTS.filter(d => d.type === 'clinical');
    const utility = DEPARTMENTS.filter(d => d.type === 'utility');

    return (
      <div style={{ padding: `${SPACE.base}px ${SPACE.base}px 0` }}>
        {/* Clinical departments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
          <BracketLabel tone="accent" size="xs">DEPARTMENTS</BracketLabel>
          <Mono tone="muted" size="xs">{DEPARTMENTS.length} ACTIVE</Mono>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm, marginBottom: SPACE.md }}>
          {clinical.map(dept => {
            const occupancy = Math.round((dept.census / dept.capacity) * 100);
            const statusCol = deptStatusColor(dept.status);
            return (
              <TacticalCard key={dept.id} padding="sm" style={{ borderLeft: `3px solid ${statusCol}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs }}>
                  <span style={{
                    fontFamily: FONTS.sans, fontSize: TYPE.h4.size, fontWeight: TYPE.h4.weight,
                    color: COLORS.textPrimary,
                  }}>{dept.shortName}</span>
                  <StatusPill label={dept.status} tone={deptStatusTone(dept.status)} size="xs" />
                </div>
                <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: SPACE.xs }}>{dept.name}</Mono>

                {/* Census bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 4 }}>
                  <Mono tone="muted" size="xs">CENSUS</Mono>
                  <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color: COLORS.textPrimary }}>
                    {dept.census}/{dept.capacity}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 3, background: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: SPACE.xs }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${occupancy}%` }}
                    transition={{ duration: MOTION.base, ease: MOTION.ease }}
                    style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0,
                      background: statusCol,
                      borderRadius: RADIUS.full,
                    }}
                  />
                </div>

                {/* Active transfers indicator */}
                {dept.activeTransfers > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <ArrowRight size={9} color={COLORS.info} />
                    <Mono tone="info" size="xs">{dept.activeTransfers} TRANSFER{dept.activeTransfers > 1 ? 'S' : ''}</Mono>
                  </div>
                )}
              </TacticalCard>
            );
          })}
        </div>

        {/* Utility departments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
          <Mono tone="muted" size="xs">SUPPORT SERVICES</Mono>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: SPACE.sm }}>
          {utility.map(dept => {
            const occupancy = Math.round((dept.census / dept.capacity) * 100);
            return (
              <div key={dept.id} style={{
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                borderTop: `2px solid ${dept.color}`,
              }}>
                <span style={{
                  fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, fontWeight: 600,
                  color: COLORS.textPrimary, display: 'block', marginBottom: 2,
                }}>{dept.shortName}</span>
                <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: 4 }}>{dept.name}</Mono>
                <div style={{ position: 'relative', height: 2, background: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${occupancy}%`,
                    background: deptStatusColor(dept.status),
                    borderRadius: RADIUS.full,
                    transition: `width ${MOTION.base}s ease`,
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <StatusPill label={dept.status} tone={deptStatusTone(dept.status)} size="xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Active Transfers ───────────────────────────────────────────────────
  const renderTransfers = () => {
    const isOpen = expandedSection === 'transfers';
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('transfers')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <BracketLabel tone="accent" size="xs">ACTIVE TRANSFERS</BracketLabel>
            <span style={{
              padding: `1px ${SPACE.sm}px`, background: `${COLORS.info}20`,
              border: `1px solid ${COLORS.info}40`, borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600,
              letterSpacing: '0.1em', color: COLORS.info,
            }}>{ACTIVE_TRANSFERS.length}</span>
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
                {ACTIVE_TRANSFERS.map(transfer => {
                  const statusCol = transferStatusColor(transfer.status);
                  return (
                    <motion.div
                      key={transfer.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: MOTION.fast }}
                      style={{
                        position: 'relative',
                        padding: SPACE.md,
                        background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${statusCol}08 100%)`,
                        border: `1px solid ${statusCol}30`,
                        borderRadius: RADIUS.sm,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Animated accent bar */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: 3 }}
                        transition={{ duration: MOTION.base, ease: MOTION.ease }}
                        style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          background: statusCol,
                          boxShadow: `0 0 10px ${statusCol}60`,
                        }}
                      />

                      {/* Header: patient + status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: RADIUS.full,
                            background: `${statusCol}20`, border: `1px solid ${statusCol}50`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, color: statusCol,
                          }}>
                            {transfer.patientInitials}
                          </div>
                          <div>
                            <Mono tone="secondary" size="xs">{transfer.patientId}</Mono>
                          </div>
                        </div>
                        <StatusPill label={transfer.status} tone={transferStatusTone(transfer.status)} size="xs" />
                      </div>

                      {/* Route: from -> to */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs }}>
                        <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 600, color: COLORS.textPrimary }}>
                          {transfer.from}
                        </span>
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <ArrowRight size={14} color={statusCol} />
                        </motion.div>
                        <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 600, color: COLORS.textPrimary }}>
                          {transfer.to}
                        </span>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} color={COLORS.textMuted} />
                          <Mono tone="secondary" size="xs">{transfer.eta}</Mono>
                        </div>
                      </div>

                      {/* Reason */}
                      <div style={{
                        fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size,
                        color: COLORS.textSecondary, marginBottom: SPACE.sm,
                      }}>
                        {transfer.reason}
                      </div>

                      {/* Progress bar */}
                      <div style={{ position: 'relative', height: 3, background: `${statusCol}20`, borderRadius: RADIUS.full, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${transfer.progress}%` }}
                          transition={{ duration: MOTION.slow, ease: MOTION.ease }}
                          style={{
                            position: 'absolute', top: 0, left: 0, bottom: 0,
                            background: statusCol,
                            borderRadius: RADIUS.full,
                            boxShadow: `0 0 6px ${statusCol}40`,
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Resource Sharing Panel ─────────────────────────────────────────────
  const renderResources = () => {
    const isOpen = expandedSection === 'resources';
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('resources')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <BracketLabel tone="accent" size="xs">SHARED RESOURCES</BracketLabel>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, paddingBottom: SPACE.base }}>
                {SHARED_RESOURCES.map(resource => {
                  const utilPct = resource.total > 0 ? Math.round(((resource.total - resource.available) / resource.total) * 100) : 0;
                  const barColor = utilizationColor(resource.available, resource.total);
                  return (
                    <div key={resource.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <Layers size={11} color={COLORS.textMuted} />
                          <span style={{
                            fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size,
                            fontWeight: 600, color: COLORS.textPrimary,
                          }}>{resource.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <span style={{ fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600, color: barColor }}>
                            {resource.available}
                          </span>
                          <Mono tone="muted" size="xs">/ {resource.total} {resource.unit}</Mono>
                        </div>
                      </div>

                      {/* Utilization bar */}
                      <div style={{ position: 'relative', height: 5, background: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 3 }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${utilPct}%` }}
                          transition={{ duration: MOTION.base, ease: MOTION.ease }}
                          style={{
                            position: 'absolute', top: 0, left: 0, bottom: 0,
                            background: barColor,
                            borderRadius: RADIUS.full,
                          }}
                        />
                      </div>
                      <Mono tone="muted" size="xs">{resource.detail}</Mono>
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

  // ── Bottleneck Alerts ──────────────────────────────────────────────────
  const renderBottlenecks = () => {
    const isOpen = expandedSection === 'bottlenecks';
    const critCount = BOTTLENECK_ALERTS.filter(b => b.severity === 'crit').length;
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('bottlenecks')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <BracketLabel tone="warn" size="xs">BOTTLENECKS</BracketLabel>
            {critCount > 0 && (
              <span style={{
                padding: `1px ${SPACE.sm}px`, background: `${COLORS.crit}20`,
                border: `1px solid ${COLORS.crit}40`, borderRadius: RADIUS.sm,
                fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600,
                letterSpacing: '0.1em', color: COLORS.crit,
              }}>{critCount} CRITICAL</span>
            )}
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
                {BOTTLENECK_ALERTS.map(alert => {
                  const alertCol = alert.severity === 'crit' ? COLORS.crit : COLORS.warn;
                  const alertBgDim = alert.severity === 'crit' ? COLORS.critDim : COLORS.warnDim;
                  return (
                    <div key={alert.id} style={{
                      padding: SPACE.md,
                      background: alertBgDim,
                      border: `1px solid ${alertCol}30`,
                      borderRadius: RADIUS.sm,
                      borderLeft: `3px solid ${alertCol}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs }}>
                        <AlertTriangle size={13} color={alertCol} />
                        <span style={{
                          fontFamily: FONTS.sans, fontSize: TYPE.body.size,
                          fontWeight: 600, color: alertCol,
                        }}>{alert.title}</span>
                      </div>
                      <div style={{
                        fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size,
                        color: COLORS.textSecondary, marginBottom: SPACE.sm, lineHeight: 1.4,
                      }}>
                        {alert.detail}
                      </div>
                      <TacticalButton
                        variant={alert.severity === 'crit' ? 'danger' : 'secondary'}
                        size="sm"
                        icon={<Zap size={11} />}
                        onClick={() => showToast(`Action initiated: ${alert.action}`)}
                      >
                        {alert.action}
                      </TacticalButton>
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

  // ── Department Chat ────────────────────────────────────────────────────
  const renderChat = () => {
    const isOpen = expandedSection === 'chat';
    return (
      <div style={{ padding: `0 ${SPACE.base}px` }}>
        <button onClick={() => toggleSection('chat')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACE.md}px 0`, background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <BracketLabel tone="accent" size="xs">DEPT COMMS</BracketLabel>
            <Mono tone="muted" size="xs">{COORD_MESSAGES.length} RECENT</Mono>
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
                {COORD_MESSAGES.map(msg => (
                  <div key={msg.id} style={{
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    borderLeft: `3px solid ${msg.fromColor}`,
                  }}>
                    {/* Route + time */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.08em', color: msg.fromColor,
                        }}>{msg.from}</span>
                        <ArrowRight size={10} color={COLORS.textMuted} />
                        <span style={{
                          fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.08em', color: COLORS.textSecondary,
                        }}>{msg.to}</span>
                      </div>
                      <Mono tone="muted" size="xs">{msg.time}</Mono>
                    </div>
                    {/* Message body */}
                    <div style={{
                      fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size,
                      color: COLORS.textPrimary, lineHeight: 1.4,
                    }}>
                      {msg.message}
                    </div>
                  </div>
                ))}

                {/* Quick reply */}
                <TacticalButton
                  variant="ghost"
                  size="sm"
                  fullWidth
                  icon={<MessageSquare size={11} />}
                  onClick={() => showToast('Compose coordination message')}
                >
                  Send Coordination Message
                </TacticalButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Summary strip at the top ───────────────────────────────────────────
  const renderSummary = () => {
    const totalCensus = DEPARTMENTS.filter(d => d.type === 'clinical').reduce((s, d) => s + d.census, 0);
    const totalCapacity = DEPARTMENTS.filter(d => d.type === 'clinical').reduce((s, d) => s + d.capacity, 0);
    const strainedCount = DEPARTMENTS.filter(d => d.status === 'STRAINED').length;
    const criticalCount = DEPARTMENTS.filter(d => d.status === 'CRITICAL').length;

    return (
      <div style={{ padding: `${SPACE.base}px ${SPACE.base}px 0` }}>
        <TacticalCard padding="md">
          <ScanningLine duration={20} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.md, marginBottom: SPACE.sm }}>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 38, fontWeight: 600,
              letterSpacing: '-0.04em', lineHeight: 0.9, color: COLORS.textPrimary,
            }}>
              {totalCensus}
            </span>
            <Mono tone="muted" size="xs">/ {totalCapacity} BEDS</Mono>
            <div style={{ flex: 1 }} />
            <Mono tone="muted" size="xs">{Math.round((totalCensus / totalCapacity) * 100)}% OCCUPIED</Mono>
          </div>

          <Divider style={{ margin: `${SPACE.xs}px 0` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.lg, marginTop: SPACE.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
              <Activity size={12} color={COLORS.info} />
              <Mono tone="info" size="xs">{ACTIVE_TRANSFERS.length} TRANSFERS</Mono>
            </div>
            {strainedCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <div style={{ width: 5, height: 5, borderRadius: RADIUS.full, background: COLORS.warn, boxShadow: `0 0 4px ${COLORS.warn}` }} />
                <Mono tone="warn" size="xs">{strainedCount} STRAINED</Mono>
              </div>
            )}
            {criticalCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <div style={{ width: 5, height: 5, borderRadius: RADIUS.full, background: COLORS.crit, boxShadow: `0 0 4px ${COLORS.crit}` }} />
                <Mono tone="crit" size="xs">{criticalCount} CRITICAL</Mono>
              </div>
            )}
          </div>
        </TacticalCard>
      </div>
    );
  };

  // ── Inline body render ─────────────────────────────────────────────────
  // Just the sections stacked. Caller owns scroll / header / close.
  return (
    <>
      {renderSummary()}

      <Divider style={{ margin: `${SPACE.md}px ${SPACE.base}px` }} />

      {renderDeptNodes()}

      <Divider style={{ margin: `${SPACE.md}px ${SPACE.base}px` }} />

      {renderTransfers()}

      <Divider style={{ margin: `0 ${SPACE.base}px` }} />

      {renderResources()}

      <Divider style={{ margin: `0 ${SPACE.base}px` }} />

      {renderBottlenecks()}

      <Divider style={{ margin: `0 ${SPACE.base}px` }} />

      {renderChat()}
    </>
  );
};

DeptCoordinationBody.displayName = 'DeptCoordinationBody';

// ── Overlay component (fullscreen) ───────────────────────────────────────
// Used by the Horizon page's "COORD · Departments" quick action. Wraps
// DeptCoordinationBody in a fullscreen motion.div with a HudStrip header
// and a close button. Body content is identical.

export const DeptCoordination: React.FC<DeptCoordinationProps> = ({ open, onClose, showToast }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dept-coordination"
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
            <BracketLabel tone="accent" size="sm">Coordination</BracketLabel>
            <div style={{ flex: 1 }} />
            <ConfidenceBadge confidence={94} ageMinutes={0.5} />
          </HudStrip>

          {/* ── Scrollable body ───────────────────────────────────────── */}
          <div style={{
            flex: 1, overflow: 'auto',
            paddingTop: 56, paddingBottom: 'max(env(safe-area-inset-bottom), 32px)',
            WebkitOverflowScrolling: 'touch',
          }}>
            <DeptCoordinationBody showToast={showToast} />
            {/* Bottom spacer for safe area */}
            <div style={{ height: 40 }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

DeptCoordination.displayName = 'DeptCoordination';
