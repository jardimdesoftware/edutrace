import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreateAeePlanDto } from 'src/aee-plans/dto/create-aee-plan.dto';
import {
  BODY_LIMIT_BYTES,
  FLAG_PATHS,
  Json,
  OBJECT_SECTION_KEYS,
  SECTION_KEYS,
  SEMESTER,
  STUDENT_EMAIL,
  TEXT_LIMITS,
  WEEKLY_HOURS_MAX,
  WEEKLY_HOURS_PATH,
  blankSections,
  byteLengthOf,
  getAt,
  maxBody,
  removeAt,
  setAt,
  validBody,
} from '../aee-plan.fixtures';

// O pipe real do projeto (whitelist e forbidNonWhitelisted), e não só o
// class-validator: é ele que devolve o 400 que a rota devolve.
function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: CreateAeePlanDto,
  }) as Promise<CreateAeePlanDto>;
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
const textPaths = TEXT_LIMITS.map(([path]) => [path]);
const flagPaths = FLAG_PATHS.map((path) => [path]);

describe('CreateAeePlanDto, corpo completo', () => {
  it('should accept a complete body and keep every value', async () => {
    const body = validBody();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept the body with every text at its maximum length', async () => {
    await expect(validate(maxBody())).resolves.toBeDefined();
  });

  // O body parser do Express recusa acima de 100 kb com 413. Com todo texto no
  // limite (em "ã", 2 bytes cada), a soma dos limites precisa caber nele.
  it('should keep the body with every text at its limit under the 100 kb of the body parser', () => {
    expect(byteLengthOf(maxBody())).toBeLessThan(BODY_LIMIT_BYTES);
  });

  // O pior caso é o caractere de 3 bytes (CJK, aspas e travessões tipográficos):
  // o limite do DTO conta caracteres, e o do body parser conta bytes.
  it('should keep the body under 100 kb even with 3 bytes in every character', () => {
    const body = TEXT_LIMITS.reduce(
      (acc, [path, limit]) => setAt(acc, path, '日'.repeat(limit)),
      validBody(),
    );

    expect(byteLengthOf(body)).toBeLessThan(BODY_LIMIT_BYTES);
  });

  it('should have the 9 text fields and the 16 checkboxes of the contract', () => {
    expect(TEXT_LIMITS).toHaveLength(9);
    expect(FLAG_PATHS).toHaveLength(16);
  });
});

