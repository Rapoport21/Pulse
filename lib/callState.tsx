/**
 * callState — research-informed call + task feature state.
 *
 * What changed (vs the prior 2-target / single-call / 5-sec-AI-fade state):
 *
 *   • Multi-call queue       1 active + N held (1 held max in UI for MVP)
 *   • Real directory         9 realistic ED contacts (was 2)
 *   • Task store             unified extracted-action store with priority
 *                             (STAT / Routine / FYI) and lifecycle
 *                             (proposed → approved/edited/rejected →
 *                             in_progress → done)
 *   • AI handoff = HITL      "AI proposes → countdown → human approves /
 *                             edits / rejects → AI executes" instead of
 *                             "AI takes the line, call ends in 5s"
 *   • Call history           records with task-summary counts
 *
 * Research that drove the design:
 *   • LiveKit Handoff Pattern + Human-in-the-Loop Pattern for voice AI
 *     (https://livekit.com/blog/handoff-pattern-voice-agents,
 *      https://livekit.com/blog/human-in-the-loop-voice-agents)
 *   • Plivo HITL Patterns
 *     (https://www.plivo.com/blog/human-in-the-loop-patterns-for-ai-customer-service-in-production/)
 *   • TigerConnect + Voalté priority messaging + auto-escalation patterns
 *   • Medplum Task model (priority codes from acute care)
 *
 * Mock playback sequences are inlined here so call surfaces stay
 * presentation-only. When a real audio + LLM pipeline lands, this is
 * the single file to swap out — the consumer API (useCall hook +
 * action methods + state shape) stays.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// ════════════════════════════════════════════════════════════════
// Directory: realistic ED contact roster
// ════════════════════════════════════════════════════════════════

export type CallTargetId =
  | 'charge_nurse'
  | 'blood_bank'
  | 'respiratory'
  | 'pharmacy'
  | 'oncall_md'
  | 'social_work'
  | 'evs'
  | 'transfer_center'
  | 'security';

export interface CallTargetInfo {
  id: CallTargetId;
  label: string;
  /** Short uppercase code used for LINK.* badges. */
  code: string;
  /** Human-readable category for grouping in the directory. */
  category: 'unit' | 'service' | 'physician' | 'support';
  /** Free-form description used in the directory. */
  detail: string;
  /** Hint for tasks extracted from this contact — most calls to RT
   *  produce routine tasks; most calls to Blood Bank are STAT. */
  defaultPriority: TaskPriority;
  /** Whether this target has a scripted mock sequence (others fall
   *  back to a "no answer · leave message" stub). */
  hasMockSequence: boolean;
}

export const CALL_DIRECTORY: CallTargetInfo[] = [
  {
    id: 'charge_nurse', label: 'ER Charge Nurse', code: 'NURSE',
    category: 'unit',     detail: 'Charge nurse · ER pod A',
    defaultPriority: 'routine', hasMockSequence: true,
  },
  {
    id: 'blood_bank',   label: 'Blood Bank',    code: 'BLOOD',
    category: 'service',  detail: 'MTP · transfusion services',
    defaultPriority: 'stat', hasMockSequence: true,
  },
  {
    id: 'respiratory',  label: 'Respiratory Therapy', code: 'RT',
    category: 'service',  detail: 'RT on-call · ext 4421',
    defaultPriority: 'stat', hasMockSequence: true,
  },
  {
    id: 'pharmacy',     label: 'Pharmacy',      code: 'PHARM',
    category: 'service',  detail: 'ED pharmacy desk',
    defaultPriority: 'routine', hasMockSequence: true,
  },
  {
    id: 'oncall_md',    label: 'On-Call Physician', code: 'MD',
    category: 'physician', detail: 'Hospitalist · paging line',
    defaultPriority: 'stat', hasMockSequence: true,
  },
  {
    id: 'social_work',  label: 'Social Work',   code: 'SW',
    category: 'service',  detail: 'Discharge coordination',
    defaultPriority: 'routine', hasMockSequence: false,
  },
  {
    id: 'evs',          label: 'EVS',           code: 'EVS',
    category: 'support',  detail: 'Environmental services',
    defaultPriority: 'routine', hasMockSequence: false,
  },
  {
    id: 'transfer_center', label: 'Transfer Center', code: 'XFER',
    category: 'service',  detail: 'Bed placement · inter-facility',
    defaultPriority: 'routine', hasMockSequence: false,
  },
  {
    id: 'security',     label: 'Security',      code: 'SEC',
    category: 'support',  detail: 'Hospital security',
    defaultPriority: 'stat', hasMockSequence: false,
  },
];

