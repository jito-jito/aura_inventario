# Despliegue en producción

Este documento describe cómo desplegar el stack completo (Postgres + Redis + backend NestJS + frontend Ionic/PWA vía nginx) con Docker Compose en un servidor propio.

## Prerrequisitos

- Un servidor con Docker y Docker Compose v2 instalados.
- Un dominio propio apuntando al servidor (Mercado Libre exige `https` en la Redirect URI de OAuth, y el service worker de la PWA solo funciona sobre `https` o `localhost`).
- Un proxy TLS delante del stack (Caddy, Traefik, nginx con certbot, o el load balancer del proveedor de hosting). **Este repo no incluye terminación TLS**: el `frontend/Dockerfile` sirve HTTP plano en el puerto 80 vía nginx; hay que ponerle un reverse proxy con certificado delante (por ejemplo, Caddy con `reverse_proxy` a `localhost:80` obtiene el certificado automáticamente con Let's Encrypt).

## 1. Variables de entorno

### `backend/.env` (secretos y config de la API)

```bash
cd backend
cp .env.example .env
```

Completar, como mínimo, para producción:

- `NODE_ENV=production` — con esto el backend valida las variables al arrancar (falla rápido y explícito si falta alguna o si quedó un valor de ejemplo) y corre las migraciones de base de datos automáticamente.
- `JWT_SECRET` y `ML_TOKEN_ENCRYPTION_KEY` — strings largos y aleatorios, distintos entre sí. **No dejar el valor de `.env.example`**: el backend rechaza arrancar si detecta `change-me-in-production`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` — generar el hash con `node -e "console.log(require('bcrypt').hashSync('TU_CLAVE', 10))"`.
- `FRONTEND_URL=https://TU_DOMINIO` — se usa para restringir CORS y como destino del redirect después del callback de OAuth de Mercado Libre.
- `MELI_CLIENT_ID` / `MELI_CLIENT_SECRET` — de la app creada en el devcenter de Mercado Libre.
- `MELI_REDIRECT_URI=https://TU_DOMINIO/api/ml/auth/callback` — el frontend (nginx) reenvía `/api/*` al backend quitando el prefijo, así que la ruta pública incluye `/api`.
- `MELI_AUTH_URL` — dominio de autorización según el país del vendedor (`.com.ar`, `.com.mx`, `.com.br`, etc.).
- `DB_HOST`, `REDIS_HOST`, `DB_PORT`, `REDIS_PORT` — **no hace falta tocarlos**: `docker-compose.prod.yml` los sobrescribe (`postgres`/`redis`, los nombres de los servicios) sin importar lo que digan acá.
- `BACKUP_DIR=./backups`, `BACKUP_RETENTION_COUNT`, `BACKUP_CRON_ENABLED` — según se necesite.

### `.env` en la raíz (para Docker Compose)

```bash
cp .env.example .env
```

- `DB_USER`, `DB_PASSWORD`, `DB_NAME` — credenciales de Postgres del contenedor.
- `HTTP_PORT` — puerto del host donde queda expuesto el frontend (por defecto 80; el reverse proxy TLS apunta acá).

**Importante:** estos valores pasan por la interpolación `$VAR` de Docker Compose, así que no deben contener el caracter `$` (a diferencia de `backend/.env`, que se monta como archivo y no sufre este problema — ver el comentario en `docker-compose.prod.yml`).

## 2. Build y arranque

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Esto construye las dos imágenes (`backend/Dockerfile`, `frontend/Dockerfile`) y levanta los 4 servicios. El backend espera a que Postgres y Redis pasen su healthcheck antes de arrancar, y el frontend espera a que el backend responda en `/health`.

## 3. Base de datos: migraciones

El backend corre las migraciones de TypeORM automáticamente al arrancar en producción (`migrationsRun: true` cuando `NODE_ENV=production`, ver `backend/src/app.module.ts`). No hace falta ningún paso manual para el primer despliegue: la migración inicial (`backend/src/migrations/`) crea todo el esquema desde cero, incluida la extensión `uuid-ossp` que necesitan los IDs.

Para correr o revertir migraciones a mano (por ejemplo, para revisar antes de aplicar):

```bash
cd backend
npm run migration:run
npm run migration:revert
```

Si en el futuro se cambia una entidad, generar la migración correspondiente contra una base con el esquema actual:

```bash
npm run migration:generate -- src/migrations/NombreDelCambio
```

## 4. Configurar la app de Mercado Libre con el dominio real

En el devcenter de Mercado Libre (<https://developers.mercadolibre.com.ar/devcenter> o el del país correspondiente), en la misma app usada en desarrollo:

1. **Redirect URI**: `https://TU_DOMINIO/api/ml/auth/callback` (igual a `MELI_REDIRECT_URI`).
2. **Notification callback URL**: `https://TU_DOMINIO/api/ml/webhooks/orders`, suscripta al topic `orders_v2`.

Ambas rutas llegan al backend a través del proxy `/api/` de nginx (ver `frontend/nginx.conf`).

## 5. Respaldos

Los `.sql.gz` quedan en el volumen `backend_backups` (montado en `/app/backups` dentro del contenedor). Para copiarlos al host:

```bash
docker compose -f docker-compose.prod.yml cp backend:/app/backups ./backups-descargados
```

Como se aclara en el `README.md`, esto sigue guardando los respaldos en el mismo servidor: para protegerse de una falla de disco hay que sincronizar ese volumen a almacenamiento externo (S3, otro disco, etc.) con una herramienta aparte — no está automatizado en este MVP.

## 6. Actualizar el despliegue

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Las migraciones pendientes corren solas al reiniciar el backend.

## Qué NO está verificado

Siendo honestos sobre los límites de lo que se pudo probar:

- **Las imágenes Docker (`backend/Dockerfile`, `frontend/Dockerfile`) y `docker-compose.prod.yml` nunca se construyeron ni se corrieron de verdad.** El entorno donde se desarrolló este MVP no tiene un daemon de Docker disponible (el CLI está instalado pero `dockerd` no arranca en este sandbox). Se validó `docker compose -f docker-compose.prod.yml config` (parseo/interpolación de variables, sin necesitar el daemon) y se revisaron ambos Dockerfiles línea por línea, pero el build real, el arranque de los 4 contenedores y la comunicación entre ellos (nginx → backend vía `/api/`, backend → postgres/redis por nombre de servicio) no se ejecutaron.
- **El flujo de OAuth y webhooks contra la API real de Mercado Libre no se probó** en ningún momento de este proyecto: el proxy saliente de este sandbox bloquea `api.mercadolibre.com` y `auth.mercadolibre.com.ar`. Sí se probó exhaustivamente con tests unitarios (HTTP mockeado) y sembrando datos realistas directo en Postgres.
- **No hay un servidor/dominio/certificado TLS real de por medio**: todo lo de este documento sobre HTTPS y el reverse proxy es la configuración recomendada, no algo desplegado y confirmado.

Lo que sí se verificó de forma real en este mismo entorno (Postgres 16 y Redis locales, sin Docker):

- La migración inicial se generó contra una base limpia y se corrió dos veces más contra bases nuevas: una a mano (`npm run migration:run`) y otra dejando que el backend compilado la corra solo al arrancar en modo producción (`NODE_ENV=production`), confirmando que crea las 9 tablas esperadas.
- El arranque en modo producción compilado (`node dist/main.js`) responde en `/health`, aplica CORS restringido a `FRONTEND_URL`, agrega los headers de `helmet`, y el rate limiting de `/auth/login` corta en la petición 6 dentro de la misma ventana de un minuto.
- La validación de variables de entorno rechaza arrancar tanto si falta una variable requerida como si quedó el valor de ejemplo de `.env.example` (probado explícitamente para `JWT_SECRET`).
- El build de producción del frontend (`ng build --configuration production`) compila y genera `dist/frontend/browser` con `apiUrl: "/api"` (no quedó ningún `localhost:3000` en el bundle).
