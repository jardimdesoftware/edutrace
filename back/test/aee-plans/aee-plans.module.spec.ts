import { Test, TestingModule } from '@nestjs/testing';
import { AeePlansController } from 'src/aee-plans/aee-plans.controller';
import { AeePlansModule } from 'src/aee-plans/aee-plans.module';
import { AeePlansService } from 'src/aee-plans/aee-plans.service';
import { PrismaService } from 'src/database/prisma.service';

describe('AeePlansModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AeePlansModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have AeePlansController defined', () => {
    expect(module.get(AeePlansController)).toBeDefined();
  });

  it('should have AeePlansService defined', () => {
    expect(module.get(AeePlansService)).toBeDefined();
  });
});
