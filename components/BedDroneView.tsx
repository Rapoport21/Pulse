/**
 * BedDroneView — high-fidelity 3D hospital floor plan.
 *
 * 2026-04-23 · Rewrite. Previous version was a flat plate with bed
 * blocks scattered on top — read more like a chart than a hospital.
 * This version is an actual floor plan: extruded outer walls, internal
 * partition walls dividing each ward into individual patient rooms,
 * door gaps facing onto a corridor spine, nursing stations, beds
 * placed head-against-wall, IV poles + monitors at occupied beds, and
 * a labeled ambulance bay at the south entrance.
 *
 * Layout (looking straight down, north up):
 *
 *                      ┌──────── ICU ────────┐
 *                      │ 6 glass-walled rooms │
 *                      └──────────────────────┘
 *                            (corridor)
 *   ┌─ MS 2W ─┐  ┌─ Stepdown ─┐  ┌─ MS 3E ─┐
 *   │ 10 rooms │  │  4 rooms  │  │ 10 rooms │
 *   └──────────┘  └────────────┘  └──────────┘
 *                          (main spine)
 *                      ┌─ Overflow C ─┐
 *                      │  surge only  │
 *                      └──────────────┘
 *                            (corridor)
 *   ┌─ Trauma ─┐  ┌─── ED Acute ───┐  ┌─ Fast Track ─┐
 *   │  3 bays  │  │     8 bays     │  │   4 bays     │
 *   └──────────┘  └────────────────┘  └──────────────┘
 *                  AMBULANCE  ·  SOUTH ENTRANCE
 *
 * Bed visuals encode state via emissive color on the headboard panel.
 * Critical (ESI-1) patients pulse red. Reserved beds breathe rose.
 * Camera arcs ±5° on a 30s loop; the radar sweep speeds up under
 * scenario severity. Inbound EMS arrive as glowing dots tracking
 * toward the ambulance bay.
 */

import React, { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BedUnit, Bed, BedState } from '../data/bedMock';
import type { ScenarioState } from '../lib/scenario';
import { useEmsInbound } from '../lib/emsLive';

// ──────────────────────────────────────────────────────────────────
// Materials & state visuals
// ──────────────────────────────────────────────────────────────────
const FLOOR_DARK = '#0a0a0a';
const FLOOR_CORRIDOR = '#141414';
const WALL_OUTER = '#1c1c1c';
const WALL_INNER = '#16110f';
const WALL_GLASS = '#1f3038';   // slight teal — ICU glass walls
const NURSE_DESK = '#221915';
const BED_BASE = '#161616';

// State → headboard / glow color
const BED_VISUAL: Record<BedState, { color: string; emissive: string; intensity: number }> = {
  ready:       { color: BED_BASE, emissive: '#19E3C2', intensity: 0.40 },
  occupied:    { color: BED_BASE, emissive: '#F5A623', intensity: 0.55 },
  dirty:       { color: BED_BASE, emissive: '#FF8A2E', intensity: 0.32 },
  not_staffed: { color: BED_BASE, emissive: '#FF6A00', intensity: 0.65 },
  blocked:     { color: BED_BASE, emissive: '#A02828', intensity: 0.32 },
  reserved:    { color: BED_BASE, emissive: '#E11D48', intensity: 0.70 },
};
const CRITICAL_VISUAL = { color: BED_BASE, emissive: '#FF3838', intensity: 0.95 };

// ──────────────────────────────────────────────────────────────────
// Floor-plan placement — each ward is a rectangle on the building plate
// ──────────────────────────────────────────────────────────────────
type Bounds = { x1: number; z1: number; x2: number; z2: number };
type WardPlan = {
  bounds: Bounds;
  /** Side of the rectangle that faces the corridor (door opening). */
  doorSide: 'N' | 'S' | 'E' | 'W';
  /** Number of rows × cols of patient rooms inside the ward. */
  rows: number;
  cols: number;
  /** Whether to render glass partition walls (ICU) vs solid (Med-Surg). */
  glass?: boolean;
  /** Open-bay style (curtains, no walls) — used for ED. */
  openBay?: boolean;
  /** Nursing station position relative to ward center. */
  nurseStation?: { x: number; z: number };
};

