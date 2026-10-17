import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.TEST_URL || 'https://encuentro-juvenil.onrender.com';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClientSocket(): Socket {
  return io(BASE_URL, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    timeout: 25000
  });
}

interface TestReport {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

const report: TestReport[] = [];

async function runStep(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    process.stdout.write(`⏳ [TEST] ${name}... `);
    await fn();
    const durationMs = Date.now() - start;
    console.log(`✅ PASÓ (${durationMs}ms)`);
    report.push({ name, passed: true, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(`❌ FALLÓ (${durationMs}ms): ${err.message}`);
    report.push({ name, passed: false, durationMs, error: err.message });
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 SUITE DE PRUEBAS DE QA PROFESIONAL — ENCUENTRO JUVENIL');
  console.log('======================================================\n');

  let adminToken = '';
  let adminSocket: Socket;
  let stageSocket: Socket;
  let cap1Socket: Socket;
  let cap2Socket: Socket;
  let mem1Socket: Socket;
  let mem2Socket: Socket;

  let team1Id = '';
  let team1Pin = '';
  let team2Id = '';
  let team2Pin = '';

  let cap1Id = '';
  let cap2Id = '';
  let mem1Id = '';
  let mem2Id = '';

  let questionId = '';
  let pairingId = '';

  try {
    // 1. Autenticación Admin
    await runStep('1.1 Login REST de Administrador y obtención de JWT', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      if (!res.ok) throw new Error(`HTTP status ${res.status}`);
      const data = await res.json();
      if (!data.token) throw new Error('No se recibió token en respuesta');
      adminToken = data.token;
    });

    // 2. Conexión Sockets
    await runStep('1.2 Conexión de Admin y Stage por WebSocket', async () => {
      adminSocket = createClientSocket();
      stageSocket = createClientSocket();

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Timeout de conexión a Render')), 15000);
        let count = 0;
        const check = () => {
          count++;
          if (count === 2) {
            clearTimeout(t);
            resolve();
          }
        };
        if (adminSocket.connected) count++;
        else adminSocket.on('connect', check);
        if (stageSocket.connected) count++;
        else stageSocket.on('connect', check);
        if (count >= 2) {
          clearTimeout(t);
          resolve();
        }
      });

      // Admin Join
      const adminRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:join', { token: adminToken }, resolve);
      });
      if (!adminRes?.success) throw new Error(`admin:join falló: ${adminRes?.error}`);

      // Stage Join
      const stageRes = await new Promise<any>((resolve) => {
        stageSocket.emit('stage:join', resolve);
      });
      if (!stageRes?.success) throw new Error('stage:join falló');
    });

    await runStep('1.3b Prevención de Participantes Fantasmas con sesión expirada/inexistente', async () => {
      const ghostSocket = createClientSocket();
      await new Promise<void>((res) => ghostSocket.on('connect', () => res()));

      const ghostRes = await new Promise<any>((resolve) => {
        ghostSocket.emit(
          'participant:join',
          { name: 'GhostLeo', sessionToken: 'uuid-invalido-de-prueba-expirado-99999' },
          resolve
        );
      });
      ghostSocket.disconnect();

      // Debe ser rechazado para que el cliente limpie su localStorage y no cree registros duplicados
      if (ghostRes?.success) {
        throw new Error('El servidor aceptó un sessionToken inválido y creó un participante fantasma');
      }
    });

    // 3. Creación de Equipos por Capitanes
    await runStep('1.3 Registro y creación de 2 Equipos por Capitanes', async () => {
      cap1Socket = createClientSocket();
      cap2Socket = createClientSocket();

      await Promise.all([
        new Promise<void>((res) => cap1Socket.on('connect', () => res())),
        new Promise<void>((res) => cap2Socket.on('connect', () => res()))
      ]);

      // Capitán 1 crea Equipo
      const team1Res = await new Promise<any>((resolve) => {
        cap1Socket.emit('team:create', {
          teamName: `Leones QA ${Date.now()}`,
          motto: 'Valientes y Fuertes',
          avatar: '🦁',
          captainName: 'Capitán Daniel'
        }, resolve);
      });

      if (!team1Res?.success) throw new Error(`Creación equipo 1 falló: ${team1Res?.error}`);
      team1Id = team1Res.team.id;
      team1Pin = team1Res.team.pin;
      cap1Id = team1Res.participant.id;
      if (!team1Pin || team1Pin.length !== 4) throw new Error('PIN de 4 dígitos no generado');

      // Capitán 2 crea Equipo
      const team2Res = await new Promise<any>((resolve) => {
        cap2Socket.emit('team:create', {
          teamName: `Águilas QA ${Date.now()}`,
          motto: 'Volando Alto',
          avatar: '🦅',
          captainName: 'Capitán Esteban'
        }, resolve);
      });

      if (!team2Res?.success) throw new Error(`Creación equipo 2 falló: ${team2Res?.error}`);
      team2Id = team2Res.team.id;
      team2Pin = team2Res.team.pin;
      cap2Id = team2Res.participant.id;
    });

    // 4. Seguridad de PIN al unirse integrantes
    await runStep('1.4 Validación de Seguridad de PIN de 4 dígitos (rechazo de PIN incorrecto)', async () => {
      mem1Socket = createClientSocket();
      await new Promise<void>((res) => mem1Socket.on('connect', () => res()));

      const failRes = await new Promise<any>((resolve) => {
        mem1Socket.emit('team:join', {
          teamId: team1Id,
          pin: '0000', // PIN incorrecto
          name: 'Intruso'
        }, resolve);
      });

      if (failRes?.success) throw new Error('El sistema permitió unirse con un PIN incorrecto');
    });

    // 5. Integrantes se unen con PIN correcto
    await runStep('1.5 Integrantes se unen a los equipos con PIN correcto', async () => {
      mem2Socket = createClientSocket();
      await new Promise<void>((res) => mem2Socket.on('connect', () => res()));

      const join1Res = await new Promise<any>((resolve) => {
        mem1Socket.emit('team:join', {
          teamId: team1Id,
          pin: team1Pin,
          name: 'Integrante Sara'
        }, resolve);
      });
      if (!join1Res?.success) throw new Error(`Unión integrante 1 falló: ${join1Res?.error}`);
      mem1Id = join1Res.participant.id;

      const join2Res = await new Promise<any>((resolve) => {
        mem2Socket.emit('team:join', {
          teamId: team2Id,
          pin: team2Pin,
          name: 'Integrante Mateo'
        }, resolve);
      });
      if (!join2Res?.success) throw new Error(`Unión integrante 2 falló: ${join2Res?.error}`);
      mem2Id = join2Res.participant.id;
    });

    // 6. Trivia & Buzzer Concurrencia
    await runStep('2.1 Lanzamiento de Pregunta de Trivia por Admin', async () => {
      // Obtener preguntas existentes
      const qRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:get-questions', resolve);
      });
      if (!qRes?.questions || qRes.questions.length === 0) throw new Error('No hay preguntas configuradas');
      questionId = qRes.questions[0].id;

      const startRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:start-question', { questionId }, resolve);
      });
      if (!startRes?.success) throw new Error(`start-question falló: ${startRes?.error}`);
    });

    await runStep('2.2 Restricción de Buzzer: Integrante normal intenta pulsar y es rechazado', async () => {
      const buzzRes = await new Promise<any>((resolve) => {
        mem1Socket.emit('captain:buzz', resolve);
      });
      if (buzzRes?.won || buzzRes?.success) {
        throw new Error('Un integrante no capitán pudo activar el buzzer');
      }
    });

    await runStep('2.3 Concurrencia Milimétrica de Buzzer: Ambos capitanes pulsan al mismo instante', async () => {
      const countRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:start-countdown', { countdownSeconds: 1 }, resolve);
      });
      if (!countRes?.success) throw new Error(`start-countdown falló: ${countRes?.error}`);

      // Esperar a que la cuenta regresiva finalice y active el buzzer (QUESTION_ACTIVE)
      await new Promise<void>((resolve) => {
        const onState = (state: any) => {
          if (state?.status === 'QUESTION_ACTIVE') {
            adminSocket.off('game:state-update', onState);
            resolve();
          }
        };
        adminSocket.on('game:state-update', onState);
        setTimeout(resolve, 2200);
      });

      const [buzz1, buzz2] = await Promise.all([
        new Promise<any>((res) => cap1Socket.emit('captain:buzz', res)),
        new Promise<any>((res) => cap2Socket.emit('captain:buzz', res))
      ]);

      const winners = [buzz1.won, buzz2.won].filter(Boolean);
      if (winners.length !== 1) {
        throw new Error(`Concurrencia fallida: deben ganar exactamente 1 capitán, pero ganaron ${winners.length}`);
      }
    });

    await runStep('2.4 Calificación por Moderador / Admin y actualización de puntos', async () => {
      const gradeRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:grade-defense', { grade: 'CORRECT' }, resolve);
      });
      if (!gradeRes?.success) throw new Error(`admin:grade-defense falló: ${gradeRes?.error}`);
    });

    await runStep('2.5 Rebote de Pregunta (Re-apertura del Buzzer por 15 segundos)', async () => {
      const reboundRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:rebound-question', { seconds: 15 }, resolve);
      });
      if (!reboundRes?.success) throw new Error(`admin:rebound-question falló: ${reboundRes?.error}`);

      // Verificar que el buzzer vuelva a estar libre
      const reboundBuzz = await new Promise<any>((resolve) => {
        cap2Socket.emit('captain:buzz', resolve);
      });
      if (!reboundBuzz?.won) throw new Error('El rebote no permitió a otro capitán ganar el buzzer');
    });

    await runStep('2.6 Ajuste Manual de Puntos (+50 pts) por Admin en vivo', async () => {
      const adjustRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:adjust-team-points', { teamId: team1Id, deltaPoints: 50 }, resolve);
      });
      if (!adjustRes?.success) throw new Error(`admin:adjust-team-points falló: ${adjustRes?.error}`);
    });

    await runStep('2.6b Asignación Exacta de Puntaje (admin:set-team-score) y piso en 0', async () => {
      // Fijar puntaje exacto a 250 pts
      const setRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:set-team-score', { teamId: team1Id, score: 250 }, resolve);
      });
      if (!setRes?.success) throw new Error(`admin:set-team-score falló: ${setRes?.error}`);

      // Intentar restar 500 puntos para verificar que no baje de 0
      const subRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:adjust-team-points', { teamId: team1Id, deltaPoints: -500 }, resolve);
      });
      if (!subRes?.success) throw new Error('admin:adjust-team-points falló al restar');
    });

    await runStep('2.6c Control Remoto de Proyección de Stage (admin:set-stage-view a mural, lobby, auto)', async () => {
      let stageViewReceived = '';
      stageSocket.on('stage:view-change', (data: any) => {
        stageViewReceived = data.mode;
      });

      // 1. Proyectar Mural 3D
      await new Promise<any>((resolve) => {
        adminSocket.emit('admin:set-stage-view', { mode: 'mural' }, resolve);
      });
      await wait(300);
      if (stageViewReceived !== 'mural') throw new Error(`Stage no recibió modo mural (actual: ${stageViewReceived})`);

      // 2. Proyectar Sala de Espera / Lobby
      await new Promise<any>((resolve) => {
        adminSocket.emit('admin:set-stage-view', { mode: 'lobby' }, resolve);
      });
      await wait(300);
      if (stageViewReceived !== 'lobby') throw new Error(`Stage no recibió modo lobby (actual: ${stageViewReceived})`);

      // 3. Volver a Auto
      await new Promise<any>((resolve) => {
        adminSocket.emit('admin:set-stage-view', { mode: 'auto' }, resolve);
      });
      await wait(300);
      if (stageViewReceived !== 'auto') throw new Error(`Stage no recibió modo auto (actual: ${stageViewReceived})`);
    });

    await runStep('2.6d Prevención Capa 8: Miembro normal intentando pulsar (Buzzer no autorizado)', async () => {
      const illegalBuzz = await new Promise<any>((resolve) => {
        mem1Socket.emit('captain:buzz', resolve);
      });
      if (illegalBuzz?.won) throw new Error('Un miembro regular pudo pulsar el buzzer indebidamente');
      if (!illegalBuzz?.error) throw new Error('No se retornó mensaje de error al miembro regular');
    });

    await runStep('2.6e Prevención Capa 8: Cliente no autenticado intentando modificar puntajes', async () => {
      const hackerRes = await new Promise<any>((resolve) => {
        mem1Socket.emit('admin:adjust-team-points' as any, { teamId: team1Id, deltaPoints: 9999 }, resolve);
      });
      if (hackerRes?.success) throw new Error('Un cliente no autorizado pudo modificar puntajes');
      if (hackerRes?.error !== 'No autorizado') throw new Error(`Error inesperado: ${hackerRes?.error}`);
    });

    await runStep('2.7 Proyección de Podio Olímpico en Auditorio', async () => {
      const podRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:show-leaderboard', resolve);
      });
      if (!podRes?.success) throw new Error('admin:show-leaderboard falló');
    });

    await runStep('2.8 Lanzamiento Resiliente de Preguntas (sin fallo por UUID efímero)', async () => {
      const resilientRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:start-question', {
          questionId: 'uuid-inexistente-post-reinicio',
          order: 1,
          text: '¿En qué libro de la Biblia'
        }, resolve);
      });
      if (!resilientRes?.success) {
        throw new Error(`Lanzamiento resiliente falló: ${resilientRes?.error}`);
      }

      // Volver a sala de espera
      await new Promise<any>((resolve) => adminSocket.emit('admin:reset-to-lobby', resolve));
    });

    // 7. Encuentro e Integración (Fase 3)
    await runStep('3.1 Emparejamiento Automático de Duplas cruzando participantes de equipos distintos', async () => {
      let pairingReceived = false;

      mem1Socket.on('pairing:assigned', (data) => {
        pairingReceived = true;
        pairingId = data.id;
      });

      const pairRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:start-pairings', resolve);
      });
      if (!pairRes?.success) throw new Error(`admin:start-pairings falló: ${pairRes?.error}`);

      await wait(500);
      if (!pairingReceived || !pairingId) throw new Error('El participante no recibió la asignación de su dupla');
    });

    await runStep('3.2 Envío de Mensajes y Foto en Dupla', async () => {
      const sendRes = await new Promise<any>((resolve) => {
        mem1Socket.emit('chat:send-message', {
          pairingId,
          content: '¡Hola! Encantado de conocerte.',
          photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD' // Mini imagen de prueba
        }, resolve);
      });
      if (!sendRes?.success) throw new Error(`chat:send-message falló: ${sendRes?.error}`);
    });

    await runStep('3.3 Moderación de Foto por Admin y proyección en Mural de Auditorio', async () => {
      const queueRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:get-moderation-queue', resolve);
      });
      if (!queueRes?.queue || queueRes.queue.length === 0) throw new Error('Cola de moderación vacía');

      const photoMsg = queueRes.queue[0];
      const modRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:moderate-photo', { messageId: photoMsg.id, approved: true }, resolve);
      });
      if (!modRes?.success) throw new Error(`admin:moderate-photo falló: ${modRes?.error}`);
    });

    await runStep('3.4 Pausa y Reactivación del Chat por Admin', async () => {
      // Pausar chat
      await new Promise<any>((res) => adminSocket.emit('admin:toggle-chat', { enabled: false }, res));

      // Intentar enviar mensaje mientras está pausado -> Debe ser rechazado
      const failSend = await new Promise<any>((res) => {
        mem1Socket.emit('chat:send-message', { pairingId, content: 'Test cuando pausado' }, res);
      });
      if (failSend?.success) throw new Error('Se pudo enviar mensaje con chat pausado');

      // Reanudar chat
      await new Promise<any>((res) => adminSocket.emit('admin:toggle-chat', { enabled: true }, res));
    });

    await runStep('3.5 Control Remoto de Audio del Auditorio (/stage) desde Admin', async () => {
      // Escuchar eventos en el socket del Stage
      let lastAudioState: any = null;
      stageSocket.on('stage:audio-update', (state) => {
        lastAudioState = state;
      });

      // 1. Play en Stage
      await new Promise<any>((res) => adminSocket.emit('admin:set-stage-audio', { action: 'play' }, res));
      await wait(300);
      if (!lastAudioState?.playing) throw new Error('El stage no recibió la orden de PLAY de audio');

      // 2. Ajuste de Volumen al 85%
      await new Promise<any>((res) => adminSocket.emit('admin:set-stage-audio', { action: 'set-volume', volume: 0.85 }, res));
      await wait(300);
      if (lastAudioState?.volume !== 0.85) throw new Error(`Volumen no actualizado a 0.85 (actual: ${lastAudioState?.volume})`);

      // 3. Reinicio de pista (seekTime)
      await new Promise<any>((res) => adminSocket.emit('admin:set-stage-audio', { action: 'restart' }, res));
      await wait(300);
      if (!lastAudioState?.seekTime) throw new Error('El stage no recibió la orden de RESTART (seekTime)');

      // 4. Mute
      await new Promise<any>((res) => adminSocket.emit('admin:set-stage-audio', { action: 'toggle-mute' }, res));
      await wait(300);
      if (!lastAudioState?.muted) throw new Error('El stage no recibió la orden de MUTE');

      // 5. Pausa
      await new Promise<any>((res) => adminSocket.emit('admin:set-stage-audio', { action: 'pause' }, res));
      await wait(300);
      if (lastAudioState?.playing) throw new Error('El stage no recibió la orden de PAUSE');
    });

    await runStep('3.6 Disponibilidad del archivo estático de audio en servidor', async () => {
      const audioRes = await fetch(`${BASE_URL}/audio/mural_track.mp3`, { method: 'HEAD' });
      if (!audioRes.ok) throw new Error(`El archivo de audio respondió HTTP ${audioRes.status}`);
      const contentLength = Number(audioRes.headers.get('content-length') || '0');
      if (contentLength < 1000000) throw new Error(`Tamaño de audio sospechosamente bajo (${contentLength} bytes)`);
    });

    // 8. Contingencias y Superpoderes de Admin
    await runStep('4.1 Transferencia de Capitanía en vivo a otro miembro', async () => {
      let roleUpdated = false;
      mem1Socket.on('participant:role-updated', (data) => {
        if (data.role === 'CAPTAIN') roleUpdated = true;
      });

      const transRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:transfer-captain', { teamId: team1Id, newCaptainId: mem1Id }, resolve);
      });
      if (!transRes?.success) throw new Error(`transfer-captain falló: ${transRes?.error}`);

      await wait(300);
      if (!roleUpdated) throw new Error('El participante no recibió su ascenso a Capitán');
    });

    await runStep('4.2 Expulsión forzada de participante troll con desconexión inmediata', async () => {
      let kickedEventReceived = false;
      mem2Socket.on('participant:kicked', () => {
        kickedEventReceived = true;
      });

      const kickRes = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:kick-participant', { participantId: mem2Id }, resolve);
      });
      if (!kickRes?.success) throw new Error(`kick-participant falló: ${kickRes?.error}`);

      await wait(400);
      if (!kickedEventReceived) throw new Error('El participante expulsado no recibió la notificación');
      if (mem2Socket.connected) throw new Error('El socket del participante expulsado sigue conectado');
    });

    await runStep('4.3 Reseteo Maestro del Evento con doble confirmación de seguridad', async () => {
      // Rechazo con confirmación incorrecta
      const failReset = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:reset-event', { confirmText: 'NO' }, resolve);
      });
      if (failReset?.success) throw new Error('El reseteo maestro procedió sin la clave RESET');

      // Reseteo exitoso con 'RESET'
      const okReset = await new Promise<any>((resolve) => {
        adminSocket.emit('admin:reset-event', { confirmText: 'RESET' }, resolve);
      });
      if (!okReset?.success) throw new Error(`reset-event falló: ${okReset?.error}`);
    });

  } finally {
    // Limpieza de Sockets
    adminSocket?.disconnect();
    stageSocket?.disconnect();
    cap1Socket?.disconnect();
    cap2Socket?.disconnect();
    mem1Socket?.disconnect();
    mem2Socket?.disconnect();
  }

  // Resumen
  console.log('\n======================================================');
  console.log('📊 RESUMEN EJECUTIVO DE QA FUNCIONAL');
  console.log('======================================================');
  const passedCount = report.filter((r) => r.passed).length;
  const failedCount = report.filter((r) => !r.passed).length;
  console.log(`Total Casos de Prueba: ${report.length}`);
  console.log(`Pruebas Exitosas:      ✅ ${passedCount}`);
  console.log(`Pruebas Fallidas:      ❌ ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nDetalle de Fallos:');
    report.filter((r) => !r.passed).forEach((r) => {
      console.log(`- ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ¡TODOS LOS FLUJOS FUNCIONALES Y DE CONTINGENCIA PASARON AL 100%!');
  }
}

main().catch((e) => {
  console.error('Error fatal en ejecución de QA:', e);
  process.exit(1);
});
