/**
 * PulseRadiant — radiant computer-vision visualization of how PULSE
 * thinks: data being detected, classified, organized, and compiled
 * into decisions at the bright center.
 *
 * 2026-05-01 (v3) · Per Nick:
 *   1. Larger widgets, drifting in 3D (no longer static)
 *   2. No auto-rotation (camera stays still; user can drag)
 *   3. Radiant shape (concentric spherical shells, NOT a tree)
 *   4. Computer-vision style — tracker brackets, confidence scores,
 *      scan reticle, detection callouts that "lock onto" widgets
 *   5. Dimmer glow — bloom dialed way back (was blinding)
 *   6. Live data flow — new data appears at the periphery with
 *      "+ ADDED" callout, drifts inward to its category shell,
 *      occasional "RECLASSIFIED" / "COMPILED" events
 *
 * Architecture:
 *
 *                       ····  outer shell (30 raw inputs) ····
 *                  ··                                        ··
 *               ·    ··    inner shell (12 patterns)    ··    ·
 *             ·   ·        ·· (6 scenarios) ··               ·  ·
 *           ·   ·     ·    [ DECISIONS · 3 ]    ·     ·       ·  ·
 *           ·   ·     ·    bright center        ·     ·       ·  ·
 *             ·   ·                                       ·    ·
 *                ·   ··                              ··  ·
 *                  ··                                        ··
 *                       ····      pulses flow IN      ····
 *
 * All shells centered on origin. Decision widgets tight at center;
 * inputs widely scattered on outer surface. Each widget drifts
 * around its home position via per-widget sine offsets so the whole
 * thing breathes.
 *
 * Pulses travel INWARD (data → decisions). CV brackets snap onto
 * one widget at a time, hold ~2.5s, jump to another. Periodic
 * "+ ADDED · 0.87" callouts at the periphery. Periodic "COMPILED"
 * ring at center.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { COLORS, FONTS, SPACE, RADIUS } from './design';

// ──────────────────────────────────────────────────────────────────
// Widget catalog
// ──────────────────────────────────────────────────────────────────

type Layer = 1 | 2 | 3 | 4;
type Tone = 'muted' | 'info' | 'warn' | 'accent';

interface Widget {
  id: number;
  layer: Layer;
  label: string;
  value?: string;
  tone: Tone;
}

// LAYER 1 — RAW INPUTS (the wide outer shell, 30 widgets)
const LAYER_1: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'I-95 traffic',          value: '+18m', tone: 'warn' },
  { label: 'Weather',               value: '54°F · rain', tone: 'muted' },
  { label: 'Wind speed',            value: '22 kt',  tone: 'warn' },
  { label: 'Time of day',           value: '14:22', tone: 'muted' },
  { label: 'Day of week',           value: 'Wed',  tone: 'muted' },
  { label: 'Season',                value: 'Spring', tone: 'muted' },
  { label: 'Holiday calendar',      value: '—',    tone: 'muted' },
  { label: 'Public events',         value: 'Concert · 18:00', tone: 'warn' },
  { label: 'School schedule',       value: 'In session', tone: 'muted' },
  { label: '911 call volume',       value: '+24%', tone: 'warn' },
  { label: '911 call types',        value: '34% MVC', tone: 'warn' },
  { label: 'Police dispatch',       value: '12 active', tone: 'muted' },
  { label: 'Fire dispatch',         value: '3 active',  tone: 'muted' },
  { label: 'Ambulance fleet',       value: '6 / 9',   tone: 'warn' },
  { label: 'Highway crashes',       value: '2 reported', tone: 'warn' },
  { label: 'Air quality index',     value: '92',  tone: 'muted' },
  { label: 'Pollen count',          value: 'High', tone: 'muted' },
  { label: 'Flu surveillance',      value: 'Rising', tone: 'warn' },
  { label: 'Pharmacy supply',       value: 'Nominal', tone: 'muted' },
  { label: 'Blood bank',            value: 'O- · 4u', tone: 'warn' },
  { label: 'OR schedule',           value: '7 elective', tone: 'info' },
  { label: 'Lab turnaround',        value: '38m avg', tone: 'muted' },
  { label: 'Imaging queue',         value: '5 waiting', tone: 'info' },
  { label: 'Discharge queue',       value: '12 ready', tone: 'info' },
  { label: 'ICU beds',              value: '1 / 12',  tone: 'warn' },
  { label: 'ED waiting room',       value: '34 patients', tone: 'warn' },
  { label: 'Triage acuity',         value: '6 ESI-2', tone: 'warn' },
  { label: 'RN staffing',           value: '1:4.2',  tone: 'info' },
  { label: 'Insurance auth',        value: '17 pending', tone: 'muted' },
  { label: 'Prior pattern match',   value: '94% sim', tone: 'info' },
];

// LAYER 2 — PATTERNS / RISK SIGNALS (12 widgets)
const LAYER_2: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Boarding pressure',   value: '18 admitted', tone: 'warn' },
  { label: 'EMS offload risk',    value: '30m avg', tone: 'warn' },
  { label: 'Staffing gap (RN)',   value: '−2 FTE', tone: 'warn' },
  { label: 'Bed turnover',        value: '38m avg', tone: 'info' },
  { label: 'Surge probability',   value: '64% · 4h', tone: 'warn' },
  { label: 'Trauma likelihood',   value: '+38%',  tone: 'warn' },
  { label: 'ICU saturation',      value: '92% by 16:00', tone: 'warn' },
  { label: 'ED wait forecast',    value: '+22m',  tone: 'warn' },
  { label: 'Discharge throughput', value: '−18%',  tone: 'info' },
  { label: 'Float pool',          value: '2 RN warm', tone: 'info' },
  { label: 'Regional divert',     value: '2 of 4',  tone: 'warn' },
  { label: 'Resource bottleneck', value: 'CT-1',   tone: 'warn' },
];

// LAYER 3 — SCENARIOS (6 widgets)
const LAYER_3: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Baseline projection',  value: 'NEDOCS 124', tone: 'info' },
  { label: 'Mild surge',          value: 'NEDOCS 142', tone: 'warn' },
  { label: 'Moderate surge',      value: 'NEDOCS 168', tone: 'warn' },
  { label: 'Mass casualty',       value: 'NEDOCS 184', tone: 'accent' },
  { label: 'Regional divert',     value: '4 hospitals', tone: 'warn' },
  { label: 'Recovery curve',      value: '−40m by 18:00', tone: 'info' },
];

// LAYER 4 — DECISIONS at center (3 widgets)
const LAYER_4: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Pre-stage float',     value: '2 RN · 20m warm', tone: 'accent' },
  { label: 'Activate surge',      value: 'Tier 2 · ready',  tone: 'accent' },
  { label: 'Post divert',         value: 'Regional grid',   tone: 'accent' },
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
// Layout — concentric spherical shells (Fibonacci-sphere distribution)
// ──────────────────────────────────────────────────────────────────

interface PreparedWidget extends Widget {
  homePosition: THREE.Vector3;
  /** Per-widget drift parameters so each one floats on its own rhythm */
  driftPhase: number;
  driftSpeed: number;
  driftAmp: number;
}

