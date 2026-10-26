import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { AEE_PLAN_READERS } from 'src/constants';
import { hasAnyRole } from 'src/auth/roles';
import { StudentsService } from 'src/students/students.service';
import { AEE_PLAN_SECTIONS_SELECT, AEE_PLAN_SELECT } from './aee-plan-select';
import { CreateAeePlanDto } from './dto/create-aee-plan.dto';
import { UpdateAeePlanDto } from './dto/update-aee-plan.dto';

type Sections = Omit<CreateAeePlanDto, 'student_email' | 'semester'>;

const NOT_FOUND_MESSAGE = 'PAEE não encontrado';

const SECTION_KEYS = Object.keys(AEE_PLAN_SECTIONS_SELECT) as Array<
  keyof Sections
>;

// Só as seções entram na gravação. O estudante, o autor e o período letivo são
// definidos pelo service (ou não mudam), então um id_student, um id_author ou
// um semester que viesse no objeto não os troca, mesmo que o pipe de validação
// deixe de recusá-los.
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
// pode violar a unicidade de (id_student, semester) (a chave primária é uma
// sequência).
function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

// P2025: o PAEE não existe. P2020: o id passa do maior INTEGER do PostgreSQL
// (2147483647), então também não existe. A rota já recusa esse id com 400 no
// ParsePositiveIdPipe, e esta conversão evita o 500 se o service receber um id
// assim por outro caminho.
function isNotFound(error: unknown): boolean {
  return isPrismaError(error, 'P2025') || isPrismaError(error, 'P2020');
}

@Injectable()
export class AeePlansService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  async create(createAeePlanDto: CreateAeePlanDto, idAuthor: number) {
    const student = await this.studentsService.findOneOrFail({
      email: createAeePlanDto.student_email,
    });

    try {
      return await this.prisma.aeePlan.create({
        data: {
          ...pickSections(createAeePlanDto),
          semester: createAeePlanDto.semester,
          id_student: student.id,
          id_author: idAuthor,
        } as unknown as Prisma.AeePlanUncheckedCreateInput,
        select: AEE_PLAN_SELECT,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'Este estudante já tem um PAEE neste período letivo.',
        );
      }
      throw error;
    }
  }

  // Do período mais recente para o mais antigo. O AAAA.S ordena como texto: o
  // ano de quatro dígitos vem primeiro, e o semestre é 1 ou 2.
  async findByStudent(email: string, request: AuthenticatedRequest) {
    const readsAnyStudent = hasAnyRole(request.user.roles, AEE_PLAN_READERS);
    const isOwnRecord = request.user.email === email;

    // O 403 vem antes de consultar o banco, para que o estudante receba a
    // mesma resposta de um e-mail que existe e de um que não existe.
    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os PAEE deste estudante',
      );
    }

    const student = await this.studentsService.findOneOrFail({ email });

    return this.prisma.aeePlan.findMany({
      where: { id_student: student.id },
      orderBy: { semester: 'desc' },
      select: AEE_PLAN_SELECT,
    });
  }

  // Cada seção enviada substitui a seção inteira; as que não vieram ficam como
  // estão. O autor, o estudante e o período letivo não mudam.
  async update(id: number, updateAeePlanDto: UpdateAeePlanDto) {
    try {
      return await this.prisma.aeePlan.update({
        where: { id },
        data: pickSections(
          updateAeePlanDto,
        ) as unknown as Prisma.AeePlanUncheckedUpdateInput,
        select: AEE_PLAN_SELECT,
      });
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException(NOT_FOUND_MESSAGE);
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.aeePlan.delete({ where: { id }, select: { id: true } });
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException(NOT_FOUND_MESSAGE);
      }
      throw error;
    }

    return { message: `PAEE com id ${id} foi removido com sucesso` };
  }
}
