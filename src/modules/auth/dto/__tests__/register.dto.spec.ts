import { RegisterSchema, RegisterDto } from '../register.dto';

describe('RegisterSchema', () => {
  const validInput = {
    username: 'john',
    email: 'john@example.com',
    password: 'securepass',
  };

  it('should accept valid input', () => {
    const result = RegisterSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject username shorter than 3 characters', () => {
    const result = RegisterSchema.safeParse({ ...validInput, username: 'jo' });
    expect(result.success).toBe(false);
  });

  it('should accept username with exactly 3 characters', () => {
    const result = RegisterSchema.safeParse({ ...validInput, username: 'joh' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email format', () => {
    const result = RegisterSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should reject email without @ symbol', () => {
    const result = RegisterSchema.safeParse({ ...validInput, email: 'johnexample.com' });
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({ ...validInput, password: 'short' });
    expect(result.success).toBe(false);
  });

  it('should accept password with exactly 8 characters', () => {
    const result = RegisterSchema.safeParse({ ...validInput, password: '12345678' });
    expect(result.success).toBe(true);
  });

  it('should reject missing username', () => {
    const result = RegisterSchema.safeParse({ email: 'a@b.com', password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('should reject missing email', () => {
    const result = RegisterSchema.safeParse({ username: 'john', password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('should reject missing password', () => {
    const result = RegisterSchema.safeParse({ username: 'john', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('should parse valid input and return data', () => {
    const result = RegisterSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validInput);
    }
  });
});

describe('RegisterDto type', () => {
  it('should have correct shape', () => {
    const dto: RegisterDto = {
      username: 'john',
      email: 'john@example.com',
      password: 'securepass',
    };
    expect(dto.username).toBe('john');
    expect(dto.email).toBe('john@example.com');
    expect(dto.password).toBe('securepass');
  });
});
