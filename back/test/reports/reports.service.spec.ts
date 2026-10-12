import { NotFoundException } from '@nestjs/common';
import { StudentsService } from 'src/students/students.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { ReportsService } from 'src/reports/reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;
  let studentsService: StudentsService;

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
          provide: StudentsService,
          useValue: {
            findOneOrFail: jest
              .fn()
              .mockResolvedValue({ id: 2, email: 'estudante@example.com' }),
            findAllEmails: jest
              .fn()
              .mockResolvedValue(['estudante@example.com']),
          },
        },
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
    studentsService = module.get<StudentsService>(StudentsService);
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

  describe('titular estudante', () => {
    it('should answer 404 for someone who is not a student without querying', async () => {
      jest
        .spyOn(studentsService, 'findOneOrFail')
        .mockRejectedValue(new NotFoundException('Estudante não encontrado'));

      await expect(service.findOne('profissional@example.com')).rejects.toThrow(
        NotFoundException,
      );
      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
        email: 'profissional@example.com',
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
