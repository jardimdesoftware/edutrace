import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteUserDto } from 'src/users/dto/delete-user.dto';

const errorsOf = async (plain: object) =>
  validate(plainToInstance(DeleteUserDto, plain));

describe('DeleteUserDto', () => {
  it('should accept an empty body, which the open window of confirmation allows', async () => {
    await expect(errorsOf({})).resolves.toHaveLength(0);
  });

  it('should accept the password with or without remember', async () => {
    await expect(errorsOf({ currentPassword: 'senha' })).resolves.toHaveLength(
      0,
    );
    await expect(
      errorsOf({ currentPassword: 'senha', remember: true }),
    ).resolves.toHaveLength(0);
  });

  it.each([123, true, ['senha'], { senha: 1 }])(
    'should refuse a password that is not a string: %j',
    async (currentPassword) => {
      const errors = await errorsOf({ currentPassword });

      expect(errors.map((error) => error.property)).toEqual([
        'currentPassword',
      ]);
    },
  );

  it('should refuse a password over 72 characters, which bcrypt would cut', async () => {
    const errors = await errorsOf({ currentPassword: 'a'.repeat(73) });

    expect(errors.map((error) => error.property)).toEqual(['currentPassword']);
  });

  it.each(['true', 1])(
    'should refuse a remember that is not a boolean: %j',
    async (remember) => {
      const errors = await errorsOf({ remember });

      expect(errors.map((error) => error.property)).toEqual(['remember']);
    },
  );
});
