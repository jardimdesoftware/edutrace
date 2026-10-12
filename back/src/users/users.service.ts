import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/database/prisma.service';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { LEVELS, PHASES } from 'src/constants';
import { SessionsService } from 'src/sessions/sessions.service';
import { MailService } from 'src/mail/mail.service';
import {
  ACTIVATION_TOKEN_TTL_MS,
  buildActivationLink,
  generateActivationToken,
} from 'src/auth/activation-token';
import { GOOGLE_CPF_PREFIX } from './google-account';
import { Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from './users.select';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private sessionsService: SessionsService,
    private mailService: MailService,
  ) {}

  // O administrador não define a senha: a conta nasce com uma senha aleatória
  // que ninguém conhece, e a pessoa cadastrada escolhe a dela pelo link enviado
  // ao e-mail. Assim nenhuma senha conhecida por terceiros chega a existir, e o
  // primeiro acesso não precisa de troca obrigatória.
  async create(createUserDto: CreateUserDto) {
    const { id_level, ...userData } = createUserDto;
    const activation = generateActivationToken();
    const activationExpires = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

    let user: Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;

    try {
      user = await this.prisma.user.create({
        select: PUBLIC_USER_SELECT,
        data: {
          ...userData,
          password: await hash(randomUUID(), 10),
          id_level: id_level ?? LEVELS.ALUNO_ESTUDANTE,
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: false,
          activation_token: activation.hash,
          activation_expires: activationExpires,
        },
      });
    } catch (error) {
      // cpf e email são únicos no schema. Sem este tratamento a violação da
      // constraint sobe como 500 e quem cadastra não sabe o que aconteceu.
      throw this.duplicateFieldError(error) ?? error;
    }

    const activation_email_sent = await this.sendActivationLink(
      user,
      activation.token,
      activationExpires,
    );

    return { ...user, activation_email_sent };
  }

  // Falha de envio não desfaz o cadastro: a conta fica criada e a pessoa
  // consegue definir a senha por "Esqueci minha senha". O retorno avisa o
  // administrador de que o e-mail não saiu.
  private async sendActivationLink(
    user: { id: number; email: string },
    token: string,
    expiresAt: Date,
  ): Promise<boolean> {
    try {
      await this.mailService.sendAccountActivationLink(
        user.email,
        buildActivationLink(token),
        expiresAt,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Falha ao enviar o link de definição de senha do usuário ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  private isUniqueViolation(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private duplicateFieldError(error: unknown): ConflictException | null {
    if (!this.isUniqueViolation(error)) {
      return null;
    }

    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target : [target];

    if (fields.includes('cpf')) {
      return new ConflictException('Este CPF já está cadastrado.');
    }

    if (fields.includes('email')) {
      return new ConflictException('Este e-mail já está cadastrado.');
    }

    return new ConflictException('Registro já cadastrado.');
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: PUBLIC_USER_SELECT,
    });
  }

  // Uso interno da autenticação: devolve o registro completo, incluindo a senha e
  // os campos de recuperação, que signIn, updateProfile e validateResetCode
  // precisam ler. Não pode ser devolvido direto em resposta HTTP.
  async findOne(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
  }

  // Uso interno da ativação de conta. Recebe o hash do token, nunca o token.
  async findByActivationToken(tokenHash: string) {
    return this.prisma.user.findUnique({
      where: {
        activation_token: tokenHash,
      },
    });
  }

  async findOnePublic(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  async ensureGoogleStudentUser(data: {
    email: string;
    fullName: string;
    passwordHash: string;
    googleSubject: string;
  }) {
    // O login Google só define nome e perfil ao criar a conta. Uma conta que já
    // existe mantém o que o administrador cadastrou, inclusive a troca de senha
    // pendente.
    return this.prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        full_name: data.fullName,
        cpf: `google:${data.googleSubject}`,
        email: data.email,
        password: data.passwordHash,
        id_level: LEVELS.ALUNO_ESTUDANTE,
        id_current_phase: PHASES.TRIAGEM,
        must_change_password: false,
      },
    });
  }
  // Cria a conta do estudante que entra pela primeira vez com o Google, já
  // vinculada ao sub da Conta Google. Conta existente com o mesmo e-mail nunca é
  // reaproveitada: devolve null, e o dono vincula a Conta Google depois de
  // entrar com e-mail e senha.
  async createGoogleStudentUser(data: {
    email: string;
    fullName: string;
    passwordHash: string;
    googleSubject: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          full_name: data.fullName,
          cpf: `${GOOGLE_CPF_PREFIX}${data.googleSubject}`,
          email: data.email,
          password: data.passwordHash,
          google_sub: data.googleSubject,
          id_level: LEVELS.ALUNO_ESTUDANTE,
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: false,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async findByGoogleSub(googleSub: string) {
    return this.prisma.user.findUnique({ where: { google_sub: googleSub } });
  }

  async setGoogleSub(email: string, googleSub: string | null) {
    try {
      return await this.prisma.user.update({
        where: { email: email },
        data: { google_sub: googleSub },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Esta Conta Google já está vinculada a outra conta.',
        );
      }
      throw error;
    }
  }

  async update(email: string, updateUserDto: UpdateUserDto) {
    const updated = await this.prisma.user.update({
      select: PUBLIC_USER_SELECT,
      where: { email: email },
      data: {
        full_name: updateUserDto.full_name,
        id_level: updateUserDto.id_level,
      },
    });

    // O nível de acesso viaja dentro do token. Sem encerrar as sessões, quem foi
    // rebaixado continua com o nível antigo até o token vencer.
    if (updateUserDto.id_level !== undefined) {
      await this.sessionsService.revokeAllFromUser(updated.id);
    }

    return updated;
  }

  // Atualização self-service dos próprios dados (e-mail e/ou senha).
  // O e-mail é a chave de negócio que liga o usuário aos seus registros de
  // Triagem/Anamnese/PEI, então a troca precisa propagar em todas as tabelas
  // dentro de uma transação para não deixar dados órfãos.
  async updateProfile(
    currentEmail: string,
    data: { newEmail?: string; hashedPassword?: string },
  ) {
    const { newEmail, hashedPassword } = data;
    const isChangingEmail = !!newEmail && newEmail !== currentEmail;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { email: currentEmail },
        data: {
          ...(isChangingEmail ? { email: newEmail } : {}),
          // Definir a própria senha encerra a obrigação de troca do primeiro
          // acesso: a senha deixa de ser a que o administrador cadastrou.
          ...(hashedPassword
            ? { password: hashedPassword, must_change_password: false }
            : {}),
        },
      });

      if (isChangingEmail) {
        await tx.screening.updateMany({
          where: { email: currentEmail },
          data: { email: newEmail },
        });
        await tx.anamnesis.updateMany({
          where: { email: currentEmail },
          data: { email: newEmail },
        });
        await tx.plansEducation.updateMany({
          where: { student_email: currentEmail },
          data: { student_email: newEmail },
        });
        await tx.plansEducation.updateMany({
          where: { professor_email: currentEmail },
          data: { professor_email: newEmail },
        });
      }

      return user;
    });
  }

  // Enquanto o prazo do código anterior não vence, o pedido de código novo só
  // troca o código: o contador de tentativas e o prazo continuam os mesmos.
  // Zerar o contador a cada pedido daria mais 5 palpites por pedido contra a
  // mesma conta. Contador zerado e prazo novo só quando não há prazo ou ele já
  // venceu, o que limita a 5 palpites por conta a cada janela.
  async setPasswordResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    const { count } = await this.prisma.user.updateMany({
      where: { email: email, password_reset_expires: { gt: new Date() } },
      data: { password_reset_token: tokenHash },
    });

    if (count === 0) {
      await this.prisma.user.update({
        where: { email: email },
        data: {
          password_reset_token: tokenHash,
          password_reset_expires: expiresAt,
          password_reset_attempts: 0,
        },
      });
    }
  }

  // Reserva a tentativa num único UPDATE condicionado ao código existente,
  // dentro do prazo e abaixo do limite. Requisições paralelas não passam todas
  // pela conferência do limite antes do primeiro incremento, porque a
  // conferência e o incremento são a mesma operação no banco.
  async reservePasswordResetAttempt(
    email: string,
    maxAttempts: number,
  ): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: {
        email: email,
        password_reset_token: { not: null },
        password_reset_expires: { gt: new Date() },
        password_reset_attempts: { lt: maxAttempts },
      },
      data: { password_reset_attempts: { increment: 1 } },
    });

    return count === 1;
  }

  async releasePasswordResetAttempt(email: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: { password_reset_attempts: { decrement: 1 } },
    });
  }

  // Usado pela redefinição e pela ativação de conta. Gravar uma senha por
  // qualquer um dos dois caminhos invalida o código e o link pendentes do outro.
  async updatePassword(email: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        password_reset_attempts: 0,
        activation_token: null,
        activation_expires: null,
        must_change_password: false,
        failed_login_attempts: 0,
        locked_until: null,
        login_lock_count: 0,
      },
    });
  }

  // Conclui o cadastro da conta criada pelo login com Google: o CPF real
  // substitui o provisório e a senha passa a existir. O CPF é único; um CPF que
  // já pertence a outra conta nunca vincula as duas, porque bastaria saber o CPF
  // de alguém para assumir a conta dele.
  async completeGoogleRegistration(
    email: string,
    cpf: string,
    hashedPassword: string,
  ) {
    try {
      return await this.prisma.user.update({
        where: { email: email },
        data: {
          cpf: cpf,
          password: hashedPassword,
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
          must_change_password: false,
        },
      });
    } catch (error) {
      if (this.duplicateFieldError(error)) {
        throw new ConflictException(
          'Este CPF já está cadastrado. Procure o administrador.',
        );
      }
      throw error;
    }
  }

  async registerFailedLoginAttempt(email: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        failed_login_attempts: { increment: 1 },
      },
    });
  }

  async lockAccount(email: string, lockedUntil: Date) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        locked_until: lockedUntil,
        login_lock_count: { increment: 1 },
        failed_login_attempts: 0,
      },
    });
  }

  async clearLoginLock(email: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
        login_lock_count: 0,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.user.delete({
      select: PUBLIC_USER_SELECT,
      where: {
        id: id,
      },
    });
  }
}
