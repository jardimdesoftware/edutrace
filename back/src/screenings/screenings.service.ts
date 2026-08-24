import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { PrismaService } from 'src/database/prisma.service';

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

  findOne(email: string) {
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
