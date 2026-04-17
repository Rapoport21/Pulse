import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Users,
  Bot,
  GripVertical,
  Check,
  Minus,
} from 'lucide-react';
import { createGeminiClient } from '../lib/gemini';
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
  TacticalCard,
  TacticalButton,
  CornerBracket,
} from './design';

interface Staff {
  id: string;
  name: string;
  role: string;
  currentZone: string | null;
}

interface Zone {
  id: string;
  name: string;
  occupancy: number;
}

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: Zone[];
  onAssign: (assignments: { staffId: string; zoneId: string }[]) => void;
}

const MOCK_STAFF: Staff[] = [
  { id: 's1', name: 'Dr. Sarah Jenkins', role: 'Attending', currentZone: null },
  { id: 's2', name: 'Dr. Michael Chen', role: 'Resident', currentZone: null },
  { id: 's3', name: 'Nurse Emily Davis', role: 'RN', currentZone: null },
  { id: 's4', name: 'Nurse James Wilson', role: 'RN', currentZone: null },
  { id: 's5', name: 'Tech Robert Brown', role: 'Tech', currentZone: null },
  { id: 's6', name: 'Tech Lisa Taylor', role: 'Tech', currentZone: null },
  { id: 's7', name: 'Dr. Amanda White', role: 'Attending', currentZone: null },
  { id: 's8', name: 'Nurse David Lee', role: 'RN', currentZone: null },
];

// Helper: occupancy → tone mapping for the zone load pill
const occupancyTone = (pct: number): 'ok' | 'warn' | 'crit' => {
  if (pct > 90) return 'crit';
  if (pct > 75) return 'warn';
  return 'ok';
};

/**
 * StaffManagementModal — tactical personnel deployment console.
 * Split-pane layout: personnel pool (left) + zone deployment grid (right).
 * Supports drag-and-drop assign, multi-select bulk assign, and AI
 * auto-assignment via Gemini (degraded to disabled button when offline).
 */
