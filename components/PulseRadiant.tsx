/**
 * PulseRadiant — 3D force-directed network graph rendered as a glowing
 * constellation of connected nodes suspended in dark space.
 *
 * 2026-05-01 · Inspiration: Foundation's Prime Radiant device. A handheld
 * projector blooms a luminous cloud of mathematical relationships —
 * glowing particles, faint connecting threads, slow drift, warm amber-
 * gold light against deep navy/black.
 *
 * Treats PULSE's reasoning as something you LOOK INTO rather than READ.
 * The cluster represents the entities PULSE thinks about (patients,
 * beds, EMS, alerts, scenarios, forecasts, interventions) and the
 * relationships between them. Hubs are units; leaves are decisions.
 *
 * Data is synthesized — believable but not live. The point is the FEEL.
 *
 * Stack:
 *   • three.js + @react-three/fiber for scene graph
 *   • @react-three/drei for OrbitControls, instanced primitives
 *   • @react-three/postprocessing for the Bloom glow
 *
 * Visual properties (per the brief):
 *   • Dark background, deep navy → black radial gradient
 *   • Nodes glow via additive blending (soft falloff, not solid spheres)
 *   • Most nodes warm amber-gold; minority rose-accent (PULSE brand
 *     marker for predictive entities)
 *   • Edge brightness decays with distance between connected nodes
 *   • Faint starfield background drifting opposite to main rotation
 *   • Hub nodes naturally appear brighter (more incident light + more
 *     edges meeting there)
 *
 * Motion:
 *   • Slow continuous auto-rotate
 *   • Each node pulses at its own slow rhythm — cluster breathes
 *   • Edges shimmer faintly
 *   • User can grab + rotate; auto-rotate continues underneath
 *   • Periodic bright "thought" pulses travel along random edges,
 *     simulating decision propagation
 *
 * Layout: pre-computed once via lightweight relaxation iterations.
 * Not a real-time force simulation (per the brief — that's heavier).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// ──────────────────────────────────────────────────────────────────
// Palette
// ──────────────────────────────────────────────────────────────────
const PALETTE = {
  // Main amber-gold — the warm "thought" color
  amber: new THREE.Color('#F5B85B'),
  amberDim: new THREE.Color('#8B7340'),
  amberBright: new THREE.Color('#FFD688'),
  // Rose accent — PULSE brand, used for predictive/decision nodes
  rose: new THREE.Color('#F43F5E'),
  roseBright: new THREE.Color('#FF6680'),
  // Edge color — neutral warm
  edge: new THREE.Color('#6B5230'),
  edgeBright: new THREE.Color('#D4A05A'),
  // Background star color
  star: new THREE.Color('#A89B7A'),
  // Bg
  bg: new THREE.Color('#040206'),
};

// ──────────────────────────────────────────────────────────────────
// PULSE entity catalog — the things the cluster represents
// ──────────────────────────────────────────────────────────────────
type Category =
  | 'patient'   // amber, leaves
  | 'bed'       // amber
  | 'ems'       // amber
  | 'staff'     // amber
  | 'alert'     // amber
  | 'forecast'  // rose accent
  | 'scenario'  // rose accent
  | 'risk'      // rose accent
  | 'unit';     // hub — many connections, brighter

interface NodeDef {
  id: number;
  category: Category;
  label: string;
  /** "Importance" — higher = larger + brighter */
  weight: number;
}

interface PreparedNode extends NodeDef {
  position: THREE.Vector3;
  /** Per-node pulse phase (0..2π) so they breathe at different rhythms */
  phase: number;
  /** Per-node pulse speed (slight variance) */
  pulseSpeed: number;
}

interface Edge {
  from: number;
  to: number;
  /** Cached length — computed after layout */
  len: number;
}

