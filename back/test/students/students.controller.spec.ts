import { Test, TestingModule } from '@nestjs/testing';
import { RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { SetPedagogicalManagerDto } from 'src/students/dto/set-pedagogical-manager.dto';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

const request = (id_level: number) =>
  ({ user: { sub: 9, roles: [id_level] } }) as AuthenticatedRequest;

describe('PlansEducationController', () => {
  let controller: StudentsController;
  let service: StudentsService;
  let serviceQueue: { assume: jest.Mock; close: jest.Mock; reopen: jest.Mock };
  let serviceStats: { getStats: jest.Mock };

  beforeEach(async () => {
    serviceQueue = { assume: jest.fn(), close: jest.fn(), reopen: jest.fn() };
    serviceStats = { getStats: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        {
          provide: StudentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findPedagogicalManagerOptions: jest.fn(),
            setPedagogicalManager: jest.fn(),
          },
        },
        { provide: ServiceQueueService, useValue: serviceQueue },
        { provide: ServiceStatsService, useValue: serviceStats },
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
          pedagogical_manager: { id: 9, full_name: 'Ana' },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          roles: [2],
          id_current_phase: 1,
          current_phase: { id: 1, name: 'Triagem' },
        },
        {
          id: 2,
          full_name: 'Luizin',
          cpf: '12345678910',
          email: 'luizin@hotmail.com',
          affliation: 'Filiação',
          pedagogical_manager: { id: 9, full_name: 'Ana' },
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          roles: [2],
          id_current_phase: 1,
          current_phase: { id: 1, name: 'Triagem' },
        },
      ];
      jest.spyOn(service, 'findAll').mockResolvedValue(result as never);

      const masked = result.map((student) => ({
        ...student,
        cpf: '***.456.789-**',
      }));

      expect(
        await controller.findAll(request(LEVELS.PROFISSIONAL_SAUDE)),
      ).toEqual(masked);
      expect(service.findAll).toHaveBeenCalledWith([LEVELS.PROFISSIONAL_SAUDE]);
    });
  });

  describe('findOne', () => {
    it('should return the student with masked cpf', async () => {
      const student = {
        id: 1,
        full_name: 'Luizin',
        cpf: '12345678910',
        email: 'luizin@hotmail.com',
        roles: [2],
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(student as never);

      expect(
        await controller.findOne(
          'luizin@hotmail.com',
          request(LEVELS.PROFISSIONAL_SAUDE),
        ),
      ).toEqual({
        ...student,
        cpf: '***.456.789-**',
      });
      expect(service.findOne).toHaveBeenCalledWith('luizin@hotmail.com', [
        LEVELS.PROFISSIONAL_SAUDE,
      ]);
    });

    it('should return null when the email is not a student', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      expect(
        await controller.findOne('admin@edutrace.com', request(LEVELS.PROFISSIONAL_NAPNE)),
      ).toBeNull();
    });
  });

  describe('access levels', () => {
    it.each(['findAll', 'findOne'] as const)(
      'should allow %s to every professional level, not to the Administrator nor students',
      (route) => {
        const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]);

        expect(levels).toEqual([
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
          LEVELS.PROFISSIONAL_NAPNE,
          LEVELS.PROFESSOR_AEE,
        ]);
      },
    );
  });

  describe('serviceStats', () => {
    const stats = {
      totals: { WAITING: 2, IN_SERVICE: 1, CLOSED: 0 },
      professionals: [
        { id: 10, full_name: 'Ana', in_service: 1, capacity: 3, free: 2 },
      ],
      queue: {
        size: 2,
        oldest_queued_at: new Date('2026-10-01T09:30:00.000Z'),
      },
    };

    it('should return the statistics of the service as they come from the service', async () => {
      serviceStats.getStats.mockResolvedValue(stats);

      expect(await controller.serviceStats()).toBe(stats);
      expect(serviceStats.getStats).toHaveBeenCalledTimes(1);
    });

    it('should open only to the NAPNE, which leaves the Administrator, Education, Health and student levels with 403', () => {
      expect(
        Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.serviceStats),
      ).toEqual([LEVELS.PROFISSIONAL_NAPNE]);
    });

    it('should expose GET service-stats', () => {
      expect(
        Reflect.getMetadata(METHOD_METADATA, controller.serviceStats),
      ).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(PATH_METADATA, controller.serviceStats)).toBe(
        'service-stats',
      );
    });
  });

  describe('transições do atendimento', () => {
    const student = {
      id: 2,
      full_name: 'Luizin',
      cpf: '12345678910',
      email: 'luizin@hotmail.com',
      roles: [2],
    };
    const masked = { ...student, cpf: '***.456.789-**' };
    it('should assume the student for the AEE teacher of the session and mask the CPF', async () => {
      serviceQueue.assume.mockResolvedValue(student);

      const result = await controller.assume(
        'luizin@hotmail.com',
        request(LEVELS.PROFESSOR_AEE),
      );

      expect(serviceQueue.assume).toHaveBeenCalledWith(
        'luizin@hotmail.com',
        9,
        [LEVELS.PROFESSOR_AEE],
      );
      expect(result).toEqual(masked);
    });

    it.each([LEVELS.PROFESSOR_AEE])(
      'should close the service on behalf of the level %s and mask the CPF',
      async (id_level) => {
        serviceQueue.close.mockResolvedValue(student);

        const result = await controller.close(
          'luizin@hotmail.com',
          request(id_level),
        );

        expect(serviceQueue.close).toHaveBeenCalledWith('luizin@hotmail.com', {
          sub: 9,
          roles: [id_level],
        });
        expect(result).toEqual(masked);
      },
    );

    it('should reopen the service and mask the CPF', async () => {
      serviceQueue.reopen.mockResolvedValue(student);

      const result = await controller.reopen(
        'luizin@hotmail.com',
        request(LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(serviceQueue.reopen).toHaveBeenCalledWith('luizin@hotmail.com', [
        LEVELS.PROFISSIONAL_NAPNE,
      ]);
      expect(result).toEqual(masked);
    });

    it.each([
      ['assume', [LEVELS.PROFESSOR_AEE]],
      ['close', [LEVELS.PROFESSOR_AEE]],
      [
        'reopen',
        [LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE],
      ],
    ] as const)(
      'should open %s only to %j, which leaves the Education, Health, student and (except reopen) NAPNE levels with 403',
      (route, levels) => {
        expect(
          Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]),
        ).toEqual(levels);
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

  // A decisão de quem lê o telefone e o CPF do responsável externo é do select
  // que o serviço usa (userSelectFor). O controller só repassa o nível de quem
  // pede e mascara os dois CPFs do que o serviço devolveu.
  describe('responsável pedagógico externo nas leituras', () => {
    const withManager = {
      id: 1,
      full_name: 'Luizin',
      cpf: '12345678910',
      email: 'luizin@hotmail.com',
      roles: [2],
      pedagogical_manager: null,
      external_manager_name: 'Maria da Silva',
      external_manager_phone: '81999998888',
      external_manager_cpf: '98765432100',
    };
    const masked = {
      ...withManager,
      cpf: '***.456.789-**',
      external_manager_cpf: '***.654.321-**',
    };

    it.each([LEVELS.PROFISSIONAL_NAPNE])(
      'should ask the service for the level %s and mask both cpfs',
      async (level) => {
        jest
          .spyOn(service, 'findAll')
          .mockResolvedValue([withManager] as never);
        jest.spyOn(service, 'findOne').mockResolvedValue(withManager as never);

        expect(await controller.findAll(request(level))).toEqual([masked]);
        expect(
          await controller.findOne('luizin@hotmail.com', request(level)),
        ).toEqual(masked);
        expect(service.findAll).toHaveBeenCalledWith([level]);
        expect(service.findOne).toHaveBeenCalledWith('luizin@hotmail.com', [
          level,
        ]);
      },
    );

    it('should return the student without the contact keys as the service returned it', async () => {
      const { external_manager_phone: _phone, ...withoutContact } = withManager;
      const { external_manager_cpf: _cpf, ...visible } = withoutContact;
      jest.spyOn(service, 'findOne').mockResolvedValue(visible as never);

      const found = await controller.findOne(
        'luizin@hotmail.com',
        request(LEVELS.PROFISSIONAL_SAUDE),
      );

      expect(found).not.toHaveProperty('external_manager_phone');
      expect(found).not.toHaveProperty('external_manager_cpf');
    });

    it('should never return the external cpf unmasked', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(withManager as never);

      const found = await controller.findOne(
        'luizin@hotmail.com',
        request(LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(JSON.stringify(found)).not.toContain('98765432100');
    });
  });

  describe('pedagogicalManagerOptions', () => {
    it('should return the options as they come from the service', async () => {
      const options = [
        { id: 4, full_name: 'Ana', roles: [LEVELS.PROFISSIONAL_NAPNE] },
      ];
      jest
        .spyOn(service, 'findPedagogicalManagerOptions')
        .mockResolvedValue(options);

      expect(await controller.pedagogicalManagerOptions()).toBe(options);
    });

    it('should open only to the NAPNE, which leaves the Administrator, Education, Health and student levels with 403', () => {
      expect(
        Reflect.getMetadata(
          ALLOW_LEVELS_KEY,
          controller.pedagogicalManagerOptions,
        ),
      ).toEqual([LEVELS.PROFISSIONAL_NAPNE]);
    });

    it('should expose GET pedagogical-manager-options', () => {
      expect(
        Reflect.getMetadata(
          METHOD_METADATA,
          controller.pedagogicalManagerOptions,
        ),
      ).toBe(RequestMethod.GET);
      expect(
        Reflect.getMetadata(
          PATH_METADATA,
          controller.pedagogicalManagerOptions,
        ),
      ).toBe('pedagogical-manager-options');
    });
  });

  describe('setPedagogicalManager', () => {
    const dto = {
      kind: 'EXTERNAL',
      name: 'Maria da Silva',
      phone: '81999998888',
      cpf: '98765432100',
    } as SetPedagogicalManagerDto;
    const saved = {
      id: 2,
      full_name: 'Luizin',
      cpf: '12345678910',
      external_manager_name: 'Maria da Silva',
      external_manager_phone: '81999998888',
      external_manager_cpf: '98765432100',
    };

    it('should pass the e-mail and the body to the service and mask both cpfs', async () => {
      jest
        .spyOn(service, 'setPedagogicalManager')
        .mockResolvedValue(saved as never);

      const result = await controller.setPedagogicalManager(
        'luizin@hotmail.com',
        dto,
        request(LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(service.setPedagogicalManager).toHaveBeenCalledWith(
        'luizin@hotmail.com',
        dto,
        [LEVELS.PROFISSIONAL_NAPNE],
      );
      expect(result).toEqual({
        ...saved,
        cpf: '***.456.789-**',
        external_manager_cpf: '***.654.321-**',
      });
    });

    it('should open only to the NAPNE, which leaves the Administrator, Education, Health and student levels with 403', () => {
      expect(
        Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.setPedagogicalManager),
      ).toEqual([LEVELS.PROFISSIONAL_NAPNE]);
    });

    it('should expose PATCH :email/pedagogical-manager', () => {
      expect(
        Reflect.getMetadata(METHOD_METADATA, controller.setPedagogicalManager),
      ).toBe(RequestMethod.PATCH);
      expect(
        Reflect.getMetadata(PATH_METADATA, controller.setPedagogicalManager),
      ).toBe(':email/pedagogical-manager');
    });

    it('should answer 200, because it changes a student instead of creating one', () => {
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          controller.setPedagogicalManager,
        ),
      ).toBe(200);
    });
  });
});
