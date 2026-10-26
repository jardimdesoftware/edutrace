import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';

const SUB = 7;
const EMAIL = 'estudante@example.com';

const STUDENT_ROW: Record<string, unknown> = {
  id: 2,
  email: EMAIL,
  full_name: 'Estudante',
  cpf: '12345678910',
  password: 'hash-que-nunca-sai',
  roles: [LEVELS.ALUNO_ESTUDANTE],
  pedagogical_manager: null,
  external_manager_name: 'Maria da Silva',
  external_manager_phone: '81999998888',
  external_manager_cpf: '98765432100',
};

const EXTERNAL_BODY = {
  kind: 'EXTERNAL',
  name: 'Maria da Silva',
  phone: '81999998888',
  cpf: '98765432100',
};

const CONTACT_READERS = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
] as const;

const READ_ONLY_LEVELS = [
  ['Profissional de Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional de Saúde', LEVELS.PROFISSIONAL_SAUDE],
] as const;

// Devolve da linha só as colunas que o select pede, como o banco faz. É o que
// permite provar a resposta de cada rota: o telefone e o CPF do responsável
// externo só chegam ao corpo quando o select do serviço os pede.
function project(select: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(STUDENT_ROW).filter(([column]) => select[column]),
  );
}

// Monta o StudentsController e os dois services de verdade, sobre um Prisma que
// aplica o select. O AuthGuard também é o real. Assim, a resposta de cada rota
// de /students passa por todas as camadas que decidem o que o nível enxerga.
describe('contato do responsável externo, rotas de /students', () => {
  let app: INestApplication;
  let sessionLevel: number;

  beforeEach(async () => {
    sessionLevel = LEVELS.ADMIN;

    const user = {
      findMany: jest.fn(({ select }) => Promise.resolve([project(select)])),
      findFirst: jest.fn(({ select }) => Promise.resolve(project(select))),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(({ select }) => Promise.resolve(project(select))),
      count: jest.fn().mockResolvedValue(0),
    };
    const tx = {
      user,
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 2, roles: [3], service_capacity: 3 }]),
    };
    const prisma = {
      user,
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        StudentsService,
        ServiceQueueService,
        { provide: PrismaService, useValue: prisma },
        { provide: ServiceStatsService, useValue: {} },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({ sub: SUB, jti: 'jti' }),
          },
        },
        {
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

  const send = (
    method: 'get' | 'post' | 'patch',
    path: string,
    body?: object,
  ) => {
    const call = request(app.getHttpServer())[method](path);
    call.set('Authorization', 'Bearer token');
    return body ? call.send(body) : call;
  };

  const responses = {
    'GET /students': () => send('get', '/students'),
    'GET /students/:email': () => send('get', `/students/${EMAIL}`),
    'PATCH /students/:email/pedagogical-manager': () =>
      send('patch', `/students/${EMAIL}/pedagogical-manager`, EXTERNAL_BODY),
    'POST /students/:email/service/assume': () =>
      send('post', `/students/${EMAIL}/service/assume`),
    'POST /students/:email/service/close': () =>
      send('post', `/students/${EMAIL}/service/close`),
    'POST /students/:email/service/reopen': () =>
      send('post', `/students/${EMAIL}/service/reopen`),
  };

  const contactOf = (body: unknown) => (Array.isArray(body) ? body[0] : body);

  describe.each(CONTACT_READERS)('%s', (_, level) => {
    // O NAPNE é o único nível de assume, e o Administrador não o chama.
    const routes = Object.entries(responses).filter(
      ([route]) =>
        level === LEVELS.PROFISSIONAL_NAPNE ||
        route !== 'POST /students/:email/service/assume',
    );

    it.each(routes)(
      'should receive the phone and the masked cpf of the external manager in %s',
      async (_route, call) => {
        sessionLevel = level;

        const response = await call();
        const student = contactOf(response.body);

        expect(response.status).toBe(200);
        expect(student.external_manager_name).toBe('Maria da Silva');
        expect(student.external_manager_phone).toBe('81999998888');
        expect(student.external_manager_cpf).toBe('***.654.321-**');
        expect(student.cpf).toBe('***.456.789-**');
        expect(JSON.stringify(response.body)).not.toMatch(
          /98765432100|12345678910|hash-que-nunca-sai/,
        );
      },
    );
  });

  describe.each(READ_ONLY_LEVELS)('%s', (_, level) => {
    it.each([['GET /students'], ['GET /students/:email']] as const)(
      'should receive only the name of the external manager in %s',
      async (route) => {
        sessionLevel = level;

        const response = await responses[route]();
        const student = contactOf(response.body);

        expect(response.status).toBe(200);
        expect(student.external_manager_name).toBe('Maria da Silva');
        expect(student).not.toHaveProperty('external_manager_phone');
        expect(student).not.toHaveProperty('external_manager_cpf');
        expect(JSON.stringify(response.body)).not.toMatch(
          /81999998888|98765432100|654\.321|hash-que-nunca-sai/,
        );
      },
    );

    it.each([
      ['PATCH /students/:email/pedagogical-manager'],
      ['POST /students/:email/service/assume'],
      ['POST /students/:email/service/close'],
      ['POST /students/:email/service/reopen'],
    ] as const)('should answer 403, with no contact, in %s', async (route) => {
      sessionLevel = level;

      const response = await responses[route]();

      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toMatch(
        /external_manager_(phone|cpf)|81999998888|98765432100/,
      );
    });
  });

  describe('Estudante', () => {
    it.each(Object.entries(responses))(
      'should answer 403, with no contact, in %s',
      async (_route, call) => {
        sessionLevel = LEVELS.ALUNO_ESTUDANTE;

        const response = await call();

        expect(response.status).toBe(403);
        expect(JSON.stringify(response.body)).not.toMatch(
          /external_manager_(phone|cpf)|81999998888|98765432100/,
        );
      },
    );
  });
});
