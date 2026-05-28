import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { AuthController } from 'src/auth/auth.controller';
import { PrismaService } from 'src/database/prisma.service';

const prismaServiceMock = {
  user: { findUnique: jest.fn() },
};

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .compile();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide AuthService', () => {
    const service = module.get<AuthService>(AuthService);
    expect(service).toBeDefined();
  });

  it('should provide AuthController', () => {
    const controller = module.get<AuthController>(AuthController);
    expect(controller).toBeDefined();
  });

  it('should provide JwtService (global JwtModule)', () => {
    const jwtService = module.get<JwtService>(JwtService);
    expect(jwtService).toBeDefined();
  });

  it('AuthService should have JwtService injected', () => {
    const service = module.get<AuthService>(AuthService);
    expect((service as any).jwtService).toBeInstanceOf(JwtService);
  });
});
