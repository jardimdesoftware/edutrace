import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReferralKind, ServiceStatus } from '@prisma/client';
import { AeeReferralsService } from 'src/aee-referrals/aee-referrals.service';
import { AEE_SERVICE_CAPACITY, LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. O limite de atendimentos e a
// disputa por um mesmo professor se decidem na trava de linha e nos CHECKs do
// banco, que os testes unitários não exercitam. O spec apaga só as contas do
// domínio de e-mail dele, e o beforeAll recusa rodar num banco cujo nome não
// termine em "_it".
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@encam.test';
const NAPNE = { sub: 1, name: 'Ana NAPNE' };

(integrationDatabaseUrl ? describe : describe.skip)(
  'AeeReferralsService contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: AeeReferralsService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const createAccount = (roles: number[], extra: object = {}) => {
      const n = ++sequence;
      const isStudent = roles.includes(LEVELS.ALUNO_ESTUDANTE);
      return prisma.user.create({
        data: {
          full_name: 'Conta ' + n,
          cpf: '26' + String(n).padStart(9, '0'),
          email: 'conta' + n + EMAIL_DOMAIN,
          password: 'x',
          roles,
          id_current_phase: PHASES.TRIAGEM,
          ...(isStudent
            ? {
                service_status: ServiceStatus.WAITING,
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
    const createTeacher = () => createAccount([LEVELS.PROFESSOR_AEE]);

    const putInService = (studentId: number, teacherId: number) =>
      prisma.user.update({
        where: { id: studentId },
        data: {
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: teacherId,
          service_started_at: new Date(),
        },
      });

    const deleteFixtures = async () => {
      const where = { email: { endsWith: EMAIL_DOMAIN } };
      await prisma.aeeReferral.deleteMany({ where: { student: where } });
      // O CHECK do banco exige professor para quem está em atendimento: o
      // estudante volta à fila antes de perder o professor.
      await prisma.user.updateMany({
        where: { ...where, roles: { has: LEVELS.ALUNO_ESTUDANTE } },
        data: {
          service_status: ServiceStatus.WAITING,
          service_started_at: null,
          service_closed_at: null,
          aee_responsible_id: null,
        },
      });
      await prisma.user.deleteMany({ where });
    };

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      process.env.DATABASE_URL = requireIntegrationDatabaseUrl(
        integrationDatabaseUrl,
      );

      const module = await Test.createTestingModule({
        providers: [AeeReferralsService, PrismaService],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(AeeReferralsService);

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

    it('should put a waiting student in service with the teacher and leave the notice for him', async () => {
      const teacher = await createTeacher();
      const student = await createStudent();

      await service.refer(student.email, teacher.id, NAPNE);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(row.service_status).toBe(ServiceStatus.IN_SERVICE);
      expect(row.aee_responsible_id).toBe(teacher.id);
      const notices = await service.pending(teacher.id);
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({
        kind: ReferralKind.ASSIGNED,
        student_name: student.full_name,
        from_name: 'Ana NAPNE',
      });
    });

    it('should move a student between teachers, warning the new one and the one who lost him', async () => {
      const first = await createTeacher();
      const second = await createTeacher();
      const student = await createStudent();
      await putInService(student.id, first.id);

      const result = await service.refer(student.email, second.id, NAPNE);

      expect(result.previous_teacher_id).toBe(first.id);
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(row.aee_responsible_id).toBe(second.id);
      expect((await service.pending(second.id))[0].kind).toBe(
        ReferralKind.ASSIGNED,
      );
      expect((await service.pending(first.id))[0].kind).toBe(
        ReferralKind.REMOVED,
      );
    });

    it('should refuse the teacher that already attends the limit, keeping the student where he was', async () => {
      const teacher = await createTeacher();
      for (let n = 0; n < AEE_SERVICE_CAPACITY; n++) {
        const filled = await createStudent();
        await putInService(filled.id, teacher.id);
      }
      const student = await createStudent();

      await expect(
        service.refer(student.email, teacher.id, NAPNE),
      ).rejects.toBeInstanceOf(ConflictException);

      const row = await prisma.user.findUniqueOrThrow({
        where: { id: student.id },
      });
      expect(row.service_status).toBe(ServiceStatus.WAITING);
      expect(await service.pending(teacher.id)).toHaveLength(0);
    });

    it('should never pass the limit when several students are referred to the same teacher at once', async () => {
      const teacher = await createTeacher();
      for (let n = 0; n < AEE_SERVICE_CAPACITY - 1; n++) {
        const filled = await createStudent();
        await putInService(filled.id, teacher.id);
      }
      const candidates = await Promise.all([
        createStudent(),
        createStudent(),
        createStudent(),
      ]);

      const results = await Promise.allSettled(
        candidates.map((student) =>
          service.refer(student.email, teacher.id, NAPNE),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await prisma.user.count({
          where: {
            aee_responsible_id: teacher.id,
            service_status: ServiceStatus.IN_SERVICE,
          },
        }),
      ).toBe(AEE_SERVICE_CAPACITY);
    });

    it('should refuse a closed student and a student already with that teacher', async () => {
      const teacher = await createTeacher();
      const closed = await createStudent({
        service_status: ServiceStatus.CLOSED,
        service_closed_at: new Date(),
        aee_responsible_id: teacher.id,
        service_started_at: new Date(),
      });
      const attended = await createStudent();
      await putInService(attended.id, teacher.id);

      await expect(
        service.refer(closed.email, teacher.id, NAPNE),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.refer(attended.email, teacher.id, NAPNE),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should keep the notices apart by teacher and mark only the ones of the caller as seen', async () => {
      const first = await createTeacher();
      const second = await createTeacher();
      await service.refer((await createStudent()).email, first.id, NAPNE);
      await service.refer((await createStudent()).email, second.id, NAPNE);
      const ofSecond = await service.pending(second.id);

      const result = await service.markSeen(
        first.id,
        ofSecond.map((n) => n.id),
      );

      expect(result.marked).toBe(0);
      expect(await service.pending(second.id)).toHaveLength(1);
      expect((await service.markSeen(first.id)).marked).toBe(1);
      expect(await service.pending(first.id)).toHaveLength(0);
    });

    it('should delete the notices together with the account of the teacher', async () => {
      const teacher = await createTeacher();
      const student = await createStudent();
      await service.refer(student.email, teacher.id, NAPNE);
      await prisma.user.update({
        where: { id: student.id },
        data: {
          aee_responsible_id: null,
          service_status: ServiceStatus.WAITING,
          service_started_at: null,
        },
      });

      await prisma.user.delete({ where: { id: teacher.id } });

      expect(
        await prisma.aeeReferral.count({ where: { id_to: teacher.id } }),
      ).toBe(0);
    });
  },
);
