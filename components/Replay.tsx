import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Circle, Flag, AlertTriangle, MessageSquare, Activity, Plus } from 'lucide-react';
import { LogEvent } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const initialLogs: LogEvent[] = [
  { id: '1', time: '13:30', type: 'METRIC', description: 'ED Capacity crossed 90% threshold', detail: 'Triggered initial warning' },
  { id: '2', time: '13:45', type: 'NOTE', description: 'Nursing Supervisor noted call-outs for night shift', detail: '-2 RNs' },
  { id: '3', time: '14:00', type: 'METRIC', description: 'EMS Offload Time spiked to 45m', detail: '3 ambulances waiting' },
  { id: '4', time: '14:15', type: 'DECISION', description: 'Activated Surge Playbook Level 2', detail: 'Authorized by Dr. Chen' },
  { id: '5', time: '14:20', type: 'ACTION', description: 'Message sent to House Supervisor', detail: 'Requesting fast-track opening' },
];

const mockChartData = Array.from({ length: 100 }, (_, i) => {
  const time = new Date();
  time.setMinutes(time.getMinutes() - (100 - i));
  return {
    time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    saturation: 80 + Math.sin(i / 10) * 15 + (i / 10),
    index: i
  };
});

interface ReplayProps {
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const Replay: React.FC<ReplayProps> = ({ showToast }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderValue, setSliderValue] = useState(100);
  const [logs, setLogs] = useState<LogEvent[]>(initialLogs);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [newAnnotationText, setNewAnnotationText] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && sliderValue < 100) {
      interval = setInterval(() => {
        setSliderValue(prev => Math.min(prev + 1, 100));
      }, 100);
    } else if (sliderValue >= 100) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, sliderValue]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'METRIC': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'DECISION': return <Flag className="w-4 h-4 text-rose-500" />;
      case 'NOTE': return <MessageSquare className="w-4 h-4 text-blue-400" />;
      default: return <Circle className="w-4 h-4 text-neutral-400" />;
    }
  };

  const currentDataPoint = mockChartData[sliderValue === 100 ? 99 : sliderValue];

  const handleAddAnnotation = () => {
    if (!newAnnotationText.trim()) return;
    
    const newLog: LogEvent = {
      id: Date.now().toString(),
      time: currentDataPoint.time,
      type: 'NOTE',
      description: newAnnotationText,
      detail: 'Added during replay review'
    };
    
    setLogs([...logs, newLog]);
    setNewAnnotationText('');
    setIsAddingAnnotation(false);
    if (showToast) showToast('Annotation added to timeline', 'success');
  };

  return (
    <div className="h-full flex flex-col p-6">
      
      {/* Visualizer Area */}
      <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg mb-6 relative overflow-hidden flex flex-col">
         <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
           <h3 className="text-neutral-300 font-bold flex items-center gap-2">
             <Activity className="w-5 h-5 text-rose-500" />
             Historical Incident Replay
           </h3>
           <div className="text-xs font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
             T-{100 - sliderValue}m
           </div>
         </div>
         
         <div className="flex-1 flex relative p-4">
           {/* Chart Area */}
           <div className="flex-1 relative">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorSaturation" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                 <XAxis dataKey="time" stroke="#525252" fontSize={10} tickMargin={10} />
                 <YAxis stroke="#525252" fontSize={10} domain={[60, 120]} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', color: '#d4d4d4' }}
                   itemStyle={{ color: '#f43f5e' }}
                 />
                 <ReferenceLine x={currentDataPoint?.time} stroke="#f43f5e" strokeDasharray="3 3" />
                 <Area 
                   type="monotone" 
                   dataKey="saturation" 
                   stroke="#f43f5e" 
                   fillOpacity={1} 
                   fill="url(#colorSaturation)" 
                   isAnimationActive={false}
                 />
               </AreaChart>
             </ResponsiveContainer>
           </div>
           
           {/* Current Stats Overlay */}
           <div className="w-64 ml-4 flex flex-col justify-center items-center bg-neutral-950/50 rounded-lg border border-neutral-800 p-6">
              <h3 className="text-neutral-500 uppercase tracking-widest text-xs mb-4 text-center">System Saturation</h3>
              <div className="text-5xl font-mono font-bold text-white mb-2">
                 {currentDataPoint?.saturation.toFixed(1)}%
              </div>
              <div className="text-neutral-400 font-mono text-sm">{currentDataPoint?.time}</div>
           </div>
         </div>
      </div>

      {/* Controls */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 rounded-full bg-neutral-100 hover:bg-white text-neutral-900 flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            <div className="flex gap-2">
               <button onClick={() => setSliderValue(Math.max(0, sliderValue - 10))} className="p-2 hover:text-white text-neutral-500"><SkipBack className="w-5 h-5" /></button>
               <button onClick={() => setSliderValue(Math.min(100, sliderValue + 10))} className="p-2 hover:text-white text-neutral-500"><SkipForward className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="font-mono text-xl text-neutral-200 flex items-center gap-4">
            <div>
              {currentDataPoint?.time} <span className="text-neutral-600 text-sm ml-2">{sliderValue === 100 ? 'Live' : 'Replay'}</span>
            </div>
            <button 
              onClick={() => setIsAddingAnnotation(!isAddingAnnotation)}
              className="flex items-center gap-1 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-full border border-neutral-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Note
            </button>
          </div>
        </div>

        {isAddingAnnotation && (
          <div className="mb-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
            <input 
              type="text" 
              value={newAnnotationText}
              onChange={(e) => setNewAnnotationText(e.target.value)}
              placeholder="Add improvement note or annotation..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddAnnotation()}
            />
            <button 
              onClick={handleAddAnnotation}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
            >
              Save
            </button>
          </div>
        )}

        {/* Timeline Slider */}
        <div className="relative h-12 flex items-center">
          <div className="absolute inset-x-0 h-1 bg-neutral-800 rounded-full"></div>
          
          {/* Markers */}
          {logs.map((log) => {
             // Calculate position based on time roughly for demo
             // Assuming logs are within the 100 minute window
             const logTime = new Date(`1970/01/01 ${log.time}`);
             const now = new Date();
             const nowTime = new Date(`1970/01/01 ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
             // Simple mock positioning
             const diffMinutes = (nowTime.getTime() - logTime.getTime()) / 60000;
             const leftPos = Math.max(0, Math.min(100, 100 - diffMinutes));
             
             return (
               <div 
                  key={log.id} 
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-neutral-900 hover:bg-neutral-400 cursor-pointer group z-10 ${log.detail === 'Added during replay review' ? 'bg-purple-500' : 'bg-neutral-600'}`}
                  style={{ left: `${leftPos}%` }}
               >
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 bg-neutral-800 p-2 rounded border border-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                     <div className="flex items-center gap-2 text-xs text-neutral-300 font-bold mb-1">
                        {getIcon(log.type)} {log.time}
                     </div>
                     <div className="text-xs text-neutral-400">{log.description}</div>
                     {log.detail && <div className="text-[10px] text-neutral-500 mt-1 italic">{log.detail}</div>}
                  </div>
               </div>
             )
          })}

          <input 
            type="range" 
            min="0" 
            max="100" 
            value={sliderValue}
            onChange={(e) => setSliderValue(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
          />
          
          {/* Thumb Indicator (Visual only) */}
          <div 
             className="absolute top-1/2 -translate-y-1/2 w-1 bg-rose-500 h-8 pointer-events-none transition-all duration-75"
             style={{ left: `${sliderValue}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};