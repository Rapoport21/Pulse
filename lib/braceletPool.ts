/**
 * Bracelet pool — the shared data model for the SCAD participatory demo.
 *
 * Twenty numbered slots (01–20). Each slot tracks whether a physical
 * bracelet has been handed to a guest and admitted as a patient. The
 * pool is synced across all connected devices via `useRealtimeState`
 * in App.tsx (key: `bracelet-pool`).
 *
 * Flow:
 *  1. Operator hands guest a bracelet (e.g. #03).
 *  2. Operator opens MobileAdmitFlow, types guest's real name, picks
 *     bracelet #03 from the dropdown, submits.
 *  3. A patient record is created. The pool slot for #03 flips to
 *     `admitted` with that patient's ID.
 *  4. Later, operator scans the physical bracelet. The QR encodes
 *     `pulse://bracelet/03` → the scanner looks up slot #03 → if
 *     admitted, opens that patient's chart; if empty, offers to admit.
 *  5. Reset clears the pool via `broadcastReset()`.
 *
 * The pool shape is intentionally flat so it merges cleanly through the
 * optimistic-concurrency envelope used by `useRealtimeState`.
 */

/** Two-digit bracelet number, e.g. "01", "07", "20". */
export type BraceletNumber = string;

/** A single slot in the bracelet pool. */
export interface BraceletSlot {
  /** Two-digit number printed on the physical bracelet. */
  number: BraceletNumber;
  /** Whether this bracelet has been handed out + admitted. */
  status: 'empty' | 'admitted';
  /** Patient ID this bracelet is linked to (present when `status` is `admitted`). */
  patientId?: string;
  /** Display name cached on the slot so Settings can label the chip without a patient lookup. */
  patientName?: string;
  /** ISO timestamp of admission (debug / sort). */
  admittedAt?: string;
}

/** The full bracelet pool — a flat array of slots. */
export interface BraceletPool {
  bracelets: BraceletSlot[];
}

/** Default pool size. Can be bumped for larger events. */
export const POOL_SIZE = 20;

/** Build a fresh empty pool. Used as the initial state and after reset. */
export function makeInitialPool(size: number = POOL_SIZE): BraceletPool {
  return {
    bracelets: Array.from({ length: size }, (_, i) => ({
      number: String(i + 1).padStart(2, '0'),
      status: 'empty' as const,
    })),
  };
}

/** The default 20-slot pool. */
export const INITIAL_POOL: BraceletPool = makeInitialPool();

// ─────────────────────────────────────────────────────────────────────────
// QR payload format
// ─────────────────────────────────────────────────────────────────────────

/**
 * URL scheme for bracelet QR codes. Parallels `pulse://patient/<id>`
 * and `pulse://tab/<name>` schemes already in use.
 */
export const BRACELET_QR_PREFIX = 'pulse://bracelet/';

/** Encode a bracelet number into its QR payload string. */
export function braceletQRPayload(number: BraceletNumber): string {
  return `${BRACELET_QR_PREFIX}${number}`;
}

/** Parse a QR payload string. Returns the bracelet number or null if not a bracelet payload. */
export function parseBraceletPayload(payload: string): BraceletNumber | null {
  if (!payload.startsWith(BRACELET_QR_PREFIX)) return null;
  const rest = payload.slice(BRACELET_QR_PREFIX.length);
  const number = rest.split(/[?#/]/)[0];
  if (!/^\d{1,3}$/.test(number)) return null;
  return number.padStart(2, '0');
}

// ─────────────────────────────────────────────────────────────────────────
// Pool mutations (pure functions — return new pools)
// ─────────────────────────────────────────────────────────────────────────

/** Find a slot by bracelet number. */
export function findSlot(pool: BraceletPool, number: BraceletNumber): BraceletSlot | undefined {
  return pool.bracelets.find((b) => b.number === number);
}

/** List bracelet numbers not yet linked to a patient. */
export function availableNumbers(pool: BraceletPool): BraceletNumber[] {
  return pool.bracelets.filter((b) => b.status === 'empty').map((b) => b.number);
}

/** List bracelet numbers currently linked to a patient. */
export function usedNumbers(pool: BraceletPool): BraceletNumber[] {
  return pool.bracelets.filter((b) => b.status === 'admitted').map((b) => b.number);
}

/** Count of admitted slots. */
export function usedCount(pool: BraceletPool): number {
  return pool.bracelets.filter((b) => b.status === 'admitted').length;
}

/** Link a bracelet to a patient. No-op if slot is already admitted or doesn't exist. */
export function linkBracelet(
  pool: BraceletPool,
  number: BraceletNumber,
  patientId: string,
  patientName?: string,
): BraceletPool {
  return {
    bracelets: pool.bracelets.map((b) =>
      b.number === number && b.status === 'empty'
        ? {
            ...b,
            status: 'admitted' as const,
            patientId,
            patientName,
            admittedAt: new Date().toISOString(),
          }
        : b,
    ),
  };
}

/** Release a bracelet back to the pool (e.g. on discharge or manual clear). */
export function unlinkBracelet(pool: BraceletPool, number: BraceletNumber): BraceletPool {
  return {
    bracelets: pool.bracelets.map((b) =>
      b.number === number
        ? {
            number: b.number,
            status: 'empty' as const,
          }
        : b,
    ),
  };
}

/** Find the bracelet number linked to a given patient, if any. */
export function braceletForPatient(pool: BraceletPool, patientId: string): BraceletNumber | null {
  const slot = pool.bracelets.find((b) => b.patientId === patientId);
  return slot?.number ?? null;
}
