/**
 * Socket.io client singleton. Re-authenticated whenever the access token rotates;
 * uses Socket.io's built-in reconnect with exponential backoff.
 *
 * The socket URL / path is derived from NEXT_PUBLIC_API_URL:
 *   - Absolute URL (http://localhost:4000)  → connect to that origin, default path `/socket.io/`
 *   - Relative path (`/_/backend`)          → connect to current origin, path `/_/backend/socket.io/`
 * NEXT_PUBLIC_SOCKET_PATH can override the auto-derived path.
 */
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { useAuth } from '@/store/auth';
import { useTasks } from '@/store/tasks';
import { useNotifications } from '@/store/notifications';
import type { Task } from './types';
import { toast } from 'sonner';

const IS_ABSOLUTE_API = /^https?:\/\//.test(API_URL);
const SOCKET_URL = IS_ABSOLUTE_API ? API_URL : undefined; // undefined → use current page origin
const SOCKET_PATH =
  process.env.NEXT_PUBLIC_SOCKET_PATH ??
  (IS_ABSOLUTE_API ? '/socket.io/' : `${API_URL.replace(/\/$/, '')}/socket.io/`);

let socket: Socket | null = null;
let currentToken: string | null = null;
let joinedProjects = new Set<string>();

export function getSocket(): Socket {
  const token = useAuth.getState().accessToken;
  if (!token) throw new Error('No access token');

  if (socket && currentToken === token && socket.connected) return socket;

  if (socket && currentToken !== token) {
    // Token changed (refresh, login as different user). Reconnect with the new auth.
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    withCredentials: true,
  });
  currentToken = token;

  socket.on('connect', () => {
    // Re-join any project rooms we had before the reconnect.
    for (const projectId of joinedProjects) {
      socket?.emit('project:join', projectId);
    }
  });

  socket.on('connect_error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('Socket connect error', err.message);
  });

  // === Task realtime ===
  socket.on('task:created', ({ task }: { task: Task }) => {
    useTasks.getState().upsert(task.project, task);
  });
  socket.on('task:updated', ({ task }: { task: Task }) => {
    useTasks.getState().upsert(task.project, task);
  });
  socket.on('task:deleted', ({ taskId, projectId }: { taskId: string; projectId?: string }) => {
    const pid = projectId ?? guessProjectIdFor(taskId);
    if (pid) useTasks.getState().remove(pid, taskId);
  });
  socket.on('task:bulk_updated', ({ taskIds, patch, projectId }: any) => {
    const pid = projectId ?? Object.keys(useTasks.getState().byProject)[0];
    if (pid) useTasks.getState().applyBulkPatch(pid, taskIds, patch);
  });
  socket.on('task:bulk_deleted', ({ taskIds, projectId }: any) => {
    const pid = projectId ?? Object.keys(useTasks.getState().byProject)[0];
    if (pid) useTasks.getState().bulkRemove(pid, taskIds);
  });

  // === Presence ===
  socket.on('task:editing', ({ userId, taskId }: { userId: string; taskId: string }) => {
    const projectId = guessProjectIdFor(taskId);
    if (projectId) useTasks.getState().startEditing(projectId, taskId, userId);
  });
  socket.on('task:stop_editing', ({ userId, taskId }: { userId: string; taskId: string }) => {
    const projectId = guessProjectIdFor(taskId);
    if (projectId) useTasks.getState().stopEditing(projectId, taskId, userId);
  });

  // === Notifications ===
  socket.on('notification', (n: any) => {
    useNotifications.getState().prepend(n);
    toast(n.message);
  });

  return socket;
}

function guessProjectIdFor(taskId: string): string | undefined {
  const state = useTasks.getState().byProject;
  for (const [projectId, tasks] of Object.entries(state)) {
    if (tasks[taskId]) return projectId;
  }
  return undefined;
}

export function joinProject(projectId: string) {
  const s = getSocket();
  joinedProjects.add(projectId);
  s.emit('project:join', projectId);
}

export function leaveProject(projectId: string) {
  joinedProjects.delete(projectId);
  socket?.emit('project:leave', projectId);
}

export function emitEditing(projectId: string, taskId: string) {
  socket?.emit('task:editing', { projectId, taskId });
}

export function emitStopEditing(projectId: string, taskId: string) {
  socket?.emit('task:stop_editing', { projectId, taskId });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  joinedProjects.clear();
}
