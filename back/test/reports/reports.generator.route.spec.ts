import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { LEVELS } from 'src/constants';
import { ReportsController } from 'src/reports/reports.controller';
import { ReportsService } from 'src/reports/reports.service';
import { SessionsService } from 'src/sessions/sessions.service';

const SUB = 7;

const ALLOWED = [
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
  ['Professor do AEE', LEVELS.PROFESSOR_AEE],
] as const;

const DENIED = [
  ['Administrador', LEVELS.ADMIN],
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
] as const;

// Monta o controller de verdade, com o AuthGuard real, para provar que a rota
// vale para o usuário da sessão e que não é engolida por GET /reports/:email.
describe('GET /reports/generator', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let service: { generator: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    sessionLevel = LEVELS.PROFISSIONAL_NAPNE;
    service = {
      generator: jest
        .fn()
        .mockResolvedValue({ full_name: 'Ana NAPNE', cpf: '***.456.789-**' }),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: ReportsService, useValue: service },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest
              .fn()
              .mockResolvedValue({ sub: SUB, jti: 'sessao', name: 'Ana' }),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            findActive: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id_user: SUB,
                user: { roles: [sessionLevel], deleted_at: null },
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

  const get = () =>
    request(app.getHttpServer())
      .get('/reports/generator')
      .set('Authorization', 'Bearer token');

  it.each(ALLOWED)(
    'should answer the name and the masked CPF of the session user to the %s',
    async (_, level) => {
      sessionLevel = level;

      const response = await get();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        full_name: 'Ana NAPNE',
        cpf: '***.456.789-**',
      });
      expect(service.generator).toHaveBeenCalledWith(SUB);
      expect(service.findOne).not.toHaveBeenCalled();
    },
  );

  it.each(DENIED)('should answer 403 to the %s', async (_, level) => {
    sessionLevel = level;

    const response = await get();

    expect(response.status).toBe(403);
    expect(service.generator).not.toHaveBeenCalled();
  });

  it('should answer 401 without a token', async () => {
    const response = await request(app.getHttpServer()).get(
      '/reports/generator',
    );

    expect(response.status).toBe(401);
  });
});
