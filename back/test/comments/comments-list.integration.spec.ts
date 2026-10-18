import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CommentType, Prisma } from '@prisma/client';
import { authorsSql, pageIdsSql } from 'src/comments/comments-list.sql';
import { CommentsService } from 'src/comments/comments.service';
import { ListCommentsQueryDto } from 'src/comments/dto/list-comments-query.dto';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { createValidationPipe } from 'src/common/validation-pipe';
import {
  COMMENT_LIST_STATEMENT_TIMEOUT_MS,
  COMMENT_LIST_TRANSACTION_MAX_WAIT_MS,
  LEVELS,
  PHASES,
} from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { StudentsService } from 'src/students/students.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. A busca sem acento, o strpos sobre
// o texto normalizado, o filtro pelo nível atual do autor, as bordas de data, o
// DISTINCT ON dos autores e o uso do índice só existem no PostgreSQL, e um
// Prisma mockado não executa nenhum deles. O corpo da query passa pelo pipe
// real e pelo service, como na rota.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail (as anotações são apagadas antes, e o
// histórico de edições vai junto, por CASCADE), e nunca a tabela inteira. O
// beforeAll recusa rodar num banco cujo nome não termine em "_it". O CPF usa o
// prefixo 28 (estudante) e 29 (profissional), que nenhum outro spec de
// integração usa.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@anotacoes-lista.test';

const FIRST_INSTANT = Date.parse('2026-03-01T12:00:00.000Z');

