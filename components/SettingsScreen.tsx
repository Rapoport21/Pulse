import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  RotateCcw,
  LogOut,
  Wifi,
  WifiOff,
  Radio,
  Cpu,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  Check,
  Eye,
} from 'lucide-react';
import type { UserProfile } from '../types';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  CHROME,
  Mono,
  BracketLabel,
  StatusPill,
  CornerBracket,
  HudStrip,
  TacticalCard,
  TacticalButton,
  DotGridBg,
  GlowBg,
  ScanningLine,
  Divider,
} from './design';
import {
  getDeviceId,
  useConnectionStatus,
  usePresence,
  getLatencyMs,
} from '../lib/realtime';
import { triggerHaptic } from '../lib/haptics';
import { TextDimContrastSample } from './TextDimContrastSample';

/**
 * SettingsScreen — full-screen overlay for session/simulation controls.
 *
 * Wave A purpose: give the demo operator a fast, obvious way to reset
 * the whole simulation between visitors at the SCAD stand. Everything
 * that would make a fresh visitor see "state from the last person" gets
 * reset from one button. The same screen is also the home for session
 * metadata (operator, device, build) and the primary Sign Out action.
 *
 * The reset button is two-stage — first click arms it with a red
 * "PRESS AGAIN TO CONFIRM" state that auto-disarms after 4s. This is a
 * deliberate friction step so a visitor playing with the phone doesn't
 * nuke the demo mid-conversation.
 */

interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onReset: () => void;
  onLogout: () => void;
  /** Mobile wraps the HUD strips tighter and omits chrome. */
  variant?: 'mobile' | 'desktop';
}

const CONFIRM_WINDOW_MS = 4000;

