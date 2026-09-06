import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMlListingPrice1788728600000 implements MigrationInterface {
  name = 'AddMlListingPrice1788728600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ml_listings" ADD "price" double precision`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ml_listings" DROP COLUMN "price"`);
  }
}