const WARD_PLAN: Record<string, WardPlan> = {
  // ED row — south of the building
  'ed-trauma': {
    bounds: { x1: -13, z1: 5.5, x2: -7.2, z2: 9.5 },
    doorSide: 'S', rows: 1, cols: 3, openBay: true,
    nurseStation: { x: -10, z: 5.9 },
  },
  'ed-acute': {
    bounds: { x1: -6.8, z1: 5.5, x2: 4.8, z2: 9.5 },
    doorSide: 'N', rows: 2, cols: 4, openBay: true,
    nurseStation: { x: 0, z: 7.5 },
  },
  'ed-ft': {
    bounds: { x1: 5.2, z1: 5.5, x2: 12.5, z2: 9.5 },
    doorSide: 'N', rows: 2, cols: 2, openBay: true,
    nurseStation: { x: 8.85, z: 6 },
  },
  // Mid spine — overflow + stepdown
  'overflow-c': {
    bounds: { x1: -3.5, z1: 2, x2: 3.5, z2: 4.5 },
    doorSide: 'S', rows: 1, cols: 4, openBay: true,
  },
  'stepdown': {
    bounds: { x1: -3.5, z1: -3, x2: 3.5, z2: 0 },
    doorSide: 'S', rows: 1, cols: 4,
    nurseStation: { x: 0, z: -1.5 },
  },
  // North row
  'ms-2w': {
    bounds: { x1: -13, z1: -3, x2: -4.5, z2: 0 },
    doorSide: 'E', rows: 2, cols: 5,
    nurseStation: { x: -4.9, z: -1.5 },
  },
  'ms-3e': {
    bounds: { x1: 4.5, z1: -3, x2: 13, z2: 0 },
    doorSide: 'W', rows: 2, cols: 5,
    nurseStation: { x: 4.9, z: -1.5 },
  },
  'icu': {
    bounds: { x1: -7, z1: -7.5, x2: 7, z2: -4 },
    doorSide: 'S', rows: 1, cols: 6, glass: true,
    nurseStation: { x: 0, z: -4.4 },
  },
};

// ──────────────────────────────────────────────────────────────────
// Wall — extruded box primitive
// ──────────────────────────────────────────────────────────────────
const Wall: React.FC<{
  x: number; z: number; len: number;
  axis: 'x' | 'z';
  height?: number;
  thickness?: number;
  color?: string;
  glass?: boolean;
}> = ({ x, z, len, axis, height = 1.4, thickness = 0.08, color = WALL_INNER, glass }) => (
  <mesh position={[x, height / 2, z]}>
    <boxGeometry args={axis === 'x' ? [len, height, thickness] : [thickness, height, len]} />
    <meshStandardMaterial
      color={glass ? WALL_GLASS : color}
      roughness={glass ? 0.2 : 0.7}
      metalness={glass ? 0.4 : 0.05}
      transparent={glass}
      opacity={glass ? 0.55 : 1}
    />
  </mesh>
);

