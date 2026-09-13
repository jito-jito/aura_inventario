import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega el estado 'pending' a ml_processed_order_items: las ventas ahora llegan
 * como pendientes de revisión y solo descuentan stock cuando alguien las confirma
 * manualmente (antes se procesaban solas al llegar el webhook).
 */
export class AddPendingStatusToMlProcessedOrderItems1788728900000 implements MigrationInterface {
  name = 'AddPendingStatusToMlProcessedOrderItems1788728900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ml_processed_order_items_status_enum" ADD VALUE 'pending' BEFORE 'processed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."ml_processed_order_items_status_enum" RENAME TO "ml_processed_order_items_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ml_processed_order_items_status_enum" AS ENUM('processed', 'error')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_processed_order_items" ALTER COLUMN "status" TYPE "public"."ml_processed_order_items_status_enum" USING "status"::text::"public"."ml_processed_order_items_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ml_processed_order_items_status_enum_old"`);
  }
}