const UNIT_LABELS = ['ED Trauma', 'ED Acute', 'ED Fast', 'ICU', 'Stepdown', 'MS-2W', 'MS-3E', 'OR'];
const PATIENT_NAMES = [
  'Donovan', 'Lopez', 'Wright', 'Torres', 'Sellers', 'Hernandez', 'Lin', 'Flores',
  'Garcia', 'Jensen', 'Martinez', 'Tariq', 'Brooks', 'Park', 'Singh', 'Davis',
  'Kim', 'Reeves', 'Nguyen', 'Adams', 'Foster', 'Wilson', 'Chen', 'Patel',
  'Sato', 'Rivera', 'Espinoza', 'Nguyen-T', 'Watts', 'Robinson', 'Walsh', 'Fitzgerald',
];
const STAFF_NAMES = [
  'N. Chen', 'R. Patel', 'S. Lee', 'J. Kim', 'M. Davis', 'T. Reeves', 'A. Torres', 'L. Brown',
  'K. Foster', 'R. Gomez', 'P. Walsh', 'D. Miller', 'H. Park', 'V. Singh', 'C. Adams', 'B. Wells',
];
const SCENARIO_LABELS = ['MCI ramp', 'Surge S2', 'Mass-cas peak', 'EMS divert', 'Float pool warm'];
const RISK_LABELS = ['Boarding', 'Offload', 'Staff gap', 'Bed turn', 'OR backlog', 'Trauma activation'];

// Build the catalog — 120-ish entities
const buildCatalog = (): NodeDef[] => {
  const nodes: NodeDef[] = [];
  let id = 0;

  // Hubs (8) — units, high weight
  UNIT_LABELS.forEach((label) => {
    nodes.push({ id: id++, category: 'unit', label, weight: 1.7 });
  });

  // Beds (24)
  for (let i = 0; i < 24; i++) {
    const unit = UNIT_LABELS[i % UNIT_LABELS.length];
    nodes.push({ id: id++, category: 'bed', label: `${unit} · ${i + 1}`, weight: 0.6 });
  }

  // Patients (32)
  for (let i = 0; i < 32; i++) {
    nodes.push({
      id: id++,
      category: 'patient',
      label: PATIENT_NAMES[i % PATIENT_NAMES.length],
      weight: 0.5 + Math.random() * 0.35,
    });
  }

  // EMS runs (8)
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: id++,
      category: 'ems',
      label: `Medic ${10 + i}`,
      weight: 0.7,
    });
  }

  // Staff (16)
  for (let i = 0; i < 16; i++) {
    nodes.push({
      id: id++,
      category: 'staff',
      label: STAFF_NAMES[i % STAFF_NAMES.length],
      weight: 0.55,
    });
  }

  // Alerts (12)
  for (let i = 0; i < 12; i++) {
    nodes.push({
      id: id++,
      category: 'alert',
      label: `Alert ${i + 1}`,
      weight: 0.4,
    });
  }

  // Forecast nodes (6) — rose accent, predictive
  for (let i = 0; i < 6; i++) {
    nodes.push({
      id: id++,
      category: 'forecast',
      label: `Forecast +${(i + 1) * 30}m`,
      weight: 1.1,
    });
  }

  // Scenarios (5) — rose accent
  SCENARIO_LABELS.forEach((label) => {
    nodes.push({ id: id++, category: 'scenario', label, weight: 1.0 });
  });

  // Risks (6) — rose accent
  RISK_LABELS.forEach((label) => {
    nodes.push({ id: id++, category: 'risk', label, weight: 0.85 });
  });

  return nodes;
};

