/**
 * RehoboamOrb — PULSE's cinematic AI activity sphere.
 *
 * A volumetric point-cloud globe (Westworld-Rehoboam language, PULSE
 * tactical palette): thousands of shell points slowly rotating, faint
 * data strands sweeping the surface, particles spiralling into a
 * glowing core. The core hue + inflow colour are driven by the live
 * `lib/pulseAI` activity for the given surface, so the orb visualises
 * what the AI is doing (auto / needs-you / escalated / watching).
 *
 * Reuses the project's proven Three.js stack (same as PulseRadiant:
 * @react-three/fiber + drei + postprocessing Bloom). Respects
 * prefers-reduced-motion: renders a single static frame, no animation.
 *
 * Default-exported so callers can `React.lazy(() => import(...))` and
 * keep the heavy three bundle off non-orb screens.
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { COLORS } from './design';
import { useAiActivity } from '../lib/pulseAI';
import type { AiSurface, AiActivityEvent } from '../lib/pulseAI';

// ── Palette: map the dominant AI activity to a tone ────────────────
function dominantTone(events: AiActivityEvent[]): string {
  if (events.some((e) => e.kind === 'escalated')) return COLORS.warn;
  if (events.some((e) => e.kind === 'awaiting_review')) return COLORS.accent;
  if (events.some((e) => e.kind === 'auto_executed')) return COLORS.info;
  return COLORS.textMuted;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return !!reduced;
}

// ── Fibonacci sphere shell ─────────────────────────────────────────
function fibonacciSphere(n: number, radius: number): Float32Array {
  const pts = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts[i * 3] = Math.cos(theta) * r * radius;
    pts[i * 3 + 1] = y * radius;
    pts[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return pts;
}

const R = 2.0; // sphere radius (world units)

// ── Shell point cloud ──────────────────────────────────────────────
const ShellPoints: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => fibonacciSphere(1600, R), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useFrame((_, delta) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.y += delta * 0.06;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.022}
        color={new THREE.Color(COLORS.textSecondary)}
        transparent
        opacity={0.55}
        sizeAttenuation
      />
    </points>
  );
};

// ── Drifting data strands across the surface ───────────────────────
const Strands: React.FC<{ tone: string; reduced: boolean }> = ({ tone, reduced }) => {
  const grp = useRef<THREE.Group>(null);
  const lines = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (let s = 0; s < 5; s++) {
      const tilt = (s / 5) * Math.PI;
      const ctrl: THREE.Vector3[] = [];
      for (let t = 0; t <= 48; t++) {
        const a = (t / 48) * Math.PI * 2;
        const v = new THREE.Vector3(
          Math.cos(a) * R,
          Math.sin(a) * R * 0.42,
          Math.sin(a) * R,
        );
        v.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
        ctrl.push(v);
      }
      const g = new THREE.BufferGeometry().setFromPoints(ctrl);
      out.push(g);
    }
    return out;
  }, []);
  useFrame((_, delta) => {
    if (reduced || !grp.current) return;
    grp.current.rotation.y -= delta * 0.04;
    grp.current.rotation.x += delta * 0.012;
  });
  return (
    <group ref={grp}>
      {lines.map((g, i) => (
        <primitive key={i} object={new THREE.Line(
          g,
          new THREE.LineBasicMaterial({
            color: new THREE.Color(tone),
            transparent: true,
            opacity: 0.22,
          }),
        )} />
      ))}
    </group>
  );
};

// ── Inflow particles spiralling into the core ──────────────────────
const Inflow: React.FC<{ tone: string; reduced: boolean }> = ({ tone, reduced }) => {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 150;
  const { positions, seeds } = useMemo(() => {
    const p = new Float32Array(COUNT * 3);
    const s = new Float32Array(COUNT); // progress 0..1 toward core
    for (let i = 0; i < COUNT; i++) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize();
      p[i * 3] = dir.x * R;
      p[i * 3 + 1] = dir.y * R;
      p[i * 3 + 2] = dir.z * R;
      s[i] = Math.random();
    }
    return { positions: p, seeds: s };
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);
  useFrame((_, delta) => {
    if (reduced || !ref.current) return;
    const attr = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      seeds[i] += delta * (0.18 + (i % 7) * 0.012);
      if (seeds[i] >= 1) seeds[i] = 0;
      const k = 1 - seeds[i]; // 1 at shell -> 0 at core
      const ix = i * 3;
      // spiral: rotate the shell vector as it falls in
      const bx = positions[ix];
      const by = positions[ix + 1];
      const bz = positions[ix + 2];
      const ang = seeds[i] * 6.0;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      attr.setXYZ(
        i,
        (bx * cs - bz * sn) * k,
        by * k,
        (bx * sn + bz * cs) * k,
      );
    }
    attr.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.05}
        color={new THREE.Color(tone)}
        transparent
        opacity={0.85}
        sizeAttenuation
      />
    </points>
  );
};

// ── Pulsing core ───────────────────────────────────────────────────
const Core: React.FC<{ tone: string; reduced: boolean }> = ({ tone, reduced }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (reduced || !ref.current) return;
    const p = 0.85 + Math.sin(clock.elapsedTime * 2.2) * 0.12;
    ref.current.scale.setScalar(p);
    ref.current.rotation.y += 0.01;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.42, 1]} />
      <meshBasicMaterial color={new THREE.Color(tone)} toneMapped={false} />
    </mesh>
  );
};

const Scene: React.FC<{ tone: string; reduced: boolean }> = ({ tone, reduced }) => (
  <>
    <ShellPoints reduced={reduced} />
    <Strands tone={tone} reduced={reduced} />
    <Inflow tone={tone} reduced={reduced} />
    <Core tone={tone} reduced={reduced} />
    <EffectComposer>
      <Bloom
        intensity={1.15}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    </EffectComposer>
  </>
);

export interface RehoboamOrbProps {
  surface: AiSurface;
  /** Pixel height of the canvas. Panels ~200, the #9 page large ~480. */
  height?: number;
  style?: React.CSSProperties;
}

const RehoboamOrb: React.FC<RehoboamOrbProps> = ({ surface, height = 200, style }) => {
  const events = useAiActivity(surface);
  const reduced = useReducedMotion();
  const tone = useMemo(() => dominantTone(events), [events]);

  return (
    <div
      style={{
        width: '100%',
        height,
        position: 'relative',
        ...style,
      }}
      aria-hidden
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop={reduced ? 'demand' : 'always'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6.2], fov: 50, near: 0.1, far: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene tone={tone} reduced={reduced} />
      </Canvas>
    </div>
  );
};

export default RehoboamOrb;
