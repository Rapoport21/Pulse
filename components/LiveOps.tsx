import React, { useState, useMemo, useEffect } from 'react';
import { Status, ZoneStatus, UserProfile, UserRole } from '../types';
import { Users, Activity, Thermometer, Clock, UserCheck, AlertTriangle, Layers, Map as MapIcon, Maximize2, Minimize2, Search, X, Printer } from 'lucide-react';
import { PrintPreviewModal } from './PrintPreviewModal';
import { StaffManagementModal } from './StaffManagementModal';

interface LiveOpsProps {
  currentUser?: UserProfile | null;
  systemStatus?: 'normal' | 'stale' | 'manual';
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToActionBoard?: (filter: string) => void;
  loginCount?: number;
  isSurgeActive?: boolean;
}

interface ExtendedZoneStatus extends ZoneStatus {
  floor: number;
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  location: string;
  status: string;
  acuity: string;
  admittedAt: string;
}

const mockPatients: Patient[] = [
  { id: 'MRN-10293', name: 'John Doe', dob: '1980-05-12', location: 'Waiting Room', status: 'Waiting', acuity: 'Level 3', admittedAt: '14:30' },
  { id: 'MRN-84721', name: 'Jane Smith', dob: '1992-11-23', location: 'Acute Care Pods', status: 'In Treatment', acuity: 'Level 2', admittedAt: '12:15' },
  { id: 'MRN-55392', name: 'Robert Johnson', dob: '1955-02-08', location: 'Trauma Bay', status: 'Critical', acuity: 'Level 1', admittedAt: '16:45' },
  { id: 'MRN-99210', name: 'Emily Davis', dob: '2001-08-30', location: 'Triage / Intake', status: 'Triaging', acuity: 'Pending', admittedAt: '17:10' },
  { id: 'MRN-11029', name: 'Michael Wilson', dob: '1975-04-17', location: '3A: Gen Med', status: 'Admitted', acuity: 'Level 3', admittedAt: 'Yesterday' },
];

const mockZones: ExtendedZoneStatus[] = [
  // LEVEL 1: EMERGENCY
  { 
    id: 'waiting', floor: 1, name: 'Waiting Room', occupancy: 95, capacity: 40, patients: 38, 
    status: Status.CRITICAL, trend: 'Rising', staffing: '2 RN, 1 Security', waitTime: '2h 15m'
  },
  { 
    id: 'triage', floor: 1, name: 'Triage / Intake', occupancy: 80, capacity: 10, patients: 8, 
    status: Status.WARNING, trend: 'Stable', staffing: '3 RN', waitTime: '15m'
  },
  { 
    id: 'acute', floor: 1, name: 'Acute Care Pods', occupancy: 100, capacity: 30, patients: 30, 
    status: Status.CRITICAL, trend: 'Rising', staffing: '8 RN, 2 MD', waitTime: 'N/A'
  },
  { 
    id: 'resus', floor: 1, name: 'Trauma Bay', occupancy: 25, capacity: 4, patients: 1, 
    status: Status.NORMAL, trend: 'Stable', staffing: '4 RN, 2 MD', waitTime: '0m'
  },
  { 
    id: 'imaging', floor: 1, name: 'Radiology (CT/XR)', occupancy: 60, capacity: 5, patients: 3, 
    status: Status.NORMAL, trend: 'Stable', staffing: '2 Tech', waitTime: '45m'
  },
  { 
    id: 'fasttrack', floor: 1, name: 'Fast Track', occupancy: 40, capacity: 15, patients: 6, 
    status: Status.NORMAL, trend: 'Falling', staffing: '2 NP, 1 RN', waitTime: '30m'
  },

  // LEVEL 2: ICU & OR
  { 
    id: 'icu_surg', floor: 2, name: 'SICU (Surgical)', occupancy: 90, capacity: 20, patients: 18, 
    status: Status.WARNING, trend: 'Stable', staffing: '10 RN, 2 Intensivist', waitTime: 'N/A'
  },
  { 
    id: 'icu_med', floor: 2, name: 'MICU (Medical)', occupancy: 60, capacity: 20, patients: 12, 
    status: Status.NORMAL, trend: 'Stable', staffing: '6 RN, 1 Intensivist', waitTime: 'N/A'
  },
  { 
    id: 'or_main', floor: 2, name: 'Operating Theatre', occupancy: 75, capacity: 8, patients: 6, 
    status: Status.NORMAL, trend: 'Rising', staffing: 'Full Team', waitTime: 'Sch Only'
  },
  { 
    id: 'pacu', floor: 2, name: 'PACU Recovery', occupancy: 85, capacity: 12, patients: 10, 
    status: Status.WARNING, trend: 'Rising', staffing: '4 RN', waitTime: '20m Hold'
  },

  // LEVEL 3: MED/SURG
  { 
    id: 'ward_3a', floor: 3, name: '3A: Gen Med', occupancy: 98, capacity: 40, patients: 39, 
    status: Status.CRITICAL, trend: 'Rising', staffing: '6 RN, 2 CNA', waitTime: '4h Admit'
  },
  { 
    id: 'ward_3b', floor: 3, name: '3B: Ortho/Neuro', occupancy: 70, capacity: 30, patients: 21, 
    status: Status.NORMAL, trend: 'Stable', staffing: '5 RN', waitTime: 'N/A'
  },
  { 
    id: 'telemetry', floor: 3, name: '3C: Telemetry', occupancy: 88, capacity: 25, patients: 22, 
    status: Status.WARNING, trend: 'Stable', staffing: '4 RN', waitTime: '1h Hold'
  },
];

