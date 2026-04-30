/**
 * BedDroneView — architectural 3D hospital model.
 *
 * 2026-04-30 · Third pass. Previous attempts read as flat charts. This
 * version is a chunky architectural model: load-bearing exterior walls
 * 2.6 units tall, ward partitions 2.0 units, internal room dividers 1.6,
 * curtain partitions 0.8. Beds at human scale with visible mattresses
 * and headboard panels. Walking corridors with distinct light flooring.
 * Identity: red cross painted at the ambulance bay, MEMORIAL GENERAL on
 * the north exterior wall, parking stripes along the south curb.
 *
 * Camera is user-controllable via drei's OrbitControls — you can drag
 * to rotate, scroll to zoom. Auto-orbit runs underneath at a slow rate
 * (faster under scenario severity). Lighting is theatrical: warm key
 * from northwest + cool fill from southeast + cool ambient + warm
 * hemisphere ground bounce. Each ceiling fixture is a soft point light.
 *
 * Drop-in replacement of the previous BedDroneView export.
 */

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Line, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { BedUnit, Bed, BedState } from '../data/bedMock';
import type { ScenarioState } from '../lib/scenario';
import { useEmsInbound } from '../lib/emsLive';

// ──────────────────────────────────────────────────────────────────
// Materials & state visuals
// ──────────────────────────────────────────────────────────────────
const MAT = {
  groundDeep: '#02050a',
  groundPlate: '#0c0d0f',
  buildingFloor: '#1a1a1a',
  corridorFloor: '#22232a',
  exteriorWall: '#383a40',
  partitionWall: '#2a2a2e',
  glassWall: '#7faec1',
  curtainCloth: '#222229',
  bedFrame: '#1d1d1d',
  mattress: '#34373b',
  sheet: '#5a5e64',
  pillow: '#a8acb2',
  desk: '#5a3f2a',
  deskTop: '#7a5638',
  asphalt: '#181820',
  parkingStripe: '#d8c45a',
  redCross: '#c5302b',
  ambulanceLine: '#a91d2c',
};

const BED_COLOR: Record<BedState, { base: string; emissive: string; intensity: number }> = {
  ready:       { base: MAT.bedFrame, emissive: '#19E3C2', intensity: 0.55 },
  occupied:    { base: MAT.bedFrame, emissive: '#F5A623', intensity: 0.65 },
  dirty:       { base: MAT.bedFrame, emissive: '#FF8A2E', intensity: 0.45 },
  not_staffed: { base: MAT.bedFrame, emissive: '#FF6A00', intensity: 0.85 },
  blocked:     { base: MAT.bedFrame, emissive: '#A02828', intensity: 0.45 },
  reserved:    { base: MAT.bedFrame, emissive: '#E11D48', intensity: 0.95 },
};
const CRITICAL_COLOR = { base: MAT.bedFrame, emissive: '#FF3838', intensity: 1.4 };

// ──────────────────────────────────────────────────────────────────
// Floor-plan placement
// ──────────────────────────────────────────────────────────────────
type Bounds = { x1: number; z1: number; x2: number; z2: number };
type WardPlan = {
  bounds: Bounds;
  doorSide: 'N' | 'S' | 'E' | 'W';
  rows: number;
  cols: number;
  glass?: boolean;
  openBay?: boolean;
  /** Floor accent color — gives each zone a recognizable identity. */
  zoneFloor: string;
  /** Local nursing station offset (relative to ward center) */
  nurseStation?: { x: number; z: number };
};

