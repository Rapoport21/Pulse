import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, CheckCircle, AlertOctagon } from 'lucide-react';

export const ShiftHandoffModal = ({ type, role, onComplete, onCancel, loginCount = 1 }: { type: 'in' | 'out', role: string, onComplete: (notes?: string) => void, onCancel?: () => void, loginCount?: number }) => {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-800 bg-neutral-950">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {type === 'in' ? <ClipboardList className="text-blue-400" /> : <CheckCircle className="text-emerald-400" />}
            {type === 'in' ? 'Shift Briefing' : 'End of Shift Handoff'}
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Role: {role.replace('_', ' ')}</p>
        </div>
        
        <div className="p-6 space-y-6">
          {type === 'in' ? (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-300 uppercase">Critical Updates</h3>
                {loginCount > 1 ? (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-lg flex gap-3 text-sm text-emerald-200">
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
                    <p>Surge protocol successfully de-escalated. Capacity is stable. Monitor fast-track throughput.</p>
                  </div>
                ) : (
                  <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-lg flex gap-3 text-sm text-rose-200">
                    <AlertOctagon className="w-5 h-5 shrink-0 text-rose-500" />
                    <p>ER is currently holding 4 admitted patients. ICU capacity is at 95%. Expedite step-down transfers.</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-neutral-300 uppercase">Inherited Actions</h3>
                <ul className="list-disc pl-5 text-sm text-neutral-400 space-y-1">
                  <li>Review 3 pending discharge summaries.</li>
                  <li>Follow up on Blood Bank inventory.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-neutral-300 uppercase">Handoff Notes</h3>
              <p className="text-xs text-neutral-400">Leave a note for the incoming {role.replace('_', ' ')}.</p>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                placeholder="e.g., Follow up with Dr. Smith regarding Bed 4..."
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end gap-3">
          {onCancel && (
            <button 
              onClick={onCancel}
              className="px-6 py-2 text-neutral-400 hover:text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button 
            onClick={() => onComplete(type === 'out' ? note : undefined)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
          >
            {type === 'in' ? 'Acknowledge & Start Shift' : 'Submit & Logout'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
