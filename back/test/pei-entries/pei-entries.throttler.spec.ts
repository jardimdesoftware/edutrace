import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { UserThrottlerGuard } from 'src/common/user-throttler.guard';
import { LEVELS } from 'src/constants';
import { PeiEntriesController } from 'src/pei-entries/pei-entries.controller';
import { PeiEntriesService } from 'src/pei-entries/pei-entries.service';
import {
  PEI_ENTRY_CREATE_RATE_LIMIT,
  PEI_ENTRY_CREATE_RATE_TTL_MS,
  PEI_ENTRY_CREATE_THROTTLE,
} from 'src/pei-entries/pei-entries.throttle';
import { STUDENT_EMAIL, validBody } from './pei-entry.fixtures';

// O limite escrito aqui, e não importado, para que mudar a constante quebre o
// teste: são 60 registros por hora de cada usuário.
const LIMIT = 60;
const ONE_HOUR_MS = 3_600_000;

describe('PeiEntriesController create rate limit', () => {
  let app: INestApplication;
  let peiEntriesService: {
    create: jest.Mock;
    findByStudent: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const createAs = (sessionUserId: number) =>
    request(app.getHttpServer())
      .post('/pei-entries')
      .set('x-session-user', String(sessionUserId))
      .send(validBody());

  beforeEach(async () => {
    peiEntriesService = {
      create: jest.fn().mockResolvedValue({ id: 31 }),
      findByStudent: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 31 }),
      remove: jest.fn().mockResolvedValue({ message: 'removido' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      // Mesmo arranjo do AppModule: limite geral folgado e UserThrottlerGuard
      // global, depois do guard que preenche a sessão. O POST /pei-entries
      // precisa continuar no limite próprio.
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }])],
      controllers: [PeiEntriesController],
      providers: [
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = {
                sub: Number(req.headers['x-session-user']),
                roles: [LEVELS.PROFISSIONAL_EDUCACAO],
                email: 'professora@example.com',
              };
              return true;
            },
          },
        },
        { provide: APP_GUARD, useClass: UserThrottlerGuard },
        { provide: PeiEntriesService, useValue: peiEntriesService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow 60 entries per hour per user', () => {
    expect(PEI_ENTRY_CREATE_RATE_LIMIT).toBe(LIMIT);
    expect(PEI_ENTRY_CREATE_RATE_TTL_MS).toBe(ONE_HOUR_MS);
    expect(PEI_ENTRY_CREATE_THROTTLE).toEqual({
      default: { limit: LIMIT, ttl: ONE_HOUR_MS },
    });
  });

  it('should accept POST /pei-entries up to the limit and answer 429 after it', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      const response = await createAs(1);
      expect(response.status).toBe(201);
    }

    const response = await createAs(1);

    expect(response.status).toBe(429);
    expect(peiEntriesService.create).toHaveBeenCalledTimes(LIMIT);
  });

  it('should count the limit per session user', async () => {
    for (let attempt = 0; attempt <= LIMIT; attempt++) {
      await createAs(1);
    }

    const response = await createAs(2);

    expect(response.status).toBe(201);
  });

  it('should not apply the creation limit to the other routes of the PEI', async () => {
    for (let attempt = 0; attempt <= LIMIT; attempt++) {
      await createAs(1);
    }

    const server = app.getHttpServer();
    const asUser = { 'x-session-user': '1' };

    const list = await request(server)
      .get(`/pei-entries/${STUDENT_EMAIL}`)
      .set(asUser);
    const edit = await request(server)
      .patch('/pei-entries/31')
      .set(asUser)
      .send({ general_notes: 'Novas observações' });
    const remove = await request(server).delete('/pei-entries/31').set(asUser);

    expect(list.status).toBe(200);
    expect(edit.status).toBe(200);
    expect(remove.status).toBe(200);
  });
});
