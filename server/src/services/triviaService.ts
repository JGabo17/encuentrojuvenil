import prisma from './db.js';
import { getOrCreateActiveEvent } from './eventService.js';
import { getAllTeams } from './teamService.js';
import type {
  Question,
  QuestionType,
  GameState,
  BuzzerWinner,
  GameResult
} from '../types/index.js';
import type { Server } from 'socket.io';

// Banco Oficial de 20 Preguntas de Alta Dificultad (99 Preguntas Bíblicas Difíciles)
// 10 de Selección Múltiple (MULTIPLE_CHOICE) y 10 de Defensa Oral (ORAL_DEFENSE)
const DEFAULT_QUESTIONS = [
  {
    text: '¿Cuál mujer fue jueza y líder de Israel según el libro de Jueces?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Jael', 'Débora', 'Ester', 'Rut']),
    correctOptionIndex: 1,
    points: 100,
    timeLimit: 25,
    order: 1
  },
  {
    text: 'Según Daniel 1, ¿quién reinaba en Judá cuando Nabucodonosor sitió Jerusalén y qué ordenó hacer con los jóvenes nobles de Israel?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 40,
    order: 2
  },
  {
    text: 'En la carta a Filemón (1:2), ¿a quién llama el apóstol Pablo «nuestro compañero de lucha»?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Apolo', 'Arquipo', 'Onésimo', 'Tíquico']),
    correctOptionIndex: 1,
    points: 100,
    timeLimit: 25,
    order: 3
  },
  {
    text: 'Durante su viaje a Atenas (Hechos 17), ¿qué le dolió en el alma a Pablo al recorrer la ciudad y ante qué concilio o tribunal fue llevado a predicar?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 40,
    order: 4
  },
  {
    text: '¿Cuáles dos discípulos le preguntaron a Jesús si debían mandar que descendiera fuego del cielo sobre una aldea samaritana?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Pedro y Andrés', 'Juan y Jacobo', 'Felipe y Bartolomé', 'Tomás y Mateo']),
    correctOptionIndex: 1,
    points: 100,
    timeLimit: 25,
    order: 5
  },
  {
    text: '¿Cómo se llamaba el infame rey de Judá que llegó al extremo de sacrificar en el fuego a su propio hijo según 2 Reyes 16?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 35,
    order: 6
  },
  {
    text: '¿Cuál era el nombre de la única hija que Lea dio a luz a Jacob según el Génesis?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Zilpa', 'Bilha', 'Dina', 'Séfora']),
    correctOptionIndex: 2,
    points: 100,
    timeLimit: 20,
    order: 7
  },
  {
    text: 'Menciona a qué tribu de Israel pertenecía el rey Saúl en el Antiguo Testamento y explica qué apóstol del Nuevo Testamento pertenecía a esa misma tribu.',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 40,
    order: 8
  },
  {
    text: '¿Cuáles fueron los dos creyentes propuestos para ocupar el lugar de Judas Iscariote como apóstol en Hechos 1?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['José llamado Barsabás y Matías', 'José de Arimatea y Bernabé', 'Silas y Lucas', 'Esteban y Felipe']),
    correctOptionIndex: 0,
    points: 100,
    timeLimit: 25,
    order: 9
  },
  {
    text: '¿Quién era el hijo de David cuya cabellera pesaba más de dos kilos al cortarla cada año y de qué manera insólita quedó atrapado y murió?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 40,
    order: 10
  },
  {
    text: '¿Cuál fue el nombre babilónico asignado al profeta Daniel en la corte del rey de Babilonia?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Sadrac', 'Mesac', 'Abed-nego', 'Beltsasar']),
    correctOptionIndex: 3,
    points: 100,
    timeLimit: 20,
    order: 11
  },
  {
    text: '¿Cuántos capítulos tiene el libro profético de Nahúm y contra cuál gran capital del imperio asirio fue profetizada su destrucción?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 35,
    order: 12
  },
  {
    text: '¿Qué nombre le dio Jacob al lugar donde tuvo el sueño de la escalera al cielo con ángeles que subían y bajaban?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Betel', 'Peniel', 'Hebrón', 'Mahanaim']),
    correctOptionIndex: 0,
    points: 100,
    timeLimit: 20,
    order: 13
  },
  {
    text: 'Según Josué 14, ¿cuántos años tenía Caleb cuando reclamó la posesión del monte de Hebrón y por qué mantenía su fuerza intacta?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 40,
    order: 14
  },
  {
    text: '¿En qué libro de la Biblia se encuentra el versículo más largo de todas las Sagradas Escrituras (versículo 8:9)?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Salmos', 'Isaías', 'Ester', 'Ezequiel']),
    correctOptionIndex: 2,
    points: 100,
    timeLimit: 20,
    order: 15
  },
  {
    text: 'En el libro de Apocalipsis capítulo 2, ¿a qué iglesia advierte Jesús por tolerar a una supuesta profetisa llamada "Jezabel" y qué prácticas promovía?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 200,
    timeLimit: 45,
    order: 16
  },
  {
    text: 'Según las cartas del apóstol Pablo en el Nuevo Testamento (Romanos 3), ¿a quiénes se referían específicamente las Escrituras con el término "gentiles"?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['A los sacerdotes del templo', 'A los pueblos y personas no judías', 'A los soldados romanos exclusivamente', 'A los saduceos']),
    correctOptionIndex: 1,
    points: 100,
    timeLimit: 20,
    order: 17
  },
  {
    text: '¿En qué estado se encontraba el temido general cananeo Sísara cuando murió y quién fue la mujer valiente que lo abatió con una estaca de tienda?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 150,
    timeLimit: 40,
    order: 18
  },
  {
    text: 'En Hechos 17:34, ¿quiénes fueron dos de las personas prominentes de Atenas que creyeron tras escuchar a Pablo predicar en el Areópago?',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: JSON.stringify(['Dionisio y Dámaris', 'Crispo y Gayo', 'Aquila y Priscila', 'Filemón y Apia']),
    correctOptionIndex: 0,
    points: 100,
    timeLimit: 25,
    order: 19
  },
  {
    text: 'Al abrirse el cuarto sello en Apocalipsis 6, ¿qué jinete apareció sobre un caballo amarillo y qué poder destructor le fue otorgado sobre la tierra?',
    type: 'ORAL_DEFENSE' as QuestionType,
    options: null,
    correctOptionIndex: null,
    points: 200,
    timeLimit: 45,
    order: 20
  }
];

