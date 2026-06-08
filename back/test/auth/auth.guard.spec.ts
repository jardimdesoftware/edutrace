import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from 'src/auth/auth.guard';

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

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

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
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
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

    it('should throw UnauthorizedException when level is restricted', async () => {
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
        new UnauthorizedException('Nível de acesso insuficiente'),
      );
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

    it('should throw UnauthorizedException when authorization scheme is not Bearer', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = createMockExecutionContext({
        authorization: 'Basic c29tZXRva2Vu',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
