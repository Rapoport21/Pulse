import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Status, ZoneStatus, UserProfile, UserRole } from '../types';
import {
  Users,
  Activity,
  Thermometer,
  Clock,
  UserCheck,
  AlertTriangle,
  Layers,
  Search,
  X,
  Printer,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  Radio,
} from 'lucide-react';
import { PrintPreviewModal } from './PrintPreviewModal';
import { StaffManagementModal } from './StaffManagementModal';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  SHADOW,
  Mono,
  BracketLabel,
  StatusPill,
  SectionTitle,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  ScanningLine,
  Divider,
  type StatusTone,
} from './design';

interface LiveOpsProps {
  currentUser?: UserProfile | null;
  systemStatus?: 'normal' | 'stale' | 'manual';
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToActionBoard?: (filter: string) => void;
  loginCount?: number;
  isSurgeActive?: boolean;
}

interface ExtendedZoneStatus extends ZoneStatus {
  floor: number;
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  location: string;
  status: string;
  acuity: string;
  admittedAt: string;
}

const mockPatients: Patient[] = [
  { id: 'MRN-10293', name: 'John Doe', dob: '1980-05-12', location: 'Waiting Room', status: 'Waiting', acuity: 'Level 3', admittedAt: '14:30' },
  { id: 'MRN-84721', name: 'Jane Smith', dob: '1992-11-23', location: 'Acute Care Pods', status: 'In Treatment', acuity: 'Level 2', admittedAt: '12:15' },
  { id: 'MRN-55392', name: 'Robert Johnson', dob: '1955-02-08', location: 'Trauma Bay', status: 'Critical', acuity: 'Level 1', admittedAt: '16:45' },
  { id: 'MRN-99210', name: 'Emily Davis', dob: '2001-08-30', location: 'Triage / Intake', status: 'Triaging', acuity: 'Pending', admittedAt: '17:10' },
  { id: 'MRN-11029', name: 'Michael Wilson', dob: '1975-04-17', location: '3A: Gen Med', status: 'Admitted', acuity: 'Level 3', admittedAt: 'Yesterday' },
];

const mockZones: ExtendedZoneStatus[] = [
  // LEVEL 1: EMERGENCY
  { id: 'waiting', floor: 1, name: 'Waiting Room', occupancy: 95, capacity: 40, patients: 38, status: Status.CRITICAL, trend: 'Rising', staffing: '2 RN, 1 Security', waitTime: '2h 15m' },
  { id: 'triage', floor: 1, name: 'Triage / Intake', occupancy: 80, capacity: 10, patients: 8, status: Status.WARNING, trend: 'Stable', staffing: '3 RN', waitTime: '15m' },
  { id: 'acute', floor: 1, name: 'Acute Care Pods', occupancy: 100, capacity: 30, patients: 30, status: Status.CRITICAL, trend: 'Rising', staffing: '8 RN, 2 MD', waitTime: 'N/A' },
  { id: 'resus', floor: 1, name: 'Trauma Bay', occupancy: 25, capacity: 4, patients: 1, status: Status.NORMAL, trend: 'Stable', staffing: '4 RN, 2 MD', waitTime: '0m' },
  { id: 'imaging', floor: 1, name: 'Radiology (CT/XR)', occupancy: 60, capacity: 5, patients: 3, status: Status.NORMAL, trend: 'Stable', staffing: '2 Tech', waitTime: '45m' },
  { id: 'fasttrack', floor: 1, name: 'Fast Track', occupancy: 40, capacity: 15, patients: 6, status: Status.NORMAL, trend: 'Falling', staffing: '2 NP, 1 RN', waitTime: '30m' },

  // LEVEL 2: ICU & OR
  { id: 'icu_surg', floor: 2, name: 'SICU (Surgical)', occupancy: 90, capacity: 20, patients: 18, status: Status.WARNING, trend: 'Stable', staffing: '10 RN, 2 Intensivist', waitTime: 'N/A' },
  { id: 'icu_med', floor: 2, name: 'MICU (Medical)', occupancy: 60, capacity: 20, patients: 12, status: Status.NORMAL, trend: 'Stable', staffing: '6 RN, 1 Intensivist', waitTime: 'N/A' },
  { id: 'or_main', floor: 2, name: 'Operating Theatre', occupancy: 75, capacity: 8, patients: 6, status: Status.NORMAL, trend: 'Rising', staffing: 'Full Team', waitTime: 'Sch Only' },
  { id: 'pacu', floor: 2, name: 'PACU Recovery', occupancy: 85, capacity: 12, patients: 10, status: Status.WARNING, trend: 'Rising', staffing: '4 RN', waitTime: '20m Hold' },

  // LEVEL 3: MED/SURG
  { id: 'ward_3a', floor: 3, name: '3A: Gen Med', occupancy: 98, capacity: 40, patients: 39, status: Status.CRITICAL, trend: 'Rising', staffing: '6 RN, 2 CNA', waitTime: '4h Admit' },
  { id: 'ward_3b', floor: 3, name: '3B: Ortho/Neuro', occupancy: 70, capacity: 30, patients: 21, status: Status.NORMAL, trend: 'Stable', staffing: '5 RN', waitTime: 'N/A' },
  { id: 'telemetry', floor: 3, name: '3C: Telemetry', occupancy: 88, capacity: 25, patients: 22, status: Status.WARNING, trend: 'Stable', staffing: '4 RN', waitTime: '1h Hold' },
];

