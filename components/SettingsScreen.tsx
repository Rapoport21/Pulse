import React, { useEffect, useMemo, useState } from 'react';
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
  Type,
  Tag,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Zap,
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
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
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
  usePresenceMeta,
  getLatencyMs,
  getDeviceName,
  setDeviceName,
} from '../lib/realtime';
import type { BraceletPool } from '../lib/braceletPool';
import { usedCount, POOL_SIZE, unlinkBracelet, makeInitialPool } from '../lib/braceletPool';
import { triggerHaptic } from '../lib/haptics';
import { TextDimContrastSample } from './TextDimContrastSample';
import {
  type UiScale,
  readUiScale,
  writeUiScale,
  applyUiScale,
} from '../lib/uiScale';
import {
  type SurgeDuration,
  SURGE_DURATION_ORDER,
  SURGE_DURATION_LABEL,
  readSurgeDuration,
  writeSurgeDuration,
} from '../lib/surgeDuration';
import {
  type ScenarioState,
  type ScenarioSeverity,
  type ScenarioPhase,
} from '../lib/scenario';
import { ScenarioCards } from './ScenarioCards';

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
  /** Shared bracelet pool — when provided, the Bracelets section
   *  renders. Omitted on screens that don't plumb it through. */
  braceletPool?: BraceletPool;
  /** Update the bracelet pool (e.g. unlink a slot). */
  onUpdateBraceletPool?: (next: BraceletPool) => void;

  // ── Scenario controls (required for Simulation section) ──
  /** Currently running scenario, or null if none. */
  activeScenario?: ScenarioState | null;
  /** Live scenario tick snapshot — countdown, phase, flags. */
  scenarioTick?: {
    scenario: ScenarioState | null;
    elapsedMs: number;
    remainingMs: number;
    phase: ScenarioPhase | null;
    isExpired: boolean;
  };
  /** Start a new scenario at given severity. Hot-swaps if one is running. */
  onStartScenario?: (severity: ScenarioSeverity) => void;
  /** Stop the currently running scenario and revert to baseline. */
  onStopScenario?: () => void;

  // ── Manual Surge controls (independent of scenarios) ──
  isSurgeActive?: boolean;
  onActivateSurge?: () => void;
  onDeactivateSurge?: () => void;
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
          fontSize: 18,
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
        fontSize: 12,
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
// ManualSurgeToggle — a single row that lets the operator flip Surge Mode
// on/off from Settings, independent of scenarios. S3 auto-activates surge;
// this is for the operator who wants surge without the full scenario
// choreography.
// ─────────────────────────────────────────────────────────────────────────
const ManualSurgeToggle: React.FC<{
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}> = ({ isActive, onActivate, onDeactivate }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.md,
      padding: SPACE.md,
      background: COLORS.surface,
      border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
      borderRadius: RADIUS.sm,
      minHeight: 52,
      boxShadow: isActive ? `0 0 16px ${COLORS.accentGlow}` : undefined,
      transition: `box-shadow ${MOTION.base}s ${MOTION.cssEase}, border-color ${MOTION.base}s ${MOTION.cssEase}`,
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
        border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
        background: COLORS.surfaceElev,
        borderRadius: RADIUS.sm,
        color: isActive ? COLORS.accent : COLORS.textMuted,
      }}
    >
      <Zap size={16} strokeWidth={1.75} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: COLORS.textPrimary,
          marginBottom: 2,
        }}
      >
        Surge Mode
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 12,
          color: COLORS.textSecondary,
          lineHeight: 1.4,
        }}
      >
        {isActive
          ? 'Protocol Level 2 active — urgent task list live'
          : 'Independent of scenarios. Trigger any time.'}
      </div>
    </div>
    <TacticalButton
      variant={isActive ? 'danger' : 'secondary'}
      size="sm"
      onClick={isActive ? onDeactivate : onActivate}
      style={{ flexShrink: 0, minWidth: 120, height: 40 }}
    >
      {isActive ? 'Stand down' : 'Activate'}
    </TacticalButton>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// DeviceIcon — pick an icon that matches the device label.
