import { Injectable } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AEE_SERVICE_CAPACITY, LEVELS } from 'src/constants';

export interface ProfessionalLoad {
  id: number;
  full_name: string;
  in_service: number;
  capacity: number;
  free: number;
}

export interface ServiceStats {
  totals: Record<ServiceStatus, number>;
  professionals: ProfessionalLoad[];
  queue: {
    size: number;
    oldest_queued_at: Date | null;
    oldest_student: { id: number; full_name: string } | null;
  };
}

@Injectable()
export class ServiceStatsService {
  constructor(private prisma: PrismaService) {}

  // Tudo é contado no banco, sem carregar a lista de estudantes. As três
  // consultas rodam em paralelo e não formam um retrato único: um atendimento
  // assumido entre elas pode aparecer só em uma delas, e a próxima leitura do
  // painel já traz os números certos.
  async getStats(): Promise<ServiceStats> {
    const [byStatus, teachers, oldest] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['service_status'],
        where: { roles: { has: LEVELS.ALUNO_ESTUDANTE }, deleted_at: null },
        _count: { _all: true },
      }),
      // Seleção explícita: devolver o User inteiro levaria o hash da senha.
      // A ocupação usa o mesmo critério do limite em ServiceQueueService.assume
      // (responsável e IN_SERVICE), para o painel e a recusa do "assumir"
      // concordarem sobre quem está no limite.
      this.prisma.user.findMany({
        where: { roles: { has: LEVELS.PROFESSOR_AEE }, deleted_at: null },
        orderBy: [{ full_name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          full_name: true,
          _count: {
            select: {
              aee_students: {
                where: { service_status: ServiceStatus.IN_SERVICE },
              },
            },
          },
        },
      }),
      this.prisma.user.findFirst({
        where: {
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          deleted_at: null,
          service_status: ServiceStatus.WAITING,
          queued_at: { not: null },
        },
        orderBy: [{ queued_at: 'asc' }, { id: 'asc' }],
        select: { id: true, full_name: true, queued_at: true },
      }),
    ]);

    const countOf = (status: ServiceStatus): number =>
      byStatus.find((row) => row.service_status === status)?._count._all ?? 0;

    const totals = {
      WAITING: countOf(ServiceStatus.WAITING),
      IN_SERVICE: countOf(ServiceStatus.IN_SERVICE),
      CLOSED: countOf(ServiceStatus.CLOSED),
    };

    return {
      totals,
      professionals: teachers.map((teacher) =>
        this.toProfessionalLoad(teacher),
      ),
      queue: {
        size: totals.WAITING,
        oldest_queued_at: oldest?.queued_at ?? null,
        oldest_student: oldest
          ? { id: oldest.id, full_name: oldest.full_name }
          : null,
      },
    };
  }

  // O limite é fixo (AEE_SERVICE_CAPACITY). Com mais atendimentos que o limite
  // (contas anteriores à regra), as vagas ficam em zero, nunca negativas.
  private toProfessionalLoad(teacher: {
    id: number;
    full_name: string;
    _count: { aee_students: number };
  }): ProfessionalLoad {
    const inService = teacher._count.aee_students;

    return {
      id: teacher.id,
      full_name: teacher.full_name,
      in_service: inService,
      capacity: AEE_SERVICE_CAPACITY,
      free: Math.max(AEE_SERVICE_CAPACITY - inService, 0),
    };
  }
}
