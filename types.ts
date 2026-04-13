export enum UserRole {
  MANAGER = 'Floor Manager',
  NURSE = 'Nurse',
  ER_PERSONNEL = 'ER Personnel',
}

export interface UserProfile {
  role: UserRole;
  name: string;
  title: string;
  avatarInitials: string;
}

export enum Tab {
  HORIZON = 'Pulse Horizon',
  PATIENTS = 'Patients',
  BED_BOARD = 'Bed Board',
  ADMISSIONS = 'Admissions',
  LIVE_OPS = 'Live Ops',
  PLAYBOOKS = 'Playbooks',
  ACTIONS = 'Actions',
  ALERTS = 'Alerts',
  STAFFING = 'Staffing',
  BRIEF_ME = 'Brief Me',
  REPLAY = 'Replay',
  ROSTER = 'Roster',
}

export enum ConfidenceLevel {
  FULL = 'Full',
  PARTIAL = 'Partial',
  MANUAL = 'Manual',
}

export enum Status {
  NORMAL = 'Normal',
  WARNING = 'Warning',
  CRITICAL = 'Critical',
}

export interface MetricDriver {
  id: string;
  name: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  status: Status;
  impact: number; // 0-100 impact on overall load
}

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  dueTime: string; // HH:mm
  status: 'New' | 'In Progress' | 'On Hold' | 'Completed' | 'Canceled';
  priority: 'High' | 'Medium' | 'Low';
  isDecision?: boolean;
  comments?: string[];
  history?: { timestamp: string; action: string; user: string }[];
  cancelReason?: string;
}

export interface LogEvent {
  id: string;
  time: string;
  type: 'METRIC' | 'DECISION' | 'ACTION' | 'NOTE';
  description: string;
  detail?: string;
}

export interface PlaybookStep {
  id: string;
  description: string;
  role: string;
  status: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  triggerCondition: string;
  approverRole: string;
  steps: PlaybookStep[];
  estimatedImpact: string;
}

export interface ZoneStatus {
  id: string;
  name: string;
  occupancy: number; // percentage
  capacity: number;
  patients: number;
  status: Status;
  trend: 'Rising' | 'Falling' | 'Stable';
  staffing: string;
  waitTime: string;
}

// ─────────────────────────────────────────────────────────────────────────
// CLINICAL DATA MODEL
//
// FHIR R4-aligned clinical shapes. We do not implement the full FHIR spec,
// only the subset we actually render — `Patient`, `Encounter`, `Vital`,
// `Allergy`, `Problem`, `MedicationOrder`, `MedicationAdministration`,
// `LabResult`, `Note`, and the small enums that glue them together.
//
// The reason these live in `types.ts` rather than `types/clinical.ts`:
// keep the codebase flat while we iterate. When the surface area grows
// past ~300 lines of clinical types, split into `types/clinical.ts`.
//
// Every clinical interface is designed to round-trip cleanly against a
// FHIR R4 server — naming and cardinality match the spec so the
// FHIR adapter layer (see docs/improvement-ideas.md T2.22) is a pure
// mapping operation. Anything that can't be represented in FHIR lives
// in a `pulse:` extension field to keep the boundary clean.
// ─────────────────────────────────────────────────────────────────────────

/** Code status / resuscitation preference (POLST-aligned). */
export type CodeStatus =
  | 'FULL'        // Full code — attempt all resuscitation measures
  | 'DNR'         // Do Not Resuscitate — no CPR
  | 'DNI'         // Do Not Intubate — no advanced airway
  | 'DNR/DNI'     // Both — common combination
  | 'COMFORT'     // Comfort care only / hospice
  | 'LIMITED'     // Limited interventions (e.g., no pressors)
  | 'UNKNOWN';    // Status not yet documented

/** Isolation precaution level per CDC transmission-based precautions. */
export type IsolationPrecaution =
  | 'NONE'
  | 'CONTACT'     // MRSA, C. diff, enteric pathogens
  | 'DROPLET'     // Influenza, pertussis, meningitis
  | 'AIRBORNE'    // TB, measles, varicella
  | 'PROTECTIVE'; // Immunocompromised reverse isolation

/** ESI (Emergency Severity Index) 1–5 triage acuity. */
export type EsiLevel = 1 | 2 | 3 | 4 | 5;

/** Allergy severity per FHIR AllergyIntolerance.criticality. */
export type AllergySeverity = 'low' | 'high' | 'unable-to-assess';

/** Allergy verification status — `confirmed` is the clinical gold standard. */
export type AllergyVerification = 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';

