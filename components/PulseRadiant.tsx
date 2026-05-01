/**
 * PulseRadiant — reverse decision-tree topology of how PULSE thinks.
 *
 * 2026-05-01 (rewrite) · Out: glowing constellation of abstract spheres
 * with starfield. In: PULSE-tactical data widgets arranged as an
 * inverted decision tree — wide base of raw inputs, narrowing through
 * pattern recognition + scenarios, converging to a small tip of
 * decisions. Pulses propagate UP the tree (data → decisions).
 *
 * Architecture:
 *
 *                               [ DECISIONS ]                    ← layer 4 (3 widgets)
 *                                  / | \
 *                            [ SCENARIOS ]                       ← layer 3 (6 widgets)
 *                              / | | | \
 *                       [ PATTERNS / RISKS ]                     ← layer 2 (12 widgets)
 *                        / / | | | | | \ \
 *               [ RAW DATA INPUTS ]                              ← layer 1 (30 widgets)
 *
 * All four layers stacked vertically in 3D. Camera looks at the
 * structure from the side (slightly above mid-height). Slow auto-
 * rotate continues under user grab.
 *
 * Widgets:
 *   • Rendered as drei <Html> overlays so they're real DOM, real
 *     PULSE styling (tactical cards, Mono labels, BracketLabel,
 *     rose accent). Not WebGL primitives.
 *   • Each carries a label + (sometimes) a value + a category dot.
 *   • Colors graduate from neutral at the base to rose at the tip.
 *
 * Edges:
 *   • Line segments (WebGL) connecting each widget to 1-3 widgets
 *     in the layer above.
 *   • Bloom post-processing for the cinematic glow.
 *   • Decision pulses spawn at the bottom and travel UP, threading
 *     through the network. ~32% are rose-accent (decision-relevant);
 *     rest are amber (data flow).
 *
 * Background: deep black + faint rose radial glow at the floor. NO
 * stars. Matches PULSE canvas.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { COLORS, FONTS, SPACE, RADIUS } from './design';

// ──────────────────────────────────────────────────────────────────
// Widget catalog — what PULSE actually thinks about
// ──────────────────────────────────────────────────────────────────

type Layer = 1 | 2 | 3 | 4;

type Tone = 'muted' | 'info' | 'warn' | 'accent';

interface Widget {
  id: number;
  layer: Layer;
  label: string;
  value?: string;
  /** Used to color the dot. */
  tone: Tone;
}

// LAYER 1 — RAW INPUTS (the wide base, 30 widgets)
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
  { label: 'Ambulance availability', value: '6 / 9',   tone: 'warn' },
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

// LAYER 3 — SCENARIOS / WHAT-IFS (6 widgets)
const LAYER_3: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Baseline projection',  value: 'NEDOCS 124', tone: 'info' },
  { label: 'Mild surge',          value: 'NEDOCS 142', tone: 'warn' },
  { label: 'Moderate surge',      value: 'NEDOCS 168', tone: 'warn' },
  { label: 'Mass casualty',       value: 'NEDOCS 184', tone: 'accent' },
  { label: 'Regional divert',     value: '4 hospitals', tone: 'warn' },
  { label: 'Recovery curve',      value: '−40m by 18:00', tone: 'info' },
];

// LAYER 4 — DECISIONS (3 widgets at the tip)
const LAYER_4: Omit<Widget, 'id' | 'layer'>[] = [
  { label: 'Pre-stage float',     value: '2 RN · 20m warm', tone: 'accent' },
  { label: 'Activate surge',      value: 'Tier 2 · ready',  tone: 'accent' },
  { label: 'Post divert',         value: 'Regional grid',   tone: 'accent' },
];

// Build all widgets with assigned ids + layers
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
// Layout — stacked rings, decreasing radius going UP
// ──────────────────────────────────────────────────────────────────
interface PreparedWidget extends Widget {
  position: THREE.Vector3;
  /** Pulse phase for breathing animation */
  phase: number;
}

