import { RequestMethod } from '@nestjs/common';
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { ParsePositiveIdPipe } from 'src/common/parse-positive-id.pipe';
import { LEVELS } from 'src/constants';
import { CreatePeiEntryDto } from 'src/pei-entries/dto/create-pei-entry.dto';
import { UpdatePeiEntryDto } from 'src/pei-entries/dto/update-pei-entry.dto';
import { PeiEntriesController } from 'src/pei-entries/pei-entries.controller';
import { PeiEntriesService } from 'src/pei-entries/pei-entries.service';
import { STUDENT_EMAIL, validBody, validContent } from './pei-entry.fixtures';

const request = {
  user: {
    sub: 7,
    roles: [LEVELS.PROFISSIONAL_EDUCACAO],
    email: 'professora@example.com',
    name: 'Professora',
  },
} as AuthenticatedRequest;

const entry = { id: 31, ...validContent(), author: null };

describe('PeiEntriesController', () => {
  let controller: PeiEntriesController;
  let service: {
    create: jest.Mock;
    findByStudent: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(entry),
      findByStudent: jest.fn().mockResolvedValue([entry]),
      update: jest.fn().mockResolvedValue(entry),
      remove: jest.fn().mockResolvedValue({ message: 'removido' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeiEntriesController],
      providers: [{ provide: PeiEntriesService, useValue: service }],
    }).compile();

    controller = module.get(PeiEntriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create the entry with the id of the session as the author', async () => {
      const dto = validBody() as unknown as CreatePeiEntryDto;

      const result = await controller.create(dto, request);

      expect(service.create).toHaveBeenCalledWith(dto, 7);
      expect(result).toBe(entry);
    });

    it('should propagate the errors of the service', async () => {
      service.create.mockRejectedValue(new Error('falha'));

      await expect(
        controller.create(validBody() as unknown as CreatePeiEntryDto, request),
      ).rejects.toThrow('falha');
    });
  });

  describe('findByStudent', () => {
    it('should list the entries with the e-mail and the request of the session', async () => {
      const result = await controller.findByStudent(STUDENT_EMAIL, request);

      expect(service.findByStudent).toHaveBeenCalledWith(
        STUDENT_EMAIL,
        request,
      );
      expect(result).toEqual([entry]);
    });
  });

  describe('update', () => {
    it('should update the entry of the id with the id of the session as the author', async () => {
      const dto = { general_notes: 'Novas observações' } as UpdatePeiEntryDto;

      const result = await controller.update(31, dto, request);

      expect(service.update).toHaveBeenCalledWith(31, dto, 7);
      expect(result).toBe(entry);
    });
  });

  describe('remove', () => {
    it('should remove the entry of the id with the id of the session as the author', async () => {
      const result = await controller.remove(31, request);

      expect(service.remove).toHaveBeenCalledWith(31, 7);
      expect(result).toEqual({ message: 'removido' });
    });
  });

  // Metadados exatos de cada rota: o AuthGuard nega o que não está na lista, e
  // estes testes fixam a lista, o método HTTP e o caminho.
  describe('rotas e níveis de acesso', () => {
    const route = (handler: object) => ({
      method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
      path: Reflect.getMetadata(PATH_METADATA, handler) as string,
      levels: Reflect.getMetadata(ALLOW_LEVELS_KEY, handler) as number[],
    });

    it('should serve everything under /pei-entries', () => {
      expect(Reflect.getMetadata(PATH_METADATA, PeiEntriesController)).toBe(
        'pei-entries',
      );
    });

    it('should open POST /pei-entries only to the Education professional', () => {
      expect(route(controller.create)).toEqual({
        method: RequestMethod.POST,
        path: '/',
        levels: [LEVELS.PROFISSIONAL_EDUCACAO],
      });
    });

    it('should open GET /pei-entries/:email to every level, the service restricts the student to his own', () => {
      expect(route(controller.findByStudent)).toEqual({
        method: RequestMethod.GET,
        path: ':email',
        levels: [
          LEVELS.ADMIN,
          LEVELS.ALUNO_ESTUDANTE,
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
          LEVELS.PROFISSIONAL_NAPNE,
          LEVELS.PROFESSOR_AEE,
        ],
      });
    });

    it('should open PATCH /pei-entries/:id only to the Education professional, the service restricts it to the author', () => {
      expect(route(controller.update)).toEqual({
        method: RequestMethod.PATCH,
        path: ':id',
        levels: [LEVELS.PROFISSIONAL_EDUCACAO],
      });
    });

    it('should open DELETE /pei-entries/:id only to the Education professional, the service restricts it to the author', () => {
      expect(route(controller.remove)).toEqual({
        method: RequestMethod.DELETE,
        path: ':id',
        levels: [LEVELS.PROFISSIONAL_EDUCACAO],
      });
    });

    it.each(['update', 'remove'] as const)(
      'should parse the id of %s with the ParsePositiveIdPipe',
      (name) => {
        const args = Reflect.getMetadata(
          ROUTE_ARGS_METADATA,
          PeiEntriesController,
          name,
        ) as Record<string, { data: string; pipes: unknown[] }>;
        const idArg = Object.values(args).find(({ data }) => data === 'id');

        expect(idArg?.pipes).toEqual([ParsePositiveIdPipe]);
      },
    );

    it('should expose no route besides the four of the contract', () => {
      const handlers = Object.getOwnPropertyNames(
        PeiEntriesController.prototype,
      ).filter((name) => name !== 'constructor');

      expect(handlers.sort()).toEqual([
        'create',
        'findByStudent',
        'remove',
        'update',
      ]);
    });
  });
});
