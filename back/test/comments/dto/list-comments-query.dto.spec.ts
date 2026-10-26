import { BadRequestException } from '@nestjs/common';
import { ListCommentsQueryDto } from 'src/comments/dto/list-comments-query.dto';
import { createValidationPipe } from 'src/common/validation-pipe';

const pipe = createValidationPipe();

function transform(query: Record<string, unknown>) {
  return pipe.transform(query, {
    type: 'query',
    metatype: ListCommentsQueryDto,
  }) as Promise<ListCommentsQueryDto>;
}

async function messagesOf(query: Record<string, unknown>) {
  const error = await transform(query).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  expect(error).toBeInstanceOf(BadRequestException);

  return (error as BadRequestException).getResponse() as {
    message: string[];
  };
}

describe('ListCommentsQueryDto', () => {
  it('should accept an empty query and leave every field absent', async () => {
    const result = await transform({});

    expect(result).toBeInstanceOf(ListCommentsQueryDto);
    expect({ ...result }).toEqual({});
  });

  it('should convert every field to its type', async () => {
    const result = await transform({
      q: 'ação',
      author: '7',
      area: '3',
      type: 'CLASS_COUNCIL_REPORT',
      from: '2026-10-17T03:00:00.000Z',
      to: '2026-10-18T03:00:00.000Z',
      edited: 'true',
      cursor: '123',
      limit: '25',
    });

    expect({ ...result }).toEqual({
      q: 'ação',
      author: 7,
      area: 3,
      type: 'CLASS_COUNCIL_REPORT',
      from: '2026-10-17T03:00:00.000Z',
      to: '2026-10-18T03:00:00.000Z',
      edited: true,
      cursor: 123,
      limit: 25,
    });
  });

  describe('q', () => {
    it('should trim the term', async () => {
      expect((await transform({ q: '  acao  ' })).q).toBe('acao');
    });

    it('should accept an empty term, which means no filter', async () => {
      expect((await transform({ q: '' })).q).toBe('');
      expect((await transform({ q: '   ' })).q).toBe('');
    });

    it('should accept exactly 200 characters and reject 201', async () => {
      await expect(transform({ q: 'a'.repeat(200) })).resolves.toBeDefined();
      expect(await messagesOf({ q: 'a'.repeat(201) })).toMatchObject({
        message: ['q deve ter no máximo 200 caracteres.'],
      });
    });

    it('should count the 200 characters in UTF-16 units, like the textarea does', async () => {
      await expect(transform({ q: '😀'.repeat(100) })).resolves.toBeDefined();
      await expect(transform({ q: '😀'.repeat(101) })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not count the spaces trimmed at the ends against the limit', async () => {
      await expect(
        transform({ q: ` ${'a'.repeat(200)} ` }),
      ).resolves.toBeDefined();
    });

    it.each([
      ['NUL', 'a\u0000b'],
      ['a tab inside the term', 'a\tb'],
      ['a line feed inside the term', 'a\nb'],
      ['a carriage return inside the term', 'a\rb'],
      ['U+0085, a C1 control', 'a\u0085b'],
      ['DEL', 'a\u007fb'],
      ['a lone surrogate', 'a\uD800b'],
    ])('should reject %s', async (_, q) => {
      expect(await messagesOf({ q })).toMatchObject({
        message: ['q não pode ter caracteres de controle.'],
      });
    });

    describe('marcas combinantes seguidas', () => {
      const message = 'q não pode ter mais de 30 acentos ou marcas seguidos.';
      const ACUTE = '́';
      const DOT_BELOW = '̖';

      it('should accept 30 marks in a row', async () => {
        await expect(
          transform({ q: `a${ACUTE.repeat(30)}` }),
        ).resolves.toBeDefined();
      });

      it('should reject 31 marks in a row', async () => {
        expect(await messagesOf({ q: `a${ACUTE.repeat(31)}` })).toMatchObject({
          message: [message],
        });
      });

      it('should count marks of different kinds as one run', async () => {
        await expect(
          transform({ q: `a${ACUTE.repeat(15)}${DOT_BELOW.repeat(15)}` }),
        ).resolves.toBeDefined();
        expect(
          await messagesOf({
            q: `a${ACUTE.repeat(15)}${DOT_BELOW.repeat(16)}`,
          }),
        ).toMatchObject({ message: [message] });
      });

      it('should reject a term made only of marks above the limit', async () => {
        expect(await messagesOf({ q: ACUTE.repeat(31) })).toMatchObject({
          message: [message],
        });
      });

      it('should accept Portuguese text written in the composed and in the decomposed form', async () => {
        const text = 'Ação, atenção e coordenação';

        await expect(
          transform({ q: text.normalize('NFC') }),
        ).resolves.toBeDefined();
        await expect(
          transform({ q: text.normalize('NFD') }),
        ).resolves.toBeDefined();
      });
    });

    it('should accept accents, symbols and emoji', async () => {
      await expect(
        transform({ q: 'Ação 100% a_b 😀 "x" <y>' }),
      ).resolves.toBeDefined();
    });

    it('should reject a repeated parameter, which arrives as a list', async () => {
      expect((await messagesOf({ q: ['a', 'b'] })).message).toContain(
        'q deve ser uma string.',
      );
    });
  });

  describe.each(['author', 'cursor'] as const)('%s', (field) => {
    const message = `${field} deve ser um número inteiro positivo.`;

    it.each([
      ['1', 1],
      ['7', 7],
      ['123456', 123456],
      ['2147483647', 2147483647],
    ])('should accept %s as the integer it spells', async (text, expected) => {
      expect((await transform({ [field]: text }))[field]).toBe(expected);
    });

    it.each([
      ['an exponent', '1e3'],
      ['an uppercase exponent', '1E3'],
      ['a hexadecimal', '0x10'],
      ['a binary', '0b10'],
      ['a leading space', ' 5'],
      ['a trailing space', '5 '],
      ['a plus sign', '+5'],
      ['a minus sign', '-5'],
      ['zero', '0'],
      ['a leading zero', '05'],
      ['a decimal', '1.5'],
      ['a decimal that is an integer', '1.0'],
      ['text', 'abc'],
      ['an empty string', ''],
      ['a value above the largest INTEGER of PostgreSQL', '2147483648'],
      ['eleven digits', '12345678901'],
      ['Infinity', 'Infinity'],
      ['a thousands separator', '1,000'],
      ['a repeated parameter', ['1', '2']],
    ])('should reject %s', async (_, value) => {
      expect(await messagesOf({ [field]: value })).toMatchObject({
        message: [message],
      });
    });
  });

  describe('a value that is already a number, not the text of a query string', () => {
    it.each([
      ['limit', 0],
      ['limit', -1],
      ['limit', 51],
      ['limit', 1.5],
      ['author', 0],
      ['author', -7],
      ['cursor', 0],
      ['cursor', -7],
      ['cursor', 2147483648],
    ])('should reject %s = %d', async (field, value) => {
      await expect(transform({ [field]: value })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('limit', () => {
    const message = 'limit deve ser um número inteiro de 1 a 50.';

    it.each([
      ['1', 1],
      ['20', 20],
      ['50', 50],
    ])('should accept %s', async (text, expected) => {
      expect((await transform({ limit: text })).limit).toBe(expected);
    });

    it.each([
      ['zero', '0'],
      ['51', '51'],
      ['100', '100'],
      ['a negative', '-1'],
      ['an exponent', '1e1'],
      ['a hexadecimal', '0x10'],
      ['a leading space', ' 5'],
      ['a leading zero', '05'],
      ['a decimal', '10.5'],
      ['text', 'muitos'],
      ['an empty string', ''],
      ['a repeated parameter', ['5', '6']],
    ])('should reject %s', async (_, value) => {
      expect(await messagesOf({ limit: value })).toMatchObject({
        message: [message],
      });
    });
  });

  describe('area', () => {
    it.each([
      ['1', 1],
      ['3', 3],
      ['4', 4],
      ['5', 5],
      ['6', 6],
    ])('should accept %s', async (text, expected) => {
      expect((await transform({ area: text })).area).toBe(expected);
    });

    it.each([
      ['2, the student level, which does not write', '2'],
      ['zero', '0'],
      ['7', '7'],
      ['a leading zero', '03'],
      ['an exponent', '3e0'],
      ['a decimal', '3.0'],
      ['text', 'saude'],
      ['an empty string', ''],
      ['a repeated parameter', ['3', '4']],
    ])('should reject %s', async (_, value) => {
      expect(await messagesOf({ area: value })).toMatchObject({
        message: ['area deve ser 1, 3, 4, 5 ou 6.'],
      });
    });
  });

  describe('type', () => {
    it.each(['NOTE', 'CLASS_COUNCIL_REPORT'])(
      'should accept %s',
      async (type) => {
        expect((await transform({ type })).type).toBe(type);
      },
    );

    it.each([
      ['a value outside the enum', 'OTHER'],
      ['the name in lower case', 'note'],
      ['an empty string', ''],
      ['a number', '1'],
      ['a key of Object.prototype', 'constructor'],
      ['a repeated parameter', ['NOTE', 'CLASS_COUNCIL_REPORT']],
    ])('should reject %s', async (_, type) => {
      expect(await messagesOf({ type })).toMatchObject({
        message: ['type deve ser NOTE ou CLASS_COUNCIL_REPORT.'],
      });
    });
  });

  describe('edited', () => {
    it('should convert true and false', async () => {
      expect((await transform({ edited: 'true' })).edited).toBe(true);
      expect((await transform({ edited: 'false' })).edited).toBe(false);
    });

    it.each([
      ['yes', 'yes'],
      ['an uppercase true', 'TRUE'],
      ['a capitalized True', 'True'],
      ['1', '1'],
      ['0', '0'],
      ['an empty string', ''],
      ['a repeated parameter', ['true', 'false']],
    ])('should reject %s', async (_, edited) => {
      expect(await messagesOf({ edited })).toMatchObject({
        message: ['edited deve ser true ou false.'],
      });
    });
  });

  describe.each(['from', 'to'] as const)('%s', (field) => {
    const message = `${field} deve ser uma data e hora ISO 8601 com fuso, como 2026-10-17T03:00:00.000Z.`;

    it.each([
      ['UTC with milliseconds', '2026-10-17T03:00:00.000Z'],
      ['UTC without fraction', '2026-10-17T03:00:00Z'],
      ['a negative offset', '2026-10-17T00:00:00-03:00'],
      ['a positive offset', '2026-10-17T05:30:00+05:30'],
      ['a long fraction', '2026-10-17T03:00:00.123456789Z'],
      ['the 29th of February of a leap year', '2028-02-29T00:00:00Z'],
      ['the last second of the day', '2026-10-17T23:59:59.999Z'],
    ])('should accept %s', async (_, value) => {
      expect((await transform({ [field]: value }))[field]).toBe(value);
    });

    it.each([
      ['a date without time', '2026-10-17'],
      ['a date and time without zone', '2026-10-17T10:00:00'],
      ['a date and time without seconds', '2026-10-17T10:00Z'],
      ['a Brazilian date', '17/10/2026'],
      ['text', 'ontem'],
      ['an empty string', ''],
      ['a timestamp in milliseconds', '1792206000000'],
      ['a space instead of the T', '2026-10-17 10:00:00Z'],
      ['a lower case t', '2026-10-17t10:00:00Z'],
      ['a lower case z', '2026-10-17T10:00:00z'],
      ['an offset without the colon', '2026-10-17T10:00:00+0300'],
      ['an offset with hours only', '2026-10-17T10:00:00+03'],
      ['a week date', '2026-W42-6T10:00:00Z'],
      ['an ordinal date', '2026-290T10:00:00Z'],
      ['the basic format', '20261017T100000Z'],
      ['the 30th of February', '2026-02-30T00:00:00Z'],
      ['the 29th of February of a common year', '2026-02-29T00:00:00Z'],
      ['the 31st of April', '2026-04-31T00:00:00Z'],
      ['month 13', '2026-13-01T00:00:00Z'],
      ['month 00', '2026-00-10T00:00:00Z'],
      ['day 00', '2026-10-00T00:00:00Z'],
      ['hour 24', '2026-10-17T24:00:00Z'],
      ['minute 60', '2026-10-17T10:60:00Z'],
      ['second 60', '2026-10-17T10:00:60Z'],
      ['an offset of 24 hours', '2026-10-17T10:00:00+24:00'],
      ['a leading space', ' 2026-10-17T10:00:00Z'],
      ['a trailing space', '2026-10-17T10:00:00Z '],
      ['year 0000, which PostgreSQL does not have', '0000-01-01T00:00:00Z'],
      ['a year below 1000', '0999-12-31T00:00:00Z'],
      ['a year that falls after 9999 once in UTC', '9999-12-31T23:59:59-01:00'],
      ['a fraction with ten digits', '2026-10-17T10:00:00.1234567890Z'],
      ['a fraction with no digit', '2026-10-17T10:00:00.Z'],
      [
        'a repeated parameter',
        ['2026-10-17T10:00:00Z', '2026-10-18T10:00:00Z'],
      ],
    ])('should reject %s', async (_, value) => {
      expect(await messagesOf({ [field]: value })).toMatchObject({
        message: [message],
      });
    });
  });

  describe('unknown parameters', () => {
    it.each([
      ['an unknown name', { foo: '1' }],
      ['a name that differs in case', { Author: '1' }],
      ['the old client-side name busca', { busca: 'acao' }],
      ['a model column', { id_author: '1' }],
      ['a body field', { id_user: '10' }],
    ])('should answer 400 to %s', async (_, query) => {
      const { message } = await messagesOf(query);

      expect(message).toHaveLength(1);
      expect(message[0]).toMatch(/should not exist/);
    });

    it.each(['constructor', '__proto__'])(
      'should drop the %s key without copying it to the DTO',
      async (name) => {
        const query = JSON.parse(`{"${name}": "1", "limit": "5"}`);

        const result = await transform(query);

        expect(result).toBeInstanceOf(ListCommentsQueryDto);
        expect(Object.hasOwn(result, name)).toBe(false);
        expect(result.limit).toBe(5);
      },
    );

    it('should answer 400 even when the other parameters are valid', async () => {
      await expect(
        transform({ q: 'acao', limit: '5', foo: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('should report every invalid parameter at once', async () => {
    const { message } = await messagesOf({ limit: '0', edited: 'yes' });

    expect(message).toEqual(
      expect.arrayContaining([
        'limit deve ser um número inteiro de 1 a 50.',
        'edited deve ser true ou false.',
      ]),
    );
    expect(message).toHaveLength(2);
  });
});
