import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ScanFace, Check, Loader2 } from 'lucide-react';
import { UserRole } from '../types';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  CornerBracket,
  HudStrip,
  DotGridBg,
  GlowBg,
  ScanningLine,
  TacticalCard,
} from './design';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

/**
 * LoginScreenTactical — Direction A (the chosen direction).
 *
 * Aesthetic: Palantir / Anduril tactical HUD × PULSE boot-screen language.
 * Bracket decorations, monospace data, sharp corners, rose accent, scanlines,
 * fixed top/bottom HUD strips with live system data.
 *
 * Built entirely on the shared tactical design system in `./design`.
 *
 * Fidelity layer — each role card now carries a named operator (avatar +
 * full name) so the login reads like a real identity provider instead of
 * three abstract role slots. Selecting a role drops a biometric auth
 * overlay ("SCANNING BIOMETRIC" → "AUTHENTICATED") that holds for ~1.6s
 * before the dashboard mounts. The overlay is not a demo affordance —
 * it's the same chrome the rest of PULSE uses, extended one screen back.
 */

// Simple viewport-width hook — mobile breakpoint = 640px.
const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
};

// ─────────────────────────────────────────────────────────────────────────
// Role data — each card is a named operator, not just a role slot. Names
// are kept in sync with data/userProfiles.ts so the dashboard headers
// reflect whoever signed in here.
// ─────────────────────────────────────────────────────────────────────────
type RoleEntry = {
  id: string;
  role: UserRole;
  title: string;
  description: string;
  access: string;
  scope: string;
  personnelName: string;
  personnelInitials: string;
  lastActive: string;
};

