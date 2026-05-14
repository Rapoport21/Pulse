/**
 * callState — call + task feature state.
 *
 * Model (this revision):
 *   • Call states: calling → connected → ended (3 only, no handoff machine)
 *   • Tasks are extracted LIVE during the connected state — alongside
 *     transcript lines, on a scripted timeline.
 *   • Each task has executionMode = 'auto' | 'manual':
 *       - auto: AI runs it itself. Task flips proposed → approved →
 *         in_progress → done with realistic delays. The user sees the
 *         AI doing the work, no input required.
 *       - manual: AI is uncertain or the action requires clinical
 *         judgment. Task stays in 'proposed' until the user approves /
 *         edits / rejects. Lives in the global task store; reachable
 *         from the Tasks drawer or the Tasks tab in Comms even after
 *         the call ends.
 *   • Multi-call queue: 1 active + N held. The original Comms-screen
 *     held-queue UI still works.
 *
 * Research that drove the design:
 *   • LiveKit HITL Pattern — keep the human in the loop for the small
 *     set of actions that need clinical judgment; auto-execute the rest
 *     (https://livekit.com/blog/human-in-the-loop-voice-agents)
 *   • Plivo HITL in production — auto-execute is the default; only
 *     escalate the uncertain cases
 *   • Medplum Task model — priority + lifecycle from acute-care codes
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
  code: string;
  category: 'unit' | 'service' | 'physician' | 'support';
  detail: string;
  defaultPriority: TaskPriority;
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

export const FAVORITE_TARGETS: CallTargetId[] = ['charge_nurse', 'oncall_md', 'pharmacy'];

// ════════════════════════════════════════════════════════════════
// Call + Task types
// ════════════════════════════════════════════════════════════════

export type CallState = 'calling' | 'connected' | 'ended';

export interface TranscriptLine {
  speaker: 'me' | 'them' | 'ai';
  text: string;
  ts: number;
}

export type TaskPriority = 'stat' | 'routine' | 'fyi';
export type TaskExecutionMode = 'auto' | 'manual';
export type TaskStatus =
  | 'proposed'
  | 'approved'
  | 'edited'
  | 'rejected'
  | 'in_progress'
  | 'done';

export type AiConfidence = 'high' | 'med' | 'low';

export interface ExtractedTask {
  id: string;
  callId: string;
  text: string;
  assignee: string;
  priority: TaskPriority;
  status: TaskStatus;
  executionMode: TaskExecutionMode;
  aiConfidence: AiConfidence;
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
  duration: number;
  transcript: TranscriptLine[];
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
  taskSummary: { stat: number; routine: number; fyi: number; pendingReview: number };
}

// ════════════════════════════════════════════════════════════════
// Mock playback — transcript + scheduled task proposals
// ════════════════════════════════════════════════════════════════

interface MockProposal {
  /** ms after `connected` to push this proposal. */
  t: number;
  text: string;
  assignee: string;
  priority: TaskPriority;
  confidence: AiConfidence;
  reasoning: string;
  /** auto = AI runs it itself; manual = needs human approval. */
  mode: TaskExecutionMode;
}

interface MockStep {
  t: number;
  speaker: 'me' | 'them';
  text: string;
}

