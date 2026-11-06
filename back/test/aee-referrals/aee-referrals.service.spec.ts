import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReferralKind, ServiceStatus } from '@prisma/client';
import { AEE_SERVICE_CAPACITY } from 'src/constants';
import { AeeReferralsService } from 'src/aee-referrals/aee-referrals.service';

const NOW = new Date('2026-11-06T12:00:00Z');
const REQUESTER = { sub: 5, name: 'Ana NAPNE' };
const EMAIL = 'aluno@discente.ifpe.edu.br';
const STUDENT_ID = 20;
const TEACHER_ID = 31;
const PREVIOUS_ID = 12;

describe('AeeReferralsService', () => {
  let service: AeeReferralsService;
  let tx: {
    $queryRaw: jest.Mock;
    user: { findFirst: jest.Mock; count: jest.Mock; update: jest.Mock };
    aeeReferral: { createMany: jest.Mock };
  };
  let prisma: {
    user: { findFirst: jest.Mock };
    aeeReferral: { findMany: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const waitingStudent = {
    id: STUDENT_ID,
    full_name: 'Maria Clara',
    service_status: ServiceStatus.WAITING,
    aee_responsible_id: null,
  };
  const teacher = { id: TEACHER_ID, full_name: 'Beatriz AEE' };

  // O estudante e o professor saem do mesmo findFirst, na ordem das consultas.
  const stage = (student: object | null, teacherFound: object | null) => {
    tx.user.findFirst
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce(teacherFound);
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      aeeReferral: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: STUDENT_ID, aee_responsible_id: null }),
      },
      aeeReferral: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new AeeReferralsService(prisma as never);
  });

  afterEach(() => jest.useRealTimers());

  describe('refer', () => {
    it('should answer 404, without opening a transaction, for an e-mail that is not an active student', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should lock the rows involved once each, in the order of the id', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: STUDENT_ID,
        aee_responsible_id: PREVIOUS_ID,
      });
      stage(
        {
          ...waitingStudent,
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: PREVIOUS_ID,
        },
        teacher,
      );

      await service.refer(EMAIL, TEACHER_ID, REQUESTER);

      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join('?')).toContain('FOR UPDATE');
      expect(strings.join('?')).toContain('ORDER BY "id"');
      expect(JSON.stringify(values)).toContain(
        JSON.stringify([PREVIOUS_ID, STUDENT_ID, TEACHER_ID]).slice(1, -1),
      );
    });

    it('should put a waiting student in service with the teacher, like assuming, and warn the teacher', async () => {
      stage(waitingStudent, teacher);

      const result = await service.refer(EMAIL, TEACHER_ID, REQUESTER);

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: STUDENT_ID },
        data: {
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: TEACHER_ID,
          service_started_at: NOW,
          service_closed_at: null,
        },
      });
      expect(tx.aeeReferral.createMany).toHaveBeenCalledWith({
        data: [
          {
            kind: ReferralKind.ASSIGNED,
            id_to: TEACHER_ID,
            id_student: STUDENT_ID,
            student_name: 'Maria Clara',
            id_from: REQUESTER.sub,
            from_name: 'Ana NAPNE',
          },
        ],
      });
      expect(result).toEqual({
        student: { id: STUDENT_ID, full_name: 'Maria Clara' },
        teacher: { id: TEACHER_ID, full_name: 'Beatriz AEE' },
        previous_teacher_id: null,
      });
    });

    it('should move a student in service to the new teacher, keeping the start, and warn both teachers', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: STUDENT_ID,
        aee_responsible_id: PREVIOUS_ID,
      });
      stage(
        {
          ...waitingStudent,
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: PREVIOUS_ID,
        },
        teacher,
      );

      const result = await service.refer(EMAIL, TEACHER_ID, REQUESTER);

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: STUDENT_ID },
        data: { aee_responsible_id: TEACHER_ID },
      });
      const { data } = tx.aeeReferral.createMany.mock.calls[0][0] as {
        data: { kind: ReferralKind; id_to: number }[];
      };
      expect(data.map((n) => [n.kind, n.id_to])).toEqual([
        [ReferralKind.ASSIGNED, TEACHER_ID],
        [ReferralKind.REMOVED, PREVIOUS_ID],
      ]);
      expect(result.previous_teacher_id).toBe(PREVIOUS_ID);
    });

    it('should answer 409 for a student that is already with that teacher', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: STUDENT_ID,
        aee_responsible_id: TEACHER_ID,
      });
      stage(
        {
          ...waitingStudent,
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: TEACHER_ID,
        },
        teacher,
      );

      await expect(service.refer(EMAIL, TEACHER_ID, REQUESTER)).rejects.toThrow(
        new ConflictException('O estudante já está com este professor.'),
      );

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.aeeReferral.createMany).not.toHaveBeenCalled();
    });

    it('should answer 409 for a student whose service is closed', async () => {
      stage(
        { ...waitingStudent, service_status: ServiceStatus.CLOSED },
        teacher,
      );

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 404 when the target is not an active AEE teacher', async () => {
      stage(waitingStudent, null);

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 409 and change nothing for a teacher at the limit', async () => {
      stage(waitingStudent, teacher);
      tx.user.count.mockResolvedValue(AEE_SERVICE_CAPACITY);

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.user.count).toHaveBeenCalledWith({
        where: {
          aee_responsible_id: TEACHER_ID,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.aeeReferral.createMany).not.toHaveBeenCalled();
    });

    it('should accept the teacher that has one free place', async () => {
      stage(waitingStudent, teacher);
      tx.user.count.mockResolvedValue(AEE_SERVICE_CAPACITY - 1);

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).resolves.toMatchObject({ teacher: { id: TEACHER_ID } });
    });

    it('should answer 409 when the student changed teacher between the first read and the lock', async () => {
      stage(
        {
          ...waitingStudent,
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: PREVIOUS_ID,
        },
        teacher,
      );

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 404 when the student is gone after the lock', async () => {
      stage(null, teacher);

      await expect(
        service.refer(EMAIL, TEACHER_ID, REQUESTER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pending', () => {
    it('should list only the unseen notices of the teacher, oldest first', async () => {
      await service.pending(TEACHER_ID);

      expect(prisma.aeeReferral.findMany).toHaveBeenCalledWith({
        where: { id_to: TEACHER_ID, seen_at: null },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          kind: true,
          student_name: true,
          from_name: true,
          created_at: true,
        },
      });
    });
  });

  describe('markSeen', () => {
    it('should mark every pending notice of the teacher when no ids come', async () => {
      prisma.aeeReferral.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.markSeen(TEACHER_ID)).resolves.toEqual({
        marked: 3,
      });

      expect(prisma.aeeReferral.updateMany).toHaveBeenCalledWith({
        where: { id_to: TEACHER_ID, seen_at: null },
        data: { seen_at: NOW },
      });
    });

    it('should keep the filter by the teacher when ids come, so the id of someone else matches nothing', async () => {
      await service.markSeen(TEACHER_ID, [4, 9]);

      expect(prisma.aeeReferral.updateMany).toHaveBeenCalledWith({
        where: { id_to: TEACHER_ID, seen_at: null, id: { in: [4, 9] } },
        data: { seen_at: NOW },
      });
    });
  });
});
