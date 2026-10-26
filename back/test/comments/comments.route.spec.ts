import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentType, Prisma } from '@prisma/client';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { CommentsController } from 'src/comments/comments.controller';
import { CommentsService } from 'src/comments/comments.service';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { StudentsService } from 'src/students/students.service';

const SUB = 5;
const STUDENT_ID = 10;

const NOTE = {
  id: 1,
  id_user: STUDENT_ID,
  id_author: SUB,
  author_name: 'Quem pede',
  comment: 'Observação importante',
  type: CommentType.NOTE,
  created_at: '2026-10-17T10:00:00.000Z',
  updated_at: null,
  deleted_at: null,
  edits: [],
};

const REPORT = {
  ...NOTE,
  id: 2,
  comment: 'Relatório do conselho',
  type: CommentType.CLASS_COUNCIL_REPORT,
};

const WRITERS = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
] as const;

const ACUTE = '\u0301';

const statementTimeout = () =>
  new Prisma.PrismaClientKnownRequestError(
    'Raw query failed. Code: `57014`. Message: `canceling statement due to statement timeout`',
    {
      code: 'P2010',
      clientVersion: '7.10.0',
      meta: {
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: { originalCode: '57014', code: '57014', kind: 'postgres' },
        },
      },
    },
  );

const transactionStartTimeout = () =>
  new Prisma.PrismaClientKnownRequestError(
    '\nInvalid `prisma.$transaction()` invocation:\n\nTransaction API error: Unable to start a transaction in the given time.',
    { code: 'P2028', clientVersion: '7.10.0', meta: {} },
  );

const tooLong = (limit: number) => [
  `O campo comment deve ter no máximo ${limit} caracteres.`,
];

