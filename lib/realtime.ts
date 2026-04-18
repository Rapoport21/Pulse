/**
 * PULSE Generic Realtime Sync Layer
 * ----------------------------------
 * Single-channel Supabase Broadcast + Presence client.
 *
 * Designed so adding a new synced feature is one line:
 *
 *     const [value, setValue] = useRealtimeState('my-feature', defaultValue)
 *
 * Surge mode is the first consumer (see lib/surgeTaskTemplates.ts), but the
 * layer itself is feature-agnostic.
 *
 * Degrades gracefully:
 *  - If VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing, the layer
 *    runs in "local-only" mode: hooks still work, but nothing crosses devices.
 *    `useRealtimeState` falls back to its initial value, `getConnectionStatus`
 *    reports 'offline'.
 */

import { useEffect, useRef, useState } from 'react';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

export interface RealtimeLogEntry {
  ts: number;
  direction: 'in' | 'out';
  type: string;
  key?: string;
  payloadPreview: string;
  source?: string;
}

interface OutgoingMessage<T = unknown> {
  type: string;
  key?: string;
  payload?: T;
  source: string;
  ts: number;
}

interface PresenceMeta {
  device: string;
  /** Human-readable name: iPhone / iPad / Mac / Screen. Editable in Settings. */
  deviceName: string;
  joinedAt: number;
}

/** Keyed by device id. Populated from presence `sync` events. */
export type PresenceMap = Record<string, PresenceMeta>;

// ──────────────────────────────────────────────────────────────────────────────
// Optimistic concurrency: versioned envelope for state-update payloads.
//
// Each synced key tracks a Lamport-style counter + the last-writer's device id
// so concurrent edits resolve deterministically instead of permanently
// diverging. Tiebreak: higher device id (lex string compare) wins at equal
// version. The losing device surfaces a `lost-edit` event so the UI can show
// a toast.
// ──────────────────────────────────────────────────────────────────────────────

interface VersionEnvelope<T = unknown> {
  /** Lamport version, per key. */
  __v: number;
  /** Device id that authored this version (tiebreak key). */
  __d: string;
  /** Human-friendly wall-clock timestamp (debug only). */
  __t: number;
  /** The actual value being synced. */
  value: T;
}

function isEnvelope(p: unknown): p is VersionEnvelope {
  return (
    p !== null &&
    typeof p === 'object' &&
    '__v' in p &&
    typeof (p as { __v: unknown }).__v === 'number' &&
    '__d' in p &&
    typeof (p as { __d: unknown }).__d === 'string' &&
    'value' in p
  );
}

export interface LostEditInfo {
  /** useRealtimeState key whose optimistic write was clobbered. */
  key: string;
  /** Our version at the time of the lost write. */
  localVersion: number;
  /** The winning version that overwrote us. */
  incomingVersion: number;
  /** The device that published the winning version. */
  incomingDevice: string;
  /** Wall-clock ts of the winning payload (debug). */
  at: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-device identity
// ──────────────────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'pulse-device-id';

function loadOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return cryptoRandom();
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fresh = cryptoRandom();
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return cryptoRandom();
  }
}

function cryptoRandom(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  }
  return 'dev-' + Math.random().toString(36).slice(2, 11);
}

const DEVICE_ID = loadOrCreateDeviceId();
export function getDeviceId(): string {
  return DEVICE_ID;
}

// ──────────────────────────────────────────────────────────────────────────────
// Device name (human-readable label shown in Send-to sheets and Settings).
// Auto-detected from user agent, overridable via localStorage.
// ──────────────────────────────────────────────────────────────────────────────

const DEVICE_NAME_KEY = 'pulse-device-name';

/** Best-effort UA sniff. Returns "iPhone" / "iPad" / "Mac" / "Device". */
function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Device';
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac in the UA but has touch points
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)) {
    return /iPad/.test(ua) ? 'iPad' : 'iPad';
  }
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android' : 'Android Tablet';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Device';
}

function loadOrDetectDeviceName(): string {
  if (typeof window === 'undefined') return detectDeviceName();
  try {
    const stored = window.localStorage.getItem(DEVICE_NAME_KEY);
    if (stored && stored.trim()) return stored;
  } catch {
    // ignore
  }
  return detectDeviceName();
}