const SHELL_RADIUS: Record<Layer, number> = {
  4: 1.6,   // tight cluster at center for the 3 decisions
  3: 5.5,   // scenarios
  2: 9.5,   // patterns
  1: 14.5,  // wide outer shell of raw inputs
};

// Distribute N points uniformly on a sphere via Fibonacci spiral.
const fibonacciSphere = (n: number, radius: number): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }
  return points;
};

const layoutWidgets = (widgets: Widget[]): PreparedWidget[] => {
  const byLayer = new Map<Layer, Widget[]>([[1, []], [2, []], [3, []], [4, []]]);
  widgets.forEach((w) => byLayer.get(w.layer)!.push(w));

  const out: PreparedWidget[] = [];
  byLayer.forEach((items, layer) => {
    const positions = fibonacciSphere(items.length, SHELL_RADIUS[layer]);
    items.forEach((w, i) => {
      out.push({
        ...w,
        homePosition: positions[i],
        driftPhase: (i + layer * 3.7) * 0.7,
        driftSpeed: 0.18 + Math.random() * 0.18,
        driftAmp: layer === 4 ? 0.12 : 0.5,
      });
    });
  });
  return out;
};

// ──────────────────────────────────────────────────────────────────
// Edges — fan IN: each outer-shell widget connects to k nearest in
// the next shell down. Pulses travel from outer to center.
// ──────────────────────────────────────────────────────────────────

