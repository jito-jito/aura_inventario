# Mejoras propuestas

- **Creado:** 2026-10-17
- **Origen:** comparación con herramientas similares y revisión del código de `main` (commit `b7e4d67`).
- **Estado:** ideas sin implementar. Al empezar o descartar una, anotarlo en la columna "Estado" de la tabla de prioridades.

Antes de trabajar en las mejoras de prioridad alta, conviene leer cómo funciona hoy el proceso: **[Descuento de stock por ventas de Mercado Libre](../flujos/descuento-stock-ventas-ml.md)**.

## Sobre la investigación

La comparación con otras herramientas se hizo con resultados de búsqueda web: desde el entorno de trabajo no se pudieron abrir sus sitios ni la documentación de Mercado Libre, y la mayoría de las fuentes son fichas comerciales con poco detalle técnico. Lo que se dice de Aura Inventario está verificado contra el código; lo que se dice de las otras herramientas y de la API de ML hay que confirmarlo antes de construir algo sobre eso.

## Qué hacen herramientas similares

| Herramienta | Enfoque | Qué tiene que Aura no |
|---|---|---|
| **Multivende** (Chile) | Integrador multicanal | Sincroniza stock con ML y otros canales en línea, actualiza el catálogo de forma masiva, genera reportes de ventas y se conecta con facturación y logística. |
| **Bsale** (Chile) | Punto de venta, facturación e inventario | Emite la boleta automáticamente con cada venta online y mantiene el stock sincronizado. |
| **Producteca** (Argentina) | Integrador | Automatiza la publicación y la actualización de stock y precios en los canales de venta. |
| **Real Trends** | Gestión y métricas para ML | Métricas en tiempo real, varias cuentas, sincronización de stock y precios, preguntas y ventas en un solo lugar. |
| **Nubimetrics** | Inteligencia de mercado | Análisis de competencia y tendencias. No maneja stock propio. |
| **Zoho Inventory** | Inventario genérico | Punto de reorden con avisos, y armar un pedido al proveedor a partir de los productos con stock bajo. |

**Dónde está parada Aura:** su punto fuerte es tener el stock propio bien controlado, con kits, confirmación manual de ventas y proyecciones. Le falta lo que hace eficientes a las demás: **trabajar sola** (automatizar, avisar, reconciliar) y **anticipar** (reposición y rentabilidad real).

## Prioridades

| # | Mejora | Prioridad | Estado |
|---|---|---|---|
| 1 | Reconciliación periódica de órdenes | Alta | Pendiente |
| 2 | Confirmación automática con reglas | Alta | Pendiente |
| 3 | Cancelaciones y devoluciones | Alta | Pendiente |
| 4 | Alertas proactivas | Media | Pendiente |
| 5 | Reposición sugerida | Media | Pendiente |
| 6 | Rentabilidad real por venta | Media | Pendiente |
| 7 | Carga masiva por CSV o Excel | Baja | Pendiente |
| 8 | Conteo físico desde el celular | Baja | Pendiente |
| 9 | Facturación electrónica | Baja | Pendiente |
| 10 | Escribir de vuelta hacia ML | Baja (fuera de alcance hoy) | Pendiente de decisión |

**Recomendación:** empezar por 1, 2 y 3. Usan datos y canales que la aplicación ya tiene (el webhook, la cola y el registro de ventas), arreglan los problemas más graves del [análisis del 2026-10-14](../revisiones/2026-10-14-analisis-proyecto-y-ramas.md) y son las que más reducen el trabajo diario. Después, la 4, que es barata y reutiliza la comparación con ML que ya existe.

## Prioridad alta: eliminar trabajo manual y ventas perdidas

### 1. Reconciliación periódica de órdenes

El `PLAN.md` la prevé, pero no existe: la única tarea programada del backend es el respaldo nocturno.

- Cada 30 a 60 minutos, consultar las órdenes actualizadas recientemente con `/orders/search?seller=…` y procesar las que no estén registradas.
- Cubre los webhooks que se pierden, incluido el problema 4.1 del análisis.
- Hay que confirmar en la documentación de ML qué filtros de fecha acepta ese endpoint.

### 2. Confirmación automática con reglas

Hoy cada venta espera que alguien la confirme en `/ventas`, que es justo el trabajo repetitivo que los integradores eliminan. Reglas configurables posibles:

- Confirmar sola una venta pagada de una publicación simple (sin kit).
- O confirmarla cuando el envío pase a "despachado", escuchando el topic `shipments` de ML.
- Dejar en revisión manual solo las excepciones: kits, productos sin stock o sin vincular.

