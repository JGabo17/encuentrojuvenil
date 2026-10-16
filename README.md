# MVP Encuentro Juvenil — Experiencia en Tiempo Real

Plataforma interactiva en tiempo real para coordinadores y participantes de eventos juveniles.

## 🚀 Características Implementadas

- **Auditorio / Pantalla Gigante (`/stage` o `/proyector`)**:
  - Vista cinematográfica a pantalla completa con marca de agua opaca del logo oficial de **RVC**.
  - Identidad visual tipográfica limpia RVC y paleta oficial (naranja fuego `#ff6519` + deep navy `#070a12`).
  - Código QR de alta resolución proyectado para escaneo instantáneo desde cualquier asiento.
  - Muro interactivo de equipos en vivo (escudos personalizados, iniciales fallback, integrantes y puntajes acumulados).
  - **Fase 2 — Pantalla de Trivia**:
    - Proyección en vivo de preguntas activas con temporizador regresivo circular.
    - Soporte para preguntas de **Defensa Oral** y de **Opción Múltiple (A, B, C, D)**.
    - Banner dramático de bloqueo de Buzzer destacando al equipo que pulsó primero.
    - Podio animado en vivo (1º, 2º y 3º lugar) con tabla de posiciones de todos los equipos.

- **Participante Móvil (`/` o `/join`)**:
  - **Líderes / Capitanes**:
    - Crean el equipo, definen su nombre, lema y suben opcionalmente una **foto personalizada** para su escudo (comprimida dinámicamente en el navegador a ~30KB) o iniciales estilizadas.
    - Reciben un PIN numérico de 4 dígitos exclusivo para compartir con sus integrantes.
    - **Pulsador Digital (Buzzer)**: Exclusivo para capitanes con vibración háptica, feedback instantáneo y bloqueo en servidor en milisegundos.
    - Opciones interactivas de respuesta para preguntas de opción múltiple con deliberación en equipo.
  - **Integrantes**:
    - Seleccionan su equipo en la lista, colocan su nombre e ingresan el PIN de 4 dígitos de su capitán.
    - Sala de espera del equipo con persistencia de sesión (`sessionToken`), badges de rol (`👑 Capitán` vs `👥 Integrante`).
    - **Fase 3 — Encuentro e Integración (Chat en Duplas)**:
      - Pestaña de chat 1 a 1 con su pareja asignada de otro equipo (nombre, equipo y escudo de su dupla).
      - Mensajería bidireccional en tiempo real con chips de saludos rápidos ("¡Hola! Mucho gusto", "¡Gran equipo el tuyo!", "¡Bendiciones!").
      - Subida y captura de fotografía / selfie (comprimida dinámicamente con Canvas a ~35KB) con aviso de postulación al mural.
      - Estado del chat controlado remotamente por el moderador (abierto o pausado).

- **Auditorio / Pantalla Gigante (`/stage` o `/proyector`)**:
  - Vista cinematográfica a pantalla completa con marca de agua opaca del logo oficial de **RVC**.
  - Identidad visual tipográfica limpia RVC y paleta oficial (naranja fuego `#ff6519` + deep navy `#070a12`).
  - Código QR de alta resolución proyectado para escaneo instantáneo desde cualquier asiento.
  - Muro interactivo de equipos en vivo (escudos personalizados, iniciales fallback, integrantes y puntajes acumulados).
  - **Fase 2 — Pantalla de Trivia**:
    - Proyección en vivo de preguntas activas con temporizador regresivo circular.
    - Soporte para preguntas de **Defensa Oral** y de **Opción Múltiple (A, B, C, D)**.
    - Banner dramático de bloqueo de Buzzer destacando al equipo que pulsó primero.
    - Podio animado en vivo (1º, 2º y 3º lugar) con tabla de posiciones de todos los equipos.
  - **Fase 3 — Mural Social de Duplas en Vivo**:
    - Conmutador de modo `Juego` vs `Mural` para proyector.
    - Carrusel cinematográfico con rotación automática cada 6 segundos de las fotografías aprobadas.
    - Marco estilizado, subtítulo con remitente, equipo y dupla asignada ("Enviada por Gabriel (Leones) junto a su dupla Camila (Águilas)").
    - Pantalla de bienvenida estética invitando a las duplas a tomarse su foto cuando el mural está recién iniciado.

