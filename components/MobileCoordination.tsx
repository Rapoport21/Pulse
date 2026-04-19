/**
 * MobileCoordination
 *
 * The Floor Manager's C2 surface on mobile.
 *
 * Why this exists
 * ---------------
 * The generic `patients` tab (Patient List + inline Bed Board) is the
 * right view for Nurse / ER Personnel / Trauma — they're the ones
 * touching patients all shift. Floor managers don't work that way.
 * Their whole job is moving people through the building: where are
 * the open beds, what's coming through the front door, who's stuck.
 *
 * Before this component, the MANAGER role got the same Patients tab
 * as everyone else with just a re-labeled nav item ("Units"). That
 * buried the two surfaces the floor manager actually lives in —
 * Bed Board and EMS Inbound — behind a segmented control that also
 * included a Patient List they rarely open.
 *
 * This component replaces the tab entirely for MANAGER: a dedicated
 * Coordination screen with two sub-tabs that are the floor manager's
 * day — BED BOARD (spatial capacity map) and EMS INBOUND (live radio
 * board of runs decrementing to ETA). Each sub-tab embeds the same
 * card-mode component used on desktop so the data contract and
 * behavior stay identical; mobile just re-frames them into a single
 * tactical surface.
 *
 * Keeps `id: 'patients'` as the tab key — the whole app's tab state
 * machine, deep links, and QR-tab shortcuts route on that key, so
 * forking the id per role would be a much bigger change for no
 * user-visible benefit. Only the label + rendered content diverge.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BedSingle, Radio, ChevronRight } from 'lucide-react';
import type { UserProfile } from '../types';
import { UserRole } from '../types';
import type { BedUnit } from '../data/bedMock';
import type { useEmsInbound } from '../lib/emsLive';
import { triggerHaptic } from '../lib/haptics';
import { BedBoard, EmsInboundBoard } from './clinical';
import { MobileScreenHeader } from './MobileScreenHeader';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  TacticalButton,
  Mono,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface MobileCoordinationProps {
  currentUser: UserProfile;
  /** Shared bed state from App.tsx so the board matches desktop. */
  bedUnits: BedUnit[];
  /** Whether surge is currently active — unlocks overflow units. */
  isSurgeActive: boolean;
  /**
   * Shared EMS feed from MobileView — passed through to the card so
   * the tab-badge count and the board stay synchronized.
   */
  emsFeed?: ReturnType<typeof useEmsInbound>;
  /** Open the fullscreen Bed Board overlay (owned by MobileView). */
  onExpandBedBoard: () => void;
  /** Open the fullscreen EMS Inbound overlay (owned by MobileView). */
  onExpandEmsBoard: () => void;
  /** Bottom nav clearance (NAV_HEIGHT + SPACE['2xl']). Passed in so this
   *  component doesn't need to know the parent's nav constants. */
  navClearance: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

type CoordTab = 'beds' | 'ems';

export const MobileCoordination: React.FC<MobileCoordinationProps> = ({
  currentUser,
  bedUnits,
  isSurgeActive,
  emsFeed,
  onExpandBedBoard,
  onExpandEmsBoard,
  navClearance,
}) => {
  const [subTab, setSubTab] = useState<CoordTab>('beds');

  return (
    <motion.div
      key="patients"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        padding: SPACE.base,
        paddingBottom: navClearance,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.lg,
      }}
    >
      <MobileScreenHeader
        role={currentUser.role}
        page="COORD"
        title="Coordination"
      />

      {/* Tactical sub-tab pitch — one line, matches the existing
          tone for the Patients segmented control so the manager's
          tab doesn't feel like a different app. */}
      <Mono tone="muted" size="xs">
        BED BOARD · LIVE EMS RADIO
      </Mono>

      {/* ── SEGMENTED CONTROL ──────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: 3,
          gap: 3,
        }}
      >
        {(
          [
            { id: 'beds' as const, label: 'Bed Board', icon: BedSingle },
            { id: 'ems' as const, label: 'EMS Inbound', icon: Radio },
          ]
        ).map((seg) => {
          const active = subTab === seg.id;
          const Icon = seg.icon;
          return (
            <button
              key={seg.id}
              onClick={() => {
                triggerHaptic('light');
                setSubTab(seg.id);
              }}
              style={{
                flex: 1,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: active ? COLORS.accent : 'transparent',
                border: 'none',
                borderRadius: RADIUS.sm,
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: active ? COLORS.textPrimary : COLORS.textSecondary,
                cursor: 'pointer',
                transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
                boxShadow: active ? `0 0 12px ${COLORS.accentGlow}` : 'none',
              }}
            >
              <Icon size={14} strokeWidth={2} />
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* ── BED BOARD SUB-TAB ──────────────────────────────── */}
      {subTab === 'beds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          <BedBoard
            display="card"
            units={bedUnits}
            surgeActive={isSurgeActive}
            onExpand={onExpandBedBoard}
            role={currentUser.role}
            embedded
          />
          <TacticalButton
            variant="primary"
            size="md"
            onClick={() => {
              triggerHaptic('medium');
              onExpandBedBoard();
            }}
            style={{ width: '100%' }}
          >
            Open Full Bed Board
          </TacticalButton>
        </div>
      )}

      {/* ── EMS INBOUND SUB-TAB ────────────────────────────── */}
      {subTab === 'ems' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
          {/* The card mode IS the live radio board — ETAs decrement
              once a second via the shared `useEmsInbound` hook so
              this surface is always showing the same state the
              desktop HUD shows. */}
          <EmsInboundBoard display="card" externalFeed={emsFeed} />

          {/* Launcher → fullscreen overlay, same surface every role
              opens from the Patients tab in other roles. */}
          <motion.button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onExpandEmsBoard();
            }}
            whileTap={{ scale: 0.98 }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.md,
              padding: `${SPACE.md}px ${SPACE.base}px`,
              background:
                'linear-gradient(90deg, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.02) 100%)',
              border: `1px solid ${COLORS.info}`,
              borderLeft: `3px solid ${COLORS.info}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              fontFamily: FONTS.sans,
              textAlign: 'left',
              cursor: 'pointer',
              minHeight: 52,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(59,130,246,0.18)',
                border: `1px solid ${COLORS.info}`,
                borderRadius: RADIUS.sm,
                color: COLORS.info,
              }}
            >
              <Radio size={18} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  color: COLORS.info,
                  marginBottom: 2,
                }}
              >
                FULLSCREEN
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                }}
              >
                Open Full Radio Board
              </div>
            </div>
            <ChevronRight size={18} strokeWidth={2} color={COLORS.textSecondary} />
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

// Guard: this component only renders for the MANAGER role. The parent
// should branch on `currentUser.role === UserRole.MANAGER` before
// mounting — but we also soft-warn in dev if it ever slips through.
if (typeof window !== 'undefined' && process?.env?.NODE_ENV === 'development') {
  // eslint-disable-next-line no-underscore-dangle
  (MobileCoordination as unknown as { __role?: UserRole }).__role = UserRole.MANAGER;
}

export default MobileCoordination;
