import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from 'src/app.controller';
import { AppModule } from 'src/app.module';
import { AppService } from 'src/app.service';
import { PrismaService } from 'src/database/prisma.service';
import { APP_GUARD } from '@nestjs/core';
import { getOptionsToken } from '@nestjs/throttler';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserThrottlerGuard } from 'src/common/user-throttler.guard';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have App Controller defined', () => {
    const controller = module.get<AppController>(AppController);
    expect(controller).toBeDefined();
  });

  it('should have App Service defined', () => {
    const service = module.get<AppService>(AppService);
    expect(service).toBeDefined();
  });

  // O Nest executa os guards globais na ordem em que são registrados: o
  // AuthGuard precisa preencher request.user antes da contagem por usuário.
  it('should register the AuthGuard before the UserThrottlerGuard', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as Array<
      { provide?: unknown; useClass?: unknown } | (new () => unknown)
    >;
    const guards = providers
      .filter(
        (provider): provider is { provide: unknown; useClass: unknown } =>
          typeof provider === 'object' && provider.provide === APP_GUARD,
      )
      .map((provider) => provider.useClass);

    expect(guards).toEqual([AuthGuard, UserThrottlerGuard]);
  });

  it('should allow 300 requests per minute on each route by default', () => {
    expect(module.get(getOptionsToken())).toEqual([
      { name: 'default', ttl: 60_000, limit: 300 },
    ]);
  });
});