interface Edge {
  from: number;
  to: number;
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
        edges.push({ from: from.id, to: sorted[j].to.id });
      }
    });
  };

  connect(1, 2, 2);
  connect(2, 3, 2);
  connect(3, 4, 2);

  return edges;
};

// ──────────────────────────────────────────────────────────────────
// Drift helper — small spherical perturbation around home
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
// Widget HTML card — larger, animatable
// ──────────────────────────────────────────────────────────────────

const toneColor = (tone: Tone): string => {
  switch (tone) {
    case 'accent':
      return COLORS.accent;
    case 'warn':
      return COLORS.warn;
    case 'info':
      return COLORS.info;
    case 'muted':
    default:
      return COLORS.textMuted;
  }
};

interface WidgetCardProps {
  widget: PreparedWidget;
  /** True when the CV tracker has locked onto this widget */
  tracked?: boolean;
  /** Pseudo-confidence score shown when tracked */
  trackedConf?: number;
  /** Brief flash for "added" / "reclassified" events */
  flash?: 'added' | 'reclassified' | null;
}

const widgetWidth = (layer: Layer): number => {
  switch (layer) {
    case 4: return 220;
    case 3: return 200;
    case 2: return 180;
    case 1:
    default: return 170;
  }
};

const labelFontSize = (layer: Layer): number => {
  switch (layer) {
    case 4: return 12;
    case 3: return 11;
    case 2: return 11;
    case 1:
    default: return 10;
  }
};

const valueFontSize = (layer: Layer): number => {
  switch (layer) {
    case 4: return 18;
    case 3: return 15;
    case 2: return 14;
    case 1:
    default: return 13;
  }
};

