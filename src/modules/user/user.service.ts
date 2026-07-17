import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { IUserService } from '../../common/ports/user.port';
import { RegisterDto } from '../auth/dto/register.dto';
import { DemographicsService } from '../logging/demographics.service';

@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional() private readonly demographicsService: DemographicsService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Looking up user by email: ${email}`);
    return this.userRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    this.logger.debug(`Looking up user by username: ${username}`);
    return this.userRepository.findOne({ where: { username } });
  }

  async create(dto: RegisterDto): Promise<User> {
    this.logger.debug(`Creating user: ${dto.email}`);
    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = this.userRepository.create({
      username: dto.username,
      email: dto.email,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  async logDemographics(
    userId: string,
    ip: string,
    location?: { country: string; city: string },
  ): Promise<void> {
    await this.demographicsService.logDemographics(userId, ip, location);
  }
}
