import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { createValidationPipe } from 'src/common/validation-pipe';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

// Sem roles o cadastro cria estudante, que precisa de matrícula e curso.
const base = {
  full_name: 'Usuário de Teste',
  email: 'usuario@edutrace.com',
  password: 'senhaSegura123',
  enrollment_number: '20261TADS0012',
  course: 'Análise e Desenvolvimento de Sistemas',
};

function instance(cpf: unknown) {
  return plainToInstance(CreateUserDto, { ...base, cpf });
}

function validate(cpf: unknown) {
  return validateSync(instance(cpf));
}

describe('CreateUserDto, campo cpf', () => {
  it('should accept a cpf with correct check digits', () => {
    expect(validate('01234567890')).toHaveLength(0);
  });

  it('should accept a masked cpf and keep only the digits', () => {
    const dto = instance('012.345.678-90');

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.cpf).toBe('01234567890');
  });

  it('should keep only the digits of a cpf typed with spaces', () => {
    const dto = instance(' 012 345 678 90 ');

    expect(dto.cpf).toBe('01234567890');
  });

  it('should reject a cpf with wrong check digits', () => {
    const errors = validate('01234567891');

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('cpf');
    expect(errors[0].constraints).toEqual({
      isCpf: 'O campo CPF deve ser um CPF válido.',
    });
  });

  it('should reject a repeated digit sequence', () => {
    expect(validate('00000000000')).toHaveLength(1);
    expect(validate('11111111111')).toHaveLength(1);
  });

  it('should reject letters', () => {
    expect(validate('abcdefghijk')).toHaveLength(1);
  });

  it('should reject a masked cpf whose digits are invalid', () => {
    expect(validate('012.345.678-91')).toHaveLength(1);
  });

  it('should reject an empty cpf', () => {
    const errors = validate('');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });
});

