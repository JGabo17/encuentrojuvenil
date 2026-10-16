import prisma from './db.js';
import type { ChatPartner, ChatMessageItem, PairingData, MuralPhotoItem } from '../types/index.js';

// Estado en memoria de la sesión social
let chatEnabled: boolean = false;

export function isChatEnabled(): boolean {
  return chatEnabled;
}

export function setChatEnabled(enabled: boolean): boolean {
  chatEnabled = enabled;
  return chatEnabled;
}

/**
 * Algoritmo de emparejamiento en duplas (o tríos si es impar)
 * Garantiza que nadie quede emparejado con un miembro de su propio grupo.
 */
export async function generateEventPairings(eventId: string) {
  // 1. Obtener participantes con equipo
  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      teamId: { not: null }
    },
    include: {
      team: true
    }
  });

  if (participants.length < 2) {
    throw new Error('Se necesitan al menos 2 participantes con equipo para iniciar el emparejamiento.');
  }

  // Desactivar o eliminar pairings previos del evento
  await prisma.pairing.deleteMany({
    where: { eventId }
  });

  // 2. Barajar lista de participantes
  const remaining = [...participants].sort(() => Math.random() - 0.5);
  const pairs: Array<Array<typeof participants[0]>> = [];

  // Algoritmo voraz para emparejar miembros de distintos equipos
  while (remaining.length >= 2) {
    const first = remaining.shift()!;
    // Buscar el primer participante que sea de un equipo diferente
    const partnerIndex = remaining.findIndex((candidate: typeof participants[0]) => candidate.teamId !== first.teamId);

    if (partnerIndex !== -1) {
      const partner = remaining.splice(partnerIndex, 1)[0];
      pairs.push([first, partner]);
    } else {
      // Si todos los restantes son del mismo equipo que first:
      // Buscamos una pareja ya armada donde ninguno pertenezca al equipo de first
      // y convertimos esa pareja en un trío.
      const candidatePairIndex = pairs.findIndex(
        (p: Array<typeof participants[0]>) => !p.some((member: typeof participants[0]) => member.teamId === first.teamId)
      );

      if (candidatePairIndex !== -1) {
        pairs[candidatePairIndex].push(first);
      } else {
        // Fallback: Si no hay duplas libres, se emparejan entre sí como última opción
        const next = remaining.shift()!;
        pairs.push([first, next]);
      }
    }
  }

  // Si queda un participante impar al final
  if (remaining.length === 1) {
    const odd = remaining.shift()!;
    // Añadirlo a una dupla existente donde su equipo no esté presente
    const compatiblePair = pairs.find((p: Array<typeof participants[0]>) => !p.some((m: typeof participants[0]) => m.teamId === odd.teamId));
    if (compatiblePair) {
      compatiblePair.push(odd);
    } else if (pairs.length > 0) {
      pairs[0].push(odd);
    }
  }

  // 3. Guardar en Base de Datos
  const createdPairings = [];
  for (const group of pairs) {
    const memberIds = group.map((p: typeof participants[0]) => p.id);
    const pairing = await prisma.pairing.create({
      data: {
        eventId,
        memberIds: JSON.stringify(memberIds),
        active: true
      }
    });
    createdPairings.push(pairing);
  }

  // Abrir el chat automáticamente al emparejar
  chatEnabled = true;

  return {
    totalPairings: createdPairings.length,
    totalParticipants: participants.length
  };
}

/**
 * Obtener la información de dupla y mensajes de un participante
 */
export async function getPairingDataForParticipant(participantId: string): Promise<PairingData | null> {
  const pairings = await prisma.pairing.findMany({
    where: { active: true },
    include: {
      messages: {
        orderBy: { sentAt: 'asc' }
      }
    }
  });

  const targetPairing = pairings.find((p: any) => {
    try {
      const ids: string[] = JSON.parse(p.memberIds);
      return ids.includes(participantId);
    } catch {
      return false;
    }
  });

  if (!targetPairing) return null;

  const memberIds: string[] = JSON.parse(targetPairing.memberIds);
  const partnerIds = memberIds.filter((id: string) => id !== participantId);

  const partnersRaw = await prisma.participant.findMany({
    where: { id: { in: partnerIds } },
    include: { team: true }
  });

  const partners: ChatPartner[] = partnersRaw.map((p: any) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId || '',
    teamName: p.team?.name || 'Sin Equipo',
    teamAvatar: p.team?.avatar || '🛡️'
  }));

  const messages: ChatMessageItem[] = targetPairing.messages.map((m: any) => ({
    id: m.id,
    pairingId: m.pairingId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderTeamName: m.senderTeamName,
    content: m.content,
    photoUrl: m.photoUrl,
    isApprovedForMural: m.isApprovedForMural,
    sentAt: m.sentAt.toISOString()
  }));

  return {
    id: targetPairing.id,
    partners,
    messages
  };
}

/**
 * Optimización para 100+ usuarios: Obtiene todas las duplas del evento en 2 únicas consultas a BD
 */
