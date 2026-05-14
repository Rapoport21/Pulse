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
 * full name + last-active) so the login reads like a real identity
 * provider instead of three abstract role slots. Names match
 * data/userProfiles.ts so the dashboard headers reflect whoever signed
 * in here. Selection is immediate — no interstitial modal.
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
// role chrome. Clicking fires onSelect immediately — no interstitial.
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
            marginBottom: 14,
          }}
        >
          <Mono tone="secondary">// {entry.id}</Mono>
          <StatusPill label="Ready" tone="ok" />
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
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: COLORS.textPrimary,
            }}
          >
            {entry.personnelInitials}
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

        {/* Footer row: access / last-active / enter */}
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
  // Connection status is shown by the app-wide ConnectionIndicator
  // (DebugPanel.tsx), not on the login HUD itself. The hook stays
  // referenced via the import so the lib stays included; if it gets
  // truly dead we can prune later.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Local time — matches what the user sees on their device clock.
  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '.'); // YYYY.MM.DD

  const handleSelect = (role: UserRole) => {
    // Gentle haptic acknowledgement on supported devices — some embedded
    // webviews throw, so wrap it defensively.
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* ignore */
      }
    }
    onLogin(role);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // 100lvh = LARGEST viewport (full physical screen, even when
        // iOS Safari URL bar is visible). The dark login bg extends
        // BEHIND the URL bar / home indicator, which overlay it.
        // The inner HudStrips + content already pad with
        // env(safe-area-inset-*) so tap targets stay visible.
        minHeight: '100vh',
        height: '100lvh',
        width: '100%',
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
            </>
          )}
          {/* "System Online" pill removed: it was hardcoded tone="ok",
              never reflected real state, and duplicated the real
              ConnectionIndicator (floating bottom-left, app-wide). */}
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
              <Mono tone="accent">{timeStr}</Mono>
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
            <Mono tone="dim">TLS 1.3 · Session-bound</Mono>
            <Mono tone="dim">
              Node ER-01 · Uplink{' '}
              <span style={{ color: COLORS.ok }}>STABLE</span>
            </Mono>
          </motion.div>
        </div>
      </div>

      {/* Bottom HUD intentionally removed. Connection status is
          surfaced app-wide by the single ConnectionIndicator pill
          (floating bottom-left, lib: DebugPanel.tsx). No need to
          duplicate it on the login surface. */}
    </div>
  );
};

export default LoginScreenTactical;
