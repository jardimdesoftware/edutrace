import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AeePlansService } from 'src/aee-plans/aee-plans.service';
import {
  AEE_PLAN_SECTIONS_SELECT,
  AEE_PLAN_SELECT,
} from 'src/aee-plans/aee-plan-select';
import { CreateAeePlanDto } from 'src/aee-plans/dto/create-aee-plan.dto';
import { UpdateAeePlanDto } from 'src/aee-plans/dto/update-aee-plan.dto';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { AEE_PLAN_READERS, LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { FormRevisionsService } from 'src/form-revisions/form-revisions.service';
import {
  SEMESTER,
  STUDENT_EMAIL,
  validBody,
  validSections,
} from './aee-plan.fixtures';

const STUDENT_ID = 2;
const AUTHOR = { id: 7, name: 'Autor' };
const AUTHOR_ID = 7;
const PLAN_ID = 31;

const plan = {
  id: PLAN_ID,
  semester: SEMESTER,
  ...validSections(),
  author: { id: AUTHOR_ID, full_name: 'Profissional NAPNE' },
  student: { full_name: 'Estudante', course: 'Informática' },
  created_at: new Date('2026-10-17T10:00:00Z'),
  updated_at: new Date('2026-10-17T10:00:00Z'),
};

function requestOf(roles: number | number[], email = 'quem.pede@example.com') {
  return {
    user: { sub: 99, roles: [roles].flat(), email, name: 'Quem pede' },
  } as AuthenticatedRequest;
}

// Formato do P2002 com o @prisma/adapter-pg (Prisma 7): sem meta.target, a
// constraint vem pelo nome do índice em meta.driverAdapterError.cause.
function uniqueViolation(withTarget = false) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: withTarget
      ? { modelName: 'AeePlan', target: ['id_student', 'semester'] }
      : {
          modelName: 'AeePlan',
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: {
              originalCode: '23505',
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'AeePlan_id_student_semester_key' },
              table: 'AeePlan',
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

describe('AeePlansService, select da resposta', () => {
  it('should select the author by id and name and the student by name and course, never the whole User', () => {
    expect(AEE_PLAN_SELECT.author).toEqual({
      select: { id: true, full_name: true },
    });
    expect(AEE_PLAN_SELECT.student).toEqual({
      select: { full_name: true, course: true },
    });
    expect(Object.keys(AEE_PLAN_SELECT).sort()).toEqual(
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
  });

  it('should list the seven sections, without the semester, the id, the author nor the dates', () => {
    expect(Object.keys(AEE_PLAN_SECTIONS_SELECT).sort()).toEqual(
      [
        'basis',
        'evaluation_procedures',
        'has_diagnosis',
        'identification',
        'objectives',
        'purpose',
        'supports',
      ].sort(),
    );
  });
});

describe('AeePlansService', () => {
  let service: AeePlansService;
  let prisma: {
    aeePlan: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let formRevisions: {
    recordCreation: jest.Mock;
    recordEdit: jest.Mock;
    removeAll: jest.Mock;
  };
  let studentsService: { findOneOrFail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      aeePlan: {
        create: jest.fn().mockResolvedValue(plan),
        findMany: jest.fn().mockResolvedValue([plan]),
        update: jest.fn().mockResolvedValue(plan),
        delete: jest
          .fn()
          .mockResolvedValue({ id_student: STUDENT_ID, semester: '2026.1' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...plan, id_student: STUDENT_ID }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    formRevisions = {
      recordCreation: jest.fn(),
      recordEdit: jest.fn(),
      removeAll: jest.fn(),
    };
    studentsService = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: STUDENT_ID, email: STUDENT_EMAIL }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AeePlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: StudentsService, useValue: studentsService },
        { provide: FormRevisionsService, useValue: formRevisions },
      ],
    }).compile();

    service = module.get(AeePlansService);
  });

  describe('create', () => {
    const { student_email: _email, ...fields } = validBody();
    const dto = validBody() as unknown as CreateAeePlanDto;

    it('should create the plan of the student and the semester with the author of the session', async () => {
      const result = await service.create(dto, AUTHOR);

      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
        email: STUDENT_EMAIL,
      });
      expect(prisma.aeePlan.create).toHaveBeenCalledWith({
        data: { ...fields, id_student: STUDENT_ID, id_author: AUTHOR_ID },
        select: AEE_PLAN_SELECT,
      });
      expect(result).toBe(plan);
    });

    it('should not store the e-mail of the student in the record', async () => {
      await service.create(dto, AUTHOR);

      const { data } = prisma.aeePlan.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('student_email');
    });

    it('should take the author from the argument, and never from the body', async () => {
      const forged = {
        ...dto,
        id_author: 1234,
        id_student: 55,
      } as unknown as CreateAeePlanDto;

      await service.create(forged, AUTHOR);

      const { data } = prisma.aeePlan.create.mock.calls[0][0] as {
        data: { id_author: number; id_student: number };
      };
      expect(data.id_author).toBe(AUTHOR_ID);
      expect(data.id_student).toBe(STUDENT_ID);
    });

    it('should answer 404 and write nothing when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(service.create(dto, AUTHOR)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.aeePlan.create).not.toHaveBeenCalled();
    });

    it.each([
      ['sem meta.target, formato do adapter pg', false],
      ['com meta.target, formato do Prisma sem adapter', true],
    ])(
      'should answer 409 for the second plan of the student in the semester (%s)',
      async (_, withTarget) => {
        prisma.aeePlan.create.mockRejectedValue(uniqueViolation(withTarget));

        const result = service.create(dto, AUTHOR);

        await expect(result).rejects.toThrow(ConflictException);
        await expect(result).rejects.toThrow(
          'Este estudante já tem um PAEE neste período letivo.',
        );
      },
    );

    it.each(['P2003', 'P2025', 'P1001'])(
      'should not turn the Prisma error %s into 409',
      async (code) => {
        const error = knownError(code);
        prisma.aeePlan.create.mockRejectedValue(error);

        await expect(service.create(dto, AUTHOR)).rejects.toBe(error);
      },
    );

    it('should propagate an error that is not from Prisma', async () => {
      const error = new Error('conexão perdida');
      prisma.aeePlan.create.mockRejectedValue(error);

      await expect(service.create(dto, AUTHOR)).rejects.toBe(error);
    });
  });

  describe('findByStudent', () => {
    it.each(AEE_PLAN_READERS.map((level) => [level]))(
      'should let the level %i read the plans of any student',
      async (level) => {
        const result = await service.findByStudent(
          STUDENT_EMAIL,
          requestOf(level, 'outra.pessoa@example.com'),
        );

        expect(result).toEqual([plan]);
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

      expect(result).toEqual([plan]);
    });

    it('should not let a student read the records of another one, even with the same e-mail case', async () => {
      await expect(
        service.findByStudent(
          STUDENT_EMAIL,
          requestOf([2], 'outra.pessoa@example.com'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should list the plans of the student from the newest semester to the oldest', async () => {
      await service.findByStudent(
        STUDENT_EMAIL,
        requestOf(LEVELS.PROFISSIONAL_NAPNE),
      );

      expect(prisma.aeePlan.findMany).toHaveBeenCalledWith({
        where: { id_student: STUDENT_ID },
        orderBy: { semester: 'desc' },
        select: AEE_PLAN_SELECT,
      });
    });

    it('should answer an empty list, and not 404, when the student has no plan', async () => {
      prisma.aeePlan.findMany.mockResolvedValue([]);

      await expect(
        service.findByStudent(
          STUDENT_EMAIL,
          requestOf(LEVELS.PROFISSIONAL_NAPNE),
        ),
      ).resolves.toEqual([]);
    });

    it('should let the student read his own plans', async () => {
      const result = await service.findByStudent(
        STUDENT_EMAIL,
        requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
      );

      expect(result).toEqual([plan]);
    });

    it('should answer 403 to a student that reads the plans of another student, without querying', async () => {
      const result = service.findByStudent(
        'outro.estudante@example.com',
        requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
      );

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        'Você não tem permissão para visualizar os PAEE deste estudante',
      );
      expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
      expect(prisma.aeePlan.findMany).not.toHaveBeenCalled();
    });

    it('should answer 403 to the student whether or not the other student has plans', async () => {
      prisma.aeePlan.findMany.mockResolvedValue([]);

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
    });

    it('should answer 404 when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(
        service.findByStudent(
          'prof@example.com',
          requestOf(LEVELS.PROFISSIONAL_NAPNE),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.aeePlan.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const dto = {
      basis: 'Novo embasamento',
      objectives: { general: 'Novo geral', specific: 'Novo específico' },
    } as unknown as UpdateAeePlanDto;

    it('should replace only the sections that were sent', async () => {
      const result = await service.update(PLAN_ID, dto, AUTHOR);

      expect(prisma.aeePlan.update).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        data: {
          basis: 'Novo embasamento',
          objectives: { general: 'Novo geral', specific: 'Novo específico' },
        },
        select: AEE_PLAN_SELECT,
      });
      expect(result).toBe(plan);
    });

    it('should write has_diagnosis when it is false, which is not the same as missing', async () => {
      await service.update(
        PLAN_ID,
        {
          has_diagnosis: false,
        } as UpdateAeePlanDto,
        AUTHOR,
      );

      const { data } = prisma.aeePlan.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({ has_diagnosis: false });
    });

    it('should write the whole section that was sent, without merging it with the stored one', async () => {
      await service.update(PLAN_ID, dto, AUTHOR);

      const { data } = prisma.aeePlan.update.mock.calls[0][0] as {
        data: { objectives: unknown };
      };
      expect(data.objectives).toBe(
        (dto as unknown as Record<string, unknown>).objectives,
      );
    });

    it('should never change the author, the student nor the semester', async () => {
      const forged = {
        ...dto,
        id_author: 1234,
        id_student: 55,
        semester: '2030.1',
      } as unknown as UpdateAeePlanDto;

      await service.update(PLAN_ID, forged, AUTHOR);

      const { data } = prisma.aeePlan.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('id_author');
      expect(data).not.toHaveProperty('id_student');
      expect(data).not.toHaveProperty('author');
      expect(data).not.toHaveProperty('semester');
    });

    // P2025: o PAEE não existe. P2020: o id passa do maior INTEGER do
    // PostgreSQL, que a rota barra no ParsePositiveIdPipe e o service recebe
    // se for chamado sem ele.
    it.each(['P2025', 'P2020'])(
      'should answer 404 when the plan does not exist (%s)',
      async (code) => {
        prisma.aeePlan.update.mockRejectedValue(knownError(code));

        const result = service.update(PLAN_ID, dto, AUTHOR);

        await expect(result).rejects.toThrow(NotFoundException);
        await expect(result).rejects.toThrow('PAEE não encontrado');
      },
    );

    it('should propagate the other errors', async () => {
      const error = knownError('P2003');
      prisma.aeePlan.update.mockRejectedValue(error);

      await expect(service.update(PLAN_ID, dto, AUTHOR)).rejects.toBe(error);
    });
  });

  describe('remove', () => {
    it('should delete the plan by id', async () => {
      const result = await service.remove(PLAN_ID);

      expect(prisma.aeePlan.delete).toHaveBeenCalledWith({
        where: { id: PLAN_ID },
        select: { id_student: true, semester: true },
      });
      expect(formRevisions.removeAll).toHaveBeenCalledWith(expect.anything(), {
        formType: 'AEE_PLAN',
        idStudent: STUDENT_ID,
        recordKey: '2026.1',
      });
      expect(result).toEqual({
        message: `PAEE com id ${PLAN_ID} foi removido com sucesso`,
      });
    });

    it.each(['P2025', 'P2020'])(
      'should answer 404 when there is no plan to delete (%s)',
      async (code) => {
        prisma.aeePlan.delete.mockRejectedValue(knownError(code));

        const result = service.remove(PLAN_ID);

        await expect(result).rejects.toThrow(NotFoundException);
        await expect(result).rejects.toThrow('PAEE não encontrado');
      },
    );

    it('should propagate the other errors', async () => {
      const error = knownError('P2003');
      prisma.aeePlan.delete.mockRejectedValue(error);

      await expect(service.remove(PLAN_ID)).rejects.toBe(error);
    });
  });

  describe('histórico de versões', () => {
    it('should record the version 1 keyed by the semester when the plan is created', async () => {
      const dto = validBody() as unknown as CreateAeePlanDto;

      await service.create(dto, AUTHOR);

      expect(formRevisions.recordCreation).toHaveBeenCalledWith(
        expect.anything(),
        {
          formType: 'AEE_PLAN',
          idStudent: STUDENT_ID,
          recordKey: dto.semester,
        },
        plan,
        AUTHOR,
      );
    });

    it('should record the edit with the previous content, keyed by the semester of the plan', async () => {
      const updated = { ...plan, basis: 'Novo embasamento' };
      prisma.aeePlan.update.mockResolvedValue(updated);

      await service.update(
        PLAN_ID,
        { basis: 'Novo embasamento' } as UpdateAeePlanDto,
        AUTHOR,
      );

      expect(formRevisions.recordEdit).toHaveBeenCalledWith(
        expect.anything(),
        {
          formType: 'AEE_PLAN',
          idStudent: STUDENT_ID,
          recordKey: plan.semester,
        },
        expect.objectContaining({ after: updated }),
        AUTHOR,
      );
    });

    it('should answer 404 and record nothing when the plan does not exist', async () => {
      prisma.aeePlan.findUnique.mockResolvedValue(null);

      await expect(
        service.update(PLAN_ID, {} as UpdateAeePlanDto, AUTHOR),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(formRevisions.recordEdit).not.toHaveBeenCalled();
    });

    it('should let the 409 of the version limit through', async () => {
      formRevisions.recordEdit.mockRejectedValue(
        new ConflictException('limite'),
      );

      await expect(
        service.update(PLAN_ID, {} as UpdateAeePlanDto, AUTHOR),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
