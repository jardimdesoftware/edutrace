import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from 'src/comments/types/express';
import {
  PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT,
  PEI_ENTRY_READERS,
} from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { CreatePeiEntryDto } from './dto/create-pei-entry.dto';
import { UpdatePeiEntryDto } from './dto/update-pei-entry.dto';
import {
  PEI_ENTRY_CONTENT_SELECT,
  PEI_ENTRY_ORDER_BY,
  PEI_ENTRY_SELECT,
} from './pei-entry-select';

type Content = Omit<
  CreatePeiEntryDto,
  'student_email' | 'semester' | 'subject'
>;

const NOT_FOUND_MESSAGE = 'Registro do PEI não encontrado';

const MAX_ENTRIES_MESSAGE = `Este estudante já tem o máximo de ${PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT} registros do PEI ativos.`;

const NOT_AUTHOR_MESSAGE =
  'Você só pode alterar os registros do PEI que você mesmo criou';

const CONTENT_KEYS = Object.keys(PEI_ENTRY_CONTENT_SELECT) as Array<
  keyof Content
>;

// Só os campos de conteúdo entram na gravação. O estudante, o autor, o
// semestre, a disciplina e o deleted_at são definidos pelo service (ou não
// mudam), então um id_student, um id_author, um semester, um subject ou um
// deleted_at que viesse no objeto não os troca, mesmo que o pipe de validação
// deixe de recusá-los. Os pares da lista vão como objetos simples com só as
// duas chaves.
function pickContent(dto: Partial<Content>): Partial<Content> {
  const content: Partial<Content> = Object.fromEntries(
    CONTENT_KEYS.filter((key) => dto[key] !== undefined).map((key) => [
      key,
      dto[key],
    ]),
  );

  if (content.syllabus_adaptations === undefined) {
    return content;
  }

  return {
    ...content,
    syllabus_adaptations: content.syllabus_adaptations.map(
      ({ syllabus_content, adaptation }) => ({ syllabus_content, adaptation }),
    ),
  };
}

// Só o código do erro é conferido, e não a constraint violada. O
// @prisma/adapter-pg (Prisma 7) devolve o P2002 sem meta.target, e o create só
// pode violar a unicidade de (id_student, semester, subject) entre os ativos (a
// chave primária é uma sequência).
function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

// P2025: o registro não existe ou foi excluído entre a leitura e a gravação.
// P2020: o id passa do maior INTEGER do PostgreSQL (2147483647), então também
// não existe. A rota já recusa esse id com 400 no ParsePositiveIdPipe, e esta
// conversão evita o 500 se o service receber um id assim por outro caminho.
function rethrowNotFound(error: unknown): never {
  if (isPrismaError(error, 'P2025') || isPrismaError(error, 'P2020')) {
    throw new NotFoundException(NOT_FOUND_MESSAGE);
  }
  throw error;
}

