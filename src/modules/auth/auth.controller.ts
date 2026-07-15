import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Version,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterSchema } from './dto/register.dto';
import type { TokenResponseDto } from './dto/token-response.dto';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { UserExistsException } from '../../shared/exceptions/validation.exception';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Version('v1')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
  ): Promise<TokenResponseDto> {
    try {
      return await this.authService.register(dto);
    } catch (error) {
      if (error instanceof UserExistsException) {
        this.logger.warn(`User conflict: ${error.message}`);
        throw new ConflictException(error.message);
      }
      this.logger.error(`Registration failed for ${dto.username}`, error);
      throw new InternalServerErrorException('Internal server error');
    }
  }
}
