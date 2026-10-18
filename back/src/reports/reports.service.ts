import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { AEE_PLAN_SECTIONS_SELECT } from 'src/aee-plans/aee-plan-select';
import { CASE_STUDY_SECTIONS_SELECT } from 'src/case-studies/case-study-select';
import {
  PEI_ENTRY_CONTENT_SELECT,
  PEI_ENTRY_OPINION_SELECT,
  PEI_ENTRY_ORDER_BY,
} from 'src/pei-entries/pei-entry-select';

// O relatório traz a triagem, os registros do PEI, o estudo de caso e os PAEE,
// só com os campos que os formulários exibem. A anamnese não faz parte do
// relatório.
const REPORT_SCREENING_SELECT = {
  report: true,
  specific_need: true,
  physical_disability: true,
  visual_impairment: true,
  hearing_impairment: true,
  global_disorder: true,
  other_disabilities: true,
} satisfies Prisma.ScreeningSelect;

// O semestre, a disciplina, os sete campos de conteúdo, os quatro do parecer
// semestral e o nome de quem escreveu o registro. O autor sai pelo select
// explícito: o User inteiro traria o CPF, o e-mail e o hash da senha. Sem id,
// id_author, id_student, deleted_at nem datas, que o PDF não exibe.
const REPORT_PEI_ENTRY_SELECT = {
  semester: true,
  subject: true,
  ...PEI_ENTRY_CONTENT_SELECT,
  ...PEI_ENTRY_OPINION_SELECT,
  author: { select: { full_name: true } },
} satisfies Prisma.PeiEntrySelect;

// As seções do estudo de caso, o nome de quem o escreveu e o curso do estudante.
// O autor e o estudante saem pelo select explícito: o User inteiro traria o CPF,
// o e-mail e o hash da senha. Sem id nem datas, que o PDF não exibe.
const REPORT_CASE_STUDY_SELECT = {
  ...CASE_STUDY_SECTIONS_SELECT,
  author: { select: { full_name: true } },
  student: { select: { course: true } },
} satisfies Prisma.CaseStudySelect;

// O período letivo, as seções do PAEE, o nome de quem o escreveu e o curso do
// estudante. O autor e o estudante saem pelo select explícito: o User inteiro
// traria o CPF, o e-mail e o hash da senha. Sem id nem datas, que o PDF não
// exibe.
const REPORT_AEE_PLAN_SELECT = {
  semester: true,
  ...AEE_PLAN_SECTIONS_SELECT,
  author: { select: { full_name: true } },
  student: { select: { course: true } },
} satisfies Prisma.AeePlanSelect;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async findOne(email: string) {
    const student = await this.studentsService.findOneOrFail({ email });

    const [screening, peiEntries, caseStudy, aeePlans] = await Promise.all([
      this.prisma.screening.findUnique({
        where: { email },
        select: REPORT_SCREENING_SELECT,
      }),
      this.prisma.peiEntry.findMany({
        where: { id_student: student.id, deleted_at: null },
        orderBy: PEI_ENTRY_ORDER_BY,
        select: REPORT_PEI_ENTRY_SELECT,
      }),
      this.prisma.caseStudy.findUnique({
        where: { id_student: student.id },
        select: REPORT_CASE_STUDY_SELECT,
      }),
      this.prisma.aeePlan.findMany({
        where: { id_student: student.id },
        orderBy: { semester: 'desc' },
        select: REPORT_AEE_PLAN_SELECT,
      }),
    ]);

    return { screening, peiEntries, caseStudy, aeePlans };
  }
}
