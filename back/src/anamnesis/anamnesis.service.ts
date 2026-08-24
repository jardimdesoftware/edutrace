import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAnamnesisDto } from './dto/create-anamnesis.dto';
import { PrismaService } from 'src/database/prisma.service';
import { PHASES } from 'src/constants';

@Injectable()
export class AnamnesisService {
  constructor(private prisma: PrismaService) {}

  async create(createAnamnesisDto: CreateAnamnesisDto) {
    const anamnesisCreated = await this.prisma.anamnesis.create({
      data: createAnamnesisDto,
    });

    // Atualiza fase do usuário
    await this.prisma.user.update({
      where: { email: createAnamnesisDto.email },
      data: { id_current_phase: PHASES.ANAMNESE },
    });

    return anamnesisCreated;
  }

  findAll() {
    return this.prisma.anamnesis.findMany();
  }

  findOne(email: string) {
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
