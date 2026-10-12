import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/database/prisma.service';
import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SessionsService } from 'src/sessions/sessions.service';
import { MailService } from 'src/mail/mail.service';
import { PUBLIC_USER_SELECT } from 'src/users/users.select';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { UsersService } from 'src/users/users.service';
import { LEVELS, PHASES } from 'src/constants';
import * as bcryptjs from 'bcryptjs';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let sessionsService: SessionsService;
  let mailService: MailService;

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
    activation_token: null,
    activation_expires: null,
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
    login_lock_count: 0,
    google_sub: null,
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
          provide: MailService,
          useValue: {
            sendAccountActivationLink: jest.fn(),
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
              updateMany: jest.fn(),
              upsert: jest.fn(),
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
    mailService = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      full_name: 'Test User',
      cpf: '12345678900',
      email: 'test@test.com',
      affliation: 'Test',
      pedagogical_manager: 'Manager',
    };
    let frontendUrl: string | undefined;

    beforeEach(() => {
      frontendUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://edutrace.example.com';
      jest.mocked(bcryptjs.hash).mockResolvedValue('hashedPassword' as never);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser);
    });

    afterEach(() => {
      jest.useRealTimers();
      if (frontendUrl === undefined) {
        delete process.env.FRONTEND_URL;
      } else {
        process.env.FRONTEND_URL = frontendUrl;
      }
    });

    const createdData = () =>
      (prisma.user.create as jest.Mock).mock.calls[0][0].data as Record<
        string,
        unknown
      >;

    it('should create the account with a random password and without the forced change', async () => {
      await service.create(createDto as any);

      expect(bcryptjs.hash).toHaveBeenCalledWith(
        expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        10,
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: PUBLIC_USER_SELECT,
          data: expect.objectContaining({
            password: 'hashedPassword',
            id_level: LEVELS.ALUNO_ESTUDANTE,
            id_current_phase: PHASES.TRIAGEM,
            must_change_password: false,
          }),
        }),
      );
    });

    it('should store only the hash of the activation token, valid for 24 hours', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-01T12:00:00.000Z'));

      await service.create(createDto as any);

      expect(createdData().activation_token).toMatch(/^[0-9a-f]{64}$/);
      expect(createdData().activation_expires).toEqual(
        new Date('2026-10-02T12:00:00.000Z'),
      );
    });

    it('should e-mail the link carrying the token whose hash was stored', async () => {
      await service.create(createDto as any);

      const [to, link, expiresAt] = jest.mocked(
        mailService.sendAccountActivationLink,
      ).mock.calls[0];
      const prefix = 'https://edutrace.example.com/definir-senha#token=';
      const token = link.slice(prefix.length);

      expect(to).toBe(createDto.email);
      expect(link.startsWith(prefix)).toBe(true);
      expect(createHash('sha256').update(token).digest('hex')).toBe(
        createdData().activation_token,
      );
      expect(expiresAt).toEqual(createdData().activation_expires);
    });

    it('should return the created user and tell that the e-mail was sent', async () => {
      const result = await service.create(createDto as any);

      expect(result).toEqual({ ...mockUser, activation_email_sent: true });
    });

    it('should keep the account and tell the administrator when the e-mail fails', async () => {
      const error = jest
        .spyOn((service as unknown as { logger: Logger }).logger, 'error')
        .mockImplementation(() => undefined);
      jest
        .mocked(mailService.sendAccountActivationLink)
        .mockRejectedValue(new Error('SMTP indisponível'));

      const result = await service.create(createDto as any);

      expect(result).toEqual({ ...mockUser, activation_email_sent: false });
      expect(error).toHaveBeenCalledWith(
        `Falha ao enviar o link de definição de senha do usuário ${mockUser.id}`,
        expect.anything(),
      );
      const [, link] = jest.mocked(mailService.sendAccountActivationLink).mock
        .calls[0];
      const logged = JSON.stringify(error.mock.calls);
      expect(logged).not.toContain(mockUser.email);
      expect(logged).not.toContain(link.split('#token=')[1]);
      error.mockRestore();
    });

    it('should tell the administrator when FRONTEND_URL is missing and the link cannot be built', async () => {
      delete process.env.FRONTEND_URL;
      const error = jest
        .spyOn((service as unknown as { logger: Logger }).logger, 'error')
        .mockImplementation(() => undefined);

      const result = await service.create(createDto as any);

      expect(result).toEqual({ ...mockUser, activation_email_sent: false });
      expect(mailService.sendAccountActivationLink).not.toHaveBeenCalled();
      error.mockRestore();
    });

    it('should use provided id_level when given', async () => {
      await service.create({ ...createDto, id_level: LEVELS.ADMIN } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id_level: LEVELS.ADMIN }),
        }),
      );
    });
  });

  describe('findByActivationToken', () => {
    it('should look the account up by the token hash', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findByActivationToken('hash-do-token');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { activation_token: 'hash-do-token' },
      });
      expect(result).toEqual(mockUser);
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

  describe('findOnePublic', () => {
    it('should read only the public fields', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      await service.findOnePublic('test@test.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        select: PUBLIC_USER_SELECT,
      });
    });
  });

  describe('findOne', () => {
    it('should keep reading the whole record, which authentication depends on', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      await service.findOne('test@test.com');

      const argumentos = (prisma.user.findUnique as jest.Mock).mock.calls[0][0];

      // signIn, updateProfile e validateResetCode leem a senha e os campos de
      // recuperação por aqui: um select neste método quebra login e reset.
      expect(argumentos).not.toHaveProperty('select');
    });

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

  describe('ensureGoogleStudentUser', () => {
    const googleData = {
      email: 'aluno@discente.ifpe.edu.br',
      fullName: 'Nome no Google',
      passwordHash: 'randomHash',
      googleSubject: 'google-sub',
    };

    it('should create the account as a student when the e-mail is not registered', async () => {
      jest.spyOn(prisma.user, 'upsert').mockResolvedValue(mockUser);

      await service.ensureGoogleStudentUser(googleData);

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: googleData.email },
          create: {
            full_name: googleData.fullName,
            cpf: 'google:google-sub',
            email: googleData.email,
            password: googleData.passwordHash,
            id_level: LEVELS.ALUNO_ESTUDANTE,
            id_current_phase: PHASES.TRIAGEM,
            must_change_password: false,
          },
        }),
      );
    });

    it('should not change the level, the name or the pending password change of an existing account', async () => {
      const existing = {
        ...mockUser,
        email: googleData.email,
        full_name: 'Nome cadastrado pelo administrador',
        id_level: LEVELS.PROFISSIONAL_EDUCACAO,
        must_change_password: true,
      };
      jest.spyOn(prisma.user, 'upsert').mockResolvedValue(existing);

      const result = await service.ensureGoogleStudentUser(googleData);

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
      expect(result).toEqual(existing);
    });
  });

  describe('createGoogleStudentUser', () => {
    const googleData = {
      email: 'aluno@discente.ifpe.edu.br',
      fullName: 'Nome no Google',
      passwordHash: 'randomHash',
      googleSubject: 'google-sub',
    };

    it('should create the student account already linked to the Google sub', async () => {
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser);

      await service.createGoogleStudentUser(googleData);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          full_name: googleData.fullName,
          cpf: 'google:google-sub',
          email: googleData.email,
          password: googleData.passwordHash,
          google_sub: googleData.googleSubject,
          id_level: LEVELS.ALUNO_ESTUDANTE,
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: false,
        },
      });
    });

    // A conta cadastrada pelo administrador com o mesmo e-mail nunca é aberta
    // pelo Google: o dono vincula a Conta Google depois de entrar com senha.
    it('should not touch an existing account with the same e-mail', async () => {
      jest.spyOn(prisma.user, 'create').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['email'] },
        }),
      );

      await expect(service.createGoogleStudentUser(googleData)).resolves.toBe(
        null,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('should propagate other database errors', async () => {
      jest
        .spyOn(prisma.user, 'create')
        .mockRejectedValue(new Error('banco indisponível'));

      await expect(service.createGoogleStudentUser(googleData)).rejects.toThrow(
        'banco indisponível',
      );
    });
  });

  describe('findByGoogleSub', () => {
    it('should look the account up by the Google sub', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findByGoogleSub('google-sub');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { google_sub: 'google-sub' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('setGoogleSub', () => {
    it('should store the Google sub of the account', async () => {
      await service.setGoogleSub('test@test.com', 'google-sub');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { google_sub: 'google-sub' },
      });
    });

    it('should clear the Google sub of the account', async () => {
      await service.setGoogleSub('test@test.com', null);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { google_sub: null },
      });
    });

    it('should answer 409 when the Google account is linked to another account', async () => {
      jest.spyOn(prisma.user, 'update').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['google_sub'] },
        }),
      );

      await expect(
        service.setGoogleSub('test@test.com', 'google-sub'),
      ).rejects.toThrow(
        new ConflictException(
          'Esta Conta Google já está vinculada a outra conta.',
        ),
      );
    });
  });

  describe('create, violação de campo único', () => {
    const createDto = {
      full_name: 'Usuário de Teste',
      cpf: '01234567890',
      email: 'usuario@edutrace.com',
    };

    function uniqueViolation(target: string[]) {
      return new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0', meta: { target } },
      );
    }

    beforeEach(() => {
      jest.mocked(bcryptjs.hash).mockResolvedValue('hashedPassword' as never);
    });

    it('should answer 409 when the cpf is already taken', async () => {
      jest
        .spyOn(prisma.user, 'create')
        .mockRejectedValue(uniqueViolation(['cpf']));

      await expect(service.create(createDto as any)).rejects.toThrow(
        new ConflictException('Este CPF já está cadastrado.'),
      );
    });

    it('should answer 409 when the email is already taken', async () => {
      jest
        .spyOn(prisma.user, 'create')
        .mockRejectedValue(uniqueViolation(['email']));

      await expect(service.create(createDto as any)).rejects.toThrow(
        new ConflictException('Este e-mail já está cadastrado.'),
      );
    });

    it('should not send the activation e-mail when the account is not created', async () => {
      jest
        .spyOn(prisma.user, 'create')
        .mockRejectedValue(uniqueViolation(['email']));

      await expect(service.create(createDto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mailService.sendAccountActivationLink).not.toHaveBeenCalled();
    });

    it('should propagate errors that are not a unique violation', async () => {
      const erroQualquer = new Error('conexão perdida');
      jest.spyOn(prisma.user, 'create').mockRejectedValue(erroQualquer);

      await expect(service.create(createDto as any)).rejects.toThrow(
        erroQualquer,
      );
    });
  });

  describe('update', () => {
    it('should update user full_name and id_level', async () => {
      const updateDto = {
        full_name: 'Updated Name',
        id_level: LEVELS.PROFISSIONAL_EDUCACAO,
      };
      const updatedUser = { ...mockUser, ...updateDto };
      jest.spyOn(prisma.user, 'update').mockResolvedValue(updatedUser);

      const result = await service.update('test@test.com', updateDto as any);

      expect(prisma.user.update).toHaveBeenCalledWith({
        select: PUBLIC_USER_SELECT,
        where: { email: 'test@test.com' },
        data: { full_name: updateDto.full_name, id_level: updateDto.id_level },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('setPasswordResetToken', () => {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    it('should only replace the code while the current window has not expired', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.setPasswordResetToken(
        'test@test.com',
        'hashedCode',
        expiresAt,
      );

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          email: 'test@test.com',
          password_reset_expires: { gt: expect.any(Date) },
        },
        data: { password_reset_token: 'hashedCode' },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should open a new window with the attempts reset when there is no current one', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await service.setPasswordResetToken(
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
    });
  });

  describe('reservePasswordResetAttempt', () => {
    it('should reserve the attempt in a single update bound to a valid code below the limit', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const reserved = await service.reservePasswordResetAttempt(
        'test@test.com',
        5,
      );

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          email: 'test@test.com',
          password_reset_token: { not: null },
          password_reset_expires: { gt: expect.any(Date) },
          password_reset_attempts: { lt: 5 },
        },
        data: { password_reset_attempts: { increment: 1 } },
      });
      expect(reserved).toBe(true);
    });

    it('should report that nothing was reserved when no row matches', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        service.reservePasswordResetAttempt('test@test.com', 5),
      ).resolves.toBe(false);
    });
  });

  describe('releasePasswordResetAttempt', () => {
    it('should give back the reserved attempt', async () => {
      await service.releasePasswordResetAttempt('test@test.com');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { password_reset_attempts: { decrement: 1 } },
      });
    });
  });

  describe('update', () => {
    it('should revoke the sessions of the account when the level changes', async () => {
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);

      await service.update('test@test.com', {
        full_name: 'Nome',
        id_level: 3,
      });

      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(
        mockUser.id,
      );
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
      const updatedUser = {
        ...mockUser,
        locked_until: lockedUntil,
        login_lock_count: 1,
      };
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

  describe('updatePassword', () => {
    it('should update the password, invalidate the reset token and the activation link, and clear the login lock in the same update', async () => {
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
          activation_token: null,
          activation_expires: null,
          must_change_password: false,
          failed_login_attempts: 0,
          locked_until: null,
          login_lock_count: 0,
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

      expect(prisma.user.delete).toHaveBeenCalledWith({
        select: PUBLIC_USER_SELECT,
        where: { id: 1 },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('completeGoogleRegistration', () => {
    it('should replace the placeholder with the CPF and store the password', async () => {
      jest
        .spyOn(prisma.user, 'update')
        .mockResolvedValue({ ...mockUser, cpf: '01234567890' });

      await service.completeGoogleRegistration(
        'aluno@discente.ifpe.edu.br',
        '01234567890',
        'senhaHash',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'aluno@discente.ifpe.edu.br' },
        data: {
          cpf: '01234567890',
          password: 'senhaHash',
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
          must_change_password: false,
        },
      });
    });

    it('should answer 409 and point to the administrator when the CPF belongs to another account', async () => {
      jest.spyOn(prisma.user, 'update').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['cpf'] },
        }),
      );

      await expect(
        service.completeGoogleRegistration(
          'aluno@discente.ifpe.edu.br',
          '01234567890',
          'senhaHash',
        ),
      ).rejects.toThrow(
        new ConflictException(
          'Este CPF já está cadastrado. Procure o administrador.',
        ),
      );
    });

    it('should propagate errors that are not a unique violation', async () => {
      const erroQualquer = new Error('conexão perdida');
      jest.spyOn(prisma.user, 'update').mockRejectedValue(erroQualquer);

      await expect(
        service.completeGoogleRegistration(
          'aluno@discente.ifpe.edu.br',
          '01234567890',
          'senhaHash',
        ),
      ).rejects.toThrow(erroQualquer);
    });
  });
});
