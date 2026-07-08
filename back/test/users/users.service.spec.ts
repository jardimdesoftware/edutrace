import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { UsersService } from 'src/users/users.service';
import { LEVELS, PHASES } from 'src/constants';
import * as bcryptjs from 'bcryptjs';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockUser = {
    id: 1,
    full_name: 'Test User',
    cpf: '12345678900',
    email: 'test@test.com',
    password: 'hashedPassword',
    affliation: 'Test',
    pedagogical_manager: 'Manager',
    password_reset_token: null,
    password_reset_expires: null,
    password_reset_attempts: 0,
    id_level: LEVELS.ALUNO_ESTUDANTE,
    id_current_phase: PHASES.TRIAGEM,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should hash the password and create a user with default level', async () => {
      const createDto = {
        full_name: 'Test User',
        cpf: '12345678900',
        email: 'test@test.com',
        password: 'plainPassword',
        affliation: 'Test',
        pedagogical_manager: 'Manager',
      };

      jest.mocked(bcryptjs.hash).mockResolvedValue('hashedPassword' as never);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser);

      const result = await service.create(createDto as any);

      expect(bcryptjs.hash).toHaveBeenCalledWith('plainPassword', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashedPassword',
            id_level: LEVELS.ALUNO_ESTUDANTE,
            id_current_phase: PHASES.TRIAGEM,
          }),
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should use provided id_level when given', async () => {
      const createDto = {
        full_name: 'Admin',
        cpf: '00000000000',
        email: 'admin@test.com',
        password: 'adminPass',
        affliation: 'Test',
        pedagogical_manager: 'Manager',
        id_level: LEVELS.ADMIN,
      };

      jest.mocked(bcryptjs.hash).mockResolvedValue('hashedPassword' as never);
      jest.spyOn(prisma.user, 'create').mockResolvedValue({ ...mockUser, id_level: LEVELS.ADMIN });

      await service.create(createDto as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id_level: LEVELS.ADMIN }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of users with selected fields', async () => {
      const usersList = [mockUser];
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue(usersList as any);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.any(Object) }),
      );
      expect(result).toEqual(usersList);
    });
  });

  describe('findOne', () => {
    it('should return a user by email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findOne('test@test.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user is not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne('notfound@test.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user full_name and id_level', async () => {
      const updateDto = { full_name: 'Updated Name', id_level: LEVELS.PROFISSIONAL_EDUCACAO };
      const updatedUser = { ...mockUser, ...updateDto };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.update('test@test.com', updateDto as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { full_name: updateDto.full_name, id_level: updateDto.id_level },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('setPasswordResetToken', () => {
    it('should store the token hash, its expiration and reset the attempts', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const updatedUser = {
        ...mockUser,
        password_reset_token: 'hashedCode',
        password_reset_expires: expiresAt,
      };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.setPasswordResetToken(
        'test@test.com',
        'hashedCode',
        expiresAt,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: {
          password_reset_token: 'hashedCode',
          password_reset_expires: expiresAt,
          password_reset_attempts: 0,
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('incrementPasswordResetAttempts', () => {
    it('should increment the attempts counter', async () => {
      const updatedUser = { ...mockUser, password_reset_attempts: 1 };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.incrementPasswordResetAttempts('test@test.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { password_reset_attempts: { increment: 1 } },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('clearPasswordResetToken', () => {
    it('should clear the token, its expiration and the attempts', async () => {
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);

      const result = await service.clearPasswordResetToken('test@test.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: {
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
        },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('updatePassword', () => {
    it('should update the password and invalidate the reset token in the same update', async () => {
      const updatedUser = { ...mockUser, password: 'newHashedPassword' };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.updatePassword(
        'test@test.com',
        'newHashedPassword',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: {
          password: 'newHashedPassword',
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('remove', () => {
    it('should delete a user by id', async () => {
      jest.spyOn(prisma.user, 'delete').mockResolvedValue(mockUser);

      const result = await service.remove(1);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockUser);
    });
  });
});
