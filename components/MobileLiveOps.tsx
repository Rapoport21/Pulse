import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Users, Activity, AlertTriangle, Clock, TrendingUp, TrendingDown, Minus, UserCheck } from 'lucide-react';
import { Status, ZoneStatus, UserProfile } from '../types';
import {
  COLORS, FONTS, TYPE, SPACE, RADIUS, MOTION,
  Mono, StatusPill, TacticalCard, CornerBracket, type StatusTone,
} from './design';
import { MobileScreenHeader } from './MobileScreenHeader';

/* ── Props ── */

export interface MobileLiveOpsProps {
  currentUser: UserProfile;
  systemStatus: 'normal' | 'stale' | 'manual';
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  isSurgeActive: boolean;
}

/* ── Mock data (mirrors desktop LiveOps) ── */

interface ExtendedZone extends ZoneStatus { floor: number }

const Z: ExtendedZone[] = [
  { id: 'waiting',   floor: 1, name: 'Waiting Room',      occupancy: 95,  capacity: 40, patients: 38, status: Status.CRITICAL, trend: 'Rising',  staffing: '2 RN, 1 Security',    waitTime: '2h 15m' },
  { id: 'triage',    floor: 1, name: 'Triage / Intake',    occupancy: 80,  capacity: 10, patients: 8,  status: Status.WARNING,  trend: 'Stable',  staffing: '3 RN',                waitTime: '15m' },
  { id: 'acute',     floor: 1, name: 'Acute Care Pods',    occupancy: 100, capacity: 30, patients: 30, status: Status.CRITICAL, trend: 'Rising',  staffing: '8 RN, 2 MD',          waitTime: 'N/A' },
  { id: 'resus',     floor: 1, name: 'Trauma Bay',         occupancy: 25,  capacity: 4,  patients: 1,  status: Status.NORMAL,   trend: 'Stable',  staffing: '4 RN, 2 MD',          waitTime: '0m' },
  { id: 'imaging',   floor: 1, name: 'Radiology (CT/XR)',  occupancy: 60,  capacity: 5,  patients: 3,  status: Status.NORMAL,   trend: 'Stable',  staffing: '2 Tech',              waitTime: '45m' },
  { id: 'fasttrack', floor: 1, name: 'Fast Track',         occupancy: 40,  capacity: 15, patients: 6,  status: Status.NORMAL,   trend: 'Falling', staffing: '2 NP, 1 RN',          waitTime: '30m' },
  { id: 'icu_surg',  floor: 2, name: 'SICU (Surgical)',    occupancy: 90,  capacity: 20, patients: 18, status: Status.WARNING,  trend: 'Stable',  staffing: '10 RN, 2 Intensivist', waitTime: 'N/A' },
  { id: 'icu_med',   floor: 2, name: 'MICU (Medical)',     occupancy: 60,  capacity: 20, patients: 12, status: Status.NORMAL,   trend: 'Stable',  staffing: '6 RN, 1 Intensivist', waitTime: 'N/A' },
  { id: 'or_main',   floor: 2, name: 'Operating Theatre',  occupancy: 75,  capacity: 8,  patients: 6,  status: Status.NORMAL,   trend: 'Rising',  staffing: 'Full Team',            waitTime: 'Sch Only' },
  { id: 'pacu',      floor: 2, name: 'PACU Recovery',      occupancy: 85,  capacity: 12, patients: 10, status: Status.WARNING,  trend: 'Rising',  staffing: '4 RN',                waitTime: '20m Hold' },
  { id: 'ward_3a',   floor: 3, name: '3A: Gen Med',        occupancy: 98,  capacity: 40, patients: 39, status: Status.CRITICAL, trend: 'Rising',  staffing: '6 RN, 2 CNA',         waitTime: '4h Admit' },
  { id: 'ward_3b',   floor: 3, name: '3B: Ortho/Neuro',    occupancy: 70,  capacity: 30, patients: 21, status: Status.NORMAL,   trend: 'Stable',  staffing: '5 RN',                waitTime: 'N/A' },
  { id: 'telemetry', floor: 3, name: '3C: Telemetry',      occupancy: 88,  capacity: 25, patients: 22, status: Status.WARNING,  trend: 'Stable',  staffing: '4 RN',                waitTime: '1h Hold' },
];

const FLOORS = [
  { id: 1, label: 'ED',      code: 'EMRG' },
  { id: 2, label: 'ICU/OR',  code: 'ICU' },
  { id: 3, label: 'Med/Surg', code: 'M/S' },
] as const;

/* ── Helpers ── */

