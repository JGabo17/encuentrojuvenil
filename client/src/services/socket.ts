import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/types/index.js';

// Al no especificar URL estática, Socket.IO usa automáticamente el origen del navegador
// y se conecta a través del proxy de Vite (/socket.io) hacia el backend en el puerto 4000
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 50,
  reconnectionDelay: 800,
  reconnectionDelayMax: 4000,
  randomizationFactor: 0.5,
  timeout: 15000,
  transports: ['websocket', 'polling'],
  auth: (cb) => {
    const adminToken = localStorage.getItem('encuentro_admin_token') || sessionStorage.getItem('encuentro_admin_token');
    const sessionToken = localStorage.getItem('encuentro_session_token');
    cb({
      token: adminToken || undefined,
      sessionToken: sessionToken || undefined
    });
  }
});
