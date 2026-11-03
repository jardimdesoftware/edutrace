import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';
import { LEVELS } from 'src/constants';

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hash') }));

const NOW = new Date('2026-10-16T12:00:00.000Z');

const QUEUED = { service_status: ServiceStatus.WAITING, queued_at: NOW };

const CLEARED = {
  service_status: null,
  queued_at: null,
  service_started_at: null,
  service_closed_at: null,
  napne_responsible_id: null,
};

const BUSY_NAPNE_MESSAGE =
  'Encerre os atendimentos do Profissional NAPNE antes de trocar o nível ou excluir a conta.';

describe('UsersService, fila de atendimento do NAPNE', () => {
  let service: UsersService;
  let prisma: { user: { create: jest.Mock }; $transaction: jest.Mock };
  let tx: {
    $queryRaw: jest.Mock;
    user: { update: jest.Mock; count: jest.Mock; delete: jest.Mock };
  };
  let sessions: { revokeAllFromUser: jest.Mock };
  let events: string[];

  const created = { id: 7, email: 'novo@test.com' };

  // A leitura que trava a linha devolve id e nível atuais da conta.
  const lockedAccount = (id_level: number | null) =>
    tx.$queryRaw.mockResolvedValue(
      id_level === null ? [] : [{ id: 7, id_level }],
    );

  const updateData = () => tx.user.update.mock.calls[0][0].data;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    events = [];
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        update: jest.fn().mockImplementation(() => {
          events.push('update');
          return Promise.resolve({ id: 7 });
        }),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: 7 }),
      },
    };
    prisma = {
      user: { create: jest.fn().mockResolvedValue(created) },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => {
        const result = await callback(tx);
        events.push('commit');
        return result;
      }),
    };
    sessions = {
      revokeAllFromUser: jest.fn().mockImplementation(() => {
        events.push('revoke');
        return Promise.resolve();
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionsService, useValue: sessions },
        {
          provide: MailService,
          useValue: {
            sendAccountActivationLink: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    process.env.FRONTEND_URL = 'https://edutrace.example.com';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.FRONTEND_URL;
  });

  describe('create', () => {
    const dto = {
      full_name: 'Novo',
      cpf: '12345678900',
      email: 'novo@test.com',
    };
    const createdData = () => prisma.user.create.mock.calls[0][0].data;

    it('should queue the new student as WAITING with queued_at now', async () => {
      await service.create(dto as any);

      expect(createdData()).toMatchObject(QUEUED);
    });

    it('should queue a student whose level was sent explicitly', async () => {
      await service.create({ ...dto, id_level: LEVELS.ALUNO_ESTUDANTE } as any);

      expect(createdData()).toMatchObject(QUEUED);
    });

    it.each([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ])('should not queue an account of the level %s', async (id_level) => {
      await service.create({ ...dto, id_level } as any);

      expect(createdData()).not.toHaveProperty('service_status');
      expect(createdData()).not.toHaveProperty('queued_at');
    });
  });

  describe('update, entrada e saída da fila', () => {
    it('should queue the account that becomes a student', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);

      await service.update('novo@test.com', {
        id_level: LEVELS.ALUNO_ESTUDANTE,
      });

      expect(updateData()).toMatchObject(QUEUED);
    });

    it('should clear the service fields of the student that stops being one', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_SAUDE,
      });

      expect(updateData()).toMatchObject(CLEARED);
    });

    it('should keep the matrícula and the course of the student that stops being one', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', { id_level: LEVELS.ADMIN });

      expect(updateData().enrollment_number).toBeUndefined();
      expect(updateData().course).toBeUndefined();
    });

    it('should leave the queue alone when the level sent is the one the student already has', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', {
        id_level: LEVELS.ALUNO_ESTUDANTE,
      });

      for (const field of Object.keys(CLEARED)) {
        expect(updateData()).not.toHaveProperty(field);
      }
    });

    it('should leave the queue alone when the request has no level', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', { full_name: 'Outro nome' });

      for (const field of Object.keys(CLEARED)) {
        expect(updateData()).not.toHaveProperty(field);
      }
    });

    it('should clear the service fields of a student that becomes the NAPNE', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_NAPNE,
        service_capacity: 3,
      });

      expect(updateData()).toMatchObject({ ...CLEARED, service_capacity: 3 });
    });
  });

  describe('update, transação e trava', () => {
    it('should read the account with FOR UPDATE inside the transaction before writing', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', { full_name: 'Outro nome' });

      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join('?')).toContain('FOR UPDATE');
      expect(values).toEqual(['novo@test.com']);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.update.mock.invocationCallOrder[0],
      );
    });

    it('should use the default isolation level of the transaction', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', { full_name: 'Outro nome' });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should revoke the sessions only after the transaction commits', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);

      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_SAUDE,
      });

      expect(events).toEqual(['update', 'commit', 'revoke']);
      expect(sessions.revokeAllFromUser).toHaveBeenCalledWith(7);
    });

    it('should not revoke the sessions when the sent level is the current one', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_SAUDE);

      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_SAUDE,
      });

      expect(sessions.revokeAllFromUser).not.toHaveBeenCalled();
    });

    it('should not revoke the sessions when the transaction fails', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);
      tx.user.update.mockRejectedValue(new Error('conexão perdida'));

      await expect(
        service.update('novo@test.com', {
          id_level: LEVELS.PROFISSIONAL_SAUDE,
        }),
      ).rejects.toThrow('conexão perdida');

      expect(sessions.revokeAllFromUser).not.toHaveBeenCalled();
    });
  });

  describe('update, NAPNE com atendimentos', () => {
    beforeEach(() => lockedAccount(LEVELS.PROFISSIONAL_NAPNE));

    it('should answer 409 and change nothing when a NAPNE with students in service changes level', async () => {
      tx.user.count.mockResolvedValue(2);

      await expect(
        service.update('novo@test.com', {
          id_level: LEVELS.PROFISSIONAL_SAUDE,
        }),
      ).rejects.toThrow(new ConflictException(BUSY_NAPNE_MESSAGE));

      expect(tx.user.count).toHaveBeenCalledWith({
        where: {
          napne_responsible_id: 7,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(sessions.revokeAllFromUser).not.toHaveBeenCalled();
    });

    it('should clear the capacity of a NAPNE with no students in service that leaves the level', async () => {
      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_SAUDE,
      });

      expect(updateData()).toMatchObject({ service_capacity: null });
    });

    it('should let a NAPNE with students in service keep the level it already has', async () => {
      tx.user.count.mockResolvedValue(2);

      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_NAPNE,
      });

      expect(tx.user.count).not.toHaveBeenCalled();
      expect(tx.user.update).toHaveBeenCalledTimes(1);
    });

    it('should let a NAPNE with students in service change the name', async () => {
      tx.user.count.mockResolvedValue(2);

      await service.update('novo@test.com', { full_name: 'Outro nome' });

      expect(tx.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('update, service_capacity', () => {
    it('should store the capacity of a NAPNE', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);

      await service.update('novo@test.com', { service_capacity: 5 });

      expect(updateData()).toMatchObject({ service_capacity: 5 });
    });

    it('should accept zero, which stops the NAPNE from taking students', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);

      await service.update('novo@test.com', { service_capacity: 0 });

      expect(updateData()).toMatchObject({ service_capacity: 0 });
    });

    it('should accept a capacity below the students already in service and unassign nobody', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);
      tx.user.count.mockResolvedValue(4);

      await service.update('novo@test.com', { service_capacity: 1 });

      expect(updateData()).toMatchObject({ service_capacity: 1 });
      expect(updateData().napne_responsible_id).toBeUndefined();
    });

    it('should accept the capacity when the same request makes the account a NAPNE', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_SAUDE);

      await service.update('novo@test.com', {
        id_level: LEVELS.PROFISSIONAL_NAPNE,
        service_capacity: 2,
      });

      expect(updateData()).toMatchObject({
        id_level: LEVELS.PROFISSIONAL_NAPNE,
        service_capacity: 2,
      });
    });

    it.each([
      LEVELS.ADMIN,
      LEVELS.ALUNO_ESTUDANTE,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
    ])('should answer 400 for an account of the level %s', async (level) => {
      lockedAccount(level);

      await expect(
        service.update('novo@test.com', { service_capacity: 3 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 400 when the same request takes the NAPNE out of its level', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);

      await expect(
        service.update('novo@test.com', {
          id_level: LEVELS.PROFISSIONAL_SAUDE,
          service_capacity: 3,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should leave a missing account to the update itself', async () => {
      lockedAccount(null);

      await service.update('ninguem@test.com', { service_capacity: 3 });

      expect(tx.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should lock the account with FOR UPDATE before deleting it', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_SAUDE);

      await service.remove(7);

      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join('?')).toContain('FOR UPDATE');
      expect(values).toEqual([7]);
      expect(tx.user.delete).toHaveBeenCalledTimes(1);
    });

    it('should answer 409 and delete nothing for a NAPNE with students in service', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);
      tx.user.count.mockResolvedValue(1);

      await expect(service.remove(7)).rejects.toThrow(
        new ConflictException(BUSY_NAPNE_MESSAGE),
      );

      expect(tx.user.count).toHaveBeenCalledWith({
        where: {
          napne_responsible_id: 7,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });
      expect(tx.user.delete).not.toHaveBeenCalled();
    });

    it('should delete a NAPNE with no students in service', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);

      await service.remove(7);

      expect(tx.user.delete).toHaveBeenCalledTimes(1);
    });

    it('should not count anything for an account that is not a NAPNE', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.remove(7);

      expect(tx.user.count).not.toHaveBeenCalled();
    });

    it('should leave a missing account to the delete itself', async () => {
      lockedAccount(null);

      await service.remove(99);

      expect(tx.user.delete).toHaveBeenCalledTimes(1);
    });
  });
});
