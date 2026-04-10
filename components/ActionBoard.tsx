import React, { useState, useMemo, useEffect } from 'react';
import { ActionItem, UserProfile } from '../types';
import { Plus, AlertCircle, Clock, Printer, MessageSquare, History, Send, X, Search, AlertOctagon } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';
import { ROLE_ACTIONS } from '../data/userProfiles';
import { PrintPreviewModal } from './PrintPreviewModal';

import { USERS } from '../data/userProfiles';

interface ActionBoardProps {
  currentUser: UserProfile;
  systemStatus?: 'normal' | 'stale' | 'manual';
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  initialFilter?: string;
  isSurgeActive?: boolean;
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const styles = {
    High: 'text-rose-400 bg-rose-400/10 border-rose-400/20 shadow-lg shadow-rose-500/20',
    Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    Low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  };
  return (
    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${styles[priority as keyof typeof styles]}`}>
      {priority}
    </span>
  );
};

const ActionCard: React.FC<{ action: ActionItem, index: number, onClick: (action: ActionItem) => void, isSurgeActive?: boolean }> = ({ action, index, onClick, isSurgeActive }) => {
  const isLowPriority = action.priority === 'Low';
  const surgeDim = isSurgeActive && isLowPriority ? 'opacity-40 grayscale' : '';

  return (
    <Draggable draggableId={action.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(action)}
          className={`bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 p-4 rounded-xl hover:border-neutral-500 transition-all hover:bg-neutral-800 group shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200 relative cursor-pointer ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-cyan-500/50 z-50 scale-105' : ''} ${surgeDim}`}
          style={provided.draggableProps.style}
        >
          <div className="flex justify-between items-start mb-3">
            <PriorityBadge priority={action.priority} />
          </div>
          <h4 className="text-sm font-medium text-neutral-100 mb-3 leading-snug">{action.title}</h4>
          <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-700/50 pt-3">
            <span className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-300 border border-neutral-600">
                 {action.owner.charAt(0)}
              </div>
              {action.owner}
            </span>
            <span className={`flex items-center gap-1 font-mono ${action.status === 'On Hold' ? 'text-rose-400' : ''}`}>
              <Clock className="w-3 h-3" />
              {action.dueTime}
            </span>
          </div>
          {action.status === 'On Hold' && (
            <div className="mt-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 text-xs p-2 rounded flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Waiting on approval
            </div>
          )}
          {action.status === 'Canceled' && action.cancelReason && (
            <div className="mt-3 bg-neutral-900/50 border border-neutral-700/50 text-neutral-400 text-xs p-2 rounded flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> {action.cancelReason}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

const Column = ({ title, status, items, onActionClick, isSurgeActive }: { title: string, status: string, items: ActionItem[], onActionClick: (action: ActionItem) => void, isSurgeActive?: boolean }) => {
  const borderColor = status === 'On Hold' || status === 'Canceled' ? 'border-rose-900/30' : 'border-neutral-800';
  const bgGradient = status === 'On Hold' || status === 'Canceled' ? 'from-rose-950/10 to-transparent' : 'from-neutral-900 to-neutral-900/50';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`bg-gradient-to-b ${bgGradient} border ${borderColor} rounded-lg flex flex-col h-full shadow-inner min-w-[280px]`}
    >
      <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <span 
             className={`w-2 h-2 rounded-full ${
               status === 'New' ? 'bg-blue-500 text-blue-500' : 
               status === 'In Progress' ? 'bg-amber-500 text-amber-500' :
               status === 'On Hold' || status === 'Canceled' ? 'bg-rose-500 text-rose-500' : 'bg-emerald-500 text-emerald-500'
             }`}
             style={{ boxShadow: '0 0 8px currentColor' }}
           ></span>
           <h3 className="text-sm font-bold text-neutral-300 uppercase tracking-wide">{title}</h3>
        </div>
        <span className="bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs px-2 py-0.5 rounded-full font-mono">{items.length}</span>
      </div>
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar transition-colors ${snapshot.isDraggingOver ? 'bg-neutral-800/50' : ''}`}
          >
            {items.map((action, index) => (
              <ActionCard key={action.id} action={action} index={index} onClick={onActionClick} isSurgeActive={isSurgeActive} />
            ))}
            {provided.placeholder}
            {status === 'New' && (
              <button className="w-full py-4 border border-dashed border-neutral-700 rounded text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800 transition-all text-xs font-medium flex items-center justify-center gap-2">
                <Plus className="w-3 h-3" /> ADD ACTION
              </button>
            )}
          </div>
        )}
      </Droppable>
    </motion.div>
  );
};

export const ActionBoard: React.FC<ActionBoardProps> = ({ currentUser, systemStatus = 'normal', showToast, initialFilter = '', isSurgeActive = false }) => {
  const [actions, setActions] = useState<ActionItem[]>(ROLE_ACTIONS[currentUser.role]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');
  const [searchQuery, setSearchQuery] = useState(initialFilter);

  // Reset actions if user changes
  useEffect(() => {
    setActions(ROLE_ACTIONS[currentUser.role]);
  }, [currentUser.role]);

  // Update search query if initialFilter changes
  useEffect(() => {
    setSearchQuery(initialFilter);
  }, [initialFilter]);

  // Add Surge Protocol action if surge is activated
  useEffect(() => {
    if (isSurgeActive) {
      setActions(prev => {
        if (prev.some(a => a.title === 'SURGE PROTOCOL ACTIVATED')) return prev;
        return [{
          id: `surge-${Date.now()}`,
          title: 'SURGE PROTOCOL ACTIVATED',
          description: 'System-wide surge protocol is active. All non-essential tasks are suspended. Focus on critical patient throughput and capacity management.',
          status: 'New',
          priority: 'Critical',
          owner: 'System',
          dueTime: 'IMMEDIATE',
          history: [{ timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), action: 'Surge Protocol Auto-Generated', user: 'System' }]
        }, ...prev];
      });
    }
  }, [isSurgeActive]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    let movedToNewStatus = false;
    let newStatusName = '';

    setActions(prev => {
      const next = Array.from(prev);
      const draggedIndex = next.findIndex(a => a.id === draggableId);
      if (draggedIndex === -1) return prev;
      
      const [removed] = next.splice(draggedIndex, 1);
      const newStatus = destination.droppableId as ActionItem['status'];
      
      if (source.droppableId !== destination.droppableId) {
        removed.status = newStatus;
        removed.history = [
          ...(removed.history || []),
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            action: `Status changed to ${newStatus} (via drag)`,
            user: currentUser.name
          }
        ];
        movedToNewStatus = true;
        newStatusName = newStatus;
      }

      const destItems = next.filter(a => a.status === destination.droppableId);
      if (destination.index >= destItems.length) {
        next.push(removed);
      } else {
        const targetItem = destItems[destination.index];
        const targetIndex = next.findIndex(a => a.id === targetItem.id);
        next.splice(targetIndex, 0, removed);
      }
      
      return next;
    });

    if (movedToNewStatus && showToast) {
      showToast(`Action moved to ${newStatusName}`, 'info');
    }
  };

  const handleStatusChange = (id: string, newStatus: ActionItem['status'], reason?: string) => {
    let updatedActionRef: ActionItem | null = null;

    setActions(prev => prev.map(a => {
      if (a.id === id) {
        const historyEntry = {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: `Status changed to ${newStatus}${reason ? ` (Reason: ${reason})` : ''}`,
          user: currentUser.name
        };
        const updatedAction = { 
          ...a, 
          status: newStatus, 
          cancelReason: reason,
          history: [...(a.history || []), historyEntry]
        };
        updatedActionRef = updatedAction;
        return updatedAction;
      }
      return a;
    }));

    if (selectedAction?.id === id && updatedActionRef) {
      setSelectedAction(updatedActionRef);
    }

    if (showToast) {
      showToast(`Action marked as ${newStatus}`, 'info');
    }
    if (newStatus === 'Canceled') {
      setSelectedAction(null);
    }
    setCancelReason('');
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedAction) return;
    
    let updatedActionRef: ActionItem | null = null;

    setActions(prev => prev.map(a => {
      if (a.id === selectedAction.id) {
        const commentEntry = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${currentUser.name}: ${newComment}`;
        const updatedAction = {
          ...a,
          comments: [...(a.comments || []), commentEntry]
        };
        updatedActionRef = updatedAction;
        return updatedAction;
      }
      return a;
    }));

    if (updatedActionRef) {
      setSelectedAction(updatedActionRef);
    }
    setNewComment('');
  };

  const handleReassign = (newOwner: string) => {
    if (!selectedAction) return;
    
    let updatedActionRef: ActionItem | null = null;

    setActions(prev => prev.map(a => {
      if (a.id === selectedAction.id) {
        const updatedAction = {
          ...a,
          owner: newOwner,
          history: [
            { timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), action: `Reassigned to ${newOwner}`, user: currentUser.name },
            ...(a.history || [])
          ]
        };
        updatedActionRef = updatedAction;
        return updatedAction;
      }
      return a;
    }));

    if (updatedActionRef) {
      setSelectedAction(updatedActionRef);
    }
    if (showToast) showToast(`Action reassigned to ${newOwner}`, 'success');
  };

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    const lowerQuery = searchQuery.toLowerCase();
    return actions.filter(a => 
      a.title.toLowerCase().includes(lowerQuery) || 
      a.owner.toLowerCase().includes(lowerQuery) ||
      a.description.toLowerCase().includes(lowerQuery)
    );
  }, [actions, searchQuery]);

  const getActionsByStatus = (status: string) => filteredActions.filter(a => a.status === status);

  const printContent = (
    <div className="space-y-6">
      <h2 className="text-xl font-bold border-b pb-2">Action Board - {currentUser.role.replace('_', ' ')}</h2>
      {['New', 'In Progress', 'On Hold', 'Completed', 'Canceled'].map(status => {
        const statusActions = getActionsByStatus(status);
        if (statusActions.length === 0) return null;
        return (
          <div key={status} className="mb-4">
            <h3 className="text-lg font-bold bg-gray-100 p-2 rounded mb-2">{status}</h3>
            <ul className="list-disc pl-5 space-y-2">
              {statusActions.map(a => (
                <li key={a.id}>
                  <strong>{a.title}</strong> - {a.owner} (Due: {a.dueTime}) [{a.priority}]
                  {a.status === 'Canceled' && a.cancelReason && ` - Reason: ${a.cancelReason}`}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className="p-2 bg-neutral-800 rounded-lg border border-neutral-700">
            <Clock className="w-5 h-5 text-neutral-400" />
          </div>
          Action Board
          <span className="text-xs font-mono font-normal text-neutral-500 bg-neutral-900 px-2 py-1 rounded border border-neutral-800 uppercase tracking-widest hidden sm:inline-block">
            View: {currentUser.role.replace('_', ' ')}
          </span>
        </h2>
        
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5 w-full md:w-64">
              <Search className="w-4 h-4 text-neutral-500 mr-2" />
              <input 
                type="text" 
                placeholder="Filter actions..." 
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
          </div>
          {systemStatus === 'manual' && (
            <button 
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-amber-600/20 animate-in fade-in"
            >
              <Printer className="w-4 h-4" />
              Print Action Board
            </button>
          )}
        </div>
      </div>

      {isSurgeActive && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-3 flex items-center gap-3 animate-pulse shrink-0">
          <AlertOctagon className="w-5 h-5 text-rose-500" />
          <span className="text-rose-400 font-bold text-sm">SURGE PROTOCOL ACTIVE: Low priority actions have been visually deemphasized. Focus on critical tasks.</span>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-4 min-h-0 overflow-x-auto custom-scrollbar pb-2">
          <Column title="New" status="New" items={getActionsByStatus('New')} onActionClick={setSelectedAction} isSurgeActive={isSurgeActive} />
          <Column title="In Progress" status="In Progress" items={getActionsByStatus('In Progress')} onActionClick={setSelectedAction} isSurgeActive={isSurgeActive} />
          <Column title="On Hold" status="On Hold" items={getActionsByStatus('On Hold')} onActionClick={setSelectedAction} isSurgeActive={isSurgeActive} />
          <Column title="Completed" status="Completed" items={getActionsByStatus('Completed')} onActionClick={setSelectedAction} isSurgeActive={isSurgeActive} />
          <Column title="Canceled" status="Canceled" items={getActionsByStatus('Canceled')} onActionClick={setSelectedAction} isSurgeActive={isSurgeActive} />
        </div>
      </DragDropContext>

      {/* Action Detail Modal */}
      <AnimatePresence>
        {selectedAction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
            <div className="p-4 border-b border-neutral-800 flex justify-between items-start bg-neutral-950 shrink-0">
              <div>
                <PriorityBadge priority={selectedAction.priority} />
                <h3 className="text-lg font-bold text-white mt-2">{selectedAction.title}</h3>
              </div>
              <button onClick={() => setSelectedAction(null)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-neutral-800 bg-neutral-900 shrink-0">
              <button 
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
              >
                Details
              </button>
              <button 
                onClick={() => setActiveTab('comments')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'comments' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
              >
                <MessageSquare className="w-4 h-4" />
                Comments ({selectedAction.comments?.length || 0})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'history' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
              >
                <History className="w-4 h-4" />
                History
              </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="flex justify-between text-sm text-neutral-400 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span>Owner:</span>
                      <select 
                        value={selectedAction.owner}
                        onChange={(e) => handleReassign(e.target.value)}
                        className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm rounded px-2 py-1 outline-none focus:border-cyan-500"
                      >
                        <option value={selectedAction.owner}>{selectedAction.owner}</option>
                        {Object.values(USERS).filter(u => u.name !== selectedAction.owner).map(u => (
                          <option key={u.name} value={u.name}>{u.name} ({u.role.replace('_', ' ')})</option>
                        ))}
                      </select>
                    </div>
                    <span className="flex items-center">Due: <strong className="text-neutral-200 ml-1">{selectedAction.dueTime}</strong></span>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Update Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['New', 'In Progress', 'On Hold', 'Completed'].map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(selectedAction.id, status as ActionItem['status'])}
                          className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                            selectedAction.status === status 
                              ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                              : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-neutral-800">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Cancel Action</label>
                    <textarea
                      placeholder="Reason for cancellation..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50 min-h-[80px]"
                    />
                    <button
                      onClick={() => handleStatusChange(selectedAction.id, 'Canceled', cancelReason)}
                      disabled={!cancelReason.trim()}
                      className="w-full p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark as Canceled
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto min-h-[200px]">
                    {(!selectedAction.comments || selectedAction.comments.length === 0) ? (
                      <div className="text-center text-neutral-500 py-8 text-sm">
                        No comments yet.
                      </div>
                    ) : (
                      selectedAction.comments.map((comment, idx) => {
                        const match = comment.match(/^\[(.*?)\] (.*?): (.*)$/);
                        if (match) {
                          const [, time, user, text] = match;
                          return (
                            <div key={idx} className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-cyan-400">{user}</span>
                                <span className="text-[10px] text-neutral-500 font-mono">{time}</span>
                              </div>
                              <p className="text-sm text-neutral-300">{text}</p>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg text-sm text-neutral-300">
                            {comment}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-neutral-800 shrink-0">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {(!selectedAction.history || selectedAction.history.length === 0) ? (
                    <div className="text-center text-neutral-500 py-8 text-sm">
                      No history recorded.
                    </div>
                  ) : (
                    <div className="relative border-l border-neutral-800 ml-3 space-y-6 pb-4">
                      {selectedAction.history.map((entry, idx) => (
                        <div key={idx} className="relative pl-6">
                          <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-neutral-800 border-2 border-neutral-900"></div>
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-medium text-neutral-200">{entry.action}</span>
                            <span className="text-[10px] text-neutral-500 font-mono shrink-0 ml-4">{entry.timestamp}</span>
                          </div>
                          <div className="text-xs text-neutral-500">by {entry.user}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <PrintPreviewModal 
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={() => {
          if (showToast) showToast('Print job sent to local printer.', 'success');
        }}
        title="Manual Action Board"
        content={printContent}
      />
    </div>
  );
};