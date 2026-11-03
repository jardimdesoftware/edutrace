import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { LEVELS } from 'src/constants';
import { UserThrottlerGuard } from 'src/common/user-throttler.guard';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';
import { USER_CREATE_RATE_LIMIT_DEFAULT } from 'src/users/users.throttle';

describe('UsersController create rate limit', () => {
  let app: INestApplication;
  let usersService: { create: jest.Mock; findAll: jest.Mock };

  const LIMIT = USER_CREATE_RATE_LIMIT_DEFAULT;

  const createdUser = { id: 10, email: 'novo@test.com', cpf: '01234567890' };
  const body = {
    full_name: 'Novo Estudante',
    cpf: '01234567890',
    email: 'novo@test.com',
  };

  const createAs = (sessionUserId: number) =>
    request(app.getHttpServer())
      .post('/users')
      .set('x-session-user', String(sessionUserId))
      .send(body);

  beforeEach(async () => {
    usersService = {
      create: jest.fn().mockResolvedValue(createdUser),
      findAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      // Mesmo arranjo do AppModule: limite geral folgado e UserThrottlerGuard
      // global, depois do guard que preenche a sessão. O POST /users precisa
      // continuar no limite próprio.
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }])],
      controllers: [UsersController],
      providers: [
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = {
                sub: Number(req.headers['x-session-user']),
                id_level: LEVELS.ADMIN,
              };
              return true;
            },
          },
        },
        { provide: APP_GUARD, useClass: UserThrottlerGuard },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow 60 registrations per hour by default', () => {
    expect(LIMIT).toBe(60);
  });

  it('should accept POST /users up to the limit and answer 429 after it', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      const response = await createAs(1);
      expect(response.status).toBe(201);
    }

    const response = await createAs(1);

    expect(response.status).toBe(429);
    expect(usersService.create).toHaveBeenCalledTimes(LIMIT);
  });

  it('should count the limit per session user', async () => {
    for (let attempt = 0; attempt <= LIMIT; attempt++) {
      await createAs(1);
    }

    const response = await createAs(2);

    expect(response.status).toBe(201);
  });

  it('should not apply the registration limit to the other users routes', async () => {
    for (let attempt = 0; attempt <= LIMIT; attempt++) {
      await createAs(1);
    }

    const response = await request(app.getHttpServer())
      .get('/users')
      .set('x-session-user', '1');

    expect(response.status).toBe(200);
  });
});
