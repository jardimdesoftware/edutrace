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
import { FormType } from '@prisma/client';
import {
  FormRevisionsService,
  RevisionAuthor,
} from 'src/form-revisions/form-revisions.service';
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
    private formRevisions: FormRevisionsService,
  ) {}

  async create(createAeePlanDto: CreateAeePlanDto, author: RevisionAuthor) {
    const student = await this.studentsService.findOneOrFail({
      email: createAeePlanDto.student_email,
    });

    try {
      // O PAEE e a versão 1 são gravados juntos.
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.aeePlan.create({
          data: {
            ...pickSections(createAeePlanDto),
            semester: createAeePlanDto.semester,
            id_student: student.id,
            id_author: author.id,
          } as unknown as Prisma.AeePlanUncheckedCreateInput,
          select: AEE_PLAN_SELECT,
        });
        await this.formRevisions.recordCreation(
          tx,
          {
            formType: FormType.AEE_PLAN,
            idStudent: student.id,
            recordKey: createAeePlanDto.semester,
          },
          created,
          author,
        );
        return created;
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
  async update(
    id: number,
    updateAeePlanDto: UpdateAeePlanDto,
    author: RevisionAuthor,
  ) {
    try {
      // A edição e a versão nova são gravadas juntas; a edição que passa do
      // teto de versões recebe 409 e o PAEE não muda.
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.aeePlan.findUnique({
          where: { id },
          select: { ...AEE_PLAN_SELECT, id_student: true },
        });
        if (!before) {
          throw new NotFoundException(NOT_FOUND_MESSAGE);
        }

        const updated = await tx.aeePlan.update({
          where: { id },
          data: pickSections(
            updateAeePlanDto,
          ) as unknown as Prisma.AeePlanUncheckedUpdateInput,
          select: AEE_PLAN_SELECT,
        });
        await this.formRevisions.recordEdit(
          tx,
          {
            formType: FormType.AEE_PLAN,
            idStudent: before.id_student,
            recordKey: before.semester,
          },
          {
            before,
            beforeAt: before.updated_at ?? before.created_at,
            beforeAuthor: before.author
              ? { id: before.author.id, name: before.author.full_name }
              : null,
            after: updated,
          },
          author,
        );
        return updated;
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
      await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.aeePlan.delete({
          where: { id },
          select: { id_student: true, semester: true },
        });
        await this.formRevisions.removeAll(tx, {
          formType: FormType.AEE_PLAN,
          idStudent: deleted.id_student,
          recordKey: deleted.semester,
        });
      });
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException(NOT_FOUND_MESSAGE);
      }
      throw error;
    }

    return { message: `PAEE com id ${id} foi removido com sucesso` };
  }
}
