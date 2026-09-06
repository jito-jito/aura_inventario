import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMlListingVariationLabel1788728500000 implements MigrationInterface {
  name = 'AddMlListingVariationLabel1788728500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ml_listings" ADD "variationLabel" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ml_listings" DROP COLUMN "variationLabel"`);
  }
}
