import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class LevelsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.level.findMany();
  }

  async findOne(id: number) {
    return this.prisma.level.findUnique({
      where: {
        id: id,
      },
    });
  }
}
