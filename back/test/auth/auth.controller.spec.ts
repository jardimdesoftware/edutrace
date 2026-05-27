import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
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

  describe('signIn', () => {
    it('should return an access token on valid credentials', async () => {
      const authDto = { email: 'user@test.com', password: 'password123' };
      const token = { access_token: 'mock.jwt.token' };

      jest.spyOn(service, 'signIn').mockResolvedValue(token);

      const result = await controller.signIn(authDto);

      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password);
      expect(result).toEqual(token);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const authDto = { email: 'unknown@test.com', password: 'password123' };

      jest
        .spyOn(service, 'signIn')
        .mockRejectedValue(new UnauthorizedException('usuário não encontrado'));

      await expect(controller.signIn(authDto)).rejects.toThrow(UnauthorizedException);
      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const authDto = { email: 'user@test.com', password: 'wrongpassword' };

      jest
        .spyOn(service, 'signIn')
        .mockRejectedValue(new UnauthorizedException('credenciais inválidas'));

      await expect(controller.signIn(authDto)).rejects.toThrow(UnauthorizedException);
      expect(service.signIn).toHaveBeenCalledWith(authDto.email, authDto.password);
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
