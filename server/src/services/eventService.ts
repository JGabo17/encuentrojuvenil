import prisma from './db.js';

export async function getOrCreateActiveEvent() {
  let event = await prisma.event.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      templates: true
    }
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'Encuentro Juvenil — Conectados',
        code: 'JUVENIL2026',
        status: 'ACTIVE',
        templates: {
          create: [
            {
              name: '👋 Bienvenida',
              content: 'Hola {nombre} 👋 ¡Bienvenido al Encuentro Juvenil! Prepárate para lo que viene.'
            },
            {
              name: '⏳ Espera',
              content: 'Hola {nombre}, estamos por comenzar en breve. Mantén esta pantalla abierta.'
            },
            {
              name: '👀 Mira a tu alrededor',
              content: '¡{nombre}! Mira a las personas a tu alrededor y sonríe, hoy será un gran día.'
            },
            {
              name: '🎯 Mensaje especial',
              content: 'Hola {nombre}, eres una parte fundamental de este encuentro. ¡Gracias por estar aquí!'
            }
          ]
        }
      },
      include: {
        templates: true
      }
    });
  }

  return event;
}
