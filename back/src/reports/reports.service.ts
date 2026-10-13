import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';

// O relatório traz a triagem e o PEI, só com os campos que os formulários
// exibem. A anamnese não faz parte do relatório.
const REPORT_SCREENING_SELECT = {
  report: true,
  specific_need: true,
  physical_disability: true,
  visual_impairment: true,
  hearing_impairment: true,
  global_disorder: true,
  other_disabilities: true,
} satisfies Prisma.ScreeningSelect;

const REPORT_PLANS_EDUCATION_SELECT = {
  professor_name: true,
  professor_email: true,
  academic_semester: true,
  service_modality: true,
  support_service: true,
  skills: true,
  resource_equipment_used: true,
  resource_equipment_needs: true,
  curriculum_accessibility: true,
  school_content: true,
  activities_to_be_developed: true,
  objectives: true,
  work_methodology: true,
  materials_used: true,
  evaluation_criteria: true,
} satisfies Prisma.PlansEducationSelect;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async findOne(email: string) {
    await this.studentsService.findOneOrFail({ email });

    const [screening, plansEducation] = await Promise.all([
      this.prisma.screening.findUnique({
        where: { email },
        select: REPORT_SCREENING_SELECT,
      }),
      this.prisma.plansEducation.findUnique({
        where: { student_email: email },
        select: REPORT_PLANS_EDUCATION_SELECT,
      }),
    ]);

    return { screening, plansEducation };
  }
}
