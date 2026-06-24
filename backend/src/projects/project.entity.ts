import { Artifact } from '../artifacts/artifact.entity';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import { TestRun } from '../test-runs/test-run.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column()
  baseUrl!: string;

  @OneToMany(() => TestDefinition, (testDefinition) => testDefinition.project)
  testDefinitions!: TestDefinition[];

  @OneToMany(() => TestRun, (testRun) => testRun.project)
  testRuns!: TestRun[];

  @OneToMany(() => Artifact, (artifact) => artifact.project)
  artifacts!: Artifact[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