// ─────────────────────────────────────────────────────────────────────────
const DeviceIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 16 }) => {
  const n = name.toLowerCase();
  if (n.includes('iphone') || n.includes('phone') || n.includes('android')) {
    return <Smartphone size={size} strokeWidth={1.75} />;
  }
  if (n.includes('ipad') || n.includes('tablet')) {
    return <Tablet size={size} strokeWidth={1.75} />;
  }
  if (n.includes('screen') || n.includes('tv') || n.includes('display')) {
    return <Monitor size={size} strokeWidth={1.75} />;
  }
  if (n.includes('mac') || n.includes('laptop') || n.includes('windows') || n.includes('linux')) {
    return <Laptop size={size} strokeWidth={1.75} />;
  }
  return <Monitor size={size} strokeWidth={1.75} />;
};

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
  braceletPool,
  onUpdateBraceletPool,
  activeScenario,
  scenarioTick,
  onStartScenario,
  onStopScenario,
  isSurgeActive = false,
  onActivateSurge,
  onDeactivateSurge,
}) => {
  const [resetArmed, setResetArmed] = useState(false);
  const [resetJustFired, setResetJustFired] = useState(false);
  const [contrastOpen, setContrastOpen] = useState(false);
  const [uiScale, setUiScale] = useState<UiScale>(() => readUiScale());
  const [surgeDuration, setSurgeDurationState] = useState<SurgeDuration>(() =>
    readSurgeDuration()
  );
  const connectionStatus = useConnectionStatus();
  const presence = usePresence();
  const presenceMeta = usePresenceMeta();
  const [now, setNow] = useState(() => new Date());

  // Device name — the human label peers see in the "Send to…" sheet.
  // Auto-detected from the user agent; the operator can override it
  // here and the new name re-publishes to presence.
  const [deviceNameDraft, setDeviceNameDraft] = useState(() => getDeviceName());
  useEffect(() => {
    if (open) setDeviceNameDraft(getDeviceName());
  }, [open]);
  const deviceNameCommitted = getDeviceName();
  const deviceNameDirty = deviceNameDraft.trim() !== deviceNameCommitted;
  const commitDeviceName = () => {
    const trimmed = deviceNameDraft.trim();
    if (!trimmed) {
      setDeviceNameDraft(deviceNameCommitted);
      return;
    }
    setDeviceName(trimmed);
    setDeviceNameDraft(trimmed);
    triggerHaptic('light');
  };

  // Peer devices — listed so the operator can confirm names match what
  // they expect in the Send-to sheet before the demo starts.
  const peerRows = useMemo(() => {
    const myId = getDeviceId();
    return Object.values(presenceMeta)
      .filter((p) => p.device !== myId)
      .sort((a, b) => a.deviceName.localeCompare(b.deviceName));
  }, [presenceMeta]);

  // Commit a scale change: persist + apply immediately so the operator
  // sees the UI grow/shrink the moment they tap. No app reload needed.
  const handleUiScaleChange = (next: UiScale) => {
    if (next === uiScale) return;
    triggerHaptic('light');
    setUiScale(next);
    writeUiScale(next);
    applyUiScale(next);
  };

  // Commit a surge-duration change. Only affects the NEXT surge
  // activation — we don't retroactively shorten a surge that's
  // already running (would be confusing if the operator flipped
  // mid-scenario). The App reads the preference at activateSurge
  // time and schedules an auto-deactivate timer accordingly.
  const handleSurgeDurationChange = (next: SurgeDuration) => {
    if (next === surgeDuration) return;
    triggerHaptic('light');
    setSurgeDurationState(next);
    writeSurgeDuration(next);
  };

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

  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

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
            top: 0,
            left: 0,
            right: 0,
            // Stop above MobileView's bottom HUD nav so app tabs stay visible.
            bottom: isMobile ? MOBILE_NAV_OVERLAY_INSET_BOTTOM : 0,
            background: COLORS.bg,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sans,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderTop: isMobile ? `1px solid ${COLORS.borderStrong}` : undefined,
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
                whileTap={{ scale: 0.97 }}
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
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ChevronLeft size={14} strokeWidth={2} />
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
                {timeStr}
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
                // Desktop: spread sections across the full screen as a
                // 2-column grid instead of a 720px column hugging the
                // middle. Mobile: stays single-column flex (one section
                // per row, full width).
                maxWidth: isMobile ? '100%' : 1400,
                margin: '0 auto',
                display: isMobile ? 'flex' : 'grid',
                flexDirection: isMobile ? 'column' : undefined,
                gridTemplateColumns: isMobile
                  ? undefined
                  : 'repeat(2, minmax(0, 1fr))',
                // alignItems:start so sections do NOT stretch to match
                // their row-mate's height — each section sits at its
                // natural height, top-aligned.
                alignItems: isMobile ? undefined : 'start',
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
                        fontSize: 16,
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
                          fontSize: 16,
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
                          <AlertTriangle size={18} strokeWidth={2} />
                        ) : resetJustFired ? (
                          <Check size={18} strokeWidth={2} />
                        ) : (
                          <RotateCcw size={18} strokeWidth={1.75} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 15,
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
                            fontSize: 13,
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
                          <Check size={14} strokeWidth={2} />
                        ) : resetArmed ? (
                          <AlertTriangle size={14} strokeWidth={2} />
                        ) : (
                          <RotateCcw size={14} strokeWidth={2} />
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
                        size={11}
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
                    icon={<Cpu size={12} strokeWidth={1.75} />}
                    label="Device"
                    value={deviceShort}
                  />
                  <InfoRow
                    icon={<Radio size={12} strokeWidth={1.75} />}
                    label="Peers online"
                    value={`${deviceCount}`}
                  />
                  <InfoRow
                    icon={
                      connectionStatus === 'connected' ? (
                        <Wifi size={12} strokeWidth={1.75} />
                      ) : (
                        <WifiOff size={12} strokeWidth={1.75} />
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
                    icon={<ShieldCheck size={12} strokeWidth={1.75} />}
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
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.sm,
                  }}
                >
                  {/* UI Scale — opt-in zoom. Default stays at the
                      tuned-in baseline; "Larger" applies a +15% zoom
                      on the document element. See lib/uiScale.ts. */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.md,
                      padding: SPACE.md,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
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
                      <Type size={16} strokeWidth={1.75} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 15,
                          fontWeight: 600,
                          letterSpacing: '-0.01em',
                          color: COLORS.textPrimary,
                          marginBottom: 2,
                        }}
                      >
                        UI scale
                      </div>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 12,
                          color: COLORS.textSecondary,
                          lineHeight: 1.4,
                        }}
                      >
                        Default fits more on screen. Larger is easier to
                        read at arm's length.
                      </div>
                    </div>
                    {/* Segmented toggle. Two 44-tall buttons inside a
                        bordered pill. Active option inverts to accent. */}
                    <div
                      role="radiogroup"
                      aria-label="UI scale"
                      style={{
                        flexShrink: 0,
                        display: 'inline-flex',
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        overflow: 'hidden',
                        background: COLORS.surfaceElev,
                      }}
                    >
                      {(['default', 'large'] as const).map((option) => {
                        const active = uiScale === option;
                        return (
                          <motion.button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => handleUiScaleChange(option)}
                            whileTap={{ scale: 0.96 }}
                            transition={{
                              duration: MOTION.fast,
                              ease: MOTION.ease,
                            }}
                            style={{
                              minWidth: 64,
                              height: 32,
                              padding: `0 ${SPACE.md}px`,
                              background: active
                                ? COLORS.accent
                                : 'transparent',
                              border: 'none',
                              color: active
                                ? '#FFFFFF'
                                : COLORS.textSecondary,
                              cursor: 'pointer',
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {option === 'default' ? 'Default' : 'Larger'}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

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
                      <Eye size={16} strokeWidth={1.75} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 15,
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
                          fontSize: 12,
                          color: COLORS.textSecondary,
                          lineHeight: 1.4,
                        }}
                      >
                        Preview textDim candidates against the canvas. Pick
                        the tone that reads clearest at 3am.
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      color={COLORS.textMuted}
                      strokeWidth={1.75}
                    />
                  </motion.button>
                </div>
              </Section>

              {/* ── SIMULATION ──────────────────────────────── */}
              {/* Demo-tuning controls. The clinically-correct default
                  is "Permanent" — once Surge Mode is activated the
                  screen stays screaming-red until an operator stands
                  down. For the SCAD demo loop, auto-expire options
                  (30 s → 5 min) let the stand reset between visitors
                  without manual cleanup. */}
              <Section
                id="S04B"
                title="Simulation"
                meta={
                  <Mono tone="dim" size="xs">
                    Scenarios · Surge
                  </Mono>
                }
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.md,
                  }}
                >
                  {/* Scenario picker — three big tappable cards.
                      S1/S2/S3, each a 3-minute choreographed timeline
                      that reshapes every metric and feed in the app.
                      The active card gets an accent border + breathing
                      glow; others dim back. Tapping another mid-run
                      hot-swaps immediately and restarts the clock. */}
                  {onStartScenario && onStopScenario && (
                    <ScenarioCards
                      activeScenario={activeScenario ?? null}
                      tick={scenarioTick}
                      onStart={onStartScenario}
                      onStop={onStopScenario}
                    />
                  )}

                  {/* Manual Surge toggle — independent of scenarios.
                      Scenario S3 auto-activates surge, but this row
                      stays available so the operator can flip surge
                      on/off at any time from Settings without picking
                      a scenario. Surge duration (below) still applies. */}
                  {onActivateSurge && onDeactivateSurge && (
                    <ManualSurgeToggle
                      isActive={isSurgeActive}
                      onActivate={onActivateSurge}
                      onDeactivate={onDeactivateSurge}
                    />
                  )}

                  {/* Surge Duration — how long Surge Mode stays
                      active before auto stand-down. Applies to the
                      NEXT activation; in-flight surges are not
                      retroactively shortened. */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.md,
                      padding: SPACE.md,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    {/* Label row: icon tile + title + description. */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.md,
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
                          color: COLORS.accent,
                        }}
                      >
                        <Zap size={16} strokeWidth={1.75} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 15,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: COLORS.textPrimary,
                            marginBottom: 2,
                          }}
                        >
                          Surge duration
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 12,
                            color: COLORS.textSecondary,
                            lineHeight: 1.4,
                          }}
                        >
                          How long Surge Mode stays active before
                          auto stand-down. Permanent keeps it on
                          until you tap again.
                        </div>
                      </div>
                    </div>

                    {/* 5-up segmented toggle. Full-width grid so
                        every option gets equal tap area; 44-tall
                        buttons for touch targets. */}
                    <div
                      role="radiogroup"
                      aria-label="Surge duration"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${SURGE_DURATION_ORDER.length}, 1fr)`,
                        gap: 0,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        overflow: 'hidden',
                        background: COLORS.surfaceElev,
                      }}
                    >
                      {SURGE_DURATION_ORDER.map((option, i) => {
                        const active = surgeDuration === option;
                        const isLast = i === SURGE_DURATION_ORDER.length - 1;
                        return (
                          <motion.button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => handleSurgeDurationChange(option)}
                            whileTap={{ scale: 0.96 }}
                            transition={{
                              duration: MOTION.fast,
                              ease: MOTION.ease,
                            }}
                            style={{
                              minHeight: 44,
                              padding: `0 ${SPACE.xs}px`,
                              background: active
                                ? COLORS.accent
                                : 'transparent',
                              border: 'none',
                              borderRight: isLast
                                ? 'none'
                                : `1px solid ${COLORS.border}`,
                              color: active
                                ? '#FFFFFF'
                                : COLORS.textSecondary,
                              cursor: 'pointer',
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              fontWeight: 600,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {SURGE_DURATION_LABEL[option]}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Section>

              {/* ── DEVICES (SCAD Send-to demo) ─────────────── */}
              <Section
                id="S05"
                title="Devices"
                meta={
                  <Mono tone="dim" size="xs">
                    Send-to peers
                  </Mono>
                }
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.sm,
                  }}
                >
                  {/* This device — editable name. */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.md,
                      padding: SPACE.md,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
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
                        border: `1px solid ${COLORS.accent}`,
                        background: COLORS.surfaceElev,
                        borderRadius: RADIUS.sm,
                        color: COLORS.accent,
                      }}
                    >
                      <DeviceIcon name={deviceNameCommitted} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: 4 }}>
                        THIS DEVICE
                      </Mono>
                      <input
                        type="text"
                        value={deviceNameDraft}
                        onChange={(e) => setDeviceNameDraft(e.target.value)}
                        onBlur={commitDeviceName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        maxLength={24}
                        placeholder="Device name"
                        aria-label="This device's display name"
                        style={{
                          width: '100%',
                          padding: `6px ${SPACE.sm}px`,
                          background: COLORS.surfaceElev,
                          border: `1px solid ${deviceNameDirty ? COLORS.accent : COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          color: COLORS.textPrimary,
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Peer list — read-only, renamed remotely. */}
                  {peerRows.length > 0 ? (
                    peerRows.map((p) => (
                      <div
                        key={p.device}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.md,
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          background: COLORS.surface,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          minHeight: 44,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.surfaceElev,
                            borderRadius: RADIUS.sm,
                            color: COLORS.textSecondary,
                          }}
                        >
                          <DeviceIcon name={p.deviceName} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
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
                        <StatusPill label="Online" tone="ok" size="xs" pulse />
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: `${SPACE.md}px`,
                        border: `1px dashed ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        textAlign: 'center',
                      }}
                    >
                      <Mono tone="dim" size="xs">
                        NO OTHER DEVICES CONNECTED
                      </Mono>
                    </div>
                  )}
                </div>
              </Section>

              {/* ── BRACELETS (SCAD participatory demo) ──────── */}
              {braceletPool && (
                <Section
                  id="S06"
                  title="Bracelets"
                  meta={
                    <Mono tone="dim" size="xs">
                      {usedCount(braceletPool)}/{braceletPool.bracelets.length} in use
                    </Mono>
                  }
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.sm,
                    }}
                  >
                    {/* Chip grid — every slot, state at a glance. */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: SPACE.xs,
                        padding: SPACE.md,
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      {braceletPool.bracelets.map((slot) => {
                        const isUsed = slot.status === 'admitted';
                        return (
                          <button
                            key={slot.number}
                            type="button"
                            disabled={!isUsed}
                            onClick={() => {
                              if (!isUsed || !onUpdateBraceletPool) return;
                              const next = unlinkBracelet(braceletPool, slot.number);
                              onUpdateBraceletPool(next);
                              triggerHaptic('light');
                            }}
                            title={
                              isUsed
                                ? `#${slot.number} — ${slot.patientName ?? 'Linked'} (tap to release)`
                                : `#${slot.number} — empty`
                            }
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: `${SPACE.xs}px 2px`,
                              minHeight: 48,
                              background: isUsed ? COLORS.surfaceElev : 'transparent',
                              border: `1px solid ${isUsed ? COLORS.accent : COLORS.border}`,
                              borderRadius: RADIUS.sm,
                              color: isUsed ? COLORS.textPrimary : COLORS.textDim,
                              fontFamily: FONTS.mono,
                              fontSize: 13,
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              cursor: isUsed ? 'pointer' : 'default',
                              opacity: isUsed ? 1 : 0.55,
                            }}
                          >
                            <span>#{slot.number}</span>
                            {isUsed && slot.patientName && (
                              <span
                                style={{
                                  display: 'block',
                                  fontFamily: FONTS.sans,
                                  fontSize: 9,
                                  fontWeight: 500,
                                  letterSpacing: 0,
                                  textTransform: 'none',
                                  color: COLORS.textSecondary,
                                  marginTop: 2,
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {slot.patientName.split(' ')[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Release-all — clears every slot back to empty. */}
                    {onUpdateBraceletPool && usedCount(braceletPool) > 0 && (
                      <TacticalButton
                        variant="secondary"
                        size="md"
                        icon={<Tag size={14} strokeWidth={2} />}
                        onClick={() => {
                          onUpdateBraceletPool(makeInitialPool(POOL_SIZE));
                          triggerHaptic('medium');
                        }}
                        style={{ height: 44, width: '100%' }}
                      >
                        Release all bracelets
                      </TacticalButton>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Info
                        size={11}
                        color={COLORS.textDim}
                        strokeWidth={1.75}
                      />
                      <Mono tone="dim" size="xs">
                        Tap a used chip to release that bracelet back to the pool.
                      </Mono>
                    </div>
                  </div>
                </Section>
              )}

              {/* ── SIGN OUT ─────────────────────────────────── */}
              <Section id="S07" title="Sign Out">
                <TacticalCard padding="md">
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 13,
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
                    icon={<LogOut size={14} strokeWidth={2} />}
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