// Build edges — categorical relationships
const buildEdges = (nodes: NodeDef[]): Edge[] => {
  const edges: Edge[] = [];
  const byCat = new Map<Category, NodeDef[]>();
  nodes.forEach((n) => {
    if (!byCat.has(n.category)) byCat.set(n.category, []);
    byCat.get(n.category)!.push(n);
  });

  const units = byCat.get('unit') ?? [];
  const beds = byCat.get('bed') ?? [];
  const patients = byCat.get('patient') ?? [];
  const ems = byCat.get('ems') ?? [];
  const staff = byCat.get('staff') ?? [];
  const alerts = byCat.get('alert') ?? [];
  const forecasts = byCat.get('forecast') ?? [];
  const scenarios = byCat.get('scenario') ?? [];
  const risks = byCat.get('risk') ?? [];

  const link = (a: NodeDef, b: NodeDef) => {
    edges.push({ from: a.id, to: b.id, len: 1 });
  };

  // Each bed → its unit
  beds.forEach((b, i) => link(b, units[i % units.length]));
  // Each patient → a bed (most) or unit (some)
  patients.forEach((p, i) => {
    if (i < beds.length) link(p, beds[i]);
    else link(p, units[i % units.length]);
  });
  // Each EMS → a unit (typically ED-Trauma) and a forecast
  ems.forEach((e, i) => {
    link(e, units[0]); // ED Trauma
    if (forecasts[i % forecasts.length]) link(e, forecasts[i % forecasts.length]);
  });
  // Each staff → a unit + 1-2 patients
  staff.forEach((s, i) => {
    link(s, units[i % units.length]);
    if (patients[i * 2 % patients.length]) link(s, patients[i * 2 % patients.length]);
    if (patients[(i * 2 + 1) % patients.length]) link(s, patients[(i * 2 + 1) % patients.length]);
  });
  // Alerts → patients or units
  alerts.forEach((a, i) => {
    if (i % 2 === 0 && patients[i % patients.length]) link(a, patients[i % patients.length]);
    else link(a, units[i % units.length]);
  });
  // Forecasts → all units (forecasts span the hospital)
  forecasts.forEach((f) => {
    units.forEach((u, i) => {
      if (i % 2 === 0) link(f, u);
    });
  });
  // Scenarios → forecasts + risks
  scenarios.forEach((s, i) => {
    if (forecasts[i % forecasts.length]) link(s, forecasts[i % forecasts.length]);
    if (risks[i % risks.length]) link(s, risks[i % risks.length]);
    if (risks[(i + 1) % risks.length]) link(s, risks[(i + 1) % risks.length]);
  });
  // Risks → relevant units
  risks.forEach((r, i) => {
    link(r, units[i % units.length]);
    link(r, units[(i + 2) % units.length]);
  });

  return edges;
};

// ──────────────────────────────────────────────────────────────────
// Layout — pre-computed via N iterations of simple relaxation
// ──────────────────────────────────────────────────────────────────
const SPHERE_RADIUS = 8;

const layoutNodes = (nodes: NodeDef[], edges: Edge[]): PreparedNode[] => {
  // Seeded pseudo-random for deterministic init
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Initialize random positions in a sphere
  const positions: THREE.Vector3[] = nodes.map(() => {
    const r = SPHERE_RADIUS * Math.cbrt(rand());
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    );
  });

  // Adjacency list for fast lookups
  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e) => {
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  });

  // Relaxation: weak repulsion + edge-spring + center pull
  const ITERATIONS = 80;
  const REPULSION = 0.4;
  const SPRING = 0.18;
  const SPRING_REST = 1.6;
  const CENTER_PULL = 0.012;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = positions.map(() => new THREE.Vector3());

    // Repulsion (sampled — every node vs every 3rd to keep cost down)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j += 3) {
        const delta = positions[i].clone().sub(positions[j]);
        const dist = Math.max(0.1, delta.length());
        const force = REPULSION / (dist * dist);
        delta.normalize().multiplyScalar(force);
        forces[i].add(delta);
        forces[j].sub(delta);
      }
    }

    // Spring along edges
    for (const edge of edges) {
      const delta = positions[edge.to].clone().sub(positions[edge.from]);
      const dist = delta.length();
      const stretch = dist - SPRING_REST;
      const force = SPRING * stretch;
      delta.normalize().multiplyScalar(force);
      forces[edge.from].add(delta);
      forces[edge.to].sub(delta);
    }

    // Center pull
    for (let i = 0; i < positions.length; i++) {
      const center = positions[i].clone().multiplyScalar(-CENTER_PULL);
      forces[i].add(center);
    }

    // Apply forces (capped step)
    for (let i = 0; i < positions.length; i++) {
      const step = forces[i];
      const len = step.length();
      const cap = 0.5;
      if (len > cap) step.multiplyScalar(cap / len);
      positions[i].add(step);
    }
  }

  return nodes.map((n, i) => ({
    ...n,
    position: positions[i],
    phase: rand() * Math.PI * 2,
    pulseSpeed: 0.4 + rand() * 0.6,
  }));
};

