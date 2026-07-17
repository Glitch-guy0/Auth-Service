import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { config } from 'dotenv';
config({ path: '.env.test' });

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/exceptions/all-exceptions.filter';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';

jest.setTimeout(30000);

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, prefix: '' });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE auth_tokens CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');
  });

  describe('/v1/auth/register (POST)', () => {
    it('IT-1: should register a new user', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'securepass123',
        })
        .expect(201)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
          expect(res.body.data).toHaveProperty('expiresIn');
        });
    });

    it('IT-2: should reject duplicate username', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'dupuser',
          email: 'first@example.com',
          password: 'securepass123',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'dupuser',
          email: 'second@example.com',
          password: 'securepass123',
        })
        .expect(400)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('VALIDATION_USER_EXISTS');
        });
    });

    it('IT-3: should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'validuser',
          email: 'not-an-email',
          password: 'securepass123',
        })
        .expect(400);
    });

    it('IT-4: should reject short password', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'validuser',
          email: 'test@example.com',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('/v1/auth/authenticate (POST)', () => {
    it('IT-5: should login with valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'logintest',
          email: 'login@example.com',
          password: 'securepass123',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/v1/auth/authenticate')
        .send({ usernameOrEmail: 'logintest', password: 'securepass123' })
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
          expect(res.body.data).toHaveProperty('expiresIn');
        });
    });

    it('IT-6: should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'wrongpasstest',
          email: 'wrongpass@example.com',
          password: 'securepass123',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/v1/auth/authenticate')
        .send({ usernameOrEmail: 'wrongpasstest', password: 'wrongpassword' })
        .expect(401)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
        });
    });

    it('IT-7: should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/authenticate')
        .send({
          usernameOrEmail: 'nonexistent',
          password: 'securepass123',
        })
        .expect(401)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
        });
    });

    it('IT-14: should reject blocked user', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'blockeduser',
          email: 'blocked@example.com',
          password: 'securepass123',
        })
        .expect(201);

      const accessToken = registerRes.body.data.accessToken;

      const userRow = await dataSource.query(
        `SELECT id FROM users WHERE username = $1`,
        ['blockeduser'],
      );
      const userId = userRow[0].id;

      await dataSource.query(
        `UPDATE users SET blocked = true WHERE id = $1`,
        [userId],
      );

      return request(app.getHttpServer())
        .post('/v1/auth/authenticate')
        .send({
          usernameOrEmail: 'blockeduser',
          password: 'securepass123',
        })
        .expect(403)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('AUTH_USER_BLOCKED');
        });
    });
  });

  describe('/v1/auth/refresh (POST)', () => {
    it('IT-8: should refresh tokens with valid cookie', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'refreshtest',
          email: 'refresh@example.com',
          password: 'securepass123',
        })
        .expect(201);

      const setCookieHeader = registerRes.headers['set-cookie'] as unknown as string[];
      const refreshTokenCookie = setCookieHeader.find((c: string) =>
        c.startsWith('refreshToken='),
      )!;
      const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1];

      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('accessToken');
          expect(res.body.data).toHaveProperty('refreshToken');
          expect(res.body.data).toHaveProperty('expiresIn');
        });
    });

    it('IT-9: should reject refresh without cookie', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .expect(401)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
        });
    });

    it('IT-10: should reject expired refresh token', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'expiredtest',
          email: 'expired@example.com',
          password: 'securepass123',
        })
        .expect(201);

      const userRow = await dataSource.query(
        `SELECT id FROM users WHERE username = $1`,
        ['expiredtest'],
      );
      const userId = userRow[0].id;

      await dataSource.query(
        `UPDATE auth_tokens SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1`,
        [userId],
      );

      const setCookieHeader = registerRes.headers['set-cookie'] as unknown as string[];
      const refreshTokenCookie = setCookieHeader.find((c: string) =>
        c.startsWith('refreshToken='),
      )!;
      const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1];

      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('TOKEN_EXPIRED');
        });
    });
  });

  describe('/v1/auth/logout (POST)', () => {
    it('IT-11: should logout with valid access token', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'logouttest',
          email: 'logout@example.com',
          password: 'securepass123',
        })
        .expect(201);

      const accessToken = registerRes.body.data.accessToken;

      return request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeNull();
        });
    });

    it('IT-12: should handle logout replay (token blacklisted)', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'replaytest',
          email: 'replay@example.com',
          password: 'securepass123',
        })
        .expect(201);

      const accessToken = registerRes.body.data.accessToken;

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const secondLogoutRes = await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(secondLogoutRes.body.success).toBe(true);
    });
  });

  describe('Full flow', () => {
    it('IT-13: register → refresh → logout → refresh (should fail)', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          username: 'fullflowtest',
          email: 'fullflow@example.com',
          password: 'securepass123',
        })
        .expect(201);

      const accessToken = registerRes.body.data.accessToken;
      const setCookieHeader = registerRes.headers['set-cookie'] as unknown as string[];
      const refreshTokenCookie = setCookieHeader.find((c: string) =>
        c.startsWith('refreshToken='),
      )!;
      const refreshToken = refreshTokenCookie.split(';')[0].split('=')[1];

      const refreshRes = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(200);

      expect(refreshRes.body.success).toBe(true);

      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
        });
    });
  });
});
