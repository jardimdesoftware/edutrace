import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/database/prisma.service';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  LEVELS,
  PEDAGOGICAL_MANAGER_LEVELS,
  PHASES,
  REAUTH_WINDOW_MS,
  USER_DELETION_GRACE_DAYS,
} from 'src/constants';
import { hasAnyRole } from 'src/auth/roles';
import { sameRoles, sortRoles } from './roles';
import { SessionsService } from 'src/sessions/sessions.service';
import { MailService } from 'src/mail/mail.service';
import {
  ACTIVATION_TOKEN_TTL_MS,
  buildActivationLink,
  generateActivationToken,
} from 'src/auth/activation-token';
import {
  GOOGLE_ACCOUNT_IN_USE_MESSAGE,
  GOOGLE_CPF_PREFIX,
} from './google-account';
import { Prisma, ServiceStatus } from '@prisma/client';
import { PUBLIC_USER_SELECT, PublicUser } from './users.select';
import type { DeleteUserDto } from './dto/delete-user.dto';
import {
  LEAVE_PEDAGOGICAL_MANAGER,
  LEAVE_QUEUE,
  enterQueue,
} from './service-queue';

const UNIQUE_FIELD_MESSAGES = [
  { field: 'cpf', message: 'Este CPF já está cadastrado.' },
  { field: 'email', message: 'Este e-mail já está cadastrado.' },
  { field: 'enrollment_number', message: 'Esta matrícula já está cadastrada.' },
] as const;

const AEE_IN_SERVICE_MESSAGE =
  'Encerre os atendimentos do Professor do AEE antes de tirar esse papel ou excluir a conta.';

const OWN_ACCOUNT_MESSAGE = 'Você não pode excluir a própria conta.';

const LAST_ADMIN_MESSAGE = 'Não é possível excluir o último administrador.';

const ALREADY_MARKED_MESSAGE = 'Este usuário já está marcado para exclusão.';

const NOT_MARKED_MESSAGE = 'Este usuário não está marcado para exclusão.';

const HAS_RECORDS_MESSAGE =
  'Este usuário tem registros no sistema (anotações, triagem, anamnese, estudo de caso, PAEE ou PEI) e não pode ser excluído.';

export const REAUTH_REQUIRED_MESSAGE =
  'Informe sua senha para excluir o usuário.';

export const WRONG_PASSWORD_MESSAGE = 'Senha incorreta.';

const DAY_MS = 24 * 60 * 60 * 1000;

