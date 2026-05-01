import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { UserRole } from '../types';
import {
  COLORS,
  FONTS,
  SPACE,
  MOTION,
  MACRO,
  SCANLINES,
  Mono,
  BracketLabel,
  StatusPill,
  Crosshair,
  HudStrip,
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(entry.role)}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(entry.role);
          }
        }}
        style={{
          position: 'relative',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          background: hovered ? COLORS.surfaceElev : COLORS.surface,
          border: `1px solid ${hovered ? COLORS.accent : COLORS.borderStrong}`,
          borderRadius: 0, // brutalist: 90 degrees
          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
          outline: 'none',
        }}
      >
        {/* Crosshairs at corners — appear on hover */}
        {hovered && (
          <>
            <Crosshair position="tl" color={COLORS.accent} size={10} thickness={1} overlap />
            <Crosshair position="tr" color={COLORS.accent} size={10} thickness={1} overlap />
            <Crosshair position="bl" color={COLORS.accent} size={10} thickness={1} overlap />
            <Crosshair position="br" color={COLORS.accent} size={10} thickness={1} overlap />
          </>
        )}

        {/* TOP STRIP — operator id band, full-width */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: SPACE.md,
            padding: `${SPACE.sm}px ${SPACE.lg}px`,
            background: COLORS.bgDeep,
            borderBottom: `1px solid ${COLORS.borderStrong}`,
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
          }}
        >
          <span>{entry.id}</span>
          <span style={{ color: hovered ? COLORS.accent : COLORS.textDim, justifySelf: 'start' }}>
            {`>>>`} {entry.scope}
          </span>
          <StatusPill label="Ready" tone="ok" size="xs" />
        </div>

        {/* MAIN — square block + identity + arrow column */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr auto',
            alignItems: 'stretch',
            gap: 0,
          }}
        >
          {/* Square initials block — sharp, brutalist, accent-tinted */}
          <div
            style={{
              width: 64,
              minHeight: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: hovered ? COLORS.accent : COLORS.surfaceElev,
              borderRight: `1px solid ${COLORS.borderStrong}`,
              fontFamily: FONTS.mono,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: hovered ? COLORS.textPrimary : COLORS.accent,
              transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
            }}
          >
            {entry.personnelInitials}
          </div>

          {/* Identity column */}
          <div
            style={{
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 4,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: COLORS.textPrimary,
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.personnelName}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: COLORS.textSecondary,
              }}
            >
              {entry.title}
            </div>
          </div>

          {/* Right arrow column — ASCII brutalist, not a chip */}
          <div
            style={{
              borderLeft: `1px solid ${COLORS.borderStrong}`,
              padding: `0 ${SPACE.lg}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.mono,
              fontSize: 13,
              letterSpacing: '0.12em',
              color: hovered ? COLORS.accent : COLORS.textMuted,
              transform: hovered ? 'translateX(2px)' : 'translateX(0)',
              transition: `color ${MOTION.fast}s ease, transform ${MOTION.fast}s ${MOTION.cssEase}`,
            }}
          >
            {`>>>`}
          </div>
        </div>

        {/* TABULAR DATA GRID — gap-1px divider trick */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: COLORS.borderStrong,
            borderTop: `1px solid ${COLORS.borderStrong}`,
          }}
        >
          {[
            ['ACCESS', entry.access],
            ['SCOPE', entry.scope.replace('_', ' ')],
            ['LAST', entry.lastActive],
            ['STATE', 'READY'],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                background: COLORS.surface,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 8,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: COLORS.textDim,
                }}
              >
                {k}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: COLORS.textPrimary,
                  fontWeight: 600,
                }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
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
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        overflow: 'hidden',
      }}
    >
      {/* CRT scanline static — full-bleed, on top of canvas, below content */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: SCANLINES.medium,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

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
            maxWidth: 720,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.xl,
          }}
        >
          {/* HERO BAND — section tag + accent rule + macro typography */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Section tag with full-width rule */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                marginBottom: SPACE.md,
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: COLORS.accent,
              }}
            >
              <span>+++</span>
              <span>OPERATOR · AUTHENTICATION</span>
              <span style={{ flex: 1, height: 1, background: COLORS.accent, opacity: 0.6, marginLeft: SPACE.sm }} />
              <span style={{ color: COLORS.textPrimary }}>{timeStr} UTC</span>
            </div>

            {/* MACRO HEADER — fluid clamp typography */}
            <h1
              style={{
                fontFamily: FONTS.sans,
                fontSize: isMobile ? 'clamp(3rem, 10vw, 5rem)' : MACRO.banner,
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 0.86,
                margin: 0,
                color: COLORS.textPrimary,
                textTransform: 'uppercase',
              }}
            >
              SELECT<br />OPERATOR
              <sup
                style={{
                  fontSize: '0.18em',
                  fontFamily: FONTS.mono,
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  color: COLORS.accent,
                  marginLeft: '0.05em',
                  verticalAlign: 'top',
                  top: '-0.6em',
                  position: 'relative',
                }}
              >
                ®
              </sup>
            </h1>

            {/* Sub-line with action prompt */}
            <div
              style={{
                marginTop: SPACE.sm,
                fontFamily: FONTS.mono,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: COLORS.textSecondary,
                display: 'flex',
                gap: SPACE.lg,
              }}
            >
              <span>3 PERSONNEL ON ROSTER</span>
              <span style={{ color: COLORS.textDim }}>│</span>
              <span>BIOMETRIC + SESSION-BOUND</span>
              <span style={{ color: COLORS.textDim }}>│</span>
              <span style={{ color: COLORS.ok }}>UPLINK STABLE</span>
            </div>
          </motion.div>

          {/* Role cards stack — 1px gap divider trick */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: COLORS.borderStrong,
              border: `1px solid ${COLORS.borderStrong}`,
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
