import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
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
// Role data — the tactical framing adds access level + scope.
// ─────────────────────────────────────────────────────────────────────────
type RoleEntry = {
  id: string;
  role: UserRole;
  title: string;
  description: string;
  access: string;
  scope: string;
};

const ROLES: RoleEntry[] = [
  {
    id: 'ROLE_01',
    role: UserRole.MANAGER,
    title: 'Operations Director',
    description: 'Hospital-wide situational awareness, capacity & surge command.',
    access: 'L3_ADMIN',
    scope: 'HOSPITAL_WIDE',
  },
  {
    id: 'ROLE_02',
    role: UserRole.NURSE,
    title: 'Charge Nurse',
    description: 'Unit-level patient coordination, vitals, and care assignments.',
    access: 'L2_CLINICAL',
    scope: 'UNIT_FLOOR',
  },
  {
    id: 'ROLE_03',
    role: UserRole.ER_PERSONNEL,
    title: 'Trauma Attending',
    description: 'Trauma bay management, rapid response, and triage authority.',
    access: 'L2_TRAUMA',
    scope: 'TRAUMA_BAYS',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// RoleCard — the main interactive element.
// Uses the shared TacticalCard (interactive=true) which handles the hover
// bracket reveal, accent bar slide-in, and scan sweep. This file adds the
// motion entrance and the role-specific content.
// ─────────────────────────────────────────────────────────────────────────
const RoleCard: React.FC<{
  entry: RoleEntry;
  index: number;
  onSelect: (role: UserRole) => void;
}> = ({ entry, index, onSelect }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.35 + index * 0.08,
        duration: 0.45,
        ease: MOTION.ease,
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <TacticalCard
        interactive
        role="button"
        tabIndex={0}
        onClick={() => onSelect(entry.role)}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(entry.role);
          }
        }}
        padding="none"
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '18px 20px 16px',
        }}
      >
        {/* Header row: id + status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Mono tone="secondary">// {entry.id}</Mono>
          <StatusPill label="Ready" tone="ok" />
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: FONTS.sans,
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            margin: 0,
            marginBottom: 6,
          }}
        >
          {entry.title}
        </h3>

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

        {/* Footer row: access / scope / enter */}
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
              <Mono tone="muted">Scope</Mono>
              <Mono tone="primary">{entry.scope}</Mono>
            </div>
          </div>
          <motion.div
            animate={{ x: hovered ? 4 : 0 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Mono tone={hovered ? 'accent' : 'secondary'}>Enter</Mono>
            <ArrowRight
              size={14}
              color={hovered ? COLORS.accent : COLORS.textSecondary}
              strokeWidth={2}
            />
          </motion.div>
        </div>
      </TacticalCard>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export const LoginScreenTactical: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const isMobile = useIsMobile();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = now.toUTCString().slice(17, 25); // HH:MM:SS
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '.'); // YYYY.MM.DD

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
      {/* Background layers */}
      <DotGridBg />
      <GlowBg origin="bottom" />
      <ScanningLine />

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
            <Mono tone="secondary">// Secure access · Select operator role to proceed</Mono>
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
                onSelect={onLogin}
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
    </div>
  );
};

export default LoginScreenTactical;
