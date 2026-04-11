import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Send,
  Bot,
  Sparkles,
  Activity,
  Network,
  AlertTriangle,
  Wind,
  Building2,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { FunctionDeclaration, Type } from '@google/genai';
import { UserProfile, UserRole, Status } from '../types';
import { ROLE_METRICS } from '../data/userProfiles';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createGeminiClient } from '../lib/gemini';
import { getRealtimeStateSnapshot, getDeviceCount } from '../lib/realtime';
import type { SurgeModeState, UrgentTask } from '../lib/surgeTaskTemplates';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  SHADOW,
  Mono,
  BracketLabel,
  CornerBracket,
  StatusPill,
  TacticalCard,
  TacticalButton,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Mock data + tool declarations (unchanged business logic)
// ─────────────────────────────────────────────────────────────────────────

const getMockDrivers = (loginCount: number, role?: UserRole) => {
  const baseDrivers = ROLE_METRICS[role || UserRole.MANAGER];
  if (loginCount > 1) {
    return baseDrivers.map((driver) => {
      if (role === UserRole.MANAGER) {
        if (driver.id === '1')
          return { ...driver, value: '4 Admitted', status: Status.NORMAL, impact: 25, trend: 'down' };
        if (driver.id === '2')
          return { ...driver, value: '15m Avg', status: Status.NORMAL, impact: 15, trend: 'down' };
        if (driver.id === '3')
          return { ...driver, value: 'Fully Staffed', status: Status.NORMAL, impact: 5, trend: 'stable' };
      }
      if (role === UserRole.NURSE) {
        if (driver.id === 'n1')
          return { ...driver, value: '0 Overdue', status: Status.NORMAL, impact: 10, trend: 'down' };
        if (driver.id === 'n2')
          return { ...driver, value: '0 Patients', status: Status.NORMAL, impact: 5, trend: 'down' };
        if (driver.id === 'n3')
          return { ...driver, value: '1 Waiting', status: Status.NORMAL, impact: 15, trend: 'stable' };
      }
      if (role === UserRole.ER_PERSONNEL) {
        if (driver.id === 'e1')
          return { ...driver, value: '2 Available', status: Status.NORMAL, impact: 20, trend: 'stable' };
        if (driver.id === 'e2')
          return { ...driver, value: '15 mins', status: Status.NORMAL, impact: 15, trend: 'down' };
        if (driver.id === 'e3')
          return { ...driver, value: '0 Inbound', status: Status.NORMAL, impact: 5, trend: 'down' };
      }
      return { ...driver, status: Status.NORMAL, impact: Math.floor(driver.impact * 0.3), trend: 'down' };
    });
  }
  return baseDrivers;
};

const MOCK_HOSPITALS = [
  { name: 'Memorial General', status: 'Open', time: '12m', load: 65 },
  { name: 'St. Mary Level 1', status: 'Divert', time: '25m', load: 98 },
  { name: 'County Trauma', status: 'Busy', time: '18m', load: 85 },
];

const getMockVitals = (loginCount: number) => {
  if (loginCount > 1) {
    return {
      nedocs: 85,
      weather: 'Clear',
      systemStatus: 'Normal Operations',
      currentLoad: '32% (Stable)',
      projectedLoad: '35% (+90m)',
      houseStatus: {
        medSurg: '4 Beds Available',
        icu: '2 Beds Available',
        psych: '1 Patient Holding',
      },
      inboundEMS: '2 Units En Route (0 Critical)',
      waitingRoom: '12 Patients (25m Wait)',
    };
  }
  return {
    nedocs: 185,
    weather: 'Heavy Rain Warning (ETA 16:00)',
    systemStatus: 'Surge Level 2 Active',
    currentLoad: '92% (Saturation Warning)',
    projectedLoad: '112% (+90m)',
    houseStatus: {
      medSurg: '0 Beds Available',
      icu: '1 Bed Available',
      psych: '4 Patients Holding',
    },
    inboundEMS: '8 Units En Route (3 Critical)',
    waitingRoom: '38 Patients (2h 15m Wait)',
  };
};

// Tool Definitions
const getDriversTool: FunctionDeclaration = {
  name: 'get_pressure_drivers',
  description:
    'Get current key pressure drivers, bottlenecks, and operational load factors impacting the hospital.',
};

const getNetworkTool: FunctionDeclaration = {
  name: 'get_network_status',
  description: 'Get diversion status, load, and transfer times for nearby regional hospitals.',
};

