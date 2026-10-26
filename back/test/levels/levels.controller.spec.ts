import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { LevelsController } from 'src/levels/levels.controller';
import { LevelsService } from 'src/levels/levels.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('LevelsController', () => {
  let controller: LevelsController;
  let service: LevelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LevelsController],
      providers: [
        {
          provide: LevelsService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LevelsController>(LevelsController);
    service = module.get<LevelsService>(LevelsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of levels', async () => {
      const result = [
        {
          id: 1,
          name: 'Level 1',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 2,
          name: 'Level 2',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
      ];
      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await controller.findAll()).toEqual(result);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single level by ID', async () => {
      const id = '1';
      const result = {
        id: 1,
        name: 'Test Level',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(result);

      expect(await controller.findOne(id)).toEqual(result);
      expect(service.findOne).toHaveBeenCalledWith(+id);
    });
  });

  describe('routes', () => {
    it('should expose only GET routes, with no write route', () => {
      const prototype = LevelsController.prototype;
      const methods = Object.getOwnPropertyNames(prototype)
        .filter((name) => name !== 'constructor')
        .map(
          (name) =>
            Reflect.getMetadata(METHOD_METADATA, prototype[name]) as
              RequestMethod | undefined,
        );

      expect(methods).toHaveLength(2);
      expect(methods.every((method) => method === RequestMethod.GET)).toBe(
        true,
      );
    });
  });

  describe('access levels', () => {
    it.each(['findAll', 'findOne'] as const)(
      'should open %s to the four original levels and to the NAPNE and the Professor do AEE',
      (route) => {
        expect(
          Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]),
        ).toEqual([
          LEVELS.ADMIN,
          LEVELS.ALUNO_ESTUDANTE,
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
          LEVELS.PROFISSIONAL_NAPNE,
          LEVELS.PROFESSOR_AEE,
        ]);
      },
    );

    it.each(['findAll', 'findOne'] as const)(
      'should open %s to the NAPNE professional and to the Professor do AEE',
      (route) => {
        expect(
          Reflect.getMetadata(ALLOW_LEVELS_KEY, controller[route]),
        ).toEqual(
          expect.arrayContaining([
            LEVELS.PROFISSIONAL_NAPNE,
            LEVELS.PROFESSOR_AEE,
          ]),
        );
      },
    );
  });
});
