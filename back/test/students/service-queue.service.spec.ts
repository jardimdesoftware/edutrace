import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AEE_SERVICE_CAPACITY, LEVELS } from 'src/constants';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { StudentsService } from 'src/students/students.service';

const NOW = new Date('2026-10-16T12:00:00.000Z');
const EMAIL = 'estudante@example.com';
const AEE_ID = 9;
const LIMIT_MESSAGE = 'Você já atende o limite de 15 estudantes.';
const STUDENT = { id: 2, email: EMAIL, service_status: 'IN_SERVICE' };

describe('ServiceQueueService', () => {
  let service: ServiceQueueService;
  let prisma: {
    $transaction: jest.Mock;
    user: { updateMany: jest.Mock; findFirst: jest.Mock };
  };
  let tx: {
    $queryRaw: jest.Mock;
    user: { count: jest.Mock; updateMany: jest.Mock };
  };
  let students: { findOne: jest.Mock; findOneOrFail: jest.Mock };
  let events: string[];

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    events = [];
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: AEE_ID }]),
      user: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => {
        const result = await callback(tx);
        events.push('commit');
        return result;
      }),
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
    };
    students = {
      findOne: jest.fn().mockResolvedValue(STUDENT),
      findOneOrFail: jest.fn().mockImplementation(() => {
        events.push('findOneOrFail');
        return Promise.resolve({ id: 2, email: EMAIL });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceQueueService,
        { provide: PrismaService, useValue: prisma },
        { provide: StudentsService, useValue: students },
      ],
    }).compile();

    service = module.get(ServiceQueueService);
  });

  afterEach(() => jest.useRealTimers());

  // O estudante excluído entre a transição e a leitura responde 404, nas três
  // transições, em vez de um 200 sem corpo.
  describe('leitura do estudante depois da transição', () => {
    beforeEach(() => students.findOne.mockResolvedValue(null));

    it.each([
      ['assume', () => service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE])],
      ['close', () => service.close(EMAIL, { sub: 1, roles: [LEVELS.PROFESSOR_AEE] })],
      ['reopen', () => service.reopen(EMAIL, [LEVELS.PROFISSIONAL_NAPNE])],
    ])('should answer 404 from %s when the student is gone', async (_, run) => {
      await expect(run()).rejects.toThrow(
        new NotFoundException('Estudante não encontrado'),
      );
    });
  });

  describe('assume', () => {
    it('should lock the teacher row with FOR UPDATE, filtered by id and by the AEE role', async () => {
      await service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]);

      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join('?')).toContain('FOR UPDATE');
      expect(values).toEqual([AEE_ID, LEVELS.PROFESSOR_AEE]);
    });

    it('should lock before counting and count before assigning', async () => {
      await service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]);

      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.count.mock.invocationCallOrder[0],
      );
      expect(tx.user.count.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.updateMany.mock.invocationCallOrder[0],
      );
    });

    it('should count the students in service of that teacher', async () => {
      await service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]);

      expect(tx.user.count).toHaveBeenCalledWith({
        where: {
          aee_responsible_id: AEE_ID,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });
    });

    it('should move only a waiting student to IN_SERVICE in a single conditional update', async () => {
      await service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]);

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: {
          email: EMAIL,
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          service_status: ServiceStatus.WAITING,
        },
        data: {
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: AEE_ID,
          service_started_at: NOW,
          service_closed_at: null,
        },
      });
    });

    it('should read the returned student with the real roles of who asked, like close', async () => {
      const roles = [LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE];

      await expect(service.assume(EMAIL, AEE_ID, roles)).resolves.toBe(STUDENT);
      expect(students.findOne).toHaveBeenCalledWith(EMAIL, roles);
    });

    it('should use the default isolation level of the transaction', async () => {
      await service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should have a fixed capacity of 15', () => {
      expect(AEE_SERVICE_CAPACITY).toBe(15);
    });

    it('should take the last free slot', async () => {
      tx.user.count.mockResolvedValue(AEE_SERVICE_CAPACITY - 1);

      await service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]);

      expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['at the limit', 15],
      ['above the limit', 20],
    ])('should answer 409 and assign nothing %s', async (_, inService) => {
      tx.user.count.mockResolvedValue(inService);

      await expect(
        service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]),
      ).rejects.toThrow(new ConflictException(LIMIT_MESSAGE));

      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('should answer 403 when the account does not have the AEE role', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(
        service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('should answer 409 when the student is not waiting', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]),
      ).rejects.toThrow(
        new ConflictException('O estudante não está na fila de espera.'),
      );

      expect(students.findOneOrFail).toHaveBeenCalledWith({ email: EMAIL });
    });

    it('should answer 404 when the e-mail is not a student', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });
      students.findOneOrFail.mockRejectedValue(
        new NotFoundException('Estudante não encontrado'),
      );

      await expect(
        service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Quem decide entre 404 e 409 usa outra conexão do pool. Dentro da
    // transação, com o pool inteiro ocupado por transações iguais, essa
    // consulta esperaria uma conexão que só volta quando a transação acaba.
    it('should tell 404 from 409 only after the transaction ended', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assume(EMAIL, AEE_ID, [LEVELS.PROFESSOR_AEE]),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(events).toEqual(['commit', 'findOneOrFail']);
    });
  });

  describe('close', () => {
    const responsible = { sub: AEE_ID, roles: [LEVELS.PROFESSOR_AEE] };

    it('should restrict the AEE teacher to the students it is responsible for', async () => {
      await service.close(EMAIL, responsible);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          email: EMAIL,
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: AEE_ID,
        },
        data: { service_status: ServiceStatus.CLOSED, service_closed_at: NOW },
      });
    });

    // Negação por padrão: nenhum nível encerra sem filtro. Qualquer nível que
    // chegue ao service, o administrador inclusive, só encerra o que é dele.
    it.each([
      LEVELS.ADMIN,
      LEVELS.ALUNO_ESTUDANTE,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ])('should restrict level %i to its own students', async (id_level) => {
      await service.close(EMAIL, { sub: 7, roles: [id_level] });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          email: EMAIL,
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: 7,
        },
        data: { service_status: ServiceStatus.CLOSED, service_closed_at: NOW },
      });
    });

    it('should keep the responsible recorded as history', async () => {
      await service.close(EMAIL, responsible);

      const { data } = prisma.user.updateMany.mock.calls[0][0];
      expect(data).not.toHaveProperty('aee_responsible_id');
      expect(data).not.toHaveProperty('service_started_at');
    });

    it('should return the record of the student read for the level of who closes', async () => {
      await expect(service.close(EMAIL, responsible)).resolves.toBe(STUDENT);
      expect(students.findOne).toHaveBeenCalledWith(EMAIL, [
        LEVELS.PROFESSOR_AEE,
      ]);
    });

    it.each([ServiceStatus.WAITING, ServiceStatus.CLOSED])(
      'should answer 409 when the student is %s',
      async (service_status) => {
        prisma.user.updateMany.mockResolvedValue({ count: 0 });
        prisma.user.findFirst.mockResolvedValue({ service_status });

        await expect(service.close(EMAIL, responsible)).rejects.toThrow(
          new ConflictException('O estudante não está em atendimento.'),
        );
      },
    );

    it('should answer 403 when another teacher is the responsible', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.findFirst.mockResolvedValue({
        service_status: ServiceStatus.IN_SERVICE,
      });

      await expect(service.close(EMAIL, responsible)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should answer 404 when the e-mail is not a student', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.close(EMAIL, responsible)).rejects.toThrow(
        new NotFoundException('Estudante não encontrado'),
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: EMAIL, roles: { has: LEVELS.ALUNO_ESTUDANTE } },
        select: { service_status: true },
      });
    });
  });

  describe('reopen', () => {
    it('should send a closed student back to the end of the queue', async () => {
      await service.reopen(EMAIL, [LEVELS.PROFISSIONAL_NAPNE]);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          email: EMAIL,
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          service_status: ServiceStatus.CLOSED,
        },
        data: {
          service_status: ServiceStatus.WAITING,
          queued_at: NOW,
          aee_responsible_id: null,
          service_started_at: null,
          service_closed_at: null,
        },
      });
    });

    it.each([LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE])(
      'should return the record of the student read for the level %s of who reopens',
      async (level) => {
        await expect(service.reopen(EMAIL, [level])).resolves.toBe(STUDENT);
        expect(students.findOne).toHaveBeenCalledWith(EMAIL, [level]);
      },
    );

    it.each([ServiceStatus.WAITING, ServiceStatus.IN_SERVICE])(
      'should answer 409 when the student is %s',
      async (service_status) => {
        prisma.user.updateMany.mockResolvedValue({ count: 0 });
        prisma.user.findFirst.mockResolvedValue({ service_status });

        await expect(service.reopen(EMAIL, [LEVELS.PROFISSIONAL_NAPNE])).rejects.toThrow(
          new ConflictException('O estudante não está encerrado.'),
        );
      },
    );

    it('should answer 404 when the e-mail is not a student', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.reopen(EMAIL, [LEVELS.PROFISSIONAL_NAPNE])).rejects.toThrow(
        new NotFoundException('Estudante não encontrado'),
      );
    });
  });
});
