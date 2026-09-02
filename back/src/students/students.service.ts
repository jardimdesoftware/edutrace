import { Injectable } from '@nestjs/common';
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
}
