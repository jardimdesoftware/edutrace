import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { COMMENT_EDIT_LIMIT, STUDENT_RECORD_READERS } from 'src/constants';
import { AuthenticatedRequest } from './types/express';
import { StudentsService } from 'src/students/students.service';

const editsInclude = {
  edits: {
    orderBy: { created_at: 'asc' as const },
  },
};

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
    const { comment, id_user, notify_by_email } = createCommentDto;

    await this.studentsService.findOneOrFail({ id: id_user });

    const commentCreated = await this.prisma.comments.create({
      data: {
        comment,
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

  async findAllByIdUser(idUser: number, request: AuthenticatedRequest) {
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

    const allComments = await this.prisma.comments.findMany({
      where: {
        id_user: idUser,
      },
      include: editsInclude,
    });

    return this.withAuthorLevel(allComments);
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
