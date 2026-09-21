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
import { LEVELS } from 'src/constants';
import { AuthenticatedRequest } from './types/express';

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
  ) {}

  async create(
    createCommentDto: CreateCommentDto,
    idAuthor: number,
    userName: string,
  ) {
    const { comment, id_user, notify_by_email } = createCommentDto;

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

    return commentCreated;
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

    return commentUpdated;
  }

  async findAllByIdUser(idUser: number, request: AuthenticatedRequest) {
    const isStudent = request.user.id_level === LEVELS.ALUNO_ESTUDANTE;
    const isViewingOtherProfile = request.user.sub !== idUser;

    if (isStudent && isViewingOtherProfile) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar estas anotações',
      );
    }

    const allComments = await this.prisma.comments.findMany({
      where: {
        id_user: idUser,
      },
      include: editsInclude,
    });
    return allComments;
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
