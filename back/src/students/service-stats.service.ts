import { Injectable } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';

export interface ProfessionalLoad {
  id: number;
  full_name: string;
  in_service: number;
  capacity: number | null;
  free: number | null;
}

export interface ServiceStats {
  totals: Record<ServiceStatus, number>;
  professionals: ProfessionalLoad[];
  queue: { size: number; oldest_queued_at: Date | null };
}

@Injectable()
export class ServiceStatsService {
  constructor(private prisma: PrismaService) {}

  // Tudo é contado no banco, sem carregar a lista de estudantes. As três
  // consultas rodam em paralelo e não formam um retrato único: um atendimento
  // assumido entre elas pode aparecer só em uma delas, e a próxima leitura do
  // painel já traz os números certos.
  async getStats(): Promise<ServiceStats> {
    const [byStatus, napnes, oldest] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['service_status'],
        where: { roles: { has: LEVELS.ALUNO_ESTUDANTE } },
        _count: { _all: true },
      }),
      // Seleção explícita: devolver o User inteiro levaria o hash da senha.
      // A ocupação usa o mesmo critério do limite em ServiceQueueService.assume
      // (responsável e IN_SERVICE), para o painel e a recusa do "assumir"
      // concordarem sobre quem está no limite.
      this.prisma.user.findMany({
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
      }),
      this.prisma.user.aggregate({
        _min: { queued_at: true },
        where: {
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          service_status: ServiceStatus.WAITING,
        },
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
      professionals: napnes.map((napne) => this.toProfessionalLoad(napne)),
      queue: { size: totals.WAITING, oldest_queued_at: oldest._min.queued_at },
    };
  }

  // Capacidade nula é limite ainda não definido: não há vaga a informar. Com a
  // capacidade reduzida abaixo da ocupação, as vagas ficam em zero, nunca negativas.
  private toProfessionalLoad(napne: {
    id: number;
    full_name: string;
    service_capacity: number | null;
    _count: { napne_students: number };
  }): ProfessionalLoad {
    const inService = napne._count.napne_students;
    const capacity = napne.service_capacity;

    return {
      id: napne.id,
      full_name: napne.full_name,
      in_service: inService,
      capacity,
      free: capacity === null ? null : Math.max(capacity - inService, 0),
    };
  }
}
