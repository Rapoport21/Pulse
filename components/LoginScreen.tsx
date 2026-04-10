import React from 'react';
import { UserRole } from '../types';
import { USERS } from '../data/userProfiles';
import { Activity, Stethoscope, Siren, ArrowRight, ShieldCheck, Fingerprint } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0A84FF]/15 via-black to-black opacity-60"></div>
      
      {/* iOS-style Noise Overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>

      <div className="z-10 text-center mb-8 flex flex-col items-center mt-[-5vh]">
        <div className="w-16 h-16 bg-white/[0.08] border border-white/[0.1] rounded-[20px] flex items-center justify-center mb-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
          <Activity className="w-8 h-8 text-[#0A84FF]" />
        </div>
        <h1 className="text-[36px] font-bold tracking-tighter text-white leading-none mb-1">PULSE</h1>
        <p className="text-white/40 font-medium tracking-widest text-[11px] uppercase">Secure Access</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm px-6 z-10">
        
        {/* Manager Card */}
        <button 
          onClick={() => onLogin(UserRole.MANAGER)}
          className="group relative bg-white/[0.04] border border-white/[0.08] p-4 rounded-[24px] text-left transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-[16px] bg-[#FF453A]/10 border border-[#FF453A]/20 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-[#FF453A]" />
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-white mb-0.5">{USERS[UserRole.MANAGER].title}</h3>
            <p className="text-white/50 text-[12px] font-medium leading-tight line-clamp-2">Hospital-wide situational awareness & capacity.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
        </button>

        {/* Nurse Card */}
        <button 
          onClick={() => onLogin(UserRole.NURSE)}
          className="group relative bg-white/[0.04] border border-white/[0.08] p-4 rounded-[24px] text-left transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-[16px] bg-[#34C759]/10 border border-[#34C759]/20 flex items-center justify-center shrink-0">
            <Stethoscope className="w-6 h-6 text-[#34C759]" />
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-white mb-0.5">{USERS[UserRole.NURSE].title}</h3>
            <p className="text-white/50 text-[12px] font-medium leading-tight line-clamp-2">Patient-centric view, vitals, and care coordination.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
        </button>

        {/* ER Card */}
        <button 
          onClick={() => onLogin(UserRole.ER_PERSONNEL)}
          className="group relative bg-white/[0.04] border border-white/[0.08] p-4 rounded-[24px] text-left transition-all duration-300 hover:bg-white/[0.08] active:scale-[0.98] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-[16px] bg-[#0A84FF]/10 border border-[#0A84FF]/20 flex items-center justify-center shrink-0">
            <Siren className="w-6 h-6 text-[#0A84FF]" />
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-white mb-0.5">{USERS[UserRole.ER_PERSONNEL].title}</h3>
            <p className="text-white/50 text-[12px] font-medium leading-tight line-clamp-2">Trauma bay management and rapid response.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/60 transition-colors shrink-0" />
        </button>

      </div>
    </div>
  );
};
