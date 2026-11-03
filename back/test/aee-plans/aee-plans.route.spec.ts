import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AeePlansController } from 'src/aee-plans/aee-plans.controller';
import { AeePlansService } from 'src/aee-plans/aee-plans.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { StudentsService } from 'src/students/students.service';
import {
  BODY_LIMIT_BYTES,
  SECTION_KEYS,
  SEMESTER,
  STUDENT_EMAIL,
  blankSections,
  byteLengthOf,
  maxBody,
  setAt,
  validBody,
  validSections,
} from './aee-plan.fixtures';

const SUB = 7;
const STUDENT_ID = 2;
const PLAN_ID = 31;

const STORED = {
  id: PLAN_ID,
  semester: SEMESTER,
  ...validSections(),
  author: { id: SUB, full_name: 'Professor do AEE' },
  student: { full_name: 'Estudante', course: 'Informática' },
  created_at: '2026-10-17T10:00:00.000Z',
  updated_at: '2026-10-17T10:00:00.000Z',
};

const READERS = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
  ['Professor do AEE', LEVELS.PROFESSOR_AEE],
] as const;

const NOT_AEE = [
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
  ['Administrador', LEVELS.ADMIN],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
] as const;

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
  });
}

function recordNotFound() {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '7.10.0',
  });
}

// Valores que o ValidationPipe global converte com o + antes de qualquer pipe do
// parâmetro (1e3 vira 1000, 0x10 vira 16, %2016 chega como " 16" e vira 16), e
// os que o ParseIntPipe deixaria passar (-1, 0, 01). Só o inteiro positivo
// escrito por inteiro, sem zero à esquerda, é um id.
const INVALID_IDS = [
  'abc',
  '1.5',
  '12abc',
  '1e3',
  '0x10',
  '0b10000',
  '0o20',
  '%2016',
  '+16',
  '16.0',
  '-1',
  '0',
  '01',
  '2147483648',
  '99999999999',
];

