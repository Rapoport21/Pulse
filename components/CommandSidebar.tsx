import React, { useState, useEffect, useRef } from 'react';
import { Radio, ShieldAlert, PhoneCall, PhoneOff, Bot, Activity, User, CheckCircle2, Clock } from 'lucide-react';
import type { UrgentTask } from '../lib/surgeTaskTemplates';

interface TranscriptLine {
  speaker: 'me' | 'them' | 'ai';
  text: string;
}

interface ActionTask {
  task: string;
  assignee: string;
}

interface CommandSidebarProps {
  isSurgeActive: boolean;
  surgeActivatedAt: number | null;
  urgentTasks: UrgentTask[];
  onActivateSurge: () => void;
}

const formatActivatedTime = (ts: number | null) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const CommandSidebar = ({
  isSurgeActive,
  surgeActivatedAt,
  urgentTasks,
  onActivateSurge,
}: CommandSidebarProps) => {
  const [activeCall, setActiveCall] = useState<'nurse' | 'blood_bank' | null>(null);
  const [callState, setCallState] = useState<'calling' | 'connected' | 'ai_speaking' | 'ended'>('ended');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [actionTasks, setActionTasks] = useState<ActionTask[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected' || callState === 'ai_speaking') {
      interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Mock call simulation
  useEffect(() => {
    if (callState === 'connected') {
      let sequence: { t: number, speaker: 'me' | 'them' | 'ai', text: string, task?: { task: string, assignee: string } }[] = [];
      
      if (activeCall === 'nurse') {
        sequence = [
          { t: 1000, speaker: 'them', text: 'ER Charge Nurse, go ahead.' },
          { t: 3000, speaker: 'me', text: 'We have 4 criticals inbound. Need 2 beds in Med/Surg immediately.' },
          { t: 6000, speaker: 'them', text: 'Understood. I will expedite discharges for room 204 and 206.' },
          { t: 9000, speaker: 'ai', text: '[AI Note] Action identified: Expedite discharges for rooms 204, 206.', task: { task: 'Expedite discharges (204, 206)', assignee: 'ER Charge Nurse' } },
          { t: 12000, speaker: 'me', text: 'Also need respiratory therapy down here.' },
          { t: 15000, speaker: 'them', text: 'Paging RT now.' },
          { t: 17000, speaker: 'ai', text: '[AI Note] Action identified: Page Respiratory Therapy to ER.', task: { task: 'Page RT to ER', assignee: 'ER Charge Nurse' } },
        ];
      } else if (activeCall === 'blood_bank') {
        sequence = [
          { t: 1000, speaker: 'them', text: 'Blood Bank, this is Sarah.' },
          { t: 3000, speaker: 'me', text: 'Sarah, we have a massive transfusion protocol initiating in Trauma 1.' },
          { t: 6000, speaker: 'them', text: 'Copy that. MTP for Trauma 1. Preparing first cooler now.' },
          { t: 9000, speaker: 'ai', text: '[AI Note] Action identified: Prepare MTP cooler for Trauma 1.', task: { task: 'Prepare MTP cooler (Trauma 1)', assignee: 'Blood Bank' } },
          { t: 12000, speaker: 'me', text: 'We also need 4 units of O-negative sent down immediately.' },
          { t: 15000, speaker: 'them', text: 'Sending 4 units O-negative via pneumatic tube.' },
          { t: 17000, speaker: 'ai', text: '[AI Note] Action identified: Send 4 units O-negative via tube.', task: { task: 'Send 4 units O-negative', assignee: 'Blood Bank' } },
        ];
      }

      const timeouts = sequence.map(step => 
        setTimeout(() => {
          setTranscript(prev => [...prev, { speaker: step.speaker, text: step.text }]);
          if (step.task) {
            setActionTasks(prev => [...prev, step.task!]);
          }
        }, step.t)
      );

      return () => timeouts.forEach(clearTimeout);
    }
  }, [callState, activeCall]);

  const endCall = () => {
    setCallState('ended');
    setTimeout(() => setActiveCall(null), 500);
  };

  // Auto-end call when AI takes over
  useEffect(() => {
    if (callState === 'ai_speaking') {
      const timeout = setTimeout(() => {
        endCall();
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [callState]);

  const handleCall = (type: 'nurse' | 'blood_bank') => {
    setActiveCall(type);
    setCallState('calling');
    setCallDuration(0);
    setTranscript([]);
    setActionTasks([]);
    setTimeout(() => {
      if (callState !== 'ended') setCallState('connected');
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`w-full md:w-80 border-l flex flex-col h-full shrink-0 transition-colors duration-500 ${isSurgeActive ? 'bg-rose-950/40 border-rose-900/50' : 'bg-neutral-900/80 border-neutral-800'}`}>
      <div className={`p-4 border-b ${isSurgeActive ? 'border-rose-900/50' : 'border-neutral-800'}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isSurgeActive ? 'text-rose-400' : 'text-neutral-500'}`}>
          <Radio className="w-4 h-4" /> Command Net
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="p-4 space-y-4">
          {!isSurgeActive ? (
            <button
              onClick={onActivateSurge}
              className="w-full py-4 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] bg-neutral-800 text-rose-500 hover:bg-neutral-700 border border-rose-900/50"
            >
              <ShieldAlert className="w-5 h-5" />
              ACTIVATE SURGE MODE
            </button>
          ) : (
            <div
              aria-disabled
              className="w-full py-3 px-4 rounded-lg font-bold text-sm flex flex-col items-center justify-center gap-1 bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.5)] animate-pulse cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                🚨 SURGE MODE ACTIVE
              </div>
              <div className="text-[10px] font-mono opacity-80">
                Activated at {formatActivatedTime(surgeActivatedAt)}
              </div>
            </div>
          )}

          {/* Urgent Tasks Acknowledgment Feed (admin view) */}
          {isSurgeActive && urgentTasks.length > 0 && (
            <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Urgent Tasks ({urgentTasks.filter(t => t.acknowledged).length}/{urgentTasks.length})
              </div>
              <div className="space-y-1.5">
                {urgentTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`text-[11px] p-2 rounded border flex flex-col gap-0.5 ${
                      t.acknowledged
                        ? 'bg-emerald-950/30 border-emerald-900/40'
                        : 'bg-neutral-950 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      {t.acknowledged ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <span className={t.acknowledged ? 'text-emerald-200 line-through' : 'text-neutral-200'}>
                        {t.title}
                      </span>
                    </div>
                    {t.acknowledged && t.acknowledgedBy && (
                      <div className="text-[9px] text-emerald-400/80 font-mono pl-4">
                        ack'd · {t.acknowledgedBy.slice(0, 8)}{' '}
                        {t.acknowledgedAt && (
                          <span className="text-emerald-400/50">
                            @ {new Date(t.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!activeCall && (
            <div className={`space-y-2 pt-4 border-t ${isSurgeActive ? 'border-rose-900/30' : 'border-neutral-800'}`}>
              <h4 className="text-xs font-semibold text-neutral-400">Quick Comms</h4>
              <button 
                onClick={() => handleCall('nurse')}
                className="w-full text-left px-3 py-2 rounded bg-neutral-800/50 hover:bg-neutral-800 text-sm text-neutral-300 flex items-center gap-2 border border-neutral-700/50 transition-all duration-200 hover:scale-[1.02]"
              >
                <PhoneCall className="w-3 h-3 text-blue-400" /> Page Charge Nurse
              </button>
              <button 
                onClick={() => handleCall('blood_bank')}
                className="w-full text-left px-3 py-2 rounded bg-neutral-800/50 hover:bg-neutral-800 text-sm text-neutral-300 flex items-center gap-2 border border-neutral-700/50 transition-all duration-200 hover:scale-[1.02]"
              >
                <PhoneCall className="w-3 h-3 text-emerald-400" /> Call Blood Bank
              </button>
            </div>
          )}

          {!activeCall && (
            <div className={`space-y-3 pt-4 border-t ${isSurgeActive ? 'border-rose-900/30' : 'border-neutral-800'}`}>
              <h4 className="text-xs font-semibold text-neutral-400">Live Feed</h4>
              <div className="text-xs space-y-2">
                <div className={`p-2 rounded border ${isSurgeActive ? 'bg-rose-950/20 border-rose-900/30' : 'bg-neutral-950 border-neutral-800'}`}>
                  <span className="text-blue-400 font-bold">ER Charge:</span> Holding 4 admissions. Need beds.
                  <div className="text-[10px] text-neutral-500 mt-1">2m ago</div>
                </div>
                <div className={`p-2 rounded border ${isSurgeActive ? 'bg-rose-950/20 border-rose-900/30' : 'bg-neutral-950 border-neutral-800'}`}>
                  <span className="text-purple-400 font-bold">Lab:</span> Analyzer 2 back online.
                  <div className="text-[10px] text-neutral-500 mt-1">15m ago</div>
                </div>
                {isSurgeActive && (
                  <div className="p-2 rounded border bg-rose-950/40 border-rose-500/50 animate-pulse">
                    <span className="text-rose-400 font-bold">SYSTEM:</span> Surge Protocol Activated. All non-essential actions suspended.
                    <div className="text-[10px] text-rose-500/70 mt-1">Just now</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inline Call UI */}
        {activeCall && (
          <div className="flex-1 flex flex-col border-t border-neutral-800 bg-neutral-950/50 animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${callState === 'calling' ? 'bg-cyan-900/50 text-cyan-400' : callState === 'ai_speaking' ? 'bg-rose-900/50 text-rose-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                    {callState === 'ai_speaking' ? <Bot className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
                  </div>
                  {callState === 'calling' && <div className="absolute inset-0 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />}
                  {callState === 'connected' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-neutral-900 animate-pulse" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {activeCall === 'nurse' ? 'Charge Nurse (ER)' : 'Blood Bank'}
                  </h4>
                  <div className="text-xs font-mono flex items-center gap-1">
                    {callState === 'calling' && <span className="text-cyan-400 animate-pulse">Connecting...</span>}
                    {callState === 'connected' && <span className="text-emerald-400">{formatTime(callDuration)}</span>}
                    {callState === 'ai_speaking' && <span className="text-rose-400">AI Active - {formatTime(callDuration)}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Transcript Area */}
            {(callState === 'connected' || callState === 'ai_speaking') && (
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3" ref={transcriptRef}>
                {transcript.map((line, i) => (
                  <div key={i} className={`flex flex-col ${line.speaker === 'me' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-lg text-xs ${
                      line.speaker === 'me' ? 'bg-neutral-800 text-neutral-200 rounded-tr-none' : 
                      line.speaker === 'ai' ? 'bg-rose-950/30 border border-rose-900/50 text-rose-300 w-full' :
                      'bg-emerald-950/30 border border-emerald-900/50 text-emerald-300 rounded-tl-none'
                    }`}>
                      {line.speaker === 'ai' && <Bot className="w-3 h-3 inline mr-1.5 -mt-0.5" />}
                      {line.text}
                    </div>
                  </div>
                ))}
                {callState === 'ai_speaking' && (
                  <div className="bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 text-xs text-rose-300 animate-pulse">
                    <Bot className="w-4 h-4 mb-1" />
                    Taking over call... "I am the AI assistant for Command. I have logged the requested actions. You may disconnect. Thank you."
                  </div>
                )}
              </div>
            )}

            {/* AI Action Extraction */}
            {actionTasks.length > 0 && (
              <div className="p-3 bg-neutral-900 border-t border-neutral-800">
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2 flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-rose-400" /> Extracted Tasks
                </div>
                <div className="space-y-2">
                  {actionTasks.map((task, i) => (
                    <div key={i} className="bg-neutral-950 border border-neutral-800 rounded p-2 text-xs flex flex-col gap-1">
                      <span className="text-neutral-300 font-medium">{task.task}</span>
                      <span className="text-neutral-500 flex items-center gap-1 text-[10px]">
                        <User className="w-3 h-3" /> @{task.assignee}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call Controls */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/80 flex gap-2 shrink-0">
              {callState === 'connected' && (
                <button 
                  onClick={() => setCallState('ai_speaking')}
                  className="flex-1 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/50 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Bot className="w-4 h-4" /> Hand over to AI
                </button>
              )}
              <button 
                onClick={endCall}
                className="flex-1 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-400 border border-red-900/50 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
