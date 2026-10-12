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
  it.each([1, 2, 3, 4])('should accept the level %s', async (id_level) => {
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