const layoutWidgets = (widgets: Widget[]): PreparedWidget[] => {
  const prepared: PreparedWidget[] = [];
  // Layer geometry — Y increases going up (toward decisions).
  // Radius decreases going up so the tree narrows.
  const layerSpec = {
    1: { y: -8.5, radius: 13 },
    2: { y: -2.5, radius: 7.5 },
    3: { y:  3.5, radius: 4.0 },
    4: { y:  8.5, radius: 1.6 },
  } as const;

  // Group widgets by layer
  const byLayer = new Map<Layer, Widget[]>([[1, []], [2, []], [3, []], [4, []]]);
  widgets.forEach((w) => byLayer.get(w.layer)!.push(w));

  // Place each layer in a ring on the X-Z plane at its Y
  byLayer.forEach((items, layer) => {
    const spec = layerSpec[layer];
    const n = items.length;
    items.forEach((w, i) => {
      // Slight stagger / phase offset per layer to break perfect ring
      const angle = (i / n) * Math.PI * 2 + (layer * 0.3);
      const r = spec.radius * (1 + (Math.sin(i * 1.7 + layer) * 0.06));
      const yJitter = Math.sin(i * 2.3 + layer * 1.1) * 0.4;
      prepared.push({
        ...w,
        position: new THREE.Vector3(
          Math.cos(angle) * r,
          spec.y + yJitter,
          Math.sin(angle) * r,
        ),
        phase: (i + layer * 4.7) * 0.6,
      });
    });
  });

  return prepared;
};

// ──────────────────────────────────────────────────────────────────
// Edge generation — fan UP from each lower widget to nearest in upper
// ──────────────────────────────────────────────────────────────────
interface Edge {
  from: number;
  to: number;
  /** 1 if this edge crosses to a higher layer (used for pulse direction) */
  upward: 1;
}

const buildEdges = (widgets: PreparedWidget[]): Edge[] => {
  const edges: Edge[] = [];
  const byLayer = new Map<Layer, PreparedWidget[]>([[1, []], [2, []], [3, []], [4, []]]);
  widgets.forEach((w) => byLayer.get(w.layer)!.push(w));

  // For each lower-layer widget, find K nearest in the layer above and
  // connect to them. K controls fan-in density.
  const connectLayer = (lower: Layer, upper: Layer, k: number) => {
    const lowerNodes = byLayer.get(lower)!;
    const upperNodes = byLayer.get(upper)!;
    lowerNodes.forEach((from) => {
      // Compute distance to every upper node, sort, take top-k
      const distances = upperNodes
        .map((to) => ({ to, d: from.position.distanceTo(to.position) }))
        .sort((a, b) => a.d - b.d);
      for (let i = 0; i < Math.min(k, distances.length); i++) {
        edges.push({ from: from.id, to: distances[i].to.id, upward: 1 });
      }
    });
  };

  connectLayer(1, 2, 2);  // each input feeds 2 patterns
  connectLayer(2, 3, 2);  // each pattern feeds 2 scenarios
  connectLayer(3, 4, 2);  // each scenario feeds 2 decisions

  return edges;
};

// ──────────────────────────────────────────────────────────────────
// Widget HTML card (drei Html overlay — real PULSE tactical style)
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

const layerWidth = (layer: Layer): number => {
  switch (layer) {
    case 4:
      return 168;
    case 3:
      return 156;
    case 2:
      return 144;
    case 1:
    default:
      return 134;
  }
};

