/**
 * EMS inbound mock seed data — five plausible runs covering the
 * activation classes the trauma bay actually trains for:
 *
 *   • TRAUMA 1 (highest activation, multi-system, full team page)
 *   • TRAUMA 2 (significant mechanism, restricted team)
 *   • STROKE alert (FAST positive, time-stamped onset)
 *   • STEMI alert (12-lead with ST elevation, cath lab on standby)
 *   • SEPSIS alert (qSOFA positive, sepsis bundle on arrival)
 *
 * Plus one routine ground run with no activation, so the board
 * shows a healthy mix of acuity instead of looking like everything
 * is on fire.
 *
 * The shape conforms to `EmsInbound` in types.ts. ETAs are absolute
 * minutes at seed time — the live hook in `lib/emsLive.ts` decrements
 * them every second so the board feels like it's breathing.
 */

import type { EmsInbound } from '../types';

const nowIso = (offsetMin: number = 0): string =>
  new Date(Date.now() - offsetMin * 60_000).toISOString();

export const MOCK_EMS_INBOUND: EmsInbound[] = [
  {
    id: 'EMS-001',
    unit: 'Medic 14',
    mode: 'ground',
    etaMinutes: 4,
    age: 38,
    sex: 'M',
    chiefComplaint: 'MVC, restrained driver, +LOC, deformed L femur',
    activationLevel: 'TRAUMA_1',
    fieldVitals: {
      heartRate: 128,
      systolic: 88,
      diastolic: 54,
      respRate: 26,
      spO2: 92,
      gcs: 13,
    },
    fieldTreatment: '2x 18g IV NS WO · TXA 1g · pelvic binder · L femur traction',
    destinationBay: 'Trauma 1',
    createdAt: nowIso(2),
  },
  {
    id: 'EMS-002',
    unit: 'Air 2',
    mode: 'air',
    etaMinutes: 9,
    age: 71,
    sex: 'F',
    chiefComplaint: 'Acute L hemiparesis, dysarthria, last known well 38m',
    activationLevel: 'STROKE',
    fieldVitals: {
      heartRate: 92,
      systolic: 188,
      diastolic: 102,
      respRate: 18,
      spO2: 96,
      gcs: 14,
    },
    fieldTreatment: 'IV access · O2 2L NC · BG 142 · NIHSS 14 in field',
    destinationBay: 'Stroke 1',
    createdAt: nowIso(4),
  },
  {
    id: 'EMS-003',
    unit: 'Medic 7',
    mode: 'ground',
    etaMinutes: 12,
    age: 58,
    sex: 'M',
    chiefComplaint: 'Substernal CP 1h, diaphoretic, ST elev II/III/aVF',
    activationLevel: 'STEMI',
    fieldVitals: {
      heartRate: 102,
      systolic: 142,
      diastolic: 88,
      respRate: 20,
      spO2: 94,
    },
    fieldTreatment: 'ASA 324 PO · NTG SL x2 · IV established · 12L sent',
    destinationBay: 'Cath Lab',
    createdAt: nowIso(6),
  },
  {
    id: 'EMS-004',
    unit: 'Medic 22',
    mode: 'ground',
    etaMinutes: 18,
    age: 81,
    sex: 'F',
    chiefComplaint: 'AMS from SNF, fever 39.4, SBP 84, lactate 4.2 fld',
    activationLevel: 'SEPSIS',
    fieldVitals: {
      heartRate: 118,
      systolic: 84,
      diastolic: 48,
      respRate: 24,
      spO2: 91,
      gcs: 13,
    },
    fieldTreatment: '2x 16g IV NS 1L bolus · O2 4L NC · cultures pending',
    destinationBay: 'Acute 4',
    createdAt: nowIso(8),
  },
  {
    id: 'EMS-005',
    unit: 'Medic 31',
    mode: 'ground',
    etaMinutes: 22,
    age: 44,
    sex: 'M',
    chiefComplaint: 'Mechanical fall from ladder, 2m, R wrist deformity',
    activationLevel: 'TRAUMA_2',
    fieldVitals: {
      heartRate: 96,
      systolic: 132,
      diastolic: 80,
      respRate: 18,
      spO2: 98,
      gcs: 15,
    },
    fieldTreatment: 'Splinted R wrist · IV access · 4mg morphine IV',
    destinationBay: 'Trauma 2',
    createdAt: nowIso(11),
  },
  {
    id: 'EMS-006',
    unit: 'Medic 9',
    mode: 'ground',
    etaMinutes: 28,
    age: 29,
    sex: 'F',
    chiefComplaint: 'Abd pain 2d, vomiting, no fever',
    activationLevel: 'NONE',
    fieldVitals: {
      heartRate: 88,
      systolic: 118,
      diastolic: 72,
      respRate: 16,
      spO2: 99,
    },
    fieldTreatment: 'IV NS @ 125 · 4mg ondansetron IV',
    destinationBay: 'Triage',
    createdAt: nowIso(15),
  },
];

/**
 * Helper that returns a fresh deep copy of the seed list — important
 * because the live hook mutates `etaMinutes` over time and we don't
 * want React StrictMode double-mounts to share a stale starting point
 * across remounts.
 */
export const seedEmsInbound = (): EmsInbound[] =>
  MOCK_EMS_INBOUND.map((r) => ({
    ...r,
    fieldVitals: r.fieldVitals ? { ...r.fieldVitals } : undefined,
  }));
