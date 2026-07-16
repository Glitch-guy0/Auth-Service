import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { RegisterSchema } from '../../dto/register.dto';
import { LoginSchema } from '../../dto/login.dto';

describe('ZodValidationPipe', () => {
  describe('with RegisterSchema', () => {
    const pipe = new ZodValidationPipe(RegisterSchema);

    const validInput = {
      username: 'john',
      email: 'john@example.com',
      password: 'securepass',
    };

    it('should return parsed data when input matches schema', () => {
      const result = pipe.transform(validInput);
      expect(result).toEqual(validInput);
    });

    it('should throw BadRequestException with 400 status when input is invalid', () => {
      expect(() => pipe.transform({})).toThrow(BadRequestException);
      try {
        pipe.transform({});
      } catch (e) {
        expect((e as BadRequestException).getStatus()).toBe(400);
      }
    });

    it('should include Zod issue details in error response', () => {
      try {
        pipe.transform({ username: 'ab', email: 'bad', password: 'short' });
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse() as {
          message: string;
          errors: Array<{
            code: string;
            message: string;
            path: (string | number)[];
          }>;
        };
        expect(response.message).toBe('Validation failed');
        expect(response.errors).toBeDefined();
        expect(Array.isArray(response.errors)).toBe(true);
        expect(response.errors.length).toBe(3);

        const usernameError = response.errors.find(
          (err) => err.path.includes('username'),
        );
        expect(usernameError).toBeDefined();
        expect(usernameError!.code).toBe('too_small');
        expect(usernameError!.message).toContain('3');

        const emailError = response.errors.find((err) =>
          err.path.includes('email'),
        );
        expect(emailError).toBeDefined();
        expect(emailError!.code).toBe('invalid_format');
        expect(emailError!.message).toBeDefined();

        const passwordError = response.errors.find((err) =>
          err.path.includes('password'),
        );
        expect(passwordError).toBeDefined();
        expect(passwordError!.code).toBe('too_small');
      }
    });

    it('should handle empty/missing body', () => {
      expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
      expect(() => pipe.transform(null)).toThrow(BadRequestException);
    });

    it('should handle extra fields by stripping them', () => {
      const input = { ...validInput, extraField: 'ignored' };
      const result = pipe.transform(input);
      expect(result).toEqual(validInput);
      expect(result).not.toHaveProperty('extraField');
    });

    it('should reject missing required fields', () => {
      expect(() =>
        pipe.transform({ username: 'john' }),
      ).toThrow(BadRequestException);
      expect(() =>
        pipe.transform({ email: 'a@b.com' }),
      ).toThrow(BadRequestException);
      expect(() =>
        pipe.transform({ password: '12345678' }),
      ).toThrow(BadRequestException);
    });

    it('should reject username shorter than 3 characters', () => {
      expect(() =>
        pipe.transform({ ...validInput, username: 'jo' }),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid email format', () => {
      expect(() =>
        pipe.transform({ ...validInput, email: 'not-an-email' }),
      ).toThrow(BadRequestException);
    });

    it('should reject password shorter than 8 characters', () => {
      expect(() =>
        pipe.transform({ ...validInput, password: 'short' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('with LoginSchema', () => {
    const pipe = new ZodValidationPipe(LoginSchema);

    const validInput = {
      usernameOrEmail: 'john@example.com',
      password: 'securepass',
    };

    it('should return parsed data when input matches schema', () => {
      const result = pipe.transform(validInput);
      expect(result).toEqual(validInput);
    });

    it('should throw BadRequestException with 400 status when input is invalid', () => {
      expect(() => pipe.transform({})).toThrow(BadRequestException);
      try {
        pipe.transform({});
      } catch (e) {
        expect((e as BadRequestException).getStatus()).toBe(400);
      }
    });

    it('should include Zod issue details for login errors', () => {
      try {
        pipe.transform({ usernameOrEmail: 'test' });
        fail('Expected BadRequestException');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const response = (e as BadRequestException).getResponse() as {
          message: string;
          errors: Array<{
            code: string;
            message: string;
            path: (string | number)[];
          }>;
        };
        expect(response.message).toBe('Validation failed');
        expect(response.errors).toBeDefined();
        expect(response.errors.length).toBe(1);
        expect(response.errors[0].path).toEqual(['password']);
        expect(response.errors[0].code).toBe('invalid_type');
      }
    });

    it('should handle empty/missing body', () => {
      expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
      expect(() => pipe.transform(null)).toThrow(BadRequestException);
    });

    it('should handle extra fields by stripping them', () => {
      const input = { ...validInput, extra: 'field' };
      const result = pipe.transform(input);
      expect(result).toEqual(validInput);
      expect(result).not.toHaveProperty('extra');
    });
  });

  describe('with custom schema', () => {
    const customSchema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
    });
    const pipe = new ZodValidationPipe(customSchema);

    it('should validate custom schemas correctly', () => {
      const result = pipe.transform({ name: 'Alice', age: 30 });
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should reject invalid types', () => {
      expect(() =>
        pipe.transform({ name: 'Alice', age: 'not-a-number' }),
      ).toThrow(BadRequestException);
    });

    it('should reject negative numbers', () => {
      expect(() =>
        pipe.transform({ name: 'Alice', age: -5 }),
      ).toThrow(BadRequestException);
    });
  });
});
