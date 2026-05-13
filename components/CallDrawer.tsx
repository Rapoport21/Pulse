import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronsRight, Maximize2 } from 'lucide-react';
import { COLORS, FONTS, SPACE, RADIUS, MOTION, Mono } from './design';
import { Z } from './design/tokens';
import { useCall } from '../lib/callState';
import { CallPanel } from './CallPanel';
import { Tab } from '../types';

/**
 * CallDrawer — right-side slide-in surface for an active call.
 *
 * Mounts at the App level so it overlays whatever screen the user is on
 * (BedBoard, Live Ops, Horizon, etc.). When a call starts (via sidebar
 * quick-paging button or from the Comms tab), the drawer slides in from
 * the right; when the call ends, it slides back out.
 *
 * The drawer wraps a CallPanel — same component the Comms tab uses, so
 * the live in-the-moment view is identical across both surfaces.
 *
 * "Expand" button hands off to the full Comms tab without ending the
 * call.
 */
interface CallDrawerProps {
  onExpand?: (tab: Tab) => void;
}

export const CallDrawer: React.FC<CallDrawerProps> = ({ onExpand }) => {
  const { activeCall, endCall } = useCall();
  const open = activeCall !== null;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="call-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(540px, 92vw)',
            background: COLORS.bg,
            borderLeft: `1px solid ${COLORS.borderStrong}`,
            boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.6)',
            zIndex: Z.modal,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
          aria-label="Active call"
          role="dialog"
          aria-modal={false}
        >
          {/* Drawer chrome — small bar above the CallPanel with title
              + expand-to-tab + close-drawer affordances. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              borderBottom: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceElev,
              flexShrink: 0,
            }}
          >
            <Mono tone="dim" size="xs">
              // ACTIVE CALL
            </Mono>
            <div style={{ flex: 1 }} />
            {onExpand && (
              <button
                type="button"
                onClick={() => onExpand(Tab.COMMS)}
                title="Expand to Comms tab"
                style={chromeButtonStyle}
                aria-label="Expand to Comms tab"
              >
                <Maximize2 size={13} strokeWidth={2} color={COLORS.textSecondary} />
              </button>
            )}
            <button
              type="button"
              onClick={endCall}
              title="End call & close drawer"
              style={chromeButtonStyle}
              aria-label="End call and close drawer"
            >
              <ChevronsRight size={14} strokeWidth={2} color={COLORS.textSecondary} />
            </button>
          </div>

          {/* The shared call panel */}
          <CallPanel />
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

const chromeButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  background: 'transparent',
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.sm,
  cursor: 'pointer',
  fontFamily: FONTS.mono,
};
