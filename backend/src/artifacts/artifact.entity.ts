import { Project } from '../projects/project.entity';
import { TestRun } from '../test-runs/test-run.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ArtifactType = 'screenshot' | 'video' | 'trace' | 'log';

@Entity('artifacts')
@Index('IDX_artifacts_run_type', ['testRunId', 'type'])
export class Artifact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.artifacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'uuid' })
  testRunId!: string;

  @ManyToOne(() => TestRun, (testRun) => testRun.artifacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'testRunId' })
  testRun!: TestRun;

  @Column({
    type: 'enum',
    enum: ['screenshot', 'video', 'trace', 'log'],
  })
  type!: ArtifactType;

  @Column()
  storageKey!: string;

  @Column({ type: 'varchar', nullable: true })
  contentType!: string | null;

  @Column({ type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
