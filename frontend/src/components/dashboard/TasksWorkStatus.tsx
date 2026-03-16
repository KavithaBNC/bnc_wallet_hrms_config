import { useState } from 'react';
import { getMockTasks, type TaskItem } from '../../services/dashboard.service';

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const STATUS_ICON: Record<string, JSX.Element> = {
  completed: (
    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'in-progress': (
    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pending: (
    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};

const TasksWorkStatus = () => {
  const [tasks, setTasks] = useState<TaskItem[]>(() => getMockTasks());

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = t.status === 'completed' ? 'pending' : t.status === 'pending' ? 'in-progress' : 'completed';
        return { ...t, status: next, progress: next === 'completed' ? 100 : next === 'pending' ? 0 : t.progress };
      })
    );
  };

  const counts = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Tasks</h3>
          <p className="text-xs text-gray-500">Work status overview</p>
        </div>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Placeholder</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <StatBox label="Total" value={counts.total} color="text-blue-600" bg="bg-blue-50" />
        <StatBox label="Done" value={counts.completed} color="text-green-600" bg="bg-green-50" />
        <StatBox label="Active" value={counts.inProgress} color="text-amber-600" bg="bg-amber-50" />
        <StatBox label="Pending" value={counts.pending} color="text-gray-600" bg="bg-gray-50" />
      </div>

      {/* Task list */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
            <button onClick={() => toggleTask(task.id)} className="flex-shrink-0 focus:outline-none">
              {STATUS_ICON[task.status]}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {task.title}
                </p>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_BADGE[task.priority]}`}>
                  {task.priority}
                </span>
              </div>
              {task.status === 'in-progress' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${task.progress}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{task.progress}%</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-400 flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="text-[10px]">{formatShortDate(task.deadline)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-lg p-2.5 text-center`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default TasksWorkStatus;
