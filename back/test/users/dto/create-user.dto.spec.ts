import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

const base = {
  full_name: 'Usuário de Teste',
  email: 'usuario@edutrace.com',
  password: 'senhaSegura123',
};

function instance(cpf: unknown) {
  return plainToInstance(CreateUserDto, { ...base, cpf });
}

function validate(cpf: unknown) {
  return validateSync(instance(cpf));
}

describe('CreateUserDto, campo cpf', () => {
  it('should accept a cpf with correct check digits', () => {
    expect(validate('01234567890')).toHaveLength(0);
  });

  it('should accept a masked cpf and keep only the digits', () => {
    const dto = instance('012.345.678-90');

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.cpf).toBe('01234567890');
  });

  it('should keep only the digits of a cpf typed with spaces', () => {
    const dto = instance(' 012 345 678 90 ');

    expect(dto.cpf).toBe('01234567890');
  });

  it('should reject a cpf with wrong check digits', () => {
    const errors = validate('01234567891');

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('cpf');
    expect(errors[0].constraints).toEqual({
      isCpf: 'O campo CPF deve ser um CPF válido.',
    });
  });

  it('should reject a repeated digit sequence', () => {
    expect(validate('00000000000')).toHaveLength(1);
    expect(validate('11111111111')).toHaveLength(1);
  });

  it('should reject letters', () => {
    expect(validate('abcdefghijk')).toHaveLength(1);
  });

  it('should reject a masked cpf whose digits are invalid', () => {
    expect(validate('012.345.678-91')).toHaveLength(1);
  });

  it('should reject an empty cpf', () => {
    const errors = validate('');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });
});
