import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, Sparkles, Activity, Network, AlertTriangle, Wind, Building2, MapPin, ShieldAlert, CheckCircle2, Trash2, UserCircle } from 'lucide-react';
import { FunctionDeclaration, Type } from "@google/genai";
import { UserProfile, UserRole, Status } from '../types';
import { ROLE_METRICS } from '../data/userProfiles';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createGeminiClient } from '../lib/gemini';
import { getRealtimeStateSnapshot, getDeviceCount } from '../lib/realtime';
import type { SurgeModeState, UrgentTask } from '../lib/surgeTaskTemplates';

const getMockDrivers = (loginCount: number, role?: UserRole) => {
  const baseDrivers = ROLE_METRICS[role || UserRole.MANAGER];
  if (loginCount > 1) {
    return baseDrivers.map(driver => {
      if (role === UserRole.MANAGER) {
        if (driver.id === '1') return { ...driver, value: '4 Admitted', status: Status.NORMAL, impact: 25, trend: 'down' };
        if (driver.id === '2') return { ...driver, value: '15m Avg', status: Status.NORMAL, impact: 15, trend: 'down' };
        if (driver.id === '3') return { ...driver, value: 'Fully Staffed', status: Status.NORMAL, impact: 5, trend: 'stable' };
      }
      if (role === UserRole.NURSE) {
        if (driver.id === 'n1') return { ...driver, value: '0 Overdue', status: Status.NORMAL, impact: 10, trend: 'down' };
        if (driver.id === 'n2') return { ...driver, value: '0 Patients', status: Status.NORMAL, impact: 5, trend: 'down' };
        if (driver.id === 'n3') return { ...driver, value: '1 Waiting', status: Status.NORMAL, impact: 15, trend: 'stable' };
      }
      if (role === UserRole.ER_PERSONNEL) {
        if (driver.id === 'e1') return { ...driver, value: '2 Available', status: Status.NORMAL, impact: 20, trend: 'stable' };
        if (driver.id === 'e2') return { ...driver, value: '15 mins', status: Status.NORMAL, impact: 15, trend: 'down' };
        if (driver.id === 'e3') return { ...driver, value: '0 Inbound', status: Status.NORMAL, impact: 5, trend: 'down' };
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
      weather: "Clear",
      systemStatus: "Normal Operations",
      currentLoad: "32% (Stable)",
      projectedLoad: "35% (+90m)",
      houseStatus: {
        medSurg: "4 Beds Available",
        icu: "2 Beds Available",
        psych: "1 Patient Holding"
      },
      inboundEMS: "2 Units En Route (0 Critical)",
      waitingRoom: "12 Patients (25m Wait)"
    };
  }
  return {
    nedocs: 185,
    weather: "Heavy Rain Warning (ETA 16:00)",
    systemStatus: "Surge Level 2 Active",
    currentLoad: "92% (Saturation Warning)",
    projectedLoad: "112% (+90m)",
    houseStatus: {
      medSurg: "0 Beds Available",
      icu: "1 Bed Available",
      psych: "4 Patients Holding"
    },
    inboundEMS: "8 Units En Route (3 Critical)",
    waitingRoom: "38 Patients (2h 15m Wait)"
  };
};

// Tool Definitions
const getDriversTool: FunctionDeclaration = {
  name: 'get_pressure_drivers',
  description: 'Get current key pressure drivers, bottlenecks, and operational load factors impacting the hospital.',
};

const getNetworkTool: FunctionDeclaration = {
  name: 'get_network_status',
  description: 'Get diversion status, load, and transfer times for nearby regional hospitals.',
};

const getVitalsTool: FunctionDeclaration = {
  name: 'get_system_vitals',
  description: 'Get high-level system vitals including NEDOCS score, weather alerts, bed availability (house status), and census.',
};

const getPatientInfoTool: FunctionDeclaration = {
  name: 'get_patient_info',
  description: 'Get specific patient information based on location or status (e.g., patients with discharge orders, attending physician for a room).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: 'The ward or room number (e.g., L3, Trauma Bay 1)' },
      queryType: { type: Type.STRING, description: 'What to look for (e.g., discharge_orders, attending_physician)' }
    },
    required: ['location', 'queryType']
  }
};

