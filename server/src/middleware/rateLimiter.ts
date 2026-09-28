import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // límite de 300 peticiones por ventana
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Demasiadas solicitudes desde esta IP, por favor intente nuevamente en 15 minutos.' }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // límite estricto para login
  validate: { xForwardedForHeader: false },
  message: { error: 'Demasiados intentos de acceso fallidos, por favor espere unos minutos.' }
});
