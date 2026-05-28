import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CommentsService } from 'src/comments/comments.service';
import { LEVELS } from 'src/constants';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: PrismaService;

  const mockComment = {
    id: 1,
    id_user: 10,
    id_author: 5,
    author_name: 'Dr. Silva',
    content: 'Observação importante',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: PrismaService,
          useValue: {
            comments: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a comment with author id and name', async () => {
      const createDto = { id_user: 10, content: 'Observação importante' };
      jest.spyOn(prisma.comments, 'create').mockResolvedValue(mockComment as any);

      const result = await service.create(createDto as any, 5, 'Dr. Silva');

      expect(prisma.comments.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          id_author: 5,
          author_name: 'Dr. Silva',
        },
      });
      expect(result).toEqual(mockComment);
    });
  });

  describe('findAllByIdUser', () => {
    it('should return comments when requester is not a student', async () => {
      const comments = [mockComment];
      const request = {
        user: { sub: 99, id_level: LEVELS.PROFISSIONAL_SAUDE },
      } as any;

      jest.spyOn(prisma.comments, 'findMany').mockResolvedValue(comments as any);

      const result = await service.findAllByIdUser(10, request);

      expect(prisma.comments.findMany).toHaveBeenCalledWith({ where: { id_user: 10 } });
      expect(result).toEqual(comments);
    });

    it('should return comments when student is viewing their own profile', async () => {
      const comments = [mockComment];
      const request = {
        user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
      } as any;

      jest.spyOn(prisma.comments, 'findMany').mockResolvedValue(comments as any);

      const result = await service.findAllByIdUser(10, request);

      expect(result).toEqual(comments);
    });

    it('should throw ForbiddenException when student tries to view another user comments', async () => {
      const request = {
        user: { sub: 10, id_level: LEVELS.ALUNO_ESTUDANTE },
      } as any;

      await expect(service.findAllByIdUser(99, request)).rejects.toThrow(
        new ForbiddenException('Você não tem permissão para visualizar estes comentários'),
      );
      expect(prisma.comments.findMany).not.toHaveBeenCalled();
    });
  });
});
