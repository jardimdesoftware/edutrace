import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CaseStudiesService } from 'src/case-studies/case-studies.service';
import { CASE_STUDY_SELECT } from 'src/case-studies/case-study-select';
import { CreateCaseStudyDto } from 'src/case-studies/dto/create-case-study.dto';
import { UpdateCaseStudyDto } from 'src/case-studies/dto/update-case-study.dto';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { CASE_STUDY_READERS, LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { StudentsService } from 'src/students/students.service';
import { STUDENT_EMAIL, validBody, validSections } from './case-study.fixtures';

const STUDENT_ID = 2;
const AUTHOR_ID = 7;

const caseStudy = {
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
      ? { modelName: 'CaseStudy', target: ['id_student'] }
      : {
          modelName: 'CaseStudy',
          driverAdapterError: {
            name: 'DriverAdapterError',
            cause: {
              originalCode: '23505',
              kind: 'UniqueConstraintViolation',
              constraint: { index: 'CaseStudy_id_student_key' },
              table: 'CaseStudy',
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

describe('CaseStudiesService, select da resposta', () => {
  it('should select the author by id and name and the student by name and course, never the whole User', () => {
    expect(CASE_STUDY_SELECT.author).toEqual({
      select: { id: true, full_name: true },
    });
    expect(CASE_STUDY_SELECT.student).toEqual({
      select: { full_name: true, course: true },
    });
    expect(Object.keys(CASE_STUDY_SELECT).sort()).toEqual(
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
  });
});

describe('CaseStudiesService', () => {
  let service: CaseStudiesService;
  let prisma: {
    caseStudy: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let studentsService: { findOneOrFail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      caseStudy: {
        create: jest.fn().mockResolvedValue(caseStudy),
        findUnique: jest.fn().mockResolvedValue(caseStudy),
        update: jest.fn().mockResolvedValue(caseStudy),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    studentsService = {
      findOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: STUDENT_ID, email: STUDENT_EMAIL }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseStudiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StudentsService, useValue: studentsService },
      ],
    }).compile();

    service = module.get(CaseStudiesService);
  });

  describe('create', () => {
    const { student_email: _email, ...sections } = validBody();
    const dto = validBody() as unknown as CreateCaseStudyDto;

    it('should create the case study of the student with the author of the session', async () => {
      const result = await service.create(dto, AUTHOR_ID);

      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
        email: STUDENT_EMAIL,
      });
      expect(prisma.caseStudy.create).toHaveBeenCalledWith({
        data: { ...sections, id_student: STUDENT_ID, id_author: AUTHOR_ID },
        select: CASE_STUDY_SELECT,
      });
      expect(result).toBe(caseStudy);
    });

    it('should not store the e-mail of the student in the record', async () => {
      await service.create(dto, AUTHOR_ID);

      const { data } = prisma.caseStudy.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('student_email');
    });

    it('should take the author from the argument, and never from the body', async () => {
      const forged = {
        ...dto,
        id_author: 1234,
      } as unknown as CreateCaseStudyDto;

      await service.create(forged, AUTHOR_ID);

      const { data } = prisma.caseStudy.create.mock.calls[0][0] as {
        data: { id_author: number };
      };
      expect(data.id_author).toBe(AUTHOR_ID);
    });

    it('should answer 404 and write nothing when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(service.create(dto, AUTHOR_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.caseStudy.create).not.toHaveBeenCalled();
    });

    it.each([
      ['sem meta.target, formato do adapter pg', false],
      ['com meta.target, formato do Prisma sem adapter', true],
    ])(
      'should answer 409 for the second case study of the student (%s)',
      async (_, withTarget) => {
        prisma.caseStudy.create.mockRejectedValue(uniqueViolation(withTarget));

        const result = service.create(dto, AUTHOR_ID);

        await expect(result).rejects.toThrow(ConflictException);
        await expect(result).rejects.toThrow(
          'Este estudante já tem um estudo de caso.',
        );
      },
    );

    it.each(['P2003', 'P2025', 'P1001'])(
      'should not turn the Prisma error %s into 409',
      async (code) => {
        const error = knownError(code);
        prisma.caseStudy.create.mockRejectedValue(error);

        await expect(service.create(dto, AUTHOR_ID)).rejects.toBe(error);
      },
    );

    it('should propagate an error that is not from Prisma', async () => {
      const error = new Error('conexão perdida');
      prisma.caseStudy.create.mockRejectedValue(error);

      await expect(service.create(dto, AUTHOR_ID)).rejects.toBe(error);
    });
  });

  describe('findOne', () => {
    it('should let an account with the Education and the Professor do AEE roles read the records of any student', async () => {
      const result = await service.findOne(
        STUDENT_EMAIL,
        requestOf([3, 6], 'outra.pessoa@example.com'),
      );

      expect(result).toBe(caseStudy);
    });

    it('should not let a student read the records of another one, even with the same e-mail case', async () => {
      await expect(
        service.findOne(
          STUDENT_EMAIL,
          requestOf([2], 'outra.pessoa@example.com'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it.each(CASE_STUDY_READERS.map((level) => [level]))(
      'should let the level %i read the case study of any student',
      async (level) => {
        const result = await service.findOne(
          STUDENT_EMAIL,
          requestOf(level, 'outra.pessoa@example.com'),
        );

        expect(result).toBe(caseStudy);
        expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
          email: STUDENT_EMAIL,
        });
        expect(prisma.caseStudy.findUnique).toHaveBeenCalledWith({
          where: { id_student: STUDENT_ID },
          select: CASE_STUDY_SELECT,
        });
      },
    );

    it('should let the student read his own case study', async () => {
      const result = await service.findOne(
        STUDENT_EMAIL,
        requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
      );

      expect(result).toBe(caseStudy);
    });

    it('should answer 403 to a student that reads the case study of another student, without querying', async () => {
      const result = service.findOne(
        'outro.estudante@example.com',
        requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
      );

      await expect(result).rejects.toThrow(ForbiddenException);
      await expect(result).rejects.toThrow(
        'Você não tem permissão para visualizar este estudo de caso',
      );
      expect(studentsService.findOneOrFail).not.toHaveBeenCalled();
      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
    });

    it('should answer 403 to the student whether or not the other student has a case study', async () => {
      prisma.caseStudy.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(
          'outro.estudante@example.com',
          requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not compare the e-mails by prefix or by case', async () => {
      await expect(
        service.findOne(
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
        service.findOne('prof@example.com', requestOf(LEVELS.PROFISSIONAL_NAPNE)),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
    });

    it('should answer 404 when the student has no case study', async () => {
      prisma.caseStudy.findUnique.mockResolvedValue(null);

      const result = service.findOne(
        STUDENT_EMAIL,
        requestOf(LEVELS.PROFISSIONAL_NAPNE),
      );

      await expect(result).rejects.toThrow(NotFoundException);
      await expect(result).rejects.toThrow('Estudo de caso não encontrado');
    });

    it('should answer 404 to the student that has no case study of his own', async () => {
      prisma.caseStudy.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(
          STUDENT_EMAIL,
          requestOf(LEVELS.ALUNO_ESTUDANTE, STUDENT_EMAIL),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto = {
      barriers: 'Novas barreiras',
      aee_opinion: { opinion: 'Novo parecer', date: '2026-11-01' },
    } as unknown as UpdateCaseStudyDto;

    it('should replace only the sections that were sent', async () => {
      const result = await service.update(STUDENT_EMAIL, dto);

      expect(studentsService.findOneOrFail).toHaveBeenCalledWith({
        email: STUDENT_EMAIL,
      });
      expect(prisma.caseStudy.update).toHaveBeenCalledWith({
        where: { id_student: STUDENT_ID },
        data: {
          barriers: 'Novas barreiras',
          aee_opinion: { opinion: 'Novo parecer', date: '2026-11-01' },
        },
        select: CASE_STUDY_SELECT,
      });
      expect(result).toBe(caseStudy);
    });

    it('should write the whole section that was sent, without merging it with the stored one', async () => {
      await service.update(STUDENT_EMAIL, dto);

      expect(prisma.caseStudy.findUnique).not.toHaveBeenCalled();
      const { data } = prisma.caseStudy.update.mock.calls[0][0] as {
        data: { aee_opinion: unknown };
      };
      expect(data.aee_opinion).toBe(
        (dto as unknown as Record<string, unknown>).aee_opinion,
      );
    });

    it('should never change the author nor the student', async () => {
      const forged = {
        ...dto,
        id_author: 1234,
        id_student: 55,
      } as unknown as UpdateCaseStudyDto;

      await service.update(STUDENT_EMAIL, forged);

      const { data } = prisma.caseStudy.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('id_author');
      expect(data).not.toHaveProperty('id_student');
      expect(data).not.toHaveProperty('author');
    });

    it('should answer 404 when the account is not a student', async () => {
      studentsService.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(service.update('prof@example.com', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.caseStudy.update).not.toHaveBeenCalled();
    });

    it('should answer 404 when the student has no case study', async () => {
      prisma.caseStudy.update.mockRejectedValue(knownError('P2025'));

      const result = service.update(STUDENT_EMAIL, dto);

      await expect(result).rejects.toThrow(NotFoundException);
      await expect(result).rejects.toThrow('Estudo de caso não encontrado');
    });

    it('should propagate the other errors', async () => {
      const error = knownError('P2003');
      prisma.caseStudy.update.mockRejectedValue(error);

      await expect(service.update(STUDENT_EMAIL, dto)).rejects.toBe(error);
    });
  });

  describe('remove', () => {
    it('should delete the case study of the student by e-mail', async () => {
      const result = await service.remove(STUDENT_EMAIL);

      expect(prisma.caseStudy.deleteMany).toHaveBeenCalledWith({
        where: { student: { email: STUDENT_EMAIL } },
      });
      expect(result).toEqual({
        message: `Estudo de caso com email ${STUDENT_EMAIL} foi removido com sucesso`,
      });
    });

    it('should answer 404 when there is no case study to delete', async () => {
      prisma.caseStudy.deleteMany.mockResolvedValue({ count: 0 });

      const result = service.remove(STUDENT_EMAIL);

      await expect(result).rejects.toThrow(NotFoundException);
      await expect(result).rejects.toThrow('Estudo de caso não encontrado');
    });
  });
});
