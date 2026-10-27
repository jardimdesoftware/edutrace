import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';
import { CaseStudiesController } from 'src/case-studies/case-studies.controller';
import { CaseStudiesService } from 'src/case-studies/case-studies.service';
import { CreateCaseStudyDto } from 'src/case-studies/dto/create-case-study.dto';
import { UpdateCaseStudyDto } from 'src/case-studies/dto/update-case-study.dto';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS } from 'src/constants';
import { STUDENT_EMAIL, validBody, validSections } from './case-study.fixtures';

const request = {
  user: {
    sub: 7,
    roles: [LEVELS.PROFESSOR_AEE],
    email: 'professor.aee@example.com',
    name: 'Professor do AEE',
  },
} as AuthenticatedRequest;

const caseStudy = { ...validSections(), author: null };

describe('CaseStudiesController', () => {
  let controller: CaseStudiesController;
  let service: {
    create: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(caseStudy),
      findOne: jest.fn().mockResolvedValue(caseStudy),
      update: jest.fn().mockResolvedValue(caseStudy),
      remove: jest.fn().mockResolvedValue({ message: 'removido' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseStudiesController],
      providers: [{ provide: CaseStudiesService, useValue: service }],
    }).compile();

    controller = module.get(CaseStudiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create the case study with the id of the session as the author', async () => {
      const dto = validBody() as unknown as CreateCaseStudyDto;

      const result = await controller.create(dto, request);

      expect(service.create).toHaveBeenCalledWith(dto, 7);
      expect(result).toBe(caseStudy);
    });

    it('should propagate the errors of the service', async () => {
      service.create.mockRejectedValue(new Error('falha'));

      await expect(
        controller.create(
          validBody() as unknown as CreateCaseStudyDto,
          request,
        ),
      ).rejects.toThrow('falha');
    });
  });

  describe('findOne', () => {
    it('should read the case study with the e-mail and the request of the session', async () => {
      const result = await controller.findOne(STUDENT_EMAIL, request);

      expect(service.findOne).toHaveBeenCalledWith(STUDENT_EMAIL, request);
      expect(result).toBe(caseStudy);
    });
  });

  describe('update', () => {
    it('should update the case study of the e-mail', async () => {
      const dto = { barriers: 'Novas barreiras' } as UpdateCaseStudyDto;

      const result = await controller.update(STUDENT_EMAIL, dto);

      expect(service.update).toHaveBeenCalledWith(STUDENT_EMAIL, dto);
      expect(result).toBe(caseStudy);
    });
  });

  describe('remove', () => {
    it('should remove the case study of the e-mail', async () => {
      const result = await controller.remove(STUDENT_EMAIL);

      expect(service.remove).toHaveBeenCalledWith(STUDENT_EMAIL);
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

    it('should serve everything under /case-studies', () => {
      expect(Reflect.getMetadata(PATH_METADATA, CaseStudiesController)).toBe(
        'case-studies',
      );
    });

    it('should open POST /case-studies only to the AEE teacher', () => {
      expect(route(controller.create)).toEqual({
        method: RequestMethod.POST,
        path: '/',
        levels: [LEVELS.PROFESSOR_AEE],
      });
    });

    it('should open GET /case-studies/:email to every level, the service restricts the student to his own', () => {
      expect(route(controller.findOne)).toEqual({
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

    it('should open PATCH /case-studies/:email only to the AEE teacher', () => {
      expect(route(controller.update)).toEqual({
        method: RequestMethod.PATCH,
        path: ':email',
        levels: [LEVELS.PROFESSOR_AEE],
      });
    });

    it('should open DELETE /case-studies/:email only to the AEE teacher', () => {
      expect(route(controller.remove)).toEqual({
        method: RequestMethod.DELETE,
        path: ':email',
        levels: [LEVELS.PROFESSOR_AEE],
      });
    });

    it('should expose no route besides the four of the contract', () => {
      const handlers = Object.getOwnPropertyNames(
        CaseStudiesController.prototype,
      ).filter((name) => name !== 'constructor');

      expect(handlers.sort()).toEqual([
        'create',
        'findOne',
        'remove',
        'update',
      ]);
    });
  });
});