describe('CreateAeePlanDto, student_email', () => {
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

describe('CreateAeePlanDto, semester', () => {
  it.each(['2026.1', '2026.2', '1999.1', '2100.2'])(
    'should accept the semester %s',
    async (semester) => {
      const result = await validate(setAt(validBody(), 'semester', semester));

      expect(result.semester).toBe(semester);
    },
  );

  it.each([
    '2026',
    '2026.0',
    '2026.3',
    '2026.12',
    '2026-1',
    '2026/1',
    '26.1',
    '20261',
    '2026.',
    '.1',
    '',
    ' 2026.1',
    '2026.1 ',
    '2026.1\n',
    '2026.1\u0000',
    '٢٠٢٦.1',
    'a026.1',
    '2026.1.1',
    '2026.1'.repeat(50),
    20261,
    2026.1,
    null,
    true,
    {},
    [],
  ])('should refuse the semester %p with 400', async (semester) => {
    await expect(
      validate(setAt(validBody(), 'semester', semester)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should refuse a body without semester', async () => {
    await expect(
      validate(removeAt(validBody(), 'semester')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should name the field and the format in the message', async () => {
    const messages = await messagesOf(setAt(validBody(), 'semester', '2026.3'));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('semester');
    expect(messages[0]).toContain('AAAA.S');
  });
});

describe('CreateAeePlanDto, seções', () => {
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

  it.each(OBJECT_SECTION_KEYS)(
    'should refuse an empty object in %s',
    async (key) => {
      await expect(
        validate(setAt(validBody(), key, {})),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should name the nested path of the invalid field in the message', async () => {
    const messages = await messagesOf(
      setAt(validBody(), 'objectives.general', 'a'.repeat(2001)),
    );

    expect(messages).toEqual([
      'objectives.general deve ter no máximo 2000 caracteres.',
    ]);
  });
});

describe('CreateAeePlanDto, textos', () => {
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

  // O campo precisa existir no corpo, mas o conteúdo pode ser a string vazia.
  it.each(textLimits)('should accept the empty string in %s', async (path) => {
    const body = setAt(validBody(), path, '');

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(textPaths)(
    'should refuse a body without the text %s',
    async (path) => {
      await expect(
        validate(removeAt(validBody(), path)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(textPaths)(
    'should refuse a number, a boolean, an object, an array and null in %s',
    async (path) => {
      for (const value of [7, true, {}, [], null]) {
        await expect(
          validate(setAt(validBody(), path, value)),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    },
  );

  it.each(textPaths)('should trim the spaces around %s', async (path) => {
    const result = await validate(setAt(validBody(), path, '  texto  '));

    expect(getAt(result as unknown as Json, path)).toBe('texto');
  });

  it('should count the limit after trimming the spaces', async () => {
    const padded = ` ${'a'.repeat(150)} `;

    const result = await validate(
      setAt(validBody(), 'identification.subject', padded),
    );

    expect(result.identification.subject).toBe('a'.repeat(150));
  });

  it('should turn a text of only spaces into the empty string', async () => {
    const result = await validate(setAt(validBody(), 'basis', '   \n  '));

    expect(result.basis).toBe('');
  });

  // O PostgreSQL recusa o NUL em TEXT e o \u0000 em JSONB; sem a recusa na
  // borda, o erro do banco sobe como 500.
  it.each(textPaths)(
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
  ])(
    'should refuse the control character %s in a text',
    async (_name, value) => {
      await expect(
        validate(setAt(validBody(), 'basis', value)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // São textos longos, que o professor escreve em mais de uma linha.
  it.each(textPaths)(
    'should accept line breaks and tabs in %s',
    async (path) => {
      const text = 'linha 1\nlinha 2\r\n\tlinha 3 com acentuação, ç e 日本語';

      const result = await validate(setAt(validBody(), path, text));

      expect(getAt(result as unknown as Json, path)).toBe(text);
    },
  );

  it('should keep html and symbols as plain text', async () => {
    const basis = '<script>alert(1)</script> & "aspas" 100%';

    const result = await validate(setAt(validBody(), 'basis', basis));

    expect(result.basis).toBe(basis);
  });
});

describe('CreateAeePlanDto, caixas de seleção', () => {
  it.each(flagPaths)('should accept true and false in %s', async (path) => {
    for (const value of [true, false]) {
      await expect(
        validate(setAt(validBody(), path, value)),
      ).resolves.toBeDefined();
    }
  });

  it.each(flagPaths)(
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

describe('CreateAeePlanDto, carga horária semanal', () => {
  it.each([0, 1, 4, WEEKLY_HOURS_MAX])(
    'should accept weekly_hours %p',
    async (hours) => {
      await expect(
        validate(setAt(validBody(), WEEKLY_HOURS_PATH, hours)),
      ).resolves.toBeDefined();
    },
  );

  it.each([-1, WEEKLY_HOURS_MAX + 1, 4.5, '4', null, true, NaN, Infinity, {}])(
    'should refuse weekly_hours %p with 400',
    async (hours) => {
      await expect(
        validate(setAt(validBody(), WEEKLY_HOURS_PATH, hours)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // O formulário omite a carga horária quando ela está em branco.
  it('should accept a body without weekly_hours', async () => {
    const body = removeAt(validBody(), WEEKLY_HOURS_PATH);

    await expect(validate(body)).resolves.toEqual(body);
  });
});

describe('CreateAeePlanDto, formulário em branco', () => {
  const blankBody = () => ({
    student_email: STUDENT_EMAIL,
    semester: SEMESTER,
    ...blankSections(),
  });

  it('should accept every text as the empty string with the weekly hours omitted', async () => {
    const body = blankBody();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should keep the flags and the sections required in the blank form', async () => {
    await expect(
      validate(removeAt(blankBody(), 'has_diagnosis')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(removeAt(blankBody(), 'objectives')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CreateAeePlanDto, campos fora do contrato', () => {
  it.each([
    ['id', 1],
    ['id_student', 3],
    ['id_author', 9],
    ['author', { id: 1 }],
    ['student', { full_name: 'x' }],
    ['created_at', '2026-01-01T00:00:00.000Z'],
    ['email', 'estudante@example.com'],
  ])('should refuse the column %s sent in the body', async (field, value) => {
    const messages = await messagesOf({ ...validBody(), [field]: value });

    expect(messages.join(' ')).toContain(field);
  });

  it.each(['identification', 'supports', 'purpose', 'objectives'])(
    'should refuse an unknown field inside %s',
    async (path) => {
      const section = getAt(validBody(), path) as Json;
      const body = setAt(validBody(), path, { ...section, extra: 'x' });

      const messages = await messagesOf(body);

      expect(messages.join(' ')).toContain('extra');
    },
  );
});
