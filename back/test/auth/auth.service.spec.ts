import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

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
    id_current_phase: 1,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

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
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.signIn('user@test.com', 'wrongPassword')).rejects.toThrow(
        new UnauthorizedException('credenciais inválidas'),
      );
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
