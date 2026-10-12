import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import { PUBLIC_USER_SELECT } from 'src/users/users.select';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      where: {
        id_level: LEVELS.ALUNO_ESTUDANTE,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  findOne(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        id_level: LEVELS.ALUNO_ESTUDANTE,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  // Titular de triagem, anamnese, PEI, anotação e relatório. Os profissionais
  // trabalham com registros de estudantes, então administrador, profissional e
  // e-mail sem conta caem no mesmo 404.
  async findOneOrFail(where: { email: string } | { id: number }) {
    const student = await this.prisma.user.findFirst({
      where: { ...where, id_level: LEVELS.ALUNO_ESTUDANTE },
      select: { id: true, email: true },
    });

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student;
  }

  async findAllEmails(): Promise<string[]> {
    const students = await this.prisma.user.findMany({
      where: { id_level: LEVELS.ALUNO_ESTUDANTE },
      select: { email: true },
    });

    return students.map((student) => student.email);
  }
}
