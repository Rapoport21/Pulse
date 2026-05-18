/**
 * AiActivityOrbPanel — the Rehoboam-style AI activity surface.
 *
 * Drop-in replacement for <AiActivityPanel> on Alerts / Staffing /
 * Tasks. Defaults to the cinematic orb (RehoboamOrb) and keeps the
 * original list one tap away (ORB | LIST toggle) so nothing is lost
 * and the list stays accessible for scanning detail.
 *
 * RehoboamOrb is lazy-loaded so the heavy three bundle only loads when
 * an orb panel actually mounts; the Suspense fallback is the list, so
 * the surface is useful immediately and degrades gracefully.
 */

import React, { Suspense, lazy, useState } from 'react';
import { Boxes, List } from 'lucide-react';
import { COLORS, FONTS, SPACE, RADIUS, Mono } from './design';
import { AiActivityPanel } from './PulseAi';
import { useAiActivity, kindLabel } from '../lib/pulseAI';
import type { AiSurface } from '../lib/pulseAI';

const RehoboamOrb = lazy(() => import('./RehoboamOrb'));

interface AiActivityOrbPanelProps {
  surface?: AiSurface;
  limit?: number;
  title?: string;
}

export const AiActivityOrbPanel: React.FC<AiActivityOrbPanelProps> = ({
  surface = 'alerts',
  limit = 4,
  title = 'AI · ACTIVITY',
}) => {
  const [view, setView] = useState<'orb' | 'list'>('orb');
  const events = useAiActivity(surface);
  const recent = events[0];

  const ToggleBtn: React.FC<{
    mode: 'orb' | 'list';
    icon: React.ReactNode;
    label: string;
  }> = ({ mode, icon, label }) => {
    const active = view === mode;
    return (
      <button
        type="button"
        onClick={() => setView(mode)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 22,
          padding: `0 ${SPACE.sm}px`,
          fontFamily: FONTS.mono,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: active ? COLORS.textPrimary : COLORS.textMuted,
          background: active ? COLORS.surfaceElev : 'transparent',
          border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
          borderRadius: RADIUS.sm,
          cursor: 'pointer',
        }}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
      }}
    >
      {/* Header: title + ORB/LIST toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <Mono size="xs" style={{ color: COLORS.textSecondary, fontWeight: 700, letterSpacing: '0.14em' }}>
          {title}
        </Mono>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <ToggleBtn mode="orb" icon={<Boxes size={10} />} label="Orb" />
          <ToggleBtn mode="list" icon={<List size={10} />} label="List" />
        </div>
      </div>

      {view === 'orb' ? (
        <div>
          <Suspense
            fallback={
              <AiActivityPanel surface={surface} limit={limit} title={title} />
            }
          >
            <RehoboamOrb surface={surface} height={210} />
          </Suspense>
          {/* One-line live readout under the orb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              borderTop: `1px solid ${COLORS.border}`,
            }}
          >
            <Mono size="xs" style={{ color: COLORS.textMuted }}>
              {events.length} active
            </Mono>
            {recent && (
              <Mono
                size="xs"
                style={{
                  color: COLORS.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                · {kindLabel(recent.kind)} · {recent.title}
              </Mono>
            )}
          </div>
        </div>
      ) : (
        <AiActivityPanel surface={surface} limit={limit} title={title} />
      )}
    </div>
  );
};
