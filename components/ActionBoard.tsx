import React, { useState, useMemo, useEffect } from 'react';
import { ActionItem, UserProfile } from '../types';
import {
  Plus,
  AlertCircle,
  Clock,
  Printer,
  MessageSquare,
  History,
  Send,
  X,
  Search,
  AlertOctagon,
} from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';
import { ROLE_ACTIONS, USERS } from '../data/userProfiles';
import { PrintPreviewModal } from './PrintPreviewModal';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  SHADOW,
  Mono,
  BracketLabel,
  StatusPill,
  StatusTone,
  SectionTitle,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  BracketFrame,
} from './design';

interface ActionBoardProps {
  currentUser: UserProfile;
  systemStatus?: 'normal' | 'stale' | 'manual';
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  initialFilter?: string;
  isSurgeActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Priority + Status styling helpers
// ─────────────────────────────────────────────────────────────────────────
type PriorityKey = 'High' | 'Medium' | 'Low' | 'Critical';

const priorityTone = (
  priority: string,
): { color: string; bg: string; border: string; label: string } => {
  switch (priority as PriorityKey) {
    case 'Critical':
      return {
        color: COLORS.accentBright,
        bg: COLORS.accentDim,
        border: COLORS.accent,
        label: 'P0',
      };
    case 'High':
      return {
        color: COLORS.accentBright,
        bg: COLORS.accentDim,
        border: `${COLORS.accent}55`,
        label: 'P1',
      };
    case 'Medium':
      return {
        color: COLORS.warn,
        bg: COLORS.warnDim,
        border: `${COLORS.warn}55`,
        label: 'P2',
      };
    case 'Low':
    default:
      return {
        color: COLORS.info,
        bg: COLORS.infoDim,
        border: `${COLORS.info}55`,
        label: 'P3',
      };
  }
};

const statusMeta = (
  status: string,
): { tone: StatusTone; label: string; id: string; color: string } => {
  switch (status) {
    case 'New':
      return { tone: 'info', label: 'NEW', id: 'STS.01', color: COLORS.info };
    case 'In Progress':
      return {
        tone: 'warn',
        label: 'IN PROGRESS',
        id: 'STS.02',
        color: COLORS.warn,
      };
    case 'On Hold':
      return {
        tone: 'crit',
        label: 'ON HOLD',
        id: 'STS.03',
        color: COLORS.crit,
      };
    case 'Completed':
      return {
        tone: 'ok',
        label: 'COMPLETED',
        id: 'STS.04',
        color: COLORS.ok,
      };
    case 'Canceled':
    default:
      return {
        tone: 'neutral',
        label: 'CANCELED',
        id: 'STS.05',
        color: COLORS.textMuted,
      };
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PriorityPill — tactical priority pill with corner brackets
// ─────────────────────────────────────────────────────────────────────────
const PriorityPill: React.FC<{ priority: string }> = ({ priority }) => {
  const p = priorityTone(priority);
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: RADIUS.sm,
        fontFamily: FONTS.mono,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: p.color,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 8,
          opacity: 0.7,
          letterSpacing: '0.1em',
        }}
      >
        {p.label}
      </span>
      <span
        style={{
          width: 1,
          height: 8,
          background: p.color,
          opacity: 0.4,
        }}
      />
      {priority}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// OwnerBadge — avatar initial + name in mono
// ─────────────────────────────────────────────────────────────────────────
const OwnerBadge: React.FC<{ owner: string }> = ({ owner }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    }}
  >
    <span
      style={{
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.surfaceElev,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: RADIUS.sm,
        fontFamily: FONTS.mono,
        fontSize: 9,
        fontWeight: 600,
        color: COLORS.textPrimary,
        flexShrink: 0,
      }}
    >
      {owner.charAt(0).toUpperCase()}
    </span>
    <Mono
      tone="secondary"
      size="xs"
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
        maxWidth: 120,
      }}
    >
      {owner}
    </Mono>
  </span>
);

