import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { CASE_STUDY_SECTIONS_SELECT } from 'src/case-studies/case-study-select';

// O relatório traz a triagem, o PEI e o estudo de caso, só com os campos que os
// formulários exibem. A anamnese não faz parte do relatório.
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

// As seções do estudo de caso, o nome de quem o escreveu e o curso do estudante.
// O autor e o estudante saem pelo select explícito: o User inteiro traria o CPF,
// o e-mail e o hash da senha. Sem id nem datas, que o PDF não exibe.
const REPORT_CASE_STUDY_SELECT = {
  ...CASE_STUDY_SECTIONS_SELECT,
  author: { select: { full_name: true } },
  student: { select: { course: true } },
} satisfies Prisma.CaseStudySelect;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async findOne(email: string) {
    const student = await this.studentsService.findOneOrFail({ email });

    const [screening, plansEducation, caseStudy] = await Promise.all([
      this.prisma.screening.findUnique({
        where: { email },
        select: REPORT_SCREENING_SELECT,
      }),
      this.prisma.plansEducation.findUnique({
        where: { student_email: email },
        select: REPORT_PLANS_EDUCATION_SELECT,
      }),
      this.prisma.caseStudy.findUnique({
        where: { id_student: student.id },
        select: REPORT_CASE_STUDY_SELECT,
      }),
    ]);

    return { screening, plansEducation, caseStudy };
  }
}
