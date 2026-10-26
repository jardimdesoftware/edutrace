import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CommentType } from '@prisma/client';
import { CommentsService } from 'src/comments/comments.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { CreateCommentDto } from 'src/comments/dto/create-comment.dto';
import { MailService } from 'src/mail/mail.service';
import { StudentsService } from 'src/students/students.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. O tipo da anotação é uma coluna
// NOT NULL DEFAULT 'NOTE' de um enum do banco: o default que preenche as
// anotações antigas, o NOT NULL e a recusa de um valor fora do enum só existem
// no PostgreSQL, e um Prisma mockado não executa nenhum dos três.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail (as anotações são apagadas antes, e o
// histórico de edições vai junto, por CASCADE), e nunca a tabela inteira. O
// beforeAll recusa rodar num banco cujo nome não termine em "_it". O CPF usa o
// prefixo 26 (estudante) e 27 (profissional), que nenhum outro spec de
// integração usa.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@anotacoes.test';

(integrationDatabaseUrl ? describe : describe.skip)(
  'Tipo da anotação contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: CommentsService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    function createAccount(id_level: number) {
      const n = nextNumber();
      const isStudent = id_level === LEVELS.ALUNO_ESTUDANTE;
      return prisma.user.create({
        data: {
          full_name: `Conta ${n}`,
          cpf: `${isStudent ? 26 : 27}${String(n).padStart(9, '0')}`,
          email: `conta${n}${EMAIL_DOMAIN}`,
          password: 'x',
          roles: [id_level],
          id_current_phase: PHASES.TRIAGEM,
          ...(isStudent
            ? { service_status: 'WAITING' as const, queued_at: new Date() }
            : {}),
        },
      });
    }

    const createStudent = () => createAccount(LEVELS.ALUNO_ESTUDANTE);
    const createProfessional = () =>
      createAccount(LEVELS.PROFISSIONAL_EDUCACAO);

    // O corpo passa pelo pipe real, como na rota: o service recebe a instância
    // do DTO.
    async function dtoOf(body: object) {
      return (await createValidationPipe().transform(body, {
        type: 'body',
        metatype: CreateCommentDto,
      })) as CreateCommentDto;
    }

    const requestOf = (id: number, id_level: number) =>
      ({
        user: {
          sub: id,
          roles: [id_level],
          email: 'quem.pede@example.com',
          name: 'Quem',
        },
      }) as AuthenticatedRequest;

    const deleteFixtures = async () => {
      await prisma.comments.deleteMany({
        where: { user: { email: { endsWith: EMAIL_DOMAIN } } },
      });
      await prisma.user.deleteMany({
        where: { email: { endsWith: EMAIL_DOMAIN } },
      });
    };

    // O INSERT omite o type, como o de uma versão do código que não o conhece.
    const insertWithoutType = (id_user: number, id_author: number) =>
      prisma.$executeRaw`INSERT INTO "Comments" ("comment", "id_user", "id_author", "author_name") VALUES ('Texto', ${id_user}, ${id_author}, 'Autor')`;

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

      // O banco do job nasce só com as migrations, sem o seed. O createMany
      // com skipDuplicates é um INSERT ... ON CONFLICT DO NOTHING, que não
      // falha para o spec que perde a corrida dos que rodam em paralelo.
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

    describe('a coluna type', () => {
      it('should exist as NOT NULL of the CommentType enum, with NOTE as the default', async () => {
        const columns = await prisma.$queryRaw<
          { is_nullable: string; column_default: string; udt_name: string }[]
        >`SELECT is_nullable, column_default, udt_name FROM information_schema.columns WHERE table_name = 'Comments' AND column_name = 'type'`;

        expect(columns).toEqual([
          {
            is_nullable: 'NO',
            column_default: `'NOTE'::"CommentType"`,
            udt_name: 'CommentType',
          },
        ]);
      });

      it('should accept only the two values of the contract in the enum', async () => {
        const labels = await prisma.$queryRaw<
          { enumlabel: string }[]
        >`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'CommentType' ORDER BY e.enumsortorder`;

        expect(labels.map((row) => row.enumlabel)).toEqual([
          'NOTE',
          'CLASS_COUNCIL_REPORT',
        ]);
      });

      it('should record a NOTE for an insert that does not inform the type', async () => {
        const student = await createStudent();
        const author = await createProfessional();

        await insertWithoutType(student.id, author.id);

        const rows = await prisma.comments.findMany({
          where: { id_user: student.id },
        });
        expect(rows.map((row) => row.type)).toEqual([CommentType.NOTE]);
      });

      it('should record a NOTE for a create of the Prisma Client without the type', async () => {
        const student = await createStudent();
        const author = await createProfessional();

        const created = await prisma.comments.create({
          data: {
            comment: 'Texto',
            id_user: student.id,
            id_author: author.id,
            author_name: 'Autor',
          },
        });

        expect(created.type).toBe(CommentType.NOTE);
      });

      it('should refuse a value outside the enum', async () => {
        const student = await createStudent();
        const author = await createProfessional();

        await expect(
          prisma.$executeRaw`INSERT INTO "Comments" ("comment", "type", "id_user", "id_author", "author_name") VALUES ('Texto', 'OTHER'::"CommentType", ${student.id}, ${author.id}, 'Autor')`,
        ).rejects.toThrow(/invalid input value for enum/);
        expect(
          await prisma.comments.count({ where: { id_user: student.id } }),
        ).toBe(0);
      });

      it('should refuse a null type', async () => {
        const student = await createStudent();
        const author = await createProfessional();

        await expect(
          prisma.$executeRaw`INSERT INTO "Comments" ("comment", "type", "id_user", "id_author", "author_name") VALUES ('Texto', NULL, ${student.id}, ${author.id}, 'Autor')`,
        ).rejects.toThrow(/null value in column "type"/);
      });
    });

    describe('o relatório pelo service', () => {
      it('should store a report of 10000 characters and read it back with its type', async () => {
        const student = await createStudent();
        const author = await createProfessional();
        const text = 'ç'.repeat(10000);

        const created = await service.create(
          await dtoOf({
            id_user: student.id,
            comment: text,
            type: CommentType.CLASS_COUNCIL_REPORT,
          }),
          author.id,
          'Autor',
          [LEVELS.PROFISSIONAL_EDUCACAO],
        );
        const read = await service.findAllByIdUser(
          student.id,
          {},
          requestOf(author.id, LEVELS.PROFISSIONAL_EDUCACAO),
        );

        expect(created.type).toBe(CommentType.CLASS_COUNCIL_REPORT);
        expect(read.items).toHaveLength(1);
        expect(read.items[0]).toMatchObject({
          id: created.id,
          type: CommentType.CLASS_COUNCIL_REPORT,
          comment: text,
        });
      });

      it('should store a NOTE when the body has no type', async () => {
        const student = await createStudent();
        const author = await createProfessional();

        const created = await service.create(
          await dtoOf({ id_user: student.id, comment: 'Texto' }),
          author.id,
          'Autor',
          [LEVELS.PROFISSIONAL_EDUCACAO],
        );

        expect(created.type).toBe(CommentType.NOTE);
      });

      it('should keep the type and the history when the author edits the report', async () => {
        const student = await createStudent();
        const author = await createProfessional();
        const created = await service.create(
          await dtoOf({
            id_user: student.id,
            comment: 'Relatório original',
            type: CommentType.CLASS_COUNCIL_REPORT,
          }),
          author.id,
          'Autor',
          [LEVELS.PROFISSIONAL_EDUCACAO],
        );

        const updated = await service.update(
          created.id,
          { comment: 'a'.repeat(5000) },
          requestOf(author.id, LEVELS.PROFISSIONAL_EDUCACAO),
        );

        expect(updated.type).toBe(CommentType.CLASS_COUNCIL_REPORT);
        expect(updated.comment).toBe('a'.repeat(5000));
        expect(updated.edits.map((edit) => edit.comment)).toEqual([
          'Relatório original',
        ]);
      });

      it('should refuse to edit a stored NOTE above 1000 characters and leave the row untouched', async () => {
        const student = await createStudent();
        const author = await createProfessional();
        const created = await service.create(
          await dtoOf({ id_user: student.id, comment: 'Texto original' }),
          author.id,
          'Autor',
          [LEVELS.PROFISSIONAL_EDUCACAO],
        );

        await expect(
          service.update(
            created.id,
            { comment: 'a'.repeat(1001) },
            requestOf(author.id, LEVELS.PROFISSIONAL_EDUCACAO),
          ),
        ).rejects.toThrow(BadRequestException);

        const row = await prisma.comments.findUniqueOrThrow({
          where: { id: created.id },
          include: { edits: true },
        });
        expect(row.comment).toBe('Texto original');
        expect(row.edits).toHaveLength(0);
      });
    });
  },
);
