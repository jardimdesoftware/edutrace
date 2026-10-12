import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import {
  COMPROMISED_PASSWORD_MESSAGE,
  CompromisedPasswordService,
} from 'src/auth/compromised-password.service';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

jest.mock('bcryptjs');

// forgotPassword responde antes de processar o pedido; os testes que conferem
// a gravação do código e o envio esperam esse processamento terminar.
const flushBackgroundWork = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let mailService: MailService;
  let sessionsService: SessionsService;
  let compromisedPasswordService: CompromisedPasswordService;

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
    activation_token: null,
    activation_expires: null,
    must_change_password: false,
    failed_login_attempts: 0,
    locked_until: null,
    login_lock_count: 0,
    google_sub: null,
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
            findByActivationToken: jest.fn(),
            completeGoogleRegistration: jest.fn(),
            setPasswordResetToken: jest.fn(),
            reservePasswordResetAttempt: jest.fn().mockResolvedValue(true),
            releasePasswordResetAttempt: jest.fn(),
            updatePassword: jest.fn(),
            updateProfile: jest.fn(),
            registerFailedLoginAttempt: jest.fn(),
            lockAccount: jest.fn(),
            clearLoginLock: jest.fn(),
            createGoogleStudentUser: jest.fn(),
            findByGoogleSub: jest.fn(),
            setGoogleSub: jest.fn(),
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
            sendAccountLockedNotice: jest.fn().mockResolvedValue(undefined),
            sendGoogleAccountLinkNotice: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CompromisedPasswordService,
          useValue: {
            assertNotCompromised: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            create: jest.fn(),
            findActive: jest.fn(),
            revokeByJti: jest.fn(),
            revokeAllFromUser: jest.fn(),
            registerUse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);
    sessionsService = module.get<SessionsService>(SessionsService);
    compromisedPasswordService = module.get<CompromisedPasswordService>(
      CompromisedPasswordService,
    );
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
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          name: mockUser.full_name,
          id_level: mockUser.id_level,
          must_change_password: false,
          jti: expect.any(String),
        }),
      );
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

    it('should answer the locking attempt without waiting for the warning e-mail', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      jest
        .spyOn(mailService, 'sendAccountLockedNotice')
        .mockReturnValue(new Promise<void>(() => undefined));

      await expect(
        service.signIn('user@test.com', 'wrongPassword'),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE));

      expect(usersService.lockAccount).toHaveBeenCalled();
      expect(mailService.sendAccountLockedNotice).toHaveBeenCalled();
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

  describe('sessões', () => {
    it('should revoke the previous sessions and open a new one on login', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn('user@test.com', 'plainPassword', {
        ip: '10.0.0.1',
        userAgent: 'jest',
      });

      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(mockUser.id);
      expect(sessionsService.create).toHaveBeenCalledWith({
        jti: expect.any(String),
        id_user: mockUser.id,
        ip: '10.0.0.1',
        user_agent: 'jest',
      });
    });

    it('should sign the token with the jti of the session it just created', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn('user@test.com', 'plainPassword');

      const criada = (sessionsService.create as jest.Mock).mock.calls[0][0];
      const assinado = (jwtService.signAsync as jest.Mock).mock.calls[0][0];

      expect(assinado.jti).toBe(criada.jti);
    });

    it('should revoke only the current session on logout', async () => {
      const result = await service.logout('sessao-1');

      expect(sessionsService.revokeByJti).toHaveBeenCalledWith('sessao-1');
      expect(sessionsService.revokeAllFromUser).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Sessão encerrada.' });
    });

    it('should revoke every session of the account when the password is reset', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');

      await service.resetPassword('user@test.com', '123456', 'novaSenha123');

      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(
        mockUserWithResetToken.id,
      );
    });
  });

  describe('login com Google', () => {
    const discenteEmail = 'aluno@discente.ifpe.edu.br';
    const NOT_LINKED_MESSAGE =
      'Conta Google não vinculada. Entre com e-mail e senha e vincule a conta em Alterar meus dados.';
    let originalClientId: string | undefined;
    let originalFetch: typeof fetch;

    const mockGoogleCredential = (claims: Record<string, unknown>) => {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            aud: 'client-id',
            iss: 'https://accounts.google.com',
            email_verified: true,
            name: 'Nome no Google',
            sub: 'google-sub',
            ...claims,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as typeof fetch;
    };

    beforeEach(() => {
      originalClientId = process.env.GOOGLE_CLIENT_ID;
      originalFetch = globalThis.fetch;
      process.env.GOOGLE_CLIENT_ID = 'client-id';
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      if (originalClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
      } else {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
      }
    });

    describe('signInWithGoogle', () => {
      // Cenário do administrador do seed: quem compra o domínio do e-mail cria
      // uma Conta Google com ele, e o token sai com email_verified e sem hd.
      it('should refuse an existing account with the same e-mail and no linked Google account', async () => {
        mockGoogleCredential({ email: 'admin@edutrace.com' });
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
        jest.spyOn(usersService, 'findOne').mockResolvedValue({
          ...mockUser,
          email: 'admin@edutrace.com',
          id_level: 1,
        });

        await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
          new UnauthorizedException(NOT_LINKED_MESSAGE),
        );

        expect(usersService.findByGoogleSub).toHaveBeenCalledWith('google-sub');
        expect(usersService.findOne).not.toHaveBeenCalled();
        expect(jwtService.signAsync).not.toHaveBeenCalled();
        expect(sessionsService.create).not.toHaveBeenCalled();
      });

      it('should answer the same way for a registered and an unknown e-mail without a link', async () => {
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);

        mockGoogleCredential({ email: mockUser.email });
        const registered = (await service
          .signInWithGoogle('credencial')
          .catch((error: unknown) => error)) as UnauthorizedException;

        mockGoogleCredential({ email: 'ninguem@exemplo.org' });
        const unknown = (await service
          .signInWithGoogle('credencial')
          .catch((error: unknown) => error)) as UnauthorizedException;

        expect(registered).toBeInstanceOf(UnauthorizedException);
        expect(registered.getResponse()).toEqual(unknown.getResponse());
      });

      it('should sign in the account linked to the sub even when the token e-mail changed', async () => {
        mockGoogleCredential({ email: 'outro-endereco@exemplo.org' });
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue({
          ...mockUser,
          google_sub: 'google-sub',
          id_level: 3,
        });

        const result = await service.signInWithGoogle('credencial');

        expect(jwtService.signAsync).toHaveBeenCalledWith(
          expect.objectContaining({ email: mockUser.email, id_level: 3 }),
        );
        expect(result).toEqual({ access_token: 'mock.jwt.token' });
      });

      it('should keep the pending password change of a linked account', async () => {
        mockGoogleCredential({ email: mockUser.email });
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue({
          ...mockUserFirstAccess,
          google_sub: 'google-sub',
        });

        await service.signInWithGoogle('credencial');

        expect(jwtService.signAsync).toHaveBeenCalledWith(
          expect.objectContaining({ must_change_password: true }),
        );
      });

      it('should refuse a linked account while it is locked', async () => {
        mockGoogleCredential({ email: mockUser.email });
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue({
          ...mockUser,
          google_sub: 'google-sub',
          locked_until: new Date(Date.now() + 10 * 60 * 1000),
        });

        await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
          new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE),
        );
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      });

      it.each(['https://evil.example', 'accounts.google.com.evil', undefined])(
        'should refuse a token issued by %s',
        async (iss) => {
          mockGoogleCredential({ email: mockUser.email, iss });

          await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
            new UnauthorizedException('Credencial do Google inválida.'),
          );
          expect(usersService.findByGoogleSub).not.toHaveBeenCalled();
        },
      );

      it('should accept both issuers Google uses', async () => {
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue({
          ...mockUser,
          google_sub: 'google-sub',
        });

        for (const iss of [
          'accounts.google.com',
          'https://accounts.google.com',
        ]) {
          mockGoogleCredential({ email: mockUser.email, iss });
          await expect(service.signInWithGoogle('credencial')).resolves.toEqual(
            { access_token: 'mock.jwt.token' },
          );
        }
      });

      it('should not create an account for a @discente e-mail without the hd claim', async () => {
        mockGoogleCredential({ email: discenteEmail });
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);

        await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
          new UnauthorizedException(NOT_LINKED_MESSAGE),
        );
        expect(usersService.createGoogleStudentUser).not.toHaveBeenCalled();
      });

      it('should create the student account linked to the sub for a new @discente e-mail with the right hd', async () => {
        mockGoogleCredential({
          email: discenteEmail,
          hd: 'discente.ifpe.edu.br',
        });
        (bcrypt.hash as jest.Mock).mockResolvedValue('randomHash');
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
        jest.spyOn(usersService, 'createGoogleStudentUser').mockResolvedValue({
          ...mockUser,
          email: discenteEmail,
          google_sub: 'google-sub',
        });

        const result = await service.signInWithGoogle('credencial');

        expect(usersService.createGoogleStudentUser).toHaveBeenCalledWith({
          email: discenteEmail,
          fullName: 'Nome no Google',
          passwordHash: 'randomHash',
          googleSubject: 'google-sub',
        });
        expect(result).toEqual({ access_token: 'mock.jwt.token' });
      });

      it('should refuse a @discente e-mail that already has an account without the link', async () => {
        mockGoogleCredential({
          email: discenteEmail,
          hd: 'discente.ifpe.edu.br',
        });
        (bcrypt.hash as jest.Mock).mockResolvedValue('randomHash');
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
        jest
          .spyOn(usersService, 'createGoogleStudentUser')
          .mockResolvedValue(null);

        await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
          new UnauthorizedException(NOT_LINKED_MESSAGE),
        );
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      });
    });

    describe('linkGoogleAccount', () => {
      const dto = { credential: 'credencial', currentPassword: 'senhaAtual123' };

      it('should store the sub in the account of the session and warn the owner', async () => {
        mockGoogleCredential({ email: 'pessoal@gmail.com' });
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);

        const result = await service.linkGoogleAccount(mockUser.email, dto);

        expect(usersService.setGoogleSub).toHaveBeenCalledWith(
          mockUser.email,
          'google-sub',
        );
        expect(mailService.sendGoogleAccountLinkNotice).toHaveBeenCalledWith(
          mockUser.email,
          true,
        );
        expect(result).toEqual({ message: 'Conta Google vinculada.' });
      });

      it('should answer 409 when the sub is linked to another account', async () => {
        mockGoogleCredential({ email: 'pessoal@gmail.com' });
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue({
          ...mockUser,
          id: 99,
          email: 'outra@exemplo.org',
          google_sub: 'google-sub',
        });

        await expect(
          service.linkGoogleAccount(mockUser.email, dto),
        ).rejects.toThrow(
          new ConflictException(
            'Esta Conta Google já está vinculada a outra conta.',
          ),
        );
        expect(usersService.setGoogleSub).not.toHaveBeenCalled();
        expect(mailService.sendGoogleAccountLinkNotice).not.toHaveBeenCalled();
      });

      // Vincular acrescenta um meio de entrar na conta. Sem a senha atual, quem
      // usa uma sessão aberta de outra pessoa vincularia a própria Conta Google.
      it('should count a wrong current password in the account lock and not link', async () => {
        mockGoogleCredential({ email: 'pessoal@gmail.com' });
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.linkGoogleAccount(mockUser.email, dto),
        ).rejects.toThrow(new UnauthorizedException('Senha atual incorreta'));
        expect(usersService.registerFailedLoginAttempt).toHaveBeenCalledWith(
          mockUser.email,
        );
        expect(usersService.setGoogleSub).not.toHaveBeenCalled();
      });

      it('should not link while the account is locked', async () => {
        mockGoogleCredential({ email: 'pessoal@gmail.com' });
        jest.spyOn(usersService, 'findOne').mockResolvedValue({
          ...mockUser,
          locked_until: new Date(Date.now() + 10 * 60 * 1000),
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(
          service.linkGoogleAccount(mockUser.email, dto),
        ).rejects.toThrow(new UnauthorizedException('Senha atual incorreta'));
        expect(usersService.setGoogleSub).not.toHaveBeenCalled();
      });

      it('should refuse a token from another issuer', async () => {
        mockGoogleCredential({ email: 'pessoal@gmail.com', iss: 'evil' });
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(
          service.linkGoogleAccount(mockUser.email, dto),
        ).rejects.toThrow(
          new UnauthorizedException('Credencial do Google inválida.'),
        );
        expect(usersService.setGoogleSub).not.toHaveBeenCalled();
      });
    });

    describe('unlinkGoogleAccount', () => {
      it('should clear the sub, warn the owner and refuse the next Google login with it', async () => {
        jest.spyOn(usersService, 'findOne').mockResolvedValue({
          ...mockUser,
          google_sub: 'google-sub',
        });

        const result = await service.unlinkGoogleAccount(mockUser.email);

        expect(usersService.setGoogleSub).toHaveBeenCalledWith(
          mockUser.email,
          null,
        );
        expect(mailService.sendGoogleAccountLinkNotice).toHaveBeenCalledWith(
          mockUser.email,
          false,
        );
        expect(result).toEqual({ message: 'Conta Google desvinculada.' });

        mockGoogleCredential({ email: mockUser.email });
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue(null);
        await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
          new UnauthorizedException(NOT_LINKED_MESSAGE),
        );
      });

      it('should not send the notice when nothing was linked', async () => {
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);

        await service.unlinkGoogleAccount(mockUser.email);

        expect(usersService.setGoogleSub).not.toHaveBeenCalled();
        expect(mailService.sendGoogleAccountLinkNotice).not.toHaveBeenCalled();
      });
    });

    describe('getGoogleLinkStatus', () => {
      it('should report whether the account of the session has a linked Google account', async () => {
        jest
          .spyOn(usersService, 'findOne')
          .mockResolvedValueOnce({ ...mockUser, google_sub: 'google-sub' })
          .mockResolvedValueOnce(mockUser);

        await expect(
          service.getGoogleLinkStatus(mockUser.email),
        ).resolves.toEqual({ enabled: true, linked: true });
        await expect(
          service.getGoogleLinkStatus(mockUser.email),
        ).resolves.toEqual({ enabled: true, linked: false });
      });
    });
  });

  describe('updateProfile', () => {
    const dtoComSenha = {
      password: 'novaSenha123',
      currentPassword: 'senhaAtual123',
    };

    // A senha atual protege a sessão que o dono deixou aberta; sem limite de
    // tentativas, quem usa essa sessão testa senhas até achar a atual.
    it('should count a wrong current password in the account lock', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateProfile('user@test.com', dtoComSenha),
      ).rejects.toThrow(new UnauthorizedException('Senha atual incorreta'));

      expect(usersService.registerFailedLoginAttempt).toHaveBeenCalledWith(
        mockUser.email,
      );
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('should lock the account and warn the owner on the fifth wrong current password', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateProfile('user@test.com', dtoComSenha),
      ).rejects.toThrow(new UnauthorizedException('Senha atual incorreta'));

      expect(usersService.lockAccount).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(Date),
      );
      expect(mailService.sendAccountLockedNotice).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(Date),
      );
    });

    it('should refuse the correct current password while the account is locked', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updateProfile('user@test.com', dtoComSenha),
      ).rejects.toThrow(new UnauthorizedException('Senha atual incorreta'));

      expect(usersService.updateProfile).not.toHaveBeenCalled();
      expect(usersService.registerFailedLoginAttempt).not.toHaveBeenCalled();
    });

    it('should clear the pending failures after a correct current password', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockResolvedValue({ ...mockUser, failed_login_attempts: 2 });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');
      jest
        .spyOn(usersService, 'updateProfile')
        .mockResolvedValue({ ...mockUser, password: 'novoHash' });

      await service.updateProfile('user@test.com', dtoComSenha);

      expect(usersService.clearLoginLock).toHaveBeenCalledWith(mockUser.email);
    });

    it('should revoke the sessions opened before the change and open a new one', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');
      jest
        .spyOn(usersService, 'updateProfile')
        .mockResolvedValue({ ...mockUser, password: 'novoHash' });

      await service.updateProfile('user@test.com', dtoComSenha);

      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(mockUser.id);
      expect(sessionsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ id_user: mockUser.id }),
      );
    });

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
      await flushBackgroundWork();

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
      await flushBackgroundWork();
      const after = Date.now();

      const expiresAt = (usersService.setPasswordResetToken as jest.Mock).mock
        .calls[0][2] as Date;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
    });

    it('should return the same generic message without persisting or sending email when user is not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      const result = await service.forgotPassword('notfound@test.com');
      await flushBackgroundWork();

      expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetCode).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });

    it('should answer the same way for a registered and an unknown e-mail', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
      const registered = await service.forgotPassword('user@test.com');

      jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(null);
      const unknown = await service.forgotPassword('notfound@test.com');

      expect(registered).toEqual(unknown);
    });

    it('should answer before the code e-mail is sent', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
      jest
        .spyOn(mailService, 'sendPasswordResetCode')
        .mockReturnValue(new Promise<void>(() => undefined));

      await expect(service.forgotPassword('user@test.com')).resolves.toEqual({
        message: genericMessage,
      });
    });

    it('should answer before the account lookup finishes', async () => {
      jest
        .spyOn(usersService, 'findOne')
        .mockReturnValue(new Promise(() => undefined));

      await expect(service.forgotPassword('user@test.com')).resolves.toEqual({
        message: genericMessage,
      });
      expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
    });

    it('should not propagate email sending failures', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
      jest
        .spyOn(mailService, 'sendPasswordResetCode')
        .mockRejectedValue(new Error('SMTP indisponível'));

      const result = await service.forgotPassword('user@test.com');
      await flushBackgroundWork();

      expect(result).toEqual({ message: genericMessage });
    });
  });

  describe('logs de autenticação', () => {
    // Os logs vão para o stdout do container, fora do controle de acesso do
    // sistema, e o e-mail identifica estudantes. O id do usuário basta para
    // correlacionar os eventos de uma conta.
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;

    beforeEach(() => {
      const logger = (service as unknown as { logger: Logger }).logger;
      warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
      error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const loggedText = () =>
      JSON.stringify([...warn.mock.calls, ...error.mock.calls]);

    it('should identify the account by id when the login is refused by the lock', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.signIn('user@test.com', 'plainPassword'),
      ).rejects.toThrow(UnauthorizedException);

      expect(warn).toHaveBeenCalledWith(
        `Tentativa de login recusada, conta bloqueada: usuário ${mockUser.id}`,
      );
      expect(loggedText()).not.toContain(mockUser.email);
    });

    it('should identify the account by id on a failed attempt and on the lock', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-23T12:00:00.000Z'));

      try {
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.signIn('user@test.com', 'wrongPassword'),
        ).rejects.toThrow(UnauthorizedException);

        expect(warn).toHaveBeenCalledWith(
          `Falha de login 1/5: usuário ${mockUser.id}`,
        );

        jest
          .spyOn(usersService, 'findOne')
          .mockResolvedValue({ ...mockUser, failed_login_attempts: 4 });
        jest
          .spyOn(mailService, 'sendAccountLockedNotice')
          .mockRejectedValue(new Error('SMTP indisponível'));

        await expect(
          service.signIn('user@test.com', 'wrongPassword'),
        ).rejects.toThrow(UnauthorizedException);

        expect(warn).toHaveBeenCalledWith(
          `Conta bloqueada até 2026-08-23T12:15:00.000Z: usuário ${mockUser.id}`,
        );
        expect(error).toHaveBeenCalledWith(
          `Falha ao enviar aviso de bloqueio do usuário ${mockUser.id}`,
          expect.anything(),
        );
        expect(loggedText()).not.toContain(mockUser.email);
      } finally {
        jest.useRealTimers();
      }
    });

    it('should identify the account by id when the recovery e-mail fails', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
      jest
        .spyOn(mailService, 'sendPasswordResetCode')
        .mockRejectedValue(new Error('SMTP indisponível'));

      await service.forgotPassword('user@test.com');
      await flushBackgroundWork();

      expect(error).toHaveBeenCalledWith(
        `Falha ao enviar e-mail de recuperação de senha do usuário ${mockUser.id}`,
        expect.anything(),
      );
      expect(loggedText()).not.toContain(mockUser.email);
    });

    it.each([
      ['the account lookup', 'findOne'],
      ['the code storage', 'setPasswordResetToken'],
    ] as const)(
      'should log a failure in %s without the e-mail and keep the answer',
      async (_, method) => {
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashedCode');
        jest
          .spyOn(usersService, method)
          .mockRejectedValue(new Error('banco indisponível'));

        await expect(service.forgotPassword('user@test.com')).resolves.toEqual({
          message:
            'Se o e-mail informado estiver cadastrado, um código de recuperação foi enviado.',
        });
        await flushBackgroundWork();

        expect(error).toHaveBeenCalledWith(
          'Falha ao processar pedido de recuperação de senha',
          expect.anything(),
        );
        expect(loggedText()).not.toContain(mockUser.email);
      },
    );

    it('should identify the account by id when the Google login is refused by the lock', async () => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const originalFetch = globalThis.fetch;
      process.env.GOOGLE_CLIENT_ID = 'client-id';
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            aud: 'client-id',
            iss: 'https://accounts.google.com',
            email: mockUser.email,
            email_verified: true,
            sub: 'google-sub',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as typeof fetch;

      try {
        jest.spyOn(usersService, 'findByGoogleSub').mockResolvedValue({
          ...mockUser,
          google_sub: 'google-sub',
          locked_until: new Date(Date.now() + 10 * 60 * 1000),
        });

        await expect(service.signInWithGoogle('credencial')).rejects.toThrow(
          UnauthorizedException,
        );

        expect(warn).toHaveBeenCalledWith(
          `Tentativa de login com Google recusada, conta bloqueada: usuário ${mockUser.id}`,
        );
        expect(loggedText()).not.toContain(mockUser.email);
      } finally {
        globalThis.fetch = originalFetch;
        if (clientId === undefined) {
          delete process.env.GOOGLE_CLIENT_ID;
        } else {
          process.env.GOOGLE_CLIENT_ID = clientId;
        }
      }
    });
  });

  describe('verifyResetCode', () => {
    it('should resolve and keep the token when the code is valid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyResetCode('user@test.com', '123456');

      expect(usersService.reservePasswordResetAttempt).toHaveBeenCalledWith(
        'user@test.com',
        5,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashedCode');
      expect(usersService.releasePasswordResetAttempt).toHaveBeenCalledWith(
        'user@test.com',
      );
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

    it('should refuse without comparing the code when no attempt can be reserved', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUserWithResetToken,
        password_reset_expires: new Date(Date.now() - 1000),
      });
      jest
        .spyOn(usersService, 'reservePasswordResetAttempt')
        .mockResolvedValue(false);

      await expect(
        service.verifyResetCode('user@test.com', '123456'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should keep the reserved attempt and throw when the code is wrong', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.verifyResetCode('user@test.com', '000000'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(usersService.reservePasswordResetAttempt).toHaveBeenCalledWith(
        'user@test.com',
        5,
      );
      expect(usersService.releasePasswordResetAttempt).not.toHaveBeenCalled();
    });

    it('should not clear the code nor give the attempts back when the limit is reached', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...mockUserWithResetToken,
        password_reset_attempts: 5,
      });
      jest
        .spyOn(usersService, 'reservePasswordResetAttempt')
        .mockResolvedValue(false);

      await expect(
        service.verifyResetCode('user@test.com', '123456'),
      ).rejects.toThrow(new UnauthorizedException('Código inválido ou expirado.'));
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('should compare the code at most five times for ten parallel wrong guesses', async () => {
      let reservations = 0;
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUserWithResetToken);
      jest
        .spyOn(usersService, 'reservePasswordResetAttempt')
        .mockImplementation(async (_email, maxAttempts) => {
          await Promise.resolve();
          if (reservations >= maxAttempts) {
            return false;
          }
          reservations += 1;
          return true;
        });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const guesses = Array.from({ length: 10 }, (_, index) =>
        service.verifyResetCode('user@test.com', String(index).padStart(6, '0')),
      );
      await Promise.allSettled(guesses);

      expect(bcrypt.compare).toHaveBeenCalledTimes(5);
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

    it('should let a locked account sign in with the new password after the reset', async () => {
      const lockedUser = {
        ...mockUserWithResetToken,
        locked_until: new Date(Date.now() + 10 * 60 * 1000),
        login_lock_count: 1,
        failed_login_attempts: 0,
      };
      jest.spyOn(usersService, 'findOne').mockResolvedValue(lockedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');

      await service.resetPassword('user@test.com', '123456', 'novaSenha123');

      // updatePassword limpa locked_until, failed_login_attempts e
      // login_lock_count junto com a senha, então a conta volta a entrar.
      jest.spyOn(usersService, 'findOne').mockResolvedValue({
        ...lockedUser,
        password: 'newHashedPassword',
        locked_until: null,
        login_lock_count: 0,
      });

      const result = await service.signIn('user@test.com', 'novaSenha123');

      expect(result).toEqual({ access_token: 'mock.jwt.token' });
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

  describe('activateAccount', () => {
    const token = 'token-recebido-no-link';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const pendingUser = {
      ...mockUser,
      activation_token: tokenHash,
      activation_expires: new Date(Date.now() + 60 * 60 * 1000),
    };

    it('should look the account up by the token hash, never by the token', async () => {
      jest
        .spyOn(usersService, 'findByActivationToken')
        .mockResolvedValue(pendingUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');

      await service.activateAccount(token, 'novaSenha123');

      expect(usersService.findByActivationToken).toHaveBeenCalledWith(
        tokenHash,
      );
    });

    it('should store the chosen password, which also consumes the link', async () => {
      jest
        .spyOn(usersService, 'findByActivationToken')
        .mockResolvedValue(pendingUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');

      const result = await service.activateAccount(token, 'novaSenha123');

      expect(bcrypt.hash).toHaveBeenCalledWith('novaSenha123', 10);
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        pendingUser.email,
        'novoHash',
      );
      expect(result).toEqual({ message: 'Senha definida com sucesso.' });
    });

    it('should close the sessions opened before and not open a new one', async () => {
      jest
        .spyOn(usersService, 'findByActivationToken')
        .mockResolvedValue(pendingUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('novoHash');

      await service.activateAccount(token, 'novaSenha123');

      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(
        pendingUser.id,
      );
      expect(sessionsService.create).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should refuse a token that does not match any account', async () => {
      jest
        .spyOn(usersService, 'findByActivationToken')
        .mockResolvedValue(null);

      await expect(
        service.activateAccount('token-qualquer', 'novaSenha123'),
      ).rejects.toThrow(new UnauthorizedException('Link inválido ou expirado.'));
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('should refuse an expired link with the same message', async () => {
      jest.spyOn(usersService, 'findByActivationToken').mockResolvedValue({
        ...pendingUser,
        activation_expires: new Date(Date.now() - 1000),
      });

      await expect(
        service.activateAccount(token, 'novaSenha123'),
      ).rejects.toThrow(new UnauthorizedException('Link inválido ou expirado.'));
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('should refuse a token stored without a deadline', async () => {
      jest.spyOn(usersService, 'findByActivationToken').mockResolvedValue({
        ...pendingUser,
        activation_expires: null,
      });

      await expect(
        service.activateAccount(token, 'novaSenha123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('senha comum ou vazada', () => {
    const compromised = () =>
      jest
        .spyOn(compromisedPasswordService, 'assertNotCompromised')
        .mockRejectedValue(
          new BadRequestException(COMPROMISED_PASSWORD_MESSAGE),
        );

    describe('activateAccount', () => {
      const token = 'token-recebido-no-link';
      const pendingUser = {
        ...mockUser,
        activation_token: createHash('sha256').update(token).digest('hex'),
        activation_expires: new Date(Date.now() + 60 * 60 * 1000),
      };

      it('should check the chosen password and keep the link when it is refused', async () => {
        jest
          .spyOn(usersService, 'findByActivationToken')
          .mockResolvedValue(pendingUser);
        compromised();

        await expect(
          service.activateAccount(token, 'password123'),
        ).rejects.toThrow(new BadRequestException(COMPROMISED_PASSWORD_MESSAGE));
        expect(
          compromisedPasswordService.assertNotCompromised,
        ).toHaveBeenCalledWith('password123');
        expect(usersService.updatePassword).not.toHaveBeenCalled();
      });

      it('should not check the password of an invalid link', async () => {
        jest
          .spyOn(usersService, 'findByActivationToken')
          .mockResolvedValue(null);

        await expect(
          service.activateAccount('token-qualquer', 'novaSenha123'),
        ).rejects.toThrow(UnauthorizedException);
        expect(
          compromisedPasswordService.assertNotCompromised,
        ).not.toHaveBeenCalled();
      });
    });

    describe('resetPassword', () => {
      it('should check the new password and keep the old one when it is refused', async () => {
        jest
          .spyOn(usersService, 'findOne')
          .mockResolvedValue(mockUserWithResetToken);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        compromised();

        await expect(
          service.resetPassword('user@test.com', '123456', 'password123'),
        ).rejects.toThrow(new BadRequestException(COMPROMISED_PASSWORD_MESSAGE));
        expect(
          compromisedPasswordService.assertNotCompromised,
        ).toHaveBeenCalledWith('password123');
        expect(usersService.updatePassword).not.toHaveBeenCalled();
      });

      it('should not check the password when the code is wrong', async () => {
        jest
          .spyOn(usersService, 'findOne')
          .mockResolvedValue(mockUserWithResetToken);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.resetPassword('user@test.com', '000000', 'novaSenha123'),
        ).rejects.toThrow(UnauthorizedException);
        expect(
          compromisedPasswordService.assertNotCompromised,
        ).not.toHaveBeenCalled();
      });
    });

    describe('updateProfile', () => {
      it('should check the new password and keep the current one when it is refused', async () => {
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock)
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);
        compromised();

        await expect(
          service.updateProfile('user@test.com', {
            password: 'password123',
            currentPassword: 'senhaAtual123',
          }),
        ).rejects.toThrow(new BadRequestException(COMPROMISED_PASSWORD_MESSAGE));
        expect(
          compromisedPasswordService.assertNotCompromised,
        ).toHaveBeenCalledWith('password123');
        expect(usersService.updateProfile).not.toHaveBeenCalled();
      });

      it('should not check anything when the current password is wrong', async () => {
        jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.updateProfile('user@test.com', {
            password: 'novaSenha123',
            currentPassword: 'senhaErrada',
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(
          compromisedPasswordService.assertNotCompromised,
        ).not.toHaveBeenCalled();
      });

      it('should not check a password when only the e-mail changes', async () => {
        jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(mockUser);
        jest.spyOn(usersService, 'findOne').mockResolvedValueOnce(null);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        jest
          .spyOn(usersService, 'updateProfile')
          .mockResolvedValue({ ...mockUser, email: 'novo@test.com' });

        await service.updateProfile('user@test.com', {
          email: 'novo@test.com',
          currentPassword: 'senhaAtual123',
        });

        expect(
          compromisedPasswordService.assertNotCompromised,
        ).not.toHaveBeenCalled();
      });
    });
  });

  describe('cadastro pendente da conta criada pelo Google', () => {
    const googleUser = {
      ...mockUser,
      email: 'aluno@discente.ifpe.edu.br',
      cpf: 'google:1234567890',
    };
    const dto = { cpf: '01234567890', password: 'senhaNovaSegura1' };

    it('should mark the token of an account that still has the Google placeholder', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(googleUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn(googleUser.email, 'senhaDefinidaPorRecuperacao');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ must_complete_registration: true }),
      );
    });

    it('should not mark the token of an account with a real CPF', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.signIn(mockUser.email, 'plainPassword');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ must_complete_registration: false }),
      );
    });

    it('should store the CPF and the password and issue a token without the mark', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(googleUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('senhaHash');
      jest
        .spyOn(usersService, 'completeGoogleRegistration')
        .mockResolvedValue({ ...googleUser, cpf: dto.cpf });

      const result = await service.completeRegistration(googleUser.email, dto, {
        ip: '10.0.0.1',
        userAgent: 'jest',
      });

      expect(
        compromisedPasswordService.assertNotCompromised,
      ).toHaveBeenCalledWith(dto.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(usersService.completeGoogleRegistration).toHaveBeenCalledWith(
        googleUser.email,
        dto.cpf,
        'senhaHash',
      );
      expect(sessionsService.revokeAllFromUser).toHaveBeenCalledWith(
        googleUser.id,
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ must_complete_registration: false }),
      );
      expect(result).toEqual({ access_token: 'mock.jwt.token' });
    });

    it('should refuse an account whose registration is already complete', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);

      await expect(
        service.completeRegistration(mockUser.email, dto),
      ).rejects.toThrow(
        new BadRequestException('O cadastro desta conta já está completo.'),
      );
      expect(usersService.completeGoogleRegistration).not.toHaveBeenCalled();
    });

    it('should refuse when the account of the token no longer exists', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(
        service.completeRegistration(googleUser.email, dto),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.completeGoogleRegistration).not.toHaveBeenCalled();
    });

    it('should keep the account pending when the password is common or breached', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(googleUser);
      jest
        .spyOn(compromisedPasswordService, 'assertNotCompromised')
        .mockRejectedValue(
          new BadRequestException(COMPROMISED_PASSWORD_MESSAGE),
        );

      await expect(
        service.completeRegistration(googleUser.email, {
          ...dto,
          password: 'password123',
        }),
      ).rejects.toThrow(new BadRequestException(COMPROMISED_PASSWORD_MESSAGE));
      expect(usersService.completeGoogleRegistration).not.toHaveBeenCalled();
    });

    it('should propagate the conflict when the CPF belongs to another account', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(googleUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('senhaHash');
      jest
        .spyOn(usersService, 'completeGoogleRegistration')
        .mockRejectedValue(
          new ConflictException(
            'Este CPF já está cadastrado. Procure o administrador.',
          ),
        );

      await expect(
        service.completeRegistration(googleUser.email, dto),
      ).rejects.toThrow(ConflictException);
      expect(sessionsService.create).not.toHaveBeenCalled();
    });
  });
});
