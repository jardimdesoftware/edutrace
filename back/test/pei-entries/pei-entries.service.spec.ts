import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { LEVELS, PEI_ENTRY_READERS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import {
  PEI_ENTRY_CONTENT_SELECT,
  PEI_ENTRY_OPINION_SELECT,
  PEI_ENTRY_ORDER_BY,
  PEI_ENTRY_SELECT,
} from 'src/pei-entries/pei-entry-select';
import { PeiEntriesService } from 'src/pei-entries/pei-entries.service';
import { CreatePeiEntryDto } from 'src/pei-entries/dto/create-pei-entry.dto';
import { UpdatePeiEntryDto } from 'src/pei-entries/dto/update-pei-entry.dto';
import { StudentsService } from 'src/students/students.service';
import {
  OPINION_KEYS,
  SEMESTER,
  STUDENT_EMAIL,
  SUBJECT,
  blankOpinion,
  validBody,
  validContent,
  validOpinion,
} from './pei-entry.fixtures';

const STUDENT_ID = 2;
const AUTHOR_ID = 7;
const ENTRY_ID = 31;

const entry = {
  id: ENTRY_ID,
  semester: SEMESTER,
  subject: SUBJECT,
  ...validContent(),
  ...blankOpinion(),
  created_at: new Date('2026-10-17T10:00:00Z'),
  updated_at: new Date('2026-10-17T10:00:00Z'),
  id_author: AUTHOR_ID,
  author: { full_name: 'Professora Ana' },
};

function requestOf(
  roles: number | number[],
  email = 'quem.pede@example.com',
  sub = 99,
) {
  return {
    user: { sub, roles: [roles].flat(), email, name: 'Quem pede' },
  } as AuthenticatedRequest;
}

// Formato do P2002 com o @prisma/adapter-pg (Prisma 7): sem meta.target, a
// constraint vem pelo nome do índice em meta.driverAdapterError.cause.
function uniqueViolation(withTarget = false) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: withTarget
      ? {
          modelName: 'PeiEntry',
          target: ['id_student', 'semester', 'subject'],
        }
      : {
          modelName: 'PeiEntry',
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: {
              originalCode: '23505',
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'PeiEntry_id_student_semester_subject_key' },
              table: 'PeiEntry',
            },
          },
        },
  });
}

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('erro do Prisma', {
    code,
    clientVersion: '7.10.0',
  });
}

