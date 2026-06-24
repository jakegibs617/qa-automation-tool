import { Project } from '../projects/project.entity';
import { TestRun } from '../test-runs/test-run.entity';
import { TestStepDto } from './dto/test-step.dto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TestStep = TestStepDto;

@Entity('test_definitions')
@Index('IDX_test_definitions_project_name', ['projectId', 'name'], {
  unique: true,
})
export class TestDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (project) => project.testDefinitions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column()
  name!: string;

  @Column()
  startUrl!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  steps!: TestStep[];

  @OneToMany(() => TestRun, (testRun) => testRun.testDefinition)
  runs!: TestRun[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