const WidgetCard: React.FC<{ widget: PreparedWidget }> = ({ widget }) => {
  const dotColor = toneColor(widget.tone);
  const isAccent = widget.tone === 'accent';
  const w = layerWidth(widget.layer);
  const borderColor = isAccent
    ? COLORS.accent
    : widget.layer >= 3
    ? COLORS.borderStrong
    : COLORS.border;
  const labelTone = isAccent ? COLORS.accent : COLORS.textPrimary;

  return (
    <div
      style={{
        // Counteract the 3D rotation — keep cards flat to camera (handled
        // by drei Html `transform={false}` mode, default.) Width fixed
        // so multi-line labels wrap predictably.
        width: w,
        background: COLORS.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        padding: `${SPACE.xs + 2}px ${SPACE.sm + 2}px`,
        fontFamily: FONTS.mono,
        boxShadow: isAccent
          ? `0 0 14px ${COLORS.accentGlow}`
          : `0 4px 12px rgba(0, 0, 0, 0.6)`,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Top row — dot + label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: widget.value ? 4 : 0,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: labelTone,
            lineHeight: 1.15,
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
            fontSize: widget.layer >= 3 ? 12 : 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: isAccent ? COLORS.accentBright : COLORS.textPrimary,
            fontVariantNumeric: 'tabular-nums',
            paddingLeft: 11, // align under label after the dot
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
// Edge renderer — single LineSegments geometry, shimmer over time
// ──────────────────────────────────────────────────────────────────
const Edges: React.FC<{ widgets: PreparedWidget[]; edges: Edge[] }> = ({
  widgets,
  edges,
}) => {
  const meshRef = useRef<THREE.LineSegments>(null);

  const { geometry, baseColors } = useMemo(() => {
    const positions = new Float32Array(edges.length * 6);
    const colors = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      const a = widgets[e.from].position;
      const b = widgets[e.to].position;
      positions[i * 6 + 0] = a.x;
      positions[i * 6 + 1] = a.y;
      positions[i * 6 + 2] = a.z;
      positions[i * 6 + 3] = b.x;
      positions[i * 6 + 4] = b.y;
      positions[i * 6 + 5] = b.z;

      // Color: dim rose for upward edges, brightness scales with how
      // close the edge is to the decision tip (higher Y = brighter).
      const tipY = (a.y + b.y) / 2;
      const brightness = 0.18 + Math.max(0, (tipY + 9) / 18) * 0.4;
      const c = new THREE.Color('#7a3a4a').multiplyScalar(brightness);
      colors[i * 6 + 0] = c.r;
      colors[i * 6 + 1] = c.g;
      colors[i * 6 + 2] = c.b;
      colors[i * 6 + 3] = c.r;
      colors[i * 6 + 4] = c.g;
      colors[i * 6 + 5] = c.b;
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return { geometry: g, baseColors: colors };
  }, [widgets, edges]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const colorAttr = meshRef.current.geometry.attributes.color;
    const arr = colorAttr.array as Float32Array;
    for (let i = 0; i < edges.length; i++) {
      const shimmer = 0.85 + Math.sin(t * 0.45 + i * 0.13) * 0.25;
      const r = baseColors[i * 6 + 0] * shimmer;
      const g = baseColors[i * 6 + 1] * shimmer;
      const b = baseColors[i * 6 + 2] * shimmer;
      arr[i * 6 + 0] = r;
      arr[i * 6 + 1] = g;
      arr[i * 6 + 2] = b;
      arr[i * 6 + 3] = r;
      arr[i * 6 + 4] = g;
      arr[i * 6 + 5] = b;
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={meshRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
};

// ──────────────────────────────────────────────────────────────────
// Decision pulses — bright travelers moving UP the tree
// ──────────────────────────────────────────────────────────────────
interface PulseTraveler {
  edgeIdx: number;
  startedAt: number;
  duration: number;
  color: THREE.Color;
}

const Pulses: React.FC<{ widgets: PreparedWidget[]; edges: Edge[] }> = ({
  widgets,
  edges,
}) => {
  const pulsesRef = useRef<PulseTraveler[]>([]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const MAX_PULSES = 14;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorBuf = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (pulsesRef.current.length >= MAX_PULSES) return;
      const edgeIdx = Math.floor(Math.random() * edges.length);
      const isAccent = Math.random() < 0.42;
      const color = isAccent
        ? new THREE.Color(COLORS.accentBright)
        : new THREE.Color('#FFB070');
      pulsesRef.current.push({
        edgeIdx,
        startedAt: performance.now(),
        duration: 1100 + Math.random() * 700,
        color,
      });
    }, 480);
    return () => window.clearInterval(id);
  }, [edges]);

  useFrame(() => {
    if (!meshRef.current) return;
    const now = performance.now();
    pulsesRef.current = pulsesRef.current.filter(
      (p) => now - p.startedAt < p.duration,
    );

    for (let i = 0; i < MAX_PULSES; i++) {
      const p = pulsesRef.current[i];
      if (!p) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const edge = edges[p.edgeIdx];
      const from = widgets[edge.from];
      const to = widgets[edge.to];
      // Always travel from the lower-layer widget to the upper-layer
      // widget, regardless of edge from/to ordering.
      const a = from.layer < to.layer ? from.position : to.position;
      const b = from.layer < to.layer ? to.position : from.position;
      const t = Math.min(1, (now - p.startedAt) / p.duration);
      const pos = a.clone().lerp(b, t);
      dummy.position.copy(pos);
      const env = Math.sin(t * Math.PI);
      dummy.scale.setScalar(0.06 + env * 0.16);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorBuf.copy(p.color).multiplyScalar(env);
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
// Camera rig — slight angle, slow auto-rotate
// ──────────────────────────────────────────────────────────────────
const Rig: React.FC = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 2, 28);
  }, [camera]);
  return (
    <OrbitControls
      enablePan={false}
      autoRotate
      autoRotateSpeed={0.35}
      enableDamping
      dampingFactor={0.09}
      minDistance={14}
      maxDistance={55}
      // Constrain so user can't go below the floor or fully above.
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.82}
      target={[0, 1, 0]}
      makeDefault
    />
  );
};

// ──────────────────────────────────────────────────────────────────
// Layer markers — subtle floor/ceiling tags reading "INPUTS" / "DECISIONS"
// ──────────────────────────────────────────────────────────────────
const LayerMarkers: React.FC = () => (
  <>
    <Html
      position={[0, -10.5, 0]}
      center
      distanceFactor={14}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.32em',
          color: COLORS.textMuted,
          textTransform: 'uppercase',
          opacity: 0.7,
          whiteSpace: 'nowrap',
        }}
      >
        ▼ RAW INPUTS · 30 SOURCES
      </div>
    </Html>
    <Html
      position={[0, 10.6, 0]}
      center
      distanceFactor={14}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.32em',
          color: COLORS.accent,
          textTransform: 'uppercase',
          opacity: 0.95,
          whiteSpace: 'nowrap',
          textShadow: `0 0 8px ${COLORS.accentGlow}`,
        }}
      >
        ▲ DECISIONS · 3 ACTIONABLE
      </div>
    </Html>
  </>
);