export async function getAllPairingsForEvent(eventId: string): Promise<Map<string, PairingData>> {
  const pairings = await prisma.pairing.findMany({
    where: { eventId, active: true },
    include: {
      messages: { orderBy: { sentAt: 'asc' } }
    }
  });

  const allParticipantIds = new Set<string>();
  pairings.forEach((p: any) => {
    try {
      const ids: string[] = JSON.parse(p.memberIds);
      ids.forEach((id) => allParticipantIds.add(id));
    } catch {}
  });

  const participantsList = await prisma.participant.findMany({
    where: { id: { in: Array.from(allParticipantIds) } },
    include: { team: true }
  });

  const pMap = new Map<string, any>();
  participantsList.forEach((p: any) => pMap.set(p.id, p));

  const result = new Map<string, PairingData>();

  for (const pairing of pairings) {
    let memberIds: string[] = [];
    try {
      memberIds = JSON.parse(pairing.memberIds);
    } catch {
      continue;
    }

    const messages: ChatMessageItem[] = pairing.messages.map((m: any) => ({
      id: m.id,
      pairingId: m.pairingId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderTeamName: m.senderTeamName,
      content: m.content,
      photoUrl: m.photoUrl,
      isApprovedForMural: m.isApprovedForMural,
      sentAt: m.sentAt.toISOString()
    }));

    for (const memberId of memberIds) {
      const partnerIds = memberIds.filter((id) => id !== memberId);
      const partners: ChatPartner[] = partnerIds
        .map((pid) => pMap.get(pid))
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          teamId: p.teamId || '',
          teamName: p.team?.name || 'Sin Equipo',
          teamAvatar: p.team?.avatar || '🛡️'
        }));

      result.set(memberId, {
        id: pairing.id,
        partners,
        messages
      });
    }
  }

  return result;
}

/**
 * Guardar mensaje en el chat de duplas
 */
export async function createChatMessage(data: {
  pairingId: string;
  senderId: string;
  senderName: string;
  senderTeamName: string;
  content: string;
  photoUrl?: string;
}): Promise<ChatMessageItem> {
  const created = await prisma.chatMessage.create({
    data: {
      pairingId: data.pairingId,
      senderId: data.senderId,
      senderName: data.senderName,
      senderTeamName: data.senderTeamName,
      content: data.content,
      photoUrl: data.photoUrl || null,
      isApprovedForMural: false
    }
  });

  return {
    id: created.id,
    pairingId: created.pairingId,
    senderId: created.senderId,
    senderName: created.senderName,
    senderTeamName: created.senderTeamName,
    content: created.content,
    photoUrl: created.photoUrl,
    isApprovedForMural: created.isApprovedForMural,
    sentAt: created.sentAt.toISOString()
  };
}

/**
 * Obtener fotos pendientes o enviadas para la cola de moderación del admin
 */
export async function getModerationQueue(eventId: string): Promise<ChatMessageItem[]> {
  const messages = await prisma.chatMessage.findMany({
    where: {
      photoUrl: { not: null },
      pairing: { eventId }
    },
    orderBy: { sentAt: 'desc' },
    take: 50
  });

  return messages.map((m: any) => ({
    id: m.id,
    pairingId: m.pairingId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderTeamName: m.senderTeamName,
    content: m.content,
    photoUrl: m.photoUrl,
    isApprovedForMural: m.isApprovedForMural,
    sentAt: m.sentAt.toISOString()
  }));
}

/**
 * Moderar fotografía (Aprobar o Rechazar para el Mural de la Pantalla Principal)
 */
export async function moderateChatMessagePhoto(messageId: string, approved: boolean): Promise<ChatMessageItem | null> {
  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { isApprovedForMural: approved }
  });

  return {
    id: updated.id,
    pairingId: updated.pairingId,
    senderId: updated.senderId,
    senderName: updated.senderName,
    senderTeamName: updated.senderTeamName,
    content: updated.content,
    photoUrl: updated.photoUrl,
    isApprovedForMural: updated.isApprovedForMural,
    sentAt: updated.sentAt.toISOString()
  };
}

/**
 * Obtener fotografías aprobadas para rotar en el Mural del Stage
 */
export async function getApprovedMuralPhotos(eventId: string): Promise<MuralPhotoItem[]> {
  const messages = await prisma.chatMessage.findMany({
    where: {
      isApprovedForMural: true,
      photoUrl: { not: null },
      pairing: { eventId }
    },
    include: {
      pairing: true
    },
    orderBy: { sentAt: 'desc' }
  });

  const muralItems: MuralPhotoItem[] = [];

  for (const m of messages) {
    let partnerNames: string[] = [];
    try {
      const memberIds: string[] = JSON.parse(m.pairing.memberIds);
      const otherIds = memberIds.filter((id: string) => id !== m.senderId);
      const partners = await prisma.participant.findMany({
        where: { id: { in: otherIds } },
        select: { name: true }
      });
      partnerNames = partners.map((p: any) => p.name);
    } catch {}

    muralItems.push({
      id: m.id,
      photoUrl: m.photoUrl!,
      caption: m.content,
      senderName: m.senderName,
      senderTeamName: m.senderTeamName,
      partnerNames,
      sentAt: m.sentAt.toISOString()
    });
  }

  return muralItems;
}
