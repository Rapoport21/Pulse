import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Flag,
  AlertTriangle,
  MessageSquare,
  Activity,
  Plus,
  Check,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { LogEvent } from '../types';
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
  SectionTitle,
  TacticalCard,
  TacticalButton,
  CornerBracket,
} from './design';

const initialLogs: LogEvent[] = [
  { id: '1', time: '13:30', type: 'METRIC', description: 'ED Capacity crossed 90% threshold', detail: 'Triggered initial warning' },
  { id: '2', time: '13:45', type: 'NOTE', description: 'Nursing Supervisor noted call-outs for night shift', detail: '-2 RNs' },
  { id: '3', time: '14:00', type: 'METRIC', description: 'EMS Offload Time spiked to 45m', detail: '3 ambulances waiting' },
  { id: '4', time: '14:15', type: 'DECISION', description: 'Activated Surge Playbook Level 2', detail: 'Authorized by Dr. Chen' },
  { id: '5', time: '14:20', type: 'ACTION', description: 'Message sent to House Supervisor', detail: 'Requesting fast-track opening' },
];

interface ReplayProps {
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

/**
 * Replay — historical incident playback with annotation.
 * Tactical theme: rose accent chart, mono controls, T-Xm status pill,
 * tactical cards and buttons throughout.
 */
export const Replay: React.FC<ReplayProps> = ({ showToast }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderValue, setSliderValue] = useState(100);
  const [logs, setLogs] = useState<LogEvent[]>(initialLogs);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [newAnnotationText, setNewAnnotationText] = useState('');

  // Chart dataset — memoized so the "now" timestamp snapshots on mount.
  const chartData = useMemo(
    () =>
      Array.from({ length: 100 }, (_, i) => {
        const t = new Date();
        t.setMinutes(t.getMinutes() - (100 - i));
        return {
          time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          saturation: 80 + Math.sin(i / 10) * 15 + i / 10,
          index: i,
        };
      }),
    [],
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isPlaying && sliderValue < 100) {
      interval = setInterval(() => {
        setSliderValue((prev) => Math.min(prev + 1, 100));
      }, 100);
    } else if (sliderValue >= 100) {
      setIsPlaying(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, sliderValue]);

  const currentDataPoint = chartData[sliderValue === 100 ? 99 : sliderValue];

