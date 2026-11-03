import { Test, TestingModule } from '@nestjs/testing';
import { CaseStudiesController } from 'src/case-studies/case-studies.controller';
import { CaseStudiesModule } from 'src/case-studies/case-studies.module';
import { CaseStudiesService } from 'src/case-studies/case-studies.service';
import { PrismaService } from 'src/database/prisma.service';

describe('CaseStudiesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CaseStudiesModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have CaseStudiesController defined', () => {
    expect(module.get(CaseStudiesController)).toBeDefined();
  });

  it('should have CaseStudiesService defined', () => {
    expect(module.get(CaseStudiesService)).toBeDefined();
  });
});
