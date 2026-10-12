import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreateScreeningDto } from 'src/screenings/dto/create-screening.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

const screening = {
  full_name: 'João Silva',
  email: 'joao@example.com',
  specific_need: { deficiencia_fisica: true, outros: '' },
  special_service: true,
  physical_disability: {
    necessita_de_transcritor: true,
    acesso_para_cadeirante: false,
    outros: 'Algum outro tipo',
  },
  visual_impairment: { necessita_de_braille: false, outros: '' },
  hearing_impairment: { necessita_de_interprete_oralizador: false, outros: '' },
  global_disorder: { necessita_de_ledor: false, outros: '' },
};

function validate(metatype: new () => object, value: object) {
  return createValidationPipe().transform(value, { type: 'body', metatype });
}

async function messages(metatype: new () => object, value: object) {
  try {
    await validate(metatype, value);
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { message: string[] }).message;
    }
    throw error;
  }
  return [];
}

describe('createValidationPipe', () => {
  // Campo fora do DTO é recusado com o nome dele na mensagem, para que a
  // tentativa de gravar um campo indevido ou um erro de contrato não passe
  // como alteração aceita.
  it('should reject the properties that are not declared in the DTO', async () => {
    expect(
      await messages(CreateScreeningDto, {
        ...screening,
        id: 999,
        created_at: '1999-12-31T00:00:00.000Z',
      }),
    ).toEqual([
      'property id should not exist',
      'property created_at should not exist',
    ]);
  });

  it('should keep every key inside the JSON fields', async () => {
    const physical_disability = {
      ...screening.physical_disability,
      campo_adicional_do_formulario: true,
    };

    const result = await validate(CreateScreeningDto, {
      ...screening,
      physical_disability,
    });

    expect(result).toHaveProperty('physical_disability', physical_disability);
  });

  it('should hand the DTO instance to the controller', async () => {
    const result = await validate(CreateScreeningDto, screening);

    expect(result).toBeInstanceOf(CreateScreeningDto);
  });

  it('should keep normalizing a masked cpf before it reaches the service', async () => {
    const result = await validate(CreateUserDto, {
      full_name: 'Usuário de Teste',
      email: 'usuario@edutrace.com',
      cpf: '012.345.678-90',
    });

    expect(result).toHaveProperty('cpf', '01234567890');
  });

  // A senha é definida pelo próprio usuário pelo link de ativação.
  it('should reject a password sent in the user registration', async () => {
    expect(
      await messages(CreateUserDto, {
        full_name: 'Usuário de Teste',
        email: 'usuario@edutrace.com',
        password: 'senhaDoAdministrador',
        cpf: '012.345.678-90',
      }),
    ).toEqual(['property password should not exist']);
  });

  it('should reject a field with the wrong type', async () => {
    await expect(
      validate(CreateScreeningDto, {
        ...screening,
        physical_disability: 'texto no lugar do objeto',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
