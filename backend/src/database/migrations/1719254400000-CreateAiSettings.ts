import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiSettings1719254400000 implements MigrationInterface {
  name = 'CreateAiSettings1719254400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."ai_settings_provider_enum" AS ENUM('anthropic', 'ollama')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_settings" ("id" character varying NOT NULL DEFAULT 'default', "provider" "public"."ai_settings_provider_enum" NOT NULL DEFAULT 'anthropic', "model" character varying NOT NULL, "anthropicApiKey" text, "ollamaBaseUrl" character varying(500), "enabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ai_settings_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_settings"`);
    await queryRunner.query(`DROP TYPE "public"."ai_settings_provider_enum"`);
  }
}
