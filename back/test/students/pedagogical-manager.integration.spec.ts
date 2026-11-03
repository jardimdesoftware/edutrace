import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersService } from 'src/users/users.service';
import { StudentsService } from 'src/students/students.service';
import { SetPedagogicalManagerDto } from 'src/students/dto/set-pedagogical-manager.dto';
import { LEVELS, PHASES } from 'src/constants';
import { LEAVE_QUEUE } from 'src/users/service-queue';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. Os CHECKs, o ON DELETE SET NULL e a
// trava FOR SHARE só existem no banco, e um Prisma mockado não executa nenhum
// dos três.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail, e nunca a tabela inteira.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@responsavel.test';
const EXTERNAL = {
  external_manager_name: 'Maria da Silva',
  external_manager_phone: '81999998888',
  external_manager_cpf: '01234567890',
};

const NO_MANAGER = {
  pedagogical_manager_id: null,
  external_manager_name: null,
  external_manager_phone: null,
  external_manager_cpf: null,
};

(integrationDatabaseUrl ? describe : describe.skip)(
  'Responsável pedagógico contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let students: StudentsService;
    let users: UsersService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    function createAccount(
      id_level: number,
      extra: Record<string, unknown> = {},
    ) {
      const n = nextNumber();
      return prisma.user.create({
        data: {
          full_name: `Conta ${n}`,
          cpf: `${id_level === LEVELS.ALUNO_ESTUDANTE ? 8 : 9}${String(n).padStart(10, '0')}`,
          email: `conta${n}${EMAIL_DOMAIN}`,
          password: 'x',
          id_level,
          id_current_phase: PHASES.TRIAGEM,
          ...(id_level === LEVELS.ALUNO_ESTUDANTE
            ? { service_status: 'WAITING' as const, queued_at: new Date() }
            : {}),
          ...extra,
        },
      });
    }

    const createStudent = (extra: Record<string, unknown> = {}) =>
      createAccount(LEVELS.ALUNO_ESTUDANTE, extra);

    const managerOf = (id: number) =>
      prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
          pedagogical_manager_id: true,
          external_manager_name: true,
          external_manager_phone: true,
          external_manager_cpf: true,
        },
      });

    const set = (email: string, dto: Partial<SetPedagogicalManagerDto>) =>
      students.setPedagogicalManager(
        email,
        dto as SetPedagogicalManagerDto,
        LEVELS.ADMIN,
      );

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

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      const databaseUrl = requireIntegrationDatabaseUrl(integrationDatabaseUrl);

      // O PrismaService lê a conexão de DATABASE_URL.
      process.env.DATABASE_URL = databaseUrl;

      const module = await Test.createTestingModule({
        providers: [
          UsersService,
          StudentsService,
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
      students = module.get(StudentsService);
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
    });

    // O banco do job nasce só com as migrations, sem o seed: os níveis e a
    // fase que as contas referenciam precisam existir. O createMany com
    // skipDuplicates é um INSERT ... ON CONFLICT DO NOTHING, que não falha para
    // quem perde a corrida contra os outros specs.
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

    describe('CHECKs', () => {
      it('should accept a student with a server, with an external manager and with none', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);

        await expect(
          createStudent({ pedagogical_manager_id: server.id }),
        ).resolves.toBeDefined();
        await expect(createStudent(EXTERNAL)).resolves.toBeDefined();
        await expect(createStudent()).resolves.toBeDefined();
      });

      it('should refuse a student with a server and an external manager at once', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_NAPNE);

        await expect(
          createStudent({ pedagogical_manager_id: server.id, ...EXTERNAL }),
        ).rejects.toThrow('User_pedagogical_manager_one_kind_chk');
      });

      it('should refuse to link a server to a student that already has an external manager', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const student = await createStudent(EXTERNAL);

        await expect(
          prisma.$executeRawUnsafe(
            'UPDATE "User" SET pedagogical_manager_id = $1 WHERE id = $2',
            server.id,
            student.id,
          ),
        ).rejects.toThrow('User_pedagogical_manager_one_kind_chk');
      });

      it('should refuse to give an external manager to a student that already has a server', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const student = await createStudent({
          pedagogical_manager_id: server.id,
        });

        await expect(
          prisma.$executeRawUnsafe(
            `UPDATE "User" SET external_manager_name = 'Maria', external_manager_phone = '81999998888', external_manager_cpf = '01234567890' WHERE id = $1`,
            student.id,
          ),
        ).rejects.toThrow('User_pedagogical_manager_one_kind_chk');
      });

      it.each([
        ['only the name', { external_manager_name: 'Maria' }],
        [
          'the name and the phone',
          {
            external_manager_name: 'Maria',
            external_manager_phone: '8133334444',
          },
        ],
        ['only the phone', { external_manager_phone: '8133334444' }],
        ['only the cpf', { external_manager_cpf: '01234567890' }],
      ])('should refuse an external manager with %s', async (_, incomplete) => {
        await expect(createStudent(incomplete)).rejects.toThrow(
          'User_external_manager_complete_chk',
        );
      });

      it('should refuse to clear only part of the external manager', async () => {
        const student = await createStudent(EXTERNAL);

        await expect(
          prisma.$executeRawUnsafe(
            'UPDATE "User" SET external_manager_phone = NULL WHERE id = $1',
            student.id,
          ),
        ).rejects.toThrow('User_external_manager_complete_chk');
      });
    });

    // O ON DELETE SET NULL e a limpeza da troca de nível do servidor procuram os
    // estudantes pela chave estrangeira. Sem o índice, cada uma varre a tabela
    // User inteira.
    describe('índice da chave estrangeira', () => {
      it('should index pedagogical_manager_id', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'User'
            AND indexname = 'User_pedagogical_manager_id_idx'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('(pedagogical_manager_id)');
      });
    });

    describe('ON DELETE SET NULL', () => {
      it('should leave the students without manager, and not delete them, when the server is deleted', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const kept = await createStudent({
          pedagogical_manager_id: server.id,
        });
        const other = await createStudent(EXTERNAL);

        await users.remove(server.id);

        await expect(managerOf(kept.id)).resolves.toEqual(NO_MANAGER);
        await expect(managerOf(other.id)).resolves.toMatchObject(EXTERNAL);
      });
    });

    describe('setPedagogicalManager', () => {
      it.each([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE])(
        'should link a server of the level %s and answer with its id and name only',
        async (id_level) => {
          const server = await createAccount(id_level);
          const student = await createStudent();

          const result = await set(student.email, {
            kind: 'SERVER',
            user_id: server.id,
          });

          expect(result.pedagogical_manager).toEqual({
            id: server.id,
            full_name: server.full_name,
          });
          expect(result.external_manager_name).toBeNull();
          await expect(managerOf(student.id)).resolves.toMatchObject({
            pedagogical_manager_id: server.id,
          });
        },
      );

      it.each([
        LEVELS.ADMIN,
        LEVELS.ALUNO_ESTUDANTE,
        LEVELS.PROFISSIONAL_SAUDE,
      ])('should answer 400 for a server of the level %s', async (id_level) => {
        const server = await createAccount(id_level);
        const student = await createStudent();

        await expect(
          set(student.email, { kind: 'SERVER', user_id: server.id }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(managerOf(student.id)).resolves.toMatchObject({
          pedagogical_manager_id: null,
        });
      });

      it('should answer 400 for a server that does not exist', async () => {
        const student = await createStudent();

        await expect(
          set(student.email, { kind: 'SERVER', user_id: 2147483647 }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('should replace the server by an external manager, and the external manager by a server', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const student = await createStudent({
          pedagogical_manager_id: server.id,
        });

        await set(student.email, {
          kind: 'EXTERNAL',
          name: EXTERNAL.external_manager_name,
          phone: EXTERNAL.external_manager_phone,
          cpf: EXTERNAL.external_manager_cpf,
        });
        await expect(managerOf(student.id)).resolves.toEqual({
          pedagogical_manager_id: null,
          ...EXTERNAL,
        });

        await set(student.email, { kind: 'SERVER', user_id: server.id });
        await expect(managerOf(student.id)).resolves.toEqual({
          pedagogical_manager_id: server.id,
          external_manager_name: null,
          external_manager_phone: null,
          external_manager_cpf: null,
        });
      });

      it('should remove the manager with the kind NONE', async () => {
        const student = await createStudent(EXTERNAL);

        await set(student.email, { kind: 'NONE' });

        await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
      });

      it('should answer 404 for an account that is not a student', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);

        await expect(set(server.email, { kind: 'NONE' })).rejects.toMatchObject(
          { status: 404 },
        );
      });

      // Determinístico: a troca de nível do servidor é simulada por uma
      // transação que trava a linha dele e rebaixa o nível, e o vínculo chega no
      // meio dela. Com um SELECT comum, o vínculo leria o nível 3 antes do
      // commit e gravaria um estudante ligado a quem já é do nível 4.
      it('should make the link wait for a level change in flight and then answer 400', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const student = await createStudent();
        let outcome: Promise<unknown> | undefined;

        await prisma.$transaction(async (tx) => {
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
            SELECT pg_backend_pid() AS pid FROM "User"
            WHERE "id" = ${server.id} FOR UPDATE`;
          outcome = set(student.email, {
            kind: 'SERVER',
            user_id: server.id,
          }).then(
            () => 'done',
            (error: unknown) => error,
          );
          await waitUntilBlockedBy(pid);
          await tx.user.update({
            where: { id: server.id },
            data: { id_level: LEVELS.PROFISSIONAL_SAUDE },
          });
        });

        await expect(outcome).resolves.toBeInstanceOf(BadRequestException);
        await expect(managerOf(student.id)).resolves.toMatchObject({
          pedagogical_manager_id: null,
        });
      });
    });

    describe('troca de nível do estudante durante a definição', () => {
      // Determinístico: a troca de nível do estudante é simulada por uma
      // transação que trava a linha dele (FOR UPDATE, como a troca de nível
      // real) e rebaixa o nível, e a definição do responsável chega no meio dela.
      // Com a conferência fora da transação e a gravação por e-mail, a definição
      // passava pela conferência com o nível antigo e gravava o vínculo numa
      // conta que já não é estudante.
      it.each(['SERVER', 'EXTERNAL'])(
        'should answer 404 and write nothing when the student leaves the student level during the kind %s',
        async (kind) => {
          const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
          const student = await createStudent();
          const dto =
            kind === 'SERVER'
              ? { kind: 'SERVER' as const, user_id: server.id }
              : {
                  kind: 'EXTERNAL' as const,
                  name: EXTERNAL.external_manager_name,
                  phone: EXTERNAL.external_manager_phone,
                  cpf: EXTERNAL.external_manager_cpf,
                };
          let outcome: Promise<unknown> | undefined;

          await prisma.$transaction(async (tx) => {
            const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
              SELECT pg_backend_pid() AS pid FROM "User"
              WHERE "id" = ${student.id} FOR UPDATE`;
            outcome = set(student.email, dto).then(
              () => 'done',
              (error: unknown) => error,
            );
            await waitUntilBlockedBy(pid);
            await tx.user.update({
              where: { id: student.id },
              data: { id_level: LEVELS.PROFISSIONAL_SAUDE, ...LEAVE_QUEUE },
            });
          });

          await expect(outcome).resolves.toBeInstanceOf(NotFoundException);
          await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
        },
      );

      it('should answer 400 and write nothing for a student that names itself as the server', async () => {
        const student = await createStudent();

        await expect(
          set(student.email, { kind: 'SERVER', user_id: student.id }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
      });

      it('should answer 404 for an account that is not a student, whatever the kind', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const other = await createAccount(LEVELS.PROFISSIONAL_SAUDE);

        await expect(
          set(other.email, { kind: 'SERVER', user_id: server.id }),
        ).rejects.toMatchObject({ status: 404 });
        await expect(managerOf(other.id)).resolves.toEqual(NO_MANAGER);
      });

      // Disputa de verdade, sem sincronização: o resultado depende de quem
      // trava a linha primeiro, mas nunca pode ser uma conta que não é
      // estudante com vínculo.
      it('should never leave an account that is not a student with a manager, whoever wins the race', async () => {
        for (let round = 0; round < 6; round++) {
          const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
          const student = await createStudent();

          await Promise.allSettled([
            set(student.email, { kind: 'SERVER', user_id: server.id }),
            users.update(student.email, {
              id_level: LEVELS.PROFISSIONAL_SAUDE,
            }),
          ]);

          const row = await prisma.user.findUniqueOrThrow({
            where: { id: student.id },
            select: { id_level: true },
          });
          expect(row.id_level).toBe(LEVELS.PROFISSIONAL_SAUDE);
          await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
        }
      });

      // Determinístico: a transação do teste faz o que UsersService.update faz
      // com o servidor que sai dos níveis 3 e 5. Trava a linha dele (FOR
      // UPDATE), solta os estudantes ligados a ele e só então troca o nível. A
      // definição chega no meio e precisa esperar a linha do servidor sem
      // segurar a do estudante. Se travasse o estudante primeiro, a troca de
      // nível esperaria por essa linha, e a definição pela do servidor: o
      // Postgres abortaria uma das duas por deadlock, em vez de a definição
      // responder 400.
      it('should wait for the server row without holding the student row, so a level change in flight cannot deadlock it', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const student = await createStudent({
          pedagogical_manager_id: server.id,
        });
        let outcome: Promise<unknown> | undefined;

        await prisma.$transaction(async (tx) => {
          const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
            SELECT pg_backend_pid() AS pid FROM "User"
            WHERE "id" = ${server.id} FOR UPDATE`;
          outcome = set(student.email, {
            kind: 'SERVER',
            user_id: server.id,
          }).then(
            () => 'done',
            (error: unknown) => error,
          );
          await waitUntilBlockedBy(pid);
          await tx.user.updateMany({
            where: { pedagogical_manager_id: server.id },
            data: { pedagogical_manager_id: null },
          });
          await tx.user.update({
            where: { id: server.id },
            data: { id_level: LEVELS.PROFISSIONAL_SAUDE },
          });
        });

        await expect(outcome).resolves.toBeInstanceOf(BadRequestException);
        await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
      });

      // A troca de nível do servidor trava a linha dele e depois as dos
      // estudantes; a definição trava o servidor e depois o estudante. Na ordem
      // inversa, as duas esperariam uma pela outra, e o Postgres abortaria uma
      // delas com deadlock (erro que não é o 400 esperado).
      it('should neither deadlock nor leave a student with a server that left the manager levels', async () => {
        for (let round = 0; round < 6; round++) {
          const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
          const crowd = await Promise.all(
            Array.from({ length: 6 }, () => createStudent()),
          );

          const results = await Promise.allSettled([
            ...crowd.map((student) =>
              set(student.email, { kind: 'SERVER', user_id: server.id }),
            ),
            users.update(server.email, {
              id_level: LEVELS.PROFISSIONAL_SAUDE,
            }),
          ]);

          for (const result of results) {
            if (result.status === 'rejected') {
              expect(result.reason).toBeInstanceOf(BadRequestException);
            }
          }
          await expect(
            prisma.user.count({ where: { pedagogical_manager_id: server.id } }),
          ).resolves.toBe(0);
        }
      });
    });

    describe('saída do nível de estudante', () => {
      it.each([LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE])(
        'should clear the server link of the student that becomes the level %s',
        async (id_level) => {
          const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
          const student = await createStudent({
            pedagogical_manager_id: server.id,
          });

          await users.update(student.email, { id_level });

          await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
        },
      );

      it.each([LEVELS.ADMIN, LEVELS.PROFISSIONAL_EDUCACAO])(
        'should clear the external manager, a third party personal data, of the student that becomes the level %s',
        async (id_level) => {
          const student = await createStudent(EXTERNAL);

          await users.update(student.email, { id_level });

          await expect(managerOf(student.id)).resolves.toEqual(NO_MANAGER);
        },
      );

      it('should keep the matrícula and the course of the student that stops being one', async () => {
        const student = await createStudent({
          ...EXTERNAL,
          enrollment_number: '2026001',
          course: 'Informática',
        });

        await users.update(student.email, {
          id_level: LEVELS.PROFISSIONAL_SAUDE,
        });

        await expect(
          prisma.user.findUniqueOrThrow({
            where: { id: student.id },
            select: { enrollment_number: true, course: true },
          }),
        ).resolves.toEqual({
          enrollment_number: '2026001',
          course: 'Informática',
        });
      });

      it('should keep the manager of a student whose update does not change the level', async () => {
        const student = await createStudent(EXTERNAL);

        await users.update(student.email, { full_name: 'Outro nome' });
        await users.update(student.email, { id_level: LEVELS.ALUNO_ESTUDANTE });

        await expect(managerOf(student.id)).resolves.toMatchObject(EXTERNAL);
      });
    });

    describe('contato do responsável externo por nível', () => {
      it('should select the phone and the cpf only for the Administrator and the NAPNE', async () => {
        const student = await createStudent(EXTERNAL);
        const byEmail = <T extends { email: string }>(list: T[]) =>
          list.find((item) => item.email === student.email);

        for (const level of [LEVELS.ADMIN, LEVELS.PROFISSIONAL_NAPNE]) {
          const one = await students.findOne(student.email, level);
          const listed = byEmail(await students.findAll(level));

          for (const read of [one, listed]) {
            expect(read).toMatchObject(EXTERNAL);
          }
        }

        for (const level of [
          LEVELS.PROFISSIONAL_EDUCACAO,
          LEVELS.PROFISSIONAL_SAUDE,
          LEVELS.ALUNO_ESTUDANTE,
        ]) {
          const one = await students.findOne(student.email, level);
          const listed = byEmail(await students.findAll(level));

          for (const read of [one, listed]) {
            expect(read).toMatchObject({
              external_manager_name: EXTERNAL.external_manager_name,
            });
            expect(read).not.toHaveProperty('external_manager_phone');
            expect(read).not.toHaveProperty('external_manager_cpf');
          }
        }
      });

      it('should answer the definition with the select of the level that asked', async () => {
        const student = await createStudent();
        const dto = {
          kind: 'EXTERNAL' as const,
          name: EXTERNAL.external_manager_name,
          phone: EXTERNAL.external_manager_phone,
          cpf: EXTERNAL.external_manager_cpf,
        };

        const forNapne = await students.setPedagogicalManager(
          student.email,
          dto,
          LEVELS.PROFISSIONAL_NAPNE,
        );
        const forEducation = await students.setPedagogicalManager(
          student.email,
          dto,
          LEVELS.PROFISSIONAL_EDUCACAO,
        );

        expect(forNapne).toMatchObject(EXTERNAL);
        expect(forEducation).not.toHaveProperty('external_manager_phone');
        expect(forEducation).not.toHaveProperty('external_manager_cpf');
      });
    });

    describe('troca de nível do servidor', () => {
      it('should unlink the students of a server that leaves the manager levels', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const linked = await createStudent({
          pedagogical_manager_id: server.id,
        });
        const other = await createStudent(EXTERNAL);

        await users.update(server.email, {
          id_level: LEVELS.PROFISSIONAL_SAUDE,
        });

        await expect(managerOf(linked.id)).resolves.toMatchObject({
          pedagogical_manager_id: null,
        });
        await expect(managerOf(other.id)).resolves.toMatchObject(EXTERNAL);
      });

      it('should keep the students linked when the server goes from Education to NAPNE', async () => {
        const server = await createAccount(LEVELS.PROFISSIONAL_EDUCACAO);
        const linked = await createStudent({
          pedagogical_manager_id: server.id,
        });

        await users.update(server.email, {
          id_level: LEVELS.PROFISSIONAL_NAPNE,
        });

        await expect(managerOf(linked.id)).resolves.toMatchObject({
          pedagogical_manager_id: server.id,
        });
      });
    });

    describe('texto livre antigo', () => {
      // A migration renomeia a coluna em vez de apagá-la, e o @ignore a mantém
      // fora do client: o valor continua no banco e nenhuma consulta o devolve.
      it('should keep the old text in pedagogical_manager_legacy and hide it from the client', async () => {
        const student = await createStudent();

        await prisma.$executeRawUnsafe(
          `UPDATE "User" SET pedagogical_manager_legacy = 'Fulano' WHERE id = $1`,
          student.id,
        );

        const [row] = await prisma.$queryRawUnsafe<
          { pedagogical_manager_legacy: string }[]
        >(
          'SELECT pedagogical_manager_legacy FROM "User" WHERE id = $1',
          student.id,
        );
        expect(row.pedagogical_manager_legacy).toBe('Fulano');
        await expect(
          prisma.user.findUniqueOrThrow({ where: { id: student.id } }),
        ).resolves.not.toHaveProperty('pedagogical_manager_legacy');
      });
    });
  },
);
