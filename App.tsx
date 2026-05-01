import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  BookOpen,
  Layout,
  PlayCircle,
  Radio,
  Archive,
  AlertOctagon,
  Bell,
  X,
  Users,
  MessageSquare,
  CheckCircle2,
  Clock,
  BedDouble,
  UserPlus,
  ShieldAlert as ShieldAlertIcon,
  UsersRound,
  Stethoscope,
  Ambulance,
  RotateCcw,
  Zap,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
} from 'lucide-react';
import { Tab, UserRole, UserProfile, type Allergy } from './types';
import { USERS } from './data/userProfiles';
import { PulseHorizon } from './components/PulseHorizon';
import { ActionBoard } from './components/ActionBoard';
import { PlaybookActivation } from './components/PlaybookActivation';
import { BriefMe } from './components/BriefMe';
import { Replay } from './components/Replay';
import { LiveOps } from './components/LiveOps';
import { Playbooks } from './components/Playbooks';
import { Roster } from './components/Roster';
import { ChatAssistant } from './components/ChatAssistant';
import { LoginScreen } from './components/LoginScreen';
import { CommandSidebar, type SimControlAction } from './components/CommandSidebar';
import { ShiftHandoffModal } from './components/ShiftHandoffModal';
import { MobileView } from './components/MobileView';
import { SettingsScreen } from './components/SettingsScreen';
import { ScenarioHudBadge } from './components/ScenarioHudBadge';
import { EmsAutoBrief } from './components/EmsAutoBrief';
import { CinematicBoot, BOOT_DURATION_MS } from './components/CinematicBoot';
import { DebugPanel, ConnectionIndicator } from './components/DebugPanel';
import { BedBoard, AdmitFlow, AlertsCenter, WorkforceCoverage, INITIAL_ADMISSION_QUEUE } from './components/clinical';
import type { AdmissionEntry } from './components/clinical';
import type { Bed } from './data/bedMock';
import { PatientsPage } from './components/PatientsPage';
import { MOCK_PATIENTS } from './data/clinicalMock';
import type { Patient, Vital, Encounter, ClinicalNote } from './types';
import { seedBedState, escalateBedState, deescalateBedState, type BedUnit } from './data/bedMock';
import {
  useRealtimeState,
  useRealtimePing,
  useLostEditListener,
  subscribe,
  publish,
  broadcastReset,
  getDeviceId,
} from './lib/realtime';
import {
  INITIAL_POOL,
  type BraceletPool,
  linkBracelet,
  availableNumbers,
} from './lib/braceletPool';
import {
  buildInitialUrgentTasks,
  INITIAL_SURGE_STATE,
  SurgeModeState,
  UrgentTask,
} from './lib/surgeTaskTemplates';
import {
  type ScenarioState,
  type ScenarioSeverity,
  buildScenarioState,
  useScenarioEventRunner,
  useScenarioTick,
  formatScenarioRemaining,
  SCENARIO_META,
  metricValue,
  scenarioEmsBootstrap,
} from './lib/scenario';
import { fireSurgeNotification, installFirstClickPermissionListener } from './lib/notifications';
import { installGlobalHapticListener } from './lib/haptics';
import { initUiScale } from './lib/uiScale';
import { readSurgeDurationMs } from './lib/surgeDuration';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  SHADOW,
  SCANLINES,
  MOTION,
  CHROME,
  cssTransition,
  Mono,
  BracketLabel,
  StatusPill,
  CornerBracket,
  TacticalButton,
  HudStrip,
  ScanningLine,
} from './components/design';

// Friendly labels for the lost-edit toast. Maps useRealtimeState keys to
// human-readable names so the operator sees "Bed assignments" instead of
// "bed-units" when a concurrent edit wins the tiebreak.
const LOST_EDIT_LABELS: Record<string, string> = {
  'surge-mode': 'Surge state',
  'urgent-tasks': 'Urgent tasks',
  'bed-units': 'Bed assignments',
  'admission-queue': 'Admission queue',
  'patients': 'Patient chart',
  'clinical-notes': 'Clinical notes',
  'alert-acks': 'Alert acknowledgment',
  'bracelet-pool': 'Bracelets',
};