// ─────────────────────────────────────────────────────────────────────────
// ActionCard — individual draggable task card
// ─────────────────────────────────────────────────────────────────────────
const ActionCard: React.FC<{
  action: ActionItem;
  index: number;
  onClick: (action: ActionItem) => void;
  isSurgeActive?: boolean;
}> = ({ action, index, onClick, isSurgeActive }) => {
  const isLowPriority = action.priority === 'Low';
  const isDim = isSurgeActive && isLowPriority;
  const isCritical =
    (action.priority as string) === 'Critical' || action.priority === 'High';
  const isHeld = action.status === 'On Hold';
  const isCanceled = action.status === 'Canceled';
  const [hovered, setHovered] = useState(false);

  return (
    <Draggable draggableId={action.id} index={index}>
      {(provided, snapshot) => {
        const dragging = snapshot.isDragging;
        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onClick(action)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: 'relative',
              background: dragging
                ? COLORS.surfaceElev
                : hovered
                ? COLORS.surfaceElev
                : COLORS.surface,
              border: `1px solid ${
                dragging
                  ? COLORS.accent
                  : hovered
                  ? COLORS.borderStrong
                  : COLORS.border
              }`,
              borderRadius: RADIUS.sm,
              padding: SPACE.md,
              cursor: 'pointer',
              transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease, opacity ${MOTION.fast}s ease`,
              opacity: isDim ? 0.35 : isCanceled ? 0.55 : 1,
              filter: isDim ? 'grayscale(1)' : undefined,
              boxShadow: dragging
                ? `0 12px 36px rgba(0,0,0,0.6), ${SHADOW.accentGlowSm}`
                : undefined,
              overflow: 'hidden',
              ...provided.draggableProps.style,
            }}
          >
            {/* Accent rail for critical / high priority */}
            {isCritical && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: COLORS.accent,
                  boxShadow: `0 0 10px ${COLORS.accent}80`,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Hover brackets */}
            <BracketFrame
              color={COLORS.accent}
              size={8}
              visible={hovered || dragging}
              animate
            />

            {/* Top row: priority + index */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: SPACE.sm,
                gap: SPACE.sm,
              }}
            >
              <PriorityPill priority={action.priority} />
              <Mono tone="dim" size="xs">
                #{String(index + 1).padStart(2, '0')}
              </Mono>
            </div>

            {/* Title */}
            <h4
              style={{
                fontFamily: FONTS.sans,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                lineHeight: 1.4,
                color: isCanceled ? COLORS.textSecondary : COLORS.textPrimary,
                margin: 0,
                marginBottom: SPACE.md,
                textDecoration: isCanceled ? 'line-through' : undefined,
                wordBreak: 'break-word',
              }}
            >
              {action.title}
            </h4>

            {/* Footer meta row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: SPACE.sm,
                paddingTop: SPACE.sm,
                borderTop: `1px dashed ${COLORS.border}`,
              }}
            >
              <OwnerBadge owner={action.owner} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  color: isHeld ? COLORS.crit : COLORS.textSecondary,
                  flexShrink: 0,
                }}
              >
                <Clock size={10} strokeWidth={2} />
                {action.dueTime}
              </span>
            </div>

            {/* On-hold banner */}
            {isHeld && (
              <div
                style={{
                  marginTop: SPACE.sm,
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: COLORS.critDim,
                  border: `1px solid ${COLORS.crit}55`,
                  borderRadius: RADIUS.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle
                  size={10}
                  strokeWidth={2}
                  color={COLORS.crit}
                />
                <Mono tone="crit" size="xs">
                  Waiting on approval
                </Mono>
              </div>
            )}

            {/* Canceled reason */}
            {isCanceled && action.cancelReason && (
              <div
                style={{
                  marginTop: SPACE.sm,
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle
                  size={10}
                  strokeWidth={2}
                  color={COLORS.textMuted}
                />
                <Mono tone="muted" size="xs">
                  {action.cancelReason}
                </Mono>
              </div>
            )}
          </div>
        );
      }}
    </Draggable>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Column — kanban column with tactical chrome
// ─────────────────────────────────────────────────────────────────────────
const Column: React.FC<{
  title: string;
  status: string;
  items: ActionItem[];
  onActionClick: (action: ActionItem) => void;
  isSurgeActive?: boolean;
  columnIndex: number;
}> = ({ title, status, items, onActionClick, isSurgeActive, columnIndex }) => {
  const meta = statusMeta(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION.base,
        delay: 0.05 + columnIndex * 0.04,
        ease: MOTION.ease,
      }}
      style={{
        position: 'relative',
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 288,
        flex: '1 1 288px',
        maxWidth: 360,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Column corner brackets */}
      <CornerBracket
        position="tl"
        color={COLORS.borderStrong}
        size={8}
        thickness={1}
      />
      <CornerBracket
        position="tr"
        color={COLORS.borderStrong}
        size={8}
        thickness={1}
      />
      <CornerBracket
        position="bl"
        color={COLORS.borderStrong}
        size={8}
        thickness={1}
      />
      <CornerBracket
        position="br"
        color={COLORS.borderStrong}
        size={8}
        thickness={1}
      />

      {/* Column header */}
      <div
        style={{
          padding: `${SPACE.md}px ${SPACE.base}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bgDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            minWidth: 0,
          }}
        >
          <StatusPill
            label={title}
            tone={meta.tone}
            pulse={status === 'In Progress'}
            size="sm"
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Mono tone="dim" size="xs">
            //
          </Mono>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '0.08em',
              minWidth: 18,
              textAlign: 'right',
            }}
          >
            {String(items.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="custom-scrollbar"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: SPACE.sm,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.sm,
              background: snapshot.isDraggingOver
                ? COLORS.accentDim
                : 'transparent',
              transition: `background ${MOTION.fast}s ease`,
              minHeight: 120,
            }}
          >
            {items.length === 0 && !snapshot.isDraggingOver && (
              <div
                style={{
                  padding: SPACE.lg,
                  textAlign: 'center',
                  border: `1px dashed ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                }}
              >
                <Mono tone="dim" size="xs">
                  No actions
                </Mono>
              </div>
            )}
            {items.map((action, index) => (
              <ActionCard
                key={action.id}
                action={action}
                index={index}
                onClick={onActionClick}
                isSurgeActive={isSurgeActive}
              />
            ))}
            {provided.placeholder}
            {status === 'New' && (
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: `${SPACE.md}px`,
                  marginTop: items.length === 0 ? 0 : SPACE.xs,
                  background: 'transparent',
                  border: `1px dashed ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textMuted,
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: `color ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease, background ${MOTION.fast}s ease`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = COLORS.accent;
                  e.currentTarget.style.borderColor = COLORS.accent;
                  e.currentTarget.style.background = COLORS.accentDim;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = COLORS.textMuted;
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Plus size={12} strokeWidth={2} />
                New Action
              </button>
            )}
          </div>
        )}
      </Droppable>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// TacticalInput — compact search input with tactical chrome
