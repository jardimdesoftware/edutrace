import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersService } from 'src/users/users.service';
import { LEVELS, PHASES, USER_DELETION_GRACE_DAYS } from 'src/constants';
import { requireIntegrationDatabaseUrl } from './integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. O fechamento da carência decide
// entre apagar e desativar com base nas chaves estrangeiras e no CHECK do banco,
// que os testes unitários, com o Prisma mockado, não exercitam. O spec apaga só
// as contas do domínio de e-mail dele, e o beforeAll recusa rodar num banco cujo
// nome não termine em "_it".
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@desativ.test';
const DAY_MS = 24 * 60 * 60 * 1000;

(integrationDatabaseUrl ? describe : describe.skip)(
  'UsersService contra o PostgreSQL, desativação',
  () => {
    let prisma: PrismaService;
    let service: UsersService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

    const createAccount = (roles: number[], extra: object = {}) => {
      const n = ++sequence;
      const isStudent = roles.includes(LEVELS.ALUNO_ESTUDANTE);
      return prisma.user.create({
        data: {
          full_name: `Conta ${n}`,
          cpf: `25${String(n).padStart(9, '0')}`,
          email: `conta${n}${EMAIL_DOMAIN}`,
          password: 'x',
          roles,
          id_current_phase: PHASES.TRIAGEM,
          ...(isStudent
            ? {
                service_status: 'WAITING' as const,
                queued_at: new Date(),
                course: 'Análise e Desenvolvimento de Sistemas',
              }
            : {}),
          ...extra,
        },
      });
    };

    const createStudent = (extra: object = {}) =>
      createAccount([LEVELS.ALUNO_ESTUDANTE], extra);
    const createProfessional = (extra: object = {}) =>
      createAccount([LEVELS.PROFISSIONAL_EDUCACAO], extra);

    // Marca como a exclusão marcaria, só que há "days" dias.
    const markedDaysAgo = (id: number, days: number) =>
      prisma.user.update({
        where: { id },
        data: { deleted_at: daysAgo(days) },
      });

    const exists = async (id: number) =>
      (await prisma.user.count({ where: { id } })) === 1;

    const comment = (authorId: number, authorName: string, studentId: number) =>
      prisma.comments.create({
        data: {
          comment: 'anotação',
          id_author: authorId,
          author_name: authorName,
          id_user: studentId,
        },
      });

    const SECTIONS = {
      identification: {},
      general_info: {},
      school_history: {},
      pedagogical_aspects: {},
      behavioral_social: {},
      potentialities_interests: '',
      barriers: '',
      resources_strategies: {},
      pei_recommendations: {},
      aee_opinion: {},
    };

    const deleteFixtures = async () => {
      const where = { email: { endsWith: EMAIL_DOMAIN } };
      await prisma.comments.deleteMany({ where: { user: where } });
      await prisma.caseStudy.deleteMany({ where: { student: where } });
      await prisma.user.deleteMany({ where });
    };

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      process.env.DATABASE_URL = requireIntegrationDatabaseUrl(
        integrationDatabaseUrl,
      );

      const module = await Test.createTestingModule({
        providers: [
          UsersService,
          PrismaService,
          {
            provide: SessionsService,
            useValue: { revokeAllFromUser: jest.fn() },
          },
          {
            provide: MailService,
            useValue: { sendAccountActivationLink: jest.fn() },
          },
        ],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(UsersService);

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

    describe('fim da carência', () => {
      it('should delete the user that has no data', async () => {
        const student = await createStudent();
        await markedDaysAgo(student.id, USER_DELETION_GRACE_DAYS + 1);

        const result = await service.purgeExpired();

        expect(result.deleted).toBeGreaterThanOrEqual(1);
        expect(await exists(student.id)).toBe(false);
      });

      it('should deactivate, not delete, a student that has data about him, keeping the data', async () => {
        const author = await createProfessional();
        const student = await createStudent();
        await comment(author.id, author.full_name, student.id);
        await markedDaysAgo(student.id, USER_DELETION_GRACE_DAYS + 1);

        await service.purgeExpired();

        const kept = await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
        });
        expect(kept.deactivated_at).not.toBeNull();
        expect(kept.deleted_at).not.toBeNull();
        expect(
          await prisma.comments.count({ where: { id_user: student.id } }),
        ).toBe(1);
      });

      it('should deactivate a professional and keep him as the author of what he wrote', async () => {
        const professional = await createProfessional();
        const student = await createStudent();
        await prisma.caseStudy.create({
          data: {
            ...SECTIONS,
            id_student: student.id,
            id_author: professional.id,
          },
        });
        await markedDaysAgo(professional.id, USER_DELETION_GRACE_DAYS + 1);

        await service.purgeExpired();

        const kept = await prisma.user.findUniqueOrThrow({
          where: { id: professional.id },
        });
        expect(kept.deactivated_at).not.toBeNull();
        const caseStudy = await prisma.caseStudy.findUniqueOrThrow({
          where: { id_student: student.id },
        });
        expect(caseStudy.id_author).toBe(professional.id);
      });

      it('should leave alone who is still inside the grace period', async () => {
        const student = await createStudent();
        await markedDaysAgo(student.id, USER_DELETION_GRACE_DAYS - 1);

        await service.purgeExpired();

        const row = await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
        });
        expect(row.deactivated_at).toBeNull();
        expect(row.deleted_at).not.toBeNull();
      });

      it('should do nothing the second time, so the job can repeat', async () => {
        const author = await createProfessional();
        const student = await createStudent();
        await comment(author.id, author.full_name, student.id);
        await markedDaysAgo(student.id, USER_DELETION_GRACE_DAYS + 1);
        await service.purgeExpired();
        const first = await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
        });

        const second = await service.purgeExpired();

        expect(second.deactivated).toBe(0);
        const again = await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
        });
        expect(again.deactivated_at).toEqual(first.deactivated_at);
      });

      it('should never delete a user that got data during the grace period', async () => {
        const author = await createProfessional();
        const student = await createStudent();
        await markedDaysAgo(student.id, USER_DELETION_GRACE_DAYS + 1);
        await comment(author.id, author.full_name, student.id);

        await service.purgeExpired();

        expect(await exists(student.id)).toBe(true);
      });

      it('should refuse to delete, on the definitive path, a user that has data', async () => {
        const author = await createProfessional();
        const student = await createStudent();
        await comment(author.id, author.full_name, student.id);

        await expect(service.remove(student.id)).rejects.toBeInstanceOf(
          ConflictException,
        );

        expect(await exists(student.id)).toBe(true);
      });
    });

    describe('marcar para exclusão', () => {
      it('should start the grace period of a user that has data, without refusing', async () => {
        const admin = await createAccount([LEVELS.ADMIN]);
        const author = await createProfessional();
        const student = await createStudent();
        await comment(author.id, author.full_name, student.id);

        const marked = await service.markForDeletion(student.id, admin.id);

        expect(marked.deleted_at).not.toBeNull();
        expect(marked.deactivated_at).toBeNull();
      });

      it('should send the students of a professional back to no pedagogical manager', async () => {
        const admin = await createAccount([LEVELS.ADMIN]);
        const professional = await createProfessional();
        const student = await createStudent({
          pedagogical_manager_id: professional.id,
        });

        await service.markForDeletion(professional.id, admin.id);

        const row = await prisma.user.findUniqueOrThrow({
          where: { id: student.id },
        });
        expect(row.pedagogical_manager_id).toBeNull();
      });
    });

    describe('reativar', () => {
      it('should clear both marks of a deactivated user, with no deadline', async () => {
        const student = await createStudent({
          deleted_at: daysAgo(400),
          deactivated_at: daysAgo(390),
        });

        const restored = await service.restore(student.id);

        expect(restored.deleted_at).toBeNull();
        expect(restored.deactivated_at).toBeNull();
      });
    });

    describe('lista do administrador', () => {
      it('should hide the deactivated users by default and show only them on request', async () => {
        const active = await createStudent();
        const grace = await createStudent({ deleted_at: daysAgo(2) });
        const deactivated = await createStudent({
          deleted_at: daysAgo(30),
          deactivated_at: daysAgo(23),
        });
        const ids = (users: { id: number }[]) => users.map((u) => u.id);

        const byDefault = ids(await service.findAll());
        const onlyGrace = ids(await service.findAll('carencia'));
        const onlyDeactivated = ids(await service.findAll('desativados'));

        expect(byDefault).toEqual(
          expect.arrayContaining([active.id, grace.id]),
        );
        expect(byDefault).not.toContain(deactivated.id);
        expect(onlyGrace).toContain(grace.id);
        expect(onlyGrace).not.toContain(active.id);
        expect(onlyGrace).not.toContain(deactivated.id);
        expect(onlyDeactivated).toContain(deactivated.id);
        expect(onlyDeactivated).not.toContain(active.id);
        expect(onlyDeactivated).not.toContain(grace.id);
      });
    });

    describe('CHECK do banco', () => {
      it('should refuse a deactivated user that still has access', async () => {
        const student = await createStudent();

        await expect(
          prisma.user.update({
            where: { id: student.id },
            data: { deactivated_at: new Date() },
          }),
        ).rejects.toThrow();
      });
    });
  },
);
