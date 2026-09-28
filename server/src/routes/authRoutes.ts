import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { generateAdminToken, verifyAdminToken } from '../middleware/auth.js';
import { loginSchema } from '../utils/validators.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const DEFAULT_ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

// En producción podríamos guardar el admin en la DB con password hasheado,
// para MVP verificamos contra variable de entorno o hash
router.post('/login', authLimiter, async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { username, password } = result.data;

  const userMatch = username === DEFAULT_ADMIN_USER;
  const passMatch = password === DEFAULT_ADMIN_PASS;

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: 'Credenciales inválidas. Verifica usuario y contraseña.' });
  }

  const token = generateAdminToken(username);
  return res.json({
    token,
    user: { username, role: 'ADMIN' }
  });
});

router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAdminToken(token);

  if (!payload) {
    return res.status(401).json({ valid: false });
  }

  return res.json({ valid: true, user: payload });
});

export default router;
