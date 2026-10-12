import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { UserThrottlerGuard } from 'src/common/user-throttler.guard';

@Controller('itens')
class ItensController {
  @Get()
  list() {
    return [];
  }
}

// Simula o AuthGuard: preenche request.user quando a requisição traz sessão.
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const sub = request.header('x-test-user');
    if (sub) {
      request.user = { sub: Number(sub) };
    }
    return true;
  }
}

describe('UserThrottlerGuard', () => {
  let app: INestApplication;
  const LIMIT = 3;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: LIMIT }])],
      controllers: [ItensController],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: UserThrottlerGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (user?: number) => {
    const call = request(app.getHttpServer()).get('/itens');
    return user === undefined ? call : call.set('x-test-user', String(user));
  };

  it('should answer 429 once the same user exceeds the limit', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      expect((await get(1)).status).toBe(200);
    }

    expect((await get(1)).status).toBe(429);
  });

  it('should count each user apart even from the same IP', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      await get(1);
    }

    expect((await get(1)).status).toBe(429);
    expect((await get(2)).status).toBe(200);
  });

  it('should count requests without a session by IP', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      expect((await get()).status).toBe(200);
    }

    expect((await get()).status).toBe(429);
    expect((await get(1)).status).toBe(200);
  });
});