const getVitalsTool: FunctionDeclaration = {
  name: 'get_system_vitals',
  description:
    'Get high-level system vitals including NEDOCS score, weather alerts, bed availability (house status), and census.',
};

const getPatientInfoTool: FunctionDeclaration = {
  name: 'get_patient_info',
  description:
    'Get specific patient information based on location or status (e.g., patients with discharge orders, attending physician for a room).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The ward or room number (e.g., L3, Trauma Bay 1)',
      },
      queryType: {
        type: Type.STRING,
        description: 'What to look for (e.g., discharge_orders, attending_physician)',
      },
    },
    required: ['location', 'queryType'],
  },
};

const generatePriorityMatrixTool: FunctionDeclaration = {
  name: 'generate_priority_matrix',
  description:
    'Generate a visually rich priority matrix based on handover notes and current system vitals.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      priorities: {
        type: Type.ARRAY,
        description: 'List of immediate priorities to display in the matrix.',
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Short title of the priority' },
            description: {
              type: Type.STRING,
              description: 'Detailed description of the priority',
            },
            urgency: {
              type: Type.STRING,
              description: 'Urgency level: Critical, High, or Medium',
            },
            action: { type: Type.STRING, description: 'Recommended action to take' },
          },
          required: ['title', 'description', 'urgency', 'action'],
        },
      },
    },
    required: ['priorities'],
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content?: string;
  visualData?: unknown;
  visualType?: 'drivers' | 'network' | 'vitals' | 'patientInfo' | 'priorityMatrix';
}

interface ChatAssistantProps {
  currentUser?: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  loginCount?: number;
  isSurgeActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Internal tactical helpers (visual cards)
// ─────────────────────────────────────────────────────────────────────────

/** Frame used by every tool visual card — keeps headers and padding consistent. */
const VisualFrame: React.FC<{
  icon: React.ReactNode;
  label: string;
  tone?: 'accent' | 'info' | 'ok';
  children: React.ReactNode;
}> = ({ icon, label, tone = 'accent', children }) => {
  const toneColor =
    tone === 'info' ? COLORS.info : tone === 'ok' ? COLORS.ok : COLORS.accent;
  return (
    <TacticalCard padding="md" style={{ width: '100%', position: 'relative' }}>
      <CornerBracket position="tl" color={toneColor} size={8} thickness={1} />
      <CornerBracket position="tr" color={toneColor} size={8} thickness={1} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          paddingBottom: SPACE.sm,
          marginBottom: SPACE.md,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.bgDeep,
            border: `1px solid ${toneColor}`,
            borderRadius: RADIUS.sm,
            color: toneColor,
          }}
        >
          {icon}
        </div>
        <Mono
          tone="secondary"
          size="xs"
          style={{ color: toneColor, letterSpacing: '0.18em', fontWeight: 600 }}
        >
          {label}
        </Mono>
      </div>
      {children}
    </TacticalCard>
  );
};

