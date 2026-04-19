/**
 * MobileCoordination
 *
 * The Floor Manager's C2 surface on mobile.
 *
 * Why this exists
 * ---------------
 * The generic `patients` tab (Patient List + inline Bed Board) is
 * the right view for Nurse / ER Personnel / Trauma — they're the
 * ones touching patients all shift. Floor managers don't work
 * that way. Their job is moving people through the building:
 * how the shift is performing on KPIs, which departments are
 * strained, what's coming through the front door, and where the
 * beds are.
 *
 * Four sub-tabs give them those four views as first-class
 * surfaces without leaving the tab:
 *
 *   KPIs       — `MobileManagerKpiCockpit` (LWBS, DtD, LOS, …)
 *   Departments — `DeptCoordinationBody`  (shared with the
 *                 Horizon `// PULSE / * / COORD` overlay so any
 *                 change there lands here automatically)
 *   Bed Board  — `BedBoard display="card"` with onExpand →
 *                 fullscreen overlay owned by MobileView
 *   EMS Inbound — `EmsInboundBoard display="card"` with a
 *                 button that opens the fullscreen overlay
 *                 owned by MobileView
 *
 * Keeps `id: 'patients'` as the tab key — the whole app's tab
 * state machine, deep links, and QR-tab shortcuts route on that
 * key, so forking the id per role would be a much bigger change
 * for no user-visible benefit. Only the label + rendered
 * content diverge for MANAGER.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Network, BedDouble, Radio, Maximize2 } from 'lucide-react';
import type { UserProfile } from '../types';
import type { BedUnit } from '../data/bedMock';
import {
  BedBoard,
  DeptCoordinationBody,
  EmsInboundBoard,
} from './clinical';
import { MobileScreenHeader } from './MobileScreenHeader';
import { MobileManagerKpiCockpit } from './MobileManagerKpiCockpit';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION,
  BracketLabel, Mono, TacticalButton,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Sub-tabs
// ─────────────────────────────────────────────────────────────────────────

type SubTab = 'kpis' | 'departments' | 'beds' | 'ems';

interface SubTabDef {
  id: SubTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const SUB_TABS: SubTabDef[] = [
  { id: 'kpis',        label: 'KPIs',        shortLabel: 'KPIs', icon: LayoutDashboard },
  { id: 'departments', label: 'Departments', shortLabel: 'Depts', icon: Network },
  { id: 'beds',        label: 'Bed Board',   shortLabel: 'Beds',  icon: BedDouble },
  { id: 'ems',         label: 'EMS Inbound', shortLabel: 'EMS',   icon: Radio },
];

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface MobileCoordinationProps {
  currentUser: UserProfile;
  /** Toast handler. */
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  /** Bottom nav clearance (NAV_HEIGHT + SPACE['2xl']). Passed in so
   *  this component doesn't need to know the parent's nav constants. */
  navClearance: number;
  /** Bed unit data — owned by MobileView for cross-tab consistency. */
  bedUnits: BedUnit[];
  /** Whether surge protocol is currently active. */
  isSurgeActive: boolean;
  /** Called when the Bed Board sub-tab wants its fullscreen overlay. */
  onExpandBedBoard: () => void;
  /** Called when the EMS Inbound sub-tab wants its fullscreen board. */
  onExpandEmsBoard: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Segmented sub-tab bar
// ─────────────────────────────────────────────────────────────────────────

const SubTabBar: React.FC<{
  active: SubTab;
  onChange: (t: SubTab) => void;
}> = ({ active, onChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: SPACE.xs,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: 3,
      }}
    >
      {SUB_TABS.map((t) => {
        const on = active === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              background: on ? COLORS.accent : 'transparent',
              border: 'none',
              borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: on ? COLORS.textPrimary : COLORS.textSecondary,
              cursor: 'pointer',
              transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
              boxShadow: on ? `0 0 12px ${COLORS.accentGlow}` : 'none',
            }}
          >
            <Icon size={13} color={on ? COLORS.textPrimary : COLORS.textSecondary} />
            <span>{t.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const MobileCoordination: React.FC<MobileCoordinationProps> = ({
  currentUser,
  showToast,
  navClearance,
  bedUnits,
  isSurgeActive,
  onExpandBedBoard,
  onExpandEmsBoard,
}) => {
  const [sub, setSub] = useState<SubTab>('kpis');

  // Map the sub-tab slug into a page label for the breadcrumb so
  // MobileScreenHeader stays informative across all four views.
  const pageLabel =
    sub === 'kpis' ? 'COORD · KPIS'
    : sub === 'departments' ? 'COORD · DEPTS'
    : sub === 'beds' ? 'COORD · BEDS'
    : 'COORD · EMS';

  const titleLabel =
    sub === 'kpis' ? 'Shift Metrics'
    : sub === 'departments' ? 'Departments'
    : sub === 'beds' ? 'Bed Board'
    : 'EMS Inbound';

  return (
    <motion.div
      key="patients"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        // No side padding on the outer wrapper — the sub-screen
        // body components bring their own. We just handle the top
        // offset for the screen header and the bottom offset for
        // the nav bar.
        paddingTop: SPACE.base,
        paddingBottom: navClearance,
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.bg,
      }}
    >
      {/* Universal mobile screen header — same breadcrumb + title
          contract as every other mobile tab. Side-padded to match
          the body's inner padding so the title aligns with section
          content below. */}
      <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
        <MobileScreenHeader
          role={currentUser.role}
          page={pageLabel}
          title={titleLabel}
        />
      </div>

      {/* ── Sub-tab bar ─────────────────────────────────────────── */}
      <div style={{ padding: `0 ${SPACE.base}px ${SPACE.base}px` }}>
        <SubTabBar active={sub} onChange={setSub} />
      </div>

      {/* ── Active sub-screen ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {sub === 'kpis' && (
          <motion.div
            key="kpis"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
          >
            <MobileManagerKpiCockpit showToast={showToast} />
          </motion.div>
        )}

        {sub === 'departments' && (
          <motion.div
            key="departments"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
          >
            {/* Shared with the Horizon `// PULSE / * / COORD` overlay.
                Any change there lands here automatically. */}
            <DeptCoordinationBody
              showToast={(msg: string) => showToast(msg, 'info')}
            />
          </motion.div>
        )}

        {sub === 'beds' && (
          <motion.div
            key="beds"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
            style={{ padding: `0 ${SPACE.base}px` }}
          >
            {/* Card-mode BedBoard — compact inline view with an
                onExpand callback that pops the fullscreen overlay
                owned by MobileView. */}
            <BedBoard
              display="card"
              units={bedUnits}
              surgeActive={isSurgeActive}
              onExpand={onExpandBedBoard}
              role={currentUser.role}
            />
          </motion.div>
        )}

        {sub === 'ems' && (
          <motion.div
            key="ems"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION.fast }}
            style={{
              padding: `0 ${SPACE.base}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.base,
            }}
          >
            {/* LIVE-label banner + expand-to-fullscreen CTA.
                EmsInboundBoard's `card` display shows a scrollable
                stack of recent inbound runs; the CTA opens the
                fullscreen board for dispatch + prehospital detail. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: SPACE.sm,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <BracketLabel tone="accent" size="xs">LIVE RADIO</BracketLabel>
                <Mono tone="dim" size="xs">PREHOSPITAL FEED</Mono>
              </div>
              <TacticalButton
                variant="ghost"
                size="sm"
                icon={<Maximize2 size={11} />}
                onClick={onExpandEmsBoard}
              >
                Expand
              </TacticalButton>
            </div>

            <EmsInboundBoard display="card" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MobileCoordination;
