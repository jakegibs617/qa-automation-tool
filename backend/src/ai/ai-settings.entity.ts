import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AiProvider = 'anthropic' | 'ollama';

@Entity('ai_settings')
export class AiSettings {
  @PrimaryColumn({ default: 'default' })
  id!: string;

  @Column({
    type: 'enum',
    enum: ['anthropic', 'ollama'],
    default: 'anthropic',
  })
  provider!: AiProvider;

  @Column()
  model!: string;

  @Column({ type: 'text', nullable: true })
  anthropicApiKey!: string | null;

  @Column({ length: 500, nullable: true })
  ollamaBaseUrl!: string | null;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
