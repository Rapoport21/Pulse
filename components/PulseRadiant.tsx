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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { COLORS, FONTS, SPACE, RADIUS } from './design';
import {
  FUTURE_NODES,
  FUTURE_LINKS,
  TIME_AXIS,
  FLOATING_EQUATIONS,
  type FutureKind,
  type FutureNode,
} from './radiant/data';

// ──────────────────────────────────────────────────────────────────
// Environment — single hook captures viewport + a11y intent. Read
// once at mount; mobile + reduced-motion don't toggle within a
// session frequently enough to justify reactive re-renders.
// ──────────────────────────────────────────────────────────────────
interface RadiantEnv {
  /** True under ~700px width — used to cut dust + dpr. */
  mobile: boolean;
  /** OS-level prefers-reduced-motion. Kills ambient rotation + drift. */
  reducedMotion: boolean;
}

const useRadiantEnv = (): RadiantEnv =>
  useMemo<RadiantEnv>(() => {
    if (typeof window === 'undefined') return { mobile: false, reducedMotion: false };
    return {
      mobile: window.matchMedia('(max-width: 700px)').matches,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }, []);

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
    // Wider XZ for breathing room per Nick.
    const priorityRadiusMap: Record<Priority, [number, number]> = {
      5: [6, 18],
      4: [16, 32],
      3: [26, 46],
      2: [36, 62],
      1: [48, 82],
    };
    const [minR, maxR] = priorityRadiusMap[w.priority];
    const radius = minR + rand() * (maxR - minR);

    // Y squash 0.42 — cluster reads as a volumetric *disc*, not a
    // sphere. Vertical extent is tightly bounded so bottom widgets
    // don't clip below the camera frame at default fit.
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const yRaw = Math.cos(phi) * radius;
    const z = Math.sin(phi) * Math.sin(theta) * radius;
    const y = yRaw * 0.42 + 2; // tiny lift so cluster sits just above origin

    return {
      ...w,
      homePosition: new THREE.Vector3(x, y, z),
      driftPhase: (i + w.priority * 1.7) * 0.7,
      driftSpeed: 0.14 + rand() * 0.20,
      driftAmp: w.priority >= 4 ? 0.22 : 0.65,
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

// Bumped HARD per Nick ("much much larger" — third pass)
const widthByPriority = (p: Priority): number => {
  switch (p) {
    case 5: return 860;
    case 4: return 740;
    case 3: return 640;
    case 2: return 560;
    case 1:
    default: return 500;
  }
};

const labelFontByPriority = (p: Priority): number => {
  switch (p) {
    case 5: return 30;
    case 4: return 26;
    case 3: return 22;
    case 2: return 19;
    case 1:
    default: return 17;
  }
};

const valueFontByPriority = (p: Priority): number => {
  switch (p) {
    case 5: return 54;
    case 4: return 46;
    case 3: return 38;
    case 2: return 32;
    case 1:
    default: return 26;
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
  /** True when this widget is the cycle's "newly arrived" — green flash */
  fresh?: boolean;
  /** Reports hover state UP so the parent <Html> can lift its
   *  zIndexRange — fixes "some widgets don't expand on hover" caused
   *  by neighbors stacking on top in the DOM. */
  onHoverChange?: (hovered: boolean) => void;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  tracked,
  trackedConf,
  patternHighlight,
  absorbing,
  fresh,
  onHoverChange,
}) => {
  const [hovered, setHovered] = useState(false);
  const dotColor = toneColor(widget.tone);
  const isAccent = widget.tone === 'accent';
  const w = widthByPriority(widget.priority);

  // Border + scale state
  const borderColor =
    fresh
      ? COLORS.ok
      : tracked || patternHighlight
      ? COLORS.accent
      : isAccent
      ? COLORS.accent
      : widget.layer >= 3
      ? COLORS.borderStrong
      : COLORS.border;

  const scale = hovered ? 1.32 : fresh ? 1.18 : absorbing ? 1.10 : 1.0;
  const shadow = fresh
    ? `0 0 22px rgba(16, 185, 129, 0.55)`
    : hovered
    ? `0 0 26px rgba(225, 29, 72, 0.45), 0 8px 28px rgba(0, 0, 0, 0.7)`
    : tracked || patternHighlight
    ? `0 0 16px rgba(225, 29, 72, 0.30)`
    : `0 4px 14px rgba(0, 0, 0, 0.55)`;

  return (
    <div
      onMouseEnter={() => { setHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setHovered(false); onHoverChange?.(false); }}
      style={{
        position: 'relative',
        width: w,
        background: COLORS.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        padding: `${SPACE.md}px ${SPACE.base}px`,
        fontFamily: FONTS.mono,
        boxShadow: shadow,
        userSelect: 'none',
        pointerEvents: 'auto',
        cursor: 'default',
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        transition: 'transform 280ms cubic-bezier(0.23, 1, 0.32, 1), border-color 280ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 280ms cubic-bezier(0.23, 1, 0.32, 1)',
        zIndex: hovered ? 90 : fresh ? 60 : 10,
      }}
    >
      {/* "+ NEW DATA" badge during fresh-arrival pulse */}
      {fresh && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -10,
            left: 14,
            padding: '3px 8px',
            background: COLORS.ok,
            color: '#020202',
            fontFamily: FONTS.mono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            borderRadius: RADIUS.sm,
            boxShadow: `0 0 14px rgba(16, 185, 129, 0.55)`,
            pointerEvents: 'none',
          }}
        >
          + NEW DATA
        </span>
      )}
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
// Ingestion event — new widget appears at the SIDE of the radiant,
// floats inward into the cluster, drawing a connector beam from its
// flight position to its target widget. On arrival, fires onAbsorb
// (target widget pulses) AND onCascade (FutureTree lights up the
// primary path from cluster -> apex like a relayed signal).
// ──────────────────────────────────────────────────────────────────

interface IngestionEvent {
  id: number;
  startedAt: number;
  duration: number;
  /** Spawn position — biased to ±X side, well outside cluster */
  startPos: THREE.Vector3;
  /** Target widget id */
  targetId: number;
  label: string;
  value: string;
  source: string;
}

const INGEST_PAYLOADS: Array<{ label: string; value: string; source: string }> = [
  { label: '911 call surge',     value: '+34 / 5min',       source: 'CHP-911'  },
  { label: 'NWS storm cell',     value: 'EF1 risk',         source: 'NOAA'     },
  { label: 'Pediatric trauma',   value: 'EMS inbound',      source: 'EMS-NET'  },
  { label: 'Staff callout',      value: '3 RNs · noc',      source: 'KRONOS'   },
  { label: 'Regional divert',    value: 'County Mem · ED',  source: 'STATEDIV' },
  { label: 'OR delay flag',      value: 'Bay 4 · +18m',     source: 'EPIC-OR'  },
  { label: 'Imaging queue',      value: 'CT · 7 backlog',   source: 'PACS'     },
  { label: 'Heli wind alert',    value: '24 kt gust',       source: 'NOAA-AVN' },
  { label: 'Sepsis screen hit',  value: 'Bay 12 · pos',     source: 'CDS-AI'   },
  { label: 'Lab critical',       value: 'K+ 6.4',           source: 'CERNER'   },
];

const IngestionLayer: React.FC<{
  widgets: PreparedWidget[];
  onAbsorb: (widgetId: number) => void;
  onCascade: () => void;
}> = ({ widgets, onAbsorb, onCascade }) => {
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const idCounterRef = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const groupRefs = useRef<Map<number, THREE.Group>>(new Map());

  // Beam buffer — single LineSegments draws a hot line from each event's
  // current position to its target widget. Sized for up to 4 simultaneous
  // beams sampled at 16 segments each (so signal-flow heat can race
  // along the beam toward the widget).
  const MAX_BEAMS = 4;
  const SEGS_PER_BEAM = 16;
  const beamPositions = useMemo(() => new Float32Array(MAX_BEAMS * SEGS_PER_BEAM * 6), []);
  const beamColors = useMemo(() => new Float32Array(MAX_BEAMS * SEGS_PER_BEAM * 6), []);
  const beamRef = useRef<THREE.LineSegments>(null);

  // Spawn a new ingestion every 4.5s — one widget visible at a time
  // unless tail end overlaps with next spawn (cadence > flight duration).
  useEffect(() => {
    const id = window.setInterval(() => {
      const target = widgets[Math.floor(Math.random() * widgets.length)];
      // Bias to ±X side so it clearly enters from offscreen-ish, with
      // moderate Y/Z jitter so they don't all line up.
      const sideSign = Math.random() < 0.5 ? -1 : 1;
      const startPos = new THREE.Vector3(
        sideSign * (95 + Math.random() * 18),
        (Math.random() - 0.5) * 26 + 12,
        (Math.random() - 0.5) * 30,
      );
      const payload = INGEST_PAYLOADS[Math.floor(Math.random() * INGEST_PAYLOADS.length)];
      setEvents((prev) => [
        ...prev,
        {
          id: idCounterRef.current++,
          startedAt: performance.now(),
          duration: 3200,
          startPos,
          targetId: target.id,
          label: payload.label,
          value: payload.value,
          source: payload.source,
        },
      ]);
    }, 4500);
    return () => window.clearInterval(id);
  }, [widgets]);

  // Per-frame: update card positions, beam geometry, fire absorb+cascade
  useFrame(({ clock }) => {
    const now = performance.now();
    const t = clock.getElapsedTime();
    const stillActive: IngestionEvent[] = [];
    let beamIdx = 0;
    let dirty = false;

    events.forEach((e) => {
      const tt = (now - e.startedAt) / e.duration;
      if (tt >= 1) {
        onAbsorb(e.targetId);
        onCascade();
        dirty = true;
        return;
      }
      stillActive.push(e);

      const target = widgets.find((w) => w.id === e.targetId);
      if (!target) return;
      driftPosition(tmp, target.homePosition, t, target.driftPhase, target.driftSpeed, target.driftAmp);

      // Easing — slow start, accelerating arrival
      const ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
      const pos = e.startPos.clone().lerp(tmp, ease);

      // Move card group
      const group = groupRefs.current.get(e.id);
      if (group) group.position.copy(pos);

      // Write beam segments — sampled line from card position to target
      if (beamIdx < MAX_BEAMS) {
        // Signal head walks along the beam — bright at head, dim at tail
        const head = ease;
        for (let s = 0; s < SEGS_PER_BEAM; s++) {
          const t0 = s / SEGS_PER_BEAM;
          const t1 = (s + 1) / SEGS_PER_BEAM;
          const a = pos.clone().lerp(tmp, t0);
          const b = pos.clone().lerp(tmp, t1);
          const o = (beamIdx * SEGS_PER_BEAM + s) * 6;
          beamPositions[o] = a.x; beamPositions[o + 1] = a.y; beamPositions[o + 2] = a.z;
          beamPositions[o + 3] = b.x; beamPositions[o + 4] = b.y; beamPositions[o + 5] = b.z;
          // Heat profile: hot near `head`, fade away in both directions
          const segMid = (t0 + t1) / 2;
          const dist = Math.abs(segMid - head);
          const heat = Math.max(0, 1 - dist * 4) * 0.85 + 0.15;
          beamColors[o]     = 0.10 + heat * 0.06;
          beamColors[o + 1] = 0.55 + heat * 0.30;
          beamColors[o + 2] = 0.40 + heat * 0.18;
          beamColors[o + 3] = beamColors[o];
          beamColors[o + 4] = beamColors[o + 1];
          beamColors[o + 5] = beamColors[o + 2];
        }
        beamIdx += 1;
      }
    });

    // Zero out unused beam slots so prior beams don't ghost
    for (let i = beamIdx; i < MAX_BEAMS; i++) {
      const baseO = i * SEGS_PER_BEAM * 6;
      for (let s = 0; s < SEGS_PER_BEAM * 6; s++) {
        beamPositions[baseO + s] = 0;
        beamColors[baseO + s] = 0;
      }
    }

    if (beamRef.current) {
      const posAttr = beamRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = beamRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
      (posAttr.array as Float32Array).set(beamPositions);
      (colAttr.array as Float32Array).set(beamColors);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    if (dirty || stillActive.length !== events.length) {
      setEvents(stillActive);
    }
  });

  return (
    <>
      {/* Inbound beam — sampled hot line from each card's flight
          position to its target widget */}
      <lineSegments ref={beamRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[beamPositions, 3]}
            count={beamPositions.length / 3}
            array={beamPositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[beamColors, 3]}
            count={beamColors.length / 3}
            array={beamColors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </lineSegments>

      {/* Inbound widget card — full styled card, mid-flight from side */}
      {events.map((e) => (
        <group
          key={e.id}
          ref={(node) => {
            if (node) groupRefs.current.set(e.id, node);
            else groupRefs.current.delete(e.id);
          }}
          position={[e.startPos.x, e.startPos.y, e.startPos.z]}
        >
          <Html center distanceFactor={36} style={{ pointerEvents: 'none' }} zIndexRange={[120, 60]}>
            <div style={{
              width: 360,
              padding: `${SPACE.md}px ${SPACE.base}px`,
              background: 'rgba(6, 16, 12, 0.94)',
              border: `2px solid ${COLORS.ok}`,
              borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono,
              boxShadow: `0 0 28px rgba(16, 185, 129, 0.55), inset 0 0 0 1px rgba(16, 185, 129, 0.18)`,
              animation: 'ingest-card 600ms cubic-bezier(0.16, 1, 0.32, 1) backwards',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: SPACE.xs,
              }}>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: COLORS.ok,
                  textTransform: 'uppercase',
                }}>
                  + INBOUND SIGNAL
                </span>
                <span style={{
                  fontFamily: FONTS.mono,
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  color: COLORS.textMuted,
                  textTransform: 'uppercase',
                }}>
                  {e.source}
                </span>
              </div>
              <div style={{
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: '0.06em',
                color: COLORS.textPrimary,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                {e.label}
              </div>
              <div style={{
                fontFamily: FONTS.mono,
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: COLORS.ok,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {e.value}
              </div>
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
  /** When true, this widget is the cycle's "newly arrived" — green flash */
  fresh?: boolean;
  /** When true, freeze widget at homePosition (a11y: reduced motion) */
  paused?: boolean;
}> = ({ widget, tracked, trackedConf, patternHighlight, absorbing, fresh, paused }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (paused) {
      groupRef.current.position.copy(widget.homePosition);
      return;
    }
    const t = clock.getElapsedTime();
    driftPosition(tmp, widget.homePosition, t, widget.driftPhase, widget.driftSpeed, widget.driftAmp);
    groupRef.current.position.copy(tmp);
  });

  // Stagger initial spawn — each widget animates in from scale(0.6) +
  // blur. Delay by widget.id so cluster ripples into being.
  const spawnDelay = `${(widget.id % 80) * 18}ms`;

  // Hovered widget jumps to a higher zIndexRange so it lifts above
  // every neighbor on screen (drei's <Html> uses these to assign
  // DOM z-index from camera depth — without the lift, a closer
  // neighbor's stacking context blocks pointer events on this card).
  const zRange: [number, number] = hovered ? [400, 250] : fresh ? [180, 90] : [80, 10];

  return (
    <group ref={groupRef}>
      <Html
        center
        distanceFactor={36}
        style={{
          animation: `widget-spawn 600ms cubic-bezier(0.16, 1, 0.32, 1) ${spawnDelay} backwards`,
        }}
        zIndexRange={zRange}
        occlude={false}
      >
        <WidgetCard
          widget={widget}
          tracked={tracked}
          trackedConf={trackedConf}
          patternHighlight={patternHighlight}
          absorbing={absorbing}
          fresh={fresh}
          onHoverChange={setHovered}
        />
      </Html>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// FutureTree — Y-axis branching tree of projected futures
//
// Multiple paths radiate up from the cluster, converge into a single
// prediction at the apex. Some branches are dead-ends (ruled-out
// futures). Inspired by the Foundation Prime Radiant. Node + link
// data lives in ./radiant/data so it can be swapped from a real
// prediction stream later.
// ──────────────────────────────────────────────────────────────────

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
      data-radiant-apex={isApex || undefined}
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
        animation: isApex ? 'apex-breath 4.2s ease-in-out infinite' : undefined,
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
              animation: isApex ? 'apex-conf-breath 4.2s ease-in-out infinite' : undefined,
            }} />
          </div>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: COLORS.textSecondary,
            animation: isApex ? 'apex-conf-breath 4.2s ease-in-out infinite' : undefined,
          }}>
            {(node.conf * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

interface CurveMeta {
  kind: FutureKind;
  /** Inclusive index of the curve's first line-segment (each segment = 6 floats in colors[]) */
  startSeg: number;
  /** Exclusive index of the curve's last line-segment */
  endSeg: number;
  /** World-space midpoint position (for the "× PRUNED" badge) */
  midpoint: [number, number, number];
}

interface FlowEvent {
  curveIdx: number;
  startedAt: number;
  duration: number;
}

const COLOR_PRIMARY: [number, number, number] = [0.95, 0.20, 0.36];
const COLOR_ALT: [number, number, number] = [0.45, 0.14, 0.22];
const COLOR_DEAD: [number, number, number] = [0.18, 0.10, 0.10];
const COLOR_FLOW_HEAD: [number, number, number] = [1.0, 0.55, 0.65];

const FutureTree: React.FC<{ cascadeNonce?: number }> = ({ cascadeNonce = 0 }) => {
  const linesRef = useRef<THREE.LineSegments>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const flowsRef = useRef<FlowEvent[]>([]);

  // ── Build geometry: bowed Catmull-Rom splines, one per edge ─────
  const { geom, curves, primaryCount, deadCount } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const curves: CurveMeta[] = [];
    let primaryCount = 0;
    let deadCount = 0;

    const colorOf = (kind: FutureKind): [number, number, number] => {
      if (kind === 'primary' || kind === 'apex') return COLOR_PRIMARY;
      if (kind === 'dead') return COLOR_DEAD;
      return COLOR_ALT;
    };

    // Sample a STRAIGHT line between two points at N segments. Sampled
    // (rather than 1 segment edge to edge) so the per-frame signal-flow
    // animation can paint a moving hot trail along the line. The
    // visual is a straight line — no curves, no bowing — per Nick.
    const sampleLine = (
      a: [number, number, number],
      b: [number, number, number],
      kind: FutureKind,
      segments = 22,
    ): { count: number; midpoint: [number, number, number] } => {
      const va = new THREE.Vector3(...a);
      const vb = new THREE.Vector3(...b);
      const curve = new THREE.LineCurve3(va, vb);
      const pts = curve.getPoints(segments);
      const c = colorOf(kind);
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        colors.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      }
      const midPt = pts[Math.floor(pts.length / 2)];
      return { count: pts.length - 1, midpoint: [midPt.x, midPt.y, midPt.z] };
    };

    // Cluster origin → each root
    FUTURE_NODES.filter((n) => n.pos[1] >= 11 && n.pos[1] <= 17).forEach((n) => {
      const startSeg = positions.length / 6;
      const { count, midpoint } = sampleLine([0, 4, 0], n.pos, n.kind);
      curves.push({ kind: n.kind, startSeg, endSeg: startSeg + count, midpoint });
      if (n.kind === 'primary') primaryCount += 1;
      if (n.kind === 'dead') deadCount += 1;
    });

    // Inter-layer links
    FUTURE_LINKS.forEach((link) => {
      const a = FUTURE_NODES.find((n) => n.id === link.from);
      const b = FUTURE_NODES.find((n) => n.id === link.to);
      if (!a || !b) return;
      const startSeg = positions.length / 6;
      const { count, midpoint } = sampleLine(a.pos, b.pos, link.kind);
      curves.push({ kind: link.kind, startSeg, endSeg: startSeg + count, midpoint });
      if (link.kind === 'primary') primaryCount += 1;
      if (link.kind === 'dead') deadCount += 1;
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return { geom: g, curves, primaryCount, deadCount };
  }, []);

  // Snapshot of the "neutral" colors so each frame can reset before
  // applying flow heat + pruning overrides.
  const baseColorsTemplate = useMemo(() => {
    const a = geom.getAttribute('color').array as Float32Array;
    return new Float32Array(a);
  }, [geom]);

  // ── Branch pruning — every 12s, pick a random alt curve and "rule
  //    it out" for ~7s. The curve dims to dead-grey, a "× PATH PRUNED"
  //    badge fades up at its midpoint, then it heals and the cycle
  //    picks another curve. Makes the radiant feel like it's actively
  //    evaluating, not just decorating.
  const [prunedIdx, setPrunedIdx] = useState<number | null>(null);
  const altCurveIndices = useMemo(
    () => curves.map((c, i) => (c.kind === 'alt' ? i : -1)).filter((i) => i >= 0),
    [curves],
  );
  useEffect(() => {
    if (altCurveIndices.length === 0) return;
    let pickAt = -1;
    const id = window.setInterval(() => {
      pickAt = altCurveIndices[Math.floor(Math.random() * altCurveIndices.length)];
      setPrunedIdx(pickAt);
      window.setTimeout(() => setPrunedIdx((cur) => (cur === pickAt ? null : cur)), 6800);
    }, 12000);
    return () => window.clearInterval(id);
  }, [altCurveIndices]);

  // ── Flow events — primary curves fire signals constantly, alts
  //    occasionally. Each flow walks from t=0 to t=1 along its
  //    curve over ~900ms with a 5-segment hot trail.
  useEffect(() => {
    if (curves.length === 0) return;
    const id = window.setInterval(() => {
      const MAX = 18;
      if (flowsRef.current.length >= MAX) return;
      // Weighted pool — primary 6×, alt 2×, dead 0×
      const pool: number[] = [];
      curves.forEach((c, i) => {
        const w = c.kind === 'primary' || c.kind === 'apex' ? 6 : c.kind === 'alt' ? 2 : 0;
        for (let k = 0; k < w; k++) pool.push(i);
      });
      if (pool.length === 0) return;
      flowsRef.current.push({
        curveIdx: pool[Math.floor(Math.random() * pool.length)],
        startedAt: performance.now(),
        duration: 750 + Math.random() * 350,
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [curves]);

  // ── Cascade — every IngestionLayer absorb increments cascadeNonce.
  //    Light up the primary path stages (cluster→r0, r0→m0, m0→d0,
  //    d0→f0, f0→top) in sequence so the eye traces a single signal
  //    racing from the cluster all the way to the apex.
  useEffect(() => {
    if (cascadeNonce === 0 || curves.length === 0) return;
    // Find primary curves by kind, ordered by their starting Y so the
    // sequence reads bottom→top. The first one (lowest Y) is the
    // cluster→r0 arrival; subsequent ones move through the layers.
    const sorted = curves
      .map((c, i) => ({ c, i, y: c.midpoint[1] }))
      .filter((x) => x.c.kind === 'primary' || x.c.kind === 'apex')
      .sort((a, b) => a.y - b.y);
    const stages = sorted.slice(0, 6);
    const baseAt = performance.now();
    const timeouts: number[] = [];
    stages.forEach((s, idx) => {
      const id = window.setTimeout(() => {
        flowsRef.current.push({
          curveIdx: s.i,
          startedAt: performance.now(),
          duration: 950,
        });
        // Double up — second flow on the same curve, half-step later
        const id2 = window.setTimeout(() => {
          flowsRef.current.push({
            curveIdx: s.i,
            startedAt: performance.now(),
            duration: 850,
          });
        }, 220);
        timeouts.push(id2);
      }, idx * 280);
      timeouts.push(id);
      void baseAt;
    });
    return () => timeouts.forEach((id) => window.clearTimeout(id));
  }, [cascadeNonce, curves]);

  // Per-frame: reset to base, apply pruning override, apply flow heat
  useFrame(({ clock }) => {
    if (!linesRef.current) return;
    const colorAttr = linesRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = colorAttr.array as Float32Array;
    arr.set(baseColorsTemplate);

    // Pruning override — dim the pruned curve to dead-grey
    if (prunedIdx != null && prunedIdx >= 0 && prunedIdx < curves.length) {
      const c = curves[prunedIdx];
      for (let i = c.startSeg; i < c.endSeg; i++) {
        const o = i * 6;
        arr[o] = COLOR_DEAD[0]; arr[o + 1] = COLOR_DEAD[1]; arr[o + 2] = COLOR_DEAD[2];
        arr[o + 3] = COLOR_DEAD[0]; arr[o + 4] = COLOR_DEAD[1]; arr[o + 5] = COLOR_DEAD[2];
      }
    }

    // Flow heat — head + 5-segment trail
    const now = performance.now();
    flowsRef.current = flowsRef.current.filter((f) => now - f.startedAt < f.duration);
    flowsRef.current.forEach((f) => {
      const c = curves[f.curveIdx];
      if (!c) return;
      const tt = (now - f.startedAt) / f.duration;
      const segCount = c.endSeg - c.startSeg;
      const head = tt * (segCount - 1);
      for (let i = 0; i < segCount; i++) {
        const dist = head - i;
        // Trail behind the head, fade ahead
        const heat = dist >= 0 && dist <= 5 ? 1 - dist / 5 : dist < 0 && dist >= -1 ? 1 + dist : 0;
        if (heat <= 0) continue;
        const o = (c.startSeg + i) * 6;
        const r = arr[o] + (COLOR_FLOW_HEAD[0] - arr[o]) * heat;
        const g = arr[o + 1] + (COLOR_FLOW_HEAD[1] - arr[o + 1]) * heat;
        const bl = arr[o + 2] + (COLOR_FLOW_HEAD[2] - arr[o + 2]) * heat;
        arr[o] = r; arr[o + 1] = g; arr[o + 2] = bl;
        arr[o + 3] = r; arr[o + 4] = g; arr[o + 5] = bl;
      }
    });

    colorAttr.needsUpdate = true;

    // Subtle global opacity breath
    if (matRef.current) {
      matRef.current.opacity = 0.78 + Math.sin(clock.getElapsedTime() * 1.4) * 0.08;
    }
  });

  const prunedMid = prunedIdx != null ? curves[prunedIdx]?.midpoint : null;

  return (
    <group>
      {/* All edges */}
      <lineSegments ref={linesRef} geometry={geom}>
        <lineBasicMaterial ref={matRef} vertexColors transparent opacity={0.85} linewidth={1} depthWrite={false} toneMapped={false} />
      </lineSegments>

      {/* Apex marker — bright sphere just behind the apex card */}
      <mesh position={[0, 60, -0.6]}>
        <sphereGeometry args={[0.85, 20, 20]} />
        <meshBasicMaterial color={COLORS.accentBright} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 60, -0.6]}>
        <sphereGeometry args={[1.6, 20, 20]} />
        <meshBasicMaterial color={COLORS.accent} transparent opacity={0.20} />
      </mesh>

      {/* Section header floating between cluster and roots */}
      <Html position={[0, 7, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }} zIndexRange={[40, 5]}>
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

      {/* Pruning notice — fades up at the midpoint of the currently-pruned alt curve */}
      {prunedMid && (
        <Html position={prunedMid} center distanceFactor={18} style={{ pointerEvents: 'none' }} zIndexRange={[60, 8]}>
          <div style={{
            padding: '5px 10px',
            background: 'rgba(20, 6, 10, 0.92)',
            border: `1px solid ${COLORS.textMuted}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.20em',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            animation: 'prune-fade 6800ms ease-in-out',
          }}>
            × PATH PRUNED
          </div>
        </Html>
      )}

      {/* All future nodes as Html cards */}
      {FUTURE_NODES.map((n) => (
        <Html
          key={n.id}
          position={n.pos}
          center
          distanceFactor={n.kind === 'apex' ? 48 : 38}
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
// TimeAxis — vertical ticks on +X side, mapping Y to T+15m..T+4h
// ──────────────────────────────────────────────────────────────────
const TimeAxis: React.FC = () => (
  <group>
    {/* Spine — pushed out to x=58 so it clears the wider future-tree spread */}
    <mesh position={[58, 38, 0]}>
      <boxGeometry args={[0.07, 56, 0.07]} />
      <meshBasicMaterial color={COLORS.borderStrong} transparent opacity={0.55} toneMapped={false} />
    </mesh>
    {TIME_AXIS.map(({ y, label, emphasis }) => (
      <group key={y}>
        {/* Tick crossbar */}
        <mesh position={[58, y, 0]}>
          <boxGeometry args={[1.4, 0.07, 0.07]} />
          <meshBasicMaterial color={emphasis ? COLORS.accentBright : COLORS.accent} transparent opacity={emphasis ? 0.9 : 0.65} toneMapped={false} />
        </mesh>
        <Html position={[62, y, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }} zIndexRange={[30, 4]}>
          <div style={{
            padding: '4px 10px',
            background: 'rgba(20, 8, 14, 0.88)',
            border: `1px solid ${emphasis ? COLORS.accent : COLORS.borderStrong}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: '0.22em',
            color: emphasis ? COLORS.accentBright : COLORS.textSecondary,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
        </Html>
      </group>
    ))}
  </group>
);

// ──────────────────────────────────────────────────────────────────
// FloatingEquations — psychohistory-flavored mono labels in 3D space
// ──────────────────────────────────────────────────────────────────
const FloatingEquations: React.FC = () => (
  <>
    {FLOATING_EQUATIONS.map((eq, i) => (
      <Html key={i} position={eq.pos} center distanceFactor={18} style={{ pointerEvents: 'none' }} zIndexRange={[20, 3]}>
        <div style={{
          padding: '3px 9px',
          background: 'rgba(20, 8, 14, 0.55)',
          border: `1px dashed ${COLORS.border}`,
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: '0.04em',
          color: COLORS.textSecondary,
          opacity: 0.62,
          whiteSpace: 'nowrap',
        }}>
          {eq.text}
        </div>
      </Html>
    ))}
  </>
);

// ──────────────────────────────────────────────────────────────────
// AmbientDust — sparse particle field for atmosphere
// (no animation per-frame; gets motion from the scene's rotation)
// ──────────────────────────────────────────────────────────────────

const AmbientDust: React.FC<{ count?: number }> = ({ count = 600 }) => {
  const { positions, sizes } = useMemo(() => {
    const N = count;
    const pos = new Float32Array(N * 3);
    const siz = new Float32Array(N);
    let seed = 17;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < N; i++) {
      const r = 30 + rand() * 60;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 22; // bias upward into the future cone
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      siz[i] = 0.05 + rand() * 0.18;
    }
    return { positions: pos, sizes: siz };
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        color={COLORS.accent}
        transparent
        opacity={0.30}
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
};

// ──────────────────────────────────────────────────────────────────
// AmbientRotation — slow Y-axis rotation of the entire 3D structure
// HTML labels in drei <Html> are rendered in screen space, so they
// stay readable while the geometry rotates underneath them. Gives
// the Foundation Prime Radiant "live hologram" feel.
// ──────────────────────────────────────────────────────────────────

const AmbientRotation: React.FC<{ speed?: number; children: React.ReactNode }> = ({ speed = 0.04, children }) => {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current && speed !== 0) groupRef.current.rotation.y += speed * delta;
  });
  return <group ref={groupRef}>{children}</group>;
};

// ──────────────────────────────────────────────────────────────────
// CameraOrchestrator — handles BOTH initial intro flight AND aspect-
// ratio fit so the radiant always lands inside the viewport. On mount
// we compute a "home" distance from the canvas size + camera FOV that
// frames the structure with padding, drop the camera at a far/tilted
// start position, then ease to home over ~1.7s. After the intro
// completes, OrbitControls mounts and reads the camera's current
// position to initialize its spherical coords — so the user's first
// drag continues from wherever the intro landed.
// ──────────────────────────────────────────────────────────────────

const computeFitHome = (
  fovDeg: number,
  width: number,
  height: number,
  /** Y the camera looks at — chosen midway between cluster floor & apex */
  targetY: number,
  /** Half-extents of the structure to fit (radius from target along each axis) */
  halfY: number,
  halfXZ: number,
): THREE.Vector3 => {
  const aspect = width / Math.max(1, height);
  const fovRad = (fovDeg * Math.PI) / 180;
  const tanHalf = Math.tan(fovRad / 2);
  // 1.20 vertical padding, 1.15 horizontal padding so labels never crop
  const distH = (halfY * 1.20) / tanHalf;
  const distW = (halfXZ * 1.15) / (aspect * tanHalf);
  const dist = Math.max(distH, distW, 95);
  return new THREE.Vector3(0, targetY, dist);
};

const CameraOrchestrator: React.FC<{
  paused: boolean;
  onIntroDone: () => void;
}> = ({ paused, onIntroDone }) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const startedRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Cluster squashed to ±~17 around origin, apex at y=62. Target the
  // midpoint, halfY = 48 covers the whole [-17, +62] range with the
  // 1.20 padding factor in computeFitHome. halfXZ matches widened
  // priority-1 reach (82) plus TimeAxis (62).
  const targetY = 22;
  const halfY = 48;
  const halfXZ = 92;

  const home = useMemo(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return new THREE.Vector3(0, targetY, 145);
    return computeFitHome(camera.fov, size.width, size.height, targetY, halfY, halfXZ);
  }, [camera, size.width, size.height]);

  // Start point: shifted up + back, tilted off-axis, so the intro
  // dollies forward and tilts down into the radiant.
  const start = useMemo(
    () => new THREE.Vector3(home.x + 18, home.y + 26, home.z * 1.55),
    [home],
  );

  // One-time mount: snap camera to start, kick off intro timer
  useEffect(() => {
    if (completedRef.current) return;
    camera.position.copy(start);
    camera.lookAt(0, targetY, 0);
    startedRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    if (paused || completedRef.current) return;
    const DURATION = 1700; // ms
    const elapsed = performance.now() - startedRef.current;
    const tt = Math.min(1, elapsed / DURATION);
    const ease = 1 - Math.pow(1 - tt, 3);
    const pos = start.clone().lerp(home, ease);
    camera.position.copy(pos);
    camera.lookAt(0, targetY, 0);
    if (tt >= 1) {
      completedRef.current = true;
      onIntroDone();
    }
  });

  return null;
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

  // Environment-aware tuning: freeze motion on a11y; drop ambient dust
  // entirely per Nick (no flying dots).
  const env = useRadiantEnv();
  const rotationSpeed = env.reducedMotion ? 0 : 0.035;
  const driftPaused = env.reducedMotion;

  // Camera intro: orchestrator handles camera until intro completes,
  // then OrbitControls mounts and takes over. Keeps the entry cinematic
  // and screen-fitted on every aspect ratio.
  const [introDone, setIntroDone] = useState(false);

  // Fresh-arrival cycle — every 2.6s, mark a random widget as "newly
  // arrived" for 1.4s. The widget gets a green border + scale pulse +
  // "+ NEW DATA" pip. Combined with IngestionLayer's incoming
  // labels, makes the radiant feel like it's continuously growing.
  const [freshId, setFreshId] = useState<number | null>(null);
  useEffect(() => {
    if (widgets.length === 0) return;
    const id = window.setInterval(() => {
      const target = widgets[Math.floor(Math.random() * widgets.length)];
      setFreshId(target.id);
      window.setTimeout(
        () => setFreshId((cur) => (cur === target.id ? null : cur)),
        1400,
      );
    }, 2600);
    return () => window.clearInterval(id);
  }, [widgets]);

  // Signal cascade — incremented every time IngestionLayer absorbs.
  // FutureTree watches this and lights up the primary path from the
  // cluster up to the apex like a relayed signal.
  const [cascadeNonce, setCascadeNonce] = useState(0);
  const triggerCascade = useCallback(() => setCascadeNonce((n) => n + 1), []);

  return (
    <>
      <color attach="background" args={[COLORS.bg]} />

      <CameraOrchestrator paused={env.reducedMotion} onIntroDone={() => setIntroDone(true)} />

      {/* Everything 3D lives inside a slowly rotating group. HTML cards
          stay screen-locked (drei <Html> default), so labels remain
          readable while geometry rotates underneath — that's the
          Foundation Prime Radiant feel. */}
      <AmbientRotation speed={rotationSpeed}>
        <FloatingEquations />
        <TimeAxis />
        <EdgeNetwork widgets={widgets} edges={edges} patternEdges={patternEdgeIds} />
        <CenterReticle />
        <IngestionLayer widgets={widgets} onAbsorb={handleAbsorb} onCascade={triggerCascade} />
        <FutureTree cascadeNonce={cascadeNonce} />

        {widgets.map((w) => (
          <DriftWidget
            key={w.id}
            widget={w}
            tracked={trackedId === w.id}
            trackedConf={trackedId === w.id ? trackedConf : undefined}
            patternHighlight={patternIds.has(w.id)}
            absorbing={absorbingIds.has(w.id)}
            fresh={freshId === w.id}
            paused={driftPaused}
          />
        ))}
      </AmbientRotation>

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

      {/* OrbitControls mount only after the intro completes. Reads camera
          position from current state to initialize spherical coords, so
          user picks up wherever the intro landed. */}
      {introDone && (
        <OrbitControls
          enablePan={false}
          autoRotate={false}
          enableDamping
          dampingFactor={0.09}
          minDistance={80}
          maxDistance={320}
          minPolarAngle={Math.PI * 0.14}
          maxPolarAngle={Math.PI * 0.86}
          target={[0, 22, 0]}
          makeDefault
        />
      )}

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
  const env = useRadiantEnv();
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
        @keyframes prune-fade {
          0% { opacity: 0; transform: scale(0.85); }
          14% { opacity: 1; transform: scale(1.02); }
          80% { opacity: 0.85; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92); }
        }
        @keyframes apex-breath {
          0%, 100% { opacity: 0.92; }
          50% { opacity: 1; box-shadow: 0 0 12px rgba(244, 63, 94, 0.65); }
        }
        @keyframes apex-conf-breath {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.18); }
        }
        @keyframes widget-spawn {
          0%   { opacity: 0; transform: scale(0.55); filter: blur(6px); }
          55%  { opacity: 1; }
          100% { opacity: 1; transform: scale(1);    filter: blur(0); }
        }
        @keyframes ingest-card {
          0%   { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-radiant-apex] { animation: none !important; }
        }
      `}</style>

      <Canvas
        dpr={env.mobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 24, 145], fov: 55, near: 0.1, far: 380 }}
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
        whiteSpace: 'nowrap',
      }}>
        {env.mobile
          ? 'Drag · pinch to zoom · ψ-projection live'
          : 'Hover a widget · drag to rotate · scroll to zoom · ψ-projection live'}
      </div>
    </div>
  );
};
