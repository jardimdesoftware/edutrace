import { BadRequestException } from '@nestjs/common';
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