describe('PeiEntriesService, select da resposta', () => {
  it('should select the author by name only and no data of the student, never the whole User', () => {
    expect(PEI_ENTRY_SELECT.author).toEqual({
      select: { full_name: true },
    });
    expect(PEI_ENTRY_SELECT).not.toHaveProperty('student');
    expect(PEI_ENTRY_SELECT).not.toHaveProperty('id_student');
    expect(PEI_ENTRY_SELECT).not.toHaveProperty('deleted_at');
    expect(Object.keys(PEI_ENTRY_SELECT).sort()).toEqual(
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
  });

  it('should list the seven content fields, without the identification, the author nor the dates', () => {
    expect(Object.keys(PEI_ENTRY_CONTENT_SELECT).sort()).toEqual(
      [
        'adapted_assessments',
        'adapted_methodologies',
        'adapted_objectives',
        'adapted_resources',
        'general_notes',
        'prioritized_contents',
        'syllabus_adaptations',
      ].sort(),
    );
  });

  it('should list the four opinion fields, apart from the seven content fields', () => {
    expect(Object.keys(PEI_ENTRY_OPINION_SELECT).sort()).toEqual(
      [...OPINION_KEYS].sort(),
    );
    for (const key of OPINION_KEYS) {
      expect(PEI_ENTRY_CONTENT_SELECT).not.toHaveProperty(key);
    }
  });

  it('should order by semester from the newest and then by subject', () => {
    expect(PEI_ENTRY_ORDER_BY).toEqual([
      { semester: 'desc' },
      { subject: 'asc' },
    ]);
  });
});

describe('PeiEntriesService', () => {
  let service: PeiEntriesService;
  let prisma: {
    peiEntry: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    $queryRaw: jest.Mock;
    peiEntry: { count: jest.Mock; create: jest.Mock };
  };
  let studentsService: { findOneOrFail: jest.Mock; lockStudent: jest.Mock };
  let events: string[];

  beforeEach(async () => {
    events = [];
    tx = {
      // Trava a linha do autor (FOR KEY SHARE) antes da do estudante.
      $queryRaw: jest.fn().mockImplementation(() => {
        events.push('lock-author');
        return Promise.resolve([{ id: AUTHOR_ID }]);
      }),
      peiEntry: {
        count: jest.fn().mockImplementation(() => {
          events.push('count');
          return Promise.resolve(0);
        }),
        create: jest.fn().mockImplementation(() => {
          events.push('create');
          return Promise.resolve(entry);
        }),
      },
    };
    prisma = {
      // O create do client fora da transação nunca pode ser usado: a gravação
      // fora da transação escaparia da trava do estudante.
      peiEntry: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([entry]),
        findFirst: jest.fn().mockResolvedValue({ id_author: AUTHOR_ID }),
        update: jest.fn().mockResolvedValue(entry),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => {
        events.push('begin');
        const result = await callback(tx);
        events.push('commit');
        return result;
      }),
    };
    studentsService = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: STUDENT_ID, email: STUDENT_EMAIL }),
      // Trava a linha do estudante dentro da transação e confere o nível sob
      // a trava; o 404 sai daqui.
      lockStudent: jest.fn().mockImplementation(() => {
        events.push('lock-student');
        return Promise.resolve({ id: STUDENT_ID });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeiEntriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StudentsService, useValue: studentsService },
      ],
    }).compile();

    service = module.get(PeiEntriesService);
  });

  describe('create', () => {
    const dto = validBody() as unknown as CreatePeiEntryDto;

    it('should create the entry of the student, the semester and the subject with the author of the session', async () => {
      const result = await service.create(dto, AUTHOR_ID);

      expect(studentsService.lockStudent).toHaveBeenCalledWith(
        tx,
        STUDENT_EMAIL,
      );
      expect(tx.peiEntry.create).toHaveBeenCalledWith({
        data: {
          ...validContent(),
          semester: SEMESTER,
          subject: SUBJECT,
          id_student: STUDENT_ID,
          id_author: AUTHOR_ID,
        },
        select: PEI_ENTRY_SELECT,
      });
      expect(result).toBe(entry);
    });

    it('should not store the e-mail of the student in the record', async () => {
      await service.create(dto, AUTHOR_ID);

      const { data } = tx.peiEntry.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('student_email');
    });

    it('should take the author from the argument and the student from the lookup, never from the body', async () => {
      const forged = {
        ...dto,
        id_author: 1234,
        id_student: 55,
        deleted_at: new Date(),
        id: 9,
      } as unknown as CreatePeiEntryDto;

      await service.create(forged, AUTHOR_ID);

      const { data } = tx.peiEntry.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data.id_author).toBe(AUTHOR_ID);
      expect(data.id_student).toBe(STUDENT_ID);
      expect(data).not.toHaveProperty('deleted_at');
      expect(data).not.toHaveProperty('id');
    });

    it('should store the pairs as plain objects with only the two known keys', async () => {
      const body = {
        ...dto,
        syllabus_adaptations: [
          { syllabus_content: 'A', adaptation: 'B', id_author: 1 },
        ],
      } as unknown as CreatePeiEntryDto;

      await service.create(body, AUTHOR_ID);

      const { data } = tx.peiEntry.create.mock.calls[0][0] as {
        data: { syllabus_adaptations: unknown[] };
      };
      expect(data.syllabus_adaptations).toEqual([
        { syllabus_content: 'A', adaptation: 'B' },
      ]);
    });

    // O registro nasce com o parecer em branco (o default do banco): o POST
    // não grava nenhum dos quatro campos, mesmo que o objeto os carregue.
    it('should not write the opinion fields on creation, even when the object carries them', async () => {
      const forged = {
        ...dto,
        ...validOpinion(),
      } as unknown as CreatePeiEntryDto;

      await service.create(forged, AUTHOR_ID);

      const { data } = tx.peiEntry.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      for (const key of OPINION_KEYS) {
        expect(data).not.toHaveProperty(key);
      }
    });

    it('should store an empty list of pairs', async () => {
      const body = {
        ...dto,
        syllabus_adaptations: [],
      } as unknown as CreatePeiEntryDto;

      await service.create(body, AUTHOR_ID);

      const { data } = tx.peiEntry.create.mock.calls[0][0] as {
        data: { syllabus_adaptations: unknown[] };
      };
      expect(data.syllabus_adaptations).toEqual([]);
    });

    it('should answer 404 and write nothing when the account is not a student', async () => {
      studentsService.lockStudent.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(service.create(dto, AUTHOR_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.peiEntry.count).not.toHaveBeenCalled();
      expect(tx.peiEntry.create).not.toHaveBeenCalled();
    });

    // O teto de registros ativos por estudante. A contagem e a gravação rodam
    // dentro da transação que travou a linha do estudante, então dois POST
    // simultâneos se enfileiram nela (o teste de integração prova a corrida).
    describe('limit of active entries per student', () => {
      const MAX_MESSAGE =
        'Este estudante já tem o máximo de 300 registros do PEI ativos.';

      it('should lock the author, then the student, then count, then create, in this order and inside one transaction', async () => {
        await service.create(dto, AUTHOR_ID);

        expect(events).toEqual([
          'begin',
          'lock-author',
          'lock-student',
          'count',
          'create',
          'commit',
        ]);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      });

      // A troca de nível do professor trava a linha dele antes das dos
      // estudantes; o create segue a mesma ordem, e o FOR KEY SHARE é a trava
      // que a chave estrangeira id_author pediria no INSERT.
      it('should lock the row of the author of the session with FOR KEY SHARE', async () => {
        await service.create(dto, AUTHOR_ID);

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
          TemplateStringsArray,
          ...unknown[],
        ];
        expect(strings.join('?')).toMatch(
          /FROM "User" WHERE "id" = \? FOR KEY SHARE/,
        );
        expect(values).toEqual([AUTHOR_ID]);
      });

      it('should write through the transaction client, and never through the client outside of it', async () => {
        await service.create(dto, AUTHOR_ID);

        expect(tx.peiEntry.create).toHaveBeenCalledTimes(1);
        expect(prisma.peiEntry.create).not.toHaveBeenCalled();
      });

      it('should count only the active entries of the student that is locked', async () => {
        await service.create(dto, AUTHOR_ID);

        expect(tx.peiEntry.count).toHaveBeenCalledWith({
          where: { id_student: STUDENT_ID, deleted_at: null },
        });
      });

      it.each([0, 1, 150, 299])(
        'should create the entry when the student has %i active entries',
        async (active) => {
          tx.peiEntry.count.mockResolvedValue(active);

          await expect(service.create(dto, AUTHOR_ID)).resolves.toBe(entry);
          expect(tx.peiEntry.create).toHaveBeenCalledTimes(1);
        },
      );

      it.each([300, 301, 5000])(
        'should answer 409 and write nothing when the student already has %i active entries',
        async (active) => {
          tx.peiEntry.count.mockResolvedValue(active);

          const result = service.create(dto, AUTHOR_ID);

          await expect(result).rejects.toThrow(ConflictException);
          await expect(result).rejects.toThrow(MAX_MESSAGE);
          expect(tx.peiEntry.create).not.toHaveBeenCalled();
        },
      );

      it('should keep answering the duplicate message, and not the limit one, for the repeated trio under the limit', async () => {
        tx.peiEntry.count.mockResolvedValue(10);
        tx.peiEntry.create.mockRejectedValue(uniqueViolation());

        await expect(service.create(dto, AUTHOR_ID)).rejects.toThrow(
          'Este estudante já tem um registro do PEI desta disciplina neste semestre.',
        );
      });
    });

    it.each([
      ['sem meta.target, formato do adapter pg', false],
      ['com meta.target, formato do Prisma sem adapter', true],
    ])(
      'should answer 409 for the second active entry of the trio (%s)',
      async (_, withTarget) => {
        tx.peiEntry.create.mockRejectedValue(uniqueViolation(withTarget));

        const result = service.create(dto, AUTHOR_ID);

        await expect(result).rejects.toThrow(ConflictException);
        await expect(result).rejects.toThrow(
          'Este estudante já tem um registro do PEI desta disciplina neste semestre.',
        );
      },
    );

    it.each(['P2003', 'P2025', 'P1001'])(
      'should not turn the Prisma error %s into 409',
      async (code) => {
        const error = knownError(code);
        tx.peiEntry.create.mockRejectedValue(error);

        await expect(service.create(dto, AUTHOR_ID)).rejects.toBe(error);
      },
    );

    it('should propagate an error that is not from Prisma', async () => {
      const error = new Error('conexão perdida');
      tx.peiEntry.create.mockRejectedValue(error);

      await expect(service.create(dto, AUTHOR_ID)).rejects.toBe(error);
    });
  });

  describe('findByStudent', () => {
    it.each(PEI_ENTRY_READERS.map((level) => [level]))(
      'should let the level %i read the entries of any student',
      async (level) => {
        const result = await service.findByStudent(
          STUDENT_EMAIL,
          requestOf(level, 'outra.pessoa@example.com'),
        );

        expect(result).toEqual([entry]);
        expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
          email: STUDENT_EMAIL,
        });
      },
    );

    it('should let an account with the Education and the Professor do AEE roles read the records of any student', async () => {
      const result = await service.findByStudent(
        STUDENT_EMAIL,
        requestOf([3, 6], 'outra.pessoa@example.com'),
      );

      expect(result).toEqual([entry]);
    });

    it('should not let a student read the records of another one, even with the same e-mail case', async () => {
      await expect(
        service.findByStudent(
          STUDENT_EMAIL,
          requestOf([2], 'outra.pessoa@example.com'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should list only the active entries of the student, newest semester first and then by subject', async () => {
      await service.findByStudent(
        STUDENT_EMAIL,
        requestOf(LEVELS.PROFISSIONAL_EDUCACAO),
      );

      expect(prisma.peiEntry.findMany).toHaveBeenCalledWith({
        where: { id_student: STUDENT_ID, deleted_at: null },
        orderBy: [{ semester: 'desc' }, { subject: 'asc' }],
        select: PEI_ENTRY_SELECT,
      });
    });

    it('should answer an empty list, and not 404, when the student has no entry', async () => {
      prisma.peiEntry.findMany.mockResolvedValue([]);

      await expect(
        service.findByStudent(STUDENT_EMAIL, requestOf(LEVELS.PROFISSIONAL_NAPNE)),
      ).resolves.toEqual([]);
    });

    it('should let the student read his own entries', async () => {
      const result = await service.findByStudent(
        STUDENT_EMAIL,
        requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
      );

      expect(result).toEqual([entry]);
    });

    it('should answer 403 to a student that reads the entries of another student, without querying', async () => {
      const result = service.findByStudent(
        'outro.estudante@example.com',
        requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
      );

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        'Você não tem permissão para visualizar o PEI deste estudante',
      );
      expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
      expect(prisma.peiEntry.findMany).not.toHaveBeenCalled();
    });

    it('should answer 403 to the student whether or not the other student has entries', async () => {
      prisma.peiEntry.findMany.mockResolvedValue([]);

      await expect(
        service.findByStudent(
          'outro.estudante@example.com',
          requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not compare the e-mails by prefix or by case', async () => {
      await expect(
        service.findByStudent(
          STUDENT_EMAIL,
          requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL.toUpperCase()),
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findByStudent(
          `${STUDENT_EMAIL}.br`,
          requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findByStudent(
          STUDENT_EMAIL,
          requestOf(LEVELS.ALUNO_ESTUDANTE, `${STUDENT_EMAIL}.br`),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should answer 404 when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(
        service.findByStudent(
          'prof@example.com',
          requestOf(LEVELS.PROFISSIONAL_EDUCACAO),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.peiEntry.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const dto = {
      general_notes: 'Novas observações',
      syllabus_adaptations: [{ syllabus_content: 'A', adaptation: 'B' }],
    } as unknown as UpdatePeiEntryDto;

    it('should replace only the fields that were sent, of the active entry', async () => {
      const result = await service.update(ENTRY_ID, dto, AUTHOR_ID);

      expect(prisma.peiEntry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        data: {
          general_notes: 'Novas observações',
          syllabus_adaptations: [{ syllabus_content: 'A', adaptation: 'B' }],
        },
        select: PEI_ENTRY_SELECT,
      });
      expect(result).toBe(entry);
    });

    it('should write the four opinion fields of the entry, and only them, when the author sends them', async () => {
      const result = await service.update(
        ENTRY_ID,
        validOpinion() as unknown as UpdatePeiEntryDto,
        AUTHOR_ID,
      );

      expect(prisma.peiEntry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        data: validOpinion(),
        select: PEI_ENTRY_SELECT,
      });
      expect(result).toBe(entry);
    });

    it('should write only the opinion fields that were sent, and the empty one too', async () => {
      await service.update(
        ENTRY_ID,
        {
          semester_progress: 'Avançou em frações',
          individual_sessions: '',
        } as UpdatePeiEntryDto,
        AUTHOR_ID,
      );

      const { data } = prisma.peiEntry.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        semester_progress: 'Avançou em frações',
        individual_sessions: '',
      });
    });

    it('should write the content and the opinion together when both come in the same call', async () => {
      await service.update(
        ENTRY_ID,
        { ...dto, ...validOpinion() } as unknown as UpdatePeiEntryDto,
        AUTHOR_ID,
      );

      const { data } = prisma.peiEntry.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(Object.keys(data).sort()).toEqual(
        ['general_notes', 'syllabus_adaptations', ...OPINION_KEYS].sort(),
      );
    });

    it('should look for the entry by id among the active ones before writing', async () => {
      await service.update(ENTRY_ID, dto, AUTHOR_ID);

      expect(prisma.peiEntry.findFirst).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        select: { id_author: true },
      });
    });

    it('should write the empty list and the empty text, which are not the same as missing', async () => {
      await service.update(
        ENTRY_ID,
        { syllabus_adaptations: [], general_notes: '' } as UpdatePeiEntryDto,
        AUTHOR_ID,
      );

      const { data } = prisma.peiEntry.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({ syllabus_adaptations: [], general_notes: '' });
    });

    it('should never change the student, the author, the semester, the subject nor deleted_at', async () => {
      const forged = {
        ...dto,
        id_author: 1234,
        id_student: 55,
        semester: '2030.1',
        subject: 'Outra',
        deleted_at: null,
        student_email: 'outro@example.com',
      } as unknown as UpdatePeiEntryDto;

      await service.update(ENTRY_ID, forged, AUTHOR_ID);

      const { data } = prisma.peiEntry.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(Object.keys(data).sort()).toEqual(
        ['general_notes', 'syllabus_adaptations'].sort(),
      );
    });

    it('should store the pairs as plain objects with only the two known keys', async () => {
      await service.update(
        ENTRY_ID,
        {
          syllabus_adaptations: [
            { syllabus_content: 'A', adaptation: 'B', id_author: 1 },
          ],
        } as unknown as UpdatePeiEntryDto,
        AUTHOR_ID,
      );

      const { data } = prisma.peiEntry.update.mock.calls[0][0] as {
        data: { syllabus_adaptations: unknown[] };
      };
      expect(data.syllabus_adaptations).toEqual([
        { syllabus_content: 'A', adaptation: 'B' },
      ]);
    });

    it('should answer 404 when the entry does not exist or is deleted, before checking the author', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue(null);

      const result = service.update(ENTRY_ID, dto, AUTHOR_ID);

      await expect(result).rejects.toThrow(NotFoundException);
      await expect(result).rejects.toThrow('Registro do PEI não encontrado');
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 403 to another professor, without writing', async () => {
      const result = service.update(ENTRY_ID, dto, AUTHOR_ID + 1);

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        'Você só pode alterar os registros do PEI que você mesmo criou',
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    // Só o autor escreve o parecer: a regra da edição vale para os quatro campos.
    it('should answer 403 to another professor who sends the opinion, without writing', async () => {
      const result = service.update(
        ENTRY_ID,
        validOpinion() as unknown as UpdatePeiEntryDto,
        AUTHOR_ID + 1,
      );

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        'Você só pode alterar os registros do PEI que você mesmo criou',
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 403 to everyone who sends the opinion when the author account was deleted, without writing', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue({ id_author: null });

      await expect(
        service.update(
          ENTRY_ID,
          validOpinion() as unknown as UpdatePeiEntryDto,
          AUTHOR_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 404 to the opinion of an entry that does not exist or is deleted, before checking the author', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue(null);

      const result = service.update(
        ENTRY_ID,
        validOpinion() as unknown as UpdatePeiEntryDto,
        AUTHOR_ID + 1,
      );

      await expect(result).rejects.toThrow(NotFoundException);
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 404 when the entry is deleted between the lookup and the write of the opinion', async () => {
      prisma.peiEntry.update.mockRejectedValue(knownError('P2025'));

      await expect(
        service.update(
          ENTRY_ID,
          validOpinion() as unknown as UpdatePeiEntryDto,
          AUTHOR_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should answer 403 to everyone when the author account was deleted', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue({ id_author: null });

      await expect(service.update(ENTRY_ID, dto, AUTHOR_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    // O registro pode ser excluído entre a leitura e a gravação: o where com
    // deleted_at null faz o update falhar com P2025, e a resposta é 404.
    // P2020: o id passa do maior INTEGER do PostgreSQL, que a rota barra no
    // ParsePositiveIdPipe e o service recebe se for chamado sem ele.
    it.each(['P2025', 'P2020'])(
      'should answer 404 when the entry disappears before the write (%s)',
      async (code) => {
        prisma.peiEntry.update.mockRejectedValue(knownError(code));

        const result = service.update(ENTRY_ID, dto, AUTHOR_ID);

        await expect(result).rejects.toThrow(NotFoundException);
        await expect(result).rejects.toThrow('Registro do PEI não encontrado');
      },
    );

    it('should answer 404 when the lookup itself fails with P2020', async () => {
      prisma.peiEntry.findFirst.mockRejectedValue(knownError('P2020'));

      await expect(service.update(2147483648, dto, AUTHOR_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate the other errors', async () => {
      const error = knownError('P2003');
      prisma.peiEntry.update.mockRejectedValue(error);

      await expect(service.update(ENTRY_ID, dto, AUTHOR_ID)).rejects.toBe(
        error,
      );
    });
  });

  describe('remove', () => {
    it('should mark the active entry as deleted with the current date, and never delete the row', async () => {
      const before = Date.now();

      const result = await service.remove(ENTRY_ID, AUTHOR_ID);

      expect(result).toEqual({
        message: `Registro do PEI com id ${ENTRY_ID} foi removido com sucesso`,
      });
      expect(prisma.peiEntry.update).toHaveBeenCalledTimes(1);
      const call = prisma.peiEntry.update.mock.calls[0][0] as {
        where: unknown;
        data: { deleted_at: Date };
        select: unknown;
      };
      expect(call.where).toEqual({ id: ENTRY_ID, deleted_at: null });
      expect(call.select).toEqual({ id: true });
      expect(Object.keys(call.data)).toEqual(['deleted_at']);
      expect(call.data.deleted_at).toBeInstanceOf(Date);
      expect(call.data.deleted_at.getTime()).toBeGreaterThanOrEqual(before);
      expect(prisma.peiEntry.delete).not.toHaveBeenCalled();
      expect(prisma.peiEntry.deleteMany).not.toHaveBeenCalled();
    });

    it('should look for the entry among the active ones before writing', async () => {
      await service.remove(ENTRY_ID, AUTHOR_ID);

      expect(prisma.peiEntry.findFirst).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        select: { id_author: true },
      });
    });

    it('should answer 404 when the entry does not exist or is already deleted, before checking the author', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue(null);

      const result = service.remove(ENTRY_ID, AUTHOR_ID);

      await expect(result).rejects.toThrow(NotFoundException);
      await expect(result).rejects.toThrow('Registro do PEI não encontrado');
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 403 to another professor, without writing', async () => {
      const result = service.remove(ENTRY_ID, AUTHOR_ID + 1);

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        'Você só pode alterar os registros do PEI que você mesmo criou',
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    // O registro sem autor (a conta do autor foi excluída) não é de ninguém, e
    // qualquer Profissional da Educação o exclui para poder criar o seu. Só a
    // exclusão: a edição do registro sem autor segue recusada (teste do update).
    it('should let any professor delete the entry whose author account was deleted', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue({ id_author: null });

      const result = await service.remove(ENTRY_ID, AUTHOR_ID);

      expect(result).toEqual({
        message: `Registro do PEI com id ${ENTRY_ID} foi removido com sucesso`,
      });
      expect(prisma.peiEntry.update).toHaveBeenCalledWith({
        where: { id: ENTRY_ID, deleted_at: null },
        data: { deleted_at: expect.any(Date) },
        select: { id: true },
      });
    });

    it('should still answer 403 to another professor when the entry has a living author', async () => {
      prisma.peiEntry.findFirst.mockResolvedValue({ id_author: AUTHOR_ID + 1 });

      await expect(service.remove(ENTRY_ID, AUTHOR_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.peiEntry.update).not.toHaveBeenCalled();
    });

    it('should answer 404, and not 200, to the second delete of the entry without author', async () => {
      prisma.peiEntry.findFirst
        .mockResolvedValueOnce({ id_author: null })
        .mockResolvedValueOnce(null);

      await service.remove(ENTRY_ID, AUTHOR_ID);

      await expect(service.remove(ENTRY_ID, AUTHOR_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each(['P2025', 'P2020'])(
      'should answer 404 when the entry was deleted between the lookup and the write (%s)',
      async (code) => {
        prisma.peiEntry.update.mockRejectedValue(knownError(code));

        const result = service.remove(ENTRY_ID, AUTHOR_ID);

        await expect(result).rejects.toThrow(NotFoundException);
        await expect(result).rejects.toThrow('Registro do PEI não encontrado');
      },
    );

    it('should propagate the other errors', async () => {
      const error = knownError('P2003');
      prisma.peiEntry.update.mockRejectedValue(error);

      await expect(service.remove(ENTRY_ID, AUTHOR_ID)).rejects.toBe(error);
    });
  });
});
