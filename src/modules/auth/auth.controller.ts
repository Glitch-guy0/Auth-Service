import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Version,
  Logger,
  Req,
  Res,
  Headers,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterSchema } from './dto/register.dto';
import { LoginDto, LoginSchema } from './dto/login.dto';
import type { TokenResponseDto } from './dto/token-response.dto';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { AuthenticationException } from '@shared/exceptions/authentication.exception';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  private readonly REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const ip = (req.ip ?? (req.headers['x-forwarded-for'] as string) ?? '')
      .split(',')[0]
      .trim();
    const tokens = await this.authService.register(dto, ip);
    res.cookie('refreshToken', tokens.refreshToken, this.REFRESH_TOKEN_COOKIE_OPTIONS);
    return tokens;
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const ip = (req.ip ?? (req.headers['x-forwarded-for'] as string) ?? '')
      .split(',')[0]
      .trim();
    const tokens = await this.authService.login(dto, ip);
    res.cookie('refreshToken', tokens.refreshToken, this.REFRESH_TOKEN_COOKIE_OPTIONS);
    return tokens;
  }

  @Version('v1')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Token expired or invalid' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponseDto> {
    const refreshToken = (req as any).cookies?.refreshToken;
    const tokens = await this.authService.refresh(refreshToken);

    res.cookie(
      'refreshToken',
      tokens.refreshToken,
      this.REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    return tokens;
  }

  @Version('v1')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid Authorization header',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async logout(
    @Headers('authorization') authHeader: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationException(
        'Missing or invalid Authorization header',
      );
    }
    const token = authHeader.replace('Bearer ', '');

    await this.authService.logout(token);

    res.clearCookie('refreshToken', { path: '/auth' });

    return null;
  }
}
