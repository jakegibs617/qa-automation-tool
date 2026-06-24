import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Artifact } from '../artifacts/artifact.entity';
import { Project } from '../projects/project.entity';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { TestRun } from '../test-runs/test-run.entity';

const parseBoolean = (value: string | undefined, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes'].includes(value.toLowerCase());
};

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 55432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'qa_automation',
  entities: [Project, TestDefinition, TestRun, Artifact],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: parseBoolean(process.env.DB_SYNCHRONIZE),
  migrationsRun: parseBoolean(process.env.DB_MIGRATIONS_RUN),
};

export default new DataSource(dataSourceOptions);
