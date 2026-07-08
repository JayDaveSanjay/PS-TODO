import React, { useState, useEffect, startTransition } from 'react';
import { Task, TEAM, TeamMember, TaskStatus, TaskPriority, Comment } from '../types.js';
import { X, Save, Trash2, MessageSquare, Clock, User, Link, Users, AlertCircle, Trash } from 'lucide-react';

interface TaskModalProps {
  task: Task | null; // null means creating a new task
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  onDelete?: (id: string) => void;
  allTasks: Task[];
  currentMember: TeamMember;
}

export default function TaskModal({ task, onClose, onSave, onDelete, allTasks, currentMember }: TaskModalProps) {
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [priority, setPriority] = useState<TaskPriority>('med');
  const [dueDate, setDueDate] = useState('');
  const [assistingIds, setAssistingIds] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [waitingPersonId, setWaitingPersonId] = useState('');

  // Comment section fields
  const [newCommentText, setNewCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Initialize fields
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setOwnerId(task.ownerId);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate || '');
      setAssistingIds(task.assistingIds || []);
      setDependencies(task.dependencies || []);
      setWaitingPersonId(task.waitingPersonId || task.ownerId);
      setComments(task.comments || []);
    } else {
      // Default creation state
      setTitle('');
      setDescription('');
      setOwnerId(currentMember.id);
      setStatus('To Do');
      setPriority('med');
      setDueDate('');
      setAssistingIds([]);
      setDependencies([]);
      setWaitingPersonId(currentMember.id);
      setComments([]);
    }
  }, [task, currentMember]);

  // Synchronize waiting person with owner by default if not set
  const handleOwnerChange = (val: string) => {
    setOwnerId(val);
    if (!waitingPersonId || waitingPersonId === ownerId) {
      setWaitingPersonId(val);
    }
  };

  const handleToggleAssistant = (id: string) => {
    setAssistingIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleDependency = (id: string) => {
    setDependencies(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      ownerId,
      status,
      priority,
      dueDate,
      assistingIds,
      dependencies,
      waitingPersonId: waitingPersonId || ownerId
    });
  };

  // Add Comment API call
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newCommentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentMember.id,
          text: newCommentText.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to post comment');

      const addedComment = await response.json();
      startTransition(() => {
        setComments(prev => [...prev, addedComment]);
        setNewCommentText('');
      });
    } catch (err) {
      console.error(err);
      alert('Could not save comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete Comment API call
  const handleDeleteComment = async (commentId: string) => {
    if (!task) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      startTransition(() => {
        setComments(prev => prev.filter(c => c.id !== commentId));
      });
    } catch (err) {
      console.error(err);
      alert('Could not delete comment.');
    }
  };

  // Available tasks to be selected as dependencies (excluding current task to prevent loops)
  const eligibleDependencies = allTasks.filter(t => !task || t.id !== task.id);

  // Quick display helper for names
  const getMemberInitials = (id: string) => {
    const m = TEAM.find(x => x.id === id);
    if (!m) return '?';
    return m.name.substring(0, 2).toUpperCase();
  };

  const getMemberName = (id: string) => {
    return TEAM.find(x => x.id === id)?.name || 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full flex flex-col my-8 max-h-[90vh]"
        id="task_modal_content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold font-display text-slate-900" id="task_modal_title">
            {task ? 'Edit Sourcing Task' : 'Create New Sourcing Task'}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition-all"
            id="close_task_modal_btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5" id="task_modal_form">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Source 300 GSM Premium Art Card Stock"
                className="block w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Details & Sourcing Parameters
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Specify dimensions, GSM, targeted pricing, supplier options, quantities needed..."
                className="block w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Owner */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Accountable Owner *
                </label>
                <select
                  value={ownerId}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {TEAM.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Current Workflow Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>

            {/* RACI Assisting Contributors */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400" /> Assisting Team Members (Contributors)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {TEAM.map(m => (
                  <label 
                    key={m.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                      assistingIds.includes(m.id) 
                        ? 'bg-orange-50/75 border-orange-200 text-orange-800' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={assistingIds.includes(m.id)}
                      onChange={() => handleToggleAssistant(m.id)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0"
                    />
                    <span className="truncate">{m.name.split(' ')[0]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="block w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none"
                >
                  <option value="low">Low Priority</option>
                  <option value="med">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Target Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Blocked By Dependencies */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5 text-slate-400" /> Prerequisite Blockers (Blocked by)
              </label>
              {eligibleDependencies.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No other tasks in the system to link yet.</p>
              ) : (
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50/50">
                  {eligibleDependencies.map(t => (
                    <label 
                      key={t.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                        dependencies.includes(t.id)
                          ? 'bg-amber-50/60 border border-amber-200 text-amber-900'
                          : 'hover:bg-slate-100/50 border border-transparent text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dependencies.includes(t.id)}
                        onChange={() => handleToggleDependency(t.id)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 mt-0.5 shrink-0"
                      />
                      <div className="text-xs">
                        <span className="font-semibold">{t.title}</span> 
                        <span className="text-slate-400 block mt-0.5">
                          Owner: {getMemberName(t.ownerId)} • Status: {t.status}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Waiting Person (Only show if task is blocked or has dependencies) */}
            {dependencies.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Blocker Alert Target
                </label>
                <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs text-amber-900 max-w-sm">
                    This task is blocked. Who should receive the <strong>Blocker Cleared</strong> email & WhatsApp ping when the prerequisites are marked Done?
                  </div>
                  <select
                    value={waitingPersonId || ownerId}
                    onChange={(e) => setWaitingPersonId(e.target.value)}
                    className="px-2.5 py-1.5 border border-amber-200 rounded-lg text-xs bg-white text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full sm:w-auto font-medium"
                  >
                    {TEAM.map(m => (
                      <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6 shrink-0">
              {task && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                  id="delete_task_btn"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Task
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-100 transition-all"
                  id="save_task_submit_btn"
                >
                  <Save className="h-4 w-4" />
                  {task ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </div>
          </form>

          {/* Real-time Comments Section (Only for existing tasks) */}
          {task && (
            <div className="border-t border-slate-100 pt-6 space-y-4" id="task_comments_section">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-display">
                <MessageSquare className="h-4 w-4 text-slate-400" /> Discussion & Updates ({comments.length})
              </h3>

              {/* Comment Thread */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No comments or logs added yet. Start the conversation!</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-2.5 items-start bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                      {/* Initials bubble */}
                      <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {getMemberInitials(c.authorId)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">{getMemberName(c.authorId)}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 whitespace-pre-line leading-relaxed">
                          {c.text}
                        </p>
                      </div>

                      {/* Delete comment */}
                      {c.authorId === currentMember.id && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded-md transition-all self-start"
                          title="Delete comment"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2.5 items-start mt-2">
                <div className="h-7 w-7 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-2">
                  {getMemberInitials(currentMember.id)}
                </div>
                <div className="flex-1">
                  <textarea
                    rows={2}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Ask for an update, report sampling progress, specify rates..."
                    className="block w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  />
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="submit"
                      disabled={submittingComment || !newCommentText.trim()}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-[11px] font-bold text-white rounded-lg transition-all"
                      id="post_comment_btn"
                    >
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