describe('CreateUserDto, campo roles', () => {
  const valid = { ...base, cpf: '01234567890' };
  const errorsOf = (roles: unknown) =>
    validateSync(plainToInstance(CreateUserDto, { ...valid, roles }));

  it.each([
    [[1]],
    [[2]],
    [[3]],
    [[4]],
    [[5]],
    [[6]],
    [[3, 4]],
    [[5, 6]],
    [[3, 4, 5, 6]],
    [[6, 3]],
  ])('should accept the roles %j', (roles) => {
    expect(errorsOf(roles)).toHaveLength(0);
  });

  it('should keep the roles in ascending order', () => {
    const dto = plainToInstance(CreateUserDto, {
      ...valid,
      roles: [6, 3, 5],
    });

    expect(dto.roles).toEqual([3, 5, 6]);
  });

  it.each([
    ['empty', []],
    ['out of range', [99]],
    ['zero', [0]],
    ['negative', [-1]],
    ['decimal', [1.5]],
    ['text', ['3']],
    ['not a list', 3],
    ['repeated', [3, 3]],
    ['the Administrator with another role', [1, 3]],
    ['the student with another role', [2, 6]],
    ['the Administrator and the student', [1, 2]],
    ['an unknown role among valid ones', [3, 7]],
  ])('should refuse the roles %s', (_case, roles) => {
    const errors = errorsOf(roles);

    expect(errors.map((error) => error.property)).toEqual(['roles']);
    expect(errors[0].constraints).toEqual({
      isRoles: expect.any(String),
    });
  });

  it('should tell why the Administrator cannot combine', () => {
    expect(errorsOf([1, 3])[0].constraints).toEqual({
      isRoles:
        'Administrador e Estudante/Família não combinam com outros papéis.',
    });
  });

  it('should refuse the old id_level field when the pipe forbids unknown fields', () => {
    expect(() =>
      createValidationPipe().transform(
        { ...valid, id_level: 3 },
        { type: 'body', metatype: CreateUserDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CreateUserDto, campo email', () => {
  // O link de definição de senha vai para o e-mail cadastrado, e o nodemailer
  // trata vírgula como separador de destinatários.
  it.each(['aluno.a@example.test,aluno.b@example.test', 'nao e email'])(
    'should refuse %p',
    (email) => {
      const errors = validateSync(
        plainToInstance(CreateUserDto, {
          ...base,
          cpf: '01234567890',
          email,
        }),
      );

      expect(errors.map((error) => error.property)).toEqual(['email']);
      expect(errors[0].constraints).toEqual({
        isEmail: 'O campo email deve ser um e-mail válido.',
      });
    },
  );
});

// Matrícula e curso identificam o estudante nos documentos da Resolução
// CONSUP/IFPE nº 315/2025. A recusa de quem não é estudante e envia os campos
// fica no UsersService (users.service.spec.ts), que também decide o nível final.
describe('CreateUserDto, matrícula e curso do estudante', () => {
  const student = { ...base, cpf: '01234567890' };

  function invalidFields(data: object) {
    return validateSync(plainToInstance(CreateUserDto, data)).map(
      (error) => error.property,
    );
  }

  it.each([undefined, null, [2]])(
    'should accept the student with roles %p',
    (roles) => {
      expect(invalidFields({ ...student, roles })).toEqual([]);
    },
  );

  it.each(['enrollment_number', 'course'])(
    'should require %s when the level is student',
    (field) => {
      const { [field]: _omitted, ...withoutField } = student as Record<
        string,
        unknown
      >;

      expect(invalidFields(withoutField)).toEqual([field]);
      expect(invalidFields({ ...withoutField, roles: [2] })).toEqual([field]);
      expect(invalidFields({ ...withoutField, roles: null })).toEqual([field]);
    },
  );

  it.each([[1], [3], [4], [5], [6], [3, 6]])(
    'should not require matrícula and curso for the roles %j',
    (...roles) => {
      const { enrollment_number, course, ...withoutFields } = student;

      expect(invalidFields({ ...withoutFields, roles })).toEqual([]);
    },
  );

  it('should trim the matrícula and keep it in upper case', () => {
    const dto = plainToInstance(CreateUserDto, {
      ...student,
      enrollment_number: '  2026.1-ab/01  ',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.enrollment_number).toBe('2026.1-AB/01');
  });

  it('should accept a matrícula with the maximum of 30 characters', () => {
    expect(
      invalidFields({ ...student, enrollment_number: 'A'.repeat(30) }),
    ).toEqual([]);
  });

  it.each([
    '',
    '   ',
    'AB 12',
    'AB_12',
    'AB@12',
    "AB';--",
    'MATRÍCULA1',
    'A'.repeat(31),
    123456,
    ['2026'],
  ])('should refuse the matrícula %p', (enrollment_number) => {
    expect(invalidFields({ ...student, enrollment_number })).toEqual([
      'enrollment_number',
    ]);
  });

  it('should trim the course', () => {
    const dto = plainToInstance(CreateUserDto, {
      ...student,
      course: '  Licenciatura em Matemática  ',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.course).toBe('Licenciatura em Matemática');
  });

  it('should accept a course with the maximum of 150 characters', () => {
    expect(invalidFields({ ...student, course: 'C'.repeat(150) })).toEqual([]);
  });

  it.each(['', '   ', 'C'.repeat(151), 42, ['TADS']])(
    'should refuse the course %p',
    (course) => {
      expect(invalidFields({ ...student, course })).toEqual(['course']);
    },
  );

  it('should accept a course with accents, digits and punctuation', () => {
    expect(
      invalidFields({
        ...student,
        course: 'Técnico em Informática (Integrado) - 2º ano, turno A/B',
      }),
    ).toEqual([]);
  });

  // Quebra de linha, tabulação, NUL, DEL e controles C1 entram na linha da
  // tabela e na célula do CSV, e quebram o log e o documento que repetem o
  // valor. As pontas já saem aparadas pelo trim; o que sobra é o meio.
  it.each([
    'Análise\nSistemas',
    'Análise\r\nSistemas',
    'Análise\tSistemas',
    'Análise\u0000Sistemas',
    'Análise\u0007',
    'Análise\u007fSistemas',
    'Análise\u0085Sistemas',
  ])('should refuse the course %j with control characters', (course) => {
    expect(invalidFields({ ...student, course })).toEqual(['course']);
  });

  it('should tell in Portuguese that the course cannot have control characters', () => {
    const errors = validateSync(
      plainToInstance(CreateUserDto, {
        ...student,
        course: 'Análise\nSistemas',
      }),
    );

    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toEqual([
      'O campo course não deve ter caracteres de controle.',
    ]);
  });
});

// O responsável pedagógico deixou de ser um texto do cadastro e passou a ser um
// vínculo, definido por PATCH /students/:email/pedagogical-manager. O corpo do
// cadastro com o campo antigo ou com os novos é recusado, e não gravado.
describe('CreateUserDto, responsável pedagógico', () => {
  // O cadastro não recebe senha: o pipe recusaria o campo da base.
  const { password, ...fields } = base;
  const student = { ...fields, cpf: '01234567890' };

  function validate(body: object) {
    return createValidationPipe().transform(body, {
      type: 'body',
      metatype: CreateUserDto,
    });
  }

  it('should accept a body without the pedagogical manager', async () => {
    await expect(validate(student)).resolves.toBeInstanceOf(CreateUserDto);
  });

  it.each([
    ['pedagogical_manager', 'Fulano'],
    ['pedagogical_manager_id', 3],
    ['pedagogical_manager_legacy', 'Fulano'],
    ['external_manager_name', 'Maria da Silva'],
    ['external_manager_phone', '81999998888'],
    ['external_manager_cpf', '01234567890'],
  ])('should refuse %s with 400', async (field, value) => {
    await expect(
      validate({ ...student, [field]: value }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
