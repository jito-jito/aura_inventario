import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785589455250 implements MigrationInterface {
  name = 'InitialSchema1785589455250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sku" character varying NOT NULL, "name" character varying NOT NULL, "description" text, "cost" numeric(12,2) NOT NULL DEFAULT '0', "stock" integer NOT NULL DEFAULT '0', "minStock" integer NOT NULL DEFAULT '5', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c44ac33a05b144dd0d9ddcf932" ON "products"  ("sku") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inventory_movements_type_enum" AS ENUM('in', 'out', 'adjustment')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "type" "public"."inventory_movements_type_enum" NOT NULL, "quantity" integer NOT NULL, "balanceAfter" integer NOT NULL, "reason" text, "reference" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d7597827c1dcffae889db3ab873" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ml_listings_syncstatus_enum" AS ENUM('pending', 'synced', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ml_listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mlItemId" character varying NOT NULL, "mlVariationId" character varying, "title" character varying, "syncStatus" "public"."ml_listings_syncstatus_enum" NOT NULL DEFAULT 'pending', "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "lastSyncError" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_31fde447e9f6e0c9e8c82a051ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_19e34cb5f0d38d199732b108c3" ON "ml_listings"  ("mlItemId", "mlVariationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ml_listing_components" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "listing_id" uuid NOT NULL, "product_id" uuid NOT NULL, "quantityPerUnit" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bb57a9b9a0ed9d7caaed9866f85" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03c42e8c9e83c6437cf69e6a6c" ON "ml_listing_components"  ("listing_id", "product_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ml_connection_status_enum" AS ENUM('connected', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ml_connection" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ml_user_id" character varying NOT NULL, "nickname" character varying, "accessToken" text NOT NULL, "refreshToken" text NOT NULL, "tokenType" character varying NOT NULL DEFAULT 'bearer', "scope" character varying, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."ml_connection_status_enum" NOT NULL DEFAULT 'connected', "lastError" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bdb6e476d1a36f7344a047e1067" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ml_processed_order_items_status_enum" AS ENUM('processed', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ml_processed_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mlOrderId" character varying NOT NULL, "mlItemId" character varying NOT NULL, "mlVariationId" character varying, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "orderStatus" character varying NOT NULL, "status" "public"."ml_processed_order_items_status_enum" NOT NULL, "errorMessage" text, "processedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f6404a572ade49c33c451e7cacf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d388dac27d0e9b725c40f5d00" ON "ml_processed_order_items"  ("mlOrderId", "mlItemId", "mlVariationId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."projection_scenarios_periodtype_enum" AS ENUM('weekly', 'monthly')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projection_scenarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "product_id" uuid, "unitCost" numeric(12,2) NOT NULL, "unitPrice" numeric(12,2) NOT NULL, "fixedCostsPerPeriod" numeric(12,2) NOT NULL DEFAULT '0', "periodType" "public"."projection_scenarios_periodtype_enum" NOT NULL DEFAULT 'monthly', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1b35ead22428fbc360694fc5d1c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "projection_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scenario_id" uuid NOT NULL, "periodIndex" integer NOT NULL, "estimatedUnits" integer NOT NULL, CONSTRAINT "PK_42216e8fc4c255a5cd5516c1fe1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a135094a3d468f6b8b03a201e4" ON "projection_periods"  ("scenario_id", "periodIndex") `,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_5c3bec1682252c36fa161587738" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_listing_components" ADD CONSTRAINT "FK_71e6d9dad60338f7d9b34c190ee" FOREIGN KEY ("listing_id") REFERENCES "ml_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_listing_components" ADD CONSTRAINT "FK_971c796fdde0c9eba1e7595d325" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_processed_order_items" ADD CONSTRAINT "FK_04b2657aee2d97844ac4a589ac4" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_scenarios" ADD CONSTRAINT "FK_07e31782d1610883520c68eb5f1" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_periods" ADD CONSTRAINT "FK_c788bea583e890b936d8f1270de" FOREIGN KEY ("scenario_id") REFERENCES "projection_scenarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projection_periods" DROP CONSTRAINT "FK_c788bea583e890b936d8f1270de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projection_scenarios" DROP CONSTRAINT "FK_07e31782d1610883520c68eb5f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_processed_order_items" DROP CONSTRAINT "FK_04b2657aee2d97844ac4a589ac4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_listing_components" DROP CONSTRAINT "FK_971c796fdde0c9eba1e7595d325"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ml_listing_components" DROP CONSTRAINT "FK_71e6d9dad60338f7d9b34c190ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_5c3bec1682252c36fa161587738"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a135094a3d468f6b8b03a201e4"`,
    );
    await queryRunner.query(`DROP TABLE "projection_periods"`);
    await queryRunner.query(`DROP TABLE "projection_scenarios"`);
    await queryRunner.query(
      `DROP TYPE "public"."projection_scenarios_periodtype_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d388dac27d0e9b725c40f5d00"`,
    );
    await queryRunner.query(`DROP TABLE "ml_processed_order_items"`);
    await queryRunner.query(
      `DROP TYPE "public"."ml_processed_order_items_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "ml_connection"`);
    await queryRunner.query(`DROP TYPE "public"."ml_connection_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03c42e8c9e83c6437cf69e6a6c"`,
    );
    await queryRunner.query(`DROP TABLE "ml_listing_components"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_19e34cb5f0d38d199732b108c3"`,
    );
    await queryRunner.query(`DROP TABLE "ml_listings"`);
    await queryRunner.query(`DROP TYPE "public"."ml_listings_syncstatus_enum"`);
    await queryRunner.query(`DROP TABLE "inventory_movements"`);
    await queryRunner.query(
      `DROP TYPE "public"."inventory_movements_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c44ac33a05b144dd0d9ddcf932"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
