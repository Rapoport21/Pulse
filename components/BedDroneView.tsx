/**
 * BedDroneView — 3D drone-view bed map.
 *
 * 2026-04-22 · Anduril-flavored tactical floor plan. Each ward sits
 * as a labeled plate on a hospital "site" plane. Beds inside each
 * ward extrude as small boxes whose color, glow, and height telegraph
 * their state. EMS arrivals stream as moving dots toward the ED entrance.
 *
 * No real geometry from blueprints — this is a synthesized layout that
 * groups the existing BedUnits into a believable footprint:
 *     SOUTH  ED-Trauma · ED-Acute · ED-Fast Track   (ambulance bay)
 *     CENTER OR · Stepdown
 *     NORTH  ICU · Med-Surg 2W · Med-Surg 3E
 *     WEST   Overflow Hall C (only when surge is active)
 *
 * Visuals:
 *   - Tactical near-black floor with thin grid
 *   - Ward plates with rose-accent labels
 *   - Bed boxes color-coded:
 *       ready       → cool teal, low height
 *       occupied    → warm amber, medium height
 *       dirty       → muted orange (shorter, dim)
 *       not_staffed → orange (visibly "stranded")
 *       blocked     → desaturated red
 *       reserved    → rose accent, pulsing
 *       acuity≤1    → red glow override (active critical patient)
 *   - Slow continuous orbit of the camera (±5°)
 *   - Radar sweep line that rotates once per 8s
 *   - EMS run dots glide along S→N route, ETA shown above
 */

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BedUnit, Bed, BedState } from '../data/bedMock';
import type { ScenarioState } from '../lib/scenario';
import { useEmsInbound } from '../lib/emsLive';

// ────────────────────────────────────────────────────────────────────
// Floor-plan layout — synthesized positions per unit id
// ────────────────────────────────────────────────────────────────────
type WardPlacement = { x: number; z: number; w: number; d: number; row: number; col: number };

// Each ward gets a placement on a 24x18 floor.
// Coordinates are in world units (1 unit ≈ 1 meter for mental scale).
const WARD_PLACEMENT: Record<string, WardPlacement> = {
  'ed-trauma':  { x: -7,  z:  6.5, w: 4.5, d: 3, row: 0, col: 0 },
  'ed-acute':   { x:  0,  z:  6.5, w: 6,   d: 3, row: 0, col: 1 },
  'ed-ft':      { x:  7.5, z: 6.5, w: 4,   d: 3, row: 0, col: 2 },
  'or':         { x: -5,  z:  1,   w: 4,   d: 3, row: 1, col: 0 },
  'stepdown':   { x:  0,  z:  1,   w: 5,   d: 3, row: 1, col: 1 },
  'icu':        { x:  6.5, z: 1,   w: 4.5, d: 3, row: 1, col: 2 },
  'medsurg-2w': { x: -5,  z: -4.5, w: 5,   d: 3, row: 2, col: 0 },
  'medsurg-3e': { x:  1.5, z: -4.5, w: 5,  d: 3, row: 2, col: 1 },
  'overflow-c': { x:  7.5, z: -4.5, w: 4,  d: 3, row: 2, col: 2 },
};

// Fallback placement for any unit id we don't recognize — drops south
// of the building so you can see something is unmapped without crashing.
const fallbackPlacement = (i: number): WardPlacement => ({
  x: -10 + (i % 5) * 5,
  z: -10,
  w: 4,
  d: 2.5,
  row: 3,
  col: i,
});

// ────────────────────────────────────────────────────────────────────
// Bed state → visual properties
// ────────────────────────────────────────────────────────────────────
const BED_VISUAL: Record<BedState, {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  height: number;
}> = {
  ready:       { color: '#1F4F4A', emissive: '#19E3C2', emissiveIntensity: 0.18, height: 0.18 },
  occupied:    { color: '#5C3A1A', emissive: '#F5A623', emissiveIntensity: 0.32, height: 0.34 },
  dirty:       { color: '#3F2A14', emissive: '#FF8A2E', emissiveIntensity: 0.22, height: 0.20 },
  not_staffed: { color: '#5A2F0F', emissive: '#FF6A00', emissiveIntensity: 0.50, height: 0.28 },
  blocked:     { color: '#3A1818', emissive: '#A02828', emissiveIntensity: 0.30, height: 0.18 },
  reserved:    { color: '#4A1530', emissive: '#E11D48', emissiveIntensity: 0.55, height: 0.30 },
};

// Critical patient (acuity 1) → red override + tall extrusion
const CRITICAL_VISUAL = {
  color: '#3A0A0A',
  emissive: '#FF3838',
  emissiveIntensity: 0.85,
  height: 0.42,
};

