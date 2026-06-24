import { Artifact } from '../artifacts/artifact.entity';
import { Project } from '../projects/project.entity';
import { TestDefinition } from '../test-definitions/test-definition.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

@Entity('test_runs')
@Index('IDX_test_runs_project_created', ['projectId', 'createdAt'])
export class TestRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.testRuns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'uuid' })
  testDefinitionId!: string;

  @ManyToOne(() => TestDefinition, (testDefinition) => testDefinition.runs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'testDefinitionId' })
  testDefinition!: TestDefinition;

  @Column({
    type: 'enum',
    enum: ['queued', 'running', 'passed', 'failed', 'canceled'],
    default: 'queued',
  })
  status!: TestRunStatus;

  @Column({ type: 'integer', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'integer', nullable: true })
  failureStep!: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  logs!: string[];

  @OneToMany(() => Artifact, (artifact) => artifact.testRun)
  artifacts!: Artifact[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
