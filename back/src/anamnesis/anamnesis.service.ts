import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS, PHASES } from 'src/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { StudentsService } from 'src/students/students.service';

@Injectable()
export class AnamnesisService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async create(createAnamnesisDto: CreateAnamnesisDto) {
    await this.studentsService.findOneOrFail({
      email: createAnamnesisDto.email,
    });

    // A anamnese e a fase do estudante são gravadas juntas: se a fase falhar,
    // a anamnese não fica no banco.
    const [anamnesisCreated] = await this.prisma.$transaction([
      this.prisma.anamnesis.create({ data: createAnamnesisDto }),
      this.prisma.user.update({
        where: { email: createAnamnesisDto.email },
        data: { id_current_phase: PHASES.ANAMNESE },
      }),
    ]);

    return anamnesisCreated;
  }

  async findAll() {
    const emails = await this.studentsService.findAllEmails();

    return this.prisma.anamnesis.findMany({
      where: { email: { in: emails } },
    });
  }

  async findOne(email: string, request: AuthenticatedRequest) {
    const isStudent = request.user.id_level == LEVELS.ALUNO_ESTUDANTE;
    const isViewingOtherProfile = request.user.email !== email;

    if (isStudent && isViewingOtherProfile) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta anamnese',
      );
    }

    await this.studentsService.findOneOrFail({ email });

    return this.prisma.anamnesis.findUnique({
      where: { email },
    });
  }

  async update(email: string, updateAnamnesisDto: Partial<CreateAnamnesisDto>) {
    const existing = await this.prisma.anamnesis.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Anamnese com email ${email} não encontrada`);
    }

    return this.prisma.anamnesis.update({
      where: { email },
      data: updateAnamnesisDto,
    });
  }

  async remove(email: string) {
    const existing = await this.prisma.anamnesis.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Anamnese com email ${email} não encontrada`);
    }

    await this.prisma.anamnesis.delete({ where: { email } });
    return { message: `Anamnese com email ${email} foi removida com sucesso` };
  }
}
