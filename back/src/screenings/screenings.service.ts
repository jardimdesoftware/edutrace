import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS } from 'src/constants';

@Injectable()
export class ScreeningsService {
  constructor(private prisma: PrismaService) {}

  async create(createScreeningDto: CreateScreeningDto) {
    return this.prisma.screening.create({
      data: createScreeningDto,
    });
  }

  findAll() {
    return this.prisma.screening.findMany();
  }

  async findOne(email: string, request: AuthenticatedRequest) {
    const isStudent = request.user.id_level == LEVELS.ALUNO_ESTUDANTE;
    const isViewingOtherProfile = request.user.email !== email;

    if (isStudent && isViewingOtherProfile) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta triagem',
      );
    }

    return this.prisma.screening.findUnique({
      where: { email },
    });
  }

  async update(email: string, updateScreeningDto: Partial<CreateScreeningDto>) {
    const existing = await this.prisma.screening.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Triagem com email ${email} não encontrada`);
    }

    return this.prisma.screening.update({
      where: { email },
      data: updateScreeningDto,
    });
  }

  async remove(email: string) {
    const existing = await this.prisma.screening.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Triagem com email ${email} não encontrada`);
    }

    await this.prisma.screening.delete({ where: { email } });
    return { message: `Triagem com email ${email} foi removida com sucesso` };
  }
}
