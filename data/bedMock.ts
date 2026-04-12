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
  /** Full patient name for Epic-style bed board display. */
  patientName?: string;
  /** Medical record number, format "MRN-XXXX". */
  mrn?: string;
  /** Attending physician. */
  attending?: string;
  /** Length of stay in hours. */
  losHours?: number;
  /** Isolation precaution status. */
  isolation?: 'NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE' | 'PROTECTIVE';
  /** EVS (environmental services) turnover status for dirty/turning beds. */
  evsStatus?: 'none' | 'requested' | 'in_progress' | 'complete';
  /** Discharge milestone tracking for patients approaching discharge. */
  dischargeMilestones?: {
    dcOrderWritten?: boolean;
    rideConfirmed?: boolean;
    medsToeBedside?: boolean;
    estimatedDcTime?: string;  // "14:00"
  };
  /** How the patient was admitted. */
  admitSource?: 'ED' | 'OR' | 'Transfer' | 'Direct';
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
    { id: 'T1', label: 'Trauma 1', unitId: 'ed-trauma', state: 'occupied', patientId: 'P001', patientInitials: 'JD', acuity: 1, assignedNurse: 'N. Chen', stateChangedMinAgo: 120, patientName: 'James Donovan', mrn: 'MRN-7712', attending: 'Dr. Rivera', losHours: 3, isolation: 'NONE', admitSource: 'ED' },
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
    { id: 'A1', label: '1', unitId: 'ed-acute', state: 'occupied', patientInitials: 'ML', acuity: 3, assignedNurse: 'S. Lee', stateChangedMinAgo: 180, patientName: 'Maria Lopez', mrn: 'MRN-3341', attending: 'Dr. Patel', losHours: 5, isolation: 'NONE', admitSource: 'ED' },
    { id: 'A2', label: '2', unitId: 'ed-acute', state: 'occupied', patientInitials: 'KW', acuity: 2, assignedNurse: 'S. Lee', stateChangedMinAgo: 90, patientName: 'Kevin Wright', mrn: 'MRN-4582', attending: 'Dr. Chen', losHours: 2, isolation: 'DROPLET', admitSource: 'ED' },
    { id: 'A3', label: '3', unitId: 'ed-acute', state: 'occupied', patientInitials: 'BT', acuity: 3, assignedNurse: 'J. Kim', stateChangedMinAgo: 240, patientName: 'Barbara Torres', mrn: 'MRN-6109', attending: 'Dr. Rivera', losHours: 6, isolation: 'NONE', admitSource: 'ED' },
    { id: 'A4', label: '4', unitId: 'ed-acute', state: 'occupied', patientId: 'P002', patientInitials: 'JS', acuity: 2, assignedNurse: 'J. Kim', stateChangedMinAgo: 180, patientName: 'Jason Sellers', mrn: 'MRN-2290', attending: 'Dr. Kim', losHours: 4, isolation: 'NONE', admitSource: 'ED' },
    { id: 'A5', label: '5', unitId: 'ed-acute', state: 'dirty', stateChangedMinAgo: 12, evsStatus: 'requested' },
    { id: 'A6', label: '6', unitId: 'ed-acute', state: 'occupied', patientInitials: 'RH', acuity: 3, assignedNurse: 'M. Davis', stateChangedMinAgo: 60, patientName: 'Rosa Hernandez', mrn: 'MRN-8874', attending: 'Dr. Foster', losHours: 1, isolation: 'NONE', admitSource: 'ED' },
    { id: 'A7', label: '7', unitId: 'ed-acute', state: 'ready', assignedNurse: 'M. Davis', stateChangedMinAgo: 30 },
    { id: 'A8', label: '8', unitId: 'ed-acute', state: 'occupied', patientInitials: 'DL', acuity: 2, assignedNurse: 'T. Reeves', stateChangedMinAgo: 150, patientName: 'Derek Lin', mrn: 'MRN-5517', attending: 'Dr. Nguyen', losHours: 3, isolation: 'NONE', admitSource: 'ED' },
  ],
};

