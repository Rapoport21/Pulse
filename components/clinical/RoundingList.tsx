/**
 * RoundingList — the physician rounding view that shows all assigned
 * patients in priority order with key clinical data at a glance.
 *
 * Think of this as the digital version of the paper "rounding sheet" —
 * the list a doctor carries while walking the floor. Patients are
 * sorted by acuity (MEWS score), with critical patients at the top.
 *
 * Each patient row shows:
 *   - Name, bed, chief complaint
 *   - MEWS score badge with color-coded severity
 *   - Last vitals snapshot (HR, BP, SpO2, Temp)
 *   - Key lab flags (critical values highlighted)
 *   - Tasks/to-do count
 *   - Expand for quick SBAR summary + action buttons
 *
 * Props:
 *   open       — controls overlay visibility
 *   onClose    — dismiss the overlay
 *   showToast  — fire a toast notification to the parent shell
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Activity,
  Thermometer,
  Heart,
  Droplets,
  Wind,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  StickyNote,
  FileText,
  X,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  SHADOW,
  Mono,
  BracketLabel,
  StatusPill,
  CornerBracket,
  TacticalCard,
  TacticalButton,
  HudStrip,
  ScanningLine,
  Divider,
  ConfidenceBadge,
} from '../design';
import { MOCK_PATIENTS, ageInYears } from '../../data/clinicalMock';
import { MOCK_LABS } from '../../data/ehrMock';
import { computeMEWS } from '../../lib/clinicalScores';
import type { Patient, Vital, LabResult } from '../../types';
import { UserRole } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface RoundingListProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** Current user role — drives default filter, sort, and header label. */
  role?: UserRole;
  /** External patient list — when provided, replaces MOCK_PATIENTS so
   *  newly admitted patients (from realtime sync) appear in the list. */
  patients?: Patient[];
  /** Synced clinical notes — shown in expanded patient detail */
  clinicalNotes?: import('../../types').ClinicalNote[];
  /** Cross-device vitals update — pushes new vitals to all devices */
  onUpdateVitals?: (patientId: string, vitals: Omit<import('../../types').Vital, 'id' | 'timestamp'>) => void;
  /** Cross-device note creation — syncs note to all devices */
  onAddNote?: (note: Omit<import('../../types').ClinicalNote, 'id' | 'createdAt'>) => void;
  /** Cross-device discharge — frees bed and updates status everywhere */
  onDischargePatient?: (patientId: string) => void;
}

type SortMode = 'acuity' | 'bed' | 'name';
type FilterMode = 'all' | 'critical' | 'warning' | 'stable';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const latestVitals = (p: Patient): Vital | null =>
  p.vitalsHistory.length > 0 ? p.vitalsHistory[p.vitalsHistory.length - 1] : null;

const mewsColor = (score: number): string =>
  score >= 5 ? COLORS.crit : score >= 3 ? COLORS.warn : COLORS.ok;

const mewsLabel = (score: number): string =>
  score >= 5 ? 'CRITICAL' : score >= 3 ? 'ELEVATED' : 'LOW';

const flaggedLabs = (patientId: string): LabResult[] => {
  const labs = MOCK_LABS[patientId] ?? [];
  return labs.filter(
    (l) => l.flag === 'HH' || l.flag === 'LL' || l.flag === 'H' || l.flag === 'L',
  );
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
};

// Mock rounding tasks per patient
const MOCK_TASKS: Record<string, { total: number; done: number; items: string[] }> = {
  P001: {
    total: 5,
    done: 2,
    items: [
      'Repeat H/H in 2h',
      'Reassess GCS q1h',
      'Order MRI if neuro exam changes',
      '✓ Blood products started',
      '✓ Trauma surgery consult placed',
    ],
  },
  P002: {
    total: 4,
    done: 1,
    items: [
      'Repeat troponin at 6h mark',
      'Cardiology consult follow-up',
      'Start heparin drip if troponin rising',
      '✓ 12-lead ECG completed',
    ],
  },
  P003: {
    total: 2,
    done: 2,
    items: ['✓ Wound check — sutures intact', '✓ Tetanus updated'],
  },
  P004: {
    total: 3,
    done: 1,
    items: [
      'Advance diet as tolerated',
      'PT consult for ambulation',
      '✓ Foley removed',
    ],
  },
  P005: {
    total: 5,
    done: 1,
    items: [
      'Repeat lactate in 4h',
      'Blood culture f/u at 48h',
      'Reassess fluid status',
      'Adjust antibiotics per sensitivity',
      '✓ Initial fluid bolus completed',
    ],
  },
};

