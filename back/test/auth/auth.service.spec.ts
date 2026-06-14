import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    email: 'user@test.com',
    password: 'hashedPassword',
    full_name: 'Test User',
    id_level: 2,
    cpf: '12345678900',
    affliation: 'Test',
    pedagogical_manager: 'Manager',
    id_current_phase: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signIn', () => {
    it('should return an access token when credentials are valid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(true);

      const result = await service.signIn('user@test.com', 'plainPassword');

      expect(usersService.findOne).toHaveBeenCalledWith('user@test.com');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.full_name,
        id_level: mockUser.id_level,
      });
      expect(result).toEqual({ access_token: 'mock.jwt.token' });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(null);

      await expect(service.signIn('notfound@test.com', 'anyPassword')).rejects.toThrow(
        new UnauthorizedException('usuário não encontrado'),
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      jest.spyOn(usersService, 'findOne').mockResolvedValue(mockUser);
      jest.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(service.signIn('user@test.com', 'wrongPassword')).rejects.toThrow(
        new UnauthorizedException('credenciais inválidas'),
      );
    });
  });
});
