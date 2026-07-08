import { useState, useEffect, useRef } from 'react';
import { Task, TEAM, TeamMember } from '../types.js';
import { Bell, Mail, Copy, X, Check, MessageSquare } from 'lucide-react';

interface UnblockedNotifierProps {
  tasks: Task[];
}

interface NotificationAlert {
  id: string;
  task: Task;
  targetMember: TeamMember;
}

export default function UnblockedNotifier({ tasks }: UnblockedNotifierProps) {
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const prevTasksRef = useRef<Task[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check if a task is currently blocked
  const isTaskBlocked = (task: Task, allTasks: Task[]): boolean => {
    if (task.status === 'Done') return false;
    if (!task.dependencies || task.dependencies.length === 0) return false;

    // A task is blocked if any of its dependency tasks are NOT 'Done'
    return task.dependencies.some(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask ? depTask.status !== 'Done' : false;
    });
  };

  useEffect(() => {
    const prevTasks = prevTasksRef.current;

    if (prevTasks.length > 0 && tasks.length > 0) {
      const newAlerts: NotificationAlert[] = [];

      tasks.forEach(currTask => {
        // We only care about tasks that are NOT Done
        if (currTask.status === 'Done') return;

        // Check if this task existed in previous tasks
        const prevTask = prevTasks.find(t => t.id === currTask.id);
        
        if (prevTask) {
          // If it was blocked before, but is NOT blocked now, it means a blocker was cleared!
          const wasBlocked = isTaskBlocked(prevTask, prevTasks);
          const isNowBlocked = isTaskBlocked(currTask, tasks);

          if (wasBlocked && !isNowBlocked) {
            // Find who should be notified (waitingPersonId or task owner)
            const notifyId = currTask.waitingPersonId || currTask.ownerId;
            const targetMember = TEAM.find(m => m.id === notifyId) || TEAM[0];

            newAlerts.push({
              id: `alert-${currTask.id}-${Date.now()}`,
              task: currTask,
              targetMember
            });
          }
        }
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => [...prev, ...newAlerts]);
      }
    }

    // Keep reference of current tasks for next render
    prevTasksRef.current = tasks;
  }, [tasks]);

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleCopyWhatsApp = (alert: NotificationAlert) => {
    const firstName = alert.targetMember.name.split(' ')[0];
    const message = `Hi ${firstName}, the blocker for your task "${alert.task.title}" has been cleared! You are now good to proceed with it on the PrintStop Co-Task Board.`;
    
    navigator.clipboard.writeText(message)
      .then(() => {
        setCopiedId(alert.id);
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch(err => console.error('Failed to copy text:', err));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full px-4 sm:px-0">
      {alerts.map(alert => {
        const mailSubject = encodeURIComponent(`Unblocked: "${alert.task.title}"`);
        const mailBody = encodeURIComponent(
          `Hi ${alert.targetMember.name.split(' ')[0]},\n\nThe prerequisite task for "${alert.task.title}" has been completed. This task is now unblocked and ready for work.\n\nPlease log into the Co-Task Board to check details.\n\nBest,\nPrintStop Sourcing Team`
        );

        return (
          <div
            key={alert.id}
            className="bg-white border-l-4 border-emerald-500 rounded-xl shadow-2xl p-4 border border-slate-100 flex gap-3 animate-slideIn animate-bounce-subtle"
            id={`unblocked_alert_${alert.task.id}`}
          >
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-700 tracking-wide uppercase">Blocker Cleared!</span>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-slate-100 transition-all"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h4 className="text-sm font-semibold text-slate-900 mt-1 line-clamp-2">
                {alert.task.title}
              </h4>
              
              <p className="text-xs text-slate-500 mt-1">
                Waiting person <span className="font-semibold text-slate-700">{alert.targetMember.name}</span> has been cleared to proceed.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mt-3.5">
                <a
                  href={`mailto:${alert.targetMember.email}?subject=${mailSubject}&body=${mailBody}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm"
                  id={`alert_email_btn_${alert.task.id}`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email {alert.targetMember.name.split(' ')[0]}
                </a>

                <button
                  onClick={() => handleCopyWhatsApp(alert)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                  id={`alert_whatsapp_btn_${alert.task.id}`}
                >
                  {copiedId === alert.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                      WhatsApp Ping
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
