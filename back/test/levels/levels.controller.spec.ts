import { Test, TestingModule } from '@nestjs/testing';
import { CreateLevelDto } from 'src/levels/dto/create-level.dto';
import { UpdateLevelDto } from 'src/levels/dto/update-level.dto';
import { LevelsController } from 'src/levels/levels.controller';
import { LevelsService } from 'src/levels/levels.service';
import { LEVELS } from 'src/constants';

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
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
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

  describe('create', () => {
    it('should create a level', async () => {
      const createLevelDto: CreateLevelDto = { name: 'Test Level' };
      const result = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...createLevelDto,
      };
      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(createLevelDto)).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(createLevelDto);
    });
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

  describe('update', () => {
    it('should update a level', async () => {
      const id = '1';
      const updateLevelDto: UpdateLevelDto = { name: 'Updated Level' };
      const result = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        ...updateLevelDto,
      };
      jest.spyOn(service, 'update').mockResolvedValue(result);

      expect(await controller.update(id, updateLevelDto)).toEqual(result);
      expect(service.update).toHaveBeenCalledWith(+id, updateLevelDto);
    });
  });

  describe('remove', () => {
    it('should remove a level', async () => {
      const id = '1';
      const result = {
        id: 1,
        name: 'Removed Level',
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
