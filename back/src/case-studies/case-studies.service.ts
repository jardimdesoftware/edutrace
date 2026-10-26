import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { CASE_STUDY_READERS } from 'src/constants';
import { hasAnyRole } from 'src/auth/roles';
import { StudentsService } from 'src/students/students.service';
import {
  CASE_STUDY_SECTIONS_SELECT,
  CASE_STUDY_SELECT,
} from './case-study-select';
import { CreateCaseStudyDto } from './dto/create-case-study.dto';
import { UpdateCaseStudyDto } from './dto/update-case-study.dto';

type Sections = Omit<CreateCaseStudyDto, 'student_email'>;

const NOT_FOUND_MESSAGE = 'Estudo de caso não encontrado';

const SECTION_KEYS = Object.keys(CASE_STUDY_SECTIONS_SELECT) as Array<
  keyof Sections
>;

// Só as seções entram na gravação. O estudante e o autor são definidos pelo
// service, então um id_student ou um id_author que viesse no objeto não os
// troca, mesmo que o pipe de validação deixe de recusá-los.
function pickSections(dto: Partial<Sections>): Partial<Sections> {
  return Object.fromEntries(
    SECTION_KEYS.filter((key) => dto[key] !== undefined).map((key) => [
      key,
      dto[key],
    ]),
  );
}

// Só o código do erro é conferido, e não a constraint violada. O
// @prisma/adapter-pg (Prisma 7) devolve o P2002 sem meta.target, e o create só
// pode violar a unicidade de id_student (a chave primária é uma sequência).
function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

@Injectable()
export class CaseStudiesService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async create(createCaseStudyDto: CreateCaseStudyDto, idAuthor: number) {
    const student = await this.studentsService.findOneOrFail({
      email: createCaseStudyDto.student_email,
    });

    try {
      return await this.prisma.caseStudy.create({
        data: {
          ...pickSections(createCaseStudyDto),
          id_student: student.id,
          id_author: idAuthor,
        } as unknown as Prisma.CaseStudyUncheckedCreateInput,
        select: CASE_STUDY_SELECT,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Este estudante já tem um estudo de caso.');
      }
      throw error;
    }
  }

  async findOne(email: string, request: AuthenticatedRequest) {
    const readsAnyStudent = hasAnyRole(request.user.roles, CASE_STUDY_READERS);
    const isOwnRecord = request.user.email === email;

    // O 403 vem antes de consultar o banco, para que o estudante receba a
    // mesma resposta de um e-mail que existe e de um que não existe.
    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar este estudo de caso',
      );
    }

    const student = await this.studentsService.findOneOrFail({ email });

    const caseStudy = await this.prisma.caseStudy.findUnique({
      where: { id_student: student.id },
      select: CASE_STUDY_SELECT,
    });
    if (!caseStudy) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return caseStudy;
  }

  // Cada seção enviada substitui a seção inteira; as que não vieram ficam como
  // estão. O autor e o estudante não mudam.
  async update(email: string, updateCaseStudyDto: UpdateCaseStudyDto) {
    const student = await this.studentsService.findOneOrFail({ email });

    try {
      return await this.prisma.caseStudy.update({
        where: { id_student: student.id },
        data: pickSections(
          updateCaseStudyDto,
        ) as unknown as Prisma.CaseStudyUncheckedUpdateInput,
        select: CASE_STUDY_SELECT,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException(NOT_FOUND_MESSAGE);
      }
      throw error;
    }
  }

  // Sem a conferência de que a conta é de estudante, como no DELETE da triagem
  // e da anamnese: o estudo de caso de uma conta que deixou de ser estudante
  // continua removível.
  async remove(email: string) {
    const { count } = await this.prisma.caseStudy.deleteMany({
      where: { student: { email } },
    });
    if (count === 0) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return {
      message: `Estudo de caso com email ${email} foi removido com sucesso`,
    };
  }
}