### 3. Cancelaciones y devoluciones

Corresponde al problema 4.2 del análisis.

- Si una orden pendiente pasa a cancelada, descartarla sola.
- Si ya se había confirmado, generar un movimiento de devolución pendiente de revisión.
- ML ofrece un topic `claims` para reclamos que también se puede escuchar.

## Prioridad media: anticiparse

### 4. Alertas proactivas

El stock mínimo (`minStock`) y la comparación con ML (`stock-check`) existen, pero solo se ven si alguien entra a la pantalla. Zoho avisa solo cuando un producto cae bajo el punto de reorden.

- Una revisión diaria automática.
- Un aviso por notificación push de la PWA, email o Telegram con los productos en stock crítico y las publicaciones descuadradas ("ML vende algo que no tenés").

### 5. Reposición sugerida

Con el historial de ventas que ya está en la base se puede calcular:

- Velocidad de venta (unidades por día).
- Días de cobertura (stock dividido por velocidad).
- Fecha estimada en que se acaba cada producto.

Con eso, una lista "qué comprar y cuánto", al estilo del pedido a proveedor que arma Zoho. El módulo de proyecciones ya calcula promedios parecidos y se puede reutilizar.

### 6. Rentabilidad real por venta

- Según la búsqueda sobre la API de ML, `/listing_prices` devuelve la comisión según precio, categoría y tipo de publicación.
- La orden también debería traer el costo de venta y el envío, pero no se pudo confirmar.
- Con esos datos, cada venta mostraría su margen real (precio menos comisión, envío y costo del producto), y las proyecciones dejarían de ignorar la comisión de ML (hoy solo usan costo y precio).

## Prioridad baja o según necesidad

7. **Carga y actualización masiva por CSV o Excel** de productos, costos y stock. Multivende lo destaca; ahorra mucho al empezar o al recibir mercadería.
8. **Conteo físico desde el celular:** escanear el código de barras con la cámara desde la PWA y generar los ajustes de diferencia.
9. **Facturación electrónica**, por ejemplo con Bsale si se opera en Chile: emitir la boleta al confirmar la venta.
10. **Escribir de vuelta hacia ML** (pausar o actualizar stock de publicaciones). Es lo central de Multivende, Producteca y Real Trends, pero en el `PLAN.md` quedó fuera de alcance por decisión. Si se revisa esa decisión, una opción intermedia sería un botón "pausar en ML" desde la pantalla de `stock-check`, sin automatismos.

## Fuentes

- [Multivende en Shopify App Store](https://apps.shopify.com/multivende?locale=es)
- [Bsale en Shopify App Store](https://apps.shopify.com/bsale?locale=it)
- [Multivende: integración con Bsale](https://multivende.com/blog/integracion-bsale-multivende/)
- [Peru Retail: alianza Mercado Libre y Bsale](https://www.peru-retail.com/?p=104454)
- [Producteca en Tiendanube](https://www.tiendanube.com/tienda-aplicaciones-nube/producteca)
- [Jaguar Sheet: herramientas para vendedores de Mercado Libre 2026](https://jaguarsheet.com/es/blog/herramientas-vendedores-mercado-libre)
- [argentina.gob.ar sobre Real Trends](https://www.argentina.gob.ar/node/222220)
- [Jaguar Sheet vs Nubimetrics](https://jaguarsheet.com/es/blog/jaguar-sheet-vs-nubimetrics)
- [Zoho Inventory: punto de reorden](https://www.zoho.com/inventory/kb/items/item-reorder.html)
- [Zoho Marketplace: reorden automática](https://marketplace.zoho.com/app/inventory/automated-item-reorders-for-zoho-inventory)
- [Capterra: inFlow vs Zoho Inventory](https://www.capterra.com.au/compare/78431/146241/inflow-inventory/vs/zoho-inventory)
- [Mercado Libre: recibir notificaciones](https://developers.mercadolibre.com.ar/productos-recibe-notificaciones/)
- [Mercado Libre: gestionar ventas](https://developers.mercadolibre.cl/en_us/manage-sales)
- [Mercado Livre: pedidos y opiniones](https://developers.mercadolivre.com.br/pt-br/pedidos-e-opinioes)
- [Mercado Libre: comisión por vender](https://developers.mercadolibre.com.ar/comision-por-vender)
- [Mercado Libre: packs](https://developers.mercadolibre.com.ar/en_us/packs-management)
