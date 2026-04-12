/**
 * Bed state mock data for the PULSE Bed Board.
 *
 * Every bed in the hospital has a state at any given moment. The Bed Board
 * renders these states as a real-time map of capacity and constraints —
 * one of PULSE's core differentiators vs. traditional bed management tools
 * like TeleTracking or Epic Bed Management.
 *
 * States:
 *   ready       — clean, staffed, available for a new patient (green)
 *   occupied    — patient in bed (neutral/blue)
 *   dirty       — patient discharged, awaiting EVS turnover (amber)
 *   not_staffed — bed physically ready but no nurse assigned (orange)
 *   blocked     — cannot be used — maintenance, isolation hold, admin (red)
 *   reserved    — held for incoming EMS/transfer/surgery (purple)
 *
 * The mock data is designed to tell an operational story:
 *   - ED-Trauma: 2 of 3 bays occupied (one is our ESI-1 MVC patient)
 *   - ED-Acute: mostly full, 1 bed dirty, 1 ready
 *   - ED-Fast-Track: light, 2 ready
 *   - ICU: near capacity, 1 not staffed (the staffing gap)
 *   - Stepdown: 1 not staffed (this drives the surge forecast)
 *   - Med-Surg 2W: mixed states, realistic floor
 *   - Med-Surg 3E: overflow capacity, some blocked
 *   - Overflow Hall C: not visible until surge activates
 */

export type BedState = 'ready' | 'occupied' | 'dirty' | 'not_staffed' | 'blocked' | 'reserved';

export interface Bed {
  id: string;
  label: string;            // human display: "Trauma 1", "201", "ICU-3"
  unitId: string;
  state: BedState;
  patientId?: string;       // links to MOCK_PATIENTS when occupied
  patientInitials?: string; // quick display
  acuity?: 1 | 2 | 3 | 4 | 5; // ESI if patient present
  assignedNurse?: string;
  /** Minutes since state last changed — drives freshness indicator. */
  stateChangedMinAgo?: number;
  /** Why blocked — only set when state === 'blocked'. */
  blockReason?: string;
  /** Reserved for whom — only set when state === 'reserved'. */
  reservedFor?: string;
}