export interface Allergy {
  id: string;
  substance: string;              // e.g. "Penicillin", "Latex", "Shellfish"
  rxnormCode?: string;            // RxNorm for drug allergies
  snomedCode?: string;            // SNOMED for non-drug allergies
  reaction: string;               // e.g. "Anaphylaxis", "Hives", "GI upset"
  severity: AllergySeverity;
  verification: AllergyVerification;
  onset?: string;                 // ISO date — "2018-06-14"
  recordedBy?: string;            // actor who documented the allergy
  note?: string;
}

/** Problem / diagnosis — FHIR Condition resource. */
export type ProblemStatus = 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';

export interface Problem {
  id: string;
  display: string;                // human-readable: "Type 2 diabetes mellitus"
  icd10Code?: string;             // e.g. "E11.9"
  snomedCode?: string;            // e.g. "44054006"
  status: ProblemStatus;
  onsetDate?: string;             // ISO — "2019-03-22"
  lastReviewed?: string;          // ISO datetime
  priority?: number;              // 1 = highest, used for display ordering
  note?: string;
}

/** One set of vital signs captured at a point in time. */
export interface Vital {
  id: string;
  timestamp: string;              // ISO datetime
  actorId?: string;               // who recorded
  heartRate?: number;             // bpm
  systolic?: number;              // mmHg
  diastolic?: number;             // mmHg
  mapEstimated?: number;          // mean arterial pressure (computed if not given)
  respRate?: number;              // breaths/min
  spO2?: number;                  // %
  fio2?: number;                  // inspired O2 fraction 0.21–1.00
  temperature?: number;           // Celsius
  painScore?: number;             // 0–10
  gcs?: number;                   // Glasgow Coma Scale 3–15
  // For critical patients on pressors, weight bands, etc.
  weightKg?: number;
}

/** Admission / encounter class per FHIR Encounter.class. */
export type EncounterClass =
  | 'EMERGENCY'
  | 'INPATIENT'
  | 'OBSERVATION'
  | 'AMBULATORY'
  | 'VIRTUAL';

export type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'triaged'
  | 'in-progress'
  | 'onleave'
  | 'finished'
  | 'cancelled';

/** One hospital visit. A patient can have many. */
export interface Encounter {
  id: string;                     // FIN / CSN
  patientId: string;
  class: EncounterClass;
  status: EncounterStatus;
  admittedAt: string;             // ISO datetime
  dischargedAt?: string;          // ISO datetime
  location: {
    zone?: string;                // e.g. "ED-Acute"
    bed?: string;                 // e.g. "4A"
  };
  chiefComplaint?: string;
  esi?: EsiLevel;
  attendingId?: string;
  nurseId?: string;
  arrivalMode?: 'ambulatory' | 'ems' | 'private-vehicle' | 'transfer' | 'walk-in';
  payer?: {
    primary?: string;
    secondary?: string;
    memberId?: string;
    groupId?: string;
  };
}

/** Patient — FHIR Patient resource. */
export interface Patient {
  id: string;                     // internal PULSE ID
  mrn: string;                    // medical record number
  name: {
    given: string;                // first
    family: string;               // last
    preferred?: string;
  };
  birthDate: string;              // ISO — "1958-04-11"
  sex: 'M' | 'F' | 'X' | 'U';     // X = nonbinary, U = unknown
  preferredLanguage: string;      // ISO 639-1 — "en", "es"
  needsInterpreter?: boolean;
  weightKg?: number;
  heightCm?: number;
  // Clinical safety header — the five data points every chart banner
  // must render at the top of the view.
  codeStatus: CodeStatus;
  isolation: IsolationPrecaution;
  allergies: Allergy[];           // empty array = NKA (no known allergies)
  problems: Problem[];            // active problem list
  advanceDirective?: boolean;     // true = POLST / AD on file
  // Clinical decision surface
  vitalsHistory: Vital[];         // ordered oldest → newest
  // Encounter — typically the current active encounter. A real
  // deployment would model multiple encounters; we track the active
  // one for demo simplicity and stash past ones in `pastEncounters`.
  currentEncounter?: Encounter;
  pastEncounters?: Encounter[];
  // Social determinants (T2.33). All optional — the chips hide if
  // nothing is known.
  socialDeterminants?: {
    housing?: 'stable' | 'unstable' | 'unhoused';
    foodSecurity?: 'secure' | 'risk' | 'insecure';
    transportation?: 'has-reliable' | 'inconsistent' | 'none';
    caregiverSupport?: boolean;
    utilitiesSecure?: boolean;
  };
  // Photo placeholder — replaced with initials in PHI-mask mode.
  avatarInitials?: string;
}

