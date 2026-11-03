import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommentType, Prisma } from '@prisma/client';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import {
  COMMENT_EDIT_LIMIT,
  COMMENT_LIST_LIMIT,
  COMMENT_LIST_TRANSACTION_MAX_WAIT_MS,
  COMMENT_LIST_TRANSACTION_TIMEOUT_MS,
  COMMENT_MAX_LENGTH,
  STUDENT_RECORD_READERS,
} from 'src/constants';
import { AuthenticatedRequest } from './types/express';
import { StudentsService } from 'src/students/students.service';
import { commentTooLongMessage } from './comment-max-length';
import {
  authorsSql,
  countsSql,
  pageIdsSql,
  statementTimeoutSql,
} from './comments-list.sql';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

const editsInclude = {
  edits: {
    orderBy: { created_at: 'asc' as const },
  },
};

const authorCollator = new Intl.Collator('pt-BR');

const STATEMENT_TIMEOUT_SQLSTATE = '57014';

const TRANSACTION_START_TIMEOUT_TEXT =
  'Unable to start a transaction in the given time';

const SEARCH_TIMEOUT_MESSAGE =
  'A busca demorou demais. Refine os filtros e tente de novo.';

const BUSY_MESSAGE = 'O sistema está ocupado. Tente de novo em instantes.';

function isStatementTimeout(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2010'
  ) {
    return false;
  }

  const driverError = error.meta?.driverAdapterError as
    { cause?: { code?: unknown } } | undefined;

  return driverError?.cause?.code === STATEMENT_TIMEOUT_SQLSTATE;
}

function isTransactionStartTimeout(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2028' &&
    error.message.includes(TRANSACTION_START_TIMEOUT_TEXT)
  );
}

export interface CommentAuthor {
  id: number;
  name: string;
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private studentsService: StudentsService,
  ) {}

  async create(
    createCommentDto: CreateCommentDto,
    idAuthor: number,
    userName: string,
    authorLevel: number,
  ) {
    const {
      comment,
      id_user,
      notify_by_email,
      type = CommentType.NOTE,
    } = createCommentDto;

    await this.studentsService.findOneOrFail({ id: id_user });

    const commentCreated = await this.prisma.comments.create({
      data: {
        comment,
        type,
        id_user,
        id_author: idAuthor,
        author_name: userName,
      },
      include: editsInclude,
    });

    if (notify_by_email) {
      await this.notifyStudent(id_user, 'created');
    }

    return { ...commentCreated, author_level: authorLevel };
  }

  async update(
    idComment: number,
    updateCommentDto: UpdateCommentDto,
    request: AuthenticatedRequest,
  ) {
    const existingComment = await this.prisma.comments.findUnique({
      where: { id: idComment },
      include: editsInclude,
    });

    if (!existingComment || existingComment.deleted_at) {
      throw new NotFoundException('Anotação não encontrada');
    }

    if (existingComment.id_author !== request.user.sub) {
      throw new ForbiddenException(
        'Você só pode editar as anotações que você mesmo criou',
      );
    }

    const { comment, notify_by_email } = updateCommentDto;

    const maxLength = COMMENT_MAX_LENGTH[existingComment.type];

    if (comment.length > maxLength) {
      throw new BadRequestException([commentTooLongMessage(maxLength)]);
    }

    if (
      comment !== existingComment.comment &&
      existingComment.edits.length >= COMMENT_EDIT_LIMIT
    ) {
      throw new ForbiddenException(
        `Esta anotação atingiu o limite de ${COMMENT_EDIT_LIMIT} edições`,
      );
    }

    const commentUpdated =
      comment === existingComment.comment
        ? existingComment
        : await this.prisma.$transaction(async (tx) => {
            await tx.commentEdits.create({
              data: {
                id_comment: idComment,
                comment: existingComment.comment,
              },
            });

            return tx.comments.update({
              where: { id: idComment },
              data: { comment },
              include: editsInclude,
            });
          });

    if (notify_by_email) {
      await this.notifyStudent(existingComment.id_user, 'updated');
    }

    return { ...commentUpdated, author_level: request.user.id_level };
  }

  async findAllByIdUser(
    idUser: number,
    query: ListCommentsQueryDto,
    request: AuthenticatedRequest,
  ) {
    const readsAnyStudent = STUDENT_RECORD_READERS.includes(
      request.user.id_level,
    );
    const isOwnRecord = request.user.sub === idUser;

    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar estas anotações',
      );
    }

    await this.studentsService.findOneOrFail({ id: idUser });

    const limit = query.limit ?? COMMENT_LIST_LIMIT.DEFAULT;

    const { counts, pageRows, authorRows } = await this.queryPage(
      idUser,
      query,
      limit,
    );

    const pageIds = pageRows.slice(0, limit).map((row) => row.id);
    const hasMore = pageRows.length > limit;

    const comments =
      pageIds.length === 0
        ? []
        : await this.prisma.comments.findMany({
            where: { id: { in: pageIds }, id_user: idUser },
            orderBy: { id: 'desc' },
            include: editsInclude,
          });

    return {
      items: await this.withAuthorLevel(comments),
      next_cursor: hasMore ? pageIds[pageIds.length - 1] : null,
      total: counts.total,
      overall: counts.overall,
      authors: [...authorRows].sort(
        (a, b) => authorCollator.compare(a.name, b.name) || a.id - b.id,
      ),
    };
  }

  private async queryPage(
    idUser: number,
    query: ListCommentsQueryDto,
    limit: number,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw(statementTimeoutSql());

          const [counts] = await tx.$queryRaw<
            { overall: number; total: number }[]
          >(countsSql(idUser, query));
          const pageRows = await tx.$queryRaw<{ id: number }[]>(
            pageIdsSql(idUser, query, limit),
          );
          const authorRows = await tx.$queryRaw<CommentAuthor[]>(
            authorsSql(idUser),
          );

          return { counts, pageRows, authorRows };
        },
        {
          maxWait: COMMENT_LIST_TRANSACTION_MAX_WAIT_MS,
          timeout: COMMENT_LIST_TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (isStatementTimeout(error)) {
        throw new ServiceUnavailableException(SEARCH_TIMEOUT_MESSAGE);
      }

      if (isTransactionStartTimeout(error)) {
        throw new ServiceUnavailableException(BUSY_MESSAGE);
      }

      throw error;
    }
  }

  private async withAuthorLevel<T extends { id_author: number }>(
    comments: T[],
  ) {
    const authorIds = [...new Set(comments.map((c) => c.id_author))];

    if (authorIds.length === 0) {
      return [];
    }

    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, id_level: true },
    });
    const levelByAuthor = new Map(
      authors.map((author) => [author.id, author.id_level]),
    );

    return comments.map((comment) => ({
      ...comment,
      author_level: levelByAuthor.get(comment.id_author) ?? null,
    }));
  }

  private async notifyStudent(idUser: number, event: 'created' | 'updated') {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: idUser },
        select: { email: true },
      });

      if (!student) {
        return;
      }

      if (event === 'created') {
        await this.mailService.sendNewCommentNotice(student.email);
        return;
      }

      await this.mailService.sendUpdatedCommentNotice(student.email);
    } catch (error) {
      this.logger.error(
        `Falha ao enviar o aviso de anotação para o usuário ${idUser}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