const generatePriorityMatrixTool: FunctionDeclaration = {
  name: 'generate_priority_matrix',
  description: 'Generate a visually rich priority matrix based on handover notes and current system vitals.',
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
            description: { type: Type.STRING, description: 'Detailed description of the priority' },
            urgency: { type: Type.STRING, description: 'Urgency level: Critical, High, or Medium' },
            action: { type: Type.STRING, description: 'Recommended action to take' }
          },
          required: ['title', 'description', 'urgency', 'action']
        }
      }
    },
    required: ['priorities']
  }
};

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

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ currentUser, isOpen, onClose, initialQuery, loginCount = 0 }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

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
        { id: Date.now().toString(), role: 'model', content: `Operations Command online. Hello ${currentUser.name}. I have access to real-time facility telemetry, bed status, and network load tailored for ${currentUser.role} view.` }
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
      setMessages(prev => [
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
    setMessages(prev => [...prev, userMsg]);
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
      const surgeElapsedMin = surgeState.active && surgeState.activatedAt
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
      }`
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
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content || '' }],
        }));

      // Start chat session with Thinking Budget enabled
      const response = await ai.models.generateContent({
        model,
        contents: [
            ...history,
            { role: 'user', parts: [{ text: textToSend }] }
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
          tools: [{ functionDeclarations: [getDriversTool, getNetworkTool, getVitalsTool, getPatientInfoTool, generatePriorityMatrixTool] }],
        }
      });

      // Handle Function Calls
      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
         // We have tools to execute
         const toolResults = [];
         
         for (const call of functionCalls) {
             let resultData;
            let visualType: 'drivers' | 'network' | 'vitals' | 'patientInfo' | 'priorityMatrix' | undefined;

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
                  resultData = { patients: ['MRN-4921 (Room 302)', 'MRN-8812 (Room 310)', 'MRN-1092 (Room 314)', 'MRN-5531 (Room 322)'], status: 'Waiting on Transport/Pharmacy' };
               } else if (args.queryType === 'attending_physician' && args.location.includes('Trauma Bay 1')) {
                  resultData = { attending: 'Dr. Sarah Jenkins (MICU)', status: 'Paged successfully to pull patient to ICU' };
               } else {
                  resultData = { info: 'No specific data found for this query.' };
               }
               visualType = 'patientInfo';
            } else if (call.name === 'generate_priority_matrix') {
               const args = call.args as { priorities: { task: string, urgency: string, assignee: string }[] };
               resultData = args.priorities || [];
               visualType = 'priorityMatrix';
            }

            // Add the visual card to the chat immediately
            if (visualType && resultData) {
               setMessages(prev => [...prev, {
                  id: Date.now().toString() + 'viz',
                  role: 'system', // Internal type for UI rendering
                  visualType,
                  visualData: resultData
               }]);
            }

            toolResults.push({
               id: call.id,
               name: call.name,
               response: { result: resultData }
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
               { role: 'tool', parts: toolResults.map(tr => ({ functionResponse: tr })) } // Include the result with role: 'tool'
            ],
            config: {
               thinkingConfig: { thinkingBudget: 2048 }, // Enable thinking for the follow-up response too
            }
         });
         
         setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            content: secondResponse.text
         }]);

      } else {
         // No tools called, just text
         setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            content: response.text
         }]);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "System Alert: Telemetry link unstable. Retrying connection..."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (initialQuery && isOpen && messages.length > 0) {
      // Only send if it's not already the last user message
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg?.content !== initialQuery) {
        handleSend(initialQuery);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, isOpen]);

  const renderVisual = (msg: Message) => {
      if (msg.visualType === 'priorityMatrix') {
         const priorities = msg.visualData as Array<{title: string, description: string, urgency: string, action: string}>;
         return (
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 my-2 shadow-lg w-full">
               <div className="flex items-center gap-2 mb-3 border-b border-neutral-800 pb-2">
                 <AlertTriangle className="w-4 h-4 text-rose-400" />
                 <span className="text-xs uppercase text-neutral-300 font-bold tracking-widest">Immediate Priority Matrix</span>
               </div>
               <div className="space-y-3">
                 {priorities.map((p, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${p.urgency.toLowerCase() === 'critical' ? 'bg-rose-950/20 border-rose-900/50' : p.urgency.toLowerCase() === 'high' ? 'bg-amber-950/20 border-amber-900/50' : 'bg-neutral-800/50 border-neutral-700'}`}>
                      <div className="flex justify-between items-start mb-1">
                         <span className="text-sm font-bold text-white">{p.title}</span>
                         <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${p.urgency.toLowerCase() === 'critical' ? 'bg-rose-500/20 text-rose-400' : p.urgency.toLowerCase() === 'high' ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-700 text-neutral-300'}`}>{p.urgency}</span>
                      </div>
                      <p className="text-xs text-neutral-400 mb-2">{p.description}</p>
                      <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/20 p-2 rounded border border-cyan-900/30">
                         <Sparkles className="w-3 h-3" />
                         <span>{p.action}</span>
                      </div>
                    </div>
                 ))}
               </div>
            </div>
         );
      }
      if (msg.visualType === 'drivers') {
         return (
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 my-2 shadow-lg w-full">
               <div className="flex items-center gap-2 mb-3 border-b border-neutral-800 pb-2">
                 <Wind className="w-4 h-4 text-rose-400" />
                 <span className="text-xs uppercase text-neutral-300 font-bold tracking-widest">Pressure Drivers</span>
               </div>
               <div className="space-y-3">
                 {(msg.visualData as Array<{id: string, name: string, status: string, value: string, impact: number}>).map((d) => (
                    <div key={d.id} className="group">
                      <div className="flex justify-between items-center text-xs mb-1">
                         <span className="text-neutral-300 font-medium">{d.name}</span>
                         <span className={`font-mono font-bold ${d.status === 'Critical' ? 'text-rose-500' : d.status === 'Warning' ? 'text-amber-500' : 'text-emerald-500'}`}>{d.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${d.status === 'Critical' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : d.status === 'Warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${d.impact}%` }}
                        ></div>
                      </div>
                    </div>
                 ))}
               </div>
            </div>
         );
      }
      if (msg.visualType === 'network') {
         return (
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 my-2 shadow-lg w-full">
               <div className="flex items-center gap-2 mb-3 border-b border-neutral-800 pb-2">
                 <Network className="w-4 h-4 text-cyan-400" />
                 <span className="text-xs uppercase text-neutral-300 font-bold tracking-widest">Network Status</span>
               </div>
               <div className="space-y-2">
                 {(msg.visualData as Array<{name: string, status: string, time: string, load: number}>).map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-neutral-950 border border-neutral-800">
                       <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${h.status === 'Open' ? 'bg-emerald-500 text-emerald-500' : h.status === 'Divert' ? 'bg-rose-500 text-rose-500' : 'bg-amber-500 text-amber-500'}`}></div>
                          <div>
                             <p className="text-xs text-neutral-300 font-medium flex items-center gap-1">
                                {h.name}
                                {h.status === 'Divert' && <ShieldAlert className="w-3 h-3 text-rose-500" />}
                             </p>
                             <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                                <MapPin className="w-3 h-3" />
                                {h.time}
                             </div>
                          </div>
                       </div>
                       <div className="text-right">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold ${
                             h.status === 'Divert' ? 'bg-rose-950/30 text-rose-400 border-rose-500/20' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          }`}>
                             {h.status}
                          </span>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
         );
      }
      if (msg.visualType === 'vitals') {
         return (
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 my-2 shadow-lg w-full flex flex-col gap-3">
               <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                 <Activity className="w-4 h-4 text-emerald-400" />
                 <span className="text-xs uppercase text-neutral-300 font-bold tracking-widest">System Vitals</span>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-neutral-950 border border-neutral-800 rounded-lg relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
                     <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">NEDOCS Score</div>
                     <div className="text-2xl font-mono font-bold text-rose-500">{msg.visualData.nedocs}</div>
                     <div className="text-[10px] text-rose-400 mt-1">Disaster Level</div>
                  </div>
                  <div className="text-center p-3 bg-neutral-950 border border-neutral-800 rounded-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Current Load</div>
                      <div className="text-2xl font-mono font-bold text-amber-500">{msg.visualData.currentLoad.split('%')[0]}%</div>
                      <div className="text-[10px] text-amber-400 mt-1">Saturation</div>
                  </div>
               </div>
               
               <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg text-xs space-y-2">
                  <div className="flex items-center gap-2 text-cyan-500 mb-2">
                     <Building2 className="w-3 h-3" />
                     <span className="font-bold text-[10px] uppercase tracking-widest">House Status</span>
                  </div>
                  <div className="flex justify-between items-center"><span className="text-neutral-400">Med/Surg Beds</span> <span className="text-rose-400 font-mono font-bold bg-rose-950/30 px-2 py-0.5 rounded">{msg.visualData.houseStatus.medSurg}</span></div>
                  <div className="flex justify-between items-center"><span className="text-neutral-400">ICU Beds</span> <span className="text-amber-400 font-mono font-bold bg-amber-950/30 px-2 py-0.5 rounded">{msg.visualData.houseStatus.icu}</span></div>
                  <div className="flex justify-between items-center"><span className="text-neutral-400">Waiting Room</span> <span className="text-white font-mono font-bold bg-neutral-800 px-2 py-0.5 rounded">{msg.visualData.waitingRoom.split(' ')[0]}</span></div>
               </div>
               
               <div className="bg-blue-950/20 border border-blue-900/30 p-2 rounded text-xs flex items-center gap-2 text-blue-400">
                 <AlertTriangle className="w-3 h-3 shrink-0" />
                 <span>{msg.visualData.inboundEMS}</span>
               </div>
            </div>
         );
      }
      if (msg.visualType === 'patientInfo') {
         return (
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 my-2 shadow-lg w-full">
               <div className="flex items-center gap-2 mb-3 border-b border-neutral-800 pb-2">
                 <UserCircle className="w-4 h-4 text-indigo-400" />
                 <span className="text-xs uppercase text-neutral-300 font-bold tracking-widest">Patient Information</span>
               </div>
               <div className="space-y-2">
                 {msg.visualData.patients && (
                    <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg text-xs space-y-2">
                       <span className="text-neutral-400 font-bold">Patients:</span>
                       <ul className="list-disc pl-4 text-neutral-300">
                          {msg.visualData.patients.map((p: string, i: number) => <li key={i}>{p}</li>)}
                       </ul>
                       <div className="text-amber-400 mt-2 font-mono">{msg.visualData.status}</div>
                       <button 
                         onClick={() => handleSend(`Escalate transport and pharmacy for these patients`)}
                         className="mt-2 w-full bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded transition-colors flex items-center justify-center gap-2"
                       >
                         <AlertTriangle className="w-3 h-3" /> Escalate Discharges
                       </button>
                    </div>
                 )}
                 {msg.visualData.attending && (
                    <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg text-xs space-y-2">
                       <span className="text-neutral-400 font-bold">Attending:</span>
                       <div className="text-neutral-300">{msg.visualData.attending}</div>
                       <div className="text-emerald-400 mt-2 font-mono flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {msg.visualData.status}</div>
                       <button 
                         onClick={() => handleSend(`Page ${msg.visualData.attending} to pull patient to ICU`)}
                         className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded transition-colors flex items-center justify-center gap-2"
                       >
                         <Send className="w-3 h-3" /> Page Attending
                       </button>
                    </div>
                 )}
                 {msg.visualData.info && (
                    <div className="text-neutral-400 text-xs italic">{msg.visualData.info}</div>
                 )}
               </div>
            </div>
         );
      }
      return null;
  };

  if (!currentUser || !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-[#0a0a0a] border-l border-neutral-800/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col animate-in slide-in-from-right duration-500 z-50">
        
        {/* Header */}
        <div className="h-16 border-b border-neutral-800/60 flex items-center justify-between px-6 bg-neutral-900/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-[0_0_15px_rgba(225,29,72,0.15)]">
              <Sparkles className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <div className="font-bold text-base text-neutral-100 flex items-center gap-2 tracking-wide">
                PULSE Assistant
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-bold">Online</span>
              </div>
              <div className="text-xs text-neutral-500 font-mono tracking-tight">Tactical Support • {currentUser.role.replace('_', ' ')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleClearChat} className="text-neutral-500 hover:text-rose-400 p-2 hover:bg-neutral-800/80 rounded-lg transition-all duration-200" title="Clear Chat">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-neutral-500 hover:text-white p-2 hover:bg-neutral-800/80 rounded-lg transition-all duration-200" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-[#0a0a0a] to-[#050505]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            
            {msg.role === 'system' ? (
               <div className="w-full max-w-[90%] self-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {renderVisual(msg)}
               </div>
            ) : (
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-neutral-800/80 border border-neutral-700 flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Bot className="w-4 h-4 text-neutral-400" />
                  </div>
                )}
                <div className={`rounded-2xl p-4 text-sm leading-relaxed shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  msg.role === 'user' 
                    ? 'bg-rose-600 text-white rounded-tr-sm shadow-[0_4px_14px_0_rgba(225,29,72,0.2)]' 
                    : 'bg-neutral-900/80 text-neutral-200 rounded-tl-sm border border-neutral-800 backdrop-blur-sm'
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-neutral-800">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content || ''}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-in fade-in duration-200">
             <div className="flex gap-3 max-w-[85%]">
               <div className="w-8 h-8 rounded-full bg-neutral-800/80 border border-neutral-700 flex items-center justify-center shrink-0 shadow-sm mt-1">
                 <Bot className="w-4 h-4 text-neutral-400" />
               </div>
               <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-4 rounded-tl-sm border border-neutral-800 flex gap-2 items-center shadow-md">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-rose-500/80 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-rose-500/80 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-rose-500/80 rounded-full animate-bounce"></span>
                  </div>
               </div>
             </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length < 3 && !isTyping && (
        <div className="px-6 pb-3 bg-[#050505] shrink-0 flex gap-2 overflow-x-auto custom-scrollbar pt-2">
          <button onClick={() => handleSend("What are the current system vitals?")} className="whitespace-nowrap text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-4 py-2 rounded-full border border-neutral-800 transition-all duration-200 hover:border-neutral-700 shadow-sm">
            Check Vitals
          </button>
          <button onClick={() => handleSend("Show me the pressure drivers")} className="whitespace-nowrap text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-4 py-2 rounded-full border border-neutral-800 transition-all duration-200 hover:border-neutral-700 shadow-sm">
            Pressure Drivers
          </button>
          <button onClick={() => handleSend("What is the regional network status?")} className="whitespace-nowrap text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 px-4 py-2 rounded-full border border-neutral-800 transition-all duration-200 hover:border-neutral-700 shadow-sm">
            Network Status
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-neutral-800/60 bg-[#050505] shrink-0">
        {!ai && (
          <div className="mb-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
            Assistant disabled — VITE_GEMINI_API_KEY is not set in this build.
          </div>
        )}
        <div className="relative flex items-center group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={ai ? 'Ask PULSE...' : 'Assistant offline'}
            disabled={!ai}
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all placeholder:text-neutral-600 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping || !ai}
            className="absolute right-2 p-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-600 transition-all duration-200 hover:scale-105 shadow-md disabled:hover:scale-100"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      </div>
    </>
  );
};
