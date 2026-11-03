import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdatePeiEntryDto } from 'src/pei-entries/dto/update-pei-entry.dto';
import {
  ADAPTATION_MAX,
  BODY_LIMIT_BYTES,
  CONTENT_KEYS,
  Json,
  OPINION_KEYS,
  OPINION_LIMITS,
  PAIRS_MAX,
  SYLLABUS_CONTENT_MAX,
  TEXT_KEYS,
  TEXT_LIMITS,
  blankContent,
  blankOpinion,
  byteLengthOf,
  maxContent,
  maxOpinion,
  maxPairs,
  setAt,
  validContent,
  validOpinion,
  validPair,
} from '../pei-entry.fixtures';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdatePeiEntryDto,
  }) as Promise<UpdatePeiEntryDto>;
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

const only = (key: string): Json => ({ [key]: validContent()[key] });
const withPairs = (pairs: unknown): Json => ({ syllabus_adaptations: pairs });

describe('UpdatePeiEntryDto, campos parciais', () => {
  it('should accept the seven content fields together', async () => {
    const body = validContent();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(CONTENT_KEYS)('should accept a body with only %s', async (key) => {
    const body = only(key);

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept an empty body', async () => {
    await expect(validate({})).resolves.toEqual({});
  });

  it('should accept the blank form: empty texts and an empty list', async () => {
    const body = blankContent();

    await expect(validate(body)).resolves.toEqual(body);
  });
});

describe('UpdatePeiEntryDto, null não vale como ausente', () => {
  it.each(CONTENT_KEYS)('should refuse null in %s', async (key) => {
    await expect(validate({ [key]: null })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(TEXT_KEYS.map((key) => [key]))(
    'should refuse a number, a boolean, an object and an array in %s',
    async (key) => {
      for (const value of [7, true, {}, []]) {
        await expect(validate({ [key]: value })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
    },
  );
});

describe('UpdatePeiEntryDto, as mesmas regras do cadastro', () => {
  it.each(TEXT_LIMITS.map(([path, limit]) => [path, limit] as const))(
    'should refuse %s above %i characters and accept the limit',
    async (path, limit) => {
      await expect(
        validate(setAt({}, path, 'a'.repeat(limit))),
      ).resolves.toBeDefined();
      await expect(
        validate(setAt({}, path, 'a'.repeat(limit + 1))),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(TEXT_KEYS.map((key) => [key]))(
    'should refuse a NUL character in %s and accept the line breaks',
    async (key) => {
      await expect(
        validate({ [key]: 'antes\u0000depois' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({ [key]: 'linha 1\nlinha 2' }),
      ).resolves.toBeDefined();
    },
  );

  it('should trim the loose texts', async () => {
    const result = await validate({ general_notes: '  observação  ' });

    expect(result.general_notes).toBe('observação');
  });

  it('should accept 20 pairs and refuse 21', async () => {
    await expect(
      validate(withPairs(maxPairs(PAIRS_MAX))),
    ).resolves.toBeDefined();

    expect(await messagesOf(withPairs(maxPairs(PAIRS_MAX + 1)))).toEqual([
      'syllabus_adaptations deve ter no máximo 20 itens.',
    ]);
  });

  it('should accept an empty list, which clears the pairs', async () => {
    await expect(validate(withPairs([]))).resolves.toEqual({
      syllabus_adaptations: [],
    });
  });

  it.each([
    ['a string', 'texto'],
    ['a number', 7],
    ['null', null],
    ['a boolean', true],
    ['an array', [validPair()]],
  ])('should refuse %s as an item of the list', async (_name, item) => {
    await expect(validate(withPairs([item]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // Um par solto no lugar da lista passaria no ValidateNested (é um par válido),
  // e o service falharia com 500 ao percorrer o que não é lista.
  it.each([null, 'texto', 7, {}, validPair()])(
    'should refuse %p in place of the list',
    async (value) => {
      await expect(validate(withPairs(value))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('should refuse a pair without one of its two fields', async () => {
    await expect(
      validate(withPairs([{ syllabus_content: 'Frações' }])),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(withPairs([{ adaptation: 'Material concreto' }])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should refuse a blank syllabus_content, accept a blank adaptation and keep both limits', async () => {
    await expect(
      validate(withPairs([{ ...validPair(), syllabus_content: '  ' }])),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(withPairs([{ ...validPair(), adaptation: '' }])),
    ).resolves.toBeDefined();
    await expect(
      validate(
        withPairs([
          {
            ...validPair(),
            syllabus_content: 'a'.repeat(SYLLABUS_CONTENT_MAX + 1),
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      validate(
        withPairs([
          { ...validPair(), adaptation: 'a'.repeat(ADAPTATION_MAX + 1) },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should refuse a field outside the pair', async () => {
    const messages = await messagesOf(
      withPairs([{ ...validPair(), id_author: 1 }]),
    );

    expect(messages.join(' ')).toContain('id_author');
  });
});

describe('UpdatePeiEntryDto, campos fora do contrato', () => {
  // O estudante, o semestre e a disciplina identificam o registro (são a chave
  // única entre os ativos): quem errou um deles exclui o registro e cria outro,
  // em vez de trocá-lo. O autor e as datas também não mudam.
  it.each([
    ['semester', '2027.1'],
    ['subject', 'Física'],
    ['student_email', 'outro@example.com'],
    ['email', 'outro@example.com'],
    ['id', 1],
    ['id_student', 3],
    ['id_author', 9],
    ['author', { full_name: 'x' }],
    ['created_at', '2026-01-01T00:00:00.000Z'],
    ['updated_at', '2026-01-01T00:00:00.000Z'],
    ['deleted_at', '2026-01-01T00:00:00.000Z'],
  ])('should refuse %s in the body', async (field, value) => {
    const messages = await messagesOf({ [field]: value });

    expect(messages).toEqual([`property ${field} should not exist`]);
  });

  it('should refuse the identifying fields even next to valid content', async () => {
    await expect(
      validate({ ...validContent(), semester: '2027.1', subject: 'Física' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const opinionLimits = OPINION_LIMITS.map(
  ([key, limit]) => [key, limit] as const,
);
const opinionKeys = OPINION_KEYS.map((key) => [key]);
const onlyOpinion = (key: string): Json => ({ [key]: validOpinion()[key] });

const CONTROL_MESSAGE = (key: string) =>
  `${key} não pode ter caracteres de controle, exceto tabulação e quebra de linha.`;

// O parecer semestral é escrito no mesmo PATCH do conteúdo, pelos mesmos
// decoradores dos textos do PEI, e cada um dos quatro campos é opcional.
describe('UpdatePeiEntryDto, parecer semestral', () => {
  it('should accept the four opinion fields together', async () => {
    const body = validOpinion();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(opinionKeys)('should accept a body with only %s', async (key) => {
    const body = onlyOpinion(key);

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept the opinion next to the content, which the back does not forbid', async () => {
    const body = { ...validContent(), ...validOpinion() };

    await expect(validate(body)).resolves.toEqual(body);
  });

  it('should accept the blank opinion: the four texts empty', async () => {
    const body = blankOpinion();

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each(opinionKeys)('should accept the empty string in %s', async (key) => {
    await expect(validate({ [key]: '' })).resolves.toEqual({ [key]: '' });
  });

  it.each(opinionLimits)(
    'should accept %s with exactly %i characters and refuse one more, with 400',
    async (key, limit) => {
      await expect(
        validate({ [key]: 'a'.repeat(limit) }),
      ).resolves.toBeDefined();

      expect(await messagesOf({ [key]: 'a'.repeat(limit + 1) })).toEqual([
        `${key} deve ter no máximo ${limit} caracteres.`,
      ]);
    },
  );

  // O limite conta unidades UTF-16, como o .length do front e o maxLength do
  // textarea: o emoji vale 2 unidades. O MaxLength do class-validator conta o
  // par surrogate como 1 e o seletor de variação (U+FE0F) como 0, e deixava
  // passar 2000 emojis com seletor, que ocupam 6000 unidades e 14 kb.
  it.each(opinionKeys)(
    'should count the limit of %s in UTF-16 units: an emoji is 2 and the variation selector is 1',
    async (key) => {
      const message = [`${key} deve ter no máximo 2000 caracteres.`];

      expect(await messagesOf({ [key]: '\u{1F600}️'.repeat(2000) })).toEqual(
        message,
      );
      expect(await messagesOf({ [key]: '\u{1F600}'.repeat(1001) })).toEqual(
        message,
      );
      await expect(
        validate({ [key]: '\u{1F600}'.repeat(1000) }),
      ).resolves.toBeDefined();
      await expect(
        validate({ [key]: 'ã'.repeat(2000) }),
      ).resolves.toBeDefined();
    },
  );

  it('should trim the texts and count the limit after trimming', async () => {
    const padded = await validate({
      semester_progress: ` ${'a'.repeat(2000)} `,
    });
    const trimmed = await validate({ individual_sessions: '  sala 12  ' });

    expect(padded.semester_progress).toBe('a'.repeat(2000));
    expect(trimmed.individual_sessions).toBe('sala 12');
  });

  // O parecer é opcional no PATCH, mas o null não vale como ausente: chegaria ao
  // Prisma no lugar do valor (500).
  it.each(opinionKeys)('should refuse null in %s', async (key) => {
    await expect(validate({ [key]: null })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(opinionKeys)(
    'should refuse a number, a boolean, an object and an array in %s',
    async (key) => {
      for (const value of [7, true, {}, []]) {
        await expect(validate({ [key]: value })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
    },
  );

  // O PostgreSQL recusa o NUL em TEXT, e o erro subiria como 500; os demais
  // controles forjam linhas no PDF e no log. A tabulação e a quebra de linha
  // passam, porque o parecer tem mais de uma linha.
  it.each(opinionKeys)(
    'should refuse the control characters in %s and accept line breaks and tabs',
    async (key) => {
      for (const value of [
        'antes\u0000depois',
        'a\u0007b',
        '\u001b[31mvermelho',
        'a\u007fb',
        'a\u0085b',
        'a\u000bb',
        'a\u000cb',
      ]) {
        expect(await messagesOf({ [key]: value })).toEqual([
          CONTROL_MESSAGE(key),
        ]);
      }

      await expect(
        validate({ [key]: 'linha 1\nlinha 2\r\n\tlinha 3' }),
      ).resolves.toBeDefined();
    },
  );

  // O surrogate solto (um \uD800 sem o par) faz o PostgreSQL recusar o texto, e
  // o erro subiria como 500. O par de verdade (um emoji) continua valendo.
  it.each(opinionKeys)(
    'should refuse a lone surrogate in %s, with 400 and not 500, and accept an emoji',
    async (key) => {
      for (const value of ['a\uD800b', 'a\uDC00b', 'texto\uD83D']) {
        expect(await messagesOf({ [key]: value })).toEqual([
          CONTROL_MESSAGE(key),
        ]);
      }

      await expect(validate({ [key]: 'Evoluiu 🎨' })).resolves.toBeDefined();
    },
  );
});

// O body parser do Express recusa acima de 100 kb com 413. O front grava o
// conteúdo e o parecer em formulários separados, então cada PATCH leva só os
// sete campos de conteúdo ou só os quatro do parecer.
describe('UpdatePeiEntryDto, tamanho do corpo contra os 100 kb do body parser', () => {
  it('should keep the body of the content form under the limit, with every text at its maximum and 20 pairs', async () => {
    await expect(validate(maxContent())).resolves.toBeDefined();
    expect(byteLengthOf(maxContent())).toBeLessThan(BODY_LIMIT_BYTES);
  });

  it('should keep the body of the opinion form under the limit, with the four texts at their maximum', async () => {
    await expect(validate(maxOpinion())).resolves.toBeDefined();
    expect(byteLengthOf(maxOpinion())).toBeLessThan(BODY_LIMIT_BYTES);
  });

  // Os onze campos no limite, em "ã" (2 bytes), ocupam uns 101 mil dos 102,4 mil
  // bytes do limite: cabem, mas sobra pouco mais de 1 kb, e um limite maior ou um
  // campo novo estoura o corpo. Em caracteres de 3 bytes (CJK) nem o conteúdo
  // sozinho cabe. Por isso o front nunca envia os onze juntos.
  it('should keep the eleven fields together under the limit, though the front sends them apart', () => {
    expect(byteLengthOf({ ...maxContent(), ...maxOpinion() })).toBeLessThan(
      BODY_LIMIT_BYTES,
    );
  });
});
