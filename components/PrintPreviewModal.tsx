import React from 'react';
import { X, Printer, FileText, AlertTriangle } from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  title: string;
  content: React.ReactNode;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  onPrint,
  title,
  content
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-950 rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-neutral-400" />
            Print Preview: {title}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors p-1 rounded hover:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-white text-black print-content">
          <div className="max-w-2xl mx-auto">
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold uppercase tracking-tight">{title}</h1>
                <p className="text-sm text-gray-600 mt-1">Generated: {new Date().toLocaleString()}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-xl">PULSE OPS</div>
                <div className="text-xs text-gray-500">CONFIDENTIAL</div>
              </div>
            </div>
            
            <div className="prose prose-sm max-w-none text-black">
              {content}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 rounded-b-xl flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-mono">
            <AlertTriangle className="w-4 h-4" />
            Ensure printer is online and loaded with paper.
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onPrint();
                onClose();
              }}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-amber-600/20"
            >
              <Printer className="w-4 h-4" />
              Confirm Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
