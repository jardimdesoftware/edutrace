import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { LEVELS } from 'src/constants';
import { StudentsService } from './students.service';

// Quem pede o encerramento: o id da sessão (sub do token) e o nível atual.
export interface ServiceRequester {
  sub: number;
  id_level: number;
}

@Injectable()
export class ServiceQueueService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
  ) {}

  // Duas garantias, cada uma com o seu mecanismo:
  //  - o limite do NAPNE: a linha dele é travada com FOR UPDATE antes de contar
  //    os atendimentos. "Assumir" simultâneos do mesmo NAPNE se enfileiram nessa
  //    linha, e a contagem de cada um enxerga o que o anterior confirmou
  //    (READ COMMITTED, o padrão). Sem a trava, todos contariam antes do primeiro
  //    commit e passariam do limite;
  //  - o estudante: o UPDATE só casa com quem ainda está WAITING. Dois NAPNEs
  //    disputando o mesmo estudante travam a mesma linha dele, e o segundo
  //    reavalia a condição depois do commit do primeiro e não casa com nada.
  // O 404 e o 409 do estudante são decididos depois da transação: a consulta
  // usa outra conexão do pool, e dentro da transação, com o pool inteiro ocupado
  // por transações iguais, esperaria uma conexão que só volta quando elas acabam.
  async assume(email: string, napneId: number) {
    const assumed = await this.prisma.$transaction(async (tx) => {
      const [napne] = await tx.$queryRaw<{ service_capacity: number | null }[]>`
        SELECT "service_capacity" FROM "User"
        WHERE "id" = ${napneId} AND "id_level" = ${LEVELS.PROFISSIONAL_NAPNE}
        FOR UPDATE`;

      if (!napne) {
        throw new ForbiddenException('Nível de acesso insuficiente');
      }
      if (napne.service_capacity === null) {
        throw new ConflictException(
          'Seu limite de atendimentos ainda não foi definido pelo administrador.',
        );
      }

      const inService = await tx.user.count({
        where: {
          napne_responsible_id: napneId,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });
      if (inService >= napne.service_capacity) {
        throw new ConflictException('Você atingiu o limite de atendimentos.');
      }

      const { count } = await tx.user.updateMany({
        where: {
          email,
          id_level: LEVELS.ALUNO_ESTUDANTE,
          service_status: ServiceStatus.WAITING,
        },
        data: {
          service_status: ServiceStatus.IN_SERVICE,
          napne_responsible_id: napneId,
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

    return this.readStudent(email);
  }

  // O responsável continua gravado depois do encerramento, como histórico de
  // quem atendeu. A condição está no próprio UPDATE: só o administrador encerra
  // sem filtro, qualquer outro nível só encerra quem ele atende, e o status é
  // conferido na mesma operação.
  async close(email: string, requester: ServiceRequester) {
    const { count } = await this.prisma.user.updateMany({
      where: {
        email,
        id_level: LEVELS.ALUNO_ESTUDANTE,
        service_status: ServiceStatus.IN_SERVICE,
        ...(requester.id_level === LEVELS.ADMIN
          ? {}
          : { napne_responsible_id: requester.sub }),
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
            'Apenas o profissional NAPNE responsável ou o administrador encerra o atendimento.',
          )
        : new ConflictException('O estudante não está em atendimento.');
    }

    return this.readStudent(email);
  }

  // O estudante volta ao fim da fila: queued_at novo e sem responsável.
  async reopen(email: string) {
    const { count } = await this.prisma.user.updateMany({
      where: {
        email,
        id_level: LEVELS.ALUNO_ESTUDANTE,
        service_status: ServiceStatus.CLOSED,
      },
      data: {
        service_status: ServiceStatus.WAITING,
        queued_at: new Date(),
        napne_responsible_id: null,
        service_started_at: null,
        service_closed_at: null,
      },
    });

    if (count === 0) {
      await this.statusOf(email);
      throw new ConflictException('O estudante não está encerrado.');
    }

    return this.readStudent(email);
  }

  private async statusOf(email: string) {
    const student = await this.prisma.user.findFirst({
      where: { email, id_level: LEVELS.ALUNO_ESTUDANTE },
      select: { service_status: true },
    });

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student.service_status;
  }

  // O estudante excluído entre a transição e a leitura vira 404, e não uma
  // resposta 200 sem corpo.
  private async readStudent(email: string) {
    const student = await this.studentsService.findOne(email);

    if (!student) {
      throw new NotFoundException('Estudante não encontrado');
    }

    return student;
  }
}
