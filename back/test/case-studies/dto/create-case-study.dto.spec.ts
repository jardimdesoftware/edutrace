import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreateCaseStudyDto } from 'src/case-studies/dto/create-case-study.dto';
import {
  BODY_LIMIT_BYTES,
  DATE_PATHS,
  FLAG_PATHS,
  Json,
  OPTIONAL_NON_TEXT_PATHS,
  OBJECT_SECTION_KEYS,
  OPTIONAL_TEXT_PATHS,
  REQUIRED_TEXT_LIMITS,
  SECTION_KEYS,
  STUDENT_EMAIL,
  TEXT_LIMITS,
  blankSections,
  byteLengthOf,
  getAt,
  maxBody,
  removeAt,
  setAt,
  validBody,
} from '../case-study.fixtures';

// O pipe real do projeto (whitelist e forbidNonWhitelisted), e não só o
// class-validator: é ele que devolve o 400 que a rota devolve.
function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: CreateCaseStudyDto,
  }) as Promise<CreateCaseStudyDto>;
}

async function messagesOf(value: object): Promise<string[]> {
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

const textLimits = TEXT_LIMITS.map(([path, limit]) => [path, limit] as const);

describe('CreateCaseStudyDto, corpo completo', () => {
  it('should accept a complete body and keep every value', async () => {
    const body = validBody();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept a body without the optional diagnosis', async () => {
    const body = removeAt(validBody(), 'general_info.diagnosis');

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept the body with every text at its maximum length', async () => {
    await expect(validate(maxBody())).resolves.toBeDefined();
  });

  // O body parser do Express recusa acima de 100 kb com 413. Com todo texto no
  // limite (em "ã", 2 bytes cada), a soma dos limites precisa caber nele.
  it('should keep the body with every text at its limit under the 100 kb of the body parser', () => {
    const bytes = byteLengthOf(maxBody());

    expect(bytes).toBeLessThan(BODY_LIMIT_BYTES);
  });

  it('should have the 24 text fields and the 19 checkboxes of the contract', () => {
    expect(TEXT_LIMITS).toHaveLength(24);
    expect(FLAG_PATHS).toHaveLength(19);
  });
});

describe('CreateCaseStudyDto, student_email', () => {
  it('should refuse a body without student_email', async () => {
    await expect(
      validate(removeAt(validBody(), 'student_email')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['', 'sem-arroba', 'a@', 42, null])(
    'should refuse student_email %p with 400',
    async (value) => {
      await expect(
        validate(setAt(validBody(), 'student_email', value)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('CreateCaseStudyDto, seções', () => {
  it.each(SECTION_KEYS)('should refuse a body without %s', async (key) => {
    await expect(validate(removeAt(validBody(), key))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(SECTION_KEYS)('should refuse null in %s', async (key) => {
    await expect(
      validate(setAt(validBody(), key, null)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(OBJECT_SECTION_KEYS)(
    'should refuse a string, a number and an array in %s',
    async (key) => {
      for (const value of ['texto', 7, [], [{}]]) {
        await expect(
          validate(setAt(validBody(), key, value)),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    },
  );

  it.each([
    'identification.grade',
    'general_info.follow_ups',
    'general_info.follow_ups.other',
    'pedagogical_aspects.language',
    'pedagogical_aspects.reading_writing.notes',
    'pedagogical_aspects.math',
  ])('should refuse a body without the nested %s', async (path) => {
    await expect(validate(removeAt(validBody(), path))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['general_info.follow_ups', 'pedagogical_aspects.language'])(
    'should refuse a string or an array in the nested object %s',
    async (path) => {
      for (const value of ['texto', [], null]) {
        await expect(
          validate(setAt(validBody(), path, value)),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    },
  );

  it('should name the nested path of the invalid field in the message', async () => {
    const messages = await messagesOf(
      setAt(
        validBody(),
        'pedagogical_aspects.language.notes',
        'a'.repeat(1001),
      ),
    );

    expect(messages).toEqual([
      'pedagogical_aspects.language.notes deve ter no máximo 1000 caracteres.',
    ]);
  });
});

describe('CreateCaseStudyDto, textos', () => {
  it.each(textLimits)(
    'should accept %s with exactly %i characters',
    async (path, limit) => {
      await expect(
        validate(setAt(validBody(), path, 'a'.repeat(limit))),
      ).resolves.toBeDefined();
    },
  );

  it.each(textLimits)(
    'should refuse %s with one character above %i, with 400',
    async (path, limit) => {
      const messages = await messagesOf(
        setAt(validBody(), path, 'a'.repeat(limit + 1)),
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(path.split('.').pop());
      expect(messages[0]).toContain(`no máximo ${limit} caracteres`);
    },
  );

  // Texto opcional pode ser vazio: o campo precisa existir no corpo, mas o
  // conteúdo pode ser a string vazia.
  it.each(textLimits)('should accept the empty string in %s', async (path) => {
    const body = setAt(validBody(), path, '');

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(REQUIRED_TEXT_LIMITS.map(([path]) => [path]))(
    'should refuse a body without the text %s',
    async (path) => {
      await expect(
        validate(removeAt(validBody(), path)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(OPTIONAL_TEXT_PATHS.map((path) => [path]))(
    'should accept a body without the optional text %s',
    async (path) => {
      await expect(
        validate(removeAt(validBody(), path)),
      ).resolves.toBeDefined();
    },
  );

  it.each(textLimits)(
    'should refuse a number, a boolean, an object and null in %s',
    async (path) => {
      for (const value of [7, true, {}, [], null]) {
        // O diagnóstico é opcional, mas null não é "ausente": responde 400.
        await expect(
          validate(setAt(validBody(), path, value)),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    },
  );

  it.each(textLimits)('should trim the spaces around %s', async (path) => {
    const result = await validate(setAt(validBody(), path, '  texto  '));

    expect(getAt(result as unknown as Json, path)).toBe('texto');
  });

  it('should count the limit after trimming the spaces', async () => {
    const padded = ` ${'a'.repeat(50)} `;

    const result = await validate(
      setAt(validBody(), 'identification.grade', padded),
    );

    expect(result.identification.grade).toBe('a'.repeat(50));
  });

  it('should turn a text of only spaces into the empty string', async () => {
    const result = await validate(setAt(validBody(), 'barriers', '   \n  '));

    expect(result.barriers).toBe('');
  });

  // O PostgreSQL recusa o NUL em TEXT e o \u0000 em JSONB; sem a recusa na
  // borda, o erro do banco sobe como 500.
  it.each(textLimits)(
    'should refuse a NUL character in %s, with 400 and not 500',
    async (path) => {
      const messages = await messagesOf(
        setAt(validBody(), path, 'antes\u0000depois'),
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(path.split('.').pop());
      expect(messages[0]).toContain('caracteres de controle');
    },
  );

  it.each([
    ['NUL', '\u0000'],
    ['bell', '\u0007'],
    ['escape', '\u001b[31mvermelho'],
    ['delete', 'a\u007fb'],
    ['next line (C1)', 'a\u0085b'],
    ['vertical tab', 'a\u000bb'],
    ['form feed', 'a\u000cb'],
  ])('should refuse the control character %s in a text', async (_name, value) => {
    await expect(
      validate(setAt(validBody(), 'barriers', value)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // São textos longos, que o professor escreve em mais de uma linha.
  it.each(textLimits)(
    'should accept line breaks and tabs in %s',
    async (path) => {
      const text = 'linha 1\nlinha 2\r\n\tlinha 3 com acentuação, ç e 日本語';

      const result = await validate(setAt(validBody(), path, text));

      expect(getAt(result as unknown as Json, path)).toBe(text);
    },
  );

  it('should keep html and symbols as plain text', async () => {
    const barriers = '<script>alert(1)</script> & "aspas" 100%';

    const result = await validate(setAt(validBody(), 'barriers', barriers));

    expect(result.barriers).toBe(barriers);
  });
});

describe('CreateCaseStudyDto, caixas de seleção', () => {
  it.each(FLAG_PATHS.map((path) => [path]))(
    'should accept true and false in %s',
    async (path) => {
      for (const value of [true, false]) {
        await expect(
          validate(setAt(validBody(), path, value)),
        ).resolves.toBeDefined();
      }
    },
  );

  it.each(FLAG_PATHS.map((path) => [path]))(
    'should refuse a text, a number, null and a missing %s',
    async (path) => {
      for (const value of ['true', 'false', 1, 0, null, {}]) {
        await expect(
          validate(setAt(validBody(), path, value)),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      await expect(
        validate(removeAt(validBody(), path)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('CreateCaseStudyDto, idade', () => {
  it.each([0, 1, 17, 120])('should accept age %p', async (age) => {
    await expect(
      validate(setAt(validBody(), 'identification.age', age)),
    ).resolves.toBeDefined();
  });

  it.each([-1, 121, 17.5, '17', null, true, NaN, Infinity])(
    'should refuse age %p with 400',
    async (age) => {
      await expect(
        validate(setAt(validBody(), 'identification.age', age)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // O formulário omite a idade quando ela está em branco.
  it('should accept a body without age', async () => {
    const body = removeAt(validBody(), 'identification.age');

    await expect(validate(body)).resolves.toEqual(body);
  });
});

describe('CreateCaseStudyDto, datas', () => {
  it.each(
    DATE_PATHS.flatMap((path) => [
      [path, '2026-10-17'],
      [path, '2026-10-17T13:45:00.000Z'],
      [path, '2026-10-17T10:45:00-03:00'],
    ]),
  )('should accept the date in %s as %s', async (path, value) => {
    await expect(
      validate(setAt(validBody(), path, value)),
    ).resolves.toBeDefined();
  });

  it.each(
    DATE_PATHS.flatMap((path) =>
      [
        '17/10/2026',
        '2026-02-30',
        '2026-13-01',
        'ontem',
        '',
        ' 2026-10-17',
        `2026-10-17T10:00:00.${'0'.repeat(100)}Z`,
        20261017,
        null,
        true,
      ].map((value) => [path, value] as const),
    ),
  )('should refuse the date in %s as %p with 400', async (path, value) => {
    await expect(
      validate(setAt(validBody(), path, value)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // O formulário omite a data quando ela está em branco.
  it.each(DATE_PATHS.map((path) => [path]))(
    'should accept a body without the date %s',
    async (path) => {
      const body = removeAt(validBody(), path);

      await expect(validate(body)).resolves.toEqual(body);
    },
  );
});

describe('CreateCaseStudyDto, formulário em branco', () => {
  const blankBody = () => ({
    student_email: STUDENT_EMAIL,
    ...blankSections(),
  });

  it('should accept every text as the empty string with the age and the dates omitted', async () => {
    const body = blankBody();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(OPTIONAL_NON_TEXT_PATHS.map((path) => [path]))(
    'should still validate %s when it comes, and refuse null as a blank',
    async (path) => {
      const invalid = path === 'identification.age' ? 121 : '17/10/2026';

      await expect(
        validate(setAt(blankBody(), path, invalid)),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate(setAt(blankBody(), path, null)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should keep the flags and the sections required in the blank form', async () => {
    await expect(
      validate(removeAt(blankBody(), 'general_info.has_medical_report')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(removeAt(blankBody(), 'aee_opinion')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CreateCaseStudyDto, campos fora do contrato', () => {
  it.each([
    ['id', 1],
    ['id_student', 3],
    ['id_author', 9],
    ['author', { id: 1 }],
    ['created_at', '2026-01-01T00:00:00.000Z'],
    ['email', 'estudante@example.com'],
  ])('should refuse the column %s sent in the body', async (field, value) => {
    const messages = await messagesOf({ ...validBody(), [field]: value });

    expect(messages.join(' ')).toContain(field);
  });

  it.each([
    'identification',
    'general_info',
    'general_info.follow_ups',
    'school_history',
    'pedagogical_aspects',
    'pedagogical_aspects.language',
    'pedagogical_aspects.reading_writing',
    'pedagogical_aspects.math',
    'behavioral_social',
    'resources_strategies',
    'pei_recommendations',
    'aee_opinion',
  ])('should refuse an unknown field inside %s', async (path) => {
    const section = getAt(validBody(), path) as Json;
    const body = setAt(validBody(), path, { ...section, extra: 'x' });

    const messages = await messagesOf(body);

    expect(messages.join(' ')).toContain('extra');
  });
});
