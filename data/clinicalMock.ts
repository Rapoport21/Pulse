/**
 * Clinical mock data — fully-fleshed patient records that implement
 * the `Patient` interface from `types.ts`.
 *
 * Every patient has:
 *   • Demographics (MRN, DOB, sex, language)
 *   • Code status, isolation, allergies, problems
 *   • A 24h vitals history (12 samples at ~2h intervals)
 *   • A current encounter with ESI, location, chief complaint
 *   • Optional social determinants
 *
 * The vitals histories are hand-tuned to produce plausible clinical
 * stories:
 *
 *   • P001 (Doe, John) — 45M trauma, sinking into hemorrhagic shock.
 *     BP trending down, HR up, SpO2 falling. MEWS climbs over the
 *     timeline.
 *
 *   • P002 (Smith, Jane) — 62F chest pain, relatively stable but
 *     mild tachycardia, borderline hypertensive. NEWS2 low.
 *
 *   • P003 (Fox, Robert) — 28M lac repair, stable throughout.
 *     MEWS 0 across the timeline.
 *
 *   • P004 (Wong, Alice) — 34F post-op, afebrile, stable.
 *
 *   • P005 (Ruiz, Carlos) — 71M sepsis progression. Trends into
 *     qSOFA≥2 by the latest vital set. Demonstrates why a
 *     screening score tile matters.
 *
 * When the real data layer lands (see T1.2), this file becomes the
 * fallback used by `lib/mockBackend.ts`.
 */

import type { Patient, Vital, Encounter, Allergy, Problem } from '../types';

// ─────────────────────────────────────────────────────────────────────────
// Helpers — timestamps relative to "now" so the histories always look
// fresh when the demo runs.
// ─────────────────────────────────────────────────────────────────────────

/** Minutes ago → ISO timestamp. */
const minutesAgo = (mins: number): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - mins);
  return d.toISOString();
};

/** Hours ago → ISO timestamp. */
const hoursAgo = (hours: number): string => minutesAgo(hours * 60);

// ─────────────────────────────────────────────────────────────────────────
// Vital histories
//
// Each patient gets an array of 12 vital sets at ~2h intervals,
// starting 24h ago and ending 10 minutes ago. The values are not
// random — they're hand-tuned to tell a clinical story the score
// library can pick up.
// ─────────────────────────────────────────────────────────────────────────

/** Blood-pressure-dropping, HR-rising trauma story (MEWS escalates). */
const traumaShockVitals: Vital[] = [
  { id: 'v1-12', timestamp: hoursAgo(24), heartRate: 88,  systolic: 128, diastolic: 78, respRate: 16, spO2: 98, temperature: 36.9, painScore: 4, gcs: 15, fio2: 0.21 },
  { id: 'v1-11', timestamp: hoursAgo(22), heartRate: 92,  systolic: 124, diastolic: 76, respRate: 16, spO2: 97, temperature: 37.1, painScore: 5, gcs: 15, fio2: 0.21 },
  { id: 'v1-10', timestamp: hoursAgo(20), heartRate: 96,  systolic: 120, diastolic: 72, respRate: 18, spO2: 97, temperature: 37.0, painScore: 6, gcs: 15, fio2: 0.21 },
  { id: 'v1-9',  timestamp: hoursAgo(18), heartRate: 101, systolic: 116, diastolic: 70, respRate: 18, spO2: 96, temperature: 37.2, painScore: 7, gcs: 15, fio2: 0.21 },
  { id: 'v1-8',  timestamp: hoursAgo(16), heartRate: 106, systolic: 112, diastolic: 68, respRate: 20, spO2: 95, temperature: 37.4, painScore: 7, gcs: 15, fio2: 0.28 },
  { id: 'v1-7',  timestamp: hoursAgo(14), heartRate: 112, systolic: 108, diastolic: 66, respRate: 22, spO2: 95, temperature: 37.5, painScore: 7, gcs: 15, fio2: 0.28 },
  { id: 'v1-6',  timestamp: hoursAgo(12), heartRate: 118, systolic: 102, diastolic: 64, respRate: 22, spO2: 94, temperature: 37.6, painScore: 8, gcs: 14, fio2: 0.35 },
  { id: 'v1-5',  timestamp: hoursAgo(10), heartRate: 122, systolic:  98, diastolic: 62, respRate: 24, spO2: 94, temperature: 37.7, painScore: 8, gcs: 14, fio2: 0.35 },
  { id: 'v1-4',  timestamp: hoursAgo(8),  heartRate: 124, systolic:  94, diastolic: 58, respRate: 26, spO2: 93, temperature: 37.8, painScore: 8, gcs: 14, fio2: 0.40 },
  { id: 'v1-3',  timestamp: hoursAgo(6),  heartRate: 128, systolic:  90, diastolic: 56, respRate: 26, spO2: 93, temperature: 38.1, painScore: 9, gcs: 14, fio2: 0.40 },
  { id: 'v1-2',  timestamp: hoursAgo(3),  heartRate: 132, systolic:  86, diastolic: 54, respRate: 28, spO2: 92, temperature: 38.3, painScore: 9, gcs: 13, fio2: 0.50 },
  { id: 'v1-1',  timestamp: minutesAgo(10), heartRate: 136, systolic: 84, diastolic: 52, respRate: 30, spO2: 92, temperature: 38.5, painScore: 9, gcs: 13, fio2: 0.50 },
];

