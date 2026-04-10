import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Users, PhoneCall, ShieldAlert, CheckCircle2, Clock, MapPin, Search, Filter, MessageSquare } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'On Shift' | 'On Break' | 'Off Duty' | 'On Call';
  hoursWorked: number;
  contact: string;
  location: string;
}

const mockStaff: StaffMember[] = [
  { id: 'RN-101', name: 'Sarah Jenkins', role: 'Charge Nurse', department: 'Emergency', status: 'On Shift', hoursWorked: 8.5, contact: 'Ext 4421', location: 'Triage' },
  { id: 'RN-102', name: 'Michael Chang', role: 'Staff Nurse', department: 'Emergency', status: 'On Shift', hoursWorked: 4.0, contact: 'Ext 4422', location: 'Acute Care Pods' },
  { id: 'MD-201', name: 'Dr. Emily Chen', role: 'Attending', department: 'Emergency', status: 'On Shift', hoursWorked: 10.2, contact: 'Pager 881', location: 'Trauma Bay' },
  { id: 'RN-103', name: 'Jessica Alba', role: 'Staff Nurse', department: 'ICU', status: 'On Break', hoursWorked: 6.5, contact: 'Ext 5510', location: 'Break Room B' },
  { id: 'MD-202', name: 'Dr. Robert Smith', role: 'Surgeon', department: 'Surgery', status: 'On Call', hoursWorked: 0, contact: '555-0192', location: 'Off-site' },
  { id: 'TECH-301', name: 'David Miller', role: 'Rad Tech', department: 'Imaging', status: 'On Shift', hoursWorked: 2.5, contact: 'Ext 3311', location: 'CT Room 1' },
  { id: 'RN-104', name: 'Amanda Lewis', role: 'Staff Nurse', department: 'Med/Surg', status: 'Off Duty', hoursWorked: 0, contact: '555-0188', location: 'Off-site' },
  { id: 'SEC-401', name: 'James Wilson', role: 'Security', department: 'Operations', status: 'On Shift', hoursWorked: 7.0, contact: 'Radio Ch 2', location: 'ED Entrance' },
];

interface RosterProps {
  currentUser: UserProfile | null;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const Roster: React.FC<RosterProps> = ({ showToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');

  const departments = ['All', ...Array.from(new Set(mockStaff.map(s => s.department)))];

  const filteredStaff = mockStaff.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(searchQuery.toLowerCase()) || staff.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'All' || staff.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On Shift': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'On Break': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'On Call': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20';
    }
  };

  return (
    <div className="h-full flex flex-col p-6 bg-black">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-purple-400" />
            Staffing & Roster
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Real-time personnel tracking and deployment</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded px-3 py-2 w-64">
            <Search className="w-4 h-4 text-neutral-500 mr-2" />
            <input 
              type="text" 
              placeholder="Search staff..." 
              className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-neutral-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
            <Filter className="w-4 h-4 text-neutral-500 mr-2" />
            <select 
              className="bg-transparent border-none outline-none text-sm text-white cursor-pointer"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              {departments.map(d => (
                <option key={d} value={d} className="bg-neutral-900">{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Total On Shift</p>
            <p className="text-2xl font-bold text-white">{mockStaff.filter(s => s.status === 'On Shift').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">On Break</p>
            <p className="text-2xl font-bold text-white">{mockStaff.filter(s => s.status === 'On Break').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">On Call (Available)</p>
            <p className="text-2xl font-bold text-white">{mockStaff.filter(s => s.status === 'On Call').length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <PhoneCall className="w-5 h-5 text-blue-500" />
          </div>
        </div>
        <div className="bg-neutral-900 border border-rose-900/50 rounded-xl p-4 flex items-center justify-between relative overflow-hidden group cursor-pointer hover:border-rose-500/50 transition-colors">
          <div className="absolute inset-0 bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors"></div>
          <div className="relative z-10">
            <p className="text-xs text-rose-400 uppercase tracking-widest mb-1 font-bold">Critical Shortage</p>
            <p className="text-sm text-neutral-300">ICU RN (-1)</p>
          </div>
          <div className="relative z-10 w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-neutral-800 bg-neutral-950 text-xs font-bold text-neutral-500 uppercase tracking-widest">
          <div className="col-span-3">Personnel</div>
          <div className="col-span-2">Department</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-1 text-center">Hours</div>
          <div className="col-span-2 text-right">Contact</div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredStaff.map(staff => (
            <div key={staff.id} className="grid grid-cols-12 gap-4 p-4 border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors items-center group">
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300">
                  {staff.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{staff.name}</div>
                  <div className="text-xs text-neutral-500">{staff.role}</div>
                </div>
              </div>
              <div className="col-span-2 text-sm text-neutral-300">{staff.department}</div>
              <div className="col-span-2">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(staff.status)}`}>
                  {staff.status}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-1 text-sm text-neutral-400">
                <MapPin className="w-3 h-3" /> {staff.location}
              </div>
              <div className="col-span-1 text-center text-sm font-mono text-neutral-300">
                {staff.hoursWorked > 0 ? `${staff.hoursWorked}h` : '-'}
              </div>
              <div className="col-span-2 flex items-center justify-end gap-3">
                <span className="text-sm font-mono text-neutral-400">{staff.contact}</span>
                <button 
                  onClick={() => {
                    if (showToast) showToast(`Message sent to ${staff.name}`, 'success');
                  }}
                  className="p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700 rounded transition-colors opacity-0 group-hover:opacity-100" 
                  title="Send Message"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredStaff.length === 0 && (
            <div className="p-8 text-center text-neutral-500">
              No personnel found matching your criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