export async function ensureDefaultQuestions(eventId: string) {
  const count = await prisma.question.count({ where: { eventId } });
  // Si no hay preguntas o solo estaban las de muestra previas, asegurar las 20 preguntas bíblicas
  if (count < 20) {
    await prisma.question.deleteMany({ where: { eventId } });
    for (const q of DEFAULT_QUESTIONS) {
      await prisma.question.create({
        data: {
          eventId,
          text: q.text,
          type: q.type,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          points: q.points,
          timeLimit: q.timeLimit,
          order: q.order
        }
      });
    }
  }
}

export async function reloadDefaultBiblicalQuestions(eventId: string): Promise<Question[]> {
  await prisma.question.deleteMany({ where: { eventId } });
  for (const q of DEFAULT_QUESTIONS) {
    await prisma.question.create({
      data: {
        eventId,
        text: q.text,
        type: q.type,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        points: q.points,
        timeLimit: q.timeLimit,
        order: q.order
      }
    });
  }
  return getAllQuestions(eventId);
}

function mapToSharedQuestion(q: any): Question {
  let parsedOptions: string[] | undefined = undefined;
  if (q.options) {
    try {
      parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    } catch {
      parsedOptions = [];
    }
  }

  return {
    id: q.id,
    eventId: q.eventId,
    text: q.text,
    type: q.type as QuestionType,
    options: parsedOptions,
    correctOptionIndex: q.correctOptionIndex,
    points: q.points,
    timeLimit: q.timeLimit,
    order: q.order,
    createdAt: q.createdAt ? q.createdAt.toISOString() : undefined
  };
}

