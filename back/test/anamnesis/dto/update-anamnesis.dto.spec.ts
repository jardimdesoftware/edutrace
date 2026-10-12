import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdateAnamnesisDto } from 'src/anamnesis/dto/update-anamnesis.dto';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdateAnamnesisDto,
  });
}

async function messages(value: object) {
  try {
    await validate(value);
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { message: string[] }).message;
    }
    throw error;
  }
  return [];
}

describe('UpdateAnamnesisDto', () => {
  const identification = { nome_completo: 'Novo Nome', turma: 'Turma A' };

  it('should accept a body with only some of the fields', async () => {
    await expect(validate({ identification })).resolves.toEqual({
      identification,
    });
  });

  it('should reject the id and the dates the edit screen sends back', async () => {
    expect(
      await messages({
        identification,
        id: 999,
        created_at: '2000-01-01T00:00:00.000Z',
        updated_at: '2000-01-01T00:00:00.000Z',
        deleted_at: null,
      }),
    ).toEqual([
      'property id should not exist',
      'property created_at should not exist',
      'property updated_at should not exist',
      'property deleted_at should not exist',
    ]);
  });

  it('should reject identification sent as text', async () => {
    expect(await messages({ identification: 'texto' })).toEqual([
      'O campo Identification deve ser um objeto JSON.',
    ]);
  });

  it('should reject the email that links the anamnesis to its student', async () => {
    expect(
      await messages({ identification, email: 'outro.estudante@example.com' }),
    ).toEqual(['property email should not exist']);
  });
});
