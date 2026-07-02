import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;

    afterEach(() => {
      process.env.DATABASE_URL = originalDatabaseUrl;
    });

    it('should throw when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;

      expect(() => new PrismaService()).toThrow(
        'DATABASE_URL environment variable is not set',
      );
    });
  });

  describe('onModuleInit', () => {
    it('should call $connect on initialization', async () => {
      jest.spyOn(service, '$connect').mockResolvedValue();

      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalled();
    });
  });
});