// ─────────────────────────────────────────────────────────────────────────
const TacticalInput: React.FC<{
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  width?: number | string;
}> = ({ icon, value, onChange, onClear, placeholder, width = 260 }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width,
        height: 32,
        padding: '0 10px',
        background: COLORS.surface,
        border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
        borderRadius: RADIUS.sm,
        transition: `border-color ${MOTION.fast}s ease`,
      }}
    >
      {icon && (
        <span
          style={{
            color: focused ? COLORS.accent : COLORS.textMuted,
            display: 'flex',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: COLORS.textPrimary,
          fontFamily: FONTS.sans,
          fontSize: 12,
          letterSpacing: '-0.005em',
          minWidth: 0,
        }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.textPrimary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.textMuted)}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ActionBoard — main component
// ─────────────────────────────────────────────────────────────────────────
export const ActionBoard: React.FC<ActionBoardProps> = ({
  currentUser,
  systemStatus = 'normal',
  showToast,
  initialFilter = '',
  isSurgeActive = false,
}) => {
  const [actions, setActions] = useState<ActionItem[]>(
    ROLE_ACTIONS[currentUser.role],
  );
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<
    'details' | 'comments' | 'history'
  >('details');
  const [searchQuery, setSearchQuery] = useState(initialFilter);

  // Reset actions if user changes
  useEffect(() => {
    setActions(ROLE_ACTIONS[currentUser.role]);
  }, [currentUser.role]);

  // Update search query if initialFilter changes
  useEffect(() => {
    setSearchQuery(initialFilter);
  }, [initialFilter]);

  // Add Surge Protocol action if surge is activated
  useEffect(() => {
    if (isSurgeActive) {
      setActions((prev) => {
        if (prev.some((a) => a.title === 'SURGE PROTOCOL ACTIVATED'))
          return prev;
        return [
          {
            id: `surge-${Date.now()}`,
            title: 'SURGE PROTOCOL ACTIVATED',
            description:
              'System-wide surge protocol is active. All non-essential tasks are suspended. Focus on critical patient throughput and capacity management.',
            status: 'New',
            priority: 'Critical' as ActionItem['priority'],
            owner: 'System',
            dueTime: 'IMMEDIATE',
            history: [
              {
                timestamp: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                action: 'Surge Protocol Auto-Generated',
                user: 'System',
              },
            ],
          },
          ...prev,
        ];
      });
    }
  }, [isSurgeActive]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    let movedToNewStatus = false;
    let newStatusName = '';

    setActions((prev) => {
      const next = Array.from(prev);
      const draggedIndex = next.findIndex((a) => a.id === draggableId);
      if (draggedIndex === -1) return prev;

      const [removed] = next.splice(draggedIndex, 1);
      const newStatus = destination.droppableId as ActionItem['status'];

      if (source.droppableId !== destination.droppableId) {
        removed.status = newStatus;
        removed.history = [
          ...(removed.history || []),
          {
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            action: `Status changed to ${newStatus} (via drag)`,
            user: currentUser.name,
          },
        ];
        movedToNewStatus = true;
        newStatusName = newStatus;
      }

      const destItems = next.filter(
        (a) => a.status === destination.droppableId,
      );
      if (destination.index >= destItems.length) {
        next.push(removed);
      } else {
        const targetItem = destItems[destination.index];
        const targetIndex = next.findIndex((a) => a.id === targetItem.id);
        next.splice(targetIndex, 0, removed);
      }

      return next;
    });

    if (movedToNewStatus && showToast) {
      showToast(`Action moved to ${newStatusName}`, 'info');
    }
  };

  const handleStatusChange = (
    id: string,
    newStatus: ActionItem['status'],
    reason?: string,
  ) => {
    let updatedActionRef: ActionItem | null = null;

    setActions((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const historyEntry = {
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            action: `Status changed to ${newStatus}${
              reason ? ` (Reason: ${reason})` : ''
            }`,
            user: currentUser.name,
          };
          const updatedAction = {
            ...a,
            status: newStatus,
            cancelReason: reason,
            history: [...(a.history || []), historyEntry],
          };
          updatedActionRef = updatedAction;
          return updatedAction;
        }
        return a;
      }),
    );

    if (selectedAction?.id === id && updatedActionRef) {
      setSelectedAction(updatedActionRef);
    }

    if (showToast) {
      showToast(`Action marked as ${newStatus}`, 'info');
    }
    if (newStatus === 'Canceled') {
      setSelectedAction(null);
    }
    setCancelReason('');
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedAction) return;

    let updatedActionRef: ActionItem | null = null;

    setActions((prev) =>
      prev.map((a) => {
        if (a.id === selectedAction.id) {
          const commentEntry = `[${new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}] ${currentUser.name}: ${newComment}`;
          const updatedAction = {
            ...a,
            comments: [...(a.comments || []), commentEntry],
          };
          updatedActionRef = updatedAction;
          return updatedAction;
        }
        return a;
      }),
    );

    if (updatedActionRef) {
      setSelectedAction(updatedActionRef);
    }
    setNewComment('');
  };

  const handleReassign = (newOwner: string) => {
    if (!selectedAction) return;

    let updatedActionRef: ActionItem | null = null;

    setActions((prev) =>
      prev.map((a) => {
        if (a.id === selectedAction.id) {
          const updatedAction = {
            ...a,
            owner: newOwner,
            history: [
              {
                timestamp: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                action: `Reassigned to ${newOwner}`,
                user: currentUser.name,
              },
              ...(a.history || []),
            ],
          };
          updatedActionRef = updatedAction;
          return updatedAction;
        }
        return a;
      }),
    );

    if (updatedActionRef) {
      setSelectedAction(updatedActionRef);
    }
    if (showToast) showToast(`Action reassigned to ${newOwner}`, 'success');
  };

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    const lowerQuery = searchQuery.toLowerCase();
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(lowerQuery) ||
        a.owner.toLowerCase().includes(lowerQuery) ||
        (a as unknown as { description?: string }).description
          ?.toLowerCase()
          .includes(lowerQuery),
    );
  }, [actions, searchQuery]);

  const getActionsByStatus = (status: string) =>
    filteredActions.filter((a) => a.status === status);

  // Summary stats for the header
  const stats = useMemo(() => {
    const total = filteredActions.length;
    const open = filteredActions.filter(
      (a) => a.status !== 'Completed' && a.status !== 'Canceled',
    ).length;
    const critical = filteredActions.filter(
      (a) =>
        (a.priority === 'High' || (a.priority as string) === 'Critical') &&
        a.status !== 'Completed' &&
        a.status !== 'Canceled',
    ).length;
    const inProgress = filteredActions.filter(
      (a) => a.status === 'In Progress',
    ).length;
    const onHold = filteredActions.filter((a) => a.status === 'On Hold').length;
    return { total, open, critical, inProgress, onHold };
  }, [filteredActions]);

  const printContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          borderBottom: '1px solid #000',
          paddingBottom: 8,
          margin: 0,
        }}
      >
        Action Board - {currentUser.role.replace('_', ' ')}
      </h2>
      {['New', 'In Progress', 'On Hold', 'Completed', 'Canceled'].map(
        (status) => {
          const statusActions = getActionsByStatus(status);
          if (statusActions.length === 0) return null;
          return (
            <div key={status} style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  background: '#F3F4F6',
                  padding: 8,
                  borderRadius: 2,
                  marginBottom: 8,
                }}
              >
                {status}
              </h3>
              <ul style={{ paddingLeft: 20, margin: 0, listStyle: 'disc' }}>
                {statusActions.map((a) => (
                  <li key={a.id} style={{ marginBottom: 8 }}>
                    <strong>{a.title}</strong> - {a.owner} (Due: {a.dueTime}) [
                    {a.priority}]
                    {a.status === 'Canceled' &&
                      a.cancelReason &&
                      ` - Reason: ${a.cancelReason}`}
                  </li>
                ))}
              </ul>
            </div>
          );
        },
      )}
    </div>
  );

  const columns: Array<{ title: string; status: ActionItem['status'] }> = [
    { title: 'New', status: 'New' },
    { title: 'In Progress', status: 'In Progress' },
    { title: 'On Hold', status: 'On Hold' },
    { title: 'Completed', status: 'Completed' },
    { title: 'Canceled', status: 'Canceled' },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.base,
        padding: SPACE.xl,
        background: COLORS.bg,
        overflow: 'hidden',
      }}
    >
      {/* ─── Section header ─── */}
      <SectionTitle
        id="ACT.BOARD"
        label="Action Board"
        meta={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.md,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <BracketLabel tone="muted" size="xs">
              VIEW · {currentUser.role.replace('_', ' ')}
            </BracketLabel>
            <StatusPill
              label={`${stats.open} Open`}
              tone={stats.critical > 0 ? 'crit' : 'info'}
              pulse={stats.critical > 0}
            />
          </div>
        }
      />

      {/* ─── Control bar: stats + search + print ─── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.md,
          flexShrink: 0,
        }}
      >
        {/* Mini stat strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            overflow: 'hidden',
          }}
        >
          <StatCell
            label="Total"
            value={stats.total}
            tone={COLORS.textPrimary}
          />
          <StatCell
            label="Critical"
            value={stats.critical}
            tone={stats.critical > 0 ? COLORS.accent : COLORS.textPrimary}
          />
          <StatCell
            label="Active"
            value={stats.inProgress}
            tone={COLORS.warn}
          />
          <StatCell
            label="Held"
            value={stats.onHold}
            tone={stats.onHold > 0 ? COLORS.crit : COLORS.textPrimary}
            last
          />
        </div>

        {/* Search + print */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            flexWrap: 'wrap',
          }}
        >
          <TacticalInput
            icon={<Search size={13} strokeWidth={2} />}
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Filter actions..."
          />
          {systemStatus === 'manual' && (
            <TacticalButton
              variant="primary"
              size="md"
              icon={<Printer size={13} strokeWidth={2} />}
              onClick={() => setShowPrintModal(true)}
            >
              Print Board
            </TacticalButton>
          )}
        </div>
      </div>

      {/* ─── Surge banner ─── */}
      <AnimatePresence>
        {isSurgeActive && (
          <motion.div
            key="surge-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.md,
              padding: `${SPACE.md}px ${SPACE.base}px`,
              background: COLORS.accentDim,
              border: `1px solid ${COLORS.accent}`,
              borderRadius: RADIUS.sm,
              boxShadow: SHADOW.accentGlowSm,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <CornerBracket position="tl" color={COLORS.accent} size={10} />
            <CornerBracket position="tr" color={COLORS.accent} size={10} />
            <CornerBracket position="bl" color={COLORS.accent} size={10} />
            <CornerBracket position="br" color={COLORS.accent} size={10} />
            <AlertOctagon
              size={18}
              strokeWidth={2}
              color={COLORS.accentBright}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
              }}
            >
              <Mono tone="accent" size="base">
                Surge Protocol Active
              </Mono>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  lineHeight: 1.4,
                }}
              >
                Low priority actions have been visually deemphasized — focus
                on critical tasks.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Kanban columns ─── */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            display: 'flex',
            gap: SPACE.md,
            minHeight: 0,
            overflowX: 'auto',
            paddingBottom: SPACE.sm,
          }}
        >
          {columns.map((col, idx) => (
            <Column
              key={col.status}
              title={col.title}
              status={col.status}
              items={getActionsByStatus(col.status)}
              onActionClick={setSelectedAction}
              isSurgeActive={isSurgeActive}
              columnIndex={idx}
            />
          ))}
        </div>
      </DragDropContext>

      {/* ─── Action Detail Modal ─── */}
      <AnimatePresence>
        {selectedAction && (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: SPACE.md,
            }}
            onClick={() => setSelectedAction(null)}
          >
            <motion.div
              key="modal-panel"
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{
                type: 'spring',
                damping: 28,
                stiffness: 320,
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 560,
                maxHeight: '90vh',
                background: COLORS.surface,
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: RADIUS.sm,
                boxShadow: SHADOW.modal,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <CornerBracket
                position="tl"
                color={COLORS.accent}
                size={12}
                thickness={1.5}
              />
              <CornerBracket
                position="tr"
                color={COLORS.accent}
                size={12}
                thickness={1.5}
              />
              <CornerBracket
                position="bl"
                color={COLORS.accent}
                size={12}
                thickness={1.5}
              />
              <CornerBracket
                position="br"
                color={COLORS.accent}
                size={12}
                thickness={1.5}
              />

              {/* Modal header */}
              <div
                style={{
                  padding: SPACE.base,
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: COLORS.bgDeep,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: SPACE.md,
                  flexShrink: 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      marginBottom: SPACE.sm,
                      flexWrap: 'wrap',
                    }}
                  >
                    <BracketLabel tone="muted" size="xs">
                      ACT.{selectedAction.id}
                    </BracketLabel>
                    <PriorityPill priority={selectedAction.priority} />
                    <StatusPill
                      label={statusMeta(selectedAction.status).label}
                      tone={statusMeta(selectedAction.status).tone}
                      size="xs"
                    />
                  </div>
                  <h3
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.h3.size,
                      fontWeight: TYPE.h3.weight,
                      letterSpacing: TYPE.h3.tracking,
                      lineHeight: TYPE.h3.lineHeight,
                      color: COLORS.textPrimary,
                      margin: 0,
                      wordBreak: 'break-word',
                    }}
                  >
                    {selectedAction.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAction(null)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textSecondary,
                    cursor: 'pointer',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `color ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = COLORS.accent;
                    e.currentTarget.style.borderColor = COLORS.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = COLORS.textSecondary;
                    e.currentTarget.style.borderColor = COLORS.border;
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              {/* Tabs */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: COLORS.surface,
                  flexShrink: 0,
                }}
              >
                <TabButton
                  active={activeTab === 'details'}
                  onClick={() => setActiveTab('details')}
                  label="Details"
                />
                <TabButton
                  active={activeTab === 'comments'}
                  onClick={() => setActiveTab('comments')}
                  label={`Comments · ${selectedAction.comments?.length || 0}`}
                  icon={<MessageSquare size={12} strokeWidth={2} />}
                />
                <TabButton
                  active={activeTab === 'history'}
                  onClick={() => setActiveTab('history')}
                  label={`History · ${selectedAction.history?.length || 0}`}
                  icon={<History size={12} strokeWidth={2} />}
                />
              </div>

              {/* Tab content */}
              <div
                className="custom-scrollbar"
                style={{
                  padding: SPACE.base,
                  overflowY: 'auto',
                  flex: 1,
                }}
              >
                {activeTab === 'details' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.lg,
                    }}
                  >
                    {/* Owner + due time */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: SPACE.sm,
                      }}
                    >
                      <DataReadout label="Owner">
                        <select
                          value={selectedAction.owner}
                          onChange={(e) => handleReassign(e.target.value)}
                          style={{
                            width: '100%',
                            background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`,
                            color: COLORS.textPrimary,
                            fontFamily: FONTS.sans,
                            fontSize: 12,
                            padding: `6px ${SPACE.sm}px`,
                            borderRadius: RADIUS.sm,
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={selectedAction.owner}>
                            {selectedAction.owner}
                          </option>
                          {Object.values(USERS)
                            .filter((u) => u.name !== selectedAction.owner)
                            .map((u) => (
                              <option key={u.name} value={u.name}>
                                {u.name} ({u.role.replace('_', ' ')})
                              </option>
                            ))}
                        </select>
                      </DataReadout>
                      <DataReadout label="Due">
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 13,
                            fontWeight: 600,
                            color: COLORS.textPrimary,
                            letterSpacing: '0.04em',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: `6px ${SPACE.sm}px`,
                          }}
                        >
                          <Clock
                            size={12}
                            strokeWidth={2}
                            color={COLORS.textMuted}
                          />
                          {selectedAction.dueTime}
                        </span>
                      </DataReadout>
                    </div>

                    {/* Status controls */}
                    <div>
                      <div style={{ marginBottom: SPACE.sm }}>
                        <Mono tone="muted" size="xs">
                          Update Status
                        </Mono>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: SPACE.sm,
                        }}
                      >
                        {(
                          ['New', 'In Progress', 'On Hold', 'Completed'] as const
                        ).map((status) => {
                          const isActive = selectedAction.status === status;
                          const m = statusMeta(status);
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                handleStatusChange(
                                  selectedAction.id,
                                  status as ActionItem['status'],
                                )
                              }
                              style={{
                                padding: `${SPACE.sm}px ${SPACE.md}px`,
                                background: isActive
                                  ? COLORS.accentDim
                                  : COLORS.surface,
                                border: `1px solid ${
                                  isActive ? COLORS.accent : COLORS.border
                                }`,
                                borderRadius: RADIUS.sm,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: SPACE.sm,
                                textAlign: 'left',
                                transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                                boxShadow: isActive
                                  ? SHADOW.accentGlowSm
                                  : undefined,
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor =
                                    COLORS.borderStrong;
                                  e.currentTarget.style.background =
                                    COLORS.surfaceElev;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.borderColor =
                                    COLORS.border;
                                  e.currentTarget.style.background =
                                    COLORS.surface;
                                }
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: RADIUS.full,
                                  background: m.color,
                                  boxShadow: `0 0 6px ${m.color}`,
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontFamily: FONTS.mono,
                                  fontSize: 11,
                                  fontWeight: 500,
                                  letterSpacing: '0.12em',
                                  textTransform: 'uppercase',
                                  color: isActive
                                    ? COLORS.textPrimary
                                    : COLORS.textSecondary,
                                }}
                              >
                                {status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cancel section */}
                    <div
                      style={{
                        paddingTop: SPACE.md,
                        borderTop: `1px dashed ${COLORS.border}`,
                      }}
                    >
                      <div style={{ marginBottom: SPACE.sm }}>
                        <Mono tone="muted" size="xs">
                          Cancel Action
                        </Mono>
                      </div>
                      <textarea
                        placeholder="Reason for cancellation..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        style={{
                          width: '100%',
                          background: COLORS.bgDeep,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          padding: SPACE.md,
                          color: COLORS.textPrimary,
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          outline: 'none',
                          minHeight: 72,
                          resize: 'vertical',
                          marginBottom: SPACE.sm,
                          transition: `border-color ${MOTION.fast}s ease`,
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = COLORS.crit)
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = COLORS.border)
                        }
                      />
                      <TacticalButton
                        variant="danger"
                        size="md"
                        fullWidth
                        disabled={!cancelReason.trim()}
                        onClick={() =>
                          handleStatusChange(
                            selectedAction.id,
                            'Canceled',
                            cancelReason,
                          )
                        }
                      >
                        Mark as Canceled
                      </TacticalButton>
                    </div>
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.md,
                      minHeight: 240,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: SPACE.sm,
                        flex: 1,
                      }}
                    >
                      {!selectedAction.comments ||
                      selectedAction.comments.length === 0 ? (
                        <EmptyState label="No comments recorded" />
                      ) : (
                        selectedAction.comments.map((comment, idx) => {
                          const match = comment.match(/^\[(.*?)\] (.*?): (.*)$/);
                          if (match) {
                            const [, time, user, text] = match;
                            return (
                              <div
                                key={idx}
                                style={{
                                  background: COLORS.bgDeep,
                                  border: `1px solid ${COLORS.border}`,
                                  borderRadius: RADIUS.sm,
                                  padding: SPACE.md,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 4,
                                    gap: SPACE.sm,
                                  }}
                                >
                                  <Mono tone="accent" size="xs">
                                    {user}
                                  </Mono>
                                  <Mono tone="dim" size="xs">
                                    {time}
                                  </Mono>
                                </div>
                                <p
                                  style={{
                                    fontFamily: FONTS.sans,
                                    fontSize: 13,
                                    color: COLORS.textPrimary,
                                    margin: 0,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {text}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={idx}
                              style={{
                                background: COLORS.bgDeep,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: RADIUS.sm,
                                padding: SPACE.md,
                                fontFamily: FONTS.sans,
                                fontSize: 13,
                                color: COLORS.textPrimary,
                              }}
                            >
                              {comment}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: SPACE.sm,
                        paddingTop: SPACE.sm,
                        borderTop: `1px dashed ${COLORS.border}`,
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && handleAddComment()
                        }
                        style={{
                          flex: 1,
                          background: COLORS.bgDeep,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          color: COLORS.textPrimary,
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          outline: 'none',
                          minWidth: 0,
                          transition: `border-color ${MOTION.fast}s ease`,
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = COLORS.accent)
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = COLORS.border)
                        }
                      />
                      <TacticalButton
                        variant="primary"
                        size="md"
                        disabled={!newComment.trim()}
                        onClick={handleAddComment}
                        icon={<Send size={12} strokeWidth={2} />}
                      >
                        Send
                      </TacticalButton>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div>
                    {!selectedAction.history ||
                    selectedAction.history.length === 0 ? (
                      <EmptyState label="No history recorded" />
                    ) : (
                      <div
                        style={{
                          position: 'relative',
                          borderLeft: `1px dashed ${COLORS.borderStrong}`,
                          marginLeft: SPACE.sm,
                          paddingBottom: SPACE.sm,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: SPACE.md,
                        }}
                      >
                        {selectedAction.history.map((entry, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              paddingLeft: SPACE.lg,
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                left: -5,
                                top: 6,
                                width: 9,
                                height: 9,
                                background: COLORS.surface,
                                border: `1.5px solid ${COLORS.accent}`,
                                borderRadius: RADIUS.full,
                                boxShadow: `0 0 6px ${COLORS.accent}60`,
                              }}
                            />
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: SPACE.sm,
                                marginBottom: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: FONTS.sans,
                                  fontSize: 13,
                                  color: COLORS.textPrimary,
                                  lineHeight: 1.4,
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {entry.action}
                              </span>
                              <Mono tone="dim" size="xs">
                                {entry.timestamp}
                              </Mono>
                            </div>
                            <Mono tone="muted" size="xs">
                              BY {entry.user}
                            </Mono>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={() => {
          if (showToast)
            showToast('Print job sent to local printer.', 'success');
        }}
        title="Manual Action Board"
        content={printContent}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StatCell — a single mini stat in the header stat strip
// ─────────────────────────────────────────────────────────────────────────
const StatCell: React.FC<{
  label: string;
  value: number;
  tone?: string;
  last?: boolean;
}> = ({ label, value, tone = COLORS.textPrimary, last }) => (
  <div
    style={{
      padding: `${SPACE.sm}px ${SPACE.base}px`,
      borderRight: last ? undefined : `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 68,
    }}
  >
    <Mono tone="dim" size="xs">
      {label}
    </Mono>
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: 16,
        fontWeight: 600,
        color: tone,
        letterSpacing: '0.02em',
        lineHeight: 1,
      }}
    >
      {String(value).padStart(2, '0')}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// TabButton — tactical tab for the detail modal
// ─────────────────────────────────────────────────────────────────────────
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 1,
      padding: `${SPACE.md}px ${SPACE.sm}px`,
      background: active ? COLORS.bgDeep : 'transparent',
      border: 'none',
      borderBottom: `2px solid ${active ? COLORS.accent : 'transparent'}`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: active ? COLORS.accent : COLORS.textSecondary,
      transition: `color ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease, background ${MOTION.fast}s ease`,
      minWidth: 0,
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.color = COLORS.textPrimary;
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.color = COLORS.textSecondary;
    }}
  >
    {icon}
    <span
      style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// DataReadout — labeled field wrapper used in the detail modal
// ─────────────────────────────────────────────────────────────────────────
const DataReadout: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div
    style={{
      background: COLORS.bgDeep,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      padding: SPACE.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    <Mono tone="dim" size="xs">
      {label}
    </Mono>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// EmptyState — empty state placeholder
// ─────────────────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      padding: `${SPACE['2xl']}px ${SPACE.base}px`,
      textAlign: 'center',
      border: `1px dashed ${COLORS.border}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <Mono tone="dim" size="xs">
      {label}
    </Mono>
  </div>
);
