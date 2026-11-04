import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersService } from 'src/users/users.service';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsService } from 'src/students/students.service';
import { AEE_SERVICE_CAPACITY, LEVELS, PHASES } from 'src/constants';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. A garantia de que dois "assumir"
// simultâneos não passam do limite do Professor do AEE nem atribuem o mesmo
// estudante a dois professores vem do bloqueio de linha e do UPDATE condicional, e um
// Prisma mockado não executa nenhum dos dois.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail, e nunca a tabela inteira.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@fila.test';
const LIMIT_MESSAGE = 'Você já atende o limite de 15 estudantes.';

(integrationDatabaseUrl ? describe : describe.skip)(
  'Fila de atendimento do Professor do AEE contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let queue: ServiceQueueService;
    let stats: ServiceStatsService;
    let users: UsersService;
    let originalDatabaseUrl: string | undefined;
    let originalFrontendUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    async function createStudent(status: ServiceStatus = 'WAITING') {
      const n = nextNumber();
      return prisma.user.create({
        data: {
          full_name: `Estudante ${n}`,
          cpf: `5${String(n).padStart(10, '0')}`,
          email: `aluno${n}${EMAIL_DOMAIN}`,
          password: 'x',
          roles: [LEVELS.ALUNO_ESTUDANTE],
          id_current_phase: PHASES.TRIAGEM,
          service_status: status,
          queued_at: new Date(Date.now() - 60_000),
        },
      });
    }

    async function createTeacher(
      fullName?: string,
      roles: number[] = [LEVELS.PROFESSOR_AEE],
    ) {
      const n = nextNumber();
      return prisma.user.create({
        data: {
          full_name: fullName ?? `Professor ${n}`,
          cpf: `6${String(n).padStart(10, '0')}`,
          email: `professor${n}${EMAIL_DOMAIN}`,
          password: 'x',
          roles,
          id_current_phase: PHASES.TRIAGEM,
        },
      });
    }

    const inServiceOf = (teacherId: number) =>
      prisma.user.count({
        where: {
          aee_responsible_id: teacherId,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });

    const statusOf = (email: string) =>
      prisma.user.findUniqueOrThrow({
        where: { email },
        select: {
          service_status: true,
          aee_responsible_id: true,
          service_started_at: true,
          service_closed_at: true,
          queued_at: true,
        },
      });

    // Espera até que alguma conexão esteja bloqueada pela transação cujo
    // backend é holderPid. Os specs de integração rodam em paralelo no mesmo
    // banco, e uma espera de trava de outro spec não conta: o bloqueio tem que
    // vir da transação que este teste mantém aberta.
    async function waitUntilBlockedBy(holderPid: number) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const [{ blocked }] = await prisma.$queryRaw<{ blocked: number }[]>`
          SELECT count(*)::int AS blocked FROM pg_stat_activity
          WHERE datname = current_database()
            AND pg_blocking_pids(pid) @> ARRAY[${holderPid}::int]`;
        if (blocked > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        `Nenhuma conexão ficou bloqueada pela transação do backend ${holderPid}.`,
      );
    }

    const deleteFixtures = () =>
      prisma.user.deleteMany({
        where: { email: { endsWith: EMAIL_DOMAIN } },
      });

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;
      originalFrontendUrl = process.env.FRONTEND_URL;

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      const databaseUrl = requireIntegrationDatabaseUrl(integrationDatabaseUrl);

      // O PrismaService lê a conexão de DATABASE_URL.
      process.env.DATABASE_URL = databaseUrl;
      process.env.FRONTEND_URL = 'https://edutrace.example.com';

      const module = await Test.createTestingModule({
        providers: [
          UsersService,
          StudentsService,
          ServiceQueueService,
          ServiceStatsService,
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
      queue = module.get(ServiceQueueService);
      stats = module.get(ServiceStatsService);
      users = module.get(UsersService);
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
      if (originalFrontendUrl === undefined) {
        delete process.env.FRONTEND_URL;
      } else {
        process.env.FRONTEND_URL = originalFrontendUrl;
      }
    });

    // O banco do job nasce só com as migrations, sem o seed: os níveis e a
    // fase que as contas referenciam precisam existir. Os specs de integração
    // rodam em paralelo num banco novo, e dois upserts do mesmo nível
    // disputariam a inserção (Level_pkey). O createMany com skipDuplicates é um
    // INSERT ... ON CONFLICT DO NOTHING, que não falha para quem perde.
    beforeEach(async () => {
      await deleteFixtures();
      await prisma.currentPhases.createMany({
        data: [{ id: PHASES.TRIAGEM, name: 'Triagem' }],
        skipDuplicates: true,
      });
    });

    describe('concorrência', () => {
      it('should put exactly 15 in service when twenty assumes run at once', async () => {
        const teacher = await createTeacher();
        const students = await Promise.all(
          Array.from({ length: 20 }, () => createStudent()),
        );

        const results = await Promise.allSettled(
          students.map((student) =>
            queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]),
          ),
        );

        const rejected = results.filter((r) => r.status === 'rejected');
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(
          AEE_SERVICE_CAPACITY,
        );
        expect(rejected).toHaveLength(5);
        for (const { reason } of rejected) {
          expect(reason).toBeInstanceOf(ConflictException);
          expect((reason as ConflictException).message).toBe(LIMIT_MESSAGE);
        }
        await expect(inServiceOf(teacher.id)).resolves.toBe(15);
        await expect(
          prisma.user.count({
            where: {
              email: { endsWith: EMAIL_DOMAIN },
              service_status: ServiceStatus.WAITING,
            },
          }),
        ).resolves.toBe(5);
      });

      it('should accept one and refuse one when two assumes race for the last slot', async () => {
        const teacher = await createTeacher();
        const taken = await Promise.all(
          Array.from({ length: 14 }, () => createStudent()),
        );
        for (const student of taken) {
          await queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]);
        }
        const [first, second] = await Promise.all([
          createStudent(),
          createStudent(),
        ]);

        const results = await Promise.allSettled([
          queue.assume(first.email, teacher.id, [LEVELS.PROFESSOR_AEE]),
          queue.assume(second.email, teacher.id, [LEVELS.PROFESSOR_AEE]),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const [rejected] = results.filter((r) => r.status === 'rejected');
        expect(rejected.reason).toBeInstanceOf(ConflictException);
        expect((rejected.reason as ConflictException).message).toBe(
          LIMIT_MESSAGE,
        );
        await expect(inServiceOf(teacher.id)).resolves.toBe(15);
      });

      it('should give each student to exactly one teacher when two of them take the same students at once', async () => {
        const first = await createTeacher();
        const second = await createTeacher();
        const students = await Promise.all(
          Array.from({ length: 8 }, () => createStudent()),
        );

        const results = await Promise.allSettled(
          students.flatMap((student) => [
            queue.assume(student.email, first.id, [LEVELS.PROFESSOR_AEE]),
            queue.assume(student.email, second.id, [LEVELS.PROFESSOR_AEE]),
          ]),
        );

        const rejected = results.filter((r) => r.status === 'rejected');
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(8);
        expect(rejected).toHaveLength(8);
        for (const { reason } of rejected) {
          expect(reason).toBeInstanceOf(ConflictException);
          expect((reason as ConflictException).message).toBe(
            'O estudante não está na fila de espera.',
          );
        }
        const taken = await Promise.all([
          inServiceOf(first.id),
          inServiceOf(second.id),
        ]);
        expect(taken[0] + taken[1]).toBe(8);
      });

      it('should never leave an AEE teacher with students in service without the role', async () => {
        const teacher = await createTeacher();
        const students = await Promise.all(
          Array.from({ length: 5 }, () => createStudent()),
        );

        await Promise.allSettled([
          ...students.map((student) =>
            queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]),
          ),
          users.update(teacher.email, { roles: [LEVELS.PROFISSIONAL_SAUDE] }),
        ]);

        const after = await prisma.user.findUniqueOrThrow({
          where: { id: teacher.id },
          select: { roles: true },
        });
        const inService = await inServiceOf(teacher.id);

        const stillTeacher = after.roles.includes(LEVELS.PROFESSOR_AEE);
        expect(stillTeacher || inService === 0).toBe(true);
      });

      // Determinístico: o "assumir" é simulado por uma transação que trava a
      // linha do professor, e a troca de papéis (ou a exclusão) chega no meio
      // dela. Sem o FOR UPDATE, a operação contaria os atendimentos antes do
      // commit, enxergaria zero e tiraria o papel de um professor que passou a
      // ter um estudante em atendimento.
      it.each([
        [
          'the role change',
          (teacher: { id: number; email: string }) =>
            users.update(teacher.email, { roles: [LEVELS.PROFISSIONAL_SAUDE] }),
        ],
        [
          'the deletion',
          (teacher: { id: number; email: string }) => users.remove(teacher.id),
        ],
      ])(
        'should make %s wait for an assume in flight and then answer 409',
        async (_, operation) => {
          const teacher = await createTeacher();
          const student = await createStudent();
          let outcome: Promise<unknown> | undefined;

          await prisma.$transaction(async (tx) => {
            const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
              SELECT pg_backend_pid() AS pid FROM "User"
              WHERE "id" = ${teacher.id} FOR UPDATE`;
            outcome = operation(teacher).then(
              () => 'done',
              (error: unknown) => error,
            );
            await waitUntilBlockedBy(pid);
            await tx.user.update({
              where: { id: student.id },
              data: {
                service_status: ServiceStatus.IN_SERVICE,
                aee_responsible_id: teacher.id,
                service_started_at: new Date(),
              },
            });
          });

          await expect(outcome).resolves.toBeInstanceOf(ConflictException);
          await expect(
            prisma.user.findUniqueOrThrow({ where: { id: teacher.id } }),
          ).resolves.toMatchObject({ roles: [LEVELS.PROFESSOR_AEE] });
        },
      );
    });

    describe('transições', () => {
      it('should take a student from waiting to in service, closed and back to the end of the queue', async () => {
        const teacher = await createTeacher();
        const student = await createStudent();

        await queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]);
        await expect(statusOf(student.email)).resolves.toMatchObject({
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: teacher.id,
          service_closed_at: null,
        });

        await queue.close(student.email, {
          sub: teacher.id,
          roles: [LEVELS.PROFESSOR_AEE],
        });
        const closed = await statusOf(student.email);
        expect(closed).toMatchObject({
          service_status: ServiceStatus.CLOSED,
          aee_responsible_id: teacher.id,
        });
        expect(closed.service_closed_at).toBeInstanceOf(Date);

        // O encerramento libera a vaga do professor.
        await expect(inServiceOf(teacher.id)).resolves.toBe(0);

        await queue.reopen(student.email, [LEVELS.PROFISSIONAL_NAPNE]);
        const reopened = await statusOf(student.email);
        expect(reopened).toMatchObject({
          service_status: ServiceStatus.WAITING,
          aee_responsible_id: null,
          service_started_at: null,
          service_closed_at: null,
        });
        expect(reopened.queued_at!.getTime()).toBeGreaterThan(
          student.queued_at!.getTime(),
        );
      });

      it('should let only the responsible teacher close the student, and keep another teacher out', async () => {
        const teacher = await createTeacher();
        const other = await createTeacher();
        const student = await createStudent();
        await queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]);

        await expect(
          queue.close(student.email, {
            sub: other.id,
            roles: [LEVELS.PROFESSOR_AEE],
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(statusOf(student.email)).resolves.toMatchObject({
          service_status: ServiceStatus.IN_SERVICE,
        });

        await expect(
          queue.close(student.email, { sub: 1, roles: [LEVELS.ADMIN] }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        await queue.close(student.email, {
          sub: teacher.id,
          roles: [LEVELS.PROFESSOR_AEE],
        });
        await expect(statusOf(student.email)).resolves.toMatchObject({
          service_status: ServiceStatus.CLOSED,
        });
      });

      it.each([
        [[LEVELS.PROFESSOR_AEE], false],
        [[LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE], true],
      ])(
        'should answer the assume of an account with roles %j with the external manager contact only if it is %s',
        async (roles, seesContact) => {
          const student = await createStudent();
          await prisma.user.update({
            where: { id: student.id },
            data: {
              external_manager_name: 'Maria',
              external_manager_phone: '11999990000',
              external_manager_cpf: '52998224725',
            },
          });
          const teacher = await createTeacher(undefined, roles);

          const result = await queue.assume(student.email, teacher.id, roles);

          expect(result?.external_manager_name).toBe('Maria');
          if (seesContact) {
            expect(result).toMatchObject({
              external_manager_phone: '11999990000',
              external_manager_cpf: '52998224725',
            });
          } else {
            expect(result).not.toHaveProperty('external_manager_phone');
          }
        },
      );

      it('should let an account that has the AEE role among others take a student, and refuse one that does not', async () => {
        const student = await createStudent();
        const combined = await createTeacher(undefined, [
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_NAPNE,
          LEVELS.PROFESSOR_AEE,
        ]);
        const napneOnly = await createTeacher('Só NAPNE', [
          LEVELS.PROFISSIONAL_NAPNE,
        ]);

        await expect(
          queue.assume(student.email, napneOnly.id, [LEVELS.PROFESSOR_AEE]),
        ).rejects.toThrow(ForbiddenException);
        await queue.assume(student.email, combined.id, [LEVELS.PROFESSOR_AEE]);

        expect((await statusOf(student.email)).aee_responsible_id).toBe(
          combined.id,
        );
      });

      it('should answer 409 with the fixed limit to the 16th student', async () => {
        const teacher = await createTeacher();
        for (let i = 0; i < AEE_SERVICE_CAPACITY; i++) {
          await queue.assume((await createStudent()).email, teacher.id, [
            LEVELS.PROFESSOR_AEE,
          ]);
        }
        const extra = await createStudent();

        await expect(
          queue.assume(extra.email, teacher.id, [LEVELS.PROFESSOR_AEE]),
        ).rejects.toThrow(LIMIT_MESSAGE);
        await expect(statusOf(extra.email)).resolves.toMatchObject({
          service_status: ServiceStatus.WAITING,
        });
      });
    });

    // Os specs de integração dividem o banco, então os totais gerais incluem
    // contas de outros specs e só valem como piso. A ocupação é conferida por
    // professor, e esses professores são só deste teste.
    describe('estatísticas do atendimento', () => {
      const OLDEST = new Date('2000-01-01T00:00:00.000Z');

      it('should count the totals, the occupation per AEE teacher over 15 and the oldest waiting student', async () => {
        // Criados fora da ordem alfabética, para provar a ordenação por nome.
        const carla = await createTeacher('Zz Estatística Carla');
        const bruno = await createTeacher('Zz Estatística Bruno');
        const ana = await createTeacher('Zz Estatística Ana');
        // O NAPNE sem o papel 6 não entra na lista.
        const napne = await createTeacher('Zz Estatística Napne', [
          LEVELS.PROFISSIONAL_NAPNE,
        ]);
        // O sexto segue na fila, ao lado do waitingOld.
        const [first, second, third, closed, waitingOld] = await Promise.all(
          Array.from({ length: 6 }, () => createStudent()),
        );

        await queue.assume(first.email, ana.id, [LEVELS.PROFESSOR_AEE]);
        await queue.assume(second.email, ana.id, [LEVELS.PROFESSOR_AEE]);
        await queue.assume(third.email, carla.id, [LEVELS.PROFESSOR_AEE]);
        // O encerrado mantém o responsável, mas libera a vaga de Ana.
        await queue.assume(closed.email, ana.id, [LEVELS.PROFESSOR_AEE]);
        await queue.close(closed.email, {
          sub: ana.id,
          roles: [LEVELS.PROFESSOR_AEE],
        });
        await prisma.user.update({
          where: { id: waitingOld.id },
          data: { queued_at: OLDEST },
        });
        // O encerrado entrou na fila antes de todos: sem o filtro de WAITING,
        // a data mais antiga seria a dele.
        await prisma.user.update({
          where: { id: closed.id },
          data: { queued_at: new Date('1999-01-01T00:00:00.000Z') },
        });

        const result = await stats.getStats();

        expect(result.totals.WAITING).toBeGreaterThanOrEqual(2);
        expect(result.totals.IN_SERVICE).toBeGreaterThanOrEqual(3);
        expect(result.totals.CLOSED).toBeGreaterThanOrEqual(1);
        expect(result.queue.oldest_queued_at).toEqual(OLDEST);
        expect(result.queue.oldest_student).toEqual({
          id: waitingOld.id,
          full_name: waitingOld.full_name,
        });

        const ours = result.professionals.filter(({ id }) =>
          [ana.id, bruno.id, carla.id, napne.id].includes(id),
        );
        expect(ours).toEqual([
          {
            id: ana.id,
            full_name: ana.full_name,
            in_service: 2,
            capacity: 15,
            free: 13,
          },
          {
            id: bruno.id,
            full_name: bruno.full_name,
            in_service: 0,
            capacity: 15,
            free: 15,
          },
          {
            id: carla.id,
            full_name: carla.full_name,
            in_service: 1,
            capacity: 15,
            free: 14,
          },
        ]);
      });
    });

    describe('contas e limites no banco', () => {
      it('should queue the students created by the registration and by the Google sign-in', async () => {
        const registered = await users.create({
          full_name: 'Cadastrado',
          cpf: '70000000001',
          email: `cadastrado${EMAIL_DOMAIN}`,
        });
        const google = await users.createGoogleStudentUser({
          email: `google${EMAIL_DOMAIN}`,
          fullName: 'Google',
          passwordHash: 'x',
          googleSubject: 'fila-google-sub',
        });

        expect(registered.service_status).toBe(ServiceStatus.WAITING);
        expect(registered.queued_at).toBeInstanceOf(Date);
        expect(google?.service_status).toBe(ServiceStatus.WAITING);
        expect(google?.queued_at).toBeInstanceOf(Date);
      });

      it('should queue the account that becomes a student and clear the one that stops being it', async () => {
        const created = await users.create({
          full_name: 'Profissional',
          cpf: '70000000002',
          email: `profissional${EMAIL_DOMAIN}`,
          roles: [LEVELS.PROFISSIONAL_SAUDE],
        });
        expect(created.service_status).toBeNull();

        const student = await users.update(created.email, {
          roles: [LEVELS.ALUNO_ESTUDANTE],
        });
        expect(student.service_status).toBe(ServiceStatus.WAITING);
        expect(student.queued_at).toBeInstanceOf(Date);

        const teacher = await createTeacher();
        await queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]);
        const professional = await users.update(student.email, {
          roles: [LEVELS.PROFISSIONAL_EDUCACAO],
        });

        expect(professional).toMatchObject({
          service_status: null,
          queued_at: null,
          service_started_at: null,
          service_closed_at: null,
          aee_responsible: null,
        });
        await expect(inServiceOf(teacher.id)).resolves.toBe(0);
      });

      it('should answer 409 and keep the AEE teacher when it has students in service', async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        await queue.assume(student.email, teacher.id, [LEVELS.PROFESSOR_AEE]);

        await expect(
          users.update(teacher.email, { roles: [LEVELS.PROFISSIONAL_SAUDE] }),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(users.remove(teacher.id)).rejects.toBeInstanceOf(
          ConflictException,
        );

        await expect(
          prisma.user.findUniqueOrThrow({ where: { id: teacher.id } }),
        ).resolves.toMatchObject({ roles: [LEVELS.PROFESSOR_AEE] });

        await queue.close(student.email, {
          sub: teacher.id,
          roles: [LEVELS.PROFESSOR_AEE],
        });
        await expect(
          users.update(teacher.email, { roles: [LEVELS.PROFISSIONAL_SAUDE] }),
        ).resolves.toMatchObject({ roles: [LEVELS.PROFISSIONAL_SAUDE] });
      });

      it('should let a NAPNE account that is not an AEE teacher lose the role and be removed', async () => {
        const napne = await createTeacher(undefined, [
          LEVELS.PROFISSIONAL_NAPNE,
        ]);

        await expect(users.remove(napne.id)).resolves.toMatchObject({
          id: napne.id,
        });
      });

      it('should rename the responsible column and drop service_capacity with the migration', async () => {
        const [{ columns }] = await prisma.$queryRaw<{ columns: string[] }[]>`
          SELECT array_agg(column_name::text ORDER BY column_name) AS columns
          FROM information_schema.columns
          WHERE table_name = 'User'
            AND column_name IN
              ('aee_responsible_id', 'napne_responsible_id', 'service_capacity')`;
        const constraints = await prisma.$queryRaw<{ conname: string }[]>`
          SELECT conname::text FROM pg_constraint
          WHERE conrelid = '"User"'::regclass
            AND conname IN ('User_in_service_has_aee_chk',
              'User_in_service_has_aee_chk', 'User_service_capacity_chk',
              'User_aee_responsible_id_fkey', 'User_napne_responsible_id_fkey')
          ORDER BY conname`;
        const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
          SELECT indexname::text FROM pg_indexes
          WHERE tablename = 'User' AND indexname LIKE '%responsible_id%'`;

        expect(columns).toEqual(['aee_responsible_id']);
        expect(constraints.map(({ conname }) => conname)).toEqual([
          'User_aee_responsible_id_fkey',
          'User_in_service_has_aee_chk',
        ]);
        expect(indexes.map(({ indexname }) => indexname)).toEqual([
          'User_aee_responsible_id_service_status_idx',
        ]);
      });

      // Os CHECKs valem para toda gravação, também a que não passa pela API.
      it.each([
        [
          'User_service_status_level_chk',
          'a service status on an account that is not a student',
          'UPDATE "User" SET service_status = \'WAITING\' WHERE email = $1',
          'admin',
        ],
        [
          'User_service_status_level_chk',
          'a student with no service status',
          'UPDATE "User" SET service_status = NULL WHERE email = $1',
          'student',
        ],
        [
          'User_in_service_has_aee_chk',
          'a student in service with no responsible',
          'UPDATE "User" SET service_status = \'IN_SERVICE\' WHERE email = $1',
          'student',
        ],
      ])(
        'should enforce %s against %s',
        async (constraint, _, statement, kind) => {
          const account =
            kind === 'student'
              ? await createStudent()
              : await prisma.user.create({
                  data: {
                    full_name: 'Admin',
                    cpf: '70000000003',
                    email: `admin${EMAIL_DOMAIN}`,
                    password: 'x',
                    roles: [LEVELS.ADMIN],
                    id_current_phase: PHASES.TRIAGEM,
                  },
                });

          await expect(
            prisma.$executeRawUnsafe(statement, account.email),
          ).rejects.toThrow(constraint);
        },
      );
    });
  },
);
