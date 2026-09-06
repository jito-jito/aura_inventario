import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMlListingThumbnail1788728400000 implements MigrationInterface {
  name = 'AddMlListingThumbnail1788728400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ml_listings" ADD "thumbnail" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ml_listings" DROP COLUMN "thumbnail"`);
  }
}
