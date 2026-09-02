import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/database/prisma.service';
import { hash } from 'bcryptjs';
import { LEVELS, PHASES } from 'src/constants';
import { SessionsService } from 'src/sessions/sessions.service';
import { Prisma } from '@prisma/client';
import { PUBLIC_USER_SELECT } from './users.select';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private sessionsService: SessionsService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const encryptedPassword = await hash(createUserDto.password, 10);
    const { id_level, ...userData } = createUserDto;

    try {
      return await this.prisma.user.create({
        select: PUBLIC_USER_SELECT,
        data: {
          ...userData,
          password: encryptedPassword,
          id_level: id_level ?? LEVELS.ALUNO_ESTUDANTE,
          id_current_phase: PHASES.TRIAGEM,
          must_change_password: true,
        },
      });
    } catch (error) {
      // cpf e email são únicos no schema. Sem este tratamento a violação da
      // constraint sobe como 500 e quem cadastra não sabe o que aconteceu.
      throw this.duplicateFieldError(error) ?? error;
    }
  }

  private duplicateFieldError(error: unknown): ConflictException | null {
    const isUniqueViolation =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002';

    if (!isUniqueViolation) {
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

  async findOnePublic(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  async update(email: string, updateUserDto: UpdateUserDto) {
    const updated = await this.prisma.user.update({
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

  async setPasswordResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        password_reset_token: tokenHash,
        password_reset_expires: expiresAt,
        password_reset_attempts: 0,
      },
    });
  }

  async incrementPasswordResetAttempts(email: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        password_reset_attempts: { increment: 1 },
      },
    });
  }

  async clearPasswordResetToken(email: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        password_reset_token: null,
        password_reset_expires: null,
        password_reset_attempts: 0,
      },
    });
  }

  async updatePassword(email: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        password_reset_attempts: 0,
        must_change_password: false,
      },
    });
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
      where: {
        id: id,
      },
    });
  }
}
