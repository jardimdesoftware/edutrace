import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { ReportsService } from 'src/reports/reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  const mockReport = [
    {
      id: 1,
      email: 'student@test.com',
      full_name: 'Test Student',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should execute a raw query and return report data', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue(mockReport);

      const result = await service.findOne('student@test.com');

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockReport);
    });

    it('should return an empty array when no data is found', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]);

      const result = await service.findOne('notfound@test.com');

      expect(result).toEqual([]);
    });
  });
});