export const TARGET_INFO: Record<CallTargetId, CallTargetInfo> = Object.fromEntries(
  CALL_DIRECTORY.map((t) => [t.id, t]),
) as Record<CallTargetId, CallTargetInfo>;

/** Top 3 most-frequent targets — pinned in the directory. */
export const FAVORITE_TARGETS: CallTargetId[] = ['charge_nurse', 'oncall_md', 'pharmacy'];

// ════════════════════════════════════════════════════════════════
// Call + Task types
// ════════════════════════════════════════════════════════════════

export type CallState =
  | 'calling'        // ringing
  | 'connected'      // human on the line
  | 'ai_handoff'     // AI is summarizing + proposing tasks (HITL gate)
  | 'ai_executing'   // user approved; AI is performing actions
  | 'ai_done'        // AI finished; awaiting end
  | 'ended';         // call complete

export interface TranscriptLine {
  speaker: 'me' | 'them' | 'ai';
  text: string;
  ts: number;        // ms since call started
}

export type TaskPriority = 'stat' | 'routine' | 'fyi';
export type TaskStatus =
  | 'proposed'   // AI proposed; awaiting human decision
  | 'approved'   // user approved as-is
  | 'edited'    // user approved with edits
  | 'rejected'   // user rejected
  | 'in_progress' // AI is executing
  | 'done';      // AI completed (or marked done by user)

export type AiConfidence = 'high' | 'med' | 'low';

export interface ExtractedTask {
  id: string;
  callId: string;
  text: string;
  assignee: string;
  priority: TaskPriority;
  status: TaskStatus;
  aiConfidence: AiConfidence;
  /** One-line justification surfaced in the HITL panel. */
  aiReasoning: string;
  proposedAt: number;
  decidedAt?: number;
  completedAt?: number;
}

export interface Call {
  id: string;
  target: CallTargetId;
  state: CallState;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  /** Live duration in seconds. Ticks while state ∈ connected / handoff /
   *  executing / done. Frozen when ended. */
  duration: number;
  transcript: TranscriptLine[];
  /** IDs of tasks proposed from this call. Tasks themselves live in the
   *  global task store so they survive after the call ends. */
  proposedTaskIds: string[];
}

export interface CallRecord {
  id: string;
  target: CallTargetId;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  transcript: TranscriptLine[];
  taskIds: string[];
  /** Pre-computed counts for the recent-calls list. */
  taskSummary: { stat: number; routine: number; fyi: number; pendingReview: number };
}

// ════════════════════════════════════════════════════════════════
// Mock playback sequences — scripted per target
// ════════════════════════════════════════════════════════════════

interface MockProposal {
  text: string;
  assignee: string;
  priority: TaskPriority;
  confidence: AiConfidence;
  reasoning: string;
}

interface MockStep {
  t: number;
  speaker: 'me' | 'them';
  text: string;
}

interface MockSequence {
  steps: MockStep[];
  /** Proposals shown by the AI in the HITL panel after the call. */
  proposals: MockProposal[];
}

