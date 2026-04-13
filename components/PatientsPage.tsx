import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronRight, Heart, Thermometer, Wind, Activity, AlertTriangle, Shield, Users } from 'lucide-react';
import { MOCK_PATIENTS, ageInYears } from '../data/clinicalMock';
import { computeMEWS } from '../lib/clinicalScores';
import { PatientDetailScreen } from './PatientDetailScreen';
import type { Patient, UserProfile, UserRole } from '../types';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, SHADOW,
  Mono, BracketLabel, StatusPill, TacticalCard, HudStrip, ScanningLine, Divider, TacticalButton,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface PatientsPageProps {
  currentUser: UserProfile;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  initialPatientId?: string;
  /** Mutable patient list from App — includes newly admitted patients */
  patients?: Patient[];
  /** Synced clinical notes — displayed in patient detail */
  clinicalNotes?: import('../types').ClinicalNote[];
  /** Cross-device vitals update — pushes new vitals to all devices */
  onUpdateVitals?: (patientId: string, vitals: Omit<import('../types').Vital, 'id' | 'timestamp'>) => void;
  /** Cross-device note creation — syncs note to all devices */
  onAddNote?: (note: Omit<import('../types').ClinicalNote, 'id' | 'createdAt'>) => void;
  /** Cross-device discharge — frees bed and updates status everywhere */
  onDischargePatient?: (patientId: string) => void;
}

type SortKey = 'acuity' | 'bed' | 'name' | 'los';
type FilterStatus = 'all' | 'critical' | 'warning' | 'stable';

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** MEWS value to status bucket. */
const mewsToStatus = (mews: number): 'critical' | 'warning' | 'stable' =>
  mews >= 4 ? 'critical' : mews >= 2 ? 'warning' : 'stable';

/** MEWS value to color. */
const mewsColor = (mews: number): string =>
  mews >= 4 ? COLORS.crit : mews >= 2 ? COLORS.warn : COLORS.ok;

/** Vital value coloring for HR. */
const hrColor = (hr: number | undefined): string => {
  if (hr == null) return COLORS.textMuted;
  if (hr < 50 || hr > 130) return COLORS.crit;
  if (hr < 60 || hr > 110) return COLORS.warn;
  return COLORS.textMuted;
};

/** Vital value coloring for SpO2. */
const spo2Color = (spo2: number | undefined): string => {
  if (spo2 == null) return COLORS.textMuted;
  if (spo2 < 90) return COLORS.crit;
  if (spo2 < 94) return COLORS.warn;
  return COLORS.textMuted;
};

// ─────────────────────────────────────────────────────────────────────────
// Sort pill component
// ─────────────────────────────────────────────────────────────────────────

const SortPill: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 24,
      padding: '0 8px',
      background: active ? COLORS.accentDim : 'transparent',
      border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
      borderRadius: RADIUS.md,
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: active ? COLORS.accent : COLORS.textMuted,
      cursor: 'pointer',
      transition: `all ${MOTION.fast}s ease`,
    }}
  >
    {label}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// Filter pill component (with colored dot)
// ─────────────────────────────────────────────────────────────────────────

const FilterPill: React.FC<{
  label: string;
  dotColor?: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, dotColor, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: 24,
      padding: '0 8px',
      background: active ? COLORS.surfaceElev : 'transparent',
      border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
      borderRadius: RADIUS.md,
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: active ? COLORS.textPrimary : COLORS.textMuted,
      cursor: 'pointer',
      transition: `all ${MOTION.fast}s ease`,
    }}
  >
    {dotColor && (
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: RADIUS.full,
          background: dotColor,
          boxShadow: active ? `0 0 6px ${dotColor}` : undefined,
        }}
      />
    )}
    {label}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// Patient row component
// ─────────────────────────────────────────────────────────────────────────

