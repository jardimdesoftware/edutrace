import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from 'src/common/validation-pipe';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';

function validate(value: object) {
  return createValidationPipe().transform(value, {
    type: 'body',
    metatype: UpdateUserDto,
  });
}

describe('UpdateUserDto, campo id_level', () => {
  it.each([1, 2, 3, 4, 5])('should accept the level %s', async (id_level) => {
    await expect(validate({ id_level })).resolves.toEqual({ id_level });
  });

  it('should accept a body without id_level', async () => {
    await expect(validate({ full_name: 'Nome' })).resolves.toEqual({
      full_name: 'Nome',
    });
  });

  // 1.5 era gravado truncado como 1 (Administrador); 99, -1 e null chegavam ao
  // banco e respondiam 500.
  it.each([1.5, 99, -1, 0, null, '1'])(
    'should refuse %p with 400',
    async (id_level) => {
      await expect(validate({ id_level })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});

// UsersService.update grava só o nome e o nível. Os demais campos do cadastro
// são recusados, em vez de responder 200 sem alterar nada.
describe('UpdateUserDto, campos do cadastro', () => {
  it.each([
    ['email', 'outro@example.com'],
    ['cpf', '01234567890'],
    ['affliation', 'Outra'],
    ['pedagogical_manager', 'Outro'],
    ['pedagogical_manager_id', 3],
    ['pedagogical_manager_legacy', 'Outro'],
    ['external_manager_name', 'Maria da Silva'],
    ['external_manager_phone', '81999998888'],
    ['external_manager_cpf', '01234567890'],
  ])('should refuse %s with 400', async (field, value) => {
    await expect(validate({ [field]: value })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should accept the name', async () => {
    await expect(validate({ full_name: 'Novo Nome' })).resolves.toEqual({
      full_name: 'Novo Nome',
    });
  });
});

// O Administrador corrige matrícula e curso do estudante. O DTO só confere o
// formato; saber se a conta é de estudante depende do nível dela e fica no
// UsersService.
describe('UpdateUserDto, matrícula e curso', () => {
  it('should accept both fields', async () => {
    await expect(
      validate({ enrollment_number: '20261TADS0012', course: 'ADS' }),
    ).resolves.toEqual({ enrollment_number: '20261TADS0012', course: 'ADS' });
  });

  it('should accept only one of them', async () => {
    await expect(validate({ course: 'ADS' })).resolves.toEqual({
      course: 'ADS',
    });
    await expect(
      validate({ enrollment_number: '20261TADS0012' }),
    ).resolves.toEqual({ enrollment_number: '20261TADS0012' });
  });

  it('should trim the matrícula, keep it in upper case and trim the course', async () => {
    await expect(
      validate({ enrollment_number: ' 2026.1-ab/01 ', course: ' ADS ' }),
    ).resolves.toEqual({ enrollment_number: '2026.1-AB/01', course: 'ADS' });
  });

  // Os dois campos são obrigatórios do estudante: null ou vazio não limpa o
  // valor gravado.
  it.each([
    ['enrollment_number', null],
    ['enrollment_number', ''],
    ['enrollment_number', '   '],
    ['enrollment_number', 'AB 12'],
    ['enrollment_number', 'AB_12'],
    ['enrollment_number', 'A'.repeat(31)],
    ['enrollment_number', 123],
    ['course', null],
    ['course', ''],
    ['course', '   '],
    ['course', 'C'.repeat(151)],
    ['course', 42],
    ['course', 'Análise\nSistemas'],
    ['course', 'Análise\tSistemas'],
    ['course', 'Análise\u0000Sistemas'],
    ['course', 'Análise\u007fSistemas'],
    ['course', 'Análise\u0085Sistemas'],
  ])('should refuse %s = %j with 400', async (field, value) => {
    await expect(validate({ [field]: value })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should accept a course with accents, digits and punctuation', async () => {
    const course = 'Técnico em Informática (Integrado) - 2º ano, turno A/B';

    await expect(validate({ course })).resolves.toEqual({ course });
  });
});

// O Administrador define o limite de atendimentos do Profissional NAPNE. O DTO
// confere o formato; saber se a conta é de nível 5 fica no UsersService.
describe('UpdateUserDto, service_capacity', () => {
  it.each([0, 1, 3, 200])('should accept %s', async (service_capacity) => {
    await expect(validate({ service_capacity })).resolves.toEqual({
      service_capacity,
    });
  });

  it('should accept a body without service_capacity', async () => {
    await expect(validate({ full_name: 'Nome' })).resolves.toEqual({
      full_name: 'Nome',
    });
  });

  it.each([-1, 201, 1000, 1.5, '3', null, true, 'abc'])(
    'should refuse %p with 400',
    async (service_capacity) => {
      await expect(validate({ service_capacity })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});
