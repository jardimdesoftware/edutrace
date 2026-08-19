import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthDto } from 'src/auth/dto/auth.dto';

function validate(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(AuthDto, payload));
}

describe('AuthDto', () => {
  it('should accept a password shorter than eight characters', () => {
    const errors = validate({ email: 'user@edutrace.com', password: 'abc' });

    expect(errors).toHaveLength(0);
  });

  it('should not declare any length constraint on the password', () => {
    const errors = validate({ email: 'user@edutrace.com', password: 'a' });

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty password', () => {
    const errors = validate({ email: 'user@edutrace.com', password: '' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints).toEqual({
      isNotEmpty: 'O campo password não deve estar vazio.',
    });
  });

  it('should reject a password that is not a string', () => {
    const errors = validate({ email: 'user@edutrace.com', password: 12345678 });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
    expect(errors[0].constraints).toEqual({
      isString: 'O campo password deve ser uma string',
    });
  });

  it('should reject an empty email', () => {
    const errors = validate({ email: '', password: 'senhaSegura123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints).toEqual({
      isNotEmpty: 'O campo email não deve estar vazio.',
    });
  });

  it('should accept a valid pair of credentials', () => {
    const errors = validate({
      email: 'user@edutrace.com',
      password: 'senhaSegura123',
    });

    expect(errors).toHaveLength(0);
  });
});
