import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from 'src/reports/reports.controller';
import { ReportsService } from 'src/reports/reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockReport = [
    {
      id: 1,
      email: 'student@test.com',
      full_name: 'Test Student',
    },
  ];

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
  });
});