const PatientRow: React.FC<{
  patient: Patient;
  mewsScore: number;
  selected: boolean;
  onClick: () => void;
}> = ({ patient, mewsScore, selected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const latestVitals = patient.vitalsHistory[patient.vitalsHistory.length - 1];
  const bed = patient.currentEncounter?.location.bed ?? '—';
  const zone = patient.currentEncounter?.location.zone ?? '';
  const cc = patient.currentEncounter?.chiefComplaint ?? '';
  const age = ageInYears(patient.birthDate);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        padding: SPACE.md,
        cursor: 'pointer',
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: selected ? `3px solid ${COLORS.accent}` : '3px solid transparent',
        background: selected
          ? COLORS.surfaceElev
          : hovered
            ? COLORS.surfaceHover
            : 'transparent',
        transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
      }}
    >
      {/* MEWS badge */}
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: RADIUS.sm,
          background: `${mewsColor(mewsScore)}18`,
          border: `1px solid ${mewsColor(mewsScore)}40`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 16,
            fontWeight: 600,
            color: mewsColor(mewsScore),
          }}
        >
          {mewsScore}
        </span>
      </div>

      {/* Center info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {patient.name.family}, {patient.name.given}
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: COLORS.textMuted,
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            {age}{patient.sex}
          </span>
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: COLORS.textSecondary,
            letterSpacing: '0.04em',
            marginBottom: 2,
          }}
        >
          Bed {bed}
          {zone ? ` \u00B7 ${zone}` : ''}
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            color: COLORS.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cc}
        </div>
      </div>

      {/* Right: quick vitals */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          flexShrink: 0,
        }}
      >
        {latestVitals?.heartRate != null && (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              letterSpacing: '0.06em',
              color: hrColor(latestVitals.heartRate),
            }}
          >
            HR {latestVitals.heartRate}
          </span>
        )}
        {latestVitals?.spO2 != null && (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              letterSpacing: '0.06em',
              color: spo2Color(latestVitals.spO2),
            }}
          >
            SpO2 {latestVitals.spO2}%
          </span>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight
        size={14}
        color={selected ? COLORS.accent : COLORS.textDim}
        style={{ flexShrink: 0 }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export const PatientsPage: React.FC<PatientsPageProps> = ({
  currentUser,
  showToast,
  initialPatientId,
  patients: externalPatients,
  clinicalNotes,
  onUpdateVitals,
  onAddNote,
  onDischargePatient,
}) => {
  // Use mutable patient list from App if provided, otherwise fall back to static mock
  const patientList = externalPatients ?? MOCK_PATIENTS;
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    initialPatientId ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('acuity');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Sync when navigating from bed board with a specific patient
  useEffect(() => {
    if (initialPatientId) setSelectedPatientId(initialPatientId);
  }, [initialPatientId]);

  // Pre-compute MEWS for each patient (latest vitals)
  const patientsWithMews = useMemo(
    () =>
      patientList.map((p) => {
        const latest = p.vitalsHistory[p.vitalsHistory.length - 1];
        const mews = latest ? computeMEWS(latest).value : 0;
        return { patient: p, mews };
      }),
    [patientList],
  );

  // Filter + sort pipeline
  const filteredPatients = useMemo(() => {
    let list = patientsWithMews;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(({ patient: p }) => {
        const name = `${p.name.given} ${p.name.family}`.toLowerCase();
        const mrn = p.mrn.toLowerCase();
        const bed = (p.currentEncounter?.location.bed ?? '').toLowerCase();
        const cc = (p.currentEncounter?.chiefComplaint ?? '').toLowerCase();
        return name.includes(q) || mrn.includes(q) || bed.includes(q) || cc.includes(q);
      });
    }

    // Filter by status
    if (filterStatus !== 'all') {
      list = list.filter(({ mews }) => mewsToStatus(mews) === filterStatus);
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'acuity': {
          const esiA = a.patient.currentEncounter?.esi ?? 5;
          const esiB = b.patient.currentEncounter?.esi ?? 5;
          return esiA - esiB;
        }
        case 'bed': {
          const bedA = a.patient.currentEncounter?.location.bed ?? '';
          const bedB = b.patient.currentEncounter?.location.bed ?? '';
          return bedA.localeCompare(bedB, undefined, { numeric: true });
        }
        case 'name':
          return a.patient.name.family.localeCompare(b.patient.name.family);
        case 'los': {
          const admA = a.patient.currentEncounter?.admittedAt ?? '';
          const admB = b.patient.currentEncounter?.admittedAt ?? '';
          // Longest first: earlier admission = smaller date string = should come first
          return admA.localeCompare(admB);
        }
        default:
          return 0;
      }
    });

    return list;
  }, [patientsWithMews, searchQuery, filterStatus, sortBy]);

  const selectedPatient = selectedPatientId
    ? patientList.find((p) => p.id === selectedPatientId || p.mrn === selectedPatientId)
    : undefined;

  // ───────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: COLORS.bg,
      }}
    >
      {/* ── LEFT PANEL: Patient list ─────────────────────────────────── */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
        }}
      >
        {/* Header */}
        <HudStrip side="top">
          <BracketLabel tone="accent" size="sm">
            PATIENT LIST
          </BracketLabel>
          <Mono tone="muted" size="xs" style={{ marginLeft: 'auto' }}>
            {filteredPatients.length} / {patientList.length}
          </Mono>
        </HudStrip>

        {/* Search */}
        <div style={{ padding: `${SPACE.sm}px ${SPACE.md}px` }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              color={COLORS.textMuted}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: 34,
                paddingLeft: 32,
                paddingRight: SPACE.sm,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                fontFamily: FONTS.mono,
                fontSize: 13,
                color: COLORS.textPrimary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Sort pills */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: `0 ${SPACE.md}px`,
            marginBottom: SPACE.xs,
          }}
        >
          <Mono tone="dim" size="xs" style={{ alignSelf: 'center', marginRight: 4 }}>
            Sort
          </Mono>
          {(['acuity', 'bed', 'name', 'los'] as SortKey[]).map((key) => (
            <SortPill
              key={key}
              label={key === 'los' ? 'LOS' : key.charAt(0).toUpperCase() + key.slice(1)}
              active={sortBy === key}
              onClick={() => setSortBy(key)}
            />
          ))}
        </div>

        {/* Filter pills */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: `0 ${SPACE.md}px`,
            marginBottom: SPACE.sm,
          }}
        >
          <Mono tone="dim" size="xs" style={{ alignSelf: 'center', marginRight: 4 }}>
            Show
          </Mono>
          <FilterPill label="All" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
          <FilterPill label="Critical" dotColor={COLORS.crit} active={filterStatus === 'critical'} onClick={() => setFilterStatus('critical')} />
          <FilterPill label="Warning" dotColor={COLORS.warn} active={filterStatus === 'warning'} onClick={() => setFilterStatus('warning')} />
          <FilterPill label="Stable" dotColor={COLORS.ok} active={filterStatus === 'stable'} onClick={() => setFilterStatus('stable')} />
        </div>

        <Divider />

        {/* Patient rows (scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {filteredPatients.length === 0 && (
            <div
              style={{
                padding: SPACE.xl,
                textAlign: 'center',
              }}
            >
              <Mono tone="muted" size="sm">
                No patients match filters
              </Mono>
            </div>
          )}
          {filteredPatients.map(({ patient, mews }) => (
            <PatientRow
              key={patient.id}
              patient={patient}
              mewsScore={mews}
              selected={selectedPatientId === patient.id}
              onClick={() => setSelectedPatientId(patient.id)}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL: Patient detail ──────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          background: COLORS.bg,
        }}
      >
        <AnimatePresence mode="wait">
          {selectedPatient ? (
            <motion.div
              key={selectedPatient.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              style={{ height: '100%', overflow: 'auto' }}
            >
              <PatientDetailScreen
                patient={selectedPatient}
                onClose={() => setSelectedPatientId(null)}
                onSave={() => showToast('Chart saved', 'success')}
                showToast={showToast}
                embedded
                clinicalNotes={clinicalNotes}
                onUpdateVitals={onUpdateVitals}
                onAddNote={onAddNote}
                onDischargePatient={onDischargePatient}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.fast }}
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: SPACE.base,
              }}
            >
              <Users size={48} color={COLORS.textDim} strokeWidth={1.2} />
              <Mono tone="muted" size="base">
                Select a patient from the list
              </Mono>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