function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HORIZON);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);

  // Surge mode and urgent tasks live in the realtime store so all connected
  // devices stay in sync. Once activated, surge stays active for the session.
  const [surgeState, setSurgeState] = useRealtimeState<SurgeModeState>(
    'surge-mode',
    INITIAL_SURGE_STATE,
  );
  const [urgentTasks, setUrgentTasks] = useRealtimeState<UrgentTask[]>(
    'urgent-tasks',
    [],
  );
  const isSurgeActive = surgeState.active;

  // ── Active scenario — 3-minute simulation state ───────────────────────
  // Synced across devices. Event runner (below) only fires on the
  // authoring device so ems-inject / alerts / toasts don't duplicate.
  const [activeScenario, setActiveScenario] = useRealtimeState<ScenarioState | null>(
    'active-scenario',
    null,
  );
  const scenarioTick = useScenarioTick(activeScenario);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [systemStatus, setSystemStatus] = useState<'normal' | 'stale' | 'manual'>('normal');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [loginCount, setLoginCount] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Toast System
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Handover System
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showShiftBriefing, setShowShiftBriefing] = useState(false);
  const [globalHandoverNotes, setGlobalHandoverNotes] = useState<{
    author: string;
    notes: string;
  } | null>(null);

  // Patient navigation — when bed board or quick action sends user to Patients tab
  const [initialPatientId, setInitialPatientId] = useState<string | undefined>();

  // ── Shared state — synced across all connected devices via Supabase broadcast ──
  const [bedUnits, setBedUnits] = useRealtimeState<BedUnit[]>('bed-units', seedBedState());
  const [admissionQueue, setAdmissionQueue] = useRealtimeState<AdmissionEntry[]>('admission-queue', INITIAL_ADMISSION_QUEUE);
  const [patients, setPatients] = useRealtimeState<Patient[]>('patients', [...MOCK_PATIENTS]);
  // Keep a ref so assignBedToAdmission always reads the latest queue
  const admissionQueueRef = useRef(admissionQueue);
  admissionQueueRef.current = admissionQueue;

  // Auto-deactivate handle for Surge Mode. Scheduled at activateSurge
  // time from the operator's `pulse-surge-duration` preference (30 s /
  // 1 m / 2 m / 5 m / permanent). `null` = no timer is pending.
  // Must be cleared in deactivateSurge (so manual stand-down doesn't
  // leave a dangling timeout) and on unmount.
  const surgeAutoStandDownRef = useRef<number | null>(null);

  // ── Additional synced state — clinical notes & alert acks ──
  const [clinicalNotes, setClinicalNotes] = useRealtimeState<ClinicalNote[]>('clinical-notes', []);
  const [alertAcks, setAlertAcks] = useRealtimeState<Record<string, { status: string; actor: string; at: string }>>(
    'alert-acks', {}
  );

  // ── Bracelet pool — SCAD participatory demo. 20 numbered wristband slots
  // synced across every connected device. Handing out a bracelet links it to
  // a patient (see submitNewAdmission); scanning a linked bracelet on any
  // device opens that patient's chart (see MobileView handleQRScan).
  const [braceletPool, setBraceletPool] = useRealtimeState<BraceletPool>('bracelet-pool', INITIAL_POOL);
  const availableBraceletNumbers = useMemo(
    () => availableNumbers(braceletPool),
    [braceletPool],
  );

  /** Add a clinical note (SOAP, progress, nursing, etc.) — syncs to all devices */
  const addClinicalNote = useCallback((note: Omit<ClinicalNote, 'id' | 'createdAt'>) => {
    const newNote: ClinicalNote = {
      ...note,
      id: `NOTE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setClinicalNotes(prev => [newNote, ...prev]);
    showToast(`Note saved for patient`, 'success');
  }, []);

  /** Update patient vitals — pushes new vitals entry and syncs to all devices */
  const updatePatientVitals = useCallback((patientId: string, vitals: Omit<Vital, 'id' | 'timestamp'>) => {
    const newVital: Vital = {
      ...vitals,
      id: `V-${patientId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? { ...p, vitalsHistory: [...p.vitalsHistory, newVital] }
        : p
    ));
    showToast('Vitals updated', 'success');
  }, []);

  /** Discharge a patient — frees bed, updates admission queue & encounter status */
  const dischargePatient = useCallback((patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    const bedLocation = patient.currentEncounter?.location?.bed;
    const nowIso = new Date().toISOString();

    // Free the bed
    if (bedLocation) {
      setBedUnits(prev => prev.map(unit => ({
        ...unit,
        beds: unit.beds.map(bed => {
          if (bed.label === bedLocation && bed.state === 'occupied') {
            return {
              ...bed,
              state: 'dirty' as const,
              patientName: undefined,
              patientId: undefined,
              mrn: undefined,
              acuity: undefined,
              attending: undefined,
              losHours: undefined,
              stateChangedMinAgo: 0,
            };
          }
          return bed;
        }),
      })));
    }

    // Remove from admission queue — the queue tracks patients in the
    // pipeline (pending → placing → in_transit → admitted). Once
    // discharged, they exit the queue entirely; the patient record
    // itself carries the final state via currentEncounter.status =
    // 'finished' below. (Previously this tried to set status:'discharged'
    // which isn't a valid AdmissionStatus — see types in AdmitFlow.tsx.)
    setAdmissionQueue(prev => prev.filter(a => a.mrn !== patient.mrn));

    // Update patient encounter status
    setPatients(prev => prev.map(p =>
      p.id === patientId
        ? {
            ...p,
            currentEncounter: p.currentEncounter
              ? { ...p.currentEncounter, status: 'finished' as const, dischargedAt: nowIso }
              : p.currentEncounter,
          }
        : p
    ));

    showToast(`Discharged ${patient.name.given} ${patient.name.family}`, 'success');
  }, [patients]);

  /** Acknowledge an alert — syncs acknowledgment state to all devices */
  const acknowledgeAlert = useCallback((alertId: string, actor: string) => {
    setAlertAcks(prev => ({
      ...prev,
      [alertId]: { status: 'acknowledged', actor, at: new Date().toISOString() },
    }));
  }, []);

  /**
   * Build a Patient record from an admission entry. Pure function — no state
   * mutations. `bedContext` is optional: when present, the encounter carries
   * a concrete bed + zone; when absent, the patient is admitted-unassigned
   * and appears on the floor without a physical location yet.
   */
  const buildPatientFromAdmission = (
    admission: AdmissionEntry,
    bedContext?: { bedLabel: string; unitName: string; zoneName: string },
  ): Patient => {
    const nameParts = admission.name.split(' ');
    const given = nameParts[0] ?? admission.name;
    const family = nameParts.slice(1).join(' ') || 'Unknown';
    const demo = admission.demographics;
    const nowIso = new Date().toISOString();
    const patientId = `P-${admission.mrn.replace('MRN-', '')}`;

    // Use vitals from form if provided, otherwise generate defaults
    const dv = demo?.vitals;
    const initialVitals: Vital = {
      id: `V-${patientId}-0`,
      timestamp: nowIso,
      heartRate: dv?.hr ?? (78 + Math.floor(Math.random() * 20)),
      systolic: dv?.systolic ?? (118 + Math.floor(Math.random() * 20)),
      diastolic: dv?.diastolic ?? (70 + Math.floor(Math.random() * 15)),
      respRate: dv?.rr ?? (16 + Math.floor(Math.random() * 6)),
      spO2: dv?.spo2 ?? (94 + Math.floor(Math.random() * 5)),
      temperature: dv?.temp ?? (36.6 + Math.round(Math.random() * 10) / 10),
      painScore: dv?.painScore ?? Math.min(admission.acuity, Math.floor(Math.random() * 6)),
      gcs: dv?.gcs ?? 15,
    };

    const arrivalMode = demo?.arrivalMode
      ? demo.arrivalMode as Encounter['arrivalMode']
      : admission.source === 'ED' ? 'ems' : admission.source === 'Transfer' ? 'transfer' : 'ambulatory';

    const encounter: Encounter = {
      id: `ENC-${patientId}`,
      patientId,
      class: admission.source === 'ED' ? 'EMERGENCY' : 'INPATIENT',
      status: 'in-progress',
      admittedAt: nowIso,
      location: bedContext
        ? { zone: bedContext.zoneName || bedContext.unitName, bed: bedContext.bedLabel }
        : { zone: admission.requestedUnit, bed: 'UNASSIGNED' },
      bedAssignmentStatus: bedContext ? 'assigned' : 'admitted-unassigned',
      chiefComplaint: admission.complaint,
      esi: admission.acuity as 1 | 2 | 3 | 4 | 5,
      attendingId: admission.attending,
      arrivalMode,
      payer: demo?.insurance ? { primary: demo.insurance } : undefined,
    };

    // Parse DOB — form uses "MM/DD/YYYY", mock entries won't have it
    let birthDate = '1970-01-01';
    if (demo?.dob) {
      const parts = demo.dob.split('/');
      if (parts.length === 3) birthDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      else birthDate = demo.dob;
    }

    // Build allergy list from form input.
    //
    // The admit form captures clinical-speak severity
    // (mild / moderate / severe / life-threatening) because that's
    // how nurses talk about it. The stored shape uses FHIR
    // AllergyIntolerance.criticality (low / high / unable-to-assess).
    // Map at the boundary so every downstream consumer (patient
    // header strip, QR card, detail screens) can rely on the
    // FHIR-shaped type.
    const toFhirCriticality = (s: string): Allergy['severity'] => {
      switch (s) {
        case 'severe':
        case 'life-threatening':
          return 'high';
        case 'mild':
        case 'moderate':
          return 'low';
        default:
          return 'unable-to-assess';
      }
    };
    const allergies: Allergy[] = (demo?.allergies ?? [])
      .filter(a => a.substance.trim())
      .map((a, i) => ({
        id: `ALG-${patientId}-${i}`,
        substance: a.substance,
        reaction: a.reaction || 'Unknown',
        severity: toFhirCriticality(a.severity),
        verification: 'confirmed' as const,
      }));

    // Build problem list from form input
    const problems = (demo?.problems ?? [])
      .filter(p => p.display.trim())
      .map((p, i) => ({
        id: `PROB-${patientId}-${i}`,
        display: p.display,
        icd10Code: p.icd10 || undefined,
        status: p.status as 'active' | 'resolved' | 'inactive',
        priority: i + 1,
      }));

    return {
      id: patientId,
      mrn: admission.mrn,
      name: { given, family },
      birthDate,
      sex: (demo?.sex ?? 'U') as 'M' | 'F' | 'X' | 'U',
      preferredLanguage: demo?.preferredLanguage ?? 'en',
      needsInterpreter: demo?.needsInterpreter,
      weightKg: demo?.weightKg,
      heightCm: demo?.heightCm,
      codeStatus: (demo?.codeStatus ?? 'FULL') as Patient['codeStatus'],
      isolation: (demo?.isolation ?? 'NONE') as Patient['isolation'],
      allergies,
      problems,
      vitalsHistory: [initialVitals],
      currentEncounter: encounter,
      avatarInitials: `${given[0] ?? ''}${family[0] ?? ''}`.toUpperCase(),
    };
  };

  /**
   * Assign a bed to an admission queue entry — updates bed state, queue,
   * AND the existing Patient's encounter location. The Patient record is
   * created at submission time (see submitNewAdmission), so this fn just
   * moves them from "admitted-unassigned" to their concrete bed.
   */
  const assignBedToAdmission = (admissionId: string, bedId: string) => {
    // Read from ref to always get the latest queue (avoids stale closure)
    const admission = admissionQueueRef.current.find(a => a.id === admissionId);
    if (!admission) return;

    let bedLabel = '';
    let unitName = '';
    let zoneName = '';

    // Update bed state
    setBedUnits(prev => prev.map(unit => ({
      ...unit,
      beds: unit.beds.map(bed => {
        if (bed.id === bedId && bed.state === 'ready') {
          bedLabel = bed.label;
          unitName = unit.shortName;
          zoneName = unit.name;
          return {
            ...bed,
            state: 'occupied' as const,
            patientName: admission.name,
            patientId: admission.mrn,
            mrn: admission.mrn,
            acuity: admission.acuity as (1|2|3|4|5),
            attending: admission.attending,
            admitSource: (admission.source ?? 'ED') as Bed['admitSource'],
            losHours: 0,
            isolation: 'NONE' as const,
            stateChangedMinAgo: 0,
          };
        }
        return bed;
      }),
    })));

    // Update queue entry status
    setAdmissionQueue(prev => prev.map(a =>
      a.id === admissionId
        ? {
            ...a,
            status: 'admitted' as const,
            assignedBed: bedLabel,
            assignedUnit: unitName,
            bedAssignmentStatus: 'assigned' as const,
            waitMin: 0,
          }
        : a
    ));

    // Update the existing Patient's encounter location. If for any reason
    // the Patient doesn't exist yet (e.g. legacy seed data), fall back to
    // creating one so the patient still appears on the Patients tab.
    setPatients(prev => {
      const existing = prev.find(p => p.mrn === admission.mrn);
      if (existing) {
        return prev.map(p =>
          p.mrn === admission.mrn && p.currentEncounter
            ? {
                ...p,
                currentEncounter: {
                  ...p.currentEncounter,
                  location: { zone: zoneName || unitName, bed: bedLabel },
                  bedAssignmentStatus: 'assigned' as const,
                },
              }
            : p
        );
      }
      const newPatient = buildPatientFromAdmission(admission, { bedLabel, unitName, zoneName });
      return [newPatient, ...prev];
    });

    showToast(`Admitted ${admission.name} → ${bedLabel} (${unitName})`);
  };

  /**
   * Add a new admission from the form. If `bedId` is provided, the patient
   * is immediately placed in that bed (bed occupied, queue marked admitted).
   * Otherwise the patient is admitted-unassigned — they appear on the
   * Patients tab right away but no physical bed is tied to them until
   * someone calls assignBedToAdmission later.
   */
  const submitNewAdmission = (
    entry: Omit<AdmissionEntry, 'id' | 'status' | 'waitMin' | 'requestedAt'>,
    bedId?: string,
  ) => {
    const newId = `ADM-${String(admissionQueue.length + 1).padStart(3, '0')}`;
    const requestedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Resolve bed info up front if a bed was chosen
    let bedContext: { bedLabel: string; unitName: string; zoneName: string } | undefined;
    if (bedId) {
      for (const unit of bedUnits) {
        const bed = unit.beds.find(b => b.id === bedId && b.state === 'ready');
        if (bed) {
          bedContext = { bedLabel: bed.label, unitName: unit.shortName, zoneName: unit.name };
          break;
        }
      }
    }

    const newEntry: AdmissionEntry = {
      ...entry,
      id: newId,
      status: bedContext ? 'admitted' : 'pending',
      waitMin: 0,
      requestedAt,
      ...(bedContext ? {
        assignedBed: bedContext.bedLabel,
        assignedUnit: bedContext.unitName,
        bedAssignmentStatus: 'assigned' as const,
      } : {
        bedAssignmentStatus: 'admitted-unassigned' as const,
      }),
    };

    // If a bed was chosen, flip it to occupied
    if (bedContext && bedId) {
      setBedUnits(prev => prev.map(unit => ({
        ...unit,
        beds: unit.beds.map(bed => {
          if (bed.id === bedId && bed.state === 'ready') {
            return {
              ...bed,
              state: 'occupied' as const,
              patientName: entry.name,
              patientId: entry.mrn,
              mrn: entry.mrn,
              acuity: entry.acuity as (1|2|3|4|5),
              attending: entry.attending,
              admitSource: (entry.source ?? 'ED') as Bed['admitSource'],
              losHours: 0,
              isolation: 'NONE' as const,
              stateChangedMinAgo: 0,
            };
          }
          return bed;
        }),
      })));
    }

    // Push the admission entry
    setAdmissionQueue(prev => [newEntry, ...prev]);

    // Always create the Patient so they appear on Patients / My Patients
    const newPatient = buildPatientFromAdmission(newEntry, bedContext);
    setPatients(prev => {
      if (prev.some(p => p.mrn === entry.mrn)) return prev;
      return [newPatient, ...prev];
    });

    // Link the bracelet to the patient if one was selected during admit.
    // Slot flips from 'empty' → 'admitted' and carries the patient's
    // name so Settings can label the chip without a patient lookup.
    if (entry.braceletNumber) {
      setBraceletPool(prev =>
        linkBracelet(prev, entry.braceletNumber!, newPatient.id, entry.name),
      );
    }

    if (bedContext) {
      showToast(`Admitted ${entry.name} → ${bedContext.bedLabel} (${bedContext.unitName})`);
    } else {
      showToast(`Admitted ${entry.name} — bed unassigned`);
    }
  };

  // Live clock for the header — ticks every second in HH:MM:SS UTC
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const clockStr = now.toUTCString().slice(17, 25);

  // Fire surge ping (one-shot fire-and-forget). On the receiving side we hook
  // into it via useEffect below to fire the browser notification.
  const sendSurgePing = useRealtimePing<{ taskCount: number }>('surge-activated');

  // Debug mode is enabled via ?debug=1
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // First-click permission for browser notifications.
  useEffect(() => {
    return installFirstClickPermissionListener();
  }, []);

  // Global haptic tap on every button/selection click (native + web).
  useEffect(() => {
    return installGlobalHapticListener();
  }, []);

  // Apply the persisted UI scale (default/large) once on mount. See
  // lib/uiScale.ts — Settings → Display wires the toggle, this reads the
  // flag from localStorage and applies it to the document element so the
  // operator's choice survives reloads.
  useEffect(() => {
    initUiScale();
  }, []);

  // Listen for surge-activated pings from OTHER devices and fire the
  // notification + vibration flourish here.
  useEffect(() => {
    return subscribe<{ taskCount: number }>('surge-activated', (payload) => {
      const count = payload?.taskCount ?? 0;
      const outcome = fireSurgeNotification(count);
      if (outcome !== 'granted') {
        setToast({ message: `SURGE MODE ACTIVATED — ${count} urgent tasks`, type: 'error' });
      }
    });
  }, []);

  // ── Cross-device "Send to..." plumbing ─────────────────────────────────
  // When any device hits "Send to..." on a patient chart, it publishes an
  // `open-patient` broadcast carrying the target device ids + patient id.
  // Each device checks whether it's a target; if so it navigates to the
  // Patients tab with that patient pre-selected. This is how the SCAD demo
  // pushes a chart from Nick's iPhone to the wall-mounted touchscreen.
  useEffect(() => {
    return subscribe<{ patientId: string; targetDeviceIds: string[]; fromName?: string }>(
      'open-patient',
      (payload) => {
        if (!payload) return;
        const myId = getDeviceId();
        if (!payload.targetDeviceIds.includes(myId)) return;
        setInitialPatientId(payload.patientId);
        setActiveTab(Tab.PATIENTS);
        const sender = payload.fromName ? ` from ${payload.fromName}` : '';
        setToast({ message: `Chart received${sender}`, type: 'info' });
      },
    );
  }, []);

  // Optimistic-concurrency surface: when a concurrent edit on another
  // device overwrites our version at the same Lamport counter, toast the
  // operator so they know their change landed under someone else's.
  useLostEditListener((info) => {
    const label = LOST_EDIT_LABELS[info.key] ?? info.key;
    setToast({
      message: `Lost edit · ${label} was just updated on another device`,
      type: 'info',
    });
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Track window width so the shell can collapse labels on narrow desktops.
  // `isMobile` swaps to the MobileView, `isCompactNav` keeps the desktop shell
  // but tightens the header chrome.
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );
  const isCompactNav = windowWidth < 1280;

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), BOOT_DURATION_MS);

    const handleResize = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      setIsMobile(w < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const navItems = [
    { id: Tab.HORIZON, icon: Activity, label: 'Horizon', code: 'H' },
    { id: Tab.PATIENTS, icon: Stethoscope, label: 'Patients', code: 'N' },
    { id: Tab.BED_BOARD, icon: BedDouble, label: 'Bed Board', code: 'D' },
    { id: Tab.ADMISSIONS, icon: UserPlus, label: 'Admissions', code: 'I' },
    { id: Tab.ALERTS, icon: ShieldAlertIcon, label: 'Alerts', code: 'T' },
    { id: Tab.STAFFING, icon: UsersRound, label: 'Staffing', code: 'S' },
    { id: Tab.LIVE_OPS, icon: Radio, label: 'Live Ops', code: 'L' },
    { id: Tab.PLAYBOOKS, icon: BookOpen, label: 'Playbooks', code: 'P' },
    { id: Tab.ACTIONS, icon: Layout, label: 'Actions', code: 'A' },
    { id: Tab.ROSTER, icon: Users, label: 'Roster', code: 'R' },
    { id: Tab.BRIEF_ME, icon: Archive, label: 'Brief Me', code: 'B' },
    { id: Tab.REPLAY, icon: PlayCircle, label: 'Replay', code: 'Y' },
  ];

  const notifications = [
    ...(globalHandoverNotes
      ? [
          {
            id: 'handover',
            title: 'Shift Handover Notes',
            message: `From ${globalHandoverNotes.author}: ${globalHandoverNotes.notes}`,
            time: 'Just now',
            type: 'info' as const,
            isHandover: true,
          },
        ]
      : []),
    {
      id: 1,
      title: 'High Wait Time',
      message: 'Waiting room exceeds 2 hours.',
      time: '5m ago',
      type: 'warning' as const,
    },
    {
      id: 2,
      title: 'Staffing Shortage',
      message: 'ICU missing 1 RN for next shift.',
      time: '12m ago',
      type: 'critical' as const,
    },
    {
      id: 3,
      title: 'EMS Divert',
      message: 'St. Mary Level 1 is now on divert.',
      time: '1h ago',
      type: 'info' as const,
    },
  ];

  const handleActivatePlaybook = () => {
    setShowPlaybookModal(true);
  };

  const activateSurge = () => {
    if (surgeState.active) return;
    // Pass a snapshot of current hospital state so the task builder
    // can pick a state-aware mix (unstaffed beds, dirty-bed count,
    // pending ICU admits, etc.) — running surge twice now produces
    // two different task lists instead of the same five every time.
    const tasks = buildInitialUrgentTasks({
      bedUnits,
      patients,
      admissionQueue,
    });
    setSurgeState({ active: true, activatedAt: Date.now() });
    setUrgentTasks(tasks);
    setBedUnits(escalateBedState(seedBedState()));
    sendSurgePing({ taskCount: tasks.length });
    showToast('Surge Mode Activated', 'error');

    // Schedule auto stand-down per Settings → Simulation → Surge duration.
    // Read at activation time so the operator can change the preference
    // mid-demo and have it apply on the NEXT activation. `null` ms means
    // "permanent — operator dismisses manually."
    if (surgeAutoStandDownRef.current !== null) {
      window.clearTimeout(surgeAutoStandDownRef.current);
      surgeAutoStandDownRef.current = null;
    }
    const autoMs = readSurgeDurationMs();
    if (autoMs !== null) {
      surgeAutoStandDownRef.current = window.setTimeout(() => {
        surgeAutoStandDownRef.current = null;
        deactivateSurge();
      }, autoMs);
    }
  };

  const deactivateSurge = () => {
    // Cancel any pending auto stand-down timer first — whether this
    // was called by the timer itself, a manual operator tap, or a
    // reset. Safe to call even if no timer is pending.
    if (surgeAutoStandDownRef.current !== null) {
      window.clearTimeout(surgeAutoStandDownRef.current);
      surgeAutoStandDownRef.current = null;
    }
    if (!surgeState.active) return;
    setSurgeState({ active: false, activatedAt: null });
    setUrgentTasks([]);
    setBedUnits(deescalateBedState());
    showToast('Surge Mode Deactivated — Stand Down', 'info');
  };

  // Clean up the surge auto-stand-down timer on unmount. If the app
  // tears down while a timer is pending, we don't want the handler
  // to fire against a stale closure.
  useEffect(() => {
    return () => {
      if (surgeAutoStandDownRef.current !== null) {
        window.clearTimeout(surgeAutoStandDownRef.current);
        surgeAutoStandDownRef.current = null;
      }
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Scenario — start / stop / hot-swap.
  // S1 = quiet day, S2 = elevated, S3 = MCI disaster (auto-activates
  // surge). Hot-swap: tapping S3 while S2 runs replaces immediately
  // and resets the 3-minute clock.
  // ────────────────────────────────────────────────────────────────────
  const startScenario = useCallback((severity: ScenarioSeverity) => {
    const state = buildScenarioState(severity, getDeviceId());
    setActiveScenario(state);
    // Replace the EMS inbound list with a scenario-tuned set so the
    // board paints correctly from t=0 — otherwise all three severities
    // share the same 6 baseline runs for the first ~15s of the scenario.
    try {
      publish('ems-replace', scenarioEmsBootstrap(severity));
    } catch (err) {
      console.warn('[scenario] ems-replace publish failed', err);
    }
    const meta = SCENARIO_META[severity];
    showToast(`Scenario ${meta.id} · ${meta.label} — running 3:00`,
      severity === 3 ? 'error' : severity === 2 ? 'info' : 'info',
    );
  }, [setActiveScenario]);

  const stopScenario = useCallback(() => {
    if (!activeScenario) return;
    const wasS3 = activeScenario.severity === 3;
    setActiveScenario(null);
    // Flush the scenario-specific EMS list back to baseline seed.
    try { publish('ems-reset'); } catch {
      /* noop — reset is best-effort */
    }
    showToast('Scenario stopped — returning to baseline', 'info');
    // If S3 auto-activated surge, bringing down the scenario also brings
    // down surge. Manual surge from elsewhere (the PulseHorizon button or
    // Settings toggle) stays independent.
    if (wasS3 && surgeState.active) {
      deactivateSurge();
    }
  }, [activeScenario, setActiveScenario, surgeState.active]);

  // Event runner — fires scheduled events on the authoring device only.
  // Binds to the stable callbacks and publishes EMS runs via the existing
  // 'ems-inject' broadcast channel so LiveOps picks them up across devices.
  useScenarioEventRunner(activeScenario, getDeviceId(), {
    onEmsInject: (payload) => {
      publish('ems-inject', payload);
    },
    onAlert: (payload) => {
      // Scenario alerts surface as high-visibility toasts. Alerts feed
      // integration is a follow-up — the toast path fires everywhere
      // and is acknowledgeable via tap-to-dismiss.
      showToast(`${payload.title} — ${payload.message}`,
        payload.type === 'critical' ? 'error' : payload.type === 'warning' ? 'info' : 'info',
      );
    },
    onCode: (payload) => {
      showToast(`${payload.type} — ${payload.room}`, 'error');
    },
    onOverflowOpen: () => {
      showToast('Overflow Hall C OPEN — 2 beds ready', 'error');
    },
    onDischarge: (payload) => {
      showToast(`Discharge · ${payload.room} · ${payload.patient}`, 'info');
    },
    onSurgeActivate: () => {
      if (!surgeState.active) activateSurge();
    },
    onSurgeDeactivate: () => {
      if (surgeState.active) deactivateSurge();
    },
    onToast: (payload) => {
      showToast(payload.message, payload.type);
    },
    onExpire: () => {
      // Auto-clear scenario at 3:00. Uses setActiveScenario directly so
      // we don't re-trigger the "stop" toast — expiry is its own beat.
      setActiveScenario(null);
      try { publish('ems-reset'); } catch {
        /* noop — reset is best-effort */
      }
    },
  });

  // ── Simulation Controls — demo power tools ──
  const simControls = useMemo<SimControlAction[]>(() => [
    {
      id: 'mci-inbound',
      label: 'MCI — Bus Accident',
      description: '3 trauma inbound · triggers surge',
      icon: <Ambulance size={13} strokeWidth={2} />,
      tone: 'crit',
      action: () => {
        // Inject 3 MCI EMS runs across all devices
        const mciRuns = [
          { unit: 'Medic 41', mode: 'ground' as const, etaMinutes: 3, age: 22, sex: 'M' as const, chiefComplaint: 'MCI bus rollover, ejected, multiple rib fx, pneumothorax', activationLevel: 'TRAUMA_1' as const, fieldVitals: { heartRate: 138, systolic: 78, diastolic: 42, respRate: 32, spO2: 88, gcs: 11 }, fieldTreatment: 'Bilateral 14g IV · TXA 1g · chest seal L · c-collar', destinationBay: 'Trauma 1' },
          { unit: 'Medic 42', mode: 'ground' as const, etaMinutes: 6, age: 34, sex: 'F' as const, chiefComplaint: 'MCI bus rollover, restrained, GCS 14, open tib-fib', activationLevel: 'TRAUMA_2' as const, fieldVitals: { heartRate: 112, systolic: 108, diastolic: 68, respRate: 22, spO2: 95, gcs: 14 }, fieldTreatment: '18g IV NS · splint R leg · fentanyl 75mcg', destinationBay: 'Trauma 2' },
          { unit: 'Air 5', mode: 'air' as const, etaMinutes: 10, age: 8, sex: 'M' as const, chiefComplaint: 'MCI bus rollover, peds unrestrained, AMS, scalp lac', activationLevel: 'TRAUMA_1' as const, fieldVitals: { heartRate: 152, systolic: 82, diastolic: 50, respRate: 28, spO2: 93, gcs: 12 }, fieldTreatment: 'IO access · NS 20mL/kg · c-collar · pressure to scalp', destinationBay: 'Trauma 1' },
        ];
        mciRuns.forEach((run) => publish('ems-inject', run));
        if (!surgeState.active) activateSurge();
        showToast('MCI Inbound — 3 trauma patients en route', 'error');
      },
    },
    {
      id: 'fill-beds',
      label: 'Increase Census',
      description: 'Fill 4 empty beds with patients',
      icon: <TrendingUp size={13} strokeWidth={2} />,
      tone: 'warn',
      action: () => {
        setBedUnits((prev) => {
          let filled = 0;
          return prev.map((unit) => ({
            ...unit,
            beds: unit.beds.map((bed) => {
              if (filled >= 4 || bed.state !== 'ready') return bed;
              filled++;
              const names = ['Kim, David', 'Torres, Ana', 'Patel, Raj', 'Williams, Rose'];
              const mrns = ['P090', 'P091', 'P092', 'P093'];
              return {
                ...bed,
                state: 'occupied' as const,
                patientName: names[filled - 1],
                patientId: mrns[filled - 1],
                mrn: mrns[filled - 1],
                acuity: (Math.floor(Math.random() * 3) + 2) as 1 | 2 | 3 | 4 | 5,
                losHours: Math.floor(Math.random() * 12) + 1,
                isolation: 'NONE' as const,
                stateChangedMinAgo: 0,
              };
            }),
          }));
        });
        showToast('Census increased — 4 beds filled', 'info');
      },
    },
    {
      id: 'free-beds',
      label: 'Decrease Census',
      description: 'Discharge 3 patients to free beds',
      icon: <TrendingDown size={13} strokeWidth={2} />,
      tone: 'ok',
      action: () => {
        setBedUnits((prev) => {
          let freed = 0;
          return prev.map((unit) => ({
            ...unit,
            beds: unit.beds.map((bed) => {
              if (freed >= 3 || bed.state !== 'occupied') return bed;
              // Skip first 2 occupied beds to avoid clearing key demo patients
              freed++;
              return {
                ...bed,
                state: 'dirty' as const,
                patientName: undefined,
                patientId: undefined,
                mrn: undefined,
                acuity: undefined,
                attending: undefined,
                losHours: undefined,
                stateChangedMinAgo: 0,
              };
            }),
          }));
        });
        showToast('3 patients discharged — beds turning over', 'info');
      },
    },
    {
      id: 'ems-inject',
      label: 'Add EMS Inbound',
      description: 'Single high-acuity run inbound',
      icon: <Zap size={13} strokeWidth={2} />,
      tone: 'warn',
      action: () => {
        const run = {
          unit: `Medic ${Math.floor(Math.random() * 50) + 1}`,
          mode: 'ground' as const,
          etaMinutes: Math.floor(Math.random() * 12) + 4,
          age: Math.floor(Math.random() * 50) + 25,
          sex: (Math.random() > 0.5 ? 'M' : 'F') as 'M' | 'F',
          chiefComplaint: 'Chest pain 45min, diaphoretic, ST changes anterolateral',
          activationLevel: 'STEMI' as const,
          fieldVitals: { heartRate: 108, systolic: 136, diastolic: 84, respRate: 22, spO2: 93 },
          fieldTreatment: 'ASA 324 PO · NTG SL x2 · 12L transmitted · heparin 5000u',
          destinationBay: 'Cath Lab',
        };
        publish('ems-inject', run);
        showToast(`EMS inbound — ${run.unit}, ETA ${run.etaMinutes}min`, 'info');
      },
    },
    {
      id: 'reset-all',
      label: 'Reset Simulation',
      description: 'Return all state to baseline',
      icon: <RotateCcw size={13} strokeWidth={2} />,
      action: () => {
        setSurgeState(INITIAL_SURGE_STATE);
        setUrgentTasks([]);
        setBedUnits(seedBedState());
        setPatients([...MOCK_PATIENTS]);
        setAdmissionQueue(INITIAL_ADMISSION_QUEUE);
        publish('ems-reset');
        showToast('Simulation reset to baseline', 'info');
      },
    },
  ], [surgeState.active]);

  const handleConfirmPlaybook = () => {
    setShowPlaybookModal(false);
    activateSurge();
    if (activeTab !== Tab.HORIZON) {
      setActiveTab(Tab.HORIZON);
    }
  };

  const acknowledgeTask = (taskId: string, deviceId: string) => {
    setUrgentTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, acknowledged: true, acknowledgedBy: deviceId, acknowledgedAt: Date.now() }
          : t,
      ),
    );
  };

  const handleLogin = (role: UserRole) => {
    const user = { ...USERS[role] };
    if (loginCount > 0) {
      if (role === UserRole.ER_PERSONNEL) {
        user.name = 'Dr. James Wilson';
        user.avatarInitials = 'JW';
      } else if (role === UserRole.MANAGER) {
        user.name = 'Michael Chang';
        user.avatarInitials = 'MC';
      } else if (role === UserRole.NURSE) {
        user.name = 'Sarah Jenkins';
        user.avatarInitials = 'SJ';
      }
    }
    setCurrentUser(user);
    setLoginCount((prev) => prev + 1);
    setShowShiftBriefing(true);
    showToast(`Logged in as ${user.name}`, 'info');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab(Tab.HORIZON);
    setSystemStatus('normal');
    setShowHandoverModal(false);
    setShowShiftBriefing(false);
    setShowSettings(false);
    setActionFilter('');
  };

  /**
   * Reset everything to a clean baseline — used by the Settings screen
   * between visitors at the demo stand. Resets all shared (realtime) state
   * plus the local-only state that would otherwise carry "the last
   * visitor's choices" into the next walk-up. `broadcastReset` signals
   * other connected devices so they all land on a fresh mock together.
   */
  const resetSimulation = useCallback(() => {
    // Cancel any pending surge auto stand-down timer — the reset
    // already clears surge state, so we don't want a stale timeout
    // to fire later and emit a duplicate stand-down toast.
    if (surgeAutoStandDownRef.current !== null) {
      window.clearTimeout(surgeAutoStandDownRef.current);
      surgeAutoStandDownRef.current = null;
    }

    // Shared state — restored to initial values, broadcasts to peers
    setSurgeState(INITIAL_SURGE_STATE);
    setUrgentTasks([]);
    setBedUnits(seedBedState());
    setAdmissionQueue(INITIAL_ADMISSION_QUEUE);
    setPatients([...MOCK_PATIENTS]);
    setClinicalNotes([]);
    setAlertAcks({});
    setBraceletPool(INITIAL_POOL);

    // Local-only state
    setGlobalHandoverNotes(null);
    setInitialPatientId(undefined);
    setActionFilter('');
    setSystemStatus('normal');
    setChatQuery('');

    // Clear any side-effect state from the EMS board / notifications
    publish('ems-reset');
    // Notify any other devices to clear their own realtime caches too
    broadcastReset();

    showToast('Simulation reset to baseline', 'info');
  }, [
    setSurgeState,
    setUrgentTasks,
    setBedUnits,
    setAdmissionQueue,
    setPatients,
    setClinicalNotes,
    setAlertAcks,
    setBraceletPool,
  ]);

  const handleConfirmHandover = (notes: string) => {
    if (notes.trim() && currentUser) {
      setGlobalHandoverNotes({
        author: currentUser.name,
        notes: notes,
      });
    }
    showToast('Shift handover complete. Logging out...', 'success');
    setTimeout(() => {
      handleLogout();
    }, 1500);
  };

  const navigateToTab = (tab: Tab) => {
    // Clear patient context when leaving Patients tab
    if (tab !== Tab.PATIENTS) setInitialPatientId(undefined);
    setActiveTab(tab);
  };

  const navigateToActionBoard = (filter: string) => {
    setActionFilter(filter);
    navigateToTab(Tab.ACTIONS);
  };

  // ══════════════════════════════════════════════════════════════════════
  // BOOT SCREEN — Tactical system-init sequence
  // ══════════════════════════════════════════════════════════════════════
  if (isBooting) {
    return <CinematicBoot onComplete={() => setIsBooting(false)} />;
  }

  // ══════════════════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════════════════
  if (!currentUser) {
    return (
      <>
        <ConnectionIndicator />
        {debugMode && <DebugPanel currentUser={null} />}
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // AUTHENTICATED SHELL
  // ══════════════════════════════════════════════════════════════════════
  const liveStatusTone = systemStatus === 'normal' ? 'ok' : systemStatus === 'stale' ? 'warn' : 'crit';
  const liveStatusLabel = systemStatus === 'normal' ? 'Live' : systemStatus === 'stale' ? 'Stale' : 'Manual';

  return (
    <>
      <ConnectionIndicator />
      {/* Auto-brief overlay: when an inbound EMS run hits ETA 2:00, a
          card slides in top-right with a "generating handoff brief"
          shimmer + typewriter. Composed deterministically from the
          run's real fields (age, sex, vitals, treatment, bay) plus
          scenario context — see components/EmsAutoBrief.tsx. */}
      <EmsAutoBrief activeScenario={activeScenario} />
      {debugMode && <DebugPanel currentUser={currentUser} />}

      {showShiftBriefing && (
        <ShiftHandoffModal
          type="in"
          role={currentUser.role}
          onComplete={() => setShowShiftBriefing(false)}
          loginCount={loginCount}
        />
      )}

      {showHandoverModal && (
        <ShiftHandoffModal
          type="out"
          role={currentUser.role}
          onComplete={handleConfirmHandover}
          onCancel={() => setShowHandoverModal(false)}
        />
      )}

      {/* ── TACTICAL TOAST ───────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{
              type: 'spring',
              stiffness: 520,
              damping: 34,
              mass: 0.7,
            }}
            style={{
              position: 'fixed',
              top: CHROME.headerHeight + 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              background: COLORS.surface,
              border: `1px solid ${
                toast.type === 'success'
                  ? COLORS.ok
                  : toast.type === 'error'
                  ? COLORS.crit
                  : COLORS.info
              }`,
              borderRadius: RADIUS.sm,
              boxShadow: SHADOW.panel,
              fontFamily: FONTS.mono,
            }}
          >
            <CornerBracket
              position="tl"
              color={
                toast.type === 'success'
                  ? COLORS.ok
                  : toast.type === 'error'
                  ? COLORS.crit
                  : COLORS.info
              }
            />
            <CornerBracket
              position="tr"
              color={
                toast.type === 'success'
                  ? COLORS.ok
                  : toast.type === 'error'
                  ? COLORS.crit
                  : COLORS.info
              }
            />
            <CornerBracket
              position="bl"
              color={
                toast.type === 'success'
                  ? COLORS.ok
                  : toast.type === 'error'
                  ? COLORS.crit
                  : COLORS.info
              }
            />
            <CornerBracket
              position="br"
              color={
                toast.type === 'success'
                  ? COLORS.ok
                  : toast.type === 'error'
                  ? COLORS.crit
                  : COLORS.info
              }
            />
            {toast.type === 'success' ? (
              <CheckCircle2 size={14} color={COLORS.ok} />
            ) : toast.type === 'error' ? (
              <AlertOctagon size={14} color={COLORS.crit} />
            ) : (
              <Activity size={14} color={COLORS.info} />
            )}
            <Mono
              tone={toast.type === 'success' ? 'ok' : toast.type === 'error' ? 'crit' : 'secondary'}
              size="base"
              style={{ color: toast.type === 'success' ? COLORS.ok : toast.type === 'error' ? COLORS.crit : COLORS.info }}
            >
              {toast.message}
            </Mono>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatAssistant
        currentUser={currentUser}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        initialQuery={chatQuery}
        loginCount={loginCount}
      />

      {/* Settings screen — shared between mobile and desktop, full-screen overlay. */}
      <SettingsScreen
        open={showSettings}
        onClose={() => setShowSettings(false)}
        currentUser={currentUser}
        onReset={resetSimulation}
        onLogout={() => {
          setShowSettings(false);
          handleLogout();
        }}
        variant={isMobile ? 'mobile' : 'desktop'}
        braceletPool={braceletPool}
        onUpdateBraceletPool={setBraceletPool}
        // ── Scenario controls ──
        activeScenario={activeScenario}
        scenarioTick={scenarioTick}
        onStartScenario={startScenario}
        onStopScenario={stopScenario}
        // ── Manual surge toggle (independent of scenarios) ──
        isSurgeActive={isSurgeActive}
        onActivateSurge={activateSurge}
        onDeactivateSurge={deactivateSurge}
      />

      {isMobile ? (
        <MobileView
          currentUser={currentUser}
          isSurgeActive={isSurgeActive}
          surgeActivatedAt={surgeState.activatedAt}
          urgentTasks={urgentTasks}
          onAcknowledgeTask={acknowledgeTask}
          onActivateSurge={activateSurge}
          onLogout={handleLogout}
          onOpenSettings={() => setShowSettings(true)}
          showToast={showToast}
          onOpenChat={(query) => {
            setChatQuery(query || '');
            setShowChat(true);
          }}
          systemStatus={systemStatus}
          // ── Cross-device shared state & callbacks ──
          bedUnits={bedUnits}
          admissionQueue={admissionQueue}
          patients={patients}
          clinicalNotes={clinicalNotes}
          alertAcks={alertAcks}
          braceletPool={braceletPool}
          availableBraceletNumbers={availableBraceletNumbers}
          onAssignBed={assignBedToAdmission}
          onSubmitAdmission={submitNewAdmission}
          onDischargePatient={dischargePatient}
          onUpdateVitals={updatePatientVitals}
          onAddNote={addClinicalNote}
          onAcknowledgeAlert={acknowledgeAlert}
          activeScenario={activeScenario}
        />
      ) : (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: COLORS.bg,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sans,
            overflow: 'hidden',
            border: systemStatus === 'manual' ? `2px solid ${COLORS.warn}` : 'none',
          }}
        >
          {/* Subtle CRT scanline overlay — pure tactile texture, doesn't
              fight dashboard data. Sits under all content. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: SCANLINES.subtle,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          {/* ═══════════════════════════════════════════════════════
              TOP HUD STRIP — header + nav
              ═══════════════════════════════════════════════════════ */}
          <header
            style={{
              height: CHROME.headerHeight,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${SPACE.base}px`,
              background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bg} 100%)`,
              borderBottom: `1px solid ${COLORS.border}`,
              position: 'relative',
              zIndex: 40,
            }}
          >
            {/* ── Left cluster: brand + status + nav ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isCompactNav ? SPACE.md : SPACE.lg, minWidth: 0 }}>
              {/* Brand mark */}
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexShrink: 0 }}>
                <div
                  style={{
                    position: 'relative',
                    width: 24,
                    height: 24,
                    background: COLORS.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    borderRadius: RADIUS.sm,
                    boxShadow: `0 0 16px ${COLORS.accentGlow}`,
                  }}
                >
                  P
                  <CornerBracket position="tl" color={COLORS.textPrimary} size={4} thickness={1} inset={-2} />
                  <CornerBracket position="br" color={COLORS.textPrimary} size={4} thickness={1} inset={-2} />
                </div>
                {!isCompactNav && (
                  <BracketLabel tone="accent" size="base">
                    PULSE
                  </BracketLabel>
                )}
                <span style={{ color: COLORS.textDim, margin: '0 2px' }}>│</span>
                <StatusPill label={liveStatusLabel} tone={liveStatusTone} pulse />
                {/* Scenario badge — persistent HUD indicator when a
                    scenario is running. Tap to jump back to Settings
                    → Simulation so the operator can stop or swap. */}
                {activeScenario && (
                  <ScenarioHudBadge
                    severity={activeScenario.severity}
                    remainingMs={scenarioTick.remainingMs}
                    onClick={() => setShowSettings(true)}
                  />
                )}
              </div>

              {/* Nav — bracket underline on active */}
              <nav style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <NavButton
                      key={item.id}
                      onClick={() => navigateToTab(item.id)}
                      active={isActive}
                      compact={isCompactNav}
                      title={isCompactNav ? item.label : undefined}
                    >
                      <Icon size={16} strokeWidth={2} />
                      {!isCompactNav && <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>}
                    </NavButton>
                  );
                })}
              </nav>
            </div>

            {/* ── Right cluster: clock + chat + notifications + user + end shift ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isCompactNav ? SPACE.sm : SPACE.md, flexShrink: 0 }}>
              <Mono tone="secondary" size={isCompactNav ? 'sm' : 'base'}>
                {clockStr}{isCompactNav ? '' : ' UTC'}
              </Mono>
              <span style={{ color: COLORS.textDim }}>│</span>

              {/* Chat */}
              <IconButton
                active={showChat}
                onClick={() => {
                  setShowChat(!showChat);
                  if (showNotifications) setShowNotifications(false);
                }}
                label="Assistant"
              >
                <MessageSquare size={16} strokeWidth={2} />
              </IconButton>

              {/* Notifications */}
              <div style={{ position: 'relative' }}>
                <IconButton
                  active={showNotifications}
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (showChat) setShowChat(false);
                  }}
                  label="Alerts"
                  badge
                >
                  <Bell size={16} strokeWidth={2} />
                </IconButton>

                <AnimatePresence>
                  {showNotifications && (
                    <NotificationsDropdown
                      notifications={notifications}
                      onClose={() => setShowNotifications(false)}
                      onHandoverClick={(message) => {
                        setChatQuery(
                          `I am taking over the shift. Here are the handover notes from the previous shift: "${message}". What should I prioritize first based on these notes and current system vitals?`,
                        );
                        setShowNotifications(false);
                        setShowChat(true);
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>

              <span style={{ color: COLORS.textDim }}>│</span>

              {/* User info */}
              {!isCompactNav && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 2,
                    lineHeight: 1,
                  }}
                >
                  <Mono tone="muted" size="xs">
                    {currentUser.role}
                  </Mono>
                  <span
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 12,
                      fontWeight: 500,
                      color: COLORS.textPrimary,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {currentUser.name}
                  </span>
                </div>
              )}
              {isCompactNav && (
                <div
                  title={`${currentUser.name} · ${currentUser.role}`}
                  style={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: COLORS.surfaceElev,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    color: COLORS.textPrimary,
                    fontWeight: 600,
                  }}
                >
                  {currentUser.avatarInitials}
                </div>
              )}

              <IconButton
                onClick={() => setShowSettings(true)}
                label="Settings"
              >
                <SlidersHorizontal size={14} strokeWidth={2} />
              </IconButton>

              {isCompactNav ? (
                <IconButton
                  onClick={() => setShowHandoverModal(true)}
                  label="End Shift"
                >
                  <Clock size={14} strokeWidth={2} />
                </IconButton>
              ) : (
                <TacticalButton
                  variant="secondary"
                  size="sm"
                  icon={<Clock size={12} strokeWidth={2} />}
                  onClick={() => setShowHandoverModal(true)}
                >
                  End Shift
                </TacticalButton>
              )}

              {debugMode && (
                <IconButton
                  onClick={() => setSystemStatus((s) => (s === 'normal' ? 'stale' : 'normal'))}
                  label="Simulate Outage"
                >
                  <AlertOctagon size={16} strokeWidth={2} />
                </IconButton>
              )}
            </div>
          </header>

          {/* ═══════════════════════════════════════════════════════
              MAIN CONTENT AREA
              ═══════════════════════════════════════════════════════ */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {activeTab === Tab.HORIZON && (
                <PulseHorizon
                  onActivatePlaybook={handleActivatePlaybook}
                  isSurgeActive={isSurgeActive}
                  currentUser={currentUser}
                  systemStatus={systemStatus}
                  setSystemStatus={setSystemStatus}
                  showToast={showToast}
                  onNavigateToActionBoard={navigateToActionBoard}
                  onNavigateTab={(tab) => navigateToTab(tab as Tab)}
                  loginCount={loginCount}
                  activeScenario={activeScenario}
                />
              )}
              {activeTab === Tab.PATIENTS && (
                <PatientsPage
                  currentUser={currentUser}
                  showToast={showToast}
                  initialPatientId={initialPatientId}
                  patients={patients}
                  clinicalNotes={clinicalNotes}
                  onUpdateVitals={updatePatientVitals}
                  onAddNote={addClinicalNote}
                  onDischargePatient={dischargePatient}
                />
              )}
              {activeTab === Tab.LIVE_OPS && (
                <LiveOps
                  currentUser={currentUser}
                  systemStatus={systemStatus}
                  showToast={showToast}
                  onNavigateToActionBoard={navigateToActionBoard}
                  loginCount={loginCount}
                  isSurgeActive={isSurgeActive}
                />
              )}
              {activeTab === Tab.BED_BOARD && (
                <BedBoard
                  display="full"
                  units={bedUnits}
                  surgeActive={isSurgeActive}
                  open
                  embedded
                  onClose={() => setActiveTab(Tab.HORIZON)}
                  role={currentUser.role}
                  onNavigateToPatient={(patientId) => {
                    setInitialPatientId(patientId);
                    navigateToTab(Tab.PATIENTS);
                  }}
                />
              )}
              {activeTab === Tab.ADMISSIONS && (
                <AdmitFlow
                  open
                  embedded
                  onClose={() => setActiveTab(Tab.HORIZON)}
                  showToast={showToast}
                  bedUnits={bedUnits}
                  admissionQueue={admissionQueue}
                  onAssignBed={assignBedToAdmission}
                  onSubmitAdmission={submitNewAdmission}
                  onNavigateToPatient={(patientId) => {
                    setInitialPatientId(patientId);
                    navigateToTab(Tab.PATIENTS);
                  }}
                />
              )}
              {activeTab === Tab.ALERTS && (
                <AlertsCenter
                  open
                  embedded
                  onClose={() => setActiveTab(Tab.HORIZON)}
                  showToast={showToast}
                  role={currentUser.role}
                />
              )}
              {activeTab === Tab.STAFFING && (
                <WorkforceCoverage
                  open
                  embedded
                  onClose={() => setActiveTab(Tab.HORIZON)}
                  showToast={showToast}
                  role={currentUser.role}
                />
              )}
              {activeTab === Tab.PLAYBOOKS && <Playbooks onActivate={handleActivatePlaybook} />}
              {activeTab === Tab.ACTIONS && (
                <ActionBoard
                  currentUser={currentUser}
                  systemStatus={systemStatus}
                  showToast={showToast}
                  initialFilter={actionFilter}
                  isSurgeActive={isSurgeActive}
                />
              )}
              {activeTab === Tab.ROSTER && <Roster currentUser={currentUser} showToast={showToast} />}
              {activeTab === Tab.BRIEF_ME && (
                <BriefMe isSurgeActive={isSurgeActive} currentUser={currentUser} showToast={showToast} />
              )}
              {activeTab === Tab.REPLAY && <Replay showToast={showToast} />}
            </main>

            <CommandSidebar
              isSurgeActive={isSurgeActive}
              surgeActivatedAt={surgeState.activatedAt}
              urgentTasks={urgentTasks}
              onActivateSurge={activateSurge}
              onDeactivateSurge={deactivateSurge}
              simControls={simControls}
            />
          </div>

          {/* ═══════════════════════════════════════════════════════
              BOTTOM HUD STRIP — system ticker
              ═══════════════════════════════════════════════════════ */}
          <HudStrip side="bottom">
            {(() => {
              // NEDOCS + alert pills track the scenario so the ambient
              // bottom strip moves when a sim is running. Baseline
              // otherwise (keeps the demo's "dangerous" vibe).
              const nedocs = Math.round(metricValue('nedocsScore', activeScenario));
              const alerts = Math.round(metricValue('activeAlerts', activeScenario));
              const codes = Math.round(metricValue('activeCodes', activeScenario));
              const nedocsTone: 'ok' | 'warn' | 'crit' =
                nedocs >= 160 ? 'crit' : nedocs >= 120 ? 'warn' : 'ok';
              const nedocsLabel = `NEDOCS ${nedocs} · ${
                nedocs >= 160 ? 'Dangerous' : nedocs >= 120 ? 'Severe' : nedocs >= 100 ? 'Busy' : 'Normal'
              }`;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.base, flex: 1, minWidth: 0 }}>
                    <StatusPill label={nedocsLabel} tone={nedocsTone} pulse={nedocsTone === 'crit'} />
                    <span style={{ color: COLORS.textDim }}>│</span>
                    <Mono tone="secondary">Weather · Heavy Rain 16:00</Mono>
                    <span style={{ color: COLORS.textDim }}>│</span>
                    <Mono tone="secondary">
                      Alerts · {alerts}{codes > 0 ? ` · Codes · ${codes}` : ''}
                    </Mono>
                    {isSurgeActive && (
                      <>
                        <span style={{ color: COLORS.textDim }}>│</span>
                        <StatusPill label="SURGE MODE · ACTIVE" tone="crit" pulse />
                      </>
                    )}
                    {activeScenario && (
                      <>
                        <span style={{ color: COLORS.textDim }}>│</span>
                        <StatusPill
                          label={`SIM · S${activeScenario.severity} · ${formatScenarioRemaining(scenarioTick.remainingMs)}`}
                          tone={activeScenario.severity === 3 ? 'crit' : activeScenario.severity === 2 ? 'warn' : 'ok'}
                          pulse={activeScenario.severity === 3}
                        />
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flexShrink: 0 }}>
                    <Mono tone="muted">Network</Mono>
                    <StatusPill label="Stable" tone="ok" />
                  </div>
                </>
              );
            })()}
          </HudStrip>

          {/* Modals */}
          {showPlaybookModal && (
            <PlaybookActivation
              onClose={() => setShowPlaybookModal(false)}
              onConfirm={handleConfirmPlaybook}
            />
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tactical Boot Screen
// ═══════════════════════════════════════════════════════════════════════
const TacticalBootScreen: React.FC = () => {
  const [now] = useState(() => new Date());
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '.');

  const lines = [
    { tag: 'SYSTEM', msg: 'Initializing core predictive models', status: 'OK', delay: 0.1 },
    { tag: 'NETWORK', msg: 'Establishing secure EHR uplink', status: 'OK', delay: 0.35 },
    { tag: 'DATA', msg: 'Synchronizing regional telemetry', status: 'OK', delay: 0.6 },
    { tag: 'AUTH', msg: 'Verifying personnel credentials', status: 'WAIT', delay: 0.85 },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.mono,
        color: COLORS.textSecondary,
        overflow: 'hidden',
      }}
    >
      {/* dot grid */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          opacity: 0.35,
          maskImage:
            'radial-gradient(ellipse 70% 50% at center, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 50% at center, black 40%, transparent 100%)',
        }}
      />
      {/* rose glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 40% at 50% 110%, ${COLORS.accentDim}, transparent 60%)`,
        }}
      />
      {/* scan line */}
      <ScanningLine />

      <div
        style={{
          width: '100%',
          maxWidth: 640,
          padding: SPACE['2xl'],
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Brand block */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: MOTION.ease }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.lg,
            marginBottom: SPACE['3xl'],
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 64,
              height: 64,
              background: COLORS.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.sans,
              fontSize: 36,
              fontWeight: 700,
              color: COLORS.textPrimary,
              borderRadius: RADIUS.sm,
              boxShadow: `0 0 40px ${COLORS.accent}66`,
              animation: 'accent-pulse 2s ease-in-out infinite',
            }}
          >
            P
            <CornerBracket position="tl" color={COLORS.textPrimary} size={8} thickness={1.5} inset={-3} />
            <CornerBracket position="tr" color={COLORS.textPrimary} size={8} thickness={1.5} inset={-3} />
            <CornerBracket position="bl" color={COLORS.textPrimary} size={8} thickness={1.5} inset={-3} />
            <CornerBracket position="br" color={COLORS.textPrimary} size={8} thickness={1.5} inset={-3} />
          </div>
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontFamily: FONTS.sans,
                fontSize: TYPE.display.size,
                fontWeight: TYPE.display.weight,
                letterSpacing: '0.16em',
                lineHeight: 0.95,
                margin: 0,
                marginBottom: 6,
                color: COLORS.textPrimary,
              }}
            >
              PULSE
            </h1>
            <Mono tone="muted" size="xs">
              Predictive Unified Logistics &amp; Surge Engine
            </Mono>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
            }}
          >
            <Mono tone="dim" size="xs">
              BUILD {dateStr}
            </Mono>
            <Mono tone="dim" size="xs">
              NODE ER-01
            </Mono>
          </div>
        </motion.div>

        {/* Boot log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {lines.map((l) => (
            <motion.div
              key={l.tag}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: l.delay, duration: 0.4, ease: MOTION.ease }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.base,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
              }}
            >
              <Mono tone="dim" size="xs" style={{ minWidth: 72 }}>
                [ {l.tag} ]
              </Mono>
              <span
                style={{
                  flex: 1,
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  letterSpacing: '0.02em',
                }}
              >
                {l.msg}…
              </span>
              <Mono
                tone={l.status === 'OK' ? 'ok' : 'accent'}
                size="xs"
                style={{
                  animation: l.status === 'WAIT' ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
                }}
              >
                {l.status}
              </Mono>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: SPACE['3xl'],
            height: 2,
            width: '100%',
            background: COLORS.border,
            borderRadius: RADIUS.full,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              background: COLORS.accent,
              width: '100%',
              transformOrigin: 'left',
              animation: 'scale-x 2.2s ease-in-out forwards',
              boxShadow: `0 0 10px ${COLORS.accentGlow}`,
            }}
          />
        </div>

        {/* Footer meta */}
        <div
          style={{
            marginTop: SPACE.lg,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Mono tone="dim" size="xs">
            // BIOMETRIC AUTH · TLS 1.3 · SESSION-BOUND
          </Mono>
          <StatusPill label="System Online" tone="ok" />
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Small shell primitives — defined locally because they're shell-specific
// ═══════════════════════════════════════════════════════════════════════

/** Top-nav button — tactical hover + active states */
const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
  title?: string;
}> = ({ active, onClick, children, compact, title }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: compact ? 'center' : 'flex-start',
        gap: compact ? 0 : 8,
        padding: compact ? '0' : '8px 12px',
        width: compact ? 34 : undefined,
        height: compact ? 34 : undefined,
        background: active ? COLORS.surfaceElev : hovered ? COLORS.surface : 'transparent',
        border: `1px solid ${active ? COLORS.border : 'transparent'}`,
        borderRadius: RADIUS.sm,
        color: active ? COLORS.textPrimary : hovered ? COLORS.textSecondary : COLORS.textMuted,
        fontFamily: FONTS.sans,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        letterSpacing: '-0.003em',
        transition: cssTransition(),
      }}
    >
      {active && (
        <>
          <CornerBracket position="tl" color={COLORS.borderHover} size={5} thickness={1} inset={-1} />
          <CornerBracket position="br" color={COLORS.borderHover} size={5} thickness={1} inset={-1} />
        </>
      )}
      {children}
    </button>
  );
};

