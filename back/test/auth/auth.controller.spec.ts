import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from 'src/auth/auth.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from 'src/auth/auth.service';
import { AuthGuard } from 'src/auth/auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn: jest.fn(),
            logout: jest.fn(),
            forgotPassword: jest.fn(),
            verifyResetCode: jest.fn(),
            resetPassword: jest.fn(),
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

  describe('signIn', () => {
    it('should return an access token on valid credentials', async () => {
      const authDto = { email: 'user@test.com', password: 'password123' };
      const token = { access_token: 'mock.jwt.token' };

      jest.spyOn(service, 'signIn').mockResolvedValue(token);

      const result = await controller.signIn(authDto, requestFalso);

      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password, {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
      expect(result).toEqual(token);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const authDto = { email: 'unknown@test.com', password: 'password123' };

      jest
        .spyOn(service, 'signIn')
        .mockRejectedValue(new UnauthorizedException('E-mail ou senha inválidos.'));

      await expect(controller.signIn(authDto, requestFalso)).rejects.toThrow(UnauthorizedException);
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

      await expect(controller.signIn(authDto, requestFalso)).rejects.toThrow(UnauthorizedException);
      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password, {
        ip: requestFalso.ip,
        userAgent: requestFalso.headers['user-agent'],
      });
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