// Monta o controller e o service de verdade, com o AuthGuard e o
// ValidationPipe reais e o body parser do Express no limite padrão de 100 kb.
// O que o teste isola é o banco: o Prisma e o StudentsService são mocks.
describe('PAEE, rotas de /aee-plans', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let sessionEmail: string;
  let prisma: {
    aeePlan: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let studentsService: { findOneOrFail: jest.Mock };

  beforeEach(async () => {
    sessionLevel = LEVELS.PROFESSOR_AEE;
    sessionEmail = 'professor.aee@example.com';
    prisma = {
      aeePlan: {
        create: jest.fn().mockResolvedValue(STORED),
        findMany: jest.fn().mockResolvedValue([STORED]),
        update: jest.fn().mockResolvedValue(STORED),
        delete: jest.fn().mockResolvedValue({ id: PLAN_ID }),
      },
    };
    studentsService = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: STUDENT_ID, email: STUDENT_EMAIL }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AeePlansController],
      providers: [
        AeePlansService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: PrismaService, useValue: prisma },
        { provide: StudentsService, useValue: studentsService },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockImplementation(() =>
              Promise.resolve({
                sub: SUB,
                jti: 'jti',
                email: sessionEmail,
                name: 'Quem pede',
              }),
            ),
          },
        },
        {
          // O AuthGuard lê o nível do banco, e não do token.
          provide: SessionsService,
          useValue: {
            findActive: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id_user: SUB,
                user: { roles: [sessionLevel] },
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

  const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer token');

  const post = (body: object) => call('post', '/aee-plans').send(body);
  const get = (email = STUDENT_EMAIL) => call('get', `/aee-plans/${email}`);
  const patch = (body: object, id: number | string = PLAN_ID) =>
    call('patch', `/aee-plans/${id}`).send(body);
  const del = (id: number | string = PLAN_ID) =>
    call('delete', `/aee-plans/${id}`);

  describe('POST /aee-plans', () => {
    it('should answer 201 to the AEE teacher and record the session as the author', async () => {
      const response = await post(validBody());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(STORED);
      expect(prisma.aeePlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_student: STUDENT_ID,
            id_author: SUB,
            semester: SEMESTER,
          }),
        }),
      );
    });

    it.each(NOT_AEE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await post(validBody());

      expect(response.status).toBe(403);
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
      expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
    });

    it('should answer 403 before validating the body of a level that is not allowed', async () => {
      sessionLevel = LEVELS.PROFISSIONAL_SAUDE;

      const response = await post({ student_email: 'invalido' });

      expect(response.status).toBe(403);
    });

    it('should answer 404 when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      const response = await post(validBody());

      expect(response.status).toBe(404);
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
    });

    it('should answer 409 for the second plan of the student in the semester', async () => {
      prisma.aeePlan.create.mockRejectedValue(uniqueViolation());

      const response = await post(validBody());

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        'Este estudante já tem um PAEE neste período letivo.',
      );
    });

    it('should answer 400 for a text above the maximum length and name the field', async () => {
      const body = setAt(validBody(), 'basis', 'a'.repeat(4001));

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'basis deve ter no máximo 4000 caracteres.',
      ]);
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for a semester out of the AAAA.S format and name the field', async () => {
      const response = await post(setAt(validBody(), 'semester', '2026.3'));

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        expect.stringContaining('semester'),
      ]);
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
    });

    it.each(SECTION_KEYS)('should answer 400 for null in %s', async (key) => {
      const response = await post(setAt(validBody(), key, null));

      expect(response.status).toBe(400);
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a column of the model', { ...validBody(), id_author: 1 }],
      ['a field outside the contract', { ...validBody(), extra: true }],
      ['no sections', { student_email: STUDENT_EMAIL, semester: SEMESTER }],
      ['no semester', (({ semester: _s, ...rest }) => rest)(validBody())],
      ['an empty body', {}],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
    });

    // O body parser do Express recusa acima de 100 kb. A soma dos limites dos
    // campos precisa caber nele, ou o PAEE preenchido até o limite nunca seria
    // aceito.
    it('should accept, through the real body parser, the body with every text at its limit', async () => {
      const body = maxBody();
      expect(byteLengthOf(body)).toBeLessThan(BODY_LIMIT_BYTES);

      const response = await post(body);

      expect(response.status).toBe(201);
    });

    it('should accept the blank form: empty texts, and no weekly hours', async () => {
      const response = await post({
        student_email: STUDENT_EMAIL,
        semester: SEMESTER,
        ...blankSections(),
      });

      expect(response.status).toBe(201);
    });

    it('should answer 413 above 100 kb, which proves the parser limit is the default one', async () => {
      const response = await post(
        setAt(validBody(), 'basis', 'a'.repeat(BODY_LIMIT_BYTES)),
      );

      expect(response.status).toBe(413);
    });
  });

  describe('GET /aee-plans/:email', () => {
    it('should answer with the name and the course of the student, and nothing else of him', async () => {
      const response = await get();

      expect(response.body[0].student).toEqual({
        full_name: 'Estudante',
        course: 'Informática',
      });
      const { select } = prisma.aeePlan.findMany.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(select.student).toEqual({
        select: { full_name: true, course: true },
      });
      expect(select.author).toEqual({
        select: { id: true, full_name: true },
      });
    });

    it.each(READERS)(
      'should answer 200 to the %s reading any student',
      async (_, level) => {
        sessionLevel = level;

        const response = await get();

        expect(response.status).toBe(200);
        expect(response.body).toEqual([STORED]);
      },
    );

    it('should answer 200 to the student that reads his own plans', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;
      sessionEmail = STUDENT_EMAIL;

      const response = await get();

      expect(response.status).toBe(200);
      expect(response.body).toEqual([STORED]);
    });

    it('should answer 403 to the student that reads the plans of another student', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;
      sessionEmail = STUDENT_EMAIL;

      const response = await get('outro.estudante@example.com');

      expect(response.status).toBe(403);
      expect(prisma.aeePlan.findMany).not.toHaveBeenCalled();
    });

    it('should answer 200 with an empty list when the student has no plan', async () => {
      prisma.aeePlan.findMany.mockResolvedValue([]);

      const response = await get();

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should answer 404 when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      const response = await get('prof@example.com');

      expect(response.status).toBe(404);
      expect(prisma.aeePlan.findMany).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /aee-plans/:id', () => {
    it('should answer 200 to the AEE teacher with the sections that were sent', async () => {
      const response = await patch({ basis: 'Novo embasamento' });

      expect(response.status).toBe(200);
      expect(prisma.aeePlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PLAN_ID },
          data: { basis: 'Novo embasamento' },
        }),
      );
    });

    it('should accept the seven complete sections, as the form sends them', async () => {
      const response = await patch(validSections());

      expect(response.status).toBe(200);
      const { data } = prisma.aeePlan.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(Object.keys(data).sort()).toEqual([...SECTION_KEYS].sort());
    });

    it('should accept the seven blank sections, as the form sends them', async () => {
      const response = await patch(blankSections());

      expect(response.status).toBe(200);
    });

    it('should let any AEE teacher edit, whoever wrote the plan', async () => {
      sessionEmail = 'outro.aee@example.com';

      const response = await patch({ basis: 'Novo embasamento' });

      expect(response.status).toBe(200);
    });

    it.each(NOT_AEE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await patch({ basis: 'Novo embasamento' });

      expect(response.status).toBe(403);
      expect(prisma.aeePlan.update).not.toHaveBeenCalled();
    });

    it('should answer 404 when the plan does not exist', async () => {
      prisma.aeePlan.update.mockRejectedValue(recordNotFound());

      const response = await patch({ basis: 'Novo embasamento' }, 9999);

      expect(response.status).toBe(404);
    });

    it.each(INVALID_IDS)(
      'should answer 400 for the id %s, without querying',
      async (id) => {
        const response = await patch({ basis: 'Novo embasamento' }, id);

        expect(response.status).toBe(400);
        expect(prisma.aeePlan.update).not.toHaveBeenCalled();
      },
    );

    it('should edit the plan of the id that came in the path, and not another one', async () => {
      const response = await patch({ basis: 'Novo embasamento' }, 16);

      expect(response.status).toBe(200);
      expect(prisma.aeePlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 16 } }),
      );
    });

    it('should accept the largest INTEGER of PostgreSQL as the id', async () => {
      const response = await patch({ basis: 'Novo embasamento' }, 2147483647);

      expect(response.status).toBe(200);
      expect(prisma.aeePlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 2147483647 } }),
      );
    });

    it.each([
      ['a text above the maximum length', { basis: 'a'.repeat(4001) }],
      ['a null section', { identification: null }],
      ['an incomplete section', { objectives: { general: 'x' } }],
      ['the semester in the body', { semester: '2027.1' }],
      ['the author in the body', { id_author: 1 }],
      ['the e-mail of the student in the body', { student_email: 'a@b.co' }],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await patch(body);

      expect(response.status).toBe(400);
      expect(prisma.aeePlan.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /aee-plans/:id', () => {
    it('should answer 200 to the AEE teacher', async () => {
      const response = await del();

      expect(response.status).toBe(200);
      expect(prisma.aeePlan.delete).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        select: { id: true },
      });
    });

    it.each(NOT_AEE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await del();

      expect(response.status).toBe(403);
      expect(prisma.aeePlan.delete).not.toHaveBeenCalled();
    });

    it('should answer 404 when there is no plan', async () => {
      prisma.aeePlan.delete.mockRejectedValue(recordNotFound());

      const response = await del(9999);

      expect(response.status).toBe(404);
    });

    it.each(INVALID_IDS)(
      'should answer 400 for the id %s, without querying',
      async (id) => {
        const response = await del(id);

        expect(response.status).toBe(400);
        expect(prisma.aeePlan.delete).not.toHaveBeenCalled();
      },
    );

    it('should delete the plan of the id that came in the path, and not another one', async () => {
      const response = await del(16);

      expect(response.status).toBe(200);
      expect(prisma.aeePlan.delete).toHaveBeenCalledWith({
        where: { id: 16 },
        select: { id: true },
      });
    });
  });
});
