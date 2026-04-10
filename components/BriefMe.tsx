import React, { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { ROLE_INSIGHTS } from '../data/userProfiles';

interface BriefMeProps {
  isSurgeActive: boolean;
  currentUser: UserProfile;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const BriefMe: React.FC<BriefMeProps> = ({ isSurgeActive, currentUser, showToast }) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [briefingGenerated, setBriefingGenerated] = useState(false);
  
  const insights = ROLE_INSIGHTS[currentUser.role];

  // Simulate AI generation time
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isSurgeActive, currentUser]);

  const handleCopy = () => {
    setCopied(true);
    if (showToast) showToast('Briefing copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateBriefing = () => {
    setLoading(true);
    if (showToast) showToast('Generating Executive Briefing...', 'info');
    setTimeout(() => {
      setLoading(false);
      setBriefingGenerated(true);
      if (showToast) showToast('Executive Briefing generated successfully', 'success');
      setTimeout(() => setBriefingGenerated(false), 3000);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-medium mb-4">
              <Sparkles className="w-3 h-3" />
              <span>AI-Generated Situation Report</span>
           </div>
           <h2 className="text-3xl font-bold text-white mb-2">Operational Handoff</h2>
           <p className="text-neutral-400">Condensed summary for {currentUser.role} (SBAR Format)</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl relative">
          
          {loading ? (
             <div className="h-64 flex flex-col items-center justify-center gap-4 text-neutral-500">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                <span className="font-mono text-sm animate-pulse">Synthesizing metrics for {currentUser.name}...</span>
             </div>
          ) : (
             <div className="p-8 font-mono text-sm leading-relaxed text-neutral-300">
                {isSurgeActive ? (
                  <>
                     <p className="mb-4">
                        <span className="text-purple-400 font-bold">SITUATION:</span> <span className="text-emerald-400">Surge Protocol Level 2 is ACTIVE.</span> {insights.situation}
                     </p>
                     <p className="mb-4">
                        <span className="text-purple-400 font-bold">BACKGROUND:</span> {insights.background}
                     </p>
                     <p className="mb-4">
                        <span className="text-purple-400 font-bold">ASSESSMENT:</span> {insights.assessment}
                     </p>
                     <p>
                        <span className="text-purple-400 font-bold">RECOMMENDATION:</span>
                        <br/>{insights.recommendation}
                     </p>
                  </>
                ) : (
                  <>
                     <p className="mb-4">
                     <span className="text-purple-400 font-bold">SITUATION:</span> {insights.situation}
                     </p>
                     <p className="mb-4">
                     <span className="text-purple-400 font-bold">BACKGROUND:</span> {insights.background}
                     </p>
                     <p className="mb-4">
                     <span className="text-purple-400 font-bold">ASSESSMENT:</span> {insights.assessment}
                     </p>
                     <p>
                     <span className="text-purple-400 font-bold">RECOMMENDATION:</span>
                     <br/>{insights.recommendation}
                     </p>
                  </>
                )}
             </div>
          )}

          <div className="bg-black p-4 flex justify-between items-center border-t border-neutral-800">
            <span className="text-xs text-neutral-500">Generated based on real-time telemetry</span>
            <div className="flex gap-2">
              {currentUser.role === 'Floor Manager' && (
                <button 
                  onClick={handleGenerateBriefing}
                  className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-all ${
                    briefingGenerated 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {briefingGenerated ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {briefingGenerated ? 'BRIEFING SENT TO C-SUITE' : 'GENERATE EXECUTIVE BRIEFING'}
                </button>
              )}
              <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-all ${
                  copied 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'COPIED TO CLIPBOARD' : 'COPY SUMMARY'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};