// As rotas que chegam a este serviço são do Administrador (o cadastro, também
// do NAPNE), que não leem o telefone e o CPF do responsável pedagógico externo,
// e por isso as respostas usam PUBLIC_USER_SELECT. Uma rota nova para um nível
// que leia o contato escolhe o select por userSelectFor.
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
    const { roles: requestedRoles, ...userData } = createUserDto;
    const roles = sortRoles(requestedRoles ?? [LEVELS.ALUNO_ESTUDANTE]);
    this.assertStudentOnlyFields(roles, createUserDto);
    const activation = generateActivationToken();
    const activationExpires = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

    let user: PublicUser;

    try {
      user = await this.prisma.user.create({
        select: PUBLIC_USER_SELECT,
        data: {
          ...userData,
          password: await hash(randomUUID(), 10),
          roles,
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: false,
          activation_token: activation.hash,
          activation_expires: activationExpires,
          ...(roles.includes(LEVELS.ALUNO_ESTUDANTE) ? enterQueue() : {}),
        },
      });
    } catch (error) {
      // cpf, email e matrícula são únicos no schema. Sem este tratamento a
      // violação da constraint sobe como 500 e quem cadastra não sabe o que
      // aconteceu.
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

  // Com o @prisma/adapter-pg (Prisma 7) o P2002 não traz meta.target: a
  // constraint violada vem pelo nome do índice (User_cpf_key) em
  // meta.driverAdapterError.cause.constraint.index, ou pelas colunas em
  // constraint.fields quando o driver não informa o índice. O meta.target do
  // Prisma sem adapter continua sendo lido. Sem esta leitura, CPF e e-mail
  // repetidos caíam na mensagem genérica.
  private violatedConstraints(
    error: Prisma.PrismaClientKnownRequestError,
  ): unknown[] {
    const meta = error.meta as
      | {
          target?: unknown;
          driverAdapterError?: {
            cause?: { constraint?: { index?: unknown; fields?: unknown } };
          };
        }
      | undefined;
    const constraint = meta?.driverAdapterError?.cause?.constraint;

    return [meta?.target, constraint?.fields, constraint?.index].flat();
  }

  private duplicateFieldError(error: unknown): ConflictException | null {
    if (!this.isUniqueViolation(error)) {
      return null;
    }

    const violated = this.violatedConstraints(error);
    const duplicate = UNIQUE_FIELD_MESSAGES.find(
      ({ field }) =>
        violated.includes(field) || violated.includes(`User_${field}_key`),
    );

    return new ConflictException(
      duplicate?.message ?? 'Registro já cadastrado.',
    );
  }

  // Matrícula e curso só existem para o estudante. Os papéis são os finais da
  // requisição: os informados ou, na atualização sem troca de papéis, os da
  // conta. Papéis desconhecidos (conta inexistente) ficam para o update, que já
  // falha.
  private assertStudentOnlyFields(
    roles: readonly number[] | undefined,
    fields: { enrollment_number?: string; course?: string },
  ) {
    const sent =
      fields.enrollment_number !== undefined || fields.course !== undefined;

    if (
      sent &&
      roles !== undefined &&
      !roles.includes(LEVELS.ALUNO_ESTUDANTE)
    ) {
      throw new BadRequestException(
        'Matrícula e curso só podem ser informados para o papel Estudante/Família.',
      );
    }
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
          roles: [LEVELS.ALUNO_ESTUDANTE],
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: false,
          ...enterQueue(),
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
        throw new ConflictException(GOOGLE_ACCOUNT_IN_USE_MESSAGE);
      }
      throw error;
    }
  }

  // A decisão sobre a fila depende dos papéis que a conta tem agora, e o Professor
  // do AEE com estudantes em atendimento não pode perder o papel. Por isso a linha é
  // travada com FOR UPDATE antes de qualquer leitura: o "assumir" do mesmo professor
  // trava a mesma linha, então nenhum atendimento novo entra entre a conferência
  // e a troca de papéis, e duas trocas simultâneas da mesma conta se enfileiram.
  // A transação usa o isolamento padrão (READ COMMITTED), em que cada comando
  // enxerga o que a transação anterior confirmou.
  async update(email: string, updateUserDto: UpdateUserDto) {
    let result: { user: PublicUser; rolesChanged: boolean };

    try {
      result = await this.prisma.$transaction((tx) =>
        this.applyUpdate(tx, email, updateUserDto),
      );
    } catch (error) {
      throw this.duplicateFieldError(error) ?? error;
    }

    // O guard lê os papéis do banco a cada requisição, mas a sessão aberta
    // continua valendo. Encerrar as sessões obriga quem foi rebaixado a entrar
    // de novo e a ver a tela do papel novo. A revogação vem depois do commit: com
    // a transação aberta, a sessão cairia por uma troca que ainda pode ser
    // desfeita.
    if (result.rolesChanged) {
      await this.sessionsService.revokeAllFromUser(result.user.id);
    }

    return result.user;
  }

  private async applyUpdate(
    tx: Prisma.TransactionClient,
    email: string,
    updateUserDto: UpdateUserDto,
  ) {
    const { full_name, roles, enrollment_number, course } = updateUserDto;

    const [current] = await tx.$queryRaw<{ id: number; roles: number[] }[]>`
      SELECT "id", "roles" FROM "User" WHERE "email" = ${email} FOR UPDATE`;

    // Conta inexistente (current indefinido) fica para o update, que falha.
    const finalRoles = roles ?? current?.roles;
    this.assertStudentOnlyFields(finalRoles, updateUserDto);

    const rolesChange = await this.applyRolesChange(tx, current, roles);

    const user = await tx.user.update({
      select: PUBLIC_USER_SELECT,
      where: { email: email },
      data: {
        full_name,
        roles: rolesChange?.to,
        enrollment_number,
        course,
        ...(rolesChange
          ? this.studentFieldsOnRolesChange(rolesChange.from, rolesChange.to)
          : {}),
      },
    });

    return { user, rolesChanged: rolesChange !== null };
  }

  // O DTO aceita os papéis que a conta já tem: nesse caso nada muda. Chamado
  // com a linha da conta já travada (FOR UPDATE).
  private async applyRolesChange(
    tx: Prisma.TransactionClient,
    current: { id: number; roles: number[] } | undefined,
    roles: number[] | undefined,
  ) {
    if (!current || roles === undefined || sameRoles(roles, current.roles)) {
      return null;
    }
    const rolesChange = { from: current.roles, to: sortRoles(roles) };

    if (
      rolesChange.from.includes(LEVELS.PROFESSOR_AEE) &&
      !rolesChange.to.includes(LEVELS.PROFESSOR_AEE)
    ) {
      await this.assertNoServiceInProgress(tx, current.id);
    }

    // Quem deixa os papéis 3, 5 e 6 deixa de ser responsável pedagógico. Com a
    // linha dele travada, o vínculo que o PATCH do estudante grava ao mesmo
    // tempo termina antes desta limpeza ou recusa o papel novo depois dela.
    if (this.leavesPedagogicalManagerRoles(rolesChange)) {
      await tx.user.updateMany({
        where: { pedagogical_manager_id: current.id },
        data: { pedagogical_manager_id: null },
      });
    }

    return rolesChange;
  }

  private leavesPedagogicalManagerRoles({
    from,
    to,
  }: {
    from: readonly number[];
    to: readonly number[];
  }) {
    return (
      hasAnyRole(from, PEDAGOGICAL_MANAGER_LEVELS) &&
      !hasAnyRole(to, PEDAGOGICAL_MANAGER_LEVELS)
    );
  }

  // Quem passa a ser estudante entra no fim da fila. Quem deixa de ser tem o
  // atendimento e o responsável pedagógico limpos.
  private studentFieldsOnRolesChange(
    from: readonly number[],
    to: readonly number[],
  ) {
    const wasStudent = from.includes(LEVELS.ALUNO_ESTUDANTE);
    const isStudent = to.includes(LEVELS.ALUNO_ESTUDANTE);

    return {
      ...(isStudent && !wasStudent ? enterQueue() : {}),
      ...(wasStudent && !isStudent
        ? { ...LEAVE_QUEUE, ...LEAVE_PEDAGOGICAL_MANAGER }
        : {}),
    };
  }

  // Chamado com a linha do Professor do AEE já travada (FOR UPDATE).
  private async assertNoServiceInProgress(
    tx: Prisma.TransactionClient,
    aeeId: number,
  ) {
    const inService = await tx.user.count({
      where: {
        aee_responsible_id: aeeId,
        service_status: ServiceStatus.IN_SERVICE,
      },
    });

    if (inService > 0) {
      throw new ConflictException(AEE_IN_SERVICE_MESSAGE);
    }
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
        // O PEI antigo ficou na tabela PlansEducation_legacy, fora da API, e
        // guarda os e-mails em texto. O PeiEntry liga por id, sem e-mail.
        await tx.plansEducationLegacy.updateMany({
          where: { student_email: currentEmail },
          data: { student_email: newEmail },
        });
        await tx.plansEducationLegacy.updateMany({
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
  // O vínculo com a Conta Google também cai: quem conhecia a senha pode ter
  // vinculado a própria Conta Google, e sem isso continuaria entrando depois que
  // o dono recupera a conta pela redefinição.
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
        google_sub: null,
      },
    });
  }

  // Conclui o cadastro da conta criada pelo login com Google: o CPF real
  // substitui o provisório e a senha passa a existir. O CPF é único; um CPF que
  // já pertence a outra conta nunca vincula as duas, porque bastaria saber o CPF
  // de alguém para assumir a conta dele. Matrícula e curso entram junto: sem
  // eles o cadastro não conclui. A matrícula também é única, e a que já pertence
  // a outra conta devolve 409 pelo mesmo caminho do CPF.
  async completeGoogleRegistration(
    email: string,
    cpf: string,
    hashedPassword: string,
    enrollmentNumber: string,
    course: string,
  ) {
    try {
      return await this.prisma.user.update({
        where: { email: email },
        data: {
          cpf: cpf,
          password: hashedPassword,
          enrollment_number: enrollmentNumber,
          course: course,
          password_reset_token: null,
          password_reset_expires: null,
          password_reset_attempts: 0,
          must_change_password: false,
        },
      });
    } catch (error) {
      const duplicate = this.duplicateFieldError(error);
      if (duplicate) {
        throw new ConflictException(
          `${duplicate.message} Procure o administrador.`,
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

  // Exige a senha do administrador, a menos que a confirmação anterior ainda
  // valha. Com remember, a confirmação passa a valer por REAUTH_WINDOW_MS nesta
  // sessão. A janela fica no servidor: um sinal só do navegador deixaria o
  // DELETE aceitar a exclusão sem senha.
  async confirmDeletionCredentials(
    requester: { sub: number; jti: string },
    dto: DeleteUserDto,
  ): Promise<Date | null> {
    const now = new Date();
    const session = await this.sessionsService.findActive(requester.jti);

    if (session?.reauth_until && session.reauth_until > now) {
      return session.reauth_until;
    }

    if (!dto.currentPassword) {
      throw new UnauthorizedException(REAUTH_REQUIRED_MESSAGE);
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: requester.sub },
      select: { password: true },
    });

    const isPasswordValid = await compare(
      dto.currentPassword,
      admin?.password ?? '',
    );

    if (!admin || !isPasswordValid) {
      throw new UnauthorizedException(WRONG_PASSWORD_MESSAGE);
    }

    if (!dto.remember) {
      return null;
    }

    const until = new Date(now.getTime() + REAUTH_WINDOW_MS);
    await this.sessionsService.grantReauth(requester.jti, until);

    return until;
  }

  // O usuário não é apagado na hora: fica marcado por USER_DELETION_GRACE_DAYS
  // dias, sem acesso, e o administrador pode restaurá-lo até a limpeza. As
  // travas rodam já aqui, para o erro chegar a quem pediu. O alvo e todos os
  // administradores são travados em ordem de id, o que impede dois pedidos
  // simultâneos de excluírem os dois últimos administradores.
  async markForDeletion(id: number, requesterId: number): Promise<PublicUser> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} OR ${LEVELS.ADMIN} = ANY("roles") ORDER BY "id" FOR UPDATE`;

      const target = await tx.user.findUnique({
        where: { id: id },
        select: { id: true, email: true, roles: true, deleted_at: true },
      });

      if (!target) {
        throw new NotFoundException('Usuário não encontrado.');
      }

      if (target.deleted_at) {
        throw new ConflictException(ALREADY_MARKED_MESSAGE);
      }

      if (target.id === requesterId) {
        throw new ConflictException(OWN_ACCOUNT_MESSAGE);
      }

      await this.assertNotLastAdmin(tx, target);
      await this.assertNoServiceInProgress(tx, id);
      await this.assertNoLinkedRecords(tx, target);

      await tx.session.updateMany({
        where: { id_user: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });

      return tx.user.update({
        select: PUBLIC_USER_SELECT,
        where: { id: id },
        data: { deleted_at: new Date() },
      });
    });
  }

  async restore(id: number): Promise<PublicUser> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: id, deleted_at: { not: null } },
      data: { deleted_at: null },
    });

    if (count === 0) {
      const exists = await this.prisma.user.count({ where: { id: id } });
      throw exists > 0
        ? new ConflictException(NOT_MARKED_MESSAGE)
        : new NotFoundException('Usuário não encontrado.');
    }

    return this.prisma.user.findUniqueOrThrow({
      select: PUBLIC_USER_SELECT,
      where: { id: id },
    });
  }

  // Apaga de vez quem passou do prazo. As travas rodam de novo, porque desde a
  // marcação o usuário pode ter ganhado um registro ou um atendimento. A falha
  // de um usuário é registrada e não interrompe os demais.
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const limit = new Date(now.getTime() - USER_DELETION_GRACE_DAYS * DAY_MS);

    const expired = await this.prisma.user.findMany({
      where: { deleted_at: { lte: limit } },
      select: { id: true },
    });

    let purged = 0;

    for (const { id } of expired) {
      try {
        if (await this.remove(id, limit)) {
          purged += 1;
        }
      } catch (error) {
        this.logger.error(
          `Falha ao apagar o usuário ${id} marcado para exclusão`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return purged;
  }

  // Exclusão definitiva. Com expiredBefore, só apaga quem continua marcado
  // desde antes dessa data, o que deixa um usuário restaurado a salvo.
  //
  // Mesma trava e mesma recusa do update, mas sem condicionar ao papel 6: uma
  // conta que perdeu o papel com estudantes em atendimento ainda é responsável
  // por eles, e excluí-la quebraria o CHECK da chave estrangeira (500). Quem
  // tem estudantes em atendimento não é excluído até encerrar os atendimentos.
  async remove(id: number, expiredBefore?: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;

      const target = await tx.user.findUnique({
        where: { id: id },
        select: { id: true, email: true, deleted_at: true },
      });

      if (!target) {
        return null;
      }

      if (
        expiredBefore &&
        (!target.deleted_at || target.deleted_at > expiredBefore)
      ) {
        return null;
      }

      await this.assertNoServiceInProgress(tx, id);
      await this.assertNoLinkedRecords(tx, target);

      return tx.user.delete({
        select: PUBLIC_USER_SELECT,
        where: {
          id: id,
        },
      });
    });
  }

  private async assertNotLastAdmin(
    tx: Prisma.TransactionClient,
    target: { id: number; roles: number[] },
  ) {
    if (!target.roles.includes(LEVELS.ADMIN)) {
      return;
    }

    const others = await tx.user.count({
      where: {
        roles: { has: LEVELS.ADMIN },
        deleted_at: null,
        id: { not: target.id },
      },
    });

    if (others === 0) {
      throw new ConflictException(LAST_ADMIN_MESSAGE);
    }
  }

  // Triagem e anamnese ligam-se ao usuário só pelo e-mail, sem chave
  // estrangeira, e ficariam órfãs com dados pessoais. As demais tabelas têm
  // chave estrangeira que o banco recusaria com 500.
  private async assertNoLinkedRecords(
    tx: Prisma.TransactionClient,
    target: { id: number; email: string },
  ) {
    const counts = await Promise.all([
      tx.comments.count({ where: { id_user: target.id } }),
      tx.caseStudy.count({ where: { id_student: target.id } }),
      tx.aeePlan.count({ where: { id_student: target.id } }),
      tx.peiEntry.count({ where: { id_student: target.id } }),
      tx.screening.count({ where: { email: target.email } }),
      tx.anamnesis.count({ where: { email: target.email } }),
    ]);

    if (counts.some((count) => count > 0)) {
      throw new ConflictException(HAS_RECORDS_MESSAGE);
    }
  }
}
