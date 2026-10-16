import crypto from 'crypto';
import prisma from './db.js';
import { getOrCreateActiveEvent } from './eventService.js';
import type { Participant as SharedParticipant } from '../types/index.js';

function mapToSharedParticipant(p: any): SharedParticipant {
  return {
    id: p.id,
    eventId: p.eventId,
    name: p.name,
    role: (p.role || 'MEMBER') as any,
    teamId: p.teamId || null,
    team: p.team
      ? {
          id: p.team.id,
          eventId: p.team.eventId,
          name: p.team.name,
          motto: p.team.motto || null,
          avatar: p.team.avatar || '🛡️',
          pin: p.role === 'CAPTAIN' ? p.team.pin : undefined,
          score: p.team.score ?? 0,
          memberCount: p.team.members ? p.team.members.length : 0
        }
      : null,
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
      where: { sessionToken: data.sessionToken },
      include: { team: { include: { members: true } } }
    });

    if (existing) {
      const updated = await prisma.participant.update({
        where: { id: existing.id },
        data: {
          name: data.name || existing.name,
          socketId: data.socketId,
          isConnected: true,
          updatedAt: new Date()
        },
        include: { team: { include: { members: true } } }
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
    },
    include: { team: true }
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

export async function kickParticipant(id: string): Promise<SharedParticipant | null> {
  const participant = await prisma.participant.findUnique({
    where: { id },
    include: { team: true }
  });

  if (!participant) return null;

  // Si tenía mensajes de chat asociados, eliminarlos para evitar problemas de FK
  await prisma.chatMessage.deleteMany({
    where: { senderId: id }
  });

  // Eliminar el participante de la base de datos
  await prisma.participant.delete({
    where: { id }
  });

  return mapToSharedParticipant(participant);
}

