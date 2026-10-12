import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdatePlansEducationDto } from 'src/plans-education/dto/update-plans-education.dto';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdatePlansEducationDto,
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

describe('UpdatePlansEducationDto', () => {
  it('should accept a body with only some of the fields', async () => {
    await expect(validate({ objectives: 'Novos objetivos' })).resolves.toEqual({
      objectives: 'Novos objetivos',
    });
  });

  it('should drop the id and the dates the edit screen sends back', async () => {
    await expect(
      validate({
        objectives: 'Novos objetivos',
        id: 999,
        created_at: '2000-01-01T00:00:00.000Z',
        updated_at: '2000-01-01T00:00:00.000Z',
        deleted_at: null,
      }),
    ).resolves.toEqual({ objectives: 'Novos objetivos' });
  });

  it('should drop the student_email that links the plan to its student', async () => {
    await expect(
      validate({
        objectives: 'Novos objetivos',
        student_email: 'outro.estudante@example.com',
      }),
    ).resolves.toEqual({ objectives: 'Novos objetivos' });
  });

  // A autoria é de quem criou o PEI e não muda pelo PATCH.
  it('should drop the author fields', async () => {
    await expect(
      validate({
        objectives: 'Novos objetivos',
        professor_email: 'outro.professor@example.com',
        professor_name: 'Outro Professor',
      }),
    ).resolves.toEqual({ objectives: 'Novos objetivos' });
  });

  it('should reject academic_semester sent as text', async () => {
    expect(await messages({ academic_semester: 'primeiro' })).toEqual([
      'O campo academic_semester deve ser um objeto JSON.',
    ]);
  });

  it('should reject objectives sent as a number', async () => {
    expect(await messages({ objectives: 123 })).toEqual([
      'O campo objectives deve ser uma string.',
    ]);
  });
});
