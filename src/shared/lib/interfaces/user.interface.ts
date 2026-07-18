import { User } from '@modules/user/user.entity';
import { RegisterDto } from '@modules/auth/dto/register.dto';

/**
 * Port interface defining the user service contract.
 *
 * Implementations manage user entity CRUD operations and optional
 * demographics logging. Callers depend on this interface rather than
 * concrete implementations, following hexagonal architecture principles.
 */
export interface IUserService {
  /**
   * Look up a user by their email address.
   *
   * @param email - The email address to search for
   * @returns The matching User entity, or null if not found
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Look up a user by their username.
   *
   * @param username - The username to search for
   * @returns The matching User entity, or null if not found
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Create a new user with a bcrypt-hashed password.
   *
   * @param dto - Registration data (username, email, password)
   * @returns The newly created User entity
   */
  create(dto: RegisterDto): Promise<User>;

  /**
   * Log user demographics (IP address, location) to MongoDB.
   *
   * @param userId - The user's UUID
   * @param ip - Client IP address
   * @param location - Optional geolocation data (country, city)
   */
  logDemographics(
    userId: string,
    ip: string,
    location?: { country: string; city: string },
  ): Promise<void>;
}
