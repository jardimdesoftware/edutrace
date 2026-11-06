import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AeeReferralsController } from 'src/aee-referrals/aee-referrals.controller';
import { AeeReferralsService } from 'src/aee-referrals/aee-referrals.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { SessionsService } from 'src/sessions/sessions.service';

const SUB = 5;

const NOT_NAPNE = [
  ['Administrador', LEVELS.ADMIN],
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Professor do AEE', LEVELS.PROFESSOR_AEE],
] as const;

const NOT_AEE = [
  ['Administrador', LEVELS.ADMIN],
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
] as const;

// Monta o controller de verdade, com o AuthGuard real e o ValidationPipe
// global, para provar o nível que cada rota aceita e o que o corpo precisa ter.
describe('encaminhamento ao AEE, rotas de /aee-referrals', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let service: {
    refer: jest.Mock;
    pending: jest.Mock;
    markSeen: jest.Mock;
  };

  beforeEach(async () => {
    sessionLevel = LEVELS.PROFISSIONAL_NAPNE;
    service = {
      refer: jest.fn().mockResolvedValue({ teacher: { id: 31 } }),
      pending: jest.fn().mockResolvedValue([]),
      markSeen: jest.fn().mockResolvedValue({ marked: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AeeReferralsController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: AeeReferralsService, useValue: service },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({
              sub: SUB,
              jti: 'sessao',
              name: 'Ana NAPNE',
            }),
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
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const refer = (body: object) =>
    request(app.getHttpServer())
      .post('/aee-referrals')
      .set('Authorization', 'Bearer token')
      .send(body);

  const GOOD = { student_email: 'aluno@discente.ifpe.edu.br', teacher_id: 31 };

  describe('POST /aee-referrals', () => {
    it('should refer with the name and the id of the session as the author', async () => {
      const response = await refer(GOOD);

      expect(response.status).toBe(201);
      expect(service.refer).toHaveBeenCalledWith(
        'aluno@discente.ifpe.edu.br',
        31,
        { sub: SUB, name: 'Ana NAPNE' },
      );
    });

    it('should refuse, with 400, an author that comes in the body', async () => {
      const response = await refer({
        ...GOOD,
        id_from: 99,
        from_name: 'Outra pessoa',
      });

      expect(response.status).toBe(400);
      expect(service.refer).not.toHaveBeenCalled();
    });

    it.each(NOT_NAPNE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await refer(GOOD);

      expect(response.status).toBe(403);
      expect(service.refer).not.toHaveBeenCalled();
    });

    it.each([
      ['no e-mail', { teacher_id: 31 }],
      ['an invalid e-mail', { ...GOOD, student_email: 'isso' }],
      ['no teacher', { student_email: GOOD.student_email }],
      ['a teacher that is a text', { ...GOOD, teacher_id: '31' }],
      ['a teacher that is zero', { ...GOOD, teacher_id: 0 }],
      ['a teacher that is a fraction', { ...GOOD, teacher_id: 1.5 }],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await refer(body);

      expect(response.status).toBe(400);
      expect(service.refer).not.toHaveBeenCalled();
    });
  });

  describe('GET /aee-referrals/notifications', () => {
    const list = () =>
      request(app.getHttpServer())
        .get('/aee-referrals/notifications')
        .set('Authorization', 'Bearer token');

    it('should list the notices of the teacher of the session', async () => {
      sessionLevel = LEVELS.PROFESSOR_AEE;

      const response = await list();

      expect(response.status).toBe(200);
      expect(service.pending).toHaveBeenCalledWith(SUB);
    });

    it.each(NOT_AEE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await list();

      expect(response.status).toBe(403);
      expect(service.pending).not.toHaveBeenCalled();
    });
  });

  describe('POST /aee-referrals/notifications/seen', () => {
    const seen = (body?: object) =>
      request(app.getHttpServer())
        .post('/aee-referrals/notifications/seen')
        .set('Authorization', 'Bearer token')
        .send(body);

    it('should mark the notices of the teacher of the session as seen', async () => {
      sessionLevel = LEVELS.PROFESSOR_AEE;

      const response = await seen({ ids: [3, 4] });

      expect(response.status).toBe(200);
      expect(service.markSeen).toHaveBeenCalledWith(SUB, [3, 4]);
    });

    it('should mark every pending notice when no ids come', async () => {
      sessionLevel = LEVELS.PROFESSOR_AEE;

      await seen({});

      expect(service.markSeen).toHaveBeenCalledWith(SUB, undefined);
    });

    it.each([
      ['ids that are not a list', { ids: 3 }],
      ['ids with a text', { ids: [1, 'a'] }],
      ['ids with zero', { ids: [0] }],
      [
        'more than 100 ids',
        { ids: Array.from({ length: 101 }, (_, i) => i + 1) },
      ],
    ])('should answer 400 for %s', async (_, body) => {
      sessionLevel = LEVELS.PROFESSOR_AEE;

      const response = await seen(body);

      expect(response.status).toBe(400);
      expect(service.markSeen).not.toHaveBeenCalled();
    });

    it.each(NOT_AEE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await seen({});

      expect(response.status).toBe(403);
      expect(service.markSeen).not.toHaveBeenCalled();
    });
  });
});
