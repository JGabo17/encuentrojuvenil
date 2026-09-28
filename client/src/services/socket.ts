import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types/index.js';

// Al no especificar URL estática, Socket.IO usa automáticamente el origen del navegador
// y se conecta a través del proxy de Vite (/socket.io) hacia el backend en el puerto 4000
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});
