import { RequestMethod } from '@nestjs/common';
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';
import { AeePlansController } from 'src/aee-plans/aee-plans.controller';
import { AeePlansService } from 'src/aee-plans/aee-plans.service';
import { CreateAeePlanDto } from 'src/aee-plans/dto/create-aee-plan.dto';
import { UpdateAeePlanDto } from 'src/aee-plans/dto/update-aee-plan.dto';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { ParsePositiveIdPipe } from 'src/common/parse-positive-id.pipe';
import { LEVELS } from 'src/constants';
import { STUDENT_EMAIL, validBody, validSections } from './aee-plan.fixtures';

const request = {
  user: {
    sub: 7,
    roles: [LEVELS.PROFISSIONAL_NAPNE],
    email: 'napne@example.com',
    name: 'Profissional NAPNE',
  },
} as AuthenticatedRequest;

const plan = { id: 31, ...validSections(), author: null };

describe('AeePlansController', () => {
  let controller: AeePlansController;
  let service: {
    create: jest.Mock;
    findByStudent: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(plan),
      findByStudent: jest.fn().mockResolvedValue([plan]),
      update: jest.fn().mockResolvedValue(plan),
      remove: jest.fn().mockResolvedValue({ message: 'removido' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AeePlansController],
      providers: [{ provide: AeePlansService, useValue: service }],
    }).compile();

    controller = module.get(AeePlansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create the plan with the id of the session as the author', async () => {
      const dto = validBody() as unknown as CreateAeePlanDto;

      const result = await controller.create(dto, request);

      expect(service.create).toHaveBeenCalledWith(dto, 7);
      expect(result).toBe(plan);
    });

    it('should propagate the errors of the service', async () => {
      service.create.mockRejectedValue(new Error('falha'));

      await expect(
        controller.create(validBody() as unknown as CreateAeePlanDto, request),
      ).rejects.toThrow('falha');
    });
  });

  describe('findByStudent', () => {
    it('should list the plans with the e-mail and the request of the session', async () => {
      const result = await controller.findByStudent(STUDENT_EMAIL, request);

      expect(service.findByStudent).toHaveBeenCalledWith(
        STUDENT_EMAIL,
        request,
      );
      expect(result).toEqual([plan]);
    });
  });

  describe('update', () => {
    it('should update the plan of the id', async () => {
      const dto = { basis: 'Novo embasamento' } as UpdateAeePlanDto;

      const result = await controller.update(31, dto);

      expect(service.update).toHaveBeenCalledWith(31, dto);
      expect(result).toBe(plan);
    });
  });

  describe('remove', () => {
    it('should remove the plan of the id', async () => {
      const result = await controller.remove(31);

      expect(service.remove).toHaveBeenCalledWith(31);
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

    it('should serve everything under /aee-plans', () => {
      expect(Reflect.getMetadata(PATH_METADATA, AeePlansController)).toBe(
        'aee-plans',
      );
    });

    it('should open POST /aee-plans only to the NAPNE', () => {
      expect(route(controller.create)).toEqual({
        method: RequestMethod.POST,
        path: '/',
        levels: [LEVELS.PROFISSIONAL_NAPNE],
      });
    });

    it('should open GET /aee-plans/:email to every level, the service restricts the student to his own', () => {
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

    it('should open PATCH /aee-plans/:id only to the NAPNE', () => {
      expect(route(controller.update)).toEqual({
        method: RequestMethod.PATCH,
        path: ':id',
        levels: [LEVELS.PROFISSIONAL_NAPNE],
      });
    });

    it('should open DELETE /aee-plans/:id only to the NAPNE', () => {
      expect(route(controller.remove)).toEqual({
        method: RequestMethod.DELETE,
        path: ':id',
        levels: [LEVELS.PROFISSIONAL_NAPNE],
      });
    });

    it.each(['update', 'remove'] as const)(
      'should parse the id of %s with the ParsePositiveIdPipe',
      (name) => {
        const args = Reflect.getMetadata(
          ROUTE_ARGS_METADATA,
          AeePlansController,
          name,
        ) as Record<string, { data: string; pipes: unknown[] }>;
        const idArg = Object.values(args).find(({ data }) => data === 'id');

        expect(idArg?.pipes).toEqual([ParsePositiveIdPipe]);
      },
    );

    it('should expose no route besides the four of the contract', () => {
      const handlers = Object.getOwnPropertyNames(
        AeePlansController.prototype,
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
