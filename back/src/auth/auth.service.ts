import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async signIn(email: string, password: string): Promise<any> {
    const user = await this.userService.findOne(email);
    if (!user) {
      throw new UnauthorizedException('usuário não encontrado');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('credenciais inválidas');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.full_name,
      id_level: user.id_level,
      must_change_password: user.must_change_password,
    };

    const token = {
      access_token: await this.jwtService.signAsync(payload),
    };
    return token;
  }

  // Permite que qualquer usuário autenticado altere o próprio e-mail e/ou senha.
  // A identidade vem do token (currentEmail), nunca do corpo da requisição.
  async updateProfile(
    currentEmail: string,
    dto: UpdateProfileDto,
  ): Promise<{ access_token: string }> {
    const user = await this.userService.findOne(currentEmail);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    // Quem está no primeiro acesso não pode alterar só o e-mail e seguir usando
    // a senha que o administrador cadastrou.
    if (user.must_change_password && !dto.password) {
      throw new BadRequestException(
        'É obrigatório definir uma nova senha no primeiro acesso.',
      );
    }

    // Sem esta checagem o usuário "troca" a senha pela mesma e o administrador
    // continua conhecendo a credencial em uso.
    if (dto.password && (await bcrypt.compare(dto.password, user.password))) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    const newEmail = dto.email?.trim();
    const isChangingEmail = !!newEmail && newEmail !== currentEmail;

    if (isChangingEmail) {
      const existing = await this.userService.findOne(newEmail);
      if (existing) {
        throw new ConflictException('Este e-mail já está em uso.');
      }
    }

    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const updated = await this.userService.updateProfile(currentEmail, {
      newEmail: isChangingEmail ? newEmail : undefined,
      hashedPassword,
    });

    const payload = {
      sub: updated.id,
      email: updated.email,
      name: updated.full_name,
      id_level: updated.id_level,
      must_change_password: updated.must_change_password,
    };

    return { access_token: await this.jwtService.signAsync(payload) };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'Se o e-mail informado estiver cadastrado, um código de recuperação foi enviado.',
    };

    const user = await this.userService.findOne(email);
    if (!user) {
      return genericResponse;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

    await this.userService.setPasswordResetToken(email, tokenHash, expiresAt);

    try {
      await this.mailService.sendPasswordResetCode(email, code);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de recuperação de senha para ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return genericResponse;
  }

  async verifyResetCode(
    email: string,
    code: string,
  ): Promise<{ message: string }> {
    await this.validateResetCode(email, code);
    return { message: 'Código válido.' };
  }

  async resetPassword(
    email: string,
    code: string,
    password: string,
  ): Promise<{ message: string }> {
    await this.validateResetCode(email, code);

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userService.updatePassword(email, hashedPassword);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private async validateResetCode(email: string, code: string): Promise<void> {
    const invalidCodeException = new UnauthorizedException(
      'Código inválido ou expirado.',
    );

    const user = await this.userService.findOne(email);
    if (!user || !user.password_reset_token) {
      throw invalidCodeException;
    }

    if (user.password_reset_attempts >= MAX_RESET_ATTEMPTS) {
      await this.userService.clearPasswordResetToken(email);
      throw invalidCodeException;
    }

    if (
      !user.password_reset_expires ||
      user.password_reset_expires < new Date()
    ) {
      throw invalidCodeException;
    }

    const isCodeValid = await bcrypt.compare(code, user.password_reset_token);
    if (!isCodeValid) {
      await this.userService.incrementPasswordResetAttempts(email);
      throw invalidCodeException;
    }
  }
}
