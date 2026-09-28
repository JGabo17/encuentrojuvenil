import prisma from './db.js';
import { getOrCreateActiveEvent } from './eventService.js';
import { getParticipantById } from './participantService.js';
import type { MessageLog as SharedMessageLog, RecipientType } from '../types/index.js';

export function replaceVariables(content: string, participantName: string): string {
  return content.replace(/\{nombre\}/gi, participantName);
}

function mapMessageLog(log: any): SharedMessageLog {
  return {
    id: log.id,
    eventId: log.eventId,
    sender: log.sender,
    recipientType: log.recipientType as RecipientType,
    recipientId: log.recipientId,
    recipientName: log.recipientName,
    content: log.content,
    sentAt: log.sentAt.toISOString()
  };
}

export async function logMessage(data: {
  recipientType: RecipientType;
  recipientId?: string | null;
  recipientName?: string | null;
  content: string;
  sender?: string;
  eventId?: string;
}): Promise<SharedMessageLog> {
  const activeEvent = data.eventId ? { id: data.eventId } : await getOrCreateActiveEvent();

  let recipientName = data.recipientName;
  if (!recipientName && data.recipientId) {
    const p = await getParticipantById(data.recipientId);
    if (p) recipientName = p.name;
  }

  const log = await prisma.messageLog.create({
    data: {
      eventId: activeEvent.id,
      sender: data.sender || 'ADMIN',
      recipientType: data.recipientType,
      recipientId: data.recipientId || null,
      recipientName: recipientName || (data.recipientType === 'ALL' ? 'Todos' : null),
      content: data.content
    }
  });

  return mapMessageLog(log);
}

export async function getMessageHistory(eventId?: string, limit = 50): Promise<SharedMessageLog[]> {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();
  const logs = await prisma.messageLog.findMany({
    where: { eventId: activeEvent.id },
    orderBy: { sentAt: 'desc' },
    take: limit
  });

  return logs.map(mapMessageLog);
}
