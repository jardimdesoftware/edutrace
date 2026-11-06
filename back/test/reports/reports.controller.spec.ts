import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from 'src/reports/reports.controller';
import { ReportsService } from 'src/reports/reports.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockReport = {
    screening: null,
    peiEntries: [],
    caseStudy: null,
    aeePlans: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            findOne: jest.fn(),
            generator: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOne', () => {
    it('should return report data for a given email', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockReport);

      const result = await controller.findOne('student@test.com');

      expect(service.findOne).toHaveBeenCalledWith('student@test.com');
      expect(result).toEqual(mockReport);
    });

    it('should allow the export to every professional level, not to the Administrator nor students', () => {
      const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.findOne);

      expect(levels).toEqual([
        LEVELS.PROFISSIONAL_EDUCACAO,
        LEVELS.PROFISSIONAL_SAUDE,
        LEVELS.PROFISSIONAL_NAPNE,
        LEVELS.PROFESSOR_AEE,
      ]);
    });
  });

  describe('generator', () => {
    it('should ask the service for the user of the session', async () => {
      const identity = { full_name: 'Ana', cpf: '***.456.789-**' };
      jest.spyOn(service, 'generator').mockResolvedValue(identity);

      const result = await controller.generator({
        user: { sub: 7 },
      } as never);

      expect(service.generator).toHaveBeenCalledWith(7);
      expect(result).toEqual(identity);
    });

    it('should allow the same levels of the report', () => {
      const levels = Reflect.getMetadata(
        ALLOW_LEVELS_KEY,
        controller.generator,
      );

      expect(levels).toEqual(
        Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.findOne),
      );
    });
  });
});
