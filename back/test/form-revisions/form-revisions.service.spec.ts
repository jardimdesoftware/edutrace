import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FormType, Prisma } from '@prisma/client';
import { FORM_MAX_VERSIONS, LEVELS } from 'src/constants';
import {
  FORM_VERSION_LIMIT_MESSAGE,
  FormRevisionsService,
  UNKNOWN_AUTHOR_NAME,
} from 'src/form-revisions/form-revisions.service';

const author = { id: 7, name: 'Profa. Ana' };
const target = { formType: FormType.ANAMNESIS, idStudent: 3 };

function build() {
  const tx = {
    formRevision: {
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const prisma = {
    formRevision: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const students = {
    findOneOrFail: jest.fn().mockResolvedValue({ id: 3 }),
  };
  const service = new FormRevisionsService(prisma as any, students as any);

  return { tx, prisma, students, service };
}

const createdData = (tx: ReturnType<typeof build>['tx'], call = 0) =>
  tx.formRevision.create.mock.calls[call][0].data;

describe('FormRevisionsService', () => {
  describe('recordCreation', () => {
    it('should store the version 1 with the author and the content', async () => {
      const { tx, service } = build();

      await service.recordCreation(
        tx as any,
        target,
        { a: 1, created_at: new Date('2026-01-01T00:00:00Z') },
        author,
      );

      expect(createdData(tx)).toMatchObject({
        form_type: 'ANAMNESIS',
        id_student: 3,
        record_key: '',
        version: 1,
        author_name: 'Profa. Ana',
        id_author: 7,
        snapshot: { a: 1, created_at: '2026-01-01T00:00:00.000Z' },
      });
    });

    it('should key the version by the semester of a PAEE', async () => {
      const { tx, service } = build();

      await service.recordCreation(
        tx as any,
        { formType: FormType.AEE_PLAN, idStudent: 3, recordKey: '2026.1' },
        {},
        author,
      );

      expect(createdData(tx).record_key).toBe('2026.1');
    });
  });

  describe('recordEdit', () => {
    const change = {
      before: { v: 'antes' },
      beforeAt: new Date('2026-02-02T00:00:00Z'),
      after: { v: 'depois' },
    };

    it('should store the next version after the existing ones', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(2);

      await service.recordEdit(tx as any, target, change, author);

      expect(tx.formRevision.create).toHaveBeenCalledTimes(1);
      expect(createdData(tx)).toMatchObject({
        version: 3,
        author_name: 'Profa. Ana',
        snapshot: { v: 'depois' },
      });
    });

    it('should store the previous state as version 1 when the form has no history yet', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(0);

      await service.recordEdit(tx as any, target, change, author);

      expect(createdData(tx, 0)).toMatchObject({
        version: 1,
        author_name: UNKNOWN_AUTHOR_NAME,
        id_author: null,
        snapshot: { v: 'antes' },
        created_at: change.beforeAt,
      });
      expect(createdData(tx, 1)).toMatchObject({
        version: 2,
        snapshot: { v: 'depois' },
      });
    });

    it('should credit the original author on the baseline version when the record knows it', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(0);

      await service.recordEdit(
        tx as any,
        target,
        { ...change, beforeAuthor: { id: 9, name: 'Prof. Bia' } },
        author,
      );

      expect(createdData(tx, 0)).toMatchObject({
        author_name: 'Prof. Bia',
        id_author: 9,
      });
    });

    it('should answer 409 and store nothing when the form is at the limit', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(FORM_MAX_VERSIONS);

      await expect(
        service.recordEdit(tx as any, target, change, author),
      ).rejects.toThrow(new ConflictException(FORM_VERSION_LIMIT_MESSAGE));
      expect(tx.formRevision.create).not.toHaveBeenCalled();
    });

    it('should accept the edit that reaches the limit', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(FORM_MAX_VERSIONS - 1);

      await service.recordEdit(tx as any, target, change, author);

      expect(createdData(tx).version).toBe(FORM_MAX_VERSIONS);
    });

    it('should answer 409 when two edits dispute the same version', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(1);
      tx.formRevision.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );

      await expect(
        service.recordEdit(tx as any, target, change, author),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should let other errors through', async () => {
      const { tx, service } = build();
      tx.formRevision.count.mockResolvedValue(1);
      tx.formRevision.create.mockRejectedValue(new Error('banco caiu'));

      await expect(
        service.recordEdit(tx as any, target, change, author),
      ).rejects.toThrow('banco caiu');
    });
  });

  describe('removeAll', () => {
    it('should delete only the history of that form', async () => {
      const { tx, service } = build();

      await service.removeAll(tx as any, {
        formType: FormType.AEE_PLAN,
        idStudent: 3,
        recordKey: '2026.1',
      });

      expect(tx.formRevision.deleteMany).toHaveBeenCalledWith({
        where: { form_type: 'AEE_PLAN', id_student: 3, record_key: '2026.1' },
      });
    });
  });

  describe('list e findVersion', () => {
    it('should list the versions in ascending order for a reader', async () => {
      const { prisma, service } = build();
      prisma.formRevision.findMany.mockResolvedValue([{ version: 1 }]);

      const result = await service.list(FormType.ANAMNESIS, 'a@x.com', '', [
        LEVELS.PROFISSIONAL_SAUDE,
      ]);

      expect(result).toEqual([{ version: 1 }]);
      expect(prisma.formRevision.findMany).toHaveBeenCalledWith({
        where: { form_type: 'ANAMNESIS', id_student: 3, record_key: '' },
        orderBy: { version: 'asc' },
        select: { version: true, author_name: true, created_at: true },
      });
    });

    it.each([
      [FormType.ANAMNESIS, LEVELS.PROFISSIONAL_EDUCACAO],
      [FormType.ANAMNESIS, LEVELS.ALUNO_ESTUDANTE],
      [FormType.SCREENING, LEVELS.ALUNO_ESTUDANTE],
      [FormType.CASE_STUDY, LEVELS.ADMIN],
      [FormType.AEE_PLAN, LEVELS.ALUNO_ESTUDANTE],
    ])(
      'should answer 403 for %s to level %s before querying',
      async (type, level) => {
        const { prisma, students, service } = build();

        await expect(
          service.list(type, 'a@x.com', '', [level]),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.findVersion(type, 'a@x.com', '', 1, [level]),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(students.findOneOrFail).not.toHaveBeenCalled();
        expect(prisma.formRevision.findMany).not.toHaveBeenCalled();
      },
    );

    it('should return the content of one version', async () => {
      const { prisma, service } = build();
      prisma.formRevision.findFirst.mockResolvedValue({
        version: 2,
        snapshot: { a: 1 },
      });

      const result = await service.findVersion(
        FormType.CASE_STUDY,
        'a@x.com',
        '',
        2,
        [LEVELS.PROFESSOR_AEE],
      );

      expect(result).toMatchObject({ version: 2, snapshot: { a: 1 } });
      expect(prisma.formRevision.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            form_type: 'CASE_STUDY',
            id_student: 3,
            record_key: '',
            version: 2,
          },
        }),
      );
    });

    it('should answer 404 for a version that does not exist', async () => {
      const { prisma, service } = build();
      prisma.formRevision.findFirst.mockResolvedValue(null);

      await expect(
        service.findVersion(FormType.CASE_STUDY, 'a@x.com', '', 9, [
          LEVELS.PROFESSOR_AEE,
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
