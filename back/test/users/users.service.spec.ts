import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { UsersService } from 'src/users/users.service';
import { LEVELS, PHASES } from 'src/constants';
import * as bcryptjs from 'bcryptjs';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let sessionsService: SessionsService;

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
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
    login_lock_count: 0,
    id_level: LEVELS.ALUNO_ESTUDANTE,
    id_current_phase: PHASES.TRIAGEM,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  let tx: {
    user: { update: jest.Mock };
    screening: { updateMany: jest.Mock };
    anamnesis: { updateMany: jest.Mock };
    plansEducation: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      user: { update: jest.fn().mockResolvedValue(mockUser) },
      screening: { updateMany: jest.fn() },
      anamnesis: { updateMany: jest.fn() },
      plansEducation: { updateMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: SessionsService,
          useValue: {
            revokeAllFromUser: jest.fn(),
          },
        },
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
            $transaction: jest.fn((callback: (client: unknown) => unknown) =>
              callback(tx),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    sessionsService = module.get<SessionsService>(SessionsService);
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
            must_change_password: true,
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

  describe('update', () => {
    it('should revoke the sessions of the account when the level changes', async () => {
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);

      await service.update('test@test.com', {
        full_name: 'Nome',
        id_level: 3,
      });

      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should keep the sessions when the level is not part of the change', async () => {
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);

      // O DTO declara os campos como obrigatórios no tipo, mas ambos são
      // @IsOptional, então o corpo pode chegar sem id_level.
      await service.update('test@test.com', {
        full_name: 'Novo Nome',
      } as UpdateUserDto);

      expect(sessionsService.revokeAllFromUser).not.toHaveBeenCalled();
    });
  });

  describe('registerFailedLoginAttempt', () => {
    it('should increment the failed login counter', async () => {
      const updatedUser = { ...mockUser, failed_login_attempts: 1 };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.registerFailedLoginAttempt('test@test.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { failed_login_attempts: { increment: 1 } },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('lockAccount', () => {
    it('should store the deadline, count the lock and reset the failures', async () => {
      const lockedUntil = new Date('2026-08-23T12:15:00.000Z');
      const updatedUser = { ...mockUser, locked_until: lockedUntil, login_lock_count: 1 };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.lockAccount('test@test.com', lockedUntil);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: {
          locked_until: lockedUntil,
          login_lock_count: { increment: 1 },
          failed_login_attempts: 0,
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('clearLoginLock', () => {
    it('should reset the failures, the deadline and the lock count', async () => {
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);

      const result = await service.clearLoginLock('test@test.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
          login_lock_count: 0,
        },
      });
      expect(result).toEqual(mockUser);
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
          must_change_password: false,
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('updateProfile', () => {
    it('should clear must_change_password when a new password is stored', async () => {
      await service.updateProfile('test@test.com', {
        hashedPassword: 'newHashedPassword',
      });

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: {
          password: 'newHashedPassword',
          must_change_password: false,
        },
      });
    });

    it('should not touch must_change_password when only the email changes', async () => {
      await service.updateProfile('test@test.com', {
        newEmail: 'novo@test.com',
      });

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { email: 'novo@test.com' },
      });
    });

    it('should propagate the new email to the related records', async () => {
      await service.updateProfile('test@test.com', {
        newEmail: 'novo@test.com',
      });

      expect(tx.screening.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { email: 'novo@test.com' },
      });
      expect(tx.anamnesis.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { email: 'novo@test.com' },
      });
      expect(tx.plansEducation.updateMany).toHaveBeenCalledWith({
        where: { student_email: 'test@test.com' },
        data: { student_email: 'novo@test.com' },
      });
      expect(tx.plansEducation.updateMany).toHaveBeenCalledWith({
        where: { professor_email: 'test@test.com' },
        data: { professor_email: 'novo@test.com' },
      });
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
