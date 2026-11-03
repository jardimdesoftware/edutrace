import { Test, TestingModule } from '@nestjs/testing';
import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('PlansEducationController', () => {
  let controller: StudentsController;
  let service: StudentsService;
  let serviceQueue: { assume: jest.Mock; close: jest.Mock; reopen: jest.Mock };

  beforeEach(async () => {
    serviceQueue = { assume: jest.fn(), close: jest.fn(), reopen: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        {
          provide: StudentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
        { provide: ServiceQueueService, useValue: serviceQueue },
      ],
    }).compile();

    controller = module.get<StudentsController>(StudentsController);
    service = module.get<StudentsService>(StudentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of students with masked cpf', async () => {
      const result = [
        {
          id: 1,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: 'Luizin',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id_level: 2,
          id_current_phase: 1,
          level: { id: 2, name: 'Aluno/Estudante' },
          current_phase: { id: 1, name: 'Triagem' },
        },
        {
          id: 2,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: 'Luizin',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          id_level: 2,
          id_current_phase: 1,
          level: { id: 2, name: 'Aluno/Estudante' },
          current_phase: { id: 1, name: 'Triagem' },
        },
      ];
      jest.spyOn(service, 'findAll').mockResolvedValue(result as never);

      const masked = result.map((student) => ({
        ...student,
        cpf: '***.456.789-**',
      }));

      expect(await controller.findAll()).toEqual(masked);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the student with masked cpf', async () => {
      const student = {
        id: 1,
        full_name: 'Luizin',
        cpf: '12345678910',
        email: 'luizin@hotmail.com',
        id_level: 2,
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(student as never);

      expect(await controller.findOne('luizin@hotmail.com')).toEqual({
        ...student,
        cpf: '***.456.789-**',
      });
      expect(service.findOne).toHaveBeenCalledWith('luizin@hotmail.com');
    });

    it('should return null when the email is not a student', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      expect(await controller.findOne('admin@edutrace.com')).toBeNull();
    });
  });

  describe('access levels', () => {
    it.each(['findAll', 'findOne'] as const)(
      'should allow %s to every level except students',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).toEqual([
          LEVELS.ADMIN,
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
          LEVELS.PROFISSIONAL_NAPNE,
        ]);
      },
    );
  });

  describe('transições do atendimento', () => {
    const student = {
      id: 2,
      full_name: 'Luizin',
      cpf: '12345678910',
      email: 'luizin@hotmail.com',
      id_level: 2,
    };
    const masked = { ...student, cpf: '***.456.789-**' };
    const request = (id_level: number) =>
      ({ user: { sub: 9, id_level } }) as AuthenticatedRequest;

    it('should assume the student for the NAPNE of the session and mask the CPF', async () => {
      serviceQueue.assume.mockResolvedValue(student);

      const result = await controller.assume(
        'luizin@hotmail.com',
        request(LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(serviceQueue.assume).toHaveBeenCalledWith('luizin@hotmail.com', 9);
      expect(result).toEqual(masked);
    });

    it.each([LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE])(
      'should close the service on behalf of the level %s and mask the CPF',
      async (id_level) => {
        serviceQueue.close.mockResolvedValue(student);

        const result = await controller.close(
          'luizin@hotmail.com',
          request(id_level),
        );

        expect(serviceQueue.close).toHaveBeenCalledWith('luizin@hotmail.com', {
          sub: 9,
          id_level,
        });
        expect(result).toEqual(masked);
      },
    );

    it('should reopen the service and mask the CPF', async () => {
      serviceQueue.reopen.mockResolvedValue(student);

      const result = await controller.reopen('luizin@hotmail.com');

      expect(serviceQueue.reopen).toHaveBeenCalledWith('luizin@hotmail.com');
      expect(result).toEqual(masked);
    });

    it.each([
      ['assume', [LEVELS.PROFISSIONAL_NAPNE]],
      ['close', [LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE]],
      ['reopen', [LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE]],
    ] as const)(
      'should open %s only to %j, which leaves the Education, Health and student levels with 403',
      (route, levels) => {
        expect(Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route])).toEqual(
          levels,
        );
      },
    );

    it.each([
      ['assume', 'assume'],
      ['close', 'close'],
      ['reopen', 'reopen'],
    ] as const)('should expose %s as POST :email/service/%s', (route, path) => {
      expect(Reflect.getMetadata(METHOD_METADATA, controller[route])).toBe(
        RequestMethod.POST,
      );
      expect(Reflect.getMetadata(PATH_METADATA, controller[route])).toBe(
        `:email/service/${path}`,
      );
    });

    it.each(['assume', 'close', 'reopen'] as const)(
      'should answer %s with 200, because it changes a student instead of creating one',
      (route) => {
        expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller[route])).toBe(
          200,
        );
      },
    );
  });
});
