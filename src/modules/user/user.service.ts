import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { IUserService } from '@shared/lib/interfaces/user.interface';
import { RegisterDto } from '../auth/dto/register.dto';
import { DemographicsService } from '../logging/demographics.service';

/**
 * User entity management service handling CRUD operations and demographics logging.
 *
 * Delegates persistence to the TypeORM `User` repository and optionally
 * forwards demographics data to {@link DemographicsService} when configured.
 *
 * @implements {IUserService}
 */
@Injectable()
export class UserService implements IUserService {
  private readonly logger = new Logger(UserService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Optional() private readonly demographicsService: DemographicsService,
  ) {}

  /**
   * Look up a user by their email address.
   *
   * @param email - The email address to search for
   * @returns The matching User entity, or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug(`Looking up user by email: ${email}`);
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Look up a user by their username.
   *
   * @param username - The username to search for
   * @returns The matching User entity, or null if not found
   */
  async findByUsername(username: string): Promise<User | null> {
    this.logger.debug(`Looking up user by username: ${username}`);
    return this.userRepository.findOne({ where: { username } });
  }

  /**
   * Create a new user with a bcrypt-hashed password.
   *
   * Hashes the plain-text password using bcrypt with 12 salt rounds,
   * persists the new user entity, and returns the saved record.
   *
   * @param dto - Registration data (username, email, password)
   * @returns The newly created User entity
   */
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

  /**
   * Log user demographics (IP address, location) to MongoDB.
   *
   * Delegates to the optional DemographicsService. This is a fire-and-forget
   * operation — failures are caught by the caller.
   *
   * @param userId - The user's UUID
   * @param ip - Client IP address
   * @param location - Optional geolocation data (country, city)
   */
  async logDemographics(
    userId: string,
    ip: string,
    location?: { country: string; city: string },
  ): Promise<void> {
    await this.demographicsService.logDemographics(userId, ip, location);
  }
}
