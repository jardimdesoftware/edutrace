import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdatePeiEntryDto } from 'src/pei-entries/dto/update-pei-entry.dto';
import {
  ADAPTATION_MAX,
  CONTENT_KEYS,
  Json,
  PAIRS_MAX,
  SYLLABUS_CONTENT_MAX,
  TEXT_KEYS,
  TEXT_LIMITS,
  blankContent,
  maxPairs,
  setAt,
  validContent,
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