const edFastTrack: BedUnit = {
  id: 'ed-ft',
  name: 'ED — Fast Track',
  shortName: 'FAST TRK',
  floor: '1',
  beds: [
    { id: 'FT1', label: 'FT-1', unitId: 'ed-ft', state: 'occupied', patientId: 'P003', patientInitials: 'RF', acuity: 4, assignedNurse: 'A. Torres', stateChangedMinAgo: 60, patientName: 'Rachel Flores', mrn: 'MRN-1123', attending: 'Dr. Adams', losHours: 1, isolation: 'NONE', admitSource: 'ED' },
    { id: 'FT2', label: 'FT-2', unitId: 'ed-ft', state: 'ready', assignedNurse: 'A. Torres', stateChangedMinAgo: 20 },
    { id: 'FT3', label: 'FT-3', unitId: 'ed-ft', state: 'occupied', patientInitials: 'PG', acuity: 5, assignedNurse: 'L. Brown', stateChangedMinAgo: 30, patientName: 'Paul Garcia', mrn: 'MRN-9047', attending: 'Dr. Adams', losHours: 1, isolation: 'NONE', admitSource: 'ED' },
    { id: 'FT4', label: 'FT-4', unitId: 'ed-ft', state: 'ready', assignedNurse: 'L. Brown', stateChangedMinAgo: 90 },
  ],
};

const icu: BedUnit = {
  id: 'icu',
  name: 'ICU',
  shortName: 'ICU',
  floor: '2',
  beds: [
    { id: 'ICU1', label: 'ICU-1', unitId: 'icu', state: 'occupied', patientInitials: 'WJ', acuity: 1, assignedNurse: 'K. Foster', stateChangedMinAgo: 480, patientName: 'Walter Jensen', mrn: 'MRN-6632', attending: 'Dr. Chen', losHours: 72, isolation: 'NONE', admitSource: 'OR' },
    { id: 'ICU2', label: 'ICU-2', unitId: 'icu', state: 'occupied', patientInitials: 'EM', acuity: 1, assignedNurse: 'K. Foster', stateChangedMinAgo: 360, patientName: 'Elena Martinez', mrn: 'MRN-2018', attending: 'Dr. Rivera', losHours: 48, isolation: 'NONE', admitSource: 'ED' },
    { id: 'ICU3', label: 'ICU-3', unitId: 'icu', state: 'occupied', patientInitials: 'AT', acuity: 2, assignedNurse: 'R. Gomez', stateChangedMinAgo: 720, patientName: 'Ahmad Tariq', mrn: 'MRN-8450', attending: 'Dr. Patel', losHours: 120, isolation: 'AIRBORNE', admitSource: 'Transfer' },
    { id: 'ICU4', label: 'ICU-4', unitId: 'icu', state: 'not_staffed', stateChangedMinAgo: 120 },
    { id: 'ICU5', label: 'ICU-5', unitId: 'icu', state: 'occupied', patientInitials: 'HB', acuity: 1, assignedNurse: 'R. Gomez', stateChangedMinAgo: 200, patientName: 'Helen Brooks', mrn: 'MRN-3774', attending: 'Dr. Kim', losHours: 36, isolation: 'NONE', admitSource: 'ED' },
    { id: 'ICU6', label: 'ICU-6', unitId: 'icu', state: 'blocked', blockReason: 'Vent maintenance', stateChangedMinAgo: 60 },
  ],
};

const stepdown: BedUnit = {
  id: 'stepdown',
  name: 'Stepdown',
  shortName: 'SDU',
  floor: '2',
  beds: [
    { id: 'SD1', label: 'SD-1', unitId: 'stepdown', state: 'occupied', patientInitials: 'NG', acuity: 3, assignedNurse: 'P. Walsh', stateChangedMinAgo: 300, patientName: 'Nancy Gomez', mrn: 'MRN-5190', attending: 'Dr. Wilson', losHours: 36, isolation: 'NONE', admitSource: 'OR' },
    { id: 'SD2', label: 'SD-2', unitId: 'stepdown', state: 'occupied', patientInitials: 'LF', acuity: 2, assignedNurse: 'P. Walsh', stateChangedMinAgo: 600, patientName: 'Lawrence Fitzgerald', mrn: 'MRN-7823', attending: 'Dr. Foster', losHours: 60, isolation: 'NONE', admitSource: 'Transfer', dischargeMilestones: { dcOrderWritten: true, rideConfirmed: false, medsToeBedside: false, estimatedDcTime: '16:00' } },
    { id: 'SD3', label: 'SD-3', unitId: 'stepdown', state: 'not_staffed', stateChangedMinAgo: 180 },
    { id: 'SD4', label: 'SD-4', unitId: 'stepdown', state: 'dirty', stateChangedMinAgo: 8, evsStatus: 'requested' },
  ],
};

