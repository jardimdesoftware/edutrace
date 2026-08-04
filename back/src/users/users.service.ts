import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/database/prisma.service';
import { hash } from 'bcryptjs';
import { LEVELS, PHASES } from 'src/constants';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const encryptedPassword = await hash(createUserDto.password, 10);
    const { id_level, ...userData } = createUserDto;

    const userCreated = this.prisma.user.create({
      data: {
        ...userData,
        password: encryptedPassword,
        id_level: id_level ?? LEVELS.ALUNO_ESTUDANTE,
        id_current_phase: PHASES.TRIAGEM,
      },
    });

    return userCreated;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        full_name: true,
        affliation: true,
        cpf: true,
        pedagogical_manager: true,
        comments: true,
        current_phase: true,
        created_at: true,
        deleted_at: true,
        email: true,
        id_current_phase: true,
        id_level: true,
        level: true,
        updated_at: true,
      },
    });
  }

  async findOne(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
  }

  async update(email: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { email: email },
      data: {
        full_name: updateUserDto.full_name,
        id_level: updateUserDto.id_level,
      },
    });
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
          ...(hashedPassword ? { password: hashedPassword } : {}),
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
