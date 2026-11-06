import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReferralKind, ServiceStatus } from '@prisma/client';
import { AEE_SERVICE_CAPACITY, LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';

// Quem encaminha: o id e o nome da sessão, nunca do corpo da requisição.
export interface ReferralRequester {
  sub: number;
  name: string;
}

const STUDENT_NOT_FOUND = 'Estudante não encontrado.';
const TEACHER_NOT_FOUND = 'Professor do AEE não encontrado.';
const CLOSED_MESSAGE =
  'O atendimento deste estudante está encerrado. Reabra o atendimento antes de encaminhar.';
const SAME_TEACHER_MESSAGE = 'O estudante já está com este professor.';
const CHANGED_MESSAGE =
  'O estudante foi atualizado por outra pessoa. Recarregue e tente de novo.';

@Injectable()
export class AeeReferralsService {
  constructor(private prisma: PrismaService) {}

  // Encaminha o estudante a um Professor do AEE e já o atribui a ele, com as
  // mesmas garantias do "assumir" (ServiceQueueService): a linha do professor é
  // travada com FOR UPDATE antes de contar os atendimentos, então dois
  // encaminhamentos simultâneos ao mesmo professor se enfileiram e a contagem do
  // segundo enxerga o que o primeiro confirmou. O estudante e o professor
  // anterior, se houver, entram na mesma trava, em ordem de id, para evitar
  // impasse entre dois encaminhamentos cruzados.
  async refer(
    studentEmail: string,
    teacherId: number,
    requester: ReferralRequester,
  ) {
    // Leitura sem trava, só para saber quais linhas travar. A conferência de
    // verdade é a de depois da trava.
    const preview = await this.prisma.user.findFirst({
      where: {
        email: studentEmail,
        roles: { has: LEVELS.ALUNO_ESTUDANTE },
        deleted_at: null,
      },
      select: { id: true, aee_responsible_id: true },
    });

    if (!preview) {
      throw new NotFoundException(STUDENT_NOT_FOUND);
    }

    return this.prisma.$transaction(async (tx) => {
      const lockIds = [
        ...new Set(
          [preview.id, teacherId, preview.aee_responsible_id].filter(
            (id): id is number => typeof id === 'number',
          ),
        ),
      ].sort((a, b) => a - b);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(lockIds)}) ORDER BY "id" FOR UPDATE`;

      const student = await tx.user.findFirst({
        where: {
          id: preview.id,
          roles: { has: LEVELS.ALUNO_ESTUDANTE },
          deleted_at: null,
        },
        select: {
          id: true,
          full_name: true,
          service_status: true,
          aee_responsible_id: true,
        },
      });

      if (!student) {
        throw new NotFoundException(STUDENT_NOT_FOUND);
      }

      if (student.aee_responsible_id !== preview.aee_responsible_id) {
        throw new ConflictException(CHANGED_MESSAGE);
      }

      const teacher = await tx.user.findFirst({
        where: {
          id: teacherId,
          roles: { has: LEVELS.PROFESSOR_AEE },
          deleted_at: null,
        },
        select: { id: true, full_name: true },
      });

      if (!teacher) {
        throw new NotFoundException(TEACHER_NOT_FOUND);
      }

      if (student.service_status === ServiceStatus.CLOSED) {
        throw new ConflictException(CLOSED_MESSAGE);
      }

      const inService = student.service_status === ServiceStatus.IN_SERVICE;

      if (inService && student.aee_responsible_id === teacher.id) {
        throw new ConflictException(SAME_TEACHER_MESSAGE);
      }

      const occupied = await tx.user.count({
        where: {
          aee_responsible_id: teacher.id,
          service_status: ServiceStatus.IN_SERVICE,
        },
      });

      if (occupied >= AEE_SERVICE_CAPACITY) {
        throw new ConflictException(
          'Este professor já atende o limite de ' +
            AEE_SERVICE_CAPACITY +
            ' estudantes.',
        );
      }

      // Quem já está em atendimento só troca de professor: o início do
      // atendimento continua sendo o original.
      await tx.user.update({
        where: { id: student.id },
        data: inService
          ? { aee_responsible_id: teacher.id }
          : {
              service_status: ServiceStatus.IN_SERVICE,
              aee_responsible_id: teacher.id,
              service_started_at: new Date(),
              service_closed_at: null,
            },
      });

      const notices: Prisma.AeeReferralCreateManyInput[] = [
        {
          kind: ReferralKind.ASSIGNED,
          id_to: teacher.id,
          id_student: student.id,
          student_name: student.full_name,
          id_from: requester.sub,
          from_name: requester.name,
        },
      ];

      if (inService && student.aee_responsible_id) {
        notices.push({
          kind: ReferralKind.REMOVED,
          id_to: student.aee_responsible_id,
          id_student: student.id,
          student_name: student.full_name,
          id_from: requester.sub,
          from_name: requester.name,
        });
      }

      await tx.aeeReferral.createMany({ data: notices });

      return {
        student: { id: student.id, full_name: student.full_name },
        teacher: { id: teacher.id, full_name: teacher.full_name },
        previous_teacher_id: inService ? student.aee_responsible_id : null,
      };
    });
  }

  // Os avisos que o professor ainda não viu, do mais antigo para o mais novo.
  async pending(userId: number) {
    return this.prisma.aeeReferral.findMany({
      where: { id_to: userId, seen_at: null },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        kind: true,
        student_name: true,
        from_name: true,
        created_at: true,
      },
    });
  }

  // Só os avisos do próprio professor: o filtro por id_to está no UPDATE, então
  // um id de outro professor não casa com nada.
  async markSeen(userId: number, ids?: number[]) {
    const { count } = await this.prisma.aeeReferral.updateMany({
      where: {
        id_to: userId,
        seen_at: null,
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { seen_at: new Date() },
    });

    return { marked: count };
  }
}