  const handleAddAnnotation = () => {
    if (!newAnnotationText.trim()) return;
    const newLog: LogEvent = {
      id: Date.now().toString(),
      time: currentDataPoint.time,
      type: 'NOTE',
      description: newAnnotationText,
      detail: 'Added during replay review',
    };
    setLogs([...logs, newLog]);
    setNewAnnotationText('');
    setIsAddingAnnotation(false);
    if (showToast) showToast('Annotation added to timeline', 'success');
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'METRIC':
        return { Icon: AlertTriangle, color: COLORS.warn };
      case 'DECISION':
        return { Icon: Flag, color: COLORS.accent };
      case 'NOTE':
        return { Icon: MessageSquare, color: COLORS.info };
      default:
        return { Icon: Activity, color: COLORS.textSecondary };
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE['2xl'],
        background: COLORS.bg,
        gap: SPACE.lg,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: SPACE.lg }}>
        <div>
          <SectionTitle
            id="REPLAY.TIMELINE"
            label="Historical Incident Replay"
            divider={false}
            style={{ marginBottom: 4 }}
          />
          <Mono tone="muted" size="xs">
            // Scrub any window to review capacity, decisions, and annotations
          </Mono>
        </div>
        <StatusPill
          label={sliderValue === 100 ? 'LIVE' : `T-${100 - sliderValue}m`}
          tone={sliderValue === 100 ? 'ok' : 'warn'}
          pulse={sliderValue === 100}
        />
      </div>

      {/* Visualizer card — chart + current stats */}
      <TacticalCard
        padding="none"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 260,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceElev,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <Activity size={14} strokeWidth={2} color={COLORS.textSecondary} />
            <Mono tone="primary" size="sm">
              System Saturation
            </Mono>
          </div>
          <Mono tone="muted" size="xs">
            RANGE: 100M · RESOLUTION: 1M
          </Mono>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Chart */}
          <div style={{ flex: 1, position: 'relative', padding: SPACE.md }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="saturationFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={COLORS.border} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke={COLORS.textMuted}
                  fontSize={10}
                  fontFamily={FONTS.mono}
                  tickMargin={10}
                />
                <YAxis
                  stroke={COLORS.textMuted}
                  fontSize={10}
                  fontFamily={FONTS.mono}
                  domain={[60, 120]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.borderStrong}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                  }}
                  itemStyle={{ color: COLORS.info }}
                  labelStyle={{ color: COLORS.textMuted }}
                />
                <ReferenceLine
                  x={currentDataPoint?.time}
                  stroke={COLORS.textSecondary}
                  strokeDasharray="2 3"
                />
                <Area
                  type="monotone"
                  dataKey="saturation"
                  stroke={COLORS.info}
                  strokeWidth={1.5}
                  fill="url(#saturationFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Current stats */}
          <div
            style={{
              width: 240,
              borderLeft: `1px solid ${COLORS.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: SPACE.lg,
              gap: SPACE.sm,
              background: COLORS.bgDeep,
            }}
          >
            <Mono tone="muted" size="xs">
              Current Saturation
            </Mono>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: '-0.04em',
                color: COLORS.textPrimary,
                lineHeight: 0.95,
              }}
            >
              {currentDataPoint?.saturation.toFixed(1)}
              <span
                style={{
                  fontSize: 22,
                  color: COLORS.info,
                  marginLeft: 4,
                }}
              >
                %
              </span>
            </div>
            <Mono tone="info" size="sm">
              {currentDataPoint?.time}
            </Mono>
          </div>
        </div>
      </TacticalCard>

      {/* Controls + timeline */}
      <TacticalCard padding="md" style={{ padding: SPACE.lg }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: SPACE.base,
            gap: SPACE.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isPlaying ? COLORS.accent : COLORS.surfaceElev,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: RADIUS.sm,
                color: isPlaying ? COLORS.textPrimary : COLORS.accent,
                cursor: 'pointer',
                transition: `all ${MOTION.fast}s ease`,
                boxShadow: isPlaying ? `0 0 16px ${COLORS.accent}60` : 'none',
              }}
            >
              {isPlaying ? (
                <Pause size={16} strokeWidth={2} />
              ) : (
                <Play size={16} strokeWidth={2} style={{ marginLeft: 2 }} />
              )}
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              <IconBtn
                onClick={() => setSliderValue(Math.max(0, sliderValue - 10))}
                label="Jump back 10m"
              >
                <SkipBack size={14} strokeWidth={2} />
              </IconBtn>
              <IconBtn
                onClick={() => setSliderValue(Math.min(100, sliderValue + 10))}
                label="Jump forward 10m"
              >
                <SkipForward size={14} strokeWidth={2} />
              </IconBtn>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: SPACE.sm,
                fontFamily: FONTS.mono,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  letterSpacing: '0.04em',
                }}
              >
                {currentDataPoint?.time}
              </span>
              <Mono tone="muted" size="xs">
                {sliderValue === 100 ? 'LIVE' : 'REPLAY'}
              </Mono>
            </div>
            <TacticalButton
              variant="secondary"
              size="sm"
              icon={<Plus size={13} strokeWidth={2} />}
              onClick={() => setIsAddingAnnotation(!isAddingAnnotation)}
            >
              Add Note
            </TacticalButton>
          </div>
        </div>

        {/* Annotation input */}
        <AnimatePresence initial={false}>
          {isAddingAnnotation && (
            <motion.div
              key="anno"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              style={{ overflow: 'hidden', marginBottom: SPACE.base }}
            >
              <div style={{ display: 'flex', gap: SPACE.sm, paddingTop: 4 }}>
                <input
                  type="text"
                  value={newAnnotationText}
                  onChange={(e) => setNewAnnotationText(e.target.value)}
                  placeholder="Add improvement note or annotation…"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAnnotation()}
                  style={{
                    flex: 1,
                    height: 32,
                    padding: '0 10px',
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    outline: 'none',
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sans,
                    fontSize: 12,
                    letterSpacing: '-0.005em',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = COLORS.accent)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
                />
                <TacticalButton
                  variant="primary"
                  size="sm"
                  onClick={handleAddAnnotation}
                  icon={<Check size={13} strokeWidth={2} />}
                >
                  Save
                </TacticalButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline with markers */}
        <div style={{ position: 'relative', height: 48, display: 'flex', alignItems: 'center' }}>
          {/* Rail */}
          <div
            style={{
              position: 'absolute',
              inset: '50% 0 auto 0',
              height: 2,
              transform: 'translateY(-50%)',
              background: COLORS.border,
            }}
          />
          {/* Filled segment */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 2,
              width: `${sliderValue}%`,
              background: COLORS.info,
              transition: 'width 75ms linear',
            }}
          />

          {/* Markers */}
          {logs.map((log) => {
            const logTime = new Date(`1970/01/01 ${log.time}`);
            const now = new Date();
            const nowTime = new Date(
              `1970/01/01 ${now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`,
            );
            const diffMinutes = (nowTime.getTime() - logTime.getTime()) / 60000;
            const leftPos = Math.max(0, Math.min(100, 100 - diffMinutes));
            const { Icon, color } = getLogIcon(log.type);

            return (
              <div
                key={log.id}
                className="replay-marker"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${leftPos}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 10,
                  height: 10,
                  borderRadius: RADIUS.full,
                  background: color,
                  border: `2px solid ${COLORS.bg}`,
                  zIndex: 10,
                  cursor: 'pointer',
                  boxShadow: `0 0 8px ${color}80`,
                }}
              >
                {/* Tooltip on hover */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 200,
                    padding: SPACE.sm,
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.borderStrong}`,
                    borderRadius: RADIUS.sm,
                    opacity: 0,
                    transition: `opacity ${MOTION.fast}s ease`,
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                  className="replay-tooltip"
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <Icon size={12} strokeWidth={2} color={color} />
                    <Mono tone="primary" size="xs">
                      {log.time} · {log.type}
                    </Mono>
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 11,
                      color: COLORS.textSecondary,
                      lineHeight: 1.4,
                    }}
                  >
                    {log.description}
                  </div>
                  {log.detail && (
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 10,
                        color: COLORS.textMuted,
                        fontStyle: 'italic',
                        marginTop: 4,
                      }}
                    >
                      {log.detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Range input — transparent, covers entire rail */}
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={(e) => setSliderValue(parseInt(e.target.value))}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 30,
            }}
          />

          {/* Playhead bar */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${sliderValue}%`,
              transform: 'translate(-50%, -50%)',
              width: 2,
              height: 28,
              background: COLORS.info,
              pointerEvents: 'none',
              transition: 'left 75ms linear',
            }}
          />
          <CornerBracket
            position="tl"
            color={COLORS.borderStrong}
            size={6}
            thickness={1}
            inset={0}
          />
          <CornerBracket
            position="bl"
            color={COLORS.borderStrong}
            size={6}
            thickness={1}
            inset={0}
          />
          <CornerBracket
            position="tr"
            color={COLORS.borderStrong}
            size={6}
            thickness={1}
            inset={0}
          />
          <CornerBracket
            position="br"
            color={COLORS.borderStrong}
            size={6}
            thickness={1}
            inset={0}
          />
        </div>
      </TacticalCard>

      <style>
        {`.replay-marker:hover .replay-tooltip { opacity: 1 !important; }`}
      </style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Tiny icon button reused for skip controls
// ─────────────────────────────────────────────────────────────────────────
const IconBtn: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, label, children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? COLORS.surface : 'transparent',
        border: `1px solid ${hovered ? COLORS.border : 'transparent'}`,
        borderRadius: RADIUS.sm,
        color: hovered ? COLORS.textPrimary : COLORS.textSecondary,
        cursor: 'pointer',
        transition: `all ${MOTION.fast}s ease`,
      }}
    >
      {children}
    </button>
  );
};