const WARD_PLAN: Record<string, WardPlan> = {
  // ED row — south
  'ed-trauma': {
    bounds: { x1: -15, z1:  6, x2:  -8.4, z2: 11 },
    doorSide: 'S', rows: 1, cols: 3, openBay: true,
    zoneFloor: '#251616',
    nurseStation: { x: -11.7, z: 6.4 },
  },
  'ed-acute': {
    bounds: { x1: -8, z1:  6, x2:  6, z2: 11 },
    doorSide: 'N', rows: 2, cols: 4, openBay: true,
    zoneFloor: '#1f1d1a',
    nurseStation: { x: -1, z: 8.5 },
  },
  'ed-ft': {
    bounds: { x1:  6.4, z1:  6, x2: 14.4, z2: 11 },
    doorSide: 'N', rows: 2, cols: 2, openBay: true,
    zoneFloor: '#1c1f1a',
    nurseStation: { x: 10.4, z: 6.4 },
  },
  // Mid spine
  'overflow-c': {
    bounds: { x1: -4, z1:  2.4, x2:  4, z2:  5 },
    doorSide: 'S', rows: 1, cols: 4, openBay: true,
    zoneFloor: '#1f1d18',
  },
  'stepdown': {
    bounds: { x1: -4, z1: -3, x2:  4, z2:  0.6 },
    doorSide: 'S', rows: 1, cols: 4,
    zoneFloor: '#1d1922',
    nurseStation: { x: 0, z: -1.2 },
  },
  // Inpatient row
  'ms-2w': {
    bounds: { x1: -15, z1: -3, x2:  -5, z2:  0.6 },
    doorSide: 'E', rows: 2, cols: 5,
    zoneFloor: '#1f1d17',
    nurseStation: { x: -5.4, z: -1.2 },
  },
  'ms-3e': {
    bounds: { x1:   5, z1: -3, x2: 15, z2:  0.6 },
    doorSide: 'W', rows: 2, cols: 5,
    zoneFloor: '#1f1d17',
    nurseStation: { x: 5.4, z: -1.2 },
  },
  // ICU — north
  'icu': {
    bounds: { x1: -8, z1: -8.5, x2:  8, z2:  -4.5 },
    doorSide: 'S', rows: 1, cols: 6, glass: true,
    zoneFloor: '#0e1f23',
    nurseStation: { x: 0, z: -4.9 },
  },
};

// ──────────────────────────────────────────────────────────────────
// Wall — extruded box primitive, thicker than before
// ──────────────────────────────────────────────────────────────────
const Wall: React.FC<{
  x: number; z: number; len: number;
  axis: 'x' | 'z';
  height: number;
  thickness?: number;
  color?: string;
  glass?: boolean;
}> = ({ x, z, len, axis, height, thickness = 0.18, color = MAT.partitionWall, glass }) => (
  <mesh position={[x, height / 2, z]}>
    <boxGeometry args={axis === 'x' ? [len, height, thickness] : [thickness, height, len]} />
    <meshStandardMaterial
      color={glass ? MAT.glassWall : color}
      roughness={glass ? 0.15 : 0.85}
      metalness={glass ? 0.4 : 0.05}
      transparent={glass}
      opacity={glass ? 0.32 : 1}
    />
  </mesh>
);

