import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from 'src/sessions/sessions.service';
import { PrismaService } from 'src/database/prisma.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: PrismaService;

  const sessao = {
    id: 1,
    jti: 'sessao-1',
    id_user: 7,
    ip: '10.0.0.1',
    user_agent: 'jest',
    created_at: new Date(),
    last_used_at: new Date(),
    revoked_at: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: PrismaService,
          useValue: {
            session: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should store the session with its origin', async () => {
      jest.spyOn(prisma.session, 'create').mockResolvedValue(sessao);

      await service.create({
        jti: 'sessao-1',
        id_user: 7,
        ip: '10.0.0.1',
        user_agent: 'jest',
      });

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          jti: 'sessao-1',
          id_user: 7,
          ip: '10.0.0.1',
          user_agent: 'jest',
        },
      });
    });

    it('should store null when the origin is unknown', async () => {
      jest.spyOn(prisma.session, 'create').mockResolvedValue(sessao);

      await service.create({ jti: 'sessao-1', id_user: 7 });

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { jti: 'sessao-1', id_user: 7, ip: null, user_agent: null },
      });
    });
  });

  describe('findActive', () => {
    it('should look only for sessions that were not revoked', async () => {
      jest.spyOn(prisma.session, 'findFirst').mockResolvedValue(sessao);

      const result = await service.findActive('sessao-1');

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { jti: 'sessao-1', revoked_at: null },
      });
      expect(result).toEqual(sessao);
    });
  });

  describe('revokeByJti', () => {
    it('should revoke the session of that jti', async () => {
      jest.spyOn(prisma.session, 'updateMany').mockResolvedValue({ count: 1 });

      await service.revokeByJti('sessao-1');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { jti: 'sessao-1', revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
    });
  });

  describe('revokeAllFromUser', () => {
    it('should revoke every open session of the account', async () => {
      jest.spyOn(prisma.session, 'updateMany').mockResolvedValue({ count: 3 });

      await service.revokeAllFromUser(7);

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id_user: 7, revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
    });
  });

  describe('registerUse', () => {
    it('should not write when the session was used less than a minute ago', async () => {
      await service.registerUse({ id: 1, last_used_at: new Date() });

      expect(prisma.session.update).not.toHaveBeenCalled();
    });

    it('should refresh last_used_at after the interval', async () => {
      jest.spyOn(prisma.session, 'update').mockResolvedValue(sessao);

      await service.registerUse({
        id: 1,
        last_used_at: new Date(Date.now() - 61 * 1000),
      });

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { last_used_at: expect.any(Date) },
      });
    });
  });
});
