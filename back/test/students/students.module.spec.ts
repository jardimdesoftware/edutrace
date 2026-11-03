import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsModule } from 'src/students/students.module';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsService } from 'src/students/students.service';

describe('StudentsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [StudentsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have StudentsController defined', () => {
    const controller = module.get<StudentsController>(StudentsController);
    expect(controller).toBeDefined();
  });

  it('should have StudentsService defined', () => {
    const service = module.get<StudentsService>(StudentsService);
    expect(service).toBeDefined();
  });

  it('should have ServiceQueueService defined', () => {
    const service = module.get<ServiceQueueService>(ServiceQueueService);
    expect(service).toBeDefined();
  });

  it('should have ServiceStatsService defined', () => {
    const service = module.get<ServiceStatsService>(ServiceStatsService);
    expect(service).toBeDefined();
  });
});
