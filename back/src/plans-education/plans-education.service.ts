import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlansEducationDto } from './dto/create-plans-education.dto';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { STUDENT_RECORD_READERS } from 'src/constants';
import { StudentsService } from 'src/students/students.service';

@Injectable()
export class PlansEducationService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  // A autoria vem do usuário autenticado. O PATCH não altera esses campos, e
  // PATCH /auth/me mantém professor_email quando o professor troca de e-mail.
  async create(
    createPlansEducationDto: CreatePlansEducationDto,
    author: AuthenticatedRequest['user'],
  ) {
    await this.studentsService.findOneOrFail({
      email: createPlansEducationDto.student_email,
    });

    return this.prisma.plansEducation.create({
      data: {
        ...createPlansEducationDto,
        professor_email: author.email,
        professor_name: author.name,
      },
    });
  }

  async findAll() {
    const emails = await this.studentsService.findAllEmails();

    return this.prisma.plansEducation.findMany({
      where: { student_email: { in: emails } },
    });
  }

  async findOne(email: string, request: AuthenticatedRequest) {
    const readsAnyStudent = STUDENT_RECORD_READERS.includes(
      request.user.id_level,
    );
    const isOwnRecord = request.user.email === email;

    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar este PEI',
      );
    }

    await this.studentsService.findOneOrFail({ email });

    const planEducation = await this.prisma.plansEducation.findUnique({
      where: { student_email: email },
    });

    if (!planEducation) throw new NotFoundException('PEI não encontrado');

    return planEducation;
  }

  async update(email: string, data: Partial<CreatePlansEducationDto>) {
    // O PATCH devolve o registro inteiro: o titular precisa ser estudante,
    // como na leitura. O DELETE fica sem a conferência para que registros
    // gravados para quem não é estudante continuem removíveis.
    await this.studentsService.findOneOrFail({ email });

    const existing = await this.prisma.plansEducation.findUnique({
      where: { student_email: email },
    });

    if (!existing) {
      throw new NotFoundException('PEI não encontrado');
    }

    return this.prisma.plansEducation.update({
      where: { student_email: email },
      data,
    });
  }

  async remove(email: string) {
    const existing = await this.prisma.plansEducation.findUnique({
      where: { student_email: email },
    });

    if (!existing) {
      throw new NotFoundException('PEI não encontrado');
    }

    await this.prisma.plansEducation.delete({
      where: { student_email: email },
    });

    return { message: `PEI do aluno ${email} removido com sucesso` };
  }
}