// ────────────────────────────────────────────────────────────────────
// Scene — orbiting camera + ambient lighting + radar sweep
// ────────────────────────────────────────────────────────────────────
const SceneRig: React.FC<{ scenarioSeverity: number | null }> = ({ scenarioSeverity }) => {
  // Animate the *active* default camera (created by Canvas) — declaring
  // a fresh <perspectiveCamera> inside the scene doesn't get used unless
  // we mark it makeDefault. Easier to animate the existing one in place.
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Slow drift — arcs +/-5° over ~30s. Not a full orbit; this is a
    // surveillance hover, not a flythrough.
    const angle = Math.sin(t * 0.15) * 0.087;
    const radius = 22;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = 14 + Math.cos(angle) * 2;
    camera.position.y = 16;
    camera.lookAt(0, 0, 0);
  });

  // Severity tints overall ambient — S3 washes scene red, S2 amber.
  const ambientColor =
    scenarioSeverity === 3 ? '#3a0e0e' :
    scenarioSeverity === 2 ? '#3a2a0e' :
    '#0e1a26';

  return (
    <>
      <ambientLight color={ambientColor} intensity={0.6} />
      <directionalLight position={[8, 18, 6]} intensity={0.6} color="#ffffff" />
      <hemisphereLight args={['#1a1a1a', '#080808', 0.4]} />
    </>
  );
};

// ────────────────────────────────────────────────────────────────────
// Floor — dark plate + grid
// ────────────────────────────────────────────────────────────────────
const Floor: React.FC = () => {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      {/* Grid lines */}
      <gridHelper args={[60, 60, '#1A1A1A', '#0E0E0E']} position={[0, 0, 0]} />
      {/* Hospital footprint plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 1]}>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color="#0A0A0A" roughness={0.95} />
      </mesh>
      {/* Building outline */}
      <Line
        points={[
          [-12, 0.02,  10],
          [ 12, 0.02,  10],
          [ 12, 0.02,  -8],
          [-12, 0.02,  -8],
          [-12, 0.02,  10],
        ]}
        color="#2A2A2A"
        lineWidth={1}
      />
    </>
  );
};

// ────────────────────────────────────────────────────────────────────
// Radar sweep — thin glowing line that rotates around the building
// ────────────────────────────────────────────────────────────────────
const RadarSweep: React.FC<{ scenarioSeverity: number | null }> = ({ scenarioSeverity }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      // 8s per revolution by default, faster under pressure
      const speed = scenarioSeverity === 3 ? 0.6 : scenarioSeverity === 2 ? 0.4 : 0.25;
      ref.current.rotation.y = t * speed;
    }
  });

  const sweepColor =
    scenarioSeverity === 3 ? '#FF3838' :
    scenarioSeverity === 2 ? '#F5A623' :
    '#19E3C2';

  return (
    <group ref={ref} position={[0, 0.02, 1]}>
      <Line
        points={[
          [0, 0, 0],
          [12, 0, 0],
        ]}
        color={sweepColor}
        lineWidth={1}
        transparent
        opacity={0.55}
      />
      <Line
        points={[
          [0, 0, 0],
          [11.5, 0, 1.5],
        ]}
        color={sweepColor}
        lineWidth={1}
        transparent
        opacity={0.25}
      />
      <Line
        points={[
          [0, 0, 0],
          [11.5, 0, -1.5],
        ]}
        color={sweepColor}
        lineWidth={1}
        transparent
        opacity={0.25}
      />
    </group>
  );
};