const DriverBar: React.FC<{
  name: string;
  status: string;
  value: string;
  impact: number;
}> = ({ name, status, value, impact }) => {
  const color =
    status === 'Critical'
      ? COLORS.crit
      : status === 'Warning'
        ? COLORS.warn
        : COLORS.ok;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            color: COLORS.textSecondary,
            fontSize: 12,
            fontFamily: FONTS.sans,
            fontWeight: 500,
          }}
        >
          {name}
        </span>
        <span
          style={{
            color,
            fontFamily: FONTS.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 4,
          width: '100%',
          background: COLORS.bgDeep,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.sm,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, impact))}%`,
            background: color,
            boxShadow: status === 'Critical' ? `0 0 8px ${color}` : 'none',
            transition: `width ${MOTION.base}s ease`,
          }}
        />
      </div>
    </div>
  );
};

const VitalStatBox: React.FC<{
  label: string;
  value: string;
  sub: string;
  tone: 'crit' | 'warn' | 'ok' | 'info';
}> = ({ label, value, sub, tone }) => {
  const color =
    tone === 'crit'
      ? COLORS.crit
      : tone === 'warn'
        ? COLORS.warn
        : tone === 'ok'
          ? COLORS.ok
          : COLORS.info;
  return (
    <div
      style={{
        position: 'relative',
        padding: SPACE.md,
        textAlign: 'center',
        background: COLORS.bgDeep,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </Mono>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 24,
          fontWeight: 600,
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color,
          opacity: 0.8,
          marginTop: 6,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {sub}
      </div>
    </div>
  );
};

const HouseRow: React.FC<{
  label: string;
  value: string;
  tone: 'crit' | 'warn' | 'neutral';
}> = ({ label, value, tone }) => {
  const color =
    tone === 'crit' ? COLORS.crit : tone === 'warn' ? COLORS.warn : COLORS.textPrimary;
  const bg =
    tone === 'crit' ? COLORS.critDim : tone === 'warn' ? COLORS.warnDim : COLORS.surfaceElev;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <span style={{ color: COLORS.textSecondary }}>{label}</span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontWeight: 600,
          color,
          background: bg,
          border: `1px solid ${tone === 'neutral' ? COLORS.border : color + '33'}`,
          padding: '3px 8px',
          borderRadius: RADIUS.sm,
          fontSize: 10,
          letterSpacing: '0.06em',
        }}
      >
        {value}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  currentUser,
  isOpen,
  onClose,
  initialQuery,
  loginCount = 0,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Gemini client safely. If the API key is missing or the SDK
  // throws, ai is null and the input is disabled instead of crashing the app.
  const { client: ai, error: aiError } = useMemo(() => createGeminiClient(), []);

  useEffect(() => {
    if (currentUser && messages.length === 0) {
      const welcome = ai
        ? `Operations Command online. Hello ${currentUser.name}. I have access to real-time facility telemetry, bed status, and network load tailored for ${currentUser.role} view.`
        : `PULSE Assistant is **offline**. The Gemini API key is not configured for this build, so chat is disabled — but the rest of PULSE will continue to operate normally.`;
      setMessages([{ id: '0', role: 'model', content: welcome }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, ai]);

  const handleClearChat = () => {
    if (currentUser) {
      setMessages([
        {
          id: Date.now().toString(),
          role: 'model',
          content: `Operations Command online. Hello ${currentUser.name}. I have access to real-time facility telemetry, bed status, and network load tailored for ${currentUser.role} view.`,
        },
      ]);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (presetInput?: string) => {
    const textToSend = presetInput || input;
    if (!textToSend.trim()) return;

    if (!ai) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: textToSend },
        {
          id: Date.now().toString() + 'err',
          role: 'model',
          content:
            'PULSE Assistant is offline — Gemini API key is not configured.' +
            (aiError ? `\n\n_${aiError}_` : ''),
        },
      ]);
      setInput('');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const model = 'gemini-3-pro-preview';

      // Pull live realtime context fresh on every send so the assistant always
      // reflects current state (no stale React closures).
      const surgeState = getRealtimeStateSnapshot<SurgeModeState>('surge-mode') || {
        active: false,
        activatedAt: null,
      };
      const urgentTasks = getRealtimeStateSnapshot<UrgentTask[]>('urgent-tasks') || [];
      const deviceCount = getDeviceCount();
      const surgeElapsedMin =
        surgeState.active && surgeState.activatedAt
          ? Math.floor((Date.now() - surgeState.activatedAt) / 60000)
          : 0;
      const ackedCount = urgentTasks.filter((t) => t.acknowledged).length;

      const liveContextBlock = `
