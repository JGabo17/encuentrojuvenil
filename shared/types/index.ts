// Tipos compartidos entre Frontend y Backend para Encuentro Juvenil MVP

export type RecipientType = 'ALL' | 'PARTICIPANT';
export type ParticipantRole = 'CAPTAIN' | 'MEMBER';
export type QuestionType = 'ORAL_DEFENSE' | 'MULTIPLE_CHOICE';

export type GameStatus =
  | 'LOBBY'           // Sala de espera
  | 'QUESTION_READING' // Pregunta y opciones en pantalla para lectura previa; buzzer bloqueado
  | 'COUNTDOWN_ACTIVE' // Cuenta regresiva hacia atrás activa (7s); buzzer a punto de desbloquearse
  | 'QUESTION_ACTIVE' // Pregunta en curso, temporizador corriendo, buzzer habilitado para pulsar
  | 'BUZZER_LOCKED'   // Un capitán ganó el turno con el pulsador
  | 'EVALUATING'      // El moderador está deliberando o escuchando la respuesta oral
  | 'SHOWING_RESULT'  // Mostrando el veredicto (Correcto, Parcial, Incorrecto)
  | 'LEADERBOARD';    // Podio / Tabla de posiciones general

export interface Question {
  id: string;
  eventId: string;
  text: string;
  type: QuestionType;
  options?: string[]; // Para opción múltiple
  correctOptionIndex?: number | null;
  points: number;
  timeLimit: number;
  order: number;
  createdAt?: string;
}

export interface BuzzerWinner {
  teamId: string;
  teamName: string;
  teamAvatar?: string | null;
  captainName: string;
  pressedAt: number; // milisegundos
}

export interface GameResult {
  grade: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
  pointsAwarded: number;
  teamId: string;
  teamName: string;
  correctOptionIndex?: number | null;
}

export interface GameState {
  status: GameStatus;
  currentQuestion?: Question | null;
  timeRemaining: number;
  countdownRemaining?: number;
  buzzerWinner?: BuzzerWinner | null;
  selectedChoice?: number | null;
  result?: GameResult | null;
}

export interface TeamMemberSummary {
  id: string;
  name: string;
  role: ParticipantRole;
  isConnected: boolean;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  motto?: string | null;
  avatar: string;
  pin?: string; // Solo se envía al capitán o admin
  score: number;
  memberCount: number;
  members?: TeamMemberSummary[];
  createdAt?: string;
}

export interface Participant {
  id: string;
  eventId: string;
  name: string;
  role: ParticipantRole;
  teamId?: string | null;
  team?: Team | null;
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

export interface StageData {
  teams: Team[];
  totalParticipants: number;
  connectedCount: number;
  gameState?: GameState;
  muralPhotos?: MuralPhotoItem[];
}

// Fase 3: Encuentro e Integración (Chat en duplas & Mural social)
export interface ChatPartner {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamAvatar?: string | null;
}

export interface ChatMessageItem {
  id: string;
  pairingId: string;
  senderId: string;
  senderName: string;
  senderTeamName: string;
  content: string;
  photoUrl?: string | null;
  isApprovedForMural: boolean;
  sentAt: string;
}

export interface PairingData {
  id: string;
  partners: ChatPartner[];
  messages: ChatMessageItem[];
}

/** Mensaje de un joven mostrado en el muro en vivo del Stage */
export interface WallMessage {
  id: string;
  content: string;
  senderName: string;
  senderTeamName: string;
  sentAt: string;
}

/** Vista del admin: incluye el estado de moderación de cada mensaje */
export interface WallModerationItem extends WallMessage {
  flagged: boolean;
  hidden: boolean;
  approved: boolean;
  onWall: boolean;
}

export interface WallState {
  enabled: boolean;
  messages: WallMessage[];
}

export interface AdminWallState {
  enabled: boolean;
  messages: WallModerationItem[];
  words: string[];
}
export interface MuralPhotoItem {
  id: string;
  photoUrl: string;
  caption: string;
  senderName: string;
  senderTeamName: string;
  partnerNames: string[];
  sentAt: string;
}

export interface SocialState {
  chatEnabled: boolean;
  totalPairings: number;
  approvedPhotosCount: number;
}

// Eventos de Socket.IO
export interface ClientToServerEvents {
  // Participante / Registro tradicional
  'participant:join': (
    data: { name: string; sessionToken?: string; eventId?: string },
    callback?: (response: { success: boolean; error?: string; participant?: Participant }) => void
  ) => void;

