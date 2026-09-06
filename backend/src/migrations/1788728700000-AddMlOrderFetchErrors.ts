import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMlOrderFetchErrors1788728700000 implements MigrationInterface {
  name = 'AddMlOrderFetchErrors1788728700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ml_order_fetch_errors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mlOrderId" character varying NOT NULL, "message" text NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ml_order_fetch_errors_mlOrderId" UNIQUE ("mlOrderId"), CONSTRAINT "PK_ml_order_fetch_errors" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ml_order_fetch_errors"`);
  }
}