let CURRENT_DEVICE_NAME = loadOrDetectDeviceName();

export function getDeviceName(): string {
  return CURRENT_DEVICE_NAME;
}

/** Override the device name. Persists to localStorage and re-tracks presence. */
export function setDeviceName(name: string): void {
  const trimmed = name.trim() || detectDeviceName();
  CURRENT_DEVICE_NAME = trimmed;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DEVICE_NAME_KEY, trimmed);
    } catch {
      // ignore
    }
  }
  // Re-track presence so peers see the new label immediately.
  if (store.channel && store.status === 'connected') {
    store.channel
      .track({ device: DEVICE_ID, deviceName: trimmed, joinedAt: Date.now() } satisfies PresenceMeta)
      .catch((e) => console.warn('[realtime] re-track failed', e));
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Module-level singleton
// ──────────────────────────────────────────────────────────────────────────────

const CHANNEL_NAME = 'pulse-demo';
const BROADCAST_EVENT = 'pulse-msg';

interface RealtimeStore {
  client: SupabaseClient | null;
  channel: RealtimeChannel | null;
  status: ConnectionStatus;
  // Local cache of all keyed states. Keyed by useRealtimeState key.
  cache: Map<string, unknown>;
  // Per-key set of subscribers (React setState fns).
  cacheSubs: Map<string, Set<(value: unknown) => void>>;
  // Generic event subscribers (key = event name)
  eventSubs: Map<string, Set<(payload: unknown) => void>>;
  // Status subscribers
  statusSubs: Set<(s: ConnectionStatus) => void>;
  // Presence subscribers
  presenceSubs: Set<(devices: string[]) => void>;
  presenceState: string[];
  // Keyed presence meta (device id → PresenceMeta). Populated from Supabase
  // presence sync events. Falls back to a single local entry when offline.
  presenceMeta: PresenceMap;
  presenceMetaSubs: Set<(meta: PresenceMap) => void>;
  // Ring buffer of last 50 messages for the debug panel.
  log: RealtimeLogEntry[];
  logSubs: Set<(log: RealtimeLogEntry[]) => void>;
  // Last measured latency (ms) — naive ping.
  latencyMs: number;
  // Pending state-request promises waiting on a state-response.
  pendingStateRequests: Map<string, (value: unknown) => void>;
  // Per-key Lamport version + last writer for optimistic concurrency.
  versions: Map<string, { version: number; device: string }>;
  // Subscribers for the 'lost-edit' signal.
  lostEditSubs: Set<(info: LostEditInfo) => void>;
}

const store: RealtimeStore = {
  client: null,
  channel: null,
  status: 'connecting',
  cache: new Map(),
  cacheSubs: new Map(),
  eventSubs: new Map(),
  statusSubs: new Set(),
  presenceSubs: new Set(),
  presenceState: [DEVICE_ID],
  presenceMeta: {
    [DEVICE_ID]: {
      device: DEVICE_ID,
      deviceName: CURRENT_DEVICE_NAME,
      joinedAt: Date.now(),
    },
  },
  presenceMetaSubs: new Set(),
  log: [],
  logSubs: new Set(),
  latencyMs: 0,
  pendingStateRequests: new Map(),
  versions: new Map(),
  lostEditSubs: new Set(),
};

const LOG_MAX = 50;

function appendLog(entry: RealtimeLogEntry) {
  store.log.push(entry);
  if (store.log.length > LOG_MAX) store.log.splice(0, store.log.length - LOG_MAX);
  store.logSubs.forEach((fn) => fn([...store.log]));
}

function setStatus(s: ConnectionStatus) {
  if (store.status === s) return;
  store.status = s;
  store.statusSubs.forEach((fn) => fn(s));
}

function setPresence(devices: string[]) {
  store.presenceState = devices;
  store.presenceSubs.forEach((fn) => fn([...devices]));
}

function setPresenceMeta(meta: PresenceMap) {
  store.presenceMeta = meta;
  store.presenceMetaSubs.forEach((fn) => fn({ ...meta }));
}

function previewRaw(p: unknown): string {
  try {
    const s = JSON.stringify(p);
    return s && s.length > 120 ? s.slice(0, 120) + '…' : s || '';
  } catch {
    return String(p);
  }
}

function previewPayload(p: unknown): string {
  // Unwrap version envelopes so the debug log shows the actual payload
  // annotated with the Lamport version instead of the raw `__v/__d/__t`
  // wrapper every time.
  if (isEnvelope(p)) {
    return `v=${p.__v} · ${previewRaw(p.value)}`;
  }
  return previewRaw(p);
}

// ──────────────────────────────────────────────────────────────────────────────
// Wire up the channel
// ──────────────────────────────────────────────────────────────────────────────

function readSupabaseEnv() {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return {
    url: env.VITE_SUPABASE_URL || '',
    anonKey: env.VITE_SUPABASE_ANON_KEY || '',
  };
}

let initStarted = false;
function ensureInit() {
  if (initStarted) return;
  initStarted = true;

  const { url, anonKey } = readSupabaseEnv();
  if (!url || !anonKey) {
    setStatus('offline');
    appendLog({
      ts: Date.now(),
      direction: 'in',
      type: 'system',
      payloadPreview: 'Supabase env vars not set — running in local-only mode.',
    });
    return;
  }

  try {
    store.client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 20 } },
    });

    const channel = store.client.channel(CHANNEL_NAME, {
      config: {
        presence: { key: DEVICE_ID },
        broadcast: { self: false, ack: true },
      },
    });

    channel.on('broadcast', { event: BROADCAST_EVENT }, (msg) => {
      const data = msg.payload as OutgoingMessage;
      if (!data || data.source === DEVICE_ID) return; // ignore our own echoes
      handleIncoming(data);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState() as Record<string, PresenceMeta[]>;
      const devices = Object.keys(presenceState);
      setPresence(devices);
      // Flatten to a keyed meta map. Supabase stores an array of meta objects
      // per key (one per concurrent connection), so we take the first.
      const meta: PresenceMap = {};
      for (const id of devices) {
        const list = presenceState[id];
        if (list && list.length > 0) {
          const entry = list[0];
          meta[id] = {
            device: entry.device ?? id,
            deviceName: entry.deviceName ?? 'Device',
            joinedAt: entry.joinedAt ?? Date.now(),
          };
        }
      }
      setPresenceMeta(meta);
      appendLog({
        ts: Date.now(),
        direction: 'in',
        type: 'presence-sync',
        payloadPreview: `${devices.length} device(s) connected`,
      });
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('connected');
        try {
          await channel.track({
            device: DEVICE_ID,
            deviceName: CURRENT_DEVICE_NAME,
            joinedAt: Date.now(),
          } satisfies PresenceMeta);
        } catch (e) {
          console.warn('[realtime] presence track failed', e);
        }
        appendLog({
          ts: Date.now(),
          direction: 'in',
          type: 'system',
          payloadPreview: `Connected as ${DEVICE_ID.slice(0, 8)}`,
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setStatus('disconnected');
        appendLog({
          ts: Date.now(),
          direction: 'in',
          type: 'system',
          payloadPreview: `Channel status: ${status}`,
        });
      } else if (status === 'CLOSED') {
        setStatus('disconnected');
      }
    });

    store.channel = channel;
  } catch (e) {
    console.error('[realtime] init failed', e);
    setStatus('offline');
  }
}

