import { User } from '@modules/user/user.entity';
import { RegisterDto } from '@modules/auth/dto/register.dto';

export interface IUserService {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(dto: RegisterDto): Promise<User>;
  logDemographics(
    userId: string,
    ip: string,
    location?: { country: string; city: string },
  ): Promise<void>;
}