@Injectable()
export class PeiEntriesService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  // A trava da linha do estudante, a contagem dos registros ativos e a gravação
  // rodam na mesma transação. Dois POST do mesmo estudante se enfileiram na
  // trava, e a contagem do segundo enxerga o que o primeiro confirmou (READ
  // COMMITTED, o padrão): sem a trava, os dois contariam 299 e gravariam,
  // passando do teto. O 404 do estudante sai da própria trava, que confere o
  // nível sob ela; a consulta do estudante não pode usar outra conexão do pool
  // dentro da transação, porque com o pool inteiro ocupado por transações iguais
  // ela esperaria uma conexão que só volta quando elas acabam.
  //
  // A linha do autor é travada antes da do estudante (FOR KEY SHARE, a trava
  // que a chave estrangeira id_author pede no INSERT). A troca de nível do
  // professor (UsersService.update) trava o professor e depois os estudantes
  // dele, e na ordem inversa as duas transações esperariam uma pela outra
  // (deadlock). A ordem do projeto é servidor antes de estudante.
  async create(createPeiEntryDto: CreatePeiEntryDto, idAuthor: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "User" WHERE "id" = ${idAuthor} FOR KEY SHARE`;

        const student = await this.studentsService.lockStudent(
          tx,
          createPeiEntryDto.student_email,
        );

        const active = await tx.peiEntry.count({
          where: { id_student: student.id, deleted_at: null },
        });
        if (active >= PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT) {
          throw new ConflictException(MAX_ENTRIES_MESSAGE);
        }

        return tx.peiEntry.create({
          data: {
            ...pickContent(createPeiEntryDto),
            semester: createPeiEntryDto.semester,
            subject: createPeiEntryDto.subject,
            id_student: student.id,
            id_author: idAuthor,
          } as unknown as Prisma.PeiEntryUncheckedCreateInput,
          select: PEI_ENTRY_SELECT,
        });
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'Este estudante já tem um registro do PEI desta disciplina neste semestre.',
        );
      }
      throw error;
    }
  }

  // Só os registros ativos: o excluído continua no banco e sai da listagem.
  async findByStudent(email: string, request: AuthenticatedRequest) {
    const readsAnyStudent = PEI_ENTRY_READERS.includes(request.user.id_level);
    const isOwnRecord = request.user.email === email;

    // O 403 vem antes de consultar o banco, para que o estudante receba a
    // mesma resposta de um e-mail que existe e de um que não existe.
    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar o PEI deste estudante',
      );
    }

    const student = await this.studentsService.findOneOrFail({ email });

    return this.prisma.peiEntry.findMany({
      where: { id_student: student.id, deleted_at: null },
      orderBy: PEI_ENTRY_ORDER_BY,
      select: PEI_ENTRY_SELECT,
    });
  }

  // Cada campo enviado substitui o valor inteiro; os que não vieram ficam como
  // estão. Só o autor edita, e o 404 vem antes do 403 (como nas anotações): quem
  // não é o autor também não descobre se o id existe e está excluído. O registro
  // de um autor cuja conta foi excluída (id_author nulo) não é de ninguém, e
  // ninguém o edita: a exclusão dele é a única saída (veja o remove).
  async update(
    id: number,
    updatePeiEntryDto: UpdatePeiEntryDto,
    idAuthor: number,
  ) {
    try {
      const entryAuthor = await this.findActiveEntryAuthor(id);
      if (entryAuthor !== idAuthor) {
        throw new ForbiddenException(NOT_AUTHOR_MESSAGE);
      }

      // O where com deleted_at null impede editar um registro excluído entre a
      // leitura e a escrita: o update falha com P2025.
      return await this.prisma.peiEntry.update({
        where: { id, deleted_at: null },
        data: pickContent(
          updatePeiEntryDto,
        ) as unknown as Prisma.PeiEntryUncheckedUpdateInput,
        select: PEI_ENTRY_SELECT,
      });
    } catch (error) {
      return rethrowNotFound(error);
    }
  }

  // Exclusão lógica: grava deleted_at e mantém a linha no banco. O registro
  // sai das listagens e do relatório, e o professor pode criar de novo o mesmo
  // trio (o índice único só vale entre os ativos). Exclui o autor ou, quando a
  // conta do autor foi excluída e o registro ficou sem autor, qualquer
  // Profissional da Educação (a rota só aceita o nível 3): sem isso, o trio
  // ficaria preso para sempre, porque ninguém edita o registro sem autor.
  async remove(id: number, idAuthor: number) {
    try {
      const entryAuthor = await this.findActiveEntryAuthor(id);
      if (entryAuthor !== null && entryAuthor !== idAuthor) {
        throw new ForbiddenException(NOT_AUTHOR_MESSAGE);
      }

      await this.prisma.peiEntry.update({
        where: { id, deleted_at: null },
        data: { deleted_at: new Date() },
        select: { id: true },
      });
    } catch (error) {
      return rethrowNotFound(error);
    }

    return { message: `Registro do PEI com id ${id} foi removido com sucesso` };
  }

  // O autor do registro ativo (nulo quando a conta dele foi excluída). 404 se o
  // registro não existe ou está excluído.
  private async findActiveEntryAuthor(id: number): Promise<number | null> {
    const entry = await this.prisma.peiEntry.findFirst({
      where: { id, deleted_at: null },
      select: { id_author: true },
    });

    if (!entry) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return entry.id_author;
  }
}