const floors = [
  { id: 1, name: 'L1: Emergency Dept', short: 'L1' },
  { id: 2, name: 'L2: ICU / OR', short: 'L2' },
  { id: 3, name: 'L3: Med / Surg', short: 'L3' },
];

export const LiveOps: React.FC<LiveOpsProps> = ({ currentUser, systemStatus = 'normal', showToast, onNavigateToActionBoard, loginCount = 1, isSurgeActive = false }) => {
  const [selectedZone, setSelectedZone] = useState<ExtendedZoneStatus | null>(null);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);

  const searchResults = useMemo(() => {
    if (searchQuery.trim() === '') {
      return [];
    }
    const lowerQuery = searchQuery.toLowerCase();
    return mockPatients.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || p.id.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === UserRole.ER_PERSONNEL) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentFloor(1);
      } else if (currentUser.role === UserRole.NURSE) {
        setCurrentFloor(3); // Assume nurse is on Med/Surg for this demo
      } else {
        setCurrentFloor(1); // Manager starts at L1
      }
    }
  }, [currentUser]);

  const activeZones = useMemo(() => {
    if (loginCount > 1 || isSurgeActive) {
      return mockZones.map(zone => {
        const newOccupancy = Math.floor(zone.occupancy * 0.35);
        const newPatients = Math.floor(zone.patients * 0.35);
        return { 
          ...zone, 
          status: Status.NORMAL, 
          occupancy: newOccupancy, 
          patients: newPatients,
          trend: 'Stable',
          waitTime: zone.waitTime === 'N/A' || zone.waitTime === 'Sch Only' ? zone.waitTime : '10m'
        };
      });
    }
    return mockZones;
  }, [loginCount, isSurgeActive]);

  const floorZones = useMemo(() => activeZones.filter(z => z.floor === currentFloor), [currentFloor, activeZones]);

  const getZoneColor = (status: Status) => {
    switch (status) {
      case Status.CRITICAL: return 'stroke-rose-500 fill-rose-900/40';
      case Status.WARNING: return 'stroke-amber-500 fill-amber-900/40';
      case Status.NORMAL: return 'stroke-emerald-500 fill-emerald-900/40';
      default: return 'stroke-cyan-800 fill-cyan-950/30';
    }
  };

  const handleZoneClick = (id: string) => {
    const zone = activeZones.find(z => z.id === id);
    if (zone) setSelectedZone(zone);
  };

  const renderGridPoints = () => {
    const points = [];
    for(let x=50; x<=850; x+=100) {
      for(let y=50; y<=600; y+=100) {
        points.push(<rect key={`grid-${x}-${y}`} x={x-2} y={y-2} width="4" height="4" fill="#1e293b" />);
      }
    }
    return <g>{points}</g>;
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-black">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <MapIcon className="w-6 h-6 text-cyan-400" />
            Facility Schematic
            {currentUser && (
              <span className="text-xs font-mono font-normal text-cyan-600 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50 uppercase tracking-widest">
                View: {currentUser.role.replace('_', ' ')}
              </span>
            )}
          </h2>
          <p className="text-cyan-600/60 font-mono text-sm uppercase tracking-widest mt-1">Real-time Telemetry • Digital Twin</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="relative">
            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5 w-64">
              <Search className="w-4 h-4 text-neutral-500 mr-2" />
              <input 
                type="text" 
                placeholder="Search patient by name or ID..." 
                className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-neutral-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-md shadow-xl z-50 max-h-60 overflow-y-auto">
                {searchResults.map(p => (
                  <div 
                    key={p.id} 
                    className="p-2 hover:bg-neutral-700 cursor-pointer border-b border-neutral-700/50 last:border-0"
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-xs text-neutral-400 flex justify-between">
                      <span>{p.id}</span>
                      <span>{p.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-neutral-500 bg-neutral-900/50 p-2 rounded border border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Optimal
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span> Load
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span> Critical
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        
        {/* LEFT: BLUEPRINT MAP */}
        <div className={`col-span-9 bg-[#0b1221] border ${systemStatus === 'manual' ? 'border-amber-500/50' : 'border-cyan-900/30'} rounded-lg relative overflow-hidden flex flex-col shadow-2xl transition-colors duration-500`}>
          
          {systemStatus === 'manual' && (
            <div className="absolute top-0 left-0 w-full bg-amber-500/20 border-b border-amber-500/50 p-2 z-20 flex items-center justify-center gap-2 backdrop-blur-sm animate-in slide-in-from-top-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-amber-500 font-mono text-xs font-bold uppercase tracking-widest">Manual Override Active - Telemetry Offline</span>
            </div>
          )}

          {/* Controls */}
          <div className={`absolute ${systemStatus === 'manual' ? 'top-12' : 'top-4'} right-4 z-10 flex flex-col gap-2 transition-all duration-500`}>
            <div className="bg-[#0f172a]/90 backdrop-blur border border-cyan-900/50 rounded flex flex-col shadow-lg">
              <button onClick={() => setZoom(Math.min(zoom + 0.2, 2))} className="p-2 hover:bg-cyan-900/30 text-cyan-400 border-b border-cyan-900/30"><Maximize2 className="w-4 h-4"/></button>
              <button onClick={() => setZoom(Math.max(zoom - 0.2, 0.6))} className="p-2 hover:bg-cyan-900/30 text-cyan-400"><Minimize2 className="w-4 h-4"/></button>
            </div>
          </div>

          <div className={`absolute ${systemStatus === 'manual' ? 'top-12' : 'top-4'} left-4 z-10 transition-all duration-500`}>
            <div className="bg-[#0f172a]/90 backdrop-blur border border-cyan-900/50 rounded flex flex-col shadow-lg overflow-hidden">
               {floors.map(floor => (
                  <button 
                    key={floor.id}
                    onClick={() => { setCurrentFloor(floor.id); setSelectedZone(null); }}
                    className={`px-4 py-3 text-left text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-3 transition-all duration-200 hover:scale-105 ${
                       currentFloor === floor.id 
                       ? 'bg-cyan-950/50 text-cyan-300 border-l-2 border-cyan-400' 
                       : 'text-cyan-700 hover:text-cyan-400 hover:bg-cyan-950/30 border-l-2 border-transparent'
                    }`}
                  >
                     <Layers className="w-4 h-4" />
                     {floor.name}
                  </button>
               ))}
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="flex-1 overflow-hidden relative cursor-move active:cursor-grabbing bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <svg 
              viewBox="0 0 1000 700" 
              className="w-full h-full transition-transform duration-500 ease-out"
              style={{ transform: `scale(${zoom})` }}
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
                </pattern>
                <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" strokeWidth="0.5" opacity="0.5"/>
                </pattern>
              </defs>

              <rect width="100%" height="100%" fill="#0b1221" />
              <rect width="100%" height="100%" fill="url(#smallGrid)" />
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {renderGridPoints()}

              <g transform="translate(50, 50)">
                
                {/* LEVEL 1: EMERGENCY DEPARTMENT */}
                {currentFloor === 1 && (
                   <>
                      {/* Outer Shell */}
                      <path d="M50,100 L50,600 L850,600 L850,100 L700,100 L700,50 L200,50 L200,100 Z" fill="none" stroke="#0891b2" strokeWidth="4" strokeLinecap="square" />
                      
                      {/* Structure Pillars */}
                      {[150, 350, 550, 750].map(x => (
                        <rect key={x} x={x} y={100} width="10" height="10" fill="#155e75" />
                      ))}
                      {[150, 350, 550, 750].map(x => (
                        <rect key={x} x={x} y={590} width="10" height="10" fill="#155e75" />
                      ))}

                      {/* Corridor Lines */}
                      <path d="M250,100 L250,500" fill="none" stroke="#164e63" strokeWidth="1" strokeDasharray="5,5" />
                      <path d="M650,100 L650,500" fill="none" stroke="#164e63" strokeWidth="1" strokeDasharray="5,5" />

                      {/* ZONES */}
                      {/* Waiting Room */}
                      <g onClick={() => handleZoneClick('waiting')} className={`transition-all duration-300 cursor-pointer hover:opacity-100 ${selectedZone?.id === 'waiting' ? 'opacity-100' : 'opacity-80'}`}>
                         <path d="M50,400 L250,400 L250,600 L50,600 Z" className={getZoneColor(activeZones.find(z=>z.id==='waiting')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'waiting' ? 3 : 1} />
                         <text x="150" y="500" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-sm">WAITING</text>
                         <circle cx="100" cy="450" r="3" fill="#155e75" /><circle cx="120" cy="450" r="3" fill="#155e75" /><circle cx="140" cy="450" r="3" fill="#155e75" />
                      </g>

                      {/* Triage */}
                      <g onClick={() => handleZoneClick('triage')} className="cursor-pointer hover:brightness-125 transition-all">
                         <rect x="250" y="450" width="200" height="150" className={getZoneColor(activeZones.find(z=>z.id==='triage')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'triage' ? 3 : 1} />
                         <text x="350" y="525" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-sm">TRIAGE</text>
                         <path d="M300,450 L300,600" stroke="#155e75" strokeWidth="1" />
                         <path d="M400,450 L400,600" stroke="#155e75" strokeWidth="1" />
                      </g>

                      {/* Fast Track */}
                      <g onClick={() => handleZoneClick('fasttrack')} className="cursor-pointer hover:brightness-125 transition-all">
                         <rect x="650" y="300" width="200" height="300" className={getZoneColor(activeZones.find(z=>z.id==='fasttrack')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'fasttrack' ? 3 : 1} />
                         <text x="750" y="450" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-sm">FAST TRACK</text>
                         <path d="M650,400 L750,400" stroke="#155e75" strokeWidth="1" />
                         <path d="M650,500 L750,500" stroke="#155e75" strokeWidth="1" />
                      </g>

                      {/* Acute Care */}
                      <g onClick={() => handleZoneClick('acute')} className="cursor-pointer hover:brightness-125 transition-all">
                         <path d="M250,200 L650,200 L650,450 L450,450 L450,600 L250,600 Z" className={getZoneColor(activeZones.find(z=>z.id==='acute')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'acute' ? 3 : 1} />
                         <text x="450" y="325" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold">ACUTE CARE PODS</text>
                         <circle cx="450" cy="350" r="40" fill="none" stroke="#0891b2" strokeWidth="2" strokeDasharray="4,2" />
                      </g>

                      {/* Trauma / Resus */}
                      <g onClick={() => handleZoneClick('resus')} className="cursor-pointer hover:brightness-125 transition-all">
                         <rect x="50" y="100" width="200" height="300" className={getZoneColor(activeZones.find(z=>z.id==='resus')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'resus' ? 3 : 1} />
                         <text x="150" y="250" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-sm font-bold tracking-widest" transform="rotate(-90 150 250)">TRAUMA</text>
                         <rect x="80" y="150" width="30" height="50" fill="none" stroke="#155e75" rx="2" />
                         <rect x="80" y="250" width="30" height="50" fill="none" stroke="#155e75" rx="2" />
                      </g>

                      {/* Imaging */}
                      <g onClick={() => handleZoneClick('imaging')} className="cursor-pointer hover:brightness-125 transition-all">
                         <rect x="650" y="100" width="200" height="200" className={getZoneColor(activeZones.find(z=>z.id==='imaging')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'imaging' ? 3 : 1} />
                         <text x="750" y="200" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-sm">IMAGING</text>
                         <path d="M720,150 L780,150 L780,250 L720,250 Z" fill="none" stroke="#155e75" strokeWidth="1" />
                      </g>

                      {/* Labels */}
                      <text x="15" y="500" fill="#0891b2" fontSize="10" className="font-mono opacity-50" transform="rotate(-90 15 500)">AMBULANCE</text>
                   </>
                )}

                {/* LEVEL 2: ICU & OR */}
                {currentFloor === 2 && (
                  <>
                     <path d="M50,100 L850,100 L850,600 L50,600 Z" fill="none" stroke="#0891b2" strokeWidth="4" />
                     
                     {/* Elevators / Lobby Left */}
                     <rect x="50" y="100" width="150" height="500" fill="none" stroke="#164e63" strokeWidth="2" />
                     <text x="125" y="350" fill="#155e75" fontSize="14" className="font-mono" textAnchor="middle" transform="rotate(-90 125 350)">ELEVATOR LOBBY</text>
                     <rect x="80" y="250" width="40" height="40" fill="#0f172a" stroke="#1e293b" />
                     <rect x="80" y="310" width="40" height="40" fill="#0f172a" stroke="#1e293b" />
                     <path d="M80,250 L120,290 M120,250 L80,290" stroke="#1e293b" strokeWidth="0.5" />
                     <path d="M80,310 L120,350 M120,310 L80,350" stroke="#1e293b" strokeWidth="0.5" />

                     {/* ICU SURG (Top) */}
                     <g onClick={() => handleZoneClick('icu_surg')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="200" y="100" width="350" height="250" className={getZoneColor(activeZones.find(z=>z.id==='icu_surg')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'icu_surg' ? 3 : 1} />
                        <text x="375" y="225" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold">SURGICAL ICU</text>
                        {/* Bed cubicles */}
                        {[220, 280, 340, 400, 460].map(x => (
                           <rect key={x} x={x} y={120} width="40" height="50" fill="none" stroke="#155e75" rx="2" />
                        ))}
                     </g>

                     {/* ICU MED (Bottom) */}
                     <g onClick={() => handleZoneClick('icu_med')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="200" y="350" width="350" height="250" className={getZoneColor(activeZones.find(z=>z.id==='icu_med')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'icu_med' ? 3 : 1} />
                        <text x="375" y="475" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold">MEDICAL ICU</text>
                        {/* Bed cubicles */}
                        {[220, 280, 340, 400, 460].map(x => (
                           <rect key={x} x={x} y={530} width="40" height="50" fill="none" stroke="#155e75" rx="2" />
                        ))}
                     </g>

                     {/* OR Complex (Right) */}
                     <g onClick={() => handleZoneClick('or_main')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="550" y="100" width="300" height="350" className={getZoneColor(activeZones.find(z=>z.id==='or_main')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'or_main' ? 3 : 1} />
                        <text x="700" y="275" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold">OPERATING THEATRE</text>
                        {/* OR Tables */}
                        <circle cx="620" cy="180" r="20" fill="none" stroke="#155e75" />
                        <rect x="610" y="170" width="20" height="20" fill="#155e75" />
                        <circle cx="780" cy="180" r="20" fill="none" stroke="#155e75" />
                        <rect x="770" y="170" width="20" height="20" fill="#155e75" />
                     </g>

                     {/* PACU (Bottom Right) */}
                     <g onClick={() => handleZoneClick('pacu')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="550" y="450" width="300" height="150" className={getZoneColor(activeZones.find(z=>z.id==='pacu')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'pacu' ? 3 : 1} />
                        <text x="700" y="525" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-sm font-bold">PACU (RECOVERY)</text>
                     </g>
                  </>
                )}

                {/* LEVEL 3: MED/SURG */}
                {currentFloor === 3 && (
                  <>
                     {/* H Shape Layout */}
                     <path d="M50,100 L850,100 L850,600 L50,600 L50,100 Z" fill="none" stroke="#0891b2" strokeWidth="4" />

                     {/* Left Wing (Services) */}
                     <rect x="50" y="100" width="150" height="500" fill="none" stroke="#164e63" strokeWidth="2" />
                     <text x="125" y="350" fill="#155e75" fontSize="14" className="font-mono" textAnchor="middle" transform="rotate(-90 125 350)">SERVICES / LOBBY</text>

                     {/* Ward 3A (Top) */}
                     <g onClick={() => handleZoneClick('ward_3a')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="200" y="100" width="450" height="200" className={getZoneColor(activeZones.find(z=>z.id==='ward_3a')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'ward_3a' ? 3 : 1} />
                        <text x="425" y="200" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold">UNIT 3A: GEN MED</text>
                        {/* Rooms */}
                        <path d="M200,150 L650,150" stroke="#164e63" strokeWidth="1" strokeDasharray="5,5" />
                        {[250, 300, 350, 400, 450, 500, 550, 600].map(x => (
                           <line key={x} x1={x} y1={100} x2={x} y2={150} stroke="#155e75" strokeWidth="1" />
                        ))}
                     </g>

                     {/* Ward 3B (Bottom) */}
                     <g onClick={() => handleZoneClick('ward_3b')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="200" y="400" width="450" height="200" className={getZoneColor(activeZones.find(z=>z.id==='ward_3b')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'ward_3b' ? 3 : 1} />
                        <text x="425" y="500" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold">UNIT 3B: ORTHO/NEURO</text>
                        {/* Rooms */}
                        <path d="M200,550 L650,550" stroke="#164e63" strokeWidth="1" strokeDasharray="5,5" />
                        {[250, 300, 350, 400, 450, 500, 550, 600].map(x => (
                           <line key={x} x1={x} y1={550} x2={x} y2={600} stroke="#155e75" strokeWidth="1" />
                        ))}
                     </g>

                     {/* Connecting Hallway */}
                     <rect x="200" y="300" width="450" height="100" fill="none" stroke="#164e63" strokeWidth="1" />
                     <text x="425" y="355" fill="#155e75" fontSize="10" className="font-mono" textAnchor="middle">CENTRAL CORRIDOR</text>

                     {/* Telemetry (Right) */}
                     <g onClick={() => handleZoneClick('telemetry')} className="cursor-pointer hover:brightness-125 transition-all">
                        <rect x="650" y="100" width="200" height="500" className={getZoneColor(activeZones.find(z=>z.id==='telemetry')?.status || Status.NORMAL)} strokeWidth={selectedZone?.id === 'telemetry' ? 3 : 1} />
                        <text x="750" y="350" fill="currentColor" textAnchor="middle" className="text-cyan-200 font-mono text-lg font-bold" transform="rotate(-90 750 350)">UNIT 3C: TELEMETRY</text>
                        <path d="M750,100 L750,600" stroke="#155e75" strokeWidth="1" strokeDasharray="2,2" />
                     </g>
                  </>
                )}
                
              </g>

            </svg>
          </div>
        </div>

        {/* RIGHT: DATA PANEL */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="bg-[#0b1221] border border-cyan-900/30 rounded-lg p-6 flex-1 shadow-2xl flex flex-col relative overflow-hidden">
            
            {/* Decorative Scan Line - Only Active when No Zone Selected */}
            {!selectedZone && (
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/50 shadow-[0_0_10px_#06b6d4] animate-scan opacity-20 pointer-events-none"></div>
            )}

            <h3 className="text-xs font-bold text-cyan-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
               <Activity className="w-3 h-3" /> Zone Telemetry
            </h3>
            
            {selectedZone ? (
              <div className="space-y-6 animate-fadeIn flex-1">
                <div className="flex items-center justify-between pb-4 border-b border-cyan-900/30">
                  <span className="text-xl font-bold text-cyan-100 font-mono tracking-tight">{selectedZone.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                     selectedZone.status === Status.CRITICAL ? 'bg-rose-950/30 text-rose-400 border-rose-500/50' :
                     selectedZone.status === Status.WARNING ? 'bg-amber-950/30 text-amber-400 border-amber-500/50' :
                     'bg-emerald-950/30 text-emerald-400 border-emerald-500/50'
                  }`}>{selectedZone.status}</span>
                </div>

                {/* Primary Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f172a] p-3 rounded border border-cyan-900/30 group hover:border-cyan-500/50 transition-colors">
                    <div className="text-cyan-600 text-[10px] uppercase mb-1 flex items-center gap-1">
                       <Users className="w-3 h-3" /> Census
                    </div>
                    <div className="text-xl font-mono text-cyan-100">{selectedZone.patients} <span className="text-xs text-cyan-700">/ {selectedZone.capacity}</span></div>
                  </div>
                  <div className="bg-[#0f172a] p-3 rounded border border-cyan-900/30 group hover:border-cyan-500/50 transition-colors">
                    <div className="text-cyan-600 text-[10px] uppercase mb-1 flex items-center gap-1">
                       <Clock className="w-3 h-3" /> Wait
                    </div>
                    <div className="text-xl font-mono text-cyan-100">{selectedZone.waitTime}</div>
                  </div>
                  <div className="bg-[#0f172a] p-3 rounded border border-cyan-900/30 group hover:border-cyan-500/50 transition-colors col-span-2">
                    <div className="flex justify-between items-center mb-1">
                       <div className="text-cyan-600 text-[10px] uppercase flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Load Factor
                       </div>
                       <div className="text-xs font-mono text-cyan-400">{selectedZone.occupancy}%</div>
                    </div>
                    <div className="h-1.5 w-full bg-cyan-950 rounded-full overflow-hidden">
                      <div 
                         className={`h-full rounded-full transition-all duration-1000 ${
                            selectedZone.occupancy > 90 ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' :
                            selectedZone.occupancy > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                         }`}
                         style={{ width: `${selectedZone.occupancy}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Staffing Detail */}
                <div className="bg-[#0f172a] p-4 rounded border border-cyan-900/30">
                   <div className="text-cyan-600 text-[10px] uppercase mb-2 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Active Personnel
                   </div>
                   <div className="text-cyan-100 font-mono text-sm border-l-2 border-cyan-500 pl-3">
                      {selectedZone.staffing}
                   </div>
                </div>

                {/* Dynamic Alert Box based on status */}
                {selectedZone.status === Status.CRITICAL && (
                   <div 
                     className="mt-auto bg-rose-950/10 border border-rose-900/30 p-3 rounded flex gap-3 animate-pulse-slow cursor-pointer hover:bg-rose-950/20 transition-colors"
                     onClick={() => onNavigateToActionBoard?.(selectedZone.name)}
                   >
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                      <div>
                         <h4 className="text-rose-400 text-xs font-bold uppercase mb-1">Threshold Exceeded</h4>
                         <p className="text-rose-200/60 text-[10px] font-mono leading-relaxed">
                           Load exceeds safety limits. Trigger capacity protocol immediately. Click to view actions.
                         </p>
                      </div>
                   </div>
                )}
                
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-cyan-800/40">
                 <div className="w-16 h-16 border border-current rounded-full flex items-center justify-center mb-4">
                    <MapIcon className="w-8 h-8" />
                 </div>
                 <p className="text-center text-xs font-mono uppercase tracking-widest">Select sector for analysis</p>
              </div>
            )}
          </div>

          <div className="bg-[#0b1221] border border-cyan-900/30 rounded-lg p-4 shadow-lg flex flex-col gap-4">
             <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-cyan-500">
                   <Thermometer className="w-4 h-4" />
                   <span>TOTAL CENSUS ({floors.find(f => f.id === currentFloor)?.short})</span>
                </div>
                <strong className="text-white text-lg">
                  {floorZones.reduce((acc, curr) => acc + curr.patients, 0)}
                  <span className="text-xs text-neutral-500 ml-1">PAX</span>
                </strong>
             </div>
             
             <button 
               onClick={() => setShowStaffModal(true)}
               className="w-full py-2.5 bg-cyan-900/50 hover:bg-cyan-800/50 text-cyan-300 border border-cyan-700/50 rounded font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02]"
             >
               <Users className="w-4 h-4" />
               Manage Personnel
             </button>

             {systemStatus === 'manual' && (
               <button 
                 onClick={() => setShowPrintModal(true)}
                 className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-amber-600/20 animate-in fade-in"
               >
                 <Printer className="w-4 h-4" />
                 Print Manual Action Plan
               </button>
             )}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 0.2; }
          90% { opacity: 0.2; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>

      <StaffManagementModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        zones={activeZones}
        onAssign={(assignments) => {
          if (showToast) showToast(`Successfully assigned ${assignments.length} personnel.`, 'success');
        }}
      />

      <PrintPreviewModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={() => {
          if (showToast) showToast('Print job sent to all department printers.', 'success');
        }}
        title="Hospital-Wide Manual Action Plan"
        content={
          <div className="space-y-6">
            <h2 className="text-xl font-bold border-b pb-2">Floor Status Overview</h2>
            {floors.map(f => {
              const fZones = activeZones.filter(z => z.floor === f.id);
              if (fZones.length === 0) return null;
              return (
                <div key={f.id} className="mb-4">
                  <h3 className="text-lg font-bold bg-gray-100 p-2 rounded mb-2">{f.name}</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">Zone</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Occupancy</th>
                        <th className="p-2">Patients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fZones.map(z => (
                        <tr key={z.id} className="border-b">
                          <td className="p-2 font-medium">{z.name}</td>
                          <td className="p-2">{z.status}</td>
                          <td className="p-2">{z.occupancy}%</td>
                          <td className="p-2">{z.patients} / {z.capacity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        }
      />

      {/* Patient Info Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-cyan-900/50 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-950">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-500" />
                Patient Information
              </h3>
              <button onClick={() => setSelectedPatient(null)} className="text-neutral-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-2xl font-bold text-cyan-100">{selectedPatient.name}</h4>
                  <p className="text-neutral-400 font-mono text-sm">{selectedPatient.id}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-widest border ${
                  selectedPatient.status === 'Critical' ? 'bg-rose-950/30 text-rose-400 border-rose-500/50' :
                  selectedPatient.status === 'Waiting' ? 'bg-amber-950/30 text-amber-400 border-amber-500/50' :
                  'bg-emerald-950/30 text-emerald-400 border-emerald-500/50'
                }`}>
                  {selectedPatient.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
                <div>
                  <p className="text-[10px] uppercase text-cyan-600 font-bold mb-1">DOB</p>
                  <p className="text-sm text-neutral-200">{selectedPatient.dob}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-cyan-600 font-bold mb-1">Acuity</p>
                  <p className="text-sm text-neutral-200">{selectedPatient.acuity}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-cyan-600 font-bold mb-1">Location</p>
                  <p className="text-sm text-neutral-200">{selectedPatient.location}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-cyan-600 font-bold mb-1">Admitted / Arrived</p>
                  <p className="text-sm text-neutral-200">{selectedPatient.admittedAt}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button 
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};