export async function getAllQuestions(eventId?: string): Promise<Question[]> {
  const activeEvent = eventId ? { id: eventId } : await getOrCreateActiveEvent();
  await ensureDefaultQuestions(activeEvent.id);

  const questions = await prisma.question.findMany({
    where: { eventId: activeEvent.id },
    orderBy: { order: 'asc' }
  });

  return questions.map(mapToSharedQuestion);
}

export async function createQuestion(data: {
  text: string;
  type: QuestionType;
  options?: string[];
  correctOptionIndex?: number;
  points?: number;
  timeLimit?: number;
}): Promise<Question> {
  const activeEvent = await getOrCreateActiveEvent();
  const highest = await prisma.question.findFirst({
    where: { eventId: activeEvent.id },
    orderBy: { order: 'desc' }
  });

  const nextOrder = (highest?.order ?? 0) + 1;

  const created = await prisma.question.create({
    data: {
      eventId: activeEvent.id,
      text: data.text.trim(),
      type: data.type,
      options: data.options ? JSON.stringify(data.options) : null,
      correctOptionIndex: data.correctOptionIndex ?? null,
      points: data.points ?? 100,
      timeLimit: data.timeLimit ?? 20,
      order: nextOrder
    }
  });

  return mapToSharedQuestion(created);
}

// ====================================================
// MOTOR DE JUEGO EN MEMORIA (UNICA FUENTE DE VERDAD)
// ====================================================
class GameEngine {
  private state: GameState = {
    status: 'LOBBY',
    currentQuestion: null,
    timeRemaining: 0,
    buzzerWinner: null,
    selectedChoice: null,
    result: null
  };

  private timerInterval: NodeJS.Timeout | null = null;
  private io: Server | null = null;

  public setSocketServer(io: Server) {
    this.io = io;
  }

  public getState(): GameState {
    return this.state;
  }

  private broadcastState() {
    if (this.io) {
      this.io.emit('game:state-update', this.state);
    }
  }

  private clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // 1. Iniciar Pregunta en Fase de Lectura previa (Pantallas muestran pregunta y opciones, buzzer bloqueado)
  public async startQuestion(questionId: string, order?: number, text?: string) {
    this.clearTimer();

    let q = await prisma.question.findUnique({ where: { id: questionId } });

    // Fallback de resiliencia: si el servidor se reinició o desplegó y cambiaron los UUIDs,
    // o el cliente tiene una lista desincronizada en memoria:
    if (!q) {
      const activeEvent = await getOrCreateActiveEvent();
      await ensureDefaultQuestions(activeEvent.id);

      const all = await prisma.question.findMany({
        where: { eventId: activeEvent.id },
        orderBy: { order: 'asc' }
      });

      if (text && text.trim()) {
        const cleanText = text.trim().toLowerCase();
        q = all.find((item) => item.text.trim().toLowerCase() === cleanText) || null;
      }

      if (!q && typeof order === 'number') {
        q = all.find((item) => item.order === order) || null;
      }

      if (!q) {
        q = all.find((item) => String(item.order) === String(questionId)) || null;
      }

      if (!q && all.length > 0) {
        q = all[0];
      }
    }

    if (!q) throw new Error('Pregunta no encontrada.');

    const question = mapToSharedQuestion(q);

    this.state = {
      status: 'QUESTION_READING',
      currentQuestion: question,
      timeRemaining: question.timeLimit,
      countdownRemaining: 7,
      buzzerWinner: null,
      selectedChoice: null,
      result: null
    };

    this.broadcastState();
  }

