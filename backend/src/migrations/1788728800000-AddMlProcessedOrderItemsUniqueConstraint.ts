import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Evita el doble descuento de stock por una misma venta a nivel de base de datos:
 * dos ejecuciones concurrentes (o un reintento tras un crash a mitad de camino)
 * que intenten insertar el mismo (orden, item, variación, producto) chocan acá.
 *
 * Postgres trata cada NULL como distinto en un UNIQUE, así que un solo índice
 * sobre las 4 columnas no protegería nada para publicaciones sin variación
 * (mlVariationId NULL, la mayoría) — por eso son dos índices únicos parciales.
 */
export class AddMlProcessedOrderItemsUniqueConstraint1788728800000 implements MigrationInterface {
  name = 'AddMlProcessedOrderItemsUniqueConstraint1788728800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ml_processed_order_items_with_variation" ON "ml_processed_order_items" ("mlOrderId", "mlItemId", "mlVariationId", "productId") WHERE "mlVariationId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ml_processed_order_items_without_variation" ON "ml_processed_order_items" ("mlOrderId", "mlItemId", "productId") WHERE "mlVariationId" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_ml_processed_order_items_without_variation"`);
    await queryRunner.query(`DROP INDEX "UQ_ml_processed_order_items_with_variation"`);
  }
}
