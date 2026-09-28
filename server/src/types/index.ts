export type RecipientType = 'ALL' | 'PARTICIPANT';

export interface Participant {
  id: string;
  eventId: string;
  name: string;
  sessionToken: string;
  socketId?: string | null;
  isConnected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  eventId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  eventId: string;
  sender: string;
  recipientType: RecipientType;
  recipientId?: string | null;
  recipientName?: string | null;
  content: string;
  sentAt: string;
}

export interface LiveMessagePayload {
  id: string;
  content: string;
  recipientType: RecipientType;
  recipientId?: string | null;
  sentAt: string;
}

// Eventos de Socket.IO
export interface ClientToServerEvents {
  // Participante
  'participant:join': (
    data: { name: string; sessionToken?: string; eventId?: string },
    callback?: (response: { success: boolean; error?: string; participant?: Participant }) => void
  ) => void;

  // Admin
  'admin:join': (
    data: { token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:send-message': (
    data: { recipientType: RecipientType; recipientId?: string; content: string },
    callback?: (response: { success: boolean; error?: string; message?: MessageLog }) => void
  ) => void;
  'admin:create-template': (
    data: { name: string; content: string },
    callback?: (response: { success: boolean; template?: MessageTemplate; error?: string }) => void
  ) => void;
  'admin:update-template': (
    data: { id: string; name: string; content: string },
    callback?: (response: { success: boolean; template?: MessageTemplate; error?: string }) => void
  ) => void;
  'admin:delete-template': (
    data: { id: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  // Fase 1 ping/saludo simple
  'client:ping': (data: { message: string }) => void;
}

export interface ServerToClientEvents {
  // Para Participantes
  'message:received': (message: LiveMessagePayload) => void;
  'participant:registered': (participant: Participant) => void;

  // Para Administrador
  'admin:participants-update': (participants: Participant[]) => void;
  'admin:participant-joined': (participant: Participant) => void;
  'admin:participant-status': (data: { participantId: string; isConnected: boolean }) => void;
  'admin:message-logged': (log: MessageLog) => void;

  // General
  'system:error': (data: { message: string }) => void;
  'server:pong': (data: { message: string; timestamp: string }) => void;
}
