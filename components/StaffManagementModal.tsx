import React, { useMemo, useState } from 'react';
import { X, Users, Bot, CheckCircle2, GripVertical } from 'lucide-react';
import { createGeminiClient } from '../lib/gemini';

interface Staff {
  id: string;
  name: string;
  role: string;
  currentZone: string | null;
}

interface Zone {
  id: string;
  name: string;
  occupancy: number;
}

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  zones: Zone[];
  onAssign: (assignments: { staffId: string; zoneId: string }[]) => void;
}

const MOCK_STAFF: Staff[] = [
  { id: 's1', name: 'Dr. Sarah Jenkins', role: 'Attending', currentZone: null },
  { id: 's2', name: 'Dr. Michael Chen', role: 'Resident', currentZone: null },
  { id: 's3', name: 'Nurse Emily Davis', role: 'RN', currentZone: null },
  { id: 's4', name: 'Nurse James Wilson', role: 'RN', currentZone: null },
  { id: 's5', name: 'Tech Robert Brown', role: 'Tech', currentZone: null },
  { id: 's6', name: 'Tech Lisa Taylor', role: 'Tech', currentZone: null },
  { id: 's7', name: 'Dr. Amanda White', role: 'Attending', currentZone: null },
  { id: 's8', name: 'Nurse David Lee', role: 'RN', currentZone: null },
];

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({ isOpen, onClose, zones, onAssign }) => {
  const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isAIAssigning, setIsAIAssigning] = useState(false);
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null);

  // Initialize Gemini client safely. If unavailable, AI auto-assign degrades
  // to a disabled button.
  const { client: ai } = useMemo(() => createGeminiClient(), []);

  if (!isOpen) return null;

  const handleToggleStaff = (id: string) => {
    const newSet = new Set(selectedStaffIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStaffIds(newSet);
  };

  const handleAssignSelected = () => {
    if (selectedStaffIds.size === 0 || !selectedZoneId) return;
    
    const assignments = Array.from(selectedStaffIds).map(id => ({
      staffId: id,
      zoneId: selectedZoneId
    }));
    
    applyAssignments(assignments);
    setSelectedStaffIds(new Set());
  };

  const applyAssignments = (assignments: { staffId: string; zoneId: string }[]) => {
    setStaff(prev => prev.map(s => {
      const assignment = assignments.find(a => a.staffId === s.id);
      if (assignment) {
        return { ...s, currentZone: assignment.zoneId };
      }
      return s;
    }));
    onAssign(assignments);
  };

  const handleAIAssign = async () => {
    if (!ai) {
      console.warn('AI Auto-Assign is unavailable: Gemini API key is not configured.');
      return;
    }
    setIsAIAssigning(true);
    try {
      const prompt = `
        You are an AI hospital operations manager. Assign the following unassigned staff to the following zones based on occupancy.
        Higher occupancy zones need more staff, especially RNs and Attendings.
        
        Unassigned Staff:
        ${staff.filter(s => !s.currentZone).map(s => `- ${s.id}: ${s.name} (${s.role})`).join('\n')}
        
        Zones:
        ${zones.map(z => `- ${z.id}: ${z.name} (Occupancy: ${z.occupancy}%)`).join('\n')}
        
        Return ONLY a JSON array of assignments in this exact format:
        [{"staffId": "s1", "zoneId": "z1"}, ...]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const assignments = JSON.parse(response.text || '[]');
      if (Array.isArray(assignments)) {
        applyAssignments(assignments);
      }
    } catch (error) {
      console.error("AI Assignment failed:", error);
    } finally {
      setIsAIAssigning(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedStaffId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, zoneId: string) => {
    e.preventDefault();
    const staffId = e.dataTransfer.getData('text/plain');
    if (staffId && zoneId) {
      applyAssignments([{ staffId, zoneId }]);
    }
    setDraggedStaffId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-cyan-500" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Live Ops Personnel Management</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleAIAssign}
              disabled={isAIAssigning || !ai}
              title={!ai ? 'AI offline — VITE_GEMINI_API_KEY not set' : undefined}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
            >
              {isAIAssigning ? <span className="animate-pulse">Analyzing Load...</span> : <><Bot className="w-4 h-4" /> AI Auto-Assign{!ai ? ' (offline)' : ''}</>}
            </button>
            <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Staff Pool */}
          <div className="w-1/3 border-r border-neutral-800 flex flex-col bg-neutral-950/50">
            <div className="p-3 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Available Personnel</h3>
              <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">{staff.filter(s => !s.currentZone).length} Unassigned</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {staff.filter(s => !s.currentZone).map(s => (
                <div 
                  key={s.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, s.id)}
                  onClick={() => handleToggleStaff(s.id)}
                  className={`p-3 rounded border cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors ${
                    selectedStaffIds.has(s.id) 
                      ? 'bg-cyan-900/30 border-cyan-500/50' 
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="text-neutral-500 cursor-grab"><GripVertical className="w-4 h-4" /></div>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedStaffIds.has(s.id) ? 'bg-cyan-500 border-cyan-500' : 'border-neutral-600'}`}>
                    {selectedStaffIds.has(s.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{s.name}</div>
                    <div className="text-xs text-neutral-500">{s.role}</div>
                  </div>
                </div>
              ))}
              {staff.filter(s => !s.currentZone).length === 0 && (
                <div className="text-center p-8 text-neutral-600 text-sm">All personnel assigned.</div>
              )}
            </div>
            
            {/* Bulk Assign Controls */}
            {selectedStaffIds.size > 0 && (
              <div className="p-3 border-t border-neutral-800 bg-neutral-900">
                <div className="text-xs text-neutral-400 mb-2">{selectedStaffIds.size} selected</div>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
                    value={selectedZoneId}
                    onChange={e => setSelectedZoneId(e.target.value)}
                  >
                    <option value="">Select Zone...</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name} ({z.occupancy}% Load)</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAssignSelected}
                    disabled={!selectedZoneId}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded text-sm font-medium transition-colors"
                  >
                    Assign
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Zones */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0b1221]">
            <div className="grid grid-cols-2 gap-4">
              {zones.map(zone => (
                <div 
                  key={zone.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, zone.id)}
                  className={`bg-neutral-900/80 border rounded-lg p-4 flex flex-col transition-colors ${
                    draggedStaffId ? 'border-dashed border-cyan-500/50 bg-cyan-950/10' : 'border-neutral-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">{zone.name}</h4>
                      <div className="text-xs text-neutral-500 mt-1">Drop personnel here</div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                      zone.occupancy > 90 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      zone.occupancy > 75 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {zone.occupancy}% Load
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2 min-h-[100px]">
                    {staff.filter(s => s.currentZone === zone.id).map(s => (
                      <div key={s.id} className="bg-neutral-950 border border-neutral-800 rounded p-2 flex justify-between items-center group">
                        <div>
                          <div className="text-sm text-neutral-200">{s.name}</div>
                          <div className="text-[10px] text-neutral-500 uppercase">{s.role}</div>
                        </div>
                        <button 
                          onClick={() => applyAssignments([{ staffId: s.id, zoneId: '' }])} // Unassign
                          className="text-neutral-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Unassign"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {staff.filter(s => s.currentZone === zone.id).length === 0 && (
                      <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-800 rounded text-neutral-600 text-xs uppercase tracking-widest">
                        No Staff Assigned
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
