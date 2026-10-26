import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS, PHASES } from 'src/constants';
import { requireIntegrationDatabaseUrl } from './integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe.
// Os CHECKs de User.roles (migration 20261026100000_add_user_roles) não passam
// pelo Prisma nem pelo DTO: cada caso grava direto no banco, e só o banco pode
// barrar a combinação. O spec apaga as contas do domínio de e-mail dele.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

(integrationDatabaseUrl ? describe : describe.skip)(
  'User.roles contra o PostgreSQL, CHECKs de composição',
  () => {
    let prisma: PrismaService;
    let originalDatabaseUrl: string | undefined;
    let counter = 0;

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;

      const databaseUrl = requireIntegrationDatabaseUrl(integrationDatabaseUrl);
      process.env.DATABASE_URL = databaseUrl;

      const module = await Test.createTestingModule({
        providers: [PrismaService],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
    });

    const deleteFixtures = () =>
      prisma.user.deleteMany({
        where: { email: { endsWith: '@roles.edutrace.test' } },
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
      await prisma.currentPhases.createMany({
        data: [{ id: PHASES.TRIAGEM, name: 'Triagem' }],
        skipDuplicates: true,
      });
    });

    // Insere direto, sem o Prisma Client, com os campos NOT NULL e as colunas
    // da fila que os CHECKs de service_status e service_capacity olham.
    async function insertRaw(
      roles: number[],
      extra: { status?: 'WAITING'; capacity?: number } = {},
    ) {
      counter += 1;
      const n = String(counter).padStart(4, '0');
      const status = extra.status ?? null;
      const capacity = extra.capacity ?? null;

      return prisma.$executeRaw`
        INSERT INTO "User"
          ("full_name", "cpf", "email", "password", "roles", "id_current_phase",
           "service_status", "queued_at", "service_capacity", "updated_at")
        VALUES
          (${'Conta de teste'}, ${`7${n}000000`}, ${`conta${n}@roles.edutrace.test`},
           ${'x'}, ${roles}::integer[], ${PHASES.TRIAGEM},
           ${status}::"ServiceStatus", ${status ? new Date() : null}, ${capacity},
           now())`;
    }

    it('should create the level 6, Professor do AEE, with the migrations alone', async () => {
      const level = await prisma.level.findUnique({
        where: { id: LEVELS.PROFESSOR_AEE },
      });

      expect(level?.name).toBe('Professor do AEE');
    });

    it.each([
      ['a professional with the Professor do AEE role', [3, 6]],
      ['the NAPNE with the Professor do AEE role', [5, 6]],
      ['the four professional roles', [3, 4, 5, 6]],
      ['the Professor do AEE alone', [6]],
      ['the Administrator alone', [1]],
    ])('should accept %s', async (_case, roles) => {
      await expect(insertRaw(roles)).resolves.toBe(1);
    });

    it('should accept the student alone, with the queue status', async () => {
      await expect(insertRaw([2], { status: 'WAITING' })).resolves.toBe(1);
    });

    it.each([
      ['an empty list', [], 'User_roles_not_empty_chk'],
      ['a role above the known ones', [7], 'User_roles_known_chk'],
      ['the role zero', [0], 'User_roles_known_chk'],
      ['a negative role', [-3], 'User_roles_known_chk'],
      [
        'a role above the known ones among valid ones',
        [3, 7],
        'User_roles_known_chk',
      ],
      ['a repeated role', [3, 3], 'User_roles_unique_chk'],
      ['a repeated role among others', [3, 6, 3], 'User_roles_unique_chk'],
      [
        'the Administrator with a professional role',
        [1, 3],
        'User_roles_exclusive_chk',
      ],
      [
        'the Administrator with the student',
        [1, 2],
        'User_roles_exclusive_chk',
      ],
      [
        'the student with a professional role',
        [2, 6],
        'User_roles_exclusive_chk',
      ],
    ])('should refuse %s', async (_case, roles, constraint) => {
      await expect(insertRaw(roles)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(constraint),
        }),
      );
    });

    it('should refuse a NULL role list', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "User" ("full_name", "cpf", "email", "password", "roles", "id_current_phase", "updated_at")
          VALUES ('x', '70000000001', 'nulo@roles.edutrace.test', 'x', NULL, ${PHASES.TRIAGEM}, now())`,
      ).rejects.toThrow(/roles/);
    });

    it('should refuse a multidimensional list, which the flattened checks alone would accept', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "User" ("full_name", "cpf", "email", "password", "roles", "id_current_phase", "updated_at")
          VALUES ('x', '70000000003', 'matriz@roles.edutrace.test', 'x', '{{3,6}}'::integer[], ${PHASES.TRIAGEM}, now())`,
      ).rejects.toThrow(/User_roles_not_empty_chk/);
    });

    it('should refuse a NULL element inside the list', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "User" ("full_name", "cpf", "email", "password", "roles", "id_current_phase", "updated_at")
          VALUES ('x', '70000000002', 'nulo2@roles.edutrace.test', 'x', ARRAY[3, NULL]::integer[], ${PHASES.TRIAGEM}, now())`,
      ).rejects.toThrow(/User_roles_/);
    });

    it('should keep the student status tied to the student role', async () => {
      await expect(insertRaw([2])).rejects.toThrow(
        /User_service_status_level_chk/,
      );
      await expect(insertRaw([3, 6], { status: 'WAITING' })).rejects.toThrow(
        /User_service_status_level_chk/,
      );
    });

    it('should allow service_capacity only with the NAPNE role, even among others', async () => {
      await expect(insertRaw([5, 6], { capacity: 7 })).resolves.toBe(1);
      await expect(insertRaw([3, 5], { capacity: 7 })).resolves.toBe(1);
      await expect(insertRaw([3, 6], { capacity: 7 })).rejects.toThrow(
        /User_service_capacity_chk/,
      );
      await expect(insertRaw([5], { capacity: 201 })).rejects.toThrow(
        /User_service_capacity_chk/,
      );
    });

    it('should refuse an UPDATE that breaks the composition', async () => {
      await insertRaw([3, 6]);
      const { id } = await prisma.user.findFirstOrThrow({
        where: { email: { endsWith: '@roles.edutrace.test' } },
        select: { id: true },
      });

      await expect(
        prisma.$executeRaw`UPDATE "User" SET "roles" = ARRAY[1, 3] WHERE "id" = ${id}`,
      ).rejects.toThrow(/User_roles_exclusive_chk/);
    });
  },
);
