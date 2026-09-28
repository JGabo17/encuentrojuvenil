import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_encuentro_juvenil_2026';

export interface AdminTokenPayload {
  username: string;
  role: 'ADMIN';
}

export function generateAdminToken(username: string): string {
  return jwt.sign({ username, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch (err) {
    return null;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Se requiere token de administrador.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAdminToken(token);

  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Token inválido o permisos insuficientes.' });
  }

  (req as any).admin = payload;
  next();
}
