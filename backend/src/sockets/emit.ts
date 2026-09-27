import type { Server } from 'socket.io';

// Untyped at this boundary — emit helpers don't need the per-event typing.
let io: Server<any, any, any, any> | null = null;

export function setIO(server: Server<any, any, any, any>) {
  io = server;
}

export function getIO(): Server<any, any, any, any> {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/** Broadcast to every member viewing a given project. */
export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload);
}

/** Direct message to a specific user (across all their connected devices). */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
