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
import { randomInt, randomUUID } from 'node:crypto';
import { SessionsService } from 'src/sessions/sessions.service';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

// Resposta única para qualquer falha de autenticação. Mensagens distintas para
// e-mail inexistente e senha incorreta revelam quais contas existem.
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

// Hash bcrypt (custo 10, o mesmo usado nas senhas reais) de uma senha aleatória
// descartável. Serve para que o caminho de e-mail inexistente pague o mesmo custo
// de CPU do caminho de senha incorreta: sem essa comparação, a diferença de tempo
// de resposta distingue os dois casos mesmo com a mensagem unificada.
const NON_EXISTENT_USER_PASSWORD_HASH =
  '$2b$10$iMrrGyWs8x9.Ue/VXnHYlORQpzM/P9Hm0ETaQYvUpIc5i0.3SvKt2';

export type SessionContext = {
  ip?: string | null;
  userAgent?: string | null;
};

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private sessionsService: SessionsService,
  ) {}

  async signIn(
    email: string,
    password: string,
    context?: SessionContext,
  ): Promise<any> {
    const user = await this.userService.findOne(email);

    // A comparação roda antes de qualquer decisão para que conta inexistente,
    // senha incorreta e conta bloqueada custem o mesmo tempo de resposta.
    const isPasswordValid = await bcrypt.compare(
      password,
      user?.password ?? NON_EXISTENT_USER_PASSWORD_HASH,
    );

    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (this.isLocked(user)) {
      this.logger.warn(
        `Tentativa de login recusada, conta bloqueada: ${user.email}`,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!isPasswordValid) {
      await this.registerFailedLogin(user);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.failed_login_attempts > 0 || user.login_lock_count > 0) {
      await this.userService.clearLoginLock(user.email);
    }

    return this.issueSessionToken(user, context);
  }

  async logout(jti: string): Promise<{ message: string }> {
    await this.sessionsService.revokeByJti(jti);
    return { message: 'Sessão encerrada.' };
  }

  // Um login novo derruba as sessões anteriores da conta. Sem isso a mesma
  // credencial fica em uso simultâneo em vários lugares sem que ninguém perceba,
  // e o token antigo continua válido até vencer.
  private async issueSessionToken(
    user: {
      id: number;
      email: string;
      full_name: string;
      id_level: number;
      must_change_password: boolean;
    },
    context?: SessionContext,
  ): Promise<{ access_token: string }> {
    await this.sessionsService.revokeAllFromUser(user.id);

    const jti = randomUUID();

    await this.sessionsService.create({
      jti: jti,
      id_user: user.id,
      ip: context?.ip,
      user_agent: context?.userAgent,
    });

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.full_name,
      id_level: user.id_level,
      must_change_password: user.must_change_password,
      jti: jti,
    };

    return { access_token: await this.jwtService.signAsync(payload) };
  }

  private isLocked(user: { locked_until: Date | null }): boolean {
    return !!user.locked_until && user.locked_until > new Date();
  }

  // O bloqueio dobra a cada reincidência para encarecer o ataque sem prender o
  // usuário legítimo por tempo indeterminado: 15 minutos, 30, 60, e daí em
  // diante o teto de 1 hora. Um login bem-sucedido devolve a duração ao início.
  private lockDuration(previousLocks: number): number {
    return Math.min(BASE_LOCK_MS * 2 ** previousLocks, MAX_LOCK_MS);
  }

  private async registerFailedLogin(user: {
    email: string;
    failed_login_attempts: number;
    login_lock_count: number;
  }): Promise<void> {
    const attempts = user.failed_login_attempts + 1;

    if (attempts < MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.userService.registerFailedLoginAttempt(user.email);
      this.logger.warn(
        `Falha de login ${attempts}/${MAX_FAILED_LOGIN_ATTEMPTS}: ${user.email}`,
      );
      return;
    }

    const lockedUntil = new Date(
      Date.now() + this.lockDuration(user.login_lock_count),
    );

    await this.userService.lockAccount(user.email, lockedUntil);
    this.logger.warn(
      `Conta bloqueada até ${lockedUntil.toISOString()}: ${user.email}`,
    );

    // O aviso vai por e-mail porque a resposta HTTP é genérica: informar o
    // bloqueio ali revelaria que aquele e-mail existe. Falha de envio não pode
    // derrubar o login, mesmo tratamento de forgotPassword.
    try {
      await this.mailService.sendAccountLockedNotice(user.email, lockedUntil);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar aviso de bloqueio para ${user.email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Permite que qualquer usuário autenticado altere o próprio e-mail e/ou senha.
  // A identidade vem do token (currentEmail), nunca do corpo da requisição.
  async updateProfile(
    currentEmail: string,
    dto: UpdateProfileDto,
    context?: SessionContext,
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

    // Trocar e-mail ou senha encerra as sessões abertas antes da mudança: quem
    // usava a credencial antiga perde o acesso, e quem alterou continua com o
    // token novo devolvido aqui.
    return this.issueSessionToken(updated, context);
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
    const user = await this.validateResetCode(email, code);

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userService.updatePassword(email, hashedPassword);

    // Quem redefine a senha normalmente perdeu o controle da conta, então todas
    // as sessões abertas caem, inclusive as de quem estava usando a senha antiga.
    await this.sessionsService.revokeAllFromUser(user.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private async validateResetCode(email: string, code: string) {
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

    return user;
  }
}