const SEQ_CHARGE_NURSE: MockSequence = {
  steps: [
    { t: 1000,  speaker: 'them', text: 'ER Charge Nurse, go ahead.' },
    { t: 3000,  speaker: 'me',   text: 'We have 4 criticals inbound. Need 2 beds in Med/Surg immediately.' },
    { t: 6500,  speaker: 'them', text: 'Understood. I will expedite discharges for room 204 and 206.' },
    { t: 10000, speaker: 'me',   text: 'Also need respiratory therapy down here.' },
    { t: 13000, speaker: 'them', text: 'Paging RT now.' },
  ],
  proposals: [
    {
      text: 'Expedite discharges for rooms 204, 206',
      assignee: 'ER Charge Nurse',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Explicit commitment in the call · timeframe = immediate',
    },
    {
      text: 'Page Respiratory Therapy to ER',
      assignee: 'ER Charge Nurse',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Explicit "paging RT now" confirmation',
    },
  ],
};

const SEQ_BLOOD_BANK: MockSequence = {
  steps: [
    { t: 1000,  speaker: 'them', text: 'Blood Bank, this is Sarah.' },
    { t: 3000,  speaker: 'me',   text: 'Sarah, MTP initiating in Trauma 1.' },
    { t: 6000,  speaker: 'them', text: 'Copy. MTP for Trauma 1. Preparing first cooler now.' },
    { t: 10000, speaker: 'me',   text: 'Also need 4 units of O-negative immediately.' },
    { t: 13000, speaker: 'them', text: 'Sending 4 units O-negative via pneumatic tube.' },
  ],
  proposals: [
    {
      text: 'Prepare MTP cooler for Trauma 1',
      assignee: 'Blood Bank',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'MTP activation · standard cooler protocol',
    },
    {
      text: 'Send 4 units O-negative via tube',
      assignee: 'Blood Bank',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Explicit volume + delivery method specified',
    },
  ],
};

const SEQ_RT: MockSequence = {
  steps: [
    { t: 1000,  speaker: 'them', text: 'RT on call.' },
    { t: 2800,  speaker: 'me',   text: 'Need a vent set up in bay 12, bedside, ARDS settings.' },
    { t: 6000,  speaker: 'them', text: 'On the way. ARDS protocol vent for bay 12.' },
    { t: 9500,  speaker: 'me',   text: 'Patient is intubated, sats 86 on bag.' },
    { t: 12500, speaker: 'them', text: 'Two minutes out. Bringing PEEP cart.' },
  ],
  proposals: [
    {
      text: 'Set up ARDS-protocol vent · bay 12',
      assignee: 'Respiratory Therapy',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Vent + settings + location confirmed by RT',
    },
  ],
};

const SEQ_PHARMACY: MockSequence = {
  steps: [
    { t: 1000,  speaker: 'them', text: 'Pharmacy.' },
    { t: 2800,  speaker: 'me',   text: 'Need vanco trough recheck on bed 7, sooner than scheduled.' },
    { t: 6000,  speaker: 'them', text: 'Vanco trough · bed 7 · I will move the lab draw up to next round.' },
    { t: 10000, speaker: 'me',   text: 'Also need ceftriaxone 1g IV for bed 9 in the next 20 min.' },
    { t: 13500, speaker: 'them', text: 'Sending ceftriaxone 1g · bed 9 · ETA 12 minutes.' },
  ],
  proposals: [
    {
      text: 'Move vanco trough draw · bed 7 · next round',
      assignee: 'Pharmacy',
      priority: 'routine',
      confidence: 'high',
      reasoning: 'Lab draw rescheduling, no immediate clinical risk',
    },
    {
      text: 'Dispense ceftriaxone 1g IV · bed 9',
      assignee: 'Pharmacy',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Time-bound antibiotic order · 20 min window',
    },
  ],
};

