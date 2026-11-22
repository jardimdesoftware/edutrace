import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

// Limita a consulta da agenda: cobre um mês com folga e impede varrer tudo.
export const APPOINTMENTS_MAX_RANGE_DAYS = 62;
const DAY_MS = 24 * 60 * 60 * 1000;

// O estudante sai só com o nome e o e-mail; o User inteiro traria CPF e hash.
const APPOINTMENT_SELECT = {
  id: true,
  starts_at: true,
  ends_at: true,
  notes: true,
  student: { select: { id: true, full_name: true, email: true } },
} satisfies Prisma.AeeAppointmentSelect;

// Estudante que o professor atende agora.
const attendedBy = (teacherId: number): Prisma.UserWhereInput => ({
  aee_responsible_id: teacherId,
  service_status: ServiceStatus.IN_SERVICE,
  deleted_at: null,
});

@Injectable()
export class AeeAppointmentsService {
  constructor(private prisma: PrismaService) {}

  // Só os horários de estudantes que o professor ainda atende: quem foi
  // reatribuído a outro professor sai da agenda.
  list(teacherId: number, from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);

    if (end <= start) {
      throw new BadRequestException('O campo to deve ser posterior a from.');
    }
    if (
      end.getTime() - start.getTime() >
      APPOINTMENTS_MAX_RANGE_DAYS * DAY_MS
    ) {
      throw new BadRequestException(
        `O período aceita no máximo ${APPOINTMENTS_MAX_RANGE_DAYS} dias.`,
      );
    }

    return this.prisma.aeeAppointment.findMany({
      where: {
        id_teacher: teacherId,
        starts_at: { gte: start, lt: end },
        student: attendedBy(teacherId),
      },
      orderBy: { starts_at: 'asc' },
      select: APPOINTMENT_SELECT,
    });
  }

  students(teacherId: number) {
    return this.prisma.user.findMany({
      where: attendedBy(teacherId),
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true, email: true },
    });
  }

  async create(teacherId: number, dto: CreateAppointmentDto) {
    const { start, end } = this.period(dto.starts_at, dto.ends_at);
    await this.assertAttends(teacherId, dto.id_student);
    await this.assertFree(teacherId, start, end);

    return this.prisma.aeeAppointment.create({
      data: {
        id_teacher: teacherId,
        id_student: dto.id_student,
        starts_at: start,
        ends_at: end,
        notes: dto.notes?.trim() || null,
      },
      select: APPOINTMENT_SELECT,
    });
  }

  async update(teacherId: number, id: number, dto: UpdateAppointmentDto) {
    const current = await this.findOwned(teacherId, id);

    const { start, end } = this.period(
      dto.starts_at ?? current.starts_at.toISOString(),
      dto.ends_at ?? current.ends_at.toISOString(),
    );
    const studentId = dto.id_student ?? current.id_student;

    if (studentId !== current.id_student) {
      await this.assertAttends(teacherId, studentId);
    }
    await this.assertFree(teacherId, start, end, id);

    return this.prisma.aeeAppointment.update({
      where: { id },
      data: {
        id_student: studentId,
        starts_at: start,
        ends_at: end,
        ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
      },
      select: APPOINTMENT_SELECT,
    });
  }

  async remove(teacherId: number, id: number) {
    await this.findOwned(teacherId, id);
    await this.prisma.aeeAppointment.delete({ where: { id } });
  }

  // O horário de outro professor responde 404, igual ao inexistente, para não
  // confirmar que o id existe.
  private async findOwned(teacherId: number, id: number) {
    const found = await this.prisma.aeeAppointment.findFirst({
      where: { id, id_teacher: teacherId },
    });
    if (!found) {
      throw new NotFoundException('Horário não encontrado.');
    }
    return found;
  }

  private period(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= start) {
      throw new BadRequestException(
        'O fim do atendimento deve ser posterior ao início.',
      );
    }
    return { start, end };
  }

  private async assertAttends(teacherId: number, studentId: number) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, ...attendedBy(teacherId) },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Estudante não encontrado.');
    }
  }

  // Um professor não atende dois estudantes ao mesmo tempo.
  private async assertFree(
    teacherId: number,
    start: Date,
    end: Date,
    ignoreId?: number,
  ) {
    const clash = await this.prisma.aeeAppointment.findFirst({
      where: {
        id_teacher: teacherId,
        starts_at: { lt: end },
        ends_at: { gt: start },
        ...(ignoreId && { id: { not: ignoreId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException('Já existe um atendimento nesse horário.');
    }
  }
}