function handleIncoming(data: OutgoingMessage) {
  appendLog({
    ts: data.ts || Date.now(),
    direction: 'in',
    type: data.type,
    key: data.key,
    payloadPreview: previewPayload(data.payload),
    source: data.source,
  });

  // Generic event subscribers
  store.eventSubs.get(data.type)?.forEach((fn) => fn(data.payload));

  if (data.type === 'state-update' && data.key) {
    // Envelope-aware write with Lamport ordering. Back-compat: if an older
    // client sent a raw payload (no envelope), treat it as version 0 from an
    // unknown device — the next versioned write will win trivially.
    const key = data.key;
    let incomingVersion = 0;
    let incomingDevice = '';
    let incomingValue: unknown;
    if (isEnvelope(data.payload)) {
      incomingVersion = data.payload.__v;
      incomingDevice = data.payload.__d;
      incomingValue = data.payload.value;
    } else {
      incomingValue = data.payload;
    }

    const local = store.versions.get(key) ?? { version: 0, device: '' };

    // Accept if strictly newer, or equal version with a higher device-id
    // tiebreak. Reject stale or tied-but-lower updates.
    const accept =
      incomingVersion > local.version ||
      (incomingVersion === local.version && incomingDevice > DEVICE_ID) ||
      // First-ever update for this key — nothing local to compare against.
      (local.version === 0 && incomingVersion > 0);

    if (!accept) {
      appendLog({
        ts: Date.now(),
        direction: 'in',
        type: 'state-drop',
        key,
        payloadPreview: `stale v=${incomingVersion} (local v=${local.version})`,
        source: data.source,
      });
      return;
    }

    // Detect a concurrent-edit collision: we held a version at the same
    // number from ourselves, the incoming came in equal and won the
    // tiebreak — our optimistic write just got clobbered. Fire lost-edit
    // so the UI can toast the operator.
    const wasOurs = local.device === DEVICE_ID;
    const wasConcurrent = incomingVersion === local.version && local.version > 0;
    if (wasOurs && wasConcurrent) {
      const info: LostEditInfo = {
        key,
        localVersion: local.version,
        incomingVersion,
        incomingDevice,
        at: Date.now(),
      };
      store.lostEditSubs.forEach((fn) => {
        try {
          fn(info);
        } catch (e) {
          console.warn('[realtime] lost-edit handler threw', e);
        }
      });
      appendLog({
        ts: Date.now(),
        direction: 'in',
        type: 'lost-edit',
        key,
        payloadPreview: `our v=${local.version} lost to ${incomingDevice.slice(0, 8)}`,
        source: data.source,
      });
    }

    store.cache.set(key, incomingValue);
    store.versions.set(key, {
      version: incomingVersion,
      device: incomingDevice,
    });
    store.cacheSubs.get(key)?.forEach((fn) => fn(incomingValue));
  } else if (data.type === 'state-request' && data.key) {
    // Another device is asking — if we have it, respond with both the
    // current value and our version metadata so they can align.
    if (store.cache.has(data.key)) {
      const vmeta = store.versions.get(data.key) ?? {
        version: 0,
        device: DEVICE_ID,
      };
      publish('state-response', {
        key: data.key,
        value: store.cache.get(data.key),
        version: vmeta.version,
        device: vmeta.device,
      });
    }
  } else if (data.type === 'state-response') {
    const payload = data.payload as {
      key?: string;
      value?: unknown;
      version?: number;
      device?: string;
    };
    if (payload?.key && store.pendingStateRequests.has(payload.key)) {
      const resolver = store.pendingStateRequests.get(payload.key)!;
      store.pendingStateRequests.delete(payload.key);
      resolver(payload.value);
      // Adopt the peer's cache AND version so our next write is strictly
      // newer (prevents starting at v=1 on top of a v=5 network state).
      store.cache.set(payload.key, payload.value);
      if (
        typeof payload.version === 'number' &&
        typeof payload.device === 'string'
      ) {
        store.versions.set(payload.key, {
          version: payload.version,
          device: payload.device,
        });
      }
      store.cacheSubs.get(payload.key)?.forEach((fn) => fn(payload.value));
    }
  } else if (data.type === 'reset-all') {
    // Clear cache + versions and notify everyone.
    const keys = Array.from(store.cache.keys());
    store.cache.clear();
    store.versions.clear();
    keys.forEach((k) => {
      store.cacheSubs.get(k)?.forEach((fn) => fn(undefined));
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API: low-level
// ──────────────────────────────────────────────────────────────────────────────

export function publish<T = unknown>(type: string, payload?: T, key?: string) {
  ensureInit();
  const msg: OutgoingMessage<T> = {
    type,
    key,
    payload,
    source: DEVICE_ID,
    ts: Date.now(),
  };
  appendLog({
    ts: msg.ts,
    direction: 'out',
    type,
    key,
    payloadPreview: previewPayload(payload),
    source: DEVICE_ID,
  });
  if (store.channel && store.status === 'connected') {
    const t0 = performance.now();
    store.channel
      .send({ type: 'broadcast', event: BROADCAST_EVENT, payload: msg })
      .then(() => {
        store.latencyMs = Math.round(performance.now() - t0);
      })
      .catch((err) => {
        console.warn('[realtime] publish failed', err);
      });
  }
}

export function subscribe<T = unknown>(event: string, handler: (payload: T) => void): () => void {
  ensureInit();
  let set = store.eventSubs.get(event);
  if (!set) {
    set = new Set();
    store.eventSubs.set(event, set);
  }
  set.add(handler as (p: unknown) => void);
  return () => {
    store.eventSubs.get(event)?.delete(handler as (p: unknown) => void);
  };
}

export function getConnectionStatus(): ConnectionStatus {
  ensureInit();
  return store.status;
}

export function subscribeConnectionStatus(fn: (s: ConnectionStatus) => void): () => void {
  ensureInit();
  store.statusSubs.add(fn);
  // Push initial value.
  fn(store.status);
  return () => store.statusSubs.delete(fn);
}

export function getPresence(): string[] {
  ensureInit();
  return [...store.presenceState];
}

export function getDeviceCount(): number {
  ensureInit();
  return Math.max(1, store.presenceState.length);
}

export function subscribePresence(fn: (devices: string[]) => void): () => void {
  ensureInit();
  store.presenceSubs.add(fn);
  fn([...store.presenceState]);
  return () => store.presenceSubs.delete(fn);
}

/** Full presence meta keyed by device id — device name + joinedAt. */
export function getPresenceMeta(): PresenceMap {
  ensureInit();
  return { ...store.presenceMeta };
}

export function subscribePresenceMeta(fn: (meta: PresenceMap) => void): () => void {
  ensureInit();
  store.presenceMetaSubs.add(fn);
  fn({ ...store.presenceMeta });
  return () => store.presenceMetaSubs.delete(fn);
}

export function getLatencyMs(): number {
  return store.latencyMs;
}

export function getLog(): RealtimeLogEntry[] {
  return [...store.log];
}

export function subscribeLog(fn: (log: RealtimeLogEntry[]) => void): () => void {
  ensureInit();
  store.logSubs.add(fn);
  fn([...store.log]);
  return () => store.logSubs.delete(fn);
}

export function getRealtimeStateSnapshot<T>(key: string): T | undefined {
  return store.cache.get(key) as T | undefined;
}

export function broadcastReset() {
  publish('reset-all');
  // Also reset locally.
  const keys = Array.from(store.cache.keys());
  store.cache.clear();
  store.versions.clear();
  keys.forEach((k) => {
    store.cacheSubs.get(k)?.forEach((fn) => fn(undefined));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Optimistic concurrency: lost-edit subscription
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Subscribe to `lost-edit` events. Fires when this device authored the
 * latest version for a synced key and a peer's concurrent write at the
 * same version won the tiebreak — i.e. our optimistic edit was silently
 * clobbered by another device.
 *
 * Returns an unsubscribe function.
 */
export function onLostEdit(
  handler: (info: LostEditInfo) => void,
): () => void {
  ensureInit();
  store.lostEditSubs.add(handler);
  return () => {
    store.lostEditSubs.delete(handler);
  };
}

/** React wrapper for onLostEdit. Handler is kept up-to-date via a ref. */
export function useLostEditListener(
  handler: (info: LostEditInfo) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    return onLostEdit((info) => handlerRef.current(info));
  }, []);
}

/** Debug helper — read a key's current Lamport version + last writer. */
export function getVersionMeta(
  key: string,
): { version: number; device: string } | null {
  const meta = store.versions.get(key);
  return meta ? { ...meta } : null;
}

// ──────────────────────────────────────────────────────────────────────────────
// React hook: useRealtimeState
// ──────────────────────────────────────────────────────────────────────────────

/**
 * useState-like hook that mirrors its value across all connected devices.
 * Uses Supabase Broadcast under the hood. On mount, fires a state-request
 * and adopts a peer's value if anyone responds within 500ms — otherwise
 * uses initialState.
 */
export function useRealtimeState<T>(
  key: string,
  initialState: T
): [T, (next: T | ((prev: T) => T)) => void] {
  const initialRef = useRef(initialState);
  const [value, setValue] = useState<T>(() => {
    const cached = store.cache.get(key);
    return cached === undefined ? initialState : (cached as T);
  });

  // Subscribe this component to cache updates.
  useEffect(() => {
    ensureInit();
    let set = store.cacheSubs.get(key);
    if (!set) {
      set = new Set();
      store.cacheSubs.set(key, set);
    }
    const handler = (next: unknown) => {
      // undefined means reset → restore initial.
      if (next === undefined) {
        setValue(initialRef.current);
      } else {
        setValue(next as T);
      }
    };
    set.add(handler);
    return () => {
      store.cacheSubs.get(key)?.delete(handler);
    };
  }, [key]);

  // On mount, request current value from peers.
  useEffect(() => {
    ensureInit();
    if (store.cache.has(key)) {
      // Already have a value (e.g. another mount on the same device).
      setValue(store.cache.get(key) as T);
      return;
    }
    let resolved = false;
    const resolver = (peerValue: unknown) => {
      if (resolved) return;
      resolved = true;
      if (peerValue !== undefined) {
        setValue(peerValue as T);
        store.cache.set(key, peerValue);
      }
    };
    store.pendingStateRequests.set(key, resolver);
    publish('state-request', undefined, key);
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        store.pendingStateRequests.delete(key);
        // No peer responded — keep initial state and seed the cache so we
        // can answer state-requests from later joiners.
        if (!store.cache.has(key)) {
          store.cache.set(key, initialRef.current);
        }
      }
    }, 500);
    return () => {
      clearTimeout(timeout);
      store.pendingStateRequests.delete(key);
    };
  }, [key]);

  const setAndPublish = (next: T | ((prev: T) => T)) => {
    // Resolve value synchronously from our own cache (always up-to-date)
    // instead of inside React's setValue callback. This avoids putting
    // side-effects (publish) inside what React expects to be a pure updater.
    const prev = (store.cache.has(key) ? store.cache.get(key) : value) as T;
    const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;

    // Lamport increment: always strictly greater than whatever we've seen
    // for this key (our own writes + any peer-adopted versions).
    const currentVersion = store.versions.get(key)?.version ?? 0;
    const nextVersion = currentVersion + 1;

    // 1. Update local cache + version side-table (synchronous)
    store.cache.set(key, resolved);
    store.versions.set(key, { version: nextVersion, device: DEVICE_ID });

    // 2. Set React state (batched by React, but that's fine — UI catches up)
    setValue(resolved);

    // 3. Notify other local subscribers sharing this key on the same device
    store.cacheSubs.get(key)?.forEach((fn) => fn(resolved));

    // 4. Broadcast versioned envelope — outside setState, guaranteed to fire
    const envelope: VersionEnvelope<T> = {
      __v: nextVersion,
      __d: DEVICE_ID,
      __t: Date.now(),
      value: resolved,
    };
    publish('state-update', envelope, key);
  };

  return [value, setAndPublish];
}

// ──────────────────────────────────────────────────────────────────────────────
// React hook: useRealtimePing — fire-and-forget event channel
// ──────────────────────────────────────────────────────────────────────────────

export function useRealtimePing<T = unknown>(
  event: string,
  handler?: (payload: T) => void
): (payload?: T) => void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!handlerRef.current) return;
    const unsub = subscribe<T>(event, (payload) => {
      handlerRef.current?.(payload);
    });
    return unsub;
  }, [event]);

  return (payload?: T) => {
    publish(event, payload);
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// React hook: useConnectionStatus — for UI indicators
// ──────────────────────────────────────────────────────────────────────────────

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatusState] = useState<ConnectionStatus>(() => store.status);
  useEffect(() => subscribeConnectionStatus(setStatusState), []);
  return status;
}

export function usePresence(): string[] {
  const [devices, setDevices] = useState<string[]>(() => [...store.presenceState]);
  useEffect(() => subscribePresence(setDevices), []);
  return devices;
}

/** React hook — keyed presence meta, live-updated on every sync. */
export function usePresenceMeta(): PresenceMap {
  const [meta, setMeta] = useState<PresenceMap>(() => ({ ...store.presenceMeta }));
  useEffect(() => subscribePresenceMeta(setMeta), []);
  return meta;
}

export function useRealtimeLog(): RealtimeLogEntry[] {
  const [log, setLog] = useState<RealtimeLogEntry[]>(() => [...store.log]);
  useEffect(() => subscribeLog(setLog), []);
  return log;
}
