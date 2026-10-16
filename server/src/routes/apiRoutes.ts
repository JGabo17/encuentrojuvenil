import { Router } from 'express';
import { requireAdminAuth } from '../middleware/auth.js';
import { getOrCreateActiveEvent } from '../services/eventService.js';
import { getAllParticipants } from '../services/participantService.js';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../services/templateService.js';
import { getMessageHistory } from '../services/messageService.js';
import { templateSchema } from '../utils/validators.js';

const router = Router();

import { getAllTeams, getStageData } from '../services/teamService.js';

// Evento público activo
router.get('/event', async (req, res) => {
  try {
    const event = await getOrCreateActiveEvent();
    res.json({
      id: event.id,
      name: event.name,
      code: event.code,
      status: event.status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener evento' });
  }
});

// Listado público de equipos (sin PIN)
router.get('/teams', async (req, res) => {
  try {
    const teams = await getAllTeams(undefined, false);
    res.json(teams);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener equipos' });
  }
});

// Datos para la pantalla de auditorio / proyector
router.get('/stage', async (req, res) => {
  try {
    const stage = await getStageData();
    res.json(stage);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener datos de stage' });
  }
});

// Rutas protegidas para Administrador
router.get('/participants', requireAdminAuth, async (req, res) => {
  try {
    const participants = await getAllParticipants();
    res.json(participants);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', requireAdminAuth, async (req, res) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', requireAdminAuth, async (req, res) => {
  try {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const template = await createTemplate(parsed.data);
    res.status(201).json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/templates/:id', requireAdminAuth, async (req, res) => {
  try {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const template = await updateTemplate(req.params.id, parsed.data);
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:id', requireAdminAuth, async (req, res) => {
  try {
    await deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/messages/history', requireAdminAuth, async (req, res) => {
  try {
    const history = await getMessageHistory();
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
