import { motion, useTransform, type MotionValue } from 'motion/react';
import { PinnedScrub } from '../components/PinnedScrub';
import { HudPanel } from '../components/HudPanel';

/**
 * Roles — pinned scrub, four roles. Direct port of Relats's "industries"
 * section pattern: a list on the left where the active item expands to
 * show a video preview, and a product/spec card on the right that
 * updates per active role.
 */

type Role = {
  id: string;
  name: string;
  surface: string;       // What surface they live in
  bigStat: string;
  bigStatLabel: string;
  capabilities: string[];
  accent: string;        // the role's status color
};

const ROLES: Role[] = [
  {
    id: 'manager',
    name: 'Operations Director',
    surface: 'COMMAND SURFACE · DESKTOP',
    bigStat: '90 min',
    bigStatLabel: 'forward-look horizon',
    capabilities: [
      'Capacity / Risk / Staffing forecasts',
      'Surge proposal review + confirm',
      'Cross-department task routing',
      'Replay & after-action review',
    ],
    accent: 'var(--accent)',
  },
  {
    id: 'charge',
    name: 'Charge Nurse',
    surface: 'UNIT SURFACE · TABLET',
    bigStat: '4 / 47',
    bigStatLabel: 'beds available · live',
    capabilities: [
      'Bed states with confidence flag',
      'Coverage gaps, not headcount',
      'Brief Me · 30s shift handoff',
      'Comms thread with Manager + EVS',
    ],
    accent: 'var(--info)',
  },
  {
    id: 'er',
    name: 'ER / Trauma Attending',
    surface: 'CLINICAL SURFACE · MOBILE',
    bigStat: '3 holds',
    bigStatLabel: 'ED → ICU pending',
    capabilities: [
      'Active patient list with acuity',
      'Orders + lab results inline',
      'Code activations + team paging',
      'Same data, simpler lens',
    ],
    accent: 'var(--warn)',
  },
  {
    id: 'evs',
    name: 'EVS · Transport',
    surface: 'OPS SURFACE · MOBILE',
    bigStat: '6 tasks',
    bigStatLabel: 'queued · ETA tracked',
    capabilities: [
      'Bed-turn task queue with ETAs',
      'Surge tasks routed automatically',
      'Status in two taps',
      'No more pages or whiteboards',
    ],
    accent: 'var(--ok)',
  },
];

export function Roles() {
  return (
    <PinnedScrub id="roles" viewports={14} variants={ROLES.length}>
      {({ progress, variantIndex }) => (
        <RolesInner progress={progress} variantIndex={variantIndex} />
      )}
    </PinnedScrub>
  );
}

function RolesInner({
  progress,
  variantIndex,
}: {
  progress: MotionValue<number>;
  variantIndex: MotionValue<number>;
}) {
  const headerOpacity = useTransform(progress, [0, 0.005], [1, 0]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.2 }} />

      {/* Section title (fades out as scrub starts) */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: headerOpacity,
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 24 }}>
            ROLE-AWARE SURFACES
          </div>
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 88px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 0.95 }}>
            Same data.<br />Four lenses.
          </h2>
        </div>
      </motion.div>

      {/* Role list (left) */}
      <div
        style={{
          position: 'absolute',
          left: 'clamp(24px, 5vw, 64px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(380px, 36vw)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 16, color: 'var(--text-2)' }}>
          ROLES · 04
        </div>
        {ROLES.map((r, i) => (
          <RoleRow key={r.id} role={r} index={i} variantIndex={variantIndex} progress={progress} />
        ))}
      </div>

      {/* Active role detail card (right) */}
      <div
        style={{
          position: 'absolute',
          right: 'clamp(24px, 5vw, 64px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 'min(520px, 42vw)',
        }}
      >
        {ROLES.map((r, i) => (
          <RoleCard key={r.id} role={r} index={i} variantIndex={variantIndex} progress={progress} />
        ))}
      </div>
    </div>
  );
}

function RoleRow({
  role,
  index,
  variantIndex,
  progress,
}: {
  role: Role;
  index: number;
  variantIndex: MotionValue<number>;
  progress: MotionValue<number>;
}) {
  const isActive = useTransform(variantIndex, (v) => Math.round(v) === index);
  const opacity = useTransform(isActive, (a) => (a ? 1 : 0.35));
  const color = useTransform(isActive, (a) => (a ? 'var(--text)' : 'var(--text-2)'));
  const previewHeight = useTransform(isActive, (a) => (a ? 168 : 0));
  const previewOpacity = useTransform(isActive, (a) => (a ? 1 : 0));
  // Prevent unused-progress warning while keeping the prop wired for future tweaks.
  void progress;

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 0' }}>
      <motion.div
        style={{
          opacity,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 'clamp(20px, 2.4vw, 32px)',
          fontWeight: 600,
          letterSpacing: '-0.025em',
        }}
      >
        <span>{role.name}</span>
        <motion.span style={{ opacity: useTransform(isActive, (a) => (a ? 1 : 0)), fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', color: role.accent }}>
          ACTIVE
        </motion.span>
      </motion.div>

      {/* Inline preview when active */}
      <motion.div
        style={{
          height: previewHeight,
          opacity: previewOpacity,
          overflow: 'hidden',
          marginTop: useTransform(isActive, (a) => (a ? 14 : 0)),
        }}
      >
        <RolePreview role={role} />
      </motion.div>
    </div>
  );
}

function RolePreview({ role }: { role: Role }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 160,
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        gap: 8,
      }}
    >
      <div className="eyebrow" style={{ color: role.accent, fontSize: 10 }}>
        {role.surface}
      </div>
      {/* Faux UI strips */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-2)',
              letterSpacing: '0.12em',
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: i === 1 ? role.accent : 'var(--border-strong)',
              }}
            />
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span>{['12', '04', '38', '92', '07'][i]}</span>
          </div>
        ))}
      </div>
      <div className="scanline" />
    </div>
  );
}

function RoleCard({
  role,
  index,
  variantIndex,
  progress,
}: {
  role: Role;
  index: number;
  variantIndex: MotionValue<number>;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(variantIndex, (v) => {
    const d = Math.abs(v - index);
    return Math.max(0, 1 - d * 1.6);
  });
  void progress;

  return (
    <motion.div style={{ position: 'absolute', inset: 0, opacity }}>
      <HudPanel label={role.surface} emphasized style={{ minHeight: 360 }}>
        <div
          style={{
            fontSize: 'clamp(48px, 6vw, 96px)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: role.accent,
          }}
        >
          {role.bigStat}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8 }}>
          {role.bigStatLabel.toUpperCase()}
        </div>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {role.capabilities.map((c) => (
            <div key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text)' }}>
              <span style={{ marginTop: 6, width: 4, height: 4, borderRadius: '50%', background: role.accent, flexShrink: 0 }} />
              <span style={{ lineHeight: 1.45 }}>{c}</span>
            </div>
          ))}
        </div>
      </HudPanel>
    </motion.div>
  );
}
