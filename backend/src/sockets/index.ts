import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyToken, type AccessPayload } from '../utils/jwt';
import { Project } from '../models/Project';
import { setIO } from './emit';

interface SocketData {
  userId: string;
  email: string;
  // Tracks which task the user is "editing" — used for presence cleanup on disconnect.
  editing?: { projectId: string; taskId: string };
}

export function initSocket(httpServer: HttpServer) {
  const io = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS_LIST,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT handshake
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string } | undefined)?.token ||
        (socket.handshake.headers.authorization as string | undefined)?.replace(/^Bearer /, '');
      if (!token) return next(new Error('Missing token'));
      const payload = verifyToken<AccessPayload>('access', token);
      if (payload.type !== 'access') return next(new Error('Invalid token type'));
      socket.data = { userId: payload.sub, email: payload.email };
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket auth failed');
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    // Personal room — used by notifications.
    socket.join(`user:${userId}`);
    logger.debug({ userId, sid: socket.id }, 'Socket connected');

    socket.on('project:join', async (projectId: string, ack?: (ok: boolean) => void) => {
      try {
        if (!projectId || typeof projectId !== 'string') return ack?.(false);
        // Authorize: must be owner or member.
        const project = await Project.findById(projectId).select('owner members').lean();
        if (!project) return ack?.(false);
        const allowed =
          String(project.owner) === userId ||
          project.members.some((m) => String(m.user) === userId);
        if (!allowed) return ack?.(false);

        socket.join(`project:${projectId}`);
        // Tell everyone in the room who is here.
        socket.to(`project:${projectId}`).emit('presence:join', { userId });
        ack?.(true);
      } catch (err) {
        logger.error({ err }, 'project:join failed');
        ack?.(false);
      }
    });

    socket.on('project:leave', (projectId: string) => {
      if (typeof projectId !== 'string') return;
      socket.leave(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('presence:leave', { userId });
    });

    /**
     * Edit-presence — "user X is editing task Y". Other clients receive the indicator
     * and ours self-clears on disconnect.
     */
    socket.on('task:editing', (payload: { projectId: string; taskId: string }) => {
      if (!payload?.projectId || !payload?.taskId) return;
      socket.data.editing = payload;
      socket.to(`project:${payload.projectId}`).emit('task:editing', {
        userId,
        taskId: payload.taskId,
      });
    });

    socket.on('task:stop_editing', (payload: { projectId: string; taskId: string }) => {
      if (!payload?.projectId || !payload?.taskId) return;
      socket.data.editing = undefined;
      socket.to(`project:${payload.projectId}`).emit('task:stop_editing', {
        userId,
        taskId: payload.taskId,
      });
    });

    socket.on('disconnect', () => {
      // If the user disconnects mid-edit, broadcast a "stop editing" so other clients clear UI.
      const editing = socket.data.editing;
      if (editing) {
        socket.to(`project:${editing.projectId}`).emit('task:stop_editing', {
          userId,
          taskId: editing.taskId,
        });
      }
      logger.debug({ userId, sid: socket.id }, 'Socket disconnected');
    });
  });

  setIO(io);
  return io;
}
