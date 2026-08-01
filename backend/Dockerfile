# --- Etapa 1: build ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Etapa 2: runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# pg_dump para BackupService. La imagen de postgres del stack es 16-alpine;
# apk instala la versión de cliente disponible en el repo de esta Alpine base,
# que puede no coincidir exactamente con la 16 del servidor. pg_dump tolera
# diferencias de versión menores; si el respaldo falla por incompatibilidad
# de versión mayor, fijar aquí el paquete versionado (ej. postgresql16-client).
RUN apk add --no-cache postgresql-client

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S aura && adduser -S aura -G aura && mkdir -p /app/backups && chown -R aura:aura /app
USER aura

EXPOSE 3000
CMD ["node", "dist/main.js"]