(integrationDatabaseUrl ? describe : describe.skip)(
  'Lista de anotações contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: CommentsService;
    let studentsService: StudentsService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    function createAccount(id_level: number, full_name?: string) {
      const n = nextNumber();
      const isStudent = id_level === LEVELS.ALUNO_ESTUDANTE;
      return prisma.user.create({
        data: {
          full_name: full_name ?? `Conta ${n}`,
          cpf: `${isStudent ? 28 : 29}${String(n).padStart(9, '0')}`,
          email: `conta${n}${EMAIL_DOMAIN}`,
          password: 'x',
          id_level,
          id_current_phase: PHASES.TRIAGEM,
          ...(isStudent
            ? { service_status: 'WAITING' as const, queued_at: new Date() }
            : {}),
        },
      });
    }

    const createStudent = () => createAccount(LEVELS.ALUNO_ESTUDANTE);
    const createAuthor = (
      id_level: number = LEVELS.PROFISSIONAL_EDUCACAO,
      full_name?: string,
    ) => createAccount(id_level, full_name);

    interface CommentFixture {
      student: { id: number };
      author: { id: number };
      comment?: string;
      type?: CommentType;
      authorName?: string;
      createdAt?: Date | string;
      edits?: string[];
    }

    // Cada anotação nasce um segundo depois da anterior, então a ordem do id e a
    // do created_at coincidem, e os testes de data escolhem o instante exato.
    function addComment({
      student,
      author,
      comment = 'Registro',
      type = CommentType.NOTE,
      authorName = 'Autor',
      createdAt,
      edits = [],
    }: CommentFixture) {
      return prisma.comments.create({
        data: {
          comment,
          type,
          id_user: student.id,
          id_author: author.id,
          author_name: authorName,
          created_at: createdAt
            ? new Date(createdAt)
            : new Date(FIRST_INSTANT + nextNumber() * 1000),
          edits: { create: edits.map((text) => ({ comment: text })) },
        },
      });
    }

    async function addComments(
      count: number,
      fixture: CommentFixture,
    ): Promise<{ id: number }[]> {
      const created: { id: number }[] = [];
      for (let index = 0; index < count; index += 1) {
        created.push(
          await addComment({ ...fixture, comment: `Registro ${index + 1}` }),
        );
      }
      return created;
    }

    const requestOf = (id: number, id_level: number) =>
      ({
        user: {
          sub: id,
          id_level,
          email: 'quem.pede@example.com',
          name: 'Quem',
        },
      }) as AuthenticatedRequest;

    const reader = () => requestOf(1, LEVELS.PROFISSIONAL_NAPNE);

    // A query passa pelo pipe real, como as strings que chegam na rota.
    async function queryOf(raw: Record<string, string>) {
      return (await createValidationPipe().transform(raw, {
        type: 'query',
        metatype: ListCommentsQueryDto,
      })) as ListCommentsQueryDto;
    }

    async function list(
      studentId: number,
      raw: Record<string, string> = {},
      request: AuthenticatedRequest = reader(),
    ) {
      return service.findAllByIdUser(studentId, await queryOf(raw), request);
    }

    const idsOf = (page: { items: { id: number }[] }) =>
      page.items.map((item) => item.id);

    const newestFirst = (created: { id: number }[]) =>
      created.map((c) => c.id).reverse();

    const deleteFixtures = async () => {
      await prisma.comments.deleteMany({
        where: { user: { email: { endsWith: EMAIL_DOMAIN } } },
      });
      await prisma.user.deleteMany({
        where: { email: { endsWith: EMAIL_DOMAIN } },
      });
    };

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      const databaseUrl = requireIntegrationDatabaseUrl(integrationDatabaseUrl);

      // O PrismaService lê a conexão de DATABASE_URL.
      process.env.DATABASE_URL = databaseUrl;

      const module = await Test.createTestingModule({
        providers: [
          CommentsService,
          StudentsService,
          PrismaService,
          { provide: MailService, useValue: {} },
        ],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(CommentsService);
      studentsService = module.get(StudentsService);

      // O banco do job nasce só com as migrations, sem o seed. O createMany
      // com skipDuplicates é um INSERT ... ON CONFLICT DO NOTHING, que não
      // falha para o spec que perde a corrida dos que rodam em paralelo.
      await prisma.level.createMany({
        data: [
          { id: LEVELS.ADMIN, name: 'Administrador' },
          { id: LEVELS.ALUNO_ESTUDANTE, name: 'Estudante/Família' },
          {
            id: LEVELS.PROFISSIONAL_EDUCACAO,
            name: 'Profissional da Educação',
          },
          { id: LEVELS.PROFISSIONAL_SAUDE, name: 'Profissional da Saúde' },
          { id: LEVELS.PROFISSIONAL_NAPNE, name: 'Profissional NAPNE' },
        ],
        skipDuplicates: true,
      });
      await prisma.currentPhases.createMany({
        data: [{ id: PHASES.TRIAGEM, name: 'Triagem' }],
        skipDuplicates: true,
      });
    });

    afterAll(async () => {
      if (prisma) {
        await deleteFixtures();
      }
      await prisma?.$disconnect();

      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    });

    beforeEach(async () => {
      await deleteFixtures();
    });

    describe('paginação por cursor', () => {
      it('should walk 25 records in pages of 10 without repeating or skipping any, newest first', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const created = await addComments(25, { student, author });

        const seen: number[] = [];
        let cursor: string | undefined;
        let pages = 0;
        do {
          const page = await list(student.id, {
            limit: '10',
            ...(cursor ? { cursor } : {}),
          });
          seen.push(...idsOf(page));
          cursor =
            page.next_cursor === null ? undefined : `${page.next_cursor}`;
          pages += 1;
          expect(page.total).toBe(25);
          expect(page.overall).toBe(25);
        } while (cursor && pages < 10);

        expect(pages).toBe(3);
        expect(seen).toEqual(newestFirst(created));
      });

      it('should answer next_cursor with the id of the last item of the page', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const created = await addComments(5, { student, author });

        const page = await list(student.id, { limit: '2' });

        expect(idsOf(page)).toEqual([created[4].id, created[3].id]);
        expect(page.next_cursor).toBe(created[3].id);
      });

      it('should use a page of 20 when the limit is absent', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const created = await addComments(25, { student, author });

        const first = await list(student.id);
        const second = await list(student.id, {
          cursor: `${first.next_cursor}`,
        });

        expect(first.items).toHaveLength(20);
        expect(second.items).toHaveLength(5);
        expect([...idsOf(first), ...idsOf(second)]).toEqual(
          newestFirst(created),
        );
        expect(second.next_cursor).toBeNull();
      });

      it('should answer next_cursor null when the last page has exactly the limit', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        await addComments(10, { student, author });

        const page = await list(student.id, { limit: '10' });

        expect(page.items).toHaveLength(10);
        expect(page.next_cursor).toBeNull();
      });

      it('should answer an empty page for a cursor at or below the oldest id', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const created = await addComments(3, { student, author });

        const page = await list(student.id, { cursor: `${created[0].id}` });

        expect(page.items).toEqual([]);
        expect(page.next_cursor).toBeNull();
        expect(page.total).toBe(3);
      });

      it('should not let a record created between two pages repeat or hide anything', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const created = await addComments(6, { student, author });

        const first = await list(student.id, { limit: '3' });
        await addComment({ student, author, comment: 'Chegou depois' });
        const second = await list(student.id, {
          limit: '3',
          cursor: `${first.next_cursor}`,
        });

        expect([...idsOf(first), ...idsOf(second)]).toEqual(
          newestFirst(created),
        );
      });

      it('should page inside the filters and keep the total independent of the cursor', async () => {
        const student = await createStudent();
        const ana = await createAuthor();
        const bia = await createAuthor();
        const fromAna: { id: number }[] = [];
        for (let index = 0; index < 7; index += 1) {
          fromAna.push(await addComment({ student, author: ana }));
          await addComment({ student, author: bia });
        }

        const first = await list(student.id, {
          author: `${ana.id}`,
          limit: '3',
        });
        const second = await list(student.id, {
          author: `${ana.id}`,
          limit: '3',
          cursor: `${first.next_cursor}`,
        });
        const third = await list(student.id, {
          author: `${ana.id}`,
          limit: '3',
          cursor: `${second.next_cursor}`,
        });

        expect([...idsOf(first), ...idsOf(second), ...idsOf(third)]).toEqual(
          newestFirst(fromAna),
        );
        expect(third.next_cursor).toBeNull();
        for (const page of [first, second, third]) {
          expect(page.total).toBe(7);
          expect(page.overall).toBe(14);
        }
      });

      it('should return each item with its edit history in order and the current level of the author', async () => {
        const student = await createStudent();
        const author = await createAuthor(LEVELS.PROFISSIONAL_SAUDE);
        const created = await addComment({
          student,
          author,
          comment: 'Texto final',
          edits: ['Primeira versão', 'Segunda versão'],
        });

        const page = await list(student.id);

        expect(page.items).toHaveLength(1);
        expect(page.items[0]).toMatchObject({
          id: created.id,
          comment: 'Texto final',
          type: CommentType.NOTE,
          id_author: author.id,
          author_level: LEVELS.PROFISSIONAL_SAUDE,
        });
        expect(page.items[0].edits.map((edit) => edit.comment)).toEqual([
          'Primeira versão',
          'Segunda versão',
        ]);
      });

      it('should answer author_level null for an author that no longer exists', async () => {
        const student = await createStudent();
        await addComment({ student, author: { id: 2147483000 } });

        const page = await list(student.id);

        expect(page.items.map((item) => item.author_level)).toEqual([null]);
      });
    });

    describe('total e overall', () => {
      it('should count only the records of this student', async () => {
        const student = await createStudent();
        const other = await createStudent();
        const author = await createAuthor();
        await addComments(4, { student, author });
        await addComments(9, { student: other, author });

        const page = await list(student.id);

        expect(page.total).toBe(4);
        expect(page.overall).toBe(4);
        expect(page.items).toHaveLength(4);
      });

      it('should count the matches in total and the whole record in overall, whatever the limit', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        await addComments(3, { student, author, type: CommentType.NOTE });
        await addComments(2, {
          student,
          author,
          type: CommentType.CLASS_COUNCIL_REPORT,
        });

        const page = await list(student.id, {
          type: 'CLASS_COUNCIL_REPORT',
          limit: '1',
        });

        expect(page.items).toHaveLength(1);
        expect(page.total).toBe(2);
        expect(page.overall).toBe(5);
      });

      it('should answer an empty page with zero total and the overall of the student when nothing matches', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        await addComments(3, { student, author });

        const page = await list(student.id, { q: 'inexistente' });

        expect(page).toMatchObject({
          items: [],
          next_cursor: null,
          total: 0,
          overall: 3,
        });
      });

      it('should answer zeros and an empty list for a student without records', async () => {
        const student = await createStudent();

        const page = await list(student.id);

        expect(page).toEqual({
          items: [],
          next_cursor: null,
          total: 0,
          overall: 0,
          authors: [],
        });
      });
    });

    describe('filtros, um de cada vez', () => {
      it('should filter by author', async () => {
        const student = await createStudent();
        const ana = await createAuthor();
        const bia = await createAuthor();
        const fromAna = await addComment({ student, author: ana });
        await addComment({ student, author: bia });

        const page = await list(student.id, { author: `${ana.id}` });

        expect(idsOf(page)).toEqual([fromAna.id]);
        expect(page.total).toBe(1);
        expect(page.overall).toBe(2);
      });

      it('should filter by type', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const note = await addComment({ student, author });
        const report = await addComment({
          student,
          author,
          type: CommentType.CLASS_COUNCIL_REPORT,
        });

        expect(idsOf(await list(student.id, { type: 'NOTE' }))).toEqual([
          note.id,
        ]);
        expect(
          idsOf(await list(student.id, { type: 'CLASS_COUNCIL_REPORT' })),
        ).toEqual([report.id]);
      });

      describe('area, o nível atual do autor', () => {
        it.each([
          ['Administrador', LEVELS.ADMIN],
          ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
          ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
          ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
        ])('should keep only the records of a %s', async (_, area) => {
          const student = await createStudent();
          const authors = await Promise.all(
            [
              LEVELS.ADMIN,
              LEVELS.PROFISSIONAL_EDUCACAO,
              LEVELS.PROFISSIONAL_SAUDE,
              LEVELS.PROFISSIONAL_NAPNE,
            ].map((level) => createAuthor(level)),
          );
          const comments = new Map<number, number>();
          for (const author of authors) {
            const created = await addComment({ student, author });
            comments.set(author.id_level, created.id);
          }

          const page = await list(student.id, { area: `${area}` });

          expect(idsOf(page)).toEqual([comments.get(area)]);
          expect(page.total).toBe(1);
          expect(page.overall).toBe(4);
        });

        it('should follow the level the author has today, not the one of the day he wrote', async () => {
          const student = await createStudent();
          const author = await createAuthor(LEVELS.PROFISSIONAL_SAUDE);
          const older = await addComment({ student, author });
          const newer = await addComment({ student, author });

          expect(idsOf(await list(student.id, { area: '4' }))).toEqual([
            newer.id,
            older.id,
          ]);

          await prisma.user.update({
            where: { id: author.id },
            data: { id_level: LEVELS.PROFISSIONAL_NAPNE },
          });

          expect(idsOf(await list(student.id, { area: '4' }))).toEqual([]);
          expect(idsOf(await list(student.id, { area: '5' }))).toEqual([
            newer.id,
            older.id,
          ]);
        });

        it('should leave out the records of an author that no longer exists', async () => {
          const student = await createStudent();
          const author = await createAuthor(LEVELS.PROFISSIONAL_EDUCACAO);
          const existing = await addComment({ student, author });
          await addComment({ student, author: { id: 2147483000 } });

          const page = await list(student.id, { area: '3' });

          expect(idsOf(page)).toEqual([existing.id]);
          expect(page.overall).toBe(2);
        });
      });

      describe('edited', () => {
        it('should keep only the records with at least one edit when true', async () => {
          const student = await createStudent();
          const author = await createAuthor();
          await addComment({ student, author });
          const once = await addComment({ student, author, edits: ['v1'] });
          const twice = await addComment({
            student,
            author,
            edits: ['v1', 'v2'],
          });

          const page = await list(student.id, { edited: 'true' });

          expect(idsOf(page)).toEqual([twice.id, once.id]);
          expect(page.total).toBe(2);
          expect(page.overall).toBe(3);
        });

        it('should not filter when false', async () => {
          const student = await createStudent();
          const author = await createAuthor();
          await addComment({ student, author });
          await addComment({ student, author, edits: ['v1'] });

          const page = await list(student.id, { edited: 'false' });

          expect(page.items).toHaveLength(2);
          expect(page.total).toBe(2);
        });
      });

      describe('from e to', () => {
        const AT = '2026-05-10T12:00:00.000Z';

        async function recordsAround() {
          const student = await createStudent();
          const author = await createAuthor();
          const before = await addComment({
            student,
            author,
            createdAt: '2026-05-10T11:59:59.999Z',
          });
          const exact = await addComment({ student, author, createdAt: AT });
          const after = await addComment({
            student,
            author,
            createdAt: '2026-05-10T12:00:00.001Z',
          });
          return { student, before, exact, after };
        }

        it('should include the record created exactly at from', async () => {
          const { student, exact, after } = await recordsAround();

          expect(idsOf(await list(student.id, { from: AT }))).toEqual([
            after.id,
            exact.id,
          ]);
        });

        it('should exclude a record created one millisecond before from', async () => {
          const { student, after } = await recordsAround();

          expect(
            idsOf(await list(student.id, { from: '2026-05-10T12:00:00.001Z' })),
          ).toEqual([after.id]);
        });

        it('should exclude the record created exactly at to', async () => {
          const { student, before } = await recordsAround();

          expect(idsOf(await list(student.id, { to: AT }))).toEqual([
            before.id,
          ]);
        });

        it('should include a record created one millisecond before to', async () => {
          const { student, before, exact } = await recordsAround();

          expect(
            idsOf(await list(student.id, { to: '2026-05-10T12:00:00.001Z' })),
          ).toEqual([exact.id, before.id]);
        });

        it('should take the day of a local midnight as the half-open interval [from, to)', async () => {
          const student = await createStudent();
          const author = await createAuthor();
          await addComment({
            student,
            author,
            createdAt: '2026-05-10T02:59:59.999Z',
          });
          const first = await addComment({
            student,
            author,
            createdAt: '2026-05-10T03:00:00.000Z',
          });
          const last = await addComment({
            student,
            author,
            createdAt: '2026-05-11T02:59:59.999Z',
          });
          await addComment({
            student,
            author,
            createdAt: '2026-05-11T03:00:00.000Z',
          });

          const page = await list(student.id, {
            from: '2026-05-10T03:00:00.000Z',
            to: '2026-05-11T03:00:00.000Z',
          });

          expect(idsOf(page)).toEqual([last.id, first.id]);
          expect(page.total).toBe(2);
          expect(page.overall).toBe(4);
        });

        it('should read the offset the client sent as the same instant in UTC', async () => {
          const { student, exact, after } = await recordsAround();

          expect(
            idsOf(
              await list(student.id, { from: '2026-05-10T09:00:00-03:00' }),
            ),
          ).toEqual([after.id, exact.id]);
          expect(
            idsOf(
              await list(student.id, { from: '2026-05-10T17:30:00+05:30' }),
            ),
          ).toEqual([after.id, exact.id]);
        });

        it('should answer an empty page, and not an error, when from is after to', async () => {
          const { student } = await recordsAround();

          const page = await list(student.id, {
            from: '2026-05-11T00:00:00Z',
            to: '2026-05-10T00:00:00Z',
          });

          expect(page.items).toEqual([]);
          expect(page.total).toBe(0);
        });
      });

      describe('q, a busca por texto', () => {
        async function recordsWith(texts: string[], authorName = 'Autor') {
          const student = await createStudent();
          const author = await createAuthor();
          const created: { id: number; text: string }[] = [];
          for (const text of texts) {
            const row = await addComment({
              student,
              author,
              comment: text,
              authorName,
            });
            created.push({ id: row.id, text });
          }
          return { student, created };
        }

        const found = async (
          student: { id: number },
          q: string,
        ): Promise<number[]> => idsOf(await list(student.id, { q }));

        describe('sem diferenciar maiúscula nem acento', () => {
          const ACAO_NFD = 'Ação'.normalize('NFD');

          it.each([
            ['acao'],
            ['ACAO'],
            ['Acao'],
            ['ação'],
            ['AÇÃO'],
            ['Ação'],
            [ACAO_NFD],
            [ACAO_NFD.toUpperCase()],
            ['ca'],
            ['  acao  '],
          ])(
            'should find "Ação" in the three spellings with the term %j',
            async (q) => {
              const { student, created } = await recordsWith([
                'Ação imediata',
                'AÇÃO URGENTE',
                `${ACAO_NFD} decomposta`,
                'Nenhuma ocorrência hoje',
              ]);

              const ids = await found(student, q);

              expect(ids).toEqual([
                created[2].id,
                created[1].id,
                created[0].id,
              ]);
            },
          );

          it('should find an accented word by the term without the accent', async () => {
            const { student, created } = await recordsWith([
              'Nenhuma ocorrência hoje',
              'Observação simples',
            ]);

            expect(await found(student, 'ocorrencia')).toEqual([created[0].id]);
            expect(await found(student, 'OCORRÊNCIA')).toEqual([created[0].id]);
            expect(await found(student, 'observacao')).toEqual([created[1].id]);
          });

          it('should treat the cedilla, the tilde and the circumflex like the base letter', async () => {
            const { student, created } = await recordsWith([
              'coração aflição pâncreas ônibus à vontade',
            ]);

            for (const q of [
              'coracao',
              'aflicao',
              'pancreas',
              'onibus',
              'a vontade',
            ]) {
              expect(await found(student, q)).toEqual([created[0].id]);
            }
          });

          it('should find an emoji', async () => {
            const { student, created } = await recordsWith([
              'Muito bem \uD83D\uDE00',
              'Sem emoji',
            ]);

            expect(await found(student, '\uD83D\uDE00')).toEqual([
              created[0].id,
            ]);
          });

          it('should match every record for a term made only of a combining mark, like the browser does', async () => {
            const { student, created } = await recordsWith(['um', 'dois']);

            expect(await found(student, '\u0301')).toEqual(
              newestFirst(created),
            );
          });
        });

        describe('% e _ são texto comum', () => {
          it('should match a literal %', async () => {
            const { student, created } = await recordsWith([
              'Desconto de 50% hoje',
              'Cinquenta por cento',
              'Desconto de 50 reais',
            ]);

            expect(await found(student, '%')).toEqual([created[0].id]);
            expect(await found(student, '50%')).toEqual([created[0].id]);
            expect(await found(student, '%50')).toEqual([]);
          });

          it('should match a literal _', async () => {
            const { student, created } = await recordsWith([
              'campo_nome preenchido',
              'campoXnome preenchido',
              'campo nome preenchido',
            ]);

            expect(await found(student, '_')).toEqual([created[0].id]);
            expect(await found(student, 'o_n')).toEqual([created[0].id]);
            expect(await found(student, 'campo_nome')).toEqual([created[0].id]);
          });

          it('should match a literal backslash', async () => {
            const { student, created } = await recordsWith([
              'pasta C:\\temp criada',
              'pasta C:/temp criada',
            ]);

            expect(await found(student, '\\')).toEqual([created[0].id]);
          });

          it('should not read the term as a pattern', async () => {
            const { student } = await recordsWith(['abc', 'a.c', 'a*c']);

            expect(await found(student, 'a.c')).toHaveLength(1);
            expect(await found(student, 'a*c')).toHaveLength(1);
            expect(await found(student, '.*')).toHaveLength(0);
            expect(await found(student, '[a-c]')).toHaveLength(0);
          });
        });

        describe('o nome do autor', () => {
          it('should find by a fragment of the author name, without case nor accent', async () => {
            const student = await createStudent();
            const jose = await createAuthor();
            const ana = await createAuthor();
            const byJose = await addComment({
              student,
              author: jose,
              comment: 'Registro 1',
              authorName: 'José Álvaro',
            });
            const byAna = await addComment({
              student,
              author: ana,
              comment: 'Registro 2',
              authorName: 'Professora Ana',
            });

            expect(await found(student, 'jose')).toEqual([byJose.id]);
            expect(await found(student, 'ALVARO')).toEqual([byJose.id]);
            expect(await found(student, 'professora')).toEqual([byAna.id]);
            expect(await found(student, 'ANA')).toEqual([byAna.id]);
          });

          it('should match the text of one record or the author name of another', async () => {
            const student = await createStudent();
            const maria = await createAuthor();
            const other = await createAuthor();
            const byText = await addComment({
              student,
              author: other,
              comment: 'Conversa com a Maria',
              authorName: 'Pedro',
            });
            const byName = await addComment({
              student,
              author: maria,
              comment: 'Registro sem o nome',
              authorName: 'Maria Souza',
            });
            await addComment({
              student,
              author: other,
              comment: 'Nada a ver',
              authorName: 'Pedro',
            });

            expect(await found(student, 'maria')).toEqual([
              byName.id,
              byText.id,
            ]);
          });

          it('should search the name written on the record, which is the name of that day', async () => {
            const student = await createStudent();
            const author = await createAuthor(
              LEVELS.PROFISSIONAL_EDUCACAO,
              'Ana Lima',
            );
            const old = await addComment({
              student,
              author,
              authorName: 'Ana Souza',
            });
            const recent = await addComment({
              student,
              author,
              authorName: 'Ana Lima',
            });

            expect(await found(student, 'souza')).toEqual([old.id]);
            expect(await found(student, 'lima')).toEqual([recent.id]);
          });
        });

        describe('um termo que parece SQL', () => {
          it.each([
            [`x'); DROP TABLE "Comments"; --`],
            [`' OR '1'='1`],
            [`" OR 1=1 --`],
            [`'; SELECT pg_sleep(5); --`],
            ['$1'],
            ['${1}'],
            ['?'],
          ])('should treat %j as plain text and keep the table', async (q) => {
            const { student } = await recordsWith(['um', 'dois']);

            const page = await list(student.id, { q });

            expect(page.items).toEqual([]);
            expect(page.total).toBe(0);
            expect(page.overall).toBe(2);
            expect(
              await prisma.comments.count({ where: { id_user: student.id } }),
            ).toBe(2);
          });

          it('should find a record whose text really has the characters of an injection', async () => {
            const { student, created } = await recordsWith([
              `o aluno escreveu ' OR '1'='1 no quadro`,
              'registro comum',
            ]);

            expect(await found(student, `' OR '1'='1`)).toEqual([
              created[0].id,
            ]);
          });
        });

        it('should not filter when the term is empty', async () => {
          const { student } = await recordsWith(['um', 'dois']);

          const page = await list(student.id, { q: '' });

          expect(page.items).toHaveLength(2);
          expect(page.total).toBe(2);
        });

        it('should match a term of 200 characters', async () => {
          const term = 'a'.repeat(200);
          const { student, created } = await recordsWith([
            `começo ${term} fim`,
            'curto',
          ]);

          expect(await found(student, term)).toEqual([created[0].id]);
        });
      });
    });

    describe('filtros combinados', () => {
      it('should apply every filter at once, paging inside the intersection', async () => {
        const student = await createStudent();
        const health = await createAuthor(
          LEVELS.PROFISSIONAL_SAUDE,
          'Dra. Ana',
        );
        const education = await createAuthor(LEVELS.PROFISSIONAL_EDUCACAO);
        const inside = '2026-06-10T15:00:00.000Z';
        const wanted: { id: number }[] = [];
        for (let index = 0; index < 4; index += 1) {
          wanted.push(
            await addComment({
              student,
              author: health,
              authorName: 'Dra. Ana',
              comment: `Ação ${index}`,
              type: CommentType.CLASS_COUNCIL_REPORT,
              createdAt: inside,
              edits: ['rascunho'],
            }),
          );
        }
        await addComment({
          student,
          author: education,
          comment: 'Ação outro autor',
          type: CommentType.CLASS_COUNCIL_REPORT,
          createdAt: inside,
          edits: ['rascunho'],
        });
        await addComment({
          student,
          author: health,
          authorName: 'Dra. Ana',
          comment: 'Ação outro tipo',
          type: CommentType.NOTE,
          createdAt: inside,
          edits: ['rascunho'],
        });
        await addComment({
          student,
          author: health,
          authorName: 'Dra. Ana',
          comment: 'Ação sem edição',
          type: CommentType.CLASS_COUNCIL_REPORT,
          createdAt: inside,
        });
        await addComment({
          student,
          author: health,
          authorName: 'Dra. Ana',
          comment: 'Ação fora do período',
          type: CommentType.CLASS_COUNCIL_REPORT,
          createdAt: '2026-07-01T00:00:00.000Z',
          edits: ['rascunho'],
        });
        await addComment({
          student,
          author: health,
          authorName: 'Dra. Ana',
          comment: 'Outro assunto',
          type: CommentType.CLASS_COUNCIL_REPORT,
          createdAt: inside,
          edits: ['rascunho'],
        });

        const filters = {
          q: 'acao',
          author: `${health.id}`,
          area: '4',
          type: 'CLASS_COUNCIL_REPORT',
          from: '2026-06-10T00:00:00.000Z',
          to: '2026-06-11T00:00:00.000Z',
          edited: 'true',
        };
        const first = await list(student.id, { ...filters, limit: '3' });
        const second = await list(student.id, {
          ...filters,
          limit: '3',
          cursor: `${first.next_cursor}`,
        });

        expect([...idsOf(first), ...idsOf(second)]).toEqual(
          newestFirst(wanted),
        );
        expect(first.next_cursor).not.toBeNull();
        expect(second.next_cursor).toBeNull();
        expect(first.total).toBe(4);
        expect(second.total).toBe(4);
        expect(first.overall).toBe(9);
      });
    });

    describe('authors', () => {
      it('should list the distinct authors of the whole record with the latest name of each, in alphabetical order of Brazilian Portuguese', async () => {
        const student = await createStudent();
        const zelia = await createAuthor();
        const agata = await createAuthor();
        const ana = await createAuthor();
        await addComment({ student, author: zelia, authorName: 'Zélia Prado' });
        await addComment({ student, author: ana, authorName: 'Ana Souza' });
        await addComment({ student, author: agata, authorName: 'Ágata Reis' });
        await addComment({
          student,
          author: ana,
          authorName: 'Ana Souza Lima',
        });
        await addComment({ student, author: zelia, authorName: 'Zélia Prado' });

        const page = await list(student.id);

        expect(page.authors).toEqual([
          { id: agata.id, name: 'Ágata Reis' },
          { id: ana.id, name: 'Ana Souza Lima' },
          { id: zelia.id, name: 'Zélia Prado' },
        ]);
      });

      it('should list the authors of the whole record even when the filters keep none of their records', async () => {
        const student = await createStudent();
        const ana = await createAuthor();
        const bia = await createAuthor();
        await addComment({ student, author: ana, authorName: 'Ana' });
        await addComment({ student, author: bia, authorName: 'Bia' });

        const page = await list(student.id, {
          author: `${ana.id}`,
          q: 'nada',
          limit: '1',
        });

        expect(page.items).toEqual([]);
        expect(page.authors.map((author) => author.name)).toEqual([
          'Ana',
          'Bia',
        ]);
      });

      it('should not list the authors of another student', async () => {
        const student = await createStudent();
        const other = await createStudent();
        const ana = await createAuthor();
        const bia = await createAuthor();
        await addComment({ student, author: ana, authorName: 'Ana' });
        await addComment({ student: other, author: bia, authorName: 'Bia' });

        const page = await list(student.id);

        expect(page.authors).toEqual([{ id: ana.id, name: 'Ana' }]);
      });
    });

    describe('acesso', () => {
      it('should answer 403 to a student who asks for another student, even with filters', async () => {
        const student = await createStudent();
        const other = await createStudent();
        const author = await createAuthor();
        await addComment({ student: other, author });

        await expect(
          list(
            other.id,
            { q: 'registro', author: `${author.id}`, limit: '5' },
            requestOf(student.id, LEVELS.ALUNO_ESTUDANTE),
          ),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          list(other.id, {}, requestOf(student.id, LEVELS.ALUNO_ESTUDANTE)),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should let the student page and filter his own records', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        const created = await addComments(3, { student, author });

        const page = await list(
          student.id,
          { q: 'registro', limit: '2' },
          requestOf(student.id, LEVELS.ALUNO_ESTUDANTE),
        );

        expect(idsOf(page)).toEqual([created[2].id, created[1].id]);
        expect(page.next_cursor).toBe(created[1].id);
        expect(page.total).toBe(3);
      });

      it('should answer 404 when the id is not the one of a student', async () => {
        const author = await createAuthor();

        await expect(list(author.id, { q: 'x' })).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    // O DTO recusa mais de 30 marcas combinantes seguidas, mas o dado antigo ou
    // gravado direto no banco passa por cima dele: o texto de 10000 unidades com
    // 4999 + 5000 marcas leva segundos para o normalize(NFD) do PostgreSQL, e o
    // teto da consulta é o que impede a busca de segurar a conexão do pool.
    describe('o tempo máximo da busca', () => {
      const SLOW_TEST_TIMEOUT_MS = 40000;
      const HEAVY_RECORDS = 10;

      const addHeavyRecords = (
        student: { id: number },
        author: { id: number },
        count: number,
      ) =>
        prisma.$executeRaw`INSERT INTO "Comments" ("comment", "id_user", "id_author", "author_name") SELECT 'a' || repeat(chr(769), 4999) || repeat(chr(790), 5000), ${student.id}::int, ${author.id}::int, 'Autor' FROM generate_series(1, ${count}::int)`;

      const addWorstLegalRecords = (
        student: { id: number },
        author: { id: number },
        count: number,
      ) =>
        prisma.$executeRaw`INSERT INTO "Comments" ("comment", "id_user", "id_author", "author_name") SELECT repeat('a' || repeat(chr(790), 15) || repeat(chr(769), 15), 322), ${student.id}::int, ${author.id}::int, 'Autor' FROM generate_series(1, ${count}::int)`;

      const activeNormalizeQueries = async () => {
        const rows = await prisma.$queryRaw<
          { total: number }[]
        >`SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' AND pid <> pg_backend_pid() AND query LIKE '%normalize(%'`;
        return rows[0].total;
      };

      it(
        'should answer 503 within the statement timeout, and not keep the connection busy, for records that bypassed the DTO',
        async () => {
          const student = await createStudent();
          const other = await createStudent();
          const author = await createAuthor();
          await addHeavyRecords(student, author, HEAVY_RECORDS);
          await addComment({ student: other, author });

          const startedAt = Date.now();
          const search = list(student.id, { q: 'acao' });

          await expect(search).rejects.toThrow(ServiceUnavailableException);
          await expect(search).rejects.toMatchObject({
            message:
              'A busca demorou demais. Refine os filtros e tente de novo.',
          });
          const elapsed = Date.now() - startedAt;
          expect(elapsed).toBeGreaterThanOrEqual(
            COMMENT_LIST_STATEMENT_TIMEOUT_MS - 100,
          );
          expect(elapsed).toBeLessThan(
            COMMENT_LIST_STATEMENT_TIMEOUT_MS + 3000,
          );

          expect(await activeNormalizeQueries()).toBe(0);
          const next = await list(other.id);
          expect(next.total).toBe(1);
        },
        SLOW_TEST_TIMEOUT_MS,
      );

      it(
        'should keep listing the records of that student when there is no text search, since only the search is slow',
        async () => {
          const student = await createStudent();
          const author = await createAuthor();
          await addHeavyRecords(student, author, HEAVY_RECORDS);

          await expect(
            list(student.id, { q: 'acao', limit: '1' }),
          ).rejects.toThrow(ServiceUnavailableException);
          await expect(list(student.id, { limit: '1' })).resolves.toMatchObject(
            {
              overall: HEAVY_RECORDS,
              total: HEAVY_RECORDS,
            },
          );
        },
        SLOW_TEST_TIMEOUT_MS,
      );

      it(
        'should search the worst text the DTO accepts, with runs of 30 marks, well inside the timeout',
        async () => {
          const student = await createStudent();
          const author = await createAuthor();
          await addWorstLegalRecords(student, author, 50);

          const startedAt = Date.now();
          const page = await list(student.id, { q: 'acao' });
          const elapsed = Date.now() - startedAt;

          expect(page.overall).toBe(50);
          expect(page.total).toBe(0);
          expect(elapsed).toBeLessThan(COMMENT_LIST_STATEMENT_TIMEOUT_MS);
        },
        SLOW_TEST_TIMEOUT_MS,
      );

      it(
        'should answer 503 with the message of the busy system, and not 500, when the whole pool stays busy longer than the wait of the transaction',
        async () => {
          const POOL_SIZE = 10;
          const student = await createStudent();
          const author = await createAuthor();
          await addComments(2, { student, author });
          const sleepers = Array.from(
            { length: POOL_SIZE },
            async () => prisma.$queryRaw`SELECT 1 AS x FROM pg_sleep(7.5)`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          // O findOneOrFail também usa o pool: sem o stub ele esperaria na fila e a
          // transação abriria depois, com o pool já livre.
          const lookup = jest
            .spyOn(studentsService, 'findOneOrFail')
            .mockResolvedValueOnce({ id: student.id } as never);

          const startedAt = Date.now();
          const search = list(student.id);

          await expect(search).rejects.toThrow(ServiceUnavailableException);
          await expect(search).rejects.toMatchObject({
            message: 'O sistema está ocupado. Tente de novo em instantes.',
          });
          const elapsed = Date.now() - startedAt;
          expect(elapsed).toBeGreaterThanOrEqual(
            COMMENT_LIST_TRANSACTION_MAX_WAIT_MS - 100,
          );
          expect(elapsed).toBeLessThan(
            COMMENT_LIST_TRANSACTION_MAX_WAIT_MS + 2000,
          );

          lookup.mockRestore();
          await Promise.all(sleepers);
          await expect(list(student.id)).resolves.toMatchObject({ total: 2 });
        },
        SLOW_TEST_TIMEOUT_MS,
      );

      it('should not leave the statement timeout on any connection of the pool, since it is SET LOCAL', async () => {
        const student = await createStudent();
        const author = await createAuthor();
        await addComments(3, { student, author });
        await list(student.id, { q: 'registro' });

        const settings = await Promise.all(
          Array.from(
            { length: 12 },
            () =>
              prisma.$queryRaw<
                { value: string }[]
              >`SELECT current_setting('statement_timeout') AS value FROM pg_sleep(0.2)`,
          ),
        );

        expect(settings.map((rows) => rows[0].value)).toEqual(
          Array(12).fill('0'),
        );
      });
    });

    describe('o índice (id_user, id)', () => {
      it('should exist in the database, on id_user and then id', async () => {
        const indexes = await prisma.$queryRaw<
          { indexname: string; indexdef: string }[]
        >`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Comments' AND indexname = 'Comments_id_user_id_idx'`;

        expect(indexes).toHaveLength(1);
        expect(indexes[0].indexdef).toMatch(/USING btree \(id_user, id\)$/);
      });

      // O estudante com poucas anotações convive com um que tem 30 mil: sem o
      // índice composto, o plano lê o índice da chave primária de ponta a ponta
      // filtrando por id_user, ou a tabela inteira, e ordena.
      it('should serve the page of a student with an index scan in id order, with no sort', async () => {
        const student = await createStudent();
        const noisy = await createStudent();
        const author = await createAuthor();
        await addComments(30, { student, author });
        await prisma.$executeRaw`INSERT INTO "Comments" ("comment", "id_user", "id_author", "author_name") SELECT 'ruído', ${noisy.id}::int, ${author.id}::int, 'Autor' FROM generate_series(1, 30000)`;
        await prisma.$executeRaw`ANALYZE "Comments"`;

        const query = await queryOf({ cursor: '2147483647' });
        const plan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>(
          Prisma.sql`EXPLAIN (COSTS OFF) ${pageIdsSql(student.id, query, 20)}`,
        );
        const text = plan.map((row) => row['QUERY PLAN']).join('\n');

        expect(text).toMatch(/Index (Only )?Scan Backward/);
        expect(text).toContain('Comments_id_user_id_idx');
        expect(text).not.toMatch(/Sort|Seq Scan/);
      });

      it('should serve the authors of a student from the same index', async () => {
        const student = await createStudent();
        const noisy = await createStudent();
        const author = await createAuthor();
        await addComments(30, { student, author });
        await prisma.$executeRaw`INSERT INTO "Comments" ("comment", "id_user", "id_author", "author_name") SELECT 'ruído', ${noisy.id}::int, ${author.id}::int, 'Autor' FROM generate_series(1, 30000)`;
        await prisma.$executeRaw`ANALYZE "Comments"`;

        const plan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>(
          Prisma.sql`EXPLAIN (COSTS OFF) ${authorsSql(student.id)}`,
        );
        const text = plan.map((row) => row['QUERY PLAN']).join('\n');

        expect(text).toContain('Comments_id_user_id_idx');
        expect(text).not.toContain('Seq Scan');
      });
    });
  },
);
