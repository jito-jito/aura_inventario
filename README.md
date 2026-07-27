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
- `pg_dump` disponible en el PATH (paquete `postgresql-client`), usado para los respaldos automáticos

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
- `POST /ml/listings`, `GET /ml/listings`, `GET /ml/listings/unlinked-products`, `DELETE /ml/listings/:id` — vincular productos internos con publicaciones de Mercado Libre.
- `POST /ml/webhooks/orders` (público) — callback de notificaciones de Mercado Libre. `GET /ml/orders/processed` (protegido) — historial de ítems de órdenes procesados.
- `GET /monitoring/errors` — errores agregados de conexión ML, publicaciones vinculadas y procesamiento de ventas.
- `POST /backups`, `GET /backups`, `GET /backups/:filename/download` — respaldos de la base de datos (ver sección más abajo).

### Conectar una cuenta de Mercado Libre

1. Crear una aplicación en <https://developers.mercadolibre.com.ar/devcenter> (o el devcenter del país correspondiente).
2. Configurar en el panel de la app la **Redirect URI** exactamente igual a `MELI_REDIRECT_URI` (por defecto `http://localhost:3000/ml/auth/callback`).
3. Copiar el `Client ID` y `Client Secret` al `.env` del backend (`MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`).
4. Ajustar `MELI_AUTH_URL` si el vendedor no es de Argentina (por ejemplo `https://auth.mercadolibre.com.mx/authorization` para México).
5. Definir `ML_TOKEN_ENCRYPTION_KEY` con un secreto propio (se usa para cifrar los tokens guardados en la base de datos).
6. Desde la página **Conexión Mercado Libre** del frontend, tocar "Conectar con Mercado Libre": redirige a Mercado Libre, y al autorizar vuelve al backend (`/ml/auth/callback`), que guarda los tokens y redirige de nuevo al frontend.

El flujo usa Authorization Code + PKCE. Los tokens se guardan cifrados (AES-256-GCM) y se refrescan automáticamente cuando faltan menos de 5 minutos para que expiren.

### Detección de ventas (webhooks de Mercado Libre)

El sistema es de **solo lectura** hacia Mercado Libre: detecta ventas y descuenta stock interno, pero nunca actualiza `available_quantity` ni ningún dato de la publicación en Mercado Libre.

1. En el panel de la app (mismo devcenter de la sección anterior), configurar la **Notification callback URL** apuntando a `https://TU_DOMINIO_PUBLICO/ml/webhooks/orders` y suscribirse al topic `orders_v2`. Como Mercado Libre necesita llamar a esta URL, en desarrollo local hace falta exponerla con una herramienta como `ngrok` (`ngrok http 3000` y usar esa URL pública).
2. Al llegar una notificación, el backend la encola (BullMQ + Redis) y responde `200` de inmediato para no bloquear a Mercado Libre.
3. Un worker toma el job, consulta el detalle de la orden (`GET /orders/:id` con el access token vigente) y, si el estado es `paid`, descuenta stock por cada ítem vinculado en `ml_listings` (registrando el movimiento de salida con referencia a la orden). Si el ítem no está vinculado a ningún producto, se ignora. Si la orden ya fue procesada antes, se ignora (idempotencia por orden + ítem).
4. Si falla el descuento (por ejemplo, stock insuficiente), queda registrado con el error tanto en `ml_processed_order_items` como en el vínculo correspondiente (`GET /ml/listings` muestra el estado y el último error).

### Respaldo y recuperación de datos

- `POST /backups` (protegido) — genera un respaldo manual ahora mismo (`pg_dump` comprimido con gzip).
- `GET /backups` (protegido) — lista los respaldos disponibles.
- `GET /backups/:filename/download` (protegido) — descarga un respaldo.

Además corre automáticamente todas las noches a las 03:00 (desactivable con `BACKUP_CRON_ENABLED=false`). Los archivos se guardan en `BACKUP_DIR` (por defecto `backend/backups/`, ignorado por git) y se conservan los últimos `BACKUP_RETENTION_COUNT` (por defecto 14), borrando los más viejos automáticamente.

**Importante:** esto guarda los respaldos en el disco local del servidor. Para protegerse de verdad ante una falla de disco, hay que sincronizar `BACKUP_DIR` a un disco externo o a un bucket (S3, etc.) — eso no está automatizado en este MVP, hay que agregarlo (por ejemplo con un `rclone`/`aws s3 sync` programado aparte).

Para restaurar un respaldo (**operación destructiva**, no tiene botón en la UI a propósito):

```bash
gunzip -c aura-inventario-XXXXXXXXTXXXXXX.sql.gz | psql -h localhost -U aura -d aura_inventario
```

## 3. Frontend (Ionic Angular PWA)

```bash
cd frontend
npm install   # aplica automáticamente un patch a @ionic/core (ver nota abajo)
npm start
```

Abre `http://localhost:4200`. Rutas disponibles: `/login`, `/dashboard`, `/products`, `/inventory`, `/ml-connection`, `/ml-listings`, `/logs`, `/backups`.

### Nota sobre `patch-package`

`@ionic/core` no declara un campo `exports` en su `package.json`, lo que rompe el nuevo test runner de Angular basado en Vitest (falla con `Directory import ... is not supported`). Se agregó un patch en `frontend/patches/@ionic+core+8.8.15.patch` que se aplica automáticamente vía el script `postinstall`. No requiere acción manual.

## Tests

```bash
cd backend && npm test
cd frontend && npm test
```

## Variables de entorno

Ver `.env.example` en la raíz (Postgres/Redis) y en `backend/.env.example` (API, JWT, admin).
