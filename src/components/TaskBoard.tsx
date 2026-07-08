import { useState, useEffect, startTransition } from 'react';
import { Task, TEAM, TeamMember, TaskStatus, TaskPriority } from '../types.js';
import { 
  Kanban, Table, BarChart3, GitFork, Search, Filter, 
  Plus, LogOut, User, RefreshCw, AlertCircle, Calendar, 
  ArrowRight, ShieldAlert, Phone, Mail, ChevronRight, CheckCircle2, Lock
} from 'lucide-react';
import TaskModal from './TaskModal.js';
import UnblockedNotifier from './UnblockedNotifier.js';

interface TaskBoardProps {
  currentMember: TeamMember;
  onLogout: () => void;
}

type ViewType = 'kanban' | 'table' | 'workload' | 'dependencies';

export default function TaskBoard({ currentMember, onLogout }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeView, setActiveView] = useState<ViewType>('kanban');
  const [loading, setLoading] = useState(true);
  
  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Sorting state (for Table view)
  const [sortField, setSortField] = useState<string>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Synchronization status
  const [syncTime, setSyncTime] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch tasks
  const fetchTasks = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setIsSyncing(true);
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      startTransition(() => {
        setTasks(data);
        setSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      });
    } catch (err) {
      console.error('Task fetch error:', err);
    } finally {
      startTransition(() => {
        setLoading(false);
        setIsSyncing(false);
      });
    }
  };

  // Poll for multi-user updates
  useEffect(() => {
    fetchTasks(true);
    const interval = setInterval(() => {
      fetchTasks(false);
    }, 4000); // Poll every 4 seconds to sync team tasks

    return () => clearInterval(interval);
  }, []);

  // Save/Create task
  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      let response;
      if (selectedTask) {
        // Edit Mode
        response = await fetch(`/api/tasks/${selectedTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
      } else {
        // Create Mode
        response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
      }

      if (!response.ok) throw new Error('Failed to save task');

      // Refresh tasks immediately
      fetchTasks(false);
      setIsModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert('Could not save task. Please try again.');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This will remove it from all dependency blocks too.')) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete task');

      fetchTasks(false);
      setIsModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert('Could not delete task.');
    }
  };

  // Quick move status (Kanban drag helper)
  const handleQuickMove = async (taskId: string, nextStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Validation: Blocked tasks can't move to In Progress directly if dependencies are still open
    if (nextStatus === 'Done' && isBlocked(task)) {
      if (!confirm('This task still has open prerequisite dependencies. Mark as Done anyway?')) {
        return;
      }
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');
      fetchTasks(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Check if task is blocked based on database relationships
  const isBlocked = (task: Task): boolean => {
    if (task.status === 'Done') return false;
    if (!task.dependencies || task.dependencies.length === 0) return false;
    
    // Check if any of the dependencies are NOT 'Done'
    return task.dependencies.some(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask ? depTask.status !== 'Done' : false;
    });
  };

  // Get effective status (Blocked status overrides status if there are pending prerequisites)
  const getEffectiveStatus = (task: Task): TaskStatus => {
    if (task.status !== 'Done' && isBlocked(task)) {
      return 'Blocked';
    }
    return task.status;
  };

  // Filtering Logic
  const filteredTasks = tasks.filter(task => {
    // 1. Search Query
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const titleMatch = task.title.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      if (!titleMatch && !descMatch) return false;
    }

    // 2. Status
    const effStatus = getEffectiveStatus(task);
    if (statusFilter !== 'all') {
      if (statusFilter === 'Blocked' && effStatus !== 'Blocked') return false;
      if (statusFilter !== 'Blocked' && task.status !== statusFilter) return false;
    }

    // 3. Assignee
    if (ownerFilter !== 'all') {
      const isOwner = task.ownerId === ownerFilter;
      const isAssistant = task.assistingIds?.includes(ownerFilter);
      if (!isOwner && !isAssistant) return false;
    }

    // 4. Priority
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

    return true;
  });

  // Sorting Logic (for Table)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let aVal: any = a[sortField as keyof Task] || '';
    let bVal: any = b[sortField as keyof Task] || '';

    // Handle nested custom values
    if (sortField === 'owner') {
      aVal = TEAM.find(m => m.id === a.ownerId)?.name || '';
      bVal = TEAM.find(m => m.id === b.ownerId)?.name || '';
    } else if (sortField === 'status') {
      aVal = getEffectiveStatus(a);
      bVal = getEffectiveStatus(b);
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case 'high': return 'bg-red-50 text-red-700 border-red-100';
      case 'med': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'low': return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans flex flex-col">
      {/* Real-time Unblocked Event Toaster */}
      <UnblockedNotifier tasks={tasks} />

      {/* Main Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-orange-600 text-white flex items-center justify-center rounded-xl font-display font-black text-lg tracking-tight">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-orange-600">PrintStop Sourcing Portal</span>
              <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
            </div>
            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">Co-Task Board</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Sync status */}
          <div className="text-right hidden md:block">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">Last synced</p>
            <p className="text-xs font-mono font-bold text-slate-600 flex items-center gap-1">
              <RefreshCw className={`h-3 w-3 text-slate-400 ${isSyncing ? 'animate-spin text-orange-500' : ''}`} />
              {syncTime || 'Syncing...'}
            </p>
          </div>

          {/* User profile bubble */}
          <div className="flex items-center gap-2.5 bg-slate-50 pl-3 pr-4 py-1.5 rounded-2xl border border-slate-100">
            <div className="h-7 w-7 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center border border-orange-200 shadow-inner">
              {currentMember.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="text-left shrink-0">
              <p className="text-xs font-bold text-slate-800 leading-none">{currentMember.name}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{currentMember.phone}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            id="logout_btn"
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-slate-200 transition-all"
            title="Sign out of Co-Task Board"
          >
            <LogOut className="h-4 w-4" />
          </button>

          {/* New Task Trigger */}
          <button
            onClick={() => { setSelectedTask(null); setIsModalOpen(true); }}
            id="header_new_task_btn"
            className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl shadow-lg shadow-orange-100 border border-orange-600 hover:border-orange-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </header>

      {/* Filter / View Subheader */}
      <div className="bg-slate-100/50 border-b border-slate-200/60 px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* View Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl self-start" id="view_tabs">
          <button
            onClick={() => startTransition(() => setActiveView('kanban'))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'kanban' 
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" />
            Kanban Board
          </button>

          <button
            onClick={() => startTransition(() => setActiveView('table'))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'table' 
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            Sourcing Grid
          </button>

          <button
            onClick={() => startTransition(() => setActiveView('workload'))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'workload' 
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Workload Distribution
          </button>

          <button
            onClick={() => startTransition(() => setActiveView('dependencies'))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeView === 'dependencies' 
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <GitFork className="h-3.5 w-3.5" />
            Blocker Chain Map
          </button>
        </div>

        {/* Toolbar Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sourcing tasks..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-medium placeholder-slate-400 text-slate-800"
            />
          </div>

          {/* Member Filter */}
          <div className="relative">
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="pl-2.5 pr-8 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500 font-bold text-slate-700 appearance-none"
            >
              <option value="all">Sourcing Assignee: All</option>
              {TEAM.map(m => (
                <option key={m.id} value={m.id}>{m.id === currentMember.id ? 'My Tasks Only' : m.name}</option>
              ))}
            </select>
            <Filter className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-2.5 pr-8 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-none font-bold text-slate-700 appearance-none"
            >
              <option value="all">Status: All</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked / Pending</option>
              <option value="Done">Completed</option>
            </select>
            <Filter className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="pl-2.5 pr-8 py-2 text-xs border border-slate-200 bg-white rounded-xl focus:outline-none font-bold text-slate-700 appearance-none"
            >
              <option value="all">Priority: All</option>
              <option value="high">High</option>
              <option value="med">Medium</option>
              <option value="low">Low</option>
            </select>
            <Filter className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 p-6 overflow-x-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Retrieving PrintStop Sourcing Tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 mt-10">
            <AlertCircle className="h-10 w-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 font-display">No tasks in the board</h3>
            <p className="text-sm text-slate-400 mt-1">Get started by creating your very first sourcing contract task.</p>
            <button
              onClick={() => { setSelectedTask(null); setIsModalOpen(true); }}
              className="mt-4 inline-flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              <Plus className="h-4 w-4" /> Add Task
            </button>
          </div>
        ) : (
          <>
            {/* VIEW 1: KANBAN BOARD */}
            {activeView === 'kanban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
                {/* 4 COLUMNS: To Do, In Progress, Blocked, Done */}
                {(['To Do', 'In Progress', 'Blocked', 'Done'] as const).map(col => {
                  const colTasks = filteredTasks.filter(t => getEffectiveStatus(t) === col);

                  return (
                    <div key={col} className="bg-slate-100/70 border border-slate-200/40 rounded-2xl p-4 flex flex-col min-h-[480px]">
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/50 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            col === 'To Do' ? 'bg-slate-400' :
                            col === 'In Progress' ? 'bg-sky-500' :
                            col === 'Blocked' ? 'bg-amber-500' : 'bg-green-500'
                          }`} />
                          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{col}</h3>
                        </div>
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-md">
                          {colTasks.length}
                        </span>
                      </div>

                      {/* Task cards wrapper */}
                      <div className="flex-1 space-y-3">
                        {colTasks.length === 0 ? (
                          <div className="h-full border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-6 text-center">
                            <span className="text-[11px] text-slate-400 font-semibold italic">Drop or move tasks here</span>
                          </div>
                        ) : (
                          colTasks.map(t => {
                            const mainOwner = TEAM.find(x => x.id === t.ownerId);
                            const assistants = (t.assistingIds || []).map(id => TEAM.find(x => x.id === id)).filter(Boolean) as TeamMember[];
                            const blockersLeft = (t.dependencies || []).filter(depId => {
                              const depT = tasks.find(x => x.id === depId);
                              return depT ? depT.status !== 'Done' : false;
                            });

                            return (
                              <div
                                key={t.id}
                                className="group bg-white rounded-xl border border-slate-200/75 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer relative"
                                onClick={() => { setSelectedTask(t); setIsModalOpen(true); }}
                                id={`task_card_${t.id}`}
                              >
                                {/* Left strip accent based on priority */}
                                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-md ${
                                  t.priority === 'high' ? 'bg-red-500' :
                                  t.priority === 'med' ? 'bg-amber-500' : 'bg-slate-300'
                                }`} />

                                <div className="flex items-start justify-between gap-2 pl-1">
                                  <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                                    {t.title}
                                  </h4>
                                </div>

                                {t.description && (
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed pl-1">
                                    {t.description}
                                  </p>
                                )}

                                {/* Chips / Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-3 pl-1">
                                  {/* Accountable Owner badge */}
                                  {mainOwner && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/50">
                                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                                      {mainOwner.name.split(' ')[0]}
                                    </span>
                                  )}

                                  {/* Contributors indicator */}
                                  {assistants.length > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                      +{assistants.length} contributors
                                    </span>
                                  )}

                                  {/* Blocked indicator */}
                                  {col === 'Blocked' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
                                      <Lock className="h-2.5 w-2.5" />
                                      Blocked
                                    </span>
                                  )}

                                  {/* Priority indicator */}
                                  <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${getPriorityColor(t.priority)}`}>
                                    {t.priority}
                                  </span>

                                  {/* Due date */}
                                  {t.dueDate && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      {new Date(t.dueDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}

                                  {/* Comments count */}
                                  {t.comments?.length > 0 && (
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1 py-0.5 rounded ml-auto shrink-0">
                                      💬 {t.comments.length}
                                    </span>
                                  )}
                                </div>

                                {/* Quick state transit controllers */}
                                <div className="border-t border-slate-100 mt-3 pt-2.5 flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-1">
                                  <span className="text-[9px] font-bold text-slate-400 mr-auto">Move:</span>
                                  {t.status !== 'To Do' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleQuickMove(t.id, 'To Do'); }}
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] font-semibold text-slate-600 rounded-md transition-all shrink-0"
                                    >
                                      To Do
                                    </button>
                                  )}
                                  {t.status !== 'In Progress' && col !== 'Blocked' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleQuickMove(t.id, 'In Progress'); }}
                                      className="px-2 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[10px] font-semibold text-slate-600 rounded-md transition-all shrink-0"
                                    >
                                      In Progress
                                    </button>
                                  )}
                                  {t.status !== 'Done' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleQuickMove(t.id, 'Done'); }}
                                      className="inline-flex items-center gap-0.5 px-2 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-[10px] font-bold text-emerald-700 rounded-md transition-all shrink-0"
                                    >
                                      <CheckCircle2 className="h-3 w-3" /> Done
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW 2: SOURCING GRID (TABLE VIEW) */}
            {activeView === 'table' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="sourcing_grid_table">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="px-6 py-3.5 cursor-pointer hover:text-slate-700" onClick={() => handleSort('title')}>
                          Task Title {sortField === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="px-6 py-3.5 cursor-pointer hover:text-slate-700" onClick={() => handleSort('owner')}>
                          Assignee {sortField === 'owner' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="px-6 py-3.5">Contributors</th>
                        <th className="px-6 py-3.5 cursor-pointer hover:text-slate-700" onClick={() => handleSort('status')}>
                          Status {sortField === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="px-6 py-3.5 cursor-pointer hover:text-slate-700" onClick={() => handleSort('priority')}>
                          Priority {sortField === 'priority' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="px-6 py-3.5 cursor-pointer hover:text-slate-700" onClick={() => handleSort('dueDate')}>
                          Target Due {sortField === 'dueDate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {sortedTasks.map(t => {
                        const mainOwner = TEAM.find(x => x.id === t.ownerId);
                        const assistants = (t.assistingIds || []).map(id => TEAM.find(x => x.id === id)).filter(Boolean) as TeamMember[];
                        const effStatus = getEffectiveStatus(t);

                        return (
                          <tr 
                            key={t.id} 
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                            onClick={() => { setSelectedTask(t); setIsModalOpen(true); }}
                          >
                            <td className="px-6 py-4 max-w-sm">
                              <p className="font-bold text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors">{t.title}</p>
                              {t.description && <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>}
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-700">
                              {mainOwner ? mainOwner.name : 'Unassigned'}
                            </td>
                            <td className="px-6 py-4 max-w-[140px] truncate">
                              {assistants.length > 0 
                                ? assistants.map(a => a.name.split(' ')[0]).join(', ') 
                                : <span className="text-slate-300 italic">—</span>}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                effStatus === 'To Do' ? 'bg-slate-50 border-slate-200 text-slate-600' :
                                effStatus === 'In Progress' ? 'bg-sky-50 border-sky-100 text-sky-700' :
                                effStatus === 'Blocked' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                'bg-green-50 border-green-100 text-green-700'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  effStatus === 'To Do' ? 'bg-slate-400' :
                                  effStatus === 'In Progress' ? 'bg-sky-500' :
                                  effStatus === 'Blocked' ? 'bg-amber-500 animate-pulse' :
                                  'bg-green-500'
                                }`} />
                                {effStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getPriorityColor(t.priority)}`}>
                                {t.priority}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-500">
                              {t.dueDate ? new Date(t.dueDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedTask(t); setIsModalOpen(true); }}
                                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 px-2.5 py-1.5 rounded-lg transition-all"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: WORKLOAD DISTRIBUTION */}
            {activeView === 'workload' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="workload_distribution_panel">
                {TEAM.map(member => {
                  // Count owned and assisting tasks
                  const ownedTasks = tasks.filter(t => t.ownerId === member.id);
                  const assistingTasks = tasks.filter(t => t.assistingIds?.includes(member.id));
                  
                  const activeOwned = ownedTasks.filter(t => getEffectiveStatus(t) !== 'Done');
                  const completedOwned = ownedTasks.filter(t => getEffectiveStatus(t) === 'Done');

                  // Counts per status
                  const toDoCount = ownedTasks.filter(t => getEffectiveStatus(t) === 'To Do').length;
                  const inProgressCount = ownedTasks.filter(t => getEffectiveStatus(t) === 'In Progress').length;
                  const blockedCount = ownedTasks.filter(t => getEffectiveStatus(t) === 'Blocked').length;
                  const doneCount = completedOwned.length;

                  const totalOwned = ownedTasks.length;
                  const completionPercentage = totalOwned > 0 ? Math.round((doneCount / totalOwned) * 100) : 0;

                  return (
                    <div key={member.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        {/* Member card header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-700 font-display font-bold flex items-center justify-center border border-orange-200">
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-slate-800">{member.name}</h3>
                              <p className="text-[10px] text-slate-400 font-semibold">{member.email}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            activeOwned.length > 3 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-600'
                          }`}>
                            {activeOwned.length} Active Tasks
                          </span>
                        </div>

                        {/* Direct Contacts Row */}
                        <div className="mt-3.5 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px] font-bold text-slate-600">
                          <a href={`tel:${member.phone}`} className="flex items-center gap-1 hover:text-orange-600">
                            <Phone className="h-3 w-3 text-slate-400" /> {member.phone}
                          </a>
                          <a href={`mailto:${member.email}`} className="flex items-center gap-1 hover:text-orange-600">
                            <Mail className="h-3 w-3 text-slate-400" /> Contact Email
                          </a>
                        </div>

                        {/* Progress meter */}
                        <div className="mt-5 space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            <span>Sourcing completed</span>
                            <span className="text-slate-700 font-mono font-bold">{completionPercentage}% ({doneCount}/{totalOwned})</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                            <div 
                              className="h-full bg-green-500 rounded-full transition-all duration-500" 
                              style={{ width: `${completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats counters */}
                        <div className="grid grid-cols-4 gap-1.5 mt-5">
                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">To Do</p>
                            <p className="text-sm font-bold text-slate-700 mt-0.5">{toDoCount}</p>
                          </div>
                          <div className="bg-sky-50 border border-sky-100/50 p-2.5 rounded-xl text-center">
                            <p className="text-[9px] font-black uppercase text-sky-500 tracking-wider">Active</p>
                            <p className="text-sm font-bold text-sky-700 mt-0.5">{inProgressCount}</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100/50 p-2.5 rounded-xl text-center animate-pulse">
                            <p className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Blocked</p>
                            <p className="text-sm font-bold text-amber-700 mt-0.5">{blockedCount}</p>
                          </div>
                          <div className="bg-green-50 border border-green-100/50 p-2.5 rounded-xl text-center">
                            <p className="text-[9px] font-black uppercase text-green-500 tracking-wider">Done</p>
                            <p className="text-sm font-bold text-green-700 mt-0.5">{doneCount}</p>
                          </div>
                        </div>

                        {/* Active Owned Tasks list */}
                        <div className="mt-5 space-y-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Current Open Tasks</p>
                          {activeOwned.length === 0 ? (
                            <p className="text-xs text-slate-300 italic py-1">No pending assigned tasks.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {activeOwned.map(t => (
                                <div 
                                  key={t.id}
                                  onClick={() => { setSelectedTask(t); setIsModalOpen(true); }}
                                  className="group border border-slate-100 hover:border-slate-200 bg-slate-50/50 p-2 rounded-lg flex items-center justify-between gap-2 text-[11px] cursor-pointer hover:bg-slate-50 transition-all"
                                >
                                  <span className="font-bold text-slate-700 truncate flex-1 group-hover:text-orange-600 transition-colors">
                                    {t.title}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 border ${
                                    getEffectiveStatus(t) === 'Blocked' 
                                      ? 'bg-amber-50 border-amber-100 text-amber-700' 
                                      : 'bg-slate-100 text-slate-500 border-transparent'
                                  }`}>
                                    {getEffectiveStatus(t) === 'Blocked' ? 'Blocked' : t.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Assisting / RACI Support */}
                      {assistingTasks.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Assists as contributor on{' '}
                          <span className="text-slate-600 font-bold font-mono">
                            {assistingTasks.length} task{assistingTasks.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW 4: BLOCKER CHAIN MAP (DEPENDENCIES MAP) */}
            {activeView === 'dependencies' && (
              <div className="space-y-4" id="blocker_chain_map_panel">
                <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl max-w-3xl flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold">Prerequisite Chain Mapping</span>: Sourcing tasks linked via <strong>“Blocked by”</strong> form visual chains below. Prerequisite items appear on the left. Completed items turn green with a checkmark. When all prerequisite cards on the left are complete, the waiting person on the right is immediately alerted with messaging triggers to resume work.
                  </div>
                </div>

                <div className="space-y-4 max-w-4xl">
                  {tasks.filter(t => t.dependencies?.length > 0).length === 0 ? (
                    <div className="py-12 bg-white border border-slate-100 rounded-2xl text-center shadow-sm max-w-2xl">
                      <GitFork className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700">No dependency links established yet</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Open any task and check the "Blocked by" options to link tasks in dependency structures.
                      </p>
                    </div>
                  ) : (
                    tasks.filter(t => t.dependencies?.length > 0).map(blockedTask => {
                      const waitingPerson = TEAM.find(m => m.id === (blockedTask.waitingPersonId || blockedTask.ownerId));
                      const isCurrentlyBlocked = isBlocked(blockedTask);

                      return (
                        <div 
                          key={blockedTask.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
                        >
                          <div className="flex flex-wrap items-center gap-2.5 pb-2 border-b border-slate-100">
                            <span className={`h-2.5 w-2.5 rounded-full ${isCurrentlyBlocked ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Chain for: <span className="text-slate-800 normal-case font-bold">{blockedTask.title}</span>
                            </h4>
                          </div>

                          {/* Visualization Grid Flow */}
                          <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-4">
                            {/* Prerequisites List (Inputs) */}
                            <div className="flex flex-wrap items-center gap-2.5">
                              {blockedTask.dependencies.map((depId, idx) => {
                                const depT = tasks.find(x => x.id === depId);
                                if (!depT) return null;
                                const isDepDone = depT.status === 'Done';

                                return (
                                  <div key={depId} className="flex items-center gap-2">
                                    {idx > 0 && <span className="text-xs font-bold text-slate-300">+</span>}
                                    <div 
                                      onClick={() => { setSelectedTask(depT); setIsModalOpen(true); }}
                                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all max-w-[200px] ${
                                        isDepDone 
                                          ? 'bg-green-50/70 border-green-200 text-green-900 shadow-xs' 
                                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <p className="text-[11px] font-bold truncate">{depT.title}</p>
                                      <div className="flex items-center justify-between gap-2 mt-1.5">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{TEAM.find(x => x.id === depT.ownerId)?.name.split(' ')[0]}</span>
                                        <span className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
                                          isDepDone ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                          {depT.status}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Arrow divider */}
                            <div className="flex items-center gap-1 text-slate-400 self-center">
                              <ChevronRight className="h-5 w-5 hidden sm:block" />
                              <span className="text-[9px] font-black uppercase tracking-wider">Blocks</span>
                              <ArrowRight className="h-4 w-4" />
                            </div>

                            {/* Target Blocked Task (Output) */}
                            <div 
                              onClick={() => { setSelectedTask(blockedTask); setIsModalOpen(true); }}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all max-w-[220px] ${
                                isCurrentlyBlocked 
                                  ? 'bg-amber-50/70 border-amber-200 text-amber-900 shadow-xs animate-pulse-subtle' 
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <p className="text-[11px] font-bold truncate">{blockedTask.title}</p>
                              <div className="flex items-center justify-between gap-2 mt-1.5">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{TEAM.find(x => x.id === blockedTask.ownerId)?.name.split(' ')[0]}</span>
                                <span className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
                                  isCurrentlyBlocked ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {isCurrentlyBlocked ? 'Blocked' : blockedTask.status}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Waiting targets summary */}
                          {isCurrentlyBlocked && waitingPerson && (
                            <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 p-2.5 rounded-xl font-medium">
                              Waiting person: <span className="font-bold text-slate-800">{waitingPerson.name}</span> ({waitingPerson.email}). 
                              They will be alerted immediately when all left prerequisites become <span className="font-bold text-green-600">Done</span>.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Slide Modal Component */}
      {isModalOpen && (
        <TaskModal
          task={selectedTask}
          onClose={() => { setIsModalOpen(false); setSelectedTask(null); }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          allTasks={tasks}
          currentMember={currentMember}
        />
      )}
    </div>
  );
}
