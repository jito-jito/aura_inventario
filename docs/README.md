# Documentación de Aura Inventario

Punto de entrada de la documentación técnica y funcional del proyecto. Cada apartado vive en su propia carpeta; este índice se actualiza cada vez que se agrega un documento.

## Estructura

| Carpeta | Qué va acá | Estado |
|---|---|---|
| [`arquitectura/`](./arquitectura/) | Visión general del sistema, módulos del backend, modelo de datos, decisiones de diseño (ADR). | Pendiente |
| [`flujos/`](./flujos/) | Procesos de negocio de punta a punta (ej. venta en Mercado Libre → confirmación → descuento de stock, conexión OAuth, respaldos). | Pendiente |
| [`frontend/`](./frontend/) | Páginas, componentes, servicios y patrones de la app Ionic Angular. | Pendiente |
| [`backend/`](./backend/) | Módulos NestJS, endpoints, entidades, colas y tareas programadas. | Pendiente |
| [`infraestructura/`](./infraestructura/) | Entornos (local, Railway), Docker, Postgres, Redis, variables de entorno, migraciones, respaldos. | Pendiente |
| [`revisiones/`](./revisiones/) | Análisis y auditorías del estado del proyecto en una fecha dada (bugs, deuda técnica, estado de ramas). | 1 documento |

Las carpetas marcadas como "Pendiente" todavía no existen: se crean cuando se escribe el primer documento de ese apartado.

## Documentos

### Revisiones

- [2026-10-14 — Análisis del proyecto y de las ramas `frontend/main` y `backend/main`](./revisiones/2026-10-14-analisis-proyecto-y-ramas.md)

### Otros documentos existentes (raíz del repo)

- [`README.md`](../README.md) — cómo levantar el proyecto en local.
- [`PLAN.md`](../PLAN.md) — alcance del MVP y fases de desarrollo.
- [`DEPLOY.md`](../DEPLOY.md) — despliegue en producción.

## Convenciones

- **Idioma:** español.
- **Formato:** Markdown. Diagramas en [Mermaid](https://mermaid.js.org/) dentro del propio `.md` (GitHub los renderiza), así quedan versionados junto al texto.
- **Nombres de archivo:** en minúsculas y con guiones (`flujo-ventas-ml.md`). Los documentos que son una foto de una fecha (revisiones, análisis) llevan la fecha al inicio: `AAAA-MM-DD-tema.md`.
- **Encabezado de cada documento:** fecha de la última actualización y, si describe código, la rama y el commit sobre el que se escribió. El código cambia y la documentación queda desactualizada: así se sabe contra qué versión compararla.
- **Honestidad sobre lo verificado:** separar siempre lo que se comprobó (tests, build, prueba manual) de lo que se dedujo leyendo el código o no se pudo probar (ver [`CLAUDE.md`](../CLAUDE.md)).
- **Referencias al código:** rutas relativas a la raíz del repo (`backend/src/ml-orders/ml-orders.service.ts`), sin números de línea salvo que sean imprescindibles, porque se desfasan rápido.
- **Al agregar un documento:** sumarlo a la sección "Documentos" de este índice.
