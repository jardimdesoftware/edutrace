import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import { userSelectFor } from 'src/users/users.select';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  // O nível de quem pede decide o select (userSelectFor): o telefone e o CPF do
  // responsável externo só saem do banco para quem os administra.
  findAll(requesterLevel: number) {
    return this.prisma.user.findMany({
      where: {
        id_level: LEVELS.ALUNO_ESTUDANTE,
      },
      select: userSelectFor(requesterLevel),
    });
  }

  findOne(email: string, requesterLevel: number) {
    return this.prisma.user.findFirst({
      where: {
        email,
        id_level: LEVELS.ALUNO_ESTUDANTE,
      },
      select: userSelectFor(requesterLevel),
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
