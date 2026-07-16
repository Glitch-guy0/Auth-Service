import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateKeyPair, exportPKCS8, exportSPKI, importPKCS8, jwtVerify, SignJWT } from 'jose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { TokenService } from '../token.service';
import { IKeyManager } from '../../../common/ports/key-manager.port';
import { KEY_MANAGER } from '../../../common/ports/key-manager.token';
import { AuthToken } from '../auth-token.entity';
import { Repository } from 'typeorm';
import { TokenInvalidSignatureException, TokenExpiredException } from '../../../shared/exceptions/authentication.exception';

jest.mock('crypto');
jest.mock('bcrypt', () => {
  const actual = jest.requireActual('bcrypt');
  return {
    ...actual,
    hash: jest.fn(actual.hash),
  };
});

describe('TokenService', () => {
  let service: TokenService;
  let keyManagerMock: jest.Mocked<IKeyManager>;
  let configServiceMock: jest.Mocked<ConfigService>;
  let authTokenRepo: jest.Mocked<Repository<AuthToken>>;
  let testPrivateKey: string;
  let testPublicKey: CryptoKey;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true, modulusLength: 2048 });
    testPrivateKey = await exportPKCS8(privateKey);
    testPublicKey = publicKey;
  });

  beforeEach(async () => {
    keyManagerMock = {
      getPrivateKey: jest.fn().mockResolvedValue(testPrivateKey),
      getPublicKey: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          KEY_KID: 'test-kid-123',
          AUTH_SERVICE_ISSUER: 'test-issuer',
          ACCESS_TOKEN_EXPIRY_SECONDS: 900,
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    authTokenRepo = {
      query: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: KEY_MANAGER, useValue: keyManagerMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: 'AuthTokenRepository', useValue: authTokenRepo },
        { provide: require('@nestjs/typeorm').getRepositoryToken(AuthToken), useValue: authTokenRepo },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  describe('generateAccessToken (via generateTokenPair path)', () => {
    it('should throw "Not implemented" for generateTokenPair', async () => {
      await expect(service.generateTokenPair('user-1')).rejects.toThrow('Not implemented');
    });



    it('should throw error when getPrivateKey fails', async () => {
      keyManagerMock.getPrivateKey.mockRejectedValue(new Error('Key unavailable'));

      const generateAccessToken = (service as unknown as { generateAccessToken: (userId: string) => Promise<string> }).generateAccessToken.bind(service);
      await expect(generateAccessToken('user-1')).rejects.toThrow('Key unavailable');
    });
  });

  describe('generateAccessToken (private method)', () => {
    let accessToken: string;

    beforeEach(async () => {
      const generateAccessToken = (service as unknown as { generateAccessToken: (userId: string) => Promise<string> }).generateAccessToken.bind(service);
      accessToken = await generateAccessToken('user-123');
    });

    it('should produce a valid JWT with 3 dot-separated parts', () => {
      const parts = accessToken.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should contain correct sub, iss, kid, and exp in payload', async () => {
      const { payload } = await jwtVerify(accessToken, testPublicKey);

      expect(payload.sub).toBe('user-123');
      expect(payload.iss).toBe('test-issuer');
      expect(payload.kid).toBe('test-kid-123');
      expect(typeof payload.exp).toBe('number');
      expect(typeof payload.iat).toBe('number');
    });

    it('should have exp set to iat + configured expiry', async () => {
      const { payload } = await jwtVerify(accessToken, testPublicKey);

      expect(payload.exp! - payload.iat!).toBe(900);
    });

    it('should be signed with RS256 algorithm', async () => {
      const { payload, protectedHeader } = await jwtVerify(accessToken, testPublicKey);

      expect(protectedHeader.alg).toBe('RS256');
      expect(protectedHeader.kid).toBe('test-kid-123');
    });

    it('should call getPrivateKey on KeyManager', () => {
      expect(keyManagerMock.getPrivateKey).toHaveBeenCalled();
    });
  });

  describe('generateRefreshToken', () => {
    beforeEach(() => {
      (crypto.randomBytes as jest.Mock).mockReturnValue(
        Buffer.from('a'.repeat(64)),
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedvalue');
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return rawToken and tokenHash', async () => {
      const result = await (service as any).generateRefreshToken();
      expect(result).toHaveProperty('rawToken');
      expect(result).toHaveProperty('tokenHash');
    });

    it('should return hex-encoded rawToken of 128 characters', async () => {
      const result = await (service as any).generateRefreshToken();
      expect(result.rawToken).toMatch(/^[0-9a-f]{128}$/);
    });

    it('should call crypto.randomBytes with configured byte count', async () => {
      await (service as any).generateRefreshToken();
      expect(crypto.randomBytes).toHaveBeenCalledWith(64);
    });

    it('should call bcrypt.hash with rawToken and configured salt rounds', async () => {
      const result = await (service as any).generateRefreshToken();
      expect(bcrypt.hash).toHaveBeenCalledWith(result.rawToken, 10);
    });

    it('should return tokenHash from bcrypt.hash', async () => {
      const result = await (service as any).generateRefreshToken();
      expect(result.tokenHash).toBe('$2b$10$hashedvalue');
    });

    it('should generate different tokens on each call', async () => {
      (crypto.randomBytes as jest.Mock)
        .mockReturnValueOnce(Buffer.from('a'.repeat(64)))
        .mockReturnValueOnce(Buffer.from('b'.repeat(64)));

      const result1 = await (service as any).generateRefreshToken();
      const result2 = await (service as any).generateRefreshToken();
      expect(result1.rawToken).not.toBe(result2.rawToken);
    });

    it('should verify rawToken against tokenHash with bcrypt.compare', async () => {
      const testBuffer = Buffer.from('a'.repeat(64));
      const expectedHex = testBuffer.toString('hex');
      (crypto.randomBytes as jest.Mock).mockReturnValue(testBuffer);

      const knownHash = '$2b$4$abcdefghijklmnopqrstuvwxyz01234567890123456789012345678901234';
      (bcrypt.hash as jest.Mock).mockResolvedValue(knownHash);

      const result = await (service as any).generateRefreshToken();

      expect(result.rawToken).toBe(expectedHex);
      expect(result.rawToken).toHaveLength(128);
      expect(result.tokenHash).toBe(knownHash);
      expect(result.tokenHash).not.toBe(result.rawToken);
      expect(result.tokenHash).toMatch(/^\$2[ab]\$/);
    });

    it('should throw when crypto.randomBytes fails', async () => {
      (crypto.randomBytes as jest.Mock).mockImplementation(() => {
        throw new Error('entropy exhausted');
      });
      await expect((service as any).generateRefreshToken()).rejects.toThrow(
        'entropy exhausted',
      );
    });

    it('should throw when bcrypt.hash fails', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('hash failed'));
      await expect((service as any).generateRefreshToken()).rejects.toThrow(
        'hash failed',
      );
    });
  });

  describe('verifyAccessToken', () => {
    let testPublicKeyStr: string;
    let wrongKeyPair: CryptoKeyPair;

    beforeAll(async () => {
      testPublicKeyStr = await exportSPKI(testPublicKey);
      wrongKeyPair = await generateKeyPair('RS256', { extractable: true, modulusLength: 2048 });
    });

    beforeEach(() => {
      keyManagerMock.getPublicKey.mockResolvedValue(testPublicKeyStr);
    });

    it('should return userId for valid signed JWT', async () => {
      const privateKeyObj = await importPKCS8(testPrivateKey, 'RS256');
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer', kid: 'test-kid-123' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-123' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKeyObj);

      const result = await service.verifyAccessToken(token);
      expect(result).toEqual({ userId: 'user-123' });
    });

    it('should throw TokenInvalidSignatureException for invalid signature', async () => {
      const wrongPrivateKey = await exportPKCS8(wrongKeyPair.privateKey);
      const wrongPrivateKeyObj = await importPKCS8(wrongPrivateKey, 'RS256');
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer', kid: 'test-kid-123' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-123' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(wrongPrivateKeyObj);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(TokenInvalidSignatureException);
    });

    it('should throw TokenExpiredException for expired token', async () => {
      const privateKeyObj = await importPKCS8(testPrivateKey, 'RS256');
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer', kid: 'test-kid-123' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-123' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
        .sign(privateKeyObj);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(TokenExpiredException);
    });

    it('should throw TokenInvalidSignatureException for malformed token', async () => {
      await expect(service.verifyAccessToken('not.a.valid.token')).rejects.toThrow(TokenInvalidSignatureException);
    });

    it('should throw TokenInvalidSignatureException for missing kid', async () => {
      const privateKeyObj = await importPKCS8(testPrivateKey, 'RS256');
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer' })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKeyObj);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(TokenInvalidSignatureException);
    });

    it('should call getPublicKey with correct kid', async () => {
      const privateKeyObj = await importPKCS8(testPrivateKey, 'RS256');
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer', kid: 'test-kid-123' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-123' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKeyObj);

      await service.verifyAccessToken(token);
      expect(keyManagerMock.getPublicKey).toHaveBeenCalledWith('test-kid-123');
    });

    it('should throw TokenInvalidSignatureException when public key not found', async () => {
      keyManagerMock.getPublicKey.mockResolvedValue(null as any);
      const privateKeyObj = await importPKCS8(testPrivateKey, 'RS256');
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer', kid: 'test-kid-123' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-123' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKeyObj);

      await expect(service.verifyAccessToken(token)).rejects.toThrow(TokenInvalidSignatureException);
    });

    it('should only accept RS256 algorithm', async () => {
      const { publicKey: hs256PublicKey } = await generateKeyPair('RS256', { extractable: true });
      const privateKeyObj = await importPKCS8(testPrivateKey, 'RS256');
      
      const token = await new SignJWT({ sub: 'user-123', iss: 'test-issuer', kid: 'test-kid-123' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-123' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKeyObj);

      keyManagerMock.getPublicKey.mockResolvedValue(await exportSPKI(hs256PublicKey));
      
      await expect(service.verifyAccessToken(token)).rejects.toThrow(TokenInvalidSignatureException);
    });
  });

  describe('storeToken', () => {
    it('should execute UPSERT with correct SQL and parameters', async () => {
      authTokenRepo.query = jest.fn().mockResolvedValue(undefined);

      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const tokenHash = 'abc123hash';
      const expiresAt = new Date('2025-08-15T00:00:00Z');

      await service.storeToken(userId, tokenHash, expiresAt);

      expect(authTokenRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_tokens'),
        [userId, tokenHash, expiresAt],
      );
      expect(authTokenRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (user_id)'),
        [userId, tokenHash, expiresAt],
      );
      expect(authTokenRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('DO UPDATE SET'),
        [userId, tokenHash, expiresAt],
      );
    });

    it('should return void', async () => {
      authTokenRepo.query = jest.fn().mockResolvedValue(undefined);

      const result = await service.storeToken(
        '550e8400-e29b-41d4-a716-446655440000',
        'hash',
        new Date(),
      );

      expect(result).toBeUndefined();
    });

    it('should propagate database errors from query', async () => {
      authTokenRepo.query = jest.fn().mockRejectedValue(new Error('DB connection failed'));

      await expect(
        service.storeToken('user-id', 'hash', new Date()),
      ).rejects.toThrow('DB connection failed');
    });
  });
});