/** Mild-tachy, borderline-hypertensive chest-pain story. Stable-ish. */
const chestPainVitals: Vital[] = [
  { id: 'v2-12', timestamp: hoursAgo(24), heartRate: 78, systolic: 134, diastolic: 82, respRate: 16, spO2: 99, temperature: 36.8, painScore: 6, gcs: 15, fio2: 0.21 },
  { id: 'v2-11', timestamp: hoursAgo(22), heartRate: 80, systolic: 136, diastolic: 84, respRate: 16, spO2: 99, temperature: 36.9, painScore: 7, gcs: 15, fio2: 0.21 },
  { id: 'v2-10', timestamp: hoursAgo(20), heartRate: 82, systolic: 138, diastolic: 86, respRate: 16, spO2: 98, temperature: 37.0, painScore: 7, gcs: 15, fio2: 0.21 },
  { id: 'v2-9',  timestamp: hoursAgo(18), heartRate: 84, systolic: 140, diastolic: 86, respRate: 18, spO2: 98, temperature: 37.0, painScore: 6, gcs: 15, fio2: 0.21 },
  { id: 'v2-8',  timestamp: hoursAgo(16), heartRate: 86, systolic: 142, diastolic: 88, respRate: 18, spO2: 98, temperature: 37.1, painScore: 6, gcs: 15, fio2: 0.21 },
  { id: 'v2-7',  timestamp: hoursAgo(14), heartRate: 88, systolic: 142, diastolic: 88, respRate: 18, spO2: 97, temperature: 37.1, painScore: 5, gcs: 15, fio2: 0.21 },
  { id: 'v2-6',  timestamp: hoursAgo(12), heartRate: 90, systolic: 144, diastolic: 90, respRate: 18, spO2: 97, temperature: 37.2, painScore: 5, gcs: 15, fio2: 0.21 },
  { id: 'v2-5',  timestamp: hoursAgo(10), heartRate: 92, systolic: 144, diastolic: 90, respRate: 18, spO2: 97, temperature: 37.1, painScore: 4, gcs: 15, fio2: 0.21 },
  { id: 'v2-4',  timestamp: hoursAgo(8),  heartRate: 94, systolic: 146, diastolic: 92, respRate: 18, spO2: 96, temperature: 37.1, painScore: 4, gcs: 15, fio2: 0.21 },
  { id: 'v2-3',  timestamp: hoursAgo(6),  heartRate: 96, systolic: 146, diastolic: 92, respRate: 18, spO2: 96, temperature: 37.0, painScore: 3, gcs: 15, fio2: 0.21 },
  { id: 'v2-2',  timestamp: hoursAgo(3),  heartRate: 98, systolic: 148, diastolic: 94, respRate: 18, spO2: 96, temperature: 37.0, painScore: 3, gcs: 15, fio2: 0.21 },
  { id: 'v2-1',  timestamp: minutesAgo(10), heartRate: 98, systolic: 145, diastolic: 90, respRate: 18, spO2: 96, temperature: 36.9, painScore: 3, gcs: 15, fio2: 0.21 },
];

