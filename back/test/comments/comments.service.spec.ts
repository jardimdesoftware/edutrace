import { StudentsService } from 'src/students/students.service';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommentType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { CommentsService } from 'src/comments/comments.service';
import {
  COMMENT_EDIT_LIMIT,
  COMMENT_LIST_TRANSACTION_MAX_WAIT_MS,
  COMMENT_LIST_TRANSACTION_TIMEOUT_MS,
  LEVELS,
} from 'src/constants';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: PrismaService;
  let studentsService: StudentsService;
  let mailService: MailService;
  let transactionClient: {
    commentEdits: { create: jest.Mock };
    comments: { update: jest.Mock };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };

  const editsInclude = { edits: { orderBy: { created_at: 'asc' } } };

  const mockComment = {
    id: 1,
    id_user: 10,
    id_author: 5,
    author_name: 'Dr. Silva',
    comment: 'Observação importante',
    type: CommentType.NOTE,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    edits: [],
  };

  beforeEach(async () => {
    transactionClient = {
      commentEdits: { create: jest.fn() },
      comments: { update: jest.fn() },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: StudentsService,
          useValue: {
            findOneOrFail: jest
              .fn()
              .mockResolvedValue({ id: 2, email: 'estudante@example.com' }),
            findAllEmails: jest
              .fn()
              .mockResolvedValue(['estudante@example.com']),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            comments: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            $queryRaw: jest.fn(),
            $queryRawUnsafe: jest.fn(),
            $executeRaw: jest.fn(),
            $executeRawUnsafe: jest.fn(),
            $transaction: jest.fn(
              (callback: (tx: typeof transactionClient) => unknown) =>
                callback(transactionClient),
            ),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendNewCommentNotice: jest.fn(),
            sendUpdatedCommentNotice: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    prisma = module.get<PrismaService>(PrismaService);
    studentsService = module.get<StudentsService>(StudentsService);
    mailService = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a comment with author id and name', async () => {
      const createDto = { id_user: 10, comment: 'Observação importante' };
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);

      const result = await service.create(
        createDto as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.comments.create).toHaveBeenCalledWith({
        data: {
          comment: 'Observação importante',
          type: CommentType.NOTE,
          id_user: 10,
          id_author: 5,
          author_name: 'Dr. Silva',
        },
        include: editsInclude,
      });
      expect(result).toEqual({
        ...mockComment,
        author_level: LEVELS.PROFISSIONAL_SAUDE,
      });
    });

    it('should record the type sent by the client', async () => {
      const report = {
        ...mockComment,
        type: CommentType.CLASS_COUNCIL_REPORT,
      };
      jest.spyOn(prisma.comments, 'create').mockResolvedValue(report as any);

      const result = await service.create(
        {
          id_user: 10,
          comment: 'Relatório do conselho',
          type: CommentType.CLASS_COUNCIL_REPORT,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.comments.create).toHaveBeenCalledWith({
        data: {
          comment: 'Relatório do conselho',
          type: CommentType.CLASS_COUNCIL_REPORT,
          id_user: 10,
          id_author: 5,
          author_name: 'Dr. Silva',
        },
        include: editsInclude,
      });
      expect(result.type).toBe(CommentType.CLASS_COUNCIL_REPORT);
    });

    it('should record a NOTE when the client does not send the type', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);

      await service.create(
        { id_user: 10, comment: 'Observação importante' } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: CommentType.NOTE }),
        }),
      );
    });

    it('should take the author of a report from the session, like a note', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);

      await service.create(
        {
          id_user: 10,
          comment: 'Relatório do conselho',
          type: CommentType.CLASS_COUNCIL_REPORT,
          id_author: 999,
          author_name: 'Autor forjado',
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_author: 5,
            author_name: 'Dr. Silva',
          }),
        }),
      );
    });

    it('should email the student about a report like about a note', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ email: 'estudante@edutrace.com' } as any);

      await service.create(
        {
          id_user: 10,
          comment: 'Relatório do conselho',
          type: CommentType.CLASS_COUNCIL_REPORT,
          notify_by_email: true,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(mailService.sendNewCommentNotice).toHaveBeenCalledWith(
        'estudante@edutrace.com',
      );
    });

    it('should ignore fields that do not belong to the model', async () => {
      const createDto = {
        id_user: 10,
        comment: 'Observação importante',
        notify_by_email: false,
        id_author: 999,
        author_name: 'Autor forjado',
      };
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);

      await service.create(
        createDto as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.comments.create).toHaveBeenCalledWith({
        data: {
          comment: 'Observação importante',
          type: CommentType.NOTE,
          id_user: 10,
          id_author: 5,
          author_name: 'Dr. Silva',
        },
        include: editsInclude,
      });
    });

    it('should not send an email when notify_by_email is absent', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);

      await service.create(
        { id_user: 10, comment: 'Observação importante' } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(mailService.sendNewCommentNotice).not.toHaveBeenCalled();
    });

    it('should not send an email when notify_by_email is false', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);

      await service.create(
        {
          id_user: 10,
          comment: 'Observação importante',
          notify_by_email: false,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(mailService.sendNewCommentNotice).not.toHaveBeenCalled();
    });

    it('should send an email to the student when notify_by_email is true', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ email: 'estudante@edutrace.com' } as any);

      await service.create(
        {
          id_user: 10,
          comment: 'Observação importante',
          notify_by_email: true,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { email: true },
      });
      expect(mailService.sendNewCommentNotice).toHaveBeenCalledWith(
        'estudante@edutrace.com',
      );
    });

    it('should keep the comment created when the email fails', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ email: 'estudante@edutrace.com' } as any);
      jest
        .spyOn(mailService, 'sendNewCommentNotice')
        .mockRejectedValue(new Error('SMTP indisponível'));

      const result = await service.create(
        {
          id_user: 10,
          comment: 'Observação importante',
          notify_by_email: true,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(result).toEqual({
        ...mockComment,
        author_level: LEVELS.PROFISSIONAL_SAUDE,
      });
    });

    it('should log the failure by user id when the email rejects with a non-Error value', async () => {
      const loggerError = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ email: 'estudante@edutrace.com' } as any);
      jest
        .spyOn(mailService, 'sendNewCommentNotice')
        .mockRejectedValue('timeout do SMTP');

      const result = await service.create(
        {
          id_user: 10,
          comment: 'Observação importante',
          notify_by_email: true,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(result).toEqual({
        ...mockComment,
        author_level: LEVELS.PROFISSIONAL_SAUDE,
      });
      expect(loggerError).toHaveBeenCalledWith(
        'Falha ao enviar o aviso de anotação para o usuário 10',
        'timeout do SMTP',
      );
      expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
        'estudante@edutrace.com',
      );
    });

    it('should not send an email when the student does not exist', async () => {
      jest
        .spyOn(prisma.comments, 'create')
        .mockResolvedValue(mockComment as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as any);

      await service.create(
        {
          id_user: 10,
          comment: 'Observação importante',
          notify_by_email: true,
        } as any,
        5,
        'Dr. Silva',
        LEVELS.PROFISSIONAL_SAUDE,
      );

      expect(mailService.sendNewCommentNotice).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const authorRequest = {
      user: {
        sub: 5,
        id_level: LEVELS.PROFISSIONAL_SAUDE,
        name: 'Dr. Silva',
        email: 'dr.silva@edutrace.com',
      },
    } as any;

    it('should keep the replaced text in the edit history and update the comment', async () => {
      const updatedComment = { ...mockComment, comment: 'Texto corrigido' };
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue(mockComment as any);
      transactionClient.comments.update.mockResolvedValue(updatedComment);

      const result = await service.update(
        1,
        { comment: 'Texto corrigido' } as any,
        authorRequest,
      );

      expect(transactionClient.commentEdits.create).toHaveBeenCalledWith({
        data: { id_comment: 1, comment: 'Observação importante' },
      });
      expect(transactionClient.comments.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { comment: 'Texto corrigido' },
        include: editsInclude,
      });
      expect(result).toEqual({
        ...updatedComment,
        author_level: LEVELS.PROFISSIONAL_SAUDE,
      });
    });

    it('should load the comment with its edit history', async () => {
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue(mockComment as any);
      transactionClient.comments.update.mockResolvedValue(mockComment);

      await service.update(
        1,
        { comment: 'Texto corrigido' } as any,
        authorRequest,
      );

      expect(prisma.comments.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: editsInclude,
      });
    });

    it('should not record an edit when the text did not change', async () => {
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue(mockComment as any);

      const result = await service.update(
        1,
        { comment: 'Observação importante' } as any,
        authorRequest,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(transactionClient.commentEdits.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...mockComment,
        author_level: LEVELS.PROFISSIONAL_SAUDE,
      });
    });

    it('should throw ForbiddenException when the requester is not the author', async () => {
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue(mockComment as any);

      const otherProfessional = {
        user: { sub: 7, id_level: LEVELS.PROFISSIONAL_EDUCACAO },
      } as any;

      await expect(
        service.update(
          1,
          { comment: 'Texto de outro' } as any,
          otherProfessional,
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'Você só pode editar as anotações que você mesmo criou',
        ),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    describe('limit of the stored type', () => {
      const tooLong = (limit: number) => ({
        statusCode: 400,
        message: [`O campo comment deve ter no máximo ${limit} caracteres.`],
        error: 'Bad Request',
      });

      it('should accept an annotation edited to exactly 1000 characters', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(mockComment as any);
        transactionClient.comments.update.mockResolvedValue(mockComment);

        await service.update(
          1,
          { comment: 'a'.repeat(1000) } as any,
          authorRequest,
        );

        expect(transactionClient.comments.update).toHaveBeenCalled();
      });

      it('should reject an annotation edited to 1001 characters, with the shape of the ValidationPipe', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(mockComment as any);

        const result = service.update(
          1,
          { comment: 'a'.repeat(1001), notify_by_email: true } as any,
          authorRequest,
        );

        await expect(result).rejects.toThrow(BadRequestException);
        await expect(result).rejects.toMatchObject({
          response: tooLong(1000),
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(transactionClient.commentEdits.create).not.toHaveBeenCalled();
        expect(mailService.sendUpdatedCommentNotice).not.toHaveBeenCalled();
      });

      it('should count in UTF-16 units, so 501 emojis do not fit an annotation', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(mockComment as any);

        await expect(
          service.update(
            1,
            { comment: '😀'.repeat(501) } as any,
            authorRequest,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should apply the limit of the stored type, and not the type sent in the body', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(mockComment as any);

        await expect(
          service.update(
            1,
            {
              comment: 'a'.repeat(1001),
              type: CommentType.CLASS_COUNCIL_REPORT,
            } as any,
            authorRequest,
          ),
        ).rejects.toMatchObject({ response: tooLong(1000) });
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should answer 403 to a user who is not the author before judging the length', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(mockComment as any);

        await expect(
          service.update(
            1,
            { comment: 'a'.repeat(1001) } as any,
            { user: { sub: 7, id_level: LEVELS.PROFISSIONAL_EDUCACAO } } as any,
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('class council report', () => {
      const report = {
        ...mockComment,
        comment: 'Relatório original',
        type: CommentType.CLASS_COUNCIL_REPORT,
      };

      it('should accept a report edited to 10000 characters, far above the limit of an annotation', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(report as any);
        transactionClient.comments.update.mockResolvedValue(report);

        await service.update(
          1,
          { comment: 'a'.repeat(10000) } as any,
          authorRequest,
        );

        expect(transactionClient.comments.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { comment: 'a'.repeat(10000) },
          include: editsInclude,
        });
      });

      it('should reject a report edited to 10001 characters', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(report as any);

        const result = service.update(
          1,
          { comment: 'a'.repeat(10001) } as any,
          authorRequest,
        );

        await expect(result).rejects.toThrow(BadRequestException);
        await expect(result).rejects.toMatchObject({
          response: {
            statusCode: 400,
            message: ['O campo comment deve ter no máximo 10000 caracteres.'],
            error: 'Bad Request',
          },
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should keep the replaced text in the edit history and return the type', async () => {
        const updated = { ...report, comment: 'Relatório corrigido' };
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(report as any);
        transactionClient.comments.update.mockResolvedValue(updated);

        const result = await service.update(
          1,
          { comment: 'Relatório corrigido' } as any,
          authorRequest,
        );

        expect(transactionClient.commentEdits.create).toHaveBeenCalledWith({
          data: { id_comment: 1, comment: 'Relatório original' },
        });
        expect(transactionClient.comments.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { comment: 'Relatório corrigido' } }),
        );
        expect(result.type).toBe(CommentType.CLASS_COUNCIL_REPORT);
      });

      it('should not let the type change on the edit', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(mockComment as any);
        transactionClient.comments.update.mockResolvedValue(mockComment);

        await service.update(
          1,
          {
            comment: 'Texto corrigido',
            type: CommentType.CLASS_COUNCIL_REPORT,
          } as any,
          authorRequest,
        );

        expect(transactionClient.comments.update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { comment: 'Texto corrigido' },
          include: editsInclude,
        });
      });

      it('should let only the author edit the report', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(report as any);

        await expect(
          service.update(
            1,
            { comment: 'Texto de outro' } as any,
            { user: { sub: 7, id_level: LEVELS.PROFISSIONAL_NAPNE } } as any,
          ),
        ).rejects.toThrow(
          new ForbiddenException(
            'Você só pode editar as anotações que você mesmo criou',
          ),
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('should respect the edit limit like an annotation', async () => {
        const edited = {
          ...report,
          edits: Array.from({ length: COMMENT_EDIT_LIMIT }, (_, i) => ({
            id: i + 1,
            id_comment: 1,
            comment: `Versão ${i + 1}`,
            created_at: new Date(),
          })),
        };
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(edited as any);

        await expect(
          service.update(
            1,
            { comment: 'Mais uma edição', notify_by_email: true } as any,
            authorRequest,
          ),
        ).rejects.toThrow(
          new ForbiddenException(
            'Esta anotação atingiu o limite de 10 edições',
          ),
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(mailService.sendUpdatedCommentNotice).not.toHaveBeenCalled();
      });

      it('should send the update notice when notify_by_email is true', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(report as any);
        transactionClient.comments.update.mockResolvedValue(report);
        jest
          .spyOn(prisma.user, 'findUnique')
          .mockResolvedValue({ email: 'estudante@edutrace.com' } as any);

        await service.update(
          1,
          { comment: 'Relatório corrigido', notify_by_email: true } as any,
          authorRequest,
        );

        expect(mailService.sendUpdatedCommentNotice).toHaveBeenCalledWith(
          'estudante@edutrace.com',
        );
      });
    });

    describe('edit limit', () => {
      const withEdits = (total: number) => ({
        ...mockComment,
        edits: Array.from({ length: total }, (_, i) => ({
          id: i + 1,
          id_comment: 1,
          comment: `Versão ${i + 1}`,
          created_at: new Date(),
        })),
      });

      it('should allow the tenth edit', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(withEdits(COMMENT_EDIT_LIMIT - 1) as any);
        transactionClient.comments.update.mockResolvedValue(mockComment);

        await service.update(
          1,
          { comment: 'Décima edição' } as any,
          authorRequest,
        );

        expect(transactionClient.commentEdits.create).toHaveBeenCalled();
        expect(transactionClient.comments.update).toHaveBeenCalled();
      });

      it('should reject a new edit once the limit is reached, without saving or emailing', async () => {
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(withEdits(COMMENT_EDIT_LIMIT) as any);

        await expect(
          service.update(
            1,
            { comment: 'Décima primeira edição', notify_by_email: true } as any,
            authorRequest,
          ),
        ).rejects.toThrow(
          new ForbiddenException(
            'Esta anotação atingiu o limite de 10 edições',
          ),
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(mailService.sendUpdatedCommentNotice).not.toHaveBeenCalled();
      });

      it('should not fail when the text is unchanged at the limit', async () => {
        const comment = withEdits(COMMENT_EDIT_LIMIT);
        jest
          .spyOn(prisma.comments, 'findUnique')
          .mockResolvedValue(comment as any);

        const result = await service.update(
          1,
          { comment: 'Observação importante' } as any,
          authorRequest,
        );

        expect(result).toEqual({
          ...comment,
          author_level: LEVELS.PROFISSIONAL_SAUDE,
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    it('should throw NotFoundException when the comment does not exist', async () => {
      jest.spyOn(prisma.comments, 'findUnique').mockResolvedValue(null as any);

      await expect(
        service.update(
          99,
          { comment: 'Texto corrigido' } as any,
          authorRequest,
        ),
      ).rejects.toThrow(new NotFoundException('Anotação não encontrada'));
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the comment is deleted', async () => {
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue({ ...mockComment, deleted_at: new Date() } as any);

      await expect(
        service.update(1, { comment: 'Texto corrigido' } as any, authorRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not send an email when notify_by_email is absent', async () => {
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue(mockComment as any);
      transactionClient.comments.update.mockResolvedValue(mockComment);

      await service.update(
        1,
        { comment: 'Texto corrigido' } as any,
        authorRequest,
      );

      expect(mailService.sendUpdatedCommentNotice).not.toHaveBeenCalled();
    });

    it('should send the update notice when notify_by_email is true', async () => {
      jest
        .spyOn(prisma.comments, 'findUnique')
        .mockResolvedValue(mockComment as any);
      transactionClient.comments.update.mockResolvedValue(mockComment);
      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue({ email: 'estudante@edutrace.com' } as any);

      await service.update(
        1,
        { comment: 'Texto corrigido', notify_by_email: true } as any,
        authorRequest,
      );

      expect(mailService.sendUpdatedCommentNotice).toHaveBeenCalledWith(
        'estudante@edutrace.com',
      );
      expect(mailService.sendNewCommentNotice).not.toHaveBeenCalled();
    });
  });

  describe('findAllByIdUser', () => {
    const professional = {
      user: { sub: 99, id_level: LEVELS.PROFISSIONAL_SAUDE },
    } as any;
    const ownStudent = {
      user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
    } as any;

    const olderComment = { ...mockComment, id: 3, id_author: 6 };
    const newerComment = { ...mockComment, id: 7, id_author: 5 };

    function mockQueries({
      counts = { overall: 2, total: 2 },
      ids = [] as number[],
      authors = [] as { id: number; name: string }[],
    } = {}) {
      transactionClient.$queryRaw.mockImplementation(((sql: Prisma.Sql) => {
        if (sql.text.includes('count(*)')) {
          return Promise.resolve([counts]);
        }
        if (sql.text.includes('DISTINCT ON')) {
          return Promise.resolve(authors);
        }
        return Promise.resolve(ids.map((id) => ({ id })));
      }) as any);
    }

    function mockRecords(comments: object[]) {
      jest
        .spyOn(prisma.comments, 'findMany')
        .mockResolvedValue(comments as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
        { id: 5, id_level: LEVELS.PROFISSIONAL_SAUDE },
        { id: 6, id_level: LEVELS.PROFISSIONAL_EDUCACAO },
      ] as any);
    }

    const pageIdsCall = () =>
      transactionClient.$queryRaw.mock.calls
        .map(([sql]: [Prisma.Sql]) => sql)
        .find((sql: Prisma.Sql) =>
          sql.text.includes('ORDER BY c."id" DESC'),
        ) as Prisma.Sql;

    it('should answer with the page, the cursor, both counts and the authors', async () => {
      mockQueries({
        counts: { overall: 9, total: 4 },
        ids: [7, 3],
        authors: [
          { id: 5, name: 'Dr. Silva' },
          { id: 6, name: 'Ana' },
        ],
      });
      mockRecords([newerComment, olderComment]);

      const result = await service.findAllByIdUser(10, {}, professional);

      expect(result).toEqual({
        items: [
          { ...newerComment, author_level: LEVELS.PROFISSIONAL_SAUDE },
          { ...olderComment, author_level: LEVELS.PROFISSIONAL_EDUCACAO },
        ],
        next_cursor: null,
        total: 4,
        overall: 9,
        authors: [
          { id: 6, name: 'Ana' },
          { id: 5, name: 'Dr. Silva' },
        ],
      });
    });

    it('should load the records of the page by id, newest first, with their edit history, only from this student', async () => {
      mockQueries({ ids: [7, 3] });
      mockRecords([newerComment, olderComment]);

      await service.findAllByIdUser(10, {}, professional);

      expect(prisma.comments.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.comments.findMany).toHaveBeenCalledWith({
        where: { id: { in: [7, 3] }, id_user: 10 },
        orderBy: { id: 'desc' },
        include: editsInclude,
      });
    });

    it('should return the type of each item', async () => {
      mockQueries({ ids: [7, 3] });
      mockRecords([
        { ...newerComment, type: CommentType.CLASS_COUNCIL_REPORT },
        olderComment,
      ]);

      const result = await service.findAllByIdUser(10, {}, professional);

      expect(result.items.map((c) => c.type)).toEqual([
        CommentType.CLASS_COUNCIL_REPORT,
        CommentType.NOTE,
      ]);
    });

    describe('page size and cursor', () => {
      it('should ask for 21 ids when the limit is absent, because the default is 20', async () => {
        mockQueries();

        await service.findAllByIdUser(10, {}, professional);

        expect(pageIdsCall().values).toEqual([10, 21]);
      });

      it('should ask for one id more than the limit sent', async () => {
        mockQueries();

        await service.findAllByIdUser(10, { limit: 5 }, professional);

        expect(pageIdsCall().values).toEqual([10, 6]);
      });

      it('should answer next_cursor with the id of the last item when there is one more record', async () => {
        mockQueries({ counts: { overall: 3, total: 3 }, ids: [9, 7, 3] });
        mockRecords([{ ...newerComment, id: 9 }, newerComment]);

        const result = await service.findAllByIdUser(
          10,
          { limit: 2 },
          professional,
        );

        expect(result.next_cursor).toBe(7);
        expect(prisma.comments.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: { in: [9, 7] }, id_user: 10 },
          }),
        );
        expect(result.items.map((c) => c.id)).toEqual([9, 7]);
      });

      it('should answer next_cursor null when the page has exactly the limit and nothing after it', async () => {
        mockQueries({ counts: { overall: 2, total: 2 }, ids: [7, 3] });
        mockRecords([newerComment, olderComment]);

        const result = await service.findAllByIdUser(
          10,
          { limit: 2 },
          professional,
        );

        expect(result.next_cursor).toBeNull();
        expect(result.items).toHaveLength(2);
      });

      it('should pass the cursor to the page query', async () => {
        mockQueries();

        await service.findAllByIdUser(10, { cursor: 7 }, professional);

        expect(pageIdsCall().values).toEqual([10, 7, 21]);
      });
    });

    describe('empty result', () => {
      it('should not load records nor author levels, and keep the counts and the authors', async () => {
        mockQueries({
          counts: { overall: 5, total: 0 },
          authors: [{ id: 5, name: 'Dr. Silva' }],
        });

        const result = await service.findAllByIdUser(
          10,
          { q: 'nada' },
          professional,
        );

        expect(result).toEqual({
          items: [],
          next_cursor: null,
          total: 0,
          overall: 5,
          authors: [{ id: 5, name: 'Dr. Silva' }],
        });
        expect(prisma.comments.findMany).not.toHaveBeenCalled();
        expect(prisma.user.findMany).not.toHaveBeenCalled();
      });
    });

    describe('author level', () => {
      it('should look up each author level once, selecting only id and id_level', async () => {
        mockQueries({ ids: [3, 2, 1] });
        mockRecords([
          { ...mockComment, id: 3, id_author: 5 },
          { ...mockComment, id: 2, id_author: 6 },
          { ...mockComment, id: 1, id_author: 5 },
        ]);

        const result = await service.findAllByIdUser(10, {}, ownStudent);

        expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
        expect(prisma.user.findMany).toHaveBeenCalledWith({
          where: { id: { in: [5, 6] } },
          select: { id: true, id_level: true },
        });
        expect(result.items.map((c) => [c.id, c.author_level])).toEqual([
          [3, LEVELS.PROFISSIONAL_SAUDE],
          [2, LEVELS.PROFISSIONAL_EDUCACAO],
          [1, LEVELS.PROFISSIONAL_SAUDE],
        ]);
      });

      it('should return author_level null when the author no longer exists', async () => {
        mockQueries({ ids: [1] });
        jest
          .spyOn(prisma.comments, 'findMany')
          .mockResolvedValue([mockComment] as any);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);

        const result = await service.findAllByIdUser(10, {}, professional);

        expect(result.items).toEqual([{ ...mockComment, author_level: null }]);
      });
    });

    describe('authors', () => {
      it('should sort the authors alphabetically in Brazilian Portuguese, accents included', async () => {
        mockQueries({
          authors: [
            { id: 1, name: 'Zélia' },
            { id: 2, name: 'Ana' },
            { id: 3, name: 'Ágata' },
            { id: 4, name: 'Éder' },
            { id: 5, name: 'Eva' },
          ],
        });

        const result = await service.findAllByIdUser(10, {}, professional);

        expect(result.authors.map((a) => a.name)).toEqual([
          'Ágata',
          'Ana',
          'Éder',
          'Eva',
          'Zélia',
        ]);
      });

      it('should break a tie of names by id, so the order is stable', async () => {
        mockQueries({
          authors: [
            { id: 9, name: 'Maria' },
            { id: 4, name: 'Maria' },
          ],
        });

        const result = await service.findAllByIdUser(10, {}, professional);

        expect(result.authors.map((a) => a.id)).toEqual([4, 9]);
      });

      it('should list the authors of the whole record, with no filter', async () => {
        mockQueries();

        await service.findAllByIdUser(
          10,
          { q: 'x', author: 5, edited: true },
          professional,
        );

        const authorsCall = transactionClient.$queryRaw.mock.calls
          .map(([sql]: [Prisma.Sql]) => sql)
          .find((sql: Prisma.Sql) =>
            sql.text.includes('DISTINCT ON'),
          ) as Prisma.Sql;
        expect(authorsCall.values).toEqual([10]);
      });
    });

    describe('access', () => {
      it('should return the page of the student to himself', async () => {
        mockQueries({ ids: [1] });
        jest
          .spyOn(prisma.comments, 'findMany')
          .mockResolvedValue([mockComment] as any);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);

        const result = await service.findAllByIdUser(10, {}, ownStudent);

        expect(result.items).toHaveLength(1);
      });

      it('should return the page of another student to the NAPNE professional', async () => {
        mockQueries({ ids: [1] });
        jest
          .spyOn(prisma.comments, 'findMany')
          .mockResolvedValue([mockComment] as any);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);

        const result = await service.findAllByIdUser(10, {}, {
          user: { sub: 99, id_level: LEVELS.PROFISSIONAL_NAPNE },
        } as any);

        expect(result.items).toHaveLength(1);
      });

      it.each([
        ['a student asking for another student', LEVELS.ALUNO_ESTUDANTE],
        ['a level outside the readers', 7],
      ])(
        'should answer 403 before any query to %s, even with filters',
        async (_, level) => {
          const request = { user: { sub: 10, id_level: level } } as any;

          await expect(
            service.findAllByIdUser(
              99,
              { q: 'acao', author: 5, limit: 10 },
              request,
            ),
          ).rejects.toThrow(
            new ForbiddenException(
              'Você não tem permissão para visualizar estas anotações',
            ),
          );
          expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
          expect(prisma.$transaction).not.toHaveBeenCalled();
          expect(transactionClient.$queryRaw).not.toHaveBeenCalled();
          expect(prisma.comments.findMany).not.toHaveBeenCalled();
        },
      );
    });

    describe('SQL', () => {
      it('should only use the tagged $queryRaw, never the unsafe variants', async () => {
        mockQueries({ ids: [1] });
        jest
          .spyOn(prisma.comments, 'findMany')
          .mockResolvedValue([mockComment] as any);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);

        await service.findAllByIdUser(
          10,
          { q: `x'); DROP TABLE "Comments"; --` },
          professional,
        );

        expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(3);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
        expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
        for (const [sql] of transactionClient.$queryRaw.mock.calls) {
          expect(sql).toEqual(
            expect.objectContaining({
              strings: expect.any(Array),
              values: expect.any(Array),
            }),
          );
          expect(sql.text).not.toContain('DROP');
        }
      });
    });

    describe('transaction and statement timeout', () => {
      const SEARCH_TIMEOUT_MESSAGE =
        'A busca demorou demais. Refine os filtros e tente de novo.';
      const BUSY_MESSAGE =
        'O sistema está ocupado. Tente de novo em instantes.';

      const statementTimeout = () =>
        new Prisma.PrismaClientKnownRequestError(
          'Raw query failed. Code: `57014`. Message: `canceling statement due to statement timeout`',
          {
            code: 'P2010',
            clientVersion: '7.10.0',
            meta: {
              driverAdapterError: {
                name: 'DriverAdapterError',
                cause: {
                  originalCode: '57014',
                  originalMessage:
                    'canceling statement due to statement timeout',
                  kind: 'postgres',
                  code: '57014',
                  severity: 'ERROR',
                  message: 'canceling statement due to statement timeout',
                },
              },
            },
          },
        );

      function mockRecordsOfThePage() {
        jest
          .spyOn(prisma.comments, 'findMany')
          .mockResolvedValue([mockComment] as any);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);
      }

      it('should run the three queries in one transaction, with the transaction timeout of the list', async () => {
        mockQueries({ ids: [1] });
        mockRecordsOfThePage();

        await service.findAllByIdUser(10, {}, professional);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
          maxWait: COMMENT_LIST_TRANSACTION_MAX_WAIT_MS,
          timeout: COMMENT_LIST_TRANSACTION_TIMEOUT_MS,
        });
        expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(3);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('should send the SET LOCAL of the statement timeout inside the transaction, before the first query', async () => {
        mockQueries({ ids: [1] });
        mockRecordsOfThePage();

        await service.findAllByIdUser(10, {}, professional);

        expect(transactionClient.$executeRaw).toHaveBeenCalledTimes(1);
        expect(transactionClient.$executeRaw.mock.calls[0][0].text).toBe(
          'SET LOCAL statement_timeout = 3000',
        );
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
        const [setLocalOrder] =
          transactionClient.$executeRaw.mock.invocationCallOrder;
        for (const queryOrder of transactionClient.$queryRaw.mock
          .invocationCallOrder) {
          expect(setLocalOrder).toBeLessThan(queryOrder);
        }
      });

      it('should run counts, page and authors one after the other, never at the same time', async () => {
        const releases: (() => void)[] = [];
        transactionClient.$queryRaw.mockImplementation(
          (sql: Prisma.Sql) =>
            new Promise((resolve) => {
              const rows = sql.text.includes('count(*)')
                ? [{ overall: 1, total: 1 }]
                : [];
              releases.push(() => resolve(rows));
            }),
        );
        mockRecordsOfThePage();
        const settle = () => new Promise((resolve) => setImmediate(resolve));

        const pending = service.findAllByIdUser(10, {}, professional);
        await settle();
        expect(releases).toHaveLength(1);
        expect(transactionClient.$queryRaw.mock.calls[0][0].text).toContain(
          'count(*)',
        );

        releases[0]();
        await settle();
        expect(releases).toHaveLength(2);
        expect(transactionClient.$queryRaw.mock.calls[1][0].text).toContain(
          'ORDER BY c."id" DESC',
        );

        releases[1]();
        await settle();
        expect(releases).toHaveLength(3);
        expect(transactionClient.$queryRaw.mock.calls[2][0].text).toContain(
          'DISTINCT ON',
        );

        releases[2]();
        await expect(pending).resolves.toMatchObject({ total: 1 });
      });

      it.each([
        ['the count', 0],
        ['the page', 1],
        ['the authors', 2],
      ])(
        'should answer 503 with the message of the search when %s exceeds the statement timeout, and not run what comes next',
        async (_, failingCall) => {
          mockQueries({ ids: [1] });
          mockRecordsOfThePage();
          const implementation =
            transactionClient.$queryRaw.getMockImplementation();
          let call = 0;
          transactionClient.$queryRaw.mockImplementation((sql: Prisma.Sql) => {
            if (call++ === failingCall) {
              return Promise.reject(statementTimeout());
            }
            return implementation?.(sql);
          });

          const result = service.findAllByIdUser(10, {}, professional);

          await expect(result).rejects.toThrow(ServiceUnavailableException);
          await expect(result).rejects.toMatchObject({
            message: SEARCH_TIMEOUT_MESSAGE,
          });
          expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(
            failingCall + 1,
          );
          expect(prisma.comments.findMany).not.toHaveBeenCalled();
        },
      );

      it('should not tell the database detail in the 503', async () => {
        mockQueries();
        transactionClient.$queryRaw.mockRejectedValueOnce(statementTimeout());

        const error = await service
          .findAllByIdUser(10, {}, professional)
          .catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(ServiceUnavailableException);
        const body = JSON.stringify(
          (error as ServiceUnavailableException).getResponse(),
        );
        expect(body).toContain(SEARCH_TIMEOUT_MESSAGE);
        for (const detail of ['57014', 'statement', 'P2010', 'Raw query']) {
          expect(body).not.toContain(detail);
        }
      });

      it('should answer 503 when the timeout comes out of the SET LOCAL transaction itself', async () => {
        jest
          .spyOn(prisma, '$transaction')
          .mockRejectedValueOnce(statementTimeout());

        await expect(
          service.findAllByIdUser(10, {}, professional),
        ).rejects.toThrow(ServiceUnavailableException);
      });

      const transactionStartTimeout = () =>
        new Prisma.PrismaClientKnownRequestError(
          '\nInvalid `prisma.$transaction()` invocation:\n\nTransaction API error: Unable to start a transaction in the given time.',
          { code: 'P2028', clientVersion: '7.10.0', meta: {} },
        );

      it('should answer 503 with the message of the busy system when the pool gives no connection to open the transaction in time', async () => {
        jest
          .spyOn(prisma, '$transaction')
          .mockRejectedValueOnce(transactionStartTimeout());

        const result = service.findAllByIdUser(10, {}, professional);

        await expect(result).rejects.toThrow(ServiceUnavailableException);
        await expect(result).rejects.toMatchObject({
          message: BUSY_MESSAGE,
        });
        expect(transactionClient.$queryRaw).not.toHaveBeenCalled();
        expect(prisma.comments.findMany).not.toHaveBeenCalled();
      });

      it('should not tell the Prisma detail in the busy 503', async () => {
        jest
          .spyOn(prisma, '$transaction')
          .mockRejectedValueOnce(transactionStartTimeout());

        const error = await service
          .findAllByIdUser(10, {}, professional)
          .catch((thrown: unknown) => thrown);

        const body = JSON.stringify(
          (error as ServiceUnavailableException).getResponse(),
        );
        expect(body).toContain(BUSY_MESSAGE);
        for (const detail of [
          'P2028',
          'Prisma',
          'transaction',
          'Transaction',
        ]) {
          expect(body).not.toContain(detail);
        }
      });

      it('should keep the message of the search for the statement timeout, not the busy one', async () => {
        jest
          .spyOn(prisma, '$transaction')
          .mockRejectedValueOnce(statementTimeout());

        await expect(
          service.findAllByIdUser(10, {}, professional),
        ).rejects.toMatchObject({ message: SEARCH_TIMEOUT_MESSAGE });
      });

      it.each([
        [
          'the expired transaction',
          'Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 10000 ms, however 10019 ms passed since the start of the transaction.',
          { operation: 'query', timeout: 10000, timeTaken: 10019 },
        ],
        [
          'the closed transaction',
          'Transaction API error: Transaction already closed: A query cannot be executed on a committed transaction.',
          { operation: 'query' },
        ],
      ])(
        'should let the other P2028, %s, go up as it was',
        async (_, message, meta) => {
          const error = new Prisma.PrismaClientKnownRequestError(message, {
            code: 'P2028',
            clientVersion: '7.10.0',
            meta,
          });
          mockQueries();
          transactionClient.$queryRaw.mockRejectedValueOnce(error);

          await expect(
            service.findAllByIdUser(10, {}, professional),
          ).rejects.toBe(error);
        },
      );

      const notATimeout = (
        code: string,
        meta?: Record<string, unknown>,
      ): Prisma.PrismaClientKnownRequestError =>
        new Prisma.PrismaClientKnownRequestError('falha', {
          code,
          clientVersion: '7.10.0',
          meta,
        });

      it.each([
        [
          'another raw query error',
          notATimeout('P2010', {
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: { originalCode: '22021', code: '22021', kind: 'postgres' },
            },
          }),
        ],
        ['a raw query error with no meta', notATimeout('P2010')],
        [
          'the 57014 under another Prisma code',
          notATimeout('P2028', {
            driverAdapterError: {
              name: 'DriverAdapterError',
              cause: { originalCode: '57014', code: '57014' },
            },
          }),
        ],
        ['the close of the transaction by Prisma', notATimeout('P2028')],
        ['an error that is not from Prisma', new Error('conexão perdida')],
        [
          'a lookalike that is not a Prisma error',
          Object.assign(new Error('x'), {
            code: 'P2010',
            meta: { driverAdapterError: { cause: { code: '57014' } } },
          }),
        ],
      ])('should let %s go up as it was', async (_, error) => {
        mockQueries();
        transactionClient.$queryRaw.mockRejectedValueOnce(error);

        await expect(
          service.findAllByIdUser(10, {}, professional),
        ).rejects.toBe(error);
      });
    });
  });

  describe('titular estudante', () => {
    it('should not create a note nor email someone who is not a student', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));

      await expect(
        service.create(
          { comment: 'Texto', id_user: 9, notify_by_email: true },
          3,
          'Saúde',
          LEVELS.PROFISSIONAL_SAUDE,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({ id: 9 });
      expect(prisma.comments.create).not.toHaveBeenCalled();
      expect(mailService.sendNewCommentNotice).not.toHaveBeenCalled();
    });

    it('should answer 404 when reading the notes of someone who is not a student', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));

      await expect(
        service.findAllByIdUser(9, {}, {
          user: {
            sub: 3,
            id_level: LEVELS.PROFISSIONAL_SAUDE,
            email: 'saude@example.com',
            name: 'Saúde',
          },
        } as never),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(transactionClient.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.comments.findMany).not.toHaveBeenCalled();
    });
  });
});
