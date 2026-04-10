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
  joinedAt: number;
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
  // Ring buffer of last 50 messages for the debug panel.
  log: RealtimeLogEntry[];
  logSubs: Set<(log: RealtimeLogEntry[]) => void>;
  // Last measured latency (ms) — naive ping.
  latencyMs: number;
  // Pending state-request promises waiting on a state-response.
  pendingStateRequests: Map<string, (value: unknown) => void>;
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
  log: [],
  logSubs: new Set(),
  latencyMs: 0,
  pendingStateRequests: new Map(),
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

function previewPayload(p: unknown): string {
  try {
    const s = JSON.stringify(p);
    return s && s.length > 120 ? s.slice(0, 120) + '…' : s || '';
  } catch {
    return String(p);
  }
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
          await channel.track({ device: DEVICE_ID, joinedAt: Date.now() } satisfies PresenceMeta);
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
    // Update local cache and notify cache subscribers WITHOUT re-publishing.
    store.cache.set(data.key, data.payload);
    store.cacheSubs.get(data.key)?.forEach((fn) => fn(data.payload));
  } else if (data.type === 'state-request' && data.key) {
    // Another device is asking — if we have it, respond.
    if (store.cache.has(data.key)) {
      publish('state-response', { key: data.key, value: store.cache.get(data.key) });
    }
  } else if (data.type === 'state-response') {
    const payload = data.payload as { key?: string; value?: unknown };
    if (payload?.key && store.pendingStateRequests.has(payload.key)) {
      const resolver = store.pendingStateRequests.get(payload.key)!;
      store.pendingStateRequests.delete(payload.key);
      resolver(payload.value);
      // Also stash in cache so subsequent mounts are instant.
      store.cache.set(payload.key, payload.value);
      store.cacheSubs.get(payload.key)?.forEach((fn) => fn(payload.value));
    }
  } else if (data.type === 'reset-all') {
    // Clear cache and notify everyone.
    const keys = Array.from(store.cache.keys());
    store.cache.clear();
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
  keys.forEach((k) => {
    store.cacheSubs.get(k)?.forEach((fn) => fn(undefined));
  });
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
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      store.cache.set(key, resolved);
      // Notify other local subscribers on this device (multiple components
      // sharing the same key). Each subscriber's setState is idempotent in
      // React, so re-notifying our own setValue is fine.
      store.cacheSubs.get(key)?.forEach((fn) => fn(resolved));
      publish('state-update', resolved, key);
      return resolved;
    });
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

export function useRealtimeLog(): RealtimeLogEntry[] {
  const [log, setLog] = useState<RealtimeLogEntry[]>(() => [...store.log]);
  useEffect(() => subscribeLog(setLog), []);
  return log;
}
