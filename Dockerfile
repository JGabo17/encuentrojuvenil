# Imagen base oficial de Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY shared ./shared

# Instalar dependencias
RUN cd server && npm install
RUN cd client && npm install

# Copiar código fuente
COPY server ./server
COPY client ./client

# Generar Prisma y compilar cliente y servidor
RUN cd server && npx prisma generate
RUN cd client && npm run build
RUN cd server && npm run build

# Imagen de producción ligera
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/client/dist ./client/dist

# Exponer el puerto
EXPOSE 4000

# Iniciar servidor en producción
CMD ["node", "server/dist/index.js"]
