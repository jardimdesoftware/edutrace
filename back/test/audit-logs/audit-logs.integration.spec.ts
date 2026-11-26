import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditAction } from '@prisma/client';
import { defer, lastValueFrom } from 'rxjs';
import { AuditContextInterceptor } from 'src/audit-logs/audit-context.interceptor';
import { PROTECTED_VALUE } from 'src/audit-logs/audit-changes';
import { LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe. O
// trigger que torna a tabela somente inserção e a leitura de antes pela extensão
// do Prisma só existem no banco. O CPF usa o prefixo 31, que nenhum outro spec
// de integração usa. As linhas do AuditLog ficam no banco: o trigger não deixa
// apagá-las.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@auditoria.test';

// A gravação do log não segura a resposta, então o teste espera por ela.
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

(integrationDatabaseUrl ? describe : describe.skip)(
  'Log de auditoria contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const createStudent = () => {
      const n = ++sequence;
      return prisma.user.create({
        data: {
          full_name: `Estudante ${n}`,
          cpf: `31${String((Date.now() + n) % 1e9).padStart(9, '0')}`,
          email: `estudante${n}-${Date.now()}${EMAIL_DOMAIN}`,
          password: 'x',
          roles: [LEVELS.ALUNO_ESTUDANTE],
          id_current_phase: PHASES.TRIAGEM,
          service_status: 'WAITING',
          queued_at: new Date(),
        },
      });
    };

    const entriesOf = (id: number) =>
      prisma.auditLog.findMany({
        where: { entity: 'User', entity_id: id },
        orderBy: { id: 'asc' },
      });

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = requireIntegrationDatabaseUrl(
        integrationDatabaseUrl,
      );

      const module = await Test.createTestingModule({
        providers: [PrismaService],
      }).compile();
      await module.init();
      prisma = module.get(PrismaService);

      await prisma.currentPhases.createMany({
        data: [{ id: PHASES.TRIAGEM, name: 'Triagem' }],
        skipDuplicates: true,
      });
    });

    afterAll(async () => {
      if (prisma) {
        await prisma.user.deleteMany({
          where: { email: { endsWith: EMAIL_DOMAIN } },
        });
      }
      await prisma?.$disconnect();

      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    });

    it('records the change with before and after, hiding the password', async () => {
      const student = await createStudent();

      const result = await prisma.user.update({
        where: { id: student.id },
        data: { full_name: 'Nome Novo', password: 'outro' },
        select: { id: true },
      });
      await settle();
      const [created, updated] = await entriesOf(student.id);

      expect(result).toEqual({ id: student.id });
      expect(created.action).toBe(AuditAction.CREATE);
      expect(updated.action).toBe(AuditAction.UPDATE);
      expect(updated.changes).toEqual({
        full_name: { from: student.full_name, to: 'Nome Novo' },
        password: { from: PROTECTED_VALUE, to: PROTECTED_VALUE },
      });
    });

    // O valor de antes da segunda alteração só existe dentro da transação: lido
    // por outra conexão, ele seria o nome de antes da transação.
    it('reads the value before the write inside the transaction that makes it', async () => {
      const student = await createStudent();

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: student.id },
          data: { full_name: 'Primeiro' },
        });
        await tx.user.update({
          where: { id: student.id },
          data: { full_name: 'Segundo' },
        });
      });
      await settle();

      expect((await entriesOf(student.id)).at(-1)?.changes).toEqual({
        full_name: { from: 'Primeiro', to: 'Segundo' },
      });
    });

    // A leitura de antes pela conexão de fora da transação pedia uma segunda
    // conexão ao pool para cada transação aberta; com mais transações que
    // conexões, todas ficavam esperando.
    it('finishes more simultaneous transactions than the connection pool holds', async () => {
      const students: { id: number }[] = [];
      for (let n = 0; n < 25; n++) {
        students.push(await createStudent());
      }

      // A espera por uma conexão livre é longa para que só o travamento, e não a
      // fila natural do pool, reprove o teste.
      await Promise.all(
        students.map((student) =>
          prisma.$transaction(
            (tx) =>
              tx.user.update({
                where: { id: student.id },
                data: { full_name: `Transação ${student.id}` },
              }),
            { maxWait: 15_000 },
          ),
        ),
      );
      await settle();

      const updates = await prisma.auditLog.count({
        where: {
          entity: 'User',
          action: AuditAction.UPDATE,
          entity_id: { in: students.map(({ id }) => id) },
        },
      });
      expect(updates).toBe(25);
    }, 30_000);

    it('saves who made the change when it happens in a request', async () => {
      const student = await createStudent();
      const request = {
        user: { sub: 99, name: 'Administrador', email: 'admin@x.com' },
        ip: '10.0.0.1',
        method: 'PATCH',
        route: { path: '/users/:id' },
      };
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      await lastValueFrom(
        new AuditContextInterceptor(prisma).intercept(context, {
          handle: () =>
            defer(() =>
              prisma.user.update({
                where: { id: student.id },
                data: { full_name: 'Pela Requisição' },
              }),
            ),
        }),
      );
      await settle();

      expect((await entriesOf(student.id)).at(-1)).toMatchObject({
        action: AuditAction.UPDATE,
        actor_id: 99,
        actor_name: 'Administrador',
        route: '/users/:id',
        succeeded: true,
      });
    });

    it('refuses to update, delete or truncate a log entry', async () => {
      const student = await createStudent();
      await settle();
      const [entry] = await entriesOf(student.id);

      await expect(
        prisma.$executeRaw`UPDATE "AuditLog" SET "entity" = 'x' WHERE "id" = ${entry.id}`,
      ).rejects.toThrow(/apenas inserção/);
      await expect(
        prisma.$executeRaw`DELETE FROM "AuditLog" WHERE "id" = ${entry.id}`,
      ).rejects.toThrow(/apenas inserção/);
      await expect(prisma.$executeRaw`TRUNCATE "AuditLog"`).rejects.toThrow(
        /apenas inserção/,
      );
    });
  },
);