const SEQ_ONCALL_MD: MockSequence = {
  steps: [
    { t: 1000,  speaker: 'them', text: 'Dr. Tanaka, hospitalist.' },
    { t: 3000,  speaker: 'me',   text: 'Bed 4 · troponin 2.4 · STEMI protocol initiated.' },
    { t: 7000,  speaker: 'them', text: 'On my way down. Five minutes. Hold ASA + heparin per protocol.' },
    { t: 11000, speaker: 'me',   text: 'EKG up on the chart. Cath lab activated.' },
    { t: 14500, speaker: 'them', text: 'Good. Page me again if rhythm changes.' },
  ],
  proposals: [
    {
      text: 'Cardiologist en route to bed 4 · ETA 5 min',
      assignee: 'Bedside team',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'STEMI · physician en route confirmation',
    },
    {
      text: 'Page Dr. Tanaka if bed 4 rhythm changes',
      assignee: 'ER Charge Nurse',
      priority: 'routine',
      confidence: 'med',
      reasoning: 'Conditional task · trigger-based',
    },
  ],
};

const MOCK_SEQUENCES: Partial<Record<CallTargetId, MockSequence>> = {
  charge_nurse: SEQ_CHARGE_NURSE,
  blood_bank:   SEQ_BLOOD_BANK,
  respiratory:  SEQ_RT,
  pharmacy:     SEQ_PHARMACY,
  oncall_md:    SEQ_ONCALL_MD,
};

// ════════════════════════════════════════════════════════════════
// Context shape
// ════════════════════════════════════════════════════════════════

interface CallContextValue {
  // Active state
  activeCall: Call | null;
  heldCalls: Call[];

  // Task store (cross-call)
  tasks: ExtractedTask[];
  pendingReviewCount: number;
  openTaskCount: number;

  // Call history
  history: CallRecord[];

  // Call actions
  startCall: (target: CallTargetId) => string | null;
  endCall: (callId?: string) => void;
  holdActiveCall: () => void;
  resumeCall: (callId: string) => void;

  // AI handoff (HITL)
  handToAI: () => void;
  approveTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  editTask: (taskId: string, patch: Partial<Pick<ExtractedTask, 'text' | 'priority' | 'assignee'>>) => void;
  /** User approves all pending; AI executes whatever was approved. */
  executeApprovedAndEnd: () => void;

  // Task management (independent of calls)
  completeTask: (taskId: string) => void;
  reassignTask: (taskId: string, assignee: string) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCall must be used inside a <CallProvider>');
  }
  return ctx;
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

let __nextCallId = 1;
let __nextTaskId = 1;
const newCallId = () => `c${__nextCallId++}_${Date.now().toString(36)}`;
const newTaskId = () => `t${__nextTaskId++}_${Date.now().toString(36)}`;

function summarize(tasks: ExtractedTask[]): CallRecord['taskSummary'] {
  let stat = 0, routine = 0, fyi = 0, pendingReview = 0;
  for (const t of tasks) {
    if (t.priority === 'stat') stat++;
    else if (t.priority === 'routine') routine++;
    else fyi++;
    if (t.status === 'proposed') pendingReview++;
  }
  return { stat, routine, fyi, pendingReview };
}

