import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { LEVELS } from 'src/constants';
import { SessionsService } from 'src/sessions/sessions.service';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';

const SUB = 7;

const STATS = {
  totals: { WAITING: 2, IN_SERVICE: 1, CLOSED: 0 },
  professionals: [
    { id: 10, full_name: 'Ana', in_service: 1, capacity: 3, free: 2 },
  ],
  queue: { size: 2, oldest_queued_at: '2026-10-01T09:30:00.000Z' },
};

// O GET /students/:email atende qualquer e-mail, inclusive "service-stats". Se
// a rota nova for declarada depois dele, o Nest entrega a requisição ao
// findOne, que responde 200 com corpo vazio ao Profissional de Educação e de
// Saúde e esconde a estatística de quem a pediu. Por isso o teste monta o
// controller de verdade, com o AuthGuard real, e olha qual handler foi chamado.
describe('GET /students/service-stats', () => {
  let app: INestApplication;
  let sessionLevel: number | readonly number[];
  let studentsService: { findAll: jest.Mock; findOne: jest.Mock };
  let statsService: { getStats: jest.Mock };

  beforeEach(async () => {
    sessionLevel = LEVELS.ADMIN;
    studentsService = {
      findAll: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
    };
    statsService = { getStats: jest.fn().mockResolvedValue(STATS) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: StudentsService, useValue: studentsService },
        { provide: ServiceQueueService, useValue: {} },
        { provide: ServiceStatsService, useValue: statsService },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({ sub: SUB, jti: 'jti' }),
          },
        },
        {
          // O AuthGuard lê o nível do banco, e não do token: o mock devolve o
          // nível que o teste definiu.
          provide: SessionsService,
          useValue: {
            findActive: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id_user: SUB,
                user: { roles: [sessionLevel].flat() },
              }),
            ),
            registerUse: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer token');

  it.each([
    ['Administrador', LEVELS.ADMIN],
    ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
    [
      'NAPNE com Professor do AEE',
      [LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE],
    ],
  ])(
    'should answer 200 with the statistics to the %s, through the stats handler',
    async (_, level) => {
      sessionLevel = level;

      const response = await get('/students/service-stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(STATS);
      expect(statsService.getStats).toHaveBeenCalledTimes(1);
    },
  );

  it('should not handle service-stats as GET /students/:email', async () => {
    await get('/students/service-stats');

    expect(studentsService.findOne).not.toHaveBeenCalled();
  });

  it.each([
    ['Profissional de Educação', LEVELS.PROFISSIONAL_EDUCACAO],
    ['Profissional de Saúde', LEVELS.PROFISSIONAL_SAUDE],
    ['Professor do AEE', LEVELS.PROFESSOR_AEE],
    [
      'Educação com Professor do AEE',
      [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE],
    ],
    ['Estudante', LEVELS.ALUNO_ESTUDANTE],
  ])('should answer 403 to the %s', async (_, level) => {
    sessionLevel = level;

    const response = await get('/students/service-stats');

    expect(response.status).toBe(403);
    expect(statsService.getStats).not.toHaveBeenCalled();
    expect(studentsService.findOne).not.toHaveBeenCalled();
  });

  it('should keep GET /students/:email answering a real e-mail', async () => {
    studentsService.findOne.mockResolvedValue({
      id: 2,
      email: 'estudante@example.com',
      cpf: '12345678910',
    });

    const response = await get('/students/estudante@example.com');

    expect(response.status).toBe(200);
    expect(studentsService.findOne).toHaveBeenCalledWith(
      'estudante@example.com',
      [LEVELS.ADMIN],
    );
    expect(statsService.getStats).not.toHaveBeenCalled();
  });
});