  // Equipos y Roles (Fase 1)
  'team:create': (
    data: { teamName: string; motto?: string; avatar: string; captainName: string; sessionToken?: string },
    callback?: (response: { success: boolean; error?: string; team?: Team; participant?: Participant }) => void
  ) => void;
  'team:join': (
    data: { teamId: string; pin: string; name: string; sessionToken?: string },
    callback?: (response: { success: boolean; error?: string; team?: Team; participant?: Participant }) => void
  ) => void;
  'teams:get': (
    callback?: (response: { success: boolean; teams: Team[] }) => void
  ) => void;

  // Fase 2: Motor de Trivia y Pulsador Buzzer
  'captain:buzz': (
    callback?: (response: { success: boolean; won: boolean; error?: string }) => void
  ) => void;
  'captain:submit-choice': (
    data: { choiceIndex: number },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'game:get-state': (
    callback?: (response: { state: GameState }) => void
  ) => void;

  // Moderador / Admin Trivia Control
  'admin:start-question': (
    data: { questionId: string; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:start-countdown': (
    data?: { countdownSeconds?: number; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:cancel-question': (
    data?: { token?: string } | ((response: { success: boolean; error?: string }) => void),
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:grade-defense': (
    data: { grade: 'CORRECT' | 'PARTIAL' | 'INCORRECT'; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:show-result': (
    data?: { token?: string } | ((response: { success: boolean; error?: string }) => void),
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:show-leaderboard': (
    data?: { token?: string } | ((response: { success: boolean }) => void),
    callback?: (response: { success: boolean }) => void
  ) => void;
  'admin:reset-to-lobby': (
    data?: { token?: string } | ((response: { success: boolean }) => void),
    callback?: (response: { success: boolean }) => void
  ) => void;
  'admin:create-question': (
    data: {
      text: string;
      type: QuestionType;
      options?: string[];
      correctOptionIndex?: number;
      points?: number;
      timeLimit?: number;
      token?: string;
    },
    callback?: (response: { success: boolean; question?: Question; error?: string }) => void
  ) => void;
  'admin:get-questions': (
    callback?: (response: { success: boolean; questions: Question[] }) => void
  ) => void;

  // Pantalla del Auditorio / Proyector
  'stage:join': (
    callback?: (response: { success: boolean; data: StageData; gameState: GameState }) => void
  ) => void;

  // Admin general
  'admin:join': (
    data: { token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:send-message': (
    data: { recipientType: RecipientType; recipientId?: string; content: string; token?: string },
    callback?: (response: { success: boolean; error?: string; message?: MessageLog }) => void
  ) => void;
  'admin:create-template': (
    data: { name: string; content: string; token?: string },
    callback?: (response: { success: boolean; template?: MessageTemplate; error?: string }) => void
  ) => void;
  'admin:update-template': (
    data: { id: string; name: string; content: string; token?: string },
    callback?: (response: { success: boolean; template?: MessageTemplate; error?: string }) => void
  ) => void;
  'admin:delete-template': (
    data: { id: string; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  // Fase 3: Encuentro e Integración (Chat en duplas y Mural)
  'admin:start-pairings': (
    data?: { token?: string } | ((response: { success: boolean; count?: number; error?: string }) => void),
    callback?: (response: { success: boolean; count?: number; error?: string }) => void
  ) => void;
  'admin:toggle-chat': (
    data: { enabled: boolean; token?: string },
    callback?: (response: { success: boolean; chatEnabled: boolean }) => void
  ) => void;
  'admin:get-moderation-queue': (
    data?: { token?: string } | ((response: { success: boolean; queue: ChatMessageItem[] }) => void),
    callback?: (response: { success: boolean; queue: ChatMessageItem[] }) => void
  ) => void;
  'admin:moderate-photo': (
    data: { messageId: string; approved: boolean; token?: string },
    callback?: (response: { success: boolean }) => void
  ) => void;
  'participant:get-pairing': (
    callback?: (response: { success: boolean; pairing?: PairingData; chatEnabled: boolean }) => void
  ) => void;
  'chat:send-message': (
    data: { pairingId: string; content: string; photoUrl?: string },
    callback?: (response: { success: boolean; message?: ChatMessageItem; error?: string }) => void
  ) => void;
  'stage:get-wall': (
    callback?: (response: { success: boolean; enabled: boolean; messages: WallMessage[] }) => void
  ) => void;
  'admin:get-wall': (
    data?: { token?: string } | ((response: { success: boolean } & AdminWallState) => void),
    callback?: (response: { success: boolean } & AdminWallState) => void
  ) => void;
  'admin:wall-hide': (
    data: { messageId: string; hidden: boolean; token?: string },
    callback?: (response: { success: boolean }) => void
  ) => void;
  'admin:wall-approve': (
    data: { messageId: string; approved: boolean; token?: string },
    callback?: (response: { success: boolean }) => void
  ) => void;
  'admin:wall-toggle': (
    data: { enabled: boolean; token?: string },
    callback?: (response: { success: boolean; enabled: boolean }) => void
  ) => void;
  'admin:wall-set-words': (
    data: { words: string[]; token?: string },
    callback?: (response: { success: boolean; words: string[] }) => void
  ) => void;
  'stage:get-mural': (
    callback?: (response: { success: boolean; photos: MuralPhotoItem[] }) => void
  ) => void;

  // Superpoderes de Admin & Contingencias en Vivo
  'admin:adjust-team-points': (
    data: { teamId: string; deltaPoints: number; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:rebound-question': (
    data?: { seconds?: number; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:kick-participant': (
    data: { participantId: string; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:transfer-captain': (
    data: { teamId: string; newCaptainId: string; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'admin:reset-event': (
    data: { confirmText: string; token?: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;

  // Ping básico
  'client:ping': (data: { message: string }) => void;
}

export interface ServerToClientEvents {
  // Para Participantes
  'message:received': (message: LiveMessagePayload) => void;
  'participant:registered': (participant: Participant) => void;
  'participant:kicked': (data: { reason: string }) => void;
  'participant:role-updated': (data: { role: ParticipantRole }) => void;
  'event:reset': () => void;

  // Para Equipos y Sala de Espera
  'teams:update': (teams: Team[]) => void;
  'stage:update': (data: StageData) => void;

  // Fase 2: Eventos del Juego en Vivo
  'game:state-update': (state: GameState) => void;
  'game:timer-tick': (data: { timeRemaining: number }) => void;
  'game:countdown-tick': (data: { countdownRemaining: number }) => void;
  'game:buzzer-won': (winner: BuzzerWinner) => void;
  'game:score-updated': (teams: Team[]) => void;

  // Fase 3: Eventos Sociales
  'pairing:assigned': (pairing: PairingData) => void;
  'chat:new-message': (message: ChatMessageItem) => void;
  'chat:status-change': (data: { chatEnabled: boolean }) => void;
  'stage:mural-update': (photos: MuralPhotoItem[]) => void;
  'stage:wall-update': (data: WallState) => void;
  'admin:wall-update': (data: AdminWallState) => void;
  'admin:photo-submitted': (message: ChatMessageItem) => void;
  'admin:moderation-queue-update': (queue: ChatMessageItem[]) => void;

  // Para Administrador
  'admin:participants-update': (participants: Participant[]) => void;
  'admin:participant-joined': (participant: Participant) => void;
  'admin:participant-status': (data: { participantId: string; isConnected: boolean }) => void;
  'admin:message-logged': (log: MessageLog) => void;

  // General
  'system:error': (data: { message: string }) => void;
  'server:pong': (data: { message: string; timestamp: string }) => void;
}
