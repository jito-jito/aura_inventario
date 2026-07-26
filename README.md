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
- `GET /products`, `POST /products`, `PATCH /products/:id` — catálogo interno.
- `POST /inventory/movements`, `GET /inventory/movements` — movimientos de stock.
- `GET /ml/auth/connect`, `GET /ml/auth/callback`, `GET /ml/auth/status`, `POST /ml/auth/disconnect` — conexión OAuth con Mercado Libre (ver sección siguiente).

### Conectar una cuenta de Mercado Libre

1. Crear una aplicación en <https://developers.mercadolibre.com.ar/devcenter> (o el devcenter del país correspondiente).
2. Configurar en el panel de la app la **Redirect URI** exactamente igual a `MELI_REDIRECT_URI` (por defecto `http://localhost:3000/ml/auth/callback`).
3. Copiar el `Client ID` y `Client Secret` al `.env` del backend (`MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`).
4. Ajustar `MELI_AUTH_URL` si el vendedor no es de Argentina (por ejemplo `https://auth.mercadolibre.com.mx/authorization` para México).
5. Definir `ML_TOKEN_ENCRYPTION_KEY` con un secreto propio (se usa para cifrar los tokens guardados en la base de datos).
6. Desde la página **Conexión Mercado Libre** del frontend, tocar "Conectar con Mercado Libre": redirige a Mercado Libre, y al autorizar vuelve al backend (`/ml/auth/callback`), que guarda los tokens y redirige de nuevo al frontend.

El flujo usa Authorization Code + PKCE. Los tokens se guardan cifrados (AES-256-GCM) y se refrescan automáticamente cuando faltan menos de 5 minutos para que expiren.

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
