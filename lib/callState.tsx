import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * callState — shared state for the PULSE call feature.
 *
 * Previously local to CommandSidebar. Lifted into a Context so that:
 *   - the right-side CallDrawer (live in-the-moment call view),
 *   - the Comms top-level tab (call + directory + history),
 *   - the sidebar "Quick Paging" buttons (which trigger calls),
 * all read and write the same call state. One source of truth.
 *
 * Mock playback sequences are inlined here so the call surfaces stay
 * presentation-only. When a real audio pipeline lands, this is the
 * single file to swap out.
 */

export type CallTarget = 'nurse' | 'blood_bank' | null;
export type CallStateType = 'calling' | 'connected' | 'ai_speaking' | 'ended';

export interface TranscriptLine {
  speaker: 'me' | 'them' | 'ai';
  text: string;
}

export interface ActionTask {
  task: string;
  assignee: string;
}

interface MockStep {
  t: number; // ms after `connected`
  speaker: 'me' | 'them' | 'ai';
  text: string;
  task?: ActionTask;
}

const NURSE_SEQUENCE: MockStep[] = [
  { t: 1000, speaker: 'them', text: 'ER Charge Nurse, go ahead.' },
  {
    t: 3000,
    speaker: 'me',
    text: 'We have 4 criticals inbound. Need 2 beds in Med/Surg immediately.',
  },
  {
    t: 6000,
    speaker: 'them',
    text: 'Understood. I will expedite discharges for room 204 and 206.',
  },
  {
    t: 9000,
    speaker: 'ai',
    text: '[AI Note] Action identified: Expedite discharges for rooms 204, 206.',
    task: { task: 'Expedite discharges (204, 206)', assignee: 'ER Charge Nurse' },
  },
  { t: 12000, speaker: 'me', text: 'Also need respiratory therapy down here.' },
  { t: 15000, speaker: 'them', text: 'Paging RT now.' },
  {
    t: 17000,
    speaker: 'ai',
    text: '[AI Note] Action identified: Page Respiratory Therapy to ER.',
    task: { task: 'Page RT to ER', assignee: 'ER Charge Nurse' },
  },
];

const BLOOD_BANK_SEQUENCE: MockStep[] = [
  { t: 1000, speaker: 'them', text: 'Blood Bank, this is Sarah.' },
  {
    t: 3000,
    speaker: 'me',
    text: 'Sarah, we have a massive transfusion protocol initiating in Trauma 1.',
  },
  {
    t: 6000,
    speaker: 'them',
    text: 'Copy that. MTP for Trauma 1. Preparing first cooler now.',
  },
  {
    t: 9000,
    speaker: 'ai',
    text: '[AI Note] Action identified: Prepare MTP cooler for Trauma 1.',
    task: { task: 'Prepare MTP cooler (Trauma 1)', assignee: 'Blood Bank' },
  },
  {
    t: 12000,
    speaker: 'me',
    text: 'We also need 4 units of O-negative sent down immediately.',
  },
  {
    t: 15000,
    speaker: 'them',
    text: 'Sending 4 units O-negative via pneumatic tube.',
  },
  {
    t: 17000,
    speaker: 'ai',
    text: '[AI Note] Action identified: Send 4 units O-negative via tube.',
    task: { task: 'Send 4 units O-negative', assignee: 'Blood Bank' },
  },
];

const SEQUENCES: Record<NonNullable<CallTarget>, MockStep[]> = {
  nurse: NURSE_SEQUENCE,
  blood_bank: BLOOD_BANK_SEQUENCE,
};

export const CALL_TARGET_LABEL: Record<NonNullable<CallTarget>, string> = {
  nurse: 'Charge Nurse · ER',
  blood_bank: 'Blood Bank',
};

interface CallContextValue {
  activeCall: CallTarget;
  callState: CallStateType;
  callDuration: number;
  transcript: TranscriptLine[];
  actionTasks: ActionTask[];
  startCall: (type: NonNullable<CallTarget>) => void;
  endCall: () => void;
  handToAI: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

/** Consumer hook. Throws if used outside the provider — surfaces wiring
 *  bugs at mount instead of silently rendering with no call state. */
export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCall must be used inside a <CallProvider>');
  }
  return ctx;
}

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCall, setActiveCall] = useState<CallTarget>(null);
  const [callState, setCallState] = useState<CallStateType>('ended');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [actionTasks, setActionTasks] = useState<ActionTask[]>([]);

  // Duration ticker — runs while the call is live or AI is wrapping.
  useEffect(() => {
    if (callState !== 'connected' && callState !== 'ai_speaking') return;
    const id = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [callState]);

  // Mock playback — scripted sequence per call target. Pushes transcript
  // lines + extracted tasks at scheduled offsets. When a real audio
  // pipeline lands, this whole block gets replaced; the consumer API
  // stays the same.
  useEffect(() => {
    if (callState !== 'connected' || !activeCall) return;
    const sequence = SEQUENCES[activeCall];
    const ids = sequence.map((step) =>
      setTimeout(() => {
        setTranscript((prev) => [...prev, { speaker: step.speaker, text: step.text }]);
        if (step.task) setActionTasks((prev) => [...prev, step.task!]);
      }, step.t),
    );
    return () => ids.forEach(clearTimeout);
  }, [callState, activeCall]);

  // Auto-end shortly after the AI takes over the line.
  useEffect(() => {
    if (callState !== 'ai_speaking') return;
    const id = setTimeout(() => endCallInternal(), 5000);
    return () => clearTimeout(id);
  }, [callState]);

  const endCallInternal = () => {
    setCallState('ended');
    // small delay so the exit animation can render with the data intact
    setTimeout(() => setActiveCall(null), 500);
  };

  const startCall = (type: NonNullable<CallTarget>) => {
    setActiveCall(type);
    setCallState('calling');
    setCallDuration(0);
    setTranscript([]);
    setActionTasks([]);
    setTimeout(() => {
      setCallState((cs) => (cs === 'calling' ? 'connected' : cs));
    }, 2000);
  };

  const handToAI = () => setCallState('ai_speaking');

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callState,
        callDuration,
        transcript,
        actionTasks,
        startCall,
        endCall: endCallInternal,
        handToAI,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