export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  onClose,
  zones,
  onAssign,
}) => {
  const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isAIAssigning, setIsAIAssigning] = useState(false);
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const { client: ai } = useMemo(() => createGeminiClient(), []);

  const handleToggleStaff = (id: string) => {
    setSelectedStaffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyAssignments = (
    assignments: { staffId: string; zoneId: string }[],
  ) => {
    setStaff((prev) =>
      prev.map((s) => {
        const assignment = assignments.find((a) => a.staffId === s.id);
        if (assignment) {
          return { ...s, currentZone: assignment.zoneId || null };
        }
        return s;
      }),
    );
    onAssign(assignments);
  };

  const handleAssignSelected = () => {
    if (selectedStaffIds.size === 0 || !selectedZoneId) return;
    const assignments = Array.from(selectedStaffIds).map((id) => ({
      staffId: id,
      zoneId: selectedZoneId,
    }));
    applyAssignments(assignments);
    setSelectedStaffIds(new Set());
  };

  const handleAIAssign = async () => {
    if (!ai) {
      console.warn('AI Auto-Assign is unavailable: Gemini API key is not configured.');
      return;
    }
    setIsAIAssigning(true);
    try {
      const prompt = `
        You are an AI hospital operations manager. Assign the following unassigned staff to the following zones based on occupancy.
        Higher occupancy zones need more staff, especially RNs and Attendings.

        Unassigned Staff:
        ${staff
          .filter((s) => !s.currentZone)
          .map((s) => `- ${s.id}: ${s.name} (${s.role})`)
          .join('\n')}

        Zones:
        ${zones
          .map((z) => `- ${z.id}: ${z.name} (Occupancy: ${z.occupancy}%)`)
          .join('\n')}

        Return ONLY a JSON array of assignments in this exact format:
        [{"staffId": "s1", "zoneId": "z1"}, ...]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const assignments = JSON.parse(response.text || '[]');
      if (Array.isArray(assignments)) {
        applyAssignments(assignments);
      }
    } catch (error) {
      console.error('AI Assignment failed:', error);
    } finally {
      setIsAIAssigning(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedStaffId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedStaffId(null);
    setDragOverZone(null);
  };

  const handleDragOver = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverZone !== zoneId) setDragOverZone(zoneId);
  };

  const handleDragLeave = () => setDragOverZone(null);

  const handleDrop = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    const staffId = e.dataTransfer.getData('text/plain');
    if (staffId && zoneId) {
      applyAssignments([{ staffId, zoneId }]);
    }
    setDraggedStaffId(null);
    setDragOverZone(null);
  };

  const unassignedStaff = staff.filter((s) => !s.currentZone);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: SPACE.md,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 1120,
              height: '82vh',
              display: 'flex',
              flexDirection: 'column',
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              boxShadow:
                '0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(225,29,72,0.08)',
              overflow: 'hidden',
            }}
          >
            <CornerBracket position="tl" color={COLORS.borderStrong} size={11} thickness={1} inset={-1} />
            <CornerBracket position="tr" color={COLORS.borderStrong} size={11} thickness={1} inset={-1} />
            <CornerBracket position="bl" color={COLORS.borderStrong} size={11} thickness={1} inset={-1} />
            <CornerBracket position="br" color={COLORS.borderStrong} size={11} thickness={1} inset={-1} />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceElev,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <div
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.borderStrong}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textSecondary,
                  }}
                >
                  <Users size={17} strokeWidth={2} />
                </div>
                <div>
                  <BracketLabel tone="secondary" size="xs">
                    PERSONNEL · DEPLOYMENT
                  </BracketLabel>
                  <h2
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.h3.size,
                      fontWeight: TYPE.h3.weight,
                      letterSpacing: TYPE.h3.tracking,
                      lineHeight: 1.2,
                      color: COLORS.textPrimary,
                      margin: '2px 0 0',
                    }}
                  >
                    Live Ops Personnel Management
                  </h2>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <TacticalButton
                  variant="secondary"
                  size="sm"
                  disabled={isAIAssigning || !ai}
                  onClick={handleAIAssign}
                  title={!ai ? 'AI offline — VITE_GEMINI_API_KEY not set' : undefined}
                  icon={<Bot size={14} strokeWidth={2} />}
                >
                  {isAIAssigning
                    ? 'Analyzing Load…'
                    : `AI Auto-Assign${!ai ? ' · offline' : ''}`}
                </TacticalButton>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textMuted,
                    cursor: 'pointer',
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = COLORS.borderStrong;
                    e.currentTarget.style.color = COLORS.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = COLORS.border;
                    e.currentTarget.style.color = COLORS.textMuted;
                  }}
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Content — split pane */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              {/* LEFT · Staff pool */}
              <div
                style={{
                  width: '34%',
                  minWidth: 280,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: `1px solid ${COLORS.border}`,
                  background: COLORS.bgDeep,
                }}
              >
                {/* Pool header */}
                <div
                  style={{
                    padding: `${SPACE.base}px ${SPACE.md}px`,
                    borderBottom: `1px solid ${COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.sm,
                    background: COLORS.surface,
                  }}
                >
                  <BracketLabel tone="muted" size="xs">
                    AVAILABLE PERSONNEL
                  </BracketLabel>
                  <Mono
                    tone="primary"
                    size="xs"
                    style={{
                      padding: '2px 8px',
                      background: COLORS.surfaceElev,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    {unassignedStaff.length} UNASSIGNED
                  </Mono>
                </div>

                {/* Pool list */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: SPACE.sm,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.xs,
                  }}
                >
                  {unassignedStaff.length === 0 && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: SPACE['2xl'],
                        color: COLORS.textDim,
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                      }}
                    >
                      All personnel assigned
                    </div>
                  )}
                  {unassignedStaff.map((s) => {
                    const isSelected = selectedStaffIds.has(s.id);
                    const isDragging = draggedStaffId === s.id;
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, s.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleToggleStaff(s.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          background: isSelected
                            ? 'rgba(225,29,72,0.08)'
                            : COLORS.surface,
                          border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                          borderLeft: `3px solid ${isSelected ? COLORS.accent : 'transparent'}`,
                          borderRadius: RADIUS.sm,
                          cursor: isDragging ? 'grabbing' : 'grab',
                          opacity: isDragging ? 0.5 : 1,
                          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = COLORS.borderStrong;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = COLORS.border;
                          }
                        }}
                      >
                        <GripVertical
                          size={14}
                          strokeWidth={2}
                          color={COLORS.textDim}
                          style={{ flexShrink: 0 }}
                        />
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isSelected ? COLORS.accent : COLORS.surfaceElev,
                            border: `1px solid ${isSelected ? COLORS.accent : COLORS.borderStrong}`,
                            borderRadius: RADIUS.sm,
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: FONTS.sans,
                              fontSize: 14,
                              fontWeight: 600,
                              color: COLORS.textPrimary,
                              lineHeight: 1.25,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {s.name}
                          </div>
                          <Mono tone="muted" size="xs">
                            {s.role}
                          </Mono>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bulk assign footer */}
                <AnimatePresence initial={false}>
                  {selectedStaffIds.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                      style={{
                        borderTop: `1px solid ${COLORS.border}`,
                        background: COLORS.surface,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: SPACE.md,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: SPACE.sm,
                        }}
                      >
                        <Mono tone="info" size="xs">
                          {selectedStaffIds.size} SELECTED · BULK ASSIGN
                        </Mono>
                        <div style={{ display: 'flex', gap: SPACE.sm }}>
                          <select
                            value={selectedZoneId}
                            onChange={(e) => setSelectedZoneId(e.target.value)}
                            style={{
                              flex: 1,
                              padding: `${SPACE.xs + 2}px ${SPACE.sm}px`,
                              background: COLORS.bgDeep,
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: RADIUS.sm,
                              color: COLORS.textPrimary,
                              fontFamily: FONTS.mono,
                              fontSize: 12,
                              letterSpacing: '0.04em',
                              outline: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">SELECT ZONE…</option>
                            {zones.map((z) => (
                              <option key={z.id} value={z.id}>
                                {z.name.toUpperCase()} · {z.occupancy}%
                              </option>
                            ))}
                          </select>
                          <TacticalButton
                            variant="primary"
                            size="sm"
                            disabled={!selectedZoneId}
                            onClick={handleAssignSelected}
                          >
                            Assign
                          </TacticalButton>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT · Zone grid */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: SPACE.md,
                  background: COLORS.bg,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: SPACE.md,
                  }}
                >
                  {zones.map((zone) => {
                    const assigned = staff.filter((s) => s.currentZone === zone.id);
                    const isDropTarget = dragOverZone === zone.id;
                    const hasDragSession = draggedStaffId !== null;
                    return (
                      <div
                        key={zone.id}
                        onDragOver={(e) => handleDragOver(e, zone.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, zone.id)}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          padding: SPACE.md,
                          background: isDropTarget
                            ? 'rgba(225,29,72,0.06)'
                            : COLORS.surface,
                          border: `1px solid ${isDropTarget ? COLORS.accent : hasDragSession ? COLORS.borderStrong : COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                          borderStyle: hasDragSession ? 'dashed' : 'solid',
                        }}
                      >
                        {isDropTarget && (
                          <>
                            <CornerBracket position="tl" color={COLORS.accent} size={8} thickness={1} inset={-1} />
                            <CornerBracket position="tr" color={COLORS.accent} size={8} thickness={1} inset={-1} />
                            <CornerBracket position="bl" color={COLORS.accent} size={8} thickness={1} inset={-1} />
                            <CornerBracket position="br" color={COLORS.accent} size={8} thickness={1} inset={-1} />
                          </>
                        )}

                        {/* Zone header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: SPACE.sm,
                            marginBottom: SPACE.md,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <BracketLabel tone="muted" size="xs">
                              ZONE · {zone.id.toUpperCase()}
                            </BracketLabel>
                            <h4
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: 16,
                                fontWeight: 600,
                                color: COLORS.textPrimary,
                                margin: '2px 0 0',
                                letterSpacing: '-0.003em',
                              }}
                            >
                              {zone.name}
                            </h4>
                            <Mono tone="dim" size="xs" style={{ marginTop: 2 }}>
                              {hasDragSession ? 'Drop to assign' : `${assigned.length} assigned`}
                            </Mono>
                          </div>
                          <StatusPill
                            label={`${zone.occupancy}% Load`}
                            tone={occupancyTone(zone.occupancy)}
                          />
                        </div>

                        {/* Assigned staff list */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            minHeight: 96,
                          }}
                        >
                          {assigned.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: SPACE.sm,
                                padding: `${SPACE.xs + 2}px ${SPACE.sm}px`,
                                background: COLORS.bgDeep,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: RADIUS.sm,
                              }}
                              onMouseEnter={(e) => {
                                const btn = e.currentTarget.querySelector(
                                  '[data-unassign]',
                                ) as HTMLElement | null;
                                if (btn) btn.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                const btn = e.currentTarget.querySelector(
                                  '[data-unassign]',
                                ) as HTMLElement | null;
                                if (btn) btn.style.opacity = '0';
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontFamily: FONTS.sans,
                                    fontSize: 13,
                                    color: COLORS.textPrimary,
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {s.name}
                                </div>
                                <Mono tone="dim" size="xs">
                                  {s.role}
                                </Mono>
                              </div>
                              <button
                                data-unassign
                                type="button"
                                onClick={() =>
                                  applyAssignments([{ staffId: s.id, zoneId: '' }])
                                }
                                aria-label="Unassign"
                                title="Unassign"
                                style={{
                                  width: 20,
                                  height: 20,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'transparent',
                                  border: `1px solid ${COLORS.border}`,
                                  borderRadius: RADIUS.sm,
                                  color: COLORS.textDim,
                                  cursor: 'pointer',
                                  opacity: 0,
                                  transition: `opacity ${MOTION.fast}s ease, all ${MOTION.fast}s ease`,
                                  flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = COLORS.crit;
                                  e.currentTarget.style.color = COLORS.crit;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = COLORS.border;
                                  e.currentTarget.style.color = COLORS.textDim;
                                }}
                              >
                                <Minus size={12} strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                          {assigned.length === 0 && (
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 72,
                                border: `1px dashed ${COLORS.border}`,
                                borderRadius: RADIUS.sm,
                                color: COLORS.textDim,
                                fontFamily: FONTS.mono,
                                fontSize: 11,
                                letterSpacing: '0.16em',
                                textTransform: 'uppercase',
                                background: COLORS.bgDeep,
                              }}
                            >
                              No Staff Assigned
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
