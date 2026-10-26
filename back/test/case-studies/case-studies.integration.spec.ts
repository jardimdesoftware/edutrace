import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CaseStudiesService } from 'src/case-studies/case-studies.service';
import { CreateCaseStudyDto } from 'src/case-studies/dto/create-case-study.dto';
import { UpdateCaseStudyDto } from 'src/case-studies/dto/update-case-study.dto';
import { createValidationPipe } from 'src/common/validation-pipe';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';
import {
  Json,
  blankSections,
  maxBody,
  setAt,
  validBody,
} from './case-study.fixtures';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. A unicidade do estudo de caso por
// estudante, as chaves estrangeiras (RESTRICT no estudante, SET NULL no autor)
// e o formato do P2002 do @prisma/adapter-pg só existem no banco, e um Prisma
// mockado não executa nenhum dos três.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail (o CASCADE do estudo de caso não
// existe: o estudo de caso é apagado antes das contas), e nunca a tabela
// inteira. O beforeAll recusa rodar num banco cujo nome não termine em "_it".
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@estudo-de-caso.test';
const COURSE = 'Análise e Desenvolvimento de Sistemas';

(integrationDatabaseUrl ? describe : describe.skip)(
  'Estudo de caso contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: CaseStudiesService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    function createAccount(id_level: number) {
      const n = nextNumber();
      const isStudent = id_level === LEVELS.ALUNO_ESTUDANTE;
      return prisma.user.create({
        data: {
          full_name: `Conta ${n}`,
          cpf: `${isStudent ? 4 : 3}${String(n).padStart(10, '0')}`,
          email: `conta${n}${EMAIL_DOMAIN}`,
          password: 'x',
          roles: [id_level],
          id_current_phase: PHASES.TRIAGEM,
          ...(isStudent
            ? {
                service_status: 'WAITING' as const,
                queued_at: new Date(),
                course: COURSE,
              }
            : {}),
        },
      });
    }

    const createStudent = () => createAccount(LEVELS.ALUNO_ESTUDANTE);
    const createNapne = () => createAccount(LEVELS.PROFISSIONAL_NAPNE);

    // O corpo passa pelo pipe real, como na rota: o service recebe a instância
    // do DTO, com as seções aninhadas também como instâncias de classe.
    async function dtoOf(email: string, body: Json = validBody()) {
      return (await createValidationPipe().transform(
        { ...body, student_email: email },
        { type: 'body', metatype: CreateCaseStudyDto },
      )) as CreateCaseStudyDto;
    }

    // As seções como o Prisma as recebe, sem o e-mail do estudante, para gravar
    // direto na tabela e provar as chaves estrangeiras sem passar pelo service.
    async function sectionsOf(email: string) {
      const { student_email: _email, ...sections } = await dtoOf(email);
      return JSON.parse(JSON.stringify(sections)) as Omit<
        Prisma.CaseStudyUncheckedCreateInput,
        'id_student' | 'id_author'
      >;
    }

    async function updateDtoOf(body: Json) {
      return (await createValidationPipe().transform(body, {
        type: 'body',
        metatype: UpdateCaseStudyDto,
      })) as UpdateCaseStudyDto;
    }

    const requestOf = (id: number, email: string, id_level: number) =>
      ({
        user: { sub: id, roles: [id_level], email, name: 'Quem pede' },
      }) as AuthenticatedRequest;

    // Apaga na ordem que as chaves pedem: o estudo de caso antes do estudante
    // (RESTRICT), e só então as contas.
    const deleteFixtures = async () => {
      await prisma.caseStudy.deleteMany({
        where: { student: { email: { endsWith: EMAIL_DOMAIN } } },
      });
      await prisma.user.deleteMany({
        where: { email: { endsWith: EMAIL_DOMAIN } },
      });
    };

    beforeAll(async () => {
      originalDatabaseUrl = process.env.DATABASE_URL;

      // Antes de qualquer conexão: se a guarda lançar, nada foi aberto.
      const databaseUrl = requireIntegrationDatabaseUrl(integrationDatabaseUrl);

      // O PrismaService lê a conexão de DATABASE_URL.
      process.env.DATABASE_URL = databaseUrl;

      const module = await Test.createTestingModule({
        providers: [CaseStudiesService, StudentsService, PrismaService],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(CaseStudiesService);

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

    describe('criar e ler', () => {
      it('should store the sections and read them back with the author and the dates only', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        const read = await service.findOne(
          student.email,
          requestOf(author.id, author.email, LEVELS.PROFISSIONAL_NAPNE),
        );

        expect(read).toEqual(created);
        expect(Object.keys(read).sort()).toEqual(
          [
            'aee_opinion',
            'author',
            'barriers',
            'behavioral_social',
            'created_at',
            'general_info',
            'identification',
            'pedagogical_aspects',
            'pei_recommendations',
            'potentialities_interests',
            'resources_strategies',
            'school_history',
            'student',
            'updated_at',
          ].sort(),
        );
        expect(read.author).toEqual({
          id: author.id,
          full_name: author.full_name,
        });
        expect(read.student).toEqual({
          full_name: student.full_name,
          course: COURSE,
        });
        expect(read.identification).toEqual(validBody().identification);
        expect(read.pedagogical_aspects).toEqual(
          validBody().pedagogical_aspects,
        );
        expect(read.barriers).toBe('Salas com muito ruído');
        expect(read.created_at).toBeInstanceOf(Date);
      });

      it('should never return the author password, e-mail or cpf', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        const serialized = JSON.stringify(created);
        expect(serialized).not.toContain(author.email);
        expect(serialized).not.toContain(author.cpf);
        expect(serialized).not.toContain(student.email);
        expect(serialized).not.toContain(student.cpf);
        expect(serialized).not.toContain('password');
      });

      it('should store the case study with every text at its maximum length', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email, maxBody()),
          author.id,
        );

        expect(created.aee_opinion).toMatchObject({
          opinion: 'ã'.repeat(4000),
        });
        expect(created.barriers).toHaveLength(2000);
      });

      it('should store the blank form: empty texts, and no age nor dates', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email, {
            student_email: student.email,
            ...blankSections(),
          }),
          author.id,
        );

        expect(created.identification).toEqual({ grade: '' });
        expect(created.aee_opinion).toEqual({ opinion: '' });
        expect(created.barriers).toBe('');
      });

      it('should store an empty diagnosis and a missing one', async () => {
        const author = await createNapne();
        const first = await createStudent();
        const second = await createStudent();

        const withEmpty = await service.create(
          await dtoOf(
            first.email,
            setAt(validBody(), 'general_info.diagnosis', ''),
          ),
          author.id,
        );
        const without = await service.create(
          await dtoOf(
            second.email,
            (() => {
              const body = validBody();
              delete (body.general_info as Json).diagnosis;
              return body;
            })(),
          ),
          author.id,
        );

        expect(withEmpty.general_info).toMatchObject({ diagnosis: '' });
        expect(without.general_info).not.toHaveProperty('diagnosis');
      });
    });

    describe('um estudo de caso por estudante', () => {
      it('should answer 409 for the second case study of the student and keep the first', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await expect(
          service.create(
            await dtoOf(
              student.email,
              setAt(validBody(), 'barriers', 'Outra versão'),
            ),
            author.id,
          ),
        ).rejects.toThrow(
          new ConflictException('Este estudante já tem um estudo de caso.'),
        );

        const stored = await prisma.caseStudy.findMany({
          where: { id_student: student.id },
        });
        expect(stored).toHaveLength(1);
        expect(stored[0].barriers).toBe('Salas com muito ruído');
      });

      it('should refuse the second row at the database, with the P2002 code', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        const row = await prisma.caseStudy.findUniqueOrThrow({
          where: { id_student: student.id },
        });
        const { id: _id, ...copy } = row;

        await expect(
          prisma.caseStudy.create({ data: copy as never }),
        ).rejects.toMatchObject({ code: 'P2002' });
      });

      it('should let two different students have one case study each', async () => {
        const author = await createNapne();
        const first = await createStudent();
        const second = await createStudent();

        await service.create(await dtoOf(first.email), author.id);

        await expect(
          service.create(await dtoOf(second.email), author.id),
        ).resolves.toBeDefined();
      });

      it('should answer 404 for an account that is not a student, and write nothing', async () => {
        const author = await createNapne();
        const professional = await createNapne();

        await expect(
          service.create(await dtoOf(professional.email), author.id),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          prisma.caseStudy.count({ where: { id_student: professional.id } }),
        ).resolves.toBe(0);
      });
    });

    describe('chaves estrangeiras', () => {
      it('should refuse a case study for a student that does not exist', async () => {
        const author = await createNapne();
        await expect(
          prisma.caseStudy.create({
            data: {
              ...(await sectionsOf('qualquer@estudo-de-caso.test')),
              id_student: 2147483647,
              id_author: author.id,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should refuse an author that does not exist', async () => {
        const student = await createStudent();

        await expect(
          prisma.caseStudy.create({
            data: {
              ...(await sectionsOf(student.email)),
              id_student: student.id,
              id_author: 2147483647,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should refuse to delete the student account while the case study exists (RESTRICT)', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await expect(
          prisma.user.delete({ where: { id: student.id } }),
        ).rejects.toMatchObject({ code: 'P2003' });
        await expect(
          prisma.caseStudy.count({ where: { id_student: student.id } }),
        ).resolves.toBe(1);
      });

      it('should keep the case study with an unknown author when the author account is deleted (SET NULL)', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await prisma.user.delete({ where: { id: author.id } });

        const reader = await createNapne();
        const read = await service.findOne(
          student.email,
          requestOf(reader.id, reader.email, LEVELS.PROFISSIONAL_NAPNE),
        );
        expect(read.author).toBeNull();
        expect(read.barriers).toBe('Salas com muito ruído');
      });

      it('should index id_author, which the SET NULL of the author searches by', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'CaseStudy'
            AND indexname = 'CaseStudy_id_author_idx'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('(id_author)');
      });
    });

    describe('acesso à leitura', () => {
      it('should let the student read his own case study and refuse the one of another student', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const other = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        await service.create(await dtoOf(other.email), author.id);

        await expect(
          service.findOne(
            student.email,
            requestOf(student.id, student.email, LEVELS.ALUNO_ESTUDANTE),
          ),
        ).resolves.toBeDefined();
        await expect(
          service.findOne(
            other.email,
            requestOf(student.id, student.email, LEVELS.ALUNO_ESTUDANTE),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('should answer 404 for a student without a case study', async () => {
        const student = await createStudent();

        await expect(
          service.findOne(
            student.email,
            requestOf(student.id, student.email, LEVELS.ALUNO_ESTUDANTE),
          ),
        ).rejects.toThrow('Estudo de caso não encontrado');
      });
    });

    describe('editar e excluir', () => {
      it('should replace the sections that were sent, keep the others and keep the author', async () => {
        const author = await createNapne();
        const editor = await createNapne();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        const updated = await service.update(
          student.email,
          await updateDtoOf({
            barriers: 'Novas barreiras',
            aee_opinion: { opinion: 'Novo parecer', date: '2026-11-01' },
          }),
        );

        expect(updated.barriers).toBe('Novas barreiras');
        expect(updated.aee_opinion).toEqual({
          opinion: 'Novo parecer',
          date: '2026-11-01',
        });
        expect(updated.identification).toEqual(created.identification);
        expect(updated.pedagogical_aspects).toEqual(
          created.pedagogical_aspects,
        );
        expect(updated.author).toEqual(created.author);
        expect(updated.author?.id).toBe(author.id);
        expect(updated.author?.id).not.toBe(editor.id);
        expect(updated.created_at).toEqual(created.created_at);
      });

      it('should replace the whole section, dropping what it no longer has', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        const withoutDiagnosis = {
          has_medical_report: false,
          follow_ups: { health: false, therapies: false, other: '' },
        };
        const updated = await service.update(
          student.email,
          await updateDtoOf({ general_info: withoutDiagnosis }),
        );

        expect(updated.general_info).toEqual(withoutDiagnosis);
      });

      it('should answer 404 when updating a student without a case study', async () => {
        const student = await createStudent();

        await expect(
          service.update(
            student.email,
            await updateDtoOf({ barriers: 'Novas barreiras' }),
          ),
        ).rejects.toThrow('Estudo de caso não encontrado');
      });

      it('should delete the case study, answer 404 the second time and let a new one be created', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await expect(service.remove(student.email)).resolves.toMatchObject({
          message: expect.stringContaining('removido com sucesso'),
        });
        await expect(service.remove(student.email)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(
          service.create(await dtoOf(student.email), author.id),
        ).resolves.toBeDefined();
      });

      it('should delete only the case study of the e-mail it was asked for', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const other = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        await service.create(await dtoOf(other.email), author.id);

        await service.remove(student.email);

        await expect(
          prisma.caseStudy.count({ where: { id_student: other.id } }),
        ).resolves.toBe(1);
      });
    });
  },
);
