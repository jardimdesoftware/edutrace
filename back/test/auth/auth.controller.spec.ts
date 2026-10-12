import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { AuthGuard } from 'src/auth/auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn: jest.fn(),
            signInWithGoogle: jest.fn(),
            updateProfile: jest.fn(),
            logout: jest.fn(),
            forgotPassword: jest.fn(),
            verifyResetCode: jest.fn(),
            resetPassword: jest.fn(),
            activateAccount: jest.fn(),
            completeRegistration: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const requestFalso = {
    ip: '10.0.0.1',
    headers: { 'user-agent': 'jest' },
    user: { email: 'user@test.com', jti: 'sessao-1' },
  };

  const opcoesDoCookie = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
  };

  function criarRespostaFalsa() {
    return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
  }

  describe('signIn', () => {
    it('should put the token in the session cookie and not in the body', async () => {
      const authDto = { email: 'user@test.com', password: 'password123' };
      const resposta = criarRespostaFalsa();

      jest.spyOn(service, 'signIn').mockResolvedValue({ access_token: 'mock.jwt.token' });

      const result = await controller.signIn(authDto, requestFalso, resposta);

      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password, {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
      expect(resposta.cookie).toHaveBeenCalledWith(
        'edutrace_session',
        'mock.jwt.token',
        opcoesDoCookie,
      );
      expect(result).toEqual({ message: 'Sessão iniciada.' });
      expect(JSON.stringify(result)).not.toContain('mock.jwt.token');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const authDto = { email: 'unknown@test.com', password: 'password123' };

      jest
        .spyOn(service, 'signIn')
        .mockRejectedValue(new UnauthorizedException('E-mail ou senha inválidos.'));

      const resposta = criarRespostaFalsa();
      await expect(controller.signIn(authDto, requestFalso, resposta)).rejects.toThrow(UnauthorizedException);
      expect(resposta.cookie).not.toHaveBeenCalled();
      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password, {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const authDto = { email: 'user@test.com', password: 'wrongpassword' };

      jest
        .spyOn(service, 'signIn')
        .mockRejectedValue(new UnauthorizedException('E-mail ou senha inválidos.'));

      const resposta = criarRespostaFalsa();
      await expect(controller.signIn(authDto, requestFalso, resposta)).rejects.toThrow(UnauthorizedException);
      expect(resposta.cookie).not.toHaveBeenCalled();
      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password, {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
    });
  });

  describe('signInWithGoogle', () => {
    it('should put the token in the session cookie and not in the body', async () => {
      const resposta = criarRespostaFalsa();
      jest
        .spyOn(service, 'signInWithGoogle')
        .mockResolvedValue({ access_token: 'google.jwt.token' });

      const result = await controller.signInWithGoogle(
        { credential: 'credencial-google' },
        requestFalso,
        resposta,
      );

      expect(service.signInWithGoogle).toHaveBeenCalledWith('credencial-google', {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
      expect(resposta.cookie).toHaveBeenCalledWith(
        'edutrace_session',
        'google.jwt.token',
        opcoesDoCookie,
      );
      expect(result).toEqual({ message: 'Sessão iniciada.' });
    });
  });

  describe('updateMe', () => {
    it('should replace the session cookie with the token issued after the update', async () => {
      const resposta = criarRespostaFalsa();
      const dto = { currentPassword: 'senhaAtual123', password: 'novaSenha123' };
      jest
        .spyOn(service, 'updateProfile')
        .mockResolvedValue({ access_token: 'novo.jwt.token' });

      const result = await controller.updateMe(requestFalso, dto, resposta);

      expect(service.updateProfile).toHaveBeenCalledWith('user@test.com', dto, {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
      expect(resposta.cookie).toHaveBeenCalledWith(
        'edutrace_session',
        'novo.jwt.token',
        opcoesDoCookie,
      );
      expect(result).toEqual({ message: 'Dados atualizados.' });
    });

    it('should keep the current cookie when the update fails', async () => {
      const resposta = criarRespostaFalsa();
      jest
        .spyOn(service, 'updateProfile')
        .mockRejectedValue(new UnauthorizedException('Senha atual incorreta'));

      await expect(
        controller.updateMe(requestFalso, { currentPassword: 'errada' }, resposta),
      ).rejects.toThrow(UnauthorizedException);
      expect(resposta.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the session and clear the session cookie', async () => {
      const resposta = criarRespostaFalsa();
      jest
        .spyOn(service, 'logout')
        .mockResolvedValue({ message: 'Sessão encerrada com sucesso.' });

      const result = await controller.logout(requestFalso, resposta);

      expect(service.logout).toHaveBeenCalledWith('sessao-1');
      expect(resposta.clearCookie).toHaveBeenCalledWith(
        'edutrace_session',
        opcoesDoCookie,
      );
      expect(result).toEqual({ message: 'Sessão encerrada com sucesso.' });
    });
  });

  describe('forgotPassword', () => {
    it('should delegate to the service and return its result', async () => {
      const dto = { email: 'user@test.com' };
      const response = {
        message:
          'Se o e-mail informado estiver cadastrado, um código de recuperação foi enviado.',
      };

      jest.spyOn(service, 'forgotPassword').mockResolvedValue(response);

      const result = await controller.forgotPassword(dto);

      expect(service.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual(response);
    });
  });

  describe('verifyResetCode', () => {
    it('should delegate to the service and return its result', async () => {
      const dto = { email: 'user@test.com', code: '123456' };
      const response = { message: 'Código válido.' };

      jest.spyOn(service, 'verifyResetCode').mockResolvedValue(response);

      const result = await controller.verifyResetCode(dto);

      expect(service.verifyResetCode).toHaveBeenCalledWith(dto.email, dto.code);
      expect(result).toEqual(response);
    });

    it('should propagate UnauthorizedException from the service', async () => {
      const dto = { email: 'user@test.com', code: '000000' };

      jest
        .spyOn(service, 'verifyResetCode')
        .mockRejectedValue(new UnauthorizedException('Código inválido ou expirado.'));

      await expect(controller.verifyResetCode(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.verifyResetCode).toHaveBeenCalledWith(dto.email, dto.code);
    });
  });

  describe('resetPassword', () => {
    it('should delegate to the service and return its result', async () => {
      const dto = {
        email: 'user@test.com',
        code: '123456',
        password: 'novaSenha123',
      };
      const response = { message: 'Senha redefinida com sucesso.' };

      jest.spyOn(service, 'resetPassword').mockResolvedValue(response);

      const result = await controller.resetPassword(dto);

      expect(service.resetPassword).toHaveBeenCalledWith(
        dto.email,
        dto.code,
        dto.password,
      );
      expect(result).toEqual(response);
    });

    it('should propagate UnauthorizedException from the service', async () => {
      const dto = {
        email: 'user@test.com',
        code: '000000',
        password: 'novaSenha123',
      };

      jest
        .spyOn(service, 'resetPassword')
        .mockRejectedValue(new UnauthorizedException('Código inválido ou expirado.'));

      await expect(controller.resetPassword(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('activateAccount', () => {
    it('should delegate to the service and return its result', async () => {
      const dto = { token: 'token-do-link', password: 'novaSenha123' };
      const response = { message: 'Senha definida com sucesso.' };

      jest.spyOn(service, 'activateAccount').mockResolvedValue(response);

      const result = await controller.activateAccount(dto);

      expect(service.activateAccount).toHaveBeenCalledWith(
        dto.token,
        dto.password,
      );
      expect(result).toEqual(response);
    });

    it('should propagate UnauthorizedException from the service', async () => {
      jest
        .spyOn(service, 'activateAccount')
        .mockRejectedValue(
          new UnauthorizedException('Link inválido ou expirado.'),
        );

      await expect(
        controller.activateAccount({
          token: 'token-vencido',
          password: 'novaSenha123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('completeRegistration', () => {
    const dto = { cpf: '01234567890', password: 'senhaNovaSegura1' };

    it('should replace the session cookie with the token issued after the registration', async () => {
      const resposta = criarRespostaFalsa();
      jest
        .spyOn(service, 'completeRegistration')
        .mockResolvedValue({ access_token: 'novo.jwt.token' });

      const result = await controller.completeRegistration(
        requestFalso,
        dto,
        resposta,
      );

      expect(service.completeRegistration).toHaveBeenCalledWith(
        'user@test.com',
        dto,
        { ip: requestFalso.ip, userAgent: requestFalso.headers['user-agent'] },
      );
      expect(resposta.cookie).toHaveBeenCalledWith(
        'edutrace_session',
        'novo.jwt.token',
        opcoesDoCookie,
      );
      expect(result).toEqual({ message: 'Cadastro concluído.' });
    });

    it('should keep the current cookie when the CPF belongs to another account', async () => {
      const resposta = criarRespostaFalsa();
      jest
        .spyOn(service, 'completeRegistration')
        .mockRejectedValue(
          new ConflictException(
            'Este CPF já está cadastrado. Procure o administrador.',
          ),
        );

      await expect(
        controller.completeRegistration(requestFalso, dto, resposta),
      ).rejects.toThrow(ConflictException);
      expect(resposta.cookie).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return the user from the request', () => {
      const mockRequest = {
        user: { sub: 1, email: 'user@test.com', name: 'Test User', id_level: 2 },
      } as any;

      const result = controller.getProfile(mockRequest);

      expect(result).toEqual(mockRequest.user);
    });

    it('should return the exact user object attached to the request', () => {
      const mockUser = { sub: 42, email: 'admin@test.com', name: 'Admin', id_level: 1 };
      const mockRequest = { user: mockUser } as any;

      const result = controller.getProfile(mockRequest);

      expect(result).toBe(mockRequest.user);
    });
  });
});
