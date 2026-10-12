import { StudentsService } from 'src/students/students.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { CommentsService } from 'src/comments/comments.service';
import { COMMENT_EDIT_LIMIT, LEVELS } from 'src/constants';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: PrismaService;
  let studentsService: StudentsService;
  let mailService: MailService;
  let transactionClient: {
    commentEdits: { create: jest.Mock };
    comments: { update: jest.Mock };
  };

  const editsInclude = { edits: { orderBy: { created_at: 'asc' } } };

  const mockComment = {
    id: 1,
    id_user: 10,
    id_author: 5,
    author_name: 'Dr. Silva',
    comment: 'Observação importante',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    edits: [],
  };

  beforeEach(async () => {
    transactionClient = {
      commentEdits: { create: jest.fn() },
      comments: { update: jest.fn() },
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
    it('should return comments with their edit history when requester is not a student', async () => {
      const comments = [mockComment];
      const request = {
        user: { sub: 99, id_level: LEVELS.PROFISSIONAL_SAUDE },
      } as any;

      jest
        .spyOn(prisma.comments, 'findMany')
        .mockResolvedValue(comments as any);
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue([
          { id: 5, id_level: LEVELS.PROFISSIONAL_SAUDE },
        ] as any);

      const result = await service.findAllByIdUser(10, request);

      expect(prisma.comments.findMany).toHaveBeenCalledWith({
        where: { id_user: 10 },
        include: editsInclude,
      });
      expect(result).toEqual([
        { ...mockComment, author_level: LEVELS.PROFISSIONAL_SAUDE },
      ]);
    });

    it('should return comments when student is viewing their own profile', async () => {
      const comments = [mockComment];
      const request = {
        user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
      } as any;

      jest
        .spyOn(prisma.comments, 'findMany')
        .mockResolvedValue(comments as any);
      jest
        .spyOn(prisma.user, 'findMany')
        .mockResolvedValue([
          { id: 5, id_level: LEVELS.PROFISSIONAL_SAUDE },
        ] as any);

      const result = await service.findAllByIdUser(10, request);

      expect(result).toEqual([
        { ...mockComment, author_level: LEVELS.PROFISSIONAL_SAUDE },
      ]);
    });

    it('should look up each author level once, selecting only id and id_level', async () => {
      const request = {
        user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
      } as any;
      const comments = [
        { ...mockComment, id: 1, id_author: 5 },
        { ...mockComment, id: 2, id_author: 6 },
        { ...mockComment, id: 3, id_author: 5 },
      ];
      jest
        .spyOn(prisma.comments, 'findMany')
        .mockResolvedValue(comments as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
        { id: 5, id_level: LEVELS.PROFISSIONAL_SAUDE },
        { id: 6, id_level: LEVELS.PROFISSIONAL_EDUCACAO },
      ] as any);

      const result = await service.findAllByIdUser(10, request);

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: [5, 6] } },
        select: { id: true, id_level: true },
      });
      expect(result.map((c) => [c.id, c.author_level])).toEqual([
        [1, LEVELS.PROFISSIONAL_SAUDE],
        [2, LEVELS.PROFISSIONAL_EDUCACAO],
        [3, LEVELS.PROFISSIONAL_SAUDE],
      ]);
    });

    it('should return author_level null when the author no longer exists', async () => {
      const request = {
        user: { sub: 99, id_level: LEVELS.ADMIN },
      } as any;
      jest
        .spyOn(prisma.comments, 'findMany')
        .mockResolvedValue([mockComment] as any);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as any);

      const result = await service.findAllByIdUser(10, request);

      expect(result).toEqual([{ ...mockComment, author_level: null }]);
    });

    it('should not look up authors when the student has no comments', async () => {
      const request = {
        user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
      } as any;
      jest.spyOn(prisma.comments, 'findMany').mockResolvedValue([] as any);

      const result = await service.findAllByIdUser(10, request);

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when student tries to view another user comments', async () => {
      const request = {
        user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
      } as any;

      await expect(service.findAllByIdUser(99, request)).rejects.toThrow(
        new ForbiddenException(
          'Você não tem permissão para visualizar estas anotações',
        ),
      );
      expect(prisma.comments.findMany).not.toHaveBeenCalled();
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
        service.findAllByIdUser(9, {
          user: {
            sub: 3,
            id_level: LEVELS.PROFISSIONAL_SAUDE,
            email: 'saude@example.com',
            name: 'Saúde',
          },
        } as never),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.comments.findMany).not.toHaveBeenCalled();
    });
  });
});