LIVE OPERATIONAL CONTEXT (refreshed every message):
- Logged-in user: ${currentUser?.name} (${currentUser?.role})
- Connected devices on this incident channel: ${deviceCount}
- Surge mode: ${surgeState.active ? `ACTIVE (activated ${surgeElapsedMin}m ago)` : 'NOT ACTIVE'}
${
  surgeState.active
    ? `- Urgent tasks (${ackedCount}/${urgentTasks.length} acknowledged):
${urgentTasks
  .map(
    (t, i) =>
      `  ${i + 1}. [${t.acknowledged ? 'ACK' : 'OPEN'}] ${t.title}${
        t.acknowledged && t.acknowledgedBy
          ? ` — ack'd by device ${t.acknowledgedBy.slice(0, 8)}`
          : ''
      }`,
  )
  .join('\n')}`
    : '- No urgent tasks active.'
}
`;

      const roleFraming =
        currentUser?.role === UserRole.NURSE
          ? 'The user is a NURSE on the floor. Be ACTION-ORIENTED: tell them concrete next steps, who to call, what to do first. Use short imperatives. Reference unacknowledged urgent tasks when relevant.'
          : 'The user is an ADMIN/MANAGER. Be TACTICAL/STRATEGIC: focus on resource allocation, throughput, coordination, and the larger picture. Reference acknowledgment status when relevant.';

      // Construct history for the API
      const history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.content || '' }],
        }));

      // Start chat session with Thinking Budget enabled
      const response = await ai.models.generateContent({
        model,
        contents: [
          ...history,
          { role: 'user', parts: [{ text: textToSend }] },
        ],
        config: {
          thinkingConfig: { thinkingBudget: 2048 }, // REQUIRED: Budget allows the model to generate the 'thought signature'
          systemInstruction: `You are PULSE AI, a hospital operations assistant embedded inside the PULSE incident-coordination app.
          Your goal is to assist ${currentUser?.name}, who is a ${currentUser?.role}, with real-time decision support.

          ${liveContextBlock}

          ROLE FRAMING:
          ${roleFraming}

          ${
            surgeState.active
              ? "SURGE MODE IS ACTIVE — proactively reference it. Help coordinate. If the user hasn't asked about it, you may still surface unacknowledged tasks or what's outstanding."
              : ''
          }

          CRITICAL DATA CONTEXT:
          - Use the 'get_system_vitals' tool to find bed availability, waiting room count, and load saturation.
          - Use 'get_pressure_drivers' to understand why the hospital is crowded (e.g. boarding, staffing).
          - Use 'get_network_status' to see if we can divert ambulances to other hospitals.
          - Use 'get_patient_info' to find specific patient details like discharge orders or attending physicians.

          INSTRUCTIONS:
          1. ALWAYS use the provided tools to fetch real-time data before answering questions about status, capacity, or load.
          2. The data returned by tools is the GROUND TRUTH. If the user asks "How many people are in the waiting room?", use the tool and report the exact number from the data.
          3. Be concise, professional, and military-grade in your communication style. Use short sentences and bullet points.
          4. If Med/Surg beds are 0, highlight this as a critical bottleneck.
          5. Tailor your insights to the user's role (${currentUser?.role}).
          6. Do not repeat the raw data that is shown in the visual cards, instead provide analysis, recommendations, or context based on that data.
          7. If asked to page someone or send a message, confirm that the page/message has been sent.
          8. IMPORTANT: If the user asks what to prioritize based on handover notes, you MUST call the 'generate_priority_matrix' tool to display the priorities visually, rather than just listing them in text.
          9. Surge status questions: answer directly from the LIVE OPERATIONAL CONTEXT block above. Don't call any tool — that block is already ground truth.
          `,
          tools: [
            {
              functionDeclarations: [
                getDriversTool,
                getNetworkTool,
                getVitalsTool,
                getPatientInfoTool,
                generatePriorityMatrixTool,
              ],
            },
          ],
        },
      });

      // Handle Function Calls
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // We have tools to execute
        const toolResults = [];

        for (const call of functionCalls) {
          let resultData;
          let visualType:
            | 'drivers'
            | 'network'
            | 'vitals'
            | 'patientInfo'
            | 'priorityMatrix'
            | undefined;

          if (call.name === 'get_pressure_drivers') {
            resultData = getMockDrivers(loginCount, currentUser?.role);
            visualType = 'drivers';
          } else if (call.name === 'get_network_status') {
            resultData = MOCK_HOSPITALS;
            visualType = 'network';
          } else if (call.name === 'get_system_vitals') {
            resultData = getMockVitals(loginCount);
            visualType = 'vitals';
          } else if (call.name === 'get_patient_info') {
            const args = call.args as Record<string, string>;
            if (args.queryType === 'discharge_orders' && args.location.includes('L3')) {
              resultData = {
                patients: [
                  'MRN-4921 (Room 302)',
                  'MRN-8812 (Room 310)',
                  'MRN-1092 (Room 314)',
                  'MRN-5531 (Room 322)',
                ],
                status: 'Waiting on Transport/Pharmacy',
              };
            } else if (
              args.queryType === 'attending_physician' &&
              args.location.includes('Trauma Bay 1')
            ) {
              resultData = {
                attending: 'Dr. Sarah Jenkins (MICU)',
                status: 'Paged successfully to pull patient to ICU',
              };
            } else {
              resultData = { info: 'No specific data found for this query.' };
            }
            visualType = 'patientInfo';
          } else if (call.name === 'generate_priority_matrix') {
            const args = call.args as {
              priorities: { task: string; urgency: string; assignee: string }[];
            };
            resultData = args.priorities || [];
            visualType = 'priorityMatrix';
          }

          // Add the visual card to the chat immediately
          if (visualType && resultData) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString() + 'viz',
                role: 'system', // Internal type for UI rendering
                visualType,
                visualData: resultData,
              },
            ]);
          }

          toolResults.push({
            id: call.id,
            name: call.name,
            response: { result: resultData },
          });
        }

        // CRITICAL FIX: Extract the full parts (thoughts + function calls) from the first response
        // to include in the history. Without thoughts, the model sees a broken chain of reasoning.
        const modelParts = response.candidates?.[0]?.content?.parts || [];

        // Send result back to model to get final text response
        const secondResponse = await ai.models.generateContent({
          model,
          contents: [
            ...history,
            { role: 'user', parts: [{ text: textToSend }] },
            { role: 'model', parts: modelParts }, // Must include original thoughts + function call
            {
              role: 'tool',
              parts: toolResults.map((tr) => ({ functionResponse: tr })),
            }, // Include the result with role: 'tool'
          ],
          config: {
            thinkingConfig: { thinkingBudget: 2048 }, // Enable thinking for the follow-up response too
          },
        });

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            content: secondResponse.text,
          },
        ]);
      } else {
        // No tools called, just text
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            content: response.text,
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          content: 'System Alert: Telemetry link unstable. Retrying connection...',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (initialQuery && isOpen && messages.length > 0) {
      // Only send if it's not already the last user message
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg?.content !== initialQuery) {
        handleSend(initialQuery);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, isOpen]);

  // ─────────────────────────────────────────────────────────────────────
  // Visual card renderer
  // ─────────────────────────────────────────────────────────────────────
  const renderVisual = (msg: Message) => {
    if (msg.visualType === 'priorityMatrix') {
      const priorities = msg.visualData as Array<{
        title: string;
        description: string;
        urgency: string;
        action: string;
      }>;
      return (
        <VisualFrame
          icon={<AlertTriangle size={12} strokeWidth={2} />}
          label="IMMEDIATE · PRIORITY MATRIX"
          tone="accent"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            {priorities.map((p, idx) => {
              const urgency = p.urgency.toLowerCase();
              const tone: 'crit' | 'warn' | 'neutral' =
                urgency === 'critical' ? 'crit' : urgency === 'high' ? 'warn' : 'neutral';
              const toneColor =
                tone === 'crit'
                  ? COLORS.crit
                  : tone === 'warn'
                    ? COLORS.warn
                    : COLORS.borderStrong;
              const toneBg =
                tone === 'crit'
                  ? COLORS.critDim
                  : tone === 'warn'
                    ? COLORS.warnDim
                    : COLORS.surfaceElev;
              const pillTone: 'crit' | 'warn' | 'neutral' =
                tone === 'crit' ? 'crit' : tone === 'warn' ? 'warn' : 'neutral';
              return (
                <div
                  key={idx}
                  style={{
                    padding: SPACE.md,
                    background: toneBg,
                    border: `1px solid ${toneColor}`,
                    borderRadius: RADIUS.sm,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: SPACE.sm,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {p.title}
                    </span>
                    <StatusPill tone={pillTone} label={p.urgency} />
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: COLORS.textSecondary,
                      margin: 0,
                      marginBottom: SPACE.sm,
                      lineHeight: 1.5,
                    }}
                  >
                    {p.description}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      padding: `${SPACE.xs + 2}px ${SPACE.sm}px`,
                      background: COLORS.infoDim,
                      border: `1px solid ${COLORS.info}33`,
                      borderRadius: RADIUS.sm,
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      color: COLORS.info,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <Sparkles size={11} strokeWidth={2} />
                    <span>{p.action}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </VisualFrame>
      );
    }

    if (msg.visualType === 'drivers') {
      const drivers = msg.visualData as Array<{
        id: string;
        name: string;
        status: string;
        value: string;
        impact: number;
      }>;
      return (
        <VisualFrame
          icon={<Wind size={12} strokeWidth={2} />}
          label="PRESSURE · DRIVERS"
          tone="accent"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            {drivers.map((d) => (
              <DriverBar
                key={d.id}
                name={d.name}
                status={d.status}
                value={d.value}
                impact={d.impact}
              />
            ))}
          </div>
        </VisualFrame>
      );
    }

    if (msg.visualType === 'network') {
      const hospitals = msg.visualData as Array<{
        name: string;
        status: string;
        time: string;
        load: number;
      }>;
      return (
        <VisualFrame
          icon={<Network size={12} strokeWidth={2} />}
          label="NETWORK · STATUS"
          tone="info"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            {hospitals.map((h, i) => {
              const statusColor =
                h.status === 'Open'
                  ? COLORS.ok
                  : h.status === 'Divert'
                    ? COLORS.crit
                    : COLORS.warn;
              const pillTone: 'ok' | 'crit' | 'warn' =
                h.status === 'Open' ? 'ok' : h.status === 'Divert' ? 'crit' : 'warn';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.md,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusColor,
                        boxShadow: `0 0 6px ${statusColor}`,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.xs + 2,
                          color: COLORS.textPrimary,
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {h.name}
                        {h.status === 'Divert' && (
                          <ShieldAlert size={11} strokeWidth={2} color={COLORS.crit} />
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontFamily: FONTS.mono,
                          fontSize: 10,
                          color: COLORS.textMuted,
                          marginTop: 2,
                          letterSpacing: '0.08em',
                        }}
                      >
                        <MapPin size={10} strokeWidth={2} />
                        {h.time}
                      </div>
                    </div>
                  </div>
                  <StatusPill tone={pillTone} label={h.status} />
                </div>
              );
            })}
          </div>
        </VisualFrame>
      );
    }

    if (msg.visualType === 'vitals') {
      const v = msg.visualData as {
        nedocs: number;
        currentLoad: string;
        houseStatus: { medSurg: string; icu: string; psych: string };
        waitingRoom: string;
        inboundEMS: string;
      };
      return (
        <VisualFrame
          icon={<Activity size={12} strokeWidth={2} />}
          label="SYSTEM · VITALS"
          tone="ok"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: SPACE.sm,
              }}
            >
              <VitalStatBox
                label="NEDOCS"
                value={String(v.nedocs)}
                sub="Disaster Level"
                tone="crit"
              />
              <VitalStatBox
                label="Current Load"
                value={v.currentLoad.split('%')[0] + '%'}
                sub="Saturation"
                tone="warn"
              />
            </div>
            <div
              style={{
                background: COLORS.bgDeep,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                padding: SPACE.md,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.sm,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  paddingBottom: SPACE.xs,
                  borderBottom: `1px solid ${COLORS.border}`,
                  marginBottom: SPACE.xs,
                }}
              >
                <Building2 size={11} strokeWidth={2} color={COLORS.info} />
                <Mono tone="secondary" size="xs" style={{ color: COLORS.info }}>
                  HOUSE STATUS
                </Mono>
              </div>
              <HouseRow label="Med/Surg Beds" value={v.houseStatus.medSurg} tone="crit" />
              <HouseRow label="ICU Beds" value={v.houseStatus.icu} tone="warn" />
              <HouseRow
                label="Waiting Room"
                value={v.waitingRoom.split(' ')[0] + ' Patients'}
                tone="neutral"
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                padding: `${SPACE.xs + 2}px ${SPACE.sm}px`,
                background: COLORS.infoDim,
                border: `1px solid ${COLORS.info}33`,
                borderRadius: RADIUS.sm,
                color: COLORS.info,
                fontSize: 11,
                fontFamily: FONTS.mono,
                letterSpacing: '0.04em',
              }}
            >
              <AlertTriangle size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span>{v.inboundEMS}</span>
            </div>
          </div>
        </VisualFrame>
      );
    }

    if (msg.visualType === 'patientInfo') {
      const data = msg.visualData as {
        patients?: string[];
        attending?: string;
        status?: string;
        info?: string;
      };
      return (
        <VisualFrame
          icon={<UserCircle size={12} strokeWidth={2} />}
          label="PATIENT · INFORMATION"
          tone="info"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            {data.patients && (
              <div
                style={{
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  padding: SPACE.md,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACE.sm,
                }}
              >
                <Mono tone="muted" size="xs">
                  PATIENTS
                </Mono>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: COLORS.textSecondary,
                    fontSize: 12,
                    fontFamily: FONTS.mono,
                    letterSpacing: '0.04em',
                    lineHeight: 1.7,
                  }}
                >
                  {data.patients.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                {data.status && (
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      color: COLORS.warn,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {data.status}
                  </div>
                )}
                <TacticalButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  icon={<AlertTriangle size={12} strokeWidth={2} />}
                  onClick={() => handleSend('Escalate transport and pharmacy for these patients')}
                >
                  Escalate Discharges
                </TacticalButton>
              </div>
            )}
            {data.attending && (
              <div
                style={{
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  padding: SPACE.md,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACE.sm,
                }}
              >
                <Mono tone="muted" size="xs">
                  ATTENDING
                </Mono>
                <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 500 }}>
                  {data.attending}
                </div>
                {data.status && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.xs,
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      color: COLORS.ok,
                      letterSpacing: '0.06em',
                    }}
                  >
                    <CheckCircle2 size={11} strokeWidth={2} />
                    {data.status}
                  </div>
                )}
                <TacticalButton
                  variant="secondary"
                  size="sm"
                  fullWidth
                  icon={<Send size={12} strokeWidth={2} />}
                  onClick={() => handleSend(`Page ${data.attending} to pull patient to ICU`)}
                >
                  Page Attending
                </TacticalButton>
              </div>
            )}
            {data.info && (
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  fontStyle: 'italic',
                  padding: SPACE.sm,
                }}
              >
                {data.info}
              </div>
            )}
          </div>
        </VisualFrame>
      );
    }

    return null;
  };

  if (!currentUser) return null;

  // ─────────────────────────────────────────────────────────────────────
  // Drawer layout
  // ─────────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: Z.modal - 1,
            }}
          />

          {/* Drawer */}
          <motion.div
            key="chat-drawer"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 600,
              background: COLORS.bg,
              borderLeft: `1px solid ${COLORS.border}`,
              boxShadow: SHADOW.modal,
              display: 'flex',
              flexDirection: 'column',
              zIndex: Z.modal,
              fontFamily: FONTS.sans,
              color: COLORS.textPrimary,
              overflow: 'hidden',
              // iPhone safe areas — keep header below the dynamic
              // island and the input above the home indicator.
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingRight: 'env(safe-area-inset-right)',
            }}
          >
            {/* Corner brackets — neutral frame, drawer isn't urgent */}
            <CornerBracket position="tl" color={COLORS.borderStrong} size={10} thickness={1} />
            <CornerBracket position="tr" color={COLORS.borderStrong} size={10} thickness={1} />
            <CornerBracket position="bl" color={COLORS.borderStrong} size={10} thickness={1} />
            <CornerBracket position="br" color={COLORS.borderStrong} size={10} thickness={1} />

            {/* Header */}
            <div
              style={{
                position: 'relative',
                height: 64,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `0 ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <div
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.info}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.info,
                  }}
                >
                  <Sparkles size={18} strokeWidth={2} />
                </div>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                    }}
                  >
                    <BracketLabel tone="info">PULSE · ASSISTANT</BracketLabel>
                    {ai ? (
                      <StatusPill tone="ok" pulse label="ONLINE" />
                    ) : (
                      <StatusPill tone="warn" label="OFFLINE" />
                    )}
                  </div>
                  <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>
                    TACTICAL SUPPORT · {currentUser.role.replace('_', ' ')}
                  </Mono>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                <TacticalButton
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  icon={<Trash2 size={14} strokeWidth={2} />}
                  title="Clear chat"
                >
                  CLEAR
                </TacticalButton>
                <TacticalButton
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  icon={<X size={14} strokeWidth={2} />}
                  title="Close"
                >
                  CLOSE
                </TacticalButton>
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: SPACE.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.lg,
                background: `linear-gradient(to bottom, ${COLORS.bg} 0%, ${COLORS.bgDeep} 100%)`,
              }}
              className="custom-scrollbar"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'system' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: MOTION.base, ease: MOTION.ease }}
                      style={{ width: '100%', maxWidth: '92%', alignSelf: 'flex-start' }}
                    >
                      {renderVisual(msg)}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: MOTION.base, ease: MOTION.ease }}
                      style={{
                        display: 'flex',
                        gap: SPACE.sm + 2,
                        maxWidth: '88%',
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      }}
                    >
                      {msg.role === 'model' && (
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: RADIUS.sm,
                            color: COLORS.info,
                            marginTop: 2,
                          }}
                        >
                          <Bot size={14} strokeWidth={2} />
                        </div>
                      )}
                      <div
                        style={{
                          position: 'relative',
                          padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                          background:
                            msg.role === 'user' ? COLORS.surfaceElev : COLORS.surface,
                          border: `1px solid ${
                            msg.role === 'user' ? COLORS.borderStrong : COLORS.border
                          }`,
                          borderRadius: RADIUS.sm,
                          color: COLORS.textPrimary,
                          fontSize: 13,
                          lineHeight: 1.55,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        }}
                      >
                        <div
                          style={{
                            display: 'block',
                          }}
                          className="chat-markdown"
                        >
                          <Markdown remarkPlugins={[remarkGfm]}>{msg.content || ''}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ display: 'flex', justifyContent: 'flex-start' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: SPACE.sm + 2,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        color: COLORS.info,
                      }}
                    >
                      <Bot size={14} strokeWidth={2} />
                    </div>
                    <div
                      style={{
                        padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Mono tone="muted" size="xs" style={{ marginRight: SPACE.sm }}>
                        THINKING
                      </Mono>
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <span
                          key={i}
                          style={{
                            width: 5,
                            height: 5,
                            background: COLORS.textSecondary,
                            borderRadius: '50%',
                            animation: `chat-bounce 1s ease-in-out ${delay}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions */}
            {messages.length < 3 && !isTyping && (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  gap: SPACE.sm,
                  padding: `${SPACE.sm}px ${SPACE.lg}px 0`,
                  background: COLORS.bg,
                  overflowX: 'auto',
                }}
                className="custom-scrollbar"
              >
                {[
                  { label: 'CHECK VITALS', query: 'What are the current system vitals?' },
                  { label: 'PRESSURE DRIVERS', query: 'Show me the pressure drivers' },
                  { label: 'NETWORK STATUS', query: 'What is the regional network status?' },
                ].map((q) => (
                  <TacticalButton
                    key={q.label}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSend(q.query)}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {q.label}
                  </TacticalButton>
                ))}
              </div>
            )}

            {/* Input */}
            <div
              style={{
                flexShrink: 0,
                padding: SPACE.md,
                borderTop: `1px solid ${COLORS.border}`,
                background: COLORS.bg,
              }}
            >
              {!ai && (
                <div
                  style={{
                    marginBottom: SPACE.sm,
                    padding: `${SPACE.xs + 2}px ${SPACE.sm}px`,
                    background: COLORS.warnDim,
                    border: `1px solid ${COLORS.warn}33`,
                    borderRadius: RADIUS.sm,
                    fontSize: 11,
                    fontFamily: FONTS.mono,
                    color: COLORS.warn,
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.xs,
                  }}
                >
                  <AlertTriangle size={11} strokeWidth={2} />
                  ASSISTANT DISABLED — VITE_GEMINI_API_KEY NOT SET
                </div>
              )}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  background: COLORS.surface,
                  border: `1px solid ${inputFocused ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  boxShadow: inputFocused ? `0 0 12px ${COLORS.accentGlow}` : 'none',
                  transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={ai ? 'Query PULSE Assistant…' : 'ASSISTANT OFFLINE'}
                  disabled={!ai}
                  style={{
                    width: '100%',
                    padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                    paddingRight: 52,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    fontFamily: FONTS.sans,
                    letterSpacing: '-0.003em',
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping || !ai}
                  aria-label="Send message"
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      !input.trim() || isTyping || !ai ? COLORS.surfaceElev : COLORS.accent,
                    border: `1px solid ${
                      !input.trim() || isTyping || !ai ? COLORS.border : COLORS.accent
                    }`,
                    borderRadius: RADIUS.sm,
                    color:
                      !input.trim() || isTyping || !ai ? COLORS.textMuted : COLORS.textPrimary,
                    cursor:
                      !input.trim() || isTyping || !ai ? 'not-allowed' : 'pointer',
                    transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                    boxShadow:
                      !input.trim() || isTyping || !ai ? 'none' : SHADOW.accentGlowSm,
                  }}
                >
                  <Send size={14} strokeWidth={2} />
                </button>
              </div>
              <div
                style={{
                  marginTop: SPACE.xs + 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Mono tone="muted" size="xs">
                  ENTER · SEND
                </Mono>
                <Mono tone="dim" size="xs">
                  SECURE · TLS 1.3
                </Mono>
              </div>
            </div>
          </motion.div>

          {/* Local styles for chat-specific effects */}
          <style>
            {`
              @keyframes chat-bounce {
                0%, 100% { transform: translateY(0); opacity: 0.5; }
                50% { transform: translateY(-3px); opacity: 1; }
              }
              .chat-markdown p { margin: 0 0 6px 0; }
              .chat-markdown p:last-child { margin-bottom: 0; }
              .chat-markdown ul, .chat-markdown ol { margin: 4px 0; padding-left: 18px; }
              .chat-markdown li { margin: 2px 0; }
              .chat-markdown code {
                font-family: ${FONTS.mono};
                font-size: 11px;
                background: ${COLORS.bgDeep};
                padding: 1px 5px;
                border-radius: 2px;
                border: 1px solid ${COLORS.border};
              }
              .chat-markdown pre {
                font-family: ${FONTS.mono};
                font-size: 11px;
                background: ${COLORS.bgDeep};
                padding: 8px 10px;
                border-radius: 2px;
                border: 1px solid ${COLORS.border};
                overflow-x: auto;
                margin: 6px 0;
              }
              .chat-markdown pre code {
                background: transparent;
                border: none;
                padding: 0;
              }
              .chat-markdown strong { color: ${COLORS.textPrimary}; font-weight: 600; }
              .chat-markdown a { color: ${COLORS.info}; text-decoration: underline; }
            `}
          </style>
        </>
      )}
    </AnimatePresence>
  );
};
