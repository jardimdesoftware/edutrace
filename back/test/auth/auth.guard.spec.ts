import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from 'src/auth/auth.guard';
import { ALLOW_PASSWORD_CHANGE_KEY } from 'src/auth/decorators/allow-password-change.decorator';
import { ALLOW_INCOMPLETE_REGISTRATION_KEY } from 'src/auth/decorators/allow-incomplete-registration.decorator';
import { SessionsService } from 'src/sessions/sessions.service';

function createMockExecutionContext(
  headers: Record<string, string> = {},
  handlerMetadata: Record<string, any> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

const sessaoAtiva = {
  id: 1,
  jti: 'sessao-valida',
  id_user: 1,
  ip: null,
  user_agent: null,
  created_at: new Date(),
  last_used_at: new Date(),
  revoked_at: null,
  user: { id_level: 2 },
};

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;
  let sessionsService: SessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            findActive: jest.fn(),
            registerUse: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
    sessionsService = module.get<SessionsService>(SessionsService);

    // Cada teste que chega a validar o token precisa de uma sessão ativa; os
    // casos de sessão encerrada sobrescrevem este retorno.
    jest
      .spyOn(sessionsService, 'findActive')
      .mockResolvedValue(sessaoAtiva as never);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should reject a token whose session was revoked', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ sub: 1, id_level: 1, jti: 'sessao-revogada' });
      jest.spyOn(sessionsService, 'findActive').mockResolvedValue(null);

      const context = createMockExecutionContext({
        authorization: 'Bearer token-valido',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Sessão encerrada'),
      );
    });

    it('should register the use of an active session', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ sub: 1, id_level: 1, jti: 'sessao-valida' });

      const context = createMockExecutionContext({
        authorization: 'Bearer token-valido',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(sessionsService.findActive).toHaveBeenCalledWith('sessao-valida');
      expect(sessionsService.registerUse).toHaveBeenCalledWith(sessaoAtiva);
    });

    it('should allow access to public routes without token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow access with a valid token and no level restriction', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 2 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue([]);

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(payload);
    });

    it('should use fallback empty array when reflector.get returns undefined', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 2 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('invalid token'));

      const context = createMockExecutionContext({
        authorization: 'Bearer invalid.token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token expirado'),
      );
    });

    it('should throw ForbiddenException when level is restricted', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 2 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue([2]);

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Nível de acesso insuficiente'),
      );
    });

    it('should answer level restriction with 403, not 401', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 2 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue([2]);

      const context = createMockExecutionContext({
        authorization: 'Bearer valid.token',
      });

      // O cliente encerra a sessão em qualquer 401 de chamada autenticada, então
      // o status aqui decide entre mostrar o erro e derrubar o usuário do sistema.
      const erro: ForbiddenException = await guard
        .canActivate(context)
        .then(() => null as never)
        .catch((e: ForbiddenException) => e);

      expect(erro.getStatus()).toBe(403);
      expect(erro).not.toBeInstanceOf(UnauthorizedException);
    });

    it('should allow access when user level is not in the restricted list', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 3 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue([2]);
      jest
        .spyOn(sessionsService, 'findActive')
        .mockResolvedValue({ ...sessaoAtiva, user: { id_level: 3 } } as never);

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(payload);
    });

    it('should block any route when the user still must change the password', async () => {
      const payload = {
        sub: 1,
        email: 'user@test.com',
        id_level: 2,
        must_change_password: true,
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      (reflector.get as jest.Mock).mockImplementation((key: string) =>
        key === ALLOW_PASSWORD_CHANGE_KEY ? undefined : [],
      );

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Defina uma nova senha antes de continuar.'),
      );
    });

    it('should allow routes marked with AllowPasswordChange during the first access', async () => {
      const payload = {
        sub: 1,
        email: 'user@test.com',
        id_level: 2,
        must_change_password: true,
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      (reflector.get as jest.Mock).mockImplementation((key: string) =>
        key === ALLOW_PASSWORD_CHANGE_KEY ? true : [],
      );

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should not block when must_change_password is false', async () => {
      const payload = {
        sub: 1,
        email: 'user@test.com',
        id_level: 2,
        must_change_password: false,
      };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      (reflector.get as jest.Mock).mockImplementation((key: string) =>
        key === ALLOW_PASSWORD_CHANGE_KEY ? undefined : [],
      );

      const mockRequest: any = {
        headers: { authorization: 'Bearer valid.token' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    describe('cadastro pendente da conta criada pelo Google', () => {
      const payload = {
        sub: 1,
        email: 'aluno@discente.ifpe.edu.br',
        id_level: 2,
        must_change_password: false,
        must_complete_registration: true,
      };

      const contextWith = (metadata: Record<string, unknown>) => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
        (reflector.get as jest.Mock).mockImplementation((key: string) =>
          key in metadata ? metadata[key] : key === 'levels' ? [] : undefined,
        );

        const mockRequest: any = {
          headers: { authorization: 'Bearer valid.token' },
        };
        return {
          switchToHttp: () => ({ getRequest: () => mockRequest }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as any;
      };

      it('should block any route until the CPF and the password are registered', async () => {
        await expect(guard.canActivate(contextWith({}))).rejects.toThrow(
          new ForbiddenException(
            'Cadastre o CPF e a senha antes de continuar.',
          ),
        );
      });

      it('should not open the routes reserved for the first password change', async () => {
        await expect(
          guard.canActivate(contextWith({ [ALLOW_PASSWORD_CHANGE_KEY]: true })),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should allow routes marked with AllowIncompleteRegistration', async () => {
        await expect(
          guard.canActivate(
            contextWith({ [ALLOW_INCOMPLETE_REGISTRATION_KEY]: true }),
          ),
        ).resolves.toBe(true);
      });
    });

    it('should throw UnauthorizedException when authorization scheme is not Bearer', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = createMockExecutionContext({
        authorization: 'Basic c29tZXRva2Vu',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('session cookie', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    function contextWithRequest(
      request: Record<string, any>,
    ): ExecutionContext {
      return {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;
    }

    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ sub: 1, id_level: 1, jti: 'sessao-valida' });
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should read the token from the session cookie', async () => {
      const request = {
        headers: {},
        cookies: { edutrace_session: 'token.do.cookie' },
      };

      await expect(
        guard.canActivate(contextWithRequest(request)),
      ).resolves.toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'token.do.cookie',
        expect.any(Object),
      );
      expect(request).toHaveProperty('user.jti', 'sessao-valida');
    });

    it('should read the __Host- cookie in production', async () => {
      process.env.NODE_ENV = 'production';
      const request = {
        headers: {},
        cookies: { '__Host-edutrace_session': 'token.de.producao' },
      };

      await expect(
        guard.canActivate(contextWithRequest(request)),
      ).resolves.toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'token.de.producao',
        expect.any(Object),
      );
    });

    it('should prefer the cookie over the Authorization header', async () => {
      const request = {
        headers: { authorization: 'Bearer token.do.header' },
        cookies: { edutrace_session: 'token.do.cookie' },
      };

      await guard.canActivate(contextWithRequest(request));

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'token.do.cookie',
        expect.any(Object),
      );
    });

    it('should still accept the Bearer header when there is no session cookie', async () => {
      const request = {
        headers: { authorization: 'Bearer token.do.header' },
        cookies: {},
      };

      await expect(
        guard.canActivate(contextWithRequest(request)),
      ).resolves.toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'token.do.header',
        expect.any(Object),
      );
    });

    it('should reject a request whose only cookie has another name', async () => {
      const request = { headers: {}, cookies: { token: 'token.antigo' } };

      await expect(
        guard.canActivate(contextWithRequest(request)),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });

  // A autorização usa o nível gravado no banco, e não o claim do token: com o
  // SECRET_KEY conhecido, um token reassinado com outro id_level e o jti de
  // uma sessão válida passaria como administrador.
  describe('identidade da sessão', () => {
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer token-valido' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    });

    it('should put the level stored in the database in request.user', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 1,
        jti: 'sessao-valida',
        email: 'estudante@test.com',
        id_level: 1,
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toEqual(
        expect.objectContaining({ sub: 1, id_level: 2 }),
      );
    });

    it('should check the blocked levels against the level stored in the database', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 1,
        jti: 'sessao-valida',
        id_level: 1,
      });
      jest
        .spyOn(reflector, 'get')
        .mockImplementation((key: unknown) =>
          key === 'levels' ? [2] : undefined,
        );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should refuse a token whose sub is not the owner of the session', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 99,
        jti: 'sessao-valida',
        id_level: 1,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
