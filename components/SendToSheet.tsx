import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Send, Monitor, Smartphone, Tablet, Laptop, CheckCircle2 } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  Mono,
  BracketLabel,
  CornerBracket,
  TacticalButton,
} from './design';
import { triggerHaptic } from '../lib/haptics';
import { usePresenceMeta, getDeviceId } from '../lib/realtime';

/**
 * SendToSheet — bottom sheet for pushing the current patient chart to
 * one or more peer devices (SCAD demo "Send to..." flow).
 *
 * Why this exists: at the demo stand Nick scans a bracelet on his
 * iPhone → the chart opens on his phone. From there he wants to push
 * the same chart onto the wall-mounted touchscreen without walking
 * over to it. This sheet shows every other connected device (hiding
 * his own) and lets him multi-select, then broadcasts an
 * `open-patient` event carrying the target device ids. The receivers
 * in App.tsx check whether they're a target and navigate to Patients
 * with that patient pre-selected.
 *
 * Device identification comes from the presence meta. Each device
 * auto-detects its name from the user agent (iPhone / iPad / Mac) and
 * the operator can rename it in Settings for clarity
 * ("Screen", "iMac Stage", etc.).
 */

export interface SendToSheetProps {
  /** Patient id being broadcast. null = closed. */
  patientId: string | null;
  /** Patient display name for the header. */
  patientName?: string;
  /** User invokes this after choosing device(s). */
  onSend: (targetDeviceIds: string[]) => void;
  /** Dismiss the sheet. */
  onCancel: () => void;
}

/** Pick a lucide icon for the device's human name. */
function iconForDevice(name: string): React.ReactNode {
  const n = name.toLowerCase();
  if (n.includes('iphone') || n.includes('android') || n.includes('phone')) {
    return <Smartphone size={16} strokeWidth={1.75} />;
  }
  if (n.includes('ipad') || n.includes('tablet')) {
    return <Tablet size={16} strokeWidth={1.75} />;
  }
  if (n.includes('mac') || n.includes('imac') || n.includes('laptop') || n.includes('windows') || n.includes('linux')) {
    return <Laptop size={16} strokeWidth={1.75} />;
  }
  if (n.includes('screen') || n.includes('tv') || n.includes('display')) {
    return <Monitor size={16} strokeWidth={1.75} />;
  }
  return <Monitor size={16} strokeWidth={1.75} />;
}

export const SendToSheet: React.FC<SendToSheetProps> = ({
  patientId,
  patientName,
  onSend,
  onCancel,
}) => {
  const presence = usePresenceMeta();
  const myId = getDeviceId();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Peer devices only — never list the sending device. Sort by name so
  // the same device always lands in the same spot on re-renders.
  const peers = useMemo(
    () =>
      Object.values(presence)
        .filter((p) => p.device !== myId)
        .sort((a, b) => a.deviceName.localeCompare(b.deviceName)),
    [presence, myId],
  );

  if (!patientId) return null;

  const toggle = (deviceId: string) => {
    triggerHaptic('light');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const sendDisabled = selected.size === 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.modal + 5,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Send patient chart to another device"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderBottom: 'none',
          borderRadius: `${RADIUS.lg}px ${RADIUS.lg}px 0 0`,
          padding: SPACE.xl,
          paddingBottom: `calc(${SPACE.xl}px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.lg,
          maxHeight: '80vh',
        }}
      >
        <CornerBracket position="tl" color={COLORS.accent} size={12} />
        <CornerBracket position="tr" color={COLORS.accent} size={12} />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <Send size={14} strokeWidth={1.75} color={COLORS.accent} />
            <BracketLabel tone="accent">SEND CHART TO…</BracketLabel>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onCancel();
            }}
            aria-label="Cancel"
            style={{
              minHeight: 36,
              minWidth: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textSecondary,
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Patient context strip */}
        {patientName && (
          <div
            style={{
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              background: COLORS.bg,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Mono tone="muted" size="xs">
              PATIENT
            </Mono>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 500,
                color: COLORS.textPrimary,
                letterSpacing: '-0.005em',
              }}
            >
              {patientName}
            </div>
          </div>
        )}

        {/* Device list — each row a tap target. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.sm,
            overflowY: 'auto',
            minHeight: 80,
          }}
        >
          {peers.length === 0 ? (
            <div
              style={{
                padding: `${SPACE.xl}px ${SPACE.md}px`,
                border: `1px dashed ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                textAlign: 'center',
              }}
            >
              <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: SPACE.xs }}>
                NO OTHER DEVICES CONNECTED
              </Mono>
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                Open PULSE on another screen to push charts to it.
              </div>
            </div>
          ) : (
            peers.map((p) => {
              const isSelected = selected.has(p.device);
              return (
                <button
                  key={p.device}
                  type="button"
                  onClick={() => toggle(p.device)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    padding: `${SPACE.md}px ${SPACE.md}px`,
                    minHeight: 56,
                    background: isSelected ? COLORS.surfaceElev : COLORS.surface,
                    border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textPrimary,
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 16px ${COLORS.accent}30` : 'none',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      color: isSelected ? COLORS.accent : COLORS.textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    {iconForDevice(p.deviceName)}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        fontWeight: 500,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {p.deviceName}
                    </div>
                    <Mono tone="muted" size="xs">
                      {p.device.slice(0, 8).toUpperCase()}
                    </Mono>
                  </div>
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: RADIUS.full,
                      border: `1.5px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? COLORS.accent : 'transparent',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <CheckCircle2 size={14} color={COLORS.textPrimary} strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: SPACE.sm }}>
          <TacticalButton
            variant="secondary"
            size="md"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            CANCEL
          </TacticalButton>
          <TacticalButton
            variant="primary"
            size="md"
            icon={<Send size={14} strokeWidth={2} />}
            disabled={sendDisabled}
            onClick={() => {
              if (sendDisabled) return;
              triggerHaptic('medium');
              onSend(Array.from(selected));
            }}
            style={{ flex: 2 }}
          >
            {selected.size === 0
              ? 'SEND'
              : selected.size === 1
                ? 'SEND TO 1 DEVICE'
                : `SEND TO ${selected.size} DEVICES`}
          </TacticalButton>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SendToSheet;
