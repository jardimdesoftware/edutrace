import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LevelsService } from 'src/levels/levels.service';

describe('LevelsService', () => {
  let service: LevelsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LevelsService,
        {
          provide: PrismaService,
          useValue: {
            level: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LevelsService>(LevelsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not expose write methods', () => {
    expect(service).not.toHaveProperty('create');
    expect(service).not.toHaveProperty('update');
    expect(service).not.toHaveProperty('remove');
  });

  describe('findAll', () => {
    it('should return an array of levels', async () => {
      const levelsList = [
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
      jest.spyOn(prisma.level, 'findMany').mockResolvedValue(levelsList);

      const result = await service.findAll();

      expect(prisma.level.findMany).toHaveBeenCalled();
      expect(result).toEqual(levelsList);
    });
  });

  describe('findOne', () => {
    it('should return a single level by ID', async () => {
      const id = 1;
      const level = {
        id: 1,
        name: 'Test Level',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };
      jest.spyOn(prisma.level, 'findUnique').mockResolvedValue(level);

      const result = await service.findOne(id);

      expect(prisma.level.findUnique).toHaveBeenCalledWith({
        where: { id: id },
      });
      expect(result).toEqual(level);
    });
  });
});
