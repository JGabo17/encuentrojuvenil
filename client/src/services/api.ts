import type { MessageTemplate, MessageLog, Participant, Team, StageData } from '../../../shared/types/index.js';

const API_BASE = '/api';

export async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(`${API_BASE}/teams`);
  if (!res.ok) throw new Error('Error al obtener lista de equipos');
  return res.json();
}

export async function fetchStageData(): Promise<StageData> {
  const res = await fetch(`${API_BASE}/stage`);
  if (!res.ok) throw new Error('Error al obtener datos de stage');
  return res.json();
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem('encuentro_admin_token') || sessionStorage.getItem('encuentro_admin_token');
  } catch (e) {
    return null;
  }
}

export function setAdminToken(token: string) {
  try {
    localStorage.setItem('encuentro_admin_token', token);
    sessionStorage.setItem('encuentro_admin_token', token);
  } catch (e) {}
}

export function removeAdminToken() {
  try {
    localStorage.removeItem('encuentro_admin_token');
    sessionStorage.removeItem('encuentro_admin_token');
  } catch (e) {}
}

export async function loginAdmin(username: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error al iniciar sesión');
  }

  setAdminToken(data.token);
  return data;
}

export async function verifyAdminAuth(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return Boolean(data.valid);
  } catch (err) {
    return false;
  }
}

export async function fetchEventInfo() {
  const res = await fetch(`${API_BASE}/event`);
  if (!res.ok) throw new Error('Error al obtener información del evento');
  return res.json();
}

export async function fetchParticipants(): Promise<Participant[]> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/participants`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener participantes');
  return res.json();
}

export async function fetchTemplates(): Promise<MessageTemplate[]> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/templates`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener plantillas');
  return res.json();
}

export async function createTemplate(name: string, content: string): Promise<MessageTemplate> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, content })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear plantilla');
  return data;
}

export async function updateTemplate(id: string, name: string, content: string): Promise<MessageTemplate> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, content })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al actualizar plantilla');
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al eliminar plantilla');
}

export async function fetchMessageHistory(): Promise<MessageLog[]> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/messages/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Error al obtener historial');
  return res.json();
}