/** Computed early warning score result for one vital set. */
export interface EarlyWarningScore {
  /** Score name. */
  name: 'MEWS' | 'NEWS2' | 'qSOFA';
  /** Numeric total. */
  value: number;
  /** Maximum possible score — used for visual scale. */
  maxValue: number;
  /** Risk bucket per published thresholds. */
  risk: 'low' | 'moderate' | 'high' | 'critical';
  /** One-line guidance text — what to do about the score. */
  action: string;
  /** Which vitals drove the score, for audit + breakdown. */
  breakdown: Array<{
    parameter: string;
    rawValue: number | string | null;
    points: number;
  }>;
}

/** Medication order — FHIR MedicationRequest. */
export type MedOrderStatus =
  | 'draft'
  | 'active'
  | 'on-hold'
  | 'stopped'
  | 'completed'
  | 'cancelled';

export interface MedicationOrder {
  id: string;
  patientId: string;
  encounterId?: string;
  medication: string;             // display name: "Amoxicillin 500 mg capsule"
  rxnormCode?: string;
  dose: string;                   // "500 mg", "2 mg/kg"
  route: 'PO' | 'IV' | 'IM' | 'SC' | 'PR' | 'INH' | 'TOPICAL' | 'SL' | 'OTHER';
  frequency: string;              // "q6h", "BID", "PRN pain"
  indication?: string;
  orderedAt: string;              // ISO datetime
  orderedBy: string;              // provider ID
  status: MedOrderStatus;
  stopAt?: string;                // ISO datetime
  priorityHigh?: boolean;         // flag for narcotics/insulin/chemo (requires witness)
}

/** One administration event against a MedicationOrder (the MAR). */
export interface MedicationAdministration {
  id: string;
  orderId: string;
  patientId: string;
  medication: string;
  doseGiven: string;
  route: MedicationOrder['route'];
  administeredAt: string;         // ISO datetime
  administeredBy: string;         // nurse actor ID
  witnessedBy?: string;           // second nurse actor ID (for high-alert meds)
  status: 'given' | 'held' | 'refused' | 'wasted';
  reasonIfNotGiven?: string;
  bcmaVerified?: boolean;         // true if scanned match (patient + med)
}

/** Lab result — FHIR Observation of category `laboratory`. */
export interface LabResult {
  id: string;
  patientId: string;
  encounterId?: string;
  name: string;                   // "Troponin I", "White blood cell count"
  loincCode?: string;
  value: number | string;
  unit?: string;
  referenceLow?: number;
  referenceHigh?: number;
  /** Abnormal flag: H = high, L = low, HH = critical high, LL = critical low. */
  flag?: 'N' | 'H' | 'L' | 'HH' | 'LL';
  collectedAt: string;
  resultedAt: string;
  status: 'preliminary' | 'final' | 'corrected' | 'cancelled';
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

/** Clinical note — SOAP, I-PASS, nursing progress, history & physical. */
export interface ClinicalNote {
  id: string;
  patientId: string;
  encounterId?: string;
  type: 'SOAP' | 'I-PASS' | 'NURSING' | 'H&P' | 'PROGRESS' | 'DISCHARGE' | 'CONSULT';
  authorId: string;
  createdAt: string;
  updatedAt?: string;
  signed?: boolean;
  signedAt?: string;
  content: string;                // markdown for now; structured later
}

/** Immutable audit-log entry (T1.6). */
export interface AuditEntry {
  id: string;
  timestamp: string;              // ISO datetime
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;                 // verb: "administer_med", "change_code_status", "ack_critical_lab"
  targetType: string;             // "Patient" | "Encounter" | "Task" | ...
  targetId: string;
  summary: string;                // human-readable one-line
  beforeJson?: string;            // JSON snapshot of the before-state
  afterJson?: string;             // JSON snapshot of the after-state
  reason?: string;
}

/** EMS inbound entry (T2.10). */
export interface EmsInbound {
  id: string;
  unit: string;                   // "Medic 14", "Air 2"
  mode: 'ground' | 'air';
  etaMinutes: number;             // decrements over time
  age?: number;
  sex?: Patient['sex'];
  chiefComplaint: string;
  activationLevel?: 'TRAUMA_1' | 'TRAUMA_2' | 'STROKE' | 'STEMI' | 'SEPSIS' | 'NONE';
  fieldVitals?: Pick<Vital, 'heartRate' | 'systolic' | 'diastolic' | 'respRate' | 'spO2' | 'gcs'>;
  fieldTreatment?: string;        // "IV established, TXA given, tourniquet x 1"
  destinationBay?: string;        // "Trauma 1"
  createdAt: string;
}