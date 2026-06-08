import { Test, TestingModule } from '@nestjs/testing';
import { ReportsModule } from 'src/reports/reports.module';
import { ReportsService } from 'src/reports/reports.service';
import { ReportsController } from 'src/reports/reports.controller';

describe('ReportsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ReportsModule],
    })
      .overrideProvider('PrismaService')
      .useValue({ $queryRaw: jest.fn() })
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide ReportsService', () => {
    const service = module.get<ReportsService>(ReportsService);
    expect(service).toBeDefined();
  });

  it('should provide ReportsController', () => {
    const controller = module.get<ReportsController>(ReportsController);
    expect(controller).toBeDefined();
  });
});