  // 1.1 Iniciar Cuenta Regresiva de 7s hacia atrás para el Buzzer
  public startCountdown(countdownSeconds = 7) {
    if (!this.state.currentQuestion) {
      throw new Error('No hay ninguna pregunta activa para iniciar la cuenta regresiva.');
    }

    this.clearTimer();
    this.state.status = 'COUNTDOWN_ACTIVE';
    this.state.countdownRemaining = countdownSeconds;
    this.broadcastState();

    this.timerInterval = setInterval(() => {
      if (this.state.countdownRemaining === undefined) {
        this.state.countdownRemaining = 7;
      }
      this.state.countdownRemaining -= 1;

      if (this.io) {
        this.io.emit('game:countdown-tick', { countdownRemaining: this.state.countdownRemaining });
      }

      if (this.state.countdownRemaining <= 0) {
        this.clearTimer();
        this.activateBuzzerRace();
      }
    }, 1000);
  }

  // 1.2 Iniciar Carrera de Pulsadores (¡Buzzer Desbloqueado!)
  public activateBuzzerRace() {
    this.clearTimer();
    this.state.status = 'QUESTION_ACTIVE';
    this.state.countdownRemaining = 0;
    this.broadcastState();

    this.timerInterval = setInterval(() => {
      this.state.timeRemaining -= 1;

      if (this.io) {
        this.io.emit('game:timer-tick', { timeRemaining: this.state.timeRemaining });
      }

      if (this.state.timeRemaining <= 0) {
        this.clearTimer();
        // Si el tiempo se agotó y nadie pulsó
        if (this.state.status === 'QUESTION_ACTIVE') {
          this.state.status = 'EVALUATING';
          this.state.result = {
            grade: 'INCORRECT',
            pointsAwarded: 0,
            teamId: '',
            teamName: 'Tiempo agotado',
            correctOptionIndex: this.state.currentQuestion?.correctOptionIndex
          };
          this.broadcastState();
        }
      }
    }, 1000);
  }

  // 1.3 Cancelar Pregunta en cualquier momento
  public cancelQuestion() {
    this.resetToLobby();
  }

  // 2. Registro de Pulsador / Buzzer (Capitán)
  public async handleBuzzerPress(teamId: string, captainName: string): Promise<{ won: boolean }> {
    // Solo se puede pulsar si la pregunta está activa y nadie más pulsó antes
    if (this.state.status !== 'QUESTION_ACTIVE') {
      return { won: false };
    }

    // Ganador milimétrico del buzzer
    this.state.status = 'BUZZER_LOCKED';
    this.clearTimer();

    const team = await prisma.team.findUnique({ where: { id: teamId } });

    const winner: BuzzerWinner = {
      teamId,
      teamName: team?.name || 'Equipo',
      teamAvatar: team?.avatar || null,
      captainName,
      pressedAt: Date.now()
    };

    this.state.buzzerWinner = winner;

    if (this.io) {
      this.io.emit('game:buzzer-won', winner);
    }

    this.broadcastState();
    return { won: true };
  }

