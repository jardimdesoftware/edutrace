import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { AEE_SERVICE_CAPACITY, LEVELS } from 'src/constants';
import { StudentsService } from './students.service';

// Quem pede o encerramento: o id da sessão (sub do token) e os papéis atuais.
export interface ServiceRequester {
  sub: number;
  roles: readonly number[];
}

@Injectable()
export class ServiceQueueService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  // Duas garantias, cada uma com o seu mecanismo:
  //  - o limite do Professor do AEE (AEE_SERVICE_CAPACITY): a linha dele é
  //    travada com FOR UPDATE antes de contar os atendimentos. "Assumir"
  //    simultâneos do mesmo professor se enfileiram nessa linha, e a contagem
  //    de cada um enxerga o que o anterior confirmou (READ COMMITTED, o padrão). Sem a trava, todos contariam antes do primeiro
  //    commit e passariam do limite;
  //  - o estudante: o UPDATE só casa com quem ainda está WAITING. Dois professores
  //    disputando o mesmo estudante travam a mesma linha dele, e o segundo
  //    reavalia a condição depois do commit do primeiro e não casa com nada.
  // O 404 e o 409 do estudante são decididos depois da transação: a consulta
  // usa outra conexão do pool, e dentro da transação, com o pool inteiro ocupado
  // por transações iguais, esperaria uma conexão que só volta quando elas acabam.
  async assume(
    email: string,
    aeeId: number,
    requesterRoles: readonly number[],
  ) {
    const assumed = await this.prisma.$transaction(async (tx) => {
      const [teacher] = await tx.$queryRaw<{ id: number }[]>`
        SELECT "id" FROM "User"
        WHERE "id" = ${aeeId} AND ${LEVELS.PROFESSOR_AEE} = ANY("roles")
        FOR UPDATE`;

      if (!teacher) {
        throw new ForbiddenException('Nível de acesso insuficiente');
      }

      const inService = await tx.user.count({
        where: {
          aee_responsible_id: aeeId,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });
      if (inService >= AEE_SERVICE_CAPACITY) {
        throw new ConflictException(
          `Você já atende o limite de ${AEE_SERVICE_CAPACITY} estudantes.`,
        );
      }

      const { count } = await tx.user.updateMany({
        where: {
          email,
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          deleted_at: null,
          service_status: ServiceStatus.WAITING,
        },
        data: {
          service_status: ServiceStatus.IN_SERVICE,
          aee_responsible_id: aeeId,
          service_started_at: new Date(),
          service_closed_at: null,
        },
      });

      return count === 1;
    });

    if (!assumed) {
      await this.studentsService.findOneOrFail({ email });
      throw new ConflictException('O estudante não está na fila de espera.');
    }

    return this.readStudent(email, requesterRoles);
  }

  // O responsável continua gravado depois do encerramento, como histórico de
  // quem atendeu. A condição está no próprio UPDATE: o Professor do AEE só
  // encerra quem ele atende, e o status é conferido na mesma operação.
  async close(email: string, requester: ServiceRequester) {
    const { count } = await this.prisma.user.updateMany({
      where: {
        email,
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
        service_status: ServiceStatus.IN_SERVICE,
        aee_responsible_id: requester.sub,
      },
      data: {
        service_status: ServiceStatus.CLOSED,
        service_closed_at: new Date(),
      },
    });

    if (count === 0) {
      const status = await this.statusOf(email);
      throw status === ServiceStatus.IN_SERVICE
        ? new ForbiddenException(
            'Apenas o Professor do AEE responsável encerra o atendimento.',
          )
        : new ConflictException('O estudante não está em atendimento.');
    }

    return this.readStudent(email, requester.roles);
  }

  // O estudante volta ao fim da fila: queued_at novo e sem responsável.
  async reopen(email: string, requesterRoles: readonly number[]) {
    const { count } = await this.prisma.user.updateMany({
      where: {
        email,
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
        service_status: ServiceStatus.CLOSED,
      },
      data: {
        service_status: ServiceStatus.WAITING,
        queued_at: new Date(),
        aee_responsible_id: null,
        service_started_at: null,
        service_closed_at: null,
      },
    });

    if (count === 0) {
      await this.statusOf(email);
      throw new ConflictException('O estudante não está encerrado.');
    }

    return this.readStudent(email, requesterRoles);
  }

  private async statusOf(email: string) {
    const student = await this.prisma.user.findFirst({
      where: {
        email,
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
      },
      select: { service_status: true },
    });

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student.service_status;
  }

  // O estudante excluído entre a transição e a leitura vira 404, e não uma
  // resposta 200 sem corpo. O select vem dos papéis de quem fez a transição.
  private async readStudent(email: string, requesterRoles: readonly number[]) {
    const student = await this.studentsService.findOne(email, requesterRoles);

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student;
  }
}
