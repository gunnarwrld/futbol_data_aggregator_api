import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { logger } from './logger.js';

let io: SocketIOServer | null = null;

/**
 * Initialize the Socket.io server.
 * Attaches to the existing Express HTTP server.
 *
 * @param server - The Node.js HTTP server instance
 */
export function initializeSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend domains
      methods: ['GET', 'POST'],
    },
    path: '/api/v1/realtime', // Custom path to avoid conflicts
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Client connected to realtime layer');

    // Allow clients to subscribe to specific match updates
    socket.on('subscribe:match', (matchId: string) => {
      void socket.join(`match:${matchId}`);
      logger.debug({ socketId: socket.id, matchId }, 'Client subscribed to match');
    });

    socket.on('unsubscribe:match', (matchId: string) => {
      void socket.leave(`match:${matchId}`);
      logger.debug({ socketId: socket.id, matchId }, 'Client unsubscribed from match');
    });

    // Global live matches room
    socket.on('subscribe:live-matches', () => {
      void socket.join('live-matches');
      logger.debug({ socketId: socket.id }, 'Client subscribed to global live matches');
    });

    socket.on('unsubscribe:live-matches', () => {
      void socket.leave('live-matches');
      logger.debug({ socketId: socket.id }, 'Client unsubscribed from global live matches');
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Client disconnected from realtime layer');
    });
  });

  logger.info('🔌 Socket.io real-time push layer initialized');
  return io;
}

/**
 * Get the initialized Socket.io instance.
 * Throws an error if called before initialization.
 */
export function getSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initializeSocket first.');
  }
  return io;
}
