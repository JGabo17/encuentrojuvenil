import prisma from './db.js';
import { getOrCreateActiveEvent } from './eventService.js';
import type { Team as SharedTeam, StageData, ParticipantRole } from '../types/index.js';
import crypto from 'crypto';

function generatePin(): string {
  // PIN numérico de 4 dígitos entre 1000 y 9999
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function mapToSharedTeam(t: any, showPin = false): SharedTeam {
  const members = t.members
    ? t.members.map((m: any) => ({
        id: m.id,
        name: m.name,
        role: (m.role || 'MEMBER') as ParticipantRole,
        isConnected: Boolean(m.isConnected)
      }))
    : [];

  return {
    id: t.id,
    eventId: t.eventId,
    name: t.name,
    motto: t.motto || null,
    avatar: t.avatar || '🛡️',
    pin: showPin ? t.pin : undefined,
    score: t.score ?? 0,
    memberCount: t._count ? t._count.members : members.length,
    members: members.length > 0 ? members : undefined,
    createdAt: t.createdAt ? t.createdAt.toISOString() : undefined
  };
}

export async function createTeamWithCaptain(data: {
  teamName: string;
  motto?: string;
  avatar: string;
  captainName: string;
  sessionToken?: string;
  socketId: string;
}) {
  const activeEvent = await getOrCreateActiveEvent();

  // Validar si ya existe un equipo con ese nombre en este evento
  const existingTeam = await prisma.team.findFirst({
    where: {
      eventId: activeEvent.id,
      name: { equals: data.teamName.trim() }
    }
  });

  if (existingTeam) {
    throw new Error(`El equipo "${data.teamName.trim()}" ya existe. Elige otro nombre.`);
  }

  const pin = generatePin();

  // Crear el equipo
  const team = await prisma.team.create({
    data: {
      eventId: activeEvent.id,
      name: data.teamName.trim(),
      motto: data.motto ? data.motto.trim() : null,
      avatar: data.avatar || '🛡️',
      pin,
      score: 0
    }
  });

  // Crear o actualizar el participante como Capitán
  let participant;
  if (data.sessionToken) {
    const existingP = await prisma.participant.findUnique({
      where: { sessionToken: data.sessionToken }
    });

    if (existingP) {
      participant = await prisma.participant.update({
        where: { id: existingP.id },
        data: {
          name: data.captainName.trim(),
          role: 'CAPTAIN',
          teamId: team.id,
          socketId: data.socketId,
          isConnected: true
        },
        include: { team: true }
      });
    }
  }

  if (!participant) {
    const sessionToken = crypto.randomUUID();
    participant = await prisma.participant.create({
      data: {
        eventId: activeEvent.id,
        name: data.captainName.trim(),
        role: 'CAPTAIN',
        teamId: team.id,
        sessionToken,
        socketId: data.socketId,
        isConnected: true
      },
      include: { team: true }
    });
  }

  return {
    team: mapToSharedTeam(team, true), // Capitán sí recibe el PIN
    participant: {
      id: participant.id,
      eventId: participant.eventId,
      name: participant.name,
      role: 'CAPTAIN' as ParticipantRole,
      teamId: team.id,
      team: mapToSharedTeam(team, true),
      sessionToken: participant.sessionToken,
      socketId: participant.socketId,
      isConnected: participant.isConnected,
      createdAt: participant.createdAt.toISOString(),
      updatedAt: participant.updatedAt.toISOString()
    }
  };
}

export async function joinTeamAsMember(data: {
  teamId: string;
  pin: string;
  name: string;
  sessionToken?: string;
  socketId: string;
}) {
  const activeEvent = await getOrCreateActiveEvent();

  const team = await prisma.team.findUnique({
    where: { id: data.teamId },
    include: {
      members: true,
      _count: { select: { members: true } }
    }
  });

  if (!team || team.eventId !== activeEvent.id) {
    throw new Error('Equipo no encontrado.');
  }

  if (team.pin !== data.pin.trim()) {
    throw new Error('El código PIN de 4 dígitos no es correcto para este equipo.');
  }

  let participant;
  if (data.sessionToken) {
    const existingP = await prisma.participant.findUnique({
      where: { sessionToken: data.sessionToken }
    });

    if (existingP) {
      participant = await prisma.participant.update({
        where: { id: existingP.id },
        data: {
          name: data.name.trim(),
          role: 'MEMBER',
          teamId: team.id,
          socketId: data.socketId,
          isConnected: true
        },
        include: { team: true }
      });
    }
  }

  if (!participant) {
    const sessionToken = crypto.randomUUID();
    participant = await prisma.participant.create({
      data: {
        eventId: activeEvent.id,
        name: data.name.trim(),
        role: 'MEMBER',
        teamId: team.id,
        sessionToken,
        socketId: data.socketId,
        isConnected: true
      },
      include: { team: true }
    });
  }

  return {
    team: mapToSharedTeam(team, false),
    participant: {
      id: participant.id,
      eventId: participant.eventId,
      name: participant.name,
      role: 'MEMBER' as ParticipantRole,
      teamId: team.id,
      team: mapToSharedTeam(team, false),
      sessionToken: participant.sessionToken,
      socketId: participant.socketId,
      isConnected: participant.isConnected,
      createdAt: participant.createdAt.toISOString(),
      updatedAt: participant.updatedAt.toISOString()
    }
  };
}

export async function getAllTeams(eventId?: string, includePin = false): Promise<SharedTeam[]> {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();

  const teams = await prisma.team.findMany({
    where: { eventId: activeEvent.id },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          role: true,
          isConnected: true
        }
      },
      _count: { select: { members: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  return teams.map((t) => mapToSharedTeam(t, includePin));
}

export async function getStageData(eventId?: string): Promise<StageData> {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();

  const [teams, totalParticipants, connectedCount] = await Promise.all([
    getAllTeams(activeEvent.id, false),
    prisma.participant.count({ where: { eventId: activeEvent.id } }),
    prisma.participant.count({ where: { eventId: activeEvent.id, isConnected: true } })
  ]);

  return {
    teams,
    totalParticipants,
    connectedCount
  };
}

export async function adjustTeamScore(teamId: string, deltaPoints: number): Promise<SharedTeam> {
  const current = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          role: true,
          isConnected: true
        }
      },
      _count: { select: { members: true } }
    }
  });

  if (!current) {
    throw new Error('Equipo no encontrado.');
  }

  const newScore = Math.max(0, (current.score || 0) + deltaPoints);

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { score: newScore },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          role: true,
          isConnected: true
        }
      },
      _count: { select: { members: true } }
    }
  });

  return mapToSharedTeam(updated, true);
}

