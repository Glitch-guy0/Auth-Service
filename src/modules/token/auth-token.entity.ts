import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('auth_tokens')
export class AuthToken {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  token_hash!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