/** Totally stable young adult — MEWS 0 throughout. */
const stableVitals: Vital[] = Array.from({ length: 12 }, (_, i) => ({
  id: `v3-${12 - i}`,
  timestamp: hoursAgo(24 - i * 2),
  heartRate: 70 + Math.round(Math.sin(i) * 2),
  systolic: 118 + Math.round(Math.cos(i) * 2),
  diastolic: 78,
  respRate: 14 + (i % 3),
  spO2: 98 + ((i + 1) % 2),
  temperature: 36.8 + Math.sin(i / 2) * 0.1,
  painScore: i < 6 ? 3 : 1,
  gcs: 15,
  fio2: 0.21,
}));

/** Post-op stable recovery. */
const postOpVitals: Vital[] = Array.from({ length: 12 }, (_, i) => ({
  id: `v4-${12 - i}`,
  timestamp: hoursAgo(24 - i * 2),
  heartRate: 80 + Math.round(Math.cos(i / 2) * 3),
  systolic: 116 + Math.round(Math.sin(i / 2) * 3),
  diastolic: 74,
  respRate: 16,
  spO2: 98,
  temperature: 37.0 + (i < 4 ? 0.3 : 0),
  painScore: i < 6 ? 5 : 3,
  gcs: 15,
  fio2: 0.21,
}));

/** Sepsis progression — late entries push qSOFA ≥2. */
const sepsisVitals: Vital[] = [
  { id: 'v5-12', timestamp: hoursAgo(24), heartRate: 86,  systolic: 128, diastolic: 76, respRate: 18, spO2: 97, temperature: 37.3, painScore: 2, gcs: 15, fio2: 0.21 },
  { id: 'v5-11', timestamp: hoursAgo(22), heartRate: 88,  systolic: 124, diastolic: 74, respRate: 18, spO2: 97, temperature: 37.5, painScore: 2, gcs: 15, fio2: 0.21 },
  { id: 'v5-10', timestamp: hoursAgo(20), heartRate: 90,  systolic: 120, diastolic: 72, respRate: 20, spO2: 96, temperature: 37.8, painScore: 3, gcs: 15, fio2: 0.21 },
  { id: 'v5-9',  timestamp: hoursAgo(18), heartRate: 94,  systolic: 116, diastolic: 70, respRate: 20, spO2: 96, temperature: 38.1, painScore: 4, gcs: 15, fio2: 0.21 },
  { id: 'v5-8',  timestamp: hoursAgo(16), heartRate: 98,  systolic: 112, diastolic: 68, respRate: 22, spO2: 95, temperature: 38.4, painScore: 5, gcs: 15, fio2: 0.24 },
  { id: 'v5-7',  timestamp: hoursAgo(14), heartRate: 102, systolic: 108, diastolic: 66, respRate: 22, spO2: 95, temperature: 38.6, painScore: 5, gcs: 15, fio2: 0.24 },
  { id: 'v5-6',  timestamp: hoursAgo(12), heartRate: 104, systolic: 104, diastolic: 64, respRate: 24, spO2: 94, temperature: 38.8, painScore: 6, gcs: 15, fio2: 0.28 },
  { id: 'v5-5',  timestamp: hoursAgo(10), heartRate: 106, systolic: 100, diastolic: 62, respRate: 24, spO2: 94, temperature: 38.9, painScore: 6, gcs: 15, fio2: 0.28 },
  { id: 'v5-4',  timestamp: hoursAgo(8),  heartRate: 108, systolic:  96, diastolic: 60, respRate: 24, spO2: 93, temperature: 39.1, painScore: 6, gcs: 14, fio2: 0.32 },
  { id: 'v5-3',  timestamp: hoursAgo(6),  heartRate: 110, systolic:  94, diastolic: 58, respRate: 26, spO2: 93, temperature: 39.2, painScore: 6, gcs: 14, fio2: 0.35 },
  { id: 'v5-2',  timestamp: hoursAgo(3),  heartRate: 112, systolic:  92, diastolic: 58, respRate: 26, spO2: 93, temperature: 39.3, painScore: 6, gcs: 14, fio2: 0.40 },
  { id: 'v5-1',  timestamp: minutesAgo(10), heartRate: 114, systolic:  90, diastolic: 56, respRate: 28, spO2: 92, temperature: 39.4, painScore: 6, gcs: 14, fio2: 0.40 },
];