// Mock SBAR summaries
const MOCK_SBAR: Record<string, { s: string; b: string; a: string; r: string }> = {
  P001: {
    s: '45M MVC restrained driver, GCS 13, hemorrhagic shock. HR trending up, BP trending down.',
    b: 'Arrived via EMS 2h ago. Massive transfusion protocol initiated. Hgb 8.2, Lactate 4.8.',
    a: 'MEWS 7 — deteriorating. Likely intra-abdominal hemorrhage. Awaiting trauma surgery eval.',
    r: 'Repeat H/H in 2h. May need emergent OR if Hgb drops below 7. Keep MTP active.',
  },
  P002: {
    s: '62F chest pain, troponin 3.1 (rising), BNP 890. Hemodynamically stable but diaphoretic.',
    b: 'HTN, DM2, HLD. On ASA, Plavix, Metoprolol. Serial trops Q6h. ECG: ST depression V3-V5.',
    a: 'NSTEMI with mild CHF. MEWS 2 — currently stable but needs cath lab within 24h.',
    r: 'Start heparin drip. Cards consult for cath. Hold Metoprolol if SBP < 100.',
  },
  P003: {
    s: '28M lac repair right forearm, 6 sutures. Ambulating, vitals normal, pain controlled.',
    b: 'No significant PMH. Tetanus updated. Wound clean, no signs of infection.',
    a: 'MEWS 0 — stable. Ready for discharge pending wound check.',
    r: 'D/C with wound care instructions. Follow up in 7-10 days for suture removal.',
  },
  P004: {
    s: '34F post-op day 1 (laparoscopic appendectomy). Tolerating clears, ambulating.',
    b: 'Uncomplicated appendicitis. Uneventful OR. On PCA for pain management.',
    a: 'MEWS 1 — recovering well. Afebrile post-op, good UOP, no signs of complications.',
    r: 'Advance to regular diet. DC PCA → PO pain meds. Target discharge tomorrow AM.',
  },
  P005: {
    s: '71M sepsis from UTI source. Febrile to 39.1, HR 108, MAP borderline at 65.',
    b: 'DM2, CKD stage 3, BPH. Lactate 3.6, WBC 18.4, Procal 8.2. On Vanc + Pip-Tazo.',
    a: 'MEWS 5 — high risk. qSOFA 2. May progress to septic shock. Creatinine rising.',
    r: 'Repeat lactate in 4h. If MAP < 65, start vasopressors. Consider ICU upgrade.',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const RoundingList: React.FC<RoundingListProps> = ({ open, onClose, showToast, role, patients: externalPatients, clinicalNotes, onUpdateVitals, onAddNote, onDischargePatient }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Role-aware defaults:
  //  - Nurse: default sort by bed (geographic proximity), filter to critical
  //  - ER: default sort by acuity, filter to critical (ED triage priority)
  //  - Manager: default sort by bed (unit overview), show all patients
  const defaultSort: SortMode = role === UserRole.NURSE ? 'bed' : 'acuity';
  const defaultFilter: FilterMode =
    role === UserRole.NURSE ? 'critical'
    : role === UserRole.ER_PERSONNEL ? 'critical'
    : 'all';

  const [sortMode, setSortMode] = useState<SortMode>(defaultSort);
  const [filterMode, setFilterMode] = useState<FilterMode>(defaultFilter);

  // Role-aware header subtitle
  const headerSubtitle =
    role === UserRole.NURSE ? 'My Patients'
    : role === UserRole.ER_PERSONNEL ? 'ED Patients'
    : role === UserRole.MANAGER ? 'All Units'
    : 'Rounding List';

  const patientSource = externalPatients ?? MOCK_PATIENTS;
  const patients = useMemo(() => {
    let list = [...patientSource];

    // Role-based pre-filter: ER sees only EMERGENCY encounters
    if (role === UserRole.ER_PERSONNEL) {
      list = list.filter(
        (p) => p.currentEncounter?.class === 'EMERGENCY',
      );
    }

    // Filter
    if (filterMode !== 'all') {
      list = list.filter((p) => {
        const v = latestVitals(p);
        if (!v) return filterMode === 'stable';
        const score = computeMEWS(v).value;
        if (filterMode === 'critical') return score >= 5;
        if (filterMode === 'warning') return score >= 3 && score < 5;
        return score < 3;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortMode === 'acuity') {
        const sa = latestVitals(a) ? computeMEWS(latestVitals(a)!).value : 0;
        const sb = latestVitals(b) ? computeMEWS(latestVitals(b)!).value : 0;
        return sb - sa; // highest acuity first
      }
      if (sortMode === 'bed') {
        const ba = a.currentEncounter?.location.bed ?? '';
        const bb = b.currentEncounter?.location.bed ?? '';
        return ba.localeCompare(bb);
      }
      return a.name.family.localeCompare(b.name.family);
    });

    return list;
  }, [sortMode, filterMode, role, patientSource]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="rounding-list"
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
          {/* ── Header ─────────────────────────────────────────────── */}
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
              <X size={15} />
            </button>
            <BracketLabel tone="accent" size="sm">{headerSubtitle}</BracketLabel>
            <div style={{ flex: 1 }} />
            <ConfidenceBadge confidence={94} ageMinutes={1} compact />
            <Mono tone="muted" size="xs">
              {patients.length} PT{patients.length !== 1 ? 'S' : ''}
            </Mono>
          </HudStrip>

          {/* ── Body ───────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              paddingTop: 56,
              paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Controls row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                overflowX: 'auto',
              }}
            >
              {/* Sort pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowUpDown size={12} color={COLORS.textMuted} />
                {(['acuity', 'bed', 'name'] as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    style={{
                      padding: `3px 8px`,
                      background: sortMode === mode ? `${COLORS.accent}18` : 'transparent',
                      border: `1px solid ${sortMode === mode ? COLORS.accent : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: sortMode === mode ? COLORS.accent : COLORS.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div
                style={{
                  width: 1,
                  height: 16,
                  background: COLORS.border,
                  flexShrink: 0,
                }}
              />

              {/* Filter pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Filter size={12} color={COLORS.textMuted} />
                {(['all', 'critical', 'warning', 'stable'] as FilterMode[]).map((mode) => {
                  const toneColor =
                    mode === 'critical'
                      ? COLORS.crit
                      : mode === 'warning'
                      ? COLORS.warn
                      : mode === 'stable'
                      ? COLORS.ok
                      : COLORS.textSecondary;
                  return (
                    <button
                      key={mode}
                      onClick={() => setFilterMode(mode)}
                      style={{
                        padding: `3px 8px`,
                        background:
                          filterMode === mode ? `${toneColor}18` : 'transparent',
                        border: `1px solid ${filterMode === mode ? toneColor : COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        fontFamily: FONTS.mono,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: filterMode === mode ? toneColor : COLORS.textMuted,
                        cursor: 'pointer',
                      }}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Patient rows */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.sm,
                padding: `0 ${SPACE.base}px ${SPACE.base}px`,
              }}
            >
              {patients.map((patient, idx) => {
                const v = latestVitals(patient);
                const mews = v ? computeMEWS(v) : null;
                const score = mews?.value ?? 0;
                const color = mewsColor(score);
                const isExpanded = expandedId === patient.id;
                const flagged = flaggedLabs(patient.id);
                const tasks = MOCK_TASKS[patient.id];
                const sbar = MOCK_SBAR[patient.id];
                const enc = patient.currentEncounter;

                return (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: MOTION.base, ease: MOTION.ease }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        background: COLORS.surface,
                        border: `1px solid ${score >= 5 ? `${COLORS.crit}40` : COLORS.border}`,
                        borderLeft: `3px solid ${color}`,
                        borderRadius: RADIUS.sm,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Main row — always visible */}
                      <button
                        onClick={() => toggleExpand(patient.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          gap: SPACE.md,
                          padding: `${SPACE.md}px ${SPACE.md}px`,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: COLORS.textPrimary,
                          outline: 'none',
                        }}
                      >
                        {/* MEWS badge */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: RADIUS.sm,
                            background: `${color}18`,
                            border: `1.5px solid ${color}`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: FONTS.mono,
                              fontSize: 17,
                              fontWeight: 700,
                              color,
                              lineHeight: 1,
                            }}
                          >
                            {score}
                          </span>
                          <span
                            style={{
                              fontFamily: FONTS.mono,
                              fontSize: 8,
                              fontWeight: 600,
                              color,
                              letterSpacing: '0.05em',
                              lineHeight: 1,
                              marginTop: 1,
                            }}
                          >
                            MEWS
                          </span>
                        </div>

                        {/* Patient info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                            <span
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: TYPE.body.size,
                                fontWeight: 600,
                                color: COLORS.textPrimary,
                              }}
                            >
                              {patient.name.family}, {patient.name.given}
                            </span>
                            <Mono tone="muted" size="xs">
                              {ageInYears(patient.birthDate)}{patient.sex}
                            </Mono>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: SPACE.sm,
                              marginTop: 2,
                            }}
                          >
                            <Mono tone="secondary" size="xs">
                              {enc?.location.bed ?? '—'}
                            </Mono>
                            <span
                              style={{
                                width: 3,
                                height: 3,
                                borderRadius: '50%',
                                background: COLORS.textMuted,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: TYPE.bodySm.size,
                                color: COLORS.textMuted,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {enc?.chiefComplaint ?? '—'}
                            </span>
                          </div>
                        </div>

                        {/* Quick vitals */}
                        {v && (
                          <div
                            style={{
                              display: 'flex',
                              gap: SPACE.sm,
                              alignItems: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <VitalChip icon={<Heart size={11} />} value={`${v.heartRate}`} alert={v.heartRate > 110 || v.heartRate < 50} />
                            <VitalChip icon={<Activity size={11} />} value={`${v.systolic}/${v.diastolic}`} alert={v.systolic < 90} />
                            <VitalChip icon={<Droplets size={11} />} value={`${v.spO2}%`} alert={v.spO2 < 94} />
                          </div>
                        )}

                        {/* Task badge */}
                        {tasks && tasks.total > tasks.done && (
                          <div
                            style={{
                              padding: '2px 6px',
                              background: `${COLORS.warn}18`,
                              border: `1px solid ${COLORS.warn}40`,
                              borderRadius: RADIUS.sm,
                              flexShrink: 0,
                            }}
                          >
                            <Mono tone="warn" size="xs">
                              {tasks.total - tasks.done}
                            </Mono>
                          </div>
                        )}

                        {/* Expand chevron */}
                        {isExpanded ? (
                          <ChevronUp size={15} color={COLORS.textMuted} />
                        ) : (
                          <ChevronDown size={15} color={COLORS.textMuted} />
                        )}
                      </button>

                      {/* ── Expanded detail panel ──────────────────────── */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            key={`expand-${patient.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: MOTION.base, ease: MOTION.ease }}
                            style={{ overflow: 'hidden' }}
                          >
                            <Divider />
                            <div
                              style={{
                                padding: `${SPACE.md}px ${SPACE.md}px ${SPACE.base}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: SPACE.md,
                              }}
                            >
                              {/* Vitals row */}
                              {v && (
                                <div>
                                  <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>
                                    Latest Vitals · {timeAgo(v.timestamp)}
                                  </Mono>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                                      gap: SPACE.xs,
                                    }}
                                  >
                                    <VitalTile label="HR" value={`${v.heartRate}`} unit="bpm" alert={v.heartRate > 110} />
                                    <VitalTile label="BP" value={`${v.systolic}/${v.diastolic}`} unit="mmHg" alert={v.systolic < 90} />
                                    <VitalTile label="SpO2" value={`${v.spO2}`} unit="%" alert={v.spO2 < 94} />
                                    <VitalTile label="RR" value={`${v.respRate}`} unit="/min" alert={v.respRate > 24} />
                                    <VitalTile label="Temp" value={v.temperature.toFixed(1)} unit="°C" alert={v.temperature > 38.5} />
                                    <VitalTile label="GCS" value={`${v.gcs}`} unit="/15" alert={v.gcs < 14} />
                                  </div>
                                </div>
                              )}

                              {/* Flagged labs */}
                              {flagged.length > 0 && (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xs }}>
                                    <FlaskConical size={12} color={COLORS.crit} />
                                    <Mono tone="crit" size="xs">Flagged Labs</Mono>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {flagged.map((lab) => (
                                      <span
                                        key={lab.id}
                                        style={{
                                          padding: '2px 8px',
                                          background: (lab.flag === 'HH' || lab.flag === 'LL') ? `${COLORS.crit}12` : `${COLORS.warn}12`,
                                          border: `1px solid ${(lab.flag === 'HH' || lab.flag === 'LL') ? COLORS.crit : COLORS.warn}30`,
                                          borderRadius: RADIUS.sm,
                                          fontFamily: FONTS.mono,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: (lab.flag === 'HH' || lab.flag === 'LL') ? COLORS.crit : COLORS.warn,
                                        }}
                                      >
                                        {lab.name}: {typeof lab.value === 'number' ? lab.value : lab.value} {lab.unit} {lab.flag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* SBAR summary */}
                              {sbar && (
                                <div>
                                  <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.xs, display: 'block' }}>
                                    Quick SBAR
                                  </Mono>
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4,
                                      padding: SPACE.sm,
                                      background: COLORS.surfaceElev ?? `${COLORS.surface}`,
                                      border: `1px solid ${COLORS.border}`,
                                      borderRadius: RADIUS.sm,
                                    }}
                                  >
                                    <SbarLine letter="S" color={COLORS.info} text={sbar.s} />
                                    <SbarLine letter="B" color={COLORS.textSecondary} text={sbar.b} />
                                    <SbarLine letter="A" color={COLORS.warn} text={sbar.a} />
                                    <SbarLine letter="R" color={COLORS.ok} text={sbar.r} />
                                  </div>
                                </div>
                              )}

                              {/* Tasks */}
                              {tasks && (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xs }}>
                                    <CheckCircle2 size={12} color={COLORS.textMuted} />
                                    <Mono tone="muted" size="xs">
                                      Tasks · {tasks.done}/{tasks.total} complete
                                    </Mono>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {tasks.items.map((item, i) => {
                                      const done = item.startsWith('✓');
                                      return (
                                        <div
                                          key={i}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: SPACE.xs,
                                            opacity: done ? 0.5 : 1,
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: 4,
                                              height: 4,
                                              borderRadius: '50%',
                                              background: done ? COLORS.ok : COLORS.warn,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span
                                            style={{
                                              fontFamily: FONTS.sans,
                                              fontSize: TYPE.bodySm.size,
                                              color: done ? COLORS.textMuted : COLORS.textSecondary,
                                              textDecoration: done ? 'line-through' : 'none',
                                            }}
                                          >
                                            {done ? item.slice(2) : item}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Synced Clinical Notes */}
                              {clinicalNotes && clinicalNotes.filter(n => n.patientId === patient.id).length > 0 && (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xs }}>
                                    <StickyNote size={12} color={COLORS.textMuted} />
                                    <Mono tone="muted" size="xs">
                                      Notes · {clinicalNotes.filter(n => n.patientId === patient.id).length}
                                    </Mono>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {clinicalNotes.filter(n => n.patientId === patient.id).slice(0, 3).map(note => (
                                      <div
                                        key={note.id}
                                        style={{
                                          padding: `${SPACE.xs}px ${SPACE.sm}px`,
                                          background: COLORS.surfaceElev ?? COLORS.surface,
                                          border: `1px solid ${COLORS.border}`,
                                          borderRadius: RADIUS.sm,
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                          <Mono tone="accent" size="xs">{note.type}</Mono>
                                          <Mono tone="muted" size="xs">{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Mono>
                                        </div>
                                        <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textSecondary, lineHeight: 1.3 }}>
                                          {note.content.length > 120 ? note.content.slice(0, 120) + '…' : note.content}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                                <TacticalButton
                                  variant="ghost"
                                  size="sm"
                                  icon={<FileText size={13} />}
                                  onClick={() => showToast(`Opening chart for ${patient.name.family}`)}
                                >
                                  Chart
                                </TacticalButton>
                                <TacticalButton
                                  variant="ghost"
                                  size="sm"
                                  icon={<StickyNote size={13} />}
                                  onClick={() => {
                                    if (onAddNote) {
                                      onAddNote({
                                        patientId: patient.id,
                                        type: 'PROGRESS',
                                        authorId: 'current-user',
                                        content: `Rounding note — ${patient.name.family}, ${patient.name.given}. Patient assessed at bedside. ${patient.currentEncounter?.chiefComplaint ? `CC: ${patient.currentEncounter.chiefComplaint}.` : ''} Vitals reviewed. Plan discussed with team.`,
                                      });
                                    }
                                    showToast(`Note saved for ${patient.name.family}`);
                                  }}
                                >
                                  Add Note
                                </TacticalButton>
                                <TacticalButton
                                  variant="ghost"
                                  size="sm"
                                  icon={<FlaskConical size={13} />}
                                  onClick={() => showToast(`Orders for ${patient.name.family}`)}
                                >
                                  Orders
                                </TacticalButton>
                                {score >= 5 && (
                                  <TacticalButton
                                    variant="danger"
                                    size="sm"
                                    icon={<AlertTriangle size={13} />}
                                    onClick={() => showToast(`Rapid Response called for ${patient.name.family}`)}
                                  >
                                    Rapid Response
                                  </TacticalButton>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}

              {patients.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: `${SPACE['2xl']}px ${SPACE.base}px`,
                  }}
                >
                  <Mono tone="muted" size="sm">No patients match the current filter</Mono>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

RoundingList.displayName = 'RoundingList';

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

const VitalChip: React.FC<{
  icon: React.ReactNode;
  value: string;
  alert?: boolean;
}> = ({ icon, value, alert }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      color: alert ? COLORS.crit : COLORS.textMuted,
    }}
  >
    {icon}
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  </div>
);

const VitalTile: React.FC<{
  label: string;
  value: string;
  unit: string;
  alert?: boolean;
}> = ({ label, value, unit, alert }) => (
  <div
    style={{
      padding: `${SPACE.xs}px ${SPACE.sm}px`,
      background: alert ? `${COLORS.crit}08` : COLORS.bg,
      border: `1px solid ${alert ? `${COLORS.crit}30` : COLORS.border}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <Mono tone="muted" size="xs">{label}</Mono>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 15,
          fontWeight: 700,
          color: alert ? COLORS.crit : COLORS.textPrimary,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          color: COLORS.textMuted,
        }}
      >
        {unit}
      </span>
    </div>
  </div>
);

const SbarLine: React.FC<{ letter: string; color: string; text: string }> = ({
  letter,
  color,
  text,
}) => (
  <div style={{ display: 'flex', gap: SPACE.sm }}>
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 12,
        fontWeight: 700,
        color,
        width: 12,
        flexShrink: 0,
      }}
    >
      {letter}
    </span>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.bodySm.size,
        color: COLORS.textSecondary,
        lineHeight: 1.4,
      }}
    >
      {text}
    </span>
  </div>
);
