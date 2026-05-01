/**
 * PulseRadiant v4 — radiant decision-topology that looks like
 * computer vision actively thinking.
 *
 * 2026-05-01 (v4) · Per Nick's 9 fixes:
 *   1. (How would I improve it) Self-critique woven below
 *   2. Higher fidelity — sharper widget design, more typography,
 *      status indicators, sub-priority ticks
 *   3. Many more data points — 80 raw inputs (was 30), 24 patterns,
 *      10 scenarios, 5 decisions = 119 widgets
 *   4. Variable sizing by priority (1-5). Even priority-1 widgets
 *      are bigger than v3's largest
 *   5. Hover-to-expand — widgets grow + reveal detail rows
 *   6. Centered — camera dead-on (0, 0, 28) looking at origin
 *   7. NO flying spheres — replaced with edge illumination (signals
 *      fire along the wires themselves)
 *   8. Ingestion events — new "+ INGEST" widgets appear at periphery,
 *      fly into a target widget, target absorbs + briefly grows
 *   9. Looks like thinking — edge signals + pattern-match bursts
 *      (groups of related widgets simultaneously glow + connecting
 *      edges flare with "PATTERN MATCH" callout) + frequent compile
 *      ring + active CV tracker scanning
 *
 * Architecture identical to v3: 4 spherical shells (Fibonacci sphere
 * distribution), decisions at center, raw inputs on outer shell.
 * Pulses flow inward through edge illumination.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { COLORS, FONTS, SPACE, RADIUS } from './design';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

type Layer = 1 | 2 | 3 | 4;
type Tone = 'muted' | 'info' | 'warn' | 'accent';
/** 1 = trivial / 5 = critical. Drives widget size + edge weight. */
type Priority = 1 | 2 | 3 | 4 | 5;

interface Widget {
  id: number;
  layer: Layer;
  label: string;
  value?: string;
  /** Optional secondary line shown when expanded */
  detail?: string;
  /** Optional source / provenance shown when expanded */
  source?: string;
  tone: Tone;
  priority: Priority;
  /** Live / stale / hold — drives the right-corner indicator */
  status?: 'LIVE' | 'STALE' | 'HOLD';
}

// ──────────────────────────────────────────────────────────────────
// Catalog — 119 widgets total
// ──────────────────────────────────────────────────────────────────