// ──────────────────────────────────────────────────────────────────
// Scene composition
// ──────────────────────────────────────────────────────────────────
const Scene: React.FC = () => {
  const { widgets, edges } = useMemo(() => {
    const catalog = buildCatalog();
    const positioned = layoutWidgets(catalog);
    const e = buildEdges(positioned);
    return { widgets: positioned, edges: e };
  }, []);

  return (
    <>
      <color attach="background" args={[COLORS.bg]} />
      <Edges widgets={widgets} edges={edges} />
      <Pulses widgets={widgets} edges={edges} />

      {widgets.map((w) => (
        <Html
          key={w.id}
          position={[w.position.x, w.position.y, w.position.z]}
          center
          distanceFactor={14}
          style={{ pointerEvents: 'none' }}
          // zIndexRange caps the overlay z so the HUD stays above
          zIndexRange={[100, 0]}
          occlude={false}
        >
          <WidgetCard widget={w} />
        </Html>
      ))}

      <LayerMarkers />
      <Rig />

      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={0.18} luminanceSmoothing={0.7} mipmapBlur />
      </EffectComposer>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Public component
// ──────────────────────────────────────────────────────────────────
export const PulseRadiant: React.FC<{ height?: number | string }> = ({
  height = '100%',
}) => {
  return (
    <div style={{ width: '100%', height, background: COLORS.bg, position: 'relative' }}>
      {/* Floor glow — radial rose at bottom, matches PULSE canvas */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 70% 45% at 50% 110%, ${COLORS.accentDim}, transparent 60%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Faint dot grid masked to center — same pattern as the rest of PULSE */}
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
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 2, 28], fov: 50, near: 0.1, far: 200 }}
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
          opacity: 0.65,
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
};
