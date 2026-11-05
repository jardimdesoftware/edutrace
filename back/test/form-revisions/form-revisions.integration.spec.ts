import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FormType } from '@prisma/client';
import { FORM_MAX_VERSIONS, LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { FormRevisionsService } from 'src/form-revisions/form-revisions.service';
import { StudentsService } from 'src/students/students.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. O teto de versões e a disputa pelo
// mesmo número de versão se decidem no índice único e no CHECK do banco, que
// os testes unitários, com o Prisma mockado, não exercitam. O spec apaga só as
// contas do domínio de e-mail dele, e o beforeAll recusa rodar num banco cujo
// nome não termine em "_it".
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@revisions.test';
const AUTHOR = { id: 1, name: 'Autor de Teste' };
const TARGET_TYPE = FormType.ANAMNESIS;

(integrationDatabaseUrl ? describe : describe.skip)(
  'FormRevisionsService contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: FormRevisionsService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const createStudent = () => {
      const n = ++sequence;
      return prisma.user.create({
        data: {
          full_name: `Estudante ${n}`,
          cpf: `24${String(n).padStart(9, '0')}`,
          email: `estudante${n}${EMAIL_DOMAIN}`,
          password: 'x',
          roles: [LEVELS.ALUNO_ESTUDANTE],
          id_current_phase: PHASES.TRIAGEM,
          service_status: 'WAITING' as const,
          queued_at: new Date(),
          course: 'Análise e Desenvolvimento de Sistemas',
        },
      });
    };

    const record = (idStudent: number, label: string) =>
      prisma.$transaction((tx) =>
        service.recordEdit(
          tx,
          { formType: TARGET_TYPE, idStudent },
          {
            before: { label: 'antes' },
            beforeAt: new Date('2026-01-01T00:00:00Z'),
            after: { label },
          },
          AUTHOR,
        ),
      );

    const versionsOf = (idStudent: number) =>
      prisma.formRevision.findMany({
        where: { id_student: idStudent, form_type: TARGET_TYPE },
        orderBy: { version: 'asc' },
      });

    const deleteFixtures = () =>
      prisma.user.deleteMany({
        where: { email: { endsWith: EMAIL_DOMAIN } },
      });

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      process.env.DATABASE_URL = requireIntegrationDatabaseUrl(
        integrationDatabaseUrl,
      );

      const module = await Test.createTestingModule({
        providers: [FormRevisionsService, StudentsService, PrismaService],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(FormRevisionsService);

      await prisma.currentPhases.createMany({
        data: [{ id: PHASES.TRIAGEM, name: 'Triagem' }],
        skipDuplicates: true,
      });
    });

    beforeEach(deleteFixtures);

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

    it('should keep the creation and four edits, and refuse the sixth version with 409', async () => {
      const student = await createStudent();
      await prisma.$transaction((tx) =>
        service.recordCreation(
          tx,
          { formType: TARGET_TYPE, idStudent: student.id },
          { label: 'criação' },
          AUTHOR,
        ),
      );

      for (let edit = 1; edit < FORM_MAX_VERSIONS; edit++) {
        await record(student.id, `edição ${edit}`);
      }
      await expect(record(student.id, 'edição demais')).rejects.toBeInstanceOf(
        ConflictException,
      );

      const versions = await versionsOf(student.id);
      expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5]);
      expect(versions[4].snapshot).toEqual({ label: 'edição 4' });
      expect(versions[4].author_name).toBe('Autor de Teste');
    });

    it('should store the previous state as version 1 for a form that had no history', async () => {
      const student = await createStudent();

      await record(student.id, 'primeira edição');

      const versions = await versionsOf(student.id);
      expect(versions.map((v) => v.version)).toEqual([1, 2]);
      expect(versions[0].snapshot).toEqual({ label: 'antes' });
      expect(versions[0].author_name).toBe('Autor não registrado');
      expect(versions[0].id_author).toBeNull();
      expect(versions[1].snapshot).toEqual({ label: 'primeira edição' });
    });

    it('should let only one of three simultaneous edits take the last free version', async () => {
      const student = await createStudent();
      await record(student.id, 'edição 1');
      await record(student.id, 'edição 2');
      await record(student.id, 'edição 3');

      const results = await Promise.allSettled([
        record(student.id, 'a'),
        record(student.id, 'b'),
        record(student.id, 'c'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      rejected.forEach((r) =>
        expect(r.reason).toBeInstanceOf(ConflictException),
      );
      expect((await versionsOf(student.id)).map((v) => v.version)).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it('should refuse a sixth version written straight to the table', async () => {
      const student = await createStudent();

      await expect(
        prisma.formRevision.create({
          data: {
            form_type: TARGET_TYPE,
            id_student: student.id,
            version: FORM_MAX_VERSIONS + 1,
            snapshot: {},
            author_name: 'x',
          },
        }),
      ).rejects.toThrow();
    });

    it('should start again at version 1 after the history is deleted', async () => {
      const student = await createStudent();
      await record(student.id, 'edição 1');
      await prisma.$transaction((tx) =>
        service.removeAll(tx, {
          formType: TARGET_TYPE,
          idStudent: student.id,
        }),
      );

      expect(await versionsOf(student.id)).toHaveLength(0);
      await prisma.$transaction((tx) =>
        service.recordCreation(
          tx,
          { formType: TARGET_TYPE, idStudent: student.id },
          { label: 'recriado' },
          AUTHOR,
        ),
      );
      expect((await versionsOf(student.id)).map((v) => v.version)).toEqual([1]);
    });

    it('should keep the histories of two forms of the same student apart', async () => {
      const student = await createStudent();
      await record(student.id, 'anamnese');
      await prisma.$transaction((tx) =>
        service.recordCreation(
          tx,
          { formType: FormType.SCREENING, idStudent: student.id },
          { label: 'triagem' },
          AUTHOR,
        ),
      );

      expect(await versionsOf(student.id)).toHaveLength(2);
      expect(
        await prisma.formRevision.count({
          where: { id_student: student.id, form_type: FormType.SCREENING },
        }),
      ).toBe(1);
    });

    it('should delete the history together with the student account', async () => {
      const student = await createStudent();
      await record(student.id, 'edição 1');

      await prisma.user.delete({ where: { id: student.id } });

      expect(
        await prisma.formRevision.count({ where: { id_student: student.id } }),
      ).toBe(0);
    });
  },
);
