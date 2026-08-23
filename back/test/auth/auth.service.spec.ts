import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let mailService: MailService;

  const mockUser = {
    id: 1,
    email: 'user@test.com',
    password: 'hashedPassword',
    full_name: 'Test User',
    id_level: 2,
    cpf: '12345678900',
    affliation: 'Test',
    pedagogical_manager: 'Manager',
    password_reset_token: null,
    password_reset_expires: null,
    password_reset_attempts: 0,
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
    login_lock_count: 0,
    id_current_phase: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockUserFirstAccess = { ...mockUser, must_change_password: true };

  const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

  const mockUserWithResetToken = {
    ...mockUser,
    password_reset_token: 'hashedCode',
    password_reset_expires: new Date(Date.now() + 10 * 60 * 1000),
    password_reset_attempts: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            setPasswordResetToken: jest.fn(),
            incrementPasswordResetAttempts: jest.fn(),
            clearPasswordResetToken: jest.fn(),
            updatePassword: jest.fn(),
            updateProfile: jest.fn(),
            registerFailedLoginAttempt: jest.fn(),
            lockAccount: jest.fn(),
            clearLoginLock: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordResetCode: jest.fn(),
            sendAccountLockedNotice: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signIn', () => {
    it('should return an access token when credentials are valid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn('user@test.com', 'plainPassword');

      expect(usersService.findOne).toHaveBeenCalledWith('user@test.com');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.full_name,
        id_level: mockUser.id_level,
        must_change_password: false,
      });
      expect(result).toEqual({ access_token: 'mock.jwt.token' });
    });

    it('should carry must_change_password in the token payload on first access', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserFirstAccess);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn('user@test.com', 'plainPassword');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ must_change_password: true }),
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.signIn('notfound@test.com', 'anyPassword')).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.signIn('user@test.com', 'wrongPassword')).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
      );
    });

    it('should answer unknown e-mail and wrong password with the same status and message', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);
      const unknownEmailError: UnauthorizedException = await service
        .signIn('notfound@test.com', 'anyPassword')
        .catch((error: UnauthorizedException) => error);

      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const wrongPasswordError: UnauthorizedException = await service
        .signIn('user@test.com', 'wrongPassword')
        .catch((error: UnauthorizedException) => error);

      expect(unknownEmailError.getStatus()).toBe(wrongPasswordError.getStatus());
      expect(unknownEmailError.getResponse()).toEqual(
        wrongPasswordError.getResponse(),
      );
    });

    it('should count a failed attempt without locking before the fifth one', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 3 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.signIn('user@test.com', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.registerFailedLoginAttempt).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(usersService.lockAccount).not.toHaveBeenCalled();
    });

    it('should lock the account for fifteen minutes on the fifth failed attempt', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-23T12:00:00.000Z'));

      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.signIn('user@test.com', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.lockAccount).toHaveBeenCalledWith(
        mockUser.email,
        new Date('2026-08-23T12:15:00.000Z'),
      );
      expect(usersService.registerFailedLoginAttempt).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should double the lock duration on consecutive locks, up to one hour', async () => {
      const casos = [
        { login_lock_count: 1, esperado: '2026-08-23T12:30:00.000Z' },
        { login_lock_count: 2, esperado: '2026-08-23T13:00:00.000Z' },
        { login_lock_count: 5, esperado: '2026-08-23T13:00:00.000Z' },
      ];

      for (const caso of casos) {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2026-08-23T12:00:00.000Z'));

        jest.spyOn(usersService, 'findOne').mockResolvedValue({
          ...mockUser,
          failed_login_attempts: 4,
          login_lock_count: caso.login_lock_count,
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.signIn('user@test.com', 'wrongPassword'),
        ).rejects.toThrow(UnauthorizedException);

        expect(usersService.lockAccount).toHaveBeenCalledWith(
          mockUser.email,
          new Date(caso.esperado),
        );

        jest.useRealTimers();
      }
    });

    it('should refuse the correct password while the account is locked', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.signIn('user@test.com', 'plainPassword'),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(usersService.registerFailedLoginAttempt).not.toHaveBeenCalled();
    });

    it('should answer a locked account exactly like an invalid credential', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const lockedError: UnauthorizedException = await service
        .signIn('user@test.com', 'plainPassword')
        .catch((error: UnauthorizedException) => error);

      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const wrongPasswordError: UnauthorizedException = await service
        .signIn('user@test.com', 'wrongPassword')
        .catch((error: UnauthorizedException) => error);

      expect(lockedError.getStatus()).toBe(wrongPasswordError.getStatus());
      expect(lockedError.getResponse()).toEqual(
        wrongPasswordError.getResponse(),
      );
    });

    it('should accept the login again once the lock has expired', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() - 1000),
        login_lock_count: 1,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn('user@test.com', 'plainPassword');

      expect(result).toEqual({ access_token: 'mock.jwt.token' });
      expect(usersService.clearLoginLock).toHaveBeenCalledWith(mockUser.email);
    });

    it('should clear the failure counter after a successful login', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 3 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn('user@test.com', 'plainPassword');

      expect(usersService.clearLoginLock).toHaveBeenCalledWith(mockUser.email);
    });

    it('should not touch the counters when nothing was pending', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn('user@test.com', 'plainPassword');

      expect(usersService.clearLoginLock).not.toHaveBeenCalled();
    });

    it('should warn the account owner by e-mail when the account gets locked', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-23T12:00:00.000Z'));

      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.signIn('user@test.com', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mailService.sendAccountLockedNotice).toHaveBeenCalledWith(
        mockUser.email,
        new Date('2026-08-23T12:15:00.000Z'),
      );

      jest.useRealTimers();
    });

    it('should keep the lock when the warning e-mail fails', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      jest
        .spyOn(mailService, 'sendAccountLockedNotice')
        .mockRejectedValue(new Error('SMTP indisponível'));

      await expect(
        service.signIn('user@test.com', 'wrongPassword'),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));

      expect(usersService.lockAccount).toHaveBeenCalled();
    });

    it('should run a bcrypt comparison when the user does not exist', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(
        service.signIn('notfound@test.com', 'anyPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'anyPassword',
        expect.stringMatching(/^\$2[aby]\$10\$/),
      );
    });
  });

  describe('updateProfile', () => {
    const dtoComSenha = {
      password: 'novaSenha123',
      currentPassword: 'senhaAtual123',
    };

    it('should reject when the new password is equal to the current one', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      // Primeira chamada valida a senha atual, segunda compara a nova com a atual.
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updateProfile('user@test.com', dtoComSenha),
      ).rejects.toThrow(
        new BadRequestException('A nova senha deve ser diferente da senha atual.'),
      );
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('should reject an update without a new password on first access', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserFirstAccess);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updateProfile('user@test.com', {
          email: 'novo@test.com',
          currentPassword: 'senhaAtual123',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'É obrigatório definir uma nova senha no primeiro acesso.',
        ),
      );
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('should accept an email-only update when the password was already changed', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(mockUser);
      jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jest
        .spyOn(usersService, 'updateProfile')
        .mockResolvedValue({ ...mockUser, email: 'novo@test.com' });

      const result = await service.updateProfile('user@test.com', {
        email: 'novo@test.com',
        currentPassword: 'senhaAtual123',
      });

      expect(result).toEqual({ access_token: 'mock.jwt.token' });
    });

    it('should issue a token without the flag after the first access change', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserFirstAccess);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');
      jest.spyOn(usersService, 'updateProfile').mockResolvedValue(mockUser);

      await service.updateProfile('user@test.com', dtoComSenha);

      expect(usersService.updateProfile).toHaveBeenCalledWith('user@test.com', {
        newEmail: undefined,
        hashedPassword: 'novoHash',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ must_change_password: false }),
      );
    });

    it('should throw UnauthorizedException when the current password is wrong', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateProfile('user@test.com', dtoComSenha),
      ).rejects.toThrow(new UnauthorizedException('Senha atual incorreta'));
    });
  });

  describe('forgotPassword', () => {
    const genericMessage =
      'Se o e-mail informado estiver cadastrado, um código de recuperação foi enviado.';

    it('should generate a 6-digit code, persist its hash and send it by email', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');

      const result = await service.forgotPassword('user@test.com');

      const sentCode = (mailService.sendPasswordResetCode as jest.Mock).mock
        .calls[0][1];
      expect(sentCode).toMatch(/^\d{6}$/);
      expect(bcrypt.hash).toHaveBeenCalledWith(sentCode, 10);
      expect(usersService.setPasswordResetToken).toHaveBeenCalledWith(
        'user@test.com',
        'hashedCode',
        expect.any(Date),
      );
      expect(mailService.sendPasswordResetCode).toHaveBeenCalledWith(
        'user@test.com',
        sentCode,
      );
      expect(result).toEqual({ message: genericMessage });
    });

    it('should set the code expiration around 15 minutes in the future', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');

      const before = Date.now();
      await service.forgotPassword('user@test.com');
      const after = Date.now();

      const expiresAt = (usersService.setPasswordResetToken as jest.Mock).mock
        .calls[0][2] as Date;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
    });

    it('should return the same generic message without persisting or sending email when user is not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      const result = await service.forgotPassword('notfound@test.com');

      expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetCode).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });

    it('should not propagate email sending failures', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
      jest
        .spyOn(mailService, 'sendPasswordResetCode')
        .mockRejectedValue(new Error('SMTP indisponível'));

      const result = await service.forgotPassword('user@test.com');

      expect(result).toEqual({ message: genericMessage });
    });
  });

  describe('verifyResetCode', () => {
    it('should resolve and keep the token when the code is valid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyResetCode('user@test.com', '123456');

      expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashedCode');
      expect(usersService.clearPasswordResetToken).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Código válido.' });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(
        service.verifyResetCode('notfound@test.com', '123456'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
    });

    it('should throw UnauthorizedException when there is no reset token', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);

      await expect(
        service.verifyResetCode('user@test.com', '123456'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
    });

    it('should throw UnauthorizedException when the code is expired', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUserWithResetToken,
        password_reset_expires: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyResetCode('user@test.com', '123456'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
    });

    it('should increment attempts and throw when the code is wrong', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.verifyResetCode('user@test.com', '000000'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(usersService.incrementPasswordResetAttempts).toHaveBeenCalledWith(
        'user@test.com',
      );
    });

    it('should clear the token and throw when max attempts are exceeded', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUserWithResetToken,
        password_reset_attempts: 5,
      });

      await expect(
        service.verifyResetCode('user@test.com', '123456'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(usersService.clearPasswordResetToken).toHaveBeenCalledWith(
        'user@test.com',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should hash the new password and update it when the code is valid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');

      const result = await service.resetPassword(
        'user@test.com',
        '123456',
        'novaSenha123',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'user@test.com',
        'newHashedPassword',
      );
      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
    });

    it('should throw and not update the password when the code is invalid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.resetPassword('user@test.com', '000000', 'novaSenha123'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw and not update the password when the code is expired', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUserWithResetToken,
        password_reset_expires: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('user@test.com', '123456', 'novaSenha123'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });
  });
});
