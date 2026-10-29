import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'node:crypto';
import { get as httpsGet } from 'node:https';
import { SessionsService } from 'src/sessions/sessions.service';
import { hashActivationToken } from './activation-token';
import { CompromisedPasswordService } from './compromised-password.service';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { LinkGoogleAccountDto } from './dto/link-google-account.dto';
import {
  GOOGLE_ACCOUNT_IN_USE_MESSAGE,
  hasPendingGoogleRegistration,
} from 'src/users/google-account';

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

// Resposta única para qualquer falha de autenticação. Mensagens distintas para
// e-mail inexistente e senha incorreta revelam quais contas existem.
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

// O Google Workspace do IFPE é a autoridade sobre os endereços discentes, e os
// tokens desses endereços trazem o claim hd com o domínio. Sem hd, o Google não
// é autoridade pelo e-mail, que só foi confirmado quando a Conta Google foi
// criada.
const GOOGLE_DISCENTE_HOSTED_DOMAIN = 'discente.ifpe.edu.br';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_NOT_LINKED_MESSAGE =
  'Conta Google não vinculada. Entre com e-mail e senha e vincule a conta em Alterar meus dados.';
const GOOGLE_TOKENINFO_TIMEOUT_MS = 10_000;
const GOOGLE_TOKENINFO_MAX_RESPONSE_BYTES = 32 * 1024;

// Hash bcrypt (custo 10, o mesmo usado nas senhas reais) de uma senha aleatória
// descartável. Serve para que o caminho de e-mail inexistente pague o mesmo custo
// de CPU do caminho de senha incorreta: sem essa comparação, a diferença de tempo
// de resposta distingue os dois casos mesmo com a mensagem unificada.
// Não é credencial de nenhuma conta, por isso a regra de segredo do Semgrep é
// suprimida na linha do valor.
const NON_EXISTENT_USER_PASSWORD_HASH =
  // nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
  '$2b$10$iMrrGyWs8x9.Ue/VXnHYlORQpzM/P9Hm0ETaQYvUpIc5i0.3SvKt2';

