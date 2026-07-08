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
