import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { PeiEntriesController } from 'src/pei-entries/pei-entries.controller';
import { PeiEntriesModule } from 'src/pei-entries/pei-entries.module';
import { PeiEntriesService } from 'src/pei-entries/pei-entries.service';

describe('PeiEntriesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [PeiEntriesModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have PeiEntriesController defined', () => {
    expect(module.get(PeiEntriesController)).toBeDefined();
  });

  it('should have PeiEntriesService defined', () => {
    expect(module.get(PeiEntriesService)).toBeDefined();
  });
});
