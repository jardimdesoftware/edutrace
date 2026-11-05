import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AeePlansService } from 'src/aee-plans/aee-plans.service';
import { CreateAeePlanDto } from 'src/aee-plans/dto/create-aee-plan.dto';
import { UpdateAeePlanDto } from 'src/aee-plans/dto/update-aee-plan.dto';
import { createValidationPipe } from 'src/common/validation-pipe';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { FormRevisionsService } from 'src/form-revisions/form-revisions.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';
import {
  Json,
  SEMESTER,
  blankSections,
  maxBody,
  setAt,
  validBody,
} from './aee-plan.fixtures';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. A unicidade do PAEE por estudante e
// período letivo, as chaves estrangeiras (RESTRICT no estudante, SET NULL no
// autor) e o formato do P2002 do @prisma/adapter-pg só existem no banco, e um
// Prisma mockado não executa nenhum dos três.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail (o PAEE é apagado antes das contas,
// porque não há CASCADE), e nunca a tabela inteira. O beforeAll recusa rodar
// num banco cujo nome não termine em "_it". O CPF usa o prefixo 22 (estudante)
// e 23 (profissional), que nenhum outro spec de integração usa.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const REVISION_AUTHOR = { id: 1, name: 'Autor' };
const EMAIL_DOMAIN = '@paee.test';
const COURSE = 'Análise e Desenvolvimento de Sistemas';
const BASIS = 'Dificuldade de concentração em atividades longas';

