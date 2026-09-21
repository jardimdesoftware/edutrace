import { Test, TestingModule } from '@nestjs/testing';
import { CreatePhaseDto } from 'src/phases/dto/create-phase.dto';
import { UpdatePhaseDto } from 'src/phases/dto/update-phase.dto';
import { PhasesController } from 'src/phases/phases.controller';
import { PhasesService } from 'src/phases/phases.service';
import { LEVELS } from 'src/constants';

describe('PhasesController', () => {
  let controller: PhasesController;
  let service: PhasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhasesController],
      providers: [
        {
          provide: PhasesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PhasesController>(PhasesController);
    service = module.get<PhasesService>(PhasesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a phase', async () => {
      const createPhaseDto: CreatePhaseDto = { name: 'Test Phase' };
      const result = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...createPhaseDto,
      };
      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(createPhaseDto)).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(createPhaseDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of phases', async () => {
      const result = [
        {
          id: 1,
          name: 'Phase 1',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: 2,
          name: 'Phase 2',
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
    it('should return a single phase by ID', async () => {
      const id = '1';
      const result = {
        id: 1,
        name: 'Test Phase',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(result);

      expect(await controller.findOne(id)).toEqual(result);
      expect(service.findOne).toHaveBeenCalledWith(+id);
    });
  });

  describe('update', () => {
    it('should update a phase', async () => {
      const id = '1';
      const updatePhaseDto: UpdatePhaseDto = { name: 'Updated Phase' };
      const result = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...updatePhaseDto,
      };
      jest.spyOn(service, 'update').mockResolvedValue(result);

      expect(await controller.update(id, updatePhaseDto)).toEqual(result);
      expect(service.update).toHaveBeenCalledWith(+id, updatePhaseDto);
    });
  });

  describe('remove', () => {
    it('should remove a phase', async () => {
      const id = '1';
      const result = {
        id: 1,
        name: 'Removed Phase',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest.spyOn(service, 'remove').mockResolvedValue(result);

      expect(await controller.remove(id)).toEqual(result);
      expect(service.remove).toHaveBeenCalledWith(+id);
    });
  });

  describe('access levels', () => {
    it.each(['create', 'update', 'remove'] as const)(
      'should restrict %s to the administrator',
      (route) => {
        const levels = Reflect.getMetadata('levels', controller[route]);

        expect(levels).toEqual([
          LEVELS.ALUNO_ESTUDANTE,
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
        ]);
        expect(levels).not.toContain(LEVELS.ADMIN);
      },
    );

    it.each(['findAll', 'findOne'] as const)(
      'should leave %s open to every authenticated level',
      (route) => {
        expect(
          Reflect.getMetadata('levels', controller[route]),
        ).toBeUndefined();
      },
    );
  });
});