const ROLES: RoleEntry[] = [
  {
    id: 'ROLE_01',
    role: UserRole.MANAGER,
    title: 'Operations Director',
    description:
      'Hospital-wide situational awareness, capacity & surge command.',
    access: 'L3_ADMIN',
    scope: 'HOSPITAL_WIDE',
    personnelName: 'Sarah Chen',
    personnelInitials: 'SC',
    lastActive: '06:12',
  },
  {
    id: 'ROLE_02',
    role: UserRole.NURSE,
    title: 'Charge Nurse',
    description:
      'Unit-level patient coordination, vitals, and care assignments.',
    access: 'L2_CLINICAL',
    scope: 'UNIT_FLOOR',
    personnelName: 'David Miller',
    personnelInitials: 'DM',
    lastActive: '07:04',
  },
  {
    id: 'ROLE_03',
    role: UserRole.ER_PERSONNEL,
    title: 'Trauma Attending',
    description:
      'Trauma bay management, rapid response, and triage authority.',
    access: 'L2_TRAUMA',
    scope: 'TRAUMA_BAYS',
    personnelName: 'Dr. Emily Rostova',
    personnelInitials: 'ER',
    lastActive: '05:48',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// RoleCard — the main interactive element. Shows personnel identity +
// role chrome. Dim + disable other cards while one is authenticating.
// ─────────────────────────────────────────────────────────────────────────
const RoleCard: React.FC<{
  entry: RoleEntry;
  index: number;
  onSelect: (role: UserRole) => void;
  selected: boolean;
  anyAuthenticating: boolean;
}> = ({ entry, index, onSelect, selected, anyAuthenticating }) => {
  const [hovered, setHovered] = useState(false);
  const disabled = anyAuthenticating && !selected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: disabled ? 0.28 : 1,
        y: 0,
      }}
      transition={{
        delay: 0.35 + index * 0.08,
        duration: 0.45,
        ease: MOTION.ease,
      }}
      onHoverStart={() => !anyAuthenticating && setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <TacticalCard
        interactive={!anyAuthenticating}
        highlight={selected}
        role="button"
        aria-pressed={selected}
        tabIndex={anyAuthenticating ? -1 : 0}
        onClick={() => !anyAuthenticating && onSelect(entry.role)}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (anyAuthenticating) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(entry.role);
          }
        }}
        padding="none"
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer',
          pointerEvents: disabled ? 'none' : undefined,
          padding: '18px 20px 16px',
        }}
      >
        {/* Header row: id + status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <Mono tone="secondary">// {entry.id}</Mono>
          <StatusPill
            label={selected ? 'Authenticating' : 'Ready'}
            tone={selected ? 'warn' : 'ok'}
            pulse={selected}
          />
        </div>

        {/* Identity row: avatar + name + title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.surfaceElev,
              border: `1px solid ${selected ? COLORS.accent : COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: selected ? COLORS.accent : COLORS.textPrimary,
              position: 'relative',
              transition: `color ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
            }}
          >
            {entry.personnelInitials}
            {selected && (
              <>
                <CornerBracket position="tl" color={COLORS.accent} size={5} thickness={1.25} inset={-2} />
                <CornerBracket position="br" color={COLORS.accent} size={5} thickness={1.25} inset={-2} />
              </>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: COLORS.textPrimary,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.personnelName}
            </div>
            <Mono tone="muted" size="xs" style={{ marginTop: 4, display: 'block' }}>
              {entry.title}
            </Mono>
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.textSecondary,
            lineHeight: 1.45,
            margin: 0,
            marginBottom: 14,
            maxWidth: '92%',
          }}
        >
          {entry.description}
        </p>

        {/* Footer row: access / scope / last active / enter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTop: `1px dashed ${COLORS.border}`,
          }}
        >
          <div style={{ display: 'flex', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Mono tone="muted">Access</Mono>
              <Mono tone="primary">{entry.access}</Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Mono tone="muted">Last Active</Mono>
              <Mono tone="primary">{entry.lastActive}</Mono>
            </div>
          </div>
          <motion.div
            animate={{ x: hovered && !anyAuthenticating ? 4 : 0 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Mono tone={hovered && !anyAuthenticating ? 'accent' : 'secondary'}>
              {selected ? 'Scanning' : 'Enter'}
            </Mono>
            {selected ? (
              <Loader2
                size={14}
                color={COLORS.accent}
                strokeWidth={2}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            ) : (
              <ArrowRight
                size={14}
                color={hovered && !anyAuthenticating ? COLORS.accent : COLORS.textSecondary}
                strokeWidth={2}
              />
            )}
          </motion.div>
        </div>
      </TacticalCard>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// BiometricAuthOverlay — Face ID lookalike that plays out after a role
// card is selected. Three phases on a tight timeline so the screen feels
// alive without keeping the user waiting:
//
//   phase 1 "scanning"      — scanning line sweeps through a bracketed
//                             square, face icon pulses (~700 ms)
//   phase 2 "matching"      — scanning line stills, line copy flips,
//                             spinner shows we're locking a match (~450 ms)
//   phase 3 "authenticated" — green checkmark replaces the face icon,
//                             corner brackets flash emerald (~450 ms)
//
// Total runway ≈ 1.6 s — long enough to read as "biometric handshake",
// short enough that the operator never feels stalled.
// ─────────────────────────────────────────────────────────────────────────
type AuthPhase = 'scanning' | 'matching' | 'authenticated';

const BiometricAuthOverlay: React.FC<{
  entry: RoleEntry;
  onComplete: () => void;
}> = ({ entry, onComplete }) => {
  const [phase, setPhase] = useState<AuthPhase>('scanning');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('matching'), 700);
    const t2 = setTimeout(() => setPhase('authenticated'), 1150);
    const t3 = setTimeout(() => onComplete(), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  const phaseColor =
    phase === 'authenticated'
      ? COLORS.ok
      : phase === 'matching'
      ? COLORS.info
      : COLORS.accent;

  const phaseLabel =
    phase === 'authenticated'
      ? 'AUTHENTICATED'
      : phase === 'matching'
      ? 'MATCHING CREDENTIAL'
      : 'SCANNING BIOMETRIC';

  return (
    <motion.div
      key="biometric-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      style={{
        position: 'fixed',
        inset: 0,
        background: `${COLORS.bg}F5`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.xl,
        paddingLeft: SPACE.base,
        paddingRight: SPACE.base,
      }}
    >
      {/* Operator identity — reminds the user whose credential is being verified */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: MOTION.ease }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Mono tone="dim" size="xs">
          // {entry.id}
        </Mono>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: COLORS.textPrimary,
          }}
        >
          {entry.personnelName}
        </span>
        <Mono tone="muted" size="xs">
          {entry.title}
        </Mono>
      </motion.div>

      {/* Scanner frame */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: MOTION.ease }}
        style={{
          position: 'relative',
          width: 176,
          height: 176,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Inner frame fill */}
        <div
          style={{
            position: 'absolute',
            inset: 8,
            background: COLORS.surface,
            border: `1px solid ${phaseColor}55`,
            borderRadius: RADIUS.sm,
            boxShadow: `inset 0 0 32px ${phaseColor}22`,
            transition: `border-color ${MOTION.base}s ease, box-shadow ${MOTION.base}s ease`,
          }}
        />

        {/* Corner brackets — larger, accent color */}
        <CornerBracket position="tl" color={phaseColor} size={20} thickness={2} inset={0} />
        <CornerBracket position="tr" color={phaseColor} size={20} thickness={2} inset={0} />
        <CornerBracket position="bl" color={phaseColor} size={20} thickness={2} inset={0} />
        <CornerBracket position="br" color={phaseColor} size={20} thickness={2} inset={0} />

        {/* Sweeping scan line — only during phase 1 */}
        <AnimatePresence>
          {phase === 'scanning' && (
            <motion.div
              key="scan-line"
              initial={{ y: '-50%', opacity: 0 }}
              animate={{ y: '50%', opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 0.7,
                ease: 'linear',
                times: [0, 0.1, 0.9, 1],
              }}
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${phaseColor}, transparent)`,
                boxShadow: `0 0 12px ${phaseColor}`,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* Center icon — ScanFace → Check */}
        <AnimatePresence mode="wait">
          {phase === 'authenticated' ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              style={{
                position: 'relative',
                color: COLORS.ok,
                filter: `drop-shadow(0 0 12px ${COLORS.ok}88)`,
              }}
            >
              <Check size={64} strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="face"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              style={{
                position: 'relative',
                color: phaseColor,
                filter: `drop-shadow(0 0 8px ${phaseColor}66)`,
                animation: phase === 'scanning' ? 'pulse-dot 1s ease-in-out infinite' : undefined,
              }}
            >
              <ScanFace size={72} strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Phase label */}
      <motion.div
        key={phaseLabel}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: MOTION.ease }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <BracketLabel tone={phase === 'authenticated' ? 'ok' : phase === 'matching' ? 'info' : 'accent'}>
          {phaseLabel}
        </BracketLabel>
        <Mono tone="dim" size="xs">
          {phase === 'authenticated'
            ? 'Session established · dispatching shell'
            : phase === 'matching'
            ? 'Confirming identity against personnel registry'
            : 'Hold still — capturing biometric signature'}
        </Mono>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export const LoginScreenTactical: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => new Date());
  const [authenticatingRole, setAuthenticatingRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toUTCString().slice(17, 25); // HH:MM:SS
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '.'); // YYYY.MM.DD

  const authenticatingEntry = authenticatingRole
    ? ROLES.find((r) => r.role === authenticatingRole) ?? null
    : null;

  const handleSelect = (role: UserRole) => {
    // Trigger haptic on supported devices
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(8);
      } catch {
        // Safari + some embedded webviews throw — ignore.
      }
    }
    setAuthenticatingRole(role);
  };

  const handleAuthComplete = () => {
    if (authenticatingRole !== null) {
      onLogin(authenticatingRole);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        overflow: 'hidden',
      }}
    >
      {/* Background layers — login is a stationary surface, so the
          decorative ScanningLine was removed to let the role cards
          breathe. */}
      <DotGridBg />
      <GlowBg origin="bottom" color={COLORS.info + '08'} intensity={0.5} />

      {/* ── TOP HUD ─────────────────────────────────────────── */}
      <HudStrip side="top" fixed height={36}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: 1,
            minWidth: 0,
          }}
        >
          <BracketLabel tone="accent">PULSE</BracketLabel>
          {!isMobile && (
            <>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono
                tone="secondary"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Predictive Unified Logistics &amp; Surge Engine
              </Mono>
            </>
          )}
        </motion.div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {!isMobile && (
            <>
              <Mono tone="dim">v1.2.4</Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="dim">Build {dateStr}</Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
            </>
          )}
          <StatusPill label={isMobile ? 'Online' : 'System Online'} tone="ok" />
        </div>
      </HudStrip>

      {/* ── CENTER CONTENT ──────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isMobile ? 'flex-start' : 'center',
          // Top/bottom HudStrips are 36px + safe-area inset each.
          // Use max() so we always clear the strips on iPhone but
          // still get the original 68/72 px breathing room on
          // wide screens with no insets.
          paddingTop: isMobile
            ? `max(68px, calc(env(safe-area-inset-top) + 56px))`
            : `max(72px, calc(env(safe-area-inset-top) + 56px))`,
          paddingBottom: isMobile
            ? `max(68px, calc(env(safe-area-inset-bottom) + 56px))`
            : `max(72px, calc(env(safe-area-inset-bottom) + 56px))`,
          paddingLeft: isMobile
            ? `max(20px, env(safe-area-inset-left))`
            : `max(24px, env(safe-area-inset-left))`,
          paddingRight: isMobile
            ? `max(20px, env(safe-area-inset-right))`
            : `max(24px, env(safe-area-inset-right))`,
          zIndex: 10,
          overflowY: isMobile ? 'auto' : 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.lg,
          }}
        >
          {/* Brand block */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{ marginBottom: 12 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 14,
                marginBottom: 6,
              }}
            >
              <h1
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: isMobile ? TYPE.displaySm.size : TYPE.display.size,
                  fontWeight: TYPE.display.weight,
                  letterSpacing: TYPE.display.tracking,
                  lineHeight: TYPE.display.lineHeight,
                  margin: 0,
                  color: COLORS.textPrimary,
                }}
              >
                PULSE
              </h1>
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: `linear-gradient(90deg, ${COLORS.accent}, transparent)`,
                }}
              />
              <Mono tone="accent">{timeStr} UTC</Mono>
            </div>
            <Mono tone="secondary">// Secure access · Select operator to proceed</Mono>
          </motion.div>

          {/* Role cards */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {ROLES.map((entry, i) => (
              <RoleCard
                key={entry.id}
                entry={entry}
                index={i}
                onSelect={handleSelect}
                selected={authenticatingRole === entry.role}
                anyAuthenticating={authenticatingRole !== null}
              />
            ))}
          </div>

          {/* Auth hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            style={{
              marginTop: 8,
              paddingTop: 14,
              borderTop: `1px dashed ${COLORS.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <Mono tone="dim">Biometric auth · TLS 1.3 · Session-bound</Mono>
            <Mono tone="dim">
              Node ER-01 · Uplink{' '}
              <span style={{ color: COLORS.ok }}>STABLE</span>
            </Mono>
          </motion.div>
        </div>
      </div>

      {/* ── BOTTOM HUD ──────────────────────────────────────── */}
      <HudStrip side="bottom" fixed height={36}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: 1,
            flexWrap: 'nowrap',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <StatusPill
            label={isMobile ? 'NEDOCS 185' : 'NEDOCS 185 · Dangerous'}
            tone="crit"
          />
          {!isMobile && (
            <>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="secondary">Weather · Heavy Rain 16:00</Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="secondary">Active Surge Playbooks · 3</Mono>
            </>
          )}
        </motion.div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {!isMobile && <Mono tone="muted">Network</Mono>}
          <StatusPill label="Stable" tone="ok" />
        </div>
      </HudStrip>

      {/* ── BIOMETRIC AUTH OVERLAY ──────────────────────────── */}
      <AnimatePresence>
        {authenticatingEntry && (
          <BiometricAuthOverlay
            entry={authenticatingEntry}
            onComplete={handleAuthComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginScreenTactical;
