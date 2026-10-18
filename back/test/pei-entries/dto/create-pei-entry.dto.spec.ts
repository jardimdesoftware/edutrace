import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreatePeiEntryDto } from 'src/pei-entries/dto/create-pei-entry.dto';
import {
  ADAPTATION_MAX,
  BODY_LIMIT_BYTES,
  CONTENT_KEYS,
  Json,
  OPINION_KEYS,
  PAIRS_MAX,
  SUBJECT_MAX,
  SYLLABUS_CONTENT_MAX,
  TEXT_KEYS,
  TEXT_LIMITS,
  blankContent,
  byteLengthOf,
  getAt,
  maxBody,
  maxPairs,
  removeAt,
  setAt,
  validBody,
  validOpinion,
  validPair,
} from '../pei-entry.fixtures';

// O pipe real do projeto (whitelist e forbidNonWhitelisted), e não só o
// class-validator: é ele que devolve o 400 que a rota devolve.
function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: CreatePeiEntryDto,
  }) as Promise<CreatePeiEntryDto>;
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

const SUBJECT_CHARACTERS_MESSAGE =
  'subject não pode ter quebra de linha nem caracteres de controle, de formatação ou inválidos.';

const textLimits = TEXT_LIMITS.map(([path, limit]) => [path, limit] as const);
const textPaths = TEXT_KEYS.map((key) => [key]);
const withPairs = (pairs: unknown) =>
  setAt(validBody(), 'syllabus_adaptations', pairs);

describe('CreatePeiEntryDto, corpo completo', () => {
  it('should accept a complete body and keep every value', async () => {
    const body = validBody();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept the body with every text at its maximum length and the list full', async () => {
    await expect(validate(maxBody())).resolves.toBeDefined();
  });

  // O body parser do Express recusa acima de 100 kb com 413. Com todo texto no
  // limite e a lista cheia (em "ã", 2 bytes cada), a soma dos limites precisa
  // caber nele. O corpo todo em caracteres de 3 bytes (CJK) não cabe: a soma dos
  // limites passa de 42 mil caracteres, e o português acentuado usa 1 ou 2 bytes
  // por caractere. O POST não leva o parecer semestral, que só o PATCH aceita
  // (a conta do corpo do PATCH está em update-pei-entry.dto.spec.ts).
  it('should keep the body with every text at its limit under the 100 kb of the body parser', () => {
    expect(byteLengthOf(maxBody())).toBeLessThan(BODY_LIMIT_BYTES);
  });

  it('should have the 7 content fields and the limits of the contract', () => {
    expect(CONTENT_KEYS).toHaveLength(7);
    expect(TEXT_LIMITS).toHaveLength(6);
    expect([
      SUBJECT_MAX,
      SYLLABUS_CONTENT_MAX,
      ADAPTATION_MAX,
      PAIRS_MAX,
    ]).toEqual([150, 500, 1000, 20]);
  });

  it('should accept the blank form: empty texts and an empty list', async () => {
    const body = { ...validBody(), ...blankContent() };

    await expect(validate(body)).resolves.toEqual(body);
  });
});

describe('CreatePeiEntryDto, student_email', () => {
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

  it('should name the field in the message', async () => {
    const messages = await messagesOf(
      setAt(validBody(), 'student_email', 'sem-arroba'),
    );

    expect(messages).toEqual([
      'O campo student_email deve ser um e-mail válido.',
    ]);
  });
});

