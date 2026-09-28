import prisma from './db.js';
import { getOrCreateActiveEvent } from './eventService.js';
import type { MessageTemplate } from '../types/index.js';

function mapTemplate(t: any): MessageTemplate {
  return {
    id: t.id,
    eventId: t.eventId,
    name: t.name,
    content: t.content,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  };
}

export async function getTemplates(eventId?: string): Promise<MessageTemplate[]> {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();
  const list = await prisma.messageTemplate.findMany({
    where: { eventId: activeEvent.id },
    orderBy: { createdAt: 'asc' }
  });
  return list.map(mapTemplate);
}

export async function createTemplate(data: { name: string; content: string; eventId?: string }): Promise<MessageTemplate> {
  const activeEvent = data.eventId ? { id: data.eventId } : await getOrCreateActiveEvent();
  const created = await prisma.messageTemplate.create({
    data: {
      eventId: activeEvent.id,
      name: data.name,
      content: data.content
    }
  });
  return mapTemplate(created);
}

export async function updateTemplate(id: string, data: { name: string; content: string }): Promise<MessageTemplate> {
  const updated = await prisma.messageTemplate.update({
    where: { id },
    data: {
      name: data.name,
      content: data.content
    }
  });
  return mapTemplate(updated);
}

export async function deleteTemplate(id: string): Promise<void> {
  await prisma.messageTemplate.delete({
    where: { id }
  });
}
