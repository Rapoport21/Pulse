import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const GlobalTicker = ({ isSurgeActive }: { isSurgeActive: boolean }) => {
  return (
    <>
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee {
            display: inline-block;
            white-space: nowrap;
            animation: marquee 25s linear infinite;
          }
        `}
      </style>
      <div className={`w-full overflow-hidden whitespace-nowrap py-1.5 px-4 text-xs font-mono flex items-center border-b z-50 relative shrink-0 ${isSurgeActive ? 'bg-rose-600 text-white border-rose-700' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}`}>
        <AlertTriangle className="w-3 h-3 mr-2 inline-block animate-pulse shrink-0" />
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee">
            <span className="mx-4">[14:02] 🚑 Trauma Alert: ETA 5 mins (Bay 1)</span>
            <span className="mx-4">•</span>
            <span className="mx-4">[14:05] 🩸 Blood Bank: O- inventory critical (2 units remaining)</span>
            <span className="mx-4">•</span>
            <span className="mx-4">[14:12] 🛏️ ICU Step-down: 2 beds clean and ready</span>
            <span className="mx-4">•</span>
            <span className="mx-4">[14:15] ⚠️ ER Wait Time exceeding 45 mins</span>
          </div>
        </div>
      </div>
    </>
  );
};