const LAYER_1: Omit<Widget, 'id' | 'layer'>[] = [
  // Traffic & roads (8)
  { label: 'I-95 traffic', value: '+18m delay', detail: 'Northbound mile 142', source: 'WAZE-API', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Beltway congestion', value: '34% slow', detail: 'Westbound', source: 'WAZE', tone: 'warn', priority: 3, status: 'LIVE' },
  { label: 'Highway 50 crash', value: '2 vehicles', detail: 'EMS dispatched', source: 'CHP-911', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'Bridge closure', value: 'I-275 west', detail: 'ETA 2h reopen', source: 'DOT', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Construction zone', value: 'Route 9', detail: 'Lane drop', source: 'DOT', tone: 'muted', priority: 2 },
  { label: 'Avg commute time', value: '+22%', source: 'GOOGLE-API', tone: 'info', priority: 2, status: 'LIVE' },
  { label: 'Tunnel volume', value: '8200 cars/hr', source: 'DOT', tone: 'muted', priority: 1 },
  { label: 'Bike-share volume', value: '−18%', source: 'CITYAPI', tone: 'muted', priority: 1 },

  // Weather & environment (10)
  { label: 'Weather', value: '54°F · rain', detail: 'Heavy thunderstorm', source: 'NOAA', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Wind speed', value: '22 kt', detail: 'Helo flight risk', source: 'NOAA', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Visibility', value: '0.4 mi', source: 'NOAA', tone: 'warn', priority: 3, status: 'LIVE' },
  { label: 'Pressure drop', value: '−6 mb / 6h', source: 'NOAA', tone: 'warn', priority: 3 },
  { label: 'Lightning strikes', value: '38 / 1h', detail: 'Convective cell', source: 'NOAA', tone: 'warn', priority: 3, status: 'LIVE' },
  { label: 'Heat index', value: '78°F', source: 'NOAA', tone: 'muted', priority: 1 },
  { label: 'UV index', value: '6 high', source: 'NOAA', tone: 'muted', priority: 1 },
  { label: 'Air quality', value: '92 AQI', source: 'EPA', tone: 'muted', priority: 2 },
  { label: 'Pollen count', value: 'High oak', source: 'WEATHER-CO', tone: 'muted', priority: 1 },
  { label: 'Sunset', value: '20:42', source: 'NOAA', tone: 'muted', priority: 1 },

  // Time & calendar (6)
  { label: 'Time of day', value: '14:22', source: 'NTP', tone: 'muted', priority: 2 },
  { label: 'Day of week', value: 'Wed · weekday', source: 'CAL', tone: 'muted', priority: 2 },
  { label: 'Season', value: 'Spring · pollen', source: 'CAL', tone: 'muted', priority: 1 },
  { label: 'Holiday calendar', value: 'No conflicts', source: 'CAL', tone: 'muted', priority: 1 },
  { label: 'School schedule', value: 'In session', source: 'DISTRICT', tone: 'muted', priority: 2 },
  { label: 'Shift change window', value: 'T−38m', source: 'WORKDAY', tone: 'info', priority: 3 },

  // Public events (5)
  { label: 'Concert at arena', value: '18:00 · 18k cap', detail: 'Hard rock · 21+', source: 'TICKETMASTER', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Marathon route', value: 'Saturday 7am', source: 'EVENTS', tone: 'warn', priority: 3 },
  { label: 'Convention center', value: '12k expected', source: 'CITY', tone: 'info', priority: 2 },
  { label: 'Stadium event', value: 'College ball · 19:30', source: 'NCAA', tone: 'warn', priority: 3 },
  { label: 'Protest planned', value: 'City hall · 16:00', source: 'PD', tone: 'warn', priority: 3 },

  // 911 / EMS / Police / Fire (10)
  { label: '911 call volume', value: '+24% vs avg', detail: 'Spike past 30m', source: 'PSAP', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: '911 call types', value: '34% MVC', source: 'PSAP', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: '911 wait time', value: '12s avg', source: 'PSAP', tone: 'info', priority: 2, status: 'LIVE' },
  { label: 'Police dispatch', value: '12 active', source: 'CAD', tone: 'muted', priority: 2, status: 'LIVE' },
  { label: 'Fire dispatch', value: '3 active', source: 'CAD', tone: 'muted', priority: 2, status: 'LIVE' },
  { label: 'Ambulance fleet', value: '6 / 9 in service', source: 'CAD', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Mutual aid status', value: '2 units inbound', source: 'CAD', tone: 'info', priority: 3 },
  { label: 'Trauma alerts', value: '2 in past hr', source: 'CAD', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'STEMI alerts', value: '1 in transit', source: 'CAD', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Stroke alerts', value: '0 active', source: 'CAD', tone: 'muted', priority: 1 },

  // Hospital ops (10)
  { label: 'ED waiting room', value: '34 patients', source: 'EHR', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'ED triage acuity', value: '6 ESI-2', source: 'EHR', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'ICU beds', value: '1 / 12 free', detail: 'Occupancy 92%', source: 'BED-MGMT', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'Med/Surg beds', value: '0 / 240', source: 'BED-MGMT', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'PACU census', value: '8 / 12', source: 'BED-MGMT', tone: 'info', priority: 2 },
  { label: 'OR utilization', value: '87% next 4h', source: 'EPIC-OR', tone: 'info', priority: 3 },
  { label: 'Discharge queue', value: '12 ready', source: 'EHR', tone: 'info', priority: 3, status: 'LIVE' },
  { label: 'Boarding holds', value: '18 admits', source: 'EHR', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Floor census', value: '284', source: 'EHR', tone: 'info', priority: 3, status: 'LIVE' },
  { label: 'L&D activity', value: '2 active labors', source: 'EHR', tone: 'muted', priority: 1, status: 'LIVE' },

  // Staffing (6)
  { label: 'RN ratio', value: '1:4.2', source: 'WORKDAY', tone: 'info', priority: 4, status: 'LIVE' },
  { label: 'RN call-outs', value: '4 in past hr', source: 'WORKDAY', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'MD coverage', value: '3 attending', source: 'WORKDAY', tone: 'info', priority: 3 },
  { label: 'Tech staffing', value: '−1 ED tech', source: 'WORKDAY', tone: 'warn', priority: 3 },
  { label: 'Float pool', value: '2 RN warm', source: 'WORKDAY', tone: 'info', priority: 4 },
  { label: 'PRN availability', value: '3 confirmed', source: 'WORKDAY', tone: 'info', priority: 2 },

  // Resources & supply (8)
  { label: 'Blood bank', value: 'O- · 4u', detail: 'Below threshold', source: 'LIS', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'Pharmacy supply', value: 'Nominal', source: 'PYXIS', tone: 'muted', priority: 2 },
  { label: 'Vent inventory', value: '6 available', source: 'BIOMED', tone: 'info', priority: 4 },
  { label: 'Crash cart count', value: '3 available', source: 'BIOMED', tone: 'muted', priority: 2 },
  { label: 'Lab turnaround', value: '38m avg', source: 'LIS', tone: 'muted', priority: 2, status: 'LIVE' },
  { label: 'Imaging queue', value: '5 CT pending', source: 'PACS', tone: 'info', priority: 3, status: 'LIVE' },
  { label: 'MRI availability', value: '2 / 3 slots', source: 'EPIC-RAD', tone: 'info', priority: 2 },
  { label: 'EVS turnover', value: '34m bed turn', source: 'EVS', tone: 'info', priority: 3 },

  // Public health & disease (6)
  { label: 'Flu surveillance', value: 'Rising trend', source: 'CDC-FLUVIEW', tone: 'warn', priority: 4 },
  { label: 'COVID positivity', value: '4.2%', source: 'PUBHEALTH', tone: 'info', priority: 3 },
  { label: 'Local outbreak', value: 'Norovirus · school', source: 'PUBHEALTH', tone: 'warn', priority: 3 },
  { label: 'Vaccine uptake', value: '67% flu', source: 'CDC', tone: 'muted', priority: 1 },
  { label: 'STD trend', value: 'Stable', source: 'PUBHEALTH', tone: 'muted', priority: 1 },
  { label: 'Sepsis screening', value: '3 alerts', source: 'EHR', tone: 'warn', priority: 4, status: 'LIVE' },

  // Regional / network (6)
  { label: 'St Mary divert', value: 'ACTIVE · 2h', source: 'REGIONAL', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'County trauma load', value: 'Saturated', source: 'REGIONAL', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Regional ED census', value: '+14% vs avg', source: 'REGIONAL', tone: 'warn', priority: 3 },
  { label: 'Helo availability', value: '1 of 2 grounded', source: 'AIRMED', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Trauma bay availability', value: '3 ready', source: 'BED-MGMT', tone: 'info', priority: 4 },
  { label: 'Receiving hospital', value: 'Mercy · 22m', source: 'REGIONAL', tone: 'info', priority: 2 },

  // Historical / pattern matching (5)
  { label: 'Prior pattern match', value: '94% similar', detail: 'Wed eve + concert + storm', source: 'AI-PRIOR', tone: 'info', priority: 4 },
  { label: 'Last surge replay', value: '14 days ago', source: 'AI-PRIOR', tone: 'info', priority: 3 },
  { label: 'Seasonal baseline', value: '+18% over Q-avg', source: 'AI-PRIOR', tone: 'info', priority: 2 },
  { label: 'Day-of-week curve', value: 'Wed · 2nd peak', source: 'AI-PRIOR', tone: 'info', priority: 2 },
  { label: 'Weather × census model', value: 'r² 0.78', source: 'AI-PRIOR', tone: 'info', priority: 3 },
];

const LAYER_2: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Boarding pressure', value: '18 admitted', detail: 'Up 12% in 1h', source: 'AGGREGATE', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'EMS offload risk', value: '30m avg wait', source: 'AGGREGATE', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'Staffing gap (RN)', value: '−2 FTE', source: 'PREDICTIVE', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'Bed turnover', value: '38m avg', source: 'AGGREGATE', tone: 'info', priority: 3 },
  { label: 'Surge probability', value: '64% · 4h', detail: 'Confidence 0.87', source: 'PREDICTIVE', tone: 'warn', priority: 5, status: 'LIVE' },
  { label: 'Trauma likelihood', value: '+38% next 2h', source: 'PREDICTIVE', tone: 'warn', priority: 4 },
  { label: 'ICU saturation', value: '92% by 16:00', source: 'PREDICTIVE', tone: 'warn', priority: 5 },
  { label: 'ED wait forecast', value: '+22m by 17:00', source: 'PREDICTIVE', tone: 'warn', priority: 4 },
  { label: 'Discharge throughput', value: '−18% projected', source: 'PREDICTIVE', tone: 'info', priority: 3 },
  { label: 'Float pool', value: '2 RN warm', source: 'AGGREGATE', tone: 'info', priority: 3 },
  { label: 'Regional divert', value: '2 of 4 hospitals', source: 'AGGREGATE', tone: 'warn', priority: 4 },
  { label: 'Resource bottleneck', value: 'CT-1 · imaging', source: 'PREDICTIVE', tone: 'warn', priority: 4 },
  { label: 'STEMI window risk', value: '0 active · ready', source: 'PREDICTIVE', tone: 'info', priority: 3 },
  { label: 'Stroke window risk', value: 'Coverage gap 18:00', source: 'PREDICTIVE', tone: 'warn', priority: 4 },
  { label: 'Mass-cas latent prob', value: '12% · 4h', source: 'PREDICTIVE', tone: 'warn', priority: 4 },
  { label: 'Helo offload bottleneck', value: 'Peak 17:30', source: 'PREDICTIVE', tone: 'warn', priority: 3 },
  { label: 'Crash cart utilization', value: 'Trending up', source: 'AGGREGATE', tone: 'info', priority: 2 },
  { label: 'Lab queue projection', value: '12 by 16:30', source: 'PREDICTIVE', tone: 'info', priority: 3 },
  { label: 'OR overrun risk', value: '38% · 16:00', source: 'PREDICTIVE', tone: 'warn', priority: 3 },
  { label: 'Sepsis cohort risk', value: '3 high-prob', source: 'PREDICTIVE', tone: 'warn', priority: 4, status: 'LIVE' },
  { label: 'Pediatric admit risk', value: 'Above threshold', source: 'PREDICTIVE', tone: 'warn', priority: 3 },
  { label: 'Psych hold risk', value: '4 PT delays', source: 'AGGREGATE', tone: 'warn', priority: 3 },
  { label: 'Burn capacity strain', value: 'Watch · network', source: 'REGIONAL', tone: 'info', priority: 2 },
  { label: 'OR-PACU coupling', value: 'Tight · monitor', source: 'PREDICTIVE', tone: 'info', priority: 2 },
];

const LAYER_3: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Baseline projection', value: 'NEDOCS 124', source: 'SCENARIO', tone: 'info', priority: 4, status: 'LIVE' },
  { label: 'Mild surge scenario', value: 'NEDOCS 142', detail: 'Probability 38%', source: 'SCENARIO', tone: 'warn', priority: 4 },
  { label: 'Moderate surge', value: 'NEDOCS 168', detail: 'Probability 22%', source: 'SCENARIO', tone: 'warn', priority: 5 },
  { label: 'Mass casualty', value: 'NEDOCS 184', detail: 'Probability 4%', source: 'SCENARIO', tone: 'accent', priority: 5 },
  { label: 'Regional divert', value: '4 hospitals', source: 'SCENARIO', tone: 'warn', priority: 4 },
  { label: 'Recovery curve', value: '−40m by 18:00', source: 'SCENARIO', tone: 'info', priority: 3 },
  { label: 'Float-pool activation', value: 'Reduces 28m wait', source: 'SCENARIO', tone: 'info', priority: 4 },
  { label: 'Hall C overflow', value: '+12 beds', source: 'SCENARIO', tone: 'info', priority: 3 },
  { label: 'No-action baseline', value: 'NEDOCS 156', source: 'SCENARIO', tone: 'warn', priority: 4 },
  { label: 'Optimal-action path', value: 'NEDOCS 118', source: 'SCENARIO', tone: 'info', priority: 5 },
];

const LAYER_4: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Pre-stage float pool', value: '2 RN · 20m warm', detail: 'Estimated impact: −18m ED wait', source: 'DECISION', tone: 'accent', priority: 5, status: 'LIVE' },
  { label: 'Activate surge protocol', value: 'Tier 2 · ready', detail: 'Approval queued · charge nurse', source: 'DECISION', tone: 'accent', priority: 5, status: 'LIVE' },
  { label: 'Post regional divert', value: 'Coordination ready', detail: 'Notify dispatch + 4 hospitals', source: 'DECISION', tone: 'accent', priority: 5, status: 'LIVE' },
  { label: 'Open Hall C overflow', value: '+12 beds · 35m', detail: 'EVS turnover dependent', source: 'DECISION', tone: 'accent', priority: 4 },
  { label: 'Hold all electives', value: '7 cases pending', detail: 'Reschedule next 24h', source: 'DECISION', tone: 'accent', priority: 4 },
];

const buildCatalog = (): Widget[] => {
  const out: Widget[] = [];
  let id = 0;
  LAYER_1.forEach((w) => out.push({ ...w, id: id++, layer: 1 }));
  LAYER_2.forEach((w) => out.push({ ...w, id: id++, layer: 2 }));
  LAYER_3.forEach((w) => out.push({ ...w, id: id++, layer: 3 }));
  LAYER_4.forEach((w) => out.push({ ...w, id: id++, layer: 4 }));
  return out;
};

// ──────────────────────────────────────────────────────────────────
// Layout — concentric spherical shells
// ──────────────────────────────────────────────────────────────────

interface PreparedWidget extends Widget {
  homePosition: THREE.Vector3;
  driftPhase: number;
  driftSpeed: number;
  driftAmp: number;
}

// Non-spherical organic distribution. Radius derives from priority:
// p5 widgets cluster tight around center, p1 widgets scatter wide.
// Y is squashed so the cluster reads as a flattened radiant disk
// (leaves room above for the future branches to rise upward).
// Seeded RNG = same layout each render.
const layoutWidgets = (widgets: Widget[]): PreparedWidget[] => {
  let seed = 7331;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return widgets.map((w, i) => {
    // Priority drives radial distance — bigger widgets near the center
    // (the "decision core"), smaller priority widgets at the periphery.
    const priorityRadiusMap: Record<Priority, [number, number]> = {
      5: [3, 8],
      4: [7, 14],
      3: [12, 20],
      2: [16, 26],
      1: [20, 32],
    };
    const [minR, maxR] = priorityRadiusMap[w.priority];
    const radius = minR + rand() * (maxR - minR);

    // Random direction — full 3D, then squash Y so cluster is wider
    // than tall (the future branches rise above).
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const yRaw = Math.cos(phi) * radius;
    const z = Math.sin(phi) * Math.sin(theta) * radius;
    // Squash Y to ~40% so cluster is flatter
    const y = yRaw * 0.42 - 2; // also shift down slightly so future has more headroom

    return {
      ...w,
      homePosition: new THREE.Vector3(x, y, z),
      driftPhase: (i + w.priority * 1.7) * 0.7,
      driftSpeed: 0.14 + rand() * 0.20,
      driftAmp: w.priority >= 4 ? 0.18 : 0.55,
    };
  });
};

// ──────────────────────────────────────────────────────────────────
// Edges — fan IN
// ──────────────────────────────────────────────────────────────────

interface Edge {
  from: number;
  to: number;
  /** Importance — derives from the higher-priority of the two endpoints */
  weight: number;
}

const buildEdges = (widgets: PreparedWidget[]): Edge[] => {
  const edges: Edge[] = [];
  const byLayer = new Map<Layer, PreparedWidget[]>([[1, []], [2, []], [3, []], [4, []]]);
  widgets.forEach((w) => byLayer.get(w.layer)!.push(w));

  const connect = (outer: Layer, inner: Layer, k: number) => {
    const o = byLayer.get(outer)!;
    const i = byLayer.get(inner)!;
    o.forEach((from) => {
      const sorted = i
        .map((to) => ({ to, d: from.homePosition.distanceTo(to.homePosition) }))
        .sort((a, b) => a.d - b.d);
      for (let j = 0; j < Math.min(k, sorted.length); j++) {
        const to = sorted[j].to;
        edges.push({ from: from.id, to: to.id, weight: Math.max(from.priority, to.priority) });
      }
    });
  };

  connect(1, 2, 2);
  connect(2, 3, 2);
  connect(3, 4, 2);
  return edges;
};

// ──────────────────────────────────────────────────────────────────
// Drift helper
// ──────────────────────────────────────────────────────────────────

const driftPosition = (
  out: THREE.Vector3,
  home: THREE.Vector3,
  t: number,
  phase: number,
  speed: number,
  amp: number,
) => {
  out.set(
    home.x + Math.sin(t * speed * 1.2 + phase) * amp,
    home.y + Math.cos(t * speed * 0.9 + phase * 1.3) * amp,
    home.z + Math.sin(t * speed * 1.1 + phase * 0.7) * amp,
  );
};

// ──────────────────────────────────────────────────────────────────
// Widget styling helpers
// ──────────────────────────────────────────────────────────────────

const toneColor = (tone: Tone): string => {
  switch (tone) {
    case 'accent': return COLORS.accent;
    case 'warn': return COLORS.warn;
    case 'info': return COLORS.info;
    case 'muted':
    default: return COLORS.textMuted;
  }
};

// Bumped HARD per Nick ("much much larger by a lot")
const widthByPriority = (p: Priority): number => {
  switch (p) {
    case 5: return 600;
    case 4: return 520;
    case 3: return 460;
    case 2: return 400;
    case 1:
    default: return 360;
  }
};

const labelFontByPriority = (p: Priority): number => {
  switch (p) {
    case 5: return 22;
    case 4: return 19;
    case 3: return 17;
    case 2: return 15;
    case 1:
    default: return 14;
  }
};

const valueFontByPriority = (p: Priority): number => {
  switch (p) {
    case 5: return 38;
    case 4: return 32;
    case 3: return 26;
    case 2: return 22;
    case 1:
    default: return 19;
  }
};

// ──────────────────────────────────────────────────────────────────
// WidgetCard — bigger, hoverable, expands on hover, higher fidelity
// ──────────────────────────────────────────────────────────────────

interface WidgetCardProps {
  widget: PreparedWidget;
  /** True when CV tracker has locked onto this widget */
  tracked?: boolean;
  trackedConf?: number;
  /** True during pattern-match flash */
  patternHighlight?: boolean;
  /** True when an ingestion event just merged into this widget */
  absorbing?: boolean;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  tracked,
  trackedConf,
  patternHighlight,
  absorbing,
}) => {
  const [hovered, setHovered] = useState(false);
  const dotColor = toneColor(widget.tone);
  const isAccent = widget.tone === 'accent';
  const w = widthByPriority(widget.priority);

  // Border + scale state
  const borderColor =
    tracked || patternHighlight
      ? COLORS.accent
      : isAccent
      ? COLORS.accent
      : widget.layer >= 3
      ? COLORS.borderStrong
      : COLORS.border;

  const scale = hovered ? 1.18 : absorbing ? 1.10 : 1.0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: w,
        background: COLORS.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        padding: `${SPACE.sm + 2}px ${SPACE.md + 2}px`,
        fontFamily: FONTS.mono,
        boxShadow: tracked || patternHighlight
          ? `0 0 16px rgba(225, 29, 72, 0.30)`
          : `0 4px 14px rgba(0, 0, 0, 0.55)`,
        userSelect: 'none',
        pointerEvents: 'auto',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        transition: 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1), border-color 220ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 220ms cubic-bezier(0.23, 1, 0.32, 1)',
        zIndex: hovered ? 50 : 10,
      }}
    >
      {/* CV tracker brackets */}
      {tracked && (
        <>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => {
            const isTop = c.startsWith('t');
            const isLeft = c.endsWith('l');
            return (
              <span key={c} aria-hidden style={{
                position: 'absolute',
                width: 11, height: 11,
                [isTop ? 'top' : 'bottom']: -4,
                [isLeft ? 'left' : 'right']: -4,
                borderTop: isTop ? `1.5px solid ${COLORS.accent}` : undefined,
                borderBottom: !isTop ? `1.5px solid ${COLORS.accent}` : undefined,
                borderLeft: isLeft ? `1.5px solid ${COLORS.accent}` : undefined,
                borderRight: !isLeft ? `1.5px solid ${COLORS.accent}` : undefined,
                pointerEvents: 'none',
              }} />
            );
          })}
          {trackedConf != null && (
            <span aria-hidden style={{
              position: 'absolute',
              top: -16, right: -4,
              fontFamily: FONTS.mono, fontSize: 9,
              letterSpacing: '0.18em',
              color: COLORS.accent,
              whiteSpace: 'nowrap',
              textShadow: `0 0 4px ${COLORS.bg}`,
            }}>
              · {trackedConf.toFixed(2)} CONF
            </span>
          )}
        </>
      )}

      {/* Top row — dot + label + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: widget.value ? 6 : 0 }}>
        <span style={{
          display: 'inline-block',
          width: widget.priority >= 4 ? 7 : 6,
          height: widget.priority >= 4 ? 7 : 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: labelFontByPriority(widget.priority),
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: COLORS.textPrimary,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
        }}>
          {widget.label}
        </span>
        {widget.status && (
          <span style={{
            fontSize: 8,
            letterSpacing: '0.18em',
            color: widget.status === 'LIVE' ? COLORS.ok : widget.status === 'STALE' ? COLORS.warn : COLORS.textMuted,
            fontFamily: FONTS.mono,
          }}>
            ● {widget.status}
          </span>
        )}
      </div>

      {/* Value */}
      {widget.value && (
        <div style={{
          fontSize: valueFontByPriority(widget.priority),
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: isAccent ? COLORS.accentBright : COLORS.textPrimary,
          fontVariantNumeric: 'tabular-nums',
          paddingLeft: 14,
          lineHeight: 1.15,
        }}>
          {widget.value}
        </div>
      )}

      {/* Priority pip rail (right edge) — small dots showing priority 1-5 */}
      <div style={{
        position: 'absolute',
        top: 8, right: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {[5, 4, 3, 2, 1].map((p) => (
          <span key={p} style={{
            width: 4, height: 4,
            borderRadius: '50%',
            background: widget.priority >= p ? dotColor : 'rgba(255, 255, 255, 0.08)',
            opacity: widget.priority >= p ? 0.85 : 0.4,
          }} />
        ))}
      </div>

      {/* Expanded detail — only on hover */}
      {hovered && (widget.detail || widget.source) && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px dashed ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {widget.detail && (
            <div style={{
              fontSize: 11,
              fontFamily: FONTS.mono,
              color: COLORS.textSecondary,
              letterSpacing: '0.04em',
              lineHeight: 1.4,
            }}>
              {widget.detail}
            </div>
          )}
          {widget.source && (
            <div style={{
              fontSize: 9,
              fontFamily: FONTS.mono,
              letterSpacing: '0.18em',
              color: COLORS.textMuted,
              textTransform: 'uppercase',
            }}>
              SRC · {widget.source}
            </div>
          )}
          <div style={{
            fontSize: 9,
            fontFamily: FONTS.mono,
            letterSpacing: '0.18em',
            color: COLORS.accent,
            textTransform: 'uppercase',
          }}>
            LAYER {widget.layer} · PRIO {widget.priority}
          </div>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Edge illumination — replaces the flying-sphere pulses
// ──────────────────────────────────────────────────────────────────

interface LitEdge {
  edgeIdx: number;
  startedAt: number;
  duration: number;
}

const EdgeNetwork: React.FC<{
  widgets: PreparedWidget[];
  edges: Edge[];
  patternEdges: Set<number>;
}> = ({ widgets, edges, patternEdges }) => {
  const meshRef = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(edges.length * 6), [edges]);
  const colors = useMemo(() => new Float32Array(edges.length * 6), [edges]);
  const litRef = useRef<LitEdge[]>([]);

  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  // Spawn lit edges continuously — visible signal flow
  useEffect(() => {
    const id = window.setInterval(() => {
      const MAX = 24;
      if (litRef.current.length >= MAX) return;
      // Bias toward outer edges (layer 1→2 or 2→3)
      const candidates: number[] = [];
      edges.forEach((e, i) => {
        const fl = widgets[e.from].layer;
        const tl = widgets[e.to].layer;
        const minL = Math.min(fl, tl);
        // Higher chance for outer edges
        const weight = minL === 1 ? 4 : minL === 2 ? 3 : 1;
        for (let k = 0; k < weight; k++) candidates.push(i);
      });
      const edgeIdx = candidates[Math.floor(Math.random() * candidates.length)];
      litRef.current.push({
        edgeIdx,
        startedAt: performance.now(),
        duration: 700 + Math.random() * 700,
      });
    }, 90);
    return () => window.clearInterval(id);
  }, [edges, widgets]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const now = performance.now();

    // Cull expired lit edges
    litRef.current = litRef.current.filter((l) => now - l.startedAt < l.duration);
    const litMap = new Map<number, number>();
    litRef.current.forEach((l) => {
      const tt = (now - l.startedAt) / l.duration;
      const env = Math.sin(tt * Math.PI);
      litMap.set(l.edgeIdx, Math.max(litMap.get(l.edgeIdx) ?? 0, env));
    });

    // Update positions + colors
    edges.forEach((e, i) => {
      const wa = widgets[e.from];
      const wb = widgets[e.to];
      driftPosition(tmpA, wa.homePosition, t, wa.driftPhase, wa.driftSpeed, wa.driftAmp);
      driftPosition(tmpB, wb.homePosition, t, wb.driftPhase, wb.driftSpeed, wb.driftAmp);
      positions[i * 6] = tmpA.x; positions[i * 6 + 1] = tmpA.y; positions[i * 6 + 2] = tmpA.z;
      positions[i * 6 + 3] = tmpB.x; positions[i * 6 + 4] = tmpB.y; positions[i * 6 + 5] = tmpB.z;

      // Color: dim baseline + lit boost + pattern-match boost
      const litBoost = litMap.get(i) ?? 0;
      const patternBoost = patternEdges.has(i) ? 1.0 : 0;
      const baseR = 0.18, baseG = 0.06, baseB = 0.10;
      const r = baseR + litBoost * 0.85 + patternBoost * 0.95;
      const g = baseG + litBoost * 0.18 + patternBoost * 0.18;
      const b = baseB + litBoost * 0.30 + patternBoost * 0.30;
      colors[i * 6] = r; colors[i * 6 + 1] = g; colors[i * 6 + 2] = b;
      colors[i * 6 + 3] = r; colors[i * 6 + 4] = g; colors[i * 6 + 5] = b;
    });

    const posAttr = meshRef.current.geometry.attributes.position;
    (posAttr.array as Float32Array).set(positions);
    posAttr.needsUpdate = true;
    const colorAttr = meshRef.current.geometry.attributes.color;
    (colorAttr.array as Float32Array).set(colors);
    colorAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
};

// ──────────────────────────────────────────────────────────────────
// Compile burst
// ──────────────────────────────────────────────────────────────────

const CompileBurst: React.FC<{ intervalMs?: number }> = ({ intervalMs = 5500 }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      startRef.current = performance.now();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  useFrame(() => {
    if (!ringRef.current) return;
    const elapsed = performance.now() - startRef.current;
    const duration = 1800;
    const tt = Math.min(1, elapsed / duration);
    const radius = 0.5 + tt * 18;
    const opacity = elapsed > duration ? 0 : (1 - tt) * 0.40;
    ringRef.current.scale.setScalar(radius);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.95, 1, 64]} />
      <meshBasicMaterial color={COLORS.accent} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

// ──────────────────────────────────────────────────────────────────
// Center reticle
// ──────────────────────────────────────────────────────────────────

const CenterReticle: React.FC = () => (
  <Html position={[0, 0, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
    <div style={{ position: 'relative', width: 90, height: 90, opacity: 0.45 }}>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => {
        const isTop = c.startsWith('t');
        const isLeft = c.endsWith('l');
        return (
          <span key={c} style={{
            position: 'absolute',
            width: 16, height: 16,
            [isTop ? 'top' : 'bottom']: 0,
            [isLeft ? 'left' : 'right']: 0,
            borderTop: isTop ? `1px solid ${COLORS.accent}` : undefined,
            borderBottom: !isTop ? `1px solid ${COLORS.accent}` : undefined,
            borderLeft: isLeft ? `1px solid ${COLORS.accent}` : undefined,
            borderRight: !isLeft ? `1px solid ${COLORS.accent}` : undefined,
          }} />
        );
      })}
      <span style={{ position: 'absolute', top: '50%', left: 35, right: 35, height: 1, background: COLORS.accent, opacity: 0.6 }} />
      <span style={{ position: 'absolute', left: '50%', top: 35, bottom: 35, width: 1, background: COLORS.accent, opacity: 0.6 }} />
      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 4, height: 4, background: COLORS.accent, borderRadius: '50%' }} />
    </div>
  </Html>
);

// ──────────────────────────────────────────────────────────────────
// Ingestion event — new widget appears, drifts inward to a target
// ──────────────────────────────────────────────────────────────────

interface IngestionEvent {
  id: number;
  startedAt: number;
  duration: number;
  /** Random outer position to spawn at */
  startPos: THREE.Vector3;
  /** Target widget id */
  targetId: number;
  label: string;
}

const INGEST_LABELS = [
  'NEW DATA · 911 spike',
  'NEW DATA · weather alert',
  'NEW DATA · trauma alert',
  'NEW DATA · staff callout',
  'NEW DATA · regional divert',
  'NEW DATA · pattern match',
  'NEW DATA · OR delay',
  'NEW DATA · imaging queue',
];

const IngestionLayer: React.FC<{
  widgets: PreparedWidget[];
  onAbsorb: (widgetId: number) => void;
}> = ({ widgets, onAbsorb }) => {
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const idCounterRef = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const groupRefs = useRef<Map<number, THREE.Group>>(new Map());

  // Spawn a new ingestion every 1.6s
  useEffect(() => {
    const id = window.setInterval(() => {
      const target = widgets[Math.floor(Math.random() * widgets.length)];
      const startPos = new THREE.Vector3(
        (Math.random() - 0.5) * 36,
        (Math.random() - 0.5) * 24,
        (Math.random() - 0.5) * 36,
      ).normalize().multiplyScalar(20 + Math.random() * 4);
      setEvents((prev) => [
        ...prev,
        {
          id: idCounterRef.current++,
          startedAt: performance.now(),
          duration: 2000,
          startPos,
          targetId: target.id,
          label: INGEST_LABELS[Math.floor(Math.random() * INGEST_LABELS.length)],
        },
      ]);
    }, 1600);
    return () => window.clearInterval(id);
  }, [widgets]);

  // Per-frame: update positions and clean up
  useFrame(({ clock }) => {
    const now = performance.now();
    const t = clock.getElapsedTime();
    const stillActive: IngestionEvent[] = [];
    events.forEach((e) => {
      const tt = (now - e.startedAt) / e.duration;
      if (tt >= 1) {
        onAbsorb(e.targetId);
        return;
      }
      stillActive.push(e);
      const target = widgets.find((w) => w.id === e.targetId)!;
      driftPosition(tmp, target.homePosition, t, target.driftPhase, target.driftSpeed, target.driftAmp);
      const pos = e.startPos.clone().lerp(tmp, tt * tt); // ease-in
      const group = groupRefs.current.get(e.id);
      if (group) {
        group.position.copy(pos);
      }
    });
    if (stillActive.length !== events.length) {
      setEvents(stillActive);
    }
  });

  return (
    <>
      {events.map((e) => (
        <group
          key={e.id}
          ref={(node) => {
            if (node) groupRefs.current.set(e.id, node);
            else groupRefs.current.delete(e.id);
          }}
          position={[e.startPos.x, e.startPos.y, e.startPos.z]}
        >
          <Html center distanceFactor={14} style={{ pointerEvents: 'none' }} zIndexRange={[40, 5]}>
            <div style={{
              padding: '6px 10px',
              background: 'rgba(20, 20, 24, 0.85)',
              border: `1px solid ${COLORS.ok}`,
              borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono,
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.ok,
              whiteSpace: 'nowrap',
              boxShadow: `0 0 12px rgba(16, 185, 129, 0.30)`,
            }}>
              + {e.label}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Drift widget wrapper
// ──────────────────────────────────────────────────────────────────

const DriftWidget: React.FC<{
  widget: PreparedWidget;
  tracked: boolean;
  trackedConf?: number;
  patternHighlight: boolean;
  absorbing: boolean;
}> = ({ widget, tracked, trackedConf, patternHighlight, absorbing }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    driftPosition(tmp, widget.homePosition, t, widget.driftPhase, widget.driftSpeed, widget.driftAmp);
    groupRef.current.position.copy(tmp);
  });

  return (
    <group ref={groupRef}>
      <Html center distanceFactor={22} style={{}} zIndexRange={[80, 10]} occlude={false}>
        <WidgetCard
          widget={widget}
          tracked={tracked}
          trackedConf={trackedConf}
          patternHighlight={patternHighlight}
          absorbing={absorbing}
        />
      </Html>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// FutureTree — Y-axis branching tree of projected futures
// Multiple paths radiate UP from the cluster, converge into a single
// prediction at the apex. Some branches are dead-ends (ruled-out
// futures). Inspired by the Foundation Prime Radiant.
// ──────────────────────────────────────────────────────────────────

type FutureKind = 'primary' | 'alt' | 'dead' | 'apex';

interface FutureNode {
  id: string;
  pos: [number, number, number];
  label: string;
  value?: string;
  detail?: string;
  time?: string;
  conf?: number; // 0..1
  kind: FutureKind;
  size: number; // px width
}

interface FutureLink {
  from: string;
  to: string;
  kind: FutureKind;
}

// Layered nodes (Y-up). Roots near cluster, top is the predicted future.
//   Y=6   roots (6)         → 4 alive, 2 dead-ends
//   Y=12  mid (5)           → 4 alive, 1 dead-end
//   Y=18  deep (4)          → 3 alive, 1 dead-end
//   Y=24  final (2)         → both alive, converging
//   Y=30  apex (1)          → the prediction
const FUTURE_NODES: FutureNode[] = [
  // Roots (Y=6) — branching upward from cluster
  { id: 'r0', pos: [-7, 6, 0],   label: 'Surge protocol HOT',  value: '76% conf', time: 'T+15m', kind: 'primary', size: 380, conf: 0.76 },
  { id: 'r1', pos: [-2, 6, 4],   label: 'EMS rerouting',        value: '4 hospitals', time: 'T+15m', kind: 'alt',     size: 340 },
  { id: 'r2', pos: [3, 6, 2],    label: 'Trauma OR open',       value: 'Bay 3',      time: 'T+15m', kind: 'alt',     size: 340 },
  { id: 'r3', pos: [7, 6, -2],   label: 'Staff recall sent',    value: '12 nurses',  time: 'T+15m', kind: 'alt',     size: 340 },
  { id: 'r4', pos: [-9, 6, -4],  label: 'Helo offload',         value: 'Wind 22kt',  detail: 'Weather scrub', kind: 'dead', size: 260 },
  { id: 'r5', pos: [10, 6, 4],   label: 'Storm bypass route',   value: 'I-95 closed', detail: 'Geography blocks', kind: 'dead', size: 260 },

  // Mid layer (Y=12)
  { id: 'm0', pos: [-5, 12, 1],  label: 'Triage thinning',     value: '−14% wait',  time: 'T+30m', kind: 'primary', size: 380, conf: 0.81 },
  { id: 'm1', pos: [1, 12, 5],   label: 'Bed cohort A',        value: '6 freed',    time: 'T+30m', kind: 'alt',     size: 320 },
  { id: 'm2', pos: [5, 12, -3],  label: 'OR queue resolved',   value: '3 cases',    time: 'T+30m', kind: 'alt',     size: 320 },
  { id: 'm3', pos: [-8, 12, -2], label: 'Ambulance backlog',   value: '−2 in queue', time: 'T+30m', kind: 'alt',     size: 320 },
  { id: 'm4', pos: [9, 12, 5],   label: 'INSUFFICIENT DATA',   value: 'Pattern weak', detail: 'Below threshold', kind: 'dead', size: 240 },

  // Deep layer (Y=18)
  { id: 'd0', pos: [-3, 18, 2],  label: 'NEDOCS easing',       value: '−24 pts',    time: 'T+1h',  kind: 'primary', size: 400, conf: 0.69 },
  { id: 'd1', pos: [3, 18, 4],   label: 'Surge subsides',      value: '−18% load',  time: 'T+1h',  kind: 'alt',     size: 340 },
  { id: 'd2', pos: [-6, 18, -3], label: 'ICU at 88%',          value: 'Stable',     time: 'T+1h',  kind: 'alt',     size: 340 },
  { id: 'd3', pos: [7, 18, -4],  label: 'INCOMPATIBLE SIGNAL', value: 'Rejected',   detail: 'Anti-correlation', kind: 'dead', size: 240 },

  // Final (Y=24) — convergence layer
  { id: 'f0', pos: [-1, 24, 1],  label: 'Capacity recovers',   value: '88% nominal', time: 'T+2h',  kind: 'primary', size: 420, conf: 0.71 },
  { id: 'f1', pos: [3, 24, -2],  label: 'Wait time normal',    value: '< 28 min',   time: 'T+2h',  kind: 'primary', size: 380, conf: 0.66 },

  // Apex (Y=30) — the prediction
  { id: 'top', pos: [0, 30, 0],  label: 'NEDOCS easing 118 by 19:00', value: '64% confidence', detail: 'Convergent forecast — 4 paths', time: 'T+4h', kind: 'apex', size: 560, conf: 0.64 },
];

const FUTURE_LINKS: FutureLink[] = [
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

  // Deep → final (convergence)
  { from: 'd0', to: 'f0', kind: 'primary' },
  { from: 'd0', to: 'f1', kind: 'alt' },
  { from: 'd1', to: 'f1', kind: 'primary' },
  { from: 'd2', to: 'f0', kind: 'alt' },

  // Final → apex
  { from: 'f0', to: 'top', kind: 'primary' },
  { from: 'f1', to: 'top', kind: 'primary' },
];

const FutureCard: React.FC<{ node: FutureNode }> = ({ node }) => {
  const isDead = node.kind === 'dead';
  const isApex = node.kind === 'apex';
  const isPrimary = node.kind === 'primary';
  const accent = isApex ? COLORS.accentBright : isPrimary ? COLORS.accent : isDead ? COLORS.textMuted : COLORS.textSecondary;
  const bg = isDead ? 'rgba(8, 6, 8, 0.78)' : isApex ? 'rgba(28, 8, 16, 0.95)' : 'rgba(14, 8, 12, 0.92)';
  const borderColor = isApex ? COLORS.accentBright : isPrimary ? COLORS.accent : isDead ? COLORS.border : COLORS.borderStrong;
  const opacity = isDead ? 0.55 : 1;

  return (
    <div
      style={{
        width: node.size,
        padding: isApex ? `${SPACE.lg}px ${SPACE.xl}px` : `${SPACE.md}px ${SPACE.base}px`,
        background: bg,
        border: `${isApex ? 2 : 1}px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
        opacity,
        boxShadow: isApex ? `0 0 28px rgba(225, 29, 72, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.04)` : isPrimary ? `0 0 14px rgba(225, 29, 72, 0.35)` : 'none',
        position: 'relative',
        textDecoration: isDead ? 'line-through' : 'none',
      }}
    >
      {/* Top meta row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.xs, gap: SPACE.sm }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: isApex ? 12 : 10, letterSpacing: '0.20em', color: accent, textTransform: 'uppercase' }}>
          {isApex ? '◆ PREDICTION' : isPrimary ? '▲ PRIMARY' : isDead ? '× RULED OUT' : '· ALT'}
        </span>
        {node.time && (
          <span style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: '0.18em', color: COLORS.textMuted, textTransform: 'uppercase' }}>
            {node.time}
          </span>
        )}
      </div>

      {/* Main label */}
      <div style={{
        fontWeight: 600,
        fontSize: isApex ? 22 : isPrimary ? 17 : 15,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
        color: isDead ? COLORS.textMuted : COLORS.textPrimary,
        marginBottom: node.value ? SPACE.xs : 0,
      }}>
        {node.label}
      </div>

      {/* Value */}
      {node.value && (
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: isApex ? 16 : 13,
          letterSpacing: '0.05em',
          color: isDead ? COLORS.textDim : isPrimary || isApex ? COLORS.accent : COLORS.textSecondary,
        }}>
          {node.value}
        </div>
      )}

      {/* Detail (apex / dead-end) */}
      {node.detail && (
        <div style={{
          marginTop: SPACE.xs,
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.14em',
          color: COLORS.textMuted,
          textTransform: 'uppercase',
        }}>
          {node.detail}
        </div>
      )}

      {/* Confidence bar (primary + apex) */}
      {(isApex || isPrimary) && typeof node.conf === 'number' && (
        <div style={{ marginTop: SPACE.sm, display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
          <div style={{ flex: 1, height: 3, background: COLORS.border, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: `${(node.conf * 100).toFixed(0)}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentBright})`,
              boxShadow: `0 0 6px ${COLORS.accentGlow}`,
            }} />
          </div>
          <span style={{ fontFamily: FONTS.mono, fontSize: 9, letterSpacing: '0.16em', color: COLORS.textSecondary }}>
            {(node.conf * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

const FutureTree: React.FC = () => {
  const linesRef = useRef<THREE.LineSegments>(null);

  // Build line geometry: cluster→roots, plus all FUTURE_LINKS
  const { geom, primaryCount, deadCount } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    let primaryCount = 0;
    let deadCount = 0;

    const colorOf = (kind: FutureKind): [number, number, number] => {
      if (kind === 'primary' || kind === 'apex') return [0.95, 0.20, 0.36];
      if (kind === 'dead') return [0.18, 0.10, 0.10];
      return [0.45, 0.14, 0.22];
    };

    // Cluster (origin) → each root
    FUTURE_NODES.filter((n) => n.pos[1] === 6).forEach((n) => {
      const c = colorOf(n.kind);
      positions.push(0, 3, 0, n.pos[0], n.pos[1], n.pos[2]);
      colors.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      if (n.kind === 'primary') primaryCount += 1;
      if (n.kind === 'dead') deadCount += 1;
    });

    // Inter-layer links
    FUTURE_LINKS.forEach((link) => {
      const a = FUTURE_NODES.find((n) => n.id === link.from);
      const b = FUTURE_NODES.find((n) => n.id === link.to);
      if (!a || !b) return;
      const c = colorOf(link.kind);
      positions.push(...a.pos, ...b.pos);
      colors.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      if (link.kind === 'primary') primaryCount += 1;
      if (link.kind === 'dead') deadCount += 1;
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return { geom: g, primaryCount, deadCount };
  }, []);

  // Shimmer the primary path's color subtly
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.getElapsedTime();
    matRef.current.opacity = 0.78 + Math.sin(t * 1.6) * 0.08;
  });

  return (
    <group>
      {/* All edges (single LineSegments using vertex colors) */}
      <lineSegments ref={linesRef} geometry={geom}>
        <lineBasicMaterial ref={matRef} vertexColors transparent opacity={0.85} linewidth={1} />
      </lineSegments>

      {/* Apex marker — small bright sphere just behind the apex card */}
      <mesh position={[0, 30, -0.6]}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color={COLORS.accentBright} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 30, -0.6]}>
        <sphereGeometry args={[0.85, 16, 16]} />
        <meshBasicMaterial color={COLORS.accent} transparent opacity={0.20} />
      </mesh>

      {/* Section header floating above the cluster, below the roots */}
      <Html position={[0, 4.5, 0]} center distanceFactor={18} style={{ pointerEvents: 'none' }} zIndexRange={[40, 5]}>
        <div style={{
          padding: `${SPACE.xs}px ${SPACE.md}px`,
          background: 'rgba(20, 8, 14, 0.88)',
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: RADIUS.sm,
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.24em',
          color: COLORS.textSecondary,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          ▲ PROJECTED FUTURES · 4-HOUR HORIZON · {primaryCount} PRIMARY · {deadCount} RULED-OUT
        </div>
      </Html>

      {/* All future nodes as Html cards */}
      {FUTURE_NODES.map((n) => (
        <Html
          key={n.id}
          position={n.pos}
          center
          distanceFactor={n.kind === 'apex' ? 28 : 22}
          style={{ pointerEvents: 'none' }}
          zIndexRange={n.kind === 'apex' ? [70, 12] : n.kind === 'dead' ? [40, 4] : [55, 8]}
        >
          <FutureCard node={n} />
        </Html>
      ))}
    </group>
  );
};


// ──────────────────────────────────────────────────────────────────
// Scene composition
// ──────────────────────────────────────────────────────────────────

const Scene: React.FC = () => {
  const { widgets, edges, edgeIndexByPair } = useMemo(() => {
    const cat = buildCatalog();
    const positioned = layoutWidgets(cat);
    const e = buildEdges(positioned);
    const map = new Map<string, number>();
    e.forEach((edge, i) => map.set(`${edge.from}-${edge.to}`, i));
    return { widgets: positioned, edges: e, edgeIndexByPair: map };
  }, []);

  // CV tracker
  const [trackedId, setTrackedId] = useState<number>(0);
  const [trackedConf, setTrackedConf] = useState<number>(0.91);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTrackedId(Math.floor(Math.random() * widgets.length));
      setTrackedConf(0.78 + Math.random() * 0.20);
    }, 2200);
    return () => window.clearInterval(id);
  }, [widgets.length]);

  // Pattern-match bursts — pick 4-6 connected widgets, briefly highlight
  const [patternIds, setPatternIds] = useState<Set<number>>(new Set());
  const [patternEdgeIds, setPatternEdgeIds] = useState<Set<number>>(new Set());
  const [patternLabel, setPatternLabel] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      // Pick a layer-2 pattern widget; gather widgets connected to it
      const patternWidgets = widgets.filter((w) => w.layer === 2);
      const root = patternWidgets[Math.floor(Math.random() * patternWidgets.length)];
      const ids = new Set<number>([root.id]);
      const eIds = new Set<number>();
      edges.forEach((edge, idx) => {
        if (edge.from === root.id || edge.to === root.id) {
          ids.add(edge.from);
          ids.add(edge.to);
          eIds.add(idx);
        }
      });
      const messages = ['PATTERN MATCH', 'CORRELATION DETECTED', 'COVARIANCE FOUND', 'HISTORICAL MATCH'];
      setPatternIds(ids);
      setPatternEdgeIds(eIds);
      setPatternLabel(`▸ ${messages[Math.floor(Math.random() * messages.length)]} · ${root.label.toUpperCase()}`);
      window.setTimeout(() => {
        setPatternIds(new Set());
        setPatternEdgeIds(new Set());
        setPatternLabel(null);
      }, 1400);
    }, 4500);
    return () => window.clearInterval(id);
  }, [widgets, edges]);

  // Absorbing widgets — set true briefly when ingestion lands on them
  const [absorbingIds, setAbsorbingIds] = useState<Set<number>>(new Set());
  const handleAbsorb = (widgetId: number) => {
    setAbsorbingIds((prev) => {
      const next = new Set(prev);
      next.add(widgetId);
      return next;
    });
    window.setTimeout(() => {
      setAbsorbingIds((prev) => {
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
    }, 600);
  };

  return (
    <>
      <color attach="background" args={[COLORS.bg]} />
      <EdgeNetwork widgets={widgets} edges={edges} patternEdges={patternEdgeIds} />
      <CompileBurst intervalMs={5500} />
      <CenterReticle />
      <IngestionLayer widgets={widgets} onAbsorb={handleAbsorb} />
      <FutureTree />

      {widgets.map((w) => (
        <DriftWidget
          key={w.id}
          widget={w}
          tracked={trackedId === w.id}
          trackedConf={trackedId === w.id ? trackedConf : undefined}
          patternHighlight={patternIds.has(w.id)}
          absorbing={absorbingIds.has(w.id)}
        />
      ))}

      {/* Pattern-match floating label — shown at left of cluster during burst */}
      {patternLabel && (
        <Html position={[-14, 0, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }} zIndexRange={[60, 5]}>
          <div style={{
            padding: '8px 14px',
            background: 'rgba(20, 8, 14, 0.92)',
            border: `1px solid ${COLORS.accent}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: COLORS.accent,
            whiteSpace: 'nowrap',
            boxShadow: `0 0 18px rgba(225, 29, 72, 0.40)`,
            animation: 'pattern-pulse 1400ms ease-in-out',
          }}>
            {patternLabel}
          </div>
        </Html>
      )}

      {/* Camera — vertical composition. Cluster sits at origin, the
          future tree extends UP (+Y) to the apex at y=30. Target the
          midpoint at y=12 so both cluster and apex are framed. */}
      <OrbitControls
        enablePan={false}
        autoRotate={false}
        enableDamping
        dampingFactor={0.09}
        minDistance={36}
        maxDistance={120}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.82}
        target={[0, 12, 0]}
        makeDefault
      />

      {/* Bloom dialed back so it's not blinding */}
      <EffectComposer>
        <Bloom intensity={0.30} luminanceThreshold={0.55} luminanceSmoothing={0.85} mipmapBlur />
      </EffectComposer>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Public component
// ──────────────────────────────────────────────────────────────────

export const PulseRadiant: React.FC<{ height?: number | string }> = ({ height = '100%' }) => {
  return (
    <div style={{ width: '100%', height, background: COLORS.bg, position: 'relative' }}>
      {/* Floor glow */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 65% 40% at 50% 110%, ${COLORS.accentDim}, transparent 60%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
        backgroundSize: '24px 24px', opacity: 0.16,
        maskImage: 'radial-gradient(ellipse 75% 60% at center, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at center, black 30%, transparent 100%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <style>{`
        @keyframes pattern-pulse {
          0% { opacity: 0; transform: scale(0.92); }
          15% { opacity: 1; transform: scale(1.02); }
          75% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.98); }
        }
      `}</style>

      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 12, 80], fov: 50, near: 0.1, far: 240 }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
      >
        <Scene />
      </Canvas>

      <div style={{
        position: 'absolute', bottom: 14, left: '50%',
        transform: 'translateX(-50%)',
        color: COLORS.textMuted, opacity: 0.6,
        fontFamily: FONTS.mono, fontSize: 10,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        pointerEvents: 'none', zIndex: 2,
      }}>
        Hover a widget to expand · drag to look · scroll to zoom
      </div>
    </div>
  );
};
