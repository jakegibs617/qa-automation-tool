import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreSchema1719168000000 implements MigrationInterface {
  name = 'CreateCoreSchema1719168000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."test_runs_status_enum" AS ENUM('queued', 'running', 'passed', 'failed', 'canceled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."artifacts_type_enum" AS ENUM('screenshot', 'video', 'trace', 'log')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "baseUrl" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_projects_name" UNIQUE ("name"), CONSTRAINT "PK_projects_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "test_definitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "name" character varying NOT NULL, "startUrl" character varying NOT NULL, "steps" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_test_definitions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_test_definitions_project_name" ON "test_definitions" ("projectId", "name")`,
    );
    await queryRunner.query(
      `CREATE TABLE "test_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "testDefinitionId" uuid NOT NULL, "status" "public"."test_runs_status_enum" NOT NULL DEFAULT 'queued', "durationMs" integer, "failureStep" integer, "errorMessage" text, "logs" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_test_runs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_test_runs_project_created" ON "test_runs" ("projectId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE TABLE "artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "testRunId" uuid NOT NULL, "type" "public"."artifacts_type_enum" NOT NULL, "storageKey" character varying NOT NULL, "contentType" character varying, "sizeBytes" bigint, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_artifacts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_artifacts_run_type" ON "artifacts" ("testRunId", "type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_definitions" ADD CONSTRAINT "FK_test_definitions_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_runs" ADD CONSTRAINT "FK_test_runs_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_runs" ADD CONSTRAINT "FK_test_runs_definition" FOREIGN KEY ("testDefinitionId") REFERENCES "test_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "artifacts" ADD CONSTRAINT "FK_artifacts_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "artifacts" ADD CONSTRAINT "FK_artifacts_run" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "artifacts" DROP CONSTRAINT "FK_artifacts_run"`);
    await queryRunner.query(
      `ALTER TABLE "artifacts" DROP CONSTRAINT "FK_artifacts_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_runs" DROP CONSTRAINT "FK_test_runs_definition"`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_runs" DROP CONSTRAINT "FK_test_runs_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "test_definitions" DROP CONSTRAINT "FK_test_definitions_project"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_artifacts_run_type"`);
    await queryRunner.query(`DROP TABLE "artifacts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_test_runs_project_created"`);
    await queryRunner.query(`DROP TABLE "test_runs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_test_definitions_project_name"`);
    await queryRunner.query(`DROP TABLE "test_definitions"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."artifacts_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."test_runs_status_enum"`);
  }
}
