import React, { useState, useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, ShieldAlert, CheckCircle2, RefreshCw, Zap, Ambulance, ArrowRight, Sliders, Network, Building2, Wind, MapPin, AlertTriangle, X } from 'lucide-react';
import { Status, UserProfile, UserRole } from '../types';
import { ROLE_METRICS } from '../data/userProfiles';

interface PulseHorizonProps {
  onActivatePlaybook: () => void;
  isSurgeActive: boolean;
  currentUser: UserProfile;
  systemStatus?: 'normal' | 'stale' | 'manual';
  setSystemStatus?: (status: 'normal' | 'stale' | 'manual') => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToActionBoard?: (filter: string) => void;
  loginCount?: number;
}

const nearbyHospitals = [
  { name: 'Memorial General', status: 'Open', time: '12m', load: 65 },
  { name: 'St. Mary Level 1', status: 'Divert', time: '25m', load: 98 },
  { name: 'County Trauma', status: 'Busy', time: '18m', load: 85 },
];

export const PulseHorizon: React.FC<PulseHorizonProps> = ({ onActivatePlaybook, isSurgeActive, currentUser, systemStatus = 'normal', setSystemStatus, showToast, loginCount = 1 }) => {
  // Simulation State
  const [simState, setSimState] = useState({
    addedStaff: 0,
    openBeds: 0,
    expeditedDischarges: 0
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<{ id: string, name: string, value: string, status: Status, impact: number, trend: string } | null>(null);

  const drivers = useMemo(() => {
    const baseDrivers = ROLE_METRICS[currentUser.role];
    if (loginCount > 1) {
      return baseDrivers.map(driver => {
        if (currentUser.role === UserRole.MANAGER) {
          if (driver.id === '1') return { ...driver, value: '4 Admitted', status: Status.NORMAL, impact: 25, trend: 'down' };
          if (driver.id === '2') return { ...driver, value: '15m Avg', status: Status.NORMAL, impact: 15, trend: 'down' };
          if (driver.id === '3') return { ...driver, value: 'Fully Staffed', status: Status.NORMAL, impact: 5, trend: 'stable' };
        }
        if (currentUser.role === UserRole.NURSE) {
          if (driver.id === 'n1') return { ...driver, value: '0 Overdue', status: Status.NORMAL, impact: 10, trend: 'down' };
          if (driver.id === 'n2') return { ...driver, value: '0 Patients', status: Status.NORMAL, impact: 5, trend: 'down' };
          if (driver.id === 'n3') return { ...driver, value: '1 Waiting', status: Status.NORMAL, impact: 15, trend: 'stable' };
        }
        if (currentUser.role === UserRole.ER_PERSONNEL) {
          if (driver.id === 'e1') return { ...driver, value: '2 Available', status: Status.NORMAL, impact: 20, trend: 'stable' };
          if (driver.id === 'e2') return { ...driver, value: '15 mins', status: Status.NORMAL, impact: 15, trend: 'down' };
          if (driver.id === 'e3') return { ...driver, value: '0 Inbound', status: Status.NORMAL, impact: 5, trend: 'down' };
        }
        return { ...driver, status: Status.NORMAL, impact: Math.floor(driver.impact * 0.3), trend: 'down' };
      });
    }
    return baseDrivers;
  }, [currentUser.role, loginCount]);

  // Calculate dynamic forecast based on simulation levers
  const chartData = useMemo(() => {
    // Base load trajectory without intervention
    let baseLoad = { now: 92, plus30: 98, plus60: 105, plus90: 112 };
    
    if (isSurgeActive) {
      baseLoad = { now: 32, plus30: 30, plus60: 28, plus90: 25 };
    } else if (loginCount > 1) {
      baseLoad = { now: 32, plus30: 34, plus60: 35, plus90: 38 };
    }
    
    // Impact factors
    const staffImpact = simState.addedStaff * 2.5; // Each staff reduces load by 2.5%
    const bedImpact = simState.openBeds * 1.5; // Each bed reduces load by 1.5%
    const dischargeImpact = simState.expeditedDischarges * 3.0; // Big impact

    const totalReduction = staffImpact + bedImpact + dischargeImpact;

    // Apply curve smoothing (impact takes time to realize)
    const r30 = totalReduction * 0.3;
    const r60 = totalReduction * 0.7;
    const r90 = totalReduction * 1.0;

    return [
      { time: '-30m', load: isSurgeActive ? 85 : (loginCount > 1 ? 32 : 85), capacity: 100, safe: 100 },
      { time: 'Now', load: systemStatus === 'manual' ? 85 : baseLoad.now, capacity: 100, safe: 100 },
      { time: '+30m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus30 - r30), capacity: 100, safe: 100 },
      { time: '+60m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus60 - r60), capacity: 100, safe: 100 },
      { time: '+90m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus90 - r90), capacity: 100, safe: 100 },
    ];
  }, [simState, isSurgeActive, systemStatus, loginCount]);

  const projectedLoad = chartData[4].load;
  const isSafe = projectedLoad < 100;

  const getDriverTitle = () => {
    switch (currentUser.role) {
      case UserRole.NURSE: return 'My Patient Alerts';
      case UserRole.ER_PERSONNEL: return 'Trauma & Triage Status';
      default: return 'Pressure Drivers';
    }
  };

  const handleSwitchToManual = () => {
    if (setSystemStatus) setSystemStatus('manual');
    setShowManualModal(false);
  };

  return (
    <div className="h-full grid grid-cols-12 gap-6 p-6 overflow-y-auto">
      
      {/* LEFT COLUMN: FORECAST, SIMULATOR & NETWORK */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        
        {/* Stale Data Banner */}
        {systemStatus === 'stale' && (
          <div 
            className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            onClick={() => setShowManualModal(true)}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="text-amber-500 font-bold text-sm">⚠️ Data Freshness Warning: EHR Sync delayed by 14 minutes. Confidence: Partial.</span>
            </div>
            <button className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded border border-amber-500/30 hover:bg-amber-500/30 font-bold">
              Switch to Manual Override
            </button>
          </div>
        )}

        {/* Manual Mode Banner */}
        {systemStatus === 'manual' && (
          <div className="bg-rose-500/10 border border-rose-500/50 rounded-lg p-3 flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.2)]">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span className="text-rose-500 font-bold text-sm">MANUAL OVERRIDE ACTIVE. Forecast Disabled: Insufficient Data.</span>
            </div>
            <button 
              onClick={() => {
                if (setSystemStatus) setSystemStatus('normal');
                if (showToast) showToast('EHR Sync Restored. Telemetry is live.', 'success');
              }}
              className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded border border-rose-500/30 hover:bg-rose-500/30 font-bold"
            >
              Restore EHR Sync
            </button>
          </div>
        )}

        {/* Manual Modal */}
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-amber-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-lg font-bold">EHR Connection Unstable</h2>
              </div>
              <p className="text-neutral-300 mb-6 text-sm leading-relaxed">
                The HL7 feed from the EHR has not sent an update in 14 minutes. Predictive models may be inaccurate. Would you like to switch to Manual Override to manually update census and bed states?
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    handleSwitchToManual();
                    if (showToast) showToast('Switched to Manual Override Mode', 'error');
                  }}
                  className="px-4 py-2 rounded text-sm font-bold bg-amber-500 hover:bg-amber-400 text-neutral-900"
                >
                  Switch to Manual Mode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Forecast Card */}
        <div className={`bg-neutral-900 border rounded-xl p-6 shadow-xl relative overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:border-neutral-600 ${systemStatus === 'manual' ? 'border-neutral-700 opacity-80' : 'border-neutral-800'}`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Predictive Risk Model
                <span className="ml-2 text-xs font-mono font-normal text-blue-400 bg-blue-950/30 px-2 py-1 rounded border border-blue-900/50 uppercase tracking-widest">
                  View: {currentUser.role.replace('_', ' ')}
                </span>
              </h2>
              <p className="text-neutral-400 text-sm mt-1 font-mono">
                {isSimulating ? 'SIMULATION MODE ACTIVE' : 'Live Telemetry Forecast'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-500 font-mono">
              <button 
                onClick={() => {
                  setIsSimulating(!isSimulating);
                  if (isSimulating) setSimState({ addedStaff: 0, openBeds: 0, expeditedDischarges: 0 });
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all border ${
                  isSimulating 
                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                  : 'bg-neutral-800 border-neutral-700 hover:border-neutral-500'
                }`}
              >
                <Sliders className="w-3 h-3" />
                {isSimulating ? 'Reset Simulation' : 'What-If Simulator'}
              </button>
            </div>
          </div>

          <div className="h-64 w-full relative">
            {/* Background "Safe Zone" indicator */}
            <div className="absolute inset-0 bg-gradient-to-b from-rose-900/5 to-transparent pointer-events-none"></div>
            
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isSafe ? "#10b981" : "#f43f5e"} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={isSafe ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="time" stroke="#525252" tick={{fontSize: 12}} />
                <YAxis stroke="#525252" tick={{fontSize: 12}} domain={[0, 100]} hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', color: '#f5f5f5' }}
                  itemStyle={{ color: '#f5f5f5' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Saturation']}
                />
                <ReferenceLine y={100} stroke="#737373" strokeDasharray="3 3" label={{ value: 'Capacity Cap (100%)', position: 'insideTopRight', fill: '#737373', fontSize: 10 }} />
                
                {/* Visualizing the "Gap" if simulating */}
                {isSimulating && (
                   <Area 
                    type="monotone" 
                    dataKey="load" 
                    strokeDasharray="5 5"
                    stroke="#6366f1" 
                    strokeWidth={2} 
                    fill="none" 
                    name="Simulated"
                  />
                )}

                <Area 
                  type="monotone" 
                  dataKey="load" 
                  stroke={isSafe ? "#10b981" : "#f43f5e"} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorLoad)" 
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* KPI Footer */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 border-t border-neutral-800 pt-6">
            <div className="text-center border-r border-neutral-800">
              <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Current</p>
              <p className="text-2xl font-mono font-bold text-neutral-200">{chartData[1].load.toFixed(0)}%</p>
            </div>
            <div className="text-center border-r border-neutral-800">
              <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Forecast (+90m)</p>
              <p className={`text-2xl font-mono font-bold ${projectedLoad > 100 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {projectedLoad.toFixed(0)}%
              </p>
            </div>
            <div className="text-center border-r border-neutral-800">
               <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Trend</p>
               <p className="text-xl font-mono text-neutral-300 flex items-center justify-center gap-1">
                 {projectedLoad > chartData[1].load ? <TrendingUp className="w-4 h-4 text-rose-500"/> : <TrendingDown className="w-4 h-4 text-emerald-500"/>}
                 {Math.abs(projectedLoad - chartData[1].load).toFixed(0)}%
               </p>
            </div>
             <div className="text-center">
               <p className="text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Status</p>
               <p className={`text-sm font-bold uppercase mt-1.5 px-2 py-0.5 rounded inline-block ${projectedLoad > 100 ? 'bg-rose-950/30 text-rose-500 border border-rose-500/20' : 'bg-emerald-950/30 text-emerald-500 border border-emerald-500/20'}`}>
                 {projectedLoad > 100 ? 'Saturation' : 'Safe'}
               </p>
            </div>
          </div>
        </div>

        {/* Action / Simulator Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SIMULATOR CONTROLS */}
          {isSimulating ? (
             <div className="bg-neutral-900 border border-indigo-500/30 rounded-lg p-5 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <div className="flex items-center gap-2 mb-4">
                   <Zap className="w-5 h-5 text-indigo-400" />
                   <h3 className="text-indigo-200 font-bold text-sm uppercase tracking-wide">Operational Levers</h3>
                </div>
                
                <div className="space-y-5">
                   {/* Staffing Slider */}
                   <div>
                      <div className="flex justify-between text-xs mb-2">
                         <span className="text-neutral-400">Add Nursing Staff</span>
                         <span className="text-indigo-400 font-mono">+{simState.addedStaff} FTE</span>
                      </div>
                      <input 
                        type="range" min="0" max="5" step="1"
                        value={simState.addedStaff}
                        onChange={(e) => setSimState({...simState, addedStaff: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                      />
                   </div>
                   
                   {/* Beds Slider */}
                   <div>
                      <div className="flex justify-between text-xs mb-2">
                         <span className="text-neutral-400">Open Surge Beds</span>
                         <span className="text-indigo-400 font-mono">+{simState.openBeds} Beds</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" step="1"
                        value={simState.openBeds}
                        onChange={(e) => setSimState({...simState, openBeds: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                      />
                   </div>

                   {/* Discharges Slider */}
                   <div>
                      <div className="flex justify-between text-xs mb-2">
                         <span className="text-neutral-400">Expedite Discharges</span>
                         <span className="text-indigo-400 font-mono">+{simState.expeditedDischarges} Pts</span>
                      </div>
                      <input 
                        type="range" min="0" max="8" step="1"
                        value={simState.expeditedDischarges}
                        onChange={(e) => setSimState({...simState, expeditedDischarges: parseInt(e.target.value)})}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                      />
                   </div>
                </div>

                <div className="mt-6 pt-4 border-t border-neutral-800 flex justify-between items-center">
                   <span className="text-xs text-neutral-500 italic">Changes reflect in chart above</span>
                   {isSafe && !isSurgeActive && (
                      <button 
                         onClick={onActivatePlaybook}
                         className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow transition-all"
                      >
                         Apply & Activate
                      </button>
                   )}
                </div>
             </div>
          ) : (
             /* STANDARD RECOMMENDATION VIEW */
             <div className={`border rounded-lg p-5 flex flex-col justify-between transition-colors duration-500 ${
               isSurgeActive 
                 ? 'bg-emerald-950/10 border-emerald-900/30' 
                 : (loginCount > 1 ? 'bg-neutral-900/50 border-neutral-800' : 'bg-rose-950/10 border-rose-900/30')
             }`}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                     {isSurgeActive ? (
                       <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                     ) : loginCount > 1 ? (
                       <CheckCircle2 className="w-5 h-5 text-neutral-500" />
                     ) : (
                       <ShieldAlert className="w-5 h-5 text-rose-500" />
                     )}
                     <h3 className={`font-bold text-sm uppercase ${
                       isSurgeActive 
                         ? 'text-emerald-200' 
                         : (loginCount > 1 ? 'text-neutral-400' : 'text-rose-200')
                     }`}>
                        {isSurgeActive 
                          ? 'Protocol Active' 
                          : (loginCount > 1 ? 'Intervention Not Required' : 'Intervention Required')}
                     </h3>
                  </div>
                  <p className={`text-sm mb-4 ${
                    isSurgeActive 
                      ? 'text-emerald-400/80' 
                      : (loginCount > 1 ? 'text-neutral-500' : 'text-rose-400/80')
                  }`}>
                     {isSurgeActive 
                        ? "Surge Level 2 activated. Risk trajectory stabilizing. Monitor fast-track throughput." 
                        : (loginCount > 1 
                            ? "Capacity is stable. No active surge protocols required at this time." 
                            : "Forecast exceeds safety thresholds. Activate Surge Protocol Level 2 immediately.")}
                  </p>
                </div>
                {!isSurgeActive && loginCount <= 1 && (
                  <button 
                    onClick={onActivatePlaybook}
                    className="w-full bg-rose-700 hover:bg-rose-600 text-white py-2 rounded font-bold shadow-lg shadow-rose-900/20 transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2 text-sm"
                  >
                    ACTIVATE SURGE PLAYBOOK <ArrowRight className="w-4 h-4" />
                  </button>
                )}
             </div>
          )}

          {/* Regional Network Status Widget - Moved to Left Column for better context */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-neutral-800/80 hover:border-neutral-700">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                   <Network className="w-4 h-4 text-cyan-400" /> Regional Partner Hospitals
                </h3>
                <RefreshCw className="w-3 h-3 text-neutral-600" />
             </div>
             
             <div className="space-y-3">
                {nearbyHospitals.map((hospital, idx) => (
                   <div key={idx} className="flex items-center justify-between p-2 rounded bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${hospital.status === 'Open' ? 'bg-emerald-500 text-emerald-500' : hospital.status === 'Divert' ? 'bg-rose-500 text-rose-500' : 'bg-amber-500 text-amber-500'}`}></div>
                         <div>
                            <p className="text-sm text-neutral-300 font-medium flex items-center gap-1">
                               {hospital.name}
                               {hospital.status === 'Divert' && <ShieldAlert className="w-3 h-3 text-rose-500" />}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                               <MapPin className="w-3 h-3" />
                               {hospital.time} transfer
                            </div>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                            hospital.status === 'Divert' ? 'bg-rose-950/30 text-rose-400 border-rose-500/20' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                         }`}>
                            {hospital.status}
                         </span>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: INBOUND EMS & DRIVERS */}
      <div className="col-span-12 lg:col-span-4 flex flex-col h-full gap-6">
        
        {/* Inbound EMS Widget - Moved to Right Column as a Driver */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 shadow-lg relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:bg-neutral-800/80 hover:border-neutral-700">
             
             <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                   <Ambulance className="w-4 h-4 text-blue-400" /> Inbound EMS
                </h3>
                <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20 animate-pulse">Live Feed</span>
             </div>
             <div className="flex items-end gap-2 mb-2 relative z-10">
                <span className="text-4xl font-mono font-bold text-white">{loginCount > 1 && !isSurgeActive ? '2' : '8'}</span>
                <span className="text-neutral-500 text-sm mb-1">Total En Route</span>
             </div>
             <div className="w-full bg-neutral-800 h-1.5 rounded-full mb-3 overflow-hidden relative z-10">
                <div className={`h-full shadow-[0_0_10px_currentColor] ${loginCount > 1 && !isSurgeActive ? 'bg-emerald-500 w-[10%]' : 'bg-rose-500 w-[40%]'}`}></div>
             </div>
             <div className="flex justify-between text-xs relative z-10">
                {loginCount > 1 && !isSurgeActive ? (
                  <>
                    <span className="text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> 0 Critical</span>
                    <span className="text-neutral-500">2 Stable</span>
                  </>
                ) : (
                  <>
                    <span className="text-rose-400 font-medium flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> 3 Critical (&lt; 5m)</span>
                    <span className="text-neutral-500">5 Stable</span>
                  </>
                )}
             </div>
        </div>

        {/* Drivers List */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex-1 shadow-xl flex flex-col transition-all duration-200 hover:scale-[1.02] hover:bg-neutral-800/80 hover:border-neutral-700">
          <h2 className="text-lg font-bold text-neutral-100 mb-6 uppercase tracking-wider text-xs flex items-center gap-2 shrink-0">
             <Wind className="w-4 h-4 text-neutral-500" /> {getDriverTitle()}
          </h2>
          
          <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {drivers.map((driver, idx) => (
              <div 
                key={driver.id} 
                className="group cursor-pointer hover:bg-neutral-800/50 p-2 -mx-2 rounded transition-colors"
                onClick={() => setExpandedDriverId(expandedDriverId === driver.id ? null : driver.id)}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-600 font-mono text-sm">0{idx + 1}</span>
                    <span className="text-neutral-300 font-medium group-hover:text-cyan-400 transition-colors">{driver.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-100 font-mono font-bold text-sm">{driver.value}</span>
                    <ArrowRight className={`w-3 h-3 text-neutral-600 transition-all ${expandedDriverId === driver.id ? 'rotate-90 text-cyan-400 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:text-cyan-400 -translate-x-2 group-hover:translate-x-0'}`} />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 bg-neutral-800 rounded-full overflow-hidden relative">
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                        driver.status === Status.CRITICAL ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 
                        driver.status === Status.WARNING ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${driver.impact}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">{driver.impact}%</span>
                </div>

                {expandedDriverId === driver.id && (
                  <div className="mt-4 p-3 bg-neutral-950 rounded border border-neutral-800 animate-in slide-in-from-top-2 fade-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-neutral-400 mb-3 leading-relaxed">
                      {driver.status === Status.CRITICAL 
                        ? `Critical pressure detected. Immediate intervention required to stabilize ${driver.name.toLowerCase()} metrics.`
                        : `Monitoring ${driver.name.toLowerCase()}. Current levels are within acceptable thresholds but require observation.`}
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedDriverDetails(driver);
                        }}
                        className="flex-1 py-1.5 bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 text-xs font-bold rounded border border-cyan-900/50 transition-colors"
                      >
                        View Details
                      </button>
                      <button 
                        onClick={() => {
                          if (showToast) showToast('Driver acknowledged. Monitoring adjusted.', 'info');
                          setExpandedDriverId(null);
                        }}
                        className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded transition-colors"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-800 shrink-0">
             <div className="bg-neutral-950 rounded p-4 text-xs text-neutral-400 font-mono border border-neutral-800/50">
                <div className="flex items-center gap-2 mb-2 text-cyan-500">
                   <Building2 className="w-3 h-3" />
                   <span className="font-bold">HOUSE STATUS</span>
                </div>
                {loginCount > 1 && !isSurgeActive ? (
                  <>
                    <p className="flex justify-between mb-1"><span>Med/Surg Beds:</span> <span className="text-emerald-400">4 Available</span></p>
                    <p className="flex justify-between mb-1"><span>ICU Beds:</span> <span className="text-emerald-400">2 Available</span></p>
                    <p className="flex justify-between"><span>Psych Hold:</span> <span className="text-white">1 Patient</span></p>
                  </>
                ) : (
                  <>
                    <p className="flex justify-between mb-1"><span>Med/Surg Beds:</span> <span className="text-rose-400">0 Available</span></p>
                    <p className="flex justify-between mb-1"><span>ICU Beds:</span> <span className="text-amber-400">1 Available</span></p>
                    <p className="flex justify-between"><span>Psych Hold:</span> <span className="text-white">4 Patients</span></p>
                  </>
                )}
             </div>
          </div>
        </div>
      </div>

      {selectedDriverDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedDriverDetails.status === Status.CRITICAL ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 
                    selectedDriverDetails.status === Status.WARNING ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <h2 className="text-2xl font-bold text-white">{selectedDriverDetails.name}</h2>
                </div>
                <p className="text-neutral-400 text-sm font-mono">Current Value: <span className="text-white font-bold">{selectedDriverDetails.value}</span> | Impact: <span className="text-white font-bold">{selectedDriverDetails.impact}%</span></p>
              </div>
              <button 
                onClick={() => setSelectedDriverDetails(null)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Root Causes</h3>
                  <ul className="list-disc list-inside text-sm text-neutral-300 space-y-1">
                    <li>High influx of trauma patients (last 2h)</li>
                    <li>Delayed discharges from Med/Surg</li>
                    <li>Staffing shortage in Triage</li>
                  </ul>
                </div>
                <div className="bg-neutral-950 p-4 rounded border border-neutral-800">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Predicted Trajectory</h3>
                  <p className="text-sm text-neutral-300">
                    Without intervention, metric is expected to worsen by <span className="text-rose-400 font-bold">15%</span> in the next 45 minutes.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Recommended Actions</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-neutral-800/50 p-3 rounded border border-neutral-700/50">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-neutral-200">Deploy float pool nurse to Triage</span>
                    </div>
                    <button className="text-xs bg-cyan-900/30 text-cyan-400 px-3 py-1 rounded border border-cyan-900/50 hover:bg-cyan-900/50 transition-colors">
                      Execute
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-800/50 p-3 rounded border border-neutral-700/50">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-neutral-200">Escalate pending discharges to Attending</span>
                    </div>
                    <button className="text-xs bg-cyan-900/30 text-cyan-400 px-3 py-1 rounded border border-cyan-900/50 hover:bg-cyan-900/50 transition-colors">
                      Execute
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button 
                onClick={() => setSelectedDriverDetails(null)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold rounded transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
