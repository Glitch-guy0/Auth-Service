import { TokenResponseSchema, TokenResponseDto } from '../token-response.dto';

describe('TokenResponseSchema', () => {
  const validInput = {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    expiresIn: 3600,
  };

  it('should accept valid input', () => {
    const result = TokenResponseSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept any valid string as accessToken', () => {
    const result = TokenResponseSchema.safeParse({
      accessToken: 'some-token',
      expiresIn: 1800,
    });
    expect(result.success).toBe(true);
  });

  it('should accept expiresIn as zero', () => {
    const result = TokenResponseSchema.safeParse({
      accessToken: 'token',
      expiresIn: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should accept expiresIn as a very large number', () => {
    const result = TokenResponseSchema.safeParse({
      accessToken: 'token',
      expiresIn: 999999999,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing accessToken', () => {
    const result = TokenResponseSchema.safeParse({ expiresIn: 3600 });
    expect(result.success).toBe(false);
  });

  it('should reject missing expiresIn', () => {
    const result = TokenResponseSchema.safeParse({ accessToken: 'token' });
    expect(result.success).toBe(false);
  });

  it('should reject empty object', () => {
    const result = TokenResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject null input', () => {
    const result = TokenResponseSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('should reject undefined input', () => {
    const result = TokenResponseSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('should reject non-string accessToken', () => {
    const result = TokenResponseSchema.safeParse({
      accessToken: 12345,
      expiresIn: 3600,
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-number expiresIn', () => {
    const result = TokenResponseSchema.safeParse({
      accessToken: 'token',
      expiresIn: '3600',
    });
    expect(result.success).toBe(false);
  });

  it('should reject NaN as expiresIn', () => {
    const result = TokenResponseSchema.safeParse({
      accessToken: 'token',
      expiresIn: NaN,
    });
    expect(result.success).toBe(false);
  });

  it('should parse valid input and return data', () => {
    const result = TokenResponseSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });
});

describe('TokenResponseDto type', () => {
  it('should have correct shape', () => {
    const dto: TokenResponseDto = {
      accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      expiresIn: 7200,
    };
    expect(dto.accessToken).toBe('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0');
    expect(dto.expiresIn).toBe(7200);
  });
});