// ════════════════════════════════════════════════════════════════
// Provider
// ════════════════════════════════════════════════════════════════

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [heldCalls, setHeldCalls] = useState<Call[]>([]);
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [history, setHistory] = useState<CallRecord[]>([]);

  // ── Duration ticker ────────────────────────────────────────
  // Ticks during connected / ai_handoff / ai_executing / ai_done
  // (anything past 'calling' and before 'ended').
  useEffect(() => {
    if (!activeCall) return;
    const liveStates: CallState[] = ['connected', 'ai_handoff', 'ai_executing', 'ai_done'];
    if (!liveStates.includes(activeCall.state)) return;
    const id = setInterval(() => {
      setActiveCall((c) => (c ? { ...c, duration: c.duration + 1 } : c));
    }, 1000);
    return () => clearInterval(id);
  }, [activeCall?.id, activeCall?.state]);

  // ── Mock transcript playback ───────────────────────────────
  const playbackTimers = useRef<number[]>([]);
  useEffect(() => {
    if (!activeCall || activeCall.state !== 'connected') return;
    const seq = MOCK_SEQUENCES[activeCall.target];
    if (!seq) return;
    playbackTimers.current.forEach((t) => clearTimeout(t));
    playbackTimers.current = [];
    seq.steps.forEach((step) => {
      const id = window.setTimeout(() => {
        setActiveCall((c) => {
          if (!c || c.state !== 'connected') return c;
          return {
            ...c,
            transcript: [...c.transcript, { speaker: step.speaker, text: step.text, ts: step.t }],
          };
        });
      }, step.t);
      playbackTimers.current.push(id);
    });
    return () => {
      playbackTimers.current.forEach((t) => clearTimeout(t));
      playbackTimers.current = [];
    };
  }, [activeCall?.id, activeCall?.state, activeCall?.target]);

  // ── Actions ────────────────────────────────────────────────

  const startCall = (target: CallTargetId): string | null => {
    if (activeCall) {
      // Hold the current active call before placing a new one
      setHeldCalls((h) => [...h, { ...activeCall, state: 'connected' }]);
    }
    const info = TARGET_INFO[target];
    const id = newCallId();
    const now = Date.now();
    const call: Call = {
      id,
      target,
      state: 'calling',
      startedAt: now,
      duration: 0,
      transcript: [],
      proposedTaskIds: [],
    };
    setActiveCall(call);
    // Simulate connection
    setTimeout(() => {
      setActiveCall((c) => {
        if (!c || c.id !== id || c.state !== 'calling') return c;
        // If there's no mock sequence, surface a friendly stub.
        if (!info.hasMockSequence) {
          return {
            ...c,
            state: 'connected',
            connectedAt: Date.now(),
            transcript: [
              { speaker: 'them', text: `${info.label} — please leave a message.`, ts: 600 },
            ],
          };
        }
        return { ...c, state: 'connected', connectedAt: Date.now() };
      });
    }, 1800);
    return id;
  };

  const archiveActiveCallToHistory = (call: Call, proposed: ExtractedTask[]) => {
    const record: CallRecord = {
      id: call.id,
      target: call.target,
      startedAt: call.startedAt,
      endedAt: Date.now(),
      durationSec: call.duration,
      transcript: call.transcript,
      taskIds: proposed.map((t) => t.id),
      taskSummary: summarize(proposed),
    };
    setHistory((h) => [record, ...h].slice(0, 50));
  };

  const endCall = (callId?: string) => {
    if (activeCall && (!callId || callId === activeCall.id)) {
      const tasksFromThisCall = tasks.filter((t) => activeCall.proposedTaskIds.includes(t.id));
      archiveActiveCallToHistory(activeCall, tasksFromThisCall);
      setActiveCall(null);
      return;
    }
    if (callId) {
      const held = heldCalls.find((c) => c.id === callId);
      if (held) {
        const tasksFromThisCall = tasks.filter((t) => held.proposedTaskIds.includes(t.id));
        archiveActiveCallToHistory(held, tasksFromThisCall);
        setHeldCalls((h) => h.filter((c) => c.id !== callId));
      }
    }
  };

  const holdActiveCall = () => {
    if (!activeCall) return;
    setHeldCalls((h) => [...h, activeCall]);
    setActiveCall(null);
  };

  const resumeCall = (callId: string) => {
    const held = heldCalls.find((c) => c.id === callId);
    if (!held) return;
    if (activeCall) {
      setHeldCalls((h) => [...h.filter((c) => c.id !== callId), activeCall]);
    } else {
      setHeldCalls((h) => h.filter((c) => c.id !== callId));
    }
    setActiveCall(held);
  };

  // ── AI handoff (HITL) ──────────────────────────────────────
  const handToAI = () => {
    if (!activeCall || activeCall.state !== 'connected') return;
    const seq = MOCK_SEQUENCES[activeCall.target];
    const proposals = seq?.proposals ?? [];
    const now = Date.now();
    const newTasks: ExtractedTask[] = proposals.map((p) => ({
      id: newTaskId(),
      callId: activeCall.id,
      text: p.text,
      assignee: p.assignee,
      priority: p.priority,
      status: 'proposed',
      aiConfidence: p.confidence,
      aiReasoning: p.reasoning,
      proposedAt: now,
    }));
    setTasks((prev) => [...newTasks, ...prev]);
    setActiveCall((c) =>
      c ? { ...c, state: 'ai_handoff', proposedTaskIds: newTasks.map((t) => t.id) } : c,
    );
  };

  const approveTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && t.status === 'proposed'
          ? { ...t, status: 'approved', decidedAt: Date.now() }
          : t,
      ),
    );
  };

  const rejectTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && t.status === 'proposed'
          ? { ...t, status: 'rejected', decidedAt: Date.now() }
          : t,
      ),
    );
  };

  const editTask = (
    taskId: string,
    patch: Partial<Pick<ExtractedTask, 'text' | 'priority' | 'assignee'>>,
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && t.status === 'proposed'
          ? { ...t, ...patch, status: 'edited', decidedAt: Date.now() }
          : t,
      ),
    );
  };

  /**
   * The big HITL action. Approves any still-proposed tasks (auto-OK for
   * the unchecked), moves the call to 'ai_executing', then 'ai_done',
   * then 'ended' — with realistic delays so the user can see the AI
   * working.
   */
  const executeApprovedAndEnd = () => {
    if (!activeCall || activeCall.state !== 'ai_handoff') return;
    const ids = activeCall.proposedTaskIds;
    // Auto-approve anything still in 'proposed' state.
    setTasks((prev) =>
      prev.map((t) =>
        ids.includes(t.id) && t.status === 'proposed'
          ? { ...t, status: 'approved', decidedAt: Date.now() }
          : t,
      ),
    );
    setActiveCall((c) => (c ? { ...c, state: 'ai_executing' } : c));

    // Step through execution: each approved/edited task flips to in_progress
    // → done with a small delay so the UI feels like the AI is working.
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          ids.includes(t.id) && (t.status === 'approved' || t.status === 'edited')
            ? { ...t, status: 'in_progress' }
            : t,
        ),
      );
    }, 600);
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          ids.includes(t.id) && t.status === 'in_progress'
            ? { ...t, status: 'done', completedAt: Date.now() }
            : t,
        ),
      );
      setActiveCall((c) => (c ? { ...c, state: 'ai_done' } : c));
    }, 2400);
    setTimeout(() => {
      setActiveCall((c) => {
        if (!c) return c;
        // capture proposed tasks from this call before clearing
        const taskList = tasks.filter((t) => c.proposedTaskIds.includes(t.id));
        archiveActiveCallToHistory(c, taskList);
        return null;
      });
    }, 3800);
  };

  // ── Task management (post-call) ────────────────────────────
  const completeTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'done', completedAt: Date.now() }
          : t,
      ),
    );
  };

  const reassignTask = (taskId: string, assignee: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assignee } : t)));
  };

  // Derived counts
  const pendingReviewCount = tasks.filter((t) => t.status === 'proposed').length;
  const openTaskCount = tasks.filter(
    (t) => t.status !== 'rejected' && t.status !== 'done',
  ).length;

  return (
    <CallContext.Provider
      value={{
        activeCall,
        heldCalls,
        tasks,
        pendingReviewCount,
        openTaskCount,
        history,
        startCall,
        endCall,
        holdActiveCall,
        resumeCall,
        handToAI,
        approveTask,
        rejectTask,
        editTask,
        executeApprovedAndEnd,
        completeTask,
        reassignTask,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

// ────────────────────────────────────────────────────────────
// Back-compat shims for existing imports
// ────────────────────────────────────────────────────────────

/** Old `CallTarget` type — kept so legacy imports compile while we
 *  migrate. Maps to the new CallTargetId, nullable. */
export type CallTarget = CallTargetId | null;
export type CallStateType = CallState;
export type ActionTask = { task: string; assignee: string };

/** Old label map kept for components still reaching for it. */
export const CALL_TARGET_LABEL: Record<CallTargetId, string> = Object.fromEntries(
  CALL_DIRECTORY.map((t) => [t.id, t.label]),
) as Record<CallTargetId, string>;