const floors = [
  { id: 1, name: 'L1: Emergency Dept', short: 'L1', code: 'EMRG' },
  { id: 2, name: 'L2: ICU / OR', short: 'L2', code: 'ICU/OR' },
  { id: 3, name: 'L3: Med / Surg', short: 'L3', code: 'M/S' },
];

// Map Status enum to tactical design tones
const statusToTone = (s: Status): StatusTone => {
  switch (s) {
    case Status.CRITICAL:
      return 'crit';
    case Status.WARNING:
      return 'warn';
    case Status.NORMAL:
      return 'ok';
    default:
      return 'neutral';
  }
};

const statusToColor = (s: Status): string => {
  switch (s) {
    case Status.CRITICAL:
      return COLORS.crit;
    case Status.WARNING:
      return COLORS.warn;
    case Status.NORMAL:
      return COLORS.ok;
    default:
      return COLORS.textSecondary;
  }
};

const patientStatusTone = (s: string): StatusTone => {
  switch (s) {
    case 'Critical':
      return 'crit';
    case 'Waiting':
    case 'Triaging':
      return 'warn';
    case 'In Treatment':
    case 'Admitted':
      return 'info';
    default:
      return 'neutral';
  }
};

export const LiveOps: React.FC<LiveOpsProps> = ({
  currentUser,
  systemStatus = 'normal',
  showToast,
  onNavigateToActionBoard,
  loginCount = 1,
  isSurgeActive = false,
}) => {
  const [selectedZone, setSelectedZone] = useState<ExtendedZoneStatus | null>(null);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);

  const searchResults = useMemo(() => {
    if (searchQuery.trim() === '') return [];
    const lowerQuery = searchQuery.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) || p.id.toLowerCase().includes(lowerQuery),
    );
  }, [searchQuery]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === UserRole.ER_PERSONNEL) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentFloor(1);
      } else if (currentUser.role === UserRole.NURSE) {
        setCurrentFloor(3);
      } else {
        setCurrentFloor(1);
      }
    }
  }, [currentUser]);

  const activeZones = useMemo<ExtendedZoneStatus[]>(() => {
    if (loginCount > 1 || isSurgeActive) {
      return mockZones.map((zone) => {
        const newOccupancy = Math.floor(zone.occupancy * 0.35);
        const newPatients = Math.floor(zone.patients * 0.35);
        return {
          ...zone,
          status: Status.NORMAL,
          occupancy: newOccupancy,
          patients: newPatients,
          trend: 'Stable' as const,
          waitTime:
            zone.waitTime === 'N/A' || zone.waitTime === 'Sch Only' ? zone.waitTime : '10m',
        };
      });
    }
    return mockZones;
  }, [loginCount, isSurgeActive]);

  const floorZones = useMemo(
    () => activeZones.filter((z) => z.floor === currentFloor),
    [currentFloor, activeZones],
  );

  // Auto-select first zone on floor change if none selected or selected is off-floor
  useEffect(() => {
    if (!selectedZone || selectedZone.floor !== currentFloor) {
      setSelectedZone(floorZones[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFloor, activeZones]);

  // KPI roll-up for the current floor
  const floorKpis = useMemo(() => {
    const totalCap = floorZones.reduce((a, z) => a + z.capacity, 0);
    const totalPax = floorZones.reduce((a, z) => a + z.patients, 0);
    const critical = floorZones.filter((z) => z.status === Status.CRITICAL).length;
    const warning = floorZones.filter((z) => z.status === Status.WARNING).length;
    const util = totalCap > 0 ? Math.round((totalPax / totalCap) * 100) : 0;
    const maxWait = floorZones
      .map((z) => z.waitTime)
      .find((w) => /h/.test(w)) || floorZones.map((z) => z.waitTime).find((w) => /m/.test(w)) || 'N/A';
    return { totalCap, totalPax, critical, warning, util, maxWait };
  }, [floorZones]);

  const handleZoneClick = (zone: ExtendedZoneStatus) => {
    setSelectedZone(zone);
  };

  const roleLabel = currentUser
    ? currentUser.role.replace('_', ' ').toUpperCase()
    : 'OPERATOR';

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
        fontFamily: FONTS.sans,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: SPACE.lg,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <SectionTitle
            id="OPS.LIVE"
            label="Live Operations"
            divider={false}
            style={{ marginBottom: SPACE.xs }}
            meta={
              <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center' }}>
                <StatusPill
                  label={
                    systemStatus === 'manual'
                      ? 'MANUAL OVERRIDE'
                      : systemStatus === 'stale'
                      ? 'TELEMETRY STALE'
                      : 'TELEMETRY LIVE'
                  }
                  tone={
                    systemStatus === 'manual'
                      ? 'warn'
                      : systemStatus === 'stale'
                      ? 'warn'
                      : 'ok'
                  }
                  pulse={systemStatus === 'normal'}
                />
                <BracketLabel tone="muted">VIEW · {roleLabel}</BracketLabel>
              </div>
            }
          />
          <Mono tone="muted" size="xs">
            // Real-time facility telemetry · digital twin
          </Mono>
        </div>

        {/* Patient search */}
        <PatientSearch
          value={searchQuery}
          onChange={setSearchQuery}
          results={searchResults}
          onSelect={(p) => {
            setSelectedPatient(p);
            setSearchQuery('');
          }}
        />
      </div>

      {/* MANUAL OVERRIDE BANNER */}
      <AnimatePresence>
        {systemStatus === 'manual' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: MOTION.fast }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.md,
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              background: `${COLORS.warn}12`,
              border: `1px solid ${COLORS.warn}`,
              borderRadius: RADIUS.sm,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <AlertTriangle size={17} strokeWidth={2} color={COLORS.warn} />
            <Mono tone="warn" size="sm">
              MANUAL OVERRIDE ACTIVE — TELEMETRY OFFLINE · FALLBACK PROTOCOLS ENGAGED
            </Mono>
            <CornerBracket position="tl" color={COLORS.warn} size={6} thickness={1} />
            <CornerBracket position="br" color={COLORS.warn} size={6} thickness={1} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI STRIP */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: SPACE.md,
        }}
      >
        <KpiCard
          label="Total Census"
          value={floorKpis.totalPax}
          unit="PAX"
          sub={`CAP ${floorKpis.totalCap}`}
          Icon={Users}
          tone="primary"
        />
        <KpiCard
          label="Utilization"
          value={`${floorKpis.util}%`}
          sub={
            floorKpis.util >= 90 ? 'OVER LIMIT' : floorKpis.util >= 75 ? 'HIGH LOAD' : 'NOMINAL'
          }
          Icon={Activity}
          tone={floorKpis.util >= 90 ? 'crit' : floorKpis.util >= 75 ? 'warn' : 'ok'}
        />
        <KpiCard
          label="Critical Zones"
          value={floorKpis.critical}
          sub={`WARN ${floorKpis.warning}`}
          Icon={AlertTriangle}
          tone={floorKpis.critical > 0 ? 'crit' : 'ok'}
          highlight={floorKpis.critical > 0}
        />
        <KpiCard
          label="Longest Wait"
          value={floorKpis.maxWait}
          sub={`FLOOR ${floors.find((f) => f.id === currentFloor)?.short}`}
          Icon={Clock}
          tone={/h/.test(floorKpis.maxWait) ? 'warn' : 'primary'}
        />
      </div>

      {/* FLOOR SELECTOR */}
      <FloorTabs
        floors={floors}
        current={currentFloor}
        onSelect={(id) => {
          setCurrentFloor(id);
          setSelectedZone(null);
        }}
      />

      {/* MAIN GRID */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.2fr) minmax(280px, 1fr)',
          gap: SPACE.lg,
          minHeight: 0,
        }}
      >
        {/* LEFT: Zone grid + bed map */}
        <TacticalCard
          padding="none"
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              borderBottom: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceElev,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
              <Radio size={14} strokeWidth={2} color={COLORS.textSecondary} />
              <Mono tone="primary" size="sm">
                ZONE GRID
              </Mono>
              <Mono tone="dim" size="xs">
                //
              </Mono>
              <Mono tone="muted" size="xs">
                {floors.find((f) => f.id === currentFloor)?.name}
              </Mono>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
              <Legend tone="ok" label="NOMINAL" />
              <Legend tone="warn" label="LOAD" />
              <Legend tone="crit" label="CRIT" />
            </div>
          </div>

          {/* Ambient scanline */}
          <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <ScanningLine duration={18} />
          </div>

          {/* Zone cards grid */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: SPACE.lg,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: SPACE.md,
              alignContent: 'start',
            }}
          >
            {floorZones.map((zone, idx) => (
              <ZoneCell
                key={zone.id}
                zone={zone}
                index={idx}
                active={selectedZone?.id === zone.id}
                onClick={() => handleZoneClick(zone)}
              />
            ))}
            {floorZones.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: SPACE['3xl'],
                  textAlign: 'center',
                }}
              >
                <Mono tone="muted" size="sm">
                  // No zones on this floor
                </Mono>
              </div>
            )}
          </div>
        </TacticalCard>

        {/* RIGHT: Telemetry panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
            minHeight: 0,
          }}
        >
          <TacticalCard
            padding="none"
            accentBar={!!selectedZone && selectedZone.status === Status.CRITICAL}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceElev,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <Activity size={13} strokeWidth={2} color={COLORS.textSecondary} />
                <Mono tone="primary" size="sm">
                  ZONE TELEMETRY
                </Mono>
              </div>
              {!selectedZone && <StatusPill label="IDLE" tone="neutral" />}
            </div>

            {/* Ambient scan when idle */}
            {!selectedZone && <ScanningLine duration={10} />}

            {selectedZone ? (
              <ZoneTelemetry
                zone={selectedZone}
                onTriggerActions={() => onNavigateToActionBoard?.(selectedZone.name)}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: SPACE.md,
                  padding: SPACE.lg,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  <Radio size={24} strokeWidth={1.5} color={COLORS.textMuted} />
                  <CornerBracket position="tl" color={COLORS.border} size={6} thickness={1} />
                  <CornerBracket position="tr" color={COLORS.border} size={6} thickness={1} />
                  <CornerBracket position="bl" color={COLORS.border} size={6} thickness={1} />
                  <CornerBracket position="br" color={COLORS.border} size={6} thickness={1} />
                </div>
                <Mono tone="muted" size="xs">
                  // Select sector for analysis
                </Mono>
              </div>
            )}
          </TacticalCard>

          {/* Actions card */}
          <TacticalCard padding="md" style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <Thermometer size={13} strokeWidth={2} color={COLORS.textMuted} />
                <Mono tone="muted" size="xs">
                  FLOOR ROLLUP · {floors.find((f) => f.id === currentFloor)?.short}
                </Mono>
              </div>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: TYPE.h3.size,
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.02em',
                }}
              >
                {floorKpis.totalPax}
                <Mono tone="muted" size="xs" style={{ marginLeft: 6 }}>
                  PAX
                </Mono>
              </span>
            </div>

            <Divider />

            <TacticalButton
              variant="secondary"
              fullWidth
              icon={<Users size={14} strokeWidth={2} />}
              onClick={() => setShowStaffModal(true)}
            >
              Manage Personnel
            </TacticalButton>

            {systemStatus === 'manual' && (
              <TacticalButton
                variant="danger"
                fullWidth
                icon={<Printer size={14} strokeWidth={2} />}
                onClick={() => setShowPrintModal(true)}
              >
                Print Action Plan
              </TacticalButton>
            )}
          </TacticalCard>
        </div>
      </div>

      {/* Modals */}
      <StaffManagementModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        zones={activeZones}
        onAssign={(assignments) => {
          if (showToast) showToast(`Successfully assigned ${assignments.length} personnel.`, 'success');
        }}
      />

      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={() => {
          if (showToast) showToast('Print job sent to all department printers.', 'success');
        }}
        title="Hospital-Wide Manual Action Plan"
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, borderBottom: '1px solid #ccc', paddingBottom: 8, margin: 0 }}>
              Floor Status Overview
            </h2>
            {floors.map((f) => {
              const fZones = activeZones.filter((z) => z.floor === f.id);
              if (fZones.length === 0) return null;
              return (
                <div key={f.id} style={{ marginBottom: 16 }}>
                  <h3
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      background: '#f3f4f6',
                      padding: 8,
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  >
                    {f.name}
                  </h3>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ccc' }}>
                        <th style={{ padding: 8 }}>Zone</th>
                        <th style={{ padding: 8 }}>Status</th>
                        <th style={{ padding: 8 }}>Occupancy</th>
                        <th style={{ padding: 8 }}>Patients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fZones.map((z) => (
                        <tr key={z.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: 8, fontWeight: 500 }}>{z.name}</td>
                          <td style={{ padding: 8 }}>{z.status}</td>
                          <td style={{ padding: 8 }}>{z.occupancy}%</td>
                          <td style={{ padding: 8 }}>
                            {z.patients} / {z.capacity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        }
      />

      {/* Patient Modal */}
      <AnimatePresence>
        {selectedPatient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: SPACE.lg,
            }}
            onClick={() => setSelectedPatient(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: MOTION.base, ease: MOTION.ease }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 440 }}
            >
              <TacticalCard padding="none">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: `${SPACE.md}px ${SPACE.lg}px`,
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: COLORS.surfaceElev,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                    <UserCheck size={14} strokeWidth={2} color={COLORS.textSecondary} />
                    <Mono tone="primary" size="sm">
                      PATIENT RECORD
                    </Mono>
                  </div>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: COLORS.textMuted,
                      cursor: 'pointer',
                      display: 'flex',
                    }}
                    aria-label="Close"
                  >
                    <X size={17} strokeWidth={2} />
                  </button>
                </div>

                <div style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: SPACE.md,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.h2.size,
                          fontWeight: TYPE.h2.weight,
                          letterSpacing: TYPE.h2.tracking,
                          lineHeight: 1.15,
                          color: COLORS.textPrimary,
                        }}
                      >
                        {selectedPatient.name}
                      </div>
                      <div style={{ marginTop: SPACE.xs }}>
                        <Mono tone="muted" size="xs">
                          {selectedPatient.id}
                        </Mono>
                      </div>
                    </div>
                    <StatusPill
                      label={selectedPatient.status.toUpperCase()}
                      tone={patientStatusTone(selectedPatient.status)}
                    />
                  </div>

                  <Divider />

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: SPACE.md,
                    }}
                  >
                    <PatientField label="DOB" value={selectedPatient.dob} />
                    <PatientField label="Acuity" value={selectedPatient.acuity} />
                    <PatientField label="Location" value={selectedPatient.location} />
                    <PatientField label="Admitted" value={selectedPatient.admittedAt} />
                  </div>
                </div>

                <div
                  style={{
                    padding: `${SPACE.md}px ${SPACE.lg}px`,
                    borderTop: `1px solid ${COLORS.border}`,
                    background: COLORS.surfaceElev,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: SPACE.sm,
                  }}
                >
                  <TacticalButton variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
                    Close
                  </TacticalButton>
                </div>
              </TacticalCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  unit?: string;
  tone: 'primary' | 'ok' | 'warn' | 'crit';
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  highlight?: boolean;
}> = ({ label, value, sub, unit, tone, Icon, highlight }) => {
  const toneColor =
    tone === 'ok'
      ? COLORS.ok
      : tone === 'warn'
      ? COLORS.warn
      : tone === 'crit'
      ? COLORS.crit
      : COLORS.textPrimary;

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
        minHeight: 92,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <Mono tone={highlight ? 'accent' : 'muted'} size="xs">
          {label}
        </Mono>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 31,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 0.95,
              color: toneColor,
            }}
          >
            {value}
          </span>
          {unit && (
            <Mono tone="muted" size="xs">
              {unit}
            </Mono>
          )}
        </div>
        {sub && (
          <Mono tone={tone === 'primary' ? 'dim' : tone === 'crit' ? 'crit' : tone === 'warn' ? 'warn' : 'muted'} size="xs">
            {sub}
          </Mono>
        )}
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
// Floor Tabs
// ─────────────────────────────────────────────────────────────────────────
const FloorTabs: React.FC<{
  floors: typeof floors;
  current: number;
  onSelect: (id: number) => void;
}> = ({ floors, current, onSelect }) => (
  <div
    style={{
      display: 'flex',
      gap: 0,
      borderBottom: `1px solid ${COLORS.border}`,
    }}
  >
    {floors.map((f) => {
      const active = current === f.id;
      return (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${active ? COLORS.borderHover : 'transparent'}`,
            cursor: 'pointer',
            marginBottom: -1,
            transition: `border-color ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
          }}
        >
          <Layers
            size={14}
            strokeWidth={2}
            color={active ? COLORS.textPrimary : COLORS.textMuted}
          />
          <Mono tone={active ? 'primary' : 'muted'} size="sm">
            {f.short}
          </Mono>
          <Mono tone={active ? 'secondary' : 'dim'} size="xs">
            {f.code}
          </Mono>
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Zone Cell — tactical bed grid card
// ─────────────────────────────────────────────────────────────────────────
const ZoneCell: React.FC<{
  zone: ExtendedZoneStatus;
  index: number;
  active: boolean;
  onClick: () => void;
}> = ({ zone, index, active, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const color = statusToColor(zone.status);
  const tone = statusToTone(zone.status);
  const borderColor = active ? COLORS.borderHover : hovered ? COLORS.borderHover : COLORS.border;
  const bg = active ? COLORS.surfaceElev : hovered ? COLORS.surfaceHover : COLORS.surface;

  // Bed map: filled cells = patients, empty = available
  const beds = Math.min(zone.capacity, 24);
  const filled = Math.round((zone.patients / zone.capacity) * beds);

  const TrendIcon =
    zone.trend === 'Rising' ? TrendingUp : zone.trend === 'Falling' ? TrendingDown : Minus;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: MOTION.base, ease: MOTION.ease }}
      style={{
        position: 'relative',
        padding: SPACE.md,
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
        outline: 'none',
        // NOTE: no overflow:hidden — it forces min-height:auto → 0 when the
        // cell is a CSS grid item, collapsing the row to ~28px. Corner
        // brackets and the active rail are anchored to the cell's box and
        // do not overflow, so clipping isn't needed.
      }}
    >
      {/* Accent left rail for active — neutral selection */}
      {active && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: COLORS.borderHover,
          }}
        />
      )}

      {/* Corner brackets on hover or active */}
      {(hovered || active) && (
        <>
          <CornerBracket position="tl" color={active ? COLORS.borderHover : color} size={8} thickness={1.5} />
          <CornerBracket position="br" color={active ? COLORS.borderHover : color} size={8} thickness={1.5} />
        </>
      )}

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACE.sm,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <Mono tone="dim" size="xs">
            {zone.id.toUpperCase()}
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: TYPE.h4.size,
              fontWeight: TYPE.h4.weight,
              letterSpacing: TYPE.h4.tracking,
              color: COLORS.textPrimary,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {zone.name}
          </div>
        </div>
        <StatusPill label={zone.status.toUpperCase()} tone={tone} />
      </div>

      {/* Bed grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 3,
        }}
      >
        {Array.from({ length: beds }).map((_, i) => {
          const isFilled = i < filled;
          return (
            <span
              key={i}
              style={{
                aspectRatio: '1 / 1',
                background: isFilled ? color : 'transparent',
                border: `1px solid ${isFilled ? color : COLORS.borderStrong}`,
                borderRadius: 1,
                boxShadow: isFilled && zone.status === Status.CRITICAL ? `0 0 4px ${color}` : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Metrics row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '0.04em',
            }}
          >
            {zone.patients}
          </span>
          <Mono tone="dim" size="xs">
            /
          </Mono>
          <Mono tone="muted" size="xs">
            {zone.capacity}
          </Mono>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <TrendIcon
            size={12}
            strokeWidth={2}
            color={
              zone.trend === 'Rising'
                ? color
                : zone.trend === 'Falling'
                ? COLORS.ok
                : COLORS.textMuted
            }
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 600,
              color,
              letterSpacing: '0.04em',
            }}
          >
            {zone.occupancy}%
          </span>
        </div>
      </div>

      {/* Occupancy bar */}
      <div
        style={{
          height: 2,
          background: COLORS.borderStrong,
          borderRadius: RADIUS.full,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(zone.occupancy, 100)}%` }}
          transition={{ duration: MOTION.slow, ease: MOTION.ease, delay: index * 0.04 }}
          style={{
            height: '100%',
            background: color,
            boxShadow: zone.status === Status.CRITICAL ? `0 0 6px ${color}` : undefined,
          }}
        />
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Zone Telemetry Panel
// ─────────────────────────────────────────────────────────────────────────
const ZoneTelemetry: React.FC<{
  zone: ExtendedZoneStatus;
  onTriggerActions: () => void;
}> = ({ zone, onTriggerActions }) => {
  const color = statusToColor(zone.status);
  const tone = statusToTone(zone.status);
  const TrendIcon =
    zone.trend === 'Rising' ? TrendingUp : zone.trend === 'Falling' ? TrendingDown : Minus;

  return (
    <motion.div
      key={zone.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE.lg,
        gap: SPACE.lg,
        minHeight: 0,
        overflowY: 'auto',
      }}
    >
      {/* Zone header */}
      <div>
        <Mono tone="dim" size="xs">
          ZONE · {zone.id.toUpperCase()}
        </Mono>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: TYPE.h3.size,
            fontWeight: TYPE.h3.weight,
            letterSpacing: TYPE.h3.tracking,
            color: COLORS.textPrimary,
            marginTop: SPACE.xs,
            lineHeight: 1.15,
          }}
        >
          {zone.name}
        </div>
        <div style={{ marginTop: SPACE.sm }}>
          <StatusPill label={zone.status.toUpperCase()} tone={tone} pulse={zone.status === Status.CRITICAL} />
        </div>
      </div>

      <Divider />

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: SPACE.md,
        }}
      >
        <TelemetryStat label="Census" value={`${zone.patients}`} sub={`/ ${zone.capacity}`} Icon={Users} />
        <TelemetryStat label="Wait" value={zone.waitTime} Icon={Clock} />
      </div>

      {/* Load factor */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: SPACE.sm,
          }}
        >
          <Mono tone="muted" size="xs">
            LOAD FACTOR
          </Mono>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendIcon size={13} strokeWidth={2} color={color} />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 14,
                fontWeight: 600,
                color,
                letterSpacing: '0.04em',
              }}
            >
              {zone.occupancy}%
            </span>
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            height: 6,
            background: COLORS.surfaceElev,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(zone.occupancy, 100)}%` }}
            transition={{ duration: MOTION.slow, ease: MOTION.ease }}
            style={{
              height: '100%',
              background: color,
              boxShadow: zone.status === Status.CRITICAL ? `0 0 10px ${color}` : undefined,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <Mono tone="dim" size="xs">
            0
          </Mono>
          <Mono tone="dim" size="xs">
            TREND · {zone.trend.toUpperCase()}
          </Mono>
          <Mono tone="dim" size="xs">
            100
          </Mono>
        </div>
      </div>

      {/* Staffing */}
      <div>
        <Mono tone="muted" size="xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <UserCheck size={11} strokeWidth={2} color={COLORS.textMuted} />
          ACTIVE PERSONNEL
        </Mono>
        <div
          style={{
            marginTop: SPACE.sm,
            padding: SPACE.md,
            background: COLORS.surfaceElev,
            border: `1px solid ${COLORS.border}`,
            borderLeft: `2px solid ${COLORS.borderHover}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 13,
            color: COLORS.textPrimary,
            letterSpacing: '0.02em',
          }}
        >
          {zone.staffing}
        </div>
      </div>

      {/* Critical alert */}
      {zone.status === Status.CRITICAL && (
        <motion.button
          type="button"
          onClick={onTriggerActions}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: SPACE.md,
            padding: SPACE.md,
            background: `${COLORS.crit}10`,
            border: `1px solid ${COLORS.crit}`,
            borderRadius: RADIUS.sm,
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
            fontFamily: 'inherit',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <AlertTriangle size={17} strokeWidth={2} color={COLORS.crit} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Mono tone="crit" size="sm">
              THRESHOLD EXCEEDED
            </Mono>
            <p
              style={{
                fontFamily: FONTS.sans,
                fontSize: 12,
                color: COLORS.textSecondary,
                lineHeight: 1.5,
                margin: `${SPACE.xs}px 0 0 0`,
              }}
            >
              Load exceeds safety limits. Trigger capacity protocol.
            </p>
          </div>
          <ArrowUpRight size={15} strokeWidth={2} color={COLORS.crit} style={{ flexShrink: 0 }} />
          <CornerBracket position="tl" color={COLORS.crit} size={6} thickness={1} />
          <CornerBracket position="br" color={COLORS.crit} size={6} thickness={1} />
        </motion.button>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Telemetry Stat — small metric block
// ─────────────────────────────────────────────────────────────────────────
const TelemetryStat: React.FC<{
  label: string;
  value: string;
  sub?: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}> = ({ label, value, sub, Icon }) => (
  <div
    style={{
      padding: SPACE.md,
      background: COLORS.surfaceElev,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
  >
    <Mono tone="muted" size="xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon size={11} strokeWidth={2} color={COLORS.textMuted} />
      {label}
    </Mono>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 20,
          fontWeight: 600,
          color: COLORS.textPrimary,
          letterSpacing: '0.02em',
        }}
      >
        {value}
      </span>
      {sub && (
        <Mono tone="dim" size="xs">
          {sub}
        </Mono>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Patient Field (modal)
// ─────────────────────────────────────────────────────────────────────────
const PatientField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <Mono tone="muted" size="xs">
      {label}
    </Mono>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: 14,
        color: COLORS.textPrimary,
        letterSpacing: '-0.003em',
      }}
    >
      {value}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Patient Search — header search with dropdown
// ─────────────────────────────────────────────────────────────────────────
const PatientSearch: React.FC<{
  value: string;
  onChange: (v: string) => void;
  results: Patient[];
  onSelect: (p: Patient) => void;
}> = ({ value, onChange, results, onSelect }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', width: 300 }}>
      <div
        style={{
          position: 'relative',
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
        <Search size={14} strokeWidth={2} color={focused ? COLORS.accent : COLORS.textMuted} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search patient by name or MRN…"
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
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.textMuted,
              cursor: 'pointer',
              display: 'flex',
              padding: 0,
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {focused && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              boxShadow: SHADOW.panel,
              zIndex: 40,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceElev,
              }}
            >
              <Mono tone="muted" size="xs">
                // {results.length} MATCH{results.length === 1 ? '' : 'ES'}
              </Mono>
            </div>
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${COLORS.border}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: `background ${MOTION.fast}s ease`,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: COLORS.textPrimary,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 2,
                    gap: SPACE.sm,
                  }}
                >
                  <Mono tone="muted" size="xs">
                    {p.id}
                  </Mono>
                  <Mono tone="dim" size="xs">
                    {p.location}
                  </Mono>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Legend — compact status key
// ─────────────────────────────────────────────────────────────────────────
const Legend: React.FC<{ tone: StatusTone; label: string }> = ({ tone, label }) => {
  const color =
    tone === 'ok'
      ? COLORS.ok
      : tone === 'warn'
      ? COLORS.warn
      : tone === 'crit'
      ? COLORS.crit
      : tone === 'info'
      ? COLORS.info
      : COLORS.textSecondary;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: RADIUS.full,
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <Mono tone="dim" size="xs">
        {label}
      </Mono>
    </div>
  );
};
