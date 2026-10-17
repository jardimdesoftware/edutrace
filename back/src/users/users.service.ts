import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/database/prisma.service';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { LEVELS, PEDAGOGICAL_MANAGER_LEVELS, PHASES } from 'src/constants';
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
import {
  USER_WITH_MANAGER_CONTACT_SELECT,
  UserWithManagerContact,
} from './users.select';
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

const NAPNE_IN_SERVICE_MESSAGE =
  'Encerre os atendimentos do Profissional NAPNE antes de trocar o nível ou excluir a conta.';

// As rotas que chegam a este serviço são do Administrador (o cadastro, também
// do NAPNE), que leem o telefone e o CPF do responsável pedagógico externo, e
// por isso as respostas usam USER_WITH_MANAGER_CONTACT_SELECT. Uma rota nova
// para outro nível escolhe o select por userSelectFor.
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
    const level = id_level ?? LEVELS.ALUNO_ESTUDANTE;
    this.assertStudentOnlyFields(level, createUserDto);
    const activation = generateActivationToken();
    const activationExpires = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

    let user: UserWithManagerContact;

    try {
      user = await this.prisma.user.create({
        select: USER_WITH_MANAGER_CONTACT_SELECT,
        data: {
          ...userData,
          password: await hash(randomUUID(), 10),
          id_level: level,
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: false,
          activation_token: activation.hash,
          activation_expires: activationExpires,
          ...(level === LEVELS.ALUNO_ESTUDANTE ? enterQueue() : {}),
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

  // Matrícula e curso só existem para o estudante. O nível é o final da
  // requisição: o informado ou, na atualização sem troca de nível, o da conta.
  // Nível desconhecido (conta inexistente) fica para o update, que já falha.
  private assertStudentOnlyFields(
    level: number | undefined,
    fields: { enrollment_number?: string; course?: string },
  ) {
    const sent =
      fields.enrollment_number !== undefined || fields.course !== undefined;

    if (sent && level !== undefined && level !== LEVELS.ALUNO_ESTUDANTE) {
      throw new BadRequestException(
        'Matrícula e curso só podem ser informados para o nível Estudante/Família.',
      );
    }
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: USER_WITH_MANAGER_CONTACT_SELECT,
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
      select: USER_WITH_MANAGER_CONTACT_SELECT,
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

  // A decisão sobre a fila depende do nível que a conta tem agora, e o NAPNE
  // com estudantes em atendimento não pode sair do nível. Por isso a linha é
  // travada com FOR UPDATE antes de qualquer leitura: o "assumir" do mesmo NAPNE
  // trava a mesma linha, então nenhum atendimento novo entra entre a conferência
  // e a troca de nível, e duas trocas simultâneas da mesma conta se enfileiram.
  // A transação usa o isolamento padrão (READ COMMITTED), em que cada comando
  // enxerga o que a transação anterior confirmou.
  async update(email: string, updateUserDto: UpdateUserDto) {
    let result: { user: UserWithManagerContact; levelChanged: boolean };

    try {
      result = await this.prisma.$transaction((tx) =>
        this.applyUpdate(tx, email, updateUserDto),
      );
    } catch (error) {
      throw this.duplicateFieldError(error) ?? error;
    }

    // O nível de acesso viaja dentro do token. Sem encerrar as sessões, quem foi
    // rebaixado continua com o nível antigo até o token vencer. A revogação vem
    // depois do commit: com a transação aberta, a sessão cairia por uma troca
    // que ainda pode ser desfeita.
    if (result.levelChanged) {
      await this.sessionsService.revokeAllFromUser(result.user.id);
    }

    return result.user;
  }

  private async applyUpdate(
    tx: Prisma.TransactionClient,
    email: string,
    updateUserDto: UpdateUserDto,
  ) {
    const { full_name, id_level, enrollment_number, course, service_capacity } =
      updateUserDto;

    const [current] = await tx.$queryRaw<{ id: number; id_level: number }[]>`
      SELECT "id", "id_level" FROM "User" WHERE "email" = ${email} FOR UPDATE`;

    // Conta inexistente (current indefinido) fica para o update, que falha.
    const finalLevel = id_level ?? current?.id_level;
    this.assertStudentOnlyFields(finalLevel, updateUserDto);
    this.assertCapacityOnlyForNapne(finalLevel, service_capacity);

    // O DTO aceita o nível que a conta já tem: nesse caso nada muda.
    const levelChange =
      current && id_level !== undefined && id_level !== current.id_level
        ? { from: current.id_level, to: id_level }
        : null;

    if (levelChange?.from === LEVELS.PROFISSIONAL_NAPNE) {
      await this.assertNoServiceInProgress(tx, current.id);
    }

    // Quem deixa os níveis 3 e 5 deixa de ser responsável pedagógico. Com a
    // linha dele travada, o vínculo que o PATCH do estudante grava ao mesmo
    // tempo termina antes desta limpeza ou recusa o nível novo depois dela.
    if (levelChange && this.leavesPedagogicalManagerLevels(levelChange)) {
      await tx.user.updateMany({
        where: { pedagogical_manager_id: current.id },
        data: { pedagogical_manager_id: null },
      });
    }

    const user = await tx.user.update({
      select: USER_WITH_MANAGER_CONTACT_SELECT,
      where: { email: email },
      data: {
        full_name,
        id_level,
        enrollment_number,
        course,
        service_capacity,
        ...(levelChange
          ? this.studentFieldsOnLevelChange(levelChange.from, levelChange.to)
          : {}),
      },
    });

    return { user, levelChanged: levelChange !== null };
  }

  private leavesPedagogicalManagerLevels({
    from,
    to,
  }: {
    from: number;
    to: number;
  }) {
    return (
      PEDAGOGICAL_MANAGER_LEVELS.includes(from) &&
      !PEDAGOGICAL_MANAGER_LEVELS.includes(to)
    );
  }

  // Quem passa a ser estudante entra no fim da fila. Quem deixa de ser tem o
  // atendimento e o responsável pedagógico limpos, e o NAPNE que deixa o nível
  // perde o limite, que só faz sentido no nível 5 (CHECK
  // User_service_capacity_chk).
  private studentFieldsOnLevelChange(from: number, to: number) {
    return {
      ...(to === LEVELS.ALUNO_ESTUDANTE ? enterQueue() : {}),
      ...(from === LEVELS.ALUNO_ESTUDANTE
        ? { ...LEAVE_QUEUE, ...LEAVE_PEDAGOGICAL_MANAGER }
        : {}),
      ...(from === LEVELS.PROFISSIONAL_NAPNE ? { service_capacity: null } : {}),
    };
  }

  private assertCapacityOnlyForNapne(
    level: number | undefined,
    serviceCapacity: number | undefined,
  ) {
    if (
      serviceCapacity !== undefined &&
      level !== undefined &&
      level !== LEVELS.PROFISSIONAL_NAPNE
    ) {
      throw new BadRequestException(
        'O limite de atendimentos só pode ser informado para o nível Profissional NAPNE.',
      );
    }
  }

  // Chamado com a linha do NAPNE já travada (FOR UPDATE).
  private async assertNoServiceInProgress(
    tx: Prisma.TransactionClient,
    napneId: number,
  ) {
    const inService = await tx.user.count({
      where: {
        napne_responsible_id: napneId,
        service_status: ServiceStatus.IN_SERVICE,
      },
    });

    if (inService > 0) {
      throw new ConflictException(NAPNE_IN_SERVICE_MESSAGE);
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

  // Mesma trava e mesma recusa do update: o NAPNE com estudantes em
  // atendimento não é excluído até encerrar os atendimentos.
  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const [target] = await tx.$queryRaw<{ id_level: number }[]>`
        SELECT "id_level" FROM "User" WHERE "id" = ${id} FOR UPDATE`;

      if (target?.id_level === LEVELS.PROFISSIONAL_NAPNE) {
        await this.assertNoServiceInProgress(tx, id);
      }

      return tx.user.delete({
        select: USER_WITH_MANAGER_CONTACT_SELECT,
        where: {
          id: id,
        },
      });
    });
  }
}