// Monta o controller e o service de verdade, com o AuthGuard e o
// ValidationPipe reais e o body parser do Express no limite padrão de 100 kb.
// O que o teste isola é o banco: o Prisma e o StudentsService são mocks.
describe('anotações, rotas de /comments', () => {
  let app: INestApplication;
  let sessionSub: number;
  let sessionLevel: number;
  let stored: typeof NOTE | typeof REPORT;
  let prisma: {
    comments: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    commentEdits: { create: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    sessionSub = SUB;
    sessionLevel = LEVELS.PROFISSIONAL_SAUDE;
    stored = NOTE;
    prisma = {
      comments: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...NOTE, ...data }),
          ),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(stored)),
        findMany: jest.fn().mockResolvedValue([NOTE, REPORT]),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...stored, ...data }),
          ),
      },
      commentEdits: { create: jest.fn() },
      user: {
        findUnique: jest.fn(),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: SUB, roles: [LEVELS.PROFISSIONAL_SAUDE] },
          ]),
      },
      $queryRaw: jest.fn().mockImplementation((sql: { text: string }) => {
        if (sql.text.includes('count(*)')) {
          return Promise.resolve([{ overall: 2, total: 2 }]);
        }
        if (sql.text.includes('DISTINCT ON')) {
          return Promise.resolve([{ id: SUB, name: 'Quem pede' }]);
        }
        return Promise.resolve([{ id: 2 }, { id: 1 }]);
      }),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        CommentsService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: PrismaService, useValue: prisma },
        {
          provide: StudentsService,
          useValue: {
            findOneOrFail: jest.fn().mockResolvedValue({ id: STUDENT_ID }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendNewCommentNotice: jest.fn(),
            sendUpdatedCommentNotice: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockImplementation(() =>
              Promise.resolve({
                sub: sessionSub,
                jti: 'jti',
                email: 'quem.pede@example.com',
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
                id_user: sessionSub,
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

  const call = (method: 'get' | 'post' | 'patch', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer token');

  const post = (body: object) => call('post', '/comments').send(body);
  const patch = (body: object, id = 1) =>
    call('patch', `/comments/${id}`).send(body);

  describe('POST /comments', () => {
    it('should record a NOTE when the body has no type, and answer with the type', async () => {
      const response = await post({ id_user: STUDENT_ID, comment: 'Texto' });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe(CommentType.NOTE);
      expect(prisma.comments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: CommentType.NOTE,
            id_author: SUB,
          }),
        }),
      );
    });

    it('should record a report and answer with the type', async () => {
      const response = await post({
        id_user: STUDENT_ID,
        comment: 'Relatório',
        type: CommentType.CLASS_COUNCIL_REPORT,
      });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe(CommentType.CLASS_COUNCIL_REPORT);
    });

    it.each(WRITERS)('should answer 201 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await post({
        id_user: STUDENT_ID,
        comment: 'Relatório',
        type: CommentType.CLASS_COUNCIL_REPORT,
      });

      expect(response.status).toBe(201);
    });

    it('should answer 403 to the student, for a note and for a report', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;

      for (const type of Object.values(CommentType)) {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'a',
          type,
        });

        expect(response.status).toBe(403);
      }
      expect(prisma.comments.create).not.toHaveBeenCalled();
    });

    describe('limit by type', () => {
      it.each([
        ['a NOTE', { type: CommentType.NOTE }],
        ['the type absent', {}],
      ])('should accept 1000 characters in %s', async (_, typeField) => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'a'.repeat(1000),
          ...typeField,
        });

        expect(response.status).toBe(201);
      });

      it.each([
        ['a NOTE', { type: CommentType.NOTE }],
        ['the type absent', {}],
      ])('should answer 400 to 1001 characters in %s', async (_, typeField) => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'a'.repeat(1001),
          ...typeField,
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual(tooLong(1000));
        expect(prisma.comments.create).not.toHaveBeenCalled();
      });

      it('should accept 10000 characters in a report', async () => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'a'.repeat(10000),
          type: CommentType.CLASS_COUNCIL_REPORT,
        });

        expect(response.status).toBe(201);
      });

      it('should answer 400 to 10001 characters in a report', async () => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'a'.repeat(10001),
          type: CommentType.CLASS_COUNCIL_REPORT,
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual(tooLong(10000));
        expect(prisma.comments.create).not.toHaveBeenCalled();
      });

      // O body parser do Express recusa acima de 100 kb. O relatório no limite,
      // mesmo com três bytes por caractere, precisa caber nele.
      it('should accept, through the real body parser, a report at the limit with 3-byte characters', async () => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: '€'.repeat(10000),
          type: CommentType.CLASS_COUNCIL_REPORT,
        });

        expect(response.status).toBe(201);
      });
    });

    describe('control characters in the comment', () => {
      const message = [
        'O campo comment não pode ter caracteres de controle, exceto tabulação e quebra de linha.',
      ];

      it.each(Object.values(CommentType))(
        'should answer 400 to NUL, U+0085 and a lone surrogate in a %s',
        async (type) => {
          for (const comment of [
            'antes\u0000depois',
            'antes\u0085depois',
            'antes\uD800depois',
          ]) {
            const response = await post({ id_user: STUDENT_ID, comment, type });

            expect(response.status).toBe(400);
            expect(response.body.message).toEqual(message);
          }
          expect(prisma.comments.create).not.toHaveBeenCalled();
        },
      );

      it.each(Object.values(CommentType))(
        'should accept a tab and line breaks in a %s',
        async (type) => {
          const response = await post({
            id_user: STUDENT_ID,
            comment: 'coluna 1\tcoluna 2\nlinha 2\r\nlinha 3',
            type,
          });

          expect(response.status).toBe(201);
        },
      );
    });

    describe('combining marks in the comment', () => {
      const message = [
        'O campo comment não pode ter mais de 30 acentos ou marcas seguidos.',
      ];

      it.each(Object.values(CommentType))(
        'should accept 30 marks in a row in a %s',
        async (type) => {
          const response = await post({
            id_user: STUDENT_ID,
            comment: `a${ACUTE.repeat(30)}`,
            type,
          });

          expect(response.status).toBe(201);
        },
      );

      it.each(Object.values(CommentType))(
        'should answer 400 to 31 marks in a row in a %s, without recording it',
        async (type) => {
          const response = await post({
            id_user: STUDENT_ID,
            comment: `a${ACUTE.repeat(31)}`,
            type,
          });

          expect(response.status).toBe(400);
          expect(response.body.message).toEqual(message);
          expect(prisma.comments.create).not.toHaveBeenCalled();
        },
      );

      it('should answer 400 to the report of 10000 units with 4999 + 5000 marks that slows the search down', async () => {
        const comment = `a${ACUTE.repeat(4999)}${'\u0316'.repeat(5000)}`;

        const response = await post({
          id_user: STUDENT_ID,
          comment,
          type: CommentType.CLASS_COUNCIL_REPORT,
        });

        expect(comment).toHaveLength(10000);
        expect(response.status).toBe(400);
        expect(response.body.message).toEqual(message);
        expect(prisma.comments.create).not.toHaveBeenCalled();
      });

      it('should accept Portuguese text written in the decomposed form', async () => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'Ação e atenção, João'.normalize('NFD'),
        });

        expect(response.status).toBe(201);
      });
    });

    describe('type', () => {
      it.each([
        ['null', null],
        ['a value outside the enum', 'OTHER'],
        ['the name in lower case', 'note'],
        ['a number', 1],
      ])('should answer 400 to %s', async (_, type) => {
        const response = await post({
          id_user: STUDENT_ID,
          comment: 'a',
          type,
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual([
          'O campo type deve ser NOTE ou CLASS_COUNCIL_REPORT.',
        ]);
        expect(prisma.comments.create).not.toHaveBeenCalled();
      });
    });

    it('should answer 400 to a column of the model, like the author', async () => {
      const response = await post({
        id_user: STUDENT_ID,
        comment: 'a',
        id_author: 999,
      });

      expect(response.status).toBe(400);
      expect(prisma.comments.create).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /comments/:id', () => {
    it('should answer 200 to the author and return the type of the record', async () => {
      stored = REPORT;

      const response = await patch({ comment: 'Relatório corrigido' }, 2);

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(CommentType.CLASS_COUNCIL_REPORT);
    });

    it.each([
      ['the same type', CommentType.NOTE],
      ['the other type', CommentType.CLASS_COUNCIL_REPORT],
      ['null', null],
    ])('should answer 400 to %s in the body', async (_, type) => {
      const response = await patch({ comment: 'Texto', type });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['property type should not exist']);
      expect(prisma.comments.findUnique).not.toHaveBeenCalled();
      expect(prisma.comments.update).not.toHaveBeenCalled();
    });

    it('should answer 400 to 1001 characters in a NOTE, with the same body as the creation', async () => {
      const created = await post({
        id_user: STUDENT_ID,
        comment: 'a'.repeat(1001),
      });

      const response = await patch({ comment: 'a'.repeat(1001) });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(created.body);
      expect(response.body.message).toEqual(tooLong(1000));
      expect(prisma.comments.update).not.toHaveBeenCalled();
    });

    it('should accept 1000 characters in a NOTE', async () => {
      const response = await patch({ comment: 'a'.repeat(1000) });

      expect(response.status).toBe(200);
    });

    it('should accept 10000 characters in a report', async () => {
      stored = REPORT;

      const response = await patch({ comment: 'a'.repeat(10000) }, 2);

      expect(response.status).toBe(200);
    });

    it('should answer 400 to 10001 characters in a report, from the DTO', async () => {
      stored = REPORT;

      const response = await patch({ comment: 'a'.repeat(10001) }, 2);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(tooLong(10000));
      expect(prisma.comments.findUnique).not.toHaveBeenCalled();
    });

    describe('control characters in the comment', () => {
      it.each([
        ['NUL', 'antes\u0000depois'],
        ['U+0085', 'antes\u0085depois'],
        ['a lone surrogate', 'antes\uD800depois'],
      ])(
        'should answer 400 to %s, before reading the record',
        async (_, comment) => {
          const response = await patch({ comment });

          expect(response.status).toBe(400);
          expect(response.body.message).toEqual([
            'O campo comment não pode ter caracteres de controle, exceto tabulação e quebra de linha.',
          ]);
          expect(prisma.comments.findUnique).not.toHaveBeenCalled();
          expect(prisma.comments.update).not.toHaveBeenCalled();
        },
      );

      it('should accept a tab and line breaks', async () => {
        const response = await patch({
          comment: 'coluna 1\tcoluna 2\nlinha 2\r\nlinha 3',
        });

        expect(response.status).toBe(200);
      });
    });

    describe('combining marks in the comment', () => {
      it('should accept 30 marks in a row', async () => {
        const response = await patch({ comment: `a${ACUTE.repeat(30)}` });

        expect(response.status).toBe(200);
      });

      it.each([
        ['a NOTE', NOTE, 1],
        ['a report', REPORT, 2],
      ])(
        'should answer 400 to 31 marks in a row in %s, before reading the record',
        async (_, record, id) => {
          stored = record;

          const response = await patch({ comment: `a${ACUTE.repeat(31)}` }, id);

          expect(response.status).toBe(400);
          expect(response.body.message).toEqual([
            'O campo comment não pode ter mais de 30 acentos ou marcas seguidos.',
          ]);
          expect(prisma.comments.findUnique).not.toHaveBeenCalled();
          expect(prisma.comments.update).not.toHaveBeenCalled();
        },
      );
    });

    it('should answer 403 to a user who is not the author of the report', async () => {
      stored = REPORT;
      sessionSub = 77;

      const response = await patch({ comment: 'Relatório de outro' }, 2);

      expect(response.status).toBe(403);
      expect(prisma.comments.update).not.toHaveBeenCalled();
    });

    it('should answer 403 to the student', async () => {
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;

      const response = await patch({ comment: 'Texto' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /comments/:id_user', () => {
    const pageIdsCall = () =>
      prisma.$queryRaw.mock.calls
        .map(([sql]: [{ text: string; values: unknown[] }]) => sql)
        .find((sql) => sql.text.includes('ORDER BY c."id" DESC'));

    it('should answer with the page and the type of every item, to the professional and to the student', async () => {
      for (const [sub, level] of [
        [77, LEVELS.PROFISSIONAL_NAPNE],
        [STUDENT_ID, LEVELS.ALUNO_ESTUDANTE],
      ]) {
        sessionSub = sub;
        sessionLevel = level;

        const response = await call('get', `/comments/${STUDENT_ID}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          items: [
            { ...NOTE, author_roles: [LEVELS.PROFISSIONAL_SAUDE] },
            { ...REPORT, author_roles: [LEVELS.PROFISSIONAL_SAUDE] },
          ],
          next_cursor: null,
          total: 2,
          overall: 2,
          authors: [{ id: SUB, name: 'Quem pede' }],
        });
        expect(
          response.body.items.map((c: { type: string }) => c.type),
        ).toEqual([CommentType.NOTE, CommentType.CLASS_COUNCIL_REPORT]);
      }
    });

    it('should hand every filter of the query string to the SQL, converted', async () => {
      const response = await call(
        'get',
        `/comments/${STUDENT_ID}?q=${encodeURIComponent('Ação')}&author=5&area=3&type=NOTE&from=${encodeURIComponent('2026-10-17T00:00:00-03:00')}&to=${encodeURIComponent('2026-10-18T03:00:00.000Z')}&edited=true&cursor=50&limit=5`,
      );

      expect(response.status).toBe(200);
      expect(pageIdsCall()?.values).toEqual([
        STUDENT_ID,
        'Ação',
        'Ação',
        5,
        3,
        'NOTE',
        '2026-10-17T03:00:00.000Z',
        '2026-10-18T03:00:00.000Z',
        50,
        6,
      ]);
    });

    it('should use a page of 20 when the limit is absent', async () => {
      await call('get', `/comments/${STUDENT_ID}`);

      expect(pageIdsCall()?.values).toEqual([STUDENT_ID, 21]);
    });

    it.each([
      ['limit=0', 'limit deve ser um número inteiro de 1 a 50.'],
      ['limit=51', 'limit deve ser um número inteiro de 1 a 50.'],
      ['limit=5&limit=6', 'limit deve ser um número inteiro de 1 a 50.'],
      ['author=1e3', 'author deve ser um número inteiro positivo.'],
      ['author=%205', 'author deve ser um número inteiro positivo.'],
      ['cursor=0x10', 'cursor deve ser um número inteiro positivo.'],
      ['cursor=0', 'cursor deve ser um número inteiro positivo.'],
      ['edited=yes', 'edited deve ser true ou false.'],
      ['area=2', 'area deve ser 1, 3, 4, 5 ou 6.'],
      ['type=OTHER', 'type deve ser NOTE ou CLASS_COUNCIL_REPORT.'],
      [
        'from=2026-10-17',
        'from deve ser uma data e hora ISO 8601 com fuso, como 2026-10-17T03:00:00.000Z.',
      ],
      [
        'to=2026-02-30T00:00:00Z',
        'to deve ser uma data e hora ISO 8601 com fuso, como 2026-10-17T03:00:00.000Z.',
      ],
      ['q=a%00b', 'q não pode ter caracteres de controle.'],
      ['q=a%09b', 'q não pode ter caracteres de controle.'],
      ['q=a%C2%85b', 'q não pode ter caracteres de controle.'],
      [`q=${'a'.repeat(201)}`, 'q deve ter no máximo 200 caracteres.'],
    ])(
      'should answer 400 to ?%s without touching the database',
      async (queryString, message) => {
        const response = await call(
          'get',
          `/comments/${STUDENT_ID}?${queryString}`,
        );

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual([message]);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
        expect(prisma.comments.findMany).not.toHaveBeenCalled();
      },
    );

    it.each(['foo=1', 'Author=5', 'busca=acao', 'a[b]=1', 'id_author=5'])(
      'should answer 400 to the unknown parameter ?%s',
      async (queryString) => {
        const response = await call(
          'get',
          `/comments/${STUDENT_ID}?${queryString}`,
        );

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual([
          expect.stringMatching(/should not exist/),
        ]);
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      },
    );

    it('should accept an empty q and treat it as no filter', async () => {
      const response = await call('get', `/comments/${STUDENT_ID}?q=`);

      expect(response.status).toBe(200);
      expect(pageIdsCall()?.text).not.toContain('strpos');
    });

    describe('combining marks in q', () => {
      const searchOf = (marks: number) =>
        encodeURIComponent(`a${ACUTE.repeat(marks)}`);

      it('should accept 30 marks in a row', async () => {
        const response = await call(
          'get',
          `/comments/${STUDENT_ID}?q=${searchOf(30)}`,
        );

        expect(response.status).toBe(200);
      });

      it('should answer 400 to 31 marks in a row, without touching the database', async () => {
        const response = await call(
          'get',
          `/comments/${STUDENT_ID}?q=${searchOf(31)}`,
        );

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual([
          'q não pode ter mais de 30 acentos ou marcas seguidos.',
        ]);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      });
    });

    describe('statement timeout', () => {
      const message =
        'A busca demorou demais. Refine os filtros e tente de novo.';

      it('should answer 503 with the message of the search when the database cancels a query', async () => {
        prisma.$queryRaw.mockRejectedValue(statementTimeout());

        const response = await call('get', `/comments/${STUDENT_ID}?q=acao`);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({
          statusCode: 503,
          message,
          error: 'Service Unavailable',
        });
        expect(prisma.comments.findMany).not.toHaveBeenCalled();
      });

      it('should not leak the database error in the 503', async () => {
        prisma.$queryRaw.mockRejectedValue(statementTimeout());

        const response = await call('get', `/comments/${STUDENT_ID}`);

        expect(JSON.stringify(response.body)).not.toMatch(
          /57014|statement|P2010|Raw query/,
        );
      });

      it('should answer 503 with the message of the busy system when the pool gives no connection to open the transaction', async () => {
        prisma.$transaction.mockRejectedValue(transactionStartTimeout());

        const response = await call('get', `/comments/${STUDENT_ID}`);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({
          statusCode: 503,
          message: 'O sistema está ocupado. Tente de novo em instantes.',
          error: 'Service Unavailable',
        });
        expect(prisma.comments.findMany).not.toHaveBeenCalled();
      });

      it('should not leak the Prisma error in the busy 503', async () => {
        prisma.$transaction.mockRejectedValue(transactionStartTimeout());

        const response = await call('get', `/comments/${STUDENT_ID}`);

        expect(JSON.stringify(response.body)).not.toMatch(
          /P2028|Prisma|[Tt]ransaction/,
        );
      });

      it('should keep answering 500 to any other database error', async () => {
        app.useLogger(false);
        prisma.$queryRaw.mockRejectedValue(new Error('conexão perdida'));

        const response = await call('get', `/comments/${STUDENT_ID}`);

        expect(response.status).toBe(500);
      });
    });

    it('should answer 403 to a student who asks for another student, even with valid filters, before any query', async () => {
      sessionSub = STUDENT_ID;
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;

      const response = await call(
        'get',
        '/comments/99?q=acao&author=5&area=3&type=NOTE&edited=true&limit=5',
      );

      expect(response.status).toBe(403);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.comments.findMany).not.toHaveBeenCalled();
    });

    it('should answer 200 to the student reading his own records with filters', async () => {
      sessionSub = STUDENT_ID;
      sessionLevel = LEVELS.ALUNO_ESTUDANTE;

      const response = await call(
        'get',
        `/comments/${STUDENT_ID}?type=CLASS_COUNCIL_REPORT&limit=5`,
      );

      expect(response.status).toBe(200);
    });
  });
});
