/**
 * SecureMessaging -- fullscreen overlay for secure clinical messaging
 * between hospital staff. TigerConnect / Vocera meets tactical HUD.
 *
 * Features:
 *   - Channel list with unread badges and last-message preview
 *   - Threaded chat with role badges, read receipts, urgent flags
 *   - Mock conversations for ED Team and Trauma Alpha
 *   - Quick actions header (Page On-Call, Share Patient)
 *   - Mobile-first: channel list -> thread slide transition
 *
 * Props:
 *   open       -- controls overlay visibility
 *   onClose    -- dismiss the overlay
 *   showToast  -- fire a toast notification to the parent shell
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowLeft,
  Search,
  Send,
  CheckCheck,
  AlertTriangle,
  Users,
  Circle,
  Phone,
  Share2,
  Hash,
  User,
  MessageSquare,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  TYPE,
  Z,
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalButton,
  HudStrip,
  Divider,
} from '../design';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecureMessagingProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

type Role = 'MD' | 'RN' | 'Charge' | 'RT' | 'System';

interface Message {
  id: string;
  sender: string;
  role: Role;
  text: string;
  time: string;
  isOwn: boolean;
  urgent?: boolean;
  system?: boolean;
  read?: boolean;
}

interface Channel {
  id: string;
  name: string;
  kind: 'channel' | 'dm';
  members: number;
  online: number;
  unread: number;
  lastMessage: string;
  lastTime: string;
  messages: Message[];
}

// ---------------------------------------------------------------------------
// Typing indicator keyframes (injected once)
// ---------------------------------------------------------------------------

const TYPING_STYLE_ID = 'pulse-typing-dots';

function ensureTypingStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(TYPING_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TYPING_STYLE_ID;
  style.textContent = `
@keyframes pulse-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
.pulse-dot-1 { animation: pulse-bounce 1.4s ease-in-out infinite; }
.pulse-dot-2 { animation: pulse-bounce 1.4s ease-in-out 0.2s infinite; }
.pulse-dot-3 { animation: pulse-bounce 1.4s ease-in-out 0.4s infinite; }
`;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CHANNELS: Channel[] = [
  {
    id: 'ed-team',
    name: 'ED Team',
    kind: 'channel',
    members: 14,
    online: 9,
    unread: 3,
    lastMessage: 'Bed 4 is clean and ready for the next patient',
    lastTime: '14:32',
    messages: [
      { id: 'e1', sender: 'Dr. Chen', role: 'MD', text: 'Heads up -- we have 3 boarders in the hallway and EMS is bringing in a new chest pain. Going to need Bed 4 turned over ASAP.', time: '14:18', isOwn: false },
      { id: 'e2', sender: 'RN Torres', role: 'RN', text: 'Copy that. P003 in Bed 4 just got his discharge paperwork. I\'ll have him out in 10.', time: '14:20', isOwn: false },
      { id: 'e3', sender: 'Charge Adams', role: 'Charge', text: 'EVS has been notified for Bed 4 turnover. Estimated 15 min clean time.', time: '14:22', isOwn: false },
      { id: 'e4', sender: 'You', role: 'RN', text: 'I can take the chest pain in Bed 7 -- it\'s open now. Want me to set up for a 12-lead?', time: '14:24', isOwn: true, read: true },
      { id: 'e5', sender: 'Dr. Chen', role: 'MD', text: 'Yes, 12-lead and troponin draw on arrival. ETA is 8 minutes per dispatch.', time: '14:25', isOwn: false },
      { id: 'e6', sender: 'RN Kim', role: 'RN', text: 'I\'ve got the hallway boarders covered. All three are stable -- just waiting on bed assignments upstairs.', time: '14:28', isOwn: false },
      { id: 'e7', sender: 'Dr. Martinez', role: 'MD', text: 'ICU accepted Mr. Tanaka. Transport coming down in 20 min. That frees Bed 12 for the next critical.', time: '14:30', isOwn: false, urgent: true },
      { id: 'e8', sender: 'Charge Adams', role: 'Charge', text: 'Bed 4 is clean and ready for the next patient', time: '14:32', isOwn: false, read: true },
    ],
  },
  {
    id: 'trauma-alpha',
    name: 'Trauma Alpha',
    kind: 'channel',
    members: 8,
    online: 6,
    unread: 1,
    lastMessage: 'OR 2 is booked for 15:30. Let\'s move.',
    lastTime: '14:15',
    messages: [
      { id: 't0', sender: 'System', role: 'System', text: 'Trauma Alpha activated -- MVC patient P001', time: '13:45', isOwn: false, system: true },
      { id: 't1', sender: 'Dr. Martinez', role: 'MD', text: 'P001 MVC unrestrained driver. GCS 13, obvious L femur deformity, tachycardic at 118. CT pan-scan ordered.', time: '13:48', isOwn: false, urgent: true },
      { id: 't2', sender: 'You', role: 'RN', text: '2 large-bore IVs placed, NS bolus running. Type and screen sent. Blood bank on standby for 2 units pRBC.', time: '13:52', isOwn: true, read: true },
      { id: 't3', sender: 'Dr. Chen', role: 'MD', text: 'CT results: L femur fracture confirmed, small splenic lac grade II, no free fluid. Ortho consulted.', time: '14:05', isOwn: false },
      { id: 't4', sender: 'Dr. Martinez', role: 'MD', text: 'OR 2 is booked for 15:30. Let\'s move.', time: '14:15', isOwn: false, urgent: true },
    ],
  },
  {
    id: 'icu-team',
    name: 'ICU Team',
    kind: 'channel',
    members: 10,
    online: 7,
    unread: 0,
    lastMessage: 'Vent check on Bed 3 complete -- no changes',
    lastTime: '13:55',
    messages: [],
  },
  {
    id: 'charge-nurse',
    name: 'Charge Nurse',
    kind: 'channel',
    members: 4,
    online: 3,
    unread: 0,
    lastMessage: 'Staffing for night shift is confirmed',
    lastTime: '13:10',
    messages: [],
  },
  {
    id: 'rapid-response',
    name: 'Rapid Response',
    kind: 'channel',
    members: 12,
    online: 8,
    unread: 0,
    lastMessage: 'All clear on Bed 22 -- vitals stabilized',
    lastTime: '12:45',
    messages: [],
  },
  {
    id: 'all-staff',
    name: 'All Staff',
    kind: 'channel',
    members: 42,
    online: 31,
    unread: 0,
    lastMessage: 'Cafeteria closes at 14:00 today for maintenance',
    lastTime: '11:30',
    messages: [],
  },
  // Direct messages
  {
    id: 'dm-chen',
    name: 'Dr. Chen',
    kind: 'dm',
    members: 2,
    online: 1,
    unread: 0,
    lastMessage: 'Thanks for the heads up on the troponin.',
    lastTime: '13:40',
    messages: [],
  },
  {
    id: 'dm-martinez',
    name: 'Dr. Martinez',
    kind: 'dm',
    members: 2,
    online: 1,
    unread: 2,
    lastMessage: 'Can you page ortho if they haven\'t called back?',
    lastTime: '14:10',
    messages: [
      { id: 'dm1', sender: 'Dr. Martinez', role: 'MD', text: 'Hey -- did ortho ever call back about P001?', time: '14:05', isOwn: false },
      { id: 'dm2', sender: 'Dr. Martinez', role: 'MD', text: 'Can you page ortho if they haven\'t called back?', time: '14:10', isOwn: false },
    ],
  },
  {
    id: 'dm-torres',
    name: 'RN Torres',
    kind: 'dm',
    members: 2,
    online: 1,
    unread: 0,
    lastMessage: 'I\'ll cover your lunch at 13:00',
    lastTime: '12:50',
    messages: [],
  },
  {
    id: 'dm-kim',
    name: 'RN Kim',
    kind: 'dm',
    members: 2,
    online: 0,
    unread: 0,
    lastMessage: 'On it.',
    lastTime: '12:15',
    messages: [],
  },
  {
    id: 'dm-adams',
    name: 'Charge Adams',
    kind: 'dm',
    members: 2,
    online: 1,
    unread: 0,
    lastMessage: 'Assignment board is updated.',
    lastTime: '11:50',
    messages: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_COLOR: Record<Role, string> = {
  MD: COLORS.info,
  RN: COLORS.ok,
  Charge: COLORS.warn,
  RT: COLORS.accent,
  System: COLORS.textMuted,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SecureMessaging: React.FC<SecureMessagingProps> = ({ open, onClose, showToast }) => {
  const [channels, setChannels] = useState<Channel[]>(MOCK_CHANNELS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [urgentToggle, setUrgentToggle] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find((c) => c.id === activeId) ?? null;

  // inject CSS keyframes
  useEffect(() => { ensureTypingStyles(); }, []);

  // auto-scroll on new messages or channel change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChannel?.messages.length, activeId]);

  // reset on close
  useEffect(() => {
    if (!open) {
      setActiveId(null);
      setSearchQuery('');
      setInputText('');
      setUrgentToggle(false);
    }
  }, [open]);

  // ---- handlers -----------------------------------------------------------

  const selectChannel = useCallback((id: string) => {
    setActiveId(id);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, unread: 0 } : ch)),
    );
  }, []);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !activeId) return;
    const msg: Message = {
      id: `u-${Date.now()}`,
      sender: 'You',
      role: 'RN',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      isOwn: true,
      urgent: urgentToggle,
      read: false,
    };
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === activeId
          ? { ...ch, messages: [...ch.messages, msg], lastMessage: msg.text, lastTime: msg.time }
          : ch,
      ),
    );
    setInputText('');
    setUrgentToggle(false);

    // simulate read receipt after 1.5s
    setTimeout(() => {
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === activeId
            ? { ...ch, messages: ch.messages.map((m) => (m.id === msg.id ? { ...m, read: true } : m)) }
            : ch,
        ),
      );
    }, 1500);

    // simulate typing response
    setShowTyping(true);
    setTimeout(() => setShowTyping(false), 3000);
  }, [inputText, activeId, urgentToggle]);

  const handlePage = useCallback(() => {
    if (!activeChannel) return;
    showToast(`Page sent to ${activeChannel.name}`);
  }, [activeChannel, showToast]);

  const handleSharePatient = useCallback(() => {
    if (!activeChannel) return;
    showToast(`Patient link shared in ${activeChannel.name}`);
  }, [activeChannel, showToast]);

  const handlePageOnCall = useCallback(() => {
    showToast('Paging on-call attending...');
  }, [showToast]);

  // ---- filtered channel list -----------------------------------------------

  const q = searchQuery.toLowerCase();
  const filteredChannels = q
    ? channels.filter((ch) => ch.name.toLowerCase().includes(q))
    : channels;
  const groupChannels = filteredChannels.filter((c) => c.kind === 'channel');
  const dmChannels = filteredChannels.filter((c) => c.kind === 'dm');

  // ---- sub-renders ---------------------------------------------------------

  const renderChannelList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* search */}
      <div style={{ padding: `${SPACE.sm}px ${SPACE.base}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            padding: `${SPACE.sm}px ${SPACE.md}px`,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
          }}
        >
          <Search size={14} color={COLORS.textMuted} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: COLORS.textPrimary,
              fontFamily: FONTS.sans,
              fontSize: 14,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* channels section */}
        <div style={{ padding: `${SPACE.sm}px ${SPACE.base}px ${SPACE.xs}px` }}>
          <Mono tone="muted" size="xs">CHANNELS</Mono>
        </div>
        {groupChannels.map((ch) => (
          <ChannelRow
            key={ch.id}
            channel={ch}
            active={ch.id === activeId}
            onSelect={selectChannel}
          />
        ))}

        <Divider style={{ margin: `${SPACE.md}px ${SPACE.base}px` }} />

        {/* direct messages section */}
        <div style={{ padding: `${SPACE.xs}px ${SPACE.base}px ${SPACE.xs}px` }}>
          <Mono tone="muted" size="xs">DIRECT MESSAGES</Mono>
        </div>
        {dmChannels.map((ch) => (
          <ChannelRow
            key={ch.id}
            channel={ch}
            active={ch.id === activeId}
            onSelect={selectChannel}
          />
        ))}
      </div>
    </div>
  );

  const renderThread = () => {
    if (!activeChannel) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* quick actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            padding: `${SPACE.sm}px ${SPACE.base}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            flexWrap: 'wrap',
          }}
        >
          <TacticalButton variant="ghost" onClick={handlePageOnCall} icon={<Phone size={12} />}>
            Page On-Call
          </TacticalButton>
          <TacticalButton variant="ghost" onClick={handleSharePatient} icon={<Share2 size={12} />}>
            Share Patient
          </TacticalButton>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
            <Users size={11} color={COLORS.textMuted} />
            <Mono tone="muted" size="xs">{activeChannel.members}</Mono>
            <Circle size={5} fill={COLORS.ok} color={COLORS.ok} style={{ marginLeft: 2 }} />
            <Mono tone="ok" size="xs">{activeChannel.online}</Mono>
          </div>
        </div>

        {/* messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACE.md}px ${SPACE.base}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {activeChannel.messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <MessageSquare size={28} color={COLORS.textDim} style={{ marginBottom: SPACE.sm }} />
                <Mono tone="muted" size="sm">No messages yet</Mono>
              </div>
            </div>
          )}

          {activeChannel.messages.map((msg) => {
            if (msg.system) {
              return (
                <div key={msg.id} style={{ textAlign: 'center', padding: `${SPACE.xs}px 0` }}>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: TYPE.monoSm.size,
                      letterSpacing: TYPE.monoSm.tracking,
                      color: COLORS.textMuted,
                      textTransform: 'uppercase',
                    }}
                  >
                    {msg.text} &middot; {msg.time}
                  </span>
                </div>
              );
            }

            const isOwn = msg.isOwn;
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  alignSelf: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                {/* sender line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: 2 }}>
                  <span
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.bodySm.size,
                      fontWeight: 600,
                      color: isOwn ? COLORS.accent : COLORS.textSecondary,
                    }}
                  >
                    {msg.sender}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: TYPE.monoXs.size,
                      letterSpacing: TYPE.monoXs.tracking,
                      fontWeight: 600,
                      color: ROLE_COLOR[msg.role],
                      background: `${ROLE_COLOR[msg.role]}15`,
                      padding: '1px 5px',
                      borderRadius: RADIUS.full,
                      textTransform: 'uppercase',
                    }}
                  >
                    {msg.role}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: TYPE.monoXs.size,
                      color: COLORS.textMuted,
                    }}
                  >
                    {msg.time}
                  </span>
                </div>

                {/* bubble */}
                <div
                  style={{
                    position: 'relative',
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    background: msg.urgent
                      ? `${COLORS.crit}08`
                      : isOwn
                        ? `${COLORS.accent}12`
                        : COLORS.surface,
                    border: `1px solid ${
                      msg.urgent ? `${COLORS.crit}30` : isOwn ? `${COLORS.accent}25` : COLORS.border
                    }`,
                    borderRadius: RADIUS.sm,
                    borderLeft: msg.urgent
                      ? `3px solid ${COLORS.crit}`
                      : isOwn
                        ? `3px solid ${COLORS.accent}`
                        : undefined,
                    fontFamily: FONTS.sans,
                    fontSize: TYPE.body.size,
                    color: COLORS.textPrimary,
                    lineHeight: 1.5,
                  }}
                >
                  {msg.urgent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.xs }}>
                      <AlertTriangle size={11} color={COLORS.crit} />
                      <StatusPill label="URGENT" tone="crit" />
                    </div>
                  )}
                  {msg.text}
                </div>

                {/* read receipt */}
                {isOwn && msg.read && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                    <CheckCheck size={12} color={COLORS.ok} />
                    <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.monoXs.size, color: COLORS.ok }}>
                      Read
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* typing indicator */}
          {showTyping && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE.sm }}>
              <div
                style={{
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`pulse-dot-${n}`}
                    style={{
                      display: 'inline-block',
                      width: 5,
                      height: 5,
                      borderRadius: RADIUS.full,
                      background: COLORS.textMuted,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* input bar */}
        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.bgDeep,
            padding: `${SPACE.sm}px ${SPACE.base}px`,
            paddingBottom: `max(${SPACE.sm}px, env(safe-area-inset-bottom))`,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.sm,
          }}
        >
          {/* toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <button
              onClick={() => setUrgentToggle((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                padding: `${SPACE.xs}px ${SPACE.sm}px`,
                background: urgentToggle ? `${COLORS.crit}15` : 'transparent',
                border: `1px solid ${urgentToggle ? COLORS.crit : COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: urgentToggle ? COLORS.crit : COLORS.textMuted,
                fontFamily: FONTS.mono,
                fontSize: TYPE.monoXs.size,
                fontWeight: 600,
                letterSpacing: TYPE.monoXs.tracking,
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
              }}
            >
              <AlertTriangle size={10} />
              URGENT
            </button>
            <button
              onClick={handlePage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                padding: `${SPACE.xs}px ${SPACE.sm}px`,
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textMuted,
                fontFamily: FONTS.mono,
                fontSize: TYPE.monoXs.size,
                fontWeight: 600,
                letterSpacing: TYPE.monoXs.tracking,
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
              }}
            >
              <Phone size={10} />
              PAGE
            </button>
          </div>

          {/* input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                background: COLORS.surface,
                border: `1px solid ${urgentToggle ? COLORS.crit : COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sans,
                fontSize: 16,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                background: inputText.trim() ? COLORS.accent : COLORS.surface,
                border: `1px solid ${inputText.trim() ? COLORS.accent : COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: inputText.trim() ? COLORS.textPrimary : COLORS.textMuted,
                cursor: inputText.trim() ? 'pointer' : 'default',
                transition: `all ${MOTION.fast}s ease`,
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---- main render ---------------------------------------------------------

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="secure-messaging"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            // Stop above MobileView's bottom HUD nav so app tabs stay visible.
            bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
            zIndex: Z.modal,
            background: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top)',
            borderTop: `1px solid ${COLORS.borderStrong}`,
          }}
        >
          {/* header strip */}
          <HudStrip side="top" fixed>
            {activeId ? (
              <button
                onClick={() => setActiveId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} />
              </button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
            <BracketLabel tone="accent" size="sm">COMMS</BracketLabel>
            {activeChannel && (
              <Mono tone="secondary" size="sm" style={{ marginLeft: SPACE.xs }}>
                {activeChannel.kind === 'channel' ? '#' : ''} {activeChannel.name}
              </Mono>
            )}
            <div style={{ flex: 1 }} />
            {activeChannel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <Circle size={6} fill={COLORS.ok} color={COLORS.ok} />
                <Mono tone="ok" size="xs">{activeChannel.online} online</Mono>
              </div>
            ) : (
              <StatusPill
                label={`${channels.reduce((s, c) => s + c.unread, 0)} unread`}
                tone={channels.some((c) => c.unread > 0) ? 'warn' : 'info'}
              />
            )}
          </HudStrip>

          {/* body */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              paddingTop: 48,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <AnimatePresence mode="wait">
              {activeId ? (
                <motion.div
                  key="thread"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  {renderThread()}
                </motion.div>
              ) : (
                <motion.div
                  key="channels"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  {renderChannelList()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

SecureMessaging.displayName = 'SecureMessaging';

// ---------------------------------------------------------------------------
// Channel row (internal)
// ---------------------------------------------------------------------------

const ChannelRow: React.FC<{
  channel: Channel;
  active: boolean;
  onSelect: (id: string) => void;
}> = ({ channel, active, onSelect }) => (
  <motion.button
    onClick={() => onSelect(channel.id)}
    whileTap={{ scale: 0.98 }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.md,
      width: '100%',
      padding: `${SPACE.md}px ${SPACE.base}px`,
      background: active ? `${COLORS.accent}08` : 'transparent',
      borderLeft: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
      border: 'none',
      borderRight: 'none',
      borderTop: 'none',
      borderBottom: 'none',
      borderLeftWidth: 2,
      borderLeftStyle: 'solid',
      borderLeftColor: active ? COLORS.accent : 'transparent',
      cursor: 'pointer',
      textAlign: 'left',
      transition: `background ${MOTION.fast}s ease`,
      outline: 'none',
    }}
  >
    {/* icon */}
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: channel.kind === 'dm' ? RADIUS.full : RADIUS.sm,
        background: active ? `${COLORS.accent}15` : COLORS.surface,
        border: `1px solid ${active ? `${COLORS.accent}30` : COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: active ? COLORS.accent : COLORS.textMuted,
      }}
    >
      {channel.kind === 'channel' ? <Hash size={14} /> : <User size={14} />}
    </div>

    {/* name + preview */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: TYPE.body.size,
          fontWeight: channel.unread > 0 ? 600 : 400,
          color: channel.unread > 0 ? COLORS.textPrimary : COLORS.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {channel.name}
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: TYPE.bodySm.size,
          color: COLORS.textMuted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: 1,
        }}
      >
        {channel.lastMessage}
      </div>
    </div>

    {/* time + unread */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
      <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.monoXs.size, color: COLORS.textMuted }}>
        {channel.lastTime}
      </span>
      {channel.unread > 0 && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: RADIUS.full,
            background: COLORS.accent,
            color: COLORS.textPrimary,
            fontFamily: FONTS.mono,
            fontSize: TYPE.monoXs.size,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
          }}
        >
          {channel.unread}
        </span>
      )}
    </div>
  </motion.button>
);