// ──────────────────────────────────────────────────────────────────
// Bed — chunkier, with monitor + IV pole + small patient lump
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
  const visual = isCritical ? CRITICAL_COLOR : BED_COLOR[bed.state];

  const headRef = useRef<THREE.MeshStandardMaterial>(null);
  const monitorRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!headRef.current) return;
    const t = clock.getElapsedTime();
    if (isCritical) {
      headRef.current.emissiveIntensity = visual.intensity + Math.sin(t * 4) * 0.5;
      if (monitorRef.current) {
        monitorRef.current.emissiveIntensity = 0.9 + Math.sin(t * 4) * 0.5;
      }
    } else if (isReserved) {
      headRef.current.emissiveIntensity = visual.intensity + Math.sin(t * 2.4) * 0.3;
    } else if (isOccupied) {
      headRef.current.emissiveIntensity = visual.intensity + Math.sin(t * 1.4 + x) * 0.06;
    }
  });

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {/* Frame */}
      <RoundedBox args={[0.7, 0.18, 1.6]} radius={0.04} smoothness={2} position={[0, 0.10, 0]}>
        <meshStandardMaterial color={MAT.bedFrame} roughness={0.65} />
      </RoundedBox>
      {/* Mattress */}
      <mesh position={[0, 0.21, 0]}>
        <boxGeometry args={[0.62, 0.08, 1.5]} />
        <meshStandardMaterial color={MAT.mattress} roughness={0.9} />
      </mesh>
      {/* Sheet */}
      <mesh position={[0, 0.27, 0.05]}>
        <boxGeometry args={[0.6, 0.04, 1.4]} />
        <meshStandardMaterial color={MAT.sheet} roughness={0.95} />
      </mesh>
      {/* Pillow */}
      <mesh position={[0, 0.30, -0.6]}>
        <boxGeometry args={[0.5, 0.06, 0.3]} />
        <meshStandardMaterial color={MAT.pillow} roughness={0.85} />
      </mesh>
      {/* Patient lump — only when occupied; subtle bulge under sheet */}
      {(isOccupied || isReserved) && (
        <mesh position={[0, 0.34, 0.1]}>
          <boxGeometry args={[0.42, 0.10, 1.0]} />
          <meshStandardMaterial color={MAT.sheet} roughness={0.95} />
        </mesh>
      )}
      {/* Headboard — emissive panel that telegraphs state */}
      <mesh position={[0, 0.52, -0.84]}>
        <boxGeometry args={[0.7, 0.36, 0.08]} />
        <meshStandardMaterial
          ref={headRef}
          color={visual.base}
          emissive={visual.emissive}
          emissiveIntensity={visual.intensity}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {(isOccupied || isCritical) && (
        <>
          {/* IV pole */}
          <mesh position={[0.55, 0.85, -0.65]}>
            <cylinderGeometry args={[0.022, 0.022, 1.7, 10]} />
            <meshStandardMaterial color="#5a5d62" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* IV bag */}
          <mesh position={[0.55, 1.6, -0.65]}>
            <boxGeometry args={[0.10, 0.22, 0.10]} />
            <meshStandardMaterial color="#102230" emissive="#19E3C2" emissiveIntensity={0.45} roughness={0.3} />
          </mesh>
          {/* Wall monitor at head */}
          <mesh position={[-0.45, 0.95, -0.84]}>
            <boxGeometry args={[0.32, 0.20, 0.06]} />
            <meshStandardMaterial
              ref={monitorRef}
              color="#0a0a0a"
              emissive={isCritical ? '#FF3838' : '#19E3C2'}
              emissiveIntensity={isCritical ? 1.1 : 0.75}
              roughness={0.35}
            />
          </mesh>
          {/* Monitor "screen" tiny waveform line — emissive plane */}
          <mesh position={[-0.45, 0.95, -0.79]}>
            <planeGeometry args={[0.26, 0.14]} />
            <meshBasicMaterial color={isCritical ? '#FF6363' : '#3DEAC8'} transparent opacity={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Nursing station — desk + 2 monitors + standing nurse avatar
// ──────────────────────────────────────────────────────────────────
const NursingStation: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  return (
    <group position={[x, 0, z]}>
      {/* Desk body */}
      <RoundedBox args={[2.0, 0.95, 0.7]} radius={0.05} smoothness={2} position={[0, 0.475, 0]}>
        <meshStandardMaterial color={MAT.desk} roughness={0.7} />
      </RoundedBox>
      {/* Counter top */}
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[2.1, 0.05, 0.78]} />
        <meshStandardMaterial color={MAT.deskTop} roughness={0.45} metalness={0.18} />
      </mesh>
      {/* Two monitors */}
      <mesh position={[-0.55, 1.27, 0.06]}>
        <boxGeometry args={[0.42, 0.28, 0.06]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#19E3C2" emissiveIntensity={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[0.55, 1.27, 0.06]}>
        <boxGeometry args={[0.42, 0.28, 0.06]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#E11D48" emissiveIntensity={0.65} roughness={0.35} />
      </mesh>

      {/* Standing nurse — capsule torso + sphere head */}
      <group position={[0, 0, 0.65]}>
        <mesh position={[0, 0.68, 0]}>
          <capsuleGeometry args={[0.15, 0.55, 6, 12]} />
          <meshStandardMaterial color="#163d6e" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.20, 0]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#d6b187" roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Crash cart — for ED Trauma
// ──────────────────────────────────────────────────────────────────
const CrashCart: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <group position={[x, 0, z]}>
    <RoundedBox args={[0.6, 0.85, 0.45]} radius={0.04} smoothness={2} position={[0, 0.42, 0]}>
      <meshStandardMaterial color="#a72a26" emissive="#a72a26" emissiveIntensity={0.25} roughness={0.55} />
    </RoundedBox>
    {/* Drawer lines (small dim panels) */}
    {[0.62, 0.42, 0.22].map((y, i) => (
      <mesh key={i} position={[0, y, 0.23]}>
        <boxGeometry args={[0.55, 0.15, 0.02]} />
        <meshStandardMaterial color="#5a1212" roughness={0.6} />
      </mesh>
    ))}
    {/* Defib-shape on top */}
    <mesh position={[0, 0.92, 0]}>
      <boxGeometry args={[0.5, 0.10, 0.36]} />
      <meshStandardMaterial color="#1a1a1a" emissive="#FFB400" emissiveIntensity={0.4} roughness={0.4} />
    </mesh>
  </group>
);

// ──────────────────────────────────────────────────────────────────
// Ward — outer walls (with door gap) + partitions + beds + accents
// ──────────────────────────────────────────────────────────────────
const Ward: React.FC<{ unit: BedUnit; plan: WardPlan }> = ({ unit, plan }) => {
  const { bounds, rows, cols, doorSide, glass, openBay, nurseStation, zoneFloor } = plan;
  const w = bounds.x2 - bounds.x1;
  const d = bounds.z2 - bounds.z1;
  const cx = (bounds.x1 + bounds.x2) / 2;
  const cz = (bounds.z1 + bounds.z2) / 2;

  const slots = rows * cols;
  const beds = unit.beds.slice(0, slots);
  const cellW = (w - 0.5) / cols;
  const cellD = (d - 0.5) / rows;
  const doorWidth = doorSide === 'N' || doorSide === 'S'
    ? Math.min(2.6, w * 0.32)
    : Math.min(2.0, d * 0.32);

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

  const sides: ('N' | 'S' | 'E' | 'W')[] = ['N', 'S', 'E', 'W'];
  const outerWalls = sides.flatMap((side) =>
    buildOuter(side).map((seg, i) => (
      <Wall
        key={`${side}-${i}`}
        x={seg.x} z={seg.z} len={seg.len} axis={seg.axis}
        height={2.0}
        thickness={0.22}
        color={MAT.partitionWall}
        glass={glass}
      />
    )),
  );

  const partitionEls: React.ReactNode[] = [];
  if (!openBay) {
    for (let c = 1; c < cols; c++) {
      const x = bounds.x1 + 0.25 + c * cellW;
      partitionEls.push(
        <Wall key={`v-${c}`} x={x} z={cz} len={d - 0.3} axis="z" height={1.6} thickness={0.16} glass={glass} />,
      );
    }
    for (let r = 1; r < rows; r++) {
      const z = bounds.z1 + 0.25 + r * cellD;
      partitionEls.push(
        <Wall key={`h-${r}`} x={cx} z={z} len={w - 0.3} axis="x" height={1.6} thickness={0.16} glass={glass} />,
      );
    }
  } else {
    // ED bay curtains — short translucent partitions
    for (let c = 1; c < cols; c++) {
      const x = bounds.x1 + 0.25 + c * cellW;
      partitionEls.push(
        <mesh key={`curtain-v-${c}`} position={[x, 0.55, cz]}>
          <boxGeometry args={[0.06, 1.1, d - 0.7]} />
          <meshStandardMaterial color={MAT.curtainCloth} roughness={0.97} transparent opacity={0.6} />
        </mesh>,
      );
    }
    if (rows > 1) {
      for (let r = 1; r < rows; r++) {
        const z = bounds.z1 + 0.25 + r * cellD;
        partitionEls.push(
          <mesh key={`curtain-h-${r}`} position={[cx, 0.55, z]}>
            <boxGeometry args={[w - 0.7, 1.1, 0.06]} />
            <meshStandardMaterial color={MAT.curtainCloth} roughness={0.97} transparent opacity={0.6} />
          </mesh>,
        );
      }
    }
  }

  return (
    <group>
      {/* Zone-tinted floor plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.012, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={zoneFloor} roughness={0.95} />
      </mesh>

      {outerWalls}
      {partitionEls}

      {beds.map((bed, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cellCx = bounds.x1 + 0.25 + cellW * (c + 0.5);
        const cellCz = bounds.z1 + 0.25 + cellD * (r + 0.5);
        const rotationY = doorSide === 'S' ? 0
          : doorSide === 'N' ? Math.PI
          : doorSide === 'E' ? -Math.PI / 2
          : Math.PI / 2;
        return <BedMesh key={bed.id} bed={bed} x={cellCx} z={cellCz} rotationY={rotationY} />;
      })}

      {nurseStation && <NursingStation x={nurseStation.x} z={nurseStation.z} />}

      {/* Add a crash cart at ED-Trauma (only if this is that ward) */}
      {unit.id === 'ed-trauma' && <CrashCart x={bounds.x1 + 0.6} z={bounds.z2 - 0.6} />}

      {/* Ward label — large, on the corridor side */}
      <Text
        position={[
          cx,
          0.025,
          doorSide === 'S' ? bounds.z2 + 0.7
          : doorSide === 'N' ? bounds.z1 - 0.7
          : cz,
        ]}
        rotation={[-Math.PI / 2, 0, doorSide === 'W' ? Math.PI / 2 : doorSide === 'E' ? -Math.PI / 2 : 0]}
        fontSize={0.42}
        color="#E11D48"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.16}
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        {unit.shortName}
      </Text>
      <Text
        position={[
          cx,
          0.025,
          doorSide === 'S' ? bounds.z2 + 1.25
          : doorSide === 'N' ? bounds.z1 - 1.25
          : cz + (doorSide === 'W' ? -0.7 : 0.7),
        ]}
        rotation={[-Math.PI / 2, 0, doorSide === 'W' ? Math.PI / 2 : doorSide === 'E' ? -Math.PI / 2 : 0]}
        fontSize={0.18}
        color="#9c9c9c"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
      >
        {`${unit.beds.filter((b) => b.state === 'occupied' || b.state === 'reserved').length}/${unit.beds.length}  OCCUPIED`}
      </Text>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Building shell — exterior walls, name-on-facade, ambulance bay markings
// ──────────────────────────────────────────────────────────────────
const FOOT = { x1: -16, z1: -9.5, x2: 16, z2: 12 };

const BuildingShell: React.FC = () => {
  const w = FOOT.x2 - FOOT.x1;
  const d = FOOT.z2 - FOOT.z1;
  const ambulanceWidth = 5.0;

  return (
    <>
      {/* Wide ground plane (asphalt) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={MAT.asphalt} roughness={1} />
      </mesh>

      {/* Building plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(FOOT.x1 + FOOT.x2) / 2, 0, (FOOT.z1 + FOOT.z2) / 2]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={MAT.buildingFloor} roughness={0.95} />
      </mesh>

      {/* Corridor strips (lighter floor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 1.4]}>
        <planeGeometry args={[28, 1.0]} />
        <meshStandardMaterial color={MAT.corridorFloor} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -3.8]}>
        <planeGeometry args={[14, 0.9]} />
        <meshStandardMaterial color={MAT.corridorFloor} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 4]}>
        <planeGeometry args={[1.0, 6]} />
        <meshStandardMaterial color={MAT.corridorFloor} roughness={0.85} />
      </mesh>

      {/* Exterior walls (taller) */}
      {/* North */}
      <mesh position={[0, 1.3, FOOT.z1]}>
        <boxGeometry args={[w, 2.6, 0.34]} />
        <meshStandardMaterial color={MAT.exteriorWall} roughness={0.6} />
      </mesh>
      {/* East */}
      <mesh position={[FOOT.x2, 1.3, (FOOT.z1 + FOOT.z2) / 2]}>
        <boxGeometry args={[0.34, 2.6, d]} />
        <meshStandardMaterial color={MAT.exteriorWall} roughness={0.6} />
      </mesh>
      {/* West */}
      <mesh position={[FOOT.x1, 1.3, (FOOT.z1 + FOOT.z2) / 2]}>
        <boxGeometry args={[0.34, 2.6, d]} />
        <meshStandardMaterial color={MAT.exteriorWall} roughness={0.6} />
      </mesh>
      {/* South — split for ambulance bay */}
      {(() => {
        const halfW = (w - ambulanceWidth) / 2;
        return (
          <>
            <mesh position={[FOOT.x1 + halfW / 2, 1.3, FOOT.z2]}>
              <boxGeometry args={[halfW, 2.6, 0.34]} />
              <meshStandardMaterial color={MAT.exteriorWall} roughness={0.6} />
            </mesh>
            <mesh position={[FOOT.x2 - halfW / 2, 1.3, FOOT.z2]}>
              <boxGeometry args={[halfW, 2.6, 0.34]} />
              <meshStandardMaterial color={MAT.exteriorWall} roughness={0.6} />
            </mesh>
            {/* Lintel above the entry — beams across the opening */}
            <mesh position={[0, 2.3, FOOT.z2]}>
              <boxGeometry args={[ambulanceWidth, 0.6, 0.34]} />
              <meshStandardMaterial color={MAT.exteriorWall} roughness={0.6} />
            </mesh>
          </>
        );
      })()}

      {/* Building name on north facade — facing outward (away from camera at origin) */}
      <Text
        position={[0, 1.7, FOOT.z1 - 0.18]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.65}
        color="#E11D48"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.18}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        MEMORIAL GENERAL
      </Text>
      <Text
        position={[0, 1.05, FOOT.z1 - 0.18]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.22}
        color="#FAFAFA"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.3}
      >
        TRAUMA · STROKE · STEMI · PEDIATRICS
      </Text>

      {/* Ambulance bay — painted entry zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, FOOT.z2 + 2.0]}>
        <planeGeometry args={[ambulanceWidth + 2.0, 4.0]} />
        <meshStandardMaterial color="#180a0a" roughness={0.95} />
      </mesh>
      <Line
        points={[
          [-(ambulanceWidth + 2) / 2, 0.012, FOOT.z2 + 0.05],
          [-(ambulanceWidth + 2) / 2, 0.012, FOOT.z2 + 4.0],
          [ (ambulanceWidth + 2) / 2, 0.012, FOOT.z2 + 4.0],
          [ (ambulanceWidth + 2) / 2, 0.012, FOOT.z2 + 0.05],
        ]}
        color={MAT.ambulanceLine}
        lineWidth={1.6}
      />
      <Text
        position={[0, 0.02, FOOT.z2 + 2.0]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.32}
        color={MAT.ambulanceLine}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.22}
      >
        AMBULANCE BAY
      </Text>

      {/* Red cross painted on ground in front of entry */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5, 0.012, FOOT.z2 + 5.5]}>
        <planeGeometry args={[1.6, 0.4]} />
        <meshBasicMaterial color={MAT.redCross} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5, 0.012, FOOT.z2 + 5.5]}>
        <planeGeometry args={[0.4, 1.6]} />
        <meshBasicMaterial color={MAT.redCross} />
      </mesh>
      {/* Helipad-style "H" further out */}
      <group position={[7, 0.013, FOOT.z2 + 5.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[1.2, 1.4, 32]} />
          <meshBasicMaterial color="#d8c45a" />
        </mesh>
        <mesh position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[1.2, 0.18]} />
          <meshBasicMaterial color="#d8c45a" />
        </mesh>
        <mesh position={[0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[1.2, 0.18]} />
          <meshBasicMaterial color="#d8c45a" />
        </mesh>
        <mesh>
          <planeGeometry args={[0.2, 1.0]} />
          <meshBasicMaterial color="#d8c45a" />
        </mesh>
      </group>

      {/* Parking stripes south of ambulance bay */}
      {[-12, -10, -8, 8, 10, 12].map((sx) => (
        <mesh key={sx} rotation={[-Math.PI / 2, 0, 0]} position={[sx, 0.011, FOOT.z2 + 6]}>
          <planeGeometry args={[0.12, 2.6]} />
          <meshBasicMaterial color={MAT.parkingStripe} />
        </mesh>
      ))}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Ceiling lights — emissive rectangles with point-light pools
// ──────────────────────────────────────────────────────────────────
const CeilingLights: React.FC = () => {
  const positions: [number, number, number][] = [
    // ED row
    [-12, 2.4, 8.5], [-4, 2.4, 8.5], [3, 2.4, 8.5], [10, 2.4, 8.5],
    // Mid spine
    [-9, 2.4, -1.2], [0, 2.4, -1.2], [9, 2.4, -1.2],
    // ICU
    [-5, 2.4, -6.5], [0, 2.4, -6.5], [5, 2.4, -6.5],
  ];
  return (
    <>
      {positions.map((p, i) => (
        <group key={i} position={p}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
            <planeGeometry args={[0.46, 0.22]} />
            <meshBasicMaterial color="#FFE9C4" />
          </mesh>
          <pointLight color="#FFE9C4" intensity={0.55} distance={7} decay={1.6} />
        </group>
      ))}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Radar sweep
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
      <Line points={[[0, 0, 0], [16, 0, 0]]} color={color} lineWidth={2} transparent opacity={0.7} />
      <Line points={[[0, 0, 0], [15, 0, 1.6]]} color={color} lineWidth={1} transparent opacity={0.28} />
      <Line points={[[0, 0, 0], [15, 0, -1.6]]} color={color} lineWidth={1} transparent opacity={0.28} />
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// EMS dot — moving sphere approaching ambulance bay
// ──────────────────────────────────────────────────────────────────
const EmsDot: React.FC<{ unit: string; etaSec: number; critical: boolean }> = ({ unit, etaSec, critical }) => {
  const progress = Math.max(0, Math.min(1, 1 - etaSec / 600));
  const x = -22 + progress * 22;
  const z = 22 - progress * 8;
  const color = critical ? '#FF3838' : '#19E3C2';
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.6 + Math.sin(clock.getElapsedTime() * 4) * 0.06;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.62, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 1.2, 0]}
        rotation={[-Math.PI / 2.4, 0, 0]}
        fontSize={0.26}
        color="#FAFAFA"
        anchorX="center"
        outlineWidth={0.014}
        outlineColor="#000000"
      >
        {`${unit.toUpperCase()} · ${Math.max(0, Math.ceil(etaSec / 60))}M`}
      </Text>
    </group>
  );
};

