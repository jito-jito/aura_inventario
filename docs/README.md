# Documentación de Aura Inventario

Punto de entrada de la documentación técnica y funcional del proyecto. Cada apartado vive en su propia carpeta dentro de `docs/`.

## Ver la documentación en el navegador

La documentación se escribe en Markdown y se puede leer de dos formas:

- **En GitHub**, abriendo los `.md` directamente (los diagramas Mermaid también se renderizan).
- **Como sitio web local**, con [VitePress](https://vitepress.dev/): menú lateral, buscador y diagramas.

```bash
cd docs
npm install
npm run dev      # http://localhost:5173 — se recarga solo al editar un .md
```

Otros comandos:

```bash
npm run build    # genera el sitio estático en docs/.vitepress/dist
npm run preview  # sirve ese build en http://localhost:4173
```

El menú lateral se arma solo a partir de las carpetas y archivos: agregar un documento no requiere tocar la configuración (`docs/.vitepress/config.mts`). El título de cada entrada es el primer encabezado `#` del archivo.

## Estructura

| Carpeta | Qué va acá | Estado |
|---|---|---|
| `arquitectura/` | Visión general del sistema, módulos del backend, modelo de datos, decisiones de diseño (ADR). | Pendiente |
| `flujos/` | Procesos de negocio de punta a punta (ej. venta en Mercado Libre → confirmación → descuento de stock, conexión OAuth, respaldos). | Pendiente |
| `frontend/` | Páginas, componentes, servicios y patrones de la app Ionic Angular. | Pendiente |
| `backend/` | Módulos NestJS, endpoints, entidades, colas y tareas programadas. | Pendiente |
| `infraestructura/` | Entornos (local, Railway), Docker, Postgres, Redis, variables de entorno, migraciones, respaldos. | Pendiente |
| `revisiones/` | Análisis y auditorías del estado del proyecto en una fecha dada (bugs, deuda técnica, estado de ramas). | 1 documento |

Las carpetas marcadas como "Pendiente" todavía no existen: se crean cuando se escribe el primer documento de ese apartado, y aparecen solas en el menú lateral.

## Documentos

### Revisiones

- [2026-10-14 — Análisis del proyecto y de las ramas `frontend/main` y `backend/main`](./revisiones/2026-10-14-analisis-proyecto-y-ramas.md)

### Otros documentos existentes (raíz del repo)

Estos quedan fuera de `docs/`, así que los enlaces llevan a GitHub:

- [`README.md`](https://github.com/jito-jito/aura_inventario/blob/main/README.md) — cómo levantar el proyecto en local.
- [`PLAN.md`](https://github.com/jito-jito/aura_inventario/blob/main/PLAN.md) — alcance del MVP y fases de desarrollo.
- [`DEPLOY.md`](https://github.com/jito-jito/aura_inventario/blob/main/DEPLOY.md) — despliegue en producción.

## Convenciones

- **Idioma:** español.
- **Formato:** Markdown. Diagramas en [Mermaid](https://mermaid.js.org/) dentro del propio `.md` (bloque <code>```mermaid</code>), así quedan versionados junto al texto y se ven tanto en GitHub como en el sitio local.
- **Un documento = un archivo `.md`** dentro de la carpeta de su apartado. Cada archivo empieza con un único encabezado `# Título`, que es el que aparece en el menú.
- **Nombres de archivo:** en minúsculas y con guiones (`flujo-ventas-ml.md`). Los documentos que son una foto de una fecha (revisiones, análisis) llevan la fecha al inicio: `AAAA-MM-DD-tema.md`; el menú los ordena del más nuevo al más viejo.
- **Enlaces entre documentos:** relativos y con extensión (`../flujos/flujo-ventas-ml.md`), así funcionan en GitHub y en el sitio. El build falla si un enlace interno apunta a un archivo que no existe. Para archivos fuera de `docs/` (código, `PLAN.md`), usar el enlace de GitHub.
- **Encabezado de cada documento:** fecha de la última actualización y, si describe código, la rama y el commit sobre el que se escribió. El código cambia y la documentación queda desactualizada: así se sabe contra qué versión compararla.
- **Honestidad sobre lo verificado:** separar siempre lo que se comprobó (tests, build, prueba manual) de lo que se dedujo leyendo el código o no se pudo probar (ver [`CLAUDE.md`](https://github.com/jito-jito/aura_inventario/blob/main/CLAUDE.md)).
- **Referencias al código:** rutas relativas a la raíz del repo (`backend/src/ml-orders/ml-orders.service.ts`), sin números de línea salvo que sean imprescindibles, porque se desfasan rápido.
- **Al agregar un documento:** sumarlo a la sección "Documentos" de este índice.