const WidgetCard: React.FC<WidgetCardProps> = ({ widget, tracked, trackedConf, flash }) => {
  const dotColor = toneColor(widget.tone);
  const isAccent = widget.tone === 'accent';
  const w = widgetWidth(widget.layer);
  const borderColor = tracked
    ? COLORS.accent
    : isAccent
    ? COLORS.accent
    : widget.layer >= 3
    ? COLORS.borderStrong
    : COLORS.border;

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        background: COLORS.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        fontFamily: FONTS.mono,
        boxShadow: tracked
          ? `0 0 18px rgba(225, 29, 72, 0.30)`
          : `0 4px 14px rgba(0, 0, 0, 0.5)`,
        userSelect: 'none',
        pointerEvents: 'none',
        transition: 'border-color 240ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 240ms cubic-bezier(0.23, 1, 0.32, 1)',
      }}
    >
      {/* CV tracker brackets — appear when this widget is locked */}
      {tracked && (
        <>
          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
            const isTop = corner.startsWith('t');
            const isLeft = corner.endsWith('l');
            return (
              <span
                key={corner}
                aria-hidden
                style={{
                  position: 'absolute',
                  width: 9,
                  height: 9,
                  [isTop ? 'top' : 'bottom']: -4,
                  [isLeft ? 'left' : 'right']: -4,
                  borderTop: isTop ? `1.5px solid ${COLORS.accent}` : undefined,
                  borderBottom: !isTop ? `1.5px solid ${COLORS.accent}` : undefined,
                  borderLeft: isLeft ? `1.5px solid ${COLORS.accent}` : undefined,
                  borderRight: !isLeft ? `1.5px solid ${COLORS.accent}` : undefined,
                  pointerEvents: 'none',
                }}
              />
            );
          })}
          {/* Confidence label */}
          {trackedConf != null && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: -16,
                right: -4,
                fontFamily: FONTS.mono,
                fontSize: 9,
                letterSpacing: '0.18em',
                color: COLORS.accent,
                whiteSpace: 'nowrap',
                textShadow: `0 0 4px ${COLORS.bg}`,
              }}
            >
              · {trackedConf.toFixed(2)} CONF
            </span>
          )}
        </>
      )}

      {/* "+ ADDED" / "RECLASSIFIED" flash callout */}
      {flash && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -16,
            left: 0,
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: flash === 'added' ? COLORS.ok : COLORS.warn,
            whiteSpace: 'nowrap',
            textShadow: `0 0 4px ${COLORS.bg}`,
            animation: 'cv-flash-fade 1500ms ease-out forwards',
          }}
        >
          {flash === 'added' ? '+ ADDED · INGEST' : '↻ RECLASSIFIED'}
        </span>
      )}

      {/* Top row — dot + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: widget.value ? 6 : 0,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: labelFontSize(widget.layer),
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: COLORS.textPrimary,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
          title={widget.label}
        >
          {widget.label}
        </span>
      </div>

      {/* Value row */}
      {widget.value && (
        <div
          style={{
            fontSize: valueFontSize(widget.layer),
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: isAccent ? COLORS.accentBright : COLORS.textPrimary,
            fontVariantNumeric: 'tabular-nums',
            paddingLeft: 14,
            lineHeight: 1.15,
          }}
        >
          {widget.value}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────
// Edge renderer — single LineSegments, dim shimmer
// ──────────────────────────────────────────────────────────────────

const EdgeLines: React.FC<{ widgets: PreparedWidget[]; edges: Edge[] }> = ({ widgets, edges }) => {
  const meshRef = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(edges.length * 6), [edges]);
  const colors = useMemo(() => new Float32Array(edges.length * 6), [edges]);

  // Initial colors — dim
  useEffect(() => {
    edges.forEach((_, i) => {
      const c = 0.16;
      colors[i * 6] = c * 0.95;
      colors[i * 6 + 1] = c * 0.30;
      colors[i * 6 + 2] = c * 0.42;
      colors[i * 6 + 3] = colors[i * 6];
      colors[i * 6 + 4] = colors[i * 6 + 1];
      colors[i * 6 + 5] = colors[i * 6 + 2];
    });
  }, [edges, colors]);

  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    edges.forEach((e, i) => {
      const wa = widgets[e.from];
      const wb = widgets[e.to];
      driftPosition(tmpA, wa.homePosition, t, wa.driftPhase, wa.driftSpeed, wa.driftAmp);
      driftPosition(tmpB, wb.homePosition, t, wb.driftPhase, wb.driftSpeed, wb.driftAmp);
      positions[i * 6] = tmpA.x;
      positions[i * 6 + 1] = tmpA.y;
      positions[i * 6 + 2] = tmpA.z;
      positions[i * 6 + 3] = tmpB.x;
      positions[i * 6 + 4] = tmpB.y;
      positions[i * 6 + 5] = tmpB.z;
    });
    const posAttr = meshRef.current.geometry.attributes.position;
    (posAttr.array as Float32Array).set(positions);
    posAttr.needsUpdate = true;
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
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </lineSegments>
  );
};

// ──────────────────────────────────────────────────────────────────
// Inward pulse travelers — small + dim (was blinding)
// ──────────────────────────────────────────────────────────────────

interface PulseTraveler {
  edgeIdx: number;
  startedAt: number;
  duration: number;
  /** True if pulse should travel from outer→inner (most do); false reverses */
  inward: boolean;
  color: THREE.Color;
}

