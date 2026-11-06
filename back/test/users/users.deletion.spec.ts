import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { MailService } from 'src/mail/mail.service';
import {
  REAUTH_REQUIRED_MESSAGE,
  UsersService,
  WRONG_PASSWORD_MESSAGE,
} from 'src/users/users.service';
import {
  LEVELS,
  REAUTH_WINDOW_MS,
  USER_DELETION_GRACE_DAYS,
} from 'src/constants';
import { PUBLIC_USER_SELECT } from 'src/users/users.select';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hash'),
  compare: jest.fn(),
}));

const NOW = new Date('2026-11-03T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const ADMIN_ID = 1;
const TARGET_ID = 7;

const STUDENT = {
  id: TARGET_ID,
  email: 'aluno@test.com',
  roles: [LEVELS.ALUNO_ESTUDANTE],
  deleted_at: null,
};

describe('UsersService, exclusão com carência', () => {
  let service: UsersService;
  let tx: {
    $queryRaw: jest.Mock;
    user: {
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    session: { updateMany: jest.Mock };
    comments: { count: jest.Mock };
    caseStudy: { count: jest.Mock };
    aeePlan: { count: jest.Mock };
    peiEntry: { count: jest.Mock };
    screening: { count: jest.Mock };
    anamnesis: { count: jest.Mock };
    formRevision: { count: jest.Mock };
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let sessions: { findActive: jest.Mock; grantReauth: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn().mockResolvedValue(STUDENT),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({ id: TARGET_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn().mockResolvedValue({ id: TARGET_ID }),
      },
      session: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      comments: { count: jest.fn().mockResolvedValue(0) },
      caseStudy: { count: jest.fn().mockResolvedValue(0) },
      aeePlan: { count: jest.fn().mockResolvedValue(0) },
      peiEntry: { count: jest.fn().mockResolvedValue(0) },
      screening: { count: jest.fn().mockResolvedValue(0) },
      anamnesis: { count: jest.fn().mockResolvedValue(0) },
      formRevision: { count: jest.fn().mockResolvedValue(0) },
    };
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: TARGET_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };
    sessions = {
      findActive: jest.fn().mockResolvedValue(null),
      grantReauth: jest.fn().mockResolvedValue({ count: 1 }),
    };
    (compare as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionsService, useValue: sessions },
        { provide: MailService, useValue: {} },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('confirmDeletionCredentials', () => {
    const requester = { sub: ADMIN_ID, jti: 'sessao-admin' };

    it('should accept the open window without asking for the password', async () => {
      const until = new Date(NOW.getTime() + 60_000);
      sessions.findActive.mockResolvedValue({ reauth_until: until });

      await expect(
        service.confirmDeletionCredentials(requester, {}),
      ).resolves.toBe(until);

      expect(compare).not.toHaveBeenCalled();
      expect(sessions.grantReauth).not.toHaveBeenCalled();
    });

    it.each([
      ['there is no window', null],
      ['the window ended', new Date(NOW.getTime() - 1)],
      ['the window ends right now', new Date(NOW.getTime())],
    ])(
      'should answer 401 asking for the password when %s',
      async (_, reauth_until) => {
        sessions.findActive.mockResolvedValue({ reauth_until });

        await expect(
          service.confirmDeletionCredentials(requester, {}),
        ).rejects.toThrow(new UnauthorizedException(REAUTH_REQUIRED_MESSAGE));

        expect(compare).not.toHaveBeenCalled();
      },
    );

    it('should answer 401 and open no window for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({ password: 'hash-admin' });
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.confirmDeletionCredentials(requester, {
          currentPassword: 'errada',
          remember: true,
        }),
      ).rejects.toThrow(new UnauthorizedException(WRONG_PASSWORD_MESSAGE));

      expect(compare).toHaveBeenCalledWith('errada', 'hash-admin');
      expect(sessions.grantReauth).not.toHaveBeenCalled();
    });

    it('should answer 401 when the account of the session does not exist anymore', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.confirmDeletionCredentials(requester, {
          currentPassword: 'senha',
        }),
      ).rejects.toThrow(new UnauthorizedException(WRONG_PASSWORD_MESSAGE));
    });

    it('should accept the right password and open no window without remember', async () => {
      prisma.user.findUnique.mockResolvedValue({ password: 'hash-admin' });
      (compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.confirmDeletionCredentials(requester, {
          currentPassword: 'certa',
        }),
      ).resolves.toBeNull();

      expect(sessions.grantReauth).not.toHaveBeenCalled();
    });

    it('should open the window of 10 minutes on this session with remember', async () => {
      prisma.user.findUnique.mockResolvedValue({ password: 'hash-admin' });
      (compare as jest.Mock).mockResolvedValue(true);

      const until = await service.confirmDeletionCredentials(requester, {
        currentPassword: 'certa',
        remember: true,
      });

      expect(REAUTH_WINDOW_MS).toBe(10 * 60 * 1000);
      expect(until).toEqual(new Date(NOW.getTime() + REAUTH_WINDOW_MS));
      expect(sessions.grantReauth).toHaveBeenCalledWith('sessao-admin', until);
    });
  });

  describe('markForDeletion', () => {
    it('should lock the target and every administrator, in the order of the id', async () => {
      await service.markForDeletion(TARGET_ID, ADMIN_ID);

      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      const sql = strings.join('?');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('ORDER BY "id"');
      expect(sql).toContain('ANY("roles")');
      expect(values).toEqual([TARGET_ID, LEVELS.ADMIN]);
    });

    it('should revoke the sessions and stamp deleted_at, answering with the public select', async () => {
      const result = await service.markForDeletion(TARGET_ID, ADMIN_ID);

      expect(tx.session.updateMany).toHaveBeenCalledWith({
        where: { id_user: TARGET_ID, revoked_at: null },
        data: { revoked_at: NOW },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        select: PUBLIC_USER_SELECT,
        where: { id: TARGET_ID },
        data: { deleted_at: NOW },
      });
      expect(result).toEqual({ id: TARGET_ID });
    });

    it('should answer 404 and change nothing for a missing user', async () => {
      tx.user.findUnique.mockResolvedValue(null);

      await expect(
        service.markForDeletion(TARGET_ID, ADMIN_ID),
      ).rejects.toThrow(NotFoundException);

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });

    it('should answer 409 for a user already marked', async () => {
      tx.user.findUnique.mockResolvedValue({ ...STUDENT, deleted_at: NOW });

      await expect(
        service.markForDeletion(TARGET_ID, ADMIN_ID),
      ).rejects.toThrow(
        new ConflictException('Este usuário já está marcado para exclusão.'),
      );

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 409 when the administrator marks his own account', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        id: ADMIN_ID,
        roles: [LEVELS.ADMIN],
      });
      tx.user.count.mockResolvedValue(3);

      await expect(service.markForDeletion(ADMIN_ID, ADMIN_ID)).rejects.toThrow(
        new ConflictException('Você não pode excluir a própria conta.'),
      );

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should answer 409 for the last administrator', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        roles: [LEVELS.ADMIN],
      });
      tx.user.count.mockResolvedValue(0);

      await expect(service.markForDeletion(TARGET_ID, 99)).rejects.toThrow(
        new ConflictException('Não é possível excluir o último administrador.'),
      );

      expect(tx.user.count).toHaveBeenCalledWith({
        where: {
          roles: { has: LEVELS.ADMIN },
          deleted_at: null,
          id: { not: TARGET_ID },
        },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('should mark an administrator when another one remains', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        roles: [LEVELS.ADMIN],
      });
      tx.user.count.mockImplementation(({ where }) =>
        Promise.resolve(where.roles ? 1 : 0),
      );

      await service.markForDeletion(TARGET_ID, 99);

      expect(tx.user.update).toHaveBeenCalledTimes(1);
    });

    it('should not count the administrators for a target that is not one', async () => {
      await service.markForDeletion(TARGET_ID, ADMIN_ID);

      const adminCounts = tx.user.count.mock.calls.filter(
        ([args]) => args?.where?.roles?.has === LEVELS.ADMIN,
      );
      expect(adminCounts).toHaveLength(0);
    });

    it('should answer 409 for an AEE teacher with students in service', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        roles: [LEVELS.PROFESSOR_AEE],
      });
      tx.user.count.mockResolvedValue(2);

      await expect(
        service.markForDeletion(TARGET_ID, ADMIN_ID),
      ).rejects.toThrow(ConflictException);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it.each([
      'comments',
      'caseStudy',
      'aeePlan',
      'peiEntry',
      'screening',
      'anamnesis',
      'formRevision',
    ] as const)(
      'should start the grace period of a user that has %s, without refusing',
      async (table) => {
        tx[table].count.mockResolvedValue(1);

        await service.markForDeletion(TARGET_ID, ADMIN_ID);

        expect(tx.user.update).toHaveBeenCalledWith({
          select: PUBLIC_USER_SELECT,
          where: { id: TARGET_ID },
          data: { deleted_at: NOW },
        });
      },
    );

    it('should send the students of the user back to no pedagogical manager', async () => {
      await service.markForDeletion(TARGET_ID, ADMIN_ID);

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { pedagogical_manager_id: TARGET_ID },
        data: { pedagogical_manager_id: null },
      });
    });

    it('should not touch the students when the user is refused', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        id: ADMIN_ID,
        roles: [LEVELS.ADMIN],
      });
      tx.user.count.mockResolvedValue(3);

      await expect(service.markForDeletion(ADMIN_ID, ADMIN_ID)).rejects.toThrow(
        ConflictException,
      );

      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should clear deleted_at only of a marked user and answer with the public select', async () => {
      const result = await service.restore(TARGET_ID);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: TARGET_ID, deleted_at: { not: null } },
        data: { deleted_at: null, deactivated_at: null },
      });
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        select: PUBLIC_USER_SELECT,
        where: { id: TARGET_ID },
      });
      expect(result).toEqual({ id: TARGET_ID });
    });

    it('should answer 409 for a user that is not marked', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.count.mockResolvedValue(1);

      await expect(service.restore(TARGET_ID)).rejects.toThrow(
        new ConflictException('Este usuário não está marcado para exclusão.'),
      );
    });

    it('should answer 404 for a user that does not exist', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.restore(TARGET_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    const limit = new Date(NOW.getTime() - USER_DELETION_GRACE_DAYS * DAY_MS);

    it('should delete a marked user whose period ended', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        deleted_at: new Date(limit.getTime() - 1),
      });

      await service.remove(TARGET_ID, limit);

      expect(tx.user.delete).toHaveBeenCalledWith({
        select: PUBLIC_USER_SELECT,
        where: { id: TARGET_ID },
      });
    });

    it.each([
      ['restored (deleted_at cleared)', null],
      ['marked inside the period', new Date(limit.getTime() + 1)],
    ])('should delete nothing for a user %s', async (_, deleted_at) => {
      tx.user.findUnique.mockResolvedValue({ ...STUDENT, deleted_at });

      await expect(service.remove(TARGET_ID, limit)).resolves.toBeNull();

      expect(tx.user.delete).not.toHaveBeenCalled();
    });

    it('should answer 409 and delete nothing when the user got records after being marked', async () => {
      tx.user.findUnique.mockResolvedValue({
        ...STUDENT,
        deleted_at: new Date(limit.getTime() - 1),
      });
      tx.comments.count.mockResolvedValue(1);

      await expect(service.remove(TARGET_ID, limit)).rejects.toThrow(
        ConflictException,
      );

      expect(tx.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('settleExpired', () => {
    const limit = new Date(NOW.getTime() - USER_DELETION_GRACE_DAYS * DAY_MS);
    const expired = () => ({
      ...STUDENT,
      deleted_at: new Date(limit.getTime() - 1),
    });

    it('should delete the user that has no data', async () => {
      tx.user.findUnique.mockResolvedValue(expired());

      await expect(service.settleExpired(TARGET_ID, limit)).resolves.toBe(
        'deleted',
      );

      expect(tx.user.delete).toHaveBeenCalledTimes(1);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      'comments',
      'caseStudy',
      'aeePlan',
      'peiEntry',
      'screening',
      'anamnesis',
      'formRevision',
    ] as const)(
      'should deactivate, and never delete, a user that has %s',
      async (table) => {
        tx.user.findUnique.mockResolvedValue(expired());
        tx[table].count.mockResolvedValue(1);

        await expect(service.settleExpired(TARGET_ID, limit)).resolves.toBe(
          'deactivated',
        );

        expect(tx.user.delete).not.toHaveBeenCalled();
        expect(prisma.user.updateMany).toHaveBeenCalledWith({
          where: {
            id: TARGET_ID,
            deleted_at: { lte: limit },
            deactivated_at: null,
          },
          data: { deactivated_at: NOW },
        });
      },
    );

    it('should do nothing for a user restored in the meantime', async () => {
      tx.user.findUnique.mockResolvedValue({ ...STUDENT, deleted_at: null });

      await expect(service.settleExpired(TARGET_ID, limit)).resolves.toBeNull();

      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should report nothing when the user was restored between the check and the deactivation', async () => {
      tx.user.findUnique.mockResolvedValue(expired());
      tx.comments.count.mockResolvedValue(1);
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.settleExpired(TARGET_ID, limit)).resolves.toBeNull();
    });

    it('should let the refusal for an AEE teacher in service through, leaving him in the grace period', async () => {
      tx.user.findUnique.mockResolvedValue(expired());
      tx.user.count.mockResolvedValue(1);

      await expect(service.settleExpired(TARGET_ID, limit)).rejects.toThrow(
        ConflictException,
      );

      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('purgeExpired', () => {
    const limit = new Date(NOW.getTime() - USER_DELETION_GRACE_DAYS * DAY_MS);

    it('should look for the users marked 7 days ago or before that are not deactivated yet', async () => {
      expect(USER_DELETION_GRACE_DAYS).toBe(7);

      await expect(service.purgeExpired()).resolves.toEqual({
        deleted: 0,
        deactivated: 0,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deleted_at: { lte: limit }, deactivated_at: null },
        select: { id: true },
      });
    });

    it('should count what it deleted and what it deactivated, and go on after a failure', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);
      const settle = jest
        .spyOn(service, 'settleExpired')
        .mockResolvedValueOnce('deleted')
        .mockRejectedValueOnce(new ConflictException('em atendimento'))
        .mockResolvedValueOnce('deactivated')
        .mockResolvedValueOnce(null);
      const error = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      await expect(service.purgeExpired()).resolves.toEqual({
        deleted: 1,
        deactivated: 1,
      });

      expect(settle).toHaveBeenCalledTimes(4);
      expect(settle).toHaveBeenNthCalledWith(2, 2, limit);
      expect(error).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasLinkedData', () => {
    it('should count what the user wrote and what was written about him', async () => {
      await service.hasLinkedData(tx as never, {
        id: TARGET_ID,
        email: STUDENT.email,
      });

      const writtenOrAbout = {
        OR: [{ id_student: TARGET_ID }, { id_author: TARGET_ID }],
      };
      expect(tx.comments.count).toHaveBeenCalledWith({
        where: { OR: [{ id_user: TARGET_ID }, { id_author: TARGET_ID }] },
      });
      expect(tx.caseStudy.count).toHaveBeenCalledWith({
        where: writtenOrAbout,
      });
      expect(tx.aeePlan.count).toHaveBeenCalledWith({ where: writtenOrAbout });
      expect(tx.peiEntry.count).toHaveBeenCalledWith({
        where: writtenOrAbout,
      });
      expect(tx.formRevision.count).toHaveBeenCalledWith({
        where: writtenOrAbout,
      });
      expect(tx.screening.count).toHaveBeenCalledWith({
        where: { email: STUDENT.email },
      });
      expect(tx.anamnesis.count).toHaveBeenCalledWith({
        where: { email: STUDENT.email },
      });
    });

    it('should be false when nothing points at the user', async () => {
      await expect(
        service.hasLinkedData(tx as never, { id: TARGET_ID, email: 'a@x.com' }),
      ).resolves.toBe(false);
    });
  });

  describe('deletionPreview', () => {
    const counters = (found: number) => {
      const make = () => ({ count: jest.fn().mockResolvedValue(0) });
      Object.assign(prisma, {
        comments: { count: jest.fn().mockResolvedValue(found) },
        caseStudy: make(),
        aeePlan: make(),
        peiEntry: make(),
        screening: make(),
        anamnesis: make(),
        formRevision: make(),
      });
    };

    it('should say the account has data', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        email: 'a@x.com',
      });
      counters(1);

      await expect(service.deletionPreview(TARGET_ID)).resolves.toEqual({
        has_data: true,
      });
    });

    it('should say the account has no data', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: TARGET_ID,
        email: 'a@x.com',
      });
      counters(0);

      await expect(service.deletionPreview(TARGET_ID)).resolves.toEqual({
        has_data: false,
      });
    });

    it('should answer 404 for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deletionPreview(TARGET_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll por situação', () => {
    it('should hide the deactivated users by default', async () => {
      await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deactivated_at: null },
        select: PUBLIC_USER_SELECT,
      });
    });

    it('should list only the users in the grace period', async () => {
      await service.findAll('carencia');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deleted_at: { not: null }, deactivated_at: null },
        select: PUBLIC_USER_SELECT,
      });
    });

    it('should list only the deactivated users', async () => {
      await service.findAll('desativados');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deactivated_at: { not: null } },
        select: PUBLIC_USER_SELECT,
      });
    });
  });
});
