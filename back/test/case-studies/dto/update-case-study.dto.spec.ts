import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdateCaseStudyDto } from 'src/case-studies/dto/update-case-study.dto';
import {
  FLAG_PATHS,
  Json,
  OPTIONAL_NON_TEXT_PATHS,
  OBJECT_SECTION_KEYS,
  SECTION_KEYS,
  TEXT_LIMITS,
  blankSections,
  removeAt,
  setAt,
  validSections,
} from '../case-study.fixtures';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdateCaseStudyDto,
  }) as Promise<UpdateCaseStudyDto>;
}

const only = (key: string): Json => ({ [key]: validSections()[key] });

describe('UpdateCaseStudyDto, seções parciais', () => {
  it('should accept the ten sections together', async () => {
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
});

// O formulário envia as dez seções com tudo em branco: texto vazio e a idade e
// as datas omitidas.
describe('UpdateCaseStudyDto, formulário em branco', () => {
  it('should accept the ten blank sections together', async () => {
    const body = blankSections();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(OPTIONAL_NON_TEXT_PATHS.map((path) => [path]))(
    'should accept a section without %s, and still validate it when it comes',
    async (path) => {
      const invalid = path === 'identification.age' ? 121 : '17/10/2026';

      await expect(
        validate(removeAt(validSections(), path)),
      ).resolves.toBeDefined();
      await expect(
        validate(setAt(validSections(), path, invalid)),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate(setAt(validSections(), path, null)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

// Cada seção enviada substitui a seção inteira, então precisa estar completa.
describe('UpdateCaseStudyDto, a seção enviada vai inteira', () => {
  it.each([
    'identification.grade',
    'general_info.has_medical_report',
    'general_info.follow_ups.therapies',
    'school_history.main_difficulties',
    'pedagogical_aspects.language',
    'pedagogical_aspects.math.counts',
    'behavioral_social.participation',
    'resources_strategies.curricular_adaptations',
    'pei_recommendations.referrals',
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

describe('UpdateCaseStudyDto, null não vale como ausente', () => {
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

describe('UpdateCaseStudyDto, as mesmas regras do cadastro', () => {
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

  it('should refuse an age out of range and a date out of format', async () => {
    await expect(
      validate(setAt(validSections(), 'identification.age', 121)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(setAt(validSections(), 'aee_opinion.date', '17/10/2026')),
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
    const result = await validate({ barriers: '  ruído  ' });

    expect(result.barriers).toBe('ruído');
  });
});

describe('UpdateCaseStudyDto, campos fora do contrato', () => {
  it.each([
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
