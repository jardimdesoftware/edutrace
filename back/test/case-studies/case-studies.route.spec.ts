import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { CaseStudiesController } from 'src/case-studies/case-studies.controller';
import { CaseStudiesService } from 'src/case-studies/case-studies.service';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { StudentsService } from 'src/students/students.service';
import {
  BODY_LIMIT_BYTES,
  SECTION_KEYS,
  STUDENT_EMAIL,
  blankSections,
  byteLengthOf,
  maxBody,
  setAt,
  validBody,
  validSections,
} from './case-study.fixtures';

const SUB = 7;
const STUDENT_ID = 2;

const STORED = {
  ...validSections(),
  author: { id: SUB, full_name: 'Profissional NAPNE' },
  student: { full_name: 'Estudante', course: 'Informática' },
  created_at: '2026-10-17T10:00:00.000Z',
  updated_at: '2026-10-17T10:00:00.000Z',
};

const READERS = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
] as const;

const NOT_NAPNE = [
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

// Monta o controller e o service de verdade, com o AuthGuard e o
// ValidationPipe reais e o body parser do Express no limite padrão de 100 kb.
// O que o teste isola é o banco: o Prisma e o StudentsService são mocks.
describe('estudo de caso, rotas de /case-studies', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let sessionEmail: string;
  let prisma: {
    caseStudy: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let studentsService: { findOneOrFail: jest.Mock };

  beforeEach(async () => {
    sessionLevel = LEVELS.PROFISSIONAL_NAPNE;
    sessionEmail = 'napne@example.com';
    prisma = {
      caseStudy: {
        create: jest.fn().mockResolvedValue(STORED),
        findUnique: jest.fn().mockResolvedValue(STORED),
        update: jest.fn().mockResolvedValue(STORED),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    studentsService = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: STUDENT_ID, email: STUDENT_EMAIL }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseStudiesController],
      providers: [
        CaseStudiesService,
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

  const post = (body: object) => call('post', '/case-studies').send(body);
  const get = (email = STUDENT_EMAIL) => call('get', `/case-studies/${email}`);
  const patch = (body: object, email = STUDENT_EMAIL) =>
    call('patch', `/case-studies/${email}`).send(body);
  const del = (email = STUDENT_EMAIL) =>
    call('delete', `/case-studies/${email}`);

  describe('POST /case-studies', () => {
    it('should answer 201 to the NAPNE and record the session as the author', async () => {
      const response = await post(validBody());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(STORED);
      expect(prisma.caseStudy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_student: STUDENT_ID,
            id_author: SUB,
          }),
        }),
      );
    });

    it.each(NOT_NAPNE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await post(validBody());

      expect(response.status).toBe(403);
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
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
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    it('should answer 409 for the second case study of the student', async () => {
      prisma.caseStudy.create.mockRejectedValue(uniqueViolation());

      const response = await post(validBody());

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        'Este estudante já tem um estudo de caso.',
      );
    });

    it('should answer 400 for a text above the maximum length and name the field', async () => {
      const body = setAt(validBody(), 'aee_opinion.opinion', 'a'.repeat(4001));

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'aee_opinion.opinion deve ter no máximo 4000 caracteres.',
      ]);
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a column of the model', { ...validBody(), id_author: 1 }],
      ['a field outside the contract', { ...validBody(), extra: true }],
      ['no sections', { student_email: STUDENT_EMAIL }],
      ['an empty body', {}],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    // O body parser do Express recusa acima de 100 kb. A soma dos limites dos
    // campos precisa caber nele, ou o estudo de caso preenchido até o limite
    // nunca seria aceito.
    it('should accept, through the real body parser, the body with every text at its limit', async () => {
      const body = maxBody();
      expect(byteLengthOf(body)).toBeLessThan(BODY_LIMIT_BYTES);

      const response = await post(body);

      expect(response.status).toBe(201);
    });

    it('should accept the blank form: empty texts, and no age nor dates', async () => {
      const response = await post({
        student_email: STUDENT_EMAIL,
        ...blankSections(),
      });

      expect(response.status).toBe(201);
    });

    it('should answer 413 above 100 kb, which proves the parser limit is the default one', async () => {
      const response = await post(
        setAt(validBody(), 'barriers', 'a'.repeat(BODY_LIMIT_BYTES)),
      );

      expect(response.status).toBe(413);
    });
  });

  describe('GET /case-studies/:email', () => {
    it('should answer with the name and the course of the student, and nothing else of him', async () => {
      const response = await get();

      expect(response.body.student).toEqual({
        full_name: 'Estudante',
        course: 'Informática',
      });
      const { select } = prisma.caseStudy.findUnique.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(select.student).toEqual({
        select: { full_name: true, course: true },
      });
    });

    it.each(READERS)(
      'should answer 200 to the %s reading any student',
      async (_, level) => {
        sessionLevel = level;

        const response = await get();

        expect(response.status).toBe(200);
        expect(response.body).toEqual(STORED);
      },
    );

    it('should answer 200 to the student that reads his own case study', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;
      sessionEmail = STUDENT_EMAIL;

      const response = await get();

      expect(response.status).toBe(200);
      expect(response.body).toEqual(STORED);
    });

    it('should answer 403 to the student that reads the case study of another student', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;
      sessionEmail = STUDENT_EMAIL;

      const response = await get('outro.estudante@example.com');

      expect(response.status).toBe(403);
      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
    });

    it('should answer 404 when the student has no case study', async () => {
      prisma.caseStudy.findUnique.mockResolvedValue(null);

      const response = await get();

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /case-studies/:email', () => {
    it('should answer 200 to the NAPNE with the sections that were sent', async () => {
      const response = await patch({ barriers: 'Novas barreiras' });

      expect(response.status).toBe(200);
      expect(prisma.caseStudy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_student: STUDENT_ID },
          data: expect.objectContaining({ barriers: 'Novas barreiras' }),
        }),
      );
    });

    it('should accept the ten complete sections, as the form sends them', async () => {
      const response = await patch(validSections());

      expect(response.status).toBe(200);
      const { data } = prisma.caseStudy.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(Object.keys(data).sort()).toEqual([...SECTION_KEYS].sort());
    });

    it('should accept the ten blank sections, as the form sends them', async () => {
      const response = await patch(blankSections());

      expect(response.status).toBe(200);
    });

    it('should let any NAPNE edit, whoever wrote the case study', async () => {
      sessionEmail = 'outro.napne@example.com';

      const response = await patch({ barriers: 'Novas barreiras' });

      expect(response.status).toBe(200);
    });

    it.each(NOT_NAPNE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await patch({ barriers: 'Novas barreiras' });

      expect(response.status).toBe(403);
      expect(prisma.caseStudy.update).not.toHaveBeenCalled();
    });

    it.each([
      ['a text above the maximum length', { barriers: 'a'.repeat(2001) }],
      ['a null section', { identification: null }],
      ['an incomplete section', { identification: { age: 17 } }],
      ['the author in the body', { id_author: 1 }],
      ['the e-mail of the student in the body', { student_email: 'a@b.co' }],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await patch(body);

      expect(response.status).toBe(400);
      expect(prisma.caseStudy.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /case-studies/:email', () => {
    it('should answer 200 to the NAPNE', async () => {
      const response = await del();

      expect(response.status).toBe(200);
      expect(prisma.caseStudy.deleteMany).toHaveBeenCalledWith({
        where: { student: { email: STUDENT_EMAIL } },
      });
    });

    it.each(NOT_NAPNE)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await del();

      expect(response.status).toBe(403);
      expect(prisma.caseStudy.deleteMany).not.toHaveBeenCalled();
    });

    it('should answer 404 when there is no case study', async () => {
      prisma.caseStudy.deleteMany.mockResolvedValue({ count: 0 });

      const response = await del();

      expect(response.status).toBe(404);
    });
  });
});