// ────────────────────────────────────────────────────────────────────
// Ward plate — rectangle with label, beds positioned in a grid inside
// ────────────────────────────────────────────────────────────────────
const Ward: React.FC<{ unit: BedUnit; placement: WardPlacement }> = ({ unit, placement }) => {
  const { x, z, w, d } = placement;
  const beds = unit.beds;

  // Pack beds into a row x col grid inside the ward
  const cols = Math.ceil(Math.sqrt(beds.length * (w / d)));
  const rows = Math.ceil(beds.length / cols);
  const cellW = (w - 0.6) / cols;
  const cellD = (d - 0.6) / rows;

  return (
    <group position={[x, 0, z]}>
      {/* Ward floor plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#101010" roughness={0.85} />
      </mesh>

      {/* Ward outline */}
      <Line
        points={[
          [-w / 2, 0.01, -d / 2],
          [ w / 2, 0.01, -d / 2],
          [ w / 2, 0.01,  d / 2],
          [-w / 2, 0.01,  d / 2],
          [-w / 2, 0.01, -d / 2],
        ]}
        color="#26221F"
        lineWidth={1}
      />

      {/* Ward label — Geist Mono uppercase, rose tone */}
      <Text
        position={[0, 0.02, -d / 2 + 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.32}
        color="#E11D48"
        anchorX="center"
        anchorY="top"
        letterSpacing={0.16}
      >
        {unit.shortName}
      </Text>
      <Text
        position={[0, 0.02, -d / 2 + 0.7]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.18}
        color="#525252"
        anchorX="center"
        anchorY="top"
        letterSpacing={0.18}
      >
        {`${unit.beds.filter((b) => b.state === 'occupied' || b.state === 'reserved').length}/${unit.beds.length} OCCUPIED`}
      </Text>

      {/* Beds */}
      {beds.map((bed, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const localX = -w / 2 + 0.3 + cellW / 2 + col * cellW;
        const localZ = -d / 2 + 0.95 + cellD / 2 + row * cellD;
        return <BedBox key={bed.id} bed={bed} x={localX} z={localZ} cellW={cellW * 0.7} cellD={cellD * 0.7} />;
      })}
    </group>
  );
};

// ────────────────────────────────────────────────────────────────────
// Single bed — extruded box, color/glow drives state
// ────────────────────────────────────────────────────────────────────
const BedBox: React.FC<{ bed: Bed; x: number; z: number; cellW: number; cellD: number }> = ({
  bed,
  x,
  z,
  cellW,
  cellD,
}) => {
  const isCritical = bed.state === 'occupied' && bed.acuity != null && bed.acuity <= 1;
  const visual = isCritical ? CRITICAL_VISUAL : BED_VISUAL[bed.state];
  const isReserved = bed.state === 'reserved';

  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    if (isCritical) {
      // Pulse hard for ESI-1 patients
      ref.current.emissiveIntensity = visual.emissiveIntensity + Math.sin(t * 4) * 0.35;
    } else if (isReserved) {
      ref.current.emissiveIntensity = visual.emissiveIntensity + Math.sin(t * 2.4) * 0.2;
    }
  });

  const w = Math.max(0.3, cellW);
  const d = Math.max(0.25, cellD);

  return (
    <mesh position={[x, visual.height / 2, z]}>
      <boxGeometry args={[w, visual.height, d]} />
      <meshStandardMaterial
        ref={ref}
        color={visual.color}
        emissive={visual.emissive}
        emissiveIntensity={visual.emissiveIntensity}
        roughness={0.55}
        metalness={0.1}
      />
    </mesh>
  );
};

// ────────────────────────────────────────────────────────────────────
// EMS arrivals — moving dots traveling from south edge to ED entrance
// ────────────────────────────────────────────────────────────────────
const EmsDot: React.FC<{
  unit: string;
  etaSec: number;
  critical: boolean;
}> = ({ unit, etaSec, critical }) => {
  // ETA mapped to position along route. ETA 0 = at building edge,
  // ETA 600 = far away. Build a spline-ish path entering from
  // off-screen south and curving toward ed-trauma's footprint.
  const progress = Math.max(0, Math.min(1, 1 - etaSec / 600));
  const x = -14 + progress * 7; // start far southwest
  const z = 18 - progress * 11; // approach south edge
  const color = critical ? '#FF3838' : '#19E3C2';

  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.4 + Math.sin(clock.getElapsedTime() * 4) * 0.04;
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
        />
      </mesh>
      {/* Halo */}
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, 0.95, 0]}
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

// ────────────────────────────────────────────────────────────────────
// Main scene composition
// ────────────────────────────────────────────────────────────────────
const Scene: React.FC<{
  bedUnits: BedUnit[];
  activeScenario: ScenarioState | null;
}> = ({ bedUnits, activeScenario }) => {
  const { inbound } = useEmsInbound();
  const sev = activeScenario?.severity ?? null;

  return (
    <>
      <SceneRig scenarioSeverity={sev} />
      <Floor />
      <RadarSweep scenarioSeverity={sev} />

      {bedUnits.map((unit, i) => {
        const placement = WARD_PLACEMENT[unit.id] ?? fallbackPlacement(i);
        return <Ward key={unit.id} unit={unit} placement={placement} />;
      })}

      {/* Live EMS dots */}
      {inbound
        .filter((r) => !r.arrived && r.etaSeconds < 600)
        .slice(0, 6)
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

// ────────────────────────────────────────────────────────────────────
// Public component — render-safe Canvas wrapper
// ────────────────────────────────────────────────────────────────────
export const BedDroneView: React.FC<{
  bedUnits: BedUnit[];
  activeScenario: ScenarioState | null;
  height?: number | string;
}> = ({ bedUnits, activeScenario, height = '100%' }) => {
  return (
    <div style={{ width: '100%', height, background: '#050505', position: 'relative' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 16, 14], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#050505' }}
      >
        <Suspense fallback={null}>
          <Scene bedUnits={bedUnits} activeScenario={activeScenario} />
        </Suspense>
      </Canvas>
    </div>
  );
};
