import { z } from 'zod';

// Sanitización básica para prevenir HTML o scripting
export function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Eliminar tags HTML
    .trim();
}

export const participantJoinSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .transform(sanitizeText),
  sessionToken: z.string().optional(),
  eventId: z.string().optional()
});

export const sendMessageSchema = z.object({
  recipientType: z.enum(['ALL', 'PARTICIPANT']),
  recipientId: z.string().optional().nullable(),
  content: z
    .string()
    .min(1, 'El mensaje no puede estar vacío')
    .max(1000, 'El mensaje no puede exceder 1000 caracteres')
});

export const templateSchema = z.object({
  name: z.string().min(2, 'El título debe tener al menos 2 caracteres').max(60),
  content: z.string().min(1, 'El contenido no puede estar vacío').max(1000)
});

export const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida')
});