// ─────────────────────────────────────────────────────────────────────────
// Allergies — realistic variety. NKA (empty allergy array) is just as
// valid as a list and must render correctly.
// ─────────────────────────────────────────────────────────────────────────
const penicillinAnaphylaxis: Allergy = {
  id: 'a1',
  substance: 'Penicillin',
  rxnormCode: '7980',
  reaction: 'Anaphylaxis',
  severity: 'high',
  verification: 'confirmed',
  onset: '2012-08-14',
  note: 'ED visit 2012 — epinephrine x 2',
};

const sulfaMildRash: Allergy = {
  id: 'a2',
  substance: 'Sulfa drugs',
  rxnormCode: '10180',
  reaction: 'Rash',
  severity: 'low',
  verification: 'confirmed',
  onset: '2005-03-02',
};

const latexMild: Allergy = {
  id: 'a3',
  substance: 'Latex',
  reaction: 'Contact dermatitis',
  severity: 'low',
  verification: 'confirmed',
};

const contrastModerate: Allergy = {
  id: 'a4',
  substance: 'Iodinated contrast',
  reaction: 'Urticaria, itching',
  severity: 'low',
  verification: 'confirmed',
  note: 'Tolerated with premedication',
};

const shellfishModerate: Allergy = {
  id: 'a5',
  substance: 'Shellfish',
  reaction: 'Oropharyngeal swelling',
  severity: 'high',
  verification: 'confirmed',
};

// ─────────────────────────────────────────────────────────────────────────
// Problem lists — realistic comorbidities that shape downstream decisions.
// ─────────────────────────────────────────────────────────────────────────
const problems = {
  t2dm: { id: 'p1', display: 'Type 2 diabetes mellitus', icd10Code: 'E11.9', status: 'active' as const, onsetDate: '2018-04-03', priority: 1 },
  htn: { id: 'p2', display: 'Essential hypertension', icd10Code: 'I10', status: 'active' as const, onsetDate: '2014-11-20', priority: 2 },
  copd: { id: 'p3', display: 'Chronic obstructive pulmonary disease', icd10Code: 'J44.9', status: 'active' as const, onsetDate: '2016-09-18', priority: 2 },
  afib: { id: 'p4', display: 'Atrial fibrillation', icd10Code: 'I48.91', status: 'active' as const, onsetDate: '2020-01-15', priority: 1 },
  ckd3: { id: 'p5', display: 'Chronic kidney disease, stage 3', icd10Code: 'N18.3', status: 'active' as const, onsetDate: '2021-06-10', priority: 2 },
  hfref: { id: 'p6', display: 'Heart failure with reduced ejection fraction', icd10Code: 'I50.22', status: 'active' as const, onsetDate: '2019-08-11', priority: 1 },
  cad: { id: 'p7', display: 'Coronary artery disease', icd10Code: 'I25.10', status: 'active' as const, onsetDate: '2017-05-30', priority: 1 },
  osa: { id: 'p8', display: 'Obstructive sleep apnea', icd10Code: 'G47.33', status: 'active' as const, onsetDate: '2015-02-22', priority: 3 },
  depression: { id: 'p9', display: 'Major depressive disorder', icd10Code: 'F33.1', status: 'active' as const, onsetDate: '2019-10-05', priority: 3 },
  hyperlipidemia: { id: 'p10', display: 'Hyperlipidemia', icd10Code: 'E78.5', status: 'active' as const, onsetDate: '2016-01-12', priority: 3 },
  anxiety: { id: 'p11', display: 'Generalized anxiety disorder', icd10Code: 'F41.1', status: 'active' as const, onsetDate: '2020-07-19', priority: 3 },
  uti: { id: 'p12', display: 'Urinary tract infection', icd10Code: 'N39.0', status: 'active' as const, onsetDate: minutesAgo(60 * 24).slice(0, 10), priority: 1 },
} satisfies Record<string, Problem>;

