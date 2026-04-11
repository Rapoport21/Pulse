import React, { useState, useEffect } from 'react';
import {
  Activity, ShieldAlert, LogOut, Menu, X, Bot,
  CheckCircle2, Users, AlertCircle, PhoneCall, Stethoscope,
  HeartPulse, Clock, QrCode, Search, MessageSquare, Flame,
  Circle, CheckCircle, LayoutDashboard, Bell, ChevronRight,
  Sparkles, TrendingUp, ArrowRight, MoreHorizontal, Fingerprint
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip, ReferenceLine } from 'recharts';
import { UserProfile, UserRole } from '../types';
import { ROLE_ACTIONS } from '../data/userProfiles';
import { PatientDetailScreen } from './PatientDetailScreen';
import { getDeviceId } from '../lib/realtime';
import type { UrgentTask } from '../lib/surgeTaskTemplates';

interface MobileViewProps {
  currentUser: UserProfile;
  isSurgeActive: boolean;
  surgeActivatedAt: number | null;
  urgentTasks: UrgentTask[];
  onAcknowledgeTask: (taskId: string, deviceId: string) => void;
  onActivateSurge: () => void;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenChat: (query?: string) => void;
}

const formatElapsed = (sinceMs: number | null, nowMs: number): string => {
  if (!sinceMs) return '0s';
  const diff = Math.max(0, nowMs - sinceMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const getHRStatus = (hr: string): 'normal' | 'warning' | 'critical' => {
  const val = parseInt(hr);
  if (val < 50 || val > 120) return 'critical';
  if (val < 60 || val > 100) return 'warning';
  return 'normal';
};

const getBPStatus = (bp: string): 'normal' | 'warning' | 'critical' => {
  const [sys, dia] = bp.split('/').map(Number);
  if (sys >= 160 || dia >= 100 || sys <= 80 || dia <= 50) return 'critical';
  if (sys >= 140 || dia >= 90 || sys <= 90 || dia <= 60) return 'warning';
  return 'normal';
};

const getO2Status = (o2: string): 'normal' | 'warning' | 'critical' => {
  const val = parseInt(o2);
  if (val < 90) return 'critical';
  if (val < 95) return 'warning';
  return 'normal';
};

const VitalBox = ({ label, value, unit, status = 'normal', trendData }: { label: string, value: string, unit: string, status?: 'normal' | 'warning' | 'critical', trendData: number[] }) => {
  const isCritical = status === 'critical';
  const isWarning = status === 'warning';
  
  let baseColor = 'text-white';
  let bgClass = 'bg-white/[0.04] border-white/[0.08]';
  let sparkColor = '#FFFFFF';
  let labelColor = 'text-white/50';
  let unitColor = 'text-white/40';

  if (isCritical) {
    bgClass = 'bg-rose-500/[0.08] border-rose-500/30 shadow-[inset_0_1px_0_0_rgba(225,29,72,0.2),0_4px_20px_rgba(225,29,72,0.15)]';
    baseColor = 'text-rose-500';
    sparkColor = '#FF453A';
    labelColor = 'text-rose-500/80';
    unitColor = 'text-rose-500/60';
  } else if (isWarning) {
    bgClass = 'bg-amber-500/[0.08] border-amber-500/30 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.2),0_4px_20px_rgba(245,158,11,0.15)]';
    baseColor = 'text-amber-500';
    sparkColor = '#FF9F0A';
    labelColor = 'text-amber-500/80';
    unitColor = 'text-amber-500/60';
  } else {
    if (label === 'HR') {
      bgClass = 'bg-[#FF2D55]/[0.04] border-[#FF2D55]/[0.08] shadow-[inset_0_1px_0_0_rgba(255,45,85,0.05)]';
      baseColor = 'text-[#FF2D55]';
      sparkColor = '#FF2D55';
      labelColor = 'text-[#FF2D55]/60';
      unitColor = 'text-[#FF2D55]/50';
    } else if (label === 'BP') {
      bgClass = 'bg-[#5E5CE6]/[0.04] border-[#5E5CE6]/[0.08] shadow-[inset_0_1px_0_0_rgba(94,92,230,0.05)]';
      baseColor = 'text-[#5E5CE6]';
      sparkColor = '#5E5CE6';
      labelColor = 'text-[#5E5CE6]/60';
      unitColor = 'text-[#5E5CE6]/50';
    } else if (label === 'SpO2') {
      bgClass = 'bg-[#32ADE6]/[0.04] border-[#32ADE6]/[0.08] shadow-[inset_0_1px_0_0_rgba(50,173,230,0.05)]';
      baseColor = 'text-[#32ADE6]';
      sparkColor = '#32ADE6';
      labelColor = 'text-[#32ADE6]/60';
      unitColor = 'text-[#32ADE6]/50';
    }
  }

  return (
    <div className={`relative flex flex-col p-3.5 rounded-[20px] border backdrop-blur-2xl backdrop-saturate-150 transition-all overflow-hidden ${bgClass}`}>
      <span className={`text-[11px] font-semibold tracking-wider uppercase relative z-10 ${labelColor}`}>{label}</span>
      <div className="flex items-baseline gap-1 mt-1 relative z-10">
        <span className={`text-[26px] font-bold tracking-tighter tabular-nums leading-none drop-shadow-sm ${baseColor}`}>{value}</span>
        <span className={`text-[11px] font-medium ${unitColor}`}>{unit}</span>
      </div>
    </div>
  );
};

// Ultra-High Fidelity Progress Ring with glowing head
const ProgressRing = ({ progress }: { progress: number }) => {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-[88px] h-[88px]">
      <svg className="w-full h-full transform -rotate-90 drop-shadow-lg">
        {/* Background Track */}
        <circle 
          cx="44" cy="44" r={radius} 
          stroke="currentColor" strokeWidth="7" fill="transparent" 
          className="text-white/[0.05]" 
        />
        {/* Progress Track */}
        <circle 
          cx="44" cy="44" r={radius} 
          stroke="currentColor" strokeWidth="7" fill="transparent" 
          strokeDasharray={circumference} strokeDashoffset={offset} 
          strokeLinecap="round" 
          className="text-[#32ADE6] transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] drop-shadow-[0_0_12px_rgba(50,173,230,0.6)]" 
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-bold text-white tabular-nums tracking-tighter leading-none drop-shadow-md">
          {Math.round(progress)}<span className="text-[12px] text-white/60 ml-0.5">%</span>
        </span>
      </div>
    </div>
  );
};

export const MobileView: React.FC<MobileViewProps> = ({
  currentUser,
  isSurgeActive,
  surgeActivatedAt,
  urgentTasks,
  onAcknowledgeTask,
  onActivateSurge,
  onLogout,
  showToast,
  onOpenChat
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'patients' | 'alerts' | 'comms'>('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<'all' | 'stat' | 'routine'>('all');
  const [time, setTime] = useState(new Date());
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const myDeviceId = getDeviceId();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allTasks = ROLE_ACTIONS[currentUser.role]?.filter(a => !completedTasks.includes(a.id)) || [];
  const myTasks = allTasks.filter(t => {
    if (taskFilter === 'stat') return t.priority === 'Critical' || t.priority === 'High';
    if (taskFilter === 'routine') return t.priority === 'Medium' || t.priority === 'Low';
    return true;
  });

  const progressPercent = (completedTasks.length / (ROLE_ACTIONS[currentUser.role]?.length || 1)) * 100;

  const getMyPatients = () => {
    if (currentUser.role === UserRole.ER_PERSONNEL) {
      return [
        { id: '1', name: 'Doe, John', age: '45M', mrn: 'MRN-8821', loc: 'Trauma 1', status: 'critical', code: 'FULL CODE', notes: 'MVA, awaiting CT. Intubated.', vitals: { hr: '135', bp: '85/50', o2: '92' }, trends: { hr: [80, 85, 90, 110, 125, 135], bp: [120, 115, 100, 90, 85, 85], o2: [98, 97, 95, 94, 92, 92] } },
        { id: '2', name: 'Smith, Jane', age: '62F', mrn: 'MRN-9912', loc: 'Bed 4', status: 'warning', code: 'DNR/DNI', notes: 'Chest pain, troponin pending. IV access established.', vitals: { hr: '98', bp: '145/90', o2: '96' }, trends: { hr: [75, 78, 85, 92, 95, 98], bp: [130, 135, 140, 142, 145, 145], o2: [99, 98, 98, 97, 96, 96] } },
        { id: '3', name: 'Fox, Robert', age: '28M', mrn: 'MRN-1102', loc: 'Bed 7', status: 'normal', code: 'FULL CODE', notes: 'Laceration repair complete. Awaiting discharge papers.', vitals: { hr: '72', bp: '120/80', o2: '99' }, trends: { hr: [70, 71, 72, 71, 72, 72], bp: [118, 120, 119, 121, 120, 120], o2: [98, 99, 99, 99, 99, 99] } }
      ];
    } else {
      return [
        { id: '4', name: 'Wong, Alice', age: '34F', mrn: 'MRN-3321', loc: 'Room 201', status: 'normal', code: 'FULL CODE', notes: 'Post-op appendectomy. Pain well managed.', vitals: { hr: '82', bp: '118/75', o2: '98' }, trends: { hr: [80, 81, 82, 82, 82, 82], bp: [120, 119, 118, 118, 118, 118], o2: [99, 98, 98, 98, 98, 98] } },
        { id: '5', name: 'Ruiz, Carlos', age: '71M', mrn: 'MRN-4415', loc: 'Room 202', status: 'warning', code: 'FULL CODE', notes: 'BP dropping, paging MD. Fluid bolus started.', vitals: { hr: '110', bp: '90/60', o2: '94' }, trends: { hr: [85, 90, 95, 100, 105, 110], bp: [110, 105, 100, 95, 92, 90], o2: [97, 96, 95, 95, 94, 94] } },
      ];
    }
  };

  const myPatients = getMyPatients();

  const chartData = [
    { time: 'Now', load: isSurgeActive ? 32 : 85 },
    { time: '+1h', load: isSurgeActive ? 30 : 92 },
    { time: '+2h', load: isSurgeActive ? 28 : 98 },
    { time: '+3h', load: isSurgeActive ? 25 : 105 },
    { time: '+4h', load: isSurgeActive ? 22 : 112 },
  ];
  const isSafe = chartData[4].load < 100;

  const mockAlerts = [
    { id: 1, title: 'Critical Lab Value', desc: 'Troponin elevated (2.4 ng/mL) for Smith, Jane. Protocol initiated.', time: 'Just now', unread: true, type: 'critical' },
    { id: 2, title: 'Patient Admission', desc: 'Level 1 Trauma arriving in 5 mins. ETA 14:35. Prepare Bay 1.', time: '2m ago', unread: true, type: 'warning' },
    { id: 3, title: 'Pharmacy Update', desc: 'Vanco shortage, use alternative protocols as per guidelines.', time: '1h ago', unread: false, type: 'info' },
  ];

  const handleCompleteTask = (id: string) => {
    setCompletedTasks(prev => [...prev, id]);
    showToast('Task marked complete', 'success');
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'tasks', icon: CheckCircle2, label: 'Actions' },
    { id: 'patients', icon: Users, label: currentUser.role === UserRole.MANAGER ? 'Units' : 'Patients' },
    { id: 'alerts', icon: Bell, label: 'Alerts' },
    { id: 'comms', icon: MessageSquare, label: 'Comms' },
  ] as const;

  return (
    <div 
      className="flex flex-col h-screen bg-[#000000] text-white overflow-hidden selection:bg-white/20 antialiased relative"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif' }}
    >
      {/* Ultra-Realistic Background Textures */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.04] via-black to-black pointer-events-none z-0"></div>
      {/* SVG Noise Texture for realism */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Surge Banner - Emergency Light Effect */}
      {isSurgeActive && (
        <div className="relative z-40 bg-rose-600/20 backdrop-blur-2xl backdrop-saturate-200 border-b border-rose-500/40 text-rose-500 px-4 py-3.5 text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_40px_rgba(225,29,72,0.3)] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/20 to-transparent w-[200%] animate-[shimmer_2s_infinite]"></div>
          <ShieldAlert className="w-4 h-4 animate-pulse relative z-10" />
          <span className="relative z-10 drop-shadow-[0_0_8px_rgba(225,29,72,0.8)]">SURGE PROTOCOL ACTIVE</span>
          {surgeActivatedAt && (
            <span className="relative z-10 text-rose-300/90 tabular-nums normal-case tracking-normal text-[11px] ml-2">
              · {formatElapsed(surgeActivatedAt, time.getTime())}
            </span>
          )}
        </div>
      )}

      {/* iOS Header (Ultra-Translucent Glass) */}
      <header className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0 z-30 bg-black/40 backdrop-blur-[50px] backdrop-saturate-[180%] border-b border-white/[0.08] sticky top-0 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3.5">
          <div className="relative group cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-gradient-to-b from-white/[0.15] to-white/[0.05] border border-white/[0.15] flex items-center justify-center text-[17px] font-bold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_4px_10px_rgba(0,0,0,0.3)] group-active:scale-95 transition-transform duration-300">
              {currentUser.avatarInitials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#34C759] border-[3px] border-black rounded-full shadow-[0_0_12px_rgba(52,199,89,0.8)]"></div>
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[18px] text-white leading-tight tracking-tight drop-shadow-sm">{currentUser.name}</h1>
              <div className="flex items-center gap-1 bg-white/[0.08] px-1.5 py-0.5 rounded-full border border-white/[0.05]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] animate-pulse shadow-[0_0_8px_#0A84FF]"></div>
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Sync</span>
              </div>
            </div>
            <div className="text-[13px] text-white/50 font-medium mt-0.5 tracking-wide">{currentUser.role.replace('_', ' ')}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => onOpenChat()} className="p-3 rounded-full bg-white/[0.08] border border-white/[0.05] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:bg-white/[0.12] active:scale-90 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
            <Sparkles className="w-5 h-5" />
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="p-3 rounded-full bg-white/[0.08] border border-white/[0.1] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:bg-white/[0.12] active:scale-90 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
            {showMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMenu && (
        <div className="absolute inset-0 top-[100px] bg-black/70 backdrop-blur-[50px] backdrop-saturate-[150%] z-50 flex flex-col p-6 animate-in fade-in duration-300">
          <div className="space-y-4 flex-1 mt-4">
            <button
              onClick={() => {
                if (!isSurgeActive) {
                  onActivateSurge();
                }
                setShowMenu(false);
              }}
              disabled={isSurgeActive}
              className={`w-full p-5 rounded-[24px] flex items-center gap-4 font-semibold text-left transition-all duration-300 active:scale-[0.96] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] ${
                isSurgeActive
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_8px_32px_rgba(225,29,72,0.3)] cursor-default'
                  : 'bg-white/[0.08] border border-white/[0.1] text-white'
              }`}
            >
              <ShieldAlert className={`w-7 h-7 ${isSurgeActive ? 'animate-pulse' : ''}`} />
              <div className="flex flex-col">
                <span className="text-[18px] font-bold">{isSurgeActive ? 'Surge Active' : 'Activate Surge'}</span>
                <span className="text-[13px] text-white/50 font-medium mt-0.5">
                  {isSurgeActive
                    ? `Running ${formatElapsed(surgeActivatedAt, time.getTime())}`
                    : 'Hospital-wide protocol'}
                </span>
              </div>
            </button>

            <button 
              onClick={() => { setShowMenu(false); showToast('Loading Performance Metrics...', 'info'); }}
              className="w-full p-5 rounded-[24px] flex items-center gap-4 font-semibold text-left transition-all duration-300 bg-white/[0.08] border border-white/[0.1] text-white active:scale-[0.96] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            >
              <Activity className="w-7 h-7 text-[#0A84FF]" />
              <div className="flex flex-col">
                <span className="text-[18px] font-bold">Performance Metrics</span>
                <span className="text-[13px] text-white/50 font-medium mt-0.5">View your shift data</span>
              </div>
            </button>
          </div>

          <button 
            onClick={onLogout}
            className="w-full p-5 rounded-[24px] bg-white/[0.08] border border-white/[0.1] text-[#FF453A] flex items-center justify-center gap-2 font-bold mt-auto active:scale-[0.96] transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
          >
            <LogOut className="w-6 h-6" /> Secure Sign Out
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
        
        {activeTab === 'dashboard' && (
          <div className="p-5 pb-40 space-y-7 animate-in fade-in slide-in-from-bottom-8">
            <div className="flex items-center justify-between mt-2 mb-2">
              <h1 className="text-[36px] font-bold text-white tracking-tighter leading-none">Overview</h1>
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white/40 bg-white/[0.05] px-3 py-1.5 rounded-full border border-white/[0.05]">
                <div className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse"></div> Live
              </div>
            </div>
            
            {/* The Brief - Apple Intelligence Style */}
            <div className="relative rounded-[28px] p-[1px] overflow-hidden group shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
               {/* Animated Conic Gradient Border */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250%] aspect-square opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                 <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0%,rgba(191,90,242,0.8)_25%,rgba(10,132,255,0.8)_50%,transparent_75%,transparent_100%)] animate-[spin_4s_linear_infinite]"></div>
               </div>
               
               <div className="relative bg-[#121214]/90 backdrop-blur-3xl rounded-[27px] p-6 h-full">
                 <h2 className="text-[17px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#BF5AF2] to-[#0A84FF] mb-3 flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-[#BF5AF2]" /> AI Shift Brief
                 </h2>
                 <p className="text-[16px] text-white/90 leading-relaxed font-medium tracking-wide">
                   {isSurgeActive
                     ? `Surge protocol active for ${formatElapsed(surgeActivatedAt, time.getTime())}. ${urgentTasks.filter(t => !t.acknowledgedBy).length} of ${urgentTasks.length} urgent tasks pending. ER capacity at 115%. Divert status recommended.`
                     : "Normal operations. ER wait time is 45m. ICU has 2 beds available. Staffing is optimal for current census."}
                 </p>
                 <div className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-white/30 uppercase tracking-widest">
                   <Clock className="w-3.5 h-3.5" /> Updated {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                 </div>
               </div>
            </div>

            {/* Quick Actions Scroll */}
            <div className="-mx-5 px-5">
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)]">
                <button onClick={() => showToast('Paging On-Call Physician...', 'info')} className="flex items-center gap-2.5 bg-white/[0.08] border border-white/[0.1] rounded-full px-5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] active:scale-95 transition-all snap-start shrink-0">
                  <PhoneCall className="w-4 h-4 text-[#32ADE6]" />
                  <span className="text-[15px] font-bold text-white">Page On-Call</span>
                </button>
                <button onClick={() => showToast('Code Blue Initiated!', 'error')} className="flex items-center gap-2.5 bg-white/[0.08] border border-white/[0.1] rounded-full px-5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] active:scale-95 transition-all snap-start shrink-0">
                  <Flame className="w-4 h-4 text-[#FF453A]" />
                  <span className="text-[15px] font-bold text-white">Code Blue</span>
                </button>
                <button onClick={() => showToast('Hospital Divert Status Requested', 'warning')} className="flex items-center gap-2.5 bg-white/[0.08] border border-white/[0.1] rounded-full px-5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] active:scale-95 transition-all snap-start shrink-0">
                  <ShieldAlert className="w-4 h-4 text-[#FF9F0A]" />
                  <span className="text-[15px] font-bold text-white">Divert Status</span>
                </button>
              </div>
            </div>

            {/* Live Ops */}
            <div>
              <h2 className="text-[14px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Live Ops
              </h2>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-[24px] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl relative overflow-hidden group flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[13px] font-semibold text-white/50 tracking-wide">ER Wait Time</div>
                    <div className="text-[#FF453A] flex items-center gap-1 text-[11px] font-bold bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20">
                      <TrendingUp className="w-3 h-3" /> 5m
                    </div>
                  </div>
                  <div className="text-[32px] font-bold tracking-tighter text-white tabular-nums leading-none">45<span className="text-[16px] text-white/40 ml-1 font-semibold">min</span></div>
                </div>
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-[24px] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[13px] font-semibold text-white/50 tracking-wide">Total Census</div>
                    <div className="text-[#34C759] flex items-center gap-1 text-[11px] font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                      <TrendingUp className="w-3 h-3 rotate-180" /> 12
                    </div>
                  </div>
                  <div className="text-[32px] font-bold tracking-tighter text-white tabular-nums leading-none">284<span className="text-[16px] text-white/40 ml-1 font-semibold">pts</span></div>
                </div>
                <div className={`rounded-[24px] p-5 backdrop-blur-xl transition-all duration-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] relative overflow-hidden flex flex-col justify-between ${isSurgeActive ? 'border border-rose-500/40 bg-rose-500/10 shadow-[0_4px_20px_rgba(225,29,72,0.15)]' : 'bg-white/[0.05] border border-white/[0.08]'}`}>
                  <div className="text-[13px] font-semibold text-white/50 mb-2 tracking-wide">Bed Capacity</div>
                  <div className={`text-[32px] font-bold tracking-tighter tabular-nums leading-none ${isSurgeActive ? 'text-[#FF453A] drop-shadow-[0_0_12px_rgba(255,69,58,0.6)]' : 'text-[#34C759]'}`}>
                    {isSurgeActive ? '98%' : '82%'}
                  </div>
                  {/* Mini capacity bar */}
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
                    <div className={`h-full ${isSurgeActive ? 'bg-[#FF453A] w-[98%]' : 'bg-[#34C759] w-[82%]'}`}></div>
                  </div>
                </div>
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-[24px] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="text-[13px] font-semibold text-white/50 mb-2 tracking-wide">Active Codes</div>
                  <div className="text-[32px] font-bold tracking-tighter text-white tabular-nums leading-none">1</div>
                  <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-[#0A84FF] rounded-full blur-2xl opacity-20"></div>
                </div>
              </div>
            </div>

            {/* Pulse Horizon Prediction */}
            <div>
              <h2 className="text-[14px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Pulse Horizon
              </h2>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-[28px] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <div className="text-[18px] font-bold text-white tracking-tight">Predicted Census</div>
                    <div className="text-[14px] font-medium text-white/50 mt-1">Next 4 hours</div>
                  </div>
                  <div className="text-[15px] font-bold text-[#FF9F0A] flex items-center gap-1.5 bg-[#FF9F0A]/15 px-3 py-1.5 rounded-xl border border-[#FF9F0A]/30 shadow-[0_0_15px_rgba(255,159,10,0.2)]">
                    <TrendingUp className="w-4 h-4" /> +12%
                  </div>
                </div>
                {/* Real Chart */}
                <div className="h-40 w-full relative -ml-2 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLoadMobile" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isSafe ? "#34C759" : "#FF453A"} stopOpacity={0.5}/>
                          <stop offset="95%" stopColor={isSafe ? "#34C759" : "#FF453A"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" tick={{fontSize: 12, fontWeight: 600}} axisLine={false} tickLine={false} dy={12} />
                      <YAxis hide domain={[0, 120]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(28,28,30,0.85)', backdropFilter: 'blur(20px)', saturate: '150%', borderColor: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: '16px', fontSize: '14px', fontWeight: 700, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`${value}%`, 'Saturation']}
                        cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 2, strokeDasharray: '4 4' }}
                      />
                      <ReferenceLine y={100} stroke="#FF453A" strokeDasharray="4 4" opacity={0.8} strokeWidth={2} />
                      <Area 
                        type="monotone" 
                        dataKey="load" 
                        stroke={isSafe ? "#34C759" : "#FF453A"} 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorLoadMobile)" 
                        style={{ filter: `drop-shadow(0 8px 16px ${isSafe ? 'rgba(52,199,89,0.4)' : 'rgba(255,69,58,0.4)'})` }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="p-5 pb-40 space-y-6 animate-in fade-in slide-in-from-bottom-8">
            <h1 className="text-[36px] font-bold text-white tracking-tighter mt-2">Actions</h1>

            {/* Urgent Surge Tasks (Live Sync) */}
            {isSurgeActive && urgentTasks.length > 0 && (
              <div className="bg-rose-500/[0.08] border border-rose-500/30 rounded-[28px] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(225,29,72,0.2)] backdrop-blur-2xl">
                <div className="px-6 py-4 border-b border-rose-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse drop-shadow-[0_0_8px_rgba(225,29,72,0.8)]" />
                    <div>
                      <h2 className="text-[15px] font-bold text-rose-400 uppercase tracking-widest leading-none">Surge Tasks</h2>
                      <div className="text-[11px] text-rose-500/60 font-semibold mt-1">
                        {urgentTasks.filter(t => t.acknowledgedBy).length} / {urgentTasks.length} acknowledged
                      </div>
                    </div>
                  </div>
                  {surgeActivatedAt && (
                    <span className="text-[12px] font-bold text-rose-500/80 tabular-nums bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                      {formatElapsed(surgeActivatedAt, time.getTime())}
                    </span>
                  )}
                </div>
                {urgentTasks.map((task, i) => {
                  const acked = !!task.acknowledgedBy;
                  const ackedByMe = task.acknowledgedBy === myDeviceId;
                  return (
                    <button
                      key={task.id}
                      onClick={() => {
                        if (!acked) {
                          onAcknowledgeTask(task.id, myDeviceId);
                          showToast('Task acknowledged', 'success');
                        }
                      }}
                      disabled={acked}
                      className={`w-full text-left p-5 flex gap-4 transition-all duration-300 active:bg-white/[0.05] ${
                        i !== urgentTasks.length - 1 ? 'border-b border-rose-500/10' : ''
                      } ${acked ? 'opacity-60' : 'active:scale-[0.99]'}`}
                    >
                      <div className="mt-1 shrink-0">
                        {acked ? (
                          <CheckCircle className="w-7 h-7 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                        ) : (
                          <Circle className="w-7 h-7 text-rose-500/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            task.priority === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {task.priority}
                          </span>
                          {task.role && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                              {task.role}
                            </span>
                          )}
                        </div>
                        <h3 className={`text-[16px] font-bold leading-snug tracking-tight ${acked ? 'text-white/60 line-through decoration-emerald-400/40' : 'text-white'}`}>
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-[13px] text-white/50 mt-1.5 leading-relaxed font-medium">{task.description}</p>
                        )}
                        {acked && (
                          <div className="mt-2 text-[11px] font-semibold text-emerald-400/80 flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3" />
                            Ack {ackedByMe ? 'by you' : `by ${task.acknowledgedBy?.slice(0, 6)}…`}
                            {task.acknowledgedAt && ` · ${formatElapsed(task.acknowledgedAt, time.getTime())} ago`}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Shift Progress Widget */}
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-[28px] p-7 flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl mb-2">
              <div>
                <div className="text-[15px] font-bold text-white/50 mb-1 uppercase tracking-widest">Shift Progress</div>
                <div className="text-[42px] font-bold tracking-tighter text-white tabular-nums leading-none mt-2 drop-shadow-md">
                  {completedTasks.length} <span className="text-[24px] text-white/40 font-semibold">/ {ROLE_ACTIONS[currentUser.role]?.length || 0}</span>
                </div>
              </div>
              <ProgressRing progress={progressPercent} />
            </div>

            {/* iOS Segmented Control */}
            <div className="flex p-1.5 bg-white/[0.08] rounded-[16px] border border-white/[0.05] shadow-inner backdrop-blur-xl">
              {(['all', 'stat', 'routine'] as const).map(filter => (
                <button 
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`flex-1 py-2.5 rounded-[12px] text-[15px] font-bold capitalize transition-all duration-300 ${
                    taskFilter === filter 
                      ? 'bg-white/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/[0.08]' 
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {filter === 'stat' ? 'Stat' : filter}
                </button>
              ))}
            </div>

            {/* iOS Grouped Task List */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-[28px] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              {myTasks.length === 0 ? (
                <div className="text-center text-white/40 py-24 flex flex-col items-center gap-5">
                  <div className="w-20 h-20 rounded-full bg-white/[0.05] border border-white/[0.05] flex items-center justify-center shadow-inner">
                    <CheckCircle className="w-10 h-10 text-[#34C759] drop-shadow-[0_0_12px_rgba(52,199,89,0.5)]" />
                  </div>
                  <p className="text-[18px] font-bold tracking-tight">Queue clear. Great job.</p>
                </div>
              ) : (
                myTasks.map((task, i) => (
                  <div key={task.id} className={`group p-6 flex gap-4 transition-all duration-300 active:bg-white/[0.08] ${i !== myTasks.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                    
                    {/* Checkbox */}
                    <button 
                      onClick={() => handleCompleteTask(task.id)}
                      className="mt-1 text-white/20 hover:text-[#34C759] active:scale-90 transition-all duration-300 shrink-0"
                    >
                      <Circle className="w-7 h-7" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[13px] text-white/40 font-bold uppercase tracking-widest">{task.id.split('-')[0]}</span>
                        
                        {/* Priority Dot with Glow */}
                        <div className="flex items-center gap-2 bg-white/[0.08] px-2.5 py-1 rounded-lg text-[12px] font-bold text-white/90 border border-white/[0.05] shadow-sm">
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'Critical' ? 'bg-[#FF453A] shadow-[0_0_12px_#FF453A]' :
                            task.priority === 'High' ? 'bg-[#FF9F0A] shadow-[0_0_12px_#FF9F0A]' : 
                            'bg-[#32ADE6] shadow-[0_0_12px_#32ADE6]'
                          }`} />
                          {task.priority}
                        </div>
                      </div>
                      
                      <h3 className="text-[18px] font-bold text-white leading-snug tracking-tight">{task.title}</h3>
                      <p className="text-[15px] text-white/60 mt-2 line-clamp-2 leading-relaxed font-medium">{task.description}</p>
                    </div>

                    <div className="flex flex-col items-end justify-between shrink-0">
                      <span className="text-[14px] font-semibold text-white/40 tabular-nums">{task.time}</span>
                      <ChevronRight className="w-5 h-5 text-white/20 mb-1" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'patients' && (
          <div className="p-5 pb-40 space-y-6 animate-in fade-in slide-in-from-bottom-8">
            <h1 className="text-[36px] font-bold text-white tracking-tighter mt-2">
              {currentUser.role === UserRole.MANAGER ? 'Units' : 'Patients'}
            </h1>

            <div className="relative group">
              <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-white/80 transition-colors duration-300" />
              <input 
                type="text" 
                placeholder="Search MRN or Name" 
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-[20px] pl-14 pr-5 py-4 text-[18px] font-medium text-white focus:outline-none focus:bg-white/[0.1] focus:border-white/[0.15] transition-all duration-300 placeholder:text-white/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
              />
              <Fingerprint className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-[#0A84FF] opacity-80" />
            </div>

            <div className="space-y-5">
              {myPatients.map(patient => (
                <div 
                  key={patient.id} 
                  onClick={() => setSelectedPatient(patient)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-[32px] p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl active:scale-[0.98] transition-all duration-300 relative overflow-hidden cursor-pointer group"
                >
                  {/* Subtle gradient for critical patients */}
                  {patient.status === 'critical' && (
                    <div className="absolute inset-0 bg-gradient-to-b from-rose-500/15 to-transparent pointer-events-none"></div>
                  )}
                  
                  {/* Top Bento Box */}
                  <div className="bg-white/[0.03] rounded-[24px] p-5 mb-2 border border-white/[0.05] shadow-inner group-hover:bg-white/[0.06] transition-colors">
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <h3 className="font-bold text-white text-[24px] flex items-center gap-2 tracking-tight drop-shadow-sm">
                          {patient.name}
                          {patient.status === 'critical' && <Flame className="w-6 h-6 text-[#FF453A] drop-shadow-[0_0_15px_rgba(255,69,58,0.8)]" />}
                        </h3>
                        <div className="text-[15px] text-white/50 mt-1 flex items-center gap-2 font-semibold tracking-wide">
                          <span>{patient.mrn}</span>
                          <span className="text-white/20">•</span>
                          <span>{patient.age}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2.5">
                        <span className="text-[14px] font-bold text-white bg-white/[0.1] border border-white/[0.08] px-3.5 py-1.5 rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
                          {patient.loc}
                        </span>
                        <span className={`text-[12px] font-bold px-3 py-1 rounded-lg tracking-wider ${
                          patient.code.includes('DNR') ? 'text-[#BF5AF2] bg-[#BF5AF2]/15 border border-[#BF5AF2]/30' : 'text-white/40 bg-white/[0.05] border border-white/[0.05]'
                        }`}>
                          {patient.code}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Middle Bento Box: Notes */}
                  <div className="bg-black/40 rounded-[24px] p-5 mb-2 border border-white/[0.05] shadow-inner relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <Stethoscope className="w-4 h-4 text-white/40" />
                      <span className="text-[12px] font-bold text-white/40 uppercase tracking-widest">Clinical Notes</span>
                    </div>
                    <p className="text-[16px] text-white/80 leading-relaxed font-medium">
                      {patient.notes}
                    </p>
                  </div>

                  {/* Bottom Bento Box: Vitals */}
                  <div className="grid grid-cols-3 gap-2 relative z-10">
                    <VitalBox label="HR" value={patient.vitals.hr} unit="bpm" status={getHRStatus(patient.vitals.hr)} trendData={patient.trends.hr} />
                    <VitalBox label="BP" value={patient.vitals.bp} unit="mmHg" status={getBPStatus(patient.vitals.bp)} trendData={patient.trends.bp} />
                    <VitalBox label="SpO2" value={patient.vitals.o2} unit="%" status={getO2Status(patient.vitals.o2)} trendData={patient.trends.o2} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="p-5 pb-40 space-y-6 animate-in fade-in slide-in-from-bottom-8">
            <h1 className="text-[36px] font-bold text-white tracking-tighter mt-2">Alerts</h1>
            
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-[28px] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
              {mockAlerts.map((alert, i) => (
                <div key={alert.id} className={`p-6 flex gap-5 active:bg-white/[0.08] transition-all duration-300 ${i !== mockAlerts.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
                  <div className="mt-1">
                    {alert.type === 'critical' ? (
                      <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                        <Flame className="w-6 h-6 text-[#FF453A] drop-shadow-[0_0_12px_rgba(255,69,58,0.8)]" />
                      </div>
                    ) : alert.type === 'warning' ? (
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                        <AlertCircle className="w-6 h-6 text-[#FF9F0A] drop-shadow-[0_0_12px_rgba(255,159,10,0.8)]" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                        <Activity className="w-6 h-6 text-[#32ADE6] drop-shadow-[0_0_12px_rgba(50,173,230,0.8)]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className={`text-[18px] tracking-tight ${alert.unread ? 'font-bold text-white drop-shadow-sm' : 'font-semibold text-white/60'}`}>{alert.title}</h3>
                      <span className="text-[13px] text-white/40 font-semibold tabular-nums">{alert.time}</span>
                    </div>
                    <p className={`text-[16px] leading-relaxed font-medium ${alert.unread ? 'text-white/80' : 'text-white/50'}`}>{alert.desc}</p>
                  </div>
                  {alert.unread && <div className="w-3 h-3 bg-[#0A84FF] rounded-full self-center shadow-[0_0_12px_rgba(10,132,255,0.8)] border-[2px] border-black"></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'comms' && (
          <div className="p-5 pb-40 space-y-8 animate-in fade-in slide-in-from-bottom-8">
             <h1 className="text-[36px] font-bold text-white tracking-tighter mt-2">Comms</h1>
             
             {/* Secure Chat Threads */}
             <div>
               <h2 className="text-[14px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1">Active Threads</h2>
               <div className="bg-white/[0.04] border border-white/[0.08] rounded-[28px] overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
                 <div className="p-5 flex items-center gap-4 active:bg-white/[0.08] transition-all duration-300 border-b border-white/[0.05]">
                   <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-[#FF453A] shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                     <AlertCircle className="w-7 h-7" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-center mb-1.5">
                       <span className="text-[18px] font-bold text-white truncate tracking-tight">Trauma Team Alpha</span>
                       <span className="text-[14px] text-white/40 font-semibold tabular-nums">2m</span>
                     </div>
                     <p className="text-[16px] text-white/70 truncate font-medium">Dr. Jenkins: Patient stabilized, moving to CT.</p>
                   </div>
                   <div className="w-3 h-3 bg-[#FF453A] rounded-full shadow-[0_0_12px_rgba(255,69,58,0.8)] border-[2px] border-black mr-2"></div>
                 </div>

                 <div className="p-5 flex items-center gap-4 active:bg-white/[0.08] transition-all duration-300">
                   <div className="w-14 h-14 rounded-full bg-white/[0.1] border border-white/[0.1] flex items-center justify-center text-white shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                     <Stethoscope className="w-7 h-7" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-center mb-1.5">
                       <span className="text-[18px] font-bold text-white/80 truncate tracking-tight">Pharmacy Consults</span>
                       <span className="text-[14px] text-white/40 font-semibold tabular-nums">15m</span>
                     </div>
                     <p className="text-[16px] text-white/50 truncate font-medium">Pharm: Vanco trough is 14.2, dose is good.</p>
                   </div>
                   <ChevronRight className="w-6 h-6 text-white/30 mr-1" />
                 </div>
               </div>
             </div>

             {/* Quick Paging */}
             <div>
               <h2 className="text-[14px] font-bold text-white/40 uppercase tracking-widest mb-3 ml-1">Quick Page</h2>
               <div className="grid grid-cols-4 gap-3.5">
                  {[
                    { icon: Stethoscope, label: 'Charge' },
                    { icon: Activity, label: 'Pharm' },
                    { icon: HeartPulse, label: 'Blood' },
                    { icon: ShieldAlert, label: 'Security' },
                  ].map((btn, i) => (
                    <button key={i} className="flex flex-col items-center gap-3 group active:scale-95 transition-all duration-300">
                      <div className="w-full aspect-square rounded-[24px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#0A84FF] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] group-active:bg-white/[0.12] transition-colors backdrop-blur-xl">
                        <btn.icon className="w-8 h-8 drop-shadow-sm" />
                      </div>
                      <span className="text-[14px] font-semibold text-white/60">{btn.label}</span>
                    </button>
                  ))}
               </div>
             </div>

             <div className="pt-4">
                <button onClick={() => showToast('Emergency broadcast sent to all units', 'error')} className="w-full bg-rose-500/20 border border-rose-500/30 text-[#FF453A] rounded-[24px] p-5 text-[18px] font-bold flex items-center justify-center gap-3 active:scale-[0.97] transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_8px_32px_rgba(225,29,72,0.25)] hover:bg-rose-500/30">
                   <PhoneCall className="w-6 h-6" /> Broadcast Emergency
                </button>
             </div>
          </div>
        )}
      </main>
      
      {/* Ultra-High Fidelity iOS Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur-[50px] backdrop-saturate-[180%] border-t border-white/[0.1] pb-8 pt-3 px-2 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {navItems.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center gap-1.5 p-1 w-[72px] transition-all duration-300 active:scale-90 ${activeTab === item.id ? 'text-[#0A84FF]' : 'text-white/40 hover:text-white/60'}`}
            >
              <div className="relative">
                <item.icon className={`w-7 h-7 transition-all duration-300 ${activeTab === item.id ? 'scale-110 drop-shadow-[0_0_16px_rgba(10,132,255,0.8)]' : ''}`} />
                {/* Notification Badges */}
                {item.id === 'tasks' && myTasks.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF453A] rounded-full shadow-[0_0_12px_rgba(255,69,58,0.9)] border-[2.5px] border-black"></span>}
                {item.id === 'alerts' && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#32ADE6] rounded-full shadow-[0_0_12px_rgba(50,173,230,0.9)] border-[2.5px] border-black"></span>}
              </div>
              <span className="text-[11px] font-bold mt-0.5 tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Full Screen Patient Detail Overlay */}
      {selectedPatient && (
        <PatientDetailScreen 
          patient={selectedPatient} 
          onClose={() => setSelectedPatient(null)} 
          onSave={() => showToast('Patient record updated', 'success')}
          showToast={showToast}
        />
      )}
    </div>
  );
};