/** Small icon button for chat/bell/etc */
const IconButton: React.FC<{
  active?: boolean;
  onClick: () => void;
  label: string;
  badge?: boolean;
  children: React.ReactNode;
}> = ({ active, onClick, label, badge, children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: 34,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? COLORS.surfaceElev : hovered ? COLORS.surface : 'transparent',
        border: `1px solid ${active ? COLORS.borderHover : hovered ? COLORS.border : 'transparent'}`,
        borderRadius: RADIUS.sm,
        color: active ? COLORS.textPrimary : hovered ? COLORS.textPrimary : COLORS.textSecondary,
        cursor: 'pointer',
        transition: cssTransition(),
      }}
    >
      {children}
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 6,
            height: 6,
            borderRadius: RADIUS.full,
            background: COLORS.accent,
            boxShadow: `0 0 6px ${COLORS.accent}`,
          }}
        />
      )}
    </button>
  );
};

/** Tactical notifications dropdown */
const NotificationsDropdown: React.FC<{
  notifications: Array<{
    id: string | number;
    title: string;
    message: string;
    time: string;
    type: 'info' | 'warning' | 'critical';
    isHandover?: boolean;
  }>;
  onClose: () => void;
  onHandoverClick: (message: string) => void;
}> = ({ notifications, onClose, onHandoverClick }) => (
  <motion.div
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
    style={{
      position: 'absolute',
      right: 0,
      top: 'calc(100% + 8px)',
      width: 340,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      boxShadow: SHADOW.panel,
      zIndex: 50,
      overflow: 'hidden',
    }}
  >
    <CornerBracket position="tl" color={COLORS.borderStrong} size={8} />
    <CornerBracket position="br" color={COLORS.borderStrong} size={8} />
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surfaceElev,
      }}
    >
      <BracketLabel tone="warn" size="base">
        SYSTEM ALERTS
      </BracketLabel>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: COLORS.textMuted,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          onClick={() => {
            if (n.isHandover) onHandoverClick(n.message);
          }}
          style={{
            padding: `${SPACE.md}px ${SPACE.md}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            cursor: n.isHandover ? 'pointer' : 'default',
            transition: 'background 160ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surfaceElev)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 4,
            }}
          >
            <Mono
              tone={n.type === 'critical' ? 'crit' : n.type === 'warning' ? 'warn' : 'accent'}
              size="xs"
            >
              {n.title}
            </Mono>
            <Mono tone="dim" size="xs">
              {n.time}
            </Mono>
          </div>
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12.5,
              color: COLORS.textSecondary,
              lineHeight: 1.4,
              margin: 0,
              letterSpacing: '-0.003em',
            }}
          >
            {n.message}
          </p>
        </div>
      ))}
    </div>
    <div
      style={{
        padding: SPACE.sm,
        background: COLORS.surfaceElev,
        borderTop: `1px solid ${COLORS.border}`,
        textAlign: 'center',
      }}
    >
      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: COLORS.textMuted,
          fontFamily: FONTS.mono,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        // View All Logs
      </button>
    </div>
  </motion.div>
);

export default App;
