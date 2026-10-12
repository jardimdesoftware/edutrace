import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdateScreeningDto } from 'src/screenings/dto/update-screening.dto';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdateScreeningDto,
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

describe('UpdateScreeningDto', () => {
  it('should accept a body with only some of the fields', async () => {
    await expect(validate({ special_service: false })).resolves.toEqual({
      special_service: false,
    });
  });

  it('should reject the id and the dates the edit screen sends back', async () => {
    expect(
      await messages({
        special_service: false,
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

  it('should reject the email that links the screening to its student', async () => {
    expect(
      await messages({
        full_name: 'Estudante A',
        special_service: false,
        email: 'outro.estudante@example.com',
      }),
    ).toEqual(['property email should not exist']);
  });

  it('should reject physical_disability sent as text', async () => {
    expect(
      await messages({ physical_disability: 'texto no lugar do objeto' }),
    ).toEqual(['O campo physical_disability deve ser um objeto JSON.']);
  });

  it('should reject special_service sent as text', async () => {
    expect(await messages({ special_service: 'sim' })).toEqual([
      'O campo special_service deve ser um booleano.',
    ]);
  });
});