// ─────────────────────────────────────────────────────────────────────────
// Encounters — one active per patient
// ─────────────────────────────────────────────────────────────────────────
const makeEncounter = (
  id: string,
  patientId: string,
  overrides: Partial<Encounter>,
): Encounter => ({
  id,
  patientId,
  class: 'EMERGENCY',
  status: 'in-progress',
  admittedAt: hoursAgo(6),
  location: { zone: 'ED-Acute' },
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────
// Patients — the canonical mock roster
// ─────────────────────────────────────────────────────────────────────────
export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'P001',
    mrn: 'MRN-8821',
    name: { given: 'John', family: 'Doe' },
    birthDate: '1980-06-14',
    sex: 'M',
    preferredLanguage: 'en',
    weightKg: 88,
    heightCm: 182,
    codeStatus: 'FULL',
    isolation: 'NONE',
    advanceDirective: false,
    allergies: [penicillinAnaphylaxis, latexMild],
    problems: [problems.htn, problems.hyperlipidemia],
    vitalsHistory: traumaShockVitals,
    currentEncounter: makeEncounter('E-8821', 'P001', {
      esi: 1,
      chiefComplaint: 'MVA, unrestrained driver. Suspected splenic laceration.',
      location: { zone: 'ED-Trauma', bed: 'Trauma 1' },
      arrivalMode: 'ems',
      payer: { primary: 'BlueCross BlueShield', memberId: 'XYZ123456789', groupId: '98765' },
      admittedAt: hoursAgo(2),
    }),
    socialDeterminants: {
      housing: 'stable',
      foodSecurity: 'secure',
      transportation: 'has-reliable',
      caregiverSupport: true,
      utilitiesSecure: true,
    },
    avatarInitials: 'JD',
  },
  {
    id: 'P002',
    mrn: 'MRN-9912',
    name: { given: 'Jane', family: 'Smith' },
    birthDate: '1963-02-28',
    sex: 'F',
    preferredLanguage: 'en',
    weightKg: 72,
    heightCm: 165,
    codeStatus: 'DNR/DNI',
    isolation: 'NONE',
    advanceDirective: true,
    allergies: [sulfaMildRash, contrastModerate],
    problems: [problems.afib, problems.htn, problems.ckd3, problems.hyperlipidemia],
    vitalsHistory: chestPainVitals,
    currentEncounter: makeEncounter('E-9912', 'P002', {
      esi: 2,
      chiefComplaint: 'Substernal chest pain, radiating to left arm. Onset 2h ago.',
      location: { zone: 'ED-Acute', bed: '4' },
      arrivalMode: 'ambulatory',
      payer: { primary: 'Medicare', memberId: 'MCR-2239471', groupId: 'A-01' },
      admittedAt: hoursAgo(3),
    }),
    socialDeterminants: {
      housing: 'stable',
      foodSecurity: 'secure',
      transportation: 'has-reliable',
      caregiverSupport: true,
      utilitiesSecure: true,
    },
    avatarInitials: 'JS',
  },
  {
    id: 'P003',
    mrn: 'MRN-1102',
    name: { given: 'Robert', family: 'Fox' },
    birthDate: '1997-11-30',
    sex: 'M',
    preferredLanguage: 'en',
    weightKg: 76,
    heightCm: 178,
    codeStatus: 'FULL',
    isolation: 'NONE',
    advanceDirective: false,
    allergies: [],
    problems: [],
    vitalsHistory: stableVitals,
    currentEncounter: makeEncounter('E-1102', 'P003', {
      esi: 4,
      chiefComplaint: 'Laceration to left forearm, 6 cm. Needs repair.',
      location: { zone: 'ED-Fast-Track', bed: '7' },
      arrivalMode: 'private-vehicle',
      payer: { primary: 'UnitedHealthcare', memberId: 'UHC-4092881', groupId: 'GR-88' },
      admittedAt: hoursAgo(1),
    }),
    socialDeterminants: {
      housing: 'stable',
      foodSecurity: 'secure',
      transportation: 'has-reliable',
    },
    avatarInitials: 'RF',
  },
  {
    id: 'P004',
    mrn: 'MRN-3321',
    name: { given: 'Alice', family: 'Wong' },
    birthDate: '1991-07-22',
    sex: 'F',
    preferredLanguage: 'en',
    weightKg: 58,
    heightCm: 162,
    codeStatus: 'FULL',
    isolation: 'CONTACT',
    advanceDirective: false,
    allergies: [shellfishModerate],
    problems: [problems.anxiety],
    vitalsHistory: postOpVitals,
    currentEncounter: makeEncounter('E-3321', 'P004', {
      class: 'INPATIENT',
      esi: 3,
      chiefComplaint: 'Post-op day 1, laparoscopic appendectomy.',
      location: { zone: '2-West', bed: '201' },
      admittedAt: hoursAgo(28),
      payer: { primary: 'Aetna', memberId: 'AET-7714920', groupId: 'GP-22' },
    }),
    socialDeterminants: {
      housing: 'stable',
      foodSecurity: 'secure',
      caregiverSupport: true,
    },
    avatarInitials: 'AW',
  },
  {
    id: 'P005',
    mrn: 'MRN-4415',
    name: { given: 'Carlos', family: 'Ruiz' },
    birthDate: '1954-09-03',
    sex: 'M',
    preferredLanguage: 'es',
    needsInterpreter: true,
    weightKg: 80,
    heightCm: 170,
    codeStatus: 'FULL',
    isolation: 'NONE',
    advanceDirective: false,
    allergies: [],
    problems: [problems.t2dm, problems.hfref, problems.cad, problems.copd, problems.uti],
    vitalsHistory: sepsisVitals,
    currentEncounter: makeEncounter('E-4415', 'P005', {
      class: 'INPATIENT',
      esi: 2,
      chiefComplaint: 'Fever, chills, flank pain. Possible urosepsis.',
      location: { zone: '2-West', bed: '202' },
      admittedAt: hoursAgo(36),
      payer: { primary: 'Medicare', secondary: 'Medicaid', memberId: 'MCR-4492210' },
    }),
    socialDeterminants: {
      housing: 'unstable',
      foodSecurity: 'risk',
      transportation: 'inconsistent',
      caregiverSupport: false,
      utilitiesSecure: false,
    },
    avatarInitials: 'CR',
  },
];

export const findPatientByMrn = (mrn: string): Patient | undefined =>
  MOCK_PATIENTS.find((p) => p.mrn === mrn);

export const findPatientById = (id: string): Patient | undefined =>
  MOCK_PATIENTS.find((p) => p.id === id);

/** Derive a "now" age from an ISO birthDate. */
export const ageInYears = (birthDate: string): number => {
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a -= 1;
  return a;
};

/** Short display form — "72F 62kg" / "45M 88kg". */
export const shortDemographics = (p: Patient): string => {
  const age = ageInYears(p.birthDate);
  const weight = p.weightKg ? ` ${Math.round(p.weightKg)}kg` : '';
  return `${age}${p.sex}${weight}`;
};