export interface BedUnit {
  id: string;
  name: string;
  shortName: string;
  floor?: string;
  beds: Bed[];
  /** If true, unit only appears when surge is active. */
  surgeOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Units and beds
// ─────────────────────────────────────────────────────────────────────────

const edTrauma: BedUnit = {
  id: 'ed-trauma',
  name: 'ED — Trauma',
  shortName: 'TRAUMA',
  floor: '1',
  beds: [
    { id: 'T1', label: 'Trauma 1', unitId: 'ed-trauma', state: 'occupied', patientId: 'P001', patientInitials: 'JD', acuity: 1, assignedNurse: 'N. Chen', stateChangedMinAgo: 120 },
    { id: 'T2', label: 'Trauma 2', unitId: 'ed-trauma', state: 'reserved', reservedFor: 'EMS-001 MVC', stateChangedMinAgo: 5 },
    { id: 'T3', label: 'Trauma 3', unitId: 'ed-trauma', state: 'ready', assignedNurse: 'R. Patel', stateChangedMinAgo: 45 },
  ],
};

const edAcute: BedUnit = {
  id: 'ed-acute',
  name: 'ED — Acute',
  shortName: 'ACUTE',
  floor: '1',
  beds: [
    { id: 'A1', label: '1', unitId: 'ed-acute', state: 'occupied', patientInitials: 'ML', acuity: 3, assignedNurse: 'S. Lee', stateChangedMinAgo: 180 },
    { id: 'A2', label: '2', unitId: 'ed-acute', state: 'occupied', patientInitials: 'KW', acuity: 2, assignedNurse: 'S. Lee', stateChangedMinAgo: 90 },
    { id: 'A3', label: '3', unitId: 'ed-acute', state: 'occupied', patientInitials: 'BT', acuity: 3, assignedNurse: 'J. Kim', stateChangedMinAgo: 240 },
    { id: 'A4', label: '4', unitId: 'ed-acute', state: 'occupied', patientId: 'P002', patientInitials: 'JS', acuity: 2, assignedNurse: 'J. Kim', stateChangedMinAgo: 180 },
    { id: 'A5', label: '5', unitId: 'ed-acute', state: 'dirty', stateChangedMinAgo: 12 },
    { id: 'A6', label: '6', unitId: 'ed-acute', state: 'occupied', patientInitials: 'RH', acuity: 3, assignedNurse: 'M. Davis', stateChangedMinAgo: 60 },
    { id: 'A7', label: '7', unitId: 'ed-acute', state: 'ready', assignedNurse: 'M. Davis', stateChangedMinAgo: 30 },
    { id: 'A8', label: '8', unitId: 'ed-acute', state: 'occupied', patientInitials: 'DL', acuity: 2, assignedNurse: 'T. Reeves', stateChangedMinAgo: 150 },
  ],
};

const edFastTrack: BedUnit = {
  id: 'ed-ft',
  name: 'ED — Fast Track',
  shortName: 'FAST TRK',
  floor: '1',
  beds: [
    { id: 'FT1', label: 'FT-1', unitId: 'ed-ft', state: 'occupied', patientId: 'P003', patientInitials: 'RF', acuity: 4, assignedNurse: 'A. Torres', stateChangedMinAgo: 60 },
    { id: 'FT2', label: 'FT-2', unitId: 'ed-ft', state: 'ready', assignedNurse: 'A. Torres', stateChangedMinAgo: 20 },
    { id: 'FT3', label: 'FT-3', unitId: 'ed-ft', state: 'occupied', patientInitials: 'PG', acuity: 5, assignedNurse: 'L. Brown', stateChangedMinAgo: 30 },
    { id: 'FT4', label: 'FT-4', unitId: 'ed-ft', state: 'ready', assignedNurse: 'L. Brown', stateChangedMinAgo: 90 },
  ],
};

const icu: BedUnit = {
  id: 'icu',
  name: 'ICU',
  shortName: 'ICU',
  floor: '2',
  beds: [
    { id: 'ICU1', label: 'ICU-1', unitId: 'icu', state: 'occupied', patientInitials: 'WJ', acuity: 1, assignedNurse: 'K. Foster', stateChangedMinAgo: 480 },
    { id: 'ICU2', label: 'ICU-2', unitId: 'icu', state: 'occupied', patientInitials: 'EM', acuity: 1, assignedNurse: 'K. Foster', stateChangedMinAgo: 360 },
    { id: 'ICU3', label: 'ICU-3', unitId: 'icu', state: 'occupied', patientInitials: 'AT', acuity: 2, assignedNurse: 'R. Gomez', stateChangedMinAgo: 720 },
    { id: 'ICU4', label: 'ICU-4', unitId: 'icu', state: 'not_staffed', stateChangedMinAgo: 120 },
    { id: 'ICU5', label: 'ICU-5', unitId: 'icu', state: 'occupied', patientInitials: 'HB', acuity: 1, assignedNurse: 'R. Gomez', stateChangedMinAgo: 200 },
    { id: 'ICU6', label: 'ICU-6', unitId: 'icu', state: 'blocked', blockReason: 'Vent maintenance', stateChangedMinAgo: 60 },
  ],
};

const stepdown: BedUnit = {
  id: 'stepdown',
  name: 'Stepdown',
  shortName: 'SDU',
  floor: '2',
  beds: [
    { id: 'SD1', label: 'SD-1', unitId: 'stepdown', state: 'occupied', patientInitials: 'NG', acuity: 3, assignedNurse: 'P. Walsh', stateChangedMinAgo: 300 },
    { id: 'SD2', label: 'SD-2', unitId: 'stepdown', state: 'occupied', patientInitials: 'LF', acuity: 2, assignedNurse: 'P. Walsh', stateChangedMinAgo: 600 },
    { id: 'SD3', label: 'SD-3', unitId: 'stepdown', state: 'not_staffed', stateChangedMinAgo: 180 },
    { id: 'SD4', label: 'SD-4', unitId: 'stepdown', state: 'dirty', stateChangedMinAgo: 8 },
  ],
};

const medSurg2W: BedUnit = {
  id: 'ms-2w',
  name: 'Med-Surg 2-West',
  shortName: '2-WEST',
  floor: '2',
  beds: [
    { id: '201', label: '201', unitId: 'ms-2w', state: 'occupied', patientId: 'P004', patientInitials: 'AW', acuity: 3, assignedNurse: 'D. Miller', stateChangedMinAgo: 1680 },
    { id: '202', label: '202', unitId: 'ms-2w', state: 'occupied', patientId: 'P005', patientInitials: 'CR', acuity: 2, assignedNurse: 'D. Miller', stateChangedMinAgo: 2160 },
    { id: '203', label: '203', unitId: 'ms-2w', state: 'occupied', patientInitials: 'TK', acuity: 4, assignedNurse: 'H. Park', stateChangedMinAgo: 480 },
    { id: '204', label: '204', unitId: 'ms-2w', state: 'ready', assignedNurse: 'H. Park', stateChangedMinAgo: 60 },
    { id: '205', label: '205', unitId: 'ms-2w', state: 'occupied', patientInitials: 'SB', acuity: 3, assignedNurse: 'H. Park', stateChangedMinAgo: 360 },
    { id: '206', label: '206', unitId: 'ms-2w', state: 'dirty', stateChangedMinAgo: 22 },
    { id: '207', label: '207', unitId: 'ms-2w', state: 'occupied', patientInitials: 'JR', acuity: 3, assignedNurse: 'V. Singh', stateChangedMinAgo: 1200 },
    { id: '208', label: '208', unitId: 'ms-2w', state: 'occupied', patientInitials: 'MW', acuity: 4, assignedNurse: 'V. Singh', stateChangedMinAgo: 720 },
    { id: '209', label: '209', unitId: 'ms-2w', state: 'ready', assignedNurse: 'V. Singh', stateChangedMinAgo: 45 },
    { id: '210', label: '210', unitId: 'ms-2w', state: 'blocked', blockReason: 'Plumbing repair', stateChangedMinAgo: 300 },
  ],
};

const medSurg3E: BedUnit = {
  id: 'ms-3e',
  name: 'Med-Surg 3-East',
  shortName: '3-EAST',
  floor: '3',
  beds: [
    { id: '301', label: '301', unitId: 'ms-3e', state: 'occupied', patientInitials: 'FC', acuity: 3, assignedNurse: 'C. Adams', stateChangedMinAgo: 960 },
    { id: '302', label: '302', unitId: 'ms-3e', state: 'occupied', patientInitials: 'RL', acuity: 4, assignedNurse: 'C. Adams', stateChangedMinAgo: 480 },
    { id: '303', label: '303', unitId: 'ms-3e', state: 'ready', assignedNurse: 'C. Adams', stateChangedMinAgo: 120 },
    { id: '304', label: '304', unitId: 'ms-3e', state: 'not_staffed', stateChangedMinAgo: 90 },
    { id: '305', label: '305', unitId: 'ms-3e', state: 'occupied', patientInitials: 'BE', acuity: 3, assignedNurse: 'T. Jackson', stateChangedMinAgo: 1440 },
    { id: '306', label: '306', unitId: 'ms-3e', state: 'ready', assignedNurse: 'T. Jackson', stateChangedMinAgo: 200 },
    { id: '307', label: '307', unitId: 'ms-3e', state: 'occupied', patientInitials: 'YS', acuity: 3, assignedNurse: 'T. Jackson', stateChangedMinAgo: 600 },
    { id: '308', label: '308', unitId: 'ms-3e', state: 'blocked', blockReason: 'Isolation hold', stateChangedMinAgo: 48 },
    { id: '309', label: '309', unitId: 'ms-3e', state: 'dirty', stateChangedMinAgo: 15 },
    { id: '310', label: '310', unitId: 'ms-3e', state: 'occupied', patientInitials: 'GN', acuity: 4, assignedNurse: 'B. Wells', stateChangedMinAgo: 240 },
  ],
};

const overflowHallC: BedUnit = {
  id: 'overflow-c',
  name: 'Overflow — Hall C',
  shortName: 'OVRFLW C',
  floor: '1',
  surgeOnly: true,
  beds: [
    { id: 'OC1', label: 'C-1', unitId: 'overflow-c', state: 'ready', stateChangedMinAgo: 0 },
    { id: 'OC2', label: 'C-2', unitId: 'overflow-c', state: 'ready', stateChangedMinAgo: 0 },
    { id: 'OC3', label: 'C-3', unitId: 'overflow-c', state: 'ready', stateChangedMinAgo: 0 },
    { id: 'OC4', label: 'C-4', unitId: 'overflow-c', state: 'ready', stateChangedMinAgo: 0 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────

/** All hospital units, ordered by clinical priority. */
export const HOSPITAL_UNITS: BedUnit[] = [
  edTrauma,
  edAcute,
  edFastTrack,
  icu,
  stepdown,
  medSurg2W,
  medSurg3E,
  overflowHallC,
];

/** Deep-copy factory so consumers get mutable state. */
export function seedBedState(): BedUnit[] {
  return JSON.parse(JSON.stringify(HOSPITAL_UNITS));
}

// ─────────────────────────────────────────────────────────────────────────
// Summary helpers
// ─────────────────────────────────────────────────────────────────────────

export interface BedSummary {
  total: number;
  ready: number;
  occupied: number;
  dirty: number;
  notStaffed: number;
  blocked: number;
  reserved: number;
}

export function summarizeBeds(units: BedUnit[], includeSurge: boolean): BedSummary {
  const filtered = includeSurge ? units : units.filter(u => !u.surgeOnly);
  const all = filtered.flatMap(u => u.beds);
  return {
    total: all.length,
    ready: all.filter(b => b.state === 'ready').length,
    occupied: all.filter(b => b.state === 'occupied').length,
    dirty: all.filter(b => b.state === 'dirty').length,
    notStaffed: all.filter(b => b.state === 'not_staffed').length,
    blocked: all.filter(b => b.state === 'blocked').length,
    reserved: all.filter(b => b.state === 'reserved').length,
  };
}

export function summarizeUnit(unit: BedUnit): BedSummary {
  return summarizeBeds([unit], true);
}

/** Percentage of beds that could accept a patient right now. */
export function availabilityPercent(units: BedUnit[], includeSurge: boolean): number {
  const s = summarizeBeds(units, includeSurge);
  if (s.total === 0) return 0;
  return Math.round((s.ready / s.total) * 100);
}

/** Human-readable state label. */
export function stateLabel(state: BedState): string {
  switch (state) {
    case 'ready': return 'READY';
    case 'occupied': return 'OCCUPIED';
    case 'dirty': return 'DIRTY';
    case 'not_staffed': return 'NOT STAFFED';
    case 'blocked': return 'BLOCKED';
    case 'reserved': return 'RESERVED';
  }
}
