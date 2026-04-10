import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Database, Cpu, Network } from 'lucide-react';

export const LoadingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('INITIALIZING SECURE LINK...');

  useEffect(() => {
    const steps = [
      { p: 15, s: 'ESTABLISHING EHR CONNECTION...' },
      { p: 35, s: 'SYNCING REGIONAL NETWORK DATA...' },
      { p: 60, s: 'LOADING PREDICTIVE MODELS...' },
      { p: 85, s: 'CALIBRATING SURGE THRESHOLDS...' },
      { p: 100, s: 'SYSTEM READY.' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].p);
        setStatus(steps[currentStep].s);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 400);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 font-mono text-cyan-500">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Radar / Pulse Animation */}
        <div className="relative w-32 h-32 mb-12 flex items-center justify-center">
          <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
          <div className="absolute inset-4 border border-cyan-500/50 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
          <div className="absolute inset-8 border border-cyan-500/80 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }}></div>
          <Activity className="w-12 h-12 text-cyan-400 relative z-10 animate-pulse" />
        </div>

        {/* Status Text */}
        <div className="text-center mb-8 h-8">
          <p className="text-sm tracking-[0.2em] font-bold text-cyan-400 animate-pulse">{status}</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden mb-8 relative">
          <div 
            className="h-full bg-cyan-500 transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/50"></div>
          </div>
        </div>

        {/* System Checks */}
        <div className="w-full grid grid-cols-2 gap-4 text-[10px] tracking-widest text-neutral-500">
          <div className="flex items-center gap-2">
            <Database className={`w-3 h-3 ${progress >= 15 ? 'text-cyan-500' : ''}`} />
            <span className={progress >= 15 ? 'text-cyan-400' : ''}>EHR LINK</span>
          </div>
          <div className="flex items-center gap-2">
            <Network className={`w-3 h-3 ${progress >= 35 ? 'text-cyan-500' : ''}`} />
            <span className={progress >= 35 ? 'text-cyan-400' : ''}>REGIONAL</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className={`w-3 h-3 ${progress >= 60 ? 'text-cyan-500' : ''}`} />
            <span className={progress >= 60 ? 'text-cyan-400' : ''}>AI MODELS</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldAlert className={`w-3 h-3 ${progress >= 85 ? 'text-cyan-500' : ''}`} />
            <span className={progress >= 85 ? 'text-cyan-400' : ''}>PROTOCOLS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
