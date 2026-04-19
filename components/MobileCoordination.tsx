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
 * Their whole job is moving people through the building: which
 * departments are strained, what transfers are stuck, where the
 * bottlenecks are, what resources are free.
 *
 * Before this component, the MANAGER role got the same Patients tab
 * as everyone else with just a re-labeled nav item ("Units"). That
 * buried the C2 surface behind a segmented control that also included
 * a Patient List they rarely open.
 *
 * This screen now mirrors the `// PULSE / * / COORD` quick action
 * on the Horizon page — the fullscreen Departments overlay — so the
 * Floor Manager can pull up the whole C2 view as a first-class tab
 * instead of having to bounce into the overlay every time.
 *
 * Body content comes from `DeptCoordinationBody` (shared with the
 * overlay) so the two surfaces never drift. Add a department or
 * bottleneck in one place and both update.
 *
 * Keeps `id: 'patients'` as the tab key — the whole app's tab state
 * machine, deep links, and QR-tab shortcuts route on that key, so
 * forking the id per role would be a much bigger change for no
 * user-visible benefit. Only the label + rendered content diverge.
 */

import React from 'react';
import { motion } from 'motion/react';
import type { UserProfile } from '../types';
import { DeptCoordinationBody } from './clinical';
import { MobileScreenHeader } from './MobileScreenHeader';
import { COLORS, SPACE, MOTION } from './design';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface MobileCoordinationProps {
  currentUser: UserProfile;
  /** Toast handler for section actions (escalation buttons, quick reply, etc). */
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  /** Bottom nav clearance (NAV_HEIGHT + SPACE['2xl']). Passed in so this
   *  component doesn't need to know the parent's nav constants. */
  navClearance: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const MobileCoordination: React.FC<MobileCoordinationProps> = ({
  currentUser,
  showToast,
  navClearance,
}) => {
  return (
    <motion.div
      key="patients"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        // No side padding on the outer wrapper — DeptCoordinationBody
        // brings its own section padding. We just handle the top
        // offset for the screen header and the bottom offset for the
        // nav bar.
        paddingTop: SPACE.base,
        paddingBottom: navClearance,
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.bg,
      }}
    >
      {/* Universal mobile screen header — same breadcrumb + title
          contract as every other mobile tab so the marker line
          doesn't drift. Side-padded to match the body's inner
          padding so the title aligns with section content below. */}
      <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
        <MobileScreenHeader
          role={currentUser.role}
          page="COORD"
          title="Coordination"
        />
      </div>

      {/* Shared with the fullscreen Departments overlay on the
          Horizon page. Any change there lands here automatically. */}
      <DeptCoordinationBody
        showToast={(msg: string) => showToast(msg, 'info')}
      />
    </motion.div>
  );
};

export default MobileCoordination;
