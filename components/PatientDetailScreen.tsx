import React, { useState } from 'react';
import { 
  ChevronLeft, Save, ShieldAlert, Activity, Pill, FileText, 
  Scale, Thermometer, AlertTriangle, Syringe, Heart, Droplet, 
  Wind, Plus, CheckCircle2, User, CreditCard, Clock, ScanLine, ListTodo, Droplets
} from 'lucide-react';

interface PatientDetailScreenProps {
  patient: any;
  onClose: () => void;
  onSave: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const BentoSection = ({ title, icon: Icon, children, action }: any) => (
  <div className="bg-white/[0.04] border border-white/[0.08] rounded-[32px] p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl mb-5">
    <div className="bg-white/[0.03] rounded-[24px] p-5 border border-white/[0.05] shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#0A84FF]" />
          <h2 className="text-[16px] font-bold text-white tracking-tight">{title}</h2>
        </div>
        {action && action}
      </div>
      {children}
    </div>
  </div>
);

const InputField = ({ label, defaultValue, type = "text", unit = "", placeholder = "" }: any) => (
  <div className="flex-1">
    <label className="text-[12px] font-bold text-white/40 mb-1.5 block uppercase tracking-widest pl-1">{label}</label>
    <div className="relative">
      <input 
        type={type} 
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-black/40 border border-white/[0.08] rounded-[16px] px-4 py-3.5 text-white font-semibold text-[17px] focus:outline-none focus:border-[#0A84FF] focus:bg-white/[0.05] transition-all shadow-inner placeholder:text-white/20" 
      />
      {unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-white/30">{unit}</span>}
    </div>
  </div>
);

export const PatientDetailScreen: React.FC<PatientDetailScreenProps> = ({ patient, onClose, onSave, showToast }) => {
  const [painScore, setPainScore] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuarantorSame, setIsGuarantorSame] = useState(true);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      onSave();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#000000] text-white overflow-hidden flex flex-col animate-in slide-in-from-right-full duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif' }}>
      
      {/* Background Textures */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.04] via-black to-black pointer-events-none z-0"></div>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-14 pb-4 shrink-0 z-30 bg-black/60 backdrop-blur-[50px] backdrop-saturate-[180%] border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <button onClick={onClose} className="flex items-center gap-1 text-[#0A84FF] active:opacity-50 transition-opacity px-2 py-1">
          <ChevronLeft className="w-7 h-7 -ml-2" />
          <span className="text-[17px] font-semibold">Back</span>
        </button>
        <div className="flex flex-col items-center">
          <h1 className="font-bold text-[17px] text-white tracking-tight">{patient.name}</h1>
          <span className="text-[12px] font-semibold text-white/50 tracking-wide">{patient.mrn}</span>
        </div>
        <button onClick={handleSave} className="text-[#0A84FF] font-bold text-[17px] px-2 py-1 active:opacity-50 transition-opacity">
          {isSaving ? <Activity className="w-5 h-5 animate-spin" /> : 'Save'}
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-6 pb-32 relative z-10 scroll-smooth">
        
        {/* Patient Banner */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-[20px] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-1">Age / Sex</span>
            <span className="text-[20px] font-bold text-white tracking-tight">{patient.age}</span>
          </div>
          <div className={`flex-1 border rounded-[20px] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl flex flex-col items-center justify-center ${patient.code.includes('DNR') ? 'bg-[#BF5AF2]/10 border-[#BF5AF2]/30 text-[#BF5AF2]' : 'bg-white/[0.05] border-white/[0.08] text-white'}`}>
            <span className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${patient.code.includes('DNR') ? 'text-[#BF5AF2]/60' : 'text-white/40'}`}>Code Status</span>
            <span className="text-[20px] font-bold tracking-tight">{patient.code}</span>
          </div>
          <div className="flex-1 bg-rose-500/10 border border-rose-500/30 rounded-[20px] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl flex flex-col items-center justify-center text-rose-500">
            <span className="text-[11px] font-bold text-rose-500/60 uppercase tracking-widest mb-1">Acuity</span>
            <span className="text-[20px] font-bold tracking-tight">ESI 2</span>
          </div>
        </div>

        {/* Intake / Flowsheet */}
        <BentoSection title="Intake & Measurements" icon={Scale}>
          <div className="flex gap-3 mb-4">
            <InputField label="Height" defaultValue="178" unit="cm" type="number" />
            <InputField label="Weight" defaultValue="82.5" unit="kg" type="number" />
            <div className="flex-1">
              <label className="text-[12px] font-bold text-white/40 mb-1.5 block uppercase tracking-widest pl-1">BMI</label>
              <div className="w-full bg-white/[0.02] border border-white/[0.05] rounded-[16px] px-4 py-3.5 text-[#34C759] font-bold text-[17px] flex items-center justify-between">
                26.0 <span className="text-[12px] font-bold bg-[#34C759]/20 px-2 py-0.5 rounded-md">Overweight</span>
              </div>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="text-[12px] font-bold text-white/40 mb-2 block uppercase tracking-widest pl-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Pain Scale (0-10)
            </label>
            <div className="bg-black/40 border border-white/[0.08] rounded-[20px] p-4 shadow-inner">
              <div className="flex justify-between mb-2 px-1">
                <span className="text-[14px] font-bold text-[#34C759]">0</span>
                <span className="text-[24px] font-bold text-white tabular-nums drop-shadow-md">{painScore}</span>
                <span className="text-[14px] font-bold text-[#FF453A]">10</span>
              </div>
              <input 
                type="range" 
                min="0" max="10" 
                value={painScore}
                onChange={(e) => setPainScore(parseInt(e.target.value))}
                className="w-full accent-[#0A84FF] h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Temp" defaultValue="37.2" unit="°C" type="number" />
            <InputField label="Resp Rate" defaultValue="18" unit="bpm" type="number" />
          </div>
        </BentoSection>

        {/* I&O (Intake & Output) */}
        <BentoSection title="I&O (Intake & Output)" icon={Droplets}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[#32ADE6]/10 border border-[#32ADE6]/20 rounded-[20px] p-4 shadow-inner">
              <div className="text-[12px] font-bold text-[#32ADE6]/60 uppercase tracking-widest mb-1">Total Intake</div>
              <div className="text-[24px] font-bold text-[#32ADE6] tabular-nums">1250 <span className="text-[14px] text-[#32ADE6]/60">mL</span></div>
              <div className="text-[12px] font-semibold text-[#32ADE6]/40 mt-1">PO: 250mL | IV: 1000mL</div>
            </div>
            <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-[20px] p-4 shadow-inner">
              <div className="text-[12px] font-bold text-[#FF9F0A]/60 uppercase tracking-widest mb-1">Total Output</div>
              <div className="text-[24px] font-bold text-[#FF9F0A] tabular-nums">800 <span className="text-[14px] text-[#FF9F0A]/60">mL</span></div>
              <div className="text-[12px] font-semibold text-[#FF9F0A]/40 mt-1">Void: 800mL</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => showToast('Add Intake dialog opened', 'info')} className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-3 rounded-[16px] text-[14px] font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Intake
            </button>
            <button onClick={() => showToast('Add Output dialog opened', 'info')} className="flex-1 bg-white/[0.05] border border-white/[0.1] text-white py-3 rounded-[16px] text-[14px] font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Output
            </button>
          </div>
        </BentoSection>

        {/* Clinical Profile */}
        <BentoSection title="Clinical Profile" icon={FileText}>
          <div className="mb-5">
            <label className="text-[12px] font-bold text-white/40 mb-1.5 block uppercase tracking-widest pl-1">Chief Complaint</label>
            <textarea 
              defaultValue={patient.notes}
              className="w-full bg-black/40 border border-white/[0.08] rounded-[20px] px-4 py-3.5 text-white font-medium text-[16px] focus:outline-none focus:border-[#0A84FF] focus:bg-white/[0.05] transition-all shadow-inner min-h-[100px] resize-none leading-relaxed" 
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 pl-1">
              <label className="text-[12px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Allergies
              </label>
              <button onClick={() => showToast('Add Allergy dialog opened', 'info')} className="text-[#0A84FF] text-[13px] font-bold flex items-center gap-1 active:opacity-50">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-500 px-3.5 py-2 rounded-xl text-[14px] font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.15)]">
                Penicillin <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              </div>
              <div className="bg-white/[0.06] border border-white/[0.1] text-white/80 px-3.5 py-2 rounded-xl text-[14px] font-semibold">
                Latex
              </div>
            </div>
          </div>
        </BentoSection>

        {/* Medications */}
        <BentoSection 
          title="Medications (MAR)" 
          icon={Pill}
          action={<button onClick={() => showToast('Barcode Scanner Activated', 'info')} className="bg-[#0A84FF]/15 text-[#0A84FF] px-3 py-1.5 rounded-full text-[13px] font-bold border border-[#0A84FF]/30 active:scale-95 transition-transform flex items-center gap-1.5"><ScanLine className="w-4 h-4" /> Scan to Admin</button>}
        >
          <div className="space-y-3">
            <div className="bg-black/40 border border-white/[0.05] rounded-[16px] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-[#34C759]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-white">Ondansetron (Zofran)</h4>
                  <p className="text-[13px] font-semibold text-white/50">4mg IV Push • Given 14:30</p>
                </div>
              </div>
            </div>
            
            <div className="bg-black/40 border border-white/[0.05] rounded-[16px] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-white/40">
                  <Syringe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-white">Morphine Sulfate</h4>
                  <p className="text-[13px] font-semibold text-white/50">2mg IV Push • Due 16:00</p>
                </div>
              </div>
              <button onClick={() => showToast('Medication administered', 'success')} className="bg-[#0A84FF]/15 text-[#0A84FF] px-4 py-1.5 rounded-full text-[13px] font-bold border border-[#0A84FF]/30 active:scale-95 transition-transform">
                Administer
              </button>
            </div>
          </div>
        </BentoSection>

        {/* Nursing Orders & Tasks */}
        <BentoSection title="Nursing Orders" icon={ListTodo}>
          <div className="space-y-2">
            {[
              { task: "Turn patient q2h", time: "15:00", status: "pending", type: "routine" },
              { task: "Neuro check q1h", time: "15:30", status: "pending", type: "stat" },
              { task: "Draw CBC & BMP", time: "14:00", status: "completed", type: "routine" }
            ].map((order, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-[16px] p-3.5">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => showToast(`Order marked as ${order.status === 'completed' ? 'pending' : 'completed'}`, 'success')}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${order.status === 'completed' ? 'bg-[#34C759] border-[#34C759] text-white' : 'border-white/20 text-transparent'}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <div>
                    <div className={`text-[15px] font-semibold ${order.status === 'completed' ? 'text-white/40 line-through' : 'text-white'}`}>{order.task}</div>
                    <div className="text-[12px] font-medium text-white/40 mt-0.5 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Due {order.time}
                    </div>
                  </div>
                </div>
                {order.type === 'stat' && order.status !== 'completed' && (
                  <span className="bg-rose-500/15 text-rose-500 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border border-rose-500/30">STAT</span>
                )}
              </div>
            ))}
          </div>
        </BentoSection>

        {/* Admin & Insurance */}
        <BentoSection title="Admin & Insurance" icon={CreditCard}>
          <div className="space-y-4">
            <InputField label="Primary Insurance" defaultValue="BlueCross BlueShield" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Member ID" defaultValue="XYZ123456789" />
              <InputField label="Group Number" defaultValue="98765" />
            </div>
            <div className="pt-2 border-t border-white/[0.05]">
              <div className="flex items-center justify-between py-2">
                <span className="text-[15px] font-semibold text-white/70">Guarantor Same as Patient</span>
                <button 
                  onClick={() => setIsGuarantorSame(!isGuarantorSame)}
                  className={`w-12 h-7 rounded-full relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-300 ${isGuarantorSame ? 'bg-[#34C759]' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${isGuarantorSame ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </BentoSection>

      </main>
    </div>
  );
};