export type SessionContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type GoogleTokenInfo = {
  aud?: string;
  iss?: string;
  email?: string;
  email_verified?: string | boolean;
  hd?: string;
  name?: string;
  sub?: string;
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
    private compromisedPasswordService: CompromisedPasswordService,
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
        `Tentativa de login recusada, conta bloqueada: usuário ${user.id}`,
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

  getGoogleConfig(): { enabled: boolean; clientId: string | null } {
    const clientId = process.env.GOOGLE_CLIENT_ID || null;
    return { enabled: !!clientId, clientId };
  }

  // A identidade Google é o sub do token, único entre as Contas Google e nunca
  // reaproveitado, e o login só abre a conta já vinculada a ele. Coincidência de
  // e-mail nunca abre nem vincula conta existente (OWASP Authentication Cheat
  // Sheet, Secure Federated Account Linking): quem cria uma Conta Google com o
  // e-mail de outra pessoa, num domínio que não é Gmail nem Workspace, recebe o
  // token com email_verified e entraria na conta dela.
  async signInWithGoogle(
    credential: string,
    context?: SessionContext,
  ): Promise<{ access_token: string }> {
    const tokenInfo = await this.verifyGoogleCredential(credential);
    const email = tokenInfo.email?.trim().toLowerCase();
    const sub = tokenInfo.sub;

    if (!email || !sub) {
      throw new UnauthorizedException('Credencial do Google inválida.');
    }

    let user: Awaited<ReturnType<UsersService['findByGoogleSub']>>;

    try {
      user =
        (await this.userService.findByGoogleSub(sub)) ??
        (await this.createGoogleStudent(email, sub, tokenInfo));
    } catch (error) {
      this.throwIfDatabaseUnavailable(error);
      throw error;
    }

    // Mesma resposta para e-mail cadastrado e não cadastrado.
    if (!user) {
      throw new UnauthorizedException(GOOGLE_NOT_LINKED_MESSAGE);
    }

    if (this.isLocked(user)) {
      this.logger.warn(
        `Tentativa de login com Google recusada, conta bloqueada: usuário ${user.id}`,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    try {
      return await this.issueSessionToken(user, context);
    } catch (error) {
      this.throwIfDatabaseUnavailable(error);
      throw error;
    }
  }

  // Só o estudante novo do domínio discente entra sem vínculo prévio, porque o
  // Google é a autoridade sobre esse domínio (hd). A conta nasce vinculada ao
  // sub. Se o e-mail já tem conta, nada é criado nem aberto.
  private async createGoogleStudent(
    email: string,
    sub: string,
    tokenInfo: GoogleTokenInfo,
  ) {
    const isDiscente =
      tokenInfo.hd === GOOGLE_DISCENTE_HOSTED_DOMAIN &&
      email.endsWith(`@${GOOGLE_DISCENTE_HOSTED_DOMAIN}`);

    if (!isDiscente) {
      return null;
    }

    const fullName = tokenInfo.name?.trim() || email.split('@')[0];
    const passwordHash = await bcrypt.hash(randomUUID(), 10);

    const created = await this.userService.createGoogleStudentUser({
      email,
      fullName,
      passwordHash,
      googleSubject: sub,
    });

    // Sem criação, o e-mail já tinha conta ou um login simultâneo do mesmo
    // estudante criou a conta primeiro; só o segundo caso tem dono para o sub.
    return created ?? this.userService.findByGoogleSub(sub);
  }

  async getGoogleLinkStatus(
    currentEmail: string,
  ): Promise<{ enabled: boolean; linked: boolean }> {
    const user = await this.userService.findOne(currentEmail);
    return {
      enabled: this.getGoogleConfig().enabled,
      linked: !!user?.google_sub,
    };
  }

  // Vincular acrescenta um meio de entrar na conta, então exige a sessão e a
  // senha atual, que conta no bloqueio como em updateProfile: sem a senha, quem
  // usa uma sessão aberta de outra pessoa vincularia a própria Conta Google. O
  // dono recebe aviso, e a redefinição de senha desfaz o vínculo
  // (updatePassword).
  async linkGoogleAccount(
    currentEmail: string,
    dto: LinkGoogleAccountDto,
  ): Promise<{ message: string }> {
    const user = await this.userService.findOne(currentEmail);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    await this.verifyCurrentPassword(user, dto.currentPassword);

    const tokenInfo = await this.verifyGoogleCredential(dto.credential);
    if (!tokenInfo.sub) {
      throw new UnauthorizedException('Credencial do Google inválida.');
    }

    const owner = await this.userService.findByGoogleSub(tokenInfo.sub);
    if (owner && owner.id !== user.id) {
      throw new ConflictException(GOOGLE_ACCOUNT_IN_USE_MESSAGE);
    }

    await this.userService.setGoogleSub(user.email, tokenInfo.sub);
    this.logger.log(`Conta Google vinculada: usuário ${user.id}`);
    this.sendGoogleLinkNotice(user, true);

    return { message: 'Conta Google vinculada.' };
  }

  async unlinkGoogleAccount(
    currentEmail: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findOne(currentEmail);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    if (user.google_sub) {
      await this.userService.setGoogleSub(user.email, null);
      this.logger.log(`Conta Google desvinculada: usuário ${user.id}`);
      this.sendGoogleLinkNotice(user, false);
    }

    return { message: 'Conta Google desvinculada.' };
  }

  private sendGoogleLinkNotice(
    user: { id: number; email: string },
    linked: boolean,
  ): void {
    void this.mailService
      .sendGoogleAccountLinkNotice(user.email, linked)
      .catch((error: unknown) =>
        this.logger.error(
          `Falha ao enviar aviso de vínculo da Conta Google do usuário ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );
  }

  private async verifyGoogleCredential(
    credential: string,
  ): Promise<GoogleTokenInfo> {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new BadRequestException('Login com Google não configurado.');
    }

    let response: { statusCode: number; body: string };

    try {
      response = await this.requestGoogleTokenInfo(credential);
    } catch (error) {
      this.logger.error(
        'Falha ao validar credencial do Google.',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Nao foi possivel validar o login com Google. Tente novamente em instantes.',
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new UnauthorizedException('Credencial do Google inválida.');
    }

    let tokenInfo: GoogleTokenInfo;

    try {
      tokenInfo = JSON.parse(response.body) as GoogleTokenInfo;
    } catch {
      throw new UnauthorizedException('Credencial do Google inválida.');
    }

    const emailVerified =
      tokenInfo.email_verified === true || tokenInfo.email_verified === 'true';

    if (
      tokenInfo.aud !== clientId ||
      !emailVerified ||
      !GOOGLE_ISSUERS.includes(tokenInfo.iss ?? '')
    ) {
      throw new UnauthorizedException('Credencial do Google inválida.');
    }

    return tokenInfo;
  }

  private requestGoogleTokenInfo(
    credential: string,
  ): Promise<{ statusCode: number; body: string }> {
    const url = new URL('https://oauth2.googleapis.com/tokeninfo');
    url.searchParams.set('id_token', credential);

    return new Promise((resolve, reject) => {
      const request = httpsGet(
        url,
        {
          // A VM de produção não possui rota IPv6. Fixar IPv4 evita que a
          // validação OAuth expire ao tentar um endereço IPv6 do Google.
          family: 4,
          timeout: GOOGLE_TOKENINFO_TIMEOUT_MS,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let responseBytes = 0;

          response.on('data', (chunk: Buffer) => {
            responseBytes += chunk.length;

            if (responseBytes > GOOGLE_TOKENINFO_MAX_RESPONSE_BYTES) {
              response.destroy(
                new Error('Resposta do Google excedeu o limite permitido.'),
              );
              return;
            }

            chunks.push(chunk);
          });

          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 502,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });

          response.on('error', reject);
        },
      );

      request.on('timeout', () => {
        request.destroy(new Error('Tempo limite ao validar credencial Google.'));
      });
      request.on('error', reject);
    });
  }

  private throwIfDatabaseUnavailable(error: unknown): void {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : null;

    if (code !== 'ECONNREFUSED') {
      return;
    }

    this.logger.error(
      'Banco de dados indisponivel durante o login com Google.',
      error instanceof Error ? error.stack : String(error),
    );
    throw new ServiceUnavailableException(
      'Banco de dados indisponivel. Verifique se o Postgres esta rodando.',
    );
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
      cpf: string;
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
      must_complete_registration: hasPendingGoogleRegistration(user),
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
    id: number;
    email: string;
    failed_login_attempts: number;
    login_lock_count: number;
  }): Promise<void> {
    const attempts = user.failed_login_attempts + 1;

    if (attempts < MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.userService.registerFailedLoginAttempt(user.email);
      this.logger.warn(
        `Falha de login ${attempts}/${MAX_FAILED_LOGIN_ATTEMPTS}: usuário ${user.id}`,
      );
      return;
    }

    const lockedUntil = new Date(
      Date.now() + this.lockDuration(user.login_lock_count),
    );

    await this.userService.lockAccount(user.email, lockedUntil);
    this.logger.warn(
      `Conta bloqueada até ${lockedUntil.toISOString()}: usuário ${user.id}`,
    );

    // O aviso vai por e-mail porque a resposta HTTP é genérica: informar o
    // bloqueio ali revelaria que aquele e-mail existe. O envio não é aguardado:
    // esperar o SMTP atrasaria só a tentativa que bloqueia uma conta existente,
    // e o tempo da resposta revelaria o e-mail cadastrado. Falha de envio fica
    // no log e não muda a resposta.
    void this.mailService
      .sendAccountLockedNotice(user.email, lockedUntil)
      .catch((error: unknown) =>
        this.logger.error(
          `Falha ao enviar aviso de bloqueio do usuário ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );
  }

  // A senha atual protege a sessão que o dono deixou aberta. Errar a senha
  // conta no mesmo bloqueio por conta do login, e a conta bloqueada não altera
  // nada, senão a sessão serviria para testar senhas sem limite.
  private async verifyCurrentPassword(
    user: {
      id: number;
      email: string;
      password: string;
      failed_login_attempts: number;
      login_lock_count: number;
      locked_until: Date | null;
    },
    currentPassword: string,
  ): Promise<void> {
    if (this.isLocked(user)) {
      this.logger.warn(
        `Alteração de dados recusada, conta bloqueada: usuário ${user.id}`,
      );
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      await this.registerFailedLogin(user);
      throw new UnauthorizedException('Senha atual incorreta');
    }

    if (user.failed_login_attempts > 0 || user.login_lock_count > 0) {
      await this.userService.clearLoginLock(user.email);
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

    await this.verifyCurrentPassword(user, dto.currentPassword);

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

    if (dto.password) {
      await this.compromisedPasswordService.assertNotCompromised(dto.password);
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

  // Conta criada pelo login com Google: a pessoa só usa o sistema depois de
  // cadastrar CPF e senha. A identidade vem do token (currentEmail), e a sessão
  // é reemitida sem a marca de cadastro pendente.
  async completeRegistration(
    currentEmail: string,
    dto: CompleteRegistrationDto,
    context?: SessionContext,
  ): Promise<{ access_token: string }> {
    const user = await this.userService.findOne(currentEmail);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    if (!hasPendingGoogleRegistration(user)) {
      throw new BadRequestException('O cadastro desta conta já está completo.');
    }

    await this.compromisedPasswordService.assertNotCompromised(dto.password);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const updated = await this.userService.completeGoogleRegistration(
      user.email,
      dto.cpf,
      hashedPassword,
    );

    return this.issueSessionToken(updated, context);
  }

  // A resposta não espera a busca da conta, a gravação do código nem o envio do
  // e-mail: e-mail cadastrado e não cadastrado respondem no mesmo tempo, e o
  // tempo de resposta deixa de revelar quais contas existem. As falhas do
  // processamento ficam no log, sem o e-mail informado.
  async forgotPassword(email: string): Promise<{ message: string }> {
    void this.processPasswordResetRequest(email).catch((error: unknown) =>
      this.logger.error(
        'Falha ao processar pedido de recuperação de senha',
        error instanceof Error ? error.stack : String(error),
      ),
    );

    return {
      message:
        'Se o e-mail informado estiver cadastrado, um código de recuperação foi enviado.',
    };
  }

  private async processPasswordResetRequest(email: string): Promise<void> {
    const user = await this.userService.findOne(email);
    if (!user) {
      return;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

    await this.userService.setPasswordResetToken(email, tokenHash, expiresAt);

    try {
      await this.mailService.sendPasswordResetCode(email, code);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar e-mail de recuperação de senha do usuário ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
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

    await this.compromisedPasswordService.assertNotCompromised(password);

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userService.updatePassword(email, hashedPassword);

    // Quem redefine a senha normalmente perdeu o controle da conta, então todas
    // as sessões abertas caem, inclusive as de quem estava usando a senha antiga.
    // updatePassword também desfaz o vínculo com a Conta Google.
    await this.sessionsService.revokeAllFromUser(user.id);
    if (user.google_sub) {
      this.sendGoogleLinkNotice(user, false);
    }

    return { message: 'Senha redefinida com sucesso.' };
  }

  // Primeiro acesso de quem foi cadastrado pelo administrador. O link vale uma
  // vez: updatePassword apaga o token. Não abre sessão, a pessoa entra pelo
  // login com a senha que acabou de definir.
  async activateAccount(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByActivationToken(
      hashActivationToken(token),
    );

    if (
      !user ||
      !user.activation_expires ||
      user.activation_expires < new Date()
    ) {
      throw new UnauthorizedException('Link inválido ou expirado.');
    }

    await this.compromisedPasswordService.assertNotCompromised(password);

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userService.updatePassword(user.email, hashedPassword);

    // Mesmo tratamento de resetPassword: sessões abertas antes da senha, como
    // uma entrada pelo Google, são encerradas, e o vínculo com a Conta Google
    // cai em updatePassword.
    await this.sessionsService.revokeAllFromUser(user.id);
    if (user.google_sub) {
      this.sendGoogleLinkNotice(user, false);
    }

    return { message: 'Senha definida com sucesso.' };
  }

  private async validateResetCode(email: string, code: string) {
    const invalidCodeException = new UnauthorizedException(
      'Código inválido ou expirado.',
    );

    const user = await this.userService.findOne(email);
    if (!user || !user.password_reset_token) {
      throw invalidCodeException;
    }

    // A tentativa é reservada antes da comparação, e a reserva já confere o
    // prazo e o limite. Atingido o limite, o código não é apagado: apagar zeraria
    // o contador e o pedido seguinte reabriria 5 tentativas dentro da janela.
    const reserved = await this.userService.reservePasswordResetAttempt(
      email,
      MAX_RESET_ATTEMPTS,
    );
    if (!reserved) {
      throw invalidCodeException;
    }

    const isCodeValid = await bcrypt.compare(code, user.password_reset_token);
    if (!isCodeValid) {
      throw invalidCodeException;
    }

    // Só erro conta como tentativa: o código certo devolve a reserva, e
    // verify-reset-code seguido de reset-password não gasta duas tentativas.
    await this.userService.releasePasswordResetAttempt(email);

    return user;
  }
}