describe('CreatePeiEntryDto, semester', () => {
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
    '26.1',
    '',
    ' 2026.1',
    '2026.1 ',
    '2026.1\n',
    '2026.1\u0000',
    '٢٠٢٦.1',
    '2026.1.1',
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

describe('CreatePeiEntryDto, subject', () => {
  it.each([
    'Matemática',
    'Língua Portuguesa II',
    'Redação (turma A/B) - 2º ano',
    'Física & Química',
    'a',
  ])('should accept the subject %p', async (subject) => {
    const result = await validate(setAt(validBody(), 'subject', subject));

    expect(result.subject).toBe(subject);
  });

  it('should accept the subject with exactly 150 characters and refuse 151', async () => {
    await expect(
      validate(setAt(validBody(), 'subject', 'a'.repeat(SUBJECT_MAX))),
    ).resolves.toBeDefined();

    const messages = await messagesOf(
      setAt(validBody(), 'subject', 'a'.repeat(SUBJECT_MAX + 1)),
    );
    expect(messages).toEqual(['subject deve ter no máximo 150 caracteres.']);
  });

  // O limite conta unidades UTF-16, como o .length do front: o emoji vale 2 e o
  // seletor de variação (U+FE0F), 1. O MaxLength do class-validator contava o
  // par surrogate como 1 e o seletor como 0.
  it('should count the limit of the subject in UTF-16 units', async () => {
    const message = ['subject deve ter no máximo 150 caracteres.'];
    const withSubject = (text: string) => setAt(validBody(), 'subject', text);

    expect(
      await messagesOf(withSubject('\u{1F600}️'.repeat(SUBJECT_MAX))),
    ).toEqual(message);
    expect(
      await messagesOf(withSubject('\u{1F600}'.repeat(SUBJECT_MAX / 2 + 1))),
    ).toEqual(message);
    await expect(
      validate(withSubject('\u{1F600}'.repeat(SUBJECT_MAX / 2))),
    ).resolves.toBeDefined();
  });

  it('should refuse a body without subject', async () => {
    await expect(
      validate(removeAt(validBody(), 'subject')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['', ' ', '   ', '\t', ' \t '])(
    'should refuse the blank subject %p, which the trim turns into empty',
    async (subject) => {
      const messages = await messagesOf(setAt(validBody(), 'subject', subject));

      expect(messages).toEqual(['subject não pode ficar em branco.']);
    },
  );

  it.each([7, true, {}, [], null])(
    'should refuse the subject %p that is not a string',
    async (subject) => {
      await expect(
        validate(setAt(validBody(), 'subject', subject)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should trim the spaces around the subject and count the limit after trimming', async () => {
    const padded = await validate(
      setAt(validBody(), 'subject', `  ${'a'.repeat(SUBJECT_MAX)}  `),
    );

    expect(padded.subject).toBe('a'.repeat(SUBJECT_MAX));
  });

  // A disciplina entra na unicidade (texto exato depois do trim), na tabela, no
  // PDF e no log: uma quebra de linha no meio forjaria uma linha, e "Matemática"
  // e "Matemática\n" seriam dois registros.
  it.each([
    ['line feed', 'Mate\nmática'],
    ['carriage return', 'Mate\rmática'],
    ['crlf', 'Mate\r\nmática'],
    ['tab', 'Mate\tmática'],
    ['NUL', 'Mate\u0000mática'],
    ['bell', 'Mate\u0007mática'],
    ['escape', '\u001b[31mMatemática'],
    ['delete', 'Mate\u007fmática'],
    ['vertical tab', 'Mate\u000bmática'],
    ['form feed', 'Mate\u000cmática'],
    ['next line (C1)', 'Mate\u0085mática'],
    ['line separator', 'Mate\u2028mática'],
    ['paragraph separator', 'Mate\u2029mática'],
  ])('should refuse the %s inside the subject', async (_name, subject) => {
    const messages = await messagesOf(setAt(validBody(), 'subject', subject));

    expect(messages).toEqual([SUBJECT_CHARACTERS_MESSAGE]);
  });

  // Os caracteres de formato não têm glifo ou reordenam o texto: "Matemática" e
  // "Mate\u200Bmática" pareceriam a mesma disciplina e seriam dois registros, e o
  // U+202E inverte o sentido do que vem depois dele na tabela e no PDF. O
  // surrogate solto passaria no padrão antigo e o texto não é UTF-8 válido.
  it.each([
    ['zero width space (U+200B)', 'Mate\u200Bmática'],
    ['right-to-left override (U+202E)', 'Mate\u202Emática'],
    ['byte order mark (U+FEFF)', 'Mate\uFEFFmática'],
    ['soft hyphen (U+00AD)', 'Mate\u00ADmática'],
    ['zero width joiner (U+200D)', 'Mate\u200Dmática'],
    ['left-to-right mark (U+200E)', 'Mate\u200Emática'],
    ['word joiner (U+2060)', 'Mate\u2060mática'],
    ['line separator (U+2028)', 'Mate\u2028mática'],
    ['paragraph separator (U+2029)', 'Mate\u2029mática'],
    ['lone high surrogate', 'a\uD800b'],
    ['lone low surrogate', 'a\uDC00b'],
    ['lone surrogate at the end', 'Matemática\uD83D'],
  ])(
    'should refuse the %s inside the subject, with 400',
    async (_name, subject) => {
      const messages = await messagesOf(setAt(validBody(), 'subject', subject));

      expect(messages).toEqual([SUBJECT_CHARACTERS_MESSAGE]);
    },
  );

  it('should refuse a format character at the end of the subject, because the trim does not remove it', async () => {
    await expect(
      validate(setAt(validBody(), 'subject', 'Matemática\u200B')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // O que a disciplina aceita fora do ASCII: letras acentuadas, símbolos e o par
  // de surrogates de verdade (um emoji é um ponto de código só).
  it.each([
    'Educação Física',
    'Língua Portuguesa — 2º ano',
    '日本語',
    'Arte 🎨',
  ])('should still accept the subject %p', async (subject) => {
    const result = await validate(setAt(validBody(), 'subject', subject));

    expect(result.subject).toBe(subject.normalize('NFC'));
  });

  // A comparação da disciplina é pelo texto exato: "Matemática" com a letra "a"
  // mais o acento combinante (NFD) e o mesmo texto composto (NFC) têm a mesma
  // aparência e bytes diferentes, e seriam dois registros do mesmo trio.
  describe('normalization', () => {
    const NFC = 'Matemática';
    const NFD = 'Matema\u0301tica';

    it('should differ in the code units before the normalization, to make the test mean something', () => {
      expect(NFD).not.toBe(NFC);
      expect(NFD.normalize('NFC')).toBe(NFC);
    });

    it('should turn the subject typed in NFD into NFC', async () => {
      const result = await validate(setAt(validBody(), 'subject', NFD));

      expect(result.subject).toBe(NFC);
    });

    it('should keep the subject typed in NFC as it is', async () => {
      const result = await validate(setAt(validBody(), 'subject', NFC));

      expect(result.subject).toBe(NFC);
    });

    it('should trim and then normalize', async () => {
      const result = await validate(
        setAt(validBody(), 'subject', `  ${NFD}  `),
      );

      expect(result.subject).toBe(NFC);
    });

    // O NFC pode encurtar o texto (duas unidades viram uma), e o limite vale para
    // o texto que vai ser gravado.
    it('should count the limit on the normalized subject', async () => {
      const decomposed = 'a\u0301'.repeat(SUBJECT_MAX);

      const result = await validate(setAt(validBody(), 'subject', decomposed));

      expect(result.subject).toBe('á'.repeat(SUBJECT_MAX));
    });
  });

  // O trim tira as quebras de linha das pontas, então a disciplina continua
  // válida; só a quebra no meio do texto é recusada (teste acima).
  it('should trim a line break at the ends of the subject', async () => {
    const result = await validate(
      setAt(validBody(), 'subject', 'Matemática\n'),
    );

    expect(result.subject).toBe('Matemática');
  });

  it('should keep html and symbols as plain text', async () => {
    const subject = '<b>Mat</b> & "aspas" 100%';

    const result = await validate(setAt(validBody(), 'subject', subject));

    expect(result.subject).toBe(subject);
  });
});

describe('CreatePeiEntryDto, textos do conteúdo', () => {
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

      expect(messages).toEqual([
        `${path} deve ter no máximo ${limit} caracteres.`,
      ]);
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
    const padded = ` ${'a'.repeat(2000)} `;

    const result = await validate(
      setAt(validBody(), 'adapted_objectives', padded),
    );

    expect(result.adapted_objectives).toBe('a'.repeat(2000));
  });

  // O PostgreSQL recusa o NUL em TEXT e o \u0000 em JSONB; sem a recusa na
  // borda, o erro do banco sobe como 500.
  it.each(textPaths)(
    'should refuse a NUL character in %s, with 400 and not 500',
    async (path) => {
      const messages = await messagesOf(
        setAt(validBody(), path, 'antes\u0000depois'),
      );

      expect(messages).toEqual([
        `${path} não pode ter caracteres de controle, exceto tabulação e quebra de linha.`,
      ]);
    },
  );

  it.each([
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
        validate(setAt(validBody(), 'general_notes', value)),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // O PostgreSQL recusa o surrogate solto (um \uD800 sem o par) em TEXT e em
  // JSONB, e o erro subiria como 500. O par de verdade (um emoji) continua
  // valendo.
  it.each(textPaths)(
    'should refuse a lone surrogate in %s, with 400 and not 500',
    async (path) => {
      const messages = await messagesOf(setAt(validBody(), path, 'a\uD800b'));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(path);
    },
  );

  it.each([
    ['lone high surrogate', 'a\uD800b'],
    ['lone low surrogate', 'a\uDC00b'],
    ['high surrogate at the end', 'texto\uD83D'],
    ['low surrogate before the high one', '\uDE00\uD83D'],
  ])('should refuse the %s in a text', async (_name, value) => {
    await expect(
      validate(setAt(validBody(), 'general_notes', value)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should accept a valid surrogate pair (an emoji) in a text', async () => {
    const text = 'Gosta de desenhar 🎨 e de música 🎵';

    const result = await validate(setAt(validBody(), 'general_notes', text));

    expect(result.general_notes).toBe(text);
  });

  it('should count the limit of a text in UTF-16 units, as the front does', async () => {
    const message = ['general_notes deve ter no máximo 2000 caracteres.'];
    const withNotes = (text: string) =>
      setAt(validBody(), 'general_notes', text);

    expect(await messagesOf(withNotes('\u{1F600}️'.repeat(2000)))).toEqual(
      message,
    );
    expect(await messagesOf(withNotes('\u{1F600}'.repeat(1001)))).toEqual(
      message,
    );
    await expect(
      validate(withNotes('\u{1F600}'.repeat(1000))),
    ).resolves.toBeDefined();
  });

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
    const notes = '<script>alert(1)</script> & "aspas" 100%';

    const result = await validate(setAt(validBody(), 'general_notes', notes));

    expect(result.general_notes).toBe(notes);
  });
});

describe('CreatePeiEntryDto, lista de conteúdo e adequação', () => {
  it('should accept an empty list', async () => {
    await expect(validate(withPairs([]))).resolves.toBeDefined();
  });

  it('should accept exactly 20 pairs and refuse 21 with 400', async () => {
    await expect(
      validate(withPairs(maxPairs(PAIRS_MAX))),
    ).resolves.toBeDefined();

    const messages = await messagesOf(withPairs(maxPairs(PAIRS_MAX + 1)));
    expect(messages).toEqual([
      'syllabus_adaptations deve ter no máximo 20 itens.',
    ]);
  });

  it('should refuse a body without the list', async () => {
    await expect(
      validate(removeAt(validBody(), 'syllabus_adaptations')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Um par solto no lugar da lista passaria no ValidateNested (é um par válido),
  // e o service falharia com 500 ao percorrer o que não é lista.
  it.each([null, 'texto', 7, true, {}, { 0: validPair() }, validPair()])(
    'should refuse %p in place of the list',
    async (value) => {
      await expect(validate(withPairs(value))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  // O ArrayMaxSize também recusa o que não é lista, mas com a mensagem do limite
  // de itens; o IsArray é o que diz ao cliente que o campo precisa ser uma lista.
  it.each([
    ['a single pair', validPair()],
    ['a text', 'texto'],
  ])(
    'should say that the field must be a list when it is %s',
    async (_name, value) => {
      const messages = await messagesOf(withPairs(value));

      expect(messages).toContain('syllabus_adaptations deve ser uma lista.');
    },
  );

  // O ValidateNested sozinho deixa passar o item que não é objeto, e o Prisma
  // gravaria a string no JSONB. Cada item precisa ser objeto.
  it.each([
    ['a string', 'texto'],
    ['a number', 7],
    ['null', null],
    ['a boolean', true],
    ['an array', [validPair()]],
    ['an empty array', []],
  ])('should refuse %s as an item of the list', async (_name, item) => {
    const messages = await messagesOf(withPairs([validPair(), item]));

    expect(messages.length).toBeGreaterThan(0);
  });

  it('should refuse an item that is not an object, even when it is the only one', async () => {
    for (const item of ['texto', 7, null]) {
      await expect(validate(withPairs([item]))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('should refuse an empty object and an object with only one of the two fields', async () => {
    await expect(validate(withPairs([{}]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      validate(withPairs([{ syllabus_content: 'Frações' }])),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(withPairs([{ adaptation: 'Material concreto' }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should accept syllabus_content with 1 and 500 characters, and refuse 501', async () => {
    for (const length of [1, SYLLABUS_CONTENT_MAX]) {
      await expect(
        validate(
          withPairs([{ ...validPair(), syllabus_content: 'a'.repeat(length) }]),
        ),
      ).resolves.toBeDefined();
    }

    const messages = await messagesOf(
      withPairs([
        {
          ...validPair(),
          syllabus_content: 'a'.repeat(SYLLABUS_CONTENT_MAX + 1),
        },
      ]),
    );
    expect(messages).toEqual([
      'syllabus_adaptations.0.syllabus_content deve ter no máximo 500 caracteres.',
    ]);
  });

  // O conteúdo previsto na ementa é o que identifica o par: sem ele a linha não
  // diz a que a adequação se refere.
  it.each(['', '   ', '\t\n'])(
    'should refuse the blank syllabus_content %p',
    async (value) => {
      const messages = await messagesOf(
        withPairs([{ ...validPair(), syllabus_content: value }]),
      );

      expect(messages).toEqual([
        'syllabus_adaptations.0.syllabus_content não pode ficar em branco.',
      ]);
    },
  );

  it('should accept adaptation with 0 and 1000 characters, and refuse 1001', async () => {
    for (const length of [0, ADAPTATION_MAX]) {
      await expect(
        validate(
          withPairs([{ ...validPair(), adaptation: 'a'.repeat(length) }]),
        ),
      ).resolves.toBeDefined();
    }

    const messages = await messagesOf(
      withPairs([
        { ...validPair(), adaptation: 'a'.repeat(ADAPTATION_MAX + 1) },
      ]),
    );
    expect(messages).toEqual([
      'syllabus_adaptations.0.adaptation deve ter no máximo 1000 caracteres.',
    ]);
  });

  it.each([7, true, {}, [], null])(
    'should refuse %p as syllabus_content and as adaptation',
    async (value) => {
      await expect(
        validate(withPairs([{ ...validPair(), syllabus_content: value }])),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate(withPairs([{ ...validPair(), adaptation: value }])),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should trim both sides of the pair', async () => {
    const result = await validate(
      withPairs([
        { syllabus_content: '  Frações  ', adaptation: '  Material  ' },
      ]),
    );

    expect(result.syllabus_adaptations).toEqual([
      { syllabus_content: 'Frações', adaptation: 'Material' },
    ]);
  });

  it.each(['syllabus_content', 'adaptation'])(
    'should refuse a NUL and other control characters in %s, and accept line breaks and tabs',
    async (field) => {
      for (const value of ['antes\u0000depois', 'a\u0007b', 'a\u007fb']) {
        await expect(
          validate(withPairs([{ ...validPair(), [field]: value }])),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      await expect(
        validate(
          withPairs([
            { ...validPair(), [field]: 'linha 1\nlinha 2\r\n\tlinha 3' },
          ]),
        ),
      ).resolves.toBeDefined();
    },
  );

  // O JSONB do PostgreSQL recusa o surrogate solto, e o erro subiria como 500.
  it.each(['syllabus_content', 'adaptation'])(
    'should refuse a lone surrogate in %s, with 400 and not 500',
    async (field) => {
      const messages = await messagesOf(
        withPairs([{ ...validPair(), [field]: 'a\uD800b' }]),
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain(`syllabus_adaptations.0.${field}`);
    },
  );

  it.each(['syllabus_content', 'adaptation'])(
    'should accept a valid surrogate pair (an emoji) in %s',
    async (field) => {
      await expect(
        validate(withPairs([{ ...validPair(), [field]: 'Figuras 🎨' }])),
      ).resolves.toBeDefined();
    },
  );

  it('should point to the index of the invalid pair', async () => {
    const messages = await messagesOf(
      withPairs([
        validPair(),
        validPair(),
        { ...validPair(), syllabus_content: '' },
      ]),
    );

    expect(messages).toEqual([
      'syllabus_adaptations.2.syllabus_content não pode ficar em branco.',
    ]);
  });

  it('should refuse a field outside the pair', async () => {
    const messages = await messagesOf(
      withPairs([{ ...validPair(), id_author: 1, extra: 'x' }]),
    );

    expect(messages.join(' ')).toContain('extra');
    expect(messages.join(' ')).toContain('id_author');
  });

  it('should keep the order of the pairs', async () => {
    const pairs = [
      { syllabus_content: 'C', adaptation: '3' },
      { syllabus_content: 'A', adaptation: '1' },
      { syllabus_content: 'B', adaptation: '2' },
    ];

    const result = await validate(withPairs(pairs));

    expect(result.syllabus_adaptations).toEqual(pairs);
  });
});

describe('CreatePeiEntryDto, campos fora do contrato', () => {
  it.each([
    ['id', 1],
    ['id_student', 3],
    ['id_author', 9],
    ['author', { full_name: 'x' }],
    ['student', { full_name: 'x' }],
    ['created_at', '2026-01-01T00:00:00.000Z'],
    ['updated_at', '2026-01-01T00:00:00.000Z'],
    ['deleted_at', '2026-01-01T00:00:00.000Z'],
    ['email', 'estudante@example.com'],
  ])('should refuse the column %s sent in the body', async (field, value) => {
    const messages = await messagesOf({ ...validBody(), [field]: value });

    expect(messages.join(' ')).toContain(field);
  });

  it('should name the extra field when the body is otherwise valid', async () => {
    const messages = await messagesOf({ ...validBody(), extra: true });

    expect(messages).toEqual(['property extra should not exist']);
  });
});

// O registro nasce com o parecer semestral em branco: o autor o escreve depois,
// no PATCH. Os quatro campos do parecer não estão no DTO de criação, então o
// forbidNonWhitelisted responde 400 a cada um, mesmo vazio.
describe('CreatePeiEntryDto, parecer semestral', () => {
  it.each(OPINION_KEYS.map((key) => [key]))(
    'should refuse the opinion field %s sent in the body',
    async (key) => {
      const messages = await messagesOf({
        ...validBody(),
        [key]: validOpinion()[key],
      });

      expect(messages).toEqual([`property ${key} should not exist`]);
    },
  );

  it.each(OPINION_KEYS.map((key) => [key]))(
    'should refuse the opinion field %s even when it is empty',
    async (key) => {
      const messages = await messagesOf({ ...validBody(), [key]: '' });

      expect(messages).toEqual([`property ${key} should not exist`]);
    },
  );

  it('should name the four opinion fields when they come together', async () => {
    const messages = await messagesOf({ ...validBody(), ...validOpinion() });

    expect(messages).toHaveLength(4);
    for (const key of OPINION_KEYS) {
      expect(messages).toContain(`property ${key} should not exist`);
    }
  });

  it('should have the four opinion fields of the contract', () => {
    expect(OPINION_KEYS).toEqual([
      'semester_progress',
      'semester_difficulties',
      'next_semester_notes',
      'individual_sessions',
    ]);
  });
});
