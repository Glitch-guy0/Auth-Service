import { LoginSchema, LoginDto } from '../login.dto';

describe('LoginSchema', () => {
  const validInput = {
    usernameOrEmail: 'john',
    password: 'securepass',
  };

  it('should accept valid input with username', () => {
    const result = LoginSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid input with email', () => {
    const result = LoginSchema.safeParse({
      usernameOrEmail: 'john@example.com',
      password: 'securepass',
    });
    expect(result.success).toBe(true);
  });

  it('should accept any non-empty string for usernameOrEmail', () => {
    const result = LoginSchema.safeParse({
      usernameOrEmail: 'anything-goes',
      password: 'securepass',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty strings', () => {
    const result = LoginSchema.safeParse({
      usernameOrEmail: '',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing usernameOrEmail', () => {
    const result = LoginSchema.safeParse({ password: 'pass' });
    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = LoginSchema.safeParse({ usernameOrEmail: 'john' });
    expect(result.success).toBe(false);
  });

  it('should reject empty object', () => {
    const result = LoginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should parse valid input and return data', () => {
    const result = LoginSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });
});

describe('LoginDto type', () => {
  it('should have correct shape', () => {
    const dto: LoginDto = {
      usernameOrEmail: 'john@example.com',
      password: 'securepass',
    };
    expect(dto.usernameOrEmail).toBe('john@example.com');
    expect(dto.password).toBe('securepass');
  });
});
