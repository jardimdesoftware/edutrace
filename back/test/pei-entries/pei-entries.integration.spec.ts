import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS, PHASES } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { CreatePeiEntryDto } from 'src/pei-entries/dto/create-pei-entry.dto';
import { UpdatePeiEntryDto } from 'src/pei-entries/dto/update-pei-entry.dto';
import { PeiEntriesService } from 'src/pei-entries/pei-entries.service';
import { ReportsService } from 'src/reports/reports.service';
import { StudentsService } from 'src/students/students.service';
import { requireIntegrationDatabaseUrl } from '../users/integration-database';
import {
  Json,
  SEMESTER,
  SUBJECT,
  blankContent,
  maxBody,
  validBody,
  validContent,
} from './pei-entry.fixtures';

// Roda contra um PostgreSQL real e só quando INTEGRATION_DATABASE_URL existe,
// então o npm test comum pula este arquivo. A unicidade parcial do registro do
// PEI (só entre os ativos), a exclusão lógica, as chaves estrangeiras (RESTRICT
// no estudante, SET NULL no autor), o formato do P2002 do @prisma/adapter-pg e
// os nomes da tabela antiga renomeada só existem no banco, e um Prisma mockado
// não executa nenhum dos quatro.
// Os specs de integração rodam em paralelo no mesmo banco, então este apaga só
// as contas do próprio domínio de e-mail (os registros do PEI são apagados antes
// das contas, porque não há CASCADE), e nunca a tabela inteira. O beforeAll
// recusa rodar num banco cujo nome não termine em "_it". O CPF usa o prefixo 24
// (estudante) e 25 (profissional), que nenhum outro spec de integração usa.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

const EMAIL_DOMAIN = '@pei.test';

