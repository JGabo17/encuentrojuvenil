import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { setupSocketHandlers } from './socket/index.js';
import { getOrCreateActiveEvent } from './services/eventService.js';
import type { ClientToServerEvents, ServerToClientEvents } from './types/index.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Necesario para proxies inversos como Render, Cloudflare, etc.
const port = process.env.PORT || 4000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Seguridad con Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Evita advertencias de devtools en desarrollo local
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes locales de desarrollo y clientes
    callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Rate Limiting para APIs
app.use('/api/', apiLimiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

import path from 'path';
import fs from 'fs';

const clientDistPath = fs.existsSync(path.resolve(process.cwd(), 'client/dist'))
  ? path.resolve(process.cwd(), 'client/dist')
  : path.resolve(process.cwd(), '../client/dist');

// Servir frontend compilado en producción si existe
if (fs.existsSync(clientDistPath)) {
  console.log(`[Frontend] Sirviendo frontend estático desde ${clientDistPath}`);
  app.use(express.static(clientDistPath));
}

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'Encuentro Juvenil MVP', time: new Date().toISOString() });
});

// Fallback para React Router / SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Servidor Encuentro Juvenil</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #111827; padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); max-width: 480px; }
          h1 { color: #818cf8; margin-bottom: 12px; }
          p { color: #9ca3af; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
          a { display: inline-block; margin: 6px; padding: 12px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
          a.admin { background: #ec4899; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚡ Servidor Backend Activo</h1>
          <p>Este es el servidor API & WebSockets.<br>Para correr con el frontend compilado ejecuta: <code>npm run build</code></p>
          <a href="http://localhost:5173/">📱 Ir a Vista Participante (Dev)</a>
          <a href="http://localhost:5173/admin" class="admin">💻 Ir a Panel Admin (Dev)</a>
        </div>
      </body>
    </html>
  `);
});

const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configurar WebSockets
setupSocketHandlers(io);

// Inicializar evento activo y arrancar servidor
getOrCreateActiveEvent().then((activeEvent) => {
  console.log(`[Base de Datos] Evento activo: "${activeEvent.name}" (Código: ${activeEvent.code})`);
  server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[Servidor] Listo en http://localhost:${port}`);
    console.log(`[Red Local] Accesible en http://0.0.0.0:${port}`);
    console.log(`[WebSockets] Escuchando conexiones`);
  });
}).catch((err) => {
  console.error('[Error de inicio]', err);
});