const InwardPulses: React.FC<{ widgets: PreparedWidget[]; edges: Edge[] }> = ({
  widgets,
  edges,
}) => {
  const pulsesRef = useRef<PulseTraveler[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const MAX_PULSES = 18;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorBuf = useMemo(() => new THREE.Color(), []);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pulsesRef.current.length >= MAX_PULSES) return;
      const edgeIdx = Math.floor(Math.random() * edges.length);
      const isAccent = Math.random() < 0.30;
      const color = isAccent
        ? new THREE.Color(COLORS.accent)
        : new THREE.Color('#A88858');
      pulsesRef.current.push({
        edgeIdx,
        startedAt: performance.now(),
        duration: 1500 + Math.random() * 800,
        inward: true,
        color,
      });
    }, 360);
    return () => window.clearInterval(id);
  }, [edges]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const now = performance.now();
    const t = clock.getElapsedTime();
    pulsesRef.current = pulsesRef.current.filter((p) => now - p.startedAt < p.duration);

    for (let i = 0; i < MAX_PULSES; i++) {
      const p = pulsesRef.current[i];
      if (!p) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const edge = edges[p.edgeIdx];
      const fromW = widgets[edge.from];
      const toW = widgets[edge.to];
      // Inward = travel from higher layer (outer) to lower layer (inner)
      const outer = fromW.layer < toW.layer ? fromW : toW;
      const inner = fromW.layer < toW.layer ? toW : fromW;
      driftPosition(tmpA, outer.homePosition, t, outer.driftPhase, outer.driftSpeed, outer.driftAmp);
      driftPosition(tmpB, inner.homePosition, t, inner.driftPhase, inner.driftSpeed, inner.driftAmp);

      const tt = Math.min(1, (now - p.startedAt) / p.duration);
      const pos = tmpA.clone().lerp(tmpB, tt);
      dummy.position.copy(pos);

      const env = Math.sin(tt * Math.PI);
      // Smaller + dimmer than v2 — was blinding
      dummy.scale.setScalar(0.04 + env * 0.06);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorBuf.copy(p.color).multiplyScalar(env * 0.85);
      meshRef.current.setColorAt(i, colorBuf);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PULSES]}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

// ──────────────────────────────────────────────────────────────────
// Compile burst — concentric ring expanding from center every ~9s
// ──────────────────────────────────────────────────────────────────

const CompileBurst: React.FC = () => {
  const ringRef = useRef<THREE.Mesh>(null);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      startRef.current = performance.now();
    }, 9_000);
    return () => window.clearInterval(id);
  }, []);

  useFrame(() => {
    if (!ringRef.current) return;
    const elapsed = performance.now() - startRef.current;
    const duration = 1800;
    const tt = Math.min(1, elapsed / duration);
    const radius = 0.5 + tt * 14;
    const opacity = elapsed > duration ? 0 : (1 - tt) * 0.35;
    ringRef.current.scale.setScalar(radius);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  });

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.95, 1, 64]} />
      <meshBasicMaterial
        color={COLORS.accent}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

// ──────────────────────────────────────────────────────────────────
// Center reticle — subtle CV crosshair fixed at origin
// ──────────────────────────────────────────────────────────────────

const CenterReticle: React.FC = () => {
  return (
    <Html position={[0, 0, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
      <div
        style={{
          position: 'relative',
          width: 80,
          height: 80,
          opacity: 0.55,
        }}
      >
        {/* Outer brackets */}
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => {
          const isTop = c.startsWith('t');
          const isLeft = c.endsWith('l');
          return (
            <span
              key={c}
              style={{
                position: 'absolute',
                width: 14,
                height: 14,
                [isTop ? 'top' : 'bottom']: 0,
                [isLeft ? 'left' : 'right']: 0,
                borderTop: isTop ? `1px solid ${COLORS.accent}` : undefined,
                borderBottom: !isTop ? `1px solid ${COLORS.accent}` : undefined,
                borderLeft: isLeft ? `1px solid ${COLORS.accent}` : undefined,
                borderRight: !isLeft ? `1px solid ${COLORS.accent}` : undefined,
              }}
            />
          );
        })}
        {/* Inner crosshair */}
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: 30,
            right: 30,
            height: 1,
            background: COLORS.accent,
            opacity: 0.6,
          }}
        />
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: 30,
            bottom: 30,
            width: 1,
            background: COLORS.accent,
            opacity: 0.6,
          }}
        />
        {/* Center dot */}
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 3,
            height: 3,
            background: COLORS.accent,
            borderRadius: '50%',
          }}
        />
      </div>
    </Html>
  );
};

