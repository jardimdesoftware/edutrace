import { Test, TestingModule } from '@nestjs/testing';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import { ServiceStatsService } from 'src/students/service-stats.service';

const OLDEST = new Date('2026-10-01T09:30:00.000Z');

// Linha de profissional como o Prisma devolve: o IN_SERVICE vem da contagem
// filtrada da relação, e o password só está aqui para provar que não sai.
const napne = (
  id: number,
  full_name: string,
  service_capacity: number | null,
  inService: number,
) => ({
  id,
  full_name,
  service_capacity,
  password: 'hash-que-nao-pode-sair',
  _count: { napne_students: inService },
});

describe('ServiceStatsService', () => {
  let service: ServiceStatsService;
  let prisma: {
    user: { groupBy: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _min: { queued_at: null } }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceStatsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ServiceStatsService);
  });

  describe('totals', () => {
    it('should count the students of each status', async () => {
      prisma.user.groupBy.mockResolvedValue([
        { service_status: ServiceStatus.WAITING, _count: { _all: 3 } },
        { service_status: ServiceStatus.IN_SERVICE, _count: { _all: 4 } },
        { service_status: ServiceStatus.CLOSED, _count: { _all: 5 } },
      ]);

      const { totals } = await service.getStats();

      expect(totals).toEqual({ WAITING: 3, IN_SERVICE: 4, CLOSED: 5 });
    });

    it('should report zero for the statuses without students', async () => {
      prisma.user.groupBy.mockResolvedValue([
        { service_status: ServiceStatus.IN_SERVICE, _count: { _all: 2 } },
      ]);

      const { totals } = await service.getStats();

      expect(totals).toEqual({ WAITING: 0, IN_SERVICE: 2, CLOSED: 0 });
    });

    it('should report zero for every status when there are no students', async () => {
      const { totals } = await service.getStats();

      expect(totals).toEqual({ WAITING: 0, IN_SERVICE: 0, CLOSED: 0 });
    });

    it('should count in the database, grouped by status, without loading the students', async () => {
      await service.getStats();

      expect(prisma.user.groupBy).toHaveBeenCalledWith({
        by: ['service_status'],
        where: { roles: { has: LEVELS.ALUNO_ESTUDANTE } },
        _count: { _all: true },
      });
    });
  });

  describe('professionals', () => {
    it('should report the occupation and the free slots of each NAPNE', async () => {
      prisma.user.findMany.mockResolvedValue([
        napne(10, 'Ana', 3, 2),
        napne(11, 'Bruno', 5, 0),
        napne(12, 'Carla', 4, 4),
      ]);

      const { professionals } = await service.getStats();

      expect(professionals).toEqual([
        { id: 10, full_name: 'Ana', in_service: 2, capacity: 3, free: 1 },
        { id: 11, full_name: 'Bruno', in_service: 0, capacity: 5, free: 5 },
        { id: 12, full_name: 'Carla', in_service: 4, capacity: 4, free: 0 },
      ]);
    });

    it('should report free null when the capacity was never defined', async () => {
      prisma.user.findMany.mockResolvedValue([napne(10, 'Ana', null, 1)]);

      const { professionals } = await service.getStats();

      expect(professionals).toEqual([
        { id: 10, full_name: 'Ana', in_service: 1, capacity: null, free: null },
      ]);
    });

    it('should report zero free slots when the capacity was reduced below the occupation', async () => {
      prisma.user.findMany.mockResolvedValue([napne(10, 'Ana', 2, 5)]);

      const { professionals } = await service.getStats();

      expect(professionals[0]).toEqual({
        id: 10,
        full_name: 'Ana',
        in_service: 5,
        capacity: 2,
        free: 0,
      });
    });

    it('should report zero free slots for the capacity zero', async () => {
      prisma.user.findMany.mockResolvedValue([napne(10, 'Ana', 0, 0)]);

      const { professionals } = await service.getStats();

      expect(professionals[0]).toEqual({
        id: 10,
        full_name: 'Ana',
        in_service: 0,
        capacity: 0,
        free: 0,
      });
    });

    it('should return an empty list when there is no NAPNE professional', async () => {
      const { professionals } = await service.getStats();

      expect(professionals).toEqual([]);
    });

    it('should expose only id, name, occupation, capacity and free slots, never the password', async () => {
      prisma.user.findMany.mockResolvedValue([napne(10, 'Ana', 3, 1)]);

      const { professionals } = await service.getStats();

      expect(Object.keys(professionals[0])).toEqual([
        'id',
        'full_name',
        'in_service',
        'capacity',
        'free',
      ]);
    });

    it('should read the NAPNE level ordered by name, with an explicit select and the IN_SERVICE count of each one', async () => {
      await service.getStats();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { roles: { has: LEVELS.PROFISSIONAL_NAPNE } },
        orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          full_name: true,
          service_capacity: true,
          _count: {
            select: {
              napne_students: {
                where: { service_status: ServiceStatus.IN_SERVICE },
              },
            },
          },
        },
      });
    });
  });

  describe('queue', () => {
    it('should report the size of the queue and the oldest entry', async () => {
      prisma.user.groupBy.mockResolvedValue([
        { service_status: ServiceStatus.WAITING, _count: { _all: 3 } },
      ]);
      prisma.user.aggregate.mockResolvedValue({ _min: { queued_at: OLDEST } });

      const { queue } = await service.getStats();

      expect(queue).toEqual({ size: 3, oldest_queued_at: OLDEST });
    });

    it('should report an empty queue with oldest_queued_at null', async () => {
      const { queue } = await service.getStats();

      expect(queue).toEqual({ size: 0, oldest_queued_at: null });
    });

    it('should take the oldest entry only among the waiting students', async () => {
      await service.getStats();

      expect(prisma.user.aggregate).toHaveBeenCalledWith({
        _min: { queued_at: true },
        where: {
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          service_status: ServiceStatus.WAITING,
        },
      });
    });
  });
});
