import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreateScreeningDto } from 'src/screenings/dto/create-screening.dto';

// Só o campo de e-mail importa aqui: os demais campos obrigatórios ausentes
// geram outras mensagens, que não são conferidas.
async function messages(value: object): Promise<string[]> {
  try {
    await createValidationPipe().transform(value, {
      type: 'body',
      metatype: CreateScreeningDto,
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { message: string[] }).message;
    }
    throw error;
  }
  return [];
}

const INVALID_EMAIL = 'O campo email deve ser um e-mail válido.';

describe('CreateScreeningDto, campo email', () => {
  it.each([
    'aluno.a@example.test,aluno.b@example.test',
    'nao e email',
    'aluno@',
  ])('should refuse %p', async (email) => {
    expect(await messages({ email })).toContain(INVALID_EMAIL);
  });

  it('should accept a valid address', async () => {
    expect(await messages({ email: 'aluno@example.test' })).not.toContain(
      INVALID_EMAIL,
    );
  });
});