export async function setTeamScore(teamId: string, exactScore: number): Promise<SharedTeam> {
  const current = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          role: true,
          isConnected: true
        }
      },
      _count: { select: { members: true } }
    }
  });

  if (!current) {
    throw new Error('Equipo no encontrado.');
  }

  const newScore = Math.max(0, Math.floor(Number(exactScore) || 0));

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { score: newScore },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          role: true,
          isConnected: true
        }
      },
      _count: { select: { members: true } }
    }
  });

  return mapToSharedTeam(updated, true);
}

export async function transferCaptaincy(teamId: string, newCaptainId: string): Promise<SharedTeam> {
  // Reasignar capitán anterior a MEMBER
  await prisma.participant.updateMany({
    where: {
      teamId,
      role: 'CAPTAIN'
    },
    data: {
      role: 'MEMBER'
    }
  });

  // Asignar al nuevo participante como CAPTAIN
  await prisma.participant.update({
    where: { id: newCaptainId },
    data: {
      role: 'CAPTAIN',
      teamId
    }
  });

  const updated = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        select: {
          id: true,
          name: true,
          role: true,
          isConnected: true
        }
      },
      _count: { select: { members: true } }
    }
  });

  if (!updated) {
    throw new Error('Equipo no encontrado tras transferir capitanía.');
  }

  return mapToSharedTeam(updated, true);
}

export async function resetEventData(eventId?: string): Promise<void> {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();

  // Limpieza en cascada respetando llaves foráneas (no toca Question ni MessageTemplate)
  await prisma.$transaction([
    prisma.chatMessage.deleteMany({}),
    prisma.pairing.deleteMany({}),
    prisma.messageLog.deleteMany({ where: { eventId: activeEvent.id } }),
    prisma.participant.deleteMany({ where: { eventId: activeEvent.id } }),
    prisma.team.deleteMany({ where: { eventId: activeEvent.id } })
  ]);
}

