# MVP Encuentro Juvenil — Experiencia en Tiempo Real

Plataforma interactiva en tiempo real para coordinadores y participantes de eventos juveniles.

## 🚀 Características Implementadas

- **Participante (`/` o `/join`)**:
  - Interfaz móvil minimalista y enfocada en la experiencia.
  - Registro inmediato con solo ingresar el nombre.
  - Persistencia de sesión segura (`sessionToken` local) y reconexión automática sin duplicar participantes.
  - Indicador visual claro de estado: `🟢 CONECTADO` / `⚠️ Conexión perdida. Intentando reconectar...` / `🔴 DESCONECTADO`.
  - Recepción de mensajes en tiempo real con animación suave y confeti sutil.

- **Administrador (`/admin`)**:
  - Autenticación protegida con JWT (`admin` / `admin123`).
  - Monitor en vivo con contador de participantes conectados vs registrados.
  - Lista de participantes en tiempo real con badges de presencia `🟢 En línea` y `🔴 Desconectado`.
  - Selector de destinatario: **Todos los participantes** o **Participante específico**.
  - Editor de mensajes con reemplazo dinámico de variables en servidor: `{nombre}`.
  - Plantillas preguardadas: Botones de inserción rápida, editor, creación y eliminación.
  - Historial en vivo de mensajes enviados persistido en base de datos.
  - Generador de Código QR (`qrcode.react`) para proyectar o escanear con teléfonos móviles.

- **Backend & Arquitectura**:
  - Node.js + Express + TypeScript + Socket.IO.
  - Prisma ORM con SQLite (transicionable a PostgreSQL en `.env`).
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
