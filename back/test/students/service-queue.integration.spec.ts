import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersService } from 'src/users/users.service';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { StudentsService } from 'src/students/students.service';
import { LEVELS, PHASES } from 'src/constants';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. A garantia de que dois "assumir"
// simultâneos não passam do limite do NAPNE nem atribuem o mesmo estudante a
// dois profissionais vem do bloqueio de linha e do UPDATE condicional, e um
// Prisma mockado não executa nenhum dos dois.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail, e nunca a tabela inteira.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@fila.test';
const LIMIT_MESSAGE = 'Você atingiu o limite de atendimentos.';

(integrationDatabaseUrl ? describe : describe.skip)(
  'Fila de atendimento do NAPNE contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let queue: ServiceQueueService;
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
          id_level: LEVELS.ALUNO_ESTUDANTE,
          id_current_phase: PHASES.TRIAGEM,
          service_status: status,
          queued_at: new Date(Date.now() - 60_000),
        },
      });
    }

    async function createNapne(capacity: number | null) {
      const n = nextNumber();
      return prisma.user.create({
        data: {
          full_name: `NAPNE ${n}`,
          cpf: `6${String(n).padStart(10, '0')}`,
          email: `napne${n}${EMAIL_DOMAIN}`,
          password: 'x',
          id_level: LEVELS.PROFISSIONAL_NAPNE,
          id_current_phase: PHASES.TRIAGEM,
          service_capacity: capacity,
        },
      });
    }

    const inServiceOf = (napneId: number) =>
      prisma.user.count({
        where: {
          napne_responsible_id: napneId,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });

    const statusOf = (email: string) =>
      prisma.user.findUniqueOrThrow({
        where: { email },
        select: {
          service_status: true,
          napne_responsible_id: true,
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

    describe('concorrência', () => {
      it('should put exactly the capacity in service when ten assumes run at once', async () => {
        const napne = await createNapne(3);
        const students = await Promise.all(
          Array.from({ length: 10 }, () => createStudent()),
        );

        const results = await Promise.allSettled(
          students.map((student) => queue.assume(student.email, napne.id)),
        );

        const rejected = results.filter((r) => r.status === 'rejected');
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
        expect(rejected).toHaveLength(7);
        for (const { reason } of rejected) {
          expect(reason).toBeInstanceOf(ConflictException);
          expect((reason as ConflictException).message).toBe(LIMIT_MESSAGE);
        }
        await expect(inServiceOf(napne.id)).resolves.toBe(3);
        await expect(
          prisma.user.count({
            where: {
              email: { endsWith: EMAIL_DOMAIN },
              service_status: ServiceStatus.WAITING,
            },
          }),
        ).resolves.toBe(7);
      });

      it('should give each student to exactly one NAPNE when two of them take the same students at once', async () => {
        const first = await createNapne(20);
        const second = await createNapne(20);
        const students = await Promise.all(
          Array.from({ length: 8 }, () => createStudent()),
        );

        const results = await Promise.allSettled(
          students.flatMap((student) => [
            queue.assume(student.email, first.id),
            queue.assume(student.email, second.id),
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

      it('should never leave a NAPNE with students in service at another level', async () => {
        const napne = await createNapne(5);
        const students = await Promise.all(
          Array.from({ length: 5 }, () => createStudent()),
        );

        await Promise.allSettled([
          ...students.map((student) => queue.assume(student.email, napne.id)),
          users.update(napne.email, { id_level: LEVELS.PROFISSIONAL_SAUDE }),
        ]);

        const after = await prisma.user.findUniqueOrThrow({
          where: { id: napne.id },
          select: { id_level: true, service_capacity: true },
        });
        const inService = await inServiceOf(napne.id);

        expect(
          after.id_level === LEVELS.PROFISSIONAL_NAPNE || inService === 0,
        ).toBe(true);
        if (after.id_level !== LEVELS.PROFISSIONAL_NAPNE) {
          expect(after.service_capacity).toBeNull();
        }
      });

      // Determinístico: o "assumir" é simulado por uma transação que trava a
      // linha do NAPNE, e a troca de nível (ou a exclusão) chega no meio dela.
      // Sem o FOR UPDATE, a operação contaria os atendimentos antes do commit,
      // enxergaria zero e trocaria o nível de um NAPNE que passou a ter um
      // estudante em atendimento.
      it.each([
        [
          'the level change',
          (napne: { id: number; email: string }) =>
            users.update(napne.email, { id_level: LEVELS.PROFISSIONAL_SAUDE }),
        ],
        [
          'the deletion',
          (napne: { id: number; email: string }) => users.remove(napne.id),
        ],
      ])(
        'should make %s wait for an assume in flight and then answer 409',
        async (_, operation) => {
          const napne = await createNapne(2);
          const student = await createStudent();
          let outcome: Promise<unknown> | undefined;

          await prisma.$transaction(async (tx) => {
            const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
              SELECT pg_backend_pid() AS pid FROM "User"
              WHERE "id" = ${napne.id} FOR UPDATE`;
            outcome = operation(napne).then(
              () => 'done',
              (error: unknown) => error,
            );
            await waitUntilBlockedBy(pid);
            await tx.user.update({
              where: { id: student.id },
              data: {
                service_status: ServiceStatus.IN_SERVICE,
                napne_responsible_id: napne.id,
                service_started_at: new Date(),
              },
            });
          });

          await expect(outcome).resolves.toBeInstanceOf(ConflictException);
          await expect(
            prisma.user.findUniqueOrThrow({ where: { id: napne.id } }),
          ).resolves.toMatchObject({
            id_level: LEVELS.PROFISSIONAL_NAPNE,
            service_capacity: 2,
          });
        },
      );
    });

    describe('transições', () => {
      it('should take a student from waiting to in service, closed and back to the end of the queue', async () => {
        const napne = await createNapne(1);
        const student = await createStudent();

        await queue.assume(student.email, napne.id);
        await expect(statusOf(student.email)).resolves.toMatchObject({
          service_status: ServiceStatus.IN_SERVICE,
          napne_responsible_id: napne.id,
          service_closed_at: null,
        });

        await queue.close(student.email, {
          sub: napne.id,
          id_level: LEVELS.PROFISSIONAL_NAPNE,
        });
        const closed = await statusOf(student.email);
        expect(closed).toMatchObject({
          service_status: ServiceStatus.CLOSED,
          napne_responsible_id: napne.id,
        });
        expect(closed.service_closed_at).toBeInstanceOf(Date);

        // O encerramento libera a vaga do NAPNE.
        await expect(inServiceOf(napne.id)).resolves.toBe(0);

        await queue.reopen(student.email);
        const reopened = await statusOf(student.email);
        expect(reopened).toMatchObject({
          service_status: ServiceStatus.WAITING,
          napne_responsible_id: null,
          service_started_at: null,
          service_closed_at: null,
        });
        expect(reopened.queued_at!.getTime()).toBeGreaterThan(
          student.queued_at!.getTime(),
        );
      });

      it('should answer 409 to a NAPNE with no capacity defined', async () => {
        const napne = await createNapne(null);
        const student = await createStudent();

        await expect(queue.assume(student.email, napne.id)).rejects.toThrow(
          'Seu limite de atendimentos ainda não foi definido pelo administrador.',
        );
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
          id_level: LEVELS.PROFISSIONAL_SAUDE,
        });
        expect(created.service_status).toBeNull();

        const student = await users.update(created.email, {
          id_level: LEVELS.ALUNO_ESTUDANTE,
        });
        expect(student.service_status).toBe(ServiceStatus.WAITING);
        expect(student.queued_at).toBeInstanceOf(Date);

        const napne = await createNapne(1);
        await queue.assume(student.email, napne.id);
        const professional = await users.update(student.email, {
          id_level: LEVELS.PROFISSIONAL_EDUCACAO,
        });

        expect(professional).toMatchObject({
          service_status: null,
          queued_at: null,
          service_started_at: null,
          service_closed_at: null,
          napne_responsible: null,
        });
        await expect(inServiceOf(napne.id)).resolves.toBe(0);
      });

      it('should answer 409 and keep the NAPNE when it has students in service', async () => {
        const napne = await createNapne(2);
        const student = await createStudent();
        await queue.assume(student.email, napne.id);

        await expect(
          users.update(napne.email, { id_level: LEVELS.PROFISSIONAL_SAUDE }),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(users.remove(napne.id)).rejects.toBeInstanceOf(
          ConflictException,
        );

        await expect(
          prisma.user.findUniqueOrThrow({ where: { id: napne.id } }),
        ).resolves.toMatchObject({
          id_level: LEVELS.PROFISSIONAL_NAPNE,
          service_capacity: 2,
        });

        await queue.close(student.email, { sub: 1, id_level: LEVELS.ADMIN });
        await expect(
          users.update(napne.email, { id_level: LEVELS.PROFISSIONAL_SAUDE }),
        ).resolves.toMatchObject({ id_level: LEVELS.PROFISSIONAL_SAUDE });
        await expect(
          prisma.user.findUniqueOrThrow({
            where: { id: napne.id },
            select: { service_capacity: true },
          }),
        ).resolves.toEqual({ service_capacity: null });
      });

      it('should accept a capacity below the students already in service and unassign nobody', async () => {
        const napne = await createNapne(2);
        const students = await Promise.all([createStudent(), createStudent()]);
        for (const student of students) {
          await queue.assume(student.email, napne.id);
        }

        await users.update(napne.email, { service_capacity: 1 });

        await expect(inServiceOf(napne.id)).resolves.toBe(2);
        const other = await createStudent();
        await expect(queue.assume(other.email, napne.id)).rejects.toThrow(
          LIMIT_MESSAGE,
        );
      });

      it('should answer 400 to a capacity for an account that is not a NAPNE', async () => {
        const student = await createStudent();

        await expect(
          users.update(student.email, { service_capacity: 3 }),
        ).rejects.toBeInstanceOf(BadRequestException);
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
          'User_in_service_has_napne_chk',
          'a student in service with no responsible',
          'UPDATE "User" SET service_status = \'IN_SERVICE\' WHERE email = $1',
          'student',
        ],
        [
          'User_service_capacity_chk',
          'a capacity on an account that is not a NAPNE',
          'UPDATE "User" SET service_capacity = 3 WHERE email = $1',
          'student',
        ],
        [
          'User_service_capacity_chk',
          'a capacity above 200',
          'UPDATE "User" SET service_capacity = 201 WHERE email = $1',
          'napne',
        ],
        [
          'User_service_capacity_chk',
          'a negative capacity',
          'UPDATE "User" SET service_capacity = -1 WHERE email = $1',
          'napne',
        ],
      ])(
        'should enforce %s against %s',
        async (constraint, _, statement, kind) => {
          const account =
            kind === 'napne'
              ? await createNapne(1)
              : kind === 'student'
                ? await createStudent()
                : await prisma.user.create({
                    data: {
                      full_name: 'Admin',
                      cpf: '70000000003',
                      email: `admin${EMAIL_DOMAIN}`,
                      password: 'x',
                      id_level: LEVELS.ADMIN,
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
