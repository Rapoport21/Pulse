import React, { useState } from 'react';
import { Playbook } from '../types';
import { ShieldAlert, ArrowRight, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface PlaybooksProps {
  onActivate: () => void;
}

const library: Playbook[] = [
  {
    id: 'PB-SURGE-L2',
    name: 'Level 2 Surge Protocol',
    description: 'Rapid decompression of ED via hallway boarding and fast-track expansion.',
    triggerCondition: 'NEDOCS > 100 for 60 mins',
    approverRole: 'Medical Director',
    steps: [
      { id: 's1', description: 'Notify House Supervisor and CNO', role: 'Charge Nurse', status: 'PENDING' },
      { id: 's2', description: 'Open 4 hallway beds in Med/Surg', role: 'Floor Manager', status: 'PENDING' },
      { id: 's3', description: 'Deploy rapid triage team to ED entrance', role: 'ER Personnel', status: 'PENDING' }
    ],
    estimatedImpact: '-15% Saturation in 60m'
  },
  {
    id: 'PB-MCI-ALPHA',
    name: 'Mass Casualty Alpha',
    description: 'Total mobilization for >20 incoming casualties. Cancels all electives.',
    triggerCondition: 'External Event Notification',
    approverRole: 'Chief of Ops',
    steps: [
      { id: 'm1', description: 'Activate Incident Command Center', role: 'Admin', status: 'PENDING' },
      { id: 'm2', description: 'Clear Trauma Bays 1-4', role: 'ER Personnel', status: 'PENDING' },
      { id: 'm3', description: 'Recall off-duty surgical staff', role: 'Floor Manager', status: 'PENDING' }
    ],
    estimatedImpact: 'Capacity x200%'
  },
  {
    id: 'PB-DIV-SOFT',
    name: 'Soft Diversion',
    description: 'Reroute BLS ambulances to secondary sites. Maintain ALS/Stroke/Trauma.',
    triggerCondition: 'Wait Time > 4hrs',
    approverRole: 'Charge Nurse',
    steps: [
      { id: 'd1', description: 'Notify EMS Dispatch of Soft Divert', role: 'Charge Nurse', status: 'PENDING' },
      { id: 'd2', description: 'Update regional dashboard status', role: 'Admin', status: 'PENDING' }
    ],
    estimatedImpact: '-5 EMS Arrivals/hr'
  }
];

export const Playbooks: React.FC<PlaybooksProps> = ({ onActivate }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Operational Playbooks</h2>
        <p className="text-neutral-400 max-w-2xl">
          Pre-authorized clinical and operational protocols designed to mitigate capacity risk and ensure patient safety during surge events.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {library.map((pb) => (
           <div key={pb.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-neutral-600 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-neutral-800 rounded-lg text-neutral-300 group-hover:bg-neutral-700 transition-colors">
                    {pb.id.includes('SURGE') ? <ShieldAlert className="w-6 h-6 text-rose-400"/> : <FileText className="w-6 h-6"/>}
                 </div>
                 <span className="text-xs font-mono text-neutral-500 bg-black px-2 py-1 rounded-md">{pb.id}</span>
              </div>
              
              <h3 className="text-lg font-bold text-neutral-200 mb-2">{pb.name}</h3>
              <p className="text-sm text-neutral-400 mb-6 flex-1">{pb.description}</p>
              
              <div className="space-y-3 mb-4">
                 <div className="flex justify-between text-xs border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Trigger</span>
                    <span className="text-neutral-300 font-mono text-right">{pb.triggerCondition}</span>
                 </div>
                 <div className="flex justify-between text-xs border-b border-neutral-800 pb-2">
                    <span className="text-neutral-500">Impact</span>
                    <span className="text-emerald-400 font-mono text-right">{pb.estimatedImpact}</span>
                 </div>
              </div>

              <div className="mb-6">
                <button 
                  onClick={() => setExpandedId(expandedId === pb.id ? null : pb.id)}
                  className="flex items-center justify-between w-full text-xs font-bold text-neutral-500 hover:text-neutral-300 uppercase tracking-widest py-2"
                >
                  <span>View Protocol Steps ({pb.steps.length})</span>
                  {expandedId === pb.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {expandedId === pb.id && (
                  <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                    {pb.steps.map((step, idx) => (
                      <div key={step.id} className="flex gap-3 items-start p-2 bg-neutral-950 rounded-lg border border-neutral-800">
                        <div className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm text-neutral-300 leading-tight mb-1">{step.description}</p>
                          <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Owner: {step.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={onActivate}
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-bold rounded-lg flex items-center justify-center gap-2 group-hover:text-white transition-all duration-200 hover:scale-[1.02] mt-auto"
              >
                 ACTIVATE PROTOCOL <ArrowRight className="w-4 h-4"/>
              </button>
           </div>
        ))}
      </div>
    </div>
  );
};