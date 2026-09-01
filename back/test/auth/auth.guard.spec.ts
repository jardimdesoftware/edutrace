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

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access with a valid token and no level restriction', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 2 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue([]);

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
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

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
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
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('invalid token'));

      const context = createMockExecutionContext({ authorization: 'Bearer invalid.token' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException('Token expirado'),
      );
    });

    it('should throw ForbiddenException when level is restricted', async () => {
      const payload = { sub: 1, email: 'user@test.com', id_level: 2 };
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(reflector, 'get').mockReturnValue([2]);

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
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

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
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

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
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

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
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

      const mockRequest: any = { headers: { authorization: 'Bearer valid.token' } };
      const context = {
        switchToHttp: () => ({ getRequest: () => mockRequest }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when authorization scheme is not Bearer', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = createMockExecutionContext({
        authorization: 'Basic c29tZXRva2Vu',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
