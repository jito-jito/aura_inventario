# Aura Inventario

MVP de inventario para Mercado Libre. Ver [`PLAN.md`](./PLAN.md) para el alcance y las fases de desarrollo.

## Estructura

```
/backend    → API NestJS
/frontend   → App Ionic Angular (PWA)
/docker-compose.yml → Postgres + Redis para desarrollo local
```

## Requisitos

- Node.js 20+ (probado con Node 22)
- Docker y Docker Compose (para Postgres y Redis)

## 1. Levantar infraestructura (Postgres + Redis)

```bash
cp .env.example .env   # ajustar credenciales si es necesario
docker compose up -d
```

## 2. Backend (NestJS)

```bash
cd backend
cp .env.example .env
```

Editar `.env` y generar el hash de la contraseña del admin:

```bash
node -e "console.log(require('bcrypt').hashSync('TU_CLAVE', 10))"
```

Pegar el resultado en `ADMIN_PASSWORD_HASH`.

```bash
npm install
npm run start:dev
```

- `GET /health` — estado de la API y de la conexión a la base de datos.
- `POST /auth/login` — login del admin (`{ email, password }`), devuelve `{ accessToken }` (JWT).

## 3. Frontend (Ionic Angular PWA)

```bash
cd frontend
npm install   # aplica automáticamente un patch a @ionic/core (ver nota abajo)
npm start
```

Abre `http://localhost:4200`. Rutas disponibles: `/login`, `/dashboard`, `/products`, `/inventory`, `/ml-connection`, `/ml-listings`, `/logs`. El contenido de cada página es un placeholder que se completa en las fases siguientes del plan.

### Nota sobre `patch-package`

`@ionic/core` no declara un campo `exports` en su `package.json`, lo que rompe el nuevo test runner de Angular basado en Vitest (falla con `Directory import ... is not supported`). Se agregó un patch en `frontend/patches/@ionic+core+8.8.15.patch` que se aplica automáticamente vía el script `postinstall`. No requiere acción manual.

## Tests

```bash
cd backend && npm test
cd frontend && npm test
```

## Variables de entorno

Ver `.env.example` en la raíz (Postgres/Redis) y en `backend/.env.example` (API, JWT, admin).
