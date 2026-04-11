import React, { useState, useEffect, useMemo } from 'react';
import { Activity, BookOpen, Layout, PlayCircle, Radio, Archive, CloudRain, AlertOctagon, Signal, Bell, X, Users, MessageSquare, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { Tab, UserRole, UserProfile } from './types';
import { USERS } from './data/userProfiles';
import { PulseHorizon } from './components/PulseHorizon';
import { ActionBoard } from './components/ActionBoard';
import { PlaybookActivation } from './components/PlaybookActivation';
import { BriefMe } from './components/BriefMe';
import { Replay } from './components/Replay';
import { LiveOps } from './components/LiveOps';
import { Playbooks } from './components/Playbooks';
import { Roster } from './components/Roster';
import { ChatAssistant } from './components/ChatAssistant';
import { LoginScreen } from './components/LoginScreen';
import { CommandSidebar } from './components/CommandSidebar';
import { ShiftHandoffModal } from './components/ShiftHandoffModal';
import { MobileView } from './components/MobileView';
import { DebugPanel, ConnectionIndicator } from './components/DebugPanel';
import { useRealtimeState, useRealtimePing, subscribe } from './lib/realtime';
import {
  buildInitialUrgentTasks,
  INITIAL_SURGE_STATE,
  SurgeModeState,
  UrgentTask,
} from './lib/surgeTaskTemplates';
import { fireSurgeNotification, installFirstClickPermissionListener } from './lib/notifications';
import { installGlobalHapticListener } from './lib/haptics';

function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HORIZON);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);

  // Surge mode and urgent tasks live in the realtime store so all connected
  // devices stay in sync. Once activated, surge stays active for the session.
  const [surgeState, setSurgeState] = useRealtimeState<SurgeModeState>(
    'surge-mode',
    INITIAL_SURGE_STATE,
  );
  const [urgentTasks, setUrgentTasks] = useRealtimeState<UrgentTask[]>(
    'urgent-tasks',
    [],
  );
  const isSurgeActive = surgeState.active;

  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatQuery, setChatQuery] = useState('');
  const [systemStatus, setSystemStatus] = useState<'normal' | 'stale' | 'manual'>('normal');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [loginCount, setLoginCount] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Toast System
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  // Handover System
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showShiftBriefing, setShowShiftBriefing] = useState(false);
  const [globalHandoverNotes, setGlobalHandoverNotes] = useState<{ author: string, notes: string } | null>(null);

  // Fire surge ping (one-shot fire-and-forget). On the receiving side we hook
  // into it via useEffect below to fire the browser notification.
  const sendSurgePing = useRealtimePing<{ taskCount: number }>('surge-activated');

  // Debug mode is enabled via ?debug=1
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // First-click permission for browser notifications.
  useEffect(() => {
    return installFirstClickPermissionListener();
  }, []);

  // Global haptic tap on every button/selection click (native + web).
  useEffect(() => {
    return installGlobalHapticListener();
  }, []);

  // Listen for surge-activated pings from OTHER devices and fire the
  // notification + vibration flourish here.
  useEffect(() => {
    return subscribe<{ taskCount: number }>('surge-activated', (payload) => {
      const count = payload?.taskCount ?? 0;
      const outcome = fireSurgeNotification(count);
      if (outcome !== 'granted') {
        setToast({ message: `🚨 SURGE MODE ACTIVATED — ${count} urgent tasks`, type: 'error' });
      }
    });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 2000);
    
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const navItems = [
    { id: Tab.HORIZON, icon: Activity, label: 'Horizon' },
    { id: Tab.LIVE_OPS, icon: Radio, label: 'Live Ops' },
    { id: Tab.PLAYBOOKS, icon: BookOpen, label: 'Playbooks' },
    { id: Tab.ACTIONS, icon: Layout, label: 'Actions' },
    { id: Tab.ROSTER, icon: Users, label: 'Roster' },
    { id: Tab.BRIEF_ME, icon: Archive, label: 'Brief Me' },
    { id: Tab.REPLAY, icon: PlayCircle, label: 'Replay' },
  ];

  const notifications = [
    ...(globalHandoverNotes ? [{
      id: 'handover',
      title: 'Shift Handover Notes',
      message: `From ${globalHandoverNotes.author}: ${globalHandoverNotes.notes}`,
      time: 'Just now',
      type: 'info',
      isHandover: true
    }] : []),
    { id: 1, title: 'High Wait Time', message: 'Waiting room exceeds 2 hours.', time: '5m ago', type: 'warning' },
    { id: 2, title: 'Staffing Shortage', message: 'ICU missing 1 RN for next shift.', time: '12m ago', type: 'critical' },
    { id: 3, title: 'EMS Divert', message: 'St. Mary Level 1 is now on divert.', time: '1h ago', type: 'info' },
  ];

  const handleActivatePlaybook = () => {
    setShowPlaybookModal(true);
  };

  // One-way: activates surge mode, populates urgent tasks, fires the ping.
  // Idempotent — calling again is a no-op since surge is session-permanent.
  const activateSurge = () => {
    if (surgeState.active) return;
    const tasks = buildInitialUrgentTasks();
    setSurgeState({ active: true, activatedAt: Date.now() });
    setUrgentTasks(tasks);
    sendSurgePing({ taskCount: tasks.length });
    showToast('Surge Mode Activated', 'error');
  };

  const handleConfirmPlaybook = () => {
    setShowPlaybookModal(false);
    activateSurge();
    if (activeTab !== Tab.HORIZON) {
       setActiveTab(Tab.HORIZON);
    }
  };

  // Nurses tap a task to acknowledge — the realtime store sync propagates
  // back to admin automatically.
  const acknowledgeTask = (taskId: string, deviceId: string) => {
    setUrgentTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, acknowledged: true, acknowledgedBy: deviceId, acknowledgedAt: Date.now() }
          : t,
      ),
    );
  };

  const handleLogin = (role: UserRole) => {
    const user = { ...USERS[role] };
    if (loginCount > 0) {
      if (role === UserRole.ER_PERSONNEL) {
        user.name = 'Dr. James Wilson';
        user.avatarInitials = 'JW';
      } else if (role === UserRole.MANAGER) {
        user.name = 'Michael Chang';
        user.avatarInitials = 'MC';
      } else if (role === UserRole.NURSE) {
        user.name = 'Sarah Jenkins';
        user.avatarInitials = 'SJ';
      }
    }
    setCurrentUser(user);
    setLoginCount(prev => prev + 1);
    setShowShiftBriefing(true);
    showToast(`Logged in as ${user.name}`, 'info');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab(Tab.HORIZON);
    // Note: surge state intentionally NOT cleared on logout — it's a
    // shared session-level operational state that persists across role
    // switches. Use the debug panel "Reset demo state" to clear it.
    setSystemStatus('normal');
    setShowHandoverModal(false);
    setShowShiftBriefing(false);
    setActionFilter('');
  };

  const handleConfirmHandover = (notes: string) => {
    if (notes.trim() && currentUser) {
      setGlobalHandoverNotes({
        author: currentUser.name,
        notes: notes
      });
    }
    showToast('Shift handover complete. Logging out...', 'success');
    setTimeout(() => {
      handleLogout();
    }, 1500);
  };

  const navigateToActionBoard = (filter: string) => {
    setActionFilter(filter);
    setActiveTab(Tab.ACTIONS);
  };

  if (isBooting) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center font-mono text-neutral-400 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-screen pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-rose-900/5 to-black pointer-events-none"></div>
        
        <div className="w-full max-w-2xl p-8 relative z-10">
          <div className="flex items-center gap-6 mb-12">
            <div className="w-16 h-16 bg-rose-600 flex items-center justify-center rounded font-bold text-white text-4xl shadow-[0_0_40px_rgba(225,29,72,0.4)] animate-pulse">
               P
            </div>
            <div>
              <h1 className="text-5xl font-bold tracking-[0.2em] text-white mb-2 font-sans">PULSE</h1>
              <p className="text-xs text-neutral-500 tracking-[0.4em] uppercase">Predictive Unified Logistics & Surge Engine</p>
            </div>
          </div>

          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
              <span className="text-neutral-600 w-24">[SYSTEM]</span>
              <span className="text-neutral-300">Initializing core predictive models...</span>
              <span className="ml-auto text-emerald-500 font-bold tracking-widest">OK</span>
            </div>
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
              <span className="text-neutral-600 w-24">[NETWORK]</span>
              <span className="text-neutral-300">Establishing secure EHR uplink...</span>
              <span className="ml-auto text-emerald-500 font-bold tracking-widest">OK</span>
            </div>
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500">
              <span className="text-neutral-600 w-24">[DATA]</span>
              <span className="text-neutral-300">Synchronizing regional telemetry...</span>
              <span className="ml-auto text-emerald-500 font-bold tracking-widest">OK</span>
            </div>
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-700">
              <span className="text-neutral-600 w-24">[AUTH]</span>
              <span className="text-neutral-300">Verifying personnel credentials...</span>
              <span className="ml-auto text-rose-500 font-bold tracking-widest animate-pulse">WAIT</span>
            </div>
          </div>

          <div className="mt-16 h-[2px] w-full bg-neutral-900 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-rose-500 w-full origin-left animate-scale-x shadow-[0_0_10px_rgba(225,29,72,0.8)]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <ConnectionIndicator />
        {debugMode && <DebugPanel currentUser={null} />}
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      {/* Always-visible connection indicator and optional debug panel */}
      <ConnectionIndicator />
      {debugMode && <DebugPanel currentUser={currentUser} />}

      {/* Shared Modals & Overlays */}
      {showShiftBriefing && (
        <ShiftHandoffModal 
          type="in" 
          role={currentUser.role} 
          onComplete={() => setShowShiftBriefing(false)} 
          loginCount={loginCount}
        />
      )}

      {showHandoverModal && (
        <ShiftHandoffModal 
          type="out" 
          role={currentUser.role} 
          onComplete={handleConfirmHandover} 
          onCancel={() => setShowHandoverModal(false)} 
        />
      )}

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${
            toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400' :
            toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/30 text-rose-400' :
            'bg-blue-950/90 border-blue-500/30 text-blue-400'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
             toast.type === 'error' ? <AlertOctagon className="w-5 h-5" /> : 
             <Activity className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <ChatAssistant 
        currentUser={currentUser} 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
        initialQuery={chatQuery}
        loginCount={loginCount}
      />

      {isMobile ? (
        <MobileView
          currentUser={currentUser}
          systemStatus={systemStatus}
          isSurgeActive={isSurgeActive}
          surgeActivatedAt={surgeState.activatedAt}
          urgentTasks={urgentTasks}
          onAcknowledgeTask={acknowledgeTask}
          onActivateSurge={activateSurge}
          onLogout={handleLogout}
          showToast={showToast}
          loginCount={loginCount}
          onOpenChat={(query) => {
            setChatQuery(query || '');
            setShowChat(true);
          }}
        />
      ) : (
        <div className={`flex flex-col h-screen bg-black text-neutral-200 font-sans overflow-hidden selection:bg-rose-500/30 ${systemStatus === 'manual' ? 'border-4 border-amber-500' : ''}`}>
          
          {/* Top Navigation Bar */}
          <header className="h-16 border-b border-neutral-800 bg-black flex items-center justify-between px-6 shrink-0 z-40">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-600 flex items-center justify-center rounded-sm font-bold text-white text-xl shadow-lg shadow-rose-600/30">
               P
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">PULSE</h1>
            <div className="h-6 w-px bg-neutral-800 mx-1"></div>
            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs font-mono text-emerald-400">
               <span className={`w-2 h-2 rounded-full animate-pulse ${systemStatus === 'normal' ? 'bg-emerald-500' : systemStatus === 'stale' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
               {systemStatus === 'normal' ? 'LIVE' : systemStatus === 'stale' ? 'STALE' : 'MANUAL'}
            </div>
          </div>
          
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-[1.02] ${
                    isActive 
                      ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700' 
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-rose-500' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <button 
              onClick={() => {
                setShowChat(!showChat);
                if (showNotifications) setShowNotifications(false);
              }}
              className={`relative p-2 transition-all duration-200 hover:scale-110 rounded-full hover:bg-neutral-800 ${showChat ? 'text-rose-500 bg-rose-500/10' : 'text-neutral-400 hover:text-white'}`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <ChatAssistant currentUser={currentUser} isOpen={showChat} onClose={() => setShowChat(false)} initialQuery={chatQuery} loginCount={loginCount} isSurgeActive={isSurgeActive} />
          </div>
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (showChat) setShowChat(false);
              }}
              className={`relative p-2 transition-all duration-200 hover:scale-110 rounded-full hover:bg-neutral-800 ${showNotifications ? 'text-rose-500 bg-rose-500/10' : 'text-neutral-400 hover:text-white'}`}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
            </button>
            
            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex justify-between items-center p-3 border-b border-neutral-800 bg-neutral-950">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Alerts</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-neutral-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => {
                        if (n.isHandover) {
                          setChatQuery(`I am taking over the shift. Here are the handover notes from the previous shift: "${n.message}". What should I prioritize first based on these notes and current system vitals?`);
                          setShowNotifications(false);
                          setShowChat(true);
                        }
                      }}
                      className="p-3 border-b border-neutral-800/50 hover:bg-neutral-800/50 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold uppercase ${n.type === 'critical' ? 'text-rose-400' : n.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">{n.time}</span>
                      </div>
                      <p className="text-sm text-neutral-300">{n.message}</p>
                    </div>
                  ))}
                </div>
                <div className="p-2 bg-neutral-950 border-t border-neutral-800 text-center">
                  <button className="text-xs text-neutral-400 hover:text-white font-mono uppercase tracking-widest">View All Logs</button>
                </div>
              </div>
            )}
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-neutral-500 uppercase tracking-widest">{currentUser.role}</p>
            <p className="text-sm font-mono text-neutral-300">{currentUser.name}</p>
          </div>
          <div className="h-8 w-px bg-neutral-800"></div>
          
          {/* End Shift Button */}
          <button 
            onClick={() => setShowHandoverModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition-colors text-sm font-medium"
          >
            <Clock className="w-4 h-4" />
            End Shift
          </button>

          <button 
            onClick={() => setSystemStatus(s => s === 'normal' ? 'stale' : 'normal')}
            className="p-2 text-neutral-500 hover:text-amber-500 transition-colors"
            title="Simulate Outage"
          >
            <AlertOctagon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 overflow-hidden relative">
          {activeTab === Tab.HORIZON && (
            <PulseHorizon 
              onActivatePlaybook={handleActivatePlaybook} 
              isSurgeActive={isSurgeActive} 
              currentUser={currentUser}
              systemStatus={systemStatus}
              setSystemStatus={setSystemStatus}
              showToast={showToast}
              onNavigateToActionBoard={navigateToActionBoard}
              loginCount={loginCount}
            />
          )}
          {activeTab === Tab.LIVE_OPS && <LiveOps currentUser={currentUser} systemStatus={systemStatus} showToast={showToast} onNavigateToActionBoard={navigateToActionBoard} loginCount={loginCount} isSurgeActive={isSurgeActive} />}
          {activeTab === Tab.PLAYBOOKS && <Playbooks onActivate={handleActivatePlaybook} />}
          {activeTab === Tab.ACTIONS && <ActionBoard currentUser={currentUser} systemStatus={systemStatus} showToast={showToast} initialFilter={actionFilter} isSurgeActive={isSurgeActive} />}
          {activeTab === Tab.ROSTER && <Roster currentUser={currentUser} showToast={showToast} />}
          {activeTab === Tab.BRIEF_ME && <BriefMe isSurgeActive={isSurgeActive} currentUser={currentUser} showToast={showToast} />}
          {activeTab === Tab.REPLAY && <Replay showToast={showToast} />}
        </main>
        
        <CommandSidebar
          isSurgeActive={isSurgeActive}
          surgeActivatedAt={surgeState.activatedAt}
          urgentTasks={urgentTasks}
          onActivateSurge={activateSurge}
        />
      </div>

      {/* Footer System Ticker */}
      <footer className="h-8 bg-[#0a0a0a] border-t border-neutral-800 flex items-center px-4 gap-6 text-[10px] font-mono uppercase tracking-widest text-neutral-500 shrink-0 select-none">
         <div className="flex items-center gap-2 text-rose-500">
            <AlertOctagon className="w-3 h-3" />
            <span>NEDOCS: 185 (Dangerous)</span>
         </div>
         <div className="w-px h-4 bg-neutral-800"></div>
         <div className="flex items-center gap-2">
            <CloudRain className="w-3 h-3" />
            <span>Weather: Heavy Rain Warning (ETA 16:00)</span>
         </div>
         <div className="w-px h-4 bg-neutral-800"></div>
         <div className="flex items-center gap-2 text-emerald-500">
            <Signal className="w-3 h-3" />
            <span>Network: Stable</span>
         </div>
      </footer>
      
      {/* Modals */}
      {showPlaybookModal && (
        <PlaybookActivation 
          onClose={() => setShowPlaybookModal(false)} 
          onConfirm={handleConfirmPlaybook} 
        />
      )}

    </div>
      )}
    </>
  );
}

export default App;