// Compute final edge lengths after layout
const measureEdges = (edges: Edge[], nodes: PreparedNode[]): Edge[] =>
  edges.map((e) => ({
    ...e,
    len: nodes[e.from].position.distanceTo(nodes[e.to].position),
  }));

// ──────────────────────────────────────────────────────────────────
// Renderers
// ──────────────────────────────────────────────────────────────────

const Stars: React.FC = () => {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(900);
    for (let i = 0; i < 300; i++) {
      const r = 25 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      // Drift opposite to main rotation
      ref.current.rotation.y = -clock.getElapsedTime() * 0.018;
      ref.current.rotation.x = clock.getElapsedTime() * 0.008;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color={PALETTE.star}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

interface NodesProps {
  nodes: PreparedNode[];
}

const Nodes: React.FC<NodesProps> = ({ nodes }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorBuf = useMemo(() => new THREE.Color(), []);

  // Initialize colors + base scale per node
  useEffect(() => {
    if (!meshRef.current) return;
    nodes.forEach((node, i) => {
      dummy.position.copy(node.position);
      const baseScale = 0.08 + node.weight * 0.10;
      dummy.scale.setScalar(baseScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Category color — most amber, predictive in rose
      const isAccent =
        node.category === 'forecast' ||
        node.category === 'scenario' ||
        node.category === 'risk';
      const baseColor = isAccent ? PALETTE.rose : PALETTE.amber;
      meshRef.current!.setColorAt(i, baseColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, dummy]);

  // Per-frame: pulse each node by phase
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    nodes.forEach((node, i) => {
      dummy.position.copy(node.position);
      const baseScale = 0.08 + node.weight * 0.10;
      const pulse = 1 + Math.sin(t * node.pulseSpeed + node.phase) * 0.20;
      dummy.scale.setScalar(baseScale * pulse);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);

      // Subtle color brightness shimmer for accent nodes
      const isAccent =
        node.category === 'forecast' ||
        node.category === 'scenario' ||
        node.category === 'risk';
      if (isAccent) {
        const shimmer = 0.85 + Math.sin(t * 0.7 + node.phase * 1.7) * 0.15;
        colorBuf.copy(PALETTE.rose).multiplyScalar(shimmer);
        meshRef.current!.setColorAt(i, colorBuf);
      }
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshBasicMaterial
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

interface EdgesProps {
  nodes: PreparedNode[];
  edges: Edge[];
}

const Edges: React.FC<EdgesProps> = ({ nodes, edges }) => {
  // Build a single LineSegments geometry for performance
  const { geometry, baseColors } = useMemo(() => {
    const positions = new Float32Array(edges.length * 6);
    const colors = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      const a = nodes[e.from].position;
      const b = nodes[e.to].position;
      positions[i * 6] = a.x;
      positions[i * 6 + 1] = a.y;
      positions[i * 6 + 2] = a.z;
      positions[i * 6 + 3] = b.x;
      positions[i * 6 + 4] = b.y;
      positions[i * 6 + 5] = b.z;
      // Brightness inversely proportional to length
      const brightness = Math.max(0.12, Math.min(0.55, 1 / e.len));
      const color = PALETTE.edge.clone().multiplyScalar(brightness * 1.4);
      colors[i * 6] = color.r;
      colors[i * 6 + 1] = color.g;
      colors[i * 6 + 2] = color.b;
      colors[i * 6 + 3] = color.r;
      colors[i * 6 + 4] = color.g;
      colors[i * 6 + 5] = color.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return { geometry: g, baseColors: colors };
  }, [nodes, edges]);

  // Slow shimmer — modulate the color buffer over time
  const meshRef = useRef<THREE.LineSegments>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const colorAttr = meshRef.current.geometry.attributes.color;
    const arr = colorAttr.array as Float32Array;
    for (let i = 0; i < edges.length; i++) {
      const shimmer = 0.85 + Math.sin(t * 0.4 + i * 0.13) * 0.25;
      const baseR = baseColors[i * 6];
      const baseG = baseColors[i * 6 + 1];
      const baseB = baseColors[i * 6 + 2];
      arr[i * 6] = baseR * shimmer;
      arr[i * 6 + 1] = baseG * shimmer;
      arr[i * 6 + 2] = baseB * shimmer;
      arr[i * 6 + 3] = baseR * shimmer;
      arr[i * 6 + 4] = baseG * shimmer;
      arr[i * 6 + 5] = baseB * shimmer;
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={meshRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
};

// ──────────────────────────────────────────────────────────────────
// Decision pulses — bright travelers along edges
// ──────────────────────────────────────────────────────────────────
interface PulseTraveler {
  edgeIdx: number;
  startedAt: number;
  duration: number;
  color: THREE.Color;
}

const TRAVEL_DURATION_BASE = 1400;

const Pulses: React.FC<{ nodes: PreparedNode[]; edges: Edge[] }> = ({ nodes, edges }) => {
  const pulsesRef = useRef<PulseTraveler[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const MAX_PULSES = 12;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorBuf = useMemo(() => new THREE.Color(), []);

  // Spawn a new pulse every ~700ms
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pulsesRef.current.length >= MAX_PULSES) return;
      const edgeIdx = Math.floor(Math.random() * edges.length);
      const isAccent = Math.random() < 0.32;
      const color = isAccent ? PALETTE.roseBright.clone() : PALETTE.amberBright.clone();
      pulsesRef.current.push({
        edgeIdx,
        startedAt: performance.now(),
        duration: TRAVEL_DURATION_BASE + Math.random() * 600,
        color,
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [edges]);

  useFrame(() => {
    if (!meshRef.current) return;
    const now = performance.now();
    // Cull expired pulses
    pulsesRef.current = pulsesRef.current.filter((p) => now - p.startedAt < p.duration);

    // Render up to MAX_PULSES instances; hide the rest
    for (let i = 0; i < MAX_PULSES; i++) {
      const p = pulsesRef.current[i];
      if (!p) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const edge = edges[p.edgeIdx];
      const a = nodes[edge.from].position;
      const b = nodes[edge.to].position;
      const t = Math.min(1, (now - p.startedAt) / p.duration);
      const pos = a.clone().lerp(b, t);
      dummy.position.copy(pos);
      // Bright at midpoint, fade at ends
      const envelope = Math.sin(t * Math.PI);
      dummy.scale.setScalar(0.06 + envelope * 0.10);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorBuf.copy(p.color).multiplyScalar(envelope);
      meshRef.current.setColorAt(i, colorBuf);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PULSES]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

// ──────────────────────────────────────────────────────────────────
// Camera rig — slow auto-rotate, OrbitControls layered on top
// ──────────────────────────────────────────────────────────────────
const Rig: React.FC = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 4, 22);
  }, [camera]);
  return (
    <OrbitControls
      enablePan={false}
      autoRotate
      autoRotateSpeed={0.45}
      enableDamping
      dampingFactor={0.08}
      minDistance={10}
      maxDistance={45}
    />
  );
};

// ──────────────────────────────────────────────────────────────────
// Scene composition
// ──────────────────────────────────────────────────────────────────
const Scene: React.FC = () => {
  const { nodes, edges } = useMemo(() => {
    const catalog = buildCatalog();
    const rawEdges = buildEdges(catalog);
    const positioned = layoutNodes(catalog, rawEdges);
    const measured = measureEdges(rawEdges, positioned);
    return { nodes: positioned, edges: measured };
  }, []);

  return (
    <>
      <color attach="background" args={['#040206']} />
      <Stars />
      <Edges nodes={nodes} edges={edges} />
      <Nodes nodes={nodes} />
      <Pulses nodes={nodes} edges={edges} />
      <Rig />
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.05} luminanceSmoothing={0.7} mipmapBlur />
      </EffectComposer>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Public component — renders the canvas
// ──────────────────────────────────────────────────────────────────
export const PulseRadiant: React.FC<{ height?: number | string }> = ({ height = '100%' }) => {
  return (
    <div style={{ width: '100%', height, background: '#040206', position: 'relative' }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 4, 22], fov: 50, near: 0.1, far: 200 }}
        style={{ background: 'radial-gradient(ellipse 80% 70% at center, #0a0814 0%, #040206 60%, #000000 100%)' }}
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
          color: '#A89B7A',
          opacity: 0.7,
          fontFamily: 'ui-monospace, "Geist Mono", monospace',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}
      >
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
};
