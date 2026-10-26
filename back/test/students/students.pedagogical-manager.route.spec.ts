import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { SessionsService } from 'src/sessions/sessions.service';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';

const SUB = 7;

const OPTIONS = [
  { id: 4, full_name: 'Ana', roles: [LEVELS.PROFISSIONAL_NAPNE] },
];

const STUDENT = {
  id: 2,
  email: 'estudante@example.com',
  cpf: '12345678910',
  pedagogical_manager: null,
  external_manager_name: 'Maria da Silva',
  external_manager_phone: '81999998888',
  external_manager_cpf: '01234567890',
};

const EXTERNAL_BODY = {
  kind: 'EXTERNAL',
  name: 'Maria da Silva',
  phone: '81999998888',
  cpf: '01234567890',
};

const NOT_ADMIN_OR_NAPNE = [
  ['Profissional de Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional de Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
] as const;

// O GET /students/:email atende qualquer e-mail, inclusive
// "pedagogical-manager-options". Declarada depois dele, a rota de opções seria
// tratada como o e-mail e responderia 200 com corpo vazio. O teste monta o
// controller de verdade, com o AuthGuard e o ValidationPipe reais, para conferir
// a rota, o 403 por nível e o 400 do corpo. O que cada nível enxerga do contato
// do responsável externo é coberto em students.manager-contact.route.spec.ts.
describe('responsável pedagógico, rotas de /students', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let studentsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    findPedagogicalManagerOptions: jest.Mock;
    setPedagogicalManager: jest.Mock;
  };

  beforeEach(async () => {
    sessionLevel = LEVELS.ADMIN;
    studentsService = {
      findAll: jest.fn().mockResolvedValue([STUDENT]),
      findOne: jest.fn().mockResolvedValue(STUDENT),
      findPedagogicalManagerOptions: jest.fn().mockResolvedValue(OPTIONS),
      setPedagogicalManager: jest.fn().mockResolvedValue(STUDENT),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: StudentsService, useValue: studentsService },
        { provide: ServiceQueueService, useValue: {} },
        { provide: ServiceStatsService, useValue: {} },
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
                user: { id_level: sessionLevel },
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

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer token');

  const patch = (body: object, email = 'estudante@example.com') =>
    request(app.getHttpServer())
      .patch(`/students/${email}/pedagogical-manager`)
      .set('Authorization', 'Bearer token')
      .send(body);

  describe('GET /students/pedagogical-manager-options', () => {
    it.each([
      ['Administrador', LEVELS.ADMIN],
      ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
    ])(
      'should answer 200 with the options to the %s, through the options handler',
      async (_, level) => {
        sessionLevel = level;

        const response = await get('/students/pedagogical-manager-options');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(OPTIONS);
        expect(studentsService.findOne).not.toHaveBeenCalled();
      },
    );

    it.each(NOT_ADMIN_OR_NAPNE)(
      'should answer 403 to the %s',
      async (_, level) => {
        sessionLevel = level;

        const response = await get('/students/pedagogical-manager-options');

        expect(response.status).toBe(403);
        expect(
          studentsService.findPedagogicalManagerOptions,
        ).not.toHaveBeenCalled();
        expect(studentsService.findOne).not.toHaveBeenCalled();
      },
    );

    it('should keep GET /students/:email answering a real e-mail', async () => {
      const response = await get('/students/estudante@example.com');

      expect(response.status).toBe(200);
      expect(studentsService.findOne).toHaveBeenCalledWith(
        'estudante@example.com',
        [LEVELS.ADMIN],
      );
      expect(
        studentsService.findPedagogicalManagerOptions,
      ).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /students/:email/pedagogical-manager', () => {
    it.each([
      ['Administrador', LEVELS.ADMIN],
      ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
    ])('should answer 200 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await patch(EXTERNAL_BODY);

      expect(response.status).toBe(200);
      expect(studentsService.setPedagogicalManager).toHaveBeenCalledWith(
        'estudante@example.com',
        expect.objectContaining(EXTERNAL_BODY),
        [level],
      );
    });

    it.each(NOT_ADMIN_OR_NAPNE)(
      'should answer 403 to the %s',
      async (_, level) => {
        sessionLevel = level;

        const response = await patch(EXTERNAL_BODY);

        expect(response.status).toBe(403);
        expect(studentsService.setPedagogicalManager).not.toHaveBeenCalled();
      },
    );

    it('should answer 403 before validating the body of a level that is not allowed', async () => {
      sessionLevel = LEVELS.PROFISSIONAL_SAUDE;

      const response = await patch({ kind: 'invalid' });

      expect(response.status).toBe(403);
    });

    it('should mask both cpfs in the response', async () => {
      const response = await patch(EXTERNAL_BODY);

      expect(response.body.cpf).toBe('***.456.789-**');
      expect(response.body.external_manager_cpf).toBe('***.345.678-**');
      expect(JSON.stringify(response.body)).not.toContain('01234567890');
    });

    it('should normalize the phone and the cpf before the service', async () => {
      await patch({
        ...EXTERNAL_BODY,
        phone: '(81) 99999-8888',
        cpf: '012.345.678-90',
      });

      expect(studentsService.setPedagogicalManager).toHaveBeenCalledWith(
        'estudante@example.com',
        expect.objectContaining({ phone: '81999998888', cpf: '01234567890' }),
        [LEVELS.ADMIN],
      );
    });

    it.each([
      [
        'SERVER with the fields of the external kind',
        { kind: 'SERVER', user_id: 3, name: 'Maria da Silva' },
      ],
      ['EXTERNAL with a user_id', { ...EXTERNAL_BODY, user_id: 3 }],
      ['NONE with a user_id', { kind: 'NONE', user_id: 3 }],
      [
        'both kinds in one body',
        { ...EXTERNAL_BODY, kind: 'SERVER', user_id: 3 },
      ],
      [
        'EXTERNAL with an invalid cpf',
        { ...EXTERNAL_BODY, cpf: '01234567891' },
      ],
      ['EXTERNAL with an empty name', { ...EXTERNAL_BODY, name: '   ' }],
      ['EXTERNAL with a short phone', { ...EXTERNAL_BODY, phone: '12345' }],
      ['an unknown kind', { kind: 'OTHER' }],
      ['no kind', { user_id: 3 }],
      ['a column of the model', { kind: 'NONE', pedagogical_manager_id: 3 }],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await patch(body);

      expect(response.status).toBe(400);
      expect(studentsService.setPedagogicalManager).not.toHaveBeenCalled();
    });

    it.each([{ kind: 'SERVER', user_id: 3 }, { kind: 'NONE' }])(
      'should accept %p',
      async (body) => {
        const response = await patch(body);

        expect(response.status).toBe(200);
        expect(studentsService.setPedagogicalManager).toHaveBeenCalledWith(
          'estudante@example.com',
          expect.objectContaining(body),
          [LEVELS.ADMIN],
        );
      },
    );
  });
});
