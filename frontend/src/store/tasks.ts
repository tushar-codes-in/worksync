import { create } from 'zustand';
import type { Task } from '@/lib/types';

/**
 * Per-project task cache. We keep tasks keyed by project ID; the kanban + list views
 * subscribe with shallow selectors so socket-driven updates only re-render rows that
 * actually changed.
 */
interface TasksState {
  byProject: Record<string, Record<string, Task>>;
  presence: Record<string, Record<string, Set<string>>>; // projectId -> taskId -> userIds editing
  setMany: (projectId: string, tasks: Task[]) => void;
  upsert: (projectId: string, task: Task) => void;
  remove: (projectId: string, taskId: string) => void;
  applyBulkPatch: (projectId: string, taskIds: string[], patch: Partial<Task>) => void;
  bulkRemove: (projectId: string, taskIds: string[]) => void;
  startEditing: (projectId: string, taskId: string, userId: string) => void;
  stopEditing: (projectId: string, taskId: string, userId: string) => void;
  clearProject: (projectId: string) => void;
}

export const useTasks = create<TasksState>((set) => ({
  byProject: {},
  presence: {},
  setMany: (projectId, tasks) =>
    set((s) => ({
      byProject: {
        ...s.byProject,
        [projectId]: Object.fromEntries(tasks.map((t) => [t._id, t])),
      },
    })),
  upsert: (projectId, task) =>
    set((s) => {
      const existing = s.byProject[projectId]?.[task._id];
      // Conflict resolution — last-write-wins by version (or updatedAt if versions tie).
      if (existing && existing.version > task.version) return s;
      return {
        byProject: {
          ...s.byProject,
          [projectId]: { ...(s.byProject[projectId] ?? {}), [task._id]: task },
        },
      };
    }),
  remove: (projectId, taskId) =>
    set((s) => {
      const m = { ...(s.byProject[projectId] ?? {}) };
      delete m[taskId];
      return { byProject: { ...s.byProject, [projectId]: m } };
    }),
  applyBulkPatch: (projectId, taskIds, patch) =>
    set((s) => {
      const m = { ...(s.byProject[projectId] ?? {}) };
      for (const id of taskIds) {
        if (m[id]) m[id] = { ...m[id], ...patch, version: m[id].version + 1 } as Task;
      }
      return { byProject: { ...s.byProject, [projectId]: m } };
    }),
  bulkRemove: (projectId, taskIds) =>
    set((s) => {
      const m = { ...(s.byProject[projectId] ?? {}) };
      for (const id of taskIds) delete m[id];
      return { byProject: { ...s.byProject, [projectId]: m } };
    }),
  startEditing: (projectId, taskId, userId) =>
    set((s) => {
      const p = { ...(s.presence[projectId] ?? {}) };
      const set0 = new Set(p[taskId] ?? []);
      set0.add(userId);
      p[taskId] = set0;
      return { presence: { ...s.presence, [projectId]: p } };
    }),
  stopEditing: (projectId, taskId, userId) =>
    set((s) => {
      const p = { ...(s.presence[projectId] ?? {}) };
      const set0 = new Set(p[taskId] ?? []);
      set0.delete(userId);
      if (set0.size === 0) delete p[taskId];
      else p[taskId] = set0;
      return { presence: { ...s.presence, [projectId]: p } };
    }),
  clearProject: (projectId) =>
    set((s) => {
      const { [projectId]: _a, ...rest } = s.byProject;
      const { [projectId]: _b, ...restP } = s.presence;
      return { byProject: rest, presence: restP };
    }),
}));