const medSurg2W: BedUnit = {
  id: 'ms-2w',
  name: 'Med-Surg 2-West',
  shortName: '2-WEST',
  floor: '2',
  beds: [
    { id: '201', label: '201', unitId: 'ms-2w', state: 'occupied', patientId: 'P004', patientInitials: 'AW', acuity: 3, assignedNurse: 'D. Miller', stateChangedMinAgo: 1680, patientName: 'Alice Washington', mrn: 'MRN-4401', attending: 'Dr. Nguyen', losHours: 42, isolation: 'CONTACT', admitSource: 'ED', dischargeMilestones: { dcOrderWritten: true, rideConfirmed: true, medsToeBedside: false, estimatedDcTime: '14:00' } },
    { id: '202', label: '202', unitId: 'ms-2w', state: 'occupied', patientId: 'P005', patientInitials: 'CR', acuity: 2, assignedNurse: 'D. Miller', stateChangedMinAgo: 2160, patientName: 'Carlos Reyes', mrn: 'MRN-5578', attending: 'Dr. Patel', losHours: 54, isolation: 'NONE', admitSource: 'Transfer' },
    { id: '203', label: '203', unitId: 'ms-2w', state: 'occupied', patientInitials: 'TK', acuity: 4, assignedNurse: 'H. Park', stateChangedMinAgo: 480, patientName: 'Tanya Kowalski', mrn: 'MRN-6785', attending: 'Dr. Adams', losHours: 12, isolation: 'NONE', admitSource: 'Direct' },
    { id: '204', label: '204', unitId: 'ms-2w', state: 'ready', assignedNurse: 'H. Park', stateChangedMinAgo: 60 },
    { id: '205', label: '205', unitId: 'ms-2w', state: 'occupied', patientInitials: 'SB', acuity: 3, assignedNurse: 'H. Park', stateChangedMinAgo: 360, patientName: 'Samuel Blake', mrn: 'MRN-3920', attending: 'Dr. Wilson', losHours: 9, isolation: 'NONE', admitSource: 'ED' },
    { id: '206', label: '206', unitId: 'ms-2w', state: 'dirty', stateChangedMinAgo: 22, evsStatus: 'in_progress' },
    { id: '207', label: '207', unitId: 'ms-2w', state: 'occupied', patientInitials: 'JR', acuity: 3, assignedNurse: 'V. Singh', stateChangedMinAgo: 1200, patientName: 'Janet Robinson', mrn: 'MRN-8134', attending: 'Dr. Kim', losHours: 30, isolation: 'NONE', admitSource: 'ED', dischargeMilestones: { dcOrderWritten: true, rideConfirmed: true, medsToeBedside: true, estimatedDcTime: '12:30' } },
    { id: '208', label: '208', unitId: 'ms-2w', state: 'occupied', patientInitials: 'MW', acuity: 4, assignedNurse: 'V. Singh', stateChangedMinAgo: 720, patientName: 'Michael Watts', mrn: 'MRN-2649', attending: 'Dr. Foster', losHours: 18, isolation: 'NONE', admitSource: 'Direct' },
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
    { id: '301', label: '301', unitId: 'ms-3e', state: 'occupied', patientInitials: 'FC', acuity: 3, assignedNurse: 'C. Adams', stateChangedMinAgo: 960, patientName: 'Frank Collier', mrn: 'MRN-1287', attending: 'Dr. Chen', losHours: 24, isolation: 'NONE', admitSource: 'ED' },
    { id: '302', label: '302', unitId: 'ms-3e', state: 'occupied', patientInitials: 'RL', acuity: 4, assignedNurse: 'C. Adams', stateChangedMinAgo: 480, patientName: 'Rita Lawson', mrn: 'MRN-9362', attending: 'Dr. Wilson', losHours: 12, isolation: 'NONE', admitSource: 'Direct' },
    { id: '303', label: '303', unitId: 'ms-3e', state: 'ready', assignedNurse: 'C. Adams', stateChangedMinAgo: 120 },
    { id: '304', label: '304', unitId: 'ms-3e', state: 'not_staffed', stateChangedMinAgo: 90 },
    { id: '305', label: '305', unitId: 'ms-3e', state: 'occupied', patientInitials: 'BE', acuity: 3, assignedNurse: 'T. Jackson', stateChangedMinAgo: 1440, patientName: 'Brian Espinoza', mrn: 'MRN-4056', attending: 'Dr. Nguyen', losHours: 36, isolation: 'NONE', admitSource: 'Transfer' },
    { id: '306', label: '306', unitId: 'ms-3e', state: 'ready', assignedNurse: 'T. Jackson', stateChangedMinAgo: 200 },
    { id: '307', label: '307', unitId: 'ms-3e', state: 'occupied', patientInitials: 'YS', acuity: 3, assignedNurse: 'T. Jackson', stateChangedMinAgo: 600, patientName: 'Yuki Sato', mrn: 'MRN-7291', attending: 'Dr. Kim', losHours: 15, isolation: 'NONE', admitSource: 'OR' },
    { id: '308', label: '308', unitId: 'ms-3e', state: 'blocked', blockReason: 'Isolation hold', stateChangedMinAgo: 48 },
    { id: '309', label: '309', unitId: 'ms-3e', state: 'dirty', stateChangedMinAgo: 15, evsStatus: 'in_progress' },
    { id: '310', label: '310', unitId: 'ms-3e', state: 'occupied', patientInitials: 'GN', acuity: 4, assignedNurse: 'B. Wells', stateChangedMinAgo: 240, patientName: 'Gloria Nguyen', mrn: 'MRN-8509', attending: 'Dr. Adams', losHours: 6, isolation: 'NONE', admitSource: 'ED' },
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

// ─────────────────────────────────────────────────────────────────────────
// Surge escalation transforms
// ─────────────────────────────────────────────────────────────────────────

/**
 * Transforms bed state to reflect surge conditions.
 * Called when surge protocol activates. Effects:
 *   1. Ready beds in high-demand units → reserved for incoming
 *   2. Dirty beds fast-turn → ready (EVS rapid response)
 *   3. Overflow Hall C beds get staffed and start receiving patients
 *   4. Not-staffed beds get float pool coverage
 *
 * Returns a deep copy — doesn't mutate input.
 */
export function escalateBedState(baseUnits: BedUnit[]): BedUnit[] {
  const units: BedUnit[] = JSON.parse(JSON.stringify(baseUnits));

  for (const unit of units) {
    for (const bed of unit.beds) {
      // Dirty beds fast-turn → ready (EVS surge response, < 15min)
      if (bed.state === 'dirty') {
        bed.state = 'ready';
        bed.stateChangedMinAgo = 2;
      }
      // Not-staffed → ready (float pool deployed)
      if (bed.state === 'not_staffed') {
        bed.state = 'ready';
        bed.assignedNurse = 'Float Pool';
        bed.stateChangedMinAgo = 5;
      }
    }

    // ED Acute: reserve the newly-ready beds for EMS inbound
    if (unit.id === 'ed-acute') {
      const readyBeds = unit.beds.filter(b => b.state === 'ready');
      for (const bed of readyBeds) {
        bed.state = 'reserved';
        bed.reservedFor = 'Surge Hold — EMS Inbound';
        bed.stateChangedMinAgo = 1;
      }
    }

    // ED Trauma: reserve any ready bay
    if (unit.id === 'ed-trauma') {
      const readyBeds = unit.beds.filter(b => b.state === 'ready');
      for (const bed of readyBeds) {
        bed.state = 'reserved';
        bed.reservedFor = 'Trauma Standby';
        bed.stateChangedMinAgo = 0;
      }
    }

    // Overflow: first 2 beds → occupied (early surge patients),
    // remaining → ready with float nurses
    if (unit.surgeOnly) {
      unit.beds.forEach((bed, i) => {
        if (i < 2) {
          bed.state = 'occupied';
          bed.patientInitials = ['MH', 'DV'][i];
          bed.acuity = 3;
          bed.assignedNurse = 'Float Pool';
          bed.stateChangedMinAgo = 10;
        } else {
          bed.state = 'ready';
          bed.assignedNurse = 'Float Pool';
          bed.stateChangedMinAgo = 0;
        }
      });
    }
  }

  return units;
}

/**
 * Revert surge escalation — return to baseline bed state.
 * Simply re-seeds from the original constants.
 */
export function deescalateBedState(): BedUnit[] {
  return seedBedState();
}

// ─────────────────────────────────────────────────────────────────────────
// Pending admits queue
// ─────────────────────────────────────────────────────────────────────────

export interface PendingAdmit {
  id: string;
  patientName: string;
  mrn: string;
  source: 'ED' | 'OR' | 'Transfer' | 'Direct';
  acuity: 1 | 2 | 3 | 4 | 5;
  chiefComplaint: string;
  requestedUnit: string;      // "ICU", "Med-Surg", "Stepdown"
  waitingMinutes: number;
  requestedAt: string;        // "13:42"
  attending: string;
}

/**
 * Pending admission queue — patients waiting for a bed assignment.
 * Mix of ED holds, post-op, transfers, and direct admits.
 */
export const PENDING_ADMITS: PendingAdmit[] = [
  // ED holds — patients boarding in ED, need floor bed
  {
    id: 'PA-001',
    patientName: 'Diane Okafor',
    mrn: 'MRN-6140',
    source: 'ED',
    acuity: 2,
    chiefComplaint: 'Acute CHF exacerbation',
    requestedUnit: 'Stepdown',
    waitingMinutes: 147,
    requestedAt: '10:33',
    attending: 'Dr. Foster',
  },
  {
    id: 'PA-002',
    patientName: 'Martin Schultz',
    mrn: 'MRN-3385',
    source: 'ED',
    acuity: 3,
    chiefComplaint: 'Cellulitis with fever',
    requestedUnit: 'Med-Surg',
    waitingMinutes: 82,
    requestedAt: '11:38',
    attending: 'Dr. Wilson',
  },
  // Post-surgical — needs ICU bed
  {
    id: 'PA-003',
    patientName: 'Catherine Liu',
    mrn: 'MRN-9954',
    source: 'OR',
    acuity: 1,
    chiefComplaint: 'Post craniotomy — tumor resection',
    requestedUnit: 'ICU',
    waitingMinutes: 35,
    requestedAt: '12:25',
    attending: 'Dr. Chen',
  },
  // Transfers from outside hospitals
  {
    id: 'PA-004',
    patientName: 'Robert Avery',
    mrn: 'MRN-7021',
    source: 'Transfer',
    acuity: 2,
    chiefComplaint: 'STEMI — cath lab post-PCI',
    requestedUnit: 'ICU',
    waitingMinutes: 62,
    requestedAt: '11:58',
    attending: 'Dr. Rivera',
  },
  {
    id: 'PA-005',
    patientName: 'Priya Sharma',
    mrn: 'MRN-2467',
    source: 'Transfer',
    acuity: 3,
    chiefComplaint: 'Traumatic femur fracture — ortho consult',
    requestedUnit: 'Med-Surg',
    waitingMinutes: 110,
    requestedAt: '11:10',
    attending: 'Dr. Patel',
  },
  // Direct admits
  {
    id: 'PA-006',
    patientName: 'George Whitfield',
    mrn: 'MRN-5803',
    source: 'Direct',
    acuity: 3,
    chiefComplaint: 'Uncontrolled diabetes with ketoacidosis',
    requestedUnit: 'Stepdown',
    waitingMinutes: 28,
    requestedAt: '12:32',
    attending: 'Dr. Kim',
  },
  {
    id: 'PA-007',
    patientName: 'Evelyn Hart',
    mrn: 'MRN-1178',
    source: 'Direct',
    acuity: 4,
    chiefComplaint: 'Elective cholecystectomy — pre-op admit',
    requestedUnit: 'Med-Surg',
    waitingMinutes: 15,
    requestedAt: '12:45',
    attending: 'Dr. Adams',
  },
];

/** Deep-copy factory so consumers get a mutable pending admits list. */
export function getPendingAdmits(): PendingAdmit[] {
  return JSON.parse(JSON.stringify(PENDING_ADMITS));
}
