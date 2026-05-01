/**
 * Pulse Radiant — static data
 *
 * Future-tree node graph, time-axis ticks, and floating
 * psychohistory-flavored equations. Lives in its own module so the
 * 1500-line PulseRadiant component stays readable, and so future
 * scenarios can be swapped from a real prediction stream.
 */

export type FutureKind = 'primary' | 'alt' | 'dead' | 'apex';

export interface FutureNode {
  id: string;
  pos: [number, number, number];
  label: string;
  value?: string;
  detail?: string;
  time?: string;
  /** 0..1 — only renders for primary + apex */
  conf?: number;
  kind: FutureKind;
  /** rendered card width in px */
  size: number;
}

export interface FutureLink {
  from: string;
  to: string;
  kind: FutureKind;
}

// Nodes are positioned organically — Y is roughly tiered for time
// progression (T+15m at ~14 → T+4h at 60) but each node jitters off
// its tier baseline so layers don't read as flat shelves. Card sizes
// bumped 1.3× for the third-pass "much much larger" request.
export const FUTURE_NODES: FutureNode[] = [
  // Roots (Y~14)
  { id: 'r0', pos: [-18, 13, 8],   label: 'Surge protocol HOT',  value: '76% conf', time: 'T+15m', kind: 'primary', size: 540, conf: 0.76 },
  { id: 'r1', pos: [-5,  15, 16],  label: 'EMS rerouting',        value: '4 hospitals', time: 'T+15m', kind: 'alt',     size: 480 },
  { id: 'r2', pos: [9,   12, 11],  label: 'Trauma OR open',       value: 'Bay 3',      time: 'T+15m', kind: 'alt',     size: 480 },
  { id: 'r3', pos: [21,  14, -6],  label: 'Staff recall sent',    value: '12 nurses',  time: 'T+15m', kind: 'alt',     size: 480 },
  { id: 'r4', pos: [-28, 11, -10], label: 'Helo offload',         value: 'Wind 22kt',  detail: 'Weather scrub', kind: 'dead', size: 380 },
  { id: 'r5', pos: [27,  16, 12],  label: 'Storm bypass route',   value: 'I-95 closed', detail: 'Geography blocks', kind: 'dead', size: 380 },

  // Mid (Y~26)
  { id: 'm0', pos: [-12, 27, 5],   label: 'Triage thinning',      value: '−14% wait',  time: 'T+30m', kind: 'primary', size: 540, conf: 0.81 },
  { id: 'm1', pos: [4,   25, 14],  label: 'Bed cohort A',         value: '6 freed',    time: 'T+30m', kind: 'alt',     size: 460 },
  { id: 'm2', pos: [14,  28, -9],  label: 'OR queue resolved',    value: '3 cases',    time: 'T+30m', kind: 'alt',     size: 460 },
  { id: 'm3', pos: [-21, 24, -6],  label: 'Ambulance backlog',    value: '−2 in queue', time: 'T+30m', kind: 'alt',     size: 460 },
  { id: 'm4', pos: [24,  26, 15],  label: 'INSUFFICIENT DATA',    value: 'Pattern weak', detail: 'Below threshold', kind: 'dead', size: 360 },

  // Deep (Y~38)
  { id: 'd0', pos: [-8,  39, 6],   label: 'NEDOCS easing',        value: '−24 pts',    time: 'T+1h',  kind: 'primary', size: 560, conf: 0.69 },
  { id: 'd1', pos: [8,   37, 11],  label: 'Surge subsides',       value: '−18% load',  time: 'T+1h',  kind: 'alt',     size: 480 },
  { id: 'd2', pos: [-15, 41, -8],  label: 'ICU at 88%',           value: 'Stable',     time: 'T+1h',  kind: 'alt',     size: 480 },
  { id: 'd3', pos: [18,  38, -12], label: 'INCOMPATIBLE SIGNAL',  value: 'Rejected',   detail: 'Anti-correlation', kind: 'dead', size: 360 },

  // Final (Y~50)
  { id: 'f0', pos: [-4,  50, 4],   label: 'Capacity recovers',    value: '88% nominal', time: 'T+2h',  kind: 'primary', size: 580, conf: 0.71 },
  { id: 'f1', pos: [5,   49, -5],  label: 'Wait time normal',     value: '< 28 min',   time: 'T+2h',  kind: 'primary', size: 540, conf: 0.66 },

  // Apex (Y=60)
  { id: 'top', pos: [0,  62, 0],   label: 'NEDOCS easing 118 by 19:00', value: '64% confidence', detail: 'Convergent forecast — 4 paths', time: 'T+4h', kind: 'apex', size: 760, conf: 0.64 },
];

export const FUTURE_LINKS: FutureLink[] = [
  // Roots → mid
  { from: 'r0', to: 'm0', kind: 'primary' },
  { from: 'r0', to: 'm3', kind: 'alt' },
  { from: 'r1', to: 'm0', kind: 'alt' },
  { from: 'r1', to: 'm1', kind: 'alt' },
  { from: 'r2', to: 'm2', kind: 'alt' },
  { from: 'r3', to: 'm2', kind: 'alt' },
  { from: 'r3', to: 'm1', kind: 'alt' },
  { from: 'r4', to: 'm4', kind: 'dead' },
  { from: 'r5', to: 'm4', kind: 'dead' },

  // Mid → deep
  { from: 'm0', to: 'd0', kind: 'primary' },
  { from: 'm0', to: 'd2', kind: 'alt' },
  { from: 'm1', to: 'd1', kind: 'alt' },
  { from: 'm2', to: 'd1', kind: 'alt' },
  { from: 'm3', to: 'd2', kind: 'alt' },
  { from: 'm4', to: 'd3', kind: 'dead' },

  // Deep → final
  { from: 'd0', to: 'f0', kind: 'primary' },
  { from: 'd0', to: 'f1', kind: 'alt' },
  { from: 'd1', to: 'f1', kind: 'primary' },
  { from: 'd2', to: 'f0', kind: 'alt' },

  // Final → apex
  { from: 'f0', to: 'top', kind: 'primary' },
  { from: 'f1', to: 'top', kind: 'primary' },
];

// ──────────────────────────────────────────────────────────────────
// Time axis — ticks rendered at fixed Y values along the +X side
// ──────────────────────────────────────────────────────────────────
export const TIME_AXIS: Array<{ y: number; label: string; emphasis?: boolean }> = [
  { y: 14, label: 'T+15m' },
  { y: 26, label: 'T+30m' },
  { y: 38, label: 'T+1h' },
  { y: 50, label: 'T+2h' },
  { y: 62, label: 'T+4h · APEX', emphasis: true },
];

// ──────────────────────────────────────────────────────────────────
// Floating psychohistory-style equations — atmosphere only
// ──────────────────────────────────────────────────────────────────
export const FLOATING_EQUATIONS: Array<{ pos: [number, number, number]; text: string; }> = [
  { pos: [-26, 18, -10], text: 'ψ(t) → ε(0.03)' },
  { pos: [22,  22,  12], text: 'Σ corr = 0.71' },
  { pos: [-18, 32,  16], text: 'P(NEDOCS<120 | t=2h) = 0.66' },
  { pos: [20,  36, -14], text: 'dN/dt = −0.12 · θ' },
  { pos: [-10, 46,  9],  text: '∇·F = ρ_admit / ε₀' },
  { pos: [12,  52, -5],  text: 'EV[wait | t=4h] ≈ 28m' },
  { pos: [-22, 56,  4],  text: 'σ(future) = 0.19' },
  { pos: [16,  20, -22], text: '∂P/∂t · trace(K) → 0' },
];
