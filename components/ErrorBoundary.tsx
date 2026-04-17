import React from 'react';
import { motion } from 'motion/react';
import { AlertOctagon, RotateCcw, Pause } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  HudStrip,
  TacticalCard,
  TacticalButton,
  DotGridBg,
  GlowBg,
  ScanningLine,
  BracketFrame,
} from './design';

/**
 * ErrorBoundary — catches uncaught render exceptions anywhere below it
 * and shows a tactical "SYSTEM FAULT · RESTARTING" fallback that
 * auto-reloads after 3 seconds. Designed for the SCAD Senior Show stand
 * so a visitor can't leave a broken screen on the demo device —
 * recovery is automatic and looks intentional.
 *
 * React still requires class components for error boundaries
 * (getDerivedStateFromError / componentDidCatch are not exposed to
 * function components).
 *
 * Debug hold: when `?debug=1` is set, the fallback shows the error
 * message + stack and includes a HOLD button that pauses the auto-
 * reload so you can read the stack before it reboots.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Seconds before auto-reload fires. Default 3. */
  restartDelaySec?: number;
  /** Debug mode — show the stack trace. */
  debug?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  countdown: number;
  held: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    countdown: 3,
    held: false,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Returning partial state synchronously flips into the fallback render
    // before componentDidCatch (where we start the countdown) fires.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Surface the full trace into the Xcode / Safari console for post-mortem.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error', error, errorInfo);
    const delaySec = Math.max(0, this.props.restartDelaySec ?? 3);
    this.setState({ errorInfo, countdown: delaySec });
    if (delaySec === 0) {
      // Defer just slightly so React commits the fallback render first.
      this.reloadTimer = setTimeout(() => this.reload(), 80);
      return;
    }
    this.startCountdown();
  }

  componentWillUnmount() {
    this.clearTimers();
  }

  startCountdown() {
    this.clearTimers();
    this.tickTimer = setInterval(() => {
      this.setState((prev) => {
        if (prev.held) return prev;
        if (prev.countdown <= 1) {
          this.clearTimers();
          this.reloadTimer = setTimeout(() => this.reload(), 80);
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  }

  clearTimers() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  reload() {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  handleRestartNow = () => {
    this.clearTimers();
    this.reload();
  };

  handleHold = () => {
    this.clearTimers();
    this.setState({ held: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, errorInfo, countdown, held } = this.state;
    const totalDelay = Math.max(1, this.props.restartDelaySec ?? 3);
    const progress = held
      ? 0
      : Math.max(0, Math.min(1, countdown / totalDelay));
    const debug = this.props.debug;

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          inset: 0,
          background: COLORS.bg,
          color: COLORS.textPrimary,
          fontFamily: FONTS.sans,
          zIndex: 10_000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Ambient background — crit-tinted glow so the failure reads
            as intentional tactical chrome, not a broken white screen. */}
        <DotGridBg opacity={0.35} />
        <GlowBg origin="bottom" color={`${COLORS.crit}26`} intensity={0.5} />
        <ScanningLine color={COLORS.crit} duration={6} />

        {/* ── TOP HUD ─────────────────────────────────────── */}
        <HudStrip side="top" height={48}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.md,
              flex: 1,
              minWidth: 0,
            }}
          >
            <BracketLabel tone="crit" size="base">
              SYSTEM FAULT
            </BracketLabel>
            <Mono tone="dim" size="xs">
              ERR-500
            </Mono>
          </div>
          <StatusPill
            label={held ? 'HELD' : 'RECOVERY'}
            tone="crit"
            pulse={!held}
            size="xs"
          />
        </HudStrip>

        {/* ── BODY ────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            zIndex: 1,
            padding: SPACE.xl,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE.xl,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: SPACE.xl,
            }}
          >
            {/* Fault glyph with pulsing crit glow */}
            <motion.div
              animate={{
                opacity: held ? 0.6 : [0.4, 1, 0.4],
                scale: held ? 1 : [1, 1.04, 1],
              }}
              transition={{
                duration: 1.8,
                repeat: held ? 0 : Infinity,
                ease: MOTION.easeSmooth,
              }}
              style={{
                position: 'relative',
                width: 88,
                height: 88,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: COLORS.surface,
                border: `1px solid ${COLORS.crit}`,
                borderRadius: RADIUS.sm,
                boxShadow: `0 0 28px ${COLORS.crit}55`,
              }}
            >
              <BracketFrame color={COLORS.crit} size={15} />
              <AlertOctagon
                size={51}
                strokeWidth={1.5}
                color={COLORS.crit}
              />
            </motion.div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: SPACE.sm,
                textAlign: 'center',
              }}
            >
              <h1
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 46,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  color: COLORS.textPrimary,
                  margin: 0,
                }}
              >
                System fault
              </h1>
              <Mono tone="muted" size="sm">
                Unhandled render exception
              </Mono>
            </div>

            {/* Restart card */}
            <TacticalCard padding="md" style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: SPACE.sm,
                }}
              >
                <Mono tone="crit" size="xs">
                  {held ? 'AUTO-RESTART HELD' : 'RESTARTING IN'}
                </Mono>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: held ? COLORS.textMuted : COLORS.crit,
                    lineHeight: 1,
                  }}
                >
                  {held ? '—' : `${countdown}s`}
                </span>
              </div>

              {/* Depleting progress bar (0 when held) */}
              <div
                style={{
                  height: 4,
                  width: '100%',
                  background: COLORS.surfaceElev,
                  border: `1px solid ${COLORS.border}`,
                  overflow: 'hidden',
                  marginBottom: SPACE.md,
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    width: `${progress * 100}%`,
                    opacity: held ? 0.3 : 1,
                  }}
                  transition={{
                    duration: held ? MOTION.fast : 0.9,
                    ease: MOTION.linear,
                  }}
                  style={{
                    height: '100%',
                    background: `linear-gradient(90deg, ${COLORS.crit}, ${COLORS.accentBright})`,
                    boxShadow: held ? 'none' : `0 0 8px ${COLORS.crit}80`,
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: SPACE.sm,
                }}
              >
                <div style={{ flex: 1 }}>
                  <TacticalButton
                    variant="danger"
                    fullWidth
                    size="md"
                    icon={<RotateCcw size={17} strokeWidth={2} />}
                    onClick={this.handleRestartNow}
                    style={{ height: 44 }}
                  >
                    Restart now
                  </TacticalButton>
                </div>
                {!held && (
                  <div style={{ flexShrink: 0, width: 110 }}>
                    <TacticalButton
                      variant="secondary"
                      fullWidth
                      size="md"
                      icon={<Pause size={17} strokeWidth={2} />}
                      onClick={this.handleHold}
                      style={{ height: 44 }}
                    >
                      Hold
                    </TacticalButton>
                  </div>
                )}
              </div>
            </TacticalCard>

            {/* Debug: show error details. Capped so a huge stack doesn't
                blow out the layout — full trace is in the console. */}
            {debug && error && (
              <TacticalCard padding="md" style={{ width: '100%' }}>
                <Mono tone="crit" size="xs">
                  // ERROR
                </Mono>
                <pre
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 14,
                    color: COLORS.textPrimary,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: `${SPACE.sm}px 0 0`,
                    padding: SPACE.sm,
                    background: COLORS.surfaceElev,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    maxHeight: 180,
                    overflow: 'auto',
                  }}
                >
                  {error.name}: {error.message}
                  {error.stack ? '\n' + error.stack : ''}
                  {errorInfo?.componentStack
                    ? '\n' + errorInfo.componentStack
                    : ''}
                </pre>
              </TacticalCard>
            )}
          </div>
        </div>

        {/* ── BOTTOM HUD ──────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
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
              <Mono tone="crit" size="xs">
                FAULT · RECOVERY
              </Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="dim" size="xs">
                Node ER-01
              </Mono>
            </div>
            <Mono tone="dim" size="xs">
              PULSE v1.2.4
            </Mono>
          </HudStrip>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
