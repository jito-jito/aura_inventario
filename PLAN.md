# Plan de trabajo — MVP Inventario Mercado Libre (Ionic Angular PWA + NestJS)

Este plan traduce el documento de alcance del MVP en un plan de ejecución técnico, usando **Ionic + Angular (PWA)** para el frontend y **NestJS** para el backend.

## 1. Stack y arquitectura propuesta

- **Backend:** NestJS + TypeORM (o Prisma) + PostgreSQL. Node 20 LTS.
- **Frontend:** Ionic 8 + Angular (standalone components), configurado como PWA (`@angular/pwa`: manifest + service worker).
- **Auth interna:** JWT simple, un solo rol administrador (no se requiere gestión de roles en el MVP).
- **Auth Mercado Libre:** OAuth2 (authorization code), tokens guardados cifrados en backend, refresh automático.
- **Procesamiento asíncrono:** BullMQ + Redis para procesar notificaciones (webhooks) de forma confiable, con reintentos. Evita que una notificación lenta bloquee la respuesta HTTP a Mercado Libre.
- **Infraestructura local:** Docker Compose (Postgres, Redis, backend, frontend) para desarrollo y para la infraestructura local mencionada en el documento.
- **Backups:** `pg_dump` programado (cron) + almacenamiento en un segundo disco/bucket.

## 2. Estructura del repositorio

Monorepo simple (sin necesidad de Nx para un MVP de este tamaño):

```
/backend    → NestJS
/frontend   → Ionic Angular (PWA)
/docker-compose.yml
```

## 3. Modelo de datos (borrador)

- `products` — sku, name, description, cost, stock, created_at, updated_at
- `inventory_movements` — product_id, type (`in` | `out` | `adjustment`), quantity, reason, reference, created_at
- `ml_connection` — access_token, refresh_token, expires_at, ml_user_id, status
- `ml_listings` — product_id (FK), ml_item_id, ml_variation_id (nullable), sync_status, last_synced_at
- `ml_processed_orders` — ml_order_id (unique), status, product_id, quantity, processed_at → garantiza idempotencia (historia 6, cite:23/cite:10)
- `integration_logs` — type (`webhook`|`sync`|`oauth`), level (`info`|`error`), message, payload, created_at, resolved
- Metadata de backups: registrada como job, no requiere tabla propia en el MVP.

## 4. Módulos NestJS

- `AuthModule` — login admin, guard JWT
- `ProductsModule` — CRUD de catálogo interno, búsqueda por SKU/nombre
- `InventoryModule` — movimientos, stock actual, historial, alerta de stock bajo
- `MercadoLibreModule`
  - `MlAuthModule` — flujo OAuth, refresh de tokens, estado de conexión
  - `MlListingsModule` — búsqueda de publicaciones propias, vinculación con producto interno
  - `MlWebhooksModule` — endpoint de notificaciones, encola evento en BullMQ
  - `MlOrdersModule` — consulta detalle de orden, valida estado, aplica idempotencia
- `SyncModule` — descuenta stock interno y actualiza `available_quantity` en ML, con reintentos ante fallas de red/API
- `MonitoringModule` — endpoints para dashboard (ventas recientes, errores, stock bajo)
- `BackupModule` — job programado de respaldo + endpoint de exportación manual

## 5. Frontend Ionic Angular (PWA) — páginas

- **Login** (admin)
- **Dashboard** — stock bajo, ventas recientes, errores de integración
- **Productos** — listado, alta/edición, búsqueda
- **Inventario** — registrar entradas/ajustes, ver historial por producto
- **Conexión Mercado Libre** — estado (conectado/desconectado), botón conectar/reconectar
- **Vinculación de publicaciones** — vincular producto ↔ `item_id`/variación, ver productos sin vincular, estado de sync
- **Logs / Errores** — vista de incidentes de integración

PWA: app shell cacheable offline (lectura), las operaciones que escriben stock requieren conexión (evita inconsistencias con Mercado Libre).

## 6. Fases de desarrollo

| Fase | Contenido | Estimado |
|---|---|---|
| 0. Setup | Repos, Docker Compose, esqueleto NestJS + Ionic, auth admin básica | 3–5 días |
| 1. Catálogo + stock manual | CRUD productos, movimientos, historial, stock actual (backlog #1) | 1–1.5 semanas |
| 2. Conexión OAuth ML | Flujo OAuth, guardado seguro de tokens, refresh, pantalla de estado (backlog #3, se adelanta porque la vinculación real necesita un token vigente para consultar publicaciones) | 1 semana |
| 3. Vinculación con publicaciones | Buscar publicaciones vía API, vincular `item_id`/variación, ver no vinculados (backlog #2) | 1 semana |
| 4. Notificaciones de ventas | Webhook de ML, cola BullMQ, consulta de detalle de orden, tabla de idempotencia (backlog #4) | 1–1.5 semanas |
| 5. Descuento + sync de stock | Validación de estado de orden, descuento en BD, movimiento de salida, actualización de `available_quantity` con reintentos (backlog #5 y #6) | 1–1.5 semanas |
| 6. Visibilidad operativa | Dashboard, ventas recientes, errores de integración (backlog #7) | 1 semana |
| 7. Respaldo de datos | Backup automático programado + exportación manual (backlog #8) | 3–5 días |
| 8. QA end-to-end y despliegue | Pruebas del flujo completo con cuenta real de ML, hardening, deploy de la PWA | 1 semana |

**Total estimado:** ~9–10 semanas para una persona; menos con más desarrolladores en paralelo (backend y frontend pueden avanzar simultáneamente desde la fase 1).

> Nota sobre el orden: el documento de alcance sugiere OAuth en la posición 3, pero técnicamente la vinculación con publicaciones reales (posición 2) requiere un token de Mercado Libre vigente para poder consultar los `item_id` del vendedor. Por eso este plan adelanta la conexión OAuth antes de la vinculación. El resto del orden se mantiene igual.

## 7. Consideraciones técnicas clave

- **Idempotencia:** constraint único sobre `ml_order_id` en `ml_processed_orders` antes de descontar stock.
- **Reconciliación:** las notificaciones de ML no garantizan entrega; agregar un job periódico (polling) de respaldo que revise órdenes recientes no procesadas.
- **Reintentos de sync:** si falla la actualización de `available_quantity`, reintentar con backoff y dejar el vínculo en estado "desincronizado" visible en el dashboard.
- **Seguridad:** client secret de ML solo en backend (variables de entorno), tokens cifrados en BD, JWT con expiración corta + refresh para el admin.
- **Rate limits de la API de Mercado Libre:** aplicar backoff y colas para no exceder límites al sincronizar varias publicaciones.

## 8. Fuera de alcance (según el documento)

Se respeta el alcance no incluido: múltiples usuarios/roles, otros marketplaces, repricing, compras a proveedores, reportería avanzada, app nativa, logística avanzada.

## 9. Criterios de éxito (control de avance)

- [ ] Catálogo interno con stock maestro operativo
- [ ] Productos vinculados a publicaciones reales
- [ ] Ventas detectadas por webhook + consulta de orden
- [ ] Stock descontado correctamente en BD propia
- [ ] Stock sincronizado hacia Mercado Libre
- [ ] Errores visibles en dashboard
- [ ] Respaldo básico de datos funcionando
