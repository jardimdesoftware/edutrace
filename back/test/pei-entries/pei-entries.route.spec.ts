import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { PeiEntriesController } from 'src/pei-entries/pei-entries.controller';
import { PeiEntriesService } from 'src/pei-entries/pei-entries.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { StudentsService } from 'src/students/students.service';
import {
  BODY_LIMIT_BYTES,
  CONTENT_KEYS,
  SEMESTER,
  STUDENT_EMAIL,
  SUBJECT,
  blankContent,
  byteLengthOf,
  maxBody,
  maxPairs,
  setAt,
  validBody,
  validContent,
  validPair,
} from './pei-entry.fixtures';

const SUB = 7;
const STUDENT_ID = 2;
const ENTRY_ID = 31;

const STORED = {
  id: ENTRY_ID,
  semester: SEMESTER,
  subject: SUBJECT,
  ...validContent(),
  created_at: '2026-10-17T10:00:00.000Z',
  updated_at: '2026-10-17T10:00:00.000Z',
  id_author: SUB,
  author: { full_name: 'Professora Ana' },
};

const READERS = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
] as const;

const NOT_EDUCATION = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
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
describe('PEI, rotas de /pei-entries', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let sessionEmail: string;
  let authorOfEntry: number | null;
  let prisma: {
    peiEntry: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    $queryRaw: jest.Mock;
    peiEntry: { count: jest.Mock; create: jest.Mock };
  };
  let studentsService: { findOneOrFail: jest.Mock; lockStudent: jest.Mock };

  beforeEach(async () => {
    sessionLevel = LEVELS.PROFISSIONAL_EDUCACAO;
    sessionEmail = 'professora@example.com';
    authorOfEntry = SUB;
    tx = {
      // A trava da linha do autor (FOR KEY SHARE) que o create pede antes da
      // trava do estudante.
      $queryRaw: jest.fn().mockResolvedValue([{ id: SUB }]),
      peiEntry: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(STORED),
      },
    };
    prisma = {
      peiEntry: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([STORED]),
        findFirst: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ id_author: authorOfEntry }),
          ),
        update: jest.fn().mockResolvedValue(STORED),
        delete: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };
    studentsService = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: STUDENT_ID, email: STUDENT_EMAIL }),
      lockStudent: jest.fn().mockResolvedValue({ id: STUDENT_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeiEntriesController],
      providers: [
        PeiEntriesService,
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

  const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer token');

  const post = (body: object) => call('post', '/pei-entries').send(body);
  const get = (email = STUDENT_EMAIL) => call('get', `/pei-entries/${email}`);
  const patch = (body: object, id: number | string = ENTRY_ID) =>
    call('patch', `/pei-entries/${id}`).send(body);
  const del = (id: number | string = ENTRY_ID) =>
    call('delete', `/pei-entries/${id}`);

  describe('POST /pei-entries', () => {
    it('should answer 201 to the Education professional and record the session as the author', async () => {
      const response = await post(validBody());

      expect(response.status).toBe(201);
      expect(response.body).toEqual(STORED);
      expect(tx.peiEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_student: STUDENT_ID,
            id_author: SUB,
            semester: SEMESTER,
            subject: SUBJECT,
          }),
        }),
      );
    });

    it.each(NOT_EDUCATION)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await post(validBody());

      expect(response.status).toBe(403);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
      expect(studentsService.lockStudent).not.toHaveBeenCalled();
    });

    it('should answer 403 before validating the body of a level that is not allowed', async () => {
      sessionLevel = LEVELS.PROFISSIONAL_SAUDE;

      const response = await post({ student_email: 'invalido' });

      expect(response.status).toBe(403);
    });

    it('should answer 404 when the account is not a student', async () => {
      studentsService.lockStudent.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      const response = await post(validBody());

      expect(response.status).toBe(404);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it('should answer 409 for the second active entry of the student in the semester and subject', async () => {
      tx.peiEntry.create.mockRejectedValue(uniqueViolation());

      const response = await post(validBody());

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        'Este estudante já tem um registro do PEI desta disciplina neste semestre.',
      );
    });

    it('should create through the transaction that locks the student, and never outside of it', async () => {
      const response = await post(validBody());

      expect(response.status).toBe(201);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(studentsService.lockStudent).toHaveBeenCalledWith(
        tx,
        STUDENT_EMAIL,
      );
      expect(tx.peiEntry.count).toHaveBeenCalledWith({
        where: { id_student: STUDENT_ID, deleted_at: null },
      });
      expect(prisma.peiEntry.create).not.toHaveBeenCalled();
    });

    it('should answer 201 when the student has 299 active entries', async () => {
      tx.peiEntry.count.mockResolvedValue(299);

      const response = await post(validBody());

      expect(response.status).toBe(201);
    });

    it.each([300, 301])(
      'should answer 409 when the student already has %i active entries',
      async (active) => {
        tx.peiEntry.count.mockResolvedValue(active);

        const response = await post(validBody());

        expect(response.status).toBe(409);
        expect(response.body.message).toBe(
          'Este estudante já tem o máximo de 300 registros do PEI ativos.',
        );
        expect(tx.peiEntry.create).not.toHaveBeenCalled();
      },
    );

    it('should answer 400 for a text above the maximum length and name the field', async () => {
      const body = setAt(validBody(), 'general_notes', 'a'.repeat(2001));

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'general_notes deve ter no máximo 2000 caracteres.',
      ]);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for a semester out of the AAAA.S format and name the field', async () => {
      const response = await post(setAt(validBody(), 'semester', '2026.3'));

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        expect.stringContaining('semester'),
      ]);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty subject', ''],
      ['a subject of only spaces', '   '],
      ['a subject with a line break', 'Mate\nmática'],
      ['a subject above 150 characters', 'a'.repeat(151)],
      ['a subject that is not a string', 7],
    ])('should answer 400 for %s', async (_, subject) => {
      const response = await post(setAt(validBody(), 'subject', subject));

      expect(response.status).toBe(400);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it.each(CONTENT_KEYS)('should answer 400 for null in %s', async (key) => {
      const response = await post(setAt(validBody(), key, null));

      expect(response.status).toBe(400);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for 21 pairs', async () => {
      const response = await post(
        setAt(validBody(), 'syllabus_adaptations', maxPairs(21)),
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'syllabus_adaptations deve ter no máximo 20 itens.',
      ]);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for a single pair in place of the list, and not 500', async () => {
      const response = await post(
        setAt(validBody(), 'syllabus_adaptations', validPair()),
      );

      expect(response.status).toBe(400);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a string', 'texto'],
      ['a number', 7],
      ['null', null],
    ])('should answer 400 for %s as an item of the list', async (_, item) => {
      const response = await post(
        setAt(validBody(), 'syllabus_adaptations', [item]),
      );

      expect(response.status).toBe(400);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    it.each([
      ['the author', { ...validBody(), id_author: 1 }],
      ['the student by id', { ...validBody(), id_student: 1 }],
      ['the logical deletion', { ...validBody(), deleted_at: null }],
      ['the id', { ...validBody(), id: 1 }],
      ['a field outside the contract', { ...validBody(), extra: true }],
      [
        'no content',
        { student_email: STUDENT_EMAIL, semester: SEMESTER, subject: SUBJECT },
      ],
      ['no semester', (({ semester: _s, ...rest }) => rest)(validBody())],
      ['no subject', (({ subject: _s, ...rest }) => rest)(validBody())],
      ['an empty body', {}],
    ])('should answer 400 for a body with %s', async (_, body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    // O body parser do Express recusa acima de 100 kb. A soma dos limites dos
    // campos, com a lista cheia, precisa caber nele, ou o registro preenchido
    // até o limite nunca seria aceito.
    it('should accept, through the real body parser, the body with every text at its limit and 20 pairs', async () => {
      const body = maxBody();
      expect(byteLengthOf(body)).toBeLessThan(BODY_LIMIT_BYTES);

      const response = await post(body);

      expect(response.status).toBe(201);
    });

    it('should accept the blank form: empty texts and no pairs', async () => {
      const response = await post({ ...validBody(), ...blankContent() });

      expect(response.status).toBe(201);
    });

    it('should answer 413 above 100 kb, which proves the parser limit is the default one', async () => {
      const response = await post(
        setAt(validBody(), 'general_notes', 'a'.repeat(BODY_LIMIT_BYTES)),
      );

      expect(response.status).toBe(413);
    });
  });

  describe('GET /pei-entries/:email', () => {
    it('should select the author by name only and nothing else of the users', async () => {
      const response = await get();

      expect(response.body[0].author).toEqual({ full_name: 'Professora Ana' });
      const { select, where } = prisma.peiEntry.findMany.mock.calls[0][0] as {
        select: Record<string, unknown>;
        where: unknown;
      };
      expect(select.author).toEqual({ select: { full_name: true } });
      expect(select).not.toHaveProperty('student');
      expect(select).not.toHaveProperty('deleted_at');
      expect(select).not.toHaveProperty('id_student');
      expect(where).toEqual({ id_student: STUDENT_ID, deleted_at: null });
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

    it('should answer 200 to the student that reads his own entries', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;
      sessionEmail = STUDENT_EMAIL;

      const response = await get();

      expect(response.status).toBe(200);
      expect(response.body).toEqual([STORED]);
    });

    it('should answer 403 to the student that reads the entries of another student, before querying', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;
      sessionEmail = STUDENT_EMAIL;

      const response = await get('outro.estudante@example.com');

      expect(response.status).toBe(403);
      expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
      expect(prisma.peiEntry.findMany).not.toHaveBeenCalled();
    });

    it('should answer 200 with an empty list when the student has no entry', async () => {
      prisma.peiEntry.findMany.mockResolvedValue([]);

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
      expect(prisma.peiEntry.findMany).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /pei-entries/:id', () => {
    it('should answer 200 to the author with the fields that were sent, among the active entries', async () => {
      const response = await patch({ general_notes: 'Novas observações' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(STORED);
      expect(prisma.peiEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENTRY_ID, deleted_at: null },
          data: { general_notes: 'Novas observações' },
        }),
      );
    });

    it('should accept the seven complete content fields, as the form sends them', async () => {
      const response = await patch(validContent());

      expect(response.status).toBe(200);
      const { data } = prisma.peiEntry.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(Object.keys(data).sort()).toEqual([...CONTENT_KEYS].sort());
    });

    it('should accept the seven blank fields, as the form sends them', async () => {
      const response = await patch(blankContent());

      expect(response.status).toBe(200);
    });

    it.each(NOT_EDUCATION)(
      'should answer 403 to the %s without reading the entry',
      async (_, level) => {
        sessionLevel = level;

        const response = await patch({ general_notes: 'Novas observações' });

        expect(response.status).toBe(403);
        expect(prisma.peiEntry.findFirst).not.toHaveBeenCalled();
        expect(prisma.peiEntry.update).not.toHaveBeenCalled();
      },
    );

    it('should answer 403 to another Education professional, who is not the author', async () => {
      authorOfEntry = SUB + 1;

      const response = await patch({ general_notes: 'Novas observações' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        'Você só pode alterar os registros do PEI que você mesmo criou',
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    // A exclusão do registro sem autor não abre a edição: ninguém o altera.
    it('should answer 403 to every Education professional when the author account was deleted, and not write', async () => {
      authorOfEntry = null;

      const response = await patch({ general_notes: 'Novas observações' });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        'Você só pode alterar os registros do PEI que você mesmo criou',
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 404, and not 403, when the entry does not exist or is deleted', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue(null);

      const response = await patch(
        { general_notes: 'Novas observações' },
        9999,
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Registro do PEI não encontrado');
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 404 when the entry is deleted between the lookup and the write', async () => {
      prisma.peiEntry.update.mockRejectedValue(recordNotFound());

      const response = await patch({ general_notes: 'Novas observações' });

      expect(response.status).toBe(404);
    });

    it.each(INVALID_IDS)(
      'should answer 400 for the id %s, without querying',
      async (id) => {
        const response = await patch(
          { general_notes: 'Novas observações' },
          id,
        );

        expect(response.status).toBe(400);
        expect(prisma.peiEntry.findFirst).not.toHaveBeenCalled();
        expect(prisma.peiEntry.update).not.toHaveBeenCalled();
      },
    );

    it('should edit the entry of the id that came in the path, and not another one', async () => {
      const response = await patch({ general_notes: 'Novas observações' }, 16);

      expect(response.status).toBe(200);
      expect(prisma.peiEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 16, deleted_at: null } }),
      );
      expect(prisma.peiEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 16, deleted_at: null } }),
      );
    });

    it('should accept the largest INTEGER of PostgreSQL as the id', async () => {
      const response = await patch(
        { general_notes: 'Novas observações' },
        2147483647,
      );

      expect(response.status).toBe(200);
      expect(prisma.peiEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2147483647, deleted_at: null },
        }),
      );
    });

    it.each([
      ['a text above the maximum length', { general_notes: 'a'.repeat(2001) }],
      ['a null field', { adapted_objectives: null }],
      ['a null list', { syllabus_adaptations: null }],
      ['21 pairs', { syllabus_adaptations: maxPairs(21) }],
      ['a pair that is a string', { syllabus_adaptations: ['texto'] }],
      [
        'a single pair in place of the list',
        { syllabus_adaptations: validPair() },
      ],
      ['the semester in the body', { semester: '2027.1' }],
      ['the subject in the body', { subject: 'Física' }],
      ['the author in the body', { id_author: 1 }],
      ['the student by id in the body', { id_student: 1 }],
      ['the logical deletion in the body', { deleted_at: null }],
      ['the e-mail of the student in the body', { student_email: 'a@b.co' }],
    ])('should answer 400 for %s', async (_, body) => {
      const response = await patch(body);

      expect(response.status).toBe(400);
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /pei-entries/:id', () => {
    it('should answer 200 to the author and mark the entry as deleted instead of deleting it', async () => {
      const response = await del();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: `Registro do PEI com id ${ENTRY_ID} foi removido com sucesso`,
      });
      expect(prisma.peiEntry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        data: { deleted_at: expect.any(Date) },
        select: { id: true },
      });
      expect(prisma.peiEntry.delete).not.toHaveBeenCalled();
    });

    it.each(NOT_EDUCATION)(
      'should answer 403 to the %s without reading the entry',
      async (_, level) => {
        sessionLevel = level;

        const response = await del();

        expect(response.status).toBe(403);
        expect(prisma.peiEntry.findFirst).not.toHaveBeenCalled();
        expect(prisma.peiEntry.update).not.toHaveBeenCalled();
      },
    );

    it('should answer 403 to another Education professional, who is not the author', async () => {
      authorOfEntry = SUB + 1;

      const response = await del();

      expect(response.status).toBe(403);
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    // O registro sem autor (a conta do autor foi excluída) não é de ninguém:
    // qualquer Profissional da Educação o exclui, e só os níveis que a rota
    // aceita chegam até aqui (os outros recebem 403 do guard, no teste acima).
    it('should answer 200 to any Education professional when the author account was deleted, and mark it as deleted', async () => {
      authorOfEntry = null;

      const response = await del();

      expect(response.status).toBe(200);
      expect(prisma.peiEntry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        data: { deleted_at: expect.any(Date) },
        select: { id: true },
      });
    });

    it.each(NOT_EDUCATION)(
      'should answer 403 to the %s even when the author account was deleted',
      async (_, level) => {
        authorOfEntry = null;
        sessionLevel = level;

        const response = await del();

        expect(response.status).toBe(403);
        expect(prisma.peiEntry.update).not.toHaveBeenCalled();
      },
    );

    it('should answer 404, and not 403, when there is no active entry', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue(null);

      const response = await del(9999);

      expect(response.status).toBe(404);
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it.each(INVALID_IDS)(
      'should answer 400 for the id %s, without querying',
      async (id) => {
        const response = await del(id);

        expect(response.status).toBe(400);
        expect(prisma.peiEntry.findFirst).not.toHaveBeenCalled();
        expect(prisma.peiEntry.update).not.toHaveBeenCalled();
      },
    );

    it('should delete the entry of the id that came in the path, and not another one', async () => {
      const response = await del(16);

      expect(response.status).toBe(200);
      expect(prisma.peiEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 16, deleted_at: null } }),
      );
    });
  });
});
