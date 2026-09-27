'use client';
import { memo, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTasks } from '@/store/tasks';
import type { ProjectMember, Task, TaskStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskDetailsDialog } from './task-details-dialog';
import { CreateTaskDialog } from './create-task-dialog';
import { cn } from '@/lib/utils';


const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'completed', label: 'Completed' },
];

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
};

export function KanbanBoard({
  projectId,
  tasks,
  members,
  canEdit,
  canDelete,
}: {
  projectId: string;
  tasks: Task[];
  members: ProjectMember[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const upsert = useTasks((s) => s.upsert);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], completed: [] };
    for (const t of tasks) m[t.status].push(t);
    return m;
  }, [tasks]);

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    if (!canEdit || status === task.status) return;
    // Optimistic update — replay if server rejects.
    const original = task.status;
    upsert(projectId, { ...task, status });
    try {
      const updated = await api<Task>(`/api/projects/${projectId}/tasks/${task._id}`, {
        method: 'PATCH',
        body: { status, expectedVersion: task.version },
      });
      upsert(projectId, updated);
    } catch (err) {
      upsert(projectId, { ...task, status: original });
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          column={col}
          tasks={grouped[col.id]}
          canEdit={canEdit}
          onCardClick={setSelectedTaskId}
          onDropStatus={(taskId) => {
            const t = tasks.find((x) => x._id === taskId);
            if (t) handleStatusChange(t, col.id);
          }}
          projectId={projectId}
          members={members}
        />
      ))}

      {selectedTaskId && (
        <TaskDetailsDialog
          projectId={projectId}
          taskId={selectedTaskId}
          members={members}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

interface ColumnProps {
  column: { id: TaskStatus; label: string };
  tasks: Task[];
  canEdit: boolean;
  onCardClick: (taskId: string) => void;
  onDropStatus: (taskId: string) => void;
  projectId: string;
  members: ProjectMember[];
}

function KanbanColumn({ column, tasks, canEdit, onCardClick, onDropStatus, projectId, members }: ColumnProps) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 transition-colors',
        isOver && 'border-foreground/40 bg-accent',
      )}
      onDragOver={(e) => { if (canEdit) { e.preventDefault(); setIsOver(true); } }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        const taskId = e.dataTransfer.getData('text/task-id');
        if (taskId) onDropStatus(taskId);
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{column.label}</h3>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        {canEdit && (
          <CreateTaskDialog projectId={projectId} members={members} defaultStatus={column.id}>
            <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
          </CreateTaskDialog>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">No tasks</p>
        ) : (
          tasks.map((t) => <TaskCard key={t._id} task={t} onClick={() => onCardClick(t._id)} draggable={canEdit} />)
        )}
      </div>
    </div>
  );
}

const TaskCard = memo(function TaskCard({
  task, onClick, draggable,
}: { task: Task; onClick: () => void; draggable: boolean }) {
  const presence = useTasks((s) => s.presence[task.project]?.[task._id]);
  return (
    <button
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/task-id', task._id)}
      className="group flex flex-col gap-2 rounded-md border bg-background p-3 text-left transition hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium line-clamp-2">{task.title}</p>
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{task.assignees.length} assignee{task.assignees.length === 1 ? '' : 's'}</span>
        {presence && presence.size > 0 && (
          <Badge variant="outline" className="border-green-500/50 text-green-700">
            {presence.size} editing
          </Badge>
        )}
      </div>
    </button>
  );
});
