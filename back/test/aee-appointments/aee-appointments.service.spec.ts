import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import {
  AeeAppointmentsService,
  APPOINTMENTS_MAX_RANGE_DAYS,
} from 'src/aee-appointments/aee-appointments.service';

const TEACHER = 7;
const STUDENT = 20;
const START = '2026-11-23T13:00:00.000Z';
const END = '2026-11-23T14:00:00.000Z';

describe('AeeAppointmentsService', () => {
  let service: AeeAppointmentsService;
  let prisma: {
    user: { findFirst: jest.Mock; findMany: jest.Mock };
    aeeAppointment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const stored = {
    id: 1,
    id_teacher: TEACHER,
    id_student: STUDENT,
    starts_at: new Date(START),
    ends_at: new Date(END),
    notes: null,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: STUDENT }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aeeAppointment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(stored),
        update: jest.fn().mockResolvedValue(stored),
        delete: jest.fn().mockResolvedValue(stored),
      },
    };
    service = new AeeAppointmentsService(prisma as never);
  });

  describe('students', () => {
    it('lists only students this teacher is attending now', async () => {
      await service.students(TEACHER);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            aee_responsible_id: TEACHER,
            service_status: ServiceStatus.IN_SERVICE,
            deleted_at: null,
          },
          select: { id: true, full_name: true, email: true },
        }),
      );
    });
  });

  describe('list', () => {
    it('scopes the query to the teacher and to students still attended by them', async () => {
      await service.list(TEACHER, START, '2026-11-30T00:00:00.000Z');

      const { where } = prisma.aeeAppointment.findMany.mock.calls[0][0];
      expect(where.id_teacher).toBe(TEACHER);
      expect(where.student).toEqual({
        aee_responsible_id: TEACHER,
        service_status: ServiceStatus.IN_SERVICE,
        deleted_at: null,
      });
    });

    it('rejects a period that ends before it starts', () => {
      expect(() => service.list(TEACHER, END, START)).toThrow(
        BadRequestException,
      );
    });

    it('rejects a period longer than the limit', () => {
      const to = new Date(
        new Date(START).getTime() +
          (APPOINTMENTS_MAX_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000,
      ).toISOString();

      expect(() => service.list(TEACHER, START, to)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('create', () => {
    it('creates the appointment owned by the session teacher', async () => {
      await service.create(TEACHER, {
        id_student: STUDENT,
        starts_at: START,
        ends_at: END,
        notes: '  Retomar leitura  ',
      });

      expect(prisma.aeeAppointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            id_teacher: TEACHER,
            id_student: STUDENT,
            starts_at: new Date(START),
            ends_at: new Date(END),
            notes: 'Retomar leitura',
          },
        }),
      );
    });

    it('answers 404 when the student is not attended by this teacher', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TEACHER, {
          id_student: 99,
          starts_at: START,
          ends_at: END,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.aeeAppointment.create).not.toHaveBeenCalled();
    });

    it('rejects an end that is not after the start', async () => {
      await expect(
        service.create(TEACHER, {
          id_student: STUDENT,
          starts_at: END,
          ends_at: START,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('answers 409 when the teacher already has an appointment in that time', async () => {
      prisma.aeeAppointment.findFirst.mockResolvedValue({ id: 5 });

      await expect(
        service.create(TEACHER, {
          id_student: STUDENT,
          starts_at: START,
          ends_at: END,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.aeeAppointment.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('answers 404 for an appointment of another teacher', async () => {
      prisma.aeeAppointment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TEACHER, 1, { notes: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.aeeAppointment.findFirst).toHaveBeenCalledWith({
        where: { id: 1, id_teacher: TEACHER },
      });
      expect(prisma.aeeAppointment.update).not.toHaveBeenCalled();
    });

    it('keeps the current values and ignores itself in the overlap check', async () => {
      prisma.aeeAppointment.findFirst
        .mockResolvedValueOnce(stored)
        .mockResolvedValueOnce(null);

      await service.update(TEACHER, 1, { notes: 'Nova observação' });

      const overlap = prisma.aeeAppointment.findFirst.mock.calls[1][0];
      expect(overlap.where.id).toEqual({ not: 1 });
      expect(prisma.aeeAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            id_student: STUDENT,
            starts_at: new Date(START),
            ends_at: new Date(END),
            notes: 'Nova observação',
          }),
        }),
      );
    });

    it('checks the new student when it changes', async () => {
      prisma.aeeAppointment.findFirst.mockResolvedValueOnce(stored);
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TEACHER, 1, { id_student: 99 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.aeeAppointment.update).not.toHaveBeenCalled();
    });

    it('answers 409 when the new time clashes with another appointment', async () => {
      prisma.aeeAppointment.findFirst
        .mockResolvedValueOnce(stored)
        .mockResolvedValueOnce({ id: 2 });

      await expect(
        service.update(TEACHER, 1, { starts_at: '2026-11-23T12:30:00.000Z' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes an appointment of the teacher', async () => {
      prisma.aeeAppointment.findFirst.mockResolvedValue(stored);

      await service.remove(TEACHER, 1);

      expect(prisma.aeeAppointment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('answers 404 for an appointment of another teacher', async () => {
      await expect(service.remove(TEACHER, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.aeeAppointment.delete).not.toHaveBeenCalled();
    });
  });
});