// ──────────────────────────────────────────────────────────────────
// Driftable widget group — wraps each widget in a <group> whose
// position updates per-frame so the Html overlay follows.
// ──────────────────────────────────────────────────────────────────

const DriftWidget: React.FC<{
  widget: PreparedWidget;
  tracked: boolean;
  trackedConf?: number;
  flash: 'added' | 'reclassified' | null;
}> = ({ widget, tracked, trackedConf, flash }) => {
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
      <Html center distanceFactor={14} style={{ pointerEvents: 'none' }} zIndexRange={[80, 10]} occlude={false}>
        <WidgetCard widget={widget} tracked={tracked} trackedConf={trackedConf} flash={flash} />
      </Html>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Scene composition + state for tracker / flashes
// ──────────────────────────────────────────────────────────────────

const Scene: React.FC = () => {
  const { widgets, edges } = useMemo(() => {
    const cat = buildCatalog();
    const positioned = layoutWidgets(cat);
    const e = buildEdges(positioned);
    return { widgets: positioned, edges: e };
  }, []);

  // CV tracker state — which widget is locked, and confidence value
  const [trackedId, setTrackedId] = useState<number>(0);
  const [trackedConf, setTrackedConf] = useState<number>(0.91);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = Math.floor(Math.random() * widgets.length);
      setTrackedId(next);
      setTrackedConf(0.78 + Math.random() * 0.20);
    }, 2400);
    return () => window.clearInterval(id);
  }, [widgets.length]);

  // Flash events — periodically tag a widget as ADDED or RECLASSIFIED
  const [flashId, setFlashId] = useState<number | null>(null);
  const [flashType, setFlashType] = useState<'added' | 'reclassified' | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = Math.floor(Math.random() * widgets.length);
      const type: 'added' | 'reclassified' = Math.random() < 0.55 ? 'added' : 'reclassified';
      setFlashId(next);
      setFlashType(type);
      window.setTimeout(() => {
        setFlashId(null);
        setFlashType(null);
      }, 1500);
    }, 3200);
    return () => window.clearInterval(id);
  }, [widgets.length]);

  return (
    <>
      <color attach="background" args={[COLORS.bg]} />
      <EdgeLines widgets={widgets} edges={edges} />
      <InwardPulses widgets={widgets} edges={edges} />
      <CompileBurst />
      <CenterReticle />

      {widgets.map((w) => (
        <DriftWidget
          key={w.id}
          widget={w}
          tracked={trackedId === w.id}
          trackedConf={trackedId === w.id ? trackedConf : undefined}
          flash={flashId === w.id ? flashType : null}
        />
      ))}

      {/* Camera controls — rotation OFF per Nick. User can still grab. */}
      <OrbitControls
        enablePan={false}
        autoRotate={false}
        enableDamping
        dampingFactor={0.09}
        minDistance={14}
        maxDistance={48}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.72}
        target={[0, 0, 0]}
        makeDefault
      />

      {/* Glow dialed way back — was blinding */}
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
      {/* Floor glow — same pattern as the rest of PULSE */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 65% 40% at 50% 110%, ${COLORS.accentDim}, transparent 60%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Faint dot grid */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          opacity: 0.18,
          maskImage:
            'radial-gradient(ellipse 75% 60% at center, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 60% at center, black 30%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* CSS keyframes for the flash callouts */}
      <style>{`
        @keyframes cv-flash-fade {
          0%   { opacity: 0; transform: translateY(-2px); }
          15%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 28], fov: 50, near: 0.1, far: 200 }}
        style={{ background: 'transparent', position: 'relative', zIndex: 1 }}
      >
        <Scene />
      </Canvas>

      {/* Drag hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          color: COLORS.textMuted,
          opacity: 0.6,
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        Drag to look · Scroll to zoom
      </div>
    </div>
  );
};
