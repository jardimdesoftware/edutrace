import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from 'src/comments/comments.controller';
import { CommentsService } from 'src/comments/comments.service';
import { ForbiddenException } from '@nestjs/common';

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
        user: { sub: 5, name: 'Dr. Silva', id_level: 3 },
      } as any;

      jest.spyOn(service, 'create').mockResolvedValue(mockComment as any);

      const result = await controller.create(createDto as any, request);

      expect(service.create).toHaveBeenCalledWith(createDto, 5, 'Dr. Silva');
      expect(result).toEqual(mockComment);
    });

    it('should propagate errors thrown by the service', async () => {
      const createDto = { id_user: 10, comment: 'Observação importante' };
      const request = {
        user: { sub: 5, name: 'Dr. Silva', id_level: 3 },
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
        user: { sub: 5, name: 'Dr. Silva', id_level: 3 },
      } as any;

      jest.spyOn(service, 'update').mockResolvedValue(mockComment as any);

      const result = await controller.update(1, updateDto as any, request);

      expect(service.update).toHaveBeenCalledWith(1, updateDto, request);
      expect(result).toEqual(mockComment);
    });

    it('should propagate ForbiddenException thrown by the service', async () => {
      const request = {
        user: { sub: 7, name: 'Dr. Souza', id_level: 4 },
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
    it('should return comments for a given user id', async () => {
      const comments = [mockComment];
      const request = { user: { sub: 10, id_level: 2 } } as any;

      jest.spyOn(service, 'findAllByIdUser').mockResolvedValue(comments as any);

      const result = await controller.findAllByIdUser('10', request);

      expect(service.findAllByIdUser).toHaveBeenCalledWith(10, request);
      expect(result).toEqual(comments);
    });

    it('should convert id_user param from string to number', async () => {
      const comments = [mockComment];
      const request = { user: { sub: 42, id_level: 2 } } as any;

      jest.spyOn(service, 'findAllByIdUser').mockResolvedValue(comments as any);

      await controller.findAllByIdUser('42', request);

      expect(service.findAllByIdUser).toHaveBeenCalledWith(42, request);
    });

    it('should propagate ForbiddenException thrown by the service', async () => {
      const request = { user: { sub: 99, id_level: 1 } } as any;

      jest
        .spyOn(service, 'findAllByIdUser')
        .mockRejectedValue(
          new ForbiddenException(
            'Você não tem permissão para visualizar estas anotações',
          ),
        );

      await expect(controller.findAllByIdUser('10', request)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