  // 3. Selección de Opción Múltiple (Capitán)
  public async handleChoiceSubmit(teamId: string, choiceIndex: number) {
    if (this.state.status !== 'BUZZER_LOCKED' && this.state.status !== 'QUESTION_ACTIVE') {
      throw new Error('No es momento de responder.');
    }

    this.clearTimer();

    // Verificar si quien responde es el ganador del turno
    if (this.state.buzzerWinner && this.state.buzzerWinner.teamId !== teamId) {
      throw new Error('Solo el equipo con el turno puede responder.');
    }

    this.state.selectedChoice = choiceIndex;
    const isCorrect = this.state.currentQuestion?.correctOptionIndex === choiceIndex;
    const pointsAwarded = isCorrect ? (this.state.currentQuestion?.points || 100) : 0;

    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (isCorrect && pointsAwarded > 0) {
      await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: pointsAwarded } }
      });
    }

    const result: GameResult = {
      grade: isCorrect ? 'CORRECT' : 'INCORRECT',
      pointsAwarded,
      teamId,
      teamName: team?.name || 'Equipo',
      correctOptionIndex: this.state.currentQuestion?.correctOptionIndex
    };

    this.state.status = 'SHOWING_RESULT';
    this.state.result = result;

    const updatedTeams = await getAllTeams();
    if (this.io) {
      this.io.emit('game:score-updated', updatedTeams);
      this.io.emit('teams:update', updatedTeams);
    }

    this.broadcastState();
  }

  // 4. Calificación Oral por Moderador / Admin
  public async gradeOralDefense(grade: 'CORRECT' | 'PARTIAL' | 'INCORRECT') {
    if (this.state.status !== 'BUZZER_LOCKED' || !this.state.buzzerWinner) {
      throw new Error('No hay una defensa oral activa para calificar.');
    }

    this.clearTimer();

    const { teamId, teamName } = this.state.buzzerWinner;
    // Limpiar inmediatamente el turno y cambiar estado para prevenir calificaciones duplicadas
    this.state.buzzerWinner = null;
    this.state.status = 'SHOWING_RESULT';

    const basePoints = this.state.currentQuestion?.points || 100;

    let pointsAwarded = 0;
    if (grade === 'CORRECT') pointsAwarded = basePoints;
    else if (grade === 'PARTIAL') pointsAwarded = Math.round(basePoints * 0.5);
    else pointsAwarded = 0;

    if (pointsAwarded > 0) {
      await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: pointsAwarded } }
      });
    }

    const result: GameResult = {
      grade,
      pointsAwarded,
      teamId,
      teamName,
      correctOptionIndex: null
    };

    this.state.result = result;

    const updatedTeams = await getAllTeams();
    if (this.io) {
      this.io.emit('game:score-updated', updatedTeams);
      this.io.emit('teams:update', updatedTeams);
    }

    this.broadcastState();
  }

  // 5. Mostrar Podio / Marcador
  public async showLeaderboard() {
    this.clearTimer();
    this.state.status = 'LEADERBOARD';

    const updatedTeams = await getAllTeams();
    if (this.io) {
      this.io.emit('game:score-updated', updatedTeams);
    }

    this.broadcastState();
  }

  // 6. Rebotar Pregunta al Auditorio tras error o tiempo
  public reboundQuestion(secondsRemaining = 15) {
    if (!this.state.currentQuestion) {
      throw new Error('No hay una pregunta en curso para rebotar.');
    }

    this.clearTimer();
    this.state.status = 'QUESTION_ACTIVE';
    this.state.buzzerWinner = null;
    this.state.selectedChoice = null;
    this.state.result = null;
    this.state.timeRemaining = secondsRemaining;

    this.broadcastState();

    this.timerInterval = setInterval(() => {
      this.state.timeRemaining -= 1;

      if (this.io) {
        this.io.emit('game:timer-tick', { timeRemaining: this.state.timeRemaining });
      }

      if (this.state.timeRemaining <= 0) {
        this.clearTimer();
        if (this.state.status === 'QUESTION_ACTIVE') {
          this.state.status = 'EVALUATING';
          this.state.result = {
            grade: 'INCORRECT',
            pointsAwarded: 0,
            teamId: '',
            teamName: 'Tiempo agotado (Rebote)',
            correctOptionIndex: this.state.currentQuestion?.correctOptionIndex
          };
          this.broadcastState();
        }
      }
    }, 1000);
  }

  // 7. Volver a Sala de Espera / Lobby
  public resetToLobby() {
    this.clearTimer();
    this.state = {
      status: 'LOBBY',
      currentQuestion: null,
      timeRemaining: 0,
      buzzerWinner: null,
      selectedChoice: null,
      result: null
    };
    this.broadcastState();
  }
}

export const gameEngine = new GameEngine();