(integrationDatabaseUrl ? describe : describe.skip)(
  'PAEE contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: AeePlansService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    function createAccount(id_level: number) {
      const n = nextNumber();
      const isStudent = id_level === LEVELS.ALUNO_ESTUDANTE;
      return prisma.user.create({
        data: {
          full_name: `Conta ${n}`,
          cpf: `${isStudent ? 22 : 23}${String(n).padStart(9, '0')}`,
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
    async function dtoOf(
      email: string,
      semester = SEMESTER,
      body: Json = validBody(),
    ) {
      return (await createValidationPipe().transform(
        { ...body, student_email: email, semester },
        { type: 'body', metatype: CreateAeePlanDto },
      )) as CreateAeePlanDto;
    }

    // Os campos como o Prisma os recebe, sem o e-mail do estudante, para gravar
    // direto na tabela e provar as chaves estrangeiras sem passar pelo service.
    async function fieldsOf(email: string, semester = SEMESTER) {
      const { student_email: _email, ...fields } = await dtoOf(email, semester);
      return JSON.parse(JSON.stringify(fields)) as Omit<
        Prisma.AeePlanUncheckedCreateInput,
        'id_student' | 'id_author'
      >;
    }

    async function updateDtoOf(body: Json) {
      return (await createValidationPipe().transform(body, {
        type: 'body',
        metatype: UpdateAeePlanDto,
      })) as UpdateAeePlanDto;
    }

    const requestOf = (id: number, email: string, id_level: number) =>
      ({
        user: { sub: id, roles: [id_level], email, name: 'Quem pede' },
      }) as AuthenticatedRequest;

    // Apaga na ordem que as chaves pedem: o PAEE antes do estudante (RESTRICT),
    // e só então as contas.
    const deleteFixtures = async () => {
      await prisma.aeePlan.deleteMany({
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
        providers: [
          AeePlansService,
          StudentsService,
          FormRevisionsService,
          PrismaService,
        ],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(AeePlansService);

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
      it('should store the fields and read them back with the author and the dates only', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });
        const read = await service.findByStudent(
          student.email,
          requestOf(author.id, author.email, LEVELS.PROFISSIONAL_NAPNE),
        );

        expect(read).toEqual([created]);
        expect(Object.keys(created).sort()).toEqual(
          [
            'author',
            'basis',
            'created_at',
            'evaluation_procedures',
            'has_diagnosis',
            'id',
            'identification',
            'objectives',
            'purpose',
            'semester',
            'student',
            'supports',
            'updated_at',
          ].sort(),
        );
        expect(created.author).toEqual({
          id: author.id,
          full_name: author.full_name,
        });
        expect(created.student).toEqual({
          full_name: student.full_name,
          course: COURSE,
        });
        expect(created.semester).toBe(SEMESTER);
        expect(created.identification).toEqual(validBody().identification);
        expect(created.supports).toEqual(validBody().supports);
        expect(created.purpose).toEqual(validBody().purpose);
        expect(created.objectives).toEqual(validBody().objectives);
        expect(created.has_diagnosis).toBe(true);
        expect(created.basis).toBe(BASIS);
        expect(created.created_at).toBeInstanceOf(Date);
      });

      it('should never return the author password, e-mail or cpf', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });

        const serialized = JSON.stringify(created);
        expect(serialized).not.toContain(author.email);
        expect(serialized).not.toContain(author.cpf);
        expect(serialized).not.toContain(student.email);
        expect(serialized).not.toContain(student.cpf);
        expect(serialized).not.toContain('password');
      });

      it('should store the plan with every text at its maximum length', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email, SEMESTER, maxBody()),
          { id: author.id, name: 'Autor' },
        );

        expect(created.basis).toHaveLength(4000);
        expect(created.evaluation_procedures).toHaveLength(4000);
        expect(created.objectives).toEqual({
          general: 'ã'.repeat(2000),
          specific: 'ã'.repeat(2000),
        });
      });

      it('should store the blank form: empty texts, and no weekly hours', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email, SEMESTER, {
            ...blankSections(),
          }),
          { id: author.id, name: 'Autor' },
        );

        expect(created.identification).toEqual({
          subject: '',
          enrolled_subjects: '',
        });
        expect(created.basis).toBe('');
        expect(created.objectives).toEqual({ general: '', specific: '' });
      });

      it('should store has_diagnosis false, which is not the same as missing', async () => {
        const author = await createNapne();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(
            student.email,
            SEMESTER,
            setAt(validBody(), 'has_diagnosis', false),
          ),
          { id: author.id, name: 'Autor' },
        );

        expect(created.has_diagnosis).toBe(false);
      });
    });

    describe('um PAEE por estudante e período letivo', () => {
      it('should answer 409 for the second plan of the student in the semester and keep the first', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });

        await expect(
          service.create(
            await dtoOf(
              student.email,
              SEMESTER,
              setAt(validBody(), 'basis', 'Outra versão'),
            ),
            { id: author.id, name: 'Autor' },
          ),
        ).rejects.toThrow(
          new ConflictException(
            'Este estudante já tem um PAEE neste período letivo.',
          ),
        );

        const stored = await prisma.aeePlan.findMany({
          where: { id_student: student.id },
        });
        expect(stored).toHaveLength(1);
        expect(stored[0].basis).toBe(BASIS);
      });

      it('should refuse the second row at the database, with the P2002 code', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });
        const row = await prisma.aeePlan.findFirstOrThrow({
          where: { id_student: student.id },
        });
        const { id: _id, ...copy } = row;

        await expect(
          prisma.aeePlan.create({ data: copy as never }),
        ).rejects.toMatchObject({ code: 'P2002' });
      });

      it('should let the same student have a plan in each semester', async () => {
        const author = await createNapne();
        const student = await createStudent();

        await service.create(await dtoOf(student.email, '2026.1'), {
          id: author.id,
          name: 'Autor',
        });
        await expect(
          service.create(await dtoOf(student.email, '2026.2'), {
            id: author.id,
            name: 'Autor',
          }),
        ).resolves.toMatchObject({ semester: '2026.2' });
        await expect(
          service.create(await dtoOf(student.email, '2027.1'), {
            id: author.id,
            name: 'Autor',
          }),
        ).resolves.toMatchObject({ semester: '2027.1' });

        await expect(
          prisma.aeePlan.count({ where: { id_student: student.id } }),
        ).resolves.toBe(3);
      });

      it('should let two different students have a plan in the same semester', async () => {
        const author = await createNapne();
        const first = await createStudent();
        const second = await createStudent();

        await service.create(await dtoOf(first.email), {
          id: author.id,
          name: 'Autor',
        });

        await expect(
          service.create(await dtoOf(second.email), {
            id: author.id,
            name: 'Autor',
          }),
        ).resolves.toBeDefined();
      });

      it('should answer 404 for an account that is not a student, and write nothing', async () => {
        const author = await createNapne();
        const professional = await createNapne();

        await expect(
          service.create(await dtoOf(professional.email), {
            id: author.id,
            name: 'Autor',
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          prisma.aeePlan.count({ where: { id_student: professional.id } }),
        ).resolves.toBe(0);
      });
    });

    describe('listar', () => {
      it('should list the plans of the student from the newest semester to the oldest', async () => {
        const author = await createNapne();
        const student = await createStudent();
        for (const semester of ['2026.1', '2025.2', '2027.1', '2026.2']) {
          await service.create(await dtoOf(student.email, semester), {
            id: author.id,
            name: 'Autor',
          });
        }

        const read = await service.findByStudent(
          student.email,
          requestOf(author.id, author.email, LEVELS.PROFISSIONAL_NAPNE),
        );

        expect(read.map((plan) => plan.semester)).toEqual([
          '2027.1',
          '2026.2',
          '2026.1',
          '2025.2',
        ]);
      });

      it('should list only the plans of the student that was asked for', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const other = await createStudent();
        await service.create(await dtoOf(student.email, '2026.1'), {
          id: author.id,
          name: 'Autor',
        });
        await service.create(await dtoOf(other.email, '2026.1'), {
          id: author.id,
          name: 'Autor',
        });
        await service.create(await dtoOf(other.email, '2026.2'), {
          id: author.id,
          name: 'Autor',
        });

        const read = await service.findByStudent(
          student.email,
          requestOf(author.id, author.email, LEVELS.PROFISSIONAL_NAPNE),
        );

        expect(read).toHaveLength(1);
      });

      it('should answer an empty list for a student without plans', async () => {
        const reader = await createNapne();
        const student = await createStudent();

        await expect(
          service.findByStudent(
            student.email,
            requestOf(reader.id, reader.email, LEVELS.PROFISSIONAL_NAPNE),
          ),
        ).resolves.toEqual([]);
      });

      it('should answer 404 for an account that is not a student', async () => {
        const reader = await createNapne();
        const professional = await createNapne();

        await expect(
          service.findByStudent(
            professional.email,
            requestOf(reader.id, reader.email, LEVELS.PROFISSIONAL_NAPNE),
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('chaves estrangeiras', () => {
      it('should refuse a plan for a student that does not exist', async () => {
        const author = await createNapne();
        await expect(
          prisma.aeePlan.create({
            data: {
              ...(await fieldsOf('qualquer@paee.test')),
              id_student: 2147483647,
              id_author: author.id,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should refuse an author that does not exist', async () => {
        const student = await createStudent();

        await expect(
          prisma.aeePlan.create({
            data: {
              ...(await fieldsOf(student.email)),
              id_student: student.id,
              id_author: 2147483647,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should refuse to delete the student account while a plan exists (RESTRICT)', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });

        await expect(
          prisma.user.delete({ where: { id: student.id } }),
        ).rejects.toMatchObject({ code: 'P2003' });
        await expect(
          prisma.aeePlan.count({ where: { id_student: student.id } }),
        ).resolves.toBe(1);
      });

      it('should keep the plan with an unknown author when the author account is deleted (SET NULL)', async () => {
        const author = await createNapne();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });
        await service.create(await dtoOf(student.email, '2027.1'), {
          id: author.id,
          name: 'Autor',
        });

        await prisma.user.delete({ where: { id: author.id } });

        const reader = await createNapne();
        const read = await service.findByStudent(
          student.email,
          requestOf(reader.id, reader.email, LEVELS.PROFISSIONAL_NAPNE),
        );
        expect(read).toHaveLength(2);
        expect(read.map((plan) => plan.author)).toEqual([null, null]);
        expect(read[0].basis).toBe(BASIS);
      });

      it('should index id_author, which the SET NULL of the author searches by', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'AeePlan'
            AND indexname = 'AeePlan_id_author_idx'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('(id_author)');
      });

      it('should make unique the pair of student and semester, in this order', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'AeePlan'
            AND indexname = 'AeePlan_id_student_semester_key'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('UNIQUE');
        expect(rows[0].indexdef).toContain('(id_student, semester)');
      });
    });

    describe('acesso à leitura', () => {
      it('should let the student read his own plans and refuse the ones of another student', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const other = await createStudent();
        await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });
        await service.create(await dtoOf(other.email), {
          id: author.id,
          name: 'Autor',
        });

        await expect(
          service.findByStudent(
            student.email,
            requestOf(student.id, student.email, LEVELS.ALUNO_ESTUDANTE),
          ),
        ).resolves.toHaveLength(1);
        await expect(
          service.findByStudent(
            other.email,
            requestOf(student.id, student.email, LEVELS.ALUNO_ESTUDANTE),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    describe('editar e excluir', () => {
      it('should replace the sections that were sent, keep the others, the semester and the author', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const created = await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });

        const updated = await service.update(
          created.id,
          await updateDtoOf({
            basis: 'Novo embasamento',
            objectives: { general: 'Novo geral', specific: 'Novo específico' },
          }),
          REVISION_AUTHOR,
        );

        expect(updated.basis).toBe('Novo embasamento');
        expect(updated.objectives).toEqual({
          general: 'Novo geral',
          specific: 'Novo específico',
        });
        expect(updated.identification).toEqual(created.identification);
        expect(updated.supports).toEqual(created.supports);
        expect(updated.semester).toBe(created.semester);
        expect(updated.author).toEqual(created.author);
        expect(updated.created_at).toEqual(created.created_at);
      });

      it('should replace the whole section, dropping what it no longer has', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const created = await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });

        const withoutHours = {
          subject: 'Sala de recursos',
          enrolled_subjects: 'Matemática',
        };
        const updated = await service.update(
          created.id,
          await updateDtoOf({ identification: withoutHours }),
          REVISION_AUTHOR,
        );

        expect(updated.identification).toEqual(withoutHours);
      });

      it('should write has_diagnosis false over a true', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const created = await service.create(await dtoOf(student.email), {
          id: author.id,
          name: 'Autor',
        });

        const updated = await service.update(
          created.id,
          await updateDtoOf({ has_diagnosis: false }),
          REVISION_AUTHOR,
        );

        expect(updated.has_diagnosis).toBe(false);
      });

      it('should edit only the plan of the id, and not the other semesters of the student', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const first = await service.create(
          await dtoOf(student.email, '2026.1'),
          { id: author.id, name: 'Autor' },
        );
        await service.create(await dtoOf(student.email, '2026.2'), {
          id: author.id,
          name: 'Autor',
        });

        await service.update(
          first.id,
          await updateDtoOf({ basis: 'Só o primeiro' }),
          REVISION_AUTHOR,
        );

        const stored = await prisma.aeePlan.findMany({
          where: { id_student: student.id },
          orderBy: { semester: 'asc' },
        });
        expect(stored.map((plan) => plan.basis)).toEqual([
          'Só o primeiro',
          BASIS,
        ]);
      });

      it('should answer 404 when updating a plan that does not exist', async () => {
        await expect(
          service.update(
            2147483647,
            await updateDtoOf({ basis: 'x' }),
            REVISION_AUTHOR,
          ),
        ).rejects.toThrow('PAEE não encontrado');
      });

      it('should delete only the plan of the id, answer 404 the second time and let a new one be created', async () => {
        const author = await createNapne();
        const student = await createStudent();
        const first = await service.create(
          await dtoOf(student.email, '2026.1'),
          { id: author.id, name: 'Autor' },
        );
        await service.create(await dtoOf(student.email, '2026.2'), {
          id: author.id,
          name: 'Autor',
        });

        await expect(service.remove(first.id)).resolves.toMatchObject({
          message: expect.stringContaining('removido com sucesso'),
        });
        await expect(service.remove(first.id)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(
          prisma.aeePlan.count({ where: { id_student: student.id } }),
        ).resolves.toBe(1);
        await expect(
          service.create(await dtoOf(student.email, '2026.1'), {
            id: author.id,
            name: 'Autor',
          }),
        ).resolves.toBeDefined();
      });

      it('should answer 404 when deleting a plan that does not exist', async () => {
        await expect(service.remove(2147483647)).rejects.toThrow(
          'PAEE não encontrado',
        );
      });

      // O PostgreSQL recusa 2147483648 com o P2020 (valor fora do INTEGER). A
      // rota nem chega aqui (o ParsePositiveIdPipe responde 400), e sem a
      // conversão o service lançaria o erro do Prisma a quem o chamasse direto.
      it('should answer 404, and not 500, for an id above the INTEGER range', async () => {
        await expect(
          service.update(
            2147483648,
            await updateDtoOf({ basis: 'x' }),
            REVISION_AUTHOR,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(service.remove(2147483648)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });
    });
  },
);
