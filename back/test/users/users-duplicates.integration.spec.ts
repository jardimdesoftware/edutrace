import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';
import { LEVELS, PHASES } from 'src/constants';
import { requireIntegrationDatabaseUrl } from './integration-database';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. Os testes unitários mockam o
// Prisma e só provam o que o mock devolve: o formato do erro P2002 que o
// @prisma/adapter-pg produz de verdade só aparece com um banco de verdade.
// O spec apaga as contas do domínio de e-mail dele, e nunca a tabela inteira:
// os specs de integração rodam em paralelo no mesmo banco, e apagar tudo
// removeria as contas de um spec que está no meio do teste. O beforeAll recusa
// rodar num banco cujo nome não termine em "_it".
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

(integrationDatabaseUrl ? describe : describe.skip)(
  'UsersService contra o PostgreSQL, campos únicos',
  () => {
    let prisma: PrismaService;
    let service: UsersService;
    let originalDatabaseUrl: string | undefined;
    let originalFrontendUrl: string | undefined;

    const DISCENTE_FIXTURE_EMAIL = 'cpf.duplo@discente.ifpe.edu.br';

    const student: CreateUserDto = {
      full_name: 'Estudante de Teste',
      cpf: '01234567890',
      email: 'estudante@edutrace.test',
      enrollment_number: '20261TADS0012',
      course: 'Análise e Desenvolvimento de Sistemas',
    };

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
    });

    const deleteFixtures = () =>
      prisma.user.deleteMany({
        where: {
          OR: [
            { email: { endsWith: '@edutrace.test' } },
            { email: { endsWith: '@dup-it.ifpe.edu.br' } },
            { email: DISCENTE_FIXTURE_EMAIL },
          ],
        },
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

    // O banco do job nasce só com as migrations, sem o seed: o nível e a fase
    // que a criação de usuário referencia precisam existir. Os specs de
    // integração rodam em paralelo num banco novo, e dois upserts do mesmo nível
    // disputariam a inserção (Level_pkey). O createMany com skipDuplicates é um
    // INSERT ... ON CONFLICT DO NOTHING, que não falha para quem perde.
    beforeEach(async () => {
      await deleteFixtures();
      await prisma.currentPhases.createMany({
        data: [{ id: PHASES.TRIAGEM, name: 'Triagem' }],
        skipDuplicates: true,
      });
    });

    it('should store the matrícula and the course and return them', async () => {
      const created = await service.create(student);

      expect(created).toMatchObject({
        enrollment_number: '20261TADS0012',
        course: 'Análise e Desenvolvimento de Sistemas',
      });
    });

    it('should answer 409 with the CPF message for a repeated CPF', async () => {
      await service.create(student);

      await expect(
        service.create({
          ...student,
          email: 'outro@edutrace.test',
          enrollment_number: '20261TADS0099',
        }),
      ).rejects.toThrow(new ConflictException('Este CPF já está cadastrado.'));
    });

    it('should answer 409 with the e-mail message for a repeated e-mail', async () => {
      await service.create(student);

      await expect(
        service.create({
          ...student,
          cpf: '11144477735',
          enrollment_number: '20261TADS0099',
        }),
      ).rejects.toThrow(
        new ConflictException('Este e-mail já está cadastrado.'),
      );
    });

    it('should answer 409 with the matrícula message for a repeated matrícula', async () => {
      await service.create(student);

      await expect(
        service.create({
          ...student,
          cpf: '11144477735',
          email: 'outro@edutrace.test',
        }),
      ).rejects.toThrow(
        new ConflictException('Esta matrícula já está cadastrada.'),
      );
    });

    it('should answer 409 when the update moves a student to a matrícula that is taken', async () => {
      await service.create(student);
      await service.create({
        ...student,
        cpf: '11144477735',
        email: 'outro@edutrace.test',
        enrollment_number: '20261TADS0099',
      });

      await expect(
        service.update('outro@edutrace.test', {
          enrollment_number: '20261TADS0012',
        }),
      ).rejects.toThrow(
        new ConflictException('Esta matrícula já está cadastrada.'),
      );
    });

    describe('até duas contas por CPF', () => {
      const discente: CreateUserDto = {
        ...student,
        cpf: '52998224725',
        email: DISCENTE_FIXTURE_EMAIL,
        enrollment_number: '20261TADS0500',
      };
      const profissional: CreateUserDto = {
        full_name: 'Ex-aluno Professor',
        cpf: '52998224725',
        email: 'ex.aluno@dup-it.ifpe.edu.br',
        roles: [LEVELS.PROFISSIONAL_EDUCACAO],
      };

      it('should accept a discente account and a professional account with the same CPF', async () => {
        await service.create(discente);

        await expect(service.create(profissional)).resolves.toMatchObject({
          cpf: '52998224725',
        });
      });

      it('should answer 409 with the CPF message for a second professional account of the same CPF', async () => {
        await service.create(profissional);

        await expect(
          service.create({
            ...profissional,
            email: 'segundo@dup-it.ifpe.edu.br',
          }),
        ).rejects.toThrow(
          new ConflictException('Este CPF já está cadastrado.'),
        );
      });

      it('should answer 409 with the CPF message for a third account of the same CPF', async () => {
        await service.create(discente);
        await service.create(profissional);

        await expect(
          service.create({
            ...profissional,
            email: 'terceiro@dup-it.ifpe.edu.br',
          }),
        ).rejects.toThrow(
          new ConflictException('Este CPF já está cadastrado.'),
        );
      });
    });

    it('should accept accounts without matrícula side by side', async () => {
      const professional = {
        full_name: 'Professor de Teste',
        cpf: '11144477735',
        email: 'professor@edutrace.test',
        roles: [LEVELS.PROFISSIONAL_EDUCACAO],
      };
      professional.email = 'professor@dup-it.ifpe.edu.br';

      await service.create(professional);

      await expect(
        service.create({
          ...professional,
          cpf: '52998224725',
          email: 'professor2@dup-it.ifpe.edu.br',
        }),
      ).resolves.toMatchObject({ enrollment_number: null });
    });
  },
);