- **Administrador (`/admin`)**:
  - Autenticación protegida con JWT (`admin` / `admin123`).
  - **Pestaña 🎮 Control de Trivia & Buzzer (Fase 2)**:
    - Monitor en vivo de estado del juego (LOBBY, QUESTION_ACTIVE, BUZZER_LOCKED, SHOWING_RESULT, LEADERBOARD).
    - Detección inmediata del equipo y capitán ganador del buzzer.
    - Calificación en vivo de defensas orales con 3 botones de moderador: 🟢 Correcto (100% pts), 🟡 Parcial (50% pts), 🔴 Incorrecto (0 pts).
    - Banco de preguntas: Lanzar preguntas a pantalla y dispositivos de capitanes con un clic.
    - Modal para crear nuevas preguntas (Defensa Oral u Opción Múltiple con 4 alternativas).
    - Proyección del Podio y restablecimiento al Lobby.
  - **Pestaña 🤝 Encuentro & Mural Social (Fase 3)**:
    - Botón de **"🚀 Iniciar Emparejamiento Automático"**: Algoritmo inteligente que cruza a los participantes de equipos diferentes aleatoriamente (en duplas o tríos si es impar).
    - Botón de control centralizado: **"Habilitar / Pausar Chat"** para evitar distracciones en el recinto.
    - **Bandeja de Moderación de Fotografías**: Supervisión previa con botones para 🟢 **Aprobar para Mural** o 🔴 **Retirar / Rechazar**, garantizando que ninguna foto inapropiada llegue al proyector.
  - **Pestaña 💬 Mensajería & Participantes (Fase 1)**:
    - Monitor en vivo con contador de conectados vs registrados.
    - Lista de participantes con badges de presencia `🟢 En línea` y `🔴 Desconectado`.
    - Selector de destinatario: **Todos los participantes** o **Participante específico**.
    - Editor con reemplazo dinámico `{nombre}` y plantillas guardables.
    - Historial en tiempo real de mensajes enviados.

- **Backend & Arquitectura**:
  - Node.js + Express + TypeScript + Socket.IO con motor de estados `gameEngine` (`triviaService.ts`) y `pairingService.ts`.
  - Prisma ORM con modelos de `Team`, `Participant`, `Question`, `Pairing`, `ChatMessage`, `MessageTemplate`, `MessageLog`.
  - Seguridad: Helmet, CORS, Rate Limiting, Sanitización Zod contra inyección de HTML/scripting.
  - Tipado compartido estricto en `shared/types`.

---

## 🛠️ Cómo Ejecutar el Proyecto

### Opción Rápida (UN SOLO COMANDO para Todo: Front + Back + WebSockets)
```bash
npm start
```
> Listo. Esto corre toda la plataforma completa (Frontend, Backend, Base de Datos y WebSockets) en un único proceso en `http://localhost:4000/`.

---

### Opción en Segundo Plano (Sin terminales abiertas en Windows)
- Haz doble clic en el archivo **`iniciar_en_segundo_plano.vbs`** en la carpeta del proyecto.
- ¡El servidor quedará corriendo en segundo plano de forma totalmente invisible sin estorbar con ventanas!
- Para apagarlo cuando termines tu evento, haz doble clic en **`detener_servidor.bat`**.

---

### Opción de Desarrollo (Con recarga en vivo)
Si estás modificando código:
- Backend: `npm run dev:server` (puerto 4000)
- Frontend: `npm run dev:client` (puerto 5173)

---

## 📱 Demostración del Flujo

1. **Abrir el Panel de Administrador**:
   - Navega a `http://localhost:5173/admin`
   - Ingresa:
     - **Usuario**: `admin`
     - **Contraseña**: `admin123`
2. **Abrir el Código QR o Copiar Enlace**:
   - Pulsa el botón verde **Mostrar QR** en la barra superior.
   - Escanea con un teléfono en la misma red o abre `http://localhost:5173/` en otra ventana/pestaña privada.
3. **Conectar Participante 1 ("Gabriel")**:
   - Escribe `Gabriel` y pulsa `CONTINUAR`.
   - Aparece instantáneamente con indicador `🟢 Gabriel` en el panel de administrador.
4. **Conectar Participante 2 ("María")**:
   - Abre otra ventana en incógnito y escribe `María`.
5. **Enviar Mensaje a TODOS**:
   - Selecciona la plantilla `👋 Bienvenida`.
   - Pulsa `ENVIAR A TODOS`.
   - Gabriel ve: *"Hola Gabriel 👋 ¡Bienvenido al Encuentro Juvenil! Prepárate para lo que viene."*
   - María ve: *"Hola María 👋 ¡Bienvenido al Encuentro Juvenil! Prepárate para lo que viene."*
6. **Enviar Mensaje Individual a Gabriel**:
   - Selecciona a `Gabriel` en el desplegable o en la lista.
   - Escribe *"Hola {nombre}, este mensaje es confidencial para tu equipo."*
   - Gabriel lo recibe de inmediato. María **no** lo recibe.
