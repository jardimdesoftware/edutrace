import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from 'src/comments/comments.controller';
import { CommentsService } from 'src/comments/comments.service';
import { ListCommentsQueryDto } from 'src/comments/dto/list-comments-query.dto';
import { ForbiddenException } from '@nestjs/common';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: CommentsService;

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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            findAllByIdUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a comment using author from request', async () => {
      const createDto = { id_user: 10, comment: 'Observação importante' };
      const request = {
        user: { sub: 5, name: 'Dr. Silva', roles: [3] },
      } as any;

      jest.spyOn(service, 'create').mockResolvedValue(mockComment as any);

      const result = await controller.create(createDto as any, request);

      expect(service.create).toHaveBeenCalledWith(
        createDto,
        5,
        'Dr. Silva',
        [3],
      );
      expect(result).toEqual(mockComment);
    });

    it('should propagate errors thrown by the service', async () => {
      const createDto = { id_user: 10, comment: 'Observação importante' };
      const request = {
        user: { sub: 5, name: 'Dr. Silva', roles: [3] },
      } as any;

      jest.spyOn(service, 'create').mockRejectedValue(new Error('DB error'));

      await expect(controller.create(createDto as any, request)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('update', () => {
    it('should delegate the update to the service with the parsed id', async () => {
      const updateDto = { comment: 'Texto corrigido' };
      const request = {
        user: { sub: 5, name: 'Dr. Silva', roles: [3] },
      } as any;

      jest.spyOn(service, 'update').mockResolvedValue(mockComment as any);

      const result = await controller.update(1, updateDto as any, request);

      expect(service.update).toHaveBeenCalledWith(1, updateDto, request);
      expect(result).toEqual(mockComment);
    });

    it('should propagate ForbiddenException thrown by the service', async () => {
      const request = {
        user: { sub: 7, name: 'Dr. Souza', roles: [4] },
      } as any;

      jest
        .spyOn(service, 'update')
        .mockRejectedValue(
          new ForbiddenException(
            'Você só pode editar as anotações que você mesmo criou',
          ),
        );

      await expect(
        controller.update(1, { comment: 'Texto de outro' } as any, request),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByIdUser', () => {
    const page = {
      items: [mockComment],
      next_cursor: null,
      total: 1,
      overall: 1,
      authors: [{ id: 5, name: 'Dr. Silva' }],
    };

    it('should return the page of a given user id', async () => {
      const request = { user: { sub: 10, roles: [2] } } as any;

      jest.spyOn(service, 'findAllByIdUser').mockResolvedValue(page as any);

      const result = await controller.findAllByIdUser('10', {}, request);

      expect(service.findAllByIdUser).toHaveBeenCalledWith(10, {}, request);
      expect(result).toEqual(page);
    });

    it('should convert id_user param from string to number', async () => {
      const request = { user: { sub: 42, roles: [2] } } as any;

      jest.spyOn(service, 'findAllByIdUser').mockResolvedValue(page as any);

      await controller.findAllByIdUser('42', {}, request);

      expect(service.findAllByIdUser).toHaveBeenCalledWith(42, {}, request);
    });

    it('should pass the validated query to the service', async () => {
      const request = { user: { sub: 3, roles: [4] } } as any;
      const query = Object.assign(new ListCommentsQueryDto(), {
        q: 'acao',
        author: 5,
        limit: 10,
      });

      jest.spyOn(service, 'findAllByIdUser').mockResolvedValue(page as any);

      await controller.findAllByIdUser('10', query, request);

      expect(service.findAllByIdUser).toHaveBeenCalledWith(10, query, request);
    });

    it('should receive the query as the DTO, so the global pipe validates it', () => {
      const paramTypes = Reflect.getMetadata(
        'design:paramtypes',
        CommentsController.prototype,
        'findAllByIdUser',
      );

      expect(paramTypes[1]).toBe(ListCommentsQueryDto);
    });

    it('should propagate ForbiddenException thrown by the service', async () => {
      const request = { user: { sub: 99, roles: [1] } } as any;

      jest
        .spyOn(service, 'findAllByIdUser')
        .mockRejectedValue(
          new ForbiddenException(
            'Você não tem permissão para visualizar estas anotações',
          ),
        );

      await expect(
        controller.findAllByIdUser('10', {}, request),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('access levels', () => {
    it.each(['create', 'update'] as const)(
      'should allow %s to every level except students',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).toEqual([
          LEVELS.ADMIN,
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
          LEVELS.PROFISSIONAL_NAPNE,
          LEVELS.PROFESSOR_AEE,
        ]);
      },
    );

    it('should open findAllByIdUser to every level, relying on the ownership check', () => {
      const levels = Reflect.getMetadata(
        ALLOW_LEVELS_KEY,
        controller.findAllByIdUser,
      );

      expect(levels).toEqual([
        LEVELS.ADMIN,
        LEVELS.ALUNO_ESTUDANTE,
        LEVELS.PROFISSIONAL_EDUCACAO,
        LEVELS.PROFISSIONAL_SAUDE,
        LEVELS.PROFISSIONAL_NAPNE,
        LEVELS.PROFESSOR_AEE,
      ]);
    });
  });
});
