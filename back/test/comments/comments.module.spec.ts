import { Test, TestingModule } from '@nestjs/testing';
import { CommentsModule } from 'src/comments/comments.module';
import { CommentsService } from 'src/comments/comments.service';
import { CommentsController } from 'src/comments/comments.controller';
import { PrismaService } from 'src/database/prisma.service';

describe('CommentsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommentsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ comments: { create: jest.fn(), findMany: jest.fn() } })
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide CommentsService', () => {
    const service = module.get<CommentsService>(CommentsService);
    expect(service).toBeDefined();
  });

  it('should provide CommentsController', () => {
    const controller = module.get<CommentsController>(CommentsController);
    expect(controller).toBeDefined();
  });

  it('should export CommentsService', () => {
    const service = module.get<CommentsService>(CommentsService);
    expect(service).toBeInstanceOf(CommentsService);
  });
});
