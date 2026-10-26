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

// O responsável pedagógico (servidor ou pessoa externa) é dado do estudante.
// O telefone e o CPF do externo são dados de terceiro, e não ficam numa conta
// que deixou de ser estudante.
const MANAGER_CLEARED = {
  pedagogical_manager_id: null,
  external_manager_name: null,
  external_manager_phone: null,
  external_manager_cpf: null,
};

const BUSY_NAPNE_MESSAGE =
  'Encerre os atendimentos do Profissional NAPNE antes de tirar esse papel ou excluir a conta.';

describe('UsersService, fila de atendimento do NAPNE', () => {
  let service: UsersService;
  let prisma: { user: { create: jest.Mock }; $transaction: jest.Mock };
  let tx: {
    $queryRaw: jest.Mock;
    user: {
      update: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
  };
  let sessions: { revokeAllFromUser: jest.Mock };
  let events: string[];

  const created = { id: 7, email: 'novo@test.com' };

  // A leitura que trava a linha devolve id e papéis atuais da conta.
  const lockedAccount = (roles: number | number[] | null) =>
    tx.$queryRaw.mockResolvedValue(
      roles === null ? [] : [{ id: 7, roles: [roles].flat() }],
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
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
      await service.create({ ...dto, roles: [LEVELS.ALUNO_ESTUDANTE] } as any);

      expect(createdData()).toMatchObject(QUEUED);
    });

    it.each([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ])('should not queue an account of the level %s', async (id_level) => {
      await service.create({ ...dto, roles: [id_level] } as any);

      expect(createdData()).not.toHaveProperty('service_status');
      expect(createdData()).not.toHaveProperty('queued_at');
    });
  });

  describe('update, entrada e saída da fila', () => {
    it('should queue the account that becomes a student', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);

      await service.update('novo@test.com', {
        roles: [LEVELS.ALUNO_ESTUDANTE],
      });

      expect(updateData()).toMatchObject(QUEUED);
    });

    it('should clear the service fields of the student that stops being one', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_SAUDE],
      });

      expect(updateData()).toMatchObject(CLEARED);
    });

    it('should keep the matrícula and the course of the student that stops being one', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', { roles: [LEVELS.ADMIN] });

      expect(updateData().enrollment_number).toBeUndefined();
      expect(updateData().course).toBeUndefined();
    });

    it('should leave the queue alone when the level sent is the one the student already has', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', {
        roles: [LEVELS.ALUNO_ESTUDANTE],
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
        roles: [LEVELS.PROFISSIONAL_NAPNE],
        service_capacity: 3,
      });

      expect(updateData()).toMatchObject({ ...CLEARED, service_capacity: 3 });
    });
  });

  describe('update, responsável pedagógico do estudante que deixa de ser estudante', () => {
    it.each([
      LEVELS.ADMIN,
      LEVELS.PROFISSIONAL_EDUCACAO,
      LEVELS.PROFISSIONAL_SAUDE,
      LEVELS.PROFISSIONAL_NAPNE,
    ])(
      'should clear the server link and the three external fields, in the same write that clears the queue, when the student becomes the level %s',
      async (to) => {
        lockedAccount(LEVELS.ALUNO_ESTUDANTE);

        await service.update('novo@test.com', { roles: [to] });

        expect(tx.user.update).toHaveBeenCalledTimes(1);
        expect(updateData()).toMatchObject({ ...CLEARED, ...MANAGER_CLEARED });
      },
    );

    it('should keep the matrícula and the course while clearing the manager', async () => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_SAUDE],
      });

      expect(updateData()).toMatchObject(MANAGER_CLEARED);
      expect(updateData().enrollment_number).toBeUndefined();
      expect(updateData().course).toBeUndefined();
    });

    it.each([
      [
        'the level sent is the one the student already has',
        { roles: [LEVELS.ALUNO_ESTUDANTE] },
      ],
      ['the request has no level', { full_name: 'Outro nome' }],
    ])('should leave the manager alone when %s', async (_, dto) => {
      lockedAccount(LEVELS.ALUNO_ESTUDANTE);

      await service.update('novo@test.com', dto);

      for (const field of Object.keys(MANAGER_CLEARED)) {
        expect(updateData()).not.toHaveProperty(field);
      }
    });

    it.each([
      [LEVELS.ADMIN, LEVELS.ALUNO_ESTUDANTE],
      [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.ALUNO_ESTUDANTE],
      [LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFISSIONAL_EDUCACAO],
    ])(
      'should not write the student manager fields when the level %s becomes %s',
      async (from, to) => {
        lockedAccount(from);

        await service.update('novo@test.com', { roles: [to] });

        for (const field of Object.keys(MANAGER_CLEARED)) {
          expect(updateData()).not.toHaveProperty(field);
        }
      },
    );
  });

  // O servidor que deixa os níveis 3 e 5 não pode continuar como responsável
  // pedagógico. A limpeza roda na transação do update, com a linha dele já
  // travada, para que um vínculo gravado ao mesmo tempo não escape dela.
  describe('update, estudantes do responsável pedagógico', () => {
    const CLEAR_LINKS = {
      where: { pedagogical_manager_id: 7 },
      data: { pedagogical_manager_id: null },
    };

    it.each([
      ['Profissional de Educação', LEVELS.PROFISSIONAL_EDUCACAO],
      ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
    ])(
      'should unlink the students when the %s leaves the manager levels',
      async (_, from) => {
        lockedAccount(from);

        await service.update('novo@test.com', {
          roles: [LEVELS.PROFISSIONAL_SAUDE],
        });

        expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
        expect(tx.user.updateMany).toHaveBeenCalledWith(CLEAR_LINKS);
      },
    );

    it.each([LEVELS.ADMIN, LEVELS.ALUNO_ESTUDANTE])(
      'should unlink the students when the Education professional becomes the level %s',
      async (to) => {
        lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);

        await service.update('novo@test.com', { roles: [to] });

        expect(tx.user.updateMany).toHaveBeenCalledWith(CLEAR_LINKS);
      },
    );

    it('should unlink the students before updating the account, inside the transaction', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_SAUDE],
      });

      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.updateMany.mock.invocationCallOrder[0],
      );
      expect(tx.user.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        tx.user.update.mock.invocationCallOrder[0],
      );
    });

    it.each([
      [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE],
      [LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFISSIONAL_EDUCACAO],
    ])(
      'should keep the students linked when the level %s changes to %s, which is still a manager level',
      async (from, to) => {
        lockedAccount(from);

        await service.update('novo@test.com', { roles: [to] });

        expect(tx.user.updateMany).not.toHaveBeenCalled();
      },
    );

    it.each([
      [
        LEVELS.PROFISSIONAL_EDUCACAO,
        { roles: [LEVELS.PROFISSIONAL_EDUCACAO] },
      ],
      [LEVELS.PROFISSIONAL_EDUCACAO, { full_name: 'Outro nome' }],
      [LEVELS.PROFISSIONAL_NAPNE, { roles: [LEVELS.PROFISSIONAL_NAPNE] }],
    ])(
      'should keep the students linked when the level %s does not change',
      async (current, dto) => {
        lockedAccount(current);

        await service.update('novo@test.com', dto);

        expect(tx.user.updateMany).not.toHaveBeenCalled();
      },
    );

    it.each([
      [LEVELS.ADMIN, LEVELS.PROFISSIONAL_EDUCACAO],
      [LEVELS.ALUNO_ESTUDANTE, LEVELS.PROFISSIONAL_NAPNE],
      [LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFISSIONAL_EDUCACAO],
      [LEVELS.ADMIN, LEVELS.PROFISSIONAL_SAUDE],
    ])(
      'should not touch any student when the level %s changes to %s',
      async (from, to) => {
        lockedAccount(from);

        await service.update('novo@test.com', { roles: [to] });

        expect(tx.user.updateMany).not.toHaveBeenCalled();
      },
    );

    it('should unlink nothing when a NAPNE with students in service is refused', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_NAPNE);
      tx.user.count.mockResolvedValue(2);

      await expect(
        service.update('novo@test.com', {
          roles: [LEVELS.PROFISSIONAL_SAUDE],
        }),
      ).rejects.toThrow(new ConflictException(BUSY_NAPNE_MESSAGE));

      expect(tx.user.updateMany).not.toHaveBeenCalled();
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
        roles: [LEVELS.PROFISSIONAL_SAUDE],
      });

      expect(events).toEqual(['update', 'commit', 'revoke']);
      expect(sessions.revokeAllFromUser).toHaveBeenCalledWith(7);
    });

    it('should not revoke the sessions when the sent level is the current one', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_SAUDE);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_SAUDE],
      });

      expect(sessions.revokeAllFromUser).not.toHaveBeenCalled();
    });

    it('should not revoke the sessions when the transaction fails', async () => {
      lockedAccount(LEVELS.PROFISSIONAL_EDUCACAO);
      tx.user.update.mockRejectedValue(new Error('conexão perdida'));

      await expect(
        service.update('novo@test.com', {
          roles: [LEVELS.PROFISSIONAL_SAUDE],
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
          roles: [LEVELS.PROFISSIONAL_SAUDE],
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
        roles: [LEVELS.PROFISSIONAL_SAUDE],
      });

      expect(updateData()).toMatchObject({ service_capacity: null });
    });

    it('should let a NAPNE with students in service keep the level it already has', async () => {
      tx.user.count.mockResolvedValue(2);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_NAPNE],
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
        roles: [LEVELS.PROFISSIONAL_NAPNE],
        service_capacity: 2,
      });

      expect(updateData()).toMatchObject({
        roles: [LEVELS.PROFISSIONAL_NAPNE],
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
          roles: [LEVELS.PROFISSIONAL_SAUDE],
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

  describe('papéis combinados', () => {
    const NAPNE_AEE = [LEVELS.PROFISSIONAL_NAPNE, LEVELS.PROFESSOR_AEE];

    it('should not queue an account that combines professional roles', async () => {
      await service.create({
        full_name: 'Novo',
        cpf: '12345678900',
        email: 'novo@test.com',
        roles: [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE],
      } as any);

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.roles).toEqual([
        LEVELS.PROFISSIONAL_EDUCACAO,
        LEVELS.PROFESSOR_AEE,
      ]);
      expect(data).not.toHaveProperty('service_status');
    });

    it('should answer 409 when the account loses the NAPNE role and keeps the AEE one while it has students in service', async () => {
      lockedAccount(NAPNE_AEE);
      tx.user.count.mockResolvedValue(2);

      await expect(
        service.update('novo@test.com', { roles: [LEVELS.PROFESSOR_AEE] }),
      ).rejects.toThrow(new ConflictException(BUSY_NAPNE_MESSAGE));

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 409 when an Education + NAPNE account becomes only Education', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE]);
      tx.user.count.mockResolvedValue(1);

      await expect(
        service.update('novo@test.com', {
          roles: [LEVELS.PROFISSIONAL_EDUCACAO],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should let the NAPNE with students in service lose only the AEE role, keeping the capacity', async () => {
      lockedAccount(NAPNE_AEE);
      tx.user.count.mockResolvedValue(2);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_NAPNE],
      });

      expect(updateData().roles).toEqual([LEVELS.PROFISSIONAL_NAPNE]);
      expect(updateData().service_capacity).toBeUndefined();
      expect(tx.user.count).not.toHaveBeenCalled();
    });

    it('should clear the capacity of the account that loses the NAPNE role', async () => {
      lockedAccount(NAPNE_AEE);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFESSOR_AEE],
      });

      expect(updateData().service_capacity).toBeNull();
    });

    it('should unlink the students when the account loses every manager role', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE]);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_SAUDE, LEVELS.PROFESSOR_AEE],
      });

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { pedagogical_manager_id: 7 },
        data: { pedagogical_manager_id: null },
      });
    });

    it('should keep the students linked while one manager role remains', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE]);

      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_NAPNE],
      });

      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('should revoke the sessions when only the order-insensitive set changes, and not when it is the same set', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE]);
      await service.update('novo@test.com', {
        roles: [LEVELS.PROFESSOR_AEE, LEVELS.PROFISSIONAL_EDUCACAO],
      });
      expect(sessions.revokeAllFromUser).not.toHaveBeenCalled();

      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE]);
      await service.update('novo@test.com', {
        roles: [LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_SAUDE],
      });
      expect(sessions.revokeAllFromUser).toHaveBeenCalledWith(7);
    });

    it('should answer 400 for a capacity on an account without the NAPNE role', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFESSOR_AEE]);

      await expect(
        service.update('novo@test.com', { service_capacity: 3 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should accept a capacity on an account that has the NAPNE role among others', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE]);

      await service.update('novo@test.com', { service_capacity: 3 });

      expect(updateData().service_capacity).toBe(3);
    });

    it('should answer 409 and delete nothing for an Education + NAPNE account with students in service', async () => {
      lockedAccount([LEVELS.PROFISSIONAL_EDUCACAO, LEVELS.PROFISSIONAL_NAPNE]);
      tx.user.count.mockResolvedValue(1);

      await expect(service.remove(7)).rejects.toThrow(ConflictException);

      expect(tx.user.delete).not.toHaveBeenCalled();
    });
  });
});
