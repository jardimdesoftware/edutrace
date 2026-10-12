import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreatePlansEducationDto } from 'src/plans-education/dto/create-plans-education.dto';

// Só o campo de e-mail importa aqui: os demais campos obrigatórios ausentes
// geram outras mensagens, que não são conferidas.
async function messages(value: object): Promise<string[]> {
  try {
    await createValidationPipe().transform(value, {
      type: 'body',
      metatype: CreatePlansEducationDto,
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { message: string[] }).message;
    }
    throw error;
  }
  return [];
}

const INVALID_EMAIL = 'O campo student_email deve ser um e-mail válido.';

describe('CreatePlansEducationDto, campo student_email', () => {
  it.each([
    'aluno.a@example.test,aluno.b@example.test',
    'nao e email',
    'aluno@',
  ])('should refuse %p', async (student_email) => {
    expect(await messages({ student_email })).toContain(INVALID_EMAIL);
  });

  it('should accept a valid address', async () => {
    expect(
      await messages({ student_email: 'aluno@example.test' }),
    ).not.toContain(INVALID_EMAIL);
  });
});

// A autoria vem do usuário autenticado: valores enviados no corpo não são
// declarados no DTO e o pipe de produção (whitelist) os descarta.
describe('CreatePlansEducationDto, autoria', () => {
  it('should not declare professor_email nor professor_name', () => {
    const dto = plainToInstance(CreatePlansEducationDto, {
      professor_email: 'outro.professor@example.com',
      professor_name: 'Outro Professor',
      objectives: 'Objetivos',
    });

    validateSync(dto, { whitelist: true });

    expect(dto).not.toHaveProperty('professor_email');
    expect(dto).not.toHaveProperty('professor_name');
    expect(dto).toHaveProperty('objectives', 'Objetivos');
  });

  it('should not require the author fields', async () => {
    const result = await messages({});

    expect(result.join(' ')).not.toContain('professor_');
  });
});