// ──────────────────────────────────────────────────────────────────
// Bed — base + headboard + (when occupied) IV pole + monitor
// ──────────────────────────────────────────────────────────────────
const BedMesh: React.FC<{
  bed: Bed;
  x: number;
  z: number;
  rotationY: number;
}> = ({ bed, x, z, rotationY }) => {
  const isCritical = bed.state === 'occupied' && bed.acuity != null && bed.acuity <= 1;
  const isReserved = bed.state === 'reserved';
  const isOccupied = bed.state === 'occupied';
  const visual = isCritical ? CRITICAL_VISUAL : BED_VISUAL[bed.state];

  const headRef = useRef<THREE.MeshStandardMaterial>(null);
  const monitorRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!headRef.current) return;
    const t = clock.getElapsedTime();
    if (isCritical) {
      headRef.current.emissiveIntensity = visual.intensity + Math.sin(t * 4) * 0.4;
      if (monitorRef.current) {
        monitorRef.current.emissiveIntensity = 0.6 + Math.sin(t * 4) * 0.4;
      }
    } else if (isReserved) {
      headRef.current.emissiveIntensity = visual.intensity + Math.sin(t * 2.4) * 0.25;
    } else if (isOccupied) {
      // Subtle steady glow with slow breath
      headRef.current.emissiveIntensity = visual.intensity + Math.sin(t * 1.4 + x) * 0.05;
    }
  });

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {/* Mattress / base — long axis along local Z */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.42, 0.12, 0.85]} />
        <meshStandardMaterial color="#1f1f1f" roughness={0.6} />
      </mesh>
      {/* Sheet/blanket */}
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.40, 0.04, 0.83]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.85} />
      </mesh>
      {/* Headboard — emissive glow encodes state */}
      <mesh position={[0, 0.18, -0.42]}>
        <boxGeometry args={[0.42, 0.16, 0.04]} />
        <meshStandardMaterial
          ref={headRef}
          color={visual.color}
          emissive={visual.emissive}
          emissiveIntensity={visual.intensity}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>
      {/* Pillow */}
      <mesh position={[0, 0.16, -0.32]}>
        <boxGeometry args={[0.28, 0.04, 0.14]} />
        <meshStandardMaterial color="#363636" roughness={0.8} />
      </mesh>

      {isOccupied && (
        <>
          {/* IV pole — to the right of bed head */}
          <mesh position={[0.32, 0.55, -0.36]}>
            <cylinderGeometry args={[0.012, 0.012, 1.1, 8]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0.32, 1.10, -0.36]}>
            <boxGeometry args={[0.06, 0.16, 0.06]} />
            <meshStandardMaterial color="#1c1c1c" emissive="#19E3C2" emissiveIntensity={0.3} roughness={0.4} />
          </mesh>
          {/* Monitor — wall-mounted at head */}
          <mesh position={[-0.27, 0.55, -0.42]}>
            <boxGeometry args={[0.16, 0.10, 0.04]} />
            <meshStandardMaterial
              ref={monitorRef}
              color="#0a0a0a"
              emissive={isCritical ? '#FF3838' : '#19E3C2'}
              emissiveIntensity={isCritical ? 0.85 : 0.55}
              roughness={0.4}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Ward — outer walls + internal partitions + beds + nursing station
// ──────────────────────────────────────────────────────────────────
const Ward: React.FC<{ unit: BedUnit; plan: WardPlan }> = ({ unit, plan }) => {
  const { bounds, rows, cols, doorSide, glass, openBay, nurseStation } = plan;
  const w = bounds.x2 - bounds.x1;
  const d = bounds.z2 - bounds.z1;
  const cx = (bounds.x1 + bounds.x2) / 2;
  const cz = (bounds.z1 + bounds.z2) / 2;

  // How many beds we lay out — capped at rows × cols
  const slots = rows * cols;
  const beds = unit.beds.slice(0, slots);

  const cellW = (w - 0.4) / cols;
  const cellD = (d - 0.4) / rows;

  // Door opening width (~30% of the side it's on)
  const doorWidth = doorSide === 'N' || doorSide === 'S' ? Math.min(2.4, w * 0.32) : Math.min(1.8, d * 0.32);

  // Build outer walls with door gap on the door side
  const wallPieces: Array<{ side: 'N' | 'S' | 'E' | 'W'; segments: { x: number; z: number; len: number; axis: 'x' | 'z' }[] }> = [];
  const buildOuter = (side: 'N' | 'S' | 'E' | 'W'): { x: number; z: number; len: number; axis: 'x' | 'z' }[] => {
    if (side === 'N' || side === 'S') {
      const z = side === 'N' ? bounds.z1 : bounds.z2;
      if (side === doorSide) {
        const half = (w - doorWidth) / 2;
        return [
          { x: bounds.x1 + half / 2, z, len: half, axis: 'x' },
          { x: bounds.x2 - half / 2, z, len: half, axis: 'x' },
        ];
      }
      return [{ x: cx, z, len: w, axis: 'x' }];
    }
    // E / W
    const xx = side === 'W' ? bounds.x1 : bounds.x2;
    if (side === doorSide) {
      const half = (d - doorWidth) / 2;
      return [
        { x: xx, z: bounds.z1 + half / 2, len: half, axis: 'z' },
        { x: xx, z: bounds.z2 - half / 2, len: half, axis: 'z' },
      ];
    }
    return [{ x: xx, z: cz, len: d, axis: 'z' }];
  };

  ['N', 'S', 'E', 'W'].forEach((s) => {
    wallPieces.push({ side: s as 'N' | 'S' | 'E' | 'W', segments: buildOuter(s as 'N' | 'S' | 'E' | 'W') });
  });

  // Internal partitions — solid for med-surg/icu, omitted for open ED bays
  const partitionEls: React.ReactNode[] = [];
  if (!openBay) {
    // Vertical partitions between cols
    for (let c = 1; c < cols; c++) {
      const x = bounds.x1 + 0.2 + c * cellW;
      partitionEls.push(
        <Wall key={`v-${c}`} x={x} z={cz} len={d - 0.2} axis="z" glass={glass} height={1.2} />,
      );
    }
    // Horizontal partition between rows
    for (let r = 1; r < rows; r++) {
      const z = bounds.z1 + 0.2 + r * cellD;
      partitionEls.push(
        <Wall key={`h-${r}`} x={cx} z={z} len={w - 0.2} axis="x" glass={glass} height={1.2} />,
      );
    }
  } else {
    // Curtain partitions — short low boxes to evoke ED bay curtains
    for (let c = 1; c < cols; c++) {
      const x = bounds.x1 + 0.2 + c * cellW;
      partitionEls.push(
        <mesh key={`curtain-${c}`} position={[x, 0.6, cz]}>
          <boxGeometry args={[0.04, 1.2, d - 0.6]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} transparent opacity={0.55} />
        </mesh>,
      );
    }
  }

  return (
    <group>
      {/* Floor plate for the ward (lighter than corridor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.005, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#0e0e0e" roughness={0.92} />
      </mesh>

      {/* Outer walls */}
      {wallPieces.flatMap((wp) =>
        wp.segments.map((seg, i) => (
          <Wall
            key={`${wp.side}-${i}`}
            x={seg.x}
            z={seg.z}
            len={seg.len}
            axis={seg.axis}
            color={WALL_OUTER}
            glass={glass}
          />
        )),
      )}

      {/* Internal partitions */}
      {partitionEls}

      {/* Beds — placed inside each cell, head against the wall opposite the door */}
      {beds.map((bed, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cellCx = bounds.x1 + 0.2 + cellW * (c + 0.5);
        const cellCz = bounds.z1 + 0.2 + cellD * (r + 0.5);
        // Rotate so head ("up" in local Z=-1) faces away from the door
        const rotationY = (() => {
          if (doorSide === 'S') return 0;
          if (doorSide === 'N') return Math.PI;
          if (doorSide === 'E') return -Math.PI / 2;
          return Math.PI / 2;
        })();
        return <BedMesh key={bed.id} bed={bed} x={cellCx} z={cellCz} rotationY={rotationY} />;
      })}

      {/* Nursing station */}
      {nurseStation && (
        <group position={[nurseStation.x, 0, nurseStation.z]}>
          {/* Desk */}
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[1.6, 0.8, 0.6]} />
            <meshStandardMaterial color={NURSE_DESK} roughness={0.6} />
          </mesh>
          {/* Counter top */}
          <mesh position={[0, 0.82, 0]}>
            <boxGeometry args={[1.7, 0.04, 0.7]} />
            <meshStandardMaterial color="#2a2018" roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Two monitors */}
          <mesh position={[-0.4, 1.05, 0.05]}>
            <boxGeometry args={[0.34, 0.22, 0.04]} />
            <meshStandardMaterial color="#0a0a0a" emissive="#19E3C2" emissiveIntensity={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.4, 1.05, 0.05]}>
            <boxGeometry args={[0.34, 0.22, 0.04]} />
            <meshStandardMaterial color="#0a0a0a" emissive="#E11D48" emissiveIntensity={0.45} roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* Ward label — large, mounted over the door side */}
      <Text
        position={[cx, 0.03, doorSide === 'S' ? bounds.z2 + 0.6 : doorSide === 'N' ? bounds.z1 - 0.6 : cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.34}
        color="#E11D48"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
      >
        {unit.shortName}
      </Text>
      <Text
        position={[cx, 0.03, doorSide === 'S' ? bounds.z2 + 1.0 : doorSide === 'N' ? bounds.z1 - 1.0 : cz + 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.18}
        color="#525252"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
      >
        {`${unit.beds.filter((b) => b.state === 'occupied' || b.state === 'reserved').length}/${unit.beds.length} OCCUPIED`}
      </Text>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Building shell — outer plate, exterior walls, corridors
// ──────────────────────────────────────────────────────────────────
const BuildingShell: React.FC = () => {
  // Hospital footprint: a rectangle covering all wards plus walking room
  const FOOT = { x1: -14, z1: -8.5, x2: 14, z2: 10.5 };
  const w = FOOT.x2 - FOOT.x1;
  const d = FOOT.z2 - FOOT.z1;

  return (
    <>
      {/* Ground plane way out */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#040404" roughness={1} />
      </mesh>
      {/* Building footprint floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(FOOT.x1 + FOOT.x2) / 2, 0, (FOOT.z1 + FOOT.z2) / 2]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={FLOOR_DARK} roughness={0.95} />
      </mesh>
      {/* Subtle floor grid lines */}
      <gridHelper args={[w, Math.floor(w / 2), '#1a1a1a', '#0e0e0e']} position={[(FOOT.x1 + FOOT.x2) / 2, 0.001, (FOOT.z1 + FOOT.z2) / 2]} />

      {/* Corridor floor strips — slightly lighter */}
      {/* Main spine east-west */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 1]}>
        <planeGeometry args={[26, 0.8]} />
        <meshStandardMaterial color={FLOOR_CORRIDOR} roughness={0.85} />
      </mesh>
      {/* Corridor connecting to ICU */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -3.6]}>
        <planeGeometry args={[14, 0.7]} />
        <meshStandardMaterial color={FLOOR_CORRIDOR} roughness={0.85} />
      </mesh>
      {/* North-south spur to ED */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 3.5]}>
        <planeGeometry args={[0.8, 4]} />
        <meshStandardMaterial color={FLOOR_CORRIDOR} roughness={0.85} />
      </mesh>

      {/* Exterior walls — taller, darker */}
      {/* North */}
      <mesh position={[0, 1, FOOT.z1]}>
        <boxGeometry args={[w, 2, 0.16]} />
        <meshStandardMaterial color="#262626" roughness={0.6} />
      </mesh>
      {/* East */}
      <mesh position={[FOOT.x2, 1, (FOOT.z1 + FOOT.z2) / 2]}>
        <boxGeometry args={[0.16, 2, d]} />
        <meshStandardMaterial color="#262626" roughness={0.6} />
      </mesh>
      {/* West */}
      <mesh position={[FOOT.x1, 1, (FOOT.z1 + FOOT.z2) / 2]}>
        <boxGeometry args={[0.16, 2, d]} />
        <meshStandardMaterial color="#262626" roughness={0.6} />
      </mesh>
      {/* South — split for ambulance bay opening */}
      <mesh position={[(-w / 2 + (w / 2 - 3.5)) / 2 + FOOT.x1 / 2, 1, FOOT.z2]}>
        <boxGeometry args={[w / 2 - 3.5, 2, 0.16]} />
        <meshStandardMaterial color="#262626" roughness={0.6} />
      </mesh>
      <mesh position={[FOOT.x2 - (w / 2 - 3.5) / 2, 1, FOOT.z2]}>
        <boxGeometry args={[w / 2 - 3.5, 2, 0.16]} />
        <meshStandardMaterial color="#262626" roughness={0.6} />
      </mesh>

      {/* Ambulance bay marker on the ground in front of south entrance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, FOOT.z2 + 1.5]}>
        <planeGeometry args={[6, 2.4]} />
        <meshStandardMaterial color="#1a0e0e" roughness={0.9} />
      </mesh>
      <Line
        points={[
          [-3, 0.01, FOOT.z2 + 0.4],
          [-3, 0.01, FOOT.z2 + 2.6],
          [ 3, 0.01, FOOT.z2 + 2.6],
          [ 3, 0.01, FOOT.z2 + 0.4],
        ]}
        color="#9F1239"
        lineWidth={1}
      />
      <Text
        position={[0, 0.02, FOOT.z2 + 1.5]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.22}
        color="#9F1239"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.2}
      >
        AMBULANCE BAY
      </Text>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Ceiling lights — small emissive markers casting soft point light
// ──────────────────────────────────────────────────────────────────
const CeilingLights: React.FC = () => {
  const positions: [number, number, number][] = [
    // Spread across building, ~Y=2.0
    [-9, 2.0, 7.5], [-3, 2.0, 7.5], [3, 2.0, 7.5], [9, 2.0, 7.5],
    [-9, 2.0, -1.5], [-3, 2.0, -1.5], [3, 2.0, -1.5], [9, 2.0, -1.5],
    [-4, 2.0, -5.5], [4, 2.0, -5.5],
  ];
  return (
    <>
      {positions.map((p, i) => (
        <group key={i} position={p}>
          {/* Tiny emissive square representing the fixture */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
            <planeGeometry args={[0.32, 0.18]} />
            <meshBasicMaterial color="#FAFAFA" />
          </mesh>
          {/* Soft point light */}
          <pointLight color="#FFE9C4" intensity={0.35} distance={6} decay={1.6} />
        </group>
      ))}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Camera rig — gentle drone hover
// ──────────────────────────────────────────────────────────────────
const SceneRig: React.FC<{ severity: number | null }> = ({ severity }) => {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const angle = Math.sin(t * 0.13) * 0.09; // ±5°
    const radius = 26;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = 18 + Math.cos(angle) * 2.5;
    camera.position.y = 18;
    camera.lookAt(0, 0, 0);
  });

  // Severity tints overall ambient — S3 red wash, S2 amber, baseline cool blue
  const ambientColor =
    severity === 3 ? '#3a0e0e' :
    severity === 2 ? '#3a280e' :
    '#0e1622';

  return (
    <>
      <ambientLight color={ambientColor} intensity={0.5} />
      <directionalLight
        position={[12, 22, 8]}
        intensity={0.7}
        color="#ffffff"
        castShadow
      />
      <hemisphereLight args={['#1a1a1a', '#040404', 0.35]} />
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Radar sweep — rotating glowing sliver
// ──────────────────────────────────────────────────────────────────
const RadarSweep: React.FC<{ severity: number | null }> = ({ severity }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const speed = severity === 3 ? 0.6 : severity === 2 ? 0.4 : 0.22;
    ref.current.rotation.y = clock.getElapsedTime() * speed;
  });

  const color = severity === 3 ? '#FF3838' : severity === 2 ? '#F5A623' : '#19E3C2';

  return (
    <group ref={ref} position={[0, 0.04, 1]}>
      <Line points={[[0, 0, 0], [13, 0, 0]]} color={color} lineWidth={1.5} transparent opacity={0.55} />
      <Line points={[[0, 0, 0], [12.5, 0, 1.4]]} color={color} lineWidth={1} transparent opacity={0.22} />
      <Line points={[[0, 0, 0], [12.5, 0, -1.4]]} color={color} lineWidth={1} transparent opacity={0.22} />
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// EMS dot — moving sphere approaching ambulance bay
// ──────────────────────────────────────────────────────────────────
const EmsDot: React.FC<{ unit: string; etaSec: number; critical: boolean }> = ({ unit, etaSec, critical }) => {
  // ETA 0 = at ambulance bay; ETA 600 = 6 units southwest of building
  const progress = Math.max(0, Math.min(1, 1 - etaSec / 600));
  const x = -16 + progress * 14;
  const z = 16 - progress * 4;
  const color = critical ? '#FF3838' : '#19E3C2';

  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.5 + Math.sin(clock.getElapsedTime() * 4) * 0.05;
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.55, 18]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 1.0, 0]}
        rotation={[-Math.PI / 2.4, 0, 0]}
        fontSize={0.22}
        color="#FAFAFA"
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        {`${unit.toUpperCase()} · ${Math.max(0, Math.ceil(etaSec / 60))}M`}
      </Text>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Main scene