// ──────────────────────────────────────────────────────────────────
// Lighting rig — theatrical, scenario-tinted ambient
// ──────────────────────────────────────────────────────────────────
const Lighting: React.FC<{ severity: number | null }> = ({ severity }) => {
  const ambientColor =
    severity === 3 ? '#3a1010' :
    severity === 2 ? '#3a2c10' :
    '#1a2230';

  return (
    <>
      <ambientLight color={ambientColor} intensity={0.6} />
      {/* Warm key from NW */}
      <directionalLight position={[-25, 28, 18]} intensity={1.15} color="#fff1d8" />
      {/* Cool fill from SE */}
      <directionalLight position={[20, 18, -14]} intensity={0.55} color="#7eaeff" />
      <hemisphereLight args={['#3a3a3a', '#101010', 0.45]} />
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Scene composition
// ──────────────────────────────────────────────────────────────────
const Scene: React.FC<{ bedUnits: BedUnit[]; activeScenario: ScenarioState | null }> = ({
  bedUnits,
  activeScenario,
}) => {
  const { inbound } = useEmsInbound();
  const sev = activeScenario?.severity ?? null;
  const orbitSpeed = sev === 3 ? 0.8 : sev === 2 ? 0.55 : 0.32;

  return (
    <>
      <Lighting severity={sev} />
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

      <OrbitControls
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.06}
        autoRotate
        autoRotateSpeed={orbitSpeed}
        enablePan={false}
        minPolarAngle={0.35}
        maxPolarAngle={1.32}
        minDistance={20}
        maxDistance={70}
      />
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
    <div style={{ width: '100%', height, background: MAT.groundDeep, position: 'relative' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [-22, 22, 28], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: MAT.groundDeep }}
      >
        <Suspense fallback={null}>
          <Scene bedUnits={bedUnits} activeScenario={activeScenario} />
        </Suspense>
      </Canvas>
      {/* Subtle vignette */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 80% 70% at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* Drag hint, fades on first interaction (cosmetic only) */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#88898c',
          fontFamily: 'ui-monospace, "Geist Mono", monospace',
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          opacity: 0.7,
        }}
      >
        Drag to rotate · scroll to zoom
      </div>
    </div>
  );
};
