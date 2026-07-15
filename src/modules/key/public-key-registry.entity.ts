import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('public_key_registry')
export class PublicKeyRegistry {
  @PrimaryColumn({ type: 'uuid' })
  kid!: string;

  @Column({ type: 'text' })
  public_key!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;
}