// ──────────────────────────────────────────────────────────────────
const Scene: React.FC<{ bedUnits: BedUnit[]; activeScenario: ScenarioState | null }> = ({
  bedUnits,
  activeScenario,
}) => {
  const { inbound } = useEmsInbound();
  const sev = activeScenario?.severity ?? null;

  return (
    <>
      <SceneRig severity={sev} />
      <BuildingShell />
      <CeilingLights />
      <RadarSweep severity={sev} />

      {bedUnits.map((unit) => {
        const plan = WARD_PLAN[unit.id];
        if (!plan) return null;
        return <Ward key={unit.id} unit={unit} plan={plan} />;
      })}

      {inbound
        .filter((r) => !r.arrived && r.etaSeconds < 600)
        .slice(0, 5)
        .map((r) => (
          <EmsDot
            key={r.id}
            unit={r.unit}
            etaSec={r.etaSeconds}
            critical={
              r.activationLevel === 'TRAUMA_1' ||
              r.activationLevel === 'STEMI' ||
              r.activationLevel === 'STROKE'
            }
          />
        ))}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Public component
// ──────────────────────────────────────────────────────────────────
export const BedDroneView: React.FC<{
  bedUnits: BedUnit[];
  activeScenario: ScenarioState | null;
  height?: number | string;
}> = ({ bedUnits, activeScenario, height = '100%' }) => {
  return (
    <div style={{ width: '100%', height, background: '#050505', position: 'relative' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 18, 18], fov: 38 }}
        gl={{ antialias: true, alpha: false }}
        shadows
        style={{ background: '#050505' }}
      >
        <Suspense fallback={null}>
          <Scene bedUnits={bedUnits} activeScenario={activeScenario} />
        </Suspense>
      </Canvas>
    </div>
  );
};
