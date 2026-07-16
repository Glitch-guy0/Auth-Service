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
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterSchema } from './dto/register.dto';
import { LoginDto, LoginSchema } from './dto/login.dto';
import type { TokenResponseDto } from './dto/token-response.dto';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { UserExistsException } from '../../shared/exceptions/validation.exception';
import { InvalidCredentialsException } from '../../shared/exceptions/authentication.exception';
import { UserBlockedException } from '../../shared/exceptions/authorization.exception';

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

  @Version('v1')
  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'User blocked' })
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
  ): Promise<TokenResponseDto> {
    try {
      return await this.authService.login(dto);
    } catch (error) {
      if (error instanceof InvalidCredentialsException) {
        this.logger.warn(`Login failed: ${error.message}`);
        throw new UnauthorizedException(error.message);
      }
      if (error instanceof UserBlockedException) {
        this.logger.warn(`Login blocked: ${error.message}`);
        throw new ForbiddenException(error.message);
      }
      this.logger.error(`Login failed for ${dto.usernameOrEmail}`, error);
      throw new InternalServerErrorException('Internal server error');
    }
  }
}
