import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async findOne(email: string) {
    await this.studentsService.findOneOrFail({ email });

    return this.prisma.$queryRaw<any[]>`
      SELECT a.*, p.*, s.*
      FROM "Anamnesis" a
      LEFT JOIN "PlansEducation" p ON p."student_email" = a.email
      LEFT JOIN "Screening" s ON s."email" = a.email
      WHERE a.email = ${email}
    `;
  }
}