// ─────────────────────────────────────────────────────────────────────────
// Section — bracketed block with a title, id and optional meta.
// ─────────────────────────────────────────────────────────────────────────
const Section: React.FC<{
  id: string;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, meta, children }) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE.md,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        paddingBottom: SPACE.sm,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <Mono tone="dim">// {id}</Mono>
      <h2
        style={{
          fontFamily: FONTS.sans,
          fontSize: 23,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          color: COLORS.textPrimary,
          margin: 0,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${COLORS.border}, transparent)`,
        }}
      />
      {meta && <div style={{ flexShrink: 0 }}>{meta}</div>}
    </div>
    {children}
  </section>
);

// ─────────────────────────────────────────────────────────────────────────
// InfoRow — mono label : mono value pair.
// ─────────────────────────────────────────────────────────────────────────
const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${SPACE.sm}px ${SPACE.md}px`,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      minHeight: 44,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
      {icon && (
        <span style={{ color: COLORS.textMuted, display: 'flex' }}>{icon}</span>
      )}
      <Mono tone="muted">{label}</Mono>
    </div>
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: '0.08em',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
      }}
    >
      {value}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  open,
  onClose,
  currentUser,
  onReset,
  onLogout,
  variant = 'mobile',
}) => {
  const [resetArmed, setResetArmed] = useState(false);
  const [resetJustFired, setResetJustFired] = useState(false);
  const [contrastOpen, setContrastOpen] = useState(false);
  const connectionStatus = useConnectionStatus();
  const presence = usePresence();
  const [now, setNow] = useState(() => new Date());

  // Tick clock — only while open, to avoid background churn.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);

  // Auto-disarm reset if the user hesitates.
  useEffect(() => {
    if (!resetArmed) return;
    const id = setTimeout(() => setResetArmed(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(id);
  }, [resetArmed]);

  const deviceId = getDeviceId();
  const deviceShort = deviceId.slice(0, 8).toUpperCase();
  const deviceCount = Math.max(1, presence.length);
  const latency = getLatencyMs();

  const handleResetClick = () => {
    triggerHaptic('medium');
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    onReset();
    setResetArmed(false);
    setResetJustFired(true);
    setTimeout(() => setResetJustFired(false), 1400);
  };

  const handleLogoutClick = () => {
    triggerHaptic('medium');
    onLogout();
  };

  const isMobile = variant === 'mobile';

  const statusLabel = (() => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'disconnected':
        return 'Disconnected';
      case 'offline':
        return 'Local Only';
    }
  })();

  const statusTone = (() => {
    switch (connectionStatus) {
      case 'connected':
        return 'ok' as const;
      case 'connecting':
        return 'warn' as const;
      case 'disconnected':
        return 'crit' as const;
      case 'offline':
        return 'neutral' as const;
    }
  })();

  // Build stamp — use build-time env when available, fall back to today.
  const buildDate = (() => {
    const env =
      (import.meta as unknown as { env?: Record<string, string | undefined> })
        .env || {};
    const stamp = env.VITE_BUILD_DATE || now.toISOString().slice(0, 10);
    return stamp.replace(/-/g, '.');
  })();

  const timeStr = now.toUTCString().slice(17, 25);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
          style={{
            position: 'fixed',
            inset: 0,
            background: COLORS.bg,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sans,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            // Safe-area insets sit on the outer container so the
            // HudStrips inside the flex column stay clear of the
            // dynamic island / home indicator while the body
            // naturally fills the middle (no fixed-positioning).
            paddingTop: isMobile ? 'env(safe-area-inset-top)' : 0,
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {/* Ambient background */}
          <DotGridBg opacity={0.25} />
          <GlowBg
            origin="bottom"
            color={COLORS.accentDim}
            intensity={0.4}
          />
          <ScanningLine color={COLORS.accent} duration={18} />

          {/* ── TOP HUD ─────────────────────────────────────────── */}
          <HudStrip side="top" height={isMobile ? 48 : 44}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                flex: 1,
                minWidth: 0,
              }}
            >
              <motion.button
                type="button"
                onClick={onClose}
                aria-label="Close settings"
                whileTap={{ scale: 0.94 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `6px ${SPACE.sm}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                  fontFamily: FONTS.mono,
                  fontSize: 15,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ChevronLeft size={17} strokeWidth={2} />
                Back
              </motion.button>
              <BracketLabel tone="accent" size={isMobile ? 'sm' : 'base'}>
                SETTINGS
              </BracketLabel>
              {!isMobile && (
                <>
                  <span style={{ color: COLORS.textDim }}>│</span>
                  <Mono tone="secondary">
                    Session &amp; simulation controls
                  </Mono>
                </>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                flexShrink: 0,
              }}
            >
              <Mono tone="dim" size="xs">
                {timeStr} UTC
              </Mono>
              <StatusPill
                label={statusLabel}
                tone={statusTone}
                pulse={connectionStatus === 'connected'}
                size="xs"
              />
            </div>
          </HudStrip>

          {/* ── BODY ─────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              // minHeight:0 lets this flex child shrink below intrinsic
              // content size so the scroll container actually scrolls
              // instead of pushing the bottom HudStrip off-screen.
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              zIndex: 1,
              padding: isMobile ? SPACE.base : SPACE.xl,
              paddingBottom: isMobile ? SPACE.xl : SPACE['2xl'],
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: isMobile ? '100%' : 720,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.xl,
              }}
            >
              {/* ── OPERATOR ─────────────────────────────────── */}
              <Section
                id="S01"
                title="Operator"
                meta={<StatusPill label="Active" tone="ok" size="xs" />}
              >
                <TacticalCard padding="md" accentBar>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.base,
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: COLORS.surfaceElev,
                        border: `1px solid ${COLORS.borderStrong}`,
                        borderRadius: RADIUS.sm,
                        fontFamily: FONTS.mono,
                        fontSize: 19,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        color: COLORS.textPrimary,
                        flexShrink: 0,
                      }}
                    >
                      {currentUser.avatarInitials}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 19,
                          fontWeight: 600,
                          letterSpacing: '-0.01em',
                          color: COLORS.textPrimary,
                          // Wrap long names onto a second line instead
                          // of truncating — operator identity is the
                          // most important piece of context on this
                          // screen and must read in full.
                          lineHeight: 1.25,
                          wordBreak: 'break-word',
                        }}
                      >
                        {currentUser.name}
                      </span>
                      <Mono tone="muted" size="xs">
                        {currentUser.role}
                      </Mono>
                    </div>
                  </div>
                </TacticalCard>
              </Section>

              {/* ── DEMO CONTROLS ────────────────────────────── */}
              <Section
                id="S02"
                title="Demo Controls"
                meta={
                  <Mono tone="dim" size="xs">
                    Stand-ready tools
                  </Mono>
                }
              >
                <motion.div
                  animate={
                    resetArmed
                      ? { boxShadow: `0 0 0 1px ${COLORS.crit}, 0 0 24px ${COLORS.crit}40` }
                      : resetJustFired
                      ? { boxShadow: `0 0 0 1px ${COLORS.ok}, 0 0 24px ${COLORS.ok}40` }
                      : { boxShadow: '0 0 0 1px transparent' }
                  }
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ borderRadius: RADIUS.sm }}
                >
                  <TacticalCard
                    padding="md"
                    style={{
                      borderColor: resetArmed
                        ? COLORS.crit
                        : resetJustFired
                        ? COLORS.ok
                        : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: SPACE.md,
                        marginBottom: SPACE.base,
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
                          border: `1px solid ${
                            resetArmed ? COLORS.crit : COLORS.border
                          }`,
                          background: COLORS.surface,
                          borderRadius: RADIUS.sm,
                          color: resetArmed ? COLORS.crit : COLORS.textMuted,
                        }}
                      >
                        {resetArmed ? (
                          <AlertTriangle size={23} strokeWidth={2} />
                        ) : resetJustFired ? (
                          <Check size={23} strokeWidth={2} />
                        ) : (
                          <RotateCcw size={23} strokeWidth={1.75} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 18,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: COLORS.textPrimary,
                            marginBottom: 4,
                          }}
                        >
                          Reset Simulation
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 16,
                            color: COLORS.textSecondary,
                            lineHeight: 1.45,
                          }}
                        >
                          Returns beds, patients, admissions, surge state,
                          alerts and notes to baseline across every
                          connected device.
                        </div>
                      </div>
                    </div>
                    <TacticalButton
                      variant={resetArmed ? 'danger' : 'secondary'}
                      fullWidth
                      size="md"
                      icon={
                        resetJustFired ? (
                          <Check size={17} strokeWidth={2} />
                        ) : resetArmed ? (
                          <AlertTriangle size={17} strokeWidth={2} />
                        ) : (
                          <RotateCcw size={17} strokeWidth={2} />
                        )
                      }
                      onClick={handleResetClick}
                      style={{ height: 44 }}
                    >
                      {resetJustFired
                        ? 'Reset complete'
                        : resetArmed
                        ? 'Press again to confirm'
                        : 'Reset to baseline'}
                    </TacticalButton>
                    <div
                      style={{
                        marginTop: SPACE.sm,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Info
                        size={14}
                        color={COLORS.textDim}
                        strokeWidth={1.75}
                      />
                      <Mono tone="dim" size="xs">
                        Syncs to {deviceCount} device
                        {deviceCount === 1 ? '' : 's'}
                      </Mono>
                    </div>
                  </TacticalCard>
                </motion.div>
              </Section>

              {/* ── SESSION ──────────────────────────────────── */}
              <Section id="S03" title="Session">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.sm,
                  }}
                >
                  <InfoRow
                    icon={<Cpu size={15} strokeWidth={1.75} />}
                    label="Device"
                    value={deviceShort}
                  />
                  <InfoRow
                    icon={<Radio size={15} strokeWidth={1.75} />}
                    label="Peers online"
                    value={`${deviceCount}`}
                  />
                  <InfoRow
                    icon={
                      connectionStatus === 'connected' ? (
                        <Wifi size={15} strokeWidth={1.75} />
                      ) : (
                        <WifiOff size={15} strokeWidth={1.75} />
                      )
                    }
                    label="Uplink"
                    value={
                      connectionStatus === 'connected' && latency
                        ? `${latency} MS`
                        : statusLabel
                    }
                  />
                  <InfoRow
                    icon={<ShieldCheck size={15} strokeWidth={1.75} />}
                    label="Build"
                    value={buildDate}
                  />
                </div>
              </Section>

              {/* ── DISPLAY ──────────────────────────────────── */}
              <Section
                id="S04"
                title="Display"
                meta={
                  <Mono tone="dim" size="xs">
                    Readability tools
                  </Mono>
                }
              >
                <motion.button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setContrastOpen(true);
                  }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    padding: SPACE.md,
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textPrimary,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONTS.sans,
                    minHeight: 44,
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
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surfaceElev,
                      borderRadius: RADIUS.sm,
                      color: COLORS.textMuted,
                    }}
                  >
                    <Eye size={19} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 18,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: COLORS.textPrimary,
                        marginBottom: 2,
                      }}
                    >
                      Contrast check
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 15,
                        color: COLORS.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      Preview textDim candidates against the canvas. Pick
                      the tone that reads clearest at 3am.
                    </div>
                  </div>
                  <ChevronRight
                    size={19}
                    color={COLORS.textMuted}
                    strokeWidth={1.75}
                  />
                </motion.button>
              </Section>

              {/* ── SIGN OUT ─────────────────────────────────── */}
              <Section id="S05" title="Sign Out">
                <TacticalCard padding="md">
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 16,
                      color: COLORS.textSecondary,
                      lineHeight: 1.45,
                      marginBottom: SPACE.base,
                    }}
                  >
                    Ends the session on this device. Other connected devices
                    stay signed in on their own sessions.
                  </div>
                  <TacticalButton
                    variant="danger"
                    fullWidth
                    size="md"
                    icon={<LogOut size={17} strokeWidth={2} />}
                    onClick={handleLogoutClick}
                    style={{ height: 44 }}
                  >
                    Secure Sign Out
                  </TacticalButton>
                </TacticalCard>
              </Section>
            </div>
          </div>

          {/* ── BOTTOM HUD (mobile only — desktop has its own footer) ── */}
          {isMobile && (
            <div
              style={{
                flexShrink: 0,
                // Reserve space for home-indicator below the strip
                // content so the TLS/Node line stays readable.
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: COLORS.surface,
              }}
            >
              <HudStrip side="bottom" height={32}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Mono tone="dim" size="xs">
                    Node ER-01
                  </Mono>
                  <span style={{ color: COLORS.textDim }}>│</span>
                  <Mono tone="dim" size="xs">
                    TLS 1.3
                  </Mono>
                </div>
                <Mono tone="dim" size="xs">
                  PULSE v1.2.4
                </Mono>
              </HudStrip>
            </div>
          )}

          {/* Contrast-check overlay — layers above Settings via its own
              zIndex (250 > 200). Rendered inside the motion container so
              it inherits the same mount lifecycle as Settings. */}
          <TextDimContrastSample
            open={contrastOpen}
            onClose={() => setContrastOpen(false)}
            variant={variant}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsScreen;
