/**
 * PULSE Cross-Session Memory
 * --------------------------
 * Durable localStorage layer so the demo and the AI assistant survive a
 * reload, an app relaunch, or the iPhone being backgrounded.
 *
 * Two independent stores:
 *
 *  1. App state ('pulse-state-v1'): a snapshot of the realtime cache for a
 *     whitelist of operational keys (scenario, surge, beds, patients, tasks,
 *     notes, alert acks, bracelet pool). `lib/realtime.ts` hydrates this into
 *     `store.cache` at module init, BEFORE React mounts, so `useRealtimeState`
 *     picks it up with zero component changes.
 *
 *  2. AI memory ('pulse-ai-memory-v1'): the assistant transcript. ChatAssistant
 *     sends the full message history to Gemini on every turn, so restoring the
 *     transcript restores the model's memory of the conversation for free.
 *
 * Both writes are debounced and flushed on `beforeunload` so a fast reload
 * never loses the last change. Every localStorage access is guarded. With no
 * storage available the app simply behaves as it did before (in-memory only).
 *
 * The single source of truth for "forget everything" is `clearAllPulseMemory`,
 * wired into the Settings reset so the wipe control is visible and explicit.
 */

const APP_STATE_KEY = 'pulse-state-v1';
const AI_MEMORY_KEY = 'pulse-ai-memory-v1';

/**
 * Only operational/demo state worth carrying across sessions. Device id and
 * device name are persisted separately by realtime.ts and intentionally
 * excluded here (they are identity, not demo state).
 */
export const PERSISTED_STATE_KEYS = [
  'surge-mode',
  'urgent-tasks',
  'active-scenario',
  'bed-units',
  'admission-queue',
  'patients',
  'clinical-notes',
  'alert-acks',
  'bracelet-pool',
] as const;

interface VersionMeta {
  version: number;
  device: string;
}

interface PersistedSnapshot {
  v: 1;
  savedAt: number;
  cache: Record<string, unknown>;
  versions: Record<string, VersionMeta>;
}

export interface PersistedAiMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
}

interface PersistedAiMemory {
  v: 1;
  savedAt: number;
  messages: PersistedAiMessage[];
}

/** Keep the restored transcript bounded so the system prompt stays cheap. */
const AI_MEMORY_MAX = 40;

// ──────────────────────────────────────────────────────────────────────────────
// Guarded localStorage helpers
// ──────────────────────────────────────────────────────────────────────────────

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or storage disabled (private mode). Stay in-memory.
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// App state: load
// ──────────────────────────────────────────────────────────────────────────────

export function loadPersistedState(): PersistedSnapshot | null {
  const raw = safeGet(APP_STATE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedSnapshot;
    if (!parsed || parsed.v !== 1 || typeof parsed.cache !== 'object' || parsed.cache === null) {
      return null;
    }
    return parsed;
  } catch {
    // Corrupt snapshot. Drop it so we don't keep retrying a broken parse.
    safeRemove(APP_STATE_KEY);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// App state: debounced save (+ beforeunload flush so a fast reload is safe)
// ──────────────────────────────────────────────────────────────────────────────

let statePending: string | null = null;
let stateTimer: ReturnType<typeof setTimeout> | null = null;

function flushState(): void {
  if (stateTimer) {
    clearTimeout(stateTimer);
    stateTimer = null;
  }
  if (statePending !== null) {
    safeSet(APP_STATE_KEY, statePending);
    statePending = null;
  }
}

export function persistState(
  cache: Map<string, unknown>,
  versions: Map<string, VersionMeta>,
): void {
  if (typeof window === 'undefined') return;

  const snapCache: Record<string, unknown> = {};
  const snapVersions: Record<string, VersionMeta> = {};
  for (const key of PERSISTED_STATE_KEYS) {
    if (cache.has(key)) {
      snapCache[key] = cache.get(key);
      const vm = versions.get(key);
      if (vm) snapVersions[key] = vm;
    }
  }

  if (Object.keys(snapCache).length === 0) {
    // Nothing meaningful to keep (post-reset). Drop the snapshot entirely.
    statePending = null;
    if (stateTimer) {
      clearTimeout(stateTimer);
      stateTimer = null;
    }
    safeRemove(APP_STATE_KEY);
    return;
  }

  const snapshot: PersistedSnapshot = {
    v: 1,
    savedAt: Date.now(),
    cache: snapCache,
    versions: snapVersions,
  };
  try {
    statePending = JSON.stringify(snapshot);
  } catch {
    return;
  }
  // Coalesce bursts of writes into one localStorage hit.
  if (stateTimer) return;
  stateTimer = setTimeout(flushState, 400);
}

export function clearPersistedState(): void {
  statePending = null;
  if (stateTimer) {
    clearTimeout(stateTimer);
    stateTimer = null;
  }
  safeRemove(APP_STATE_KEY);
}

// ──────────────────────────────────────────────────────────────────────────────
// AI memory: load / debounced save / clear
// ──────────────────────────────────────────────────────────────────────────────

export function loadAiMemory(): PersistedAiMessage[] | null {
  const raw = safeGet(AI_MEMORY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedAiMemory;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.messages) || parsed.messages.length === 0) {
      return null;
    }
    return parsed.messages.slice(-AI_MEMORY_MAX);
  } catch {
    safeRemove(AI_MEMORY_KEY);
    return null;
  }
}

let aiPending: string | null = null;
let aiTimer: ReturnType<typeof setTimeout> | null = null;

function flushAiMemory(): void {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  if (aiPending !== null) {
    safeSet(AI_MEMORY_KEY, aiPending);
    aiPending = null;
  }
}

export function persistAiMemory(messages: PersistedAiMessage[]): void {
  if (typeof window === 'undefined') return;

  const trimmed = messages
    .slice(-AI_MEMORY_MAX)
    .map((m) => ({ id: m.id, role: m.role, content: m.content ?? '' }));

  if (trimmed.length === 0) {
    aiPending = null;
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    safeRemove(AI_MEMORY_KEY);
    return;
  }

  const payload: PersistedAiMemory = { v: 1, savedAt: Date.now(), messages: trimmed };
  try {
    aiPending = JSON.stringify(payload);
  } catch {
    return;
  }
  if (aiTimer) return;
  aiTimer = setTimeout(flushAiMemory, 500);
}

export function clearAiMemory(): void {
  aiPending = null;
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  safeRemove(AI_MEMORY_KEY);
}

// ──────────────────────────────────────────────────────────────────────────────
// One control to forget everything (wired into the Settings reset)
// ──────────────────────────────────────────────────────────────────────────────

export function clearAllPulseMemory(): void {
  clearPersistedState();
  clearAiMemory();
}

// Flush any pending debounced writes if the tab is closing or being hidden,
// so a reload or app-switch never drops the last change.
if (typeof window !== 'undefined') {
  const flushAll = () => {
    flushState();
    flushAiMemory();
  };
  window.addEventListener('beforeunload', flushAll);
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
}
