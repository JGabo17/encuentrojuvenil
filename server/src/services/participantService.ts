import crypto from 'crypto';
import prisma from './db.js';
import { getOrCreateActiveEvent } from './eventService.js';
import type { Participant as SharedParticipant } from '../types/index.js';

function mapToSharedParticipant(p: any): SharedParticipant {
  return {
    id: p.id,
    eventId: p.eventId,
    name: p.name,
    sessionToken: p.sessionToken,
    socketId: p.socketId,
    isConnected: p.isConnected,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString()
  };
}

export async function registerOrReconnectParticipant(data: {
  name: string;
  sessionToken?: string;
  socketId: string;
}) {
  const activeEvent = await getOrCreateActiveEvent();

  // Si viene con sessionToken, intentamos recuperar la sesión existente
  if (data.sessionToken) {
    const existing = await prisma.participant.findUnique({
      where: { sessionToken: data.sessionToken }
    });

    if (existing) {
      const updated = await prisma.participant.update({
        where: { id: existing.id },
        data: {
          name: data.name || existing.name,
          socketId: data.socketId,
          isConnected: true,
          updatedAt: new Date()
        }
      });
      return mapToSharedParticipant(updated);
    }
  }

  // Si no tiene sessionToken o no existe, creamos un nuevo participante
  const sessionToken = crypto.randomUUID();
  const created = await prisma.participant.create({
    data: {
      eventId: activeEvent.id,
      name: data.name,
      sessionToken,
      socketId: data.socketId,
      isConnected: true
    }
  });

  return mapToSharedParticipant(created);
}

export async function setParticipantDisconnected(socketId: string) {
  const participant = await prisma.participant.findFirst({
    where: { socketId }
  });

  if (participant) {
    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        isConnected: false,
        socketId: null
      }
    });
    return mapToSharedParticipant(updated);
  }

  return null;
}

export async function getAllParticipants(eventId?: string) {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();
  const list = await prisma.participant.findMany({
    where: { eventId: activeEvent.id },
    orderBy: { createdAt: 'asc' }
  });

  return list.map(mapToSharedParticipant);
}

export async function getParticipantById(id: string) {
  const participant = await prisma.participant.findUnique({
    where: { id }
  });
  return participant ? mapToSharedParticipant(participant) : null;
}
