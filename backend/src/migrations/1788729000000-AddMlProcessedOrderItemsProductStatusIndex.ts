import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soporta el cálculo de "stock proyectado" en ProductsService.findAll, que
 * en cada carga de la pantalla de Productos consulta las cantidades
 * pendientes por producto (WHERE productId IN (...) AND status = 'pending').
 */
export class AddMlProcessedOrderItemsProductStatusIndex1788729000000
  implements MigrationInterface
{
  name = 'AddMlProcessedOrderItemsProductStatusIndex1788729000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_ml_processed_order_items_product_status" ON "ml_processed_order_items" ("productId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ml_processed_order_items_product_status"`);
  }
}
