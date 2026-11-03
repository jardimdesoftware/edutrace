import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { SetPedagogicalManagerDto } from 'src/students/dto/set-pedagogical-manager.dto';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: SetPedagogicalManagerDto,
  }) as Promise<SetPedagogicalManagerDto>;
}

const EXTERNAL = {
  kind: 'EXTERNAL',
  name: 'Maria da Silva',
  phone: '81999998888',
  cpf: '01234567890',
};

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

describe('SetPedagogicalManagerDto, kind', () => {
  it.each([{ kind: 'SERVER', user_id: 3 }, EXTERNAL, { kind: 'NONE' }])(
    'should accept %p',
    async (body) => {
      await expect(validate(body)).resolves.toEqual(body);
    },
  );

  it.each([{}, { kind: 'server', user_id: 3 }, { kind: 'OTHER' }, { kind: 1 }])(
    'should refuse %p with 400',
    async (body) => {
      await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});

describe('SetPedagogicalManagerDto, kind SERVER', () => {
  it('should refuse a body without user_id', async () => {
    await expect(validate({ kind: 'SERVER' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([0, -1, 1.5, '3', null, 2147483648])(
    'should refuse user_id %p with 400',
    async (user_id) => {
      await expect(
        validate({ kind: 'SERVER', user_id }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([
    ['name', 'Maria da Silva'],
    ['phone', '81999998888'],
    ['cpf', '01234567890'],
  ])(
    'should refuse the field %s of the external kind',
    async (field, value) => {
      const messages = await messagesOf({
        kind: 'SERVER',
        user_id: 3,
        [field]: value,
      });

      expect(messages).toEqual([
        `O campo ${field} só pode ser informado com kind EXTERNAL.`,
      ]);
    },
  );

  it('should refuse a null field of the external kind instead of ignoring it', async () => {
    await expect(
      validate({ kind: 'SERVER', user_id: 3, name: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SetPedagogicalManagerDto, kind EXTERNAL', () => {
  it.each(['name', 'phone', 'cpf'])(
    'should refuse a body without %s',
    async (field) => {
      const { [field as keyof typeof EXTERNAL]: _removed, ...body } = EXTERNAL;

      await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('should refuse the user_id of the server kind', async () => {
    const messages = await messagesOf({ ...EXTERNAL, user_id: 3 });

    expect(messages).toEqual([
      'O campo user_id só pode ser informado com kind SERVER.',
    ]);
  });

  describe('name', () => {
    it('should trim the name', async () => {
      await expect(
        validate({ ...EXTERNAL, name: '  Maria da Silva  ' }),
      ).resolves.toMatchObject({ name: 'Maria da Silva' });
    });

    it.each(['', '   ', '\t'])(
      'should refuse the empty name %j',
      async (name) => {
        await expect(validate({ ...EXTERNAL, name })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it('should accept a name with 150 characters', async () => {
      await expect(
        validate({ ...EXTERNAL, name: 'a'.repeat(150) }),
      ).resolves.toBeDefined();
    });

    it('should refuse a name with 151 characters', async () => {
      await expect(
        validate({ ...EXTERNAL, name: 'a'.repeat(151) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      'Maria\nSilva',
      'Maria\u0000Silva',
      'Maria\tSilva',
      'Maria\u007f',
    ])('should refuse the control character in %j', async (name) => {
      await expect(validate({ ...EXTERNAL, name })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // Cf (formato, como o U+202E que inverte o sentido do texto e esconde parte
    // do nome em tabela e CSV), Zl (U+2028) e Zp (U+2029) quebram ou forjam a
    // linha onde o nome é mostrado, como os controles da categoria Cc.
    it.each([
      ['U+202E, inversão do sentido do texto', 'Maria‮Silva'],
      ['U+202E no início do nome', '‮Maria da Silva'],
      ['U+2028, separador de linha', 'Maria Silva'],
      ['U+2029, separador de parágrafo', 'Maria Silva'],
      ['U+200B, espaço de largura zero', 'Maria​Silva'],
    ])('should refuse the invisible format character %s', async (_, name) => {
      await expect(validate({ ...EXTERNAL, name })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it.each([
      'José Ângelo D’Ávila',
      'Zoë Müller-Ñandú',
      'José da Silva',
      'João Pedro O’Neill Jr.',
    ])('should accept the valid name with accents %j', async (name) => {
      await expect(validate({ ...EXTERNAL, name })).resolves.toMatchObject({
        name,
      });
    });

    it.each([123, null, ['Maria']])('should refuse %p', async (name) => {
      await expect(validate({ ...EXTERNAL, name })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('phone', () => {
    it.each([
      ['8133334444', '8133334444'],
      ['81999998888', '81999998888'],
      ['(81) 99999-8888', '81999998888'],
      ['(81) 3333-4444', '8133334444'],
    ])('should keep only the digits of %j', async (phone, digits) => {
      await expect(validate({ ...EXTERNAL, phone })).resolves.toMatchObject({
        phone: digits,
      });
    });

    it.each([
      '',
      '123456789',
      '123456789012',
      'abcdefghijk',
      '+55 81 99999-8888',
    ])('should refuse the phone %j', async (phone) => {
      await expect(validate({ ...EXTERNAL, phone })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it.each([81999998888, null])('should refuse %p', async (phone) => {
      await expect(validate({ ...EXTERNAL, phone })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cpf', () => {
    it('should keep only the digits of a masked cpf', async () => {
      await expect(
        validate({ ...EXTERNAL, cpf: '012.345.678-90' }),
      ).resolves.toMatchObject({ cpf: '01234567890' });
    });

    it.each(['01234567891', '00000000000', '1234', 'abcdefghijk', ''])(
      'should refuse the cpf %j with 400',
      async (cpf) => {
        await expect(validate({ ...EXTERNAL, cpf })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it.each([1234567890, null])('should refuse %p', async (cpf) => {
      await expect(validate({ ...EXTERNAL, cpf })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

describe('SetPedagogicalManagerDto, kind NONE', () => {
  it.each([
    ['user_id', 3],
    ['name', 'Maria da Silva'],
    ['phone', '81999998888'],
    ['cpf', '01234567890'],
  ])('should refuse the field %s', async (field, value) => {
    await expect(
      validate({ kind: 'NONE', [field]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SetPedagogicalManagerDto, campos fora do contrato', () => {
  it.each([
    ['pedagogical_manager_id', 3],
    ['external_manager_name', 'Maria'],
    ['id', 1],
    ['email', 'outro@example.com'],
  ])('should refuse %s with 400', async (field, value) => {
    await expect(
      validate({ kind: 'NONE', [field]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
