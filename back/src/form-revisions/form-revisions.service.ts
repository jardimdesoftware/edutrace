import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FormType, Prisma } from '@prisma/client';
import { hasAnyRole } from 'src/auth/roles';
import { FORM_MAX_VERSIONS, FORM_REVISION_READERS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';

export type RevisionAuthor = { id: number; name: string };

type RevisionTarget = {
  formType: FormType;
  idStudent: number;
  recordKey?: string;
};

export const FORM_VERSION_LIMIT_MESSAGE = `Este formulário atingiu o limite de ${FORM_MAX_VERSIONS} versões e não aceita novas edições.`;

export const UNKNOWN_AUTHOR_NAME = 'Autor não registrado';

const CONCURRENT_EDIT_MESSAGE =
  'Este formulário foi editado por outra pessoa ao mesmo tempo. Recarregue e tente de novo.';

const NOT_FOUND_MESSAGE = 'Versão do formulário não encontrada';

// O conteúdo da versão é o que a rota devolveria: datas viram texto, que é o
// que o JSON aceita.
export function toSnapshot(record: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(record)) as Prisma.InputJsonValue;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class FormRevisionsService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  // Versão 1 de um formulário recém-criado. Roda na transação que cria o
  // formulário: se a versão falhar, o formulário não fica gravado.
  async recordCreation(
    tx: Prisma.TransactionClient,
    target: RevisionTarget,
    snapshot: unknown,
    author: RevisionAuthor,
  ) {
    await tx.formRevision.create({
      data: this.revisionData(target, 1, snapshot, author),
    });
  }

  // Versão seguinte de uma edição, na transação que edita o formulário. O
  // formulário que já existia sem histórico recebe antes a versão 1, com o
  // estado anterior à edição. A edição que passaria do teto recebe 409.
  async recordEdit(
    tx: Prisma.TransactionClient,
    target: RevisionTarget,
    change: {
      before: unknown;
      beforeAt: Date;
      beforeAuthor?: RevisionAuthor | null;
      after: unknown;
    },
    author: RevisionAuthor,
  ) {
    const where = this.targetWhere(target);
    let count = await tx.formRevision.count({ where });

    if (count === 0) {
      await tx.formRevision.create({
        data: {
          ...this.revisionData(
            target,
            1,
            change.before,
            change.beforeAuthor ?? { id: 0, name: UNKNOWN_AUTHOR_NAME },
          ),
          id_author: change.beforeAuthor?.id ?? null,
          created_at: change.beforeAt,
        },
      });
      count = 1;
    }

    if (count >= FORM_MAX_VERSIONS) {
      throw new ConflictException(FORM_VERSION_LIMIT_MESSAGE);
    }

    try {
      await tx.formRevision.create({
        data: this.revisionData(target, count + 1, change.after, author),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(CONCURRENT_EDIT_MESSAGE);
      }
      throw error;
    }
  }

  // Excluir o formulário apaga o histórico dele, e criar de novo recomeça na
  // versão 1.
  async removeAll(tx: Prisma.TransactionClient, target: RevisionTarget) {
    await tx.formRevision.deleteMany({ where: this.targetWhere(target) });
  }

  async list(
    formType: FormType,
    email: string,
    recordKey: string,
    roles: readonly number[],
  ) {
    this.assertReader(formType, roles);
    const student = await this.studentsService.findOneOrFail({ email });

    return this.prisma.formRevision.findMany({
      where: this.targetWhere({
        formType,
        idStudent: student.id,
        recordKey,
      }),
      orderBy: { version: 'asc' },
      select: { version: true, author_name: true, created_at: true },
    });
  }

  async findVersion(
    formType: FormType,
    email: string,
    recordKey: string,
    version: number,
    roles: readonly number[],
  ) {
    this.assertReader(formType, roles);
    const student = await this.studentsService.findOneOrFail({ email });

    const revision = await this.prisma.formRevision.findFirst({
      where: {
        ...this.targetWhere({ formType, idStudent: student.id, recordKey }),
        version,
      },
      select: {
        version: true,
        author_name: true,
        created_at: true,
        snapshot: true,
      },
    });
    if (!revision) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return revision;
  }

  // O 403 vem antes de consultar o banco, para que a resposta não diga se o
  // e-mail existe.
  private assertReader(formType: FormType, roles: readonly number[]) {
    if (!hasAnyRole(roles, FORM_REVISION_READERS[formType])) {
      throw new ForbiddenException(
        'Você não tem permissão para ver o histórico deste formulário',
      );
    }
  }

  private targetWhere({ formType, idStudent, recordKey }: RevisionTarget) {
    return {
      form_type: formType,
      id_student: idStudent,
      record_key: recordKey ?? '',
    };
  }

  private revisionData(
    target: RevisionTarget,
    version: number,
    snapshot: unknown,
    author: RevisionAuthor,
  ): Prisma.FormRevisionUncheckedCreateInput {
    return {
      ...this.targetWhere(target),
      version,
      snapshot: toSnapshot(snapshot),
      author_name: author.name,
      id_author: author.id,
    };
  }
}
