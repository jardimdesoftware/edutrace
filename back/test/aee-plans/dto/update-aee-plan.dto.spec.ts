import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdateAeePlanDto } from 'src/aee-plans/dto/update-aee-plan.dto';
import {
  FLAG_PATHS,
  Json,
  OBJECT_SECTION_KEYS,
  SECTION_KEYS,
  TEXT_LIMITS,
  WEEKLY_HOURS_PATH,
  blankSections,
  removeAt,
  setAt,
  validSections,
} from '../aee-plan.fixtures';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdateAeePlanDto,
  }) as Promise<UpdateAeePlanDto>;
}

const only = (key: string): Json => ({ [key]: validSections()[key] });

describe('UpdateAeePlanDto, seções parciais', () => {
  it('should accept the seven sections together', async () => {
    const body = validSections();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(SECTION_KEYS)('should accept a body with only %s', async (key) => {
    const body = only(key);

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept an empty body', async () => {
    await expect(validate({})).resolves.toEqual({});
  });

  it.each([true, false])(
    'should accept has_diagnosis %p, the flag that is not inside a section',
    async (value) => {
      await expect(validate({ has_diagnosis: value })).resolves.toEqual({
        has_diagnosis: value,
      });
    },
  );
});

// O formulário envia as sete seções com tudo em branco: texto vazio e a carga
// horária omitida.
describe('UpdateAeePlanDto, formulário em branco', () => {
  it('should accept the seven blank sections together', async () => {
    const body = blankSections();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept a section without weekly_hours, and still validate it when it comes', async () => {
    await expect(
      validate(removeAt(validSections(), WEEKLY_HOURS_PATH)),
    ).resolves.toBeDefined();
    await expect(
      validate(setAt(validSections(), WEEKLY_HOURS_PATH, 41)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(setAt(validSections(), WEEKLY_HOURS_PATH, null)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// Cada seção enviada substitui a seção inteira, então precisa estar completa.
describe('UpdateAeePlanDto, a seção enviada vai inteira', () => {
  it.each([
    'identification.subject',
    'identification.enrolled_subjects',
    'supports.psychology',
    'supports.medical_specialty',
    'supports.other',
    'purpose.systematic_follow_up',
    'purpose.other',
    'objectives.general',
    'objectives.specific',
  ])('should refuse a section without %s', async (path) => {
    const body = removeAt(validSections(), path);

    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(OBJECT_SECTION_KEYS)(
    'should refuse an empty object in %s',
    async (key) => {
      await expect(validate({ [key]: {} })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});

describe('UpdateAeePlanDto, null não vale como ausente', () => {
  it.each(SECTION_KEYS)('should refuse null in %s', async (key) => {
    await expect(validate({ [key]: null })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(OBJECT_SECTION_KEYS)(
    'should refuse a string and an array in %s',
    async (key) => {
      for (const value of ['texto', 7, []]) {
        await expect(validate({ [key]: value })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
    },
  );
});

describe('UpdateAeePlanDto, as mesmas regras do cadastro', () => {
  it.each(TEXT_LIMITS.map(([path, limit]) => [path, limit] as const))(
    'should refuse %s above %i characters and accept the limit',
    async (path, limit) => {
      await expect(
        validate(setAt(validSections(), path, 'a'.repeat(limit))),
      ).resolves.toBeDefined();
      await expect(
        validate(setAt(validSections(), path, 'a'.repeat(limit + 1))),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(FLAG_PATHS.map((path) => [path]))(
    'should refuse a text in the checkbox %s',
    async (path) => {
      await expect(
        validate(setAt(validSections(), path, 'true')),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should refuse a weekly load out of range', async () => {
    await expect(
      validate(setAt(validSections(), WEEKLY_HOURS_PATH, 41)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(TEXT_LIMITS.map(([path]) => [path]))(
    'should refuse a NUL character in %s and accept the line breaks',
    async (path) => {
      await expect(
        validate(setAt(validSections(), path, 'antes\u0000depois')),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate(setAt(validSections(), path, 'linha 1\nlinha 2')),
      ).resolves.toBeDefined();
    },
  );

  it('should trim the loose texts', async () => {
    const result = await validate({ basis: '  embasamento  ' });

    expect(result.basis).toBe('embasamento');
  });
});

describe('UpdateAeePlanDto, campos fora do contrato', () => {
  // O período letivo identifica o PAEE (é parte da chave única): quem errou o
  // período exclui o PAEE e cria outro, em vez de trocá-lo.
  it.each([
    ['semester', '2027.1'],
    ['student_email', 'outro@example.com'],
    ['email', 'outro@example.com'],
    ['id', 1],
    ['id_student', 3],
    ['id_author', 9],
    ['author', { id: 1 }],
    ['created_at', '2026-01-01T00:00:00.000Z'],
  ])('should refuse %s in the body', async (field, value) => {
    await expect(validate({ [field]: value })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should refuse an unknown field inside a section', async () => {
    const identification = {
      ...(validSections().identification as Json),
      extra: 'x',
    };

    await expect(validate({ identification })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