(integrationDatabaseUrl ? describe : describe.skip)(
  'PEI por semestre e disciplina contra o PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: PeiEntriesService;
    let reports: ReportsService;
    let originalDatabaseUrl: string | undefined;
    let sequence = 0;

    const nextNumber = () => ++sequence;

    function createAccount(id_level: number) {
      const n = nextNumber();
      const isStudent = id_level === LEVELS.ALUNO_ESTUDANTE;
      return prisma.user.create({
        data: {
          full_name: `Conta ${n}`,
          cpf: `${isStudent ? 24 : 25}${String(n).padStart(9, '0')}`,
          email: `conta${n}${EMAIL_DOMAIN}`,
          password: 'x',
          id_level,
          id_current_phase: PHASES.TRIAGEM,
          ...(isStudent
            ? {
                service_status: 'WAITING' as const,
                queued_at: new Date(),
              }
            : {}),
        },
      });
    }

    const createStudent = () => createAccount(LEVELS.ALUNO_ESTUDANTE);
    const createTeacher = () => createAccount(LEVELS.PROFISSIONAL_EDUCACAO);

    // O corpo passa pelo pipe real, como na rota: o service recebe a instância
    // do DTO, com os pares aninhados também como instâncias de classe.
    async function dtoOf(
      email: string,
      overrides: Json = {},
      body: Json = validBody(),
    ) {
      return (await createValidationPipe().transform(
        { ...body, student_email: email, ...overrides },
        { type: 'body', metatype: CreatePeiEntryDto },
      )) as CreatePeiEntryDto;
    }

    // Os campos como o Prisma os recebe, sem o e-mail do estudante, para gravar
    // direto na tabela e provar as chaves estrangeiras sem passar pelo service.
    async function fieldsOf(email: string, overrides: Json = {}) {
      const { student_email: _email, ...fields } = await dtoOf(
        email,
        overrides,
      );
      return JSON.parse(JSON.stringify(fields)) as Omit<
        Prisma.PeiEntryUncheckedCreateInput,
        'id_student' | 'id_author'
      >;
    }

    async function updateDtoOf(body: Json) {
      return (await createValidationPipe().transform(body, {
        type: 'body',
        metatype: UpdatePeiEntryDto,
      })) as UpdatePeiEntryDto;
    }

    const requestOf = (id: number, email: string, id_level: number) =>
      ({
        user: { sub: id, id_level, email, name: 'Quem pede' },
      }) as AuthenticatedRequest;

    const list = (reader: { id: number; email: string }, email: string) =>
      service.findByStudent(
        email,
        requestOf(reader.id, reader.email, LEVELS.PROFISSIONAL_EDUCACAO),
      );

    // Apaga na ordem que as chaves pedem: os registros do PEI (também os
    // excluídos logicamente) antes do estudante (RESTRICT), e só então as
    // contas. A tabela antiga também perde as linhas deste spec.
    const deleteFixtures = async () => {
      await prisma.peiEntry.deleteMany({
        where: { student: { email: { endsWith: EMAIL_DOMAIN } } },
      });
      await prisma.plansEducationLegacy.deleteMany({
        where: { student_email: { endsWith: EMAIL_DOMAIN } },
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
          PeiEntriesService,
          ReportsService,
          StudentsService,
          PrismaService,
        ],
      }).compile();

      await module.init();
      prisma = module.get(PrismaService);
      service = module.get(PeiEntriesService);
      reports = module.get(ReportsService);

      // O banco do job nasce só com as migrations, sem o seed. O createMany
      // com skipDuplicates é um INSERT ... ON CONFLICT DO NOTHING, que não
      // falha para o spec que perde a corrida dos que rodam em paralelo.
      await prisma.level.createMany({
        data: [
          { id: LEVELS.ALUNO_ESTUDANTE, name: 'Estudante/Família' },
          {
            id: LEVELS.PROFISSIONAL_EDUCACAO,
            name: 'Profissional da Educação',
          },
        ],
        skipDuplicates: true,
      });
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
      it('should store the fields and read them back with the author name and the dates only', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        const read = await list(author, student.email);

        expect(read).toEqual([created]);
        expect(Object.keys(created).sort()).toEqual(
          [
            'adapted_assessments',
            'adapted_methodologies',
            'adapted_objectives',
            'adapted_resources',
            'author',
            'created_at',
            'general_notes',
            'id',
            'id_author',
            'individual_sessions',
            'next_semester_notes',
            'prioritized_contents',
            'semester',
            'semester_difficulties',
            'semester_progress',
            'subject',
            'syllabus_adaptations',
            'updated_at',
          ].sort(),
        );
        expect(created.id_author).toBe(author.id);
        expect(created.author).toEqual({ full_name: author.full_name });
        expect(created.semester).toBe(SEMESTER);
        expect(created.subject).toBe(SUBJECT);
        expect(created.syllabus_adaptations).toEqual(
          validContent().syllabus_adaptations,
        );
        expect(created.adapted_objectives).toBe(
          validContent().adapted_objectives,
        );
        expect(created.created_at).toBeInstanceOf(Date);
      });

      it('should never return the author password, e-mail or cpf, nor any data of the student', async () => {
        const author = await createTeacher();
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
        expect(serialized).not.toContain(student.full_name);
        expect(serialized).not.toContain('password');
        expect(serialized).not.toContain('deleted_at');
        expect(serialized).not.toContain('id_student');
      });

      it('should keep the order of the pairs', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const pairs = ['C', 'A', 'B'].map((letter) => ({
          syllabus_content: letter,
          adaptation: `adequação ${letter}`,
        }));

        const created = await service.create(
          await dtoOf(student.email, { syllabus_adaptations: pairs }),
          author.id,
        );

        expect(created.syllabus_adaptations).toEqual(pairs);
      });

      it('should store the entry with every text at its maximum length and 20 pairs', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email, {}, maxBody()),
          author.id,
        );

        expect(created.subject).toHaveLength(150);
        expect(created.general_notes).toHaveLength(2000);
        expect(created.syllabus_adaptations).toEqual(
          maxBody().syllabus_adaptations,
        );
      });

      it('should store the blank form: empty texts and an empty list', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        const created = await service.create(
          await dtoOf(student.email, blankContent()),
          author.id,
        );

        expect(created.adapted_objectives).toBe('');
        expect(created.general_notes).toBe('');
        expect(created.syllabus_adaptations).toEqual([]);
      });

      it('should answer 404 for an account that is not a student, and write nothing', async () => {
        const author = await createTeacher();
        const professional = await createTeacher();

        await expect(
          service.create(await dtoOf(professional.email), author.id),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          prisma.peiEntry.count({ where: { id_student: professional.id } }),
        ).resolves.toBe(0);
      });
    });

    // A unicidade é de (estudante, semestre, disciplina) só entre os ativos: o
    // índice único é parcial (WHERE deleted_at IS NULL).
    describe('um registro ativo por estudante, semestre e disciplina', () => {
      it('should answer 409 for the second active entry of the trio and keep the first', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await expect(
          service.create(
            await dtoOf(student.email, { general_notes: 'Outra versão' }),
            author.id,
          ),
        ).rejects.toThrow(
          new ConflictException(
            'Este estudante já tem um registro do PEI desta disciplina neste semestre.',
          ),
        );

        const stored = await prisma.peiEntry.findMany({
          where: { id_student: student.id },
        });
        expect(stored).toHaveLength(1);
        expect(stored[0].general_notes).toBe(validContent().general_notes);
      });

      it('should answer 409 even when the second entry is written by another professor', async () => {
        const first = await createTeacher();
        const second = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), first.id);

        await expect(
          service.create(await dtoOf(student.email), second.id),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('should refuse the second active row at the database, with the P2002 code', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        const row = await prisma.peiEntry.findFirstOrThrow({
          where: { id_student: student.id },
        });
        const { id: _id, ...copy } = row;

        await expect(
          prisma.peiEntry.create({ data: copy as never }),
        ).rejects.toMatchObject({ code: 'P2002' });
      });

      it('should let the same student have an entry in each subject of the semester', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        await service.create(
          await dtoOf(student.email, { subject: 'Matemática' }),
          author.id,
        );
        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Física' }),
            author.id,
          ),
        ).resolves.toMatchObject({ subject: 'Física' });
      });

      it('should let the same student have the same subject in each semester', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        await service.create(
          await dtoOf(student.email, { semester: '2026.1' }),
          author.id,
        );
        await expect(
          service.create(
            await dtoOf(student.email, { semester: '2026.2' }),
            author.id,
          ),
        ).resolves.toMatchObject({ semester: '2026.2' });
        await expect(
          prisma.peiEntry.count({ where: { id_student: student.id } }),
        ).resolves.toBe(2);
      });

      it('should let two different students have the same subject in the same semester', async () => {
        const author = await createTeacher();
        const first = await createStudent();
        const second = await createStudent();

        await service.create(await dtoOf(first.email), author.id);

        await expect(
          service.create(await dtoOf(second.email), author.id),
        ).resolves.toBeDefined();
      });

      // A comparação é pelo texto exato, depois do trim feito no DTO.
      it('should compare the subject by the exact text, so that the case makes another entry', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        await service.create(
          await dtoOf(student.email, { subject: 'Matemática' }),
          author.id,
        );

        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'matemática' }),
            author.id,
          ),
        ).resolves.toMatchObject({ subject: 'matemática' });
      });

      // O DTO grava a disciplina em NFC: o mesmo texto digitado com a letra e o
      // acento combinante separados (NFD) tem a mesma aparência e outros bytes, e
      // sem a normalização seria uma segunda disciplina.
      it('should store the subject in NFC when it was typed in NFD', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const nfc = SUBJECT.normalize('NFC');
        const nfd = SUBJECT.normalize('NFD');
        expect(nfd.length).toBeGreaterThan(nfc.length);

        const created = await service.create(
          await dtoOf(student.email, { subject: nfd }),
          author.id,
        );

        expect(created.subject).toBe(nfc);
        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.subject).toBe(nfc);
        expect(stored.subject).toHaveLength(nfc.length);
      });

      it('should answer 409 when the same subject comes in NFD after being stored in NFC', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(
          await dtoOf(student.email, { subject: SUBJECT.normalize('NFC') }),
          author.id,
        );

        await expect(
          service.create(
            await dtoOf(student.email, { subject: SUBJECT.normalize('NFD') }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(
          prisma.peiEntry.count({ where: { id_student: student.id } }),
        ).resolves.toBe(1);
      });

      it('should answer 409 when the same subject comes in NFC after being stored from NFD', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(
          await dtoOf(student.email, { subject: SUBJECT.normalize('NFD') }),
          author.id,
        );

        await expect(
          service.create(
            await dtoOf(student.email, { subject: SUBJECT.normalize('NFC') }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('should treat the subject with spaces around as the same entry, because the DTO trims it', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await expect(
          service.create(
            await dtoOf(student.email, { subject: `  ${SUBJECT}  ` }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('should make unique, only among the active rows, the trio of student, semester and subject', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'PeiEntry'
            AND indexname = 'PeiEntry_id_student_semester_subject_key'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('UNIQUE');
        expect(rows[0].indexdef).toContain('(id_student, semester, subject)');
        expect(rows[0].indexdef).toContain('WHERE (deleted_at IS NULL)');
      });
    });

    describe('exclusão lógica', () => {
      it('should mark the entry as deleted, keep the row and its content, and answer the message', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        await expect(service.remove(created.id, author.id)).resolves.toEqual({
          message: `Registro do PEI com id ${created.id} foi removido com sucesso`,
        });

        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.deleted_at).toBeInstanceOf(Date);
        expect(stored.adapted_objectives).toBe(
          validContent().adapted_objectives,
        );
        expect(stored.syllabus_adaptations).toEqual(
          validContent().syllabus_adaptations,
        );
        expect(stored.id_author).toBe(author.id);
        expect(stored.id_student).toBe(student.id);
      });

      it('should take the deleted entry out of the list and out of the report, and keep the active ones', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const excluded = await service.create(
          await dtoOf(student.email, { subject: 'Física' }),
          author.id,
        );
        await service.create(
          await dtoOf(student.email, { subject: 'Matemática' }),
          author.id,
        );

        await service.remove(excluded.id, author.id);

        const read = await list(author, student.email);
        expect(read.map((entry) => entry.subject)).toEqual(['Matemática']);
        const report = await reports.findOne(student.email);
        expect(report.peiEntries.map((entry) => entry.subject)).toEqual([
          'Matemática',
        ]);
      });

      it('should answer 404 the second time the same entry is deleted', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        await service.remove(created.id, author.id);

        await expect(
          service.remove(created.id, author.id),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('should answer 404, and not edit, when the entry is already deleted', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        await service.remove(created.id, author.id);

        await expect(
          service.update(
            created.id,
            await updateDtoOf({ general_notes: 'Tentativa' }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.general_notes).toBe(validContent().general_notes);
      });

      it('should let the professor create the same trio again after deleting it', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const first = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        await service.remove(first.id, author.id);

        const second = await service.create(
          await dtoOf(student.email, { general_notes: 'Refeito' }),
          author.id,
        );

        expect(second.id).not.toBe(first.id);
        expect(second.general_notes).toBe('Refeito');
        await expect(
          prisma.peiEntry.count({ where: { id_student: student.id } }),
        ).resolves.toBe(2);
        await expect(
          prisma.peiEntry.count({
            where: { id_student: student.id, deleted_at: null },
          }),
        ).resolves.toBe(1);
      });

      it('should let the same trio be deleted and created again more than once', async () => {
        const author = await createTeacher();
        const student = await createStudent();

        for (let round = 0; round < 3; round++) {
          const created = await service.create(
            await dtoOf(student.email),
            author.id,
          );
          await service.remove(created.id, author.id);
        }

        await expect(
          prisma.peiEntry.count({
            where: { id_student: student.id, deleted_at: { not: null } },
          }),
        ).resolves.toBe(3);
      });

      it('should still refuse a second active entry while another one of the trio is deleted', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const first = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        await service.remove(first.id, author.id);
        await service.create(await dtoOf(student.email), author.id);

        await expect(
          service.create(await dtoOf(student.email), author.id),
        ).rejects.toBeInstanceOf(ConflictException);
      });
    });

    describe('listar', () => {
      it('should list the entries from the newest semester to the oldest and, in the same semester, by subject', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        for (const [semester, subject] of [
          ['2026.1', 'Matemática'],
          ['2025.2', 'Física'],
          ['2027.1', 'Artes'],
          ['2026.2', 'Matemática'],
          ['2026.2', 'Biologia'],
          ['2026.2', 'Física'],
        ]) {
          await service.create(
            await dtoOf(student.email, { semester, subject }),
            author.id,
          );
        }

        const read = await list(author, student.email);

        expect(read.map((entry) => [entry.semester, entry.subject])).toEqual([
          ['2027.1', 'Artes'],
          ['2026.2', 'Biologia'],
          ['2026.2', 'Física'],
          ['2026.2', 'Matemática'],
          ['2026.1', 'Matemática'],
          ['2025.2', 'Física'],
        ]);
      });

      it('should list only the entries of the student that was asked for', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const other = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        await service.create(await dtoOf(other.email), author.id);
        await service.create(
          await dtoOf(other.email, { subject: 'Física' }),
          author.id,
        );

        await expect(list(author, student.email)).resolves.toHaveLength(1);
      });

      it('should answer an empty list for a student without entries', async () => {
        const reader = await createTeacher();
        const student = await createStudent();

        await expect(list(reader, student.email)).resolves.toEqual([]);
      });

      it('should answer 404 for an account that is not a student', async () => {
        const reader = await createTeacher();
        const professional = await createTeacher();

        await expect(list(reader, professional.email)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });

      it('should let the student read his own entries and refuse the ones of another student', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const other = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        await service.create(await dtoOf(other.email), author.id);

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

    describe('relatório', () => {
      it('should return the active entries with the semester, the subject, the content and the author name only', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        const report = await reports.findOne(student.email);

        expect(report).not.toHaveProperty('plansEducation');
        expect(report.peiEntries).toHaveLength(1);
        expect(Object.keys(report.peiEntries[0]).sort()).toEqual(
          [
            'adapted_assessments',
            'adapted_methodologies',
            'adapted_objectives',
            'adapted_resources',
            'author',
            'general_notes',
            'individual_sessions',
            'next_semester_notes',
            'prioritized_contents',
            'semester',
            'semester_difficulties',
            'semester_progress',
            'subject',
            'syllabus_adaptations',
          ].sort(),
        );
        expect(report.peiEntries[0].author).toEqual({
          full_name: author.full_name,
        });
        expect(JSON.stringify(report)).not.toContain(author.email);
        expect(JSON.stringify(report)).not.toContain(author.cpf);
      });

      it('should return the entries in the same order as the list', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        for (const [semester, subject] of [
          ['2026.1', 'Matemática'],
          ['2026.2', 'Física'],
          ['2026.2', 'Artes'],
        ]) {
          await service.create(
            await dtoOf(student.email, { semester, subject }),
            author.id,
          );
        }

        const report = await reports.findOne(student.email);

        expect(
          report.peiEntries.map((entry) => [entry.semester, entry.subject]),
        ).toEqual([
          ['2026.2', 'Artes'],
          ['2026.2', 'Física'],
          ['2026.1', 'Matemática'],
        ]);
      });
    });

    describe('chaves estrangeiras', () => {
      it('should refuse an entry for a student that does not exist', async () => {
        const author = await createTeacher();
        await expect(
          prisma.peiEntry.create({
            data: {
              ...(await fieldsOf('qualquer@pei.test')),
              id_student: 2147483647,
              id_author: author.id,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should refuse an author that does not exist', async () => {
        const student = await createStudent();

        await expect(
          prisma.peiEntry.create({
            data: {
              ...(await fieldsOf(student.email)),
              id_student: student.id,
              id_author: 2147483647,
            },
          }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should refuse to delete the student account while an entry exists (RESTRICT)', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);

        await expect(
          prisma.user.delete({ where: { id: student.id } }),
        ).rejects.toMatchObject({ code: 'P2003' });
        await expect(
          prisma.peiEntry.count({ where: { id_student: student.id } }),
        ).resolves.toBe(1);
      });

      it('should refuse to delete the student account while only a logically deleted entry exists (RESTRICT)', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        await service.remove(created.id, author.id);

        await expect(
          prisma.user.delete({ where: { id: student.id } }),
        ).rejects.toMatchObject({ code: 'P2003' });
      });

      it('should keep the entries with an unknown author when the author account is deleted (SET NULL)', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await service.create(await dtoOf(student.email), author.id);
        await service.create(
          await dtoOf(student.email, { subject: 'Física' }),
          author.id,
        );

        await prisma.user.delete({ where: { id: author.id } });

        const reader = await createTeacher();
        const read = await list(reader, student.email);
        expect(read).toHaveLength(2);
        expect(read.map((entry) => entry.author)).toEqual([null, null]);
        expect(read.map((entry) => entry.id_author)).toEqual([null, null]);
        expect(read[0].adapted_objectives).toBe(
          validContent().adapted_objectives,
        );
      });

      it('should index id_author, which the SET NULL of the author searches by', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'PeiEntry'
            AND indexname = 'PeiEntry_id_author_idx'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('(id_author)');
      });

      // A checagem do RESTRICT, ao excluir uma conta de estudante, procura os
      // registros dele por id_student. O índice único parcial não atende essa
      // busca (o predicado deleted_at IS NULL não é implicado por ela), então
      // sem um índice próprio cada exclusão de conta varreria a tabela.
      it('should index id_student with a plain index, which the RESTRICT check of the student searches by', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = current_schema()
            AND tablename = 'PeiEntry'
            AND indexname = 'PeiEntry_id_student_idx'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain('(id_student)');
        expect(rows[0].indexdef).not.toContain('UNIQUE');
        expect(rows[0].indexdef).not.toContain('WHERE');
      });

      // Com a varredura sequencial desligada, o plano da busca que o RESTRICT
      // faz (FOR KEY SHARE por id_student) só tem o índice como caminho: sem o
      // PeiEntry_id_student_idx ele cai em Seq Scan, porque o índice único
      // parcial não serve.
      it('should use the id_student index in the lookup that the RESTRICT check makes', async () => {
        const plan = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
          const rows = await tx.$queryRaw<{ 'QUERY PLAN': string }[]>`
            EXPLAIN SELECT 1 FROM ONLY "PeiEntry" x
            WHERE "id_student" = 1 FOR KEY SHARE OF x`;
          return rows.map((row) => row['QUERY PLAN']).join('\n');
        });

        expect(plan).toContain('PeiEntry_id_student_idx');
        expect(plan).not.toContain('Seq Scan');
      });
    });

    // O registro sem autor (id_author nulo, porque a conta do autor foi
    // excluída) não é de ninguém: qualquer Profissional da Educação o exclui,
    // para poder criar o seu. A edição segue só do autor, e então o registro sem
    // autor não é editado por ninguém.
    describe('registro sem autor', () => {
      async function orphanEntry() {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );
        await prisma.user.delete({ where: { id: author.id } });
        return { student, created };
      }

      it('should let any Education professional delete it, and keep the row without author', async () => {
        const { student, created } = await orphanEntry();
        const other = await createTeacher();

        await expect(service.remove(created.id, other.id)).resolves.toEqual({
          message: `Registro do PEI com id ${created.id} foi removido com sucesso`,
        });

        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.deleted_at).toBeInstanceOf(Date);
        expect(stored.id_author).toBeNull();
        expect(stored.id_student).toBe(student.id);
        expect(stored.adapted_objectives).toBe(
          validContent().adapted_objectives,
        );
      });

      it('should let the professor that deleted it create his own entry of the same trio', async () => {
        const { student, created } = await orphanEntry();
        const other = await createTeacher();
        await service.remove(created.id, other.id);

        const own = await service.create(
          await dtoOf(student.email, { general_notes: 'Meu registro' }),
          other.id,
        );

        expect(own.id).not.toBe(created.id);
        expect(own.id_author).toBe(other.id);
        await expect(list(other, student.email)).resolves.toHaveLength(1);
      });

      it('should answer 404 the second time it is deleted', async () => {
        const { created } = await orphanEntry();
        const other = await createTeacher();
        await service.remove(created.id, other.id);

        await expect(
          service.remove(created.id, other.id),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('should still answer 403 to every professor that edits it, and leave it as it was', async () => {
        const { created } = await orphanEntry();
        const first = await createTeacher();
        const second = await createTeacher();

        for (const editor of [first, second]) {
          await expect(
            service.update(
              created.id,
              await updateDtoOf({ general_notes: 'Invasão' }),
              editor.id,
            ),
          ).rejects.toBeInstanceOf(ForbiddenException);
        }
        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.general_notes).toBe(validContent().general_notes);
        expect(stored.id_author).toBeNull();
        expect(stored.deleted_at).toBeNull();
      });

      it('should not open the delete of the entries that still have a living author', async () => {
        const living = await createTeacher();
        const other = await createTeacher();
        const student = await createStudent();
        const orphan = await service.create(
          await dtoOf(student.email, { subject: 'Sem autor' }),
          living.id,
        );
        await prisma.peiEntry.update({
          where: { id: orphan.id },
          data: { id_author: null },
        });
        const kept = await service.create(
          await dtoOf(student.email, { subject: 'Com autor' }),
          living.id,
        );

        await expect(
          service.remove(orphan.id, other.id),
        ).resolves.toBeDefined();
        await expect(service.remove(kept.id, other.id)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: kept.id },
        });
        expect(stored.deleted_at).toBeNull();
        expect(stored.id_author).toBe(living.id);
      });
    });

    // No máximo 300 registros ativos por estudante. A contagem e a gravação
    // rodam na transação que trava a linha do estudante, então dois POST
    // simultâneos não passam do teto.
    describe('teto de 300 registros ativos por estudante', () => {
      const MAX_MESSAGE =
        'Este estudante já tem o máximo de 300 registros do PEI ativos.';

      // Grava direto na tabela, sem passar pelo service, os registros que
      // enchem o teto. A disciplina é "Disciplina N", com N a partir de zero.
      async function fillActive(
        student: { id: number; email: string },
        authorId: number,
        count: number,
      ) {
        const base = await fieldsOf(student.email);
        await prisma.peiEntry.createMany({
          data: Array.from({ length: count }, (_, index) => ({
            ...base,
            subject: `Disciplina ${index}`,
            id_student: student.id,
            id_author: authorId,
          })),
        });
      }

      const active = (studentId: number) =>
        prisma.peiEntry.count({
          where: { id_student: studentId, deleted_at: null },
        });

      it('should answer 409 for the 301st active entry, and write nothing', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 300);

        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Uma a mais' }),
            author.id,
          ),
        ).rejects.toThrow(new ConflictException(MAX_MESSAGE));

        await expect(active(student.id)).resolves.toBe(300);
      });

      it('should accept the 300th active entry and refuse the next one', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 299);

        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Trecentésima' }),
            author.id,
          ),
        ).resolves.toMatchObject({ subject: 'Trecentésima' });
        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Excedente' }),
            author.id,
          ),
        ).rejects.toThrow(new ConflictException(MAX_MESSAGE));

        await expect(active(student.id)).resolves.toBe(300);
      });

      it('should free a place when one entry is deleted', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 300);
        const first = await prisma.peiEntry.findFirstOrThrow({
          where: { id_student: student.id },
          orderBy: { id: 'asc' },
        });

        await service.remove(first.id, author.id);

        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Vaga aberta' }),
            author.id,
          ),
        ).resolves.toMatchObject({ subject: 'Vaga aberta' });
        await expect(active(student.id)).resolves.toBe(300);
        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Sem vaga' }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('should not count the deleted entries', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 300);
        await prisma.peiEntry.updateMany({
          where: {
            id_student: student.id,
            subject: { in: ['Disciplina 0', 'Disciplina 1', 'Disciplina 2'] },
          },
          data: { deleted_at: new Date() },
        });

        await expect(active(student.id)).resolves.toBe(297);
        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Cabe' }),
            author.id,
          ),
        ).resolves.toBeDefined();
      });

      it('should count the limit per student', async () => {
        const author = await createTeacher();
        const full = await createStudent();
        const other = await createStudent();
        await fillActive(full, author.id, 300);

        await expect(
          service.create(await dtoOf(other.email), author.id),
        ).resolves.toBeDefined();
        await expect(
          service.create(
            await dtoOf(full.email, { subject: 'Excedente' }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('should count the entries of every author toward the limit of the student', async () => {
        const first = await createTeacher();
        const second = await createTeacher();
        const student = await createStudent();
        await fillActive(student, first.id, 300);

        await expect(
          service.create(
            await dtoOf(student.email, { subject: 'Outro professor' }),
            second.id,
          ),
        ).rejects.toThrow(new ConflictException(MAX_MESSAGE));
      });

      // A corrida deterministica: outra transação trava a linha do estudante e
      // grava o 300º registro sem confirmar. Com a trava, o POST espera a outra
      // confirmar e então conta 300 (409). Sem a trava, o POST conta 299 (a
      // gravação não confirmada não aparece), grava, e o INSERT só espera a
      // outra transação pela chave estrangeira: o estudante termina com 301.
      it('should wait on the lock of the student row and count after the other creation commits', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 299);
        const concurrentData = {
          ...(await fieldsOf(student.email, { subject: 'Do outro POST' })),
          id_student: student.id,
          id_author: author.id,
        };
        const body = await dtoOf(student.email, { subject: 'Deste POST' });

        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        let lockTaken!: () => void;
        const locked = new Promise<void>((resolve) => {
          lockTaken = resolve;
        });
        const concurrent = prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT "id" FROM "User" WHERE "id" = ${student.id} FOR UPDATE`;
          await tx.peiEntry.create({ data: concurrentData });
          lockTaken();
          await held;
        });
        await locked;

        const outcome = service.create(body, author.id).then(
          () => 'created' as const,
          (error: unknown) => error,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        release();
        await concurrent;

        await expect(outcome).resolves.toEqual(
          new ConflictException(MAX_MESSAGE),
        );
        await expect(active(student.id)).resolves.toBe(300);
      });

      it('should let exactly one of two simultaneous creations through when the student has 299 active entries', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 299);
        const bodies = await Promise.all(
          [0, 1].map((n) => dtoOf(student.email, { subject: `Corrida ${n}` })),
        );

        const results = await Promise.allSettled(
          bodies.map((body) => service.create(body, author.id)),
        );

        const created = results.filter((r) => r.status === 'fulfilled');
        const refused = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(created).toHaveLength(1);
        expect(refused).toHaveLength(1);
        expect(refused[0].reason).toEqual(new ConflictException(MAX_MESSAGE));
        await expect(active(student.id)).resolves.toBe(300);
      });

      it('should let exactly one of eight simultaneous creations through when the student has 299 active entries', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        await fillActive(student, author.id, 299);
        const bodies = await Promise.all(
          Array.from({ length: 8 }, (_, n) =>
            dtoOf(student.email, { subject: `Corrida ${n}` }),
          ),
        );

        const results = await Promise.allSettled(
          bodies.map((body) => service.create(body, author.id)),
        );

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const refused = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(refused).toHaveLength(7);
        for (const result of refused) {
          expect(result.reason).toEqual(new ConflictException(MAX_MESSAGE));
        }
        await expect(active(student.id)).resolves.toBe(300);
      });

      it('should lock only the row of the student, and let the creations of other students go on in parallel', async () => {
        const author = await createTeacher();
        const students = await Promise.all([createStudent(), createStudent()]);
        const bodies = await Promise.all(
          students.map((student) => dtoOf(student.email)),
        );

        const results = await Promise.allSettled(
          bodies.map((body) => service.create(body, author.id)),
        );

        expect(results.map((r) => r.status)).toEqual([
          'fulfilled',
          'fulfilled',
        ]);
      });
    });

    // A troca de nível do professor (UsersService.update) trava a linha dele
    // com FOR UPDATE e depois as dos estudantes ligados a ele. O create trava o
    // estudante e depois grava o registro, e a chave estrangeira id_author pede
    // FOR KEY SHARE na linha do professor. Na ordem estudante, professor, as
    // duas transações esperariam uma pela outra (deadlock, e o PostgreSQL aborta
    // uma delas: 500). A ordem das travas é a do projeto: servidor primeiro.
    describe('ordem das travas: professor antes do estudante', () => {
      const BLOCKED_WAIT_LIMIT_MS = 5000;
      const BLOCKED_POLL_MS = 25;
      const TEST_TIMEOUT_MS = 20000;

      // O create só está parado numa trava quando o PostgreSQL o lista como
      // bloqueado pela transação do teste (pg_blocking_pids), e não por tempo.
      async function waitUntilBlockedBy(holderPid: number) {
        const deadline = Date.now() + BLOCKED_WAIT_LIMIT_MS;
        while (Date.now() < deadline) {
          const blocked = await prisma.$queryRaw<{ pid: number }[]>`
            SELECT pid FROM pg_stat_activity
            WHERE ${holderPid}::int = ANY(pg_blocking_pids(pid))`;
          if (blocked.length > 0) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, BLOCKED_POLL_MS));
        }
        throw new Error(
          'O create não ficou parado em nenhuma trava da transação do teste.',
        );
      }

      // A transação do teste faz o papel da troca de nível: trava o professor
      // (FOR UPDATE) e, com o create parado, trava o estudante dele. Com a
      // ordem certa, o create ainda está na trava do professor e não tocou no
      // estudante, então a trava do estudante sai de imediato, a transação
      // confirma e o create termina com sucesso. Com a ordem inversa, o create
      // já segura o estudante e espera o professor: é o deadlock, e uma das duas
      // falha (a trava do estudante ou o create).
      it(
        'should let a level change that holds the professor lock reach the student, and then create the entry',
        async () => {
          const author = await createTeacher();
          const student = await createStudent();
          const body = await dtoOf(student.email);
          let outcome!: Promise<unknown>;

          const holder = prisma
            .$transaction(async (tx) => {
              const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
              SELECT pg_backend_pid() AS pid`;
              await tx.$queryRaw`
              SELECT "id" FROM "User" WHERE "id" = ${author.id} FOR UPDATE`;

              outcome = service.create(body, author.id).then(
                () => 'created' as const,
                (error: unknown) => error,
              );
              await waitUntilBlockedBy(pid);

              await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
              await tx.$queryRaw`
              SELECT "id" FROM "User" WHERE "id" = ${student.id} FOR UPDATE`;
            })
            .then(
              () => 'committed' as const,
              (error: unknown) => error,
            );

          await expect(holder).resolves.toBe('committed');
          await expect(outcome).resolves.toBe('created');
          await expect(
            prisma.peiEntry.count({ where: { id_student: student.id } }),
          ).resolves.toBe(1);
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('editar', () => {
      it('should replace the fields that were sent, keep the others, the semester, the subject and the author', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        const updated = await service.update(
          created.id,
          await updateDtoOf({
            general_notes: 'Novas observações',
            adapted_resources: '',
          }),
          author.id,
        );

        expect(updated.general_notes).toBe('Novas observações');
        expect(updated.adapted_resources).toBe('');
        expect(updated.adapted_objectives).toBe(created.adapted_objectives);
        expect(updated.syllabus_adaptations).toEqual(
          created.syllabus_adaptations,
        );
        expect(updated.semester).toBe(created.semester);
        expect(updated.subject).toBe(created.subject);
        expect(updated.id_author).toBe(author.id);
        expect(updated.author).toEqual(created.author);
        expect(updated.created_at).toEqual(created.created_at);
        expect(updated.updated_at).toBeInstanceOf(Date);
      });

      it('should replace the whole list of pairs, and clear it with an empty list', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        const replaced = await service.update(
          created.id,
          await updateDtoOf({
            syllabus_adaptations: [
              { syllabus_content: 'Só este', adaptation: '' },
            ],
          }),
          author.id,
        );
        expect(replaced.syllabus_adaptations).toEqual([
          { syllabus_content: 'Só este', adaptation: '' },
        ]);

        const cleared = await service.update(
          created.id,
          await updateDtoOf({ syllabus_adaptations: [] }),
          author.id,
        );
        expect(cleared.syllabus_adaptations).toEqual([]);
      });

      it('should edit only the entry of the id, and not the other ones of the student', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const first = await service.create(
          await dtoOf(student.email, { subject: 'Física' }),
          author.id,
        );
        await service.create(
          await dtoOf(student.email, { subject: 'Matemática' }),
          author.id,
        );

        await service.update(
          first.id,
          await updateDtoOf({ general_notes: 'Só a primeira' }),
          author.id,
        );

        const stored = await prisma.peiEntry.findMany({
          where: { id_student: student.id },
          orderBy: { subject: 'asc' },
        });
        expect(stored.map((entry) => entry.general_notes)).toEqual([
          'Só a primeira',
          validContent().general_notes,
        ]);
      });

      it('should answer 403 to another professor and leave the entry as it was', async () => {
        const author = await createTeacher();
        const other = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        await expect(
          service.update(
            created.id,
            await updateDtoOf({ general_notes: 'Invasão' }),
            other.id,
          ),
        ).rejects.toThrow(
          new ForbiddenException(
            'Você só pode alterar os registros do PEI que você mesmo criou',
          ),
        );
        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.general_notes).toBe(validContent().general_notes);
        expect(stored.id_author).toBe(author.id);
      });

      it('should answer 404 when updating an entry that does not exist', async () => {
        const author = await createTeacher();

        await expect(
          service.update(
            2147483647,
            await updateDtoOf({ general_notes: 'x' }),
            author.id,
          ),
        ).rejects.toThrow('Registro do PEI não encontrado');
      });

      it('should answer 404, and not 403, to a professor that is not the author when the entry does not exist', async () => {
        const other = await createTeacher();

        await expect(
          service.update(
            2147483647,
            await updateDtoOf({ general_notes: 'x' }),
            other.id,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('excluir', () => {
      it('should answer 403 to another professor and keep the entry active', async () => {
        const author = await createTeacher();
        const other = await createTeacher();
        const student = await createStudent();
        const created = await service.create(
          await dtoOf(student.email),
          author.id,
        );

        await expect(
          service.remove(created.id, other.id),
        ).rejects.toBeInstanceOf(ForbiddenException);
        const stored = await prisma.peiEntry.findUniqueOrThrow({
          where: { id: created.id },
        });
        expect(stored.deleted_at).toBeNull();
      });

      it('should delete only the entry of the id', async () => {
        const author = await createTeacher();
        const student = await createStudent();
        const first = await service.create(
          await dtoOf(student.email, { subject: 'Física' }),
          author.id,
        );
        await service.create(
          await dtoOf(student.email, { subject: 'Matemática' }),
          author.id,
        );

        await service.remove(first.id, author.id);

        await expect(
          prisma.peiEntry.count({
            where: { id_student: student.id, deleted_at: null },
          }),
        ).resolves.toBe(1);
      });

      it('should answer 404 when deleting an entry that does not exist', async () => {
        const author = await createTeacher();

        await expect(service.remove(2147483647, author.id)).rejects.toThrow(
          'Registro do PEI não encontrado',
        );
      });

      // O PostgreSQL recusa 2147483648 com o P2020 (valor fora do INTEGER). A
      // rota nem chega aqui (o ParsePositiveIdPipe responde 400), e sem a
      // conversão o service lançaria o erro do Prisma a quem o chamasse direto.
      it('should answer 404, and not 500, for an id above the INTEGER range', async () => {
        const author = await createTeacher();

        await expect(
          service.update(
            2147483648,
            await updateDtoOf({ general_notes: 'x' }),
            author.id,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          service.remove(2147483648, author.id),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    // A tabela antiga é renomeada, e não removida, para que o PEI antigo siga no
    // banco, fora da API. O RENAME TO não renomeia a chave primária, o índice
    // único nem a sequence, e a migration os renomeia para os nomes que o Prisma
    // espera do model PlansEducationLegacy.
    describe('tabela antiga PlansEducation_legacy', () => {
      const relations = async (...names: string[]) =>
        prisma.$queryRaw<{ relname: string; relkind: string }[]>`
          SELECT c.relname, c.relkind::text AS relkind
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema()
            AND c.relname = ANY(${names})
          ORDER BY c.relname`;

      it('should keep the old PEI in PlansEducation_legacy and have no PlansEducation table', async () => {
        const found = await relations(
          'PlansEducation',
          'PlansEducation_legacy',
        );

        expect(found).toEqual([
          { relname: 'PlansEducation_legacy', relkind: 'r' },
        ]);
      });

      it('should rename the primary key, the unique index and the sequence together with the table', async () => {
        const found = await relations(
          'PlansEducation_pkey',
          'PlansEducation_student_email_key',
          'PlansEducation_id_seq',
          'PlansEducation_legacy_pkey',
          'PlansEducation_legacy_student_email_key',
          'PlansEducation_legacy_id_seq',
        );

        expect(found).toEqual([
          { relname: 'PlansEducation_legacy_id_seq', relkind: 'S' },
          { relname: 'PlansEducation_legacy_pkey', relkind: 'i' },
          { relname: 'PlansEducation_legacy_student_email_key', relkind: 'i' },
        ]);
      });

      it('should keep the sequence of the id attached to the renamed table', async () => {
        const rows = await prisma.$queryRaw<{ column_default: string }[]>`
          SELECT column_default FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'PlansEducation_legacy'
            AND column_name = 'id'`;

        expect(rows).toHaveLength(1);
        expect(rows[0].column_default).toContain(
          'PlansEducation_legacy_id_seq',
        );
      });

      it('should still store and read a row of the old PEI through the legacy model, one per student e-mail', async () => {
        const row = {
          professor_email: `prof${EMAIL_DOMAIN}`,
          professor_name: 'Professor',
          student_email: `legado${EMAIL_DOMAIN}`,
          student_name: 'Estudante',
          academic_semester: {},
          service_modality: {},
          support_service: {},
          skills: {},
          resource_equipment_used: {},
          resource_equipment_needs: {},
          curriculum_accessibility: {},
          school_content: '',
          activities_to_be_developed: {},
          objectives: '',
          work_methodology: {},
          materials_used: {},
          evaluation_criteria: {},
        };

        await prisma.plansEducationLegacy.create({ data: row });

        await expect(
          prisma.plansEducationLegacy.count({
            where: { student_email: row.student_email },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.plansEducationLegacy.create({ data: row }),
        ).rejects.toMatchObject({ code: 'P2002' });
      });
    });
  },
);
