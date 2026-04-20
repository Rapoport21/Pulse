/**
 * BriefMeScreen — fullscreen AI-generated operational briefing overlay.
 * Core PULSE differentiator: AI synthesizes all hospital data into a
 * role-aware narrative briefing.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronRight,
  BrainCircuit, Clock, Activity, Users, Gauge, Timer,
  AlertTriangle, ChevronDown,
} from 'lucide-react';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION, cssTransition, Z,
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
  Mono, BracketLabel, StatusPill, TacticalCard, TacticalButton,
  HudStrip, ScanningLine, ConfidenceBadge, Divider,
} from '../design';

export interface BriefMeScreenProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';
interface PriorityAction { severity: Severity; text: string; department: string }
interface SpotlightPatient { id: string; name: string; summary: string; mews: number; hr: number; bp: string; spo2: number; trend: 'up' | 'down' | 'stable' }
interface ForecastItem { text: string; confidence: number }
interface HistoryEntry { time: string; summary: string }

// Mock data
const EXEC_SUMMARY = 'ED operating at 82% capacity with 3 critical patients. ICU has 1 bed available \u2014 expect 2 transfers from ED within the next 90 minutes. Staffing is adequate for current census but night shift will be 2 RNs short in ICU. Blood bank inventory is sufficient; OR utilization is at 67% with 2 rooms available.';

const METRICS: Array<{ label: string; value: string; trend: 'up' | 'down' | 'stable'; tone: 'ok' | 'warn' | 'crit' | 'info'; icon: React.ReactNode }> = [
  { label: 'Census', value: '42/52', trend: 'up', tone: 'info', icon: <Users size={13} /> },
  { label: 'Capacity', value: '81%', trend: 'up', tone: 'warn', icon: <Gauge size={13} /> },
  { label: 'MEWS>3', value: '2 pts', trend: 'stable', tone: 'crit', icon: <Activity size={13} /> },
  { label: 'Avg Wait', value: '34min', trend: 'up', tone: 'warn', icon: <Timer size={13} /> },
];

const PRIORITY_ACTIONS: PriorityAction[] = [
  { severity: 'critical', text: 'Activate trauma team for incoming MVC, ETA 8 min', department: 'ED' },
  { severity: 'high', text: 'Initiate ICU transfer for P005 (sepsis) \u2014 bed ICU-5 available at 16:00', department: 'ICU' },
  { severity: 'high', text: 'Start heparin drip for P002 (NSTEMI) \u2014 cardiology consult accepted', department: 'ED' },
  { severity: 'medium', text: 'Call in float nurse for ICU night shift gap', department: 'Staffing' },
  { severity: 'low', text: 'Schedule post-op discharge for P004 tomorrow AM', department: 'Surgical' },
];

const SPOTLIGHT_PATIENTS: SpotlightPatient[] = [
  { id: 'P001', name: 'J. Martinez', summary: 'Hemorrhagic shock trajectory. MEWS 7, trending up. Consider OR if Hgb drops.', mews: 7, hr: 128, bp: '82/48', spo2: 91, trend: 'up' },
  { id: 'P005', name: 'A. Washington', summary: 'Sepsis progressing. Lactate 4.8, qSOFA 2. May need vasopressors within 2h.', mews: 5, hr: 112, bp: '90/58', spo2: 94, trend: 'up' },
  { id: 'P002', name: 'R. Patel', summary: 'NSTEMI stable. Serial trops rising. Cath within 24h.', mews: 3, hr: 88, bp: '138/82', spo2: 97, trend: 'stable' },
];

const FORECAST_ITEMS: ForecastItem[] = [
  { text: 'Capacity will reach 88% if 2 pending admissions arrive', confidence: 87 },
  { text: 'ICU will be at full capacity after 2 transfers', confidence: 82 },
  { text: 'ED wait times expected to increase to 45min by 17:00', confidence: 74 },
  { text: 'Staffing gap opens at 19:00 \u2014 2 RN short in ICU', confidence: 91 },
];

const HISTORY_ENTRIES: HistoryEntry[] = [
  { time: '14:00', summary: 'Surge threshold crossed, playbook activated' },
  { time: '12:00', summary: 'Normal operations, 3 pending discharges' },
  { time: '10:00', summary: 'Morning huddle brief, full staffing' },
];

// Helpers
const sevColor = (s: Severity) => s === 'critical' ? COLORS.crit : s === 'high' ? COLORS.warn : s === 'medium' ? COLORS.info : COLORS.textMuted;
const sevTone = (s: Severity): 'crit' | 'warn' | 'info' | 'neutral' => s === 'critical' ? 'crit' : s === 'high' ? 'warn' : s === 'medium' ? 'info' : 'neutral';
const mewsCol = (m: number) => m >= 5 ? COLORS.crit : m >= 3 ? COLORS.warn : COLORS.ok;
const tCol = (t: 'ok' | 'warn' | 'crit' | 'info') => t === 'ok' ? COLORS.ok : t === 'warn' ? COLORS.warn : t === 'crit' ? COLORS.crit : COLORS.info;

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'stable'; color: string }> = ({ trend, color }) =>
  trend === 'up' ? <TrendingUp size={11} color={color} /> : trend === 'down' ? <TrendingDown size={11} color={color} /> : <Minus size={11} color={color} />;

const VitalChip: React.FC<{ label: string; value: string; tone: 'ok' | 'warn' | 'crit' }> = ({ label, value, tone }) => {
  const c = tone === 'ok' ? COLORS.ok : tone === 'warn' ? COLORS.warn : COLORS.crit;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: FONTS.mono, fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', color: COLORS.textMuted, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: FONTS.mono, fontSize: 10, fontWeight: 600, color: c }}>{value}</span>
    </div>
  );
};

// Typing effect hook
function useTypingEffect(text: string, active: boolean, wordsPerTick = 2, intervalMs = 40): string {
  const [visibleCount, setVisibleCount] = useState(0);
  const words = text.split(' ');
  useEffect(() => {
    if (!active) { setVisibleCount(0); return; }
    setVisibleCount(0);
    const timer = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= words.length) { clearInterval(timer); return c; }
        return Math.min(c + wordsPerTick, words.length);
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [text, active, words.length, wordsPerTick, intervalMs]);
  return words.slice(0, visibleCount).join(' ');
}

// Close button style (reused)
const closeBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, background: 'transparent',
  border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm,
  color: COLORS.textSecondary, cursor: 'pointer',
};

export const BriefMeScreen: React.FC<BriefMeScreenProps> = ({ open, onClose, showToast }) => {
  const [regenerating, setRegenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

  useEffect(() => {
    if (open) { setReady(false); const t = setTimeout(() => setReady(true), 800); return () => clearTimeout(t); }
    setReady(false);
  }, [open]);

  const typedSummary = useTypingEffect(EXEC_SUMMARY, ready && !regenerating);

  const handleRegenerate = useCallback(() => {
    setRegenerating(true); setReady(false);
    showToast('Regenerating operational brief...');
    setTimeout(() => { setRegenerating(false); setReady(true); showToast('Brief updated'); }, 1800);
  }, [showToast]);

  const handleAct = useCallback((a: PriorityAction) => {
    showToast(`Action initiated: ${a.text.slice(0, 50)}...`);
  }, [showToast]);

  const handleClose = () => { setExpandedHistory(null); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="briefme-screen"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM, zIndex: Z.modal, background: COLORS.bg, display: 'flex', flexDirection: 'column', fontFamily: FONTS.sans, color: COLORS.textPrimary, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top)', borderTop: `1px solid ${COLORS.borderStrong}` }}
        >
          {/* Header */}
          <HudStrip side="top" fixed>
            <button onClick={handleClose} style={closeBtnStyle}><X size={14} /></button>
            <BracketLabel tone="accent" size="sm">Brief Me</BracketLabel>
            <div style={{ flex: 1 }} />
            <ConfidenceBadge confidence={91} ageMinutes={2} />
          </HudStrip>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflow: 'auto', paddingTop: 56, paddingBottom: 'max(env(safe-area-inset-bottom), 40px)', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>

              {/* 1. Briefing Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACE.sm }}>
                <div>
                  <BracketLabel tone="accent" size="base">Operational Brief</BracketLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs }}>
                    <Clock size={11} color={COLORS.textMuted} />
                    <Mono tone="muted" size="xs">Generated 2 minutes ago</Mono>
                  </div>
                </div>
                <TacticalButton variant="secondary" size="sm" onClick={handleRegenerate} disabled={regenerating}
                  icon={<RefreshCw size={12} style={regenerating ? { animation: 'spin 1s linear infinite' } : undefined} />}
                >Regenerate</TacticalButton>
              </div>

              {/* 2. Executive Summary */}
              <TacticalCard highlight accentBar padding="lg"
                style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceElev} 100%)` }}
              >
                <ScanningLine duration={8} />
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
                  <BrainCircuit size={14} color={COLORS.accent} />
                  <Mono tone="accent" size="xs">AI Synthesis</Mono>
                </div>
                <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size + 1, fontWeight: 400, lineHeight: 1.65, color: COLORS.textPrimary, minHeight: 72, letterSpacing: '-0.005em' }}>
                  <AnimatePresence mode="wait">
                    {!ready || regenerating ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                        <RefreshCw size={14} color={COLORS.info} style={{ animation: 'spin 1.4s linear infinite' }} />
                        <Mono tone="secondary" size="sm">Synthesizing hospital data...</Mono>
                      </motion.div>
                    ) : (
                      <motion.span key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: MOTION.fast }}>
                        {typedSummary}
                        {typedSummary.length < EXEC_SUMMARY.length && (
                          <span style={{ opacity: 0.5, animation: 'pulse-dot 0.8s ease-in-out infinite' }}>|</span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </TacticalCard>

              {/* 3. Key Metrics Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: SPACE.sm }}>
                {METRICS.map((m, i) => (
                  <motion.div key={m.label} initial={{ opacity: 0, y: 8 }}
                    animate={ready ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: i * 0.06, duration: MOTION.base, ease: MOTION.ease }}>
                    <TacticalCard padding="md">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: SPACE.xs }}>
                        <span style={{ color: tCol(m.tone) }}>{m.icon}</span>
                        <Mono tone="muted" size="xs">{m.label}</Mono>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: 600, color: tCol(m.tone), letterSpacing: '-0.02em', lineHeight: 1 }}>{m.value}</span>
                        <TrendIcon trend={m.trend} color={tCol(m.tone)} />
                      </div>
                    </TacticalCard>
                  </motion.div>
                ))}
              </div>

              <Divider />

              {/* 4. Priority Actions */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
                  <AlertTriangle size={13} color={COLORS.warn} />
                  <Mono tone="secondary" size="sm">Priority Actions</Mono>
                  <div style={{ flex: 1 }} />
                  <Mono tone="muted" size="xs">{PRIORITY_ACTIONS.length} items</Mono>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                  {PRIORITY_ACTIONS.map((action, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }}
                      animate={ready ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.1 + i * 0.05, duration: MOTION.base, ease: MOTION.ease }}
                      style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, padding: `${SPACE.md}px ${SPACE.base}px`, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${sevColor(action.severity)}`, borderRadius: RADIUS.sm }}
                    >
                      <StatusPill label={action.severity.toUpperCase()} tone={sevTone(action.severity)} size="xs" />
                      <span style={{ flex: 1, minWidth: 0, fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textPrimary, lineHeight: 1.4 }}>{action.text}</span>
                      <Mono tone="muted" size="xs" style={{ flexShrink: 0 }}>{action.department}</Mono>
                      <TacticalButton variant="primary" size="sm" onClick={() => handleAct(action)} icon={<ChevronRight size={11} />} style={{ flexShrink: 0 }}>Act</TacticalButton>
                    </motion.div>
                  ))}
                </div>
              </div>

              <Divider />

              {/* 5. Patient Spotlight */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
                  <Activity size={13} color={COLORS.crit} />
                  <Mono tone="secondary" size="sm">Patient Spotlight</Mono>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                  {SPOTLIGHT_PATIENTS.map((pt, i) => (
                    <motion.div key={pt.id} initial={{ opacity: 0, y: 8 }}
                      animate={ready ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.15 + i * 0.06, duration: MOTION.base, ease: MOTION.ease }}>
                      <TacticalCard padding="md">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE.md }}>
                          {/* MEWS badge */}
                          <div style={{ width: 36, height: 36, borderRadius: RADIUS.sm, background: `${mewsCol(pt.mews)}12`, border: `1.5px solid ${mewsCol(pt.mews)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: mewsCol(pt.mews), lineHeight: 1 }}>{pt.mews}</span>
                            <span style={{ fontFamily: FONTS.mono, fontSize: 7, fontWeight: 500, color: mewsCol(pt.mews), letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1, marginTop: 1 }}>MEWS</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs }}>
                              <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.body.size, fontWeight: 600, color: COLORS.textPrimary }}>{pt.name}</span>
                              <Mono tone="muted" size="xs">{pt.id}</Mono>
                              <TrendIcon trend={pt.trend} color={mewsCol(pt.mews)} />
                            </div>
                            <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textSecondary, lineHeight: 1.45, marginBottom: SPACE.sm }}>{pt.summary}</div>
                            <div style={{ display: 'flex', gap: SPACE.md, padding: `${SPACE.xs}px ${SPACE.sm}px`, background: COLORS.bgDeep, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}` }}>
                              <VitalChip label="HR" value={String(pt.hr)} tone={pt.hr > 120 ? 'crit' : pt.hr > 100 ? 'warn' : 'ok'} />
                              <VitalChip label="BP" value={pt.bp} tone={parseInt(pt.bp) < 90 ? 'crit' : 'ok'} />
                              <VitalChip label="SpO2" value={`${pt.spo2}%`} tone={pt.spo2 < 92 ? 'crit' : pt.spo2 < 95 ? 'warn' : 'ok'} />
                            </div>
                          </div>
                          <button onClick={() => showToast(`Opening chart for ${pt.name}`)}
                            style={{ ...closeBtnStyle, flexShrink: 0, alignSelf: 'center' }}>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </TacticalCard>
                    </motion.div>
                  ))}
                </div>
              </div>

              <Divider />

              {/* 6. Forecast */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
                  <TrendingUp size={13} color={COLORS.info} />
                  <Mono tone="secondary" size="sm">Next 90 Minutes</Mono>
                </div>
                <TacticalCard padding="md">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                    {FORECAST_ITEMS.map((item, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -6 }}
                        animate={ready ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.2 + i * 0.05, duration: MOTION.base, ease: MOTION.ease }}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE.md }}>
                        <div style={{ width: 5, height: 5, borderRadius: RADIUS.full, background: item.confidence >= 85 ? COLORS.ok : item.confidence >= 70 ? COLORS.warn : COLORS.textMuted, boxShadow: item.confidence >= 85 ? `0 0 4px ${COLORS.ok}` : undefined, flexShrink: 0, marginTop: 6 }} />
                        <span style={{ flex: 1, minWidth: 0, fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textPrimary, lineHeight: 1.45 }}>{item.text}</span>
                        <ConfidenceBadge confidence={item.confidence} ageMinutes={2} compact style={{ flexShrink: 0, marginTop: 2 }} />
                      </motion.div>
                    ))}
                  </div>
                </TacticalCard>
              </div>

              <Divider />

              {/* 7. Briefing History */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
                  <Clock size={13} color={COLORS.textMuted} />
                  <Mono tone="secondary" size="sm">Briefing History</Mono>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                  {HISTORY_ENTRIES.map((entry, i) => {
                    const expanded = expandedHistory === i;
                    return (
                      <motion.button key={i} onClick={() => setExpandedHistory(expanded ? null : i)} whileTap={{ scale: 0.99 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: expanded ? SPACE.sm : 0, padding: `${SPACE.md}px ${SPACE.base}px`, background: expanded ? COLORS.surfaceElev : COLORS.surface, border: `1px solid ${expanded ? COLORS.borderStrong : COLORS.border}`, borderRadius: RADIUS.sm, cursor: 'pointer', textAlign: 'left', width: '100%', outline: 'none', transition: cssTransition() }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, width: '100%' }}>
                          <Mono tone="accent" size="xs" style={{ flexShrink: 0 }}>{entry.time}</Mono>
                          <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textSecondary, flex: 1 }}>{entry.summary}</span>
                          <ChevronDown size={12} color={COLORS.textMuted} style={{ transition: `transform ${MOTION.fast}s ease`, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                        </div>
                        <AnimatePresence>
                          {expanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: MOTION.fast }} style={{ overflow: 'hidden' }}>
                              <Divider style={{ marginBottom: SPACE.sm }} />
                              <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textMuted, lineHeight: 1.5 }}>
                                Full briefing snapshot from {entry.time}. Census was stable with standard operations. No critical alerts at time of generation.
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer attribution */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, padding: `${SPACE.lg}px 0 ${SPACE.base}px` }}>
                <BrainCircuit size={12} color={COLORS.textDim} />
                <Mono tone="dim" size="xs">Powered by PULSE AI</Mono>
              </div>
            </div>
          </div>

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

BriefMeScreen.displayName = 'BriefMeScreen';
