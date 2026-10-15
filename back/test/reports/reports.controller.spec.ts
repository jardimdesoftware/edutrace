import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from 'src/reports/reports.controller';
import { ReportsService } from 'src/reports/reports.service';
import { LEVELS } from 'src/constants';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockReport = { screening: null, plansEducation: null };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            findOne: jest.fn(),
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

    it('should allow the export to every level except students', () => {
      const levels = Reflect.getMetadata(ALLOW_LEVELS_KEY, controller.findOne);

      expect(levels).toEqual([
        LEVELS.ADMIN,
        LEVELS.PROFISSIONAL_EDUCACAO,
        LEVELS.PROFISSIONAL_SAUDE,
      ]);
    });
  });
});
