import React, { useState } from 'react';
import { ShieldAlert, UserCheck, Clock, CheckSquare, ArrowRight, X } from 'lucide-react';
import { Playbook } from '../types';

interface PlaybookActivationProps {
  onClose: () => void;
  onConfirm: () => void;
}

const mockPlaybook: Playbook = {
  id: 'PB-SURGE-L2',
  name: 'Level 2 Surge Protocol',
  description: 'Rapid decompression of ED via hallway boarding and fast-track expansion.',
  triggerCondition: 'NEDOCS > 100 for 60 mins OR > 5 ICU Holds',
  approverRole: 'Medical Director / Nursing Super',
  steps: [
    { id: '1', description: 'Notify House Supervisor of Capacity Constraint', role: 'Charge Nurse', status: 'pending' },
    { id: '2', description: 'Suspend Elective Admissions', role: 'Medical Director', status: 'pending' },
    { id: '3', description: 'Activate Fast-Track Area B', role: 'Operations Manager', status: 'pending' },
    { id: '4', description: 'Broadcast "Code Purple" to staff', role: 'Communications', status: 'pending' }
  ],
  estimatedImpact: '-15% Saturation in 60m'
};

export const PlaybookActivation: React.FC<PlaybookActivationProps> = ({ onClose, onConfirm }) => {
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [approverName, setApproverName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleStep = (index: number) => {
    if (checkedSteps.includes(index)) {
      setCheckedSteps(checkedSteps.filter(i => i !== index));
    } else {
      setCheckedSteps([...checkedSteps, index]);
    }
  };

  const handleActivate = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onConfirm();
    }, 1500);
  };

  const allChecked = checkedSteps.length === mockPlaybook.steps.length;
  const canActivate = allChecked && approverName.length > 2;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex justify-between items-start bg-rose-950/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 text-rose-500 rounded border border-rose-500/30">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">ACTIVATE PLAYBOOK</h2>
              <p className="text-rose-400 font-mono text-sm mt-1">{mockPlaybook.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* Rationale Section */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-black p-4 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Trigger Condition</p>
                <p className="text-sm text-neutral-200 font-mono">{mockPlaybook.triggerCondition}</p>
             </div>
             <div className="bg-black p-4 rounded border border-neutral-800">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Required Approver</p>
                <p className="text-sm text-neutral-200 flex items-center gap-2">
                   <UserCheck className="w-4 h-4 text-blue-400" />
                   {mockPlaybook.approverRole}
                </p>
             </div>
          </div>

          {/* Checklist */}
          <div>
            <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> Immediate Actions Required
            </h3>
            <div className="space-y-3">
              {mockPlaybook.steps.map((step, idx) => (
                <label 
                  key={idx} 
                  className={`flex items-center gap-4 p-4 rounded border cursor-pointer transition-all ${
                    checkedSteps.includes(idx) 
                      ? 'bg-emerald-950/20 border-emerald-500/30' 
                      : 'bg-neutral-800/50 border-neutral-700 hover:bg-neutral-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                    checkedSteps.includes(idx) ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'
                  }`}>
                    {checkedSteps.includes(idx) && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={checkedSteps.includes(idx)} 
                    onChange={() => toggleStep(idx)} 
                  />
                  <span className={`text-sm ${checkedSteps.includes(idx) ? 'text-emerald-100' : 'text-neutral-300'}`}>
                    {step.description}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Digital Signature */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
              Authorized By (Digital Signature)
            </label>
            <input 
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="Enter your full name and credentials..."
              className="w-full bg-black border border-neutral-700 rounded p-3 text-white focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-800 flex items-center justify-between bg-neutral-900">
           <div className="flex items-center gap-2 text-neutral-500 text-xs font-mono">
              <Clock className="w-3 h-3" />
              <span>Review Time: 02:14</span>
           </div>
           <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="px-6 py-2 rounded text-neutral-400 hover:text-white font-medium text-sm"
              >
                Cancel
              </button>
              <button 
                disabled={!canActivate || isSubmitting}
                onClick={handleActivate}
                className={`px-8 py-2 rounded font-bold text-sm flex items-center gap-2 transition-all ${
                   canActivate && !isSubmitting
                   ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/40' 
                   : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'INITIALIZING...' : (
                  <>
                    CONFIRM ACTIVATION <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};