interface MockSequence {
  steps: MockStep[];
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
      // Workflow change · charge nurse committed but the AI flags this
      // for the operator to confirm (discharge orchestration involves
      // patient-facing decisions).
      t: 8000,
      text: 'Expedite discharges for rooms 204, 206',
      assignee: 'ER Charge Nurse',
      priority: 'stat',
      confidence: 'med',
      reasoning: 'Multi-patient discharge orchestration · needs op confirmation',
      mode: 'manual',
    },
    {
      // Direct paging action · already confirmed in the call.
      t: 14000,
      text: 'Page Respiratory Therapy to ER',
      assignee: 'Charge desk',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Explicit "paging RT now" · auto-dispatched',
      mode: 'auto',
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
      t: 7500,
      text: 'Log MTP activation for Trauma 1',
      assignee: 'Blood Bank',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Standard MTP audit trail · auto-logged',
      mode: 'auto',
    },
    {
      t: 14500,
      text: 'Track 4 units O-negative via tube · Trauma 1',
      assignee: 'Blood Bank',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Tube dispatch confirmed · auto-tracking',
      mode: 'auto',
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
      t: 7000,
      text: 'Set up ARDS-protocol vent · bay 12',
      assignee: 'Respiratory Therapy',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'RT en route · auto-logged for room',
      mode: 'auto',
    },
    {
      // Clinical judgment: documentation of patient status change.
      t: 13500,
      text: 'Document acute hypoxia · sats 86 on bag · pre-vent',
      assignee: 'Bedside team',
      priority: 'routine',
      confidence: 'med',
      reasoning: 'Patient-state documentation · needs operator review',
      mode: 'manual',
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
      t: 7000,
      text: 'Move vanco trough draw · bed 7 · next round',
      assignee: 'Pharmacy',
      priority: 'routine',
      confidence: 'high',
      reasoning: 'Lab-draw timing change · auto-logged',
      mode: 'auto',
    },
    {
      // Med order · pharmacist confirmed, but pharmacy dispensing
      // needs operator approval per protocol (controlled change).
      t: 14500,
      text: 'Approve ceftriaxone 1g IV order · bed 9',
      assignee: 'Operator',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'Med order confirmation · operator co-sign required',
      mode: 'manual',
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
      t: 8500,
      text: 'Cardiologist en route · bed 4 · ETA 5 min',
      assignee: 'ER team',
      priority: 'stat',
      confidence: 'high',
      reasoning: 'ETA broadcast · auto-posted to team feed',
      mode: 'auto',
    },
    {
      // Conditional trigger · the AI is uncertain how to monitor.
      t: 15500,
      text: 'Watch bed 4 rhythm · page Dr. Tanaka on change',
      assignee: 'ER Charge Nurse',
      priority: 'routine',
      confidence: 'med',
      reasoning: 'Conditional task · trigger semantics need confirmation',
      mode: 'manual',
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
  activeCall: Call | null;
  heldCalls: Call[];

  tasks: ExtractedTask[];
  pendingReviewCount: number;
  openTaskCount: number;

  history: CallRecord[];

  startCall: (target: CallTargetId) => string | null;
  endCall: (callId?: string) => void;
  holdActiveCall: () => void;
  resumeCall: (callId: string) => void;

  // Per-task actions (used during + after the call by both the inline
  // task panel and the global TasksDrawer).
  approveTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  editTask: (taskId: string, patch: Partial<Pick<ExtractedTask, 'text' | 'priority' | 'assignee'>>) => void;
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

  // ── Duration ticker ───────────────────────────────────────
  useEffect(() => {
    if (!activeCall || activeCall.state !== 'connected') return;
    const id = setInterval(() => {
      setActiveCall((c) => (c ? { ...c, duration: c.duration + 1 } : c));
    }, 1000);
    return () => clearInterval(id);
  }, [activeCall?.id, activeCall?.state]);

  // ── Mock playback (transcript + scheduled proposals) ──────
  const playbackTimers = useRef<number[]>([]);
  useEffect(() => {
    if (!activeCall || activeCall.state !== 'connected') return;
    const seq = MOCK_SEQUENCES[activeCall.target];
    if (!seq) return;
    playbackTimers.current.forEach((t) => clearTimeout(t));
    playbackTimers.current = [];

    // Transcript pushes
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

    // Task proposals — fire at scheduled times. AUTO tasks self-execute;
    // MANUAL tasks wait for operator decision.
    seq.proposals.forEach((p) => {
      const callIdAtSchedule = activeCall.id;
      const id = window.setTimeout(() => {
        const now = Date.now();
        const taskId = newTaskId();
        const initialStatus: TaskStatus = p.mode === 'auto' ? 'approved' : 'proposed';
        const newTask: ExtractedTask = {
          id: taskId,
          callId: callIdAtSchedule,
          text: p.text,
          assignee: p.assignee,
          priority: p.priority,
          status: initialStatus,
          executionMode: p.mode,
          aiConfidence: p.confidence,
          aiReasoning: p.reasoning,
          proposedAt: now,
          decidedAt: p.mode === 'auto' ? now : undefined,
        };
        setTasks((prev) => [newTask, ...prev]);
        setActiveCall((c) => {
          if (!c || c.id !== callIdAtSchedule) return c;
          return { ...c, proposedTaskIds: [...c.proposedTaskIds, taskId] };
        });

        // Auto-task execution timeline: approved → in_progress → done
        if (p.mode === 'auto') {
          const t1 = window.setTimeout(() => {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId && t.status === 'approved'
                  ? { ...t, status: 'in_progress' }
                  : t,
              ),
            );
          }, 800);
          const t2 = window.setTimeout(() => {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId && t.status === 'in_progress'
                  ? { ...t, status: 'done', completedAt: Date.now() }
                  : t,
              ),
            );
          }, 2200);
          playbackTimers.current.push(t1, t2);
        }
      }, p.t);
      playbackTimers.current.push(id);
    });

    return () => {
      playbackTimers.current.forEach((t) => clearTimeout(t));
      playbackTimers.current = [];
    };
  }, [activeCall?.id, activeCall?.state, activeCall?.target]);

  // ── Actions ───────────────────────────────────────────────

  const startCall = (target: CallTargetId): string | null => {
    if (activeCall) {
      setHeldCalls((h) => [...h, activeCall]);
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
    setTimeout(() => {
      setActiveCall((c) => {
        if (!c || c.id !== id || c.state !== 'calling') return c;
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

  const archiveCallToHistory = (call: Call, callTasks: ExtractedTask[]) => {
    const record: CallRecord = {
      id: call.id,
      target: call.target,
      startedAt: call.startedAt,
      endedAt: Date.now(),
      durationSec: call.duration,
      transcript: call.transcript,
      taskIds: callTasks.map((t) => t.id),
      taskSummary: summarize(callTasks),
    };
    setHistory((h) => [record, ...h].slice(0, 50));
  };

  const endCall = (callId?: string) => {
    if (activeCall && (!callId || callId === activeCall.id)) {
      const callTasks = tasks.filter((t) => activeCall.proposedTaskIds.includes(t.id));
      archiveCallToHistory(activeCall, callTasks);
      setActiveCall(null);
      return;
    }
    if (callId) {
      const held = heldCalls.find((c) => c.id === callId);
      if (held) {
        const callTasks = tasks.filter((t) => held.proposedTaskIds.includes(t.id));
        archiveCallToHistory(held, callTasks);
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

  // ── Per-task actions ──────────────────────────────────────
  const approveTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && t.status === 'proposed'
          ? { ...t, status: 'approved', decidedAt: Date.now() }
          : t,
      ),
    );
    // Then run it: in_progress → done
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === 'approved'
            ? { ...t, status: 'in_progress' }
            : t,
        ),
      );
    }, 400);
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === 'in_progress'
            ? { ...t, status: 'done', completedAt: Date.now() }
            : t,
        ),
      );
    }, 1600);
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

  const completeTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'done', completedAt: Date.now() } : t,
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
        approveTask,
        rejectTask,
        editTask,
        completeTask,
        reassignTask,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────
// Back-compat shims
// ─────────────────────────────────────────────────────────
export type CallTarget = CallTargetId | null;
export type CallStateType = CallState;
export type ActionTask = { task: string; assignee: string };
export const CALL_TARGET_LABEL: Record<CallTargetId, string> = Object.fromEntries(
  CALL_DIRECTORY.map((t) => [t.id, t.label]),
) as Record<CallTargetId, string>;