const toTone = (s: Status): StatusTone =>
  s === Status.CRITICAL ? 'crit' : s === Status.WARNING ? 'warn' : 'ok';

const toColor = (s: Status): string =>
  s === Status.CRITICAL ? COLORS.crit : s === Status.WARNING ? COLORS.warn : COLORS.ok;

const toneColor = (t: StatusTone | 'primary'): string => {
  if (t === 'crit') return COLORS.crit;
  if (t === 'warn') return COLORS.warn;
  if (t === 'ok')   return COLORS.ok;
  if (t === 'info') return COLORS.info;
  return COLORS.textPrimary;
};

const TrendIcon: React.FC<{ trend: string; color: string }> = ({ trend, color }) => {
  if (trend === 'Rising')  return <TrendingUp size={14} color={color} />;
  if (trend === 'Falling') return <TrendingDown size={14} color={color} />;
  return <Minus size={14} color={COLORS.textMuted} />;
};

/* ── Main component ── */

export const MobileLiveOps: React.FC<MobileLiveOpsProps> = ({
  currentUser, systemStatus, showToast, isSurgeActive,
}) => {
  const [currentFloor, setCurrentFloor] = useState(1);

  const floorZones = useMemo(() => Z.filter((z) => z.floor === currentFloor), [currentFloor]);

  const kpis = useMemo(() => {
    const totalPax = floorZones.reduce((a, z) => a + z.patients, 0);
    const totalCap = floorZones.reduce((a, z) => a + z.capacity, 0);
    const util = totalCap > 0 ? Math.round((totalPax / totalCap) * 100) : 0;
    const critical = floorZones.filter((z) => z.status === Status.CRITICAL).length;
    const maxWait =
      floorZones.map((z) => z.waitTime).find((w) => /h/.test(w)) ||
      floorZones.map((z) => z.waitTime).find((w) => /\d+m/.test(w)) || 'N/A';
    return { totalPax, totalCap, util, critical, maxWait };
  }, [floorZones]);

  const utilTone: StatusTone = kpis.util >= 90 ? 'crit' : kpis.util >= 75 ? 'warn' : 'ok';

  return (
    <div style={{
      width: '100%', minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      background: COLORS.bg, fontFamily: FONTS.sans, color: COLORS.textPrimary,
      overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
      padding: SPACE.base, gap: SPACE.base,
    }}>
      {/* Universal breadcrumb + title — anchors this screen to the
          same baseline as every other mobile tab so the marker line
          doesn't drift when switching tabs. Page slug is "ACTIONS"
          (not "LIVE OPS") because that's the tab the user is on. */}
      <MobileScreenHeader
        role={currentUser.role}
        page="ACTIONS"
        title="Live Ops"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            {isSurgeActive && <StatusPill label="SURGE" tone="crit" pulse />}
            <StatusPill
              label={systemStatus === 'normal' ? 'LIVE' : systemStatus.toUpperCase()}
              tone={systemStatus === 'normal' ? 'ok' : systemStatus === 'stale' ? 'warn' : 'info'}
              pulse={systemStatus === 'normal'}
            />
          </div>
        }
      />

      {/* Floor selector */}
      <div style={{
        display: 'flex', gap: SPACE.xs,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md, padding: 3,
      }}>
        {FLOORS.map((f) => {
          const active = currentFloor === f.id;
          return (
            <button key={f.id} onClick={() => setCurrentFloor(f.id)} style={{
              flex: 1, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? COLORS.accent : 'transparent',
              border: 'none', borderRadius: RADIUS.sm,
              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: active ? COLORS.textPrimary : COLORS.textSecondary,
              cursor: 'pointer',
              transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
              boxShadow: active ? `0 0 12px ${COLORS.accentGlow}` : 'none',
            }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* KPI grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
        <KpiTile icon={<Users size={16} color={COLORS.accent} />}
          label="Census" value={`${kpis.totalPax}`} sub={`/ ${kpis.totalCap}`} tone="primary" />
        <KpiTile icon={<Activity size={16} color={toColor(
            kpis.util >= 90 ? Status.CRITICAL : kpis.util >= 75 ? Status.WARNING : Status.NORMAL)} />}
          label="Utilization" value={`${kpis.util}%`} tone={utilTone} />
        <KpiTile icon={<AlertTriangle size={16} color={kpis.critical > 0 ? COLORS.crit : COLORS.ok} />}
          label="Critical Zones" value={`${kpis.critical}`} tone={kpis.critical > 0 ? 'crit' : 'ok'} />
        <KpiTile icon={<Clock size={16} color={COLORS.warn} />}
          label="Max Wait" value={kpis.maxWait} tone={/h/.test(kpis.maxWait) ? 'warn' : 'ok'} />
      </div>

      {/* Zone section header */}
      <Mono tone="muted" size="xs" style={{ marginTop: SPACE.xs }}>
        // {FLOORS.find((f) => f.id === currentFloor)?.code} ZONES
      </Mono>

      {/* Zone cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {floorZones.map((zone) => (
          <ZoneCard key={zone.id} zone={zone} showToast={showToast} />
        ))}
      </div>

      {/* Safe-area bottom spacer */}
      <div style={{ height: SPACE.xl, flexShrink: 0 }} />
    </div>
  );
};

/* ── KpiTile ── */

const KpiTile: React.FC<{
  icon: React.ReactNode; label: string; value: string;
  sub?: string; tone?: StatusTone | 'primary';
}> = ({ icon, label, value, sub, tone = 'primary' }) => (
  <TacticalCard padding="sm" style={{ position: 'relative' }}>
    <CornerBracket position="tl" color={COLORS.border} size={8} thickness={1} />
    <CornerBracket position="br" color={COLORS.border} size={8} thickness={1} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <Mono tone="muted" size="xs">{label}</Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: FONTS.sans, fontSize: 28, fontWeight: 600,
          letterSpacing: '-0.03em', lineHeight: 1, color: toneColor(tone),
        }}>
          {value}
        </span>
        {sub && <Mono tone="muted" size="xs">{sub}</Mono>}
      </div>
    </div>
  </TacticalCard>
);

/* ── ZoneCard ── */

const ZoneCard: React.FC<{
  zone: ExtendedZone;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ zone, showToast }) => {
  const color = toColor(zone.status);
  const tone = toTone(zone.status);
  const trendColor = zone.trend === 'Rising' ? COLORS.crit
    : zone.trend === 'Falling' ? COLORS.ok : COLORS.textMuted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
    >
      <TacticalCard padding="sm" interactive style={{ position: 'relative' }}
        onClick={() => showToast(`${zone.name} selected`, 'info')}>
        {/* Name + status */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: SPACE.sm,
        }}>
          <span style={{
            fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, fontWeight: 600,
            color: COLORS.textPrimary, letterSpacing: TYPE.bodySm.tracking,
          }}>
            {zone.name}
          </span>
          <StatusPill label={zone.status} tone={tone}
            pulse={zone.status === Status.CRITICAL} size="xs" />
        </div>

        {/* Occupancy bar */}
        <div style={{
          height: 6, borderRadius: RADIUS.full,
          background: COLORS.surfaceHover, overflow: 'hidden', marginBottom: SPACE.sm,
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(zone.occupancy, 100)}%` }}
            transition={{ duration: MOTION.slow, ease: MOTION.ease }}
            style={{
              height: '100%', borderRadius: RADIUS.full,
              background: color, boxShadow: `0 0 8px ${color}60`,
            }}
          />
        </div>

        {/* Detail row: beds | staff | wait | trend */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: SPACE.xs, alignItems: 'center',
        }}>
          <DetailCell label="Beds">
            <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
              {zone.patients}/{zone.capacity}
            </span>
          </DetailCell>
          <DetailCell label="Staff">
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <UserCheck size={11} color={COLORS.textSecondary} />
              <span style={{
                fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textSecondary,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60,
              }}>
                {zone.staffing.split(',')[0]}
              </span>
            </div>
          </DetailCell>
          <DetailCell label="Wait">
            <span style={{
              fontFamily: FONTS.mono, fontSize: 13, fontWeight: 500,
              color: /h/.test(zone.waitTime) ? COLORS.warn : COLORS.textSecondary,
            }}>
              {zone.waitTime}
            </span>
          </DetailCell>
          <DetailCell label="Trend" center>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <TrendIcon trend={zone.trend} color={trendColor} />
              <Mono tone={zone.trend === 'Rising' ? 'crit' : zone.trend === 'Falling' ? 'ok' : 'muted'} size="xs">
                {zone.trend}
              </Mono>
            </div>
          </DetailCell>
        </div>
      </TacticalCard>
    </motion.div>
  );
};

/* ── DetailCell (tiny helper to reduce repetition in zone detail rows) ── */

const DetailCell: React.FC<{
  label: string; center?: boolean; children: React.ReactNode;
}> = ({ label, center, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: center ? 'center' : undefined }}>
    <Mono tone="muted" size="xs">{label}</Mono>
    {children}
  </div>
);
