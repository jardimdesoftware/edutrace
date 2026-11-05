import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { PrismaService } from 'src/database/prisma.service';
import { AuthenticatedRequest } from 'src/comments/types/express';
import { STUDENT_RECORD_READERS } from 'src/constants';
import { hasAnyRole } from 'src/auth/roles';
import { StudentsService } from 'src/students/students.service';
import { FormType } from '@prisma/client';
import {
  FormRevisionsService,
  RevisionAuthor,
} from 'src/form-revisions/form-revisions.service';

@Injectable()
export class ScreeningsService {
  constructor(
    private prisma: PrismaService,
    private studentsService: StudentsService,
    private formRevisions: FormRevisionsService,
  ) {}

  async create(createScreeningDto: CreateScreeningDto, author: RevisionAuthor) {
    const student = await this.studentsService.findOneOrFail({
      email: createScreeningDto.email,
    });

    // A triagem e a versão 1 são gravadas juntas.
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.screening.create({ data: createScreeningDto });
      await this.formRevisions.recordCreation(
        tx,
        { formType: FormType.SCREENING, idStudent: student.id },
        created,
        author,
      );
      return created;
    });
  }

  async findAll() {
    const emails = await this.studentsService.findAllEmails();

    return this.prisma.screening.findMany({
      where: { email: { in: emails } },
    });
  }

  async findOne(email: string, request: AuthenticatedRequest) {
    const readsAnyStudent = hasAnyRole(
      request.user.roles,
      STUDENT_RECORD_READERS,
    );
    const isOwnRecord = request.user.email === email;

    if (!readsAnyStudent && !isOwnRecord) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta triagem',
      );
    }

    await this.studentsService.findOneOrFail({ email });

    return this.prisma.screening.findUnique({
      where: { email },
    });
  }

  async update(
    email: string,
    updateScreeningDto: Partial<CreateScreeningDto>,
    author: RevisionAuthor,
  ) {
    // O PATCH devolve o registro inteiro: o titular precisa ser estudante,
    // como na leitura. O DELETE fica sem a conferência para que registros
    // gravados para quem não é estudante continuem removíveis.
    const student = await this.studentsService.findOneOrFail({ email });

    const existing = await this.prisma.screening.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Triagem com email ${email} não encontrada`);
    }

    // A edição e a versão nova são gravadas juntas; a edição que passa do
    // teto de versões recebe 409 e a triagem não muda.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.screening.update({
        where: { email },
        data: updateScreeningDto,
      });
      await this.formRevisions.recordEdit(
        tx,
        { formType: FormType.SCREENING, idStudent: student.id },
        {
          before: existing,
          beforeAt: existing.updated_at ?? existing.created_at,
          after: updated,
        },
        author,
      );
      return updated;
    });
  }

  async remove(email: string) {
    const existing = await this.prisma.screening.findUnique({
      where: { email },
    });
    if (!existing) {
      throw new NotFoundException(`Triagem com email ${email} não encontrada`);
    }

    // Sem a conferência de que a conta é de estudante, como no resto do DELETE.
    const owner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.screening.delete({ where: { email } });
      if (owner) {
        await this.formRevisions.removeAll(tx, {
          formType: FormType.SCREENING,
          idStudent: owner.id,
        });
      }
    });
    return { message: `Triagem com email ${email} foi removida com sucesso` };
  